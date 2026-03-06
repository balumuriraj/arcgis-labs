import { sendTraceMessage } from "@arcgis/ai-components/utils/index.js";
import type { AgentRegistration } from "@arcgis/ai-components/utils/index.js";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import { evaluateCritique } from "../oops-roast-agent/critique-evaluation";
import { buildCritiqueSignals } from "../oops-roast-agent/critique-signals";
import { summarizeVisibleLayers } from "../oops-roast-agent/layer-summary";
import { getRoastContext, getLatestUserMessage } from "../oops-roast-agent/message-utils";
import { normalizeJudgeExplanation } from "../oops-roast-agent/scoring";
import { critiqueJudgeAgentState, type CritiqueJudgeAgentState } from "./state";

async function judgeUserCritique(
  state: CritiqueJudgeAgentState,
  config?: RunnableConfig,
) {
  await sendTraceMessage(
    { text: "Critique Judge: evaluating user critique against detected map issues.", agentName: "Critique Judge Agent" },
    config,
  );

  // Sub-agent mode: state fields are pre-populated by the orchestrator.
  // Standalone mode: fall back to extracting from context + messages.
  let userMessage = state.userMessage;
  let layers = state.visibleLayers;
  let signals = state.critiqueSignals;
  let score = state.score;
  let attempts = state.attempts;

  if (!userMessage) {
    userMessage = getLatestUserMessage(state.messages)?.trim() ?? "";
  }

  if (layers.length === 0) {
    const context = getRoastContext(config);
    if (context?.mapView) {
      layers = await summarizeVisibleLayers(context.mapView);
      signals = buildCritiqueSignals(layers);
    }
    score = context?.score ?? 0;
    attempts = context?.roastAttemptCount ?? 0;
  }

  if (!userMessage || layers.length === 0) {
    return {
      evaluation: null,
      outputMessage: "No user message or layer data available to evaluate.",
    };
  }

  const evaluation = await evaluateCritique(userMessage, layers, signals, score, attempts);

  // Build a human-readable summary for standalone use.
  const judgeReason = normalizeJudgeExplanation(evaluation.verdictReason);
  const lines: string[] = [evaluation.roastReply];

  if (evaluation.intent === "non_critique") {
    lines.push(`Non-roast turn detected. ${judgeReason}`);
  } else if (evaluation.intent === "end_session") {
    lines.push("End session requested.");
  } else if (evaluation.verdict === "valid") {
    lines.push(`Critique accepted. Criterion: ${evaluation.criterionId}. Severity: ${evaluation.severity}.`);
    lines.push(`Evidence check: ${judgeReason}`);
  } else {
    lines.push(`Critique rejected. ${judgeReason}`);
  }

  return {
    evaluation,
    outputMessage: lines.join("\n\n"),
  };
}

function createCritiqueJudgeGraph(): StateGraph<CritiqueJudgeAgentState> {
  return new StateGraph(critiqueJudgeAgentState)
    .addNode("judgeUserCritique", judgeUserCritique)
    .addEdge(START, "judgeUserCritique")
    .addEdge("judgeUserCritique", END) as StateGraph<CritiqueJudgeAgentState>;
}

export { createCritiqueJudgeGraph };

export const CritiqueJudgeAgent: AgentRegistration = {
  id: "critique-judge-agent",
  name: "Critique Judge Agent",
  description:
    "Evaluates a user's map critique against detected layer quality issues. Classifies the intent (critique, non-critique, or end session), matches the critique to a detected signal, and produces a verdict with a snarky reply. Use this agent to judge whether a user's observation correctly identifies a map flaw.",
  createGraph: createCritiqueJudgeGraph,
  workspace: critiqueJudgeAgentState,
};
