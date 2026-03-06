import type {
  ChatHistory,
  CustomConfigurableType,
} from "@arcgis/ai-components/utils/index.js";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { OopsRoastAgentContext } from "./types";

export function getRoastContext(config?: RunnableConfig): OopsRoastAgentContext | null {
  const configurable = config?.configurable as CustomConfigurableType | undefined;
  const context = configurable?.context;

  if (!context || typeof context !== "object") {
    return null;
  }

  const candidate = context as Partial<OopsRoastAgentContext>;
  return {
    mapView: candidate.mapView ?? null,
    persona: candidate.persona,
    score: candidate.score ?? 0,
    roastAttemptCount: candidate.roastAttemptCount ?? 0,
    sessionClosed: candidate.sessionClosed ?? false,
    foundCriterionIds: candidate.foundCriterionIds ?? [],
  };
}

function getMessageRole(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const candidate = message as {
    role?: string;
    type?: string;
    _getType?: () => string;
  };

  if (typeof candidate._getType === "function") {
    return candidate._getType();
  }

  if (typeof candidate.role === "string") {
    return candidate.role;
  }

  if (typeof candidate.type === "string") {
    return candidate.type;
  }

  return null;
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (
          entry &&
          typeof entry === "object" &&
          "text" in entry &&
          typeof entry.text === "string"
        ) {
          return entry.text;
        }

        return "";
      })
      .filter((text) => text.trim().length > 0)
      .join("\n");
  }

  return "";
}

export function getLatestUserMessage(messages: ChatHistory): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index] as {
      content?: unknown;
    };

    const role = getMessageRole(messages[index]);
    if (role !== "human" && role !== "user") {
      continue;
    }

    const text = contentToText(candidate.content).trim();
    if (text.length > 0) {
      return text;
    }
  }

  return null;
}

export function isKickoffMessage(message: string): boolean {
  return /(start\s+(the\s+)?oops\s+report|begin\s+roast|initial\s+roast|kick\s*off|roast\s+this\s+map)/i.test(
    message,
  );
}

export function isEndSessionMessage(message: string): boolean {
  return /(i\s*am\s*done\s*roasting|i'?m\s*done\s*roasting|done\s*roasting|end\s*game|quit\s*roasting|stop\s*roasting)/i.test(
    message,
  );
}

export function escapePromptTemplateBraces(text: string): string {
  return text.replace(/\{/g, "{{").replace(/\}/g, "}}");
}
