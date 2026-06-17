import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";

export type ReceiptCardData = {
  orderId: string;
  fixture: {
    team: string;
    opponent: string;
    displayDate: string;
    city: string;
  };
  quantity: number;
  tier: string;
  orderTotal: number;
};

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

    const fixtureData = data.fixture as Record<string, unknown> | undefined;
  const orderId = typeof data.orderId === "string" ? data.orderId : "Unknown";
  const team = typeof fixtureData?.team === "string" ? fixtureData.team : "Unknown team";
  const opponent = typeof fixtureData?.opponent === "string" ? fixtureData.opponent : "Unknown opponent";
  const displayDate = typeof fixtureData?.displayDate === "string" ? fixtureData.displayDate : "Unknown date";
  const city = typeof fixtureData?.city === "string" ? fixtureData.city : "Unknown city";
  const quantity = typeof data.quantity === "number" ? data.quantity : 0;
  const tier = typeof data.tier === "string" ? data.tier : "Unknown tier";
  const orderTotal = typeof data.orderTotal === "number" ? data.orderTotal : 0;
  const fixtureLine = `${team} vs ${opponent}`;
  const orderTotalText = `$${orderTotal}`;

  return (
    <calcite-card scale="m" slot={slotName}>
      <span slot="heading">Ticket Order Receipt</span>
      <span slot="description">
        Mock purchase confirmed for {fixtureLine} on {displayDate}.
      </span>
      <calcite-list selection-mode="none" label="Ticket order receipt details">
        <calcite-list-item label="Order ID" description={orderId}></calcite-list-item>
        <calcite-list-item label="Fixture" description={fixtureLine}></calcite-list-item>
        <calcite-list-item label="Venue" description={city}></calcite-list-item>
        <calcite-list-item label="Quantity" description={String(quantity)}></calcite-list-item>
        <calcite-list-item label="Tier" description={tier}></calcite-list-item>
        <calcite-list-item label="Order Total" description={orderTotalText}></calcite-list-item>
      </calcite-list>
      <span slot="footer-start">Demo only. No payment is processed.</span>
    </calcite-card>
  );
}