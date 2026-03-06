import { sendTraceMessage } from "@arcgis/ai-components/utils/index.js";
import type { AgentRegistration } from "@arcgis/ai-components/utils/index.js";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import { createCritiqueJudgeGraph } from "../critique-judge-agent/index";
import type { CritiqueJudgeAgentState } from "../critique-judge-agent/state";
import { createPostGameReportGraph } from "../post-game-report-agent/index";
import type { PostGameReportAgentState } from "../post-game-report-agent/state";
import { MAX_ROAST_ATTEMPTS } from "./constants";
import { buildCritiqueSignals, formatEvidenceSummary } from "./critique-signals";
import { summarizeVisibleLayers } from "./layer-summary";
import {
  getLatestUserMessage,
  getRoastContext,
  isEndSessionMessage,
} from "./message-utils";
import { dispatchRoastTurnComplete } from "./roast-events";
import {
  buildFinalScoreMessage,
  buildNoContextMessage,
  buildNoFeatureLayersMessage,
  confidenceMultiplier,
  normalizeJudgeExplanation,
  pointsForEvaluation,
  pointsForSeverity,
} from "./scoring";
import {
  oopsRoastAgentState,
  type OopsRoastAgentState,
  type OopsRoastRouting,
} from "./state";

function buildChallengeMessage(signalCount: number, layerCount: number): string {
  return [
    `I've scanned your map. Detected **${signalCount}** quality issue(s) across **${layerCount}** layer(s).`,
    "",
    `You have **${MAX_ROAST_ATTEMPTS} attempts** to call them out. What's wrong with this map?`,
  ].join("\n");
}

// ─── Node 1: analyzeContext ───────────────────────────────────────────────────
// Scans layers, extracts game state from config, and decides routing.

async function analyzeContext(
  state: OopsRoastAgentState,
  config?: RunnableConfig,
): Promise<Partial<OopsRoastAgentState>> {
  await sendTraceMessage(
    { text: "Orchestrator: analyzing map context and determining routing.", agentName: "Oops Roast Agent" },
    config,
  );

  const context = getRoastContext(config);
  const mapView = context?.mapView ?? null;
  const sessionClosed = context?.sessionClosed ?? false;

  if (!mapView) {
    return {
      routing: "closed" as OopsRoastRouting,
      outputMessage: buildNoContextMessage(),
    };
  }

  const visibleLayers = await summarizeVisibleLayers(mapView);

  if (visibleLayers.length === 0) {
    return {
      routing: "closed" as OopsRoastRouting,
      outputMessage: buildNoFeatureLayersMessage(),
    };
  }

  const critiqueSignals = buildCritiqueSignals(visibleLayers);
  const userMessage = getLatestUserMessage(state.messages)?.trim() ?? "";

  if (sessionClosed) {
    const currentScore = context?.score ?? 0;
    const currentAttempts = context?.roastAttemptCount ?? 0;
    return {
      visibleLayers,
      critiqueSignals,
      userMessage,
      routing: "closed" as OopsRoastRouting,
      outputMessage: [
        buildFinalScoreMessage(currentScore, currentAttempts),
        "",
        "Load a different map if you want a fresh round.",
      ].join("\n"),
    };
  }

  if (userMessage.length === 0) {
    return {
      visibleLayers,
      critiqueSignals,
      userMessage,
      routing: "challenge" as OopsRoastRouting,
      outputMessage: buildChallengeMessage(critiqueSignals.length, visibleLayers.length),
    };
  }

  if (isEndSessionMessage(userMessage)) {
    return {
      visibleLayers,
      critiqueSignals,
      userMessage,
      routing: "end_session" as OopsRoastRouting,
    };
  }

  return {
    visibleLayers,
    critiqueSignals,
    userMessage,
    routing: "critique" as OopsRoastRouting,
  };
}

// ─── Node 2: critiqueJudge ────────────────────────────────────────────────────
// Delegates to CritiqueJudgeAgent subgraph and stores the evaluation.

async function critiqueJudge(
  state: OopsRoastAgentState,
  config?: RunnableConfig,
): Promise<Partial<OopsRoastAgentState>> {
  await sendTraceMessage(
    { text: "Orchestrator: delegating to Critique Judge Agent.", agentName: "Oops Roast Agent" },
    config,
  );

  const context = getRoastContext(config);
  const score = context?.score ?? 0;
  const attempts = context?.roastAttemptCount ?? 0;

  const judgeGraph = createCritiqueJudgeGraph().compile();
  const result = await judgeGraph.invoke(
    {
      messages: state.messages,
      userMessage: state.userMessage,
      visibleLayers: state.visibleLayers,
      critiqueSignals: state.critiqueSignals,
      score,
      attempts,
    },
    config,
  );

  return { evaluation: (result as CritiqueJudgeAgentState).evaluation };
}

// ─── Node 3: postGameReport ───────────────────────────────────────────────────
// Delegates to PostGameReportAgent subgraph and stores the report text.

async function postGameReport(
  state: OopsRoastAgentState,
  config?: RunnableConfig,
): Promise<Partial<OopsRoastAgentState>> {
  await sendTraceMessage(
    { text: "Orchestrator: delegating to Post-Game Report Agent.", agentName: "Oops Roast Agent" },
    config,
  );

  const context = getRoastContext(config);
  const persona = context?.persona ?? "cartographer";
  const foundCriterionIds = context?.foundCriterionIds ?? [];

  dispatchRoastTurnComplete({
    pointsAwarded: 0,
    sessionClosed: true,
    countAttempt: false,
    signals: state.critiqueSignals,
  });

  const reportGraph = createPostGameReportGraph().compile();
  const result = await reportGraph.invoke(
    {
      messages: state.messages,
      visibleLayers: state.visibleLayers,
      persona,
      foundCriterionIds,
      allSignals: state.critiqueSignals,
    },
    config,
  );

  return { reportText: (result as PostGameReportAgentState).reportText };
}

// ─── Node 4: buildResponse ────────────────────────────────────────────────────
// Assembles the final outputMessage from routing decision + evaluation/report.

async function buildResponse(
  state: OopsRoastAgentState,
  config?: RunnableConfig,
): Promise<Partial<OopsRoastAgentState>> {
  const context = getRoastContext(config);
  const currentScore = context?.score ?? 0;
  const currentAttempts = context?.roastAttemptCount ?? 0;

  // challenge, closed, and no-context paths already set outputMessage in analyzeContext.
  if (state.routing === "challenge" || state.routing === "closed") {
    return {};
  }

  const evaluation = state.evaluation;

  // End session triggered directly by keyword (no evaluation).
  if (state.routing === "end_session" && !evaluation) {
    return {
      outputMessage: [state.reportText, "", buildFinalScoreMessage(currentScore, currentAttempts)].join("\n"),
    };
  }

  if (!evaluation) {
    return { outputMessage: buildNoContextMessage() };
  }

  // End session triggered by LLM intent inside a critique turn.
  if (evaluation.intent === "end_session") {
    return {
      outputMessage: [
        evaluation.roastReply,
        "",
        state.reportText,
        "",
        buildFinalScoreMessage(currentScore, currentAttempts),
      ].join("\n"),
    };
  }

  const nextAttempts = currentAttempts + 1;
  const reachedCap = nextAttempts >= MAX_ROAST_ATTEMPTS;
  const attemptsRemaining = Math.max(0, MAX_ROAST_ATTEMPTS - nextAttempts);

  if (evaluation.intent === "non_critique") {
    const judgeReason = normalizeJudgeExplanation(evaluation.verdictReason);

    dispatchRoastTurnComplete({
      pointsAwarded: 0,
      sessionClosed: reachedCap,
      countAttempt: true,
      signals: reachedCap ? state.critiqueSignals : undefined,
    });

    const outputMessage = [
      evaluation.roastReply,
      "",
      `🧭 **Non-roast turn detected.** ${judgeReason}`,
      "",
      "No Roast Points awarded. Throw me a map flaw to score.",
      `*(Total Score: ${currentScore})*`,
      `*(Attempt ${nextAttempts}/${MAX_ROAST_ATTEMPTS})*`,
      `*(Roasts Left: ${attemptsRemaining})*`,
    ].join("\n");

    if (reachedCap) {
      return {
        outputMessage: [outputMessage, "", buildFinalScoreMessage(currentScore, nextAttempts)].join("\n"),
      };
    }

    return { outputMessage };
  }

  const pointsAwarded = evaluation.verdict === "valid" ? pointsForEvaluation(evaluation) : 0;
  const nextScore = currentScore + pointsAwarded;
  const judgeReason = normalizeJudgeExplanation(evaluation.verdictReason);

  const acceptedCriterionId = evaluation.verdict === "valid" ? evaluation.criterionId : undefined;
  dispatchRoastTurnComplete({
    pointsAwarded,
    sessionClosed: reachedCap,
    countAttempt: true,
    criterionId: acceptedCriterionId,
    signals: reachedCap ? state.critiqueSignals : undefined,
  });

  const scoringLines: string[] = [];
  scoringLines.push(evaluation.roastReply);

  if (evaluation.verdict === "valid") {
    const confidencePercent = Math.round(evaluation.confidence * 100);
    const confidenceFactor = confidenceMultiplier(evaluation.confidence);
    const basePoints = pointsForSeverity(evaluation.severity);

    scoringLines.push(
      `✅ **Critique accepted.** 🔥 **+${pointsAwarded} Roast Points.** Severity: **${evaluation.severity}**. Criterion: **${evaluation.criterionId}**. Confidence: **${confidencePercent}%**.`,
    );
    scoringLines.push(`*Evidence check:* ${judgeReason}`);

    if (evaluation.evidence.length > 0) {
      scoringLines.push(`*Evidence:* ${formatEvidenceSummary(evaluation.evidence)}`);
    }

    scoringLines.push(
      `*Scoring formula:* ${basePoints} base points x ${confidenceFactor.toFixed(1)} confidence multiplier.`,
    );

    if (evaluation.recommendedFix) {
      scoringLines.push(`*Suggested fix:* ${evaluation.recommendedFix}`);
    }
  } else {
    scoringLines.push(`🧾 **Critique rejected.** ${judgeReason}`);
    scoringLines.push("❌ **0 Roast Points.** Do better.");

    if (evaluation.recommendedFix) {
      scoringLines.push(`*Suggested fix:* ${evaluation.recommendedFix}`);
    }
  }

  scoringLines.push(`*(Total Score: ${nextScore})*`);
  scoringLines.push(`*(Attempt ${nextAttempts}/${MAX_ROAST_ATTEMPTS})*`);
  scoringLines.push(`*(Roasts Left: ${attemptsRemaining})*`);

  if (reachedCap) {
    scoringLines.push("");
    scoringLines.push(buildFinalScoreMessage(nextScore, nextAttempts));
  }

  return { outputMessage: scoringLines.join("\n\n") };
}

// ─── Graph ────────────────────────────────────────────────────────────────────

function createOopsRoastGraph(): StateGraph<OopsRoastAgentState> {
  return new StateGraph(oopsRoastAgentState)
    .addNode("analyzeContext", analyzeContext)
    .addNode("critiqueJudge", critiqueJudge)
    .addNode("postGameReport", postGameReport)
    .addNode("buildResponse", buildResponse)
    .addEdge(START, "analyzeContext")
    .addConditionalEdges("analyzeContext", (state) => state.routing, {
      challenge: "buildResponse",
      closed: "buildResponse",
      end_session: "postGameReport",
      critique: "critiqueJudge",
    })
    .addConditionalEdges("critiqueJudge", (state) =>
      state.evaluation?.intent === "end_session" ? "postGameReport" : "buildResponse",
    )
    .addEdge("postGameReport", "buildResponse")
    .addEdge("buildResponse", END) as StateGraph<OopsRoastAgentState>;
}

export const OopsRoastAgent: AgentRegistration = {
  id: "oops-roast-agent",
  name: "Oops Roast Agent",
  description:
    "A roast-game specialist for visible feature layers that runs opening roasts, validates user critiques, awards roast points, and provides final score wrap-ups. Use this agent when users want to roast map quality and submit critique attempts, not for general GIS data queries.",
  createGraph: createOopsRoastGraph,
  workspace: oopsRoastAgentState,
};
