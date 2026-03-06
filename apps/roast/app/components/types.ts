import type { RoastFinding, ToneMode } from "@repo/roast-analyzer";

export interface RoastFindingWithText extends RoastFinding {
  roastText: string;
}

export interface RoastApiResponse {
  layerTitle: string;
  layerUrl: string;
  geometryType: string;
  featureCount: number;
  sampledFeatureCount: number;
  tone: ToneMode;
  generatedAt: string;
  findings: RoastFindingWithText[];
  notes: string[];
}