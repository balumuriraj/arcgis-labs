/**
 * Skills are Markdown instructions the SkillAgent picks between. Each lists the tools it may use
 * (`allowed-tools`); a tool must also be registered in agent.ts.
 */

export const explore = `---
name: explore
description: Find and visit missions, craters, and places on the Moon; launch sites on Earth; nearest craters.
allowed-tools: queryData goTo showMissions chooseMission showCraters nearestCraters showCraterNames clearMap showChart flyLander
---

# Explore

- \`goTo\` moves the camera: to a mission (close-up, card, and model), a crater, a reference place, a launch site on Earth, or to the Moon or Earth. Map actions travel to the Moon by themselves; read-only questions don't need travel.
- \`showMissions\` shows a set of missions and hides the rest: pick them with SQL (\`where\`) in one step, or pass ids when the order or selection comes from earlier steps. With neither it restores every mission. \`showCraters\` marks exact crater names. \`clearMap\` removes drawings and selections and leaves the time slider alone.
- \`chooseMission\` asks the user to pick between candidate ids. \`nearestCraters\` ranks crater-center distances from a mission, crater, or place, optionally filtered with SQL.
- Craters come from a 2019 crater-only extract of the IAU gazetteer: names, locations, diameters, approval years, and name origins. To find craters named after specific people, query names matching their surnames and confirm each with its origin text before showing them; for broad honoree searches offer geography instead. For depths offer diameter; for other feature types explain that only craters are included. If nothing matches, say so and suggest dropping a filter.
- Mission site descriptions are recorded facts, not spatial containment. Photos on cards are LROC observations; don't invent what they show.
- A mission's \`launchSiteId\` is the id \`goTo\` takes for its launch site. Cape Canaveral includes Kennedy Space Center.
- \`flyLander\` is an easter egg: only when the user asks to fly. Tell them the controls it returns.
`;

export const history = `---
name: history
description: Mission chronology, firsts, gaps, trends, launches and trip times, the time slider, and charts.
allowed-tools: queryData setTime showMissions goTo chooseMission showChart
---

# History

- Query chronology with explicit filters and ordering; the map's time and selection don't affect queries. "First" and "last" depend on the population asked about, and reaching the surface isn't necessarily a successful landing.
- Gaps need a complete ordered chronology. Report boundary dates or approximate year spans, not invented exact durations.
- \`setTime\` shows the Moon as it was at the end of a year, or pauses playback. It doesn't replay arrivals.
- Chart presets: \`landings-per-year\`, \`outcomes-by-country\`, \`crater-sizes\`. Custom charts: spaceports are a bar chart of \`launchSiteId\`; trip times are a scatter of x \`launchYear\` and value \`daysToSurface\` where \`outcome <> 'impact'\`; near or far side is a pie of \`side\`; decades use \`arrivalDecade\` or \`launchDecade\`.
- \`daysToSurface\` runs from launch to reaching the surface. Planned impacts may follow years in orbit, so for them it isn't a travel time.
- Launch counts cover only missions that reached the surface, not every attempt. Budgets and politics are context, not causes these records establish.
`;

export const scale = `---
name: scale
description: True-scale objects (buildings, monuments, mountains, rockets) stood on the Moon and compared with crater sizes.
allowed-tools: queryData placeObject goTo chooseMission clearMap
---

# Scale

- \`placeObject\` stands any real object at a typed target at true scale. There's no default location: use clear context or ask.
- Its size isn't in this app's data: give its real height, and width when it matters, from widely published figures (for example Burj Khalifa 828 m, Mount Everest 8,849 m, Eiffel Tower 330 m). Say the figures you used. If you don't know an object's size reliably, say so rather than guess.
- Pick the closest shape: \`tower\` for tall tapering structures, \`mountain\` for peaks, \`block\` for buildings and stadiums, \`cylinder\` for rockets and tanks, \`sphere\` for domes and balls. It's an outline at true size, not a model of the object.
- It compares the object's height with the crater's diameter. Depths aren't in the data: never estimate them or compare an object with a rim. \`clearMap\` removes it.
`;
