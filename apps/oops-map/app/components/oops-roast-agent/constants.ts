export const MAX_FIELD_PREVIEW = 12;
export const MAX_ROAST_ATTEMPTS = 3;
export const MAX_RENDERER_JSON_DEPTH = 4;
export const MAX_RENDERER_JSON_KEYS = 14;
export const MAX_RENDERER_JSON_ITEMS = 10;
export const MAX_RENDERER_JSON_CHARS = 900;

export const POINTS_BY_SEVERITY = {
  low: 6,
  medium: 10,
  high: 14,
} as const;

export const RANK_THRESHOLDS = {
  novice: 4,
  intermediate: 14,
  senior: 26,
  legendary: 36,
} as const;

export const FULL_CONFIDENCE_THRESHOLD = 0.85;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.7;
export const CONFIDENCE_MULTIPLIER_BY_BAND = {
  high: 1,
  medium: 0.8,
  low: 0.6,
} as const;

export const CRITIQUE_CRITERION_IDS = [
  "data.null_density",
  "data.outlier_ratio",
  "data.category_imbalance",
  "temporal.stale_data",
  "scale.geometry_volume",
  "scale.no_scale_dependency",
  "schema.all_caps_exposure",
  "schema.generic_title",
  "popup.disabled",
  "popup.date_format_missing",
  "renderer.mismatch",
  "renderer.default_or_generic",
  "filter.suspicious_definition",
  "visual.opacity_legibility",
] as const;

export type CritiqueCriterionId = (typeof CRITIQUE_CRITERION_IDS)[number];

export const KEYWORDS_BY_CRITERION: Record<CritiqueCriterionId, string[]> = {
  "data.null_density": ["null", "missing", "empty", "blank", "incomplete"],
  "data.outlier_ratio": ["outlier", "extreme", "anomaly", "spike", "weird value"],
  "data.category_imbalance": [
    "dominant",
    "same category",
    "imbalance",
    "one value",
    "uniform",
  ],
  "temporal.stale_data": ["stale", "old", "outdated", "refresh", "last updated"],
  "scale.geometry_volume": [
    "too many features",
    "dense",
    "slow",
    "heavy",
    "empty layer",
    "no features",
  ],
  "schema.all_caps_exposure": [
    "all caps",
    "field name",
    "schema",
    "cryptic",
    "technical",
  ],
  "popup.disabled": ["popup", "click", "inspect", "details", "disabled"],
  "popup.date_format_missing": [
    "date format",
    "timestamp",
    "date",
    "unformatted",
    "popup",
  ],
  "renderer.mismatch": [
    "renderer",
    "symbolization",
    "class breaks",
    "unique value",
    "heatmap",
    "dot density",
  ],
  "renderer.default_or_generic": ["default symbol", "generic", "plain", "simple renderer"],
  "filter.suspicious_definition": [
    "filter",
    "definition expression",
    "where",
    "query",
    "clause",
  ],
  "visual.opacity_legibility": [
    "opacity",
    "transparent",
    "faded",
    "hard to see",
    "legibility",
  ],
  "scale.no_scale_dependency": [
    "scale",
    "zoom level",
    "scale range",
    "min scale",
    "max scale",
    "always visible",
    "no scale limit",
  ],
  "schema.generic_title": [
    "untitled",
    "no title",
    "generic name",
    "layer name",
    "title",
    "unnamed",
  ],
};
