/**
 * Skills are Markdown instructions the SkillAgent picks between. Each lists the tools it may use
 * (`allowed-tools`); a tool must also be registered in agent.ts.
 */

export const explore = `---
name: explore
description: Find and visit landing sites, named features (craters, volcanoes, canyons, plains), and places on Mars; rover routes; launch sites on Earth; nearest features.
allowed-tools: queryData goTo showMissions chooseMission showFeatures nearestFeatures showFeatureNames showElevation showRoute clearMap showChart
---

# Explore

- \`goTo\` moves the camera: to a mission (close-up and card), a named feature, a reference place, a launch site on Earth, or to Mars or Earth. Map actions travel to Mars by themselves; read-only questions don't need travel.
- \`showMissions\` shows a set of missions and hides the rest: pick them with SQL (\`where\`) in one step, or pass ids when the order or selection comes from earlier steps. With neither it restores every mission. \`showFeatures\` marks exact feature names. \`clearMap\` removes drawings, routes, and selections and leaves the time slider alone.
- \`chooseMission\` asks the user to pick between candidate ids. \`nearestFeatures\` ranks feature-center distances from a mission, feature, or place, optionally filtered with SQL (for example \`type = 'Crater'\`).
- \`showRoute\` draws where Perseverance or Curiosity has driven, from the teams' published traverse maps, and returns the distance. Other rovers' routes (Sojourner, Spirit, Opportunity, Zhurong) aren't in the data: say so and offer their landing site instead.
- Named features come from the 2019 IAU gazetteer: names, types, locations, sizes, approval years, and name origins. Query by type for kinds of places ("volcanoes" are \`type = 'Mons'\` or \`'Tholus'\` or \`'Patera'\`; canyons \`'Chasma'\` or \`'Vallis'\`). If nothing matches, say so and suggest dropping a filter.
- \`showElevation\` colors the planet by height, which makes the highlands and lowlands obvious: the low northern plains against the southern highlands, Hellas's deep basin, and the Tharsis volcanoes. It's a picture, not data: describe what the colors show, not elevation numbers.
- Mission site descriptions are recorded facts, not spatial containment. Sites marked approximate were never confirmed from orbit.
- A mission's \`launchSiteId\` is the id \`goTo\` takes for its launch site.
`;

export const history = `---
name: history
description: Landing chronology, firsts, failures and why they happened, trends, launches and trip times, the time slider, and charts.
allowed-tools: queryData setTime showMissions goTo chooseMission showChart
---

# History

- Query chronology with explicit filters and ordering; the map's time and selection don't affect queries. "First" depends on what's asked: Mars 2 was the first to reach the surface (it crashed), Mars 3 the first soft landing (it fell silent), Viking 1 the first to land and keep working.
- Each mission's \`note\` records what happened; failure causes come from there. Don't add causes the notes don't give.
- \`setTime\` shows Mars as it was at the end of a year, or pauses playback. It doesn't replay arrivals.
- Chart presets: \`outcomes-by-decade\`, \`outcomes-by-country\`, \`crater-sizes\`. Custom charts: spaceports are a bar chart of \`launchSiteId\`; trip times are a scatter of x \`launchYear\` and value \`daysToSurface\`; hemispheres are a pie of \`hemisphere\`.
- \`daysToSurface\` runs from launch to reaching the surface.
- The data holds spacecraft that reached the surface, not every launch. Budgets and politics are context, not causes these records establish.
`;

export const scale = `---
name: scale
description: True-scale objects (buildings, monuments, mountains, rockets) stood on Mars and compared with the size of craters and other features.
allowed-tools: queryData placeObject goTo chooseMission clearMap
---

# Scale

- \`placeObject\` stands any real object at a typed target at true scale. There's no default location: use clear context or ask.
- Its size isn't in this app's data: give its real height, and width when it matters, from widely published figures (for example Burj Khalifa 828 m, Mount Everest 8,849 m above sea level, Eiffel Tower 330 m). Say the figures you used. If you don't know an object's size reliably, say so rather than guess.
- Pick the closest shape: \`tower\` for tall tapering structures, \`mountain\` for peaks, \`block\` for buildings and stadiums, \`cylinder\` for rockets and tanks, \`sphere\` for domes and balls. It's an outline at true size, not a model of the object.
- It compares the object's height with the feature's recorded size (a crater's diameter, or a valley's length). The terrain under it is real, so it stands at the true ground height. Heights of Martian features (Olympus Mons rises about 22 km above its plains) are general knowledge, not this app's data: say so when you use them. \`clearMap\` removes it.
`;
