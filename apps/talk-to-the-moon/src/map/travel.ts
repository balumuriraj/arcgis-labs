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
const LEAVE_MS = 2000;
const CROSSFADE_AT_MS = 1100;
const ARRIVE_MS = 3200;

const earthCamera = (p: LatLon, altitudeM: number) =>
  new Camera({ position: new Point({ longitude: p.lon, latitude: p.lat, z: altitudeM }), tilt: 0, heading: 0 });

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ignoreAbort = (error: unknown) => {
  if (!isAbortError(error)) throw error;
};

/**
 * Two stacked scenes, Earth and the Moon, both loaded up front. A trip pulls the camera back
 * into space, crossfades the scenes (CSS on `data-world`), and flies in on the other world.
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
    private readonly onCrossfade: (world: World) => void,
  ) {
    earth.camera = earthCamera(EARTH_HOME, EARTH_RADIUS_M * 2.6);
    this.spin();
    // Any touch on the globe stops the idle spin.
    this.handles = [earth.on("drag", () => this.stopSpin()), earth.on("mouse-wheel", () => this.stopSpin())];
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
      await this.earth.goTo(earthCamera(p, EARTH_RADIUS_M * 1.4), { duration: 1800 }).catch(ignoreAbort);
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
    const [leaving, arriving] = toMoon ? [this.earth, this.moon] : [this.moon, this.earth];
    const { position } = leaving.camera;
    const from = { lat: position.latitude ?? 0, lon: position.longitude ?? 0 };
    this.stopSpin();

    const leave = leaving
      .goTo(toMoon ? earthCamera(from, EARTH_RADIUS_M * 14) : wholeMoon(from, MOON_RADIUS_M * 16), { duration: LEAVE_MS, easing: "ease-in" })
      .catch(ignoreAbort);
    if (!reducedMotion()) await wait(CROSSFADE_AT_MS);

    arriving.camera = toMoon ? wholeMoon(target, MOON_RADIUS_M * 16) : earthCamera(target, EARTH_RADIUS_M * 14);
    this.world = world;
    this.stage.dataset.world = world;
    this.onCrossfade(world);

    const near = toMoon ? wholeMoon(target) : earthCamera(target, EARTH_RADIUS_M * 2.6);
    await Promise.all([leave, arriving.goTo(near, { duration: ARRIVE_MS, easing: "cubic-out" }).catch(ignoreAbort)]);
    if (!toMoon) this.spin();
  }

  /** A slow idle rotation, so the opening shot isn't static. */
  private spin(): void {
    this.stopSpin();
    if (this.destroyed || reducedMotion()) return;
    this.spinTimer = window.setInterval(() => {
      const { earth } = this;
      if (this.world !== "earth" || earth.interacting || earth.animation) return;
      const camera = earth.camera.clone();
      camera.position.longitude = (((camera.position.longitude ?? 0) + 0.04 + 540) % 360) - 180;
      earth.camera = camera;
    }, 33);
  }

  private stopSpin(): void {
    window.clearInterval(this.spinTimer);
    this.spinTimer = undefined;
  }
}
