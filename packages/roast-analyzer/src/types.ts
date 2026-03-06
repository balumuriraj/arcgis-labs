export type ToneMode = "deadpan" | "playful" | "serious";

export type FieldKind = "string" | "number" | "date" | "other";

export interface LayerFieldProfile {
  name: string;
  alias?: string;
  kind: FieldKind;
  nullable: boolean;
}

export interface LayerDataset {
  layerUrl: string;
  layerTitle: string;
  geometryType: string;
  featureCount: number;
  sampledFeatureCount: number;
  fields: LayerFieldProfile[];
  samples: Array<Record<string, unknown>>;
  lastEditEpochMs: number | null;
}

export interface EvidenceItem {
  label: string;
  value: string;
  detail?: string;
}

export type FindingCategory =
  | "null-density"
  | "outlier"
  | "stale-date"
  | "category-imbalance"
  | "geometry-scale";

export type FindingSeverity = "low" | "medium" | "high";

export interface RoastFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  score: number;
  title: string;
  summary: string;
  confidence: number;
  suggestedFix: string;
  roastSeed: string;
  evidence: EvidenceItem[];
}

export interface AnalyzeOptions {
  maxFindings?: number;
}

export interface AnalyzeResult {
  layerTitle: string;
  layerUrl: string;
  geometryType: string;
  featureCount: number;
  sampledFeatureCount: number;
  findings: RoastFinding[];
}