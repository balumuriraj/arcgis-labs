import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";
import "@esri/calcite-components/components/calcite-button";
import { type WorldCupFixture } from "../support/utils";

export type TicketsCardData = {
  fixture: WorldCupFixture;
  tiers: {
    tier: string;
    price: number;
    availability: string;
  }[];
};

export type TicketsCardProps = {
  slotName: string;
  data?: TicketsCardData;
};

export function TicketsCard({
  slotName,
  data,
}: TicketsCardProps) {
  if (!data) {
    return null;
  }

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">
          {data.fixture.team} vs {data.fixture.opponent}
        </span>
        <span slot="description">
          {data.fixture.displayDate} · {data.fixture.city}
        </span>
        <calcite-list selection-mode="single" label="Ticket tiers">
          {data.tiers.map((tier, index) => (
            <calcite-list-item key={index} label={tier.tier} description={`${tier.availability} availability`}>
              <calcite-chip slot="content-end" label={`$${tier.price}`}>{`$${tier.price}`}</calcite-chip>
            </calcite-list-item>
          ))}
        </calcite-list>
        <calcite-button
          slot="footer-end"
          scale="l"
          onClick={async () => {
            const assistant = document.querySelector("arcgis-assistant");
            await assistant?.submitMessage(
              `Buy a ticket for the match between ${data.fixture.team} and ${data.fixture.opponent} on ${data.fixture.displayDate} at ${data.fixture.city} in ${data.tiers[1]?.tier}`,
            );
          }}
        >
          Buy Tickets
        </calcite-button>
        <span slot="footer-start">Demo only. No payment is processed.</span>
      </calcite-card>
    </div>
  );
}