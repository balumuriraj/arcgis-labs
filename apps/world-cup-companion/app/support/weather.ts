import type { WeatherCardData } from "./types";

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
  precipitationSum?: number[];
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
    precipitationSum: getNumberArray(dailyRecord, "precipitation_sum"),
    temperatureMax: getNumberArray(dailyRecord, "temperature_2m_max"),
    temperatureMin: getNumberArray(dailyRecord, "temperature_2m_min"),
    time: getStringArray(dailyRecord, "time"),
    weatherCode: getNumberArray(dailyRecord, "weather_code"),
    windSpeedMax: getNumberArray(dailyRecord, "wind_speed_10m_max"),
  };
};

const getWeatherCondition = (weatherCode: number | undefined): string => {
  if (weatherCode === undefined) {
    return "Conditions unavailable";
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
    return "Rain";
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "Snow";
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return "Thunderstorms";
  }

  return "Mixed conditions";
};

const getJson = async <Response>(url: string): Promise<Response> => {
  const response = await fetch(url);

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
    const reason = body ? getString(body, "reason") : undefined;

    throw new Error(`Weather request failed with status ${response.status}${reason ? `: ${reason}` : ""}.`);
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

// Open-Meteo's forecast endpoint only serves ~92 past days and 16 future days. Older dates come from the
// historical archive, which lags a few days behind real time.
const archiveCutoffDays = -7;
const forecastHorizonDays = 16;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const getDaysFromToday = (date: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error(`Weather date must use the YYYY-MM-DD format. Received "${date}".`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return Math.round((Date.parse(date) - Date.parse(today)) / millisecondsPerDay);
};

export const getWeather = async ({ city, date }: WeatherProviderParameters): Promise<WeatherCardData> => {
  const daysFromToday = getDaysFromToday(date);

  if (daysFromToday > forecastHorizonDays) {
    throw new Error(
      `Forecasts are only available up to ${forecastHorizonDays} days ahead, so ${date} is too far out for ${city}.`,
    );
  }

  const isHistorical = daysFromToday < archiveCutoffDays;
  const location = await getCoordinates(city);
  const forecastUrl = new URL(
    isHistorical ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast",
  );
  forecastUrl.searchParams.set("latitude", location.latitude.toString());
  forecastUrl.searchParams.set("longitude", location.longitude.toString());
  forecastUrl.searchParams.set(
    "daily",
    `weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,${
      isHistorical ? "precipitation_sum" : "precipitation_probability_max"
    }`,
  );
  forecastUrl.searchParams.set("precipitation_unit", "inch");
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
    ...(isHistorical
      ? { precipitationInches: Math.round((daily.precipitationSum?.[0] ?? 0) * 100) / 100 }
      : { precipitationChance: Math.round(daily.precipitationProbabilityMax?.[0] ?? 0) }),
    provider: isHistorical ? "Open-Meteo historical weather" : "Open-Meteo forecast",
    windMph: Math.round(daily.windSpeedMax?.[0] ?? 0),
  };
};
