import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";

/**
 * The app's data: three public hosted layers (no sign-in needed) plus a few static references.
 * Upload backups of the layers are in backups/; sources and terms are in docs/reference.md.
 *
 * Missions (51) and launch sites (10) are small, so they're read once at startup and used as
 * plain arrays. Craters (1,575) stay on the service and are queried with SQL when needed.
 */

export const MISSIONS_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/moon_missions/FeatureServer/0";
export const CRATERS_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/moon-craters/FeatureServer/0";
export const LAUNCH_SITES_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/moon_launch_sites/FeatureServer/0";

export const MOON_RADIUS_M = 1_737_400;

export type Outcome = "crewed" | "soft" | "crash" | "impact";
export const OUTCOMES: Outcome[] = ["crewed", "soft", "crash", "impact"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  crewed: "Crewed landing",
  soft: "Robotic landing",
  crash: "Crashed while landing",
  impact: "Planned impact",
};

/** Countries in the data, with the file name of their flag in public/flags/. */
export const FLAGS = {
  USA: "us",
  USSR: "su",
  Russia: "ru",
  China: "cn",
  India: "in",
  Japan: "jp",
  Israel: "il",
  "Europe (ESA)": "eu",
} as const;
export type Country = keyof typeof FLAGS;
export const flagUrl = (country: Country) => `/flags/${FLAGS[country]}.svg`;

export interface Mission {
  objectId: number;
  id: string;
  name: string;
  country: Country;
  outcome: Outcome;
  operator?: string;
  commercial: boolean;
  /** Epoch milliseconds, UTC. */
  arrivalDate: number;
  launchDate: number;
  lat: number;
  lon: number;
  site?: string;
  crew?: string[];
  orbitingCrew?: string;
  rover?: string;
  sampleReturn: boolean;
  /** The site hasn't been confirmed from orbit. */
  approximate: boolean;
  /** Describes a partial success. */
  partial?: string;
  note?: string;
  launchSiteId: string;
  vehicle: string;
  pad?: string;
  /** Mission id of another mission that shared the rocket. */
  rideshare?: string;
}

export interface LaunchSite {
  id: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
}

export interface Crater {
  name: string;
  lat: number;
  lon: number;
  diameterKm: number;
  /** What it's named after, as the gazetteer words it ("Tycho Brahe; Danish astronomer (1546-1601)."). */
  origin: string;
  yearApproved: number | null;
}

export interface MoonData {
  missions: Mission[];
  launchSites: LaunchSite[];
}

type Attributes = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value.trim()) || undefined;

function toMission(a: Attributes, objectId: number): Mission {
  return {
    objectId,
    id: a.id as string,
    name: a.name as string,
    country: a.country as Country,
    outcome: a.outcome as Outcome,
    operator: text(a.operator),
    commercial: a.commercial === 1,
    arrivalDate: a.arrivalDate as number,
    launchDate: a.launchDate as number,
    lat: a.lat as number,
    lon: a.lon as number,
    site: text(a.site),
    crew: text(a.crew)?.split(";").map((name) => name.trim()),
    orbitingCrew: text(a.orbitingCrew),
    rover: text(a.rover),
    sampleReturn: a.sampleReturn === 1,
    approximate: a.approximate === 1,
    partial: text(a.partial),
    note: text(a.note),
    launchSiteId: a.launchSiteId as string,
    vehicle: a.vehicle as string,
    pad: text(a.pad),
    rideshare: text(a.rideshare),
  };
}

export async function loadData(missions: FeatureLayer, launchSites: FeatureLayer): Promise<MoonData> {
  const [m, s] = await Promise.all([
    missions.queryFeatures({ where: "1=1", outFields: ["*"], orderByFields: ["arrivalDate"] }),
    launchSites.queryFeatures({ where: "1=1", outFields: ["id", "name", "place", "lat", "lon"] }),
  ]);
  return {
    missions: m.features.map((f) => toMission(f.attributes, f.getObjectId() as number)),
    launchSites: s.features.map((f) => f.attributes as LaunchSite),
  };
}

const CRATER_FIELDS = ["name", "lat", "lon", "diameterKm", "origin", "yearApproved"];

/** All craters matching an ArcGIS SQL `where` clause. */
export async function queryCraters(layer: FeatureLayer, where = "1=1"): Promise<Crater[]> {
  const { features } = await layer.queryFeatures({
    where,
    outFields: CRATER_FIELDS,
    returnGeometry: false,
    // The service returns 1,000 records per request by default; this allows all 1,575 at once.
    maxRecordCountFactor: 2,
  });
  return features.map((f) => f.attributes as Crater);
}

export async function findCrater(layer: FeatureLayer, name: string): Promise<Crater> {
  const [crater] = await queryCraters(layer, `name = ${sql(name)}`);
  if (!crater) throw new Error(`No crater named ${name}. Query craters for the exact name.`);
  return crater;
}

export function findMission(data: MoonData, id: string): Mission {
  const mission = data.missions.find((m) => m.id === id);
  if (!mission) throw new Error(`Unknown mission id: ${id}. Query missions for a valid id.`);
  return mission;
}

export function findLaunchSite(data: MoonData, id: string): LaunchSite {
  const site = data.launchSites.find((s) => s.id === id);
  if (!site) throw new Error(`Unknown launch site id: ${id}.`);
  return site;
}

/** A quoted SQL string literal. */
export const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Places people ask about that aren't missions or craters. */
export const PLACES = [
  { id: "south-pole", name: "the south pole", lat: -90, lon: 0 },
  { id: "north-pole", name: "the north pole", lat: 90, lon: 0 },
  { id: "far-side", name: "the center of the far side", lat: 0, lon: 180 },
  { id: "near-side", name: "the center of the near side", lat: 0, lon: 0 },
] as const;
export type Place = (typeof PLACES)[number];

const DAY = 86_400_000;
export const yearOf = (m: Mission) => new Date(m.arrivalDate).getUTCFullYear();
export const daysToSurface = (m: Mission) => Math.round((m.arrivalDate - m.launchDate) / DAY);
export const isLanding = (m: Mission) => m.outcome === "soft" || m.outcome === "crewed";
export const isFarSide = (p: { lon: number }) => Math.abs(p.lon) > 90;

export const formatDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
