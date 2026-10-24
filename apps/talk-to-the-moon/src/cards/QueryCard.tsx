export type QueryResults = {
  columns: string[];
  rows: Record<string, string | number | null>[];
  truncated: boolean;
};

/** Statistics such as averages come back unrounded; whole numbers (years, counts) stay as they are. */
const display = (value: string | number | null) =>
  value === null ? "-" : typeof value === "number" && !Number.isInteger(value) ? Math.round(value * 100) / 100 : value;

/** A snapshot of a queryData result. Only sent when there are rows. */
export function QueryCard({ data: { title, columns, rows, truncated } }: { data: QueryResults & { title: string } }) {
  return (
    <calcite-card>
      <h3 slot="heading">{title}</h3>
      <span slot="description">
        {rows.length} {rows.length === 1 ? "row" : "rows"}
        {truncated ? " (more results available)" : ""}
      </span>
      <calcite-table caption={title} scale="s">
        <calcite-table-row slot="table-header">
          {columns.map((column) => (
            <calcite-table-header key={column} heading={column} />
          ))}
        </calcite-table-row>
        {rows.map((row, index) => (
          <calcite-table-row key={index}>
            {columns.map((column) => (
              <calcite-table-cell key={column}>{display(row[column])}</calcite-table-cell>
            ))}
          </calcite-table-row>
        ))}
      </calcite-table>
    </calcite-card>
  );
}
