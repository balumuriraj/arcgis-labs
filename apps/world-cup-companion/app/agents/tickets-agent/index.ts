import { createFunctionTool, createLLMAgent, createSchema } from "@arcgis/ai-components/agent-utils/index.js";
import { createHumanInTheLoopToolMiddleware } from "@arcgis/ai-components/agent-utils/middlewares/humanInTheLoop.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import {
  type AgentConfigWithContext,
  getWorldCupMapContextFromAgentConfig,
  getOptionalString,
  getScheduledFixtureLookupLabel,
  queryScheduledFixturesFromInput,
  type TicketOrderConfirmationData,
  type TicketPriceCardData,
  type TicketPriceTier,
  type TicketTier,
} from "../../support/utils";
import prompt from "./prompt.md";

type TicketPriceInput = Record<string, unknown>;

type PurchaseTicketsInput = Record<string, unknown>;

const getRequiredNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];

  if (typeof value !== "number") {
    throw new Error(`Expected ${key} to be a number.`);
  }

  return value;
};

const getRequiredTicketTier = (input: Record<string, unknown>): TicketTier => {
  const value = getOptionalString(input.tier);

  if (value !== "Category 1" && value !== "Category 2" && value !== "Category 3") {
    throw new Error("Expected tier to be Category 1, Category 2, or Category 3.");
  }

  return value;
};

const resolveFixture = async (
  input: Record<string, unknown>,
  config?: AgentConfigWithContext,
): Promise<TicketPriceCardData["fixture"] | undefined> =>
  (await queryScheduledFixturesFromInput(getWorldCupMapContextFromAgentConfig(config, "tickets-agent").mapView, input))[0];

const fixtureLookupSchema = {
  city: { type: "string", description: "Optional fixture city extracted from the user prompt." },
  date: { type: "string", description: "Optional fixture date extracted from the user prompt." },
  matchId: { type: "string", description: "Optional fixture matchId from prior tool results or context." },
  opponent: { type: "string", description: "Optional opposing team extracted from the user prompt." },
  stage: { type: "string", description: "Optional competition stage extracted from the user prompt." },
  team: { type: "string", description: "Optional team extracted from the user prompt." },
} as const;

const ticketPriceSchema = await createSchema({
  ...fixtureLookupSchema,
});

const purchaseTicketsSchema = await createSchema({
  ...fixtureLookupSchema,
  quantity: { type: "number", required: true, description: "Number of tickets to mock-purchase." },
  tier: {
    type: "string",
    enum: ["Category 1", "Category 2", "Category 3"],
    required: true,
    description: "Ticket tier to mock-purchase.",
  },
});

const ticketTiers: TicketPriceTier[] = [
  { availability: "Limited", price: 650, tier: "Category 1" },
  { availability: "Medium", price: 375, tier: "Category 2" },
  { availability: "High", price: 190, tier: "Category 3" },
];

const getTicketPrices = await createFunctionTool({
  name: "get_ticket_prices",
  description:
    "Gets mocked ticket price tiers for a requested World Cup fixture and emits a ticket-price custom UI card. Use this for ticket price and availability prompts.",
  inputSchema: ticketPriceSchema,
  resultMode: "terminal",
  execute: async (input: TicketPriceInput, config?: AgentConfigWithContext): Promise<string | void> => {
    const fixture = await resolveFixture(input, config);

    if (!fixture) {
      return `No fixture matched ${getScheduledFixtureLookupLabel(input)}.`;
    }

    await sendUXSuggestion(
      {
        type: "tickets-card",
        data: {
          fixture,
          tiers: ticketTiers,
        } satisfies TicketPriceCardData,
      },
      config,
    );

    return `Here are the mocked ticket prices and availability for ${getScheduledFixtureLookupLabel(input)}.`;
  },
});

const purchaseTickets = await createFunctionTool({
  name: "purchase_tickets",
  description:
    "Creates a mocked ticket order confirmation after user approval. This never charges money and never calls external payment services.",
  inputSchema: purchaseTicketsSchema,
  middlewares: [
    createHumanInTheLoopToolMiddleware<PurchaseTicketsInput>({
      interrupt: ({ args }) => {
        const input = args as Record<string, unknown>;
        const quantity = typeof input.quantity === "number" ? input.quantity : undefined;
        const tier = typeof input.tier === "string" ? input.tier : undefined;
        return {
          kind: "booleanChoice",
          message: `Confirm mocked purchase of ${quantity ?? "the requested"} ${tier ?? "selected"} ticket${quantity === 1 ? "" : "s"} for ${getScheduledFixtureLookupLabel(input)}?`,
          metadata: {
            noExternalCalls: true,
            payment: "mocked",
          },
        };
      },
    }),
  ],
  resultMode: "terminal",
  execute: async (input: PurchaseTicketsInput, config?: AgentConfigWithContext): Promise<string> => {
    const quantity = getRequiredNumber(input, "quantity");
    const tier = getRequiredTicketTier(input);
    const fixture = await resolveFixture(input, config);

    if (!fixture) {
      return `No fixture matched ${getScheduledFixtureLookupLabel(input)}. No order was created.`;
    }

    const tierPrice = ticketTiers.find((ticketTier) => ticketTier.tier === tier)?.price ?? 0;
    const orderTotal = tierPrice * quantity;
    const orderId = `MOCK-${fixture.matchId.toUpperCase()}-${tier.replace(/[^0-9]/gu, "")}-${quantity}`;
    const confirmationData: TicketOrderConfirmationData = {
      orderId,
      fixture,
      quantity,
      tier,
      orderTotal,
    };
    const confirmationPayload: Record<string, unknown> = {
      orderId: confirmationData.orderId,
      fixture: confirmationData.fixture as unknown as Record<string, unknown>,
      quantity: confirmationData.quantity,
      tier: confirmationData.tier,
      orderTotal: confirmationData.orderTotal,
    };

    await sendUXSuggestion(
      {
        type: "receipt-card",
        data: confirmationPayload,
      },
      config,
    );

    return "Mock order confirmed.";
  },
});

const rootAgent = await createLLMAgent({
  name: "World Cup Tickets Agent",
  description:
    "Use this agent for mocked World Cup ticket prices, categories, availability, and ticket purchase confirmation. It extracts fixture details from the prompt and calls the ticket tools with those values.",
  tools: [getTicketPrices, purchaseTickets],
  prompt,
});

export const agent = rootAgent.registration;