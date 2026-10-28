import Graphic from "@arcgis/core/Graphic.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import LineSymbol3D from "@arcgis/core/symbols/LineSymbol3D.js";
import LineSymbol3DLayer from "@arcgis/core/symbols/LineSymbol3DLayer.js";
import { MARS_SR, type LatLon } from "./scale";

/**
 * Rover routes from the mission teams' published traverse maps (NASA/JPL-Caltech), simplified by
 * scripts/traverses.mjs into public/data/traverses.json. The file is about 1 MB, so it loads the
 * first time someone asks for a route.
 */

export interface Traverse {
  missionId: string;
  rover: string;
  source: string;
  /** When the file was built (YYYY-MM-DD); later drives aren't in it. */
  retrieved: string;
  drives: number;
  /** Total of the teams' per-drive distances. */
  drivenKm: number;
  lastSol: number | null;
  /** One [lon, lat] path per drive. */
  paths: number[][][];
}

let loading: Promise<Traverse[]> | undefined;

export function loadTraverses(): Promise<Traverse[]> {
  loading ??= fetch("/data/traverses.json").then((res) => {
    if (!res.ok) throw new Error(`Rover routes didn't load (${res.status}).`);
    return res.json() as Promise<Traverse[]>;
  });
  // Let a failed load be retried.
  loading.catch(() => (loading = undefined));
  return loading;
}

/** Mission ids with a route in the data, without loading it. */
export const TRAVERSE_MISSIONS = ["perseverance", "curiosity"] as const;

/** Draw a rover's route; returns where it starts and ends, to frame. */
export function drawTraverse(
  layer: GraphicsLayer,
  t: Traverse,
): { start: LatLon; end: LatLon; all: LatLon[] } {
  layer.removeAll();
  layer.add(
    new Graphic({
      geometry: new Polyline({ paths: t.paths, spatialReference: MARS_SR }),
      attributes: { label: `${t.rover}'s route` },
      symbol: new LineSymbol3D({
        symbolLayers: [
          new LineSymbol3DLayer({
            size: 3,
            material: { color: [255, 214, 102, 0.95] },
            cap: "round",
            join: "round",
          }),
        ],
      }),
    }),
  );
  const toLatLon = ([lon, lat]: number[]) => ({ lat, lon });
  const first = t.paths[0][0];
  const lastPath = t.paths[t.paths.length - 1];
  // A sparse sample of the route is enough to frame it.
  const all = t.paths.flatMap((p) => [p[0], p[p.length - 1]]).map(toLatLon);
  return {
    start: toLatLon(first),
    end: toLatLon(lastPath[lastPath.length - 1]),
    all,
  };
}
