import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import Multipoint from "@arcgis/core/geometry/Multipoint.js";
import { getDenormalizedExtent } from "@arcgis/core/geometry/support/normalizeUtils.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import TimeExtent from "@arcgis/core/time/TimeExtent.js";
import TimeInterval from "@arcgis/core/time/TimeInterval.js";
import { createChartTables } from "../cards/charts";
import { findMission, loadData, type Mission } from "../data";
import type { EarthScene } from "./earth";
import { describeDrawings, makeObjectsMovable } from "./graphics";
import { missionLabels, missionRenderer, type MoonScene } from "./moon";
import { loadGeodesy, moonPoint, sceneMeters, wholeMoon, type LatLon } from "./scale";
import { Travel } from "./travel";

export interface MoonElements {
  moon: HTMLArcgisSceneElement;
  earth: HTMLArcgisSceneElement;
  slider: HTMLArcgisTimeSliderElement;
  assistant: HTMLArcgisAssistantElement;
  /** Holds both scenes; `data-world` crossfades between them. */
  stage: HTMLElement;
}

const ignoreAbort = (error: unknown) => {
  if (!isAbortError(error)) throw error;
};

/**
 * Waits for both scenes, reads the data, and returns the map actions that the agent's tools and
 * the chat cards share. Everything the guide does to the map goes through this object.
 */
export async function createMoonApp(el: MoonElements, moon: MoonScene, earth: EarthScene) {
  const [data] = await Promise.all([
    loadData(moon.missions, earth.launchSites),
    el.moon.viewOnReady(),
    el.earth.viewOnReady(),
    // Tool descriptions list the crater fields.
    moon.craters.load(),
    loadGeodesy(),
  ]);
  const view = el.moon.view;
  const missionsView = await view.whenLayerView(moon.missions);

  moon.missions.renderer = missionRenderer(data.missions);
  view.camera = wholeMoon({ lat: 8, lon: 10 });
  view.environment.atmosphereEnabled = false;
  view.environment.starsEnabled = true;
  view.environment.lighting = { type: "virtual" };
  view.environment.background = { type: "color", color: [4, 6, 12, 1] };
  const earthView = el.earth.view;
  earthView.environment.atmosphereEnabled = true;
  earthView.environment.starsEnabled = true;
  earthView.environment.lighting = { type: "virtual" };

  // The mission layer's time settings drive the slider; mode and play rate are set in JSX.
  const { slider } = el;
  slider.fullTimeExtent = moon.missions.timeInfo?.fullTimeExtent;
  slider.stops = { interval: new TimeInterval({ value: 2, unit: "months" }) };
  const showAllTime = () => (slider.timeExtent = slider.fullTimeExtent);
  showAllTime();

  // Mission icons appear once the camera has arrived; on a distant Moon they'd crowd the globe.
  const travel = new Travel(earthView, view, el.stage, (stage, world) => {
    moon.missions.opacity = stage === "arrived" && world === "moon" ? 1 : 0;
  });
  const charts = createChartTables(data, moon.craters);
  const movable = makeObjectsMovable(view, moon.objects);

  /** Shared with the agent's context: what the current answer is about. */
  const state = { selected: [] as string[], othersHidden: false, focus: undefined as string | undefined };
  let highlight: ResourceHandle | undefined;

  /** Label and highlight missions; `only` also hides every other mission. */
  function select(ids: string[], { only = false } = {}): void {
    const objectIds = ids.map((id) => findMission(data, id).objectId);
    state.selected = ids;
    state.othersHidden = only;
    highlight?.remove();
    highlight = objectIds.length ? missionsView.highlight(objectIds) : undefined;
    moon.missions.labelingInfo = ids.length <= 6 ? missionLabels(ids) : [];
    missionsView.filter = only ? new FeatureFilter(objectIds.length ? { objectIds } : { where: "1=0" }) : null;
  }

  /** Stop what's going on and make sure the Moon is showing, before a new map action. */
  async function prepare(): Promise<void> {
    moon.siteModel.hide();
    await travel.toMoon();
    await slider.stop();
  }

  /**
   * Close-up of one place, then a slow orbit around it. `scale` is a real lunar map scale.
   * Resolves `true` once the camera arrives, or `false` if something else took over the camera.
   */
  async function flyTo(p: LatLon, { scale = 50_000, tilt = 68, heading = 0 } = {}): Promise<boolean> {
    const camera = { target: moonPoint(p), scale: sceneMeters(scale), tilt };
    try {
      await view.goTo({ ...camera, heading });
    } catch (error) {
      ignoreAbort(error);
      return false;
    }
    // Turn a little around the point. Dragging, zooming, or any new goTo stops it.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      view.goTo({ ...camera, heading: heading + 30 }, { duration: 9000, easing: "ease-in-out" }).catch(ignoreAbort);
    }
    return true;
  }

  /** Frame a set of places so all of them are in view. */
  function frame(points: LatLon[]): Promise<void> {
    if (!points.length) return Promise.resolve();
    const target = points.map((p) => moonPoint(p));
    if (points.length > 1) {
      // Shift longitudes into the shortest span across the antimeridian, so the camera doesn't
      // frame the long way around. The extent is in degrees, which works the same on the Moon.
      const bounds = getDenormalizedExtent(new Multipoint({ points: points.map((p) => [p.lon, p.lat]), spatialReference: { wkid: 4326 } }));
      for (const point of target) {
        if (bounds && point.x < bounds.xmin) point.x += 360;
        else if (bounds && point.x > bounds.xmax) point.x -= 360;
      }
    }
    const scale = points.length === 1 ? { scale: sceneMeters(500_000) } : {};
    return view.goTo({ target, ...scale, tilt: 0, heading: 0 }).catch(ignoreAbort);
  }

  return {
    data,
    view,
    slider,
    travel,
    moon,
    charts,
    state,
    assistant: el.assistant,
    select,
    prepare,
    flyTo,
    frame,
    showAllTime,

    /** Show the Moon as it was at the end of `year`. */
    showYear(year: number): void {
      slider.timeExtent = new TimeExtent({ start: null, end: new Date(`${year}-12-31T23:59:59Z`) });
    },

    /** Select a mission, fly down to it, and stand its craft at the site. Shared by cards and tools. */
    async visit(m: Mission): Promise<void> {
      await prepare();
      showAllTime();
      select([m.id]);
      state.focus = m.name;
      if (await flyTo(m)) moon.siteModel.show(view, m);
    },

    /** Remove the guide's drawings and selections. The time slider stays where it is. */
    clear(): void {
      moon.craterMarks.removeAll();
      moon.objects.removeAll();
      select([]);
    },

    drawings: () => describeDrawings(moon.craterMarks, moon.objects),

    /** Card buttons route through the assistant so the guide answers in the chat. */
    ask(prompt: string): void {
      void el.assistant.submitMessage(prompt);
    },

    destroy(): void {
      travel.destroy();
      moon.siteModel.hide();
      highlight?.remove();
      charts.missions.destroy();
      movable.remove();
    },
  };
}

export type MoonApp = Awaited<ReturnType<typeof createMoonApp>>;
