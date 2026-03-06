import type {
  FindingSeverity,
  LayerDataset,
  LayerFieldProfile,
  RoastFinding,
} from "./types";

const MIN_SAMPLE_SIZE = 20;
const DAY_IN_MS = 86_400_000;

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function makeFieldSlug(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isMissingValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return value;
    }

    if (value > 1_000_000_000) {
      return value * 1_000;
    }

    return null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function quantile(sortedValues: number[], quantilePosition: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position = (sortedValues.length - 1) * quantilePosition;
  const base = Math.floor(position);
  const remainder = position - base;
  const lower = sortedValues[base] ?? 0;
  const upper = sortedValues[base + 1] ?? lower;

  return lower + remainder * (upper - lower);
}

function baseConfidence(sampledFeatureCount: number): number {
  return clamp(0.35 + sampledFeatureCount / 500, 0.35, 0.92);
}

function ratioSeverity(
  ratio: number,
  mediumThreshold: number,
  highThreshold: number,
): FindingSeverity {
  if (ratio >= highThreshold) {
    return "high";
  }

  if (ratio >= mediumThreshold) {
    return "medium";
  }

  return "low";
}

function detectNullDensity(dataset: LayerDataset): RoastFinding[] {
  if (dataset.sampledFeatureCount < MIN_SAMPLE_SIZE) {
    return [];
  }

  const findings: RoastFinding[] = [];

  for (const field of dataset.fields) {
    if (field.kind === "other") {
      continue;
    }

    const missingCount = dataset.samples.reduce((count, sample) => {
      return count + (isMissingValue(sample[field.name]) ? 1 : 0);
    }, 0);

    const missingRatio =
      dataset.sampledFeatureCount === 0
        ? 0
        : missingCount / dataset.sampledFeatureCount;

    if (missingRatio < 0.35) {
      continue;
    }

    const severity = ratioSeverity(missingRatio, 0.55, 0.75);
    const confidence = clamp(
      baseConfidence(dataset.sampledFeatureCount) + missingRatio * 0.15,
      0.35,
      0.97,
    );

    findings.push({
      id: `null-density-${makeFieldSlug(field.name)}`,
      category: "null-density",
      severity,
      score: Math.round(missingRatio * 100),
      title: `${field.alias ?? field.name} is mostly empty`,
      summary: `${toPercent(missingRatio)} of sampled records miss this field.`,
      confidence,
      suggestedFix:
        "Audit data entry for this attribute and backfill high-priority nulls first.",
      roastSeed:
        "This field showed up to work and immediately took a long lunch break.",
      evidence: [
        {
          label: "Missing ratio",
          value: toPercent(missingRatio),
        },
        {
          label: "Missing values",
          value: `${missingCount} / ${dataset.sampledFeatureCount}`,
        },
        {
          label: "Field",
          value: field.alias ?? field.name,
        },
      ],
    });
  }

  return findings;
}

function detectNumericOutliers(dataset: LayerDataset): RoastFinding[] {
  if (dataset.sampledFeatureCount < MIN_SAMPLE_SIZE) {
    return [];
  }

  const findings: RoastFinding[] = [];

  for (const field of dataset.fields) {
    if (field.kind !== "number") {
      continue;
    }

    const values = dataset.samples
      .map((sample) => toNumber(sample[field.name]))
      .filter((value): value is number => value !== null);

    if (values.length < MIN_SAMPLE_SIZE) {
      continue;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const firstQuartile = quantile(sorted, 0.25);
    const thirdQuartile = quantile(sorted, 0.75);
    const interquartileRange = thirdQuartile - firstQuartile;

    if (interquartileRange <= 0) {
      continue;
    }

    const lowerBound = firstQuartile - 1.5 * interquartileRange;
    const upperBound = thirdQuartile + 1.5 * interquartileRange;

    const outlierCount = values.filter(
      (value) => value < lowerBound || value > upperBound,
    ).length;
    const outlierRatio = outlierCount / values.length;

    if (outlierCount < 3 || outlierRatio < 0.1) {
      continue;
    }

    const severity = ratioSeverity(outlierRatio, 0.16, 0.25);
    const confidence = clamp(
      baseConfidence(values.length) + outlierRatio * 0.18,
      0.4,
      0.97,
    );

    findings.push({
      id: `outlier-${makeFieldSlug(field.name)}`,
      category: "outlier",
      severity,
      score: Math.round(Math.min(100, outlierRatio * 120)),
      title: `${field.alias ?? field.name} has outlier-heavy values`,
      summary: `${toPercent(outlierRatio)} of sampled numeric values fall outside the IQR fence.`,
      confidence,
      suggestedFix:
        "Review extreme values for unit mismatches, duplicated scale, or malformed imports.",
      roastSeed:
        "A few records tried to become legends and left the rest of the data behind.",
      evidence: [
        {
          label: "Outlier ratio",
          value: toPercent(outlierRatio),
        },
        {
          label: "Fence",
          value: `${numberFormatter.format(lowerBound)} to ${numberFormatter.format(upperBound)}`,
        },
        {
          label: "Outliers",
          value: `${outlierCount} / ${values.length}`,
        },
      ],
    });
  }

  return findings;
}

function detectCategoryImbalance(dataset: LayerDataset): RoastFinding[] {
  if (dataset.sampledFeatureCount < MIN_SAMPLE_SIZE) {
    return [];
  }

  const findings: RoastFinding[] = [];

  for (const field of dataset.fields) {
    if (field.kind !== "string") {
      continue;
    }

    const values = dataset.samples
      .map((sample) => sample[field.name])
      .filter((value): value is string => {
        return typeof value === "string" && value.trim().length > 0;
      });

    if (values.length < MIN_SAMPLE_SIZE) {
      continue;
    }

    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const topEntry = ranked[0];

    if (!topEntry) {
      continue;
    }

    const [topValue, topCount] = topEntry;
    const dominanceRatio = topCount / values.length;

    if (counts.size < 2 || dominanceRatio < 0.75) {
      continue;
    }

    const severity = ratioSeverity(dominanceRatio, 0.82, 0.9);
    const confidence = clamp(
      baseConfidence(values.length) + dominanceRatio * 0.12,
      0.4,
      0.98,
    );

    findings.push({
      id: `category-imbalance-${makeFieldSlug(field.name)}`,
      category: "category-imbalance",
      severity,
      score: Math.round(dominanceRatio * 100),
      title: `${field.alias ?? field.name} is dominated by one category`,
      summary: `${JSON.stringify(topValue)} appears in ${toPercent(dominanceRatio)} of sampled values.`,
      confidence,
      suggestedFix:
        "Check coded value domains, defaults, and upstream transforms for over-collapsed categories.",
      roastSeed:
        "One value became the main character and everyone else turned into extras.",
      evidence: [
        {
          label: "Top category",
          value: JSON.stringify(topValue),
        },
        {
          label: "Dominance",
          value: toPercent(dominanceRatio),
        },
        {
          label: "Distinct values",
          value: `${counts.size}`,
        },
      ],
    });
  }

  return findings;
}

function getLatestTimestamp(
  fields: LayerFieldProfile[],
  samples: Array<Record<string, unknown>>,
): number | null {
  const dateFields = fields.filter((field) => field.kind === "date");
  if (dateFields.length === 0) {
    return null;
  }

  const candidates: number[] = [];

  for (const field of dateFields) {
    for (const sample of samples) {
      const candidate = toEpochMs(sample[field.name]);
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

function detectStaleData(dataset: LayerDataset): RoastFinding[] {
  const inferredTimestamp = getLatestTimestamp(dataset.fields, dataset.samples);
  const lastUpdated = dataset.lastEditEpochMs ?? inferredTimestamp;

  if (lastUpdated === null) {
    return [];
  }

  const daysSinceLastEdit = Math.floor((Date.now() - lastUpdated) / DAY_IN_MS);

  if (daysSinceLastEdit < 180) {
    return [];
  }

  const severity =
    daysSinceLastEdit >= 730
      ? "high"
      : daysSinceLastEdit >= 365
        ? "medium"
        : "low";

  const confidence = clamp(
    (dataset.lastEditEpochMs ? 0.9 : baseConfidence(dataset.sampledFeatureCount)) +
      0.05,
    0.5,
    0.98,
  );

  return [
    {
      id: "stale-date-layer",
      category: "stale-date",
      severity,
      score: Math.round(Math.min(100, daysSinceLastEdit / 7)),
      title: "Layer appears stale",
      summary: `Latest detectable update is ${daysSinceLastEdit} days old.`,
      confidence,
      suggestedFix:
        "Confirm source refresh schedule and backfill missed update windows.",
      roastSeed:
        "This layer has been resting so long it now qualifies as archival yoga.",
      evidence: [
        {
          label: "Last update",
          value: new Date(lastUpdated).toISOString().slice(0, 10),
        },
        {
          label: "Days stale",
          value: `${daysSinceLastEdit}`,
        },
        {
          label: "Timestamp source",
          value: dataset.lastEditEpochMs ? "editingInfo.lastEditDate" : "sampled date fields",
        },
      ],
    },
  ];
}

function detectGeometryScale(dataset: LayerDataset): RoastFinding[] {
  if (dataset.featureCount === 0) {
    return [
      {
        id: "geometry-scale-empty",
        category: "geometry-scale",
        severity: "high",
        score: 95,
        title: "Layer has no features",
        summary: "The layer returned zero records.",
        confidence: 0.99,
        suggestedFix:
          "Verify filters, publication target, and data pipelines feeding this layer.",
        roastSeed:
          "Outstanding performance: this layer is perfectly quiet because nothing is in it.",
        evidence: [
          {
            label: "Feature count",
            value: "0",
          },
        ],
      },
    ];
  }

  if (dataset.featureCount < 50_000) {
    return [];
  }

  const severity: FindingSeverity = dataset.featureCount >= 200_000 ? "high" : "medium";

  return [
    {
      id: "geometry-scale-large",
      category: "geometry-scale",
      severity,
      score: Math.round(Math.min(90, Math.log10(dataset.featureCount) * 16)),
      title: "Layer volume is heavy",
      summary: `Layer has ${numberFormatter.format(dataset.featureCount)} features and may feel dense during exploration.`,
      confidence: 0.88,
      suggestedFix:
        "Use definition expressions, clustering, or scale-dependent rendering for smoother exploration.",
      roastSeed:
        "This dataset brought the entire extended family to a two-seat performance budget.",
      evidence: [
        {
          label: "Feature count",
          value: numberFormatter.format(dataset.featureCount),
        },
        {
          label: "Sampled",
          value: numberFormatter.format(dataset.sampledFeatureCount),
        },
        {
          label: "Geometry type",
          value: dataset.geometryType,
        },
      ],
    },
  ];
}

export function runFactRules(dataset: LayerDataset): RoastFinding[] {
  return [
    ...detectNullDensity(dataset),
    ...detectNumericOutliers(dataset),
    ...detectCategoryImbalance(dataset),
    ...detectStaleData(dataset),
    ...detectGeometryScale(dataset),
  ];
}