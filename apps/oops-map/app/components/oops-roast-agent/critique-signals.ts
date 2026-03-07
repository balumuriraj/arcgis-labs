import { KEYWORDS_BY_CRITERION } from "./constants";
import { severityWeight } from "./scoring";
import type {
  CritiqueEvidenceItem,
  CritiqueSeverity,
  CritiqueSignal,
  VisibleLayerSummary,
} from "./types";

const MIN_SIGNAL_MATCH_SCORE = 1.5;

export function formatEvidenceSummary(evidence: CritiqueEvidenceItem[]): string {
  if (evidence.length === 0) {
    return "No concrete evidence returned.";
  }

  return evidence
    .slice(0, 3)
    .map((item) => {
      const detail = item.detail ? ` (${item.detail})` : "";
      return `${item.label}: ${item.value}${detail}`;
    })
    .join(" | ");
}

function parseRendererMetric(
  rendererSummary: string | null,
  label: "classes" | "breaks",
): number | null {
  if (!rendererSummary) {
    return null;
  }

  const expression = new RegExp(`${label}=(\\d+)`);
  const match = rendererSummary.match(expression);
  if (!match || typeof match[1] !== "string") {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildCritiqueSignals(
  layers: VisibleLayerSummary[],
  options?: { basemapTheme?: "dark" | "light" | "unknown" },
): CritiqueSignal[] {
  const signals: CritiqueSignal[] = [];
  const currentYear = new Date().getUTCFullYear();

  if (options?.basemapTheme === "dark") {
    signals.push({
      criterionId: "visual.basemap_contrast",
      severity: "medium",
      confidence: 0.8,
      layerTitle: "(map basemap)",
      verdictReason:
        "Dark basemap detected — renderer colors and symbol fills need sufficient contrast to remain legible.",
      recommendedFix:
        "Review all layer symbol colors and ensure fills/strokes stand out against a dark background.",
      evidence: [{ label: "Basemap theme", value: "dark" }],
    });
  }

  for (const layer of layers) {
    const featureCount = layer.featureCount;

    // schema.generic_title — empty, "Untitled", or pattern-matched generic name
    const titleTrimmed = layer.title.trim();
    const isGenericTitle =
      titleTrimmed.length === 0 ||
      /^untitled/i.test(titleTrimmed) ||
      /^new feature layer$/i.test(titleTrimmed) ||
      /^layer\s*\d*$/i.test(titleTrimmed);

    if (isGenericTitle) {
      signals.push({
        criterionId: "schema.generic_title",
        severity: "low",
        confidence: 0.85,
        layerTitle: layer.title,
        verdictReason: "Layer title is generic or empty, which is unhelpful for map readers.",
        recommendedFix:
          "Give the layer a descriptive, audience-friendly title that communicates what the data represents.",
        evidence: [
          {
            label: "Title",
            value: titleTrimmed.length === 0 ? "(empty)" : titleTrimmed,
          },
        ],
      });
    }

    // scale.no_scale_dependency — dense layer with no min/max scale set
    if (
      typeof featureCount === "number" &&
      featureCount >= 50_000 &&
      layer.minScale === 0 &&
      layer.maxScale === 0
    ) {
      signals.push({
        criterionId: "scale.no_scale_dependency",
        severity: "medium",
        confidence: 0.84,
        layerTitle: layer.title,
        verdictReason:
          "Dense layer has no scale dependency, so it renders at every zoom level regardless of legibility.",
        recommendedFix:
          "Set a minimum scale (or use scale-dependent visibility) so the layer only draws where it is actually legible.",
        evidence: [
          {
            label: "Feature count",
            value: `${featureCount}`,
          },
          {
            label: "Min scale",
            value: "0 (not set)",
          },
          {
            label: "Max scale",
            value: "0 (not set)",
          },
        ],
      });
    }

    if (featureCount === 0) {
      signals.push({
        criterionId: "scale.geometry_volume",
        severity: "high",
        confidence: 0.96,
        layerTitle: layer.title,
        verdictReason: "The layer currently returns zero features.",
        recommendedFix:
          "Review layer filters, data source refresh, and publication settings so records actually render.",
        evidence: [
          {
            label: "Feature count",
            value: "0",
          },
        ],
      });
    } else if (typeof featureCount === "number" && featureCount >= 200_000) {
      signals.push({
        criterionId: "scale.geometry_volume",
        severity: "high",
        confidence: 0.88,
        layerTitle: layer.title,
        verdictReason:
          "Feature volume is high enough to cause dense rendering and sluggish interaction.",
        recommendedFix:
          "Use scale-dependent visibility, clustering, or additional filtering for smoother map interaction.",
        evidence: [
          {
            label: "Feature count",
            value: `${featureCount}`,
          },
        ],
      });
    } else if (typeof featureCount === "number" && featureCount >= 50_000) {
      signals.push({
        criterionId: "scale.geometry_volume",
        severity: "medium",
        confidence: 0.82,
        layerTitle: layer.title,
        verdictReason:
          "Layer volume is heavy and may reduce rendering and querying responsiveness.",
        recommendedFix:
          "Consider definition expressions, aggregation, or scale constraints to reduce visual and query load.",
        evidence: [
          {
            label: "Feature count",
            value: `${featureCount}`,
          },
        ],
      });
    }

    if (!layer.popupEnabled) {
      const popupSeverity: Exclude<CritiqueSeverity, "none"> =
        typeof featureCount === "number" && featureCount >= 100_000
          ? "high"
          : "medium";

      signals.push({
        criterionId: "popup.disabled",
        severity: popupSeverity,
        confidence: 0.92,
        layerTitle: layer.title,
        verdictReason:
          "The layer has popups disabled, which blocks feature-level inspection in an interactive map.",
        recommendedFix:
          "Enable popups and define a concise popup title and field list for user-facing map exploration.",
        evidence: [
          {
            label: "Popup enabled",
            value: `${layer.popupEnabled}`,
          },
        ],
      });
    }

    if (layer.dateFieldsWithoutPopupFormat.length > 0) {
      const missingDateFormatCount = layer.dateFieldsWithoutPopupFormat.length;
      const dateSeverity: Exclude<CritiqueSeverity, "none"> =
        missingDateFormatCount >= 4
          ? "high"
          : missingDateFormatCount >= 2
            ? "medium"
            : "low";

      signals.push({
        criterionId: "popup.date_format_missing",
        severity: dateSeverity,
        confidence: 0.9,
        layerTitle: layer.title,
        verdictReason:
          "Date fields are present but popup date formatting is missing for some fields.",
        recommendedFix:
          "Add popup fieldInfos with explicit dateFormat values so timestamps are human-readable.",
        evidence: [
          {
            label: "Missing date formats",
            value: `${missingDateFormatCount}`,
            detail: layer.dateFieldsWithoutPopupFormat.join(", "),
          },
        ],
      });
    }

    if (layer.allCapsFieldNamesSample.length > 0) {
      signals.push({
        criterionId: "schema.all_caps_exposure",
        severity: "low",
        confidence: 0.72,
        layerTitle: layer.title,
        verdictReason:
          "ALL_CAPS schema-heavy field names are exposed and may reduce readability for non-technical users.",
        recommendedFix:
          "Prefer user-friendly aliases in popups and labels while keeping technical field names internal.",
        evidence: [
          {
            label: "ALL_CAPS sample",
            value: layer.allCapsFieldNamesSample.join(", "),
          },
        ],
      });
    }

    if (typeof layer.opacity === "number" && layer.opacity <= 0.5) {
      const opacityPercent = Math.round(layer.opacity * 100);
      const opacitySeverity: Exclude<CritiqueSeverity, "none"> =
        layer.opacity <= 0.2
          ? "high"
          : layer.opacity <= 0.35
            ? "medium"
            : "low";
      const confidence = layer.opacity <= 0.2 ? 0.86 : 0.8;

      signals.push({
        criterionId: "visual.opacity_legibility",
        severity: opacitySeverity,
        confidence,
        layerTitle: layer.title,
        verdictReason:
          "Low layer opacity can harm visual legibility and make features difficult to interpret.",
        recommendedFix:
          "Increase opacity or adjust symbol color/contrast so features remain readable against the basemap.",
        evidence: [
          {
            label: "Opacity",
            value: `${opacityPercent}%`,
          },
        ],
      });
    }

    const definitionExpression = layer.definitionExpression?.trim() ?? "";
    if (definitionExpression.length > 0) {
      const normalizedDefinition = definitionExpression.toLowerCase();
      const hasImpossibleClause =
        /\b1\s*=\s*0\b/.test(normalizedDefinition) ||
        /\b0\s*=\s*1\b/.test(normalizedDefinition);
      const hasTautology = /\b1\s*=\s*1\b/.test(normalizedDefinition);
      const matchedYears = definitionExpression.match(/\b(19|20)\d{2}\b/g) ?? [];
      const years = matchedYears
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));
      const oldestYear = years.length > 0 ? Math.min(...years) : null;

      if (hasImpossibleClause) {
        signals.push({
          criterionId: "filter.suspicious_definition",
          severity: "high",
          confidence: 0.93,
          layerTitle: layer.title,
          verdictReason:
            "Definition expression appears self-contradictory and can hide all records.",
          recommendedFix:
            "Review and simplify the WHERE clause so filter logic matches intended visibility.",
          evidence: [
            {
              label: "Definition expression",
              value: definitionExpression,
            },
          ],
        });
      } else if (hasTautology) {
        signals.push({
          criterionId: "filter.suspicious_definition",
          severity: "low",
          confidence: 0.75,
          layerTitle: layer.title,
          verdictReason:
            "Definition expression includes a tautology and may indicate unnecessary or placeholder filtering.",
          recommendedFix:
            "Remove no-op clauses and keep the filter expression focused on meaningful criteria.",
          evidence: [
            {
              label: "Definition expression",
              value: definitionExpression,
            },
          ],
        });
      } else if (oldestYear !== null && oldestYear <= currentYear - 10) {
        signals.push({
          criterionId: "filter.suspicious_definition",
          severity: "high",
          confidence: 0.8,
          layerTitle: layer.title,
          verdictReason:
            "Definition expression appears pinned to old year constraints that may hide current records.",
          recommendedFix:
            "Parameterize date filters or update stale hard-coded year values to reflect current data windows.",
          evidence: [
            {
              label: "Oldest year in filter",
              value: `${oldestYear}`,
            },
            {
              label: "Definition expression",
              value: definitionExpression,
            },
          ],
        });
      } else if (oldestYear !== null && oldestYear <= currentYear - 5) {
        signals.push({
          criterionId: "filter.suspicious_definition",
          severity: "medium",
          confidence: 0.74,
          layerTitle: layer.title,
          verdictReason:
            "Definition expression contains older year constraints that may no longer match current operational data.",
          recommendedFix:
            "Review whether the date filter is still intentional and move to rolling date logic when possible.",
          evidence: [
            {
              label: "Oldest year in filter",
              value: `${oldestYear}`,
            },
            {
              label: "Definition expression",
              value: definitionExpression,
            },
          ],
        });
      }
    }

    if (layer.renderer === "simple") {
      const simpleSeverity: Exclude<CritiqueSeverity, "none"> =
        typeof featureCount === "number" && featureCount >= 100_000
          ? "medium"
          : "low";

      signals.push({
        criterionId: "renderer.default_or_generic",
        severity: simpleSeverity,
        confidence: 0.7,
        layerTitle: layer.title,
        verdictReason:
          "Simple renderer may be too generic for communicating variation in this layer.",
        recommendedFix:
          "Consider unique-value or class-break rendering for primary thematic communication.",
        evidence: [
          {
            label: "Renderer",
            value: layer.renderer ?? "unknown",
          },
          {
            label: "Renderer summary",
            value: layer.rendererSummary ?? "none",
          },
        ],
      });
    }

    const rendererSummaryLower = layer.rendererSummary?.toLowerCase() ?? "";
    if (rendererSummaryLower.includes("unknown field")) {
      signals.push({
        criterionId: "renderer.mismatch",
        severity: "high",
        confidence: 0.9,
        layerTitle: layer.title,
        verdictReason:
          "Renderer appears to be configured without a clear field/valueExpression reference.",
        recommendedFix:
          "Review renderer field mappings so symbol logic references an explicit and valid attribute.",
        evidence: [
          {
            label: "Renderer summary",
            value: layer.rendererSummary ?? "none",
          },
        ],
      });
    }

    if (layer.renderer === "class-breaks") {
      const breakCount = parseRendererMetric(layer.rendererSummary, "breaks");
      if (typeof breakCount === "number" && breakCount <= 2) {
        signals.push({
          criterionId: "renderer.mismatch",
          severity: "medium",
          confidence: 0.82,
          layerTitle: layer.title,
          verdictReason:
            "Class-breaks renderer has very few breaks and may under-represent numeric variation.",
          recommendedFix:
            "Increase break count or refine class method to better communicate value distribution.",
          evidence: [
            {
              label: "Break count",
              value: `${breakCount}`,
            },
            {
              label: "Renderer summary",
              value: layer.rendererSummary ?? "none",
            },
          ],
        });
      }
    }

    if (layer.renderer === "unique-value") {
      const classCount = parseRendererMetric(layer.rendererSummary, "classes");
      if (typeof classCount === "number" && classCount <= 1) {
        signals.push({
          criterionId: "renderer.mismatch",
          severity: "medium",
          confidence: 0.82,
          layerTitle: layer.title,
          verdictReason:
            "Unique-value renderer has too few classes to justify categorical styling.",
          recommendedFix:
            "Verify source field cardinality and adjust renderer type if the data is effectively uniform.",
          evidence: [
            {
              label: "Class count",
              value: `${classCount}`,
            },
            {
              label: "Renderer summary",
              value: layer.rendererSummary ?? "none",
            },
          ],
        });
      }

      if (layer.rendererFields.length > 0) {
        const numericSet = new Set(layer.numericFieldNames);
        const numericUvField = layer.rendererFields.find((f) => numericSet.has(f));
        if (numericUvField) {
          signals.push({
            criterionId: "renderer.numeric_field_categorical",
            severity: "medium",
            confidence: 0.87,
            layerTitle: layer.title,
            verdictReason: `Unique-value renderer is applied to numeric field "${numericUvField}" — categorical symbolization is inappropriate for continuous data.`,
            recommendedFix:
              "Switch to a class-breaks renderer or a continuous color ramp that communicates numeric variation effectively.",
            evidence: [
              {
                label: "Renderer field",
                value: numericUvField,
              },
              {
                label: "Numeric fields",
                value: layer.numericFieldNames.join(", "),
              },
            ],
          });
        }
      }
    }

    if (
      layer.renderer === "heatmap" &&
      typeof featureCount === "number" &&
      featureCount < 200
    ) {
      signals.push({
        criterionId: "renderer.mismatch",
        severity: "low",
        confidence: 0.74,
        layerTitle: layer.title,
        verdictReason:
          "Heatmap renderer is being used with a small feature set, limiting value over simpler symbols.",
        recommendedFix:
          "Consider simple or class-based symbolization when point density is low.",
        evidence: [
          {
            label: "Feature count",
            value: `${featureCount}`,
          },
          {
            label: "Renderer",
            value: "heatmap",
          },
        ],
      });
    }

    if (
      layer.renderer === "dot-density" &&
      typeof featureCount === "number" &&
      featureCount < 1_000
    ) {
      signals.push({
        criterionId: "renderer.mismatch",
        severity: "low",
        confidence: 0.72,
        layerTitle: layer.title,
        verdictReason:
          "Dot-density renderer may be unnecessary at low feature volumes.",
        recommendedFix:
          "Use class-based or unique-value symbolization when feature density is modest.",
        evidence: [
          {
            label: "Feature count",
            value: `${featureCount}`,
          },
          {
            label: "Renderer",
            value: "dot-density",
          },
        ],
      });
    }
  }

  return signals.sort((left, right) => {
    if (severityWeight(right.severity) !== severityWeight(left.severity)) {
      return severityWeight(right.severity) - severityWeight(left.severity);
    }

    return right.confidence - left.confidence;
  });
}

export function formatCritiqueSignals(signals: CritiqueSignal[]): string {
  if (signals.length === 0) {
    return "No deterministic criterion signals were detected from visible-layer metadata.";
  }

  return signals
    .slice(0, 16)
    .map((signal, index) => {
      const confidencePercent = Math.round(signal.confidence * 100);
      return [
        `${index + 1}. criterionId=${signal.criterionId}`,
        `   layer=${signal.layerTitle}`,
        `   severity=${signal.severity}`,
        `   confidence=${confidencePercent}%`,
        `   reason=${signal.verdictReason}`,
        `   evidence=${formatEvidenceSummary(signal.evidence)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function scoreSignalAgainstMessage(messageLower: string, signal: CritiqueSignal): number {
  let score = 0;

  if (messageLower.includes(signal.criterionId.toLowerCase())) {
    score += 5;
  }

  if (messageLower.includes(signal.layerTitle.toLowerCase())) {
    score += 3;
  }

  for (const keyword of KEYWORDS_BY_CRITERION[signal.criterionId]) {
    if (messageLower.includes(keyword)) {
      score += 1;
    }
  }

  score += severityWeight(signal.severity) * 0.2;
  score += signal.confidence * 0.2;

  return score;
}

export function selectBestSignalForMessage(
  userMessage: string,
  signals: CritiqueSignal[],
): CritiqueSignal | null {
  if (signals.length === 0) {
    return null;
  }

  const messageLower = userMessage.toLowerCase();
  let bestSignal: CritiqueSignal | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const signal of signals) {
    const signalScore = scoreSignalAgainstMessage(messageLower, signal);
    if (signalScore > bestScore) {
      bestScore = signalScore;
      bestSignal = signal;
    }
  }

  return bestScore >= MIN_SIGNAL_MATCH_SCORE ? bestSignal : null;
}
