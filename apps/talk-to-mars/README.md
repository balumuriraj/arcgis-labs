# Talk to Mars

A Next.js example of an AI assistant that operates an ArcGIS 3D map of Mars. Ask
"Where has Perseverance driven?" and the assistant flies from Earth to Mars, draws the
rover's route from NASA's traverse map, and shows how far it has gone.

It's the sibling of [Talk to the Moon](../talk-to-the-moon/) and is built the same way:
the ArcGIS Maps SDK for JavaScript components (`arcgis-scene`, `arcgis-time-slider`,
`arcgis-chart`, `arcgis-assistant`), Calcite, and a `SkillAgent` with 13 tools. There's
no AI backend of its own.

## Run it

From the repository root, with Node.js 20.9+ and pnpm:

```bash
pnpm install
pnpm --filter talk-to-mars dev
```

Open <http://localhost:3007> and sign in through the assistant. The AI portal is
**<https://devext.arcgis.com>** by default; your account needs access to its AI
service. The map data is public and needs no sign-in.

To change the portal, copy [.env.example](./.env.example) to `.env.local` and set
`NEXT_PUBLIC_PORTAL_URL`. `NEXT_PUBLIC_*` values are visible in the browser, so
never put secrets in them.

Try **"Where has Perseverance driven?"**, **"Show every landing attempt"**,
**"Show me the highs and lows of Mars"** and **"Stand Mount Everest next to Olympus Mons"**.

## How it differs from the Moon app

- **Mars is drawn in its own coordinate system.** Esri's Mars imagery and elevation are
  published in GCS_Mars_2000_Sphere (wkid 104971), so the scene uses it directly. Heights,
  distances, and camera scales are real Martian meters; there's no Earth-sized display
  globe to convert to (compare the Moon app's `scale.ts`).
- **No hosted layers of its own.** The landing attempts and launch sites are small and
  live in [records.ts](./src/records.ts); named features come from Esri's public Mars
  nomenclature service and are normalized into a client-side layer at startup.
- **Named features, not just craters.** The 2019 IAU gazetteer's 1,879 names: craters,
  montes, valles, plains, and more, each with a `type`.
- **Rover routes.** `showRoute` draws Perseverance's and Curiosity's traverses, built
  from the mission teams' published maps by [scripts/traverses.mjs](./scripts/traverses.mjs).
- **No extras yet.** The Moon app's site models, orbital photos, and lander flight
  aren't ported.

## Read the code in this order

| File                                                                          | What to look for                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [App.tsx](./src/App.tsx)                                                      | The whole layout in JSX: two scenes, the slider, the assistant, and the agent                        |
| [map/controller.ts](./src/map/controller.ts)                                  | Startup, and the map actions that tools and cards share (`visit`, `select`, `frame`, `showTraverse`) |
| [agent/tools.ts](./src/agent/tools.ts)                                        | The tools. Start with `goTo`                                                                         |
| [agent/agent.ts](./src/agent/agent.ts) and [skills.ts](./src/agent/skills.ts) | Instructions, skills, and the live context the model sees                                            |
| [cards/Cards.tsx](./src/cards/Cards.tsx)                                      | How a tool's card data becomes a React card in the chat                                              |
| [data.ts](./src/data.ts) and [records.ts](./src/records.ts)                   | Types, lookups, and the mission records                                                              |

## Layout

```text
app/                  Next.js entry: renders src/App.tsx in the browser only
src/
  App.tsx             Layout and startup
  config.ts           Portal and API key, set before any component loads
  register.ts         The SDK and Calcite components the app uses
  data.ts             Types, feature loading and queries, static references
  records.ts          Landing attempts and launch sites
  map/
    mars.ts           Mars map, mission and feature layers, renderer, popups
    earth.ts          Earth map and launch sites
    scale.ts          Mars coordinates, distances, and circles
    graphics.ts       Feature marks and true-scale objects
    traverses.ts      Rover routes
    travel.ts         The Earth-to-Mars transition
    controller.ts     Startup plus the map actions
  agent/              SkillAgent, skills, tools
  cards/              Chat cards and charts
public/               Icons, flags, and data/traverses.json
scripts/              Test runner and the traverse builder
```

Data sources, terms, and what still needs checking are in [docs/reference.md](./docs/reference.md).
