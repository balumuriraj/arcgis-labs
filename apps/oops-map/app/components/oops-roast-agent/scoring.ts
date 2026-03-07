import {
  CONFIDENCE_MULTIPLIER_BY_BAND,
  FULL_CONFIDENCE_THRESHOLD,
  MAX_ROAST_ATTEMPTS,
  MEDIUM_CONFIDENCE_THRESHOLD,
  POINTS_BY_SEVERITY,
  RANK_THRESHOLDS,
} from "./constants";
import type { CritiqueEvaluation, CritiqueSeverity } from "./types";

export function computeRank(score: number): string {
  if (score >= RANK_THRESHOLDS.legendary) {
    return "Legendary Map Menace";
  }

  if (score >= RANK_THRESHOLDS.senior) {
    return "Senior Cartographic Critic";
  }

  if (score >= RANK_THRESHOLDS.intermediate) {
    return "Intermediate Roast Auditor";
  }

  if (score >= RANK_THRESHOLDS.novice) {
    return "Novice Map Critic";
  }

  return "Unranked Observer";
}

export function buildFinalScoreMessage(score: number, roastAttemptCount: number): string {
  const rank = computeRank(score);

  return [
    "------------------------",
    "",
    `🛑 **FINAL SCORE: ${score} Roast Points.** 🏆 **Rank:** *${rank}*`,
    "",
    "I'd print you a certificate, but this map has already caused enough visual trauma.",
    "",
    `*Roast attempts used: ${roastAttemptCount}/${MAX_ROAST_ATTEMPTS}*`,    
  ].join("\n");
}

export function normalizeJudgeExplanation(explanation: string): string {
  const compact = explanation.replace(/\s+/g, " ").trim();

  if (compact.length === 0 || /^no clear explanation returned\.?$/i.test(compact)) {
    return "The critique did not match enough visible-layer evidence.";
  }

  if (compact.length > 180) {
    return `${compact.slice(0, 177)}...`;
  }

  return compact;
}

export function severityWeight(severity: CritiqueSeverity): number {
  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  if (severity === "low") {
    return 1;
  }

  return 0;
}

export function confidenceMultiplier(confidence: number): number {
  if (confidence >= FULL_CONFIDENCE_THRESHOLD) {
    return CONFIDENCE_MULTIPLIER_BY_BAND.high;
  }

  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return CONFIDENCE_MULTIPLIER_BY_BAND.medium;
  }

  return CONFIDENCE_MULTIPLIER_BY_BAND.low;
}

export function pointsForSeverity(severity: CritiqueSeverity): number {
  if (severity === "low" || severity === "medium" || severity === "high") {
    return POINTS_BY_SEVERITY[severity];
  }

  return 0;
}

export function pointsForEvaluation(evaluation: CritiqueEvaluation): number {
  if (evaluation.verdict !== "valid") {
    return 0;
  }

  const basePoints = pointsForSeverity(evaluation.severity);
  const multiplier = confidenceMultiplier(evaluation.confidence);
  const adjusted = Math.round(basePoints * multiplier);

  return Math.max(1, adjusted);
}

export function buildNoContextMessage(): string {
  return [
    "🚨 **THE OOPS REPORT** 🚨",
    "*The stage lights are off because the map context is still loading.*",
    "",
    "**Final Verdict:** *Try again once the map finishes loading.*",
  ].join("\n");
}

export function buildNoFeatureLayersMessage(reactionGif: string): string {
  return [
    "🚨 **THE OOPS REPORT** 🚨",
    "*No visible feature layers showed up, so there is nothing roastable yet.*",
    `![No feature layers available yet](${reactionGif})`,
    "",
    "**Final Verdict:** *Toggle on at least one feature layer and I'll bring the sarcasm.*",
  ].join("\n");
}
