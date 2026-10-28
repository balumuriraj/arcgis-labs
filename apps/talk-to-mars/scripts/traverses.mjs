// Rebuilds public/data/traverses.json from the rover teams' published traverse GeoJSON (NASA/JPL-Caltech
// MMGIS maps, public domain). Run it to pick up new drives: node scripts/traverses.mjs
import { writeFileSync } from "node:fs";

const ROVERS = [
  {
    missionId: "perseverance",
    rover: "Perseverance",
    url: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json",
    lengthField: "length",
  },
  {
    missionId: "curiosity",
    rover: "Curiosity",
    url: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json",
    lengthField: "Length",
  },
];

/** About 0.6 m on Mars: finer than the imagery, coarse enough to keep the file small. */
const round = (n) => Math.round(n * 1e5) / 1e5;

function pathsOf(geometry) {
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.type === "MultiLineString"
        ? geometry.coordinates
        : [];
  return lines.map((line) => {
    const path = [];
    for (const [lon, lat] of line) {
      const p = [round(lon), round(lat)];
      const prev = path.at(-1);
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) path.push(p);
    }
    return path;
  });
}

const out = [];
for (const r of ROVERS) {
  const res = await fetch(r.url);
  if (!res.ok) throw new Error(`${r.url}: ${res.status}`);
  const { features } = await res.json();
  const paths = features
    .flatMap((f) => pathsOf(f.geometry))
    .filter((p) => p.length > 1);
  const meters = features.reduce(
    (sum, f) => sum + (Number(f.properties?.[r.lengthField]) || 0),
    0,
  );
  const sols = features
    .map((f) => f.properties?.sol)
    .filter((s) => typeof s === "number");
  out.push({
    missionId: r.missionId,
    rover: r.rover,
    source: r.url,
    retrieved: new Date().toISOString().slice(0, 10),
    drives: features.length,
    drivenKm: Math.round(meters / 100) / 10,
    lastSol: sols.length ? Math.max(...sols) : null,
    paths,
  });
  console.log(
    `${r.rover}: ${features.length} drives, ${Math.round(meters / 100) / 10} km, ${paths.reduce((n, p) => n + p.length, 0)} vertices`,
  );
}
writeFileSync("public/data/traverses.json", JSON.stringify(out));
