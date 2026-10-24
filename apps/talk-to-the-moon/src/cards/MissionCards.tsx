/* eslint-disable @next/next/no-img-element -- Calcite thumbnails need a plain img. */
import { OUTCOME_LABEL, findLaunchSite, findMission, flagUrl, formatDate, isFarSide, yearOf, type Country, type Mission } from "../data";
import { photoFor } from "../extras/photos";
import type { MoonApp } from "../map/controller";
import type { CardData } from "./Cards";
import { Metric } from "./Metric";

const outcomeText = (m: Mission) => (m.partial ? `${OUTCOME_LABEL[m.outcome]}, partly` : OUTCOME_LABEL[m.outcome]);

export function Flag({ country }: { country: Country }) {
  return <img src={flagUrl(country)} width={15} height={11} alt={country} title={country} />;
}

export function MissionCard({ app, data }: { app: MoonApp; data: CardData["mission-card"] }) {
  const m = findMission(app.data, data.id);
  const launchSite = findLaunchSite(app.data, m.launchSiteId);
  const sharedWith = m.rideshare ? findMission(app.data, m.rideshare).name : undefined;
  return (
    <calcite-card>
      <h3 slot="heading">{m.name}</h3>
      <span slot="description">
        {formatDate(m.arrivalDate)}. {outcomeText(m)}
        {m.site ? ` in ${m.site}` : ""}
        {isFarSide(m) ? ", on the far side" : ""}.
      </span>
      <calcite-chip scale="s" label={m.country}>
        <Flag country={m.country} /> {m.operator ? `${m.operator}, ${m.country}` : m.country}
      </calcite-chip>
      <br />
      <SitePhoto mission={m} />
      <br />
      <calcite-table caption={`${m.name} details`} scale="s">
        {m.crew ? <Metric label="On the surface" value={m.crew.join(" and ")} /> : null}
        {m.orbitingCrew ? <Metric label="In orbit" value={m.orbitingCrew} /> : null}
        <Metric label="Launched" value={formatDate(m.launchDate)} />
        <Metric label="Launch site" value={launchSite.name} />
        <Metric label="Rocket" value={m.vehicle} />
        {sharedWith ? <Metric label="Shared rocket with" value={sharedWith} /> : null}
        {m.rover ? <Metric label="Rover" value={m.rover} /> : null}
      </calcite-table>
      {m.note ? <p>{m.note}</p> : null}
      {m.partial ? <p>{m.partial}</p> : null}
      {m.approximate ? <p>Location is approximate; the exact spot hasn&apos;t been confirmed from orbit.</p> : null}
    </calcite-card>
  );
}

export function MissionListCard({ app, data }: { app: MoonApp; data: CardData["mission-list"] }) {
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
              description={`${m.country}, ${yearOf(m)}. ${outcomeText(m)}`}
              onClick={() => visit(app, m)}
            >
              <span slot="content-start">
                <Flag country={m.country} />
              </span>
              <calcite-action slot="actions-end" icon="arrow-down" text={`Visit ${m.name}`} scale="s" />
            </calcite-list-item>
          ))}
        </calcite-list>
      ) : (
        <p>Nothing matches.</p>
      )}
    </calcite-card>
  );
}

function visit(app: MoonApp, m: Mission) {
  app.visit(m).catch((error: unknown) => console.error(`Could not visit ${m.name}:`, error));
}

/** The site seen from lunar orbit, with LROC's image details and credit. */
function SitePhoto({ mission }: { mission: Mission }) {
  const p = photoFor(mission.id);
  if (!p) return null;
  return (
    <calcite-card label={`${mission.name} site photo`}>
      <img
        slot="thumbnail"
        src={`/photos/${mission.id}.jpg`}
        alt={`${mission.name} site from lunar orbit, ${formatDate(p.date)}`}
        loading="lazy"
      />
      <span slot="description">
        {mission.name} site from orbit, {formatDate(p.date)}: {p.altitudeKm} km up, {p.metersPerPixel} m per pixel.
        LROC image {p.imageId}, NASA/GSFC/Arizona State University.
      </span>
      <calcite-link slot="footer-start" href={p.page} target="_blank" rel="noopener">
        View original LROC image
      </calcite-link>
    </calcite-card>
  );
}
