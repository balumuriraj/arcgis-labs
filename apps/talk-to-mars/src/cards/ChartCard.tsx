import { useEffect, useRef, useState } from "react";
import type { MarsApp } from "../map/controller";
import { chartInfo, renderChart, type ChartRequest } from "./charts";

export function ChartCard({ app, data }: { app: MarsApp; data: ChartRequest }) {
  const chart = useRef<HTMLArcgisChartElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ loading: boolean; error?: string }>({
    loading: true,
  });
  const { title, note } = chartInfo(data);

  useEffect(() => {
    let current = true;
    renderChart(chart.current!, data, app.charts).then(
      () => current && setStatus({ loading: false }),
      (error: unknown) => {
        console.error("Could not load the chart:", error);
        if (current)
          setStatus({
            loading: false,
            error: `The chart could not load. ${error instanceof Error ? error.message : ""}`,
          });
      },
    );
    return () => {
      current = false;
    };
  }, [app, data, attempt]);

  return (
    <calcite-card>
      <h3 slot="heading">{title}</h3>
      <span slot="description">{note}</span>
      {status.loading ? (
        <calcite-loader
          inline
          label="Loading chart"
          text="Loading chart..."
          scale="s"
        />
      ) : null}
      {status.error ? (
        <calcite-notice open kind="danger" role="alert">
          <span slot="message">{status.error}</span>
          <calcite-button
            slot="link"
            scale="s"
            onClick={() => {
              setStatus({ loading: true });
              setAttempt((n) => n + 1);
            }}
          >
            Retry chart
          </calcite-button>
        </calcite-notice>
      ) : null}
      <arcgis-chart ref={chart} hidden={Boolean(status.error)} />
    </calcite-card>
  );
}
