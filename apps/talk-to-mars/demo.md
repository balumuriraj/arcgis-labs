# Demo script (draft)

About three minutes. The app opens on a slowly spinning Earth showing four launch sites;
everything after that is driven by talking to the guide.

This is a first draft: run every prompt against the live guide and adjust the lines to
what it actually says before using it. Check the mission records first (see
[reference](./docs/reference.md#before-a-public-demo-check-the-mission-records)).

## Before you start

- Sign in through the assistant, and run one prompt ("Go to Mars") to warm up the
  service and the map cache. Then reload so the demo opens on Earth.
- Use a wide window; the map and the chat panel both need room.
- Turn off "reduce motion" in the OS, or the trip to Mars skips its animation.

The guide suggests each prompt below in turn as a chip above the chat box: click it, then
Ask. A visitor can click through the whole demo on their own the same way. Off-script
questions don't lose the place; the next chip waits. The chips come from
[src/tour.ts](./src/tour.ts), so change the prompts there and here together.

## The script

Prompts to type are in _italics_; [brackets] are what happens on screen.

"Here is an agentic app with a map of every spacecraft that has reached the surface of Mars.

_'How many spacecraft have reached the surface of Mars, and how many worked?'_

[17 reached it; 10 landed and worked.]

That's a lot of losses. _'Show how Mars landings went, decade by decade.'_

[A stacked bar chart: the 1970s and 1990s are mostly failures.]

_'Show me every attempt.'_

[Stop talking. The camera leaves Earth and arrives at Mars. Every marker appears: cyan for
landers that worked, grey for the two that landed and went silent, coral for crashes.]

_'Show me the highs and lows of Mars.'_

[The planet turns into an elevation map: blue for the lowest ground, through green, yellow,
and red, to white on the volcano summits. The Tharsis volcanoes, Valles Marineris, and the
low northern plains jump out.]

Mars has two halves: low, smooth plains in the north and high, cratered ground in the
south. _'Turn the elevation colors off.'_

_'Where has Perseverance driven?'_

[The route appears across Jezero crater: 46 km over 559 drives, as of the data's date.]

_'And Curiosity?'_

[38 km, up the slopes of Mount Sharp in Gale crater.]

One more. _'Stand Mount Everest next to Olympus Mons.'_

[Everest appears at true scale. Olympus Mons is about 610 km across: about 69 times wider
than Everest is tall. The guide may add that Olympus Mons rises about 22 km, as general
knowledge, not from the data.]

None of those answers were scripted. The agent has a few skills and tools over real NASA
and IAU data, and decides the steps itself. It's the same pattern as the Moon app, on a
different planet."

## Facts behind the lines

All from the app's data, so the guide's answers will match what you say:

| Line                     | Figure                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Reached the surface      | 17: USA 11, USSR 3, China 1, Europe (ESA) 1, UK 1                                                       |
| Landed and worked        | 10: Viking 1 and 2, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance, Zhurong |
| Landed, then went silent | Mars 3 (1971), Beagle 2 (2003)                                                                          |
| By decade                | 1970s 5 (2 worked), 1990s 3 (1), 2000s 4 (3), 2010s 3 (2), 2020s 2 (2)                                  |
| Perseverance route       | 46.0 km, 559 drives, through sol 2022 (traverse data retrieved 2026-10-28)                              |
| Curiosity route          | 38.1 km, 1,314 drives                                                                                   |
| Olympus Mons             | 610 km across in the gazetteer; Everest is 8,849 m                                                      |
| Jezero crater            | 47.5 km across                                                                                          |

Rebuild the routes with `node scripts/traverses.mjs` before a demo and update the route figures.

## Backups

- "Take me to Viking 1": the first landing that worked, in Chryse Planitia, 1976.
- "Where did Beagle 2 land?": the British lander found by orbit in 2015.
- "What are the biggest volcanoes on Mars?": named montes and tholi by size.
- "Show Mars as it was in 1999": the time slider jumps to the end of 1999.
- "Take me to the launch site for InSight": Earth turns to Vandenberg.

## If something goes wrong

- **The guide asks a question:** answer it. That's the design: it asks instead of guessing.
- **The map is cluttered:** "Clear the map", or "Show every attempt" to restore every mission.
- **The camera is somewhere odd:** "Go to Mars" or "Show every attempt" resets the view.
- **A step fails or hangs:** move on to the next one; each prompt stands on its own.
  Reload as a last resort, which brings you back to Earth.
