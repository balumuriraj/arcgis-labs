import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-card";
import "@esri/calcite-components/components/calcite-chip";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import { useState } from "react";
import type { TicketPriceCardData } from "../support/types";

type TicketsCardProps = {
  slotName: string;
  data: TicketPriceCardData;
};

export function TicketsCard({ slotName, data }: TicketsCardProps) {
  const { fixture, tiers } = data;
  const [selectedTier, setSelectedTier] = useState(
    (tiers[1] ?? tiers[0])?.tier,
  );

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">
          {fixture.team} vs {fixture.opponent}
        </span>
        <span slot="description">
          {fixture.date} · {fixture.city}
        </span>
        <calcite-list
          selection-mode="single"
          label="Ticket tiers"
          oncalciteListChange={(event) => {
            const value = event.currentTarget.selectedItems[0]?.value;

            if (typeof value === "string") {
              setSelectedTier(value as typeof selectedTier);
            }
          }}
        >
          {tiers.map((tier) => (
            <calcite-list-item
              key={tier.tier}
              label={tier.tier}
              value={tier.tier}
              selected={tier.tier === selectedTier}
              description={`${tier.availability} availability`}
            >
              <calcite-chip slot="content-end" label={`$${tier.price}`}>
                {`$${tier.price}`}
              </calcite-chip>
            </calcite-list-item>
          ))}
        </calcite-list>
        <calcite-button
          slot="footer-end"
          scale="l"
          onClick={async (event) => {
            const assistant = event.currentTarget.closest("arcgis-assistant");
            await assistant?.submitMessage(
              `Buy a ticket for the match between ${fixture.team} and ${fixture.opponent} on ${fixture.date} at ${fixture.city} in ${selectedTier}`,
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
