import Camera from "@arcgis/core/Camera.js";
import Point from "@arcgis/core/geometry/Point.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { MOON_RADIUS_M } from "../data";
import { wholeMoon, type LatLon } from "./scale";

export type World = "earth" | "moon";

const EARTH_RADIUS_M = 6_378_137;
const EARTH_HOME = { lat: 20, lon: -40 };
const MOON_HOME = { lat: 8, lon: 10 };
const LEAVE_MS = 2200;
const CROSSFADE_AT_MS = 1200;
const ARRIVE_MS = 3000;
/** Degrees of longitude the camera arcs around each globe while leaving and arriving. */
const SWEEP = 35;
/** How far toward a corner a globe slides, as a share of the view's size. */
const SLIDE = 0.95;

const earthCamera = (p: LatLon, altitudeM: number) =>
  new Camera({
    position: new Point({ longitude: p.lon, latitude: p.lat, z: altitudeM }),
    tilt: 0,
    heading: 0,
  });

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

type Corner = "bottom-left" | "top-right";

/**
 * Slides the globe toward a corner by animating the view's padding, which moves the view's center
 * on screen. Unlike a CSS transform, it moves only the 3D content; the widgets stay where they are.
 */
function slide(
  view: SceneView,
  corner: Corner,
  from: number,
  to: number,
  ms: number,
  ease: (t: number) => number,
): Promise<void> {
  const padding = (amount: number) => {
    const x = view.width * amount;
    const y = view.height * amount;
    // Padding on the top and right pushes the center down and left, and the other way around.
    return corner === "bottom-left"
      ? { top: y, right: x, bottom: 0, left: 0 }
      : { top: 0, right: 0, bottom: y, left: x };
  };
  if (reducedMotion()) {
    view.padding = padding(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      view.padding = padding(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ignoreAbort = (error: unknown) => {
  if (!isAbortError(error)) throw error;
};

/**
 * Two stacked scenes, Earth and the Moon, both loaded up front. A trip pulls the camera back
 * into space while the globe slides off toward one corner, crossfades the scenes (CSS on
 * `data-world`), and flies in on the other world as it slides in from the opposite corner.
 * Trips run one at a time; a request made during a trip waits for it.
 */
export class Travel {
  world: World = "earth";
  private queue: Promise<unknown> = Promise.resolve();
  private spinTimer: number | undefined;
  private destroyed = false;
  private readonly handles: ResourceHandle[];

  constructor(
    private readonly earth: SceneView,
    private readonly moon: SceneView,
    private readonly stage: HTMLElement,
    /** Called as a trip leaves, and again once the camera has arrived. */
    private readonly onTrip: (
      stage: "leaving" | "arrived",
      world: World,
    ) => void,
  ) {
    earth.camera = earthCamera(EARTH_HOME, EARTH_RADIUS_M * 2.6);
    this.spin();
    // Any touch on the globe stops the idle spin.
    this.handles = [
      earth.on("drag", () => this.stopSpin()),
      earth.on("mouse-wheel", () => this.stopSpin()),
    ];
  }

  destroy(): void {
    this.destroyed = true;
    this.stopSpin();
    for (const handle of this.handles) handle.remove();
  }

  toMoon(target: LatLon = MOON_HOME): Promise<void> {
    return this.enqueue(() => this.fly("moon", target));
  }

  toEarth(): Promise<void> {
    return this.enqueue(() => this.fly("earth", EARTH_HOME));
  }

  /** Travel to Earth if needed, then turn the globe to a place on it. */
  showOnEarth(p: LatLon): Promise<void> {
    return this.enqueue(async () => {
      await this.fly("earth", EARTH_HOME);
      this.stopSpin();
      await this.earth
        .goTo(earthCamera(p, EARTH_RADIUS_M * 1.4), { duration: 1800 })
        .catch(ignoreAbort);
    });
  }

  private enqueue(trip: () => Promise<void>): Promise<void> {
    const run = this.queue.then(trip);
    this.queue = run.catch(() => {});
    return run;
  }

  private async fly(world: World, target: LatLon): Promise<void> {
    if (this.destroyed || this.world === world) return;
    const toMoon = world === "moon";
    const [leaving, arriving] = toMoon
      ? [this.earth, this.moon]
      : [this.moon, this.earth];
    const { position } = leaving.camera;
    // Leave arcing east, and arrive from the west so the sweep carries on in the same direction.
    const away = {
      lat: position.latitude ?? 0,
      lon: (position.longitude ?? 0) + SWEEP,
    };
    const approach = { lat: target.lat, lon: target.lon - SWEEP };
    this.stopSpin();
    this.onTrip("leaving", world);

    // Earth leaves toward the bottom-left and the Moon arrives from the top-right; the way back mirrors it.
    const [leaveCorner, arriveCorner]: Corner[] = toMoon
      ? ["bottom-left", "top-right"]
      : ["top-right", "bottom-left"];

    const leave = Promise.all([
      leaving
        .goTo(
          toMoon
            ? earthCamera(away, EARTH_RADIUS_M * 14)
            : wholeMoon(away, MOON_RADIUS_M * 16),
          { duration: LEAVE_MS, easing: "cubic-in" },
        )
        .catch(ignoreAbort),
      slide(leaving, leaveCorner, 0, SLIDE, LEAVE_MS, easeIn),
    ]);
    if (!reducedMotion()) await wait(CROSSFADE_AT_MS);

    arriving.camera = toMoon
      ? wholeMoon(approach, MOON_RADIUS_M * 16)
      : earthCamera(approach, EARTH_RADIUS_M * 14);
    this.world = world;
    this.stage.dataset.world = world;

    const near = toMoon
      ? wholeMoon(target)
      : earthCamera(target, EARTH_RADIUS_M * 2.6);
    await Promise.all([
      leave,
      arriving
        .goTo(near, { duration: ARRIVE_MS, easing: "expo-out" })
        .catch(ignoreAbort),
      slide(arriving, arriveCorner, SLIDE, 0, ARRIVE_MS, easeOut),
    ]);
    // The world left behind is hidden now; center it again for the next trip.
    leaving.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!this.destroyed) this.onTrip("arrived", world);
    if (!toMoon) this.spin();
  }

  /** A slow idle rotation, so the opening shot isn't static. */
  private spin(): void {
    this.stopSpin();
    if (this.destroyed || reducedMotion()) return;
    this.spinTimer = window.setInterval(() => {
      const { earth } = this;
      if (this.world !== "earth" || earth.interacting || earth.animation)
        return;
      const camera = earth.camera.clone();
      camera.position.longitude =
        (((camera.position.longitude ?? 0) + 0.04 + 540) % 360) - 180;
      earth.camera = camera;
    }, 33);
  }

  private stopSpin(): void {
    window.clearInterval(this.spinTimer);
    this.spinTimer = undefined;
  }
}
