# Build your own agentic map

You don't need the Moon to use this pattern. You need a map, an assistant, and
tools that connect what people say to actions on your data.

## Who does what

| Part | Responsibility |
| --- | --- |
| Next.js and React | Render the page in the browser and own the layout |
| `arcgis-scene` | Display a 3D map and expose its view |
| `arcgis-assistant` | Sign-in, the conversation, and calling the agent |
| `SkillAgent` | Pick a skill, then tools, from their descriptions |
| Your tools | Validate input, query data, call map actions, return facts |
| Your cards | Show a tool's results in the chat, with buttons |

The agent can't do anything in the browser except call the tools registered in
[agent.ts](../src/agent/agent.ts).

## Follow "Take me to Apollo 11"

### 1. The page starts the app

[App.tsx](../src/App.tsx) declares both scenes, the slider, and the assistant in
JSX. The maps come from `createMoonScene()` and `createEarthScene()`, created once
with `useState` and passed to the scenes as `map`. The scene components own their
views and destroy them on unmount.

An effect calls [createMoonApp](../src/map/controller.ts). It waits for both
views, reads the mission and launch-site records, sets the renderer and slider,
and returns `app`: the object with every map action. Once `app` exists, React
renders the agent and the chat cards.

### 2. The agent chooses a tool

[createMoonAgent](../src/agent/agent.ts) registers three skills from
[skills.ts](../src/agent/skills.ts) and the tools from
[tools.ts](../src/agent/tools.ts). A skill is Markdown: guidance plus an
`allowed-tools` list. The `explore` skill covers finding and visiting things.

Before each turn, `runtimeContextLoader` tells the model what the map shows: which
world, the slider's dates, the selection, and what's drawn. That's how follow-ups
like "tell me more about it" resolve.

### 3. Queries find ids; actions take them

The model calls `queryData` with SQL on the hosted missions layer, asking for `id`
and `name` where `name = 'Apollo 11'`. Then it calls `goTo` with
`{ target: { kind: "mission", id: "apollo-11" } }`.

Targets are typed: a mission id, an exact crater name, a place id, a launch-site
id, or the Moon or Earth. Places and launch sites are enums in the schema, so the
model sees the valid ids in the tool description. `goTo` doesn't guess or
fuzzy-match. An unknown id throws an error the model can read and recover from.
When a request is genuinely ambiguous ("Take me to Chang'e"), the model calls
`chooseMission`, which uses the SDK's human-in-the-loop middleware to ask the
user.

### 4. The map acts

`goTo` calls `app.visit(mission)`, which:

1. stops what's going on and travels to the Moon if needed (`prepare`),
2. shows the full timeline and selects the mission: `layerView.highlight()`, a label, and no filter,
3. flies there with `view.goTo({ target, scale, tilt })`,
4. stands the lunar module at the site ([extras/siteModel.ts](../src/extras/siteModel.ts)).

Card buttons call the same `app.visit`, so a click and a chat request behave the
same way.

### 5. The tool returns two things

**For the user**, `showCard("mission-card", { id }, config)` sends card data
through the SDK. [Cards.tsx](../src/cards/Cards.tsx) listens for the assistant's
slot requests and renders the matching React card into each slot. Cards look up
records by id from `app.data`, so the payloads stay small.

**For the model**, the tool returns JSON facts: dates, launch site, days to the
surface, the photo's details. The model writes its reply from those facts.

A card doesn't replace returning facts, and returning facts doesn't create a
card. The camera move runs in the background, so the reply appears while the
camera flies.

## Add a tool

Start with something small and read-only. For example, count the missions shown
at the slider's current date. In `createTools` in [tools.ts](../src/agent/tools.ts):

```ts
const countVisibleMissions = new FunctionTool({
  name: "countVisibleMissions",
  description: "Counts the missions shown at the time slider's current date. Doesn't change the map.",
  inputSchema: z.strictObject({}),
  execute: async () => {
    const end = app.slider.timeExtent?.end?.getTime() ?? Infinity;
    const visible = data.missions.filter((m) => m.arrivalDate <= end);
    return json({ count: visible.length, through: app.slider.timeExtent?.end });
  },
});
```

Then:

1. Add it to the array `createTools` returns. The agent registers every tool in that array.
2. Add `countVisibleMissions` to `allowed-tools` in the `history` skill in
   [skills.ts](../src/agent/skills.ts), with a line saying when to use it.
3. Ask the assistant: "How many missions are on the map right now?"

Only add a card if it helps the user. Many tools need only their return value.

## Build a smaller version

For a new app, start with:

1. A client-only React component with one `arcgis-map` or `arcgis-scene` and one `arcgis-assistant`.
2. Portal configuration before the components load ([config.ts](../src/config.ts)), plus the CSS imports in [styles.css](../src/styles.css).
3. One FeatureLayer and one map action, such as `goToFeature`.
4. One `FunctionTool` with a narrow schema and a clear description.
5. A `SkillAgent` with one skill that allows the tool.

Copy the pattern, not the Moon. [scale.ts](../src/map/scale.ts) exists only
because the lunar services draw the Moon on an Earth-sized globe. An Earth map
doesn't need it.
