import type { ChatHistory } from "@arcgis/ai-components/utils/index.js";
import { Annotation, messagesStateReducer } from "@langchain/langgraph/web";
import type { CritiqueSignal, RoastPersona, VisibleLayerSummary } from "../oops-roast-agent/types";

export const postGameReportAgentState = Annotation.Root({
  messages: Annotation<ChatHistory>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  outputMessage: Annotation<string>({
    reducer: (current = "", update) =>
      typeof update === "string" && update.trim().length > 0 ? update : current,
    default: () => "",
  }),
  visibleLayers: Annotation<VisibleLayerSummary[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  persona: Annotation<RoastPersona>({
    reducer: (_current, update) => update,
    default: () => "cartographer" as RoastPersona,
  }),
  foundCriterionIds: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  allSignals: Annotation<CritiqueSignal[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  reportText: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
});

export type PostGameReportAgentState = typeof postGameReportAgentState.State;
