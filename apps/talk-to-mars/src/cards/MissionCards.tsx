/* eslint-disable @next/next/no-img-element -- Calcite chips need a plain img. */
import {
  OUTCOME_LABEL,
  findLaunchSite,
  findMission,
  flagUrl,
  formatDate,
  yearOf,
  type Country,
  type Mission,
} from "../data";
import type { MarsApp } from "../map/controller";
import { TRAVERSE_MISSIONS } from "../map/traverses";
import type { CardData } from "./Cards";
import { Metric } from "./Metric";

export function Flag({ country }: { country: Country }) {
  return (
    <img
      src={flagUrl(country)}
      width={15}
      height={11}
      alt={country}
      title={country}
    />
  );
}

export function MissionCard({
  app,
  data,
}: {
  app: MarsApp;
  data: CardData["mission-card"];
}) {
  const m = findMission(app.data, data.id);
  const launchSite = findLaunchSite(app.data, m.launchSiteId);
  const sharedWith = m.rideshare
    ? findMission(app.data, m.rideshare).name
    : undefined;
  const hasRoute = (TRAVERSE_MISSIONS as readonly string[]).includes(m.id);
  return (
    <calcite-card>
      <h3 slot="heading">{m.name}</h3>
      <span slot="description">
        {formatDate(m.arrivalDate)}. {OUTCOME_LABEL[m.outcome]} in {m.site}.
      </span>
      <calcite-chip scale="s" label={m.country}>
        <Flag country={m.country} /> {m.operator}
      </calcite-chip>
      <br />
      <calcite-table caption={`${m.name} details`} scale="s">
        {m.rover ? <Metric label="Rover" value={m.rover} /> : null}
        <Metric label="Launched" value={formatDate(m.launchDate)} />
        <Metric label="Launch site" value={launchSite.name} />
        <Metric label="Rocket" value={m.vehicle} />
        {sharedWith ? (
          <Metric label="Shared rocket with" value={sharedWith} />
        ) : null}
      </calcite-table>
      {m.note ? <p>{m.note}</p> : null}
      {m.approximate ? (
        <p>
          Location is approximate; the exact spot hasn&apos;t been confirmed
          from orbit.
        </p>
      ) : null}
      {hasRoute ? (
        <calcite-button
          slot="footer-start"
          appearance="transparent"
          icon-start="line"
          scale="s"
          onClick={() => app.ask(`Show where ${m.name} has driven`)}
        >
          Show the route
        </calcite-button>
      ) : null}
    </calcite-card>
  );
}

export function MissionListCard({
  app,
  data,
}: {
  app: MarsApp;
  data: CardData["mission-list"];
}) {
  const missions = data.ids.map((id) => findMission(app.data, id));
  return (
    <calcite-card>
      <h3 slot="heading">{data.title}</h3>
      <span slot="description">{missions.length} found</span>
      {missions.length ? (
        <calcite-list label={data.title} selection-mode="none" scale="s">
          {missions.map((m) => (
            <calcite-list-item
              key={m.id}
              label={m.name}
              description={`${m.country}, ${yearOf(m)}. ${OUTCOME_LABEL[m.outcome]}`}
              onClick={() => visit(app, m)}
            >
              <span slot="content-start">
                <Flag country={m.country} />
              </span>
              <calcite-action
                slot="actions-end"
                icon="arrow-down"
                text={`Visit ${m.name}`}
                scale="s"
              />
            </calcite-list-item>
          ))}
        </calcite-list>
      ) : (
        <p>Nothing matches.</p>
      )}
    </calcite-card>
  );
}

function visit(app: MarsApp, m: Mission) {
  app
    .visit(m)
    .catch((error: unknown) =>
      console.error(`Could not visit ${m.name}:`, error),
    );
}
