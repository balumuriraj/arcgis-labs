import type { ChatHistory } from "@arcgis/ai-components/utils/index.js";
import { Annotation, messagesStateReducer } from "@langchain/langgraph/web";
import type { CritiqueEvaluation, CritiqueSignal, VisibleLayerSummary } from "../oops-roast-agent/types";

export const critiqueJudgeAgentState = Annotation.Root({
  messages: Annotation<ChatHistory>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  outputMessage: Annotation<string>({
    reducer: (current = "", update) =>
      typeof update === "string" && update.trim().length > 0 ? update : current,
    default: () => "",
  }),
  userMessage: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  visibleLayers: Annotation<VisibleLayerSummary[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  critiqueSignals: Annotation<CritiqueSignal[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  score: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),
  attempts: Annotation<number>({
    reducer: (_current, update) => update,
    default: () => 0,
  }),
  evaluation: Annotation<CritiqueEvaluation | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

export type CritiqueJudgeAgentState = typeof critiqueJudgeAgentState.State;
