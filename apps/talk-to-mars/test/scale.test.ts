import assert from "node:assert/strict";
import { before, test } from "node:test";
import { MARS_RADIUS_M } from "../src/data";
import { loadGeodesy, marsCircle, marsDistanceKm, offset } from "../src/map/scale";

before(() => loadGeodesy());

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test("distances are measured on the Mars sphere", () => {
  const quarter = (Math.PI / 2) * (MARS_RADIUS_M / 1000);
  close(marsDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), quarter, 1);
  close(marsDistanceKm({ lat: 0, lon: 0 }, { lat: 90, lon: 0 }), quarter, 1);
});

test("distances across the antimeridian take the short way", () => {
  const twoDegrees = (2 * Math.PI * (MARS_RADIUS_M / 1000)) / 180;
  close(marsDistanceKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }), twoDegrees, 0.1);
});

test("Perseverance to Curiosity matches the distance the spike measured in the browser", () => {
  close(marsDistanceKm({ lat: 18.4447, lon: 77.4508 }, { lat: -4.5895, lon: 137.4417 }), 3759, 1);
});

test("offset moves a point the given surface distance", () => {
  const start = { lat: 10, lon: 20 };
  close(marsDistanceKm(start, offset(start, 10)), 10, 0.01);
  close(marsDistanceKm(start, offset(start, 0, 10)), 10, 0.05);
  assert.ok(offset({ lat: 89.95, lon: 0 }, 50).lat < 90, "stays off the pole");
});

test("crater circles keep their radius and stay continuous across the antimeridian", () => {
  const center = { lat: 5, lon: 179.5 };
  const ring = marsCircle(center, 40, 32);
  assert.equal(ring.length, 33);
  assert.deepEqual(ring[0], ring[32], "closed");
  for (const [lon, lat] of ring) close(marsDistanceKm(center, { lat, lon }), 40, 0.05);
  for (let i = 1; i < ring.length; i++) assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) < 180, "no jump across the antimeridian");
});
