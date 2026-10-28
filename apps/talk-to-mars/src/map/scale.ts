import Camera from "@arcgis/core/Camera.js";
import Point from "@arcgis/core/geometry/Point.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import {
  geodeticDistanceExecute,
  geodeticDistanceLoad,
} from "@arcgis/core/geometry/operators/geodeticDistanceOperator.js";
import {
  geodeticUtilsLoad,
  geodeticUtilsPointFromDistance,
} from "@arcgis/core/geometry/operators/geodeticUtilsOperator.js";
import { MARS_RADIUS_M } from "../data";

/**
 * Esri's Mars imagery and elevation are published in Mars's own coordinate system
 * (GCS_Mars_2000_Sphere), and the scene uses it too, so everything here is in real Martian
 * latitude, longitude, and meters. Distances use the SDK's geodetic operators on that sphere.
 */

export type LatLon = { lat: number; lon: number };

export const MARS_SR = new SpatialReference({ wkid: 104971 });

/** The geodetic operators need to load once before use. */
export const loadGeodesy = () =>
  Promise.all([geodeticDistanceLoad(), geodeticUtilsLoad()]);

/** A point on Mars. `z` is in meters above the reference sphere. */
export const marsPoint = (p: LatLon, z?: number) =>
  new Point({ x: p.lon, y: p.lat, z, spatialReference: MARS_SR });

/** A camera far enough out to see the whole planet, centered on `p`. */
export const wholeMars = (p: LatLon, altitudeM = MARS_RADIUS_M * 2.4) =>
  new Camera({ position: marsPoint(p, altitudeM), tilt: 0, heading: 0 });

/** A point a short distance north and east of `p`, in kilometers on the surface. */
export function offset(p: LatLon, northKm: number, eastKm = 0): LatLon {
  const degrees = (km: number) =>
    ((km * 1000) / MARS_RADIUS_M) * (180 / Math.PI);
  return {
    lat: Math.max(-89.9, Math.min(89.9, p.lat + degrees(northKm))),
    lon: p.lon + degrees(eastKm) / Math.cos((p.lat * Math.PI) / 180),
  };
}

/** Surface distance between two places on Mars, in kilometers. */
export const marsDistanceKm = (a: LatLon, b: LatLon) =>
  geodeticDistanceExecute(marsPoint(a), marsPoint(b), { unit: "kilometers" });

/** A circle of `radiusKm` around `center`, as [lon, lat] vertices for a path or ring. */
export function marsCircle(
  center: LatLon,
  radiusKm: number,
  vertices = 96,
): number[][] {
  const c = marsPoint(center);
  const out: number[][] = [];
  for (let i = 0; i <= vertices; i++) {
    const p = geodeticUtilsPointFromDistance(
      c,
      radiusKm,
      (i % vertices) * (360 / vertices),
      { unit: "kilometers" },
    );
    if (!p) throw new Error("Could not construct a circle on Mars.");
    let lon = p.x;
    // Keep the outline continuous across the antimeridian.
    const prev = out.at(-1)?.[0];
    if (prev !== undefined) lon += Math.round((prev - lon) / 360) * 360;
    out.push([lon, p.y]);
  }
  return out;
}
