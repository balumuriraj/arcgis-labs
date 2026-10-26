import Graphic from "@arcgis/core/Graphic.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FillSymbol3DLayer from "@arcgis/core/symbols/FillSymbol3DLayer.js";
import ObjectSymbol3DLayer from "@arcgis/core/symbols/ObjectSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import PolygonSymbol3D from "@arcgis/core/symbols/PolygonSymbol3D.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import type { Mission } from "../data";
import { LUNAR_SCALE, moonCircle, moonPoint, offset } from "../map/scale";

/**
 * Optional: one 3D model at the site being visited. NASA's Lunar Module (NASA 3D Resources, free
 * to use) stands at every landing, tinted cyan for robotic landings and coral and tipped over for
 * crashes; planned impacts get only a dark mark. It's drawn far larger than life (real landers
 * are a few meters, under a pixel of the imagery) and goes away when the camera pulls back.
 *
 * To remove it: delete this file and public/models/, and the `siteModel` lines in
 * map/moon.ts and map/controller.ts.
 */

const MODEL_URL = "/models/lunar-module.glb";
/** Model height as a share of the camera's distance to the site. */
const SIZE = 0.06;
/** Hide once the camera has pulled back this many times farther than when the model appeared. */
const HIDE_BEYOND = 4;
/** Stand this many model heights south of the site, so the mission icon above the site stays clear. */
const STAND_SOUTH = 1.6;

const LOOK: Partial<
  Record<Mission["outcome"], { color?: string; tilt?: number; roll?: number }>
> = {
  crewed: {},
  soft: { color: "#5ad1e6" },
  crash: { color: "#ff7a59", tilt: 12, roll: 72 },
};

/** Soft ground marks: faint rings stacked from the outside in, so the center is darkest. */
const MARKS: Partial<
  Record<Mission["outcome"], { radius: number; rgba: number[] }[]>
> = {
  crash: [{ radius: 1.3, rgba: [18, 16, 14, 0.12] }],
  impact: [
    { radius: 1.6, rgba: [226, 220, 208, 0.035] },
    { radius: 0.6, rgba: [16, 14, 12, 0.1] },
  ],
};
const RINGS = 10;

/** A stable heading per mission, so a craft faces the same way every visit. */
function headingOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export class SiteModel {
  private readonly model = new GraphicsLayer({
    title: "Site model",
    listMode: "hide",
    elevationInfo: { mode: "relative-to-ground" },
  });
  private readonly marks = new GraphicsLayer({
    title: "Site marks",
    listMode: "hide",
    elevationInfo: { mode: "on-the-ground" },
  });
  private watch: ResourceHandle | undefined;

  readonly layers = [this.marks, this.model];

  /** Put the mission's craft at its site, sized for the current view. */
  show(view: SceneView, m: Mission): void {
    this.hide();
    const shownFrom = distance(view, m);
    const height = shownFrom * SIZE;
    const heightKm = height / LUNAR_SCALE / 1000;
    const look = LOOK[m.outcome];
    if (look) {
      this.model.add(
        new Graphic({
          geometry: moonPoint(offset(m, -STAND_SOUTH * heightKm)),
          symbol: new PointSymbol3D({
            symbolLayers: [
              new ObjectSymbol3DLayer({
                resource: { href: MODEL_URL },
                height,
                anchor: "bottom",
                heading: headingOf(m.id),
                tilt: look.tilt ?? 0,
                roll: look.roll ?? 0,
                material: look.color ? { color: look.color } : undefined,
              }),
            ],
          }),
        }),
      );
    }
    for (const mark of MARKS[m.outcome] ?? []) {
      for (let r = 0; r < RINGS; r++) {
        const radiusKm = Math.max(
          0.05,
          mark.radius * heightKm * (1 - r / RINGS),
        );
        this.marks.add(
          new Graphic({
            geometry: new Polygon({
              rings: [moonCircle(m, radiusKm, 64)],
              spatialReference: SpatialReference.WGS84,
            }),
            symbol: new PolygonSymbol3D({
              symbolLayers: [
                new FillSymbol3DLayer({
                  material: { color: mark.rgba },
                  outline: { size: 0 },
                }),
              ],
            }),
          }),
        );
      }
    }
    // Hide once the camera settles much farther out than when the model appeared.
    this.watch = reactiveUtils.when(
      () => view.stationary && distance(view, m) > shownFrom * HIDE_BEYOND,
      () => this.hide(),
    );
  }

  hide(): void {
    this.watch?.remove();
    this.watch = undefined;
    this.model.removeAll();
    this.marks.removeAll();
  }
}

/**
 * How far the camera is from the site, in scene meters: its height above the site's ground,
 * stretched by the tilt. Heights are from the Moon's reference sphere and the maria sit kilometers
 * below it, so the ground height comes from the terrain itself.
 */
function distance(view: SceneView, m: Mission): number {
  const { camera } = view;
  const ground =
    view.groundView.elevationSampler?.queryElevation(moonPoint(m))?.z ?? 0;
  const above = Math.max(1, (camera.position.z ?? 0) - ground);
  return above / Math.max(0.33, Math.cos((camera.tilt * Math.PI) / 180));
}
