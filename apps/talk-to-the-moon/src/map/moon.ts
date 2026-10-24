import Basemap from "@arcgis/core/Basemap.js";
import Ground from "@arcgis/core/Ground.js";
import Map from "@arcgis/core/Map.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import ElevationLayer from "@arcgis/core/layers/ElevationLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import LabelClass from "@arcgis/core/layers/support/LabelClass.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import LabelSymbol3D from "@arcgis/core/symbols/LabelSymbol3D.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import TextSymbol3DLayer from "@arcgis/core/symbols/TextSymbol3DLayer.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import { CRATERS_URL, MISSIONS_URL, OUTCOMES, OUTCOME_LABEL, flagUrl, sql, type Country, type Mission, type Outcome } from "../data";
import { SiteModel } from "../extras/siteModel";

const MOON_IMAGERY = "https://tiles.arcgis.com/tiles/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/Moon_Basemap_Tile0to9/MapServer";
const MOON_ELEVATION = "https://tiles.arcgis.com/tiles/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/Moon_Elevation_Surface/ImageServer";

/** The Moon map and the layers the app works with. Created once per page. */
export function createMoonScene() {
  const missions = new FeatureLayer({
    url: MISSIONS_URL,
    title: "What happened",
    outFields: ["*"],
    popupTemplate: missionPopup(),
    // The point sits on the terrain and the icon floats above it on a leader line (see missionSymbol).
    elevationInfo: { mode: "relative-to-ground" },
    screenSizePerspectiveEnabled: false,
    // Hidden until the camera arrives from Earth.
    opacity: 0,
  });

  const craters = new FeatureLayer({
    url: CRATERS_URL,
    title: "Crater names",
    listMode: "hide",
    legendEnabled: false,
    popupEnabled: false,
    elevationInfo: { mode: "on-the-ground" },
    // Labels only: the points themselves are invisible.
    renderer: new SimpleRenderer({
      symbol: new PointSymbol3D({
        symbolLayers: [new IconSymbol3DLayer({ resource: { primitive: "circle" }, size: 0.5, material: { color: [0, 0, 0, 0] } })],
      }),
    }),
    labelsVisible: false,
    labelingInfo: [
      new LabelClass({
        labelExpressionInfo: { expression: "$feature.name" },
        labelPlacement: "center-center",
        symbol: label({ color: [214, 219, 228, 0.82], size: 11, style: "italic" }),
      }),
    ],
  });

  /** Crater rims and pins drawn by the guide. */
  const craterMarks = new GraphicsLayer({ title: "Crater marks", listMode: "hide", elevationInfo: { mode: "on-the-ground" } });
  /** True-scale objects standing on the terrain. */
  const objects = new GraphicsLayer({ title: "Objects", listMode: "hide", elevationInfo: { mode: "relative-to-ground" } });
  const siteModel = new SiteModel();

  const map = new Map({
    basemap: new Basemap({ baseLayers: [new TileLayer({ url: MOON_IMAGERY, title: "Moon imagery" })] }),
    ground: new Ground({ layers: [new ElevationLayer({ url: MOON_ELEVATION })] }),
    layers: [craters, craterMarks, ...siteModel.layers, objects, missions],
  });

  return { map, missions, craters, craterMarks, objects, siteModel };
}

export type MoonScene = ReturnType<typeof createMoonScene>;

function missionPopup() {
  const outcomes = OUTCOMES.map((o) => `"${o}", "${OUTCOME_LABEL[o]}"`).join(", ");
  return new PopupTemplate({
    title: "{name}",
    expressionInfos: [{ name: "outcome", title: "Outcome", expression: `Decode($feature.outcome, ${outcomes}, "")` }],
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "expression/outcome" },
          { fieldName: "arrivalDate", label: "Reached the Moon" },
          { fieldName: "country", label: "Country" },
          { fieldName: "operator", label: "Operator" },
          { fieldName: "site", label: "Site" },
          { fieldName: "crew", label: "Crew on the surface" },
          { fieldName: "vehicle", label: "Rocket" },
          { fieldName: "launchDate", label: "Launched" },
        ],
      },
    ],
  });
}

const GROUP_HEADING: Record<Outcome, string> = {
  crewed: "Crewed landings",
  soft: "Robotic landings",
  crash: "Crashes",
  impact: "Planned impacts",
};

/** One icon per outcome (public/icons/) with the country's flag on its corner, for each pair that occurs. */
export function missionRenderer(missions: Mission[]): UniqueValueRenderer {
  const groups = OUTCOMES.map((outcome) => {
    const countries = [...new Set(missions.filter((m) => m.outcome === outcome).map((m) => m.country))].sort();
    return {
      heading: GROUP_HEADING[outcome],
      classes: countries.map((country) => ({
        label: country,
        values: [{ value: country, value2: outcome }],
        symbol: missionSymbol(outcome, country),
      })),
    };
  });
  return new UniqueValueRenderer({
    field: "country",
    field2: "outcome",
    uniqueValueGroups: groups.filter((group) => group.classes.length),
  });
}

const ICON_SIZE: Record<Outcome, number> = { crewed: 40, soft: 34, crash: 28, impact: 24 };

/**
 * The icon floats a little above the site with a thin line down to the exact spot, so it never
 * sinks into crater walls and the landing point stays precise.
 */
function missionSymbol(outcome: Outcome, country: Country): PointSymbol3D {
  const size = ICON_SIZE[outcome];
  return new PointSymbol3D({
    symbolLayers: [
      new IconSymbol3DLayer({ resource: { href: `/icons/${outcome}.svg` }, size, anchor: "bottom" }),
      // The flag sits on the disc's top-right; anchorPosition is measured in flag sizes.
      new IconSymbol3DLayer({
        resource: { href: flagUrl(country) },
        size: size * 0.55,
        anchor: "relative",
        anchorPosition: { x: -0.7, y: 1.6 },
      }),
    ],
    verticalOffset: { screenLength: 18, maxWorldLength: 200_000, minWorldLength: 0 },
    callout: new LineCallout3D({ size: 1, color: [255, 255, 255, 0.75], border: { color: [6, 8, 14, 0.6] } }),
  });
}

/** Labels for the selected missions; other missions stay unlabeled. */
export function missionLabels(ids: string[]): LabelClass[] {
  if (!ids.length) return [];
  return [
    new LabelClass({
      where: `id IN (${ids.map(sql).join(",")})`,
      labelExpressionInfo: { expression: "$feature.name" },
      labelPlacement: "above-center",
      symbol: label({ color: "white", size: 12, weight: "bold" }),
    }),
  ];
}

function label({ color, size, style, weight }: { color: string | number[]; size: number; style?: "italic"; weight?: "bold" }) {
  return new LabelSymbol3D({
    symbolLayers: [
      new TextSymbol3DLayer({
        material: { color },
        halo: { color: [6, 8, 14, 0.85], size: 1.5 },
        size,
        font: { style, weight },
      }),
    ],
  });
}
