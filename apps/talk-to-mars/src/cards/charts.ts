import Graphic from "@arcgis/core/Graphic.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import type Field from "@arcgis/core/layers/support/Field.js";
import type { ModelTypes } from "@arcgis/charts-components";
import { z } from "zod";
import {
  OUTCOMES,
  OUTCOME_LABEL,
  daysToSurface,
  hemisphereOf,
  type MarsData,
  type Mission,
} from "../data";
import { MARS_SR, marsPoint } from "../map/scale";

/**
 * Charts are native `arcgis-chart` components on two sources:
 * - features: the app's named-feature layer itself.
 * - missions: a copy of the mission records with the mission layer's field names and values (so
 *   the guide can reuse its queryData SQL) plus a few derived fields. Coded-value domains turn
 *   codes into labels on the chart.
 */

export type ChartTable = "missions" | "features";

const decadeOf = (ms: number) =>
  `${Math.floor(new Date(ms).getUTCFullYear() / 10) * 10}s`;
const decimalYear = (ms: number) =>
  +(new Date(ms).getUTCFullYear() + new Date(ms).getUTCMonth() / 12).toFixed(2);

function missionRow(m: Mission) {
  return {
    name: m.name,
    country: m.country,
    outcome: m.outcome,
    arrivalDate: m.arrivalDate,
    launchDate: m.launchDate,
    launchSiteId: m.launchSiteId,
    vehicle: m.vehicle,
    lat: m.lat,
    // Same values as the feature layer's hemisphere field.
    hemisphere: hemisphereOf(m),
    daysToSurface: daysToSurface(m),
    arrivalYear: decimalYear(m.arrivalDate),
    launchYear: decimalYear(m.launchDate),
    arrivalDecade: decadeOf(m.arrivalDate),
    launchDecade: decadeOf(m.launchDate),
  };
}

const coded = (
  name: string,
  codedValues: { code: string | number; name: string }[],
) => ({ type: "coded-value" as const, name, codedValues });

export function createChartTables(
  { missions, launchSites }: MarsData,
  features: FeatureLayer,
) {
  const missionTable = new FeatureLayer({
    title: "Missions",
    source: missions.map(
      (m, i) =>
        new Graphic({
          geometry: marsPoint(m),
          attributes: { ObjectId: i + 1, ...missionRow(m) },
        }),
    ),
    objectIdField: "ObjectId",
    geometryType: "point",
    spatialReference: MARS_SR,
    fields: [
      { name: "ObjectId", type: "oid" },
      { name: "name", alias: "Mission", type: "string" },
      { name: "country", alias: "Country", type: "string" },
      {
        name: "outcome",
        alias: "Outcome",
        type: "string",
        domain: coded(
          "outcome",
          OUTCOMES.map((o) => ({ code: o, name: OUTCOME_LABEL[o] })),
        ),
      },
      { name: "arrivalDate", alias: "Reached the surface", type: "date" },
      { name: "launchDate", alias: "Launched", type: "date" },
      {
        name: "launchSiteId",
        alias: "Spaceport",
        type: "string",
        domain: coded(
          "launchSite",
          launchSites.map((s) => ({ code: s.id, name: s.name })),
        ),
      },
      { name: "vehicle", alias: "Rocket", type: "string" },
      { name: "lat", alias: "Latitude of the site", type: "double" },
      { name: "hemisphere", alias: "Hemisphere", type: "string" },
      {
        name: "daysToSurface",
        alias: "Days from launch to the surface",
        type: "integer",
      },
      {
        name: "arrivalYear",
        alias: "Year it reached the surface",
        type: "double",
      },
      { name: "launchYear", alias: "Launch year", type: "double" },
      {
        name: "arrivalDecade",
        alias: "Decade it reached the surface",
        type: "string",
      },
      { name: "launchDecade", alias: "Decade it launched", type: "string" },
    ],
  });
  return { missions: missionTable, features } satisfies Record<
    ChartTable,
    FeatureLayer
  >;
}

export type ChartTables = ReturnType<typeof createChartTables>;

/** What the guide must know about each table to chart it honestly. */
const TABLE_NOTE: Record<ChartTable, string> = {
  missions:
    "One row per spacecraft that reached the Martian surface, whether it worked or not. Orbiters and landers that never got there aren't in the data.",
  features:
    "One row per IAU-named feature (2019 gazetteer): craters and other types. Depths and heights aren't in this table; for non-craters the size is roughly the feature's longest extent.",
};

type Kind = "category" | "number" | "date";
const kindOf = (field: Field): Kind =>
  field.type === "date"
    ? "date"
    : field.type === "string" || field.domain
      ? "category"
      : "number";

/** The chart fields of each table, for the guide's tool description. */
export function describeChartFields(tables: ChartTables): string {
  return (Object.keys(tables) as ChartTable[])
    .map((table) => {
      const fields = tables[table].fields.filter(
        (f) => f.type !== "oid" && f.name !== "origin",
      );
      const lines = fields.map((f) => {
        const values =
          f.domain?.type === "coded-value"
            ? `; values: ${f.domain.codedValues.map((v) => v.code).join(", ")}`
            : "";
        return `- ${f.name} (${kindOf(f)}): ${f.alias || f.name}${values}`;
      });
      return `${table}: ${TABLE_NOTE[table]}\n${lines.join("\n")}`;
    })
    .join("\n");
}

export const PRESETS = {
  "outcomes-by-decade": {
    title: "How Mars landings went, decade by decade",
    note: "Every spacecraft that reached the surface, by the decade it arrived.",
    about:
      "landing attempts per decade, stacked by outcome; shows the failures of the 1970s and 1990s",
    table: "missions",
  },
  "outcomes-by-country": {
    title: "How each country's landings went",
    note: "Every spacecraft that reached the surface, by the country that flew it.",
    about: "landing attempts per country, stacked by outcome",
    table: "missions",
  },
  "crater-sizes": {
    title: "How big the named craters are",
    note: "Distribution of named crater diameters in km.",
    about: "a histogram of named crater diameters in kilometers",
    table: "features",
  },
} as const satisfies Record<
  string,
  { title: string; note: string; about: string; table: ChartTable }
>;
export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as [PresetId, ...PresetId[]];

export const customChartSchema = z.strictObject({
  table: z.enum(["missions", "features"]),
  type: z.enum(["bar", "line", "pie", "scatter"]),
  x: z.string().describe("Category or date field; a numeric field for scatter"),
  stat: z.enum(["count", "avg", "sum", "min", "max"]).default("count"),
  value: z
    .string()
    .optional()
    .describe("Numeric field to aggregate, or a scatterplot's y-axis"),
  where: z
    .string()
    .default("1=1")
    .describe("ArcGIS SQL predicate on the chart fields"),
  title: z.string().min(1),
});
export type CustomChart = z.infer<typeof customChartSchema>;

/** A chart card shows a preset or a custom chart. */
export type ChartRequest = { preset: PresetId } | { custom: CustomChart };

/** Checks a custom chart against the table's fields; returns an error the guide can act on. */
export function checkCustomChart(
  tables: ChartTables,
  c: CustomChart,
): string | undefined {
  const field = (name?: string) =>
    name ? tables[c.table].fields.find((f) => f.name === name) : undefined;
  const x = field(c.x);
  const value = field(c.value);
  if (!x) return `No field "${c.x}" in ${c.table}.`;
  if (c.value && !value) return `No field "${c.value}" in ${c.table}.`;
  if (c.type === "scatter") {
    return kindOf(x) === "number" &&
      value &&
      kindOf(value) === "number" &&
      c.stat === "count"
      ? undefined
      : "Scatter needs numeric x and value fields, without aggregation.";
  }
  if (kindOf(x) === "number")
    return "Group by a category or date field, or use scatter for a numeric x.";
  if (c.type === "pie" && kindOf(x) !== "category")
    return "Pie charts need a category field.";
  if (c.type === "line" && kindOf(x) !== "date" && !x.name.endsWith("Decade"))
    return "Line charts need a date or decade field.";
  if (c.stat === "count" && c.value) return "Count doesn't take a value field.";
  if (c.stat !== "count" && !(value && kindOf(value) === "number"))
    return `${c.stat} needs a numeric value field.`;
  return undefined;
}

export function chartInfo(request: ChartRequest): {
  title: string;
  note: string;
  table: ChartTable;
} {
  if ("preset" in request) return PRESETS[request.preset];
  const { custom } = request;
  return {
    title: custom.title,
    table: custom.table,
    note: TABLE_NOTE[custom.table],
  };
}

const createModel = async <T extends ModelTypes>(
  layer: FeatureLayer,
  chartType: T,
) => {
  const { createModel } =
    await import("@arcgis/charts-components/model/shared/setup-utils");
  const model = await createModel({ layer, chartType });
  // Use the chart palette, not the layer's renderer: the feature layer draws invisible points.
  if ("colorMatch" in model) model.colorMatch = false;
  return model;
};

/** The card has its own title; single-series charts don't need a legend. */
function plain(model: {
  chartTitleVisibility: boolean;
  legendVisibility: boolean;
  setAxisTitleVisibility(visible: boolean, index: number): void;
}) {
  model.chartTitleVisibility = false;
  model.legendVisibility = false;
  model.setAxisTitleVisibility(false, 0);
  model.setAxisTitleVisibility(false, 1);
}

async function createChartModel(request: ChartRequest, layer: FeatureLayer) {
  if ("preset" in request) {
    switch (request.preset) {
      case "outcomes-by-decade": {
        const model = await createModel(layer, "barChart");
        plain(model);
        model.xAxisField = "arrivalDecade";
        model.aggregationType = "count";
        model.splitByField = "outcome";
        model.stackedType = "stacked";
        model.legendVisibility = true;
        model.legendPosition = "bottom";
        model.setDataSortOrder("xAxisAsc");
        return model;
      }
      case "outcomes-by-country": {
        const model = await createModel(layer, "barChart");
        plain(model);
        model.xAxisField = "country";
        model.aggregationType = "count";
        model.splitByField = "outcome";
        model.stackedType = "stacked";
        model.legendVisibility = true;
        model.legendPosition = "bottom";
        model.rotated = true;
        model.setDataSortOrder("yAxisDesc");
        return model;
      }
      case "crater-sizes": {
        const model = await createModel(layer, "histogram");
        model.numericField = "diameterKm";
        plain(model);
        await model.setDataFilters({ where: "type = 'Crater'" });
        return model;
      }
    }
  }

  const c = request.custom;
  if (c.type === "scatter") {
    const model = await createModel(layer, "scatterplot");
    model.xAxisField = c.x;
    model.yAxisField = c.value!;
    plain(model);
    await model.setDataFilters({ where: c.where });
    return model;
  }
  if (c.type === "pie") {
    const model = await createModel(layer, "pieChart");
    model.category = c.x;
    model.aggregationType = c.stat;
    if (c.value) model.numericFields = [c.value];
    model.chartTitleVisibility = false;
    model.legendPosition = "bottom";
    await model.setDataFilters({ where: c.where });
    return model;
  }
  const model = await createModel(
    layer,
    c.type === "bar" ? "barChart" : "lineChart",
  );
  model.xAxisField = c.x;
  model.aggregationType = c.stat;
  if (c.value) model.numericFields = [c.value];
  plain(model);
  if (layer.fields.find((f) => f.name === c.x)?.type === "date") {
    // Count dates per year, like the landings preset; otherwise every record gets its own bar.
    model.binTemporalData = true;
    model.temporalBinningSize = 1;
    model.temporalBinningUnit = "years";
    model.trimIncompleteTimeInterval = false;
  }
  if (c.x.endsWith("Decade")) model.setDataSortOrder("xAxisAsc");
  await model.setDataFilters({ where: c.where });
  return model;
}

/** Draw a chart into an `arcgis-chart` element. The charts package loads on first use. */
export async function renderChart(
  el: HTMLArcgisChartElement,
  request: ChartRequest,
  tables: ChartTables,
): Promise<void> {
  await import("@arcgis/charts-components/components/arcgis-chart");
  const layer = tables[chartInfo(request).table];
  const model = await createChartModel(request, layer);
  el.ignoreViewExtent = true;
  el.layer = layer;
  el.model = model;
}
