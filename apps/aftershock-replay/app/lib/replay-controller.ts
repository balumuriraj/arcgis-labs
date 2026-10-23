import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import TimeExtent from "@arcgis/core/time/TimeExtent.js";
import TimeInterval from "@arcgis/core/time/TimeInterval.js";
import Point from "@arcgis/core/geometry/Point.js";
import type Graphic from "@arcgis/core/Graphic.js";
import type MapView from "@arcgis/core/views/MapView.js";
import type GeoJSONLayerView from "@arcgis/core/views/layers/GeoJSONLayerView.js";
import type { ArcgisTimeSlider } from "@arcgis/map-components/components/arcgis-time-slider";
import {
  DAY,
  JULY_START,
  JULY_END,
  TIME_ZONE,
  dailyActivity,
  findCalmerDay,
  findSequence,
  localTime,
  type Earthquake,
  type Sequence,
  type DailyActivity,
} from "./earthquakes";

export type Card =
  | { kind: "event"; sequence: Sequence }
  | { kind: "playback" }
  | { kind: "foreshock"; sequence: Sequence }
  | {
      kind: "daily";
      days: DailyActivity[];
      calmer?: DailyActivity;
      count: number;
      largest?: number;
      minimum: number;
    }
  | {
      kind: "filter";
      min: number;
      max: number;
      current: number;
      status: "pending" | "applied" | "cancelled";
    };

export type Action =
  | "find"
  | "replay"
  | "before"
  | "gap"
  | "daily"
  | "filter"
  | "stats";
export type ActionResult = { text: string; cardId?: string };
export type ReplaySnapshot = {
  start: number;
  end: number;
  count: number;
  largest?: number;
  playing: boolean;
  mode: "instant" | "time-window" | "cumulative-from-start";
  minimum: number;
  updating: boolean;
  speed: number;
};

function earthquakeFromGraphic(
  feature: Graphic,
  objectIdField: string,
): Earthquake {
  const attrs: Record<string, unknown> = feature.attributes;
  const point = feature.geometry;
  if (!point || point.type !== "point")
    throw new Error("Earthquake layer contains a non-point feature.");
  const number = (key: string) => {
    const value = attrs[key];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(`Invalid earthquake field: ${key}.`);
    return value;
  };
  const string = (key: string) => {
    const value = attrs[key];
    if (typeof value !== "string")
      throw new Error(`Invalid earthquake field: ${key}.`);
    return value;
  };
  const objectId = attrs[objectIdField];
  if (typeof objectId !== "string" && typeof objectId !== "number")
    throw new Error("Invalid earthquake object ID.");
  return {
    objectId,
    id: string("id"),
    mag: number("mag"),
    time: number("time"),
    depth: number("depth"),
    place: string("place"),
    title: string("title"),
    longitude: point.longitude ?? point.x,
    latitude: point.latitude ?? point.y,
  };
}

export class ReplayController {
  readonly layer = new GeoJSONLayer({
    url: "/ridgecrest-2019-07.geojson",
    title: "USGS Ridgecrest - July 2019 (M1.5+ snapshot)",
    outFields: ["*"],
    fields: [
      { name: "id", type: "string" },
      { name: "mag", type: "double" },
      { name: "place", type: "string" },
      { name: "time", type: "date" },
      { name: "depth", type: "double" },
      { name: "title", type: "string" },
    ],
    timeInfo: { startField: "time", interval: { value: 1, unit: "days" } },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-marker",
        color: "#d97732",
        outline: { color: "white", width: 0.5 },
      },
      visualVariables: [
        {
          type: "size",
          field: "mag",
          stops: [
            { value: 1.5, size: 3 },
            { value: 4, size: 10 },
            { value: 7, size: 25 },
          ],
        },
        {
          type: "color",
          field: "mag",
          stops: [
            { value: 1.5, color: "#e8b35c" },
            { value: 5, color: "#d65532" },
            { value: 7, color: "#9b2226" },
          ],
        },
      ],
    },
    popupTemplate: {
      title: "{title}",
      content: (event) => {
        const attrs = event.graphic?.attributes;
        const node = document.createElement("p");
        node.textContent = attrs
          ? `${localTime(attrs.time)} | Depth ${attrs.depth} km`
          : "Event details unavailable.";
        return node;
      },
    },
  });
  readonly cards = new Map<string, Card>();
  private sequence?: Sequence;
  private catalog: Earthquake[] = [];
  private layerView?: GeoJSONLayerView;
  private highlight?: { remove(): void };
  private listeners = new Set<() => void>();
  private requestVersion = 0;
  private destroyed = false;
  private failure?: string;
  private handleChange = () => {
    void this.syncTime().catch(this.reportError);
  };
  private snapshot: ReplaySnapshot = {
    start: JULY_START,
    end: JULY_END,
    count: 0,
    playing: false,
    mode: "time-window",
    minimum: 0,
    updating: false,
    speed: 1,
  };

  constructor(
    readonly view: MapView,
    readonly slider: ArcgisTimeSlider,
    readonly reportError: (error: unknown) => void,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(value: Partial<ReplaySnapshot>) {
    if (this.destroyed) return;
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }

  async initialize() {
    try {
      this.view.map?.add(this.layer);
      await this.layer.load();
      const result = await this.layer.queryFeatures({
        where: "1=1",
        outFields: ["*"],
        returnGeometry: true,
        outSpatialReference: { wkid: 4326 },
      });
      if (result.exceededTransferLimit)
        throw new Error(
          "Earthquake query was truncated; refusing to infer a sequence.",
        );
      this.catalog = result.features.map((feature) =>
        earthquakeFromGraphic(feature, this.layer.objectIdField),
      );
      if (!this.catalog.length)
        throw new Error("The earthquake layer is empty.");
      this.layerView = await this.view.whenLayerView(this.layer);
      if (this.destroyed) return;
      this.view.timeZone = TIME_ZONE;
      this.slider.timeZone = TIME_ZONE;
      this.slider.fullTimeExtent = new TimeExtent({
        start: new Date(JULY_START),
        end: new Date(JULY_END),
      });
      this.slider.mode = "time-window";
      this.slider.timeExtent = this.slider.fullTimeExtent.clone();
      this.slider.stops = {
        interval: new TimeInterval({ value: 1, unit: "days" }),
      };
      this.slider.loop = false;
      this.slider.playRate = 1200;
      this.slider.addEventListener("arcgisPropertyChange", this.handleChange);
      this.update({
        minimum: Math.min(...this.catalog.map((event) => event.mag)),
      });
      await this.syncTime();
    } catch (error) {
      this.failure = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private requireReady() {
    if (this.failure)
      throw new Error(
        `The earthquake layer failed to load: ${this.failure}. I cannot answer from unavailable data.`,
      );
    if (!this.catalog.length || !this.layerView || this.destroyed)
      throw new Error(
        "The earthquake layer is not ready. Please wait for it to load.",
      );
  }

  private async query(start: number, end: number, useMinimum = true) {
    this.requireReady();
    const result = await this.layer.queryFeatures({
      where: useMinimum ? `mag >= ${this.snapshot.minimum}` : "1=1",
      objectIds: this.sequence?.events.map((event) => event.objectId),
      timeExtent: new TimeExtent({
        start: new Date(start),
        end: new Date(end),
      }),
      outFields: ["*"],
      returnGeometry: true,
      outSpatialReference: { wkid: 4326 },
    });
    if (result.exceededTransferLimit)
      throw new Error(
        "Earthquake query was truncated. Results cannot be trusted.",
      );
    return result.features.map((feature) =>
      earthquakeFromGraphic(feature, this.layer.objectIdField),
    );
  }

  async syncTime() {
    if (!this.catalog.length || this.destroyed || !this.slider.timeExtent)
      return;
    const full = this.slider.fullTimeExtent;
    const extent = this.slider.timeExtent;
    const start =
      extent.start?.getTime() ?? full?.start?.getTime() ?? JULY_START;
    const end = extent.end?.getTime() ?? full?.end?.getTime() ?? JULY_END;
    const version = ++this.requestVersion;
    const mode = this.slider.mode;
    this.update({
      start,
      end,
      playing: this.slider.state === "playing",
      updating: true,
      mode:
        mode === "instant" || mode === "cumulative-from-start"
          ? mode
          : "time-window",
    });
    const events = await this.query(start, end);
    if (version !== this.requestVersion || this.destroyed) return;
    this.update({
      count: events.length,
      largest: events.length
        ? Math.max(...events.map((event) => event.mag))
        : undefined,
      updating: false,
    });
  }

  private async setSequence() {
    this.requireReady();
    this.sequence ??= findSequence(this.catalog);
    this.applyMapFilter();
    return this.sequence;
  }

  private applyMapFilter() {
    if (!this.layerView) return;
    this.layerView.filter = new FeatureFilter({
      where: `mag >= ${this.snapshot.minimum}`,
      objectIds: this.sequence?.events.map((event) => event.objectId),
      // Cumulative sliders emit a null start to the view; bound the replay origin.
      timeExtent: this.slider.fullTimeExtent?.clone(),
    });
  }

  private addCard(card: Card) {
    const id = crypto.randomUUID();
    this.cards.set(id, card);
    return id;
  }

  async window(
    start: number,
    end: number,
    mode: ReplaySnapshot["mode"] = "time-window",
  ) {
    this.requireReady();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      start < JULY_START ||
      end > JULY_END
    ) {
      throw new Error(
        "Choose an ordered time window within July 2019 in California local time.",
      );
    }
    await this.slider.stop();
    this.highlight?.remove();
    this.slider.stops = null;
    this.slider.fullTimeExtent = new TimeExtent({
      start: new Date(mode === "cumulative-from-start" ? start : JULY_START),
      end: new Date(JULY_END),
    });
    this.slider.mode = mode;
    this.slider.timeExtent = new TimeExtent({
      start: mode === "cumulative-from-start" ? null : new Date(start),
      end: new Date(mode === "instant" ? start : end),
    });
    const stops = new Set([JULY_START, JULY_END, start, end]);
    for (let day = JULY_START; day <= JULY_END; day += DAY) stops.add(day);
    this.slider.stops = {
      dates: [...stops].sort((a, b) => a - b).map((time) => new Date(time)),
    };
    this.applyMapFilter();
    await this.syncTime();
  }

  async playback(start: number, end: number) {
    await this.window(start, start, "cumulative-from-start");
    this.slider.fullTimeExtent = new TimeExtent({
      start: new Date(start),
      end: new Date(end),
    });
    this.applyMapFilter();
    // Exact event instants at either edge plus local midnights in between.
    const stops = [new Date(start)];
    for (
      let time = JULY_START + Math.ceil((start - JULY_START) / DAY) * DAY;
      time < end;
      time += DAY
    ) {
      if (time > start) stops.push(new Date(time));
    }
    stops.push(new Date(end));
    this.slider.stops = { dates: stops };
    await this.slider.play();
    await this.syncTime();
  }

  async jump(event: Earthquake) {
    // A selected event must not remain invisible behind an earlier magnitude filter.
    if (this.snapshot.minimum > event.mag) {
      throw new Error(
        "This event is hidden by the magnitude filter. Lower the filter using the confirmation card first.",
      );
    }
    await this.window(event.time, event.time, "instant");
    this.highlight?.remove();
    this.highlight = this.layerView?.highlight(event.objectId);
    await this.view.goTo({
      center: [event.longitude, event.latitude],
      zoom: 10,
    });
  }

  async focus(id: string) {
    this.requireReady();
    const event = this.catalog.find((candidate) => candidate.id === id);
    if (!event)
      throw new Error(
        "That event ID is not present in the local earthquake layer.",
      );
    if (
      this.sequence &&
      !this.sequence.events.some((candidate) => candidate.id === id)
    ) {
      throw new Error("That event is outside the selected sequence.");
    }
    await this.jump(event);
  }

  async toggle() {
    this.requireReady();
    if (this.slider.state === "playing") await this.slider.stop();
    else await this.slider.play();
    await this.syncTime();
  }

  async step(direction: "next" | "previous") {
    this.requireReady();
    await this.slider.stop();
    if (direction === "next") await this.slider.next();
    else await this.slider.previous();
    await this.syncTime();
  }

  speed(value: number) {
    if (![1, 2, 4].includes(value))
      throw new Error("Playback speed must be 1x, 2x, or 4x.");
    this.slider.playRate = 1200 / value;
    this.update({ speed: value });
  }

  async confirmFilter(id: string, magnitude: number) {
    const card = this.cards.get(id);
    if (card?.kind !== "filter" || card.status !== "pending")
      throw new Error("This magnitude request is no longer pending.");
    if (
      !Number.isFinite(magnitude) ||
      magnitude < card.min ||
      magnitude > card.max
    )
      throw new Error("Magnitude is outside the layer's range.");
    this.update({ minimum: magnitude });
    this.applyMapFilter();
    card.status = "applied";
    await this.syncTime();
  }

  cancelFilter(id: string) {
    const card = this.cards.get(id);
    if (card?.kind !== "filter" || card.status !== "pending")
      throw new Error("This magnitude request is no longer pending.");
    card.status = "cancelled";
  }

  async action(action: Action): Promise<ActionResult> {
    this.requireReady();
    if (action === "filter") {
      // A newer request supersedes any older, still-pending approval card.
      for (const card of this.cards.values())
        if (card.kind === "filter" && card.status === "pending")
          card.status = "cancelled";
      const magnitudes = this.catalog.map((event) => event.mag);
      return {
        text: "Choose a minimum magnitude and confirm before the map changes.",
        cardId: this.addCard({
          kind: "filter",
          min: Math.min(...magnitudes),
          max: Math.max(...magnitudes),
          current: this.snapshot.minimum,
          status: "pending",
        }),
      };
    }
    const sequence = await this.setSequence();
    if (action === "find") {
      await this.window(sequence.start, sequence.end);
      await this.view.goTo(
        sequence.events.map(
          (event) =>
            new Point({
              longitude: event.longitude,
              latitude: event.latitude,
            }),
        ),
      );
      this.highlight?.remove();
      this.highlight = this.layerView?.highlight(sequence.mainshock.objectId);
      return {
        text: "I found the largest nearby sequence in this catalog. Explore its lead-up or replay what followed.",
        cardId: this.addCard({ kind: "event", sequence }),
      };
    }
    if (action === "before") {
      if (!sequence.foreshock)
        return {
          text: "No significant foreshock was found in this catalog's nearby July events.",
        };
      await this.window(sequence.foreshock.time, sequence.mainshock.time);
      return {
        text: "The earlier large quake is a foreshock because a larger earthquake followed nearby; this is a retrospective label.",
        cardId: this.addCard({ kind: "foreshock", sequence }),
      };
    }
    if (action === "replay" || action === "gap") {
      if (action === "gap" && !sequence.foreshock)
        throw new Error("No foreshock is available to replay.");
      const start =
        action === "gap"
          ? sequence.foreshock!.time
          : sequence.mainshock.time + 1;
      await this.playback(
        start,
        action === "gap" ? sequence.mainshock.time : sequence.end,
      );
      return {
        text:
          action === "gap"
            ? "Watch the activity between the two events."
            : "The map and this card follow the same timeline; drag the slider to explore.",
        cardId: this.addCard({ kind: "playback" }),
      };
    }
    const start =
      action === "stats" ? this.snapshot.start : sequence.mainshock.time + 1;
    const end = action === "stats" ? this.snapshot.end : sequence.end;
    let events = await this.query(start, end);
    let broadened = false;
    if (!events.length) {
      events = await this.query(sequence.start, sequence.end);
      broadened = true;
    }
    if (!events.length)
      return {
        text: "The broader July query is also empty at this magnitude filter. Lower the filter to explore more events.",
      };
    const days = dailyActivity(
      events,
      broadened ? sequence.start : start,
      broadened ? sequence.end : end,
    );
    const calmer = action === "daily" ? findCalmerDay(days) : undefined;
    if (calmer) await this.window(calmer.start, calmer.end);
    return {
      text: broadened
        ? "That window was empty, so I widened the query to July with your magnitude filter unchanged."
        : action === "stats"
          ? "Here is the queried activity for the selected time window."
          : calmer
            ? "I moved to the first sustained drop below a quarter of peak daily activity; this describes this catalog, not earthquake safety."
            : "There is no three-day sustained drop below a quarter of the daily peak in the queried period.",
      cardId: this.addCard({
        kind: "daily",
        days,
        calmer,
        count: events.length,
        largest: Math.max(...events.map((event) => event.mag)),
        minimum: this.snapshot.minimum,
      }),
    };
  }

  context() {
    return JSON.stringify({
      source:
        "Only the local USGS Ridgecrest July 2019 GeoJSON layer; snapshot limited to magnitude 1.5+ and its bounding box.",
      status: this.failure ?? (this.catalog.length ? "ready" : "loading"),
      timeZone: TIME_ZONE,
      window: this.snapshot,
      sequenceRadiusKm: this.sequence?.radiusKm,
      mainshockId: this.sequence?.mainshock.id,
      foreshockId: this.sequence?.foreshock?.id,
    });
  }

  destroy() {
    this.destroyed = true;
    this.requestVersion++;
    this.slider.removeEventListener("arcgisPropertyChange", this.handleChange);
    this.highlight?.remove();
    this.listeners.clear();
    this.view.map?.remove(this.layer);
    this.layer.destroy();
  }
}
