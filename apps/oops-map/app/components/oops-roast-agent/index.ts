import { sendTraceMessage } from "@arcgis/ai-components/utils/index.js";
import type { AgentRegistration } from "@arcgis/ai-components/utils/index.js";
import { getBackgroundColorTheme } from "@arcgis/core/views/support/colorUtils.js";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph/web";
import { pickRoastGif } from "../../support/utils";
import { createCritiqueJudgeGraph } from "../critique-judge-agent/index";
import type { CritiqueJudgeAgentState } from "../critique-judge-agent/state";
import { createPostGameReportGraph } from "../post-game-report-agent/index";
import type { PostGameReportAgentState } from "../post-game-report-agent/state";
import { MAX_ROAST_ATTEMPTS } from "./constants";
import { buildCritiqueSignals } from "./critique-signals";
import { summarizeVisibleLayers } from "./layer-summary";
import { enrichRendererSummaries } from "./renderer-enrichment";
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
  pointsForEvaluation,
} from "./scoring";
import {
  oopsRoastAgentState,
  type OopsRoastAgentState,
  type OopsRoastRouting,
} from "./state";
import type { RoastPersona } from "./types";

const VALID_CRITIQUE_MESSAGES: Record<RoastPersona, string[]> = {
  cartographer: [
    "🗺️ **Cartographic Strike:** At last, someone in this room can read a map.",
    "📏 **Properly Measured:** That critique actually aligns with the evidence on the page.",
    "🧭 **True North:** You found a real flaw instead of wandering into decorative nonsense.",
  ],
  chef: [
    "🧑‍🍳 **Finally Seasoned:** Yes, that is an actual flaw. Someone in this kitchen has a functioning palate.",
    "🍽️ **Service Saved:** You spotted the raw ingredient before it poisoned the whole dish.",
    "🔥 **Clean Plate Review:** Correct call. That map issue was cooked badly and deserved to be sent back.",
  ],
  movie: [
    "🎬 **Sharp Review:** At last, a critic who noticed the real narrative collapse.",
    "🍿 **Accurate Reading:** Yes, that flaw was in the final cut, and you caught it.",
    "📽️ **Festival Worthy Note:** Your critique actually understood the scene better than the map did.",
  ],
  detective: [
    "🕵️ **Case Confirmed:** Now that's real evidence. The suspect is absolutely guilty.",
    "🔎 **Good Police Work:** You found the crack in the alibi and the whole case opened up.",
    "🚨 **Charge Upheld:** Correct read. That flaw was leaving fingerprints all over the record.",
  ],
  sports: [
    "🏟️ **On the Board:** That's a clean score. You called the bad play exactly right.",
    "🏈 **Highlight Reel:** Excellent read. You saw the fumble before the replay team even buzzed in.",
    "⚾ **Right Down the Middle:** That critique connected perfectly. No review needed.",
  ],
  hr: [
    "📋 **Performance Confirmed:** Yes, that concern is fully documented and supported by the record.",
    "👔 **Appropriate Escalation:** You identified a legitimate issue requiring immediate follow-up.",
    "✅ **Reviewed and Validated:** That critique aligns with observable deficiencies in the deliverable.",
  ],
};

const INVALID_CRITIQUE_MESSAGES: Record<RoastPersona, string[]> = {
  cartographer: [
    "🧭 **Off the Map:** Your compass is broken. That's not actually a flaw.",
    "🗺️ **Projection Error:** You just accused the legend of a crime it did not commit.",
    "📐 **Cartographic Misfire:** That critique has all the precision of a scale bar drawn with spaghetti.",
  ],
  chef: [
    "👅 **Unrefined Palate:** You're tasting things that aren't there. That part of the map is fine.",
    "🍳 **Order Returned:** That critique is raw in the middle and fully unsupported by the evidence.",
    "🔪 **Kitchen Slip:** You seasoned the wrong dish. That issue is not on the menu.",
  ],
  movie: [
    "🎬 **Plot Hole:** Did we even watch the same map? That critique is entirely fictional.",
    "🍿 **Bad Screening Notes:** You're reviewing a scene that never made the final cut.",
    "📽️ **Continuity Error:** The evidence does not support this dramatic interpretation.",
  ],
  detective: [
    "🚨 **False Lead:** You're investigating the wrong suspect. The evidence doesn't support your claim.",
    "🕵️ **Case Collapsed:** Nice theory, but the facts just walked out of the interrogation room.",
    "🔎 **No Evidence Logged:** That accusation wouldn't survive five seconds in records.",
  ],
  sports: [
    "⚾ **Swing and a Miss:** Not even close to the strike zone! That was a complete airball.",
    "🏈 **Turnover on Review:** Replay shows you challenged the wrong play entirely.",
    "🚫 **No Score:** Big windup, zero contact. That critique never made it onto the board.",
  ],
  hr: [
    "🗑️ **Grievance Dismissed:** Your feedback has been reviewed and discarded for lack of factual basis.",
    "📋 **Documentation Issue:** We could not substantiate this concern after routine review.",
    "🚪 **Performance Note:** This allegation does not align with the observable behavior of the map.",
  ],
};

function buildChallengeMessage(
  signalCount: number,
  layerCount: number,
): string {
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
    {
      text: "Orchestrator: analyzing map context and determining routing.",
      agentName: "Oops Roast Agent",
    },
    config,
  );

  const context = getRoastContext(config);
  const mapView = context?.mapView ?? null;
  const persona: RoastPersona = context?.persona ?? "cartographer";
  const sessionClosed = context?.sessionClosed ?? false;

  if (!mapView) {
    return {
      routing: "closed" as OopsRoastRouting,
      outputMessage: buildNoContextMessage(),
    };
  }

  const rawLayers = await summarizeVisibleLayers(mapView);

  if (rawLayers.length === 0) {
    return {
      routing: "closed" as OopsRoastRouting,
      outputMessage: buildNoFeatureLayersMessage(
        pickRoastGif(persona, "verdict"),
      ),
    };
  }

  await sendTraceMessage(
    {
      text: "Orchestrator: enriching renderer summaries with LLM.",
      agentName: "Oops Roast Agent",
    },
    config,
  );

  const visibleLayers = await enrichRendererSummaries(rawLayers, mapView);
  const basemapThemeRaw = await getBackgroundColorTheme(mapView);
  const basemapTheme: "dark" | "light" | "unknown" =
    basemapThemeRaw === "dark" || basemapThemeRaw === "light"
      ? basemapThemeRaw
      : "unknown";
  const critiqueSignals = buildCritiqueSignals(visibleLayers, { basemapTheme });
  const userMessage = getLatestUserMessage(state.messages)?.trim() ?? "";

  // Check for explicit end-session keyword BEFORE checking sessionClosed.
  // The "End Game" button submits "end game" when sessionClosed is already true,
  // so this check must come first or postGameReport would never be reached.
  if (isEndSessionMessage(userMessage)) {
    return {
      visibleLayers,
      critiqueSignals,
      userMessage,
      routing: "end_session" as OopsRoastRouting,
    };
  }

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
      outputMessage: buildChallengeMessage(
        critiqueSignals.length,
        visibleLayers.length,
      ),
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
    {
      text: "Orchestrator: delegating to Critique Judge Agent.",
      agentName: "Oops Roast Agent",
    },
    config,
  );

  const judgeGraph = createCritiqueJudgeGraph().compile();
  const result = await judgeGraph.invoke(
    {
      messages: state.messages,
      userMessage: state.userMessage,
      visibleLayers: state.visibleLayers,
      critiqueSignals: state.critiqueSignals,
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
    {
      text: "Orchestrator: delegating to Post-Game Report Agent.",
      agentName: "Oops Roast Agent",
    },
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

function pickMessage(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ─── Node 4: buildResponse ────────────────────────────────────────────────────
// Assembles the final outputMessage from routing decision + evaluation/report.

async function buildResponse(
  state: OopsRoastAgentState,
  config?: RunnableConfig,
): Promise<Partial<OopsRoastAgentState>> {
  const context = getRoastContext(config);
  const persona: RoastPersona = context?.persona ?? "cartographer";
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
      outputMessage: [
        state.reportText,
        "",
        buildFinalScoreMessage(currentScore, currentAttempts),
      ].join("\n"),
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

  const pointsAwarded =
    evaluation.verdict === "valid" ? pointsForEvaluation(evaluation) : 0;
  const nextScore = currentScore + pointsAwarded;

  const acceptedCriterionId =
    evaluation.verdict === "valid" ? evaluation.criterionId : undefined;
  dispatchRoastTurnComplete({
    pointsAwarded,
    sessionClosed: reachedCap,
    countAttempt: true,
    criterionId: acceptedCriterionId,
    signals: reachedCap ? state.critiqueSignals : undefined,
  });

  const lines: string[] = [];

  if (evaluation.verdict === "valid") {
    lines.push("", `![reaction](${pickRoastGif(persona, "valid")})`, "");
    lines.push(`✅ **Critique accepted (+${pointsAwarded} Roast Points!)**`);

    lines.push(
      `> *${evaluation.roastReply}*`,
      "",
      pickMessage(VALID_CRITIQUE_MESSAGES[persona]),
    );
  } else {
    lines.push("", `![reaction](${pickRoastGif(persona, "invalid")})`, "");
    lines.push("❌ **Critique rejected (0 Points).**");

    lines.push(
      `> *${evaluation.roastReply}*`,
      "",
      pickMessage(INVALID_CRITIQUE_MESSAGES[persona]),
    );
  }

  if (reachedCap) {
    lines.push("", buildFinalScoreMessage(nextScore, nextAttempts));
  }

  return { outputMessage: lines.join("\n") };
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
      state.evaluation?.intent === "end_session"
        ? "postGameReport"
        : "buildResponse",
    )
    .addEdge("postGameReport", "buildResponse")
    .addEdge("buildResponse", END) as StateGraph<OopsRoastAgentState>;
}

export const OopsRoastAgent: AgentRegistration = {
  id: "oops-roast-agent",
  name: "Oops Roast Agent",
  description:
    "A roast-game specialist for visible feature layers that runs opening roasts, validates user critiques, awards roast points, and provides final score wrap-ups. Use this agent when users want to roast map quality and submit critique attempts, not for general GIS data queries.",
  createGraph: createOopsRoastGraph as unknown as AgentRegistration["createGraph"],
  workspace: oopsRoastAgentState as AgentRegistration["workspace"],
};
