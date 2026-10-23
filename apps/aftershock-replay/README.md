# Aftershock Replay

A minimal Calcite map app in which a custom `SkillAgent` explores the July 2019
Ridgecrest sequence and drives the map's shared `arcgis-time-slider`. Evidence
and next actions live in small cards inside `arcgis-assistant`, rendered through
its `arcgisSlottableRequest` / `slottableRequests` API.

The app has no authored CSS rules or inline styles, only the SDK stylesheet
imports. Layout uses native component slots. Daily activity uses default Calcite
list items and meters instead of a custom-styled chart.

Browser targets in [package.json](./package.json) require native CSS `light-dark()`
support. Older targets cause Next's CSS compiler to rewrite Calcite's color tokens
into invalid values, producing black borders and transparent backgrounds. Preserve
these targets rather than patching component colors with custom CSS. Restart the
development server after changing browser targets.

## Run

From the repository root:

Use Node.js 22.6+ (Node 24 recommended); the tests use Node's built-in TypeScript
stripping rather than an additional test framework.

```sh
pnpm install
pnpm --filter aftershock-replay dev
```

Open <http://localhost:3005>. For production, use
`pnpm --filter aftershock-replay build` and `pnpm --filter aftershock-replay start`.

The SDK is pinned to **5.2.0-next.155**, the newest 5.2 prerelease when this app
was added. The registry's `next` tag points to 6.0; do not replace these pins with
`@next` if you want to stay on 5.2.

### AI access

Use the assistant's built-in **Sign in** link. Natural-language requests require
an ArcGIS account with AI assistant privileges and an organization with AI agents
enabled. The portal must advertise both the AI Assistant Services and AI Models
helper services. Public map/data browsing does not require AI authentication.

To use a different AI-enabled portal, copy [.env.example](./.env.example) to
`.env.local` in this app and set `NEXT_PUBLIC_ARCGIS_PORTAL_URL`, then restart.
No tokens or model-provider keys belong in the source. Authentication, service
discovery, and organization permissions are handled by the ArcGIS assistant.
There is no mocked LLM or keyword-routing fallback.

The assistant intentionally has no `reference-element`: in this SDK prerelease,
associating a view makes the generic orchestrator require a saved web map with
embeddings. This app uses local GeoJSON instead. Its custom `SkillAgent` receives
layer and timeline context through the replay controller, which also performs
map navigation and highlighting. No web map portal item or embeddings are needed.

**Explore sequence** invokes the same layer-backed operation directly, so the
cards and map can also be explored without signing in. This is a deterministic
map control, not a claim that AI is working without credentials.

## Demo

1. Sign in and ask: **What was the biggest earthquake sequence here in July 2019?**
   The guide finds the largest event, zooms to its nearby cluster, selects July,
   and shows the event card.
2. Choose **Replay aftershocks**. Events accumulate from immediately after the
   mainshock, advancing through California midnights. The playback card follows
   manual slider changes as well as playback; it can pause, step, and change speed.
3. Choose **What happened before?**. The two-event card shows the strongest
   significant earlier event, its gap to the mainshock, and the count of intervening
   events. Select a row to highlight its exact instant, or **Play the gap**.
4. Ask **When did it calm down?**. The guide shows daily activity and selects
   the first sustained drop; daily bars select the corresponding local day.
5. Ask **Filter by magnitude**. Choose a minimum on the inline slider and
   confirm. Until confirmation, nothing on the map changes.
6. Try **Show accumulated events from July 5 at 9 PM to July 8 at midnight**,
   **Pause**, **Step to the next day**, or **Give me stats for this time window**.

Card buttons execute the same controller operations as agent tools without an
extra model round trip. Playback has no independent timer: the actual ArcGIS time
slider is authoritative, and its property changes trigger fresh layer queries.

## Data and interpretation

[ridgecrest-2019-07.geojson](./public/ridgecrest-2019-07.geojson) is a checked-in
USGS snapshot, generated with [the fetch script](./scripts/fetch-ridgecrest.mjs)
adapted from the supplied script. The source URL, retrieval time, limits, and
time zone are stored in the file's metadata. It contains earthquakes of M1.5+
within latitude 35.5–36.2 and longitude -118.0–-117.2, for July in California
(`2019-07-01T07:00:00Z` through `2019-08-01T07:00:00Z`).
It is not a complete catalog of all earthquakes or a real-time feed.

To deliberately regenerate the snapshot:

```sh
node apps/aftershock-replay/scripts/fetch-ridgecrest.mjs
```

- The GeoJSON layer's `time` field is a date field containing epoch milliseconds.
  Magnitude controls point size and color.
- All event details, counts, magnitudes, depths, timestamps, and gaps derive from
  layer query results, not model-authored card payloads. Cards reference an
  application-owned registry by ID.
- The largest event in the July catalog establishes the mainshock. A geographic
  cluster starts at a 25 km radius and widens to 50/100 km if no neighbors are
  found. Events are restricted to July. This is a transparent demo heuristic,
  not scientific sequence attribution.
- The strongest strictly smaller, earlier nearby M4+ event is the significant
  foreshock. This is a retrospective designation, not a prediction. Gap counts
  exclude the two endpoints. The sequence/foreshock evidence uses the full
  catalog regardless of the display magnitude filter.
- Aftershocks are the cluster's events strictly after the mainshock; replay
  excludes the mainshock itself. Counts reflect the current magnitude filter.
- "Calmed down" means the first three consecutive complete local days with counts
  at or below 25% of the queried period's peak daily count, after the peak.
  Zero-count days are retained. A partial final day cannot establish a decline.
  This describes catalog activity, **not safety or hazard**.
- Statistics are scoped to the sequence, selected time window, and confirmed
  magnitude filter. Empty time queries retry over July without secretly relaxing
  the user's magnitude filter. Failed/truncated loads and queries show explicit
  errors; no invented results are substituted.

## Validation

```sh
pnpm --filter aftershock-replay test
pnpm --filter aftershock-replay check-types
pnpm --filter aftershock-replay lint
pnpm --filter aftershock-replay build
```

Tests exercise the committed catalog, classification edge cases, California
dates, strict gap boundaries, widened searches, zero-filled daily bins, and the
measurable sustained-decline threshold. End-to-end natural-language validation
additionally requires the AI-enabled ArcGIS sign-in described above.
