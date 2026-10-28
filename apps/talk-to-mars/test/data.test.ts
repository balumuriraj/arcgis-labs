import assert from "node:assert/strict";
import { test } from "node:test";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import { createChartTables, checkCustomChart, type CustomChart } from "../src/cards/charts";
import { FLAGS, OUTCOMES, isLanding, loadData, toFeature } from "../src/data";
import { missionRenderer } from "../src/map/mars";

test("mission records load in arrival order with parsed dates", () => {
  const { missions, launchSites } = loadData();
  assert.equal(missions.length, 17);
  assert.equal(missions[0].id, "mars-2");
  for (let i = 1; i < missions.length; i++)
    assert.ok(missions[i].arrivalDate >= missions[i - 1].arrivalDate, "sorted by arrival");
  const ids = new Set(missions.map((m) => m.id));
  assert.equal(ids.size, missions.length, "ids are unique");
  for (const m of missions) {
    assert.ok(m.launchDate < m.arrivalDate, `${m.id} launched before it arrived`);
    assert.ok(Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180, `${m.id} has a valid site`);
    assert.ok(launchSites.some((s) => s.id === m.launchSiteId), `${m.id} has a known launch site`);
    assert.ok(m.country in FLAGS, `${m.id} has a flag`);
    assert.ok(OUTCOMES.includes(m.outcome));
    if (m.rideshare) assert.ok(ids.has(m.rideshare), `${m.id} shares a rocket with a known mission`);
  }
});

test("ten landings worked", () => {
  const { missions } = loadData();
  assert.deepEqual(
    missions.filter(isLanding).map((m) => m.id),
    ["viking-1", "viking-2", "pathfinder", "spirit", "opportunity", "phoenix", "curiosity", "insight", "perseverance", "zhurong"],
  );
});

test("gazetteer records are normalized to the app's terms", () => {
  const olympus = toFeature({
    name: "Olympus Mons",
    type: "Mons, montes",
    center_lat: 18.65,
    center_lon: 226.2,
    diameter: 610.13,
    origin: "Classical albedo feature name.",
    approvaldt: 94694400000,
  });
  assert.equal(olympus.type, "Mons");
  assert.ok(Math.abs(olympus.lon - -133.8) < 1e-9, "east longitudes over 180 become negative");
  assert.equal(olympus.yearApproved, 1973);
  assert.equal(toFeature({ name: "Gale", type: "Crater, craters", center_lat: -5.4, center_lon: 137.8, diameter: 154, origin: null, approvaldt: null }).origin, "");
});

test("the renderer has a class only for country and outcome pairs that occur", () => {
  const renderer = missionRenderer(loadData().missions);
  const groups = renderer.uniqueValueGroups!.map((g) => [g.heading, g.classes!.map((c) => c.label)]);
  assert.deepEqual(groups, [
    ["Landed and worked", ["China", "USA"]],
    ["Landed, then went silent", ["UK", "USSR"]],
    ["Crashed or lost", ["Europe (ESA)", "USA", "USSR"]],
  ]);
});

test("custom charts are checked against the chart table's fields", () => {
  const features = { fields: [{ name: "diameterKm", type: "double" }, { name: "type", type: "string" }] } as unknown as FeatureLayer;
  const tables = createChartTables(loadData(), features);
  const chart = (c: Partial<CustomChart>) =>
    checkCustomChart(tables, { table: "missions", type: "bar", x: "country", stat: "count", where: "1=1", title: "t", ...c });

  assert.equal(chart({}), undefined);
  assert.equal(chart({ x: "launchSiteId" }), undefined, "coded-value fields are categories");
  assert.equal(chart({ type: "line", x: "arrivalDecade" }), undefined);
  assert.equal(chart({ type: "scatter", x: "launchYear", value: "daysToSurface" }), undefined);
  assert.equal(chart({ type: "pie", x: "hemisphere" }), undefined);
  assert.equal(checkCustomChart(tables, { table: "features", type: "pie", x: "type", stat: "count", where: "1=1", title: "t" }), undefined);

  assert.match(chart({ x: "nope" })!, /No field/);
  assert.match(chart({ x: "daysToSurface" })!, /category or date/);
  assert.match(chart({ type: "line", x: "country" })!, /date or decade/);
  assert.match(chart({ type: "scatter", x: "country", value: "daysToSurface" })!, /numeric/);
  assert.match(chart({ value: "daysToSurface" })!, /doesn't take a value/);
  assert.match(chart({ stat: "avg" })!, /numeric value field/);
  tables.missions.destroy();
});
