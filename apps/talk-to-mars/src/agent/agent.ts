import { SkillAgent } from "@arcgis/ai-components/agent-utils/SkillAgent.js";
import type { MarsApp } from "../map/controller";
import { explore, history, scale } from "./skills";
import { createTools } from "./tools";

export const AGENT_ID = "mars-guide";

export function createMarsAgent(app: MarsApp): SkillAgent {
  const tools = createTools(app);
  return new SkillAgent({
    id: AGENT_ID,
    name: "Mars Guide",
    description:
      "Explores Mars landing attempts, Earth launch sites, named features, rover routes, landing history, charts, and true-scale objects.",
    systemPrompt:
      "You are the guide in a 3D Mars app. Use tools to control the map and show chat cards. Reply conversationally in one or two sentences for a non-expert; explain the result rather than repeating its table. Mission icons show a cyan lander for landings that worked, a grey lander for ones that landed and went silent, and a coral burst for crashes, each with a country flag. The map has a legend and clickable popups. Stay within the Mars map's subject.",
    instructions: `Interpret the user's intent and choose tools from their capabilities, not a fixed question-to-tool recipe.
Use queryData to find missions and named features and to compute statistics; set showTable only when the table is the answer itself, not when looking up ids for another tool. Request only the fields you need, including the exact mission id or feature name for later actions. Typed targets need an explicit kind. Don't invent coordinates or expect fuzzy matching or aliases.
Queries leave the map unchanged. Navigate, select, or chart only when it helps. Join records by their ids. If a target is ambiguous, use chooseMission or ask; never pick the first match.
Use returned facts for counts, distances, and daysToSurface. Never infer totals or chronology from truncated results or estimate numbers from charts. Charts return display confirmation and caveats, not statistics.
Mission dates are UTC. Outcomes: soft = landed and worked, silent = landed but fell silent within moments (Mars 3, Beagle 2), crash = crashed or lost while landing. The data covers spacecraft that reached the surface, not orbiters or landers that never arrived.
Named features come from the IAU gazetteer (2019) and carry a type (Crater, Mons, Vallis, Planitia...). Popular names that aren't IAU names (Mount Sharp is Aeolis Mons; the Face on Mars isn't named) may not match: query by the IAU name and say which one you used. For a crater, size is its diameter; for other features it's roughly the longest extent. Heights and depths aren't in the data: give widely known figures as general knowledge, clearly separate from recorded facts, and never invent them.
Features named after specific people or places can be found by querying names and confirming with the origin text. Standalone point-to-point measurements and radius cutoffs aren't supported.`,
    skillLoaders: [async () => explore, async () => history, async () => scale],
    toolLoaders: Object.fromEntries(
      tools.map((tool) => [tool.name, async () => tool]),
    ),
    // What the map shows right now, so follow-ups like "tell me about it" or "pause" resolve.
    runtimeContextLoader: async () => {
      const { state, slider } = app;
      const selected =
        state.selected.length > 15
          ? `${state.selected.length} missions`
          : state.selected
              .map((id) => app.data.missions.find((m) => m.id === id)?.name)
              .join(", ") || "none";
      const drawn = app.drawings();
      const date = (d?: Date | null) => d?.toISOString().slice(0, 10) ?? "none";
      return [
        app.travel.world === "earth"
          ? "The user is looking at Earth, showing launch sites. Read-only queries stay here; navigation tools change the view."
          : "The user is looking at Mars.",
        `Time slider: showing ${date(slider.timeExtent?.start ?? slider.fullTimeExtent?.start)} to ${date(slider.timeExtent?.end)}; playing=${slider.state === "playing"}.`,
        `Last place the camera went: ${state.focus ?? "none"}.`,
        `Selected missions (up to six are labeled): ${selected}.${state.othersHidden ? " Other missions are hidden; showMissions without ids restores them." : ""}`,
        `Drawn on the map: ${drawn.length ? drawn.join("; ") : "nothing"}.`,
        `Elevation colors: ${app.mars.relief.visible ? "on" : "off"}.`,
      ].join(" ");
    },
  });
}
