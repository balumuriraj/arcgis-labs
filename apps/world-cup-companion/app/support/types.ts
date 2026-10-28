import type { PointProperties } from "@arcgis/core/geometry/Point.js";

export type WorldCupFixture = {
  city: string;
  date: string;
  matchId: string;
  opponent: string;
  stage: string;
  team: string;
};

export type TicketTier = "Category 1" | "Category 2" | "Category 3";

export type TicketPriceTier = {
  availability: "High" | "Limited" | "Medium";
  price: number;
  tier: TicketTier;
};

export type TicketPriceCardData = {
  fixture: WorldCupFixture;
  tiers: TicketPriceTier[];
};

export type TicketOrderConfirmationData = {
  fixture: WorldCupFixture;
  orderId: string;
  orderTotal: number;
  quantity: number;
  tier: TicketTier;
};

export type WeatherCardData = {
  city: string;
  condition: string;
  date: string;
  high: number;
  low: number;
  precipitationChance?: number;
  precipitationInches?: number;
  provider: string;
  windMph: number;
};

export type TeamMatchFeature = {
  attributes: Record<string, unknown>;
  geometry?: PointProperties;
};

export type TeamMatchesCardData = {
  features: TeamMatchFeature[];
  teamName: string;
};

// UX suggestion types shared by the agents that emit them and the cards that render them.
export const blockTypes = {
  receipt: "receipt-card",
  teamMatches: "team-matches",
  tickets: "tickets-card",
  weather: "weather-card",
} as const;
