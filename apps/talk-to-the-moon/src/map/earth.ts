import Basemap from "@arcgis/core/Basemap.js";
import Ground from "@arcgis/core/Ground.js";
import Map from "@arcgis/core/Map.js";
import ElevationLayer from "@arcgis/core/layers/ElevationLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import LabelClass from "@arcgis/core/layers/support/LabelClass.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import LabelSymbol3D from "@arcgis/core/symbols/LabelSymbol3D.js";
import TextSymbol3DLayer from "@arcgis/core/symbols/TextSymbol3DLayer.js";
import { LAUNCH_SITES_URL } from "../data";

/** Public Esri services, no sign-in needed. */
const EARTH_IMAGERY =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
const EARTH_TERRAIN =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer";

/** Earth, where the app opens, with the spaceports the missions launched from. */
export function createEarthScene() {
  const launchSites = new FeatureLayer({
    url: LAUNCH_SITES_URL,
    title: "Launch sites",
    outFields: ["*"],
    popupTemplate: { title: "{name}", content: "{place}" },
    // A rocket on a disc, in the same style as the mission icons, floating above the site on a leader line.
    renderer: new SimpleRenderer({
      symbol: new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { href: "/icons/launch-site.svg" },
            size: 28,
            anchor: "bottom",
          }),
        ],
        verticalOffset: {
          screenLength: 14,
          maxWorldLength: 200_000,
          minWorldLength: 0,
        },
        callout: new LineCallout3D({
          size: 1,
          color: [255, 255, 255, 0.75],
          border: { color: [6, 8, 14, 0.6] },
        }),
      }),
    }),
    labelingInfo: [
      new LabelClass({
        labelExpressionInfo: { expression: "$feature.name" },
        labelPlacement: "above-center",
        symbol: new LabelSymbol3D({
          symbolLayers: [
            new TextSymbol3DLayer({
              material: { color: "white" },
              halo: { color: "#06080e", size: 1 },
              size: 11,
            }),
          ],
        }),
      }),
    ],
    elevationInfo: { mode: "relative-to-ground" },
    screenSizePerspectiveEnabled: false,
  });

  const map = new Map({
    basemap: new Basemap({
      baseLayers: [new TileLayer({ url: EARTH_IMAGERY })],
    }),
    ground: new Ground({
      layers: [new ElevationLayer({ url: EARTH_TERRAIN })],
    }),
    layers: [launchSites],
  });

  return { map, launchSites };
}

export type EarthScene = ReturnType<typeof createEarthScene>;
