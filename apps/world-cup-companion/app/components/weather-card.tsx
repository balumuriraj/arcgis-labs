import "@esri/calcite-components/dist/components/calcite-card";
import "@esri/calcite-components/dist/components/calcite-chip";
import type { WeatherCardData } from "../support/utils";

const weatherIcons = {
  clear: "brightness",
  cloudy: "cloudy",
  partlyCloudy: "partly-cloudy",
} as const;

const getWeatherIcon = (
  condition: string,
): (typeof weatherIcons)[keyof typeof weatherIcons] => {
  if (condition === "Clear sky") {
    return weatherIcons.clear;
  }

  if (condition === "Partly cloudy") {
    return weatherIcons.partlyCloudy;
  }

  return weatherIcons.cloudy;
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

  return (
    <div slot={slotName}>
      <calcite-card scale="m">
        <span slot="heading">{data.city} Forecast</span>
        <span slot="description">
          {data.date}
          {venueLabel}
        </span>
        <calcite-chip icon={getWeatherIcon(data.condition)} label={data.condition}>
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
