# Test prompts

A manual test pass through a signed-in assistant. Together these prompts use all
11 tools, every card type, and the three skills (explore, history, scale). Run
them in order in one session: some build on what's already on the map.

## Watch throughout

- The guide's reply text shows with every card. A card alone means the slots are broken.
- Lookup queries don't show a table. Tables appear only when the numbers are the answer.
- Charts render in color, not black.
- A bad step comes back as a correction from the guide, never as "I couldn't complete this request."
- No console errors besides the missing `favicon.ico`.
- The guide never states numbers that a query result or tool output didn't return.

## 1. Travel and Earth

| # | Prompt | Expect |
| --- | --- | --- |
| 1 | Show me where Apollo 11 launched from | Earth turns to Cape Canaveral (`goTo` launch site) |
| 2 | Where did the Chinese missions launch from? | Answer from `launchSiteId`; may turn to Xichang or Wenchang |
| 3 | Go to the Moon | Pull-back, crossfade, fly-in. Reply mentions 51 missions and 28 landings |
| 4 | Take me back to Earth | The trip back; the globe spins again |
| 5 | Go to the Moon | Back for the rest of the pass |

## 2. Missions

| # | Prompt | Expect |
| --- | --- | --- |
| 6 | Take me to Apollo 11 | Mission card with photo and details table, close-up, lunar module at the site, highlight and label. No query table |
| 7 | Take me to Chang'e | The guide asks which one (`chooseMission`); pick one and it flies there |
| 8 | Show me every place we've landed on the Moon | One list card of 28 landings and a filtered map; no table first |
| 9 | Show only USA landings | 14 missions on the map and in the list |
| 10 | Show everything | Every marker returns; the filter is cleared |
| 11 | Show the three Apollo missions that carried rovers | Apollo 15, 16, 17, labeled (six or fewer) |
| 12 | Click a mission in that list | Flies to it (`app.visit`) |
| 13 | Tell me more about it | "It" resolves to the last place the camera went |
| 14 | Take me to Luna 9 | Card says the location is approximate |

## 3. Craters and places

| # | Prompt | Expect |
| --- | --- | --- |
| 15 | Take me to Tycho | Rim drawn, crater card with its name origin |
| 16 | Show Copernicus, Kepler and Aristarchus | List card, three rims, framed together |
| 17 | What are the nearest craters to Apollo 11? | Collins, Moltke, Aldrin, Armstrong… with distances in km |
| 18 | Nearest craters to Tycho bigger than 50 km | Filtered candidates; Tycho itself left out |
| 19 | Biggest craters on the far side | Ranked from a query on `side`, likely shown on the map |
| 20 | Take me to Shackleton | Works near the south pole |
| 20a | What's named after the Apollo 11 crew? | Collins, Aldrin, Armstrong, confirmed by their origin text and marked on the map |
| 21 | Show all crater names, then hide them | Crater labels toggle |
| 22 | Take me to the south pole | Close-up of the pole |
| 23 | Clear the map | Rims, objects, and selection gone; slider unchanged |

## 4. History and time

| # | Prompt | Expect |
| --- | --- | --- |
| 24 | Show the Moon as it was in 1969 | Slider at the end of 1969; 17 missions so far, 9 landings |
| 25 | Press play on the slider, then say "pause" | Playback stops |
| 26 | Why did it go quiet? | The gap from Luna 24 (1976) to Chang'e 3 (2013), from queried dates |
| 27 | What was the first landing that wasn't by a government? | A commercial landing, from a query ordered by date |
| 28 | How many missions did each country send? | A table card: the numbers are the answer |
| 29 | When did India first reach the Moon? | The earliest arrival date |
| 30 | Which missions shared a rocket? | From `rideshare` |
| 31 | How long did Apollo 11 take to get there? | 4 days |

## 5. Charts

| # | Prompt | Expect |
| --- | --- | --- |
| 32 | Chart successful landings per year | Preset; the 37-year gap is visible |
| 33 | How did each country's missions end? Show a chart | Stacked bars; legend reads "Crewed landing", "Robotic landing"… |
| 34 | Show a histogram of crater sizes | Preset histogram, colored bars |
| 35 | Chart missions by spaceport | Bars labeled with spaceport names |
| 36 | Plot trip times against launch year | Scatter without planned impacts; caveat in the card |
| 37 | Pie chart of near side vs far side craters | Pie, about 57% near and 43% far |
| 38 | Missions per decade as a line chart | Line over decades in order |
| 39 | Compare average crater size on the near and far sides | About 46 km vs 73 km, from a query and/or a chart |

## 6. True-scale objects

| # | Prompt | Expect |
| --- | --- | --- |
| 40 | Stand the Burj Khalifa in Tycho crater | Tower on the crater floor; crater about 103× wider than it's tall |
| 41 | Now put Mount Everest in Tycho | A cone replaces the tower |
| 42 | Put the Eiffel Tower next to Apollo 11 | A tower beside the landing site |
| 43 | How big is a Saturn V next to Apollo 11? | A cylinder, about 110 m, framed close |
| 44 | Put a football stadium in Copernicus | A block, with the guide's own size figures |
| 45 | Put the Las Vegas Sphere next to Apollo 12 | A sphere, about 112 m |
| 46 | Put my house in Tycho | Asks for the size or says it can't know it |
| 47 | Click **Remove it** on the card | The map clears |

## 7. Easter egg

| # | Prompt | Expect |
| --- | --- | --- |
| 47a | Let me fly the lander | A lunar module appears with a chase camera; ← → steer, ↑ ↓ climb and descend |
| 47b | Press Esc, or ask for anything else | The flight ends and the map is yours again |

## 8. Recovery and limits

| # | Prompt | Expect |
| --- | --- | --- |
| 48 | Take me to Apollo 99 | Says there's no such mission and offers real ones |
| 49 | Chart missions by crew size | Explains there's no such field; may offer another chart |
| 50 | Take me to Mare Tranquillitatis | Explains that only craters are included; offers Apollo 11 |
| 51 | Which craters are named after astronauts? | Declines the broad honoree search (specific named people are fine); offers geography |
| 52 | How deep is Tycho? | Depths aren't available; offers the diameter |
| 53 | How far is Apollo 11 from Apollo 12? | Point-to-point measurement isn't supported |
| 54 | What's the weather in Paris? | Stays on the Moon |
