import { type UXSuggestion } from "@arcgis/ai-components/utils/index.js";
import type { WeatherCardData } from "../support/utils";

import { type TeamMatchFeature, TeamMatchesCard } from "./team-matches-card";
import { ReceiptCard, type ReceiptCardData } from "./receipt-card";
import { TicketsCard, type TicketsCardData } from "./tickets-card";
import { WeatherCard } from "./weather-card";

type TeamMatchesBlock = {
  type: "team-matches";
  data?: {
    features?: TeamMatchFeature[];
  };
};

type WeatherCardBlock = {
  type: "weather-card";
  data?: WeatherCardData;
};

type TicketsCardBlock = {
  type: "tickets-card";
  data?: TicketsCardData;
};

type ReceiptCardBlock = {
  type: "receipt-card";
  data?: ReceiptCardData;
};

type AssistantSlottableRequestData = {
  block?:
    | UXSuggestion
    | TeamMatchesBlock
    | WeatherCardBlock
    | TicketsCardBlock
    | ReceiptCardBlock;
  index?: number;
  message: unknown;
};

export type AssistantSlottableRequestDetail = {
  data?: AssistantSlottableRequestData;
  name: "block" | "message";
  slotName: string;
};

type AssistantSlottableContentProps = {
  slottableRequests: AssistantSlottableRequestDetail[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const isWeatherCardData = (value: unknown): value is WeatherCardData => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.city === "string" &&
    typeof value.condition === "string" &&
    typeof value.date === "string" &&
    typeof value.high === "number" &&
    typeof value.low === "number" &&
    typeof value.precipitationChance === "number" &&
    typeof value.provider === "string" &&
    typeof value.windMph === "number"
  );
};

const isTicketsCardData = (value: unknown): value is TicketsCardData => {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.tiers) && isRecord(value.fixture);
};

const isReceiptCardData = (value: unknown): value is ReceiptCardData => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.orderId === "string" &&
    typeof value.quantity === "number" &&
    typeof value.tier === "string" &&
    typeof value.orderTotal === "number" &&
    isRecord(value.fixture)
  );
};

export function AssistantSlottableContent({
  slottableRequests,
}: AssistantSlottableContentProps) {
  return slottableRequests.map((request) => {
    const block = request.data?.block;

    if (!block) {
      return null;
    }

    if (block.type === "team-matches") {
      return (
        <TeamMatchesCard
          key={request.slotName}
          slotName={request.slotName}
          data={block.data}
        />
      );
    }

    if (block.type === "weather-card") {
      if (!isWeatherCardData(block.data)) {
        return null;
      }

      return (
        <WeatherCard
          key={request.slotName}
          slotName={request.slotName}
          data={block.data}
        />
      );
    }

    if (block.type === "tickets-card") {
      if (!isTicketsCardData(block.data)) {
        return null;
      }

      return (
        <TicketsCard
          key={request.slotName}
          slotName={request.slotName}
          data={block.data}
        />
      );
    }

    if (block.type === "receipt-card") {
      if (!isReceiptCardData(block.data)) {
        return null;
      }

      return (
        <ReceiptCard
          key={request.slotName}
          slotName={request.slotName}
          data={block.data}
        />
      );
    }

    return null;
  });
}