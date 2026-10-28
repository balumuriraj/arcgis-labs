import Graphic from "@arcgis/core/Graphic.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import type Point from "@arcgis/core/geometry/Point.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import LineSymbol3D from "@arcgis/core/symbols/LineSymbol3D.js";
import LineSymbol3DLayer from "@arcgis/core/symbols/LineSymbol3DLayer.js";
import ObjectSymbol3DLayer from "@arcgis/core/symbols/ObjectSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import TextSymbol3DLayer from "@arcgis/core/symbols/TextSymbol3DLayer.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel.js";
import type { Feature } from "../data";
import { MARS_SR, marsCircle, marsPoint, type LatLon } from "./scale";

/** What the guide draws on Mars besides the mission markers. */

const HALO = { color: [6, 8, 14, 0.9], size: 1.5 };

/**
 * Craters 1 km or wider get an approximate rim from their recorded diameter. Smaller craters and
 * every other kind of feature (a valley's "diameter" is its length) get a pin.
 */
export function markFeatures(layer: GraphicsLayer, features: Feature[]): void {
  layer.removeAll();
  for (const feature of features) {
    const rim = feature.type === "Crater" && feature.diameterKm >= 1;
    if (rim) {
      layer.add(
        new Graphic({
          geometry: new Polyline({
            paths: [marsCircle(feature, feature.diameterKm / 2)],
            spatialReference: MARS_SR,
          }),
          symbol: new LineSymbol3D({
            symbolLayers: [
              new LineSymbol3DLayer({
                size: 2,
                material: { color: [255, 214, 102, 0.9] },
              }),
            ],
          }),
        }),
      );
    }
    layer.add(
      new Graphic({
        geometry: marsPoint(feature),
        attributes: { ...feature },
        popupTemplate: {
          title: "{name}",
          content: "{type}, {diameterKm} km across. {origin}",
        },
        symbol: new PointSymbol3D({
          symbolLayers: [
            ...(rim
              ? []
              : [
                  new IconSymbol3DLayer({
                    resource: { primitive: "kite" },
                    size: 12,
                    material: { color: "#ffd666" },
                    outline: { color: [6, 8, 14, 0.9], size: 1 },
                  }),
                ]),
            new TextSymbol3DLayer({
              text: feature.name,
              size: 12,
              material: { color: "#ffe9a8" },
              halo: HALO,
            }),
          ],
          verticalOffset: { screenLength: rim ? 18 : 30 },
          callout: rim
            ? undefined
            : new LineCallout3D({ size: 1, color: [255, 214, 102, 0.7] }),
        }),
      }),
    );
  }
}

export const SHAPES = [
  "tower",
  "mountain",
  "block",
  "cylinder",
  "sphere",
] as const;
export type Shape = (typeof SHAPES)[number];

/** Footprint width as a share of height, for when the guide doesn't give one. */
const TYPICAL_WIDTH: Record<Shape, number> = {
  tower: 0.13,
  mountain: 3.2,
  block: 1,
  cylinder: 0.3,
  sphere: 1,
};
export const typicalWidthM = (shape: Shape, heightM: number) =>
  Math.round(heightM * TYPICAL_WIDTH[shape] * 10) / 10;

/** A tower tapers in three stacked tiers: width (share of the base) and height (share of the total). */
const TOWER_TIERS = [
  { width: 1, height: 0.45 },
  { width: 0.58, height: 0.35 },
  { width: 0.15, height: 0.2 },
];

/** An object's outline from SDK primitives, at true scale (sizes in meters). */
function outline(
  shape: Shape,
  height: number,
  width: number,
): ObjectSymbol3DLayer[] {
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
  const primitive = {
    mountain: "cone",
    block: "cube",
    cylinder: "cylinder",
    sphere: "sphere",
  } as const;
  return [
    new ObjectSymbol3DLayer({
      resource: { primitive: primitive[shape] },
      width,
      depth: width,
      height,
      anchor: "bottom",
      material,
    }),
  ];
}

/** Any object at true scale, standing at `at`, with a label above it. */
export function placeObject(
  layer: GraphicsLayer,
  shape: Shape,
  heightM: number,
  widthM: number,
  at: LatLon,
  label: string,
): void {
  layer.removeAll();
  layer.addMany([
    new Graphic({
      geometry: marsPoint(at),
      attributes: { label, role: "shape" },
      symbol: new PointSymbol3D({
        symbolLayers: outline(shape, heightM, widthM),
      }),
    }),
    new Graphic({
      geometry: marsPoint(at, heightM),
      attributes: { label, role: "label" },
      symbol: new PointSymbol3D({
        symbolLayers: [
          new TextSymbol3DLayer({
            text: label,
            size: 13,
            material: { color: "white" },
            halo: HALO,
          }),
        ],
        verticalOffset: { screenLength: 28 },
        callout: new LineCallout3D({ size: 1, color: [255, 255, 255, 0.7] }),
      }),
    }),
  ]);
}

/**
 * Lets people click a placed object and drag it somewhere else. It keeps its true size; its label,
 * a separate graphic floating at the top, follows it.
 */
export function makeObjectsMovable(
  view: SceneView,
  objects: GraphicsLayer,
): ResourceHandle {
  const sketch = new SketchViewModel({
    view,
    layer: objects,
    updateOnGraphicClick: true,
    defaultUpdateOptions: {
      tool: "move",
      enableRotation: false,
      enableScaling: false,
      enableZ: false,
      toggleToolOnClick: false,
    },
  });
  const moving = sketch.on("update", ({ graphics: [graphic] }) => {
    // Only the shape moves; the label goes wherever the shape goes.
    if (graphic.attributes?.role !== "shape") return sketch.cancel();
    const label = objects.graphics.find((g) => g.attributes?.role === "label");
    const base = graphic.geometry as Point;
    if (label)
      label.geometry = base.clone().set({ z: (label.geometry as Point).z });
  });
  return {
    remove() {
      moving.remove();
      sketch.destroy();
    },
  };
}

/** What's drawn, for the guide's context: one entry per feature, route, or object. */
export function describeDrawings(...layers: GraphicsLayer[]): string[] {
  const entries = layers.flatMap((layer) =>
    layer.graphics
      .toArray()
      .flatMap((g) =>
        g.attributes?.label
          ? [String(g.attributes.label)]
          : g.attributes?.name
            ? [`${g.attributes.name} (${g.attributes.type})`]
            : [],
      ),
  );
  return [...new Set(entries)];
}
