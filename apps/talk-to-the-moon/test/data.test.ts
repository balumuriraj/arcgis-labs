import assert from "node:assert/strict";
import { test } from "node:test";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import { createChartTables, checkCustomChart, type CustomChart } from "../src/cards/charts";
import { loadData, type MoonData } from "../src/data";
import { missionRenderer } from "../src/map/moon";

/** A stand-in for a hosted layer: just enough of queryFeatures for loadData. */
const layer = (rows: Record<string, unknown>[]) =>
  ({
    queryFeatures: async () => ({ features: rows.map((attributes, i) => ({ attributes, getObjectId: () => i + 1 })) }),
  }) as unknown as FeatureLayer;

const apollo11 = {
  id: "apollo-11",
  name: "Apollo 11",
  country: "USA",
  outcome: "crewed",
  operator: "NASA",
  commercial: 0,
  arrivalDate: Date.parse("1969-07-20T12:00:00Z"),
  launchDate: Date.parse("1969-07-16T12:00:00Z"),
  lat: 0.67416,
  lon: 23.47314,
  site: "Mare Tranquillitatis",
  crew: "Neil Armstrong; Buzz Aldrin",
  orbitingCrew: "Michael Collins",
  rover: null,
  sampleReturn: 1,
  approximate: 0,
  partial: "",
  note: null,
  launchSiteId: "cape",
  vehicle: "Saturn V",
  pad: "LC-39A",
  rideshare: null,
};
const luna2 = { ...apollo11, id: "luna-2", name: "Luna 2", country: "USSR", outcome: "impact", crew: null, launchSiteId: "baikonur" };
const sites = [
  { id: "cape", name: "Cape Canaveral", place: "Florida, USA", lat: 28.46, lon: -80.53 },
  { id: "baikonur", name: "Baikonur Cosmodrome", place: "Kazakhstan", lat: 45.965, lon: 63.305 },
];

const load = () => loadData(layer([apollo11, luna2]), layer(sites));

test("mission records are normalized at the boundary", async () => {
  const { missions, launchSites } = await load();
  const [m] = missions;
  assert.equal(m.objectId, 1);
  assert.deepEqual(m.crew, ["Neil Armstrong", "Buzz Aldrin"]);
  assert.equal(m.sampleReturn, true);
  assert.equal(m.commercial, false);
  assert.equal(m.partial, undefined, "empty text means no value");
  assert.equal(m.rover, undefined);
  assert.equal(launchSites.length, 2);
});

test("the renderer has a class only for country and outcome pairs that occur", async () => {
  const renderer = missionRenderer((await load()).missions);
  const groups = renderer.uniqueValueGroups!.map((g) => [g.heading, g.classes!.map((c) => c.label)]);
  assert.deepEqual(groups, [
    ["Crewed landings", ["USA"]],
    ["Planned impacts", ["USSR"]],
  ]);
});

test("custom charts are checked against the chart table's fields", async () => {
  const data: MoonData = await load();
  const craters = { fields: [{ name: "diameterKm", type: "double" }, { name: "side", type: "string" }] } as unknown as FeatureLayer;
  const tables = createChartTables(data, craters);
  const chart = (c: Partial<CustomChart>) =>
    checkCustomChart(tables, { table: "missions", type: "bar", x: "country", stat: "count", where: "1=1", title: "t", ...c });

  assert.equal(chart({}), undefined);
  assert.equal(chart({ x: "launchSiteId" }), undefined, "coded-value fields are categories");
  assert.equal(chart({ type: "line", x: "arrivalDecade" }), undefined);
  assert.equal(chart({ type: "scatter", x: "launchYear", value: "daysToSurface" }), undefined);
  assert.equal(checkCustomChart(tables, { table: "craters", type: "pie", x: "side", stat: "count", where: "1=1", title: "t" }), undefined);

  assert.match(chart({ x: "nope" })!, /No field/);
  assert.match(chart({ x: "daysToSurface" })!, /category or date/);
  assert.match(chart({ type: "line", x: "country" })!, /date or decade/);
  assert.match(chart({ type: "scatter", x: "country", value: "daysToSurface" })!, /numeric/);
  assert.match(chart({ value: "daysToSurface" })!, /doesn't take a value/);
  assert.match(chart({ stat: "avg" })!, /numeric value field/);
  tables.missions.destroy();
});
