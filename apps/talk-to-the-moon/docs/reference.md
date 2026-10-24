# Reference

Configuration, the demo script, data sources and their terms, and SDK caveats.
Start with the [README](../README.md) and the [walkthrough](./build-your-own.md).

## Configuration

Copy `.env.example` to `.env.local` in this app directory and restart the dev server:

```bash
NEXT_PUBLIC_PORTAL_URL=...      # the AI-enabled portal (default https://devext.arcgis.com)
NEXT_PUBLIC_ARCGIS_API_KEY=...  # only if your setup needs one
NEXT_PUBLIC_READ_ALOUD=true     # have the assistant speak its replies (off by default)
NEXT_PUBLIC_PHOTOS=off          # hide the LROC site photos (or add ?photos=off to the URL)
```

All `NEXT_PUBLIC_` values are embedded in the browser bundle. Supported browsers
are Chrome/Edge 123+, Firefox 120+, and Safari 17.5+. Voice input uses the
browser's speech recognition, so it works best in Chrome.

## Demo script (about 90 seconds)

The app opens on a slowly spinning Earth. "We've all seen plenty of agentic maps of Earth." Then:

| # | Say | What happens |
| --- | --- | --- |
| 0 | Go to the Moon | Earth pulls back, the scenes crossfade, and the Moon flies in |
| 1 | Show me every place we've landed on the Moon | Whole-Moon view with every mission marker |
| 2 | Show the Moon as it was in 1969 | The slider shows missions through the end of 1969 |
| 3 | Why did it go quiet? | The guide queries the landing chronology and finds the 1976–2013 gap from the returned dates |
| 4 | Show only USA landings | The map shows only successful USA robotic and crewed landings |
| 5 | Stand the Burj Khalifa in Tycho crater | A true-scale outline on the crater floor, with a size comparison card. Any object works: "Put the Eiffel Tower next to Apollo 11" |
| 6 | What are the nearest craters to Apollo 11? | The nearest named crater centers, marked and listed with surface distances |

Backups: "Take me to Chang'e" (asks which one), "What was the first landing that
wasn't by a government?", "Now put Mount Everest in Tycho", "How tall would a Saturn V look next to Apollo 11?", "Take me to Copernicus",
"What crater did Chang'e 4 land in?", "Biggest craters on the Moon", "Show me where
Apollo 11 launched from".

## Data

All three layers are public on ArcGIS Online, and `backups/` has CSV copies for
republishing. The app reads missions and launch sites once at startup. Craters are
queried from the service when needed.

**Missions** come from the [Moon Missions layer](https://jsapi.maps.arcgis.com/home/item.html?id=5e7a5e537f274ec19bede7998ae464be)
([FeatureServer/0](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/moon_missions/FeatureServer/0)):
51 spacecraft that reached the surface at a known location, from NASA NSSDCA's
[Table of Anthropogenic Impacts and Spacecraft on the Moon](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html)
(updated 13 August 2025). Most coordinates come from Lunar Reconnaissance Orbiter
imagery. Sites without an LRO fix are marked `approximate`. Mission debris such as
S-IVB stages and ascent stages is left out. The original launch references are in
[backups/mission-sources.json](../backups/mission-sources.json): `nssdca` and
`siddiqi` refer to NASA NSSDCA spacecraft pages and Asif Siddiqi's *Beyond Earth*
(NASA SP-2018-4041), and other source values are URLs.

**Launch sites** come from the [Moon Launch Sites layer](https://www.arcgis.com/home/item.html?id=78ad3a153bef46e3af31a08fa3e78b81).
A mission's `launchSiteId` refers to these ids, so keep them stable.

**Craters** come from the [Moon Craters layer](https://jsapi.maps.arcgis.com/home/item.html?id=664148a6ef744843b1641d6fe29332c7)
([FeatureServer/0](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/moon-craters/FeatureServer/0)):
1,575 named craters from the IAU/USGS [Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MOON/target),
a crater-only extract of the 2019 export mirrored in
[eleanorlutz/moon_geology_atlas_of_space](https://github.com/eleanorlutz/moon_geology_atlas_of_space).
Lettered satellite craters such as "Abbe H" are left out, and depths aren't
included. Shackleton, Whipple, and Hinshelwood are too close to the poles for
Web Mercator geometry. The app works from the `lat` and `lon` attributes, so it
can still search, measure, and mark them.

**Photos** of 22 sites come from the Lunar Reconnaissance Orbiter Camera's
[Featured Sites](https://lroc.im-ldi.com/featured_sites) (NASA/GSFC/Arizona State
University). LROC's website images are copyrighted: educational use with credit
is allowed, but [commercial use needs their permission](https://lroc.im-ldi.com/about/terms).
Hide them with `?photos=off` or `NEXT_PUBLIC_PHOTOS=off` until that's settled.

**The lander model** is NASA's Apollo Lunar Module from NASA 3D Resources; see
[public/models/README.md](../public/models/README.md).

**Flags** in `public/flags/` are simplified illustrations drawn for this app, not
official flag specifications.

### Publishing missions

- Use `lat` and `lon` as coordinate fields. These are lunar coordinates stored in
  Earth geometry for display, as with the crater layer.
- Keep `id` as text. It links missions to photos, models, and rideshares.
- Publish `arrivalDate` and `launchDate` as **Date** fields with **UTC** as the
  input time zone, and enable time on `arrivalDate`. The source has calendar dates,
  so each one is at 12:00:00 UTC.
- `commercial`, `sampleReturn`, and `approximate` are integers: 1 for true, 0 for false.
- `crew` holds semicolon-separated surface crew names. `orbitingCrew` is separate.
- A new country needs a flag in `public/flags/` and an entry in `FLAGS` in
  [data.ts](../src/data.ts). A new outcome needs an icon in `public/icons/`.

A coded-value domain on `outcome` (crewed → "Crewed landing", ...) would let the
hosted layer's popups and legend show labels directly. The chart table already
adds one ([cards/charts.ts](../src/cards/charts.ts)). Until the service has the
domain, the popup decodes outcomes with an Arcade expression.

## True-scale objects

`placeObject` stands any object the guide knows at true scale: the model supplies the
name, height, optional width, and one of five shapes (tower, mountain, block,
cylinder, sphere), drawn from SDK primitives in [graphics.ts](../src/map/graphics.ts).
Sizes come from the model's general knowledge, not this app's data, so the card
and the tool result say so, and the schema rejects heights outside 0.1 m to 20 km.

## How the Moon is drawn

The lunar imagery and elevation services are published in Web Mercator, so the
scene draws the Moon on an Earth-sized globe. [scale.ts](../src/map/scale.ts) is
the only place that converts: `sceneMeters()` scales real lunar meters by about
3.67 for symbol sizes and map scales. Distances and circles use the geodetic
operators in the Moon's own coordinate system (GCS_Moon_2000, wkid 104903), so
they're true lunar distances.

The SceneView also supports GCS_Moon_2000 directly, as an experimental feature,
but that needs imagery and elevation services published in it.

## SDK caveats (6.0.0-next.14)

- **Popups.** Closing a popup clears its content but leaves the frame open, so
  [App.tsx](../src/App.tsx) closes it on `arcgisClose`. Automatic popup templates
  come up empty, so both layers define their popup templates.
- **Assistant voice properties** aren't in the React typings yet, so
  `voice-input-enabled` and `read-aloud-enabled` are passed as attributes.
- **Two WebGL scenes** render at once so the trip between worlds is instant. If a
  recording machine struggles, check the GPU in the browser's task manager.
- **chooseMission** accepts the offered mission id or its label as the user's answer.
