import { invokeTextPrompt, sendTraceMessage } from "@arcgis/ai-components/utils/index.js";
import type { AgentRegistration } from "@arcgis/ai-components/utils/index.js";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import roastWebmapPromptCartographer from "../roast-webmap-prompt.md";
import roastWebmapPromptChef from "../roast-webmap-prompt-chef.md";
import roastWebmapPromptMovie from "../roast-webmap-prompt-movie.md";
import roastWebmapPromptDetective from "../roast-webmap-prompt-detective.md";
import roastWebmapPromptSports from "../roast-webmap-prompt-sports.md";
import roastWebmapPromptHr from "../roast-webmap-prompt-hr.md";
import { formatRoastGifList } from "../../support/utils";
import type { RoastPersona } from "../oops-roast-agent/types";
import { buildCritiqueSignals } from "../oops-roast-agent/critique-signals";
import { formatLayerSummary, summarizeVisibleLayers } from "../oops-roast-agent/layer-summary";
import { escapePromptTemplateBraces, getRoastContext } from "../oops-roast-agent/message-utils";
import { postGameReportAgentState, type PostGameReportAgentState } from "./state";

const PERSONA_PROMPTS: Record<RoastPersona, string> = {
  cartographer: roastWebmapPromptCartographer,
  chef: roastWebmapPromptChef,
  movie: roastWebmapPromptMovie,
  detective: roastWebmapPromptDetective,
  sports: roastWebmapPromptSports,
  hr: roastWebmapPromptHr,
};

async function generateReport(
  state: PostGameReportAgentState,
  config?: RunnableConfig,
) {
  await sendTraceMessage(
    { text: "Post-Game Report: generating final persona-voiced verdict.", agentName: "Post-Game Report Agent" },
    config,
  );

  // Sub-agent mode: state fields are pre-populated by the orchestrator.
  // Standalone mode: fall back to extracting from context.
  let layers = state.visibleLayers;
  let persona = state.persona;
  let foundCriterionIds = state.foundCriterionIds;
  let allSignals = state.allSignals;

  if (layers.length === 0) {
    const context = getRoastContext(config);
    if (context?.mapView) {
      layers = await summarizeVisibleLayers(context.mapView);
      allSignals = buildCritiqueSignals(layers);
    }
    persona = context?.persona ?? "cartographer";
    foundCriterionIds = context?.foundCriterionIds ?? [];
  }

  const escapedLayerSummary = escapePromptTemplateBraces(formatLayerSummary(layers));

  const foundSignals = allSignals.filter((s) => foundCriterionIds.includes(s.criterionId));
  const missedSignals = allSignals.filter((s) => !foundCriterionIds.includes(s.criterionId));

  const foundList =
    foundSignals.length > 0
      ? [
          "| Flaw | Severity | Description |",
          "|------|----------|-------------|",
          ...foundSignals.map((s) => `| ${s.criterionId} | ${s.severity} | ${s.verdictReason} |`),
        ].join("\n")
      : "_None. They found absolutely nothing._";

  const missedList =
    missedSignals.length > 0
      ? [
          "| Flaw | Severity | Description |",
          "|------|----------|-------------|",
          ...missedSignals.map((s) => `| ${s.criterionId} | ${s.severity} | ${s.verdictReason} |`),
        ].join("\n")
      : "_None. Somehow they caught everything._";

  const promptText = [
    PERSONA_PROMPTS[persona].trim(),
    "",
    "The roast game is now OVER. Deliver the post-game verdict.",
    "Use the strict output format exactly.",
    "",
    "Issues the player CORRECTLY identified:",
    foundList,
    "",
    "Issues the player MISSED:",
    missedList,
    "",
    "In your post-game roast:",
    "1. Give a full map quality roast in your persona voice.",
    "2. Present the issues the player caught in a markdown table with columns: Flaw | Severity | Description.",
    "3. Present the issues the player missed in a markdown table with columns: Flaw | Severity | Description.",
    "4. Roast or praise accordingly based on each table.",
    "5. End with a verdict on their performance as a map critic.",
    "6. Never swear at, curse at, or directly verbally abuse the player. Keep any mockery clean and aimed at the map or the specific guesses.",
    "",
    formatRoastGifList(persona, "verdict"),
    "",
    "Visible feature-layer metadata:",
    escapedLayerSummary,
  ].join("\n");

  const reportText = await invokeTextPrompt({
    promptText,
    messages: state.messages,
    modelTier: "advanced",
  });

  return {
    reportText,
    outputMessage: reportText,
  };
}

function createPostGameReportGraph(): StateGraph<PostGameReportAgentState> {
  return new StateGraph(postGameReportAgentState)
    .addNode("generateReport", generateReport)
    .addEdge(START, "generateReport")
    .addEdge("generateReport", END) as StateGraph<PostGameReportAgentState>;
}

export { createPostGameReportGraph };

export const PostGameReportAgent: AgentRegistration = {
  id: "post-game-report-agent",
  name: "Post-Game Report Agent",
  description:
    "Generates the final post-game roast verdict after a roast session ends. Summarizes which map issues the player found versus missed, and delivers a persona-voiced verdict in the selected roast style (cartographer, chef, movie critic, etc.). Use this agent at the end of a roast game to produce the closing report.",
  createGraph: createPostGameReportGraph as unknown as AgentRegistration["createGraph"],
  workspace: postGameReportAgentState as AgentRegistration["workspace"],
};
