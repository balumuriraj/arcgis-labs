import { invokeTextPrompt } from "@arcgis/ai-components/utils/index.js";
import { MAX_ROAST_ATTEMPTS } from "./constants";
import { formatCritiqueSignals, selectBestSignalForMessage } from "./critique-signals";
import { formatLayerSummary } from "./layer-summary";
import { escapePromptTemplateBraces } from "./message-utils";
import type {
  CritiqueEvaluation,
  CritiqueIntent,
  CritiqueSignal,
  VisibleLayerSummary,
} from "./types";

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const normalized = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(normalized) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // Continue with substring extraction.
  }

  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  const candidateJson = normalized.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidateJson) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toIntent(value: unknown): CritiqueIntent {
  return value === "critique" || value === "non_critique" || value === "end_session"
    ? value
    : "non_critique";
}

function toSignalIndex(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function buildEvaluation(
  intent: CritiqueIntent,
  matchedSignal: CritiqueSignal | null,
  verdictReason: string,
  roastReply: string,
): CritiqueEvaluation {
  if (intent === "non_critique" || intent === "end_session") {
    return {
      intent,
      verdict: "not_applicable",
      severity: "none",
      criterionId: "none",
      confidence: 0,
      verdictReason,
      roastReply,
      recommendedFix: null,
      evidence: [],
    };
  }

  // intent === "critique"
  if (!matchedSignal) {
    return {
      intent,
      verdict: "invalid",
      severity: "none",
      criterionId: "none",
      confidence: 0,
      verdictReason:
        verdictReason.trim().length > 0
          ? verdictReason
          : "The critique did not match any detected issue in the current layer metadata.",
      roastReply,
      recommendedFix:
        "Anchor your critique to a concrete, visible issue such as popup config, renderer choice, filter logic, opacity, or feature volume.",
      evidence: [],
    };
  }

  return {
    intent,
    verdict: "valid",
    severity: matchedSignal.severity,
    criterionId: matchedSignal.criterionId,
    confidence: matchedSignal.confidence,
    verdictReason:
      verdictReason.trim().length > 0 ? verdictReason : matchedSignal.verdictReason,
    roastReply,
    recommendedFix: matchedSignal.recommendedFix,
    evidence: matchedSignal.evidence,
  };
}

export async function evaluateCritique(
  userMessage: string,
  layers: VisibleLayerSummary[],
  criterionSignals: CritiqueSignal[],
  score: number,
  roastAttemptCount: number,
): Promise<CritiqueEvaluation> {
  const escapedUserMessage = escapePromptTemplateBraces(userMessage);
  const escapedLayerSummary = escapePromptTemplateBraces(formatLayerSummary(layers));
  const escapedSignalSummary = escapePromptTemplateBraces(
    formatCritiqueSignals(criterionSignals),
  );
  const heuristicSignal = selectBestSignalForMessage(userMessage, criterionSignals);
  const heuristicHint = heuristicSignal
    ? `Heuristic hint: the user's wording most closely resembles signal for criterionId=${heuristicSignal.criterionId} on layer="${heuristicSignal.layerTitle}". Use this as a starting point, but only confirm if the user's message actually refers to that issue.`
    : "Heuristic hint: no signal keywords matched the user's message strongly enough.";

  const signalCount = Math.min(criterionSignals.length, 16);

  const promptText = [
    "You are the Oops Map critique judge for a roast game.",
    "Your job: classify the user's message, identify which detected issue it targets (if any), and write a snarky reply.",
    "",
    "## Detected issues in the current map (numbered list)",
    escapedSignalSummary,
    "",
    "## Visible feature-layer metadata",
    escapedLayerSummary,
    "",
    `## ${heuristicHint}`,
    "",
    "## Score context",
    `score=${score}, attemptsUsed=${roastAttemptCount}/${MAX_ROAST_ATTEMPTS}`,
    "",
    "## User message",
    escapedUserMessage,
    "",
    "## Instructions",
    "Return JSON only with this exact schema:",
    `{{"intent":"critique|non_critique|end_session","signalIndex":0,"verdictReason":"string","roastReply":"string"}}`,
    "",
    "Rules:",
    "- intent=end_session only if the user explicitly wants to stop roasting.",
    "- intent=non_critique for off-topic messages, standard GIS questions, or anything not critiquing a layer.",
    "- intent=critique when the user is pointing out a flaw in a layer.",
    `- signalIndex: 1-based index into the detected issues list above (1 to ${signalCount}). Set to 0 if no listed issue matches the user's critique.`,
    "- A critique is only valid when it clearly targets one of the listed issues — do not invent new issues.",
    "- verdictReason: one sentence (max 140 chars) explaining why the critique matches or misses the detected issue.",
    "- roastReply: snarky, in-character response (max 35 words). Be direct and specific.",
    "- If intent is non_critique or end_session, set signalIndex=0.",
  ].join("\n");

  const rawEvaluation = await invokeTextPrompt({
    promptText,
    modelTier: "default",
    temperature: 0.2,
  });

  const parsed = extractJsonObject(rawEvaluation);
  const intent = toIntent(parsed?.intent);
  const signalIndex = toSignalIndex(parsed?.signalIndex);

  // Resolve the matched signal by 1-based index into the capped signals list
  const matchedSignal =
    intent === "critique" && signalIndex >= 1 && signalIndex <= signalCount
      ? (criterionSignals[signalIndex - 1] ?? null)
      : null;

  const verdictReason =
    typeof parsed?.verdictReason === "string" && parsed.verdictReason.trim().length > 0
      ? parsed.verdictReason.trim()
      : "";

  const roastReply =
    typeof parsed?.roastReply === "string" && parsed.roastReply.trim().length > 0
      ? parsed.roastReply.trim()
      : "I checked it. Your critique needs more evidence.";

  return buildEvaluation(intent, matchedSignal, verdictReason, roastReply);
}
