# Technical guide

How Talk to the Moon works, for answering technical questions during a demo. For the demo
itself see [demo.md](../demo.md); for configuration and data terms see [reference.md](./reference.md).

## In one line

A **Next.js/React app on the ArcGIS Maps SDK for JavaScript 6.0** (prerelease), where an
**`arcgis-assistant` chat** runs a **`SkillAgent`** that controls a **3D `SceneView`** through
**11 typed tools**. Every fact comes from **three public hosted feature layers**. There's no custom
backend: the language model runs on Esri's AI service through the portal you sign in to.

## 1. Stack

| Layer | What's used |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript. The page renders client-only (`ssr: false`) because the SDK needs the browser |
| Map | `@arcgis/core` 6.0 and `@arcgis/map-components`: two `arcgis-scene` elements (Moon and Earth), `arcgis-time-slider`, legend, popups |
| AI | `@arcgis/ai-components`: `arcgis-assistant` (chat UI and sign-in), `SkillAgent`, `FunctionTool` (built on LangChain) |
| Charts | `@arcgis/charts-components`: native `arcgis-chart` |
| UI | Calcite Design System (shell, panels, cards, tables, lists) |
| Validation | Zod schemas for every tool's input |
| Size | About 2,760 lines in `src/` and `app/`; 8 tests that run the real SDK in Node |

## 2. Architecture

```text
App.tsx            Layout in JSX: Moon scene + slider, Earth scene, assistant, work panel
   │ creates
map/controller.ts  createMoonApp() → `app`: data + every map action (visit, select, frame, flyTo…)
   ▲                      ▲
agent/             cards/
 agent.ts  SkillAgent, instructions, live context      Cards.tsx  renders tool cards into chat slots
 skills.ts 3 skills (explore, history, scale)          charts.ts  presets + custom charts
 tools.ts  11 FunctionTools
   │
map/  moon.ts earth.ts graphics.ts travel.ts scale.ts     extras/ siteModel.ts flight.ts photos.ts
   │
data.ts  layer URLs, types, loadData(), queryCraters(), lookups
```

**Key design point:** one object, `app`, holds every map action. The agent's tools and the
chat-card buttons both call it, so "click a mission" and "take me to Apollo 11" do the same thing.

## 3. Startup

1. `config.ts` sets the portal URL (default `devext.arcgis.com`) before any component loads,
   because the assistant reads the default portal when it loads. `register.ts` then imports only
   the components the app uses.
2. `App.tsx` creates both maps once (`useState(createMoonScene)`) and passes them to
   `<arcgis-scene map={…}>`. The scene components own their views.
3. `createMoonApp()` loads, in parallel: mission and launch-site records (`layer.queryFeatures()`),
   both views (`viewOnReady()`), the crater layer's schema, and the geodetic operators.
4. It then sets the mission renderer from the loaded data, the space environment (stars, virtual
   lighting), the slider from the mission layer's own `timeInfo`, the travel controller, the chart
   table, and object moving.
5. Once `app` exists, React renders `<arcgis-assistant-agent agent={createMoonAgent(app)}>` and the
   card renderer.

## 4. What happens when you ask something

Example: *"Take me to Apollo 11"*

```text
1. The assistant sends the message plus the agent's instructions, its skills, and a live
   "runtime context" (which world is showing, slider dates, selection, what's drawn) to the model.
2. SkillAgent picks a skill ("explore"), which limits which tools the model may use.
3. The model calls queryData { dataset: "missions", where: "name = 'Apollo 11'", outFields: ["id","name"] }
   → an ArcGIS REST query on the hosted layer → returns id "apollo-11" (no table card: it's a lookup).
4. The model calls goTo { target: { kind: "mission", id: "apollo-11" } }
   → Zod validates the input → the tool looks up the record in memory
   → sends a "mission-card" to the chat (sendUXSuggestion)
   → starts app.visit(): travel to the Moon if needed, select + highlight + label, fly in,
     stand the lunar module at the site, slow orbit
   → returns JSON facts (dates, launch site, days to surface, photo metadata) to the model.
5. The model writes a one- or two-sentence reply from those facts.
6. Cards.tsx sees the assistant's slot request and renders the React card into it.
```

**Tools return two things:** a **card** for the user and **JSON facts** for the model. The model
never draws the UI and never states numbers it wasn't given.

## 5. The agent

### SkillAgent and skills

`SkillAgent` (from `@arcgis/ai-components`) is configured with a system prompt, instructions,
**skills**, **tools**, and a **runtime context loader**. A skill is a Markdown instruction set with
an `allowed-tools` list; the agent picks one per request, which narrows the tools and adds domain
guidance.

| Skill | Purpose | Tools |
| --- | --- | --- |
| explore | Find and visit missions, craters, places, launch sites | queryData, goTo, showMissions, chooseMission, showCraters, nearestCraters, showCraterNames, clearMap, showChart, flyLander |
| history | Chronology, gaps, trends, time slider, charts | queryData, setTime, showMissions, goTo, chooseMission, showChart |
| scale | True-scale objects compared with craters | queryData, placeObject, goTo, chooseMission, clearMap |

### The 11 tools

| Tool | What it does |
| --- | --- |
| `queryData` | Read-only SQL on missions or craters: `where`, `outFields`, statistics (count/sum/min/max/avg), group by, order by, limit up to 1,000. Shows a table only when `showTable` is set (when the numbers are the answer) |
| `goTo` | Typed navigation: mission, crater, place, launch site, Moon, or Earth. Travels between worlds automatically |
| `showMissions` | Shows a set of missions (by SQL `where` or explicit ids), hides the rest, list card. No arguments restores everything |
| `chooseMission` | **Human-in-the-loop**: the SDK pauses the run and asks the user to pick ("Which Chang'e?") |
| `showCraters` | Marks exact crater names with rims, framed together |
| `nearestCraters` | Ranks craters by **true lunar distance** from a mission, crater, or place |
| `showCraterNames` | Toggles all crater labels |
| `setTime` | Sets the slider to the end of a year, or pauses it |
| `showChart` | 3 presets, or a custom bar/line/pie/scatter chart |
| `placeObject` | Any real object at true scale (5 generic shapes) |
| `flyLander` | Easter egg: fly a lunar module with the arrow keys |
| `clearMap` | Removes drawings and selections |

### Guardrails: why it doesn't make up data

- **Facts only come from tools.** The instructions forbid inferring counts from truncated results,
  estimating from charts, or inventing dates and numbers.
- **Typed ids, no fuzzy matching.** Actions take exact ids or names the model first gets from
  `queryData`. Unknown ids return an error the model can read.
- **Exact values in the tool description.** Countries, operators, launch-site ids, and crater sides
  are listed, so the model doesn't guess `'near'` for `'Near side'`.
- **Errors go back to the model.** A `returnErrors` wrapper turns tool errors into a result the
  model can correct. Without it, this SDK prerelease ends the whole request with "I couldn't
  complete this request."
- **Live context.** Before each turn the model is told which world is showing, the slider dates, the
  selection, the last place the camera went, and what's drawn. That's how "tell me more about it"
  and "pause" resolve.
- **Stated limits.** No depths, no broad "named after" searches, surface arrivals only. The guide
  says so instead of improvising.

## 6. The data

| Layer | Records | Source | How it's used |
| --- | --- | --- | --- |
| Missions | 51 | NASA NSSDCA "Table of Anthropogenic Impacts and Spacecraft on the Moon" (Aug 2025) | Loaded once at startup into memory; displayed from the hosted layer; queried by SQL |
| Craters | 1,575 | IAU/USGS Gazetteer of Planetary Nomenclature (2019 crater-only extract) | Queried from the service on demand; all 1,575 in one request (`maxRecordCountFactor: 2`) |
| Launch sites | 10 | Curated | Loaded once; their ids are an enum in the `goTo` schema |

All three are public hosted feature layers on ArcGIS Online: no sign-in for the data. CSV backups
are in `backups/`. Mission outcomes are `crewed`, `soft` (robotic landing), `crash`, and `impact`
(planned impact); 28 are successful landings. Photos of 22 sites come from LROC (NASA/GSFC/ASU);
the lunar module model is from NASA 3D Resources.

## 7. The 3D map

### The Moon on an Earth-sized globe

The Moon's imagery and elevation services are published in Web Mercator, so the scene draws the
Moon at Earth size. **`scale.ts` is the only place that converts:** `sceneMeters()` multiplies real
lunar meters by about **3.67** (Earth radius ÷ Moon radius) for symbol sizes, heights, and camera
distances.

**Measurements are truly lunar.** Distances and circles use the SDK's **geodetic operators in
GCS_Moon_2000 (wkid 104903)**, the Moon's own coordinate system, radius 1,737.4 km.

*Why not a native Moon coordinate system?* SceneView supports it experimentally, but there are no
public Moon imagery and elevation services published in it.

### Symbology

- **Mission icons:** one `PointSymbol3D` per country and outcome with **two `IconSymbol3DLayer`s**,
  an outcome disc plus a flag pinned to its corner, floating on a leader line (`LineCallout3D`) above
  the exact landing point. A `UniqueValueRenderer` on `country` + `outcome`, grouped by outcome.
- **Launch sites:** an orange rocket icon in the same style.
- **Selection:** `layerView.highlight()`, labels for up to 6 missions, and `FeatureFilter` to hide
  the rest.

### The time slider

The native `arcgis-time-slider`. Its range comes from the mission layer's `timeInfo`; cumulative
mode, 2-month stops. The agent sets its extent through `setTime`.

### Camera and animation

- **Two stacked scenes.** Earth and the Moon both render all the time, so the trip is instant.
- **The trip.** The departing camera pulls back while arcing 35° around the globe; the globe slides
  toward a corner by animating the view's **`padding`** (which moves only the 3D content, not the
  widgets); the scenes crossfade with CSS opacity; the arriving globe sweeps in from the opposite
  corner.
- **Close-ups.** `view.goTo()`, then a slow 30° orbit over 9 seconds. Any user input or new `goTo`
  cancels it.
- **Reduced motion** is honored throughout.

### Drawings and extras

- **Crater rims:** geodesic circles from the recorded diameter.
- **True-scale objects:** SDK primitives (`ObjectSymbol3DLayer`: cylinder, cone, cube, sphere).
  Drag them with the SDK's `SketchViewModel` in move mode; the label follows.
- **Lunar module at visited sites:** a glTF model sized to the camera distance; it hides when you
  zoom out.
- **Flight easter egg:** a `requestAnimationFrame` loop moves the lander along its heading and puts a
  chase camera behind it; arrow keys are captured on the window.

## 8. Charts

- **Craters:** charted straight from the hosted layer.
- **Missions:** a **client-side `FeatureLayer` built once** from the loaded records. It keeps the
  hosted field names and values, adds derived fields (`side`, `daysToSurface`, decades, decimal
  years), and uses **coded-value domains**, so axes show "Crewed landing" or "Cape Canaveral"
  instead of codes.
- **Dates on the x-axis** are counted per year.
- A custom chart is checked against the table's fields, and its SQL is validated with a count query,
  before the card is shown.

## 9. The "guide's work" panel

An internal SDK component, `arcgis-assistant-observation-panel`, toggled by the button in the chat
entry. It shows every run: its steps and tool calls with inputs and outputs, timings, failures, and
**token usage with a cost estimate**. It observes the assistant through `runtimeEventsEnabled` and
records from page load, even while hidden.

It's the best answer to "how do I know what the AI actually did?": open it and show the tool calls.

## 10. Security, privacy, cost

- **What the model sees:** the tool descriptions, your messages, the live context, and the rows its
  own queries return. Never the database, the code, or credentials.
- **What it can do:** only call the 11 registered tools. Each input is validated by a Zod schema;
  field names must be plain identifiers.
- **SQL injection:** `where` clauses go to the ArcGIS REST `query` endpoint of **public, read-only**
  layers, which parses and validates the SQL. The worst case is a failed read; there are no write
  tools at all.
- **Secrets:** none in the app. Sign-in is OAuth with the portal, handled by `arcgis-assistant`.
  `NEXT_PUBLIC_*` variables hold only the portal URL and optional settings.
- **Cost and model:** the model and its billing come from the portal's AI service; the app doesn't
  choose the model. The work panel shows tokens and estimated cost per run.

## 11. Known limits and SDK workarounds (6.0.0-next.14 prerelease)

- **Tool errors are fatal by default:** hence the `returnErrors` wrapper.
- **Popups:** closing clears the content but not the frame, so the app closes it on `arcgisClose`.
  Automatic popup templates come up empty, so both layers define their own.
- **Legend swatches:** the legend ignores `anchorPosition`, so swatches show the flag over the
  disc. The map itself is correct.
- **Voice input:** `voice-input-enabled` is passed as an attribute (not in the React typings yet) and
  uses the browser's speech recognition, so it works best in Chrome.
- **Data scope:** surface arrivals only, named craters only, no depths.

## 12. Likely questions

**"Is this scripted?"**
No. There's no mapping from questions to actions. The model picks skills and tools from their
descriptions. "Why did it go quiet?" works because the model queries the chronology and reasons over
the dates it gets back. Open the work panel to show the actual tool calls.

**"Which LLM is it?"**
Whichever model the ArcGIS AI service provides through the portal; the app doesn't host or choose
one. The work panel shows run details and token usage.

**"Is there a backend?"**
No. It's a static Next.js app. Data comes from ArcGIS Online feature services; reasoning from the
portal's AI service.

**"How do you stop it making things up?"**
Facts only come from tool results; actions take exact ids, not names; cards are rendered from data,
not model text; errors go back to the model; the instructions forbid estimating numbers.

**"Can it delete or change data?"**
No. Every data tool is read-only, and the layers are public read-only services.

**"How are distances calculated?"**
With the SDK's geodetic distance operator in the Moon's coordinate system (GCS_Moon_2000), so they're
real lunar surface distances. Collins crater is 20 km from Apollo 11.

**"How does it know the Burj Khalifa's height?"**
From the model's general knowledge, and the card says so. The crater's diameter is from the IAU data.

**"How much code is it?"**
About 2,760 lines. Adding a capability is one `FunctionTool`, a Zod schema, and a line in a skill.

**"Would this work on my data?"**
Yes. The pattern is a scene, an assistant, and tools over your feature layers. The Moon-specific
code is mostly `scale.ts` and the travel animation.

**"Why two scenes instead of one?"**
The two worlds have different imagery, terrain, and scale. Keeping both loaded makes the trip
instant and the crossfade smooth.

**"What does it cost to run?"**
Hosting is static. AI usage is billed through the portal's AI service; the work panel shows tokens
and estimated cost per request.

**"What happens with an ambiguous request?"**
It asks. `chooseMission` uses the SDK's human-in-the-loop interrupt; try "Take me to Chang'e".

**"Does it work on mobile?"**
It's built for desktop: two 3D scenes plus the chat panel need a wide screen.

## 13. Numbers

| Fact | Value |
| --- | --- |
| Missions that reached the surface | 51 (28 successful landings) |
| By country | USA 21, USSR 14, China 5, Japan 5, India 3, Europe (ESA) 1, Israel 1, Russia 1 |
| From Cape Canaveral | 23 (including Israel's Beresheet and Japan's two Hakuto-R missions) |
| The quiet years | Luna 24 (Aug 1976) to Chang'e 3 (Dec 2013) |
| Named craters | 1,575 |
| Apollo 11 crew craters | Collins 20 km, Aldrin 47 km, Armstrong 49 km from the landing site |
| Armstrong crater | 4.2 km across |
| Scene scale factor | About 3.67 (Earth radius ÷ Moon radius 1,737.4 km) |
| Earth–Moon distance quoted | 384,400 km |
| Flight easter egg | 20 km/s; starts at 15 km; 200 m to 200 km |
