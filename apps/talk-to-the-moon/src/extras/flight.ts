import Camera from "@arcgis/core/Camera.js";
import Graphic from "@arcgis/core/Graphic.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import ObjectSymbol3DLayer from "@arcgis/core/symbols/ObjectSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { moonPoint, offset, sceneMeters, type LatLon } from "../map/scale";

/**
 * Optional easter egg: fly the lunar module around the Moon with the arrow keys.
 * ← → steer, ↑ ↓ climb and descend, Esc lands. Ask the guide "let me fly".
 *
 * To remove it: delete this file, the `flyLander` tool in agent/tools.ts, and `fly` in map/controller.ts.
 */

/** Drawn far larger than life (the real one is 7 m tall), so it reads from the chase camera. */
const LANDER_HEIGHT_M = 400;
const SPEED_KM_S = 20;
const START_ALTITUDE_M = 15_000;
const MIN_ALTITUDE_M = 200;
const MAX_ALTITUDE_M = 200_000;
const CLIMB_M_PER_S = 15000;
/** The chase camera sits this far behind and above the lander. */
const BEHIND_KM = 5;
const ABOVE_M = 2000;
const TURN_DEG_PER_S = 60;

const ground = (view: SceneView, p: LatLon) => view.groundView.elevationSampler?.queryElevation(moonPoint(p))?.z ?? 0;

/** The point `km` along `headingDeg` (clockwise from north) from `p`. */
function along(p: LatLon, headingDeg: number, km: number): LatLon {
  const rad = (headingDeg * Math.PI) / 180;
  return offset(p, km * Math.cos(rad), km * Math.sin(rad));
}

const landerSymbol = (heading: number) =>
  new PointSymbol3D({
    symbolLayers: [new ObjectSymbol3DLayer({ resource: { href: "/models/lunar-module.glb" }, height: sceneMeters(LANDER_HEIGHT_M), heading })],
  });

/** Starts flying from `start`. Returns a function that ends the flight. */
export function startFlight(view: SceneView, start: LatLon): () => void {
  const state = { ...start, heading: 0, altitudeM: START_ALTITUDE_M };
  const keys = new Set<string>();
  view.animation?.stop();

  const layer = new GraphicsLayer({ title: "Lander flight", listMode: "hide", elevationInfo: { mode: "relative-to-ground" } });
  const lander = new Graphic({ symbol: landerSymbol(0) });
  layer.add(lander);
  view.map?.add(layer);

  // Listen on the window, before the map or the chat box sees the keys: the chat box usually
  // has focus right after asking to fly, and the map would otherwise pan with the arrows.
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") return stop();
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "keydown") keys.add(event.key);
    else keys.delete(event.key);
  };
  window.addEventListener("keydown", onKey, { capture: true });
  window.addEventListener("keyup", onKey, { capture: true });

  let last = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const seconds = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (keys.has("ArrowLeft")) state.heading -= TURN_DEG_PER_S * seconds;
    if (keys.has("ArrowRight")) state.heading += TURN_DEG_PER_S * seconds;
    if (keys.has("ArrowUp")) state.altitudeM = Math.min(MAX_ALTITUDE_M, state.altitudeM + CLIMB_M_PER_S * seconds);
    if (keys.has("ArrowDown")) state.altitudeM = Math.max(MIN_ALTITUDE_M, state.altitudeM - CLIMB_M_PER_S * seconds);
    Object.assign(state, along(state, state.heading, SPEED_KM_S * seconds));

    lander.geometry = moonPoint(state, sceneMeters(state.altitudeM));
    lander.symbol = landerSymbol(state.heading);

    // Chase camera: behind and above the lander, looking along its heading. Its height is
    // absolute, so add the ground under it.
    const camera = along(state, state.heading + 180, BEHIND_KM);
    const tilt = 90 - (Math.atan2(ABOVE_M, BEHIND_KM * 1000) * 180) / Math.PI;
    view.camera = new Camera({
      position: moonPoint(camera, ground(view, state) + sceneMeters(state.altitudeM + ABOVE_M)),
      heading: state.heading,
      tilt,
    });
    frame = requestAnimationFrame(tick);
  });

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKey, { capture: true });
    window.removeEventListener("keyup", onKey, { capture: true });
    view.map?.remove(layer);
    layer.destroy();
  }
  return stop;
}
