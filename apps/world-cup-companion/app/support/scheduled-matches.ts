import type Graphic from "@arcgis/core/Graphic.js";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type { WorldCupFixture } from "./types";

export type ScheduledMatchesQuery = {
  city?: string;
  date?: string;
  matchId?: string;
  opponent?: string;
  stage?: string;
  teamName?: string;
};

export type ScheduledMatchesQueryResult = {
  features: Graphic[];
  layer: FeatureLayer | null;
};

const scheduledMatchesLayerTitle = "Scheduled Matches";

export const getOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const getInputString = (input: Record<string, unknown>, key: string): string | undefined =>
  getOptionalString(input[key]);

const escapeSqlString = (value: string): string => value.replaceAll("'", "''");

const buildScheduledMatchesWhereClause = ({
  city,
  date,
  matchId,
  opponent,
  stage,
  teamName,
}: ScheduledMatchesQuery): string => {
  const whereClauses: string[] = [];

  if (teamName) {
    const escapedTeamName = escapeSqlString(teamName);
    whereClauses.push(`(Team_A = '${escapedTeamName}' OR Team_B = '${escapedTeamName}')`);
  }

  // The layer has no city field; the stadium field holds the host city name (e.g. "Dallas").
  if (city) {
    whereClauses.push(`stadium = '${escapeSqlString(city)}'`);
  }
  if (date) {
    whereClauses.push(`match_date = DATE '${escapeSqlString(date)}'`);
  }
  if (matchId && Number.isFinite(Number(matchId))) {
    whereClauses.push(`match_ = ${Number(matchId)}`);
  }
  if (opponent) {
    const escapedOpponent = escapeSqlString(opponent);
    whereClauses.push(`(Team_A = '${escapedOpponent}' OR Team_B = '${escapedOpponent}')`);
  }
  if (stage) {
    whereClauses.push(`stage = '${escapeSqlString(stage)}'`);
  }

  return whereClauses.length ? whereClauses.join(" AND ") : "1 = 0";
};

const getFeatureAttribute = (feature: Graphic, fieldName: string): string => {
  const value: unknown = feature.attributes?.[fieldName];

  return typeof value === "number" || typeof value === "string" ? String(value) : "";
};

// The layer stores each match twice (once per team order), so keep one feature per match number.
const getUniqueFeatures = (features: Graphic[]): Graphic[] => {
  const featuresMap = new Map<string, Graphic>();

  features.forEach((feature, index) => {
    featuresMap.set(getFeatureAttribute(feature, "match_") || `feature-${index}`, feature);
  });

  return Array.from(featuresMap.values());
};

export const getScheduledMatchesLayer = (mapView: MapView): FeatureLayer | null =>
  (mapView.map?.allLayers.find((layer) => layer.title === scheduledMatchesLayerTitle) as FeatureLayer | undefined) ??
  null;

export const queryScheduledMatches = async (
  mapView: MapView,
  query: ScheduledMatchesQuery,
): Promise<ScheduledMatchesQueryResult> => {
  const layer = getScheduledMatchesLayer(mapView);

  if (!layer) {
    return { features: [], layer };
  }

  const featureSet = await layer.queryFeatures({
    outFields: ["*"],
    returnGeometry: true,
    where: buildScheduledMatchesWhereClause(query),
  });

  return {
    features: getUniqueFeatures(featureSet.features),
    layer,
  };
};

export const toWorldCupFixture = (feature: Graphic): WorldCupFixture => {
  const team = getFeatureAttribute(feature, "Team_A");
  const opponent = getFeatureAttribute(feature, "Team_B");
  const date = getFeatureAttribute(feature, "match_date");

  return {
    city: getFeatureAttribute(feature, "stadium"),
    date,
    matchId: getFeatureAttribute(feature, "match_") || `${team}-${opponent}-${date}`,
    opponent,
    stage: getFeatureAttribute(feature, "stage"),
    team,
  };
};

export const getScheduledFixtureLookupLabel = (input: Record<string, unknown>): string =>
  ["matchId", "team", "opponent", "date", "city", "stage"]
    .map((key) => getInputString(input, key))
    .filter(Boolean)
    .join(", ") || "the requested match";

export const queryScheduledFixturesFromInput = async (
  mapView: MapView,
  input: Record<string, unknown>,
): Promise<WorldCupFixture[]> => {
  const { features } = await queryScheduledMatches(mapView, {
    city: getInputString(input, "city"),
    date: getInputString(input, "date"),
    matchId: getInputString(input, "matchId"),
    opponent: getInputString(input, "opponent"),
    stage: getInputString(input, "stage"),
    teamName: getInputString(input, "team") ?? getInputString(input, "opponent"),
  });

  return features.map(toWorldCupFixture);
};
