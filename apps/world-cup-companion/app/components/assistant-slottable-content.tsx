import { type UXSuggestion } from "@arcgis/ai-components/utils/index.js";

import { type TeamMatchFeature, TeamMatchesCard } from "./team-matches-card";
import { ReceiptCard, type ReceiptCardData } from "./receipt-card";
import { TicketsCard, type TicketsCardData } from "./tickets-card";
import { WeatherCard, type WeatherCardData } from "./weather-card";

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

const isWeatherCardData = (value: unknown): value is WeatherCardData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.city === "string" &&
    typeof data.condition === "string" &&
    typeof data.date === "string" &&
    typeof data.high === "number" &&
    typeof data.low === "number" &&
    typeof data.precipitationChance === "number" &&
    typeof data.provider === "string" &&
    typeof data.windMph === "number"
  );
};

const isTicketsCardData = (value: unknown): value is TicketsCardData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;

  return Array.isArray(data.tiers) && !!data.fixture;
};

const isReceiptCardData = (value: unknown): value is ReceiptCardData => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.orderId === "string" &&
    typeof data.quantity === "number" &&
    typeof data.tier === "string" &&
    typeof data.orderTotal === "number" &&
    !!data.fixture
  );
};

export function AssistantSlottableContent({
  slottableRequests,
}: AssistantSlottableContentProps) {
  return slottableRequests.map((request) => {
    if (request?.data?.block?.type === "team-matches") {
      return (
        <TeamMatchesCard
          key={request.slotName}
          slotName={request.slotName}
          data={request.data.block.data}
        />
      );
    }

    if (request?.data?.block?.type === "weather-card") {
      if (!isWeatherCardData(request.data.block.data)) {
        return null;
      }

      return (
        <WeatherCard
          key={request.slotName}
          slotName={request.slotName}
          data={request.data.block.data}
        />
      );
    }

    if (request?.data?.block?.type === "tickets-card") {
      if (!isTicketsCardData(request.data.block.data)) {
        return null;
      }

      return (
        <TicketsCard
          key={request.slotName}
          slotName={request.slotName}
          data={request.data.block.data}
        />
      );
    }

    if (request?.data?.block?.type === "receipt-card") {
      if (!isReceiptCardData(request.data.block.data)) {
        return null;
      }

      return (
        <ReceiptCard
          key={request.slotName}
          slotName={request.slotName}
          data={request.data.block.data}
        />
      );
    }

    return null;
  });
}