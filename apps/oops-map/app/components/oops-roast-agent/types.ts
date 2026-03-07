import type MapView from "@arcgis/core/views/MapView.js";
import type { CritiqueCriterionId } from "./constants";

export type CritiqueIntent = "critique" | "end_session";
export type CritiqueVerdict = "valid" | "invalid" | "not_applicable";
export type CritiqueSeverity = "low" | "medium" | "high" | "none";
export type CritiqueCriterionOrNone = CritiqueCriterionId | "none";

export type RoastPersona = "cartographer" | "chef" | "movie" | "detective" | "sports" | "hr";

export type RoastTurnResult = {
  pointsAwarded: number;
  sessionClosed: boolean;
  /** Whether this turn consumed a roast attempt. False for end_session. */
  countAttempt: boolean;
  /** Criterion ID accepted as valid on this turn, if any. */
  criterionId?: string;
  /** All detected critique signals — emitted when sessionClosed is true. */
  signals?: CritiqueSignal[];
};

export type OopsRoastAgentContext = {
  mapView: MapView | null;
  persona?: RoastPersona;
  score: number;
  roastAttemptCount: number;
  sessionClosed: boolean;
  foundCriterionIds?: string[];
};

export interface VisibleLayerSummary {
  title: string;
  type: string;
  url: string | null;
  renderer: string | null;
  rendererSummary: string | null;
  rendererSymbol: string | null;
  definitionExpression: string | null;
  opacity: number | null;
  fieldPreview: string[];
  allCapsFieldNamesSample: string[];
  popupEnabled: boolean;
  popupTitle: string | null;
  popupFieldDateFormats: Array<{ fieldName: string; dateFormat: string | null }>;
  dateFieldsWithoutPopupFormat: string[];
  featureCount: number | null;
  minScale: number | null;
  maxScale: number | null;
  numericFieldNames: string[];
  rendererFields: string[];
}

export interface CritiqueEvidenceItem {
  label: string;
  value: string;
  detail?: string;
}

export interface CritiqueSignal {
  criterionId: CritiqueCriterionId;
  severity: Exclude<CritiqueSeverity, "none">;
  confidence: number;
  layerTitle: string;
  verdictReason: string;
  recommendedFix: string;
  evidence: CritiqueEvidenceItem[];
}

export interface CritiqueEvaluation {
  intent: CritiqueIntent;
  verdict: CritiqueVerdict;
  severity: CritiqueSeverity;
  criterionId: CritiqueCriterionOrNone;
  confidence: number;
  verdictReason: string;
  roastReply: string;
  recommendedFix: string | null;
  evidence: CritiqueEvidenceItem[];
}
