import { z } from "zod";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import { FunctionTool } from "@arcgis/ai-components/agent-utils/tools/FunctionTool.js";
import {
  createHumanInTheLoopToolMiddleware,
  getHumanInTheLoopPayload,
} from "@arcgis/ai-components/agent-utils/middlewares/humanInTheLoop.js";
import { sendUXSuggestion } from "@arcgis/ai-components/orchestrator/signals.js";
import type { CardData } from "../cards/Cards";
import { PRESETS, PRESET_IDS, checkCustomChart, chartInfo, customChartSchema, describeChartFields, type ChartRequest } from "../cards/charts";
import {
  PLACES,
  daysToSurface,
  findCrater,
  findLaunchSite,
  findMission,
  isFarSide,
  isLanding,
  queryCraters,
  sql,
  yearOf,
  type Crater,
  type Mission,
} from "../data";
import { photoFor } from "../extras/photos";
import type { MoonApp } from "../map/controller";
import { SHAPES, markCraters, placeObject, typicalWidthM } from "../map/graphics";
import { lunarDistanceKm, offset, type LatLon } from "../map/scale";

/**
 * Every tool follows the same shape: validate the input, look up real data, act on the map
 * through `app`, send a card to the chat, and return facts for the model to explain.
 */

type Config = Parameters<typeof sendUXSuggestion>[1];

/** Send structured data to a chat card (rendered by cards/Cards.tsx). */
const showCard = <K extends keyof CardData>(type: K, data: CardData[K], config: Config) =>
  sendUXSuggestion({ type, data: { ...data } }, config);

const json = (value: unknown) => JSON.stringify(value);

/**
 * Hands a tool's error back to the model as its result, so the model can fix its input and try
 * again. Without this, SDK 6.0.0-next.14 treats any error thrown by a tool as fatal and ends the
 * whole request with "I couldn't complete this request."
 */
function returnErrors<I extends Record<string, unknown>, O>(tool: FunctionTool<I, O>): FunctionTool<I, O> {
  // Added last, so it wraps only the tool's own work; chooseMission's question to the user stays outside.
  tool.middlewares.push({
    name: "returnErrors",
    handler: async (request, next) => {
      try {
        return await next(request);
      } catch (error) {
        if (isAbortError(error)) throw error;
        return json({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  });
  return tool;
}

/** Camera moves run while the model writes its reply; log failures other than interruptions. */
const inBackground = (promise: Promise<unknown>, what: string) =>
  void promise.catch((error: unknown) => {
    if (!isAbortError(error)) console.error(`Could not ${what}:`, error);
  });

const missionTarget = z.strictObject({ kind: z.literal("mission"), id: z.string().describe("Mission id from queryData") });
const craterTarget = z.strictObject({ kind: z.literal("crater"), name: z.string().describe("Exact crater name from queryData") });
const placeTarget = z.strictObject({
  kind: z.literal("place"),
  id: z.enum(PLACES.map((p) => p.id)).describe(PLACES.map((p) => `${p.id}: ${p.name}`).join("; ")),
});
const surfaceTarget = z.discriminatedUnion("kind", [missionTarget, craterTarget, placeTarget]);

type Spot = LatLon & { name: string; mission?: Mission; crater?: Crater };

async function resolve(app: MoonApp, target: z.infer<typeof surfaceTarget>): Promise<Spot> {
  switch (target.kind) {
    case "mission": {
      const mission = findMission(app.data, target.id);
      return { name: mission.name, lat: mission.lat, lon: mission.lon, mission };
    }
    case "crater": {
      const crater = await findCrater(app.moon.craters, target.name);
      return { name: `${crater.name} crater`, lat: crater.lat, lon: crater.lon, crater };
    }
    case "place":
      return PLACES.find((p) => p.id === target.id)!;
  }
}

/** A mission's record with the derived facts the model needs. */
const missionFacts = (app: MoonApp, m: Mission) => ({
  ...m,
  arrivalDate: new Date(m.arrivalDate).toISOString(),
  launchDate: new Date(m.launchDate).toISOString(),
  launchSite: findLaunchSite(app.data, m.launchSiteId),
  sharedRocketWith: m.rideshare ? findMission(app.data, m.rideshare).name : undefined,
  daysToSurface: daysToSurface(m),
  side: isFarSide(m) ? "Far side" : "Near side",
  photoFromOrbit: photoFor(m.id),
});

const identifier = z.string().regex(/^[A-Za-z_]\w*$/);
const querySchema = z.strictObject({
  dataset: z.enum(["missions", "craters"]),
  showTable: z
    .boolean()
    .default(false)
    .describe(
      "Show the rows as a table card. Only when the table is the answer the user wants (counts, statistics, rankings, comparisons); leave false when looking up ids or names for another tool, whose own card shows the result.",
    ),
  title: z.string().min(1).optional().describe("Heading for the table card"),
  where: z.string().min(1).default("1=1"),
  outFields: z.array(identifier).default([]),
  outStatistics: z
    .array(
      z.strictObject({
        statisticType: z.enum(["count", "sum", "min", "max", "avg"]),
        onStatisticField: identifier,
        outStatisticFieldName: identifier,
      }),
    )
    .default([]),
  groupByFieldsForStatistics: z.array(identifier).default([]),
  orderByFields: z.array(z.string().regex(/^[A-Za-z_]\w*( (ASC|DESC))?$/)).default([]),
  limit: z.number().int().min(1).max(1000).default(100),
});

export function createTools(app: MoonApp) {
  const { data, moon } = app;
  const fieldList = (layer: typeof moon.missions) => layer.fields.map((f) => `${f.name} (${f.type})`).join(", ");
  // Exact text values, so the model doesn't guess ('near' instead of 'Near side') and get no rows.
  const valuesOf = (field: "country" | "operator" | "launchSiteId") =>
    [...new Set(data.missions.map((m) => m[field]).filter(Boolean))].sort().map((v) => `'${v}'`).join(", ");
  const exactValues = `Exact text values: mission country ${valuesOf("country")}; operator ${valuesOf("operator")}; launchSiteId ${valuesOf("launchSiteId")}; crater side 'Near side' or 'Far side'.`;

  const queryData = new FunctionTool({
    name: "queryData",
    description: `Read-only ArcGIS queries on the hosted missions or craters layer, independent of the camera, time slider, and map selection. Give a SQL WHERE clause (not a SELECT statement) and either outFields or outStatistics with optional groupByFieldsForStatistics; orderByFields sorts. Missions: ${fieldList(moon.missions)}. Craters: ${fieldList(moon.craters)}. Include the mission id or crater name when a later action needs them. Dates are UTC; WHERE supports TIMESTAMP 'YYYY-MM-DD HH:MM:SS'. Mission flags are 0/1; missing text is null or empty. Outcomes: crewed, soft (robotic landing), crash, impact (planned impact); successful landings are crewed or soft. ${exactValues} Statistics are count, sum, min, max, avg on field names, not expressions; count the ${moon.missions.objectIdField} field for record counts, and sort aggregates by their output names. Default limit 100, at most 1000; truncated means more rows exist. Returns the rows to you either way; doesn't change the map.`,
    inputSchema: querySchema,
    execute: async (input, config) => {
      const q = querySchema.parse(input);
      const layer = q.dataset === "missions" ? moon.missions : moon.craters;
      const statistics = q.outStatistics.length > 0;
      const columns = statistics ? [...q.groupByFieldsForStatistics, ...q.outStatistics.map((s) => s.outStatisticFieldName)] : q.outFields;
      if (!columns.length) throw new Error("Choose outFields, or outStatistics.");
      const result = await layer.queryFeatures({
        where: q.where,
        returnGeometry: false,
        orderByFields: q.orderByFields,
        ...(statistics
          ? { outStatistics: q.outStatistics, groupByFieldsForStatistics: q.groupByFieldsForStatistics }
          : { outFields: q.outFields, num: q.limit + 1, maxRecordCountFactor: 2 }),
      });
      // Report dates as ISO strings, including the min/max of a date field.
      const dates = new Set(layer.fields.filter((f) => f.type === "date").map((f) => f.name));
      for (const s of q.outStatistics) {
        if ((s.statisticType === "min" || s.statisticType === "max") && dates.has(s.onStatisticField)) dates.add(s.outStatisticFieldName);
      }
      const rows = result.features.slice(0, q.limit).map((f) =>
        Object.fromEntries(
          columns.map((column) => {
            const value = (f.attributes[column] ?? null) as string | number | null;
            return [column, dates.has(column) && typeof value === "number" ? new Date(value).toISOString() : value];
          }),
        ),
      );
      const results = { columns, rows, truncated: result.features.length > q.limit };
      // An empty table says nothing the reply can't.
      const shown = q.showTable && rows.length > 0;
      if (shown) await showCard("query-results", { title: q.title ?? "Query results", ...results }, config);
      return json({ dataset: q.dataset, shownToUser: shown ? "table card" : "nothing", ...results });
    },
  });

  const goTo = new FunctionTool({
    name: "goTo",
    description:
      "Moves the camera to an explicitly typed target: a mission id or exact crater name from queryData (with a close-up and its card), a reference place, a launch site on Earth, or the Moon or Earth as a whole. Travels between Earth and the Moon as needed. No free-text name interpretation or type guessing.",
    inputSchema: z.strictObject({
      target: z.discriminatedUnion("kind", [
        missionTarget,
        craterTarget,
        placeTarget,
        z.strictObject({
          kind: z.literal("launchSite"),
          id: z.enum(data.launchSites.map((s) => s.id)).describe(data.launchSites.map((s) => `${s.id}: ${s.name}, ${s.place}`).join("; ")),
        }),
        z.strictObject({ kind: z.literal("moon") }),
        z.strictObject({ kind: z.literal("earth") }),
      ]),
    }),
    execute: async ({ target }, config) => {
      if (target.kind === "earth") {
        await app.slider.stop();
        await app.travel.toEarth();
        return json({ world: "earth" });
      }
      if (target.kind === "launchSite") {
        const site = findLaunchSite(data, target.id);
        await app.slider.stop();
        await app.travel.showOnEarth(site);
        return json({ shownToUser: "Earth, turned to the launch site", site });
      }
      if (target.kind === "moon") {
        const alreadyThere = app.travel.world === "moon";
        app.showAllTime();
        // The trip takes about four seconds; let it play while the model replies.
        inBackground(app.travel.toMoon(), "travel to the Moon");
        return json(
          alreadyThere
            ? { alreadyOnMoon: true }
            : {
                from: "Earth",
                to: "Moon",
                animationSeconds: 4,
                distanceKm: 384_400,
                missionsReachingSurface: data.missions.length,
                successfulLandings: data.missions.filter(isLanding).length,
              },
        );
      }

      const spot = await resolve(app, target);
      if (spot.mission) {
        await showCard("mission-card", { id: spot.mission.id }, config);
        inBackground(app.visit(spot.mission), `visit ${spot.name}`);
        return json({ shownToUser: "close-up and mission card", mission: missionFacts(app, spot.mission) });
      }
      await app.prepare();
      app.showAllTime();
      app.state.focus = spot.name;
      if (spot.crater) {
        markCraters(moon.craterMarks, [spot.crater]);
        await showCard("crater-card", spot.crater, config);
      }
      const scale = spot.crater ? Math.min(Math.max(spot.crater.diameterKm * 8000, 50_000), 3_000_000) : 50_000;
      inBackground(app.flyTo(spot, { scale }), `go to ${spot.name}`);
      return json({ shownToUser: spot.crater ? "close-up and crater card" : "close-up", target: spot.name, crater: spot.crater });
    },
  });

  const showMissions = new FunctionTool({
    name: "showMissions",
    description:
      "Shows a set of missions in a list card and on the map, hiding the rest; labels up to six. Choose them with an SQL where on the mission fields (listed by arrival date), or with explicit missionIds in the order to show. Give neither to restore every mission marker and frame the whole Moon. An empty missionIds list hides all markers. Returns the missions shown, so no separate query is needed.",
    inputSchema: z.strictObject({
      where: z.string().min(1).optional().describe("ArcGIS SQL on the mission fields, e.g. outcome IN ('crewed', 'soft')"),
      missionIds: z.array(z.string()).optional().describe("Explicit ids, when the selection or order comes from earlier steps"),
      title: z.string().optional().describe("Card heading"),
    }),
    execute: async ({ where, missionIds, title }, config) => {
      if (where && missionIds) throw new Error("Give either where or missionIds, not both.");
      if (where) {
        const { features } = await moon.missions.queryFeatures({ where, outFields: ["id"], orderByFields: ["arrivalDate"], returnGeometry: false });
        missionIds = features.map((f) => f.attributes.id as string);
      }
      await app.prepare();
      app.showAllTime();
      if (!missionIds) {
        app.clear();
        app.state.focus = undefined;
        inBackground(app.frame(data.missions.filter((m) => !isFarSide(m))), "frame the missions");
        return json({
          shownToUser: "whole-Moon view with every mission marker",
          missionsShown: data.missions.length,
          note: "Far-side missions are hidden behind the globe in this view.",
        });
      }
      const missions = [...new Set(missionIds)].map((id) => findMission(data, id));
      const ids = missions.map((m) => m.id);
      app.select(ids, { only: true });
      await showCard("mission-list", { title: title ?? "Missions", ids }, config);
      if (missions.length) inBackground(app.frame(missions), "frame the missions");
      return json({
        shownToUser: "list card; the map shows only these missions",
        count: missions.length,
        missions: missions.map((m) => ({ id: m.id, name: m.name, country: m.country, outcome: m.outcome, year: yearOf(m) })),
      });
    },
  });

  type Choice = { missionIds: string[]; question: string };
  const choiceLabel = (m: Mission) => `${m.name} (${yearOf(m)})`;
  const chooseMission = new FunctionTool<Choice>({
    name: "chooseMission",
    description:
      "Asks the user to choose among mission ids from queryData and returns the chosen id. Use when the intended mission is ambiguous; it doesn't find candidates.",
    inputSchema: z.strictObject({ missionIds: z.array(z.string()).min(2), question: z.string().min(1) }),
    middlewares: [
      // The SDK pauses the run and shows a native single-choice prompt in the chat.
      createHumanInTheLoopToolMiddleware<Choice>({
        id: "choose-mission",
        interrupt: async ({ input }) => ({
          kind: "singleSelection",
          message: input.question,
          metadata: input.missionIds.map((id) => choiceLabel(findMission(data, id))),
        }),
      }),
    ],
    execute: async ({ missionIds }, config) => {
      const answer = getHumanInTheLoopPayload<unknown>(config);
      const chosen = missionIds.map((id) => findMission(data, id)).find((m) => m.id === answer || choiceLabel(m) === answer);
      if (!chosen) throw new Error("Choose one of the offered missions.");
      return json({ missionId: chosen.id });
    },
  });

  const showCraters = new FunctionTool({
    name: "showCraters",
    description:
      "Marks and frames exact crater names from queryData, in the given order. Shows a detail card for one crater or a list for several. Doesn't search or interpret names.",
    inputSchema: z.strictObject({ names: z.array(z.string()).min(1), title: z.string().min(1) }),
    execute: async ({ names, title }, config) => {
      const requested = [...new Set(names)];
      const found = await queryCraters(moon.craters, `name IN (${requested.map(sql).join(", ")})`);
      const craters = requested.map((name) => {
        const crater = found.find((c) => c.name === name);
        if (!crater) throw new Error(`No crater named ${name}. Query craters for the exact name.`);
        return crater;
      });
      await app.prepare();
      app.clear();
      markCraters(moon.craterMarks, craters);
      if (craters.length === 1) {
        const [crater] = craters;
        app.state.focus = `${crater.name} crater`;
        await showCard("crater-card", crater, config);
        // Frame the rim's north and south edges, so a big crater fills the view.
        const r = crater.diameterKm / 2;
        inBackground(app.frame([offset(crater, r), offset(crater, -r)]), "frame the crater");
      } else {
        await showCard("crater-list", { title, total: craters.length, items: craters }, config);
        inBackground(app.frame(craters), "frame the craters");
      }
      return json({ shownToUser: "crater card and map marks", craters });
    },
  });

  const nearestCraters = new FunctionTool({
    name: "nearestCraters",
    description:
      "Ranks named craters by lunar surface distance from an explicit mission, crater, or place to each crater's center (not its rim). An optional SQL where restricts the candidates; the origin crater itself is left out. Marks the results on the map and lists them in a card.",
    inputSchema: z.strictObject({
      origin: surfaceTarget,
      where: z.string().min(1).default("1=1"),
      limit: z.number().int().min(1).max(25).default(10),
      title: z.string().min(1),
    }),
    execute: async ({ origin, where = "1=1", limit = 10, title }, config) => {
      const center = await resolve(app, origin);
      const candidates = await queryCraters(moon.craters, center.crater ? `(${where}) AND name <> ${sql(center.crater.name)}` : where);
      const nearest = candidates
        .map((crater) => ({ ...crater, km: Math.round(lunarDistanceKm(center, crater) * 10) / 10 }))
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
      await app.prepare();
      app.clear();
      markCraters(moon.craterMarks, nearest);
      app.state.focus = center.name;
      await showCard("crater-list", { title, total: candidates.length, items: nearest, from: center.name }, config);
      if (nearest.length) inBackground(app.frame([center, ...nearest]), "frame the craters");
      return json({
        shownToUser: "crater list card, craters marked on the map",
        totalMatching: candidates.length,
        center: center.name,
        distanceBasis: "Approximate surface distance to crater centers, not rims; named craters only.",
        craters: nearest,
      });
    },
  });

  const showCraterNames = new FunctionTool({
    name: "showCraterNames",
    description: "Shows or hides the names of all craters. Off by default; craters in the current answer are labeled anyway.",
    inputSchema: z.strictObject({ visible: z.boolean() }),
    execute: async ({ visible }) => {
      moon.craters.labelsVisible = visible;
      return json({ craterNames: visible ? "shown" : "hidden" });
    },
  });

  const setTime = new FunctionTool({
    name: "setTime",
    description:
      "Stops time-slider playback. With a year, shows the Moon as it was at the end of that year and returns how many missions had arrived by then.",
    inputSchema: z.strictObject({ year: z.number().int().min(1959).max(new Date().getUTCFullYear()).optional() }),
    execute: async ({ year }) => {
      await app.prepare();
      if (year === undefined) return json({ paused: true, showingThrough: app.slider.timeExtent?.end?.toISOString() });
      app.showYear(year);
      const soFar = data.missions.filter((m) => yearOf(m) <= year);
      return json({ showingThrough: year, missionsSoFar: soFar.length, landingsSoFar: soFar.filter(isLanding).length });
    },
  });

  const chartSchema = z
    .strictObject({ preset: z.enum(PRESET_IDS).optional(), custom: customChartSchema.optional() })
    .refine((input) => !input.preset !== !input.custom, "Give either a preset or a custom chart.");
  const showChart = new FunctionTool({
    name: "showChart",
    description: `Shows a native chart card without changing the map. Returns display confirmation and caveats, not numbers: use queryData for facts and never estimate values from a chart. Presets:\n${PRESET_IDS.map((id) => `- ${id}: ${PRESETS[id].about}`).join("\n")}\nOr a custom chart: a type, an x field, an aggregation, an optional value field, and an SQL where on these fields (the mission fields match queryData's names and values; the SDK handles date binning):\n${describeChartFields(app.charts)}`,
    inputSchema: chartSchema,
    execute: async ({ preset, custom }, config) => {
      let request: ChartRequest;
      if (custom) {
        const chart = customChartSchema.parse(custom);
        const error = checkCustomChart(app.charts, chart);
        if (error) throw new Error(error);
        // Check the where clause before showing the card.
        await app.charts[chart.table].queryFeatureCount({ where: chart.where });
        request = { custom: chart };
      } else {
        request = { preset: preset! };
      }
      const { title, note } = chartInfo(request);
      await showCard("chart", request, config);
      return json({ shownToUser: `chart card: ${title}`, caveats: note });
    },
  });

  const placeObjectTool = new FunctionTool({
    name: "placeObject",
    description:
      "Stands any real object (a building, monument, mountain, rocket, ...) at true scale at an explicit mission, crater, or place, and frames it. Give its real size in meters from widely published figures and the closest shape; it's drawn as an outline, not a model. Compares its height with a crater's diameter; crater depths are unavailable.",
    inputSchema: z.strictObject({
      name: z.string().min(1),
      heightM: z.number().min(0.1).max(20_000),
      widthM: z.number().min(0.1).max(100_000).optional().describe("Footprint width; omit for the shape's typical proportions"),
      shape: z
        .enum(SHAPES)
        .describe("tower: tall and tapering; mountain: a wide cone; block: a building or stadium; cylinder: a rocket or tank; sphere: a dome or ball"),
      target: surfaceTarget,
    }),
    execute: async ({ name, heightM, shape, widthM = typicalWidthM(shape, heightM), target }, config) => {
      const spot = await resolve(app, target);
      const { crater } = spot;
      await app.prepare();
      app.showAllTime();
      // Beside a lander, east of it, so the two don't overlap. Craters wider than about 15 km have
      // a central peak, so stand it on the flat floor south of center (the camera looks north).
      const at = spot.mission
        ? offset(spot, 0, Math.max(0.3, widthM / 1000))
        : offset(spot, crater && crater.diameterKm >= 15 ? -crater.diameterKm * 0.15 : 0);
      placeObject(moon.objects, shape, heightM, widthM, at, `${name}, ${heightM.toLocaleString("en-US")} m`);
      markCraters(moon.craterMarks, crater ? [crater] : []);
      app.state.focus = spot.name;
      const card = {
        name,
        heightM,
        widthM,
        at: spot.name,
        craterDiameterKm: crater ? Math.round(crater.diameterKm) : undefined,
        craterWiderThanTallBy: crater ? Math.round((crater.diameterKm * 1000) / heightM) : undefined,
      };
      await showCard("object-card", card, config);
      // Frame a small crater whole; for big ones stay close enough that the object still reads.
      const scale = crater ? Math.min(crater.diameterKm, 60) * 6000 : Math.max(Math.max(heightM, widthM) * 24, 2_500);
      inBackground(app.flyTo(at, { scale, tilt: 72, heading: spot.lat < -60 ? 180 : 0 }), "frame the object");
      return json({
        shownToUser: "true-scale outline and comparison card",
        sizeSource: "the guide's general knowledge, not this app's data",
        ...card,
      });
    },
  });

  const clearMap = new FunctionTool({
    name: "clearMap",
    description: "Removes crater marks and placed objects, and clears mission selection, filters, and labels. Leaves the time slider alone.",
    inputSchema: z.strictObject({}),
    execute: async () => {
      app.clear();
      return json({ cleared: true });
    },
  });

  return [
    returnErrors(queryData),
    returnErrors(goTo),
    returnErrors(showMissions),
    returnErrors(chooseMission),
    returnErrors(showCraters),
    returnErrors(nearestCraters),
    returnErrors(showCraterNames),
    returnErrors(setTime),
    returnErrors(showChart),
    returnErrors(placeObjectTool),
    returnErrors(clearMap),
  ];
}
