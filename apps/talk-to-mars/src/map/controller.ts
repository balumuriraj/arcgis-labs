import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import Multipoint from "@arcgis/core/geometry/Multipoint.js";
import { getDenormalizedExtent } from "@arcgis/core/geometry/support/normalizeUtils.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import TimeExtent from "@arcgis/core/time/TimeExtent.js";
import TimeInterval from "@arcgis/core/time/TimeInterval.js";
import { createChartTables } from "../cards/charts";
import { findMission, type Mission } from "../data";
import { describeDrawings, makeObjectsMovable } from "./graphics";
import { missionLabels, type MarsScene } from "./mars";
import { loadGeodesy, marsPoint, wholeMars, type LatLon } from "./scale";
import { drawTraverse, loadTraverses } from "./traverses";
import { Travel } from "./travel";

export interface MarsElements {
  mars: HTMLArcgisSceneElement;
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
 * Waits for both scenes, reads the named features, and returns the map actions that the agent's
 * tools and the chat cards share. Everything the guide does to the map goes through this object.
 */
export async function createMarsApp(el: MarsElements, mars: MarsScene) {
  const { data } = mars;
  await Promise.all([
    mars.loadFeatures(),
    el.mars.viewOnReady(),
    el.earth.viewOnReady(),
    loadGeodesy(),
  ]);
  const view = el.mars.view;
  const missionsView = await view.whenLayerView(mars.missions);

  view.camera = wholeMars({ lat: 5, lon: -80 });
  // In Mars's coordinate system the SDK draws Mars's own thin, dusty atmosphere.
  view.environment.atmosphereEnabled = true;
  view.environment.starsEnabled = true;
  view.environment.lighting = { type: "virtual" };
  const earthView = el.earth.view;
  earthView.environment.atmosphereEnabled = true;
  earthView.environment.starsEnabled = true;
  earthView.environment.lighting = { type: "virtual" };

  // The mission layer's time settings drive the slider; mode and play rate are set in JSX.
  const { slider } = el;
  slider.fullTimeExtent = mars.missions.timeInfo?.fullTimeExtent;
  slider.stops = { interval: new TimeInterval({ value: 6, unit: "months" }) };
  const showAllTime = () => (slider.timeExtent = slider.fullTimeExtent);
  showAllTime();

  // Mission icons appear once the camera has arrived; on a distant planet they'd crowd the globe.
  const travel = new Travel(earthView, view, el.stage, (stage, world) => {
    mars.missions.opacity = stage === "arrived" && world === "mars" ? 1 : 0;
  });
  const charts = createChartTables(data, mars.features);
  const movable = makeObjectsMovable(view, mars.objects);

  /** Shared with the agent's context: what the current answer is about. */
  const state = {
    selected: [] as string[],
    othersHidden: false,
    focus: undefined as string | undefined,
  };
  let highlight: ResourceHandle | undefined;

  /** Label and highlight missions; `only` also hides every other mission. */
  function select(ids: string[], { only = false } = {}): void {
    const objectIds = ids.map((id) => findMission(data, id).objectId);
    state.selected = ids;
    state.othersHidden = only;
    highlight?.remove();
    highlight = objectIds.length
      ? missionsView.highlight(objectIds)
      : undefined;
    mars.missions.labelingInfo = ids.length <= 6 ? missionLabels(ids) : [];
    missionsView.filter = only
      ? new FeatureFilter(objectIds.length ? { objectIds } : { where: "1=0" })
      : null;
  }

  /** Stop what's going on and make sure Mars is showing, before a new map action. */
  async function prepare(): Promise<void> {
    await travel.toMars();
    await slider.stop();
  }

  /**
   * Close-up of one place, then a slow orbit around it. `scale` is a map scale.
   * Resolves `true` once the camera arrives, or `false` if something else took over the camera.
   */
  async function flyTo(
    p: LatLon,
    { scale = 50_000, tilt = 68, heading = 0 } = {},
  ): Promise<boolean> {
    const camera = { target: marsPoint(p), scale, tilt };
    try {
      await view.goTo({ ...camera, heading });
    } catch (error) {
      ignoreAbort(error);
      return false;
    }
    // Turn a little around the point. Dragging, zooming, or any new goTo stops it.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      view
        .goTo(
          { ...camera, heading: heading + 30 },
          { duration: 9000, easing: "ease-in-out" },
        )
        .catch(ignoreAbort);
    }
    return true;
  }

  /** Frame a set of places so all of them are in view. */
  function frame(points: LatLon[], { tilt = 0 } = {}): Promise<void> {
    if (!points.length) return Promise.resolve();
    const target = points.map((p) => marsPoint(p));
    if (points.length > 1) {
      // Shift longitudes into the shortest span across the antimeridian, so the camera doesn't
      // frame the long way around. The extent is in degrees, which works the same on Mars.
      const bounds = getDenormalizedExtent(
        new Multipoint({
          points: points.map((p) => [p.lon, p.lat]),
          spatialReference: { wkid: 4326 },
        }),
      );
      for (const point of target) {
        if (bounds && point.x < bounds.xmin) point.x += 360;
        else if (bounds && point.x > bounds.xmax) point.x -= 360;
      }
    }
    const scale = points.length === 1 ? { scale: 2_000_000 } : {};
    return view.goTo({ target, ...scale, tilt, heading: 0 }).catch(ignoreAbort);
  }

  return {
    data,
    view,
    slider,
    travel,
    mars,
    charts,
    state,
    assistant: el.assistant,
    select,
    prepare,
    flyTo,
    frame,
    showAllTime,

    /** Show Mars as it was at the end of `year`. */
    showYear(year: number): void {
      slider.timeExtent = new TimeExtent({
        start: null,
        end: new Date(`${year}-12-31T23:59:59Z`),
      });
    },

    /** Select a mission and fly down to it. Shared by cards and tools. */
    async visit(m: Mission): Promise<void> {
      await prepare();
      showAllTime();
      select([m.id]);
      state.focus = m.name;
      await flyTo(m);
    },

    /** Draw a rover's route and frame it. Returns the route's record. */
    async showTraverse(missionId: string) {
      const traverse = (await loadTraverses()).find(
        (t) => t.missionId === missionId,
      );
      if (!traverse)
        throw new Error(
          `No route for ${missionId}. Routes exist for Perseverance and Curiosity.`,
        );
      await prepare();
      showAllTime();
      select([missionId]);
      state.focus = `${traverse.rover}'s route`;
      const { all } = drawTraverse(mars.traverses, traverse);
      void frame(all, { tilt: 45 });
      return traverse;
    },

    /** Remove the guide's drawings and selections. The time slider stays where it is. */
    clear(): void {
      mars.featureMarks.removeAll();
      mars.traverses.removeAll();
      mars.objects.removeAll();
      select([]);
    },

    drawings: () =>
      describeDrawings(mars.featureMarks, mars.traverses, mars.objects),

    /** Card buttons route through the assistant so the guide answers in the chat. */
    ask(prompt: string): void {
      void el.assistant.submitMessage(prompt);
    },

    destroy(): void {
      travel.destroy();
      highlight?.remove();
      charts.missions.destroy();
      movable.remove();
    },
  };
}

export type MarsApp = Awaited<ReturnType<typeof createMarsApp>>;
