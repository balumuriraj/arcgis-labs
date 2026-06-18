import type Graphic from "@arcgis/core/Graphic.js";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import type MapView from "@arcgis/core/views/MapView.js";

export type WorldCupFixture = {
  city: string;
  date: string;
  displayDate: string;
  matchId: string;
  opponent: string;
  stage: string;
  team: string;
  venue: string;
  venueAlias?: string;
};

export type TicketTier = "Category 1" | "Category 2" | "Category 3";

export type TicketPriceTier = {
  availability: "High" | "Limited" | "Medium";
  price: number;
  tier: TicketTier;
};

export type TicketPriceCardData = {
  fixture: WorldCupFixture;
  tiers: TicketPriceTier[];
};

export type TicketOrderConfirmationData = {
  fixture: WorldCupFixture;
  orderId: string;
  orderTotal: number;
  quantity: number;
  tier: TicketTier;
};

export type WeatherCardData = {
  city: string;
  condition: string;
  date: string;
  high: number;
  low: number;
  precipitationChance: number;
  provider: string;
  venue?: string;
  windMph: number;
};

export type WorldCupMapContext = {
  mapView: MapView;
};

export type AgentConfigWithContext = {
  configurable?: {
    context?: unknown;
  };
};

let mapContextPromise: Promise<WorldCupMapContext> | undefined;

export const getWorldCupMapContext = async (): Promise<WorldCupMapContext> => {
  mapContextPromise ??= (async (): Promise<WorldCupMapContext> => {
    const mapElement = document.querySelector<HTMLArcgisMapElement>("#world-cup-map");

    if (!mapElement) {
      throw new Error("Expected #world-cup-map for the World Cup Companion story.");
    }

    await mapElement.viewOnReady();

    if (!mapElement.view) {
      throw new Error("The World Cup Companion map is ready but does not expose a view.");
    }

    return {
      mapView: mapElement.view,
    };
  })();

  return await mapContextPromise;
};

export const getWorldCupMapContextFromAgentConfig = (
  config: AgentConfigWithContext | undefined,
  agentName: string,
): WorldCupMapContext => {
  const context = config?.configurable?.context;

  if (!context || typeof context !== "object" || !("mapView" in context)) {
    throw new Error(`${agentName} requires WorldCupMapContext from arcgis-assistant-agent context.`);
  }

  return context as WorldCupMapContext;
};

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

  if (city) {
    whereClauses.push(`stadium = '${escapeSqlString(city)}'`);
  }
  if (date) {
    whereClauses.push(`match_date = DATE '${escapeSqlString(date)}'`);
  }
  if (matchId) {
    whereClauses.push(`match_ = '${escapeSqlString(matchId)}'`);
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
  const attributes = (feature as { attributes?: Record<string, unknown> }).attributes;
  const value = attributes?.[fieldName];

  return typeof value === "number" || typeof value === "string" ? String(value) : "";
};

const getFeatureKey = (feature: Graphic, index: number): string => {
  const attributes = (feature as { attributes?: Record<string, unknown> }).attributes;
  const matchId = attributes?.match_;

  return typeof matchId === "number" || typeof matchId === "string" ? String(matchId) : `feature-${index}`;
};

const getUniqueFeatures = (features: Graphic[]): Graphic[] => {
  const featuresMap = new Map<string, Graphic>();

  features.forEach((feature, index) => {
    featuresMap.set(getFeatureKey(feature, index), feature);
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
  const venue = getFeatureAttribute(feature, "stadium");

  return {
    city: getFeatureAttribute(feature, "city") || venue,
    date,
    displayDate: date,
    matchId: getFeatureAttribute(feature, "match_") || `${team}-${opponent}-${date}`,
    opponent,
    stage: getFeatureAttribute(feature, "stage"),
    team,
    venue,
  };
};

export const queryScheduledFixtures = async (
  mapView: MapView,
  query: ScheduledMatchesQuery,
): Promise<WorldCupFixture[]> => (await queryScheduledMatches(mapView, query)).features.map(toWorldCupFixture);

export const getScheduledFixtureLookupLabel = (input: Record<string, unknown>): string =>
  ["matchId", "team", "opponent", "date", "city", "stage"]
    .map((key) => getInputString(input, key))
    .filter(Boolean)
    .join(", ") || "the requested match";

export const queryScheduledFixturesFromInput = async (
  mapView: MapView,
  input: Record<string, unknown>,
): Promise<WorldCupFixture[]> =>
  await queryScheduledFixtures(mapView, {
    city: getInputString(input, "city"),
    date: getInputString(input, "date"),
    matchId: getInputString(input, "matchId"),
    opponent: getInputString(input, "opponent"),
    stage: getInputString(input, "stage"),
    teamName: getInputString(input, "team") ?? getInputString(input, "opponent"),
  });

type WeatherProviderParameters = {
  city: string;
  date: string;
};

type GeocodingResult = {
  admin1?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  timezone?: string;
};

type GeocodingResponse = {
  results?: Record<string, unknown>[];
};

type ForecastDaily = {
  precipitationProbabilityMax?: number[];
  temperatureMax?: number[];
  temperatureMin?: number[];
  time?: string[];
  weatherCode?: number[];
  windSpeedMax?: number[];
};

type ForecastResponse = Record<string, unknown>;

type LocatedGeocodingResult = GeocodingResult & {
  latitude: number;
  longitude: number;
};

const getNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];

  return typeof value === "number" ? value : undefined;
};

const getString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];

  return typeof value === "string" ? value : undefined;
};

const getNumberArray = (record: Record<string, unknown>, key: string): number[] | undefined => {
  const value = record[key];

  return Array.isArray(value) && value.every((item) => typeof item === "number") ? value : undefined;
};

const getStringArray = (record: Record<string, unknown>, key: string): string[] | undefined => {
  const value = record[key];

  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
};

const parseGeocodingResult = (record: Record<string, unknown>): GeocodingResult => ({
  admin1: getString(record, "admin1"),
  countryCode: getString(record, "country_code"),
  latitude: getNumber(record, "latitude"),
  longitude: getNumber(record, "longitude"),
  name: getString(record, "name"),
  timezone: getString(record, "timezone"),
});

const parseForecastDaily = (forecast: ForecastResponse): ForecastDaily | undefined => {
  const daily = forecast.daily;

  if (!daily || typeof daily !== "object" || Array.isArray(daily)) {
    return undefined;
  }

  const dailyRecord = daily as Record<string, unknown>;

  return {
    precipitationProbabilityMax: getNumberArray(dailyRecord, "precipitation_probability_max"),
    temperatureMax: getNumberArray(dailyRecord, "temperature_2m_max"),
    temperatureMin: getNumberArray(dailyRecord, "temperature_2m_min"),
    time: getStringArray(dailyRecord, "time"),
    weatherCode: getNumberArray(dailyRecord, "weather_code"),
    windSpeedMax: getNumberArray(dailyRecord, "wind_speed_10m_max"),
  };
};

const getWeatherCondition = (weatherCode: number | undefined): string => {
  if (weatherCode === undefined) {
    return "Forecast unavailable";
  }

  if (weatherCode === 0) {
    return "Clear sky";
  }
  if ([1, 2, 3].includes(weatherCode)) {
    return "Partly cloudy";
  }
  if ([45, 48].includes(weatherCode)) {
    return "Foggy";
  }
  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return "Drizzle";
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return "Rain likely";
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "Snow likely";
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return "Thunderstorms possible";
  }

  return "Forecast available";
};

const getJson = async <Response>(url: string): Promise<Response> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}.`);
  }

  return (await response.json()) as Response;
};

const getCoordinates = async (city: string): Promise<LocatedGeocodingResult> => {
  const searchUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  searchUrl.searchParams.set("name", city);
  searchUrl.searchParams.set("count", "1");
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("format", "json");

  const geocoding = await getJson<GeocodingResponse>(searchUrl.toString());
  const location = geocoding.results
    ?.map(parseGeocodingResult)
    .find((result) => typeof result.latitude === "number" && typeof result.longitude === "number");

  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    throw new Error(`Could not find weather coordinates for ${city}.`);
  }

  return { ...location, latitude: location.latitude, longitude: location.longitude };
};

const getLocationLabel = (location: GeocodingResult, fallbackCity: string): string => {
  const locality = location.name?.trim() || fallbackCity;
  const region = location.admin1?.trim();
  const country = location.countryCode?.trim();

  return [locality, region, country].filter(Boolean).join(", ");
};

export const getWeather = async ({ city, date }: WeatherProviderParameters): Promise<WeatherCardData> => {
  const location = await getCoordinates(city);
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", location.latitude.toString());
  forecastUrl.searchParams.set("longitude", location.longitude.toString());
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
  );
  forecastUrl.searchParams.set("temperature_unit", "fahrenheit");
  forecastUrl.searchParams.set("wind_speed_unit", "mph");
  forecastUrl.searchParams.set("timezone", location.timezone ?? "auto");
  forecastUrl.searchParams.set("start_date", date);
  forecastUrl.searchParams.set("end_date", date);

  const forecast = await getJson<ForecastResponse>(forecastUrl.toString());
  const daily = parseForecastDaily(forecast);

  if (!daily?.time?.length) {
    throw new Error(`No weather forecast returned for ${city} on ${date}.`);
  }

  return {
    city: getLocationLabel(location, city),
    condition: getWeatherCondition(daily.weatherCode?.[0]),
    date: daily.time[0] ?? date,
    high: Math.round(daily.temperatureMax?.[0] ?? 0),
    low: Math.round(daily.temperatureMin?.[0] ?? 0),
    precipitationChance: Math.round(daily.precipitationProbabilityMax?.[0] ?? 0),
    provider: "Open-Meteo forecast",
    windMph: Math.round(daily.windSpeedMax?.[0] ?? 0),
  };
};
