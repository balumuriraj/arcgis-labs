import assert from "node:assert/strict";
import { before, test } from "node:test";
import { MOON_RADIUS_M } from "../src/data";
import { loadGeodesy, lunarDistanceKm, moonCircle, offset } from "../src/map/scale";

before(() => loadGeodesy());

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("distances are measured on the Moon, not the Earth-sized display globe", () => {
  const quarter = (Math.PI / 2) * (MOON_RADIUS_M / 1000);
  close(lunarDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), quarter, 1);
  close(lunarDistanceKm({ lat: 0, lon: 0 }, { lat: 90, lon: 0 }), quarter, 1);
});

test("distances across the antimeridian take the short way", () => {
  const twoDegrees = (2 * Math.PI * (MOON_RADIUS_M / 1000)) / 180;
  close(lunarDistanceKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }), twoDegrees, 0.1);
});

test("Apollo 11 to Collins crater matches the guide's nearest-crater answer", () => {
  close(lunarDistanceKm({ lat: 0.67416, lon: 23.47314 }, { lat: 1.3, lon: 23.71 }), 20.2, 0.5);
});

test("offset moves a point the given surface distance", () => {
  const start = { lat: 10, lon: 20 };
  close(lunarDistanceKm(start, offset(start, 10)), 10, 0.01);
  close(lunarDistanceKm(start, offset(start, 0, 10)), 10, 0.05);
  assert.ok(offset({ lat: 89.95, lon: 0 }, 50).lat < 90, "stays off the pole");
});

test("crater circles keep their radius and stay continuous across the antimeridian", () => {
  const center = { lat: 5, lon: 179.5 };
  const ring = moonCircle(center, 40, 32);
  assert.equal(ring.length, 33);
  assert.deepEqual(ring[0], ring[32], "closed");
  for (const [lon, lat] of ring) close(lunarDistanceKm(center, { lat, lon }), 40, 0.05);
  for (let i = 1; i < ring.length; i++) assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) < 180, "no jump across the antimeridian");
});
