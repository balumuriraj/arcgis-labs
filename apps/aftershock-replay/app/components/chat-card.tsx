import "@esri/calcite-components/components/calcite-card";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-slider";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-chip";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-meter";

import { useState, useSyncExternalStore } from "react";
import { localDay, localTime, type Earthquake } from "../lib/earthquakes";
import type { Action, Card, ReplayController } from "../lib/replay-controller";

type Props = {
  cardId: string;
  slotName: string;
  controller: ReplayController;
  onAction: (action: Action) => Promise<void>;
};

export function ChatCard({ cardId, slotName, controller, onAction }: Props) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const card = controller.cards.get(cardId);
  const [busy, setBusy] = useState(false);
  const [magnitude, setMagnitude] = useState(
    card?.kind === "filter" ? card.current : snapshot.minimum,
  );
  const [selectedDay, setSelectedDay] = useState<number>();
  const [, render] = useState(0);
  if (!card) return null;

  const run = async (work: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      controller.reportError(error);
    } finally {
      setBusy(false);
      render((value) => value + 1);
    }
  };
  const actionButton = (action: Action, label: string) => (
    <calcite-button
      width="full"
      disabled={busy}
      onClick={() => void run(() => onAction(action))}
    >
      {label}
    </calcite-button>
  );

  const eventRow = (event: Earthquake, mainshock: boolean) => (
    <calcite-button
      width="full"
      appearance="outline"
      disabled={busy}
      onClick={() => void run(() => controller.jump(event))}
    >
      {mainshock ? "Mainshock" : "Foreshock"}: M{event.mag.toFixed(1)}
      <br />
      {localTime(event.time)}
      <br />
      Depth {event.depth.toLocaleString()} km
    </calcite-button>
  );

  const heading: Record<Card["kind"], string> = {
    event: "Largest earthquake in the sequence",
    playback: "Replay",
    foreshock: "Before the mainshock",
    daily: "Daily activity",
    filter: "Confirm magnitude filter",
  };

  return (
    <div slot={slotName}>
      <calcite-card>
        <span slot="heading">{heading[card.kind]}</span>
        {card.kind === "event" ? (
          <>
            <div>
              <strong>M{card.sequence.mainshock.mag.toFixed(1)}</strong>
              <p>{localTime(card.sequence.mainshock.time)}</p>
              <p>{card.sequence.mainshock.place}</p>
              <p>Depth {card.sequence.mainshock.depth.toLocaleString()} km</p>
              <small>
                Nearby July cluster; historical catalog snapshot only.
              </small>
            </div>
            <div slot="footer-start">
              {actionButton("replay", "Replay aftershocks")}
              {actionButton("before", "What happened before?")}
            </div>
          </>
        ) : null}
        {card.kind === "playback" ? (
          <>
            <div>
              <p aria-live="polite" aria-atomic="true">
                <strong>
                  {snapshot.updating
                    ? "Updating..."
                    : snapshot.count.toLocaleString()}{" "}
                  events
                </strong>
                {" | "}
                {localDay(snapshot.end)}
              </p>
              <small>
                {snapshot.mode === "cumulative-from-start"
                  ? "Accumulated"
                  : snapshot.mode === "instant"
                    ? "Single moment"
                    : "Selected window"}{" "}
                | M{snapshot.minimum.toFixed(1)}+
              </small>
              <calcite-label>
                Speed
                <calcite-select
                  label="Replay speed"
                  value={String(snapshot.speed)}
                  oncalciteSelectChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    controller.speed(value);
                  }}
                >
                  {[1, 2, 4].map((value) => (
                    <calcite-option
                      key={value}
                      value={String(value)}
                      selected={snapshot.speed === value}
                    >
                      {value}x
                    </calcite-option>
                  ))}
                </calcite-select>
              </calcite-label>
            </div>
            <div slot="footer-start">
              <calcite-button
                disabled={busy}
                onClick={() => void run(() => controller.toggle())}
              >
                {snapshot.playing ? "Pause" : "Play"}
              </calcite-button>
              {actionButton("before", "What happened before?")}
              <calcite-button
                appearance="outline"
                disabled={busy}
                onClick={() => void run(() => controller.step("previous"))}
              >
                Previous day
              </calcite-button>
              <calcite-button
                appearance="outline"
                disabled={busy}
                onClick={() => void run(() => controller.step("next"))}
              >
                Next day
              </calcite-button>
              {actionButton("daily", "When did it calm down?")}
              {actionButton("filter", "Filter magnitude")}
            </div>
          </>
        ) : null}
        {card.kind === "foreshock" && card.sequence.foreshock ? (
          <>
            <div>
              {eventRow(card.sequence.foreshock, false)}
              <p>
                {(
                  (card.sequence.mainshock.time -
                    card.sequence.foreshock.time) /
                  3_600_000
                ).toFixed(2)}{" "}
                hours apart
              </p>
              <p>
                {card.sequence.gapCount.toLocaleString()} events strictly
                between them
              </p>
              <calcite-chip kind="brand" label="Mainshock">
                Mainshock
              </calcite-chip>
              {eventRow(card.sequence.mainshock, true)}
              <small>
                Unfiltered sequence evidence. Click a row to jump to its exact
                time.
              </small>
            </div>
            <div slot="footer-start">
              {actionButton("gap", "Play the gap")}
              {actionButton("replay", "Compare aftershocks")}
            </div>
          </>
        ) : null}
        {card.kind === "daily" ? (
          <>
            <div>
              <p>
                {card.count.toLocaleString()} events | Largest M
                {card.largest?.toFixed(1)} | M{card.minimum.toFixed(1)}+
              </p>
              <DailyChart
                card={card}
                onSelect={(index) => {
                  const day = card.days[index];
                  if (!day) return;
                  setSelectedDay(index);
                  void run(() => controller.window(day.start, day.end));
                }}
              />
              <p aria-live="polite">
                {selectedDay !== undefined && card.days[selectedDay]
                  ? `${localDay(card.days[selectedDay].start)}: ${card.days[selectedDay].count.toLocaleString()} events`
                  : "Choose a bar to explore that California day."}
              </p>
              {card.calmer ? (
                <p>First sustained drop: {localDay(card.calmer.start)}</p>
              ) : null}
              <small>
                A sustained drop means three full days at or below 25% of this
                period&apos;s peak daily count. First/last days may be partial;
                only full days qualify. This is not a safety assessment.
              </small>
            </div>
            <div slot="footer-start">
              {actionButton("replay", "Replay aftershocks")}
              {actionButton("filter", "Filter magnitude")}
            </div>
          </>
        ) : null}
        {card.kind === "filter" ? (
          <div>
            <calcite-label>
              Minimum magnitude: M{magnitude.toFixed(1)}
              <calcite-slider
                label="Minimum earthquake magnitude"
                min={card.min}
                max={card.max}
                step={0.1}
                value={magnitude}
                disabled={busy || card.status !== "pending"}
                labelHandles
                oncalciteSliderInput={(event) => {
                  const value = event.currentTarget.value;
                  if (typeof value === "number") setMagnitude(value);
                }}
              />
            </calcite-label>
            <small>
              Applies to the map and subsequent activity queries. Sequence
              identification stays based on the full catalog.
            </small>
            {card.status === "pending" ? (
              <div>
                <calcite-button
                  disabled={busy}
                  onClick={() =>
                    void run(() => controller.confirmFilter(cardId, magnitude))
                  }
                >
                  Apply filter
                </calcite-button>
                <calcite-button
                  appearance="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(() => controller.cancelFilter(cardId))
                  }
                >
                  Cancel
                </calcite-button>
              </div>
            ) : (
              <p role="status">
                {card.status === "applied"
                  ? `Applied: M${magnitude.toFixed(1)}+`
                  : "Cancelled; no change applied."}
              </p>
            )}
          </div>
        ) : null}
      </calcite-card>
    </div>
  );
}

function DailyChart({
  card,
  onSelect,
}: {
  card: Extract<Card, { kind: "daily" }>;
  onSelect: (index: number) => void;
}) {
  const max = Math.max(1, ...card.days.map((day) => day.count));
  return (
    <calcite-list
      label="Earthquakes per California day"
      selection-mode="single-persist"
    >
      {card.days.map((day, index) => (
        <calcite-list-item
          key={day.start}
          value={String(day.start)}
          label={localDay(day.start)}
          description={`${day.count.toLocaleString()} events`}
          oncalciteListItemSelect={(event) => {
            if (event.currentTarget.selected) onSelect(index);
          }}
        >
          <calcite-meter
            slot="content-bottom"
            label={`${localDay(day.start)}: ${day.count} earthquakes`}
            min={0}
            max={max}
            value={day.count}
          />
        </calcite-list-item>
      ))}
    </calcite-list>
  );
}
