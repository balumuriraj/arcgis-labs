import Graphic from "@arcgis/core/Graphic.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import LineSymbol3D from "@arcgis/core/symbols/LineSymbol3D.js";
import LineSymbol3DLayer from "@arcgis/core/symbols/LineSymbol3DLayer.js";
import ObjectSymbol3DLayer from "@arcgis/core/symbols/ObjectSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import TextSymbol3DLayer from "@arcgis/core/symbols/TextSymbol3DLayer.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import type { Crater } from "../data";
import { moonCircle, moonPoint, sceneMeters, type LatLon } from "./scale";

/** What the guide draws on the Moon besides the mission markers. */

const HALO = { color: [6, 8, 14, 0.9], size: 1.5 };

/** Larger craters get an approximate rim from their recorded diameter; small ones get a pin. */
export function markCraters(layer: GraphicsLayer, craters: Crater[]): void {
  layer.removeAll();
  for (const crater of craters) {
    const rim = crater.diameterKm >= 1;
    if (rim) {
      layer.add(
        new Graphic({
          geometry: new Polyline({ paths: [moonCircle(crater, crater.diameterKm / 2)], spatialReference: SpatialReference.WGS84 }),
          symbol: new LineSymbol3D({ symbolLayers: [new LineSymbol3DLayer({ size: 2, material: { color: [255, 214, 102, 0.9] } })] }),
        }),
      );
    }
    layer.add(
      new Graphic({
        geometry: moonPoint(crater),
        attributes: { ...crater },
        popupTemplate: { title: "{name}", content: "{diameterKm} km across. {origin}" },
        symbol: new PointSymbol3D({
          symbolLayers: [
            ...(rim
              ? []
              : [new IconSymbol3DLayer({ resource: { primitive: "kite" }, size: 12, material: { color: "#ffd666" }, outline: { color: [6, 8, 14, 0.9], size: 1 } })]),
            new TextSymbol3DLayer({ text: crater.name, size: 12, material: { color: "#ffe9a8" }, halo: HALO }),
          ],
          verticalOffset: { screenLength: rim ? 18 : 30 },
          callout: rim ? undefined : new LineCallout3D({ size: 1, color: [255, 214, 102, 0.7] }),
        }),
      }),
    );
  }
}

export const SHAPES = ["tower", "mountain", "block", "cylinder", "sphere"] as const;
export type Shape = (typeof SHAPES)[number];

/** Footprint width as a share of height, for when the guide doesn't give one. */
const TYPICAL_WIDTH: Record<Shape, number> = { tower: 0.13, mountain: 3.2, block: 1, cylinder: 0.3, sphere: 1 };
export const typicalWidthM = (shape: Shape, heightM: number) => Math.round(heightM * TYPICAL_WIDTH[shape] * 10) / 10;

/** A tower tapers in three stacked tiers: width (share of the base) and height (share of the total). */
const TOWER_TIERS = [
  { width: 1, height: 0.45 },
  { width: 0.58, height: 0.35 },
  { width: 0.15, height: 0.2 },
];

/** An object's outline from SDK primitives, at true scale (sizes in lunar meters). */
function outline(shape: Shape, heightM: number, widthM: number): ObjectSymbol3DLayer[] {
  const height = sceneMeters(heightM);
  const width = sceneMeters(widthM);
  const material = { color: "#ff6b9a" };
  if (shape === "tower") {
    let base = 0;
    return TOWER_TIERS.map((tier) => {
      const layer = new ObjectSymbol3DLayer({
        resource: { primitive: "cylinder" },
        width: width * tier.width,
        depth: width * tier.width,
        height: height * tier.height,
        // Stack each tier on the ones below it.
        anchor: "relative",
        anchorPosition: { x: 0, y: 0, z: -0.5 - base / tier.height },
        material,
      });
      base += tier.height;
      return layer;
    });
  }
  const primitive = { mountain: "cone", block: "cube", cylinder: "cylinder", sphere: "sphere" } as const;
  return [new ObjectSymbol3DLayer({ resource: { primitive: primitive[shape] }, width, depth: width, height, anchor: "bottom", material })];
}

/** Any object at true scale, standing at `at`, with a label above it. */
export function placeObject(layer: GraphicsLayer, shape: Shape, heightM: number, widthM: number, at: LatLon, label: string): void {
  layer.removeAll();
  layer.addMany([
    new Graphic({ geometry: moonPoint(at), attributes: { label }, symbol: new PointSymbol3D({ symbolLayers: outline(shape, heightM, widthM) }) }),
    new Graphic({
      geometry: moonPoint(at, sceneMeters(heightM)),
      attributes: { label },
      symbol: new PointSymbol3D({
        symbolLayers: [new TextSymbol3DLayer({ text: label, size: 13, material: { color: "white" }, halo: HALO })],
        verticalOffset: { screenLength: 28 },
        callout: new LineCallout3D({ size: 1, color: [255, 255, 255, 0.7] }),
      }),
    }),
  ]);
}

/** What's drawn, for the guide's context: one entry per crater or object. */
export function describeDrawings(craterMarks: GraphicsLayer, objects: GraphicsLayer): string[] {
  const craters = craterMarks.graphics.toArray().flatMap((g) => (g.attributes?.name ? [`${g.attributes.name} (crater)`] : []));
  const labels = objects.graphics.toArray().map((g) => String(g.attributes?.label));
  return [...new Set([...craters, ...labels])];
}
