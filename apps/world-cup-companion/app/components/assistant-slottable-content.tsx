import {
  blockTypes,
  type TeamMatchesCardData,
  type TicketOrderConfirmationData,
  type TicketPriceCardData,
  type WeatherCardData,
} from "../support/types";

import { ReceiptCard } from "./receipt-card";
import { TeamMatchesCard } from "./team-matches-card";
import { TicketsCard } from "./tickets-card";
import { WeatherCard } from "./weather-card";

export type AssistantSlottableRequestDetail =
  HTMLArcgisAssistantElement["arcgisSlottableRequest"]["detail"];

type AssistantSlottableContentProps = {
  slottableRequests: AssistantSlottableRequestDetail[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const isTeamMatchesCardData = (
  value: unknown,
): value is TeamMatchesCardData =>
  isRecord(value) && Array.isArray(value.features);

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
    (typeof value.precipitationChance === "number" ||
      typeof value.precipitationInches === "number") &&
    typeof value.provider === "string" &&
    typeof value.windMph === "number"
  );
};

const isTicketPriceCardData = (
  value: unknown,
): value is TicketPriceCardData => {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.tiers) && isRecord(value.fixture);
};

const isTicketOrderConfirmationData = (
  value: unknown,
): value is TicketOrderConfirmationData => {
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
  return slottableRequests.map(({ data, slotName }) => {
    const block = data?.block;

    switch (block?.type) {
      case blockTypes.teamMatches:
        return isTeamMatchesCardData(block.data) ? (
          <TeamMatchesCard key={slotName} slotName={slotName} data={block.data} />
        ) : null;
      case blockTypes.weather:
        return isWeatherCardData(block.data) ? (
          <WeatherCard key={slotName} slotName={slotName} data={block.data} />
        ) : null;
      case blockTypes.tickets:
        return isTicketPriceCardData(block.data) ? (
          <TicketsCard key={slotName} slotName={slotName} data={block.data} />
        ) : null;
      case blockTypes.receipt:
        return isTicketOrderConfirmationData(block.data) ? (
          <ReceiptCard key={slotName} slotName={slotName} data={block.data} />
        ) : null;
      default:
        return null;
    }
  });
}
