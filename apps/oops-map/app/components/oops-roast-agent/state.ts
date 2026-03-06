import type { ChatHistory } from "@arcgis/ai-components/utils/index.js";
import { Annotation, messagesStateReducer } from "@langchain/langgraph/web";
import type { CritiqueEvaluation, CritiqueSignal, VisibleLayerSummary } from "./types";

export type OopsRoastRouting = "challenge" | "end_session" | "critique" | "closed";

export const oopsRoastAgentState = Annotation.Root({
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
  critiqueSignals: Annotation<CritiqueSignal[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  userMessage: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  routing: Annotation<OopsRoastRouting>({
    reducer: (_current, update) => update,
    default: () => "challenge" as OopsRoastRouting,
  }),
  evaluation: Annotation<CritiqueEvaluation | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  reportText: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
});

export type OopsRoastAgentState = typeof oopsRoastAgentState.State;
