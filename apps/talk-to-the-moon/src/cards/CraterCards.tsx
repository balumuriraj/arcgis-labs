import type { MoonApp } from "../map/controller";
import type { CardData } from "./Cards";
import { Metric } from "./Metric";

const fmt = (n: number) => n.toLocaleString("en-US");

export function CraterCard({
  data: crater,
}: {
  data: CardData["crater-card"];
}) {
  return (
    <calcite-card>
      <h3 slot="heading">{crater.name} crater</h3>
      {crater.diameterKm >= 0.5 ? (
        <calcite-table caption="Crater size" scale="s">
          <Metric
            label="Diameter"
            value={`${fmt(Math.round(crater.diameterKm))} km`}
          />
        </calcite-table>
      ) : null}
      {crater.origin ? <p>{crater.origin}</p> : null}
      {crater.yearApproved ? (
        <p>Name approved in {crater.yearApproved}.</p>
      ) : null}
    </calcite-card>
  );
}

export function CraterListCard({
  app,
  data: { title, total, items, from },
}: {
  app: MoonApp;
  data: CardData["crater-list"];
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
          Approximate surface distances from {from} to named crater centers, not
          crater rims.
        </p>
      ) : null}
      {items.length ? (
        <calcite-list label={title} selection-mode="none" scale="s">
          {items.map((crater) => {
            const details = [
              crater.diameterKm >= 0.5
                ? `${fmt(Math.round(crater.diameterKm))} km across`
                : "",
              crater.km !== undefined ? `${fmt(crater.km)} km away` : "",
            ].filter(Boolean);
            return (
              <calcite-list-item
                key={crater.name}
                label={crater.name}
                description={details.join(". ")}
                onClick={() => app.ask(`Tell me about ${crater.name}`)}
              >
                <calcite-action
                  slot="actions-end"
                  icon="speech-bubble"
                  text={`Ask about ${crater.name}`}
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
  app: MoonApp;
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
        {d.craterDiameterKm !== undefined ? (
          <Metric
            label="Crater diameter"
            value={`${fmt(d.craterDiameterKm)} km`}
          />
        ) : null}
      </calcite-table>
      <p>
        {d.craterWiderThanTallBy !== undefined
          ? `The crater is about ${fmt(d.craterWiderThanTallBy)} times wider than ${d.name} is tall.`
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
