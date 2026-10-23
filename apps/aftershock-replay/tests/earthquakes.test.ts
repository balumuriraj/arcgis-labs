import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DAY,
  JULY_START,
  JULY_END,
  dailyActivity,
  distanceKm,
  findCalmerDay,
  findSequence,
  localTime,
  type Earthquake,
} from "../app/lib/earthquakes.ts";

const snapshot = JSON.parse(
  await readFile(
    new URL("../public/ridgecrest-2019-07.geojson", import.meta.url),
    "utf8",
  ),
);
const catalog: Earthquake[] = snapshot.features.map(
  (feature: {
    properties: Omit<Earthquake, "objectId" | "longitude" | "latitude">;
    geometry: { coordinates: [number, number] };
  }) => ({
    ...feature.properties,
    objectId: feature.properties.id,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  }),
);

test("the committed snapshot is nonempty, unique, valid, and entirely in California July", () => {
  assert.ok(catalog.length > 1000);
  assert.equal(new Set(catalog.map((event) => event.id)).size, catalog.length);
  for (const event of catalog) {
    assert.ok(event.time >= JULY_START && event.time <= JULY_END);
    assert.ok(
      [event.mag, event.depth, event.latitude, event.longitude].every(
        Number.isFinite,
      ),
    );
    assert.ok(event.mag >= snapshot.metadata.minimumMagnitude);
  }
});

test("the real golden path finds the largest event and a strictly smaller, earlier nearby foreshock", () => {
  const sequence = findSequence(catalog);
  const largest = catalog.reduce((a, b) => (a.mag > b.mag ? a : b));
  assert.equal(sequence.mainshock.id, largest.id);
  assert.equal(sequence.mainshock.mag, 7.1);
  assert.equal(sequence.foreshock?.mag, 6.4);
  assert.ok(sequence.foreshock);
  assert.ok(sequence.foreshock.time < sequence.mainshock.time);
  assert.ok(sequence.foreshock.mag < sequence.mainshock.mag);
  assert.ok(
    distanceKm(sequence.foreshock, sequence.mainshock) <= sequence.radiusKm,
  );
  assert.equal(
    sequence.gapCount,
    sequence.events.filter(
      (event) =>
        event.time > sequence.foreshock!.time &&
        event.time < sequence.mainshock.time,
    ).length,
  );
  assert.ok(sequence.gapCount > 0);
  const aftershocks = sequence.events.filter(
    (event) => event.time > sequence.mainshock.time,
  );
  assert.ok(aftershocks.length > 0);
  const days = dailyActivity(
    aftershocks,
    sequence.mainshock.time + 1,
    sequence.end,
  );
  assert.equal(
    days.reduce((sum, day) => sum + day.count, 0),
    aftershocks.length,
  );
  const calmer = findCalmerDay(days);
  assert.ok(calmer, "the real sequence has a sustained decline to demonstrate");
  const index = days.indexOf(calmer);
  const peak = Math.max(...days.map((day) => day.count));
  assert.ok(days.slice(index, index + 3).every((day) => day.count <= peak / 4));
});

test("California formatting does not turn the evening mainshock into the next day", () => {
  const sequence = findSequence(catalog);
  assert.match(localTime(sequence.mainshock.time), /Jul 5, 2019/);
  assert.match(localTime(sequence.mainshock.time), /PDT/);
});

function event(
  id: string,
  mag: number,
  day: number,
  longitude = -117.6,
): Earthquake {
  return {
    objectId: id,
    id,
    mag,
    time: JULY_START + day * DAY,
    depth: 5,
    place: "test",
    title: "test",
    longitude,
    latitude: 35.8,
  };
}

test("an event after the largest quake is never selected as a foreshock", () => {
  const sequence = findSequence([event("main", 7, 2), event("after", 6, 3)]);
  assert.equal(sequence.foreshock, undefined);
  assert.equal(sequence.gapCount, 0);
});

test("equal magnitudes do not establish a foreshock; isolated earlier events do not qualify", () => {
  const sequence = findSequence([
    event("earlier", 5, 0, -120),
    event("main", 7, 2),
    event("equal", 7, 3),
    event("after", 4, 4),
  ]);
  assert.equal(sequence.foreshock, undefined);
});

test("empty data fails explicitly, and an empty tight cluster retries a wider radius", () => {
  assert.throws(() => findSequence([]), /no July 2019 earthquakes/);
  const wider = findSequence([
    event("main", 7, 2),
    event("near", 4, 3, -117.1),
  ]);
  assert.ok(wider.radiusKm > 25);
  assert.equal(wider.events.length, 2);
  assert.throws(() => findSequence([event("isolated", 7, 2)]), /widening/);
});

test("daily bins use California midnights and include zero-activity days", () => {
  const events = [event("late", 3, 0), event("next", 3, 1)];
  events[0]!.time = JULY_START + DAY - 1;
  const days = dailyActivity(events, JULY_START, JULY_START + 3 * DAY - 1);
  assert.deepEqual(
    days.map((day) => day.count),
    [1, 1, 0],
  );
  assert.equal(days[0]!.end + 1, days[1]!.start);
  assert.equal(findCalmerDay([]), undefined);
});

test("calm-day selection requires three full days and never labels a single dip as a trend", () => {
  const days = [100, 20, 40, 10, 20, 25].map((count, i) => ({
    start: JULY_START + i * DAY,
    end: JULY_START + (i + 1) * DAY - 1,
    count,
  }));
  assert.equal(findCalmerDay(days)?.start, days[3]!.start);
  days[5]!.end -= 1;
  assert.equal(findCalmerDay(days), undefined);
});
