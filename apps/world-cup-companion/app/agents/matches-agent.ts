import { createFunctionTool, createLLMAgent, createSchema } from "@arcgis/ai-components/agent-utils/index.js";
import type { WorldCupMapContext } from "../support/utils.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import { getOptionalString, queryScheduledMatches } from "../support/utils.js";

// A handler can be used to remove any previous highlight when applying a new one
let highlight: ResourceHandle | null = null;

type FindMatchesInput = Record<string, unknown>;

type AgentConfig = {
  configurable?: {
    context?: unknown;
  };
};

const getWorldCupMapContext = (config?: AgentConfig): WorldCupMapContext => {
  const context = config?.configurable?.context;

  if (!context || typeof context !== "object" || !("mapView" in context)) {
    throw new Error("matches-agent requires WorldCupMapContext from arcgis-assistant-agent context.");
  }

  return context as WorldCupMapContext;
};

const findMatchesSchema = await createSchema({
  city: { type: "string", description: "Optional city or location mentioned in the user prompt." },
  date: {
    type: "string",
    description:
      "Optional match date mentioned in the user prompt. Format: YYYY-MM-DD. If user prompt includes a relative date (e.g., 'this month', 'next week', 'weekend'), extract the specific date that matches the intent.",
  },
  stage: {
    type: "string",
    description:
      "Optional competition stage mentioned in the user prompt. enums: Group Stage, Round of 32, Round of 16, Quarterfinals, Semifinals, 3rd Place, Final",
  },
  teamName: {
    type: "string",
    required: true,
    description: "Team name extracted from the user prompt.",
  },
});

const findMatches = await createFunctionTool({
  name: "find_matches",
  description:
    "Finds matches for a requested team from the live map layer, highlights the matching features, and returns a match summary.",
  inputSchema: findMatchesSchema,
  resultMode: "terminal",
  execute: async (input: FindMatchesInput, config?: AgentConfig): Promise<string> => {
    const context = getWorldCupMapContext(config);
    console.log("find_matches input: ", input, context);

    const teamName = getOptionalString(input.teamName);

    if (!teamName) {
      throw new Error("teamName is required and must be a non-empty string.");
    }

    const mapView = context.mapView;
    const { features, layer } = await queryScheduledMatches(mapView, {
      city: getOptionalString(input.city),
      date: getOptionalString(input.date),
      stage: getOptionalString(input.stage),
      teamName,
    });

    if (!layer) {
      return "Matches layer not found on the map. Cannot find matches or highlight venues without the layer.";
    }

    if (!features.length) {
      return `No matches found for ${teamName}.`;
    }

    await mapView.goTo(features);
    const layerView = await mapView?.whenLayerView(layer);

    if (layerView) {
      highlight?.remove();
      highlight = layerView.highlight(features);
    }

    try {
      await sendUXSuggestion(
        {
          type: "team-matches",
          data: {
            teamName,
            features: features.map((feature) => feature.toJSON()),
          },
        },
        config,
      );
    } catch (error) {
      console.error("Error sending UX suggestion: ", error);
    }

    return `${teamName} plays ${features.length} matches. Highlighted them on the map.`;
  },
});

const rootAgent = await createLLMAgent({
  name: "World Cup Matches Agent",
  description:
    "Use this agent for World Cup match prompts, fixture lists, dates, cities, stages, and requests to show or highlight match venues on the map. It extracts the requested team from the prompt and queries the live map layer for matching features.",
  tools: [findMatches],
  prompt: String.raw`
You are the World Cup Companion matches agent.

Use the available tools to query the live map layer. Do not invent matches, teams, dates, venues, stages, or counts that are not returned by the tools.

Before calling any tool:
1. Extract the user's intent.
2. Extract the team name from the user prompt. Normalize possessive forms to the plain team name.
3. Pass the extracted teamName to find_matches using the teamName input field.

For match lookup, fixture list, or map highlight requests:
1. Extract teamName from the prompt.
2. Extract any optional city, date, or stage from the prompt.
3. Call find_matches with teamName and any optional city, date, or stage that was present.
4. Reply with a concise summary based only on the tool result.

When a user asks to show, find, list, zoom to, or highlight a team's matches, call find_matches. The tool queries the map layer, highlights the matching features, and returns the match summary.
`,
});

export const agent = rootAgent.registration;
