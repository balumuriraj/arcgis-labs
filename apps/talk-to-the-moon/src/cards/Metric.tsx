/** One labeled row of a Calcite table. */
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <calcite-table-row>
      <calcite-table-header heading={label} />
      <calcite-table-cell>{value}</calcite-table-cell>
    </calcite-table-row>
  );
}
