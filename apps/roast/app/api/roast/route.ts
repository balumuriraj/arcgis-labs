import {
  analyzeLayer,
  renderRoast,
  type LayerDataset,
  type LayerFieldProfile,
  type ToneMode,
} from "@repo/roast-analyzer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_FINDINGS = 6;
const MAX_OUT_FIELDS = 40;
const MAX_SAMPLE_RECORDS = 250;

interface RoastRequestBody {
  layerUrl?: unknown;
  tone?: unknown;
  maxFindings?: unknown;
}

interface ArcgisError {
  code?: number;
  message?: string;
  details?: string[];
}

interface ArcgisResponseBase {
  error?: ArcgisError;
}

interface ArcgisField {
  name: string;
  alias?: string;
  type: string;
  nullable?: boolean;
}

interface ArcgisLayerMetadata extends ArcgisResponseBase {
  name?: string;
  displayField?: string;
  geometryType?: string;
  fields?: ArcgisField[];
  editingInfo?: {
    lastEditDate?: number;
  };
}

interface ArcgisCountResponse extends ArcgisResponseBase {
  count?: number;
}

interface ArcgisFeature {
  attributes?: Record<string, unknown>;
}

interface ArcgisFeatureResponse extends ArcgisResponseBase {
  features?: ArcgisFeature[];
}

function isToneMode(value: unknown): value is ToneMode {
  return value === "deadpan" || value === "playful" || value === "serious";
}

function normalizeLayerUrl(rawLayerUrl: string): string {
  const withoutQuery = rawLayerUrl.trim().split("?")[0] ?? "";
  return withoutQuery.replace(/\/+$/, "");
}

function isSupportedLayerUrl(layerUrl: string): boolean {
  return /^https?:\/\/.+\/(FeatureServer|MapServer)\/\d+$/i.test(layerUrl);
}

function normalizeMaxFindings(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_FINDINGS;
  }

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function mapFieldKind(type: string): LayerFieldProfile["kind"] {
  switch (type) {
    case "esriFieldTypeString":
    case "esriFieldTypeGUID":
    case "esriFieldTypeGlobalID":
      return "string";
    case "esriFieldTypeSmallInteger":
    case "esriFieldTypeInteger":
    case "esriFieldTypeSingle":
    case "esriFieldTypeDouble":
    case "esriFieldTypeOID":
    case "esriFieldTypeBigInteger":
      return "number";
    case "esriFieldTypeDate":
    case "esriFieldTypeDateOnly":
    case "esriFieldTypeTimeOnly":
    case "esriFieldTypeTimestampOffset":
      return "date";
    default:
      return "other";
  }
}

function buildOutFields(fields: LayerFieldProfile[]): string {
  const names = fields
    .map((field) => field.name)
    .filter((name) => name.trim().length > 0);

  if (names.length === 0) {
    return "*";
  }

  const prioritized = [
    ...names.filter((name) => name.toUpperCase() === "OBJECTID"),
    ...names.filter((name) => name.toUpperCase() !== "OBJECTID"),
  ];

  const unique = [...new Set(prioritized)].slice(0, MAX_OUT_FIELDS);
  return unique.join(",");
}

function throwIfArcgisError<T extends ArcgisResponseBase>(
  payload: T,
  context: string,
): T {
  if (!payload.error) {
    return payload;
  }

  const details = payload.error.details?.join(" ") ?? "";
  const message = payload.error.message ?? "ArcGIS request failed.";
  throw new Error(`${context}: ${message} ${details}`.trim());
}

async function fetchArcgisJson<T extends ArcgisResponseBase>(
  url: string,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`ArcGIS request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function buildQueryUrl(baseUrl: string, params: URLSearchParams): string {
  return `${baseUrl}/query?${params.toString()}`;
}

async function buildDataset(layerUrl: string): Promise<LayerDataset> {
  const metadata = throwIfArcgisError(
    await fetchArcgisJson<ArcgisLayerMetadata>(`${layerUrl}?f=pjson`),
    "Layer metadata",
  );

  const fields: LayerFieldProfile[] = (metadata.fields ?? []).map((field) => {
    return {
      name: field.name,
      alias: field.alias,
      kind: mapFieldKind(field.type),
      nullable: field.nullable ?? true,
    };
  });

  const countQuery = new URLSearchParams({
    where: "1=1",
    returnCountOnly: "true",
    f: "pjson",
  });

  const sampleQuery = new URLSearchParams({
    where: "1=1",
    outFields: buildOutFields(fields),
    returnGeometry: "false",
    resultRecordCount: `${MAX_SAMPLE_RECORDS}`,
    f: "pjson",
  });

  const [countPayload, samplePayload] = await Promise.all([
    fetchArcgisJson<ArcgisCountResponse>(buildQueryUrl(layerUrl, countQuery)),
    fetchArcgisJson<ArcgisFeatureResponse>(buildQueryUrl(layerUrl, sampleQuery)),
  ]);

  const count = throwIfArcgisError(countPayload, "Layer count").count;
  const sampledFeatures =
    throwIfArcgisError(samplePayload, "Layer sample").features ?? [];

  const samples = sampledFeatures.map((feature) => feature.attributes ?? {});

  const layerTitle = metadata.name ?? metadata.displayField ?? "Untitled layer";
  const featureCount =
    typeof count === "number" && Number.isFinite(count)
      ? count
      : sampledFeatures.length;

  return {
    layerUrl,
    layerTitle,
    geometryType: metadata.geometryType ?? "unknown",
    featureCount,
    sampledFeatureCount: samples.length,
    fields,
    samples,
    lastEditEpochMs: metadata.editingInfo?.lastEditDate ?? null,
  };
}

export async function POST(request: Request) {
  let body: RoastRequestBody;

  try {
    body = (await request.json()) as RoastRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (typeof body.layerUrl !== "string" || body.layerUrl.trim().length === 0) {
    return NextResponse.json(
      { error: "layerUrl is required." },
      { status: 400 },
    );
  }

  const layerUrl = normalizeLayerUrl(body.layerUrl);
  if (!isSupportedLayerUrl(layerUrl)) {
    return NextResponse.json(
      {
        error:
          "layerUrl must be a direct ArcGIS FeatureServer or MapServer layer URL ending with /<layerId>.",
      },
      { status: 400 },
    );
  }

  const tone: ToneMode = isToneMode(body.tone) ? body.tone : "deadpan";
  const maxFindings = normalizeMaxFindings(body.maxFindings);

  try {
    const dataset = await buildDataset(layerUrl);
    const analysis = analyzeLayer(dataset, { maxFindings });

    const findings = analysis.findings.map((finding) => {
      return {
        ...finding,
        roastText: renderRoast(finding, tone),
      };
    });

    const notes: string[] = [];
    if (dataset.sampledFeatureCount < 50) {
      notes.push("Sample size is limited; findings are directional.");
    }
    if (dataset.featureCount > dataset.sampledFeatureCount) {
      notes.push(
        `Analysis sampled ${dataset.sampledFeatureCount} of ${dataset.featureCount} total records.`,
      );
    }

    return NextResponse.json({
      ...analysis,
      tone,
      generatedAt: new Date().toISOString(),
      findings,
      notes,
    });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Unexpected roast processing failure.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}