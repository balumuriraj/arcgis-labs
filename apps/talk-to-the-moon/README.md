# Talk to the Moon

A Next.js example of an AI assistant that operates an ArcGIS 3D map. Ask
"Take me to Apollo 11" and the assistant finds the mission, flies the camera
there, stands a lunar module at the site, and shows a card in the chat.

It's built from the ArcGIS Maps SDK for JavaScript components (`arcgis-scene`,
`arcgis-time-slider`, `arcgis-chart`, `arcgis-assistant`), Calcite, and a
`SkillAgent` with 11 tools. There's no AI backend of its own.

## Run it

From the repository root, with Node.js 20.9+ and pnpm:

```bash
pnpm install
pnpm --filter talk-to-the-moon dev
```

Open <http://localhost:3006> and sign in through the assistant. The AI portal is
**<https://devext.arcgis.com>** by default; your account needs access to its AI
service. The map data is public and needs no sign-in.

To change the portal, copy [.env.example](./.env.example) to `.env.local` and set
`NEXT_PUBLIC_PORTAL_URL`. `NEXT_PUBLIC_*` values are visible in the browser, so
never put secrets in them.

Try **"Take me to Apollo 11"**, **"Show me every place we've landed on the Moon"**,
**"Why did it go quiet?"** and **"Stand the Burj Khalifa in Tycho crater"**.

## How it works

```text
User message
  -> SkillAgent picks a skill, then a FunctionTool
  -> the tool validates its input and looks up real data
  -> the tool calls a map action (app.visit, app.select, ...)
  -> the tool sends a card to the chat and returns facts to the model
  -> the model explains the facts in a sentence or two
```

React renders the page. The SDK components own the scenes, the time slider, the
chat, and the charts. The app's own code is data, tools, map actions, and cards.

## Read the code in this order

| File | What to look for |
| --- | --- |
| [App.tsx](./src/App.tsx) | The whole layout in JSX: two scenes, the slider, the assistant, and the agent |
| [map/controller.ts](./src/map/controller.ts) | Startup, and the map actions that tools and cards share (`visit`, `select`, `frame`) |
| [agent/tools.ts](./src/agent/tools.ts) | The tools. Start with `goTo` |
| [agent/agent.ts](./src/agent/agent.ts) and [skills.ts](./src/agent/skills.ts) | Instructions, skills, and the live context the model sees |
| [cards/Cards.tsx](./src/cards/Cards.tsx) | How a tool's card data becomes a React card in the chat |
| [data.ts](./src/data.ts) | The hosted layers, record types, and lookups |

[docs/build-your-own.md](./docs/build-your-own.md) traces one request through
these files and shows how to add a tool.

## Layout

```text
app/                  Next.js entry: renders src/App.tsx in the browser only
src/
  App.tsx             Layout and startup
  config.ts           Portal and API key, set before any component loads
  register.ts         The SDK and Calcite components the app uses
  data.ts             Layer URLs, types, loadData(), queries, static references
  map/
    moon.ts           Moon map, mission and crater layers, renderer, popups
    earth.ts          Earth map and launch sites
    scale.ts          Lunar units on the Earth-sized display globe; lunar distances
    graphics.ts       Crater marks and true-scale objects
    travel.ts         The Earth-to-Moon transition
    controller.ts     Startup plus the map actions
  agent/              SkillAgent, skills, tools
  cards/              Chat cards and charts
  extras/             Optional: the 3D lander at visited sites, orbital photos, and a lander flight easter egg
public/               Icons, flags, photos, and the lander model
backups/              CSV copies of the hosted layers, for republishing
```

## Choices worth copying

- **Small data is loaded once.** The 51 missions and 10 launch sites are read
  with `layer.queryFeatures()` at startup and used as plain arrays. The 1,575
  craters stay on the service and are queried with SQL when needed.
- **The SDK does the work.** Icons are two `IconSymbol3DLayer`s (outcome disc and
  flag) rather than generated SVG. Selection uses `layerView.highlight()` and
  `FeatureFilter`. The slider takes its range from the layer's `timeInfo`. Chart
  labels come from coded-value domains. Lunar distances use the geodetic
  operators in the Moon's coordinate system.
- **One object for map actions.** Tools and card buttons both call
  `app.visit(mission)`, so a click and a chat request behave the same.
- **Tools return facts, cards show them.** A tool sends a card for the user and
  returns JSON for the model, and the model never makes up numbers.

The Earth intro, the lander model, photos, true-scale objects, and charts are extras on
top of the pattern. For your own app, start with one scene, one assistant, and
one tool.

## Check your changes

From the repository root:

```bash
pnpm --filter talk-to-the-moon test
pnpm --filter talk-to-the-moon check-types
pnpm --filter talk-to-the-moon lint
pnpm --filter talk-to-the-moon build
```

The tests run with the real SDK in Node and cover lunar geometry, record
parsing, the renderer, and chart checks. Sign-in, rendering, and the model's
behavior need a browser.

## Further reading

- [Build your own: trace a request and add a tool](./docs/build-your-own.md)
- [Test prompts: a manual pass through every tool and card](./docs/test-prompts.md)
- [Demo script](./demo.md)
- [Technical guide: how it all works, with answers to likely questions](./docs/technical-guide.md)
- [Data sources and SDK caveats](./docs/reference.md). Check the
  asset terms there before reusing photos or models.

This is a desktop-focused example on the ArcGIS 6.0 prerelease packages.
