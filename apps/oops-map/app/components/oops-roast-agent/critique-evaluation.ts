import { invokeTextPrompt } from "@arcgis/ai-components/utils/index.js";
import { formatCritiqueSignals } from "./critique-signals";
import { formatLayerSummary } from "./layer-summary";
import { escapePromptTemplateBraces } from "./message-utils";
import { PERSONA_PROMPT_DESCRIPTIONS } from "./personas";
import type {
  CritiqueEvaluation,
  CritiqueIntent,
  CritiqueSignal,
  RoastPersona,
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
  return value === "critique" || value === "end_session"
    ? value
    : "critique";
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
  if (intent === "end_session") {
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
  persona: RoastPersona,
): Promise<CritiqueEvaluation> {
  const escapedUserMessage = escapePromptTemplateBraces(userMessage);
  const escapedLayerSummary = escapePromptTemplateBraces(formatLayerSummary(layers));
  const escapedSignalSummary = escapePromptTemplateBraces(
    formatCritiqueSignals(criterionSignals),
  );

  const signalCount = Math.min(criterionSignals.length, 16);

  const promptText = [
    "You are the Oops Map critique judge for a roast game.",
    `You are playing the role of: ${PERSONA_PROMPT_DESCRIPTIONS[persona]}.`,
    "Your job: classify the user's message, identify which detected issue it targets (if any), and write a snarky reply that stays fully in character.",
    "",
    "## Detected issues in the current map (numbered list)",
    escapedSignalSummary,
    "",
    "## Visible feature-layer metadata",
    escapedLayerSummary,
    "",
    "## User message",
    escapedUserMessage,
    "",
    "## Instructions",
    "Return JSON only with this exact schema:",
    `{{"intent":"critique|end_session","signalIndex":0,"verdictReason":"string","roastReply":"string"}}`,
    "",
    "Rules:",
    "- intent=end_session only if the user explicitly wants to stop roasting.",
    "- Use intent=critique for every other message, including off-topic questions, vague complaints, or failed critiques.",
    `- signalIndex: 1-based index into the detected issues list above (1 to ${signalCount}). Set to 0 if no listed issue matches the user's critique.`,
    "- A critique is only valid when it clearly targets one of the listed issues — do not invent new issues.",
    "- verdictReason: one short sentence (max 140 chars) acting as the 'official referee ruling' explaining exactly why their guess was right or wrong.",
    "- roastReply: snarky in-character response (max 35 words) staying fully in persona. NEVER reveal or describe the actual detected issue. If the verdict will be valid, roast the MAP for its flaws. If the verdict will be invalid, roast the critique itself for being wrong, off-base, or unsupported.",
    "- Never swear at, curse at, or directly verbally abuse the user. Keep the language clean even when mocking a bad critique.",
    "- If the message is not actually a critique, still use intent=critique and set signalIndex=0 so the verdict becomes invalid.",
    "- If intent is end_session, set signalIndex=0.",
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
