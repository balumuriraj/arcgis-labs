import { FEATURE_TYPES, type Feature } from "../data";
import type { MarsApp } from "../map/controller";
import type { CardData } from "./Cards";
import { Metric } from "./Metric";

const fmt = (n: number) => n.toLocaleString("en-US");

/** "Crater" stays as is; other types get their meaning: "Mons (mountain or volcano)". */
const typeText = (f: Feature) =>
  f.type === "Crater" || !FEATURE_TYPES[f.type]
    ? f.type
    : `${f.type} (${FEATURE_TYPES[f.type]})`;

const sizeLabel = (f: Feature) =>
  f.type === "Crater" ? "Diameter" : "Size (longest extent)";

export function FeatureCard({ data: f }: { data: CardData["feature-card"] }) {
  return (
    <calcite-card>
      <h3 slot="heading">{f.name}</h3>
      <span slot="description">{typeText(f)}</span>
      {f.diameterKm >= 0.5 ? (
        <calcite-table caption="Size" scale="s">
          <Metric
            label={sizeLabel(f)}
            value={`${fmt(Math.round(f.diameterKm))} km`}
          />
        </calcite-table>
      ) : null}
      {f.origin ? <p>Named after: {f.origin}</p> : null}
      {f.yearApproved ? <p>Name approved in {f.yearApproved}.</p> : null}
    </calcite-card>
  );
}

export function FeatureListCard({
  app,
  data: { title, total, items, from },
}: {
  app: MarsApp;
  data: CardData["feature-list"];
}) {
  return (
    <calcite-card>
      <h3 slot="heading">{title}</h3>
      <span slot="description">
        {total > items.length
          ? `${items.length} of ${fmt(total)}`
          : `${items.length} found`}
      </span>
      {from ? (
        <p>
          Approximate surface distances from {from} to feature centers, not
          their edges.
        </p>
      ) : null}
      {items.length ? (
        <calcite-list label={title} selection-mode="none" scale="s">
          {items.map((f) => {
            const details = [
              f.type,
              f.diameterKm >= 0.5 ? `${fmt(Math.round(f.diameterKm))} km` : "",
              f.km !== undefined ? `${fmt(f.km)} km away` : "",
            ].filter(Boolean);
            return (
              <calcite-list-item
                key={f.name}
                label={f.name}
                description={details.join(". ")}
                onClick={() => app.ask(`Tell me about ${f.name}`)}
              >
                <calcite-action
                  slot="actions-end"
                  icon="speech-bubble"
                  text={`Ask about ${f.name}`}
                  scale="s"
                />
              </calcite-list-item>
            );
          })}
        </calcite-list>
      ) : (
        <p>Nothing matches.</p>
      )}
    </calcite-card>
  );
}

export function ObjectCard({
  app,
  data: d,
}: {
  app: MarsApp;
  data: CardData["object-card"];
}) {
  return (
    <calcite-card>
      <h3 slot="heading">
        {d.name} in {d.at}, true scale
      </h3>
      <calcite-table caption="Size comparison" scale="s">
        <Metric label="Height" value={`${fmt(d.heightM)} m`} />
        <Metric label="Width" value={`${fmt(Math.round(d.widthM))} m`} />
        {d.featureSizeKm !== undefined ? (
          <Metric
            label={`Size of ${d.at}`}
            value={`${fmt(d.featureSizeKm)} km`}
          />
        ) : null}
      </calcite-table>
      <p>
        {d.featureWiderThanTallBy !== undefined
          ? `${d.at} is about ${fmt(d.featureWiderThanTallBy)} times wider than ${d.name} is tall.`
          : "Shown next to the site at true size."}
      </p>
      <p>
        <small>
          An outline at true size. {d.name}&apos;s size is the guide&apos;s
          figure, not from this app&apos;s data.
        </small>
      </p>
      <calcite-button
        width="full"
        appearance="transparent"
        icon-start="x"
        scale="s"
        onClick={() => app.ask("Clear the map")}
      >
        Remove it
      </calcite-button>
    </calcite-card>
  );
}

export function RouteCard({
  app,
  data: d,
}: {
  app: MarsApp;
  data: CardData["route-card"];
}) {
  return (
    <calcite-card>
      <h3 slot="heading">Where {d.rover} has driven</h3>
      <span slot="description">
        From the mission team&apos;s traverse map, as of {d.retrieved}.
      </span>
      <calcite-table caption="Route" scale="s">
        <Metric label="Distance driven" value={`${fmt(d.drivenKm)} km`} />
        <Metric label="Drives" value={fmt(d.drives)} />
        {d.lastSol !== null ? (
          <Metric label="Latest drive" value={`Sol ${fmt(d.lastSol)}`} />
        ) : null}
      </calcite-table>
      <calcite-link
        slot="footer-start"
        href={d.source}
        target="_blank"
        rel="noopener"
      >
        NASA/JPL-Caltech traverse data
      </calcite-link>
      <calcite-button
        slot="footer-end"
        appearance="transparent"
        icon-start="pin"
        scale="s"
        onClick={() => app.ask(`Take me to ${d.rover}'s landing site`)}
      >
        Landing site
      </calcite-button>
    </calcite-card>
  );
}
