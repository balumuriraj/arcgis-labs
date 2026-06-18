import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import type { TicketOrderConfirmationData } from "../support/utils";

export type ReceiptCardData = TicketOrderConfirmationData;

export function ReceiptCard({
  slotName,
  data,
}: {
  slotName: string;
  data?: ReceiptCardData;
}) {
  if (!data) {
    return null;
  }

  const fixtureLine = `${data.fixture.team} vs ${data.fixture.opponent}`;

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">Ticket Order Receipt</span>
        <span slot="description">
          Mock purchase confirmed for {fixtureLine} on {data.fixture.displayDate}.
        </span>
        <calcite-list selection-mode="none" label="Ticket order receipt details">
          <calcite-list-item label="Order ID" description={data.orderId}></calcite-list-item>
          <calcite-list-item label="Fixture" description={fixtureLine}></calcite-list-item>
          <calcite-list-item label="Venue" description={data.fixture.city}></calcite-list-item>
          <calcite-list-item label="Quantity" description={String(data.quantity)}></calcite-list-item>
          <calcite-list-item label="Tier" description={data.tier}></calcite-list-item>
          <calcite-list-item label="Order Total" description={`$${data.orderTotal}`}></calcite-list-item>
        </calcite-list>
        <span slot="footer-start">Demo only. No payment is processed.</span>
      </calcite-card>
    </div>
  );
}