import "@esri/calcite-components/components/calcite-card";
import "@esri/calcite-components/components/calcite-chip";
import type { WeatherCardData } from "../support/types";

// Keyed by the condition labels produced in support/weather.ts.
const weatherIcons: Record<string, HTMLCalciteChipElement["icon"]> = {
  "Clear sky": "brightness",
  Drizzle: "rain",
  Foggy: "fog",
  "Partly cloudy": "partly-cloudy",
  Rain: "rain",
  Snow: "snow",
  Thunderstorms: "rain-thunder",
};

type WeatherCardProps = {
  slotName: string;
  data: WeatherCardData;
};

export function WeatherCard({ slotName, data }: WeatherCardProps) {
  const precipitationLabel =
    data.precipitationInches === undefined
      ? `${data.precipitationChance ?? 0}% precipitation chance`
      : `${data.precipitationInches} in of precipitation`;

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">{data.city} Weather</span>
        <span slot="description">{data.date}</span>
        <calcite-chip
          icon={weatherIcons[data.condition] ?? "cloudy"}
          label={data.condition}
        >
          {data.condition}
        </calcite-chip>
        <p>
          High {data.high}F / Low {data.low}F. {precipitationLabel}, wind up to{" "}
          {data.windMph} mph.
        </p>
        <span slot="footer-start">{data.provider}</span>
      </calcite-card>
    </div>
  );
}
