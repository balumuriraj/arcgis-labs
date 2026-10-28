import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import { LAUNCH_SITES, MISSIONS } from "./records";

/**
 * The app's data:
 * - Landing attempts (17) and launch sites (4) are small and live in records.ts; they become
 *   client-side layers at startup.
 * - Named features (1,879, from the IAU gazetteer via Esri's public Mars nomenclature service) are
 *   read once at startup and normalized into a client-side layer (map/mars.ts).
 * - Rover traverses (public/data/traverses.json) load the first time someone asks for one.
 * Sources and terms are in docs/reference.md.
 */

export const FEATURES_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Mars_Nomenclature_All/FeatureServer/7";

export const MARS_RADIUS_M = 3_396_190;

export type Outcome = "soft" | "silent" | "crash";
export const OUTCOMES: Outcome[] = ["soft", "silent", "crash"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  soft: "Landed and worked",
  silent: "Landed, then went silent",
  crash: "Crashed or lost while landing",
};

/** Countries in the data, with the file name of their flag in public/flags/. */
export const FLAGS = {
  USA: "us",
  USSR: "su",
  China: "cn",
  "Europe (ESA)": "eu",
  UK: "gb",
} as const;
export type Country = keyof typeof FLAGS;
export const flagUrl = (country: Country) => `/flags/${FLAGS[country]}.svg`;

export interface Mission {
  /** Position in MISSIONS plus one; the client-side layer's object id. */
  objectId: number;
  id: string;
  name: string;
  country: Country;
  outcome: Outcome;
  operator: string;
  /** Epoch milliseconds, UTC. */
  arrivalDate: number;
  launchDate: number;
  lat: number;
  lon: number;
  site: string;
  rover?: string;
  /** The site hasn't been confirmed from orbit. */
  approximate: boolean;
  note?: string;
  launchSiteId: string;
  vehicle: string;
  /** Mission id of another lander that shared the rocket. */
  rideshare?: string;
}

export interface LaunchSite {
  id: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
}

export interface Feature {
  name: string;
  /** The IAU descriptor, singular: Crater, Mons, Vallis, Planitia, ... */
  type: string;
  lat: number;
  /** -180 to 180, east positive. */
  lon: number;
  /** For a crater its diameter; for other features the gazetteer's size, roughly their longest extent. */
  diameterKm: number;
  /** What it's named after, as the gazetteer words it. */
  origin: string;
  yearApproved: number | null;
}

/** IAU descriptors in the data, in plain English, for the guide. */
export const FEATURE_TYPES: Record<string, string> = {
  Crater: "impact crater",
  "Albedo Feature": "light or dark region seen from Earth",
  Catena: "chain of craters",
  Cavus: "hollow or irregular depression",
  Chaos: "broken, jumbled terrain",
  Chasma: "deep, steep-sided canyon",
  Collis: "small hills",
  Dorsum: "ridge",
  Fluctus: "flow terrain",
  Fossa: "long, narrow trough",
  Labes: "landslide",
  Labyrinthus: "network of intersecting valleys",
  Lingula: "tongue-shaped plateau",
  Macula: "dark spot",
  Mensa: "mesa",
  Mons: "mountain or volcano",
  Palus: "small plain",
  Patera: "irregular or volcanic crater",
  Planitia: "low plain",
  Planum: "plateau",
  Rupes: "cliff or scarp",
  Scopulus: "irregular scarp",
  Serpens: "winding ridge",
  Sulcus: "parallel grooves",
  Terra: "large highland region",
  Tholus: "small dome-shaped mountain",
  Unda: "dunes",
  Vallis: "valley",
  Vastitas: "widespread lowland",
};

export interface MarsData {
  missions: Mission[];
  launchSites: LaunchSite[];
}

export function loadData(): MarsData {
  return {
    missions: MISSIONS.map((m, i) => ({
      ...m,
      objectId: i + 1,
      arrivalDate: Date.parse(m.arrivalDate),
      launchDate: Date.parse(m.launchDate),
    })).sort((a, b) => a.arrivalDate - b.arrivalDate),
    launchSites: LAUNCH_SITES,
  };
}

type Attributes = Record<string, unknown>;

/** A gazetteer record in the app's terms: longitudes -180 to 180, the descriptor in the singular. */
export function toFeature(a: Attributes): Feature {
  const lon = a.center_lon as number;
  const approved = a.approvaldt as number | null;
  return {
    name: a.name as string,
    type: String(a.type).split(",")[0].trim(),
    lat: a.center_lat as number,
    lon: lon > 180 ? lon - 360 : lon,
    diameterKm: a.diameter as number,
    origin: (a.origin as string | null) ?? "",
    yearApproved: approved ? new Date(approved).getUTCFullYear() : null,
  };
}

/** Every named feature from the public service, in pages. */
export async function fetchFeatures(service: FeatureLayer): Promise<Feature[]> {
  const out: Feature[] = [];
  for (let start = 0; ; start += 1000) {
    const { features, exceededTransferLimit } = await service.queryFeatures({
      where: "1=1",
      outFields: [
        "name",
        "type",
        "center_lat",
        "center_lon",
        "diameter",
        "origin",
        "approvaldt",
      ],
      orderByFields: ["OBJECTID"],
      returnGeometry: false,
      start,
      num: 1000,
    });
    out.push(...features.map((f) => toFeature(f.attributes)));
    if (!exceededTransferLimit || !features.length) return out;
  }
}

const FEATURE_FIELDS = [
  "name",
  "type",
  "lat",
  "lon",
  "diameterKm",
  "origin",
  "yearApproved",
];

/** All features matching an ArcGIS SQL `where` clause. */
export async function queryFeatures(
  layer: FeatureLayer,
  where = "1=1",
): Promise<Feature[]> {
  const { features } = await layer.queryFeatures({
    where,
    outFields: FEATURE_FIELDS,
    returnGeometry: false,
  });
  return features.map((f) => f.attributes as Feature);
}

export async function findFeature(
  layer: FeatureLayer,
  name: string,
): Promise<Feature> {
  const [feature] = await queryFeatures(layer, `name = ${sql(name)}`);
  if (!feature)
    throw new Error(
      `No feature named ${name}. Query features for the exact name.`,
    );
  return feature;
}

export function findMission(data: MarsData, id: string): Mission {
  const mission = data.missions.find((m) => m.id === id);
  if (!mission)
    throw new Error(
      `Unknown mission id: ${id}. Query missions for a valid id.`,
    );
  return mission;
}

export function findLaunchSite(data: MarsData, id: string): LaunchSite {
  const site = data.launchSites.find((s) => s.id === id);
  if (!site) throw new Error(`Unknown launch site id: ${id}.`);
  return site;
}

/** A quoted SQL string literal. */
export const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Places people ask about that aren't missions or named features. */
export const PLACES = [
  { id: "south-pole", name: "the south pole", lat: -90, lon: 0 },
  { id: "north-pole", name: "the north pole", lat: 90, lon: 0 },
  {
    id: "prime-meridian",
    name: "the prime meridian at the equator (Airy-0)",
    lat: -5.1,
    lon: 0,
  },
] as const;
export type Place = (typeof PLACES)[number];

const DAY = 86_400_000;
export const yearOf = (m: Mission) => new Date(m.arrivalDate).getUTCFullYear();
export const daysToSurface = (m: Mission) =>
  Math.round((m.arrivalDate - m.launchDate) / DAY);
export const isLanding = (m: Mission) => m.outcome === "soft";
export const hemisphereOf = (p: { lat: number }) =>
  p.lat >= 0 ? "Northern" : "Southern";

export const formatDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
