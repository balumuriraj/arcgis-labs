import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import type { TicketPriceCardData } from "../support/utils";

export type TicketsCardData = TicketPriceCardData;

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

  const defaultSelectedTier = data.tiers[1] ?? data.tiers[0];

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
            <calcite-list-item
              key={tier.tier ?? index}
              label={tier.tier}
              value={tier.tier}
              selected={tier.tier === defaultSelectedTier?.tier}
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
            const card = event.currentTarget.closest("calcite-card");
            const tierList = card?.querySelector("calcite-list") as HTMLCalciteListElement | null;
            const selectedListItem = tierList?.selectedItems?.[0] as HTMLCalciteListItemElement | undefined;
            const selectedTier = selectedListItem?.value ?? selectedListItem?.label ?? defaultSelectedTier?.tier;
            const assistant = document.querySelector("arcgis-assistant");
            await assistant?.submitMessage(
              `Buy a ticket for the match between ${data.fixture.team} and ${data.fixture.opponent} on ${data.fixture.displayDate} at ${data.fixture.city} in ${selectedTier}`,
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