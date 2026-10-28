import Point from "@arcgis/core/geometry/Point";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-table";
import "@esri/calcite-components/components/calcite-table-cell";
import "@esri/calcite-components/components/calcite-table-header";
import "@esri/calcite-components/components/calcite-table-row";
import { getWorldCupMapContext } from "../support/map-context";
import type { TeamMatchesCardData, TeamMatchFeature } from "../support/types";

type TeamMatchesCardProps = {
  slotName: string;
  data: TeamMatchesCardData;
};

const getAttributeText = (
  feature: TeamMatchFeature,
  fieldName: string,
): string => String(feature.attributes[fieldName] ?? "");

const goToFeature = async (feature: TeamMatchFeature): Promise<void> => {
  if (!feature.geometry) {
    return;
  }

  const { mapView } = await getWorldCupMapContext();
  await mapView.goTo(new Point(feature.geometry));
};

export function TeamMatchesCard({ slotName, data }: TeamMatchesCardProps) {
  if (!data.features.length) {
    return null;
  }

  return (
    <calcite-table
      slot={slotName}
      caption={`${data.teamName} matches`}
      bordered
      group-separator
      numbered
      selection-mode="none"
      striped
    >
      <calcite-table-row slot="table-header">
        <calcite-table-header heading="Team A"></calcite-table-header>
        <calcite-table-header heading="Team B"></calcite-table-header>
        <calcite-table-header heading="Stadium"></calcite-table-header>
        <calcite-table-header heading="Match Date"></calcite-table-header>
        <calcite-table-header heading="" alignment="end"></calcite-table-header>
      </calcite-table-row>
      {data.features.map((feature, index) => (
        <calcite-table-row
          key={getAttributeText(feature, "match_") || `feature-${index}`}
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
              onClick={() => void goToFeature(feature)}
            >
              View
            </calcite-button>
          </calcite-table-cell>
        </calcite-table-row>
      ))}
    </calcite-table>
  );
}
