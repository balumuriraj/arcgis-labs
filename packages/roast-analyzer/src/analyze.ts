import { runFactRules } from "./fact-rules";
import type { AnalyzeOptions, AnalyzeResult, LayerDataset } from "./types";

const DEFAULT_MAX_FINDINGS = 6;

export function analyzeLayer(
  dataset: LayerDataset,
  options: AnalyzeOptions = {},
): AnalyzeResult {
  const normalizedMaxFindings = options.maxFindings
    ? Math.max(1, Math.min(20, Math.floor(options.maxFindings)))
    : DEFAULT_MAX_FINDINGS;

  const findings = runFactRules(dataset)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.confidence - left.confidence;
    })
    .slice(0, normalizedMaxFindings);

  return {
    layerTitle: dataset.layerTitle,
    layerUrl: dataset.layerUrl,
    geometryType: dataset.geometryType,
    featureCount: dataset.featureCount,
    sampledFeatureCount: dataset.sampledFeatureCount,
    findings,
  };
}