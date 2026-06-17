import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";

export type WeatherCardData = {
  city: string;
  condition: string;
  date: string;
  high: number;
  low: number;
  precipitationChance: number;
  provider: string;
  venue?: string;
  windMph: number;
};

export type WeatherCardProps = {
  slotName: string;
  data?: WeatherCardData;
};

export function WeatherCard({ slotName, data }: WeatherCardProps) {
  if (!data) {
    return null;
  }

  const venueLabel = data.venue ? ` at ${data.venue}` : "";
  const icon =
    data.condition === "Sunny"
      ? "brightness"
      : data.condition === "Partly Cloudy"
        ? "partly-cloudy"
        : "cloudy";

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">{data.city} Forecast</span>
        <span slot="description">
          {data.date}
          {venueLabel}
        </span>
        <calcite-chip icon={icon} label={data.condition}>
          {data.condition}
        </calcite-chip>
        <p>
          High {data.high}F / Low {data.low}F. {data.precipitationChance}%
          precipitation chance, wind up to {data.windMph} mph.
        </p>
        <span slot="footer-start">{data.provider}</span>
      </calcite-card>
    </div>
  );
}
