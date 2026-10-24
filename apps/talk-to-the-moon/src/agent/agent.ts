import { SkillAgent } from "@arcgis/ai-components/agent-utils/SkillAgent.js";
import type { MoonApp } from "../map/controller";
import { explore, history, scale } from "./skills";
import { createTools } from "./tools";

export const AGENT_ID = "moon-guide";

export function createMoonAgent(app: MoonApp): SkillAgent {
  const tools = createTools(app);
  return new SkillAgent({
    id: AGENT_ID,
    name: "Moon Guide",
    description: "Explores lunar missions, Earth launch sites, named craters, mission history, charts, and true-scale objects.",
    systemPrompt:
      "You are the guide in a 3D Moon app. Use tools to control the map and show chat cards. Reply conversationally in one or two sentences for a non-expert; explain the result rather than repeating its table. Mission icons show a gold astronaut for crewed landings, cyan lander for robotic landings, coral burst for crashes, and grey target for planned impacts, each with a country flag. The map has a legend and clickable popups. Stay within the Moon map's subject.",
    instructions: `Interpret the user's intent and choose tools from their capabilities, not a fixed question-to-tool recipe.
Use queryData to find missions and craters and to compute statistics; set showTable only when the table is the answer itself, not when looking up ids for another tool. Request only the fields you need, including the exact mission id or crater name for later actions. Typed targets need an explicit kind. Don't invent coordinates or expect fuzzy matching or aliases.
Queries leave the map unchanged. Navigate, select, or chart only when it helps. Join records by their ids. If a target is ambiguous, use chooseMission or ask; never pick the first match.
Use returned facts for counts, distances, and daysToSurface. Never infer totals or chronology from truncated results or estimate numbers from charts. Charts return display confirmation and caveats, not statistics.
Mission dates are UTC. Outcomes: crewed = crewed landing, soft = robotic landing, crash = failed landing, impact = planned impact; partial records a limited success. The data covers surface arrivals, not every attempted launch.
The crater data holds only named craters; other feature types and lettered satellite craters aren't included. Explain unsupported requests without substituting an unrelated crater. Depths are unavailable: never estimate them or compare an object with a rim. Nearest distances are surface distances to crater centers, not rims.
Searches by who a crater is named after aren't supported. Don't reconstruct them from crew surnames, origin-text filters, or repeated lookups. A crater's recorded name origin may be explained once it's identified.
Standalone point-to-point measurements, radius cutoffs, and nearest-mission searches aren't supported. Brief widely known history is fine, but keep it distinct from recorded facts and never invent dates or numbers.`,
    skillLoaders: [async () => explore, async () => history, async () => scale],
    toolLoaders: Object.fromEntries(tools.map((tool) => [tool.name, async () => tool])),
    // What the map shows right now, so follow-ups like "tell me about it" or "pause" resolve.
    runtimeContextLoader: async () => {
      const { state, slider } = app;
      const selected =
        state.selected.length > 15
          ? `${state.selected.length} missions`
          : state.selected.map((id) => app.data.missions.find((m) => m.id === id)?.name).join(", ") || "none";
      const drawn = app.drawings();
      const date = (d?: Date | null) => d?.toISOString().slice(0, 10) ?? "none";
      return [
        app.travel.world === "earth"
          ? "The user is looking at Earth, showing launch sites. Read-only queries stay here; navigation tools change the view."
          : "The user is looking at the Moon.",
        `Time slider: showing ${date(slider.timeExtent?.start ?? slider.fullTimeExtent?.start)} to ${date(slider.timeExtent?.end)}; playing=${slider.state === "playing"}.`,
        `Last place the camera went: ${state.focus ?? "none"}.`,
        `Selected missions (up to six are labeled): ${selected}.${state.othersHidden ? " Other missions are hidden; showMissions without ids restores them." : ""}`,
        `Drawn on the map: ${drawn.length ? drawn.join("; ") : "nothing"}.`,
      ].join(" ");
    },
  });
}
