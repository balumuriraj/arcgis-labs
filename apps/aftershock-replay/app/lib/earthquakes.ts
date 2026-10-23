export const TIME_ZONE = "America/Los_Angeles";
export const DAY = 86_400_000;
export const JULY_START = Date.parse("2019-07-01T00:00:00-07:00");
export const JULY_END = Date.parse("2019-08-01T00:00:00-07:00") - 1;

export type Earthquake = {
  objectId: number | string;
  id: string;
  mag: number;
  place: string;
  time: number;
  depth: number;
  title: string;
  longitude: number;
  latitude: number;
};
export type DailyActivity = { start: number; end: number; count: number };
export type Sequence = {
  mainshock: Earthquake;
  foreshock?: Earthquake;
  events: Earthquake[];
  gapCount: number;
  radiusKm: number;
  start: number;
  end: number;
};

export function localTime(time: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(time);
}

export function localDay(time: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(time);
}

export function distanceKm(a: Earthquake, b: Earthquake) {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function findSequence(catalog: Earthquake[]): Sequence {
  const july = catalog.filter(
    (event) => event.time >= JULY_START && event.time <= JULY_END,
  );
  const mainshock = july.reduce<Earthquake | undefined>(
    (largest, event) => (!largest || event.mag > largest.mag ? event : largest),
    undefined,
  );
  if (!mainshock)
    throw new Error(
      "The layer contains no July 2019 earthquakes. No sequence can be inferred.",
    );
  // Widen the spatial search when a tight radius produces no neighboring events.
  let radiusKm = 25;
  let events: Earthquake[] = [];
  for (const radius of [25, 50, 100]) {
    radiusKm = radius;
    events = july.filter((event) => distanceKm(mainshock, event) <= radius);
    if (events.length > 1) break;
  }
  if (events.length < 2)
    throw new Error(
      "No nearby sequence found after widening the search to 100 km.",
    );
  events.sort((a, b) => a.time - b.time);
  const foreshock = events
    .filter(
      (event) =>
        event.time < mainshock.time &&
        event.mag < mainshock.mag &&
        event.mag >= 4,
    )
    .reduce<
      Earthquake | undefined
    >((largest, event) => (!largest || event.mag > largest.mag ? event : largest), undefined);
  return {
    mainshock,
    foreshock,
    events,
    radiusKm,
    gapCount: foreshock
      ? events.filter(
          (event) => event.time > foreshock.time && event.time < mainshock.time,
        ).length
      : 0,
    start: JULY_START,
    end: JULY_END,
  };
}

export function dailyActivity(
  events: Earthquake[],
  start: number,
  end: number,
): DailyActivity[] {
  // The snapshot is July 2019 (PDT throughout); local midnight is UTC 07:00.
  const midnight = JULY_START + Math.floor((start - JULY_START) / DAY) * DAY;
  const days: DailyActivity[] = [];
  for (let day = midnight; day <= end; day += DAY) {
    days.push({
      start: day,
      end: Math.min(day + DAY - 1, end),
      count: events.filter(
        (event) =>
          event.time >= Math.max(day, start) &&
          event.time <= Math.min(day + DAY - 1, end),
      ).length,
    });
  }
  return days;
}

export function findCalmerDay(
  days: DailyActivity[],
): DailyActivity | undefined {
  const peak = days.reduce<DailyActivity | undefined>(
    (best, day) => (!best || day.count > best.count ? day : best),
    undefined,
  );
  if (!peak || peak.count === 0) return undefined;
  // Require three consecutive complete days below one quarter of the peak.
  return days.find(
    (day, index) =>
      day.start > peak.start &&
      index + 2 < days.length &&
      days
        .slice(index, index + 3)
        .every(
          (candidate) =>
            candidate.count <= peak.count / 4 &&
            candidate.end - candidate.start === DAY - 1,
        ),
  );
}
