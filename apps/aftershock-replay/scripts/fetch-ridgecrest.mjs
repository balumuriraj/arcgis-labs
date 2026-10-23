// Adapted from the supplied USGS fetch script; boundaries are July in California.
import { writeFile } from "node:fs/promises";

const params = new URLSearchParams({
  format: "geojson",
  starttime: "2019-07-01T07:00:00",
  endtime: "2019-08-01T07:00:00",
  minlatitude: "35.5",
  maxlatitude: "36.2",
  minlongitude: "-118.0",
  maxlongitude: "-117.2",
  minmagnitude: "1.5",
  eventtype: "earthquake",
  orderby: "time-asc",
});
const response = await fetch(
  `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`,
);
if (!response.ok)
  throw new Error(
    `USGS request failed: ${response.status} ${await response.text()}`,
  );
const data = await response.json();
if (
  !Array.isArray(data.features) ||
  !data.features.length ||
  data.features.length >= 20000
) {
  throw new Error(
    "USGS returned an empty, invalid, or potentially truncated catalog.",
  );
}
const features = data.features
  .filter((f) => f.properties.type === "earthquake" && f.properties.mag != null)
  .map((f) => ({
    type: "Feature",
    id: f.id,
    geometry: {
      type: "Point",
      coordinates: f.geometry.coordinates.slice(0, 2),
    },
    properties: {
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      depth: f.geometry.coordinates[2],
      title: f.properties.title,
    },
  }));
await writeFile(
  new URL("../public/ridgecrest-2019-07.geojson", import.meta.url),
  JSON.stringify({
    type: "FeatureCollection",
    metadata: {
      source: response.url,
      fetchedAt: new Date().toISOString(),
      timeZone: "America/Los_Angeles",
      minimumMagnitude: 1.5,
      description:
        "USGS catalog snapshot, not a complete catalog of all earthquakes.",
    },
    features,
  }),
);
console.log(`Saved ${features.length} USGS earthquakes.`);
