import { z } from "zod";
import { isAbortError } from "@arcgis/core/core/promiseUtils.js";
import { FunctionTool } from "@arcgis/ai-components/agent-utils/tools/FunctionTool.js";
import {
  createHumanInTheLoopToolMiddleware,
  getHumanInTheLoopPayload,
} from "@arcgis/ai-components/agent-utils/middlewares/humanInTheLoop.js";
import { sendUXSuggestion } from "@arcgis/ai-components/orchestrator/signals.js";
import type { CardData } from "../cards/Cards";
import {
  PRESETS,
  PRESET_IDS,
  checkCustomChart,
  chartInfo,
  customChartSchema,
  describeChartFields,
  type ChartRequest,
} from "../cards/charts";
import {
  FEATURE_TYPES,
  PLACES,
  daysToSurface,
  findFeature,
  findLaunchSite,
  findMission,
  hemisphereOf,
  isLanding,
  queryFeatures,
  sql,
  yearOf,
  type Feature,
  type Mission,
} from "../data";
import type { MarsApp } from "../map/controller";
import {
  SHAPES,
  markFeatures,
  placeObject,
  typicalWidthM,
} from "../map/graphics";
import { marsDistanceKm, offset, type LatLon } from "../map/scale";
import { TRAVERSE_MISSIONS } from "../map/traverses";

/**
 * Every tool follows the same shape: validate the input, look up real data, act on the map
 * through `app`, send a card to the chat, and return facts for the model to explain.
 */

type Config = Parameters<typeof sendUXSuggestion>[1];

/** Send structured data to a chat card (rendered by cards/Cards.tsx). */
const showCard = <K extends keyof CardData>(
  type: K,
  data: CardData[K],
  config: Config,
) => sendUXSuggestion({ type, data: { ...data } }, config);

const json = (value: unknown) => JSON.stringify(value);

/**
 * Hands a tool's error back to the model as its result, so the model can fix its input and try
 * again. Without this, SDK 5.2 treats any error thrown by a tool as fatal and ends the
 * whole request with "I couldn't complete this request."
 */
function returnErrors<I extends Record<string, unknown>, O>(
  tool: FunctionTool<I, O>,
): FunctionTool<I, O> {
  // Added last, so it wraps only the tool's own work; chooseMission's question to the user stays outside.
  tool.middlewares.push({
    name: "returnErrors",
    handler: async (request, next) => {
      try {
        return await next(request);
      } catch (error) {
        if (isAbortError(error)) throw error;
        return json({
          error: error instanceof Error ? error.message : String(error),
        });
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

const missionTarget = z.strictObject({
  kind: z.literal("mission"),
  id: z.string().describe("Mission id from queryData"),
});
const featureTarget = z.strictObject({
  kind: z.literal("feature"),
  name: z
    .string()
    .describe(
      "Exact name of a named feature (crater, mons, vallis...) from queryData",
    ),
});
const placeTarget = z.strictObject({
  kind: z.literal("place"),
  id: z
    .enum(PLACES.map((p) => p.id))
    .describe(PLACES.map((p) => `${p.id}: ${p.name}`).join("; ")),
});
const surfaceTarget = z.discriminatedUnion("kind", [
  missionTarget,
  featureTarget,
  placeTarget,
]);

type Spot = LatLon & { name: string; mission?: Mission; feature?: Feature };

/** A feature's name as people say it: "Gale crater", but "Olympus Mons" as it is. */
const featureName = (f: Feature) =>
  f.type === "Crater" ? `${f.name} crater` : f.name;

async function resolve(
  app: MarsApp,
  target: z.infer<typeof surfaceTarget>,
): Promise<Spot> {
  switch (target.kind) {
    case "mission": {
      const mission = findMission(app.data, target.id);
      return {
        name: mission.name,
        lat: mission.lat,
        lon: mission.lon,
        mission,
      };
    }
    case "feature": {
      const feature = await findFeature(app.mars.features, target.name);
      return {
        name: featureName(feature),
        lat: feature.lat,
        lon: feature.lon,
        feature,
      };
    }
    case "place":
      return PLACES.find((p) => p.id === target.id)!;
  }
}

/** A mission's record with the derived facts the model needs. */
const missionFacts = (app: MarsApp, m: Mission) => ({
  ...m,
  arrivalDate: new Date(m.arrivalDate).toISOString(),
  launchDate: new Date(m.launchDate).toISOString(),
  launchSite: findLaunchSite(app.data, m.launchSiteId),
  sharedRocketWith: m.rideshare
    ? findMission(app.data, m.rideshare).name
    : undefined,
  daysToSurface: daysToSurface(m),
  hemisphere: hemisphereOf(m),
  routeAvailable: (TRAVERSE_MISSIONS as readonly string[]).includes(m.id),
});

const identifier = z.string().regex(/^[A-Za-z_]\w*$/);
const querySchema = z.strictObject({
  dataset: z.enum(["missions", "features"]),
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
  orderByFields: z
    .array(z.string().regex(/^[A-Za-z_]\w*( (ASC|DESC))?$/))
    .default([]),
  limit: z.number().int().min(1).max(1000).default(100),
});

export function createTools(app: MarsApp) {
  const { data, mars } = app;
  const fieldList = (layer: typeof mars.missions) =>
    layer.fields
      .filter((f) => f.type !== "oid")
      .map((f) => `${f.name} (${f.type})`)
      .join(", ");
  // Exact text values, so the model doesn't guess ('Mountain' instead of 'Mons') and get no rows.
  const valuesOf = (field: "country" | "launchSiteId") =>
    [...new Set(data.missions.map((m) => m[field]).filter(Boolean))]
      .sort()
      .map((v) => `'${v}'`)
      .join(", ");
  const featureTypes = Object.entries(FEATURE_TYPES)
    .map(([type, meaning]) => `'${type}' (${meaning})`)
    .join(", ");
  const exactValues = `Exact text values: mission country ${valuesOf("country")}; launchSiteId ${valuesOf("launchSiteId")}; hemisphere 'Northern' or 'Southern'; feature type ${featureTypes}.`;

  const queryData = new FunctionTool({
    name: "queryData",
    description: `Read-only ArcGIS queries on the missions layer (every spacecraft that reached the Martian surface) or the named-features layer (IAU names: craters, montes, valles, plains...), independent of the camera, time slider, and map selection. Give a SQL WHERE clause (not a SELECT statement) and either outFields or outStatistics with optional groupByFieldsForStatistics; orderByFields sorts. Missions: ${fieldList(mars.missions)}. Features: ${fieldList(mars.features)}. Include the mission id or feature name when a later action needs them. Dates are UTC; WHERE supports TIMESTAMP 'YYYY-MM-DD HH:MM:SS'. Mission flags are 0/1; missing text is null. Outcomes: soft (landed and worked), silent (landed, then went silent within moments), crash (crashed or lost while landing); successful landings are soft. Longitudes run -180 to 180, east positive. ${exactValues} Statistics are count, sum, min, max, avg on field names, not expressions; count the ObjectId field for record counts, and sort aggregates by their output names. Default limit 100, at most 1000; truncated means more rows exist. Returns the rows to you either way; doesn't change the map.`,
    inputSchema: querySchema,
    execute: async (input, config) => {
      const q = querySchema.parse(input);
      const layer = q.dataset === "missions" ? mars.missions : mars.features;
      const statistics = q.outStatistics.length > 0;
      const columns = statistics
        ? [
            ...q.groupByFieldsForStatistics,
            ...q.outStatistics.map((s) => s.outStatisticFieldName),
          ]
        : q.outFields;
      if (!columns.length)
        throw new Error("Choose outFields, or outStatistics.");
      const result = await layer.queryFeatures({
        where: q.where,
        returnGeometry: false,
        orderByFields: q.orderByFields,
        ...(statistics
          ? {
              outStatistics: q.outStatistics,
              groupByFieldsForStatistics: q.groupByFieldsForStatistics,
            }
          : {
              outFields: q.outFields,
              num: q.limit + 1,
            }),
      });
      // Report dates as ISO strings, including the min/max of a date field.
      const dates = new Set(
        layer.fields.filter((f) => f.type === "date").map((f) => f.name),
      );
      for (const s of q.outStatistics) {
        if (
          (s.statisticType === "min" || s.statisticType === "max") &&
          dates.has(s.onStatisticField)
        )
          dates.add(s.outStatisticFieldName);
      }
      const rows = result.features.slice(0, q.limit).map((f) =>
        Object.fromEntries(
          columns.map((column) => {
            const value = (f.attributes[column] ?? null) as
              | string
              | number
              | null;
            return [
              column,
              dates.has(column) && typeof value === "number"
                ? new Date(value).toISOString()
                : value,
            ];
          }),
        ),
      );
      const results = {
        columns,
        rows,
        truncated: result.features.length > q.limit,
      };
      // An empty table says nothing the reply can't.
      const shown = q.showTable && rows.length > 0;
      if (shown)
        await showCard(
          "query-results",
          { title: q.title ?? "Query results", ...results },
          config,
        );
      return json({
        dataset: q.dataset,
        shownToUser: shown ? "table card" : "nothing",
        ...results,
      });
    },
  });

  const goTo = new FunctionTool({
    name: "goTo",
    description:
      "Moves the camera to an explicitly typed target: a mission id or exact feature name from queryData (with a close-up and its card), a reference place, a launch site on Earth, or Mars or Earth as a whole. Travels between Earth and Mars as needed. No free-text name interpretation or type guessing.",
    inputSchema: z.strictObject({
      target: z.discriminatedUnion("kind", [
        missionTarget,
        featureTarget,
        placeTarget,
        z.strictObject({
          kind: z.literal("launchSite"),
          id: z
            .enum(data.launchSites.map((s) => s.id))
            .describe(
              data.launchSites
                .map((s) => `${s.id}: ${s.name}, ${s.place}`)
                .join("; "),
            ),
        }),
        z.strictObject({ kind: z.literal("mars") }),
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
      if (target.kind === "mars") {
        const alreadyThere = app.travel.world === "mars";
        app.showAllTime();
        // The trip takes about four seconds; let it play while the model replies.
        inBackground(app.travel.toMars(), "travel to Mars");
        return json(
          alreadyThere
            ? { alreadyOnMars: true }
            : {
                from: "Earth",
                to: "Mars",
                animationSeconds: 4,
                distanceNote:
                  "Mars is 55 to 400 million km from Earth depending on where both planets are in their orbits.",
                spacecraftReachingSurface: data.missions.length,
                successfulLandings: data.missions.filter(isLanding).length,
              },
        );
      }

      const spot = await resolve(app, target);
      if (spot.mission) {
        await showCard("mission-card", { id: spot.mission.id }, config);
        inBackground(app.visit(spot.mission), `visit ${spot.name}`);
        return json({
          shownToUser: "close-up and mission card",
          mission: missionFacts(app, spot.mission),
        });
      }
      await app.prepare();
      app.showAllTime();
      app.state.focus = spot.name;
      if (spot.feature) {
        markFeatures(mars.featureMarks, [spot.feature]);
        await showCard("feature-card", spot.feature, config);
      }
      const scale = spot.feature
        ? Math.min(Math.max(spot.feature.diameterKm * 8000, 50_000), 20_000_000)
        : 2_000_000;
      inBackground(app.flyTo(spot, { scale }), `go to ${spot.name}`);
      return json({
        shownToUser: spot.feature ? "close-up and feature card" : "close-up",
        target: spot.name,
        feature: spot.feature,
      });
    },
  });

  const showMissions = new FunctionTool({
    name: "showMissions",
    description:
      "Shows a set of missions in a list card and on the map, hiding the rest; labels up to six. Choose them with an SQL where on the mission fields (listed by arrival date), or with explicit missionIds in the order to show. Give neither to restore every mission marker and frame the whole planet. An empty missionIds list hides all markers. Returns the missions shown, so no separate query is needed.",
    inputSchema: z.strictObject({
      where: z
        .string()
        .min(1)
        .optional()
        .describe("ArcGIS SQL on the mission fields, e.g. outcome = 'soft'"),
      missionIds: z
        .array(z.string())
        .optional()
        .describe(
          "Explicit ids, when the selection or order comes from earlier steps",
        ),
      title: z.string().optional().describe("Card heading"),
    }),
    execute: async ({ where, missionIds, title }, config) => {
      if (where && missionIds)
        throw new Error("Give either where or missionIds, not both.");
      if (where) {
        const { features } = await mars.missions.queryFeatures({
          where,
          outFields: ["id"],
          orderByFields: ["arrivalDate"],
          returnGeometry: false,
        });
        missionIds = features.map((f) => f.attributes.id as string);
      }
      await app.prepare();
      app.showAllTime();
      if (!missionIds) {
        app.clear();
        app.state.focus = undefined;
        inBackground(app.frame(data.missions), "frame the missions");
        return json({
          shownToUser: "every mission marker",
          missionsShown: data.missions.length,
          note: "Missions on the far side of the planet from the camera are hidden behind the globe.",
        });
      }
      const missions = [...new Set(missionIds)].map((id) =>
        findMission(data, id),
      );
      const ids = missions.map((m) => m.id);
      app.select(ids, { only: true });
      await showCard(
        "mission-list",
        { title: title ?? "Missions", ids },
        config,
      );
      if (missions.length)
        inBackground(app.frame(missions), "frame the missions");
      return json({
        shownToUser: "list card; the map shows only these missions",
        count: missions.length,
        missions: missions.map((m) => ({
          id: m.id,
          name: m.name,
          country: m.country,
          outcome: m.outcome,
          year: yearOf(m),
        })),
      });
    },
  });

  type Choice = { missionIds: string[]; question: string };
  const choiceLabel = (m: Mission) => `${m.name} (${yearOf(m)})`;
  const chooseMission = new FunctionTool<Choice>({
    name: "chooseMission",
    description:
      "Asks the user to choose among mission ids from queryData and returns the chosen id. Use when the intended mission is ambiguous; it doesn't find candidates.",
    inputSchema: z.strictObject({
      missionIds: z.array(z.string()).min(2),
      question: z.string().min(1),
    }),
    middlewares: [
      // The SDK pauses the run and shows a native single-choice prompt in the chat.
      createHumanInTheLoopToolMiddleware<Choice>({
        id: "choose-mission",
        interrupt: async ({ input }) => ({
          kind: "singleSelection",
          message: input.question,
          metadata: input.missionIds.map((id) =>
            choiceLabel(findMission(data, id)),
          ),
        }),
      }),
    ],
    execute: async ({ missionIds }, config) => {
      const answer = getHumanInTheLoopPayload<unknown>(config);
      const chosen = missionIds
        .map((id) => findMission(data, id))
        .find((m) => m.id === answer || choiceLabel(m) === answer);
      if (!chosen) throw new Error("Choose one of the offered missions.");
      return json({ missionId: chosen.id });
    },
  });

  const showFeatures = new FunctionTool({
    name: "showFeatures",
    description:
      "Marks and frames exact feature names from queryData, in the given order: crater rims, or pins for other features. Shows a detail card for one feature or a list for several. Doesn't search or interpret names.",
    inputSchema: z.strictObject({
      names: z.array(z.string()).min(1),
      title: z.string().min(1),
    }),
    execute: async ({ names, title }, config) => {
      const requested = [...new Set(names)];
      const found = await queryFeatures(
        mars.features,
        `name IN (${requested.map(sql).join(", ")})`,
      );
      const features = requested.map((name) => {
        const feature = found.find((f) => f.name === name);
        if (!feature)
          throw new Error(
            `No feature named ${name}. Query features for the exact name.`,
          );
        return feature;
      });
      await app.prepare();
      app.clear();
      markFeatures(mars.featureMarks, features);
      if (features.length === 1) {
        const [feature] = features;
        app.state.focus = featureName(feature);
        await showCard("feature-card", feature, config);
        // Frame its north and south edges, so a big feature fills the view.
        const r = feature.diameterKm / 2;
        inBackground(
          app.frame([offset(feature, r), offset(feature, -r)]),
          "frame the feature",
        );
      } else {
        await showCard(
          "feature-list",
          { title, total: features.length, items: features },
          config,
        );
        inBackground(app.frame(features), "frame the features");
      }
      return json({
        shownToUser: `${features.length === 1 ? "feature card" : "feature list card"} and map marks`,
        features,
      });
    },
  });

  const nearestFeatures = new FunctionTool({
    name: "nearestFeatures",
    description:
      "Ranks named features by surface distance from an explicit mission, feature, or place to each feature's center (not its edge). An optional SQL where restricts the candidates (e.g. type = 'Crater'); the origin feature itself is left out. Marks the results on the map and lists them in a card.",
    inputSchema: z.strictObject({
      origin: surfaceTarget,
      where: z.string().min(1).default("1=1"),
      limit: z.number().int().min(1).max(25).default(10),
      title: z.string().min(1),
    }),
    execute: async ({ origin, where = "1=1", limit = 10, title }, config) => {
      const center = await resolve(app, origin);
      const candidates = await queryFeatures(
        mars.features,
        center.feature
          ? `(${where}) AND name <> ${sql(center.feature.name)}`
          : where,
      );
      const nearest = candidates
        .map((feature) => ({
          ...feature,
          km: Math.round(marsDistanceKm(center, feature) * 10) / 10,
        }))
        .sort((a, b) => a.km - b.km)
        .slice(0, limit);
      await app.prepare();
      app.clear();
      markFeatures(mars.featureMarks, nearest);
      app.state.focus = center.name;
      await showCard(
        "feature-list",
        { title, total: candidates.length, items: nearest, from: center.name },
        config,
      );
      if (nearest.length)
        inBackground(app.frame([center, ...nearest]), "frame the features");
      return json({
        shownToUser: "feature list card, features marked on the map",
        totalMatching: candidates.length,
        center: center.name,
        distanceBasis:
          "Approximate surface distance to feature centers, not edges; named features only.",
        features: nearest,
      });
    },
  });

  const showFeatureNames = new FunctionTool({
    name: "showFeatureNames",
    description:
      "Shows or hides the names of all named features. Off by default; features in the current answer are labeled anyway.",
    inputSchema: z.strictObject({ visible: z.boolean() }),
    execute: async ({ visible }) => {
      mars.features.labelsVisible = visible;
      return json({ featureNames: visible ? "shown" : "hidden" });
    },
  });

  const showElevation = new FunctionTool({
    name: "showElevation",
    description:
      "Shows or hides elevation colors over the imagery: a shaded relief from blue on the lowest ground, through green, yellow, and red, to white on the highest volcano summits. Changes only how the planet looks, not the camera; clearMap leaves it alone. Off by default.",
    inputSchema: z.strictObject({ visible: z.boolean() }),
    execute: async ({ visible }) => {
      if (visible) await app.travel.toMars();
      mars.relief.visible = visible;
      return json({
        elevationColors: visible ? "shown" : "hidden",
        colorKey: visible
          ? "Blue is the lowest ground, then green, yellow, and red, with white on the highest volcano summits. Colors are relative; this app has no elevation values."
          : undefined,
      });
    },
  });

  const showRoute = new FunctionTool({
    name: "showRoute",
    description:
      "Draws a rover's route across Mars from the mission team's published traverse map and frames it. Routes exist for Perseverance and Curiosity only. Returns the distance driven and how recent the data is.",
    inputSchema: z.strictObject({
      missionId: z.enum(TRAVERSE_MISSIONS),
    }),
    execute: async ({ missionId }, config) => {
      const t = await app.showTraverse(missionId);
      const mission = findMission(data, missionId);
      const card = {
        missionId,
        rover: t.rover,
        drivenKm: t.drivenKm,
        drives: t.drives,
        lastSol: t.lastSol,
        retrieved: t.retrieved,
        source: t.source,
      };
      await showCard("route-card", card, config);
      return json({
        shownToUser: "the route on the map and a route card",
        ...card,
        landed: new Date(mission.arrivalDate).toISOString().slice(0, 10),
        site: mission.site,
        distanceBasis:
          "Sum of the team's per-drive distances; drives after the retrieval date aren't included.",
      });
    },
  });

  const setTime = new FunctionTool({
    name: "setTime",
    description:
      "Stops time-slider playback. With a year, shows Mars as it was at the end of that year and returns how many spacecraft had reached the surface by then.",
    inputSchema: z.strictObject({
      year: z
        .number()
        .int()
        .min(1971)
        .max(new Date().getUTCFullYear())
        .optional(),
    }),
    execute: async ({ year }) => {
      await app.prepare();
      if (year === undefined)
        return json({
          paused: true,
          showingThrough: app.slider.timeExtent?.end?.toISOString(),
        });
      app.showYear(year);
      const soFar = data.missions.filter((m) => yearOf(m) <= year);
      return json({
        showingThrough: year,
        reachedSurfaceSoFar: soFar.length,
        successfulLandingsSoFar: soFar.filter(isLanding).length,
      });
    },
  });

  const chartSchema = z
    .strictObject({
      preset: z.enum(PRESET_IDS).optional(),
      custom: customChartSchema.optional(),
    })
    .refine(
      (input) => !input.preset !== !input.custom,
      "Give either a preset or a custom chart.",
    );
  const showChart = new FunctionTool({
    name: "showChart",
    description: `Shows a native chart card without changing the map. Returns display confirmation and caveats, not numbers: use queryData for facts and never estimate values from a chart. Presets:\n${PRESET_IDS.map((id) => `- ${id}: ${PRESETS[id].about}`).join("\n")}\nOr a custom chart: a type, an x field, an aggregation, an optional value field, and an SQL where on these fields (the mission fields match queryData's names and values; date fields are counted per year; use arrivalDecade or launchDecade for decades):\n${describeChartFields(app.charts)}`,
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
      "Stands any real object (a building, monument, mountain, rocket, ...) at true scale at an explicit mission, feature, or place, and frames it. Give its real size in meters from widely published figures and the closest shape; it's drawn as an outline, not a model. Compares its height with the feature's recorded size; depths and heights of Martian features aren't in the data.",
    inputSchema: z.strictObject({
      name: z.string().min(1),
      heightM: z.number().min(0.1).max(20_000),
      widthM: z
        .number()
        .min(0.1)
        .max(100_000)
        .optional()
        .describe("Footprint width; omit for the shape's typical proportions"),
      shape: z
        .enum(SHAPES)
        .describe(
          "tower: tall and tapering; mountain: a wide cone; block: a building or stadium; cylinder: a rocket or tank; sphere: a dome or ball",
        ),
      target: surfaceTarget,
    }),
    execute: async (
      { name, heightM, shape, widthM = typicalWidthM(shape, heightM), target },
      config,
    ) => {
      const spot = await resolve(app, target);
      const { feature } = spot;
      await app.prepare();
      app.showAllTime();
      // Beside a lander, east of it, so the two don't overlap. Craters wider than about 15 km have
      // a central peak (Gale's is Mount Sharp), so stand it on the floor south of center.
      const crater = feature?.type === "Crater" ? feature : undefined;
      const at = spot.mission
        ? offset(spot, 0, Math.max(0.3, widthM / 1000))
        : offset(
            spot,
            crater && crater.diameterKm >= 15 ? -crater.diameterKm * 0.15 : 0,
          );
      placeObject(
        mars.objects,
        shape,
        heightM,
        widthM,
        at,
        `${name}, ${heightM.toLocaleString("en-US")} m`,
      );
      markFeatures(mars.featureMarks, feature ? [feature] : []);
      app.state.focus = spot.name;
      const card = {
        name,
        heightM,
        widthM,
        at: spot.name,
        featureSizeKm: feature ? Math.round(feature.diameterKm) : undefined,
        featureWiderThanTallBy: feature
          ? Math.round((feature.diameterKm * 1000) / heightM)
          : undefined,
      };
      await showCard("object-card", card, config);
      // Frame a small feature whole; for big ones stay close enough that the object still reads.
      const scale = feature
        ? Math.min(feature.diameterKm, 60) * 6000
        : Math.max(Math.max(heightM, widthM) * 24, 2_500);
      inBackground(
        app.flyTo(at, { scale, tilt: 72, heading: spot.lat < -60 ? 180 : 0 }),
        "frame the object",
      );
      return json({
        shownToUser: "true-scale outline and comparison card",
        sizeSource: "the guide's general knowledge, not this app's data",
        ...card,
      });
    },
  });

  const clearMap = new FunctionTool({
    name: "clearMap",
    description:
      "Removes feature marks, rover routes, and placed objects, and clears mission selection, filters, and labels. Leaves the time slider alone.",
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
    returnErrors(showFeatures),
    returnErrors(nearestFeatures),
    returnErrors(showFeatureNames),
    returnErrors(showElevation),
    returnErrors(showRoute),
    returnErrors(setTime),
    returnErrors(showChart),
    returnErrors(placeObjectTool),
    returnErrors(clearMap),
  ];
}
