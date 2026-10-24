import Camera from "@arcgis/core/Camera.js";
import Point from "@arcgis/core/geometry/Point.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import { geodeticDistanceExecute, geodeticDistanceLoad } from "@arcgis/core/geometry/operators/geodeticDistanceOperator.js";
import { geodeticUtilsLoad, geodeticUtilsPointFromDistance } from "@arcgis/core/geometry/operators/geodeticUtilsOperator.js";
import { MOON_RADIUS_M } from "../data";

/**
 * The lunar imagery and elevation services are published in Web Mercator, so the scene draws the
 * Moon on an Earth-sized globe. This file is the only place that deals with that: the rest of
 * the app works in real lunar latitude, longitude, and meters.
 *
 * Measurements use the Moon's own coordinate system (GCS_Moon_2000) and the SDK's geodetic
 * operators, so distances are true lunar distances.
 */

export type LatLon = { lat: number; lon: number };

const SCENE_RADIUS_M = 6_378_137;
/** Scene meters per lunar meter. */
export const LUNAR_SCALE = SCENE_RADIUS_M / MOON_RADIUS_M;
const MOON_SR = new SpatialReference({ wkid: 104903 });

/** The geodetic operators need to load once before use. */
export const loadGeodesy = () => Promise.all([geodeticDistanceLoad(), geodeticUtilsLoad()]);

/** A point in the scene. `z` is in scene meters. */
export const moonPoint = (p: LatLon, z?: number) =>
  new Point({ x: p.lon, y: p.lat, z, spatialReference: SpatialReference.WGS84 });

/** Real lunar meters to scene meters, for scales, heights, and camera distances. */
export const sceneMeters = (lunarMeters: number) => lunarMeters * LUNAR_SCALE;

/** A camera far enough out to see the whole Moon, centered on `p`. */
export const wholeMoon = (p: LatLon, altitudeM = MOON_RADIUS_M * 2.4) =>
  new Camera({ position: moonPoint(p, sceneMeters(altitudeM)), tilt: 0, heading: 0 });

/** A point a short distance north and east of `p`, in kilometers on the lunar surface. */
export function offset(p: LatLon, northKm: number, eastKm = 0): LatLon {
  const degrees = (km: number) => ((km * 1000) / MOON_RADIUS_M) * (180 / Math.PI);
  return {
    lat: Math.max(-89.9, Math.min(89.9, p.lat + degrees(northKm))),
    lon: p.lon + degrees(eastKm) / Math.cos((p.lat * Math.PI) / 180),
  };
}

const lunar = (p: LatLon) => new Point({ x: p.lon, y: p.lat, spatialReference: MOON_SR });

/** Surface distance between two places on the Moon, in kilometers. */
export const lunarDistanceKm = (a: LatLon, b: LatLon) =>
  geodeticDistanceExecute(lunar(a), lunar(b), { unit: "kilometers" });

/** A circle of `radiusKm` around `center` on the Moon, as [lon, lat] vertices for a path or ring. */
export function moonCircle(center: LatLon, radiusKm: number, vertices = 96): number[][] {
  const c = lunar(center);
  const out: number[][] = [];
  for (let i = 0; i <= vertices; i++) {
    const p = geodeticUtilsPointFromDistance(c, radiusKm, (i % vertices) * (360 / vertices), { unit: "kilometers" });
    if (!p) throw new Error("Could not construct a lunar circle.");
    let lon = p.x;
    // Keep the outline continuous across the antimeridian.
    const prev = out.at(-1)?.[0];
    if (prev !== undefined) lon += Math.round((prev - lon) / 360) * 360;
    out.push([lon, p.y]);
  }
  return out;
}
