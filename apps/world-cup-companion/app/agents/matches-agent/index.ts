import { createFunctionTool, createLLMAgent, createSchema } from "@arcgis/ai-components/agent-utils/index.js";
import type { ResourceHandle } from "@arcgis/core/core/Handles.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import {
  type AgentConfigWithContext,
  getWorldCupMapContextFromAgentConfig,
  getOptionalString,
  queryScheduledMatches,
} from "../../support/utils";
import prompt from "./prompt.md";

// A handler can be used to remove any previous highlight when applying a new one
let highlight: ResourceHandle | null = null;

type FindMatchesInput = Record<string, unknown>;

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
  execute: async (input: FindMatchesInput, config?: AgentConfigWithContext): Promise<string> => {
    const context = getWorldCupMapContextFromAgentConfig(config, "matches-agent");
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
  prompt,
});

export const agent = rootAgent.registration;