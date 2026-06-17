import { createFunctionTool, createLLMAgent, createSchema } from "@arcgis/ai-components/agent-utils/index.js";
import { createHumanInTheLoopToolMiddleware } from "@arcgis/ai-components/agent-utils/middlewares/humanInTheLoop.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import {
  getOptionalString,
  getScheduledFixtureLookupLabel,
  queryScheduledFixturesFromInput,
} from "../support/utils.js";
import type {
  TicketOrderConfirmationData,
  TicketPriceCardData,
  TicketPriceTier,
  TicketTier,
  WorldCupMapContext,
} from "../support/utils.js";

type TicketPriceInput = Record<string, unknown>;

type PurchaseTicketsInput = Record<string, unknown>;

type AgentConfig = {
  configurable?: {
    context?: unknown;
  };
};

const getWorldCupMapContext = (config?: AgentConfig): WorldCupMapContext => {
  const context = config?.configurable?.context;

  if (!context || typeof context !== "object" || !("mapView" in context)) {
    throw new Error("tickets-agent requires WorldCupMapContext from arcgis-assistant-agent context.");
  }

  return context as WorldCupMapContext;
};

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
  config?: AgentConfig,
): Promise<TicketPriceCardData["fixture"] | undefined> =>
  (await queryScheduledFixturesFromInput(getWorldCupMapContext(config).mapView, input))[0];

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
  execute: async (input: TicketPriceInput, config?: AgentConfig): Promise<string | void> => {
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
  execute: async (input: PurchaseTicketsInput, config?: AgentConfig): Promise<string> => {
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
  prompt: String.raw`
You are the World Cup Companion tickets agent. Tickets and purchases are mocked for demo purposes.

Use the available tools to look up ticket prices and create mocked ticket-order confirmations. Do not invent fixtures, prices, availability, payment status, or inventory that is not returned by the tools.

Before calling any tool:
1. Extract the user's intent.
2. Extract fixture details from the prompt, such as team, opponent, city, date, stage, or matchId when available.
3. Extract ticket tier and quantity when the prompt is a purchase request.

Rules:
- For ticket price or availability prompts, call get_ticket_prices with the extracted fixture details.
- For purchase prompts, use the latest relevant fixture from the conversation when the user follows up. If the latest relevant fixture is unclear, ask which match before calling purchase_tickets.
- For purchase prompts, call purchase_tickets with fixture details, tier, and quantity.
- Never imply real payment, real inventory, or external calls.
`,
});

export const agent = rootAgent.registration;
