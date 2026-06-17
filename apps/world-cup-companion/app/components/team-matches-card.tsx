import Point, { PointProperties } from "@arcgis/core/geometry/Point";
import "@esri/calcite-components/components/calcite-table";
import "@esri/calcite-components/components/calcite-table-cell";
import "@esri/calcite-components/components/calcite-table-header";
import "@esri/calcite-components/components/calcite-table-row";
import "@esri/calcite-components/components/calcite-button";

export type TeamMatchFeature = {
  attributes: Record<string, unknown>;
  geometry?: PointProperties;
};

type TeamMatchesData = {
  features?: TeamMatchFeature[];
};

type TeamMatchesProps = {
  slotName: string;
  data?: TeamMatchesData;
};

const getAttributeText = (
  feature: TeamMatchFeature,
  fieldName: string,
): string => String(feature.attributes[fieldName] ?? "");

export function TeamMatchesCard({
  slotName,
  data,
}: TeamMatchesProps) {
  const features = Array.isArray(data?.features) ? data.features : [];

  if (!features.length) {
    return null;
  }

  return (
    <calcite-table
      slot={slotName}
      caption="Team Matches"
      bordered
      group-separator
      numbered
      selection-mode="none"
      striped
    >
      <calcite-table-row slot="table-header">
        <calcite-table-header
          heading="Team A"
          description="Description"
        ></calcite-table-header>
        <calcite-table-header
          heading="Team B"
          description="Description"
        ></calcite-table-header>
        <calcite-table-header
          heading="Stadium"
          description="Description"
        ></calcite-table-header>
        <calcite-table-header
          heading="Match Date"
          description="Description"
        ></calcite-table-header>
        <calcite-table-header heading="" alignment="end"></calcite-table-header>
      </calcite-table-row>
      {features.map((feature, index) => (
        <calcite-table-row
          key={
            getAttributeText(feature, "match_") ||
            `${getAttributeText(feature, "Team_A")}-${getAttributeText(feature, "Team_B")}-${index}`
          }
        >
          <calcite-table-cell>
            {getAttributeText(feature, "Team_A")}
          </calcite-table-cell>
          <calcite-table-cell>
            {getAttributeText(feature, "Team_B")}
          </calcite-table-cell>
          <calcite-table-cell>
            {getAttributeText(feature, "stadium")}
          </calcite-table-cell>
          <calcite-table-cell>
            {getAttributeText(feature, "match_date")}
          </calcite-table-cell>
          <calcite-table-cell alignment="end">
            <calcite-button
              appearance="outline"
              scale="s"
              onClick={async () => {
                const mapView = document.querySelector("arcgis-map")?.view;
                const geometry = feature.geometry
                  ? new Point(feature.geometry)
                  : null;
                if (mapView && geometry) {
                  await mapView.goTo(geometry);
                }
              }}
            >
              View
            </calcite-button>
          </calcite-table-cell>
        </calcite-table-row>
      ))}
    </calcite-table>
  );
}
