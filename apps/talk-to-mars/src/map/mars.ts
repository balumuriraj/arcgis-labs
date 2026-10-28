import Basemap from "@arcgis/core/Basemap.js";
import Graphic from "@arcgis/core/Graphic.js";
import Ground from "@arcgis/core/Ground.js";
import Map from "@arcgis/core/Map.js";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import ElevationLayer from "@arcgis/core/layers/ElevationLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import type { FieldProperties } from "@arcgis/core/layers/support/Field.js";
import LabelClass from "@arcgis/core/layers/support/LabelClass.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import LabelSymbol3D from "@arcgis/core/symbols/LabelSymbol3D.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import TextSymbol3DLayer from "@arcgis/core/symbols/TextSymbol3DLayer.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import {
  FEATURES_URL,
  OUTCOMES,
  OUTCOME_LABEL,
  fetchFeatures,
  flagUrl,
  loadData,
  sql,
  type Country,
  type Feature,
  type Mission,
  type Outcome,
} from "../data";
import { MARS_SR, marsPoint } from "./scale";

/** Esri's public Mars services (esri_astro), all in GCS_Mars_2000_Sphere. */
const ASTRO = "https://astro.arcgis.com/arcgis/rest/services/OnMars";
/** Viking and MOC color mosaic, about 230 m per pixel: the whole planet. */
const MARS_IMAGERY = `${ASTRO}/MDIM/MapServer`;
/** Mars Reconnaissance Orbiter's context camera, about 5 m per pixel: close-ups. */
const MARS_CLOSE_UP = `${ASTRO}/CTX1/MapServer`;
/** HRSC and MOLA blended elevation, 200 m per pixel. */
const MARS_ELEVATION = `${ASTRO}/MDEM200M/ImageServer`;
/** The same elevation as a color shaded relief: blue for the lowest ground, through green, yellow, and red, to white for the highest volcano summits. */
const MARS_RELIEF = `${ASTRO}/MColorDEM/MapServer`;

/** The Mars map and the layers the app works with. Created once per page. */
export function createMarsScene() {
  const data = loadData();
  const missions = new FeatureLayer({
    title: "What happened",
    source: data.missions.map(
      (m) =>
        new Graphic({
          geometry: marsPoint(m),
          attributes: missionAttributes(m),
        }),
    ),
    objectIdField: "ObjectId",
    geometryType: "point",
    spatialReference: MARS_SR,
    fields: MISSION_FIELDS,
    timeInfo: { startField: "arrivalDate" },
    outFields: ["*"],
    popupTemplate: missionPopup(),
    renderer: missionRenderer(data.missions),
    // The point sits on the terrain and the icon floats above it on a leader line (see missionSymbol).
    elevationInfo: { mode: "relative-to-ground" },
    screenSizePerspectiveEnabled: false,
    // Hidden until the camera arrives from Earth.
    opacity: 0,
  });

  // Filled by loadFeatures from the public gazetteer service, in the app's own terms.
  const features = new FeatureLayer({
    title: "Named features",
    source: [],
    objectIdField: "ObjectId",
    geometryType: "point",
    spatialReference: MARS_SR,
    fields: [
      { name: "ObjectId", type: "oid" },
      { name: "name", alias: "Name", type: "string" },
      { name: "type", alias: "Feature type", type: "string" },
      { name: "lat", alias: "Latitude", type: "double" },
      { name: "lon", alias: "Longitude", type: "double" },
      { name: "diameterKm", alias: "Size (km)", type: "double" },
      { name: "origin", alias: "Named after", type: "string" },
      {
        name: "yearApproved",
        alias: "Year the name was approved",
        type: "small-integer",
      },
      { name: "hemisphere", alias: "Hemisphere", type: "string" },
    ],
    listMode: "hide",
    legendEnabled: false,
    popupEnabled: false,
    elevationInfo: { mode: "on-the-ground" },
    // Labels only: the points themselves are invisible.
    renderer: new SimpleRenderer({
      symbol: new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: "circle" },
            size: 0.5,
            material: { color: [0, 0, 0, 0] },
          }),
        ],
      }),
    }),
    labelsVisible: false,
    labelingInfo: [
      new LabelClass({
        labelExpressionInfo: { expression: "$feature.name" },
        labelPlacement: "center-center",
        symbol: label({
          color: [236, 222, 210, 0.82],
          size: 11,
          style: "italic",
        }),
      }),
    ],
  });

  /** Feature rims and pins drawn by the guide. */
  const featureMarks = new GraphicsLayer({
    title: "Feature marks",
    listMode: "hide",
    elevationInfo: { mode: "on-the-ground" },
  });
  /** Rover routes, drawn on demand. */
  const traverses = new GraphicsLayer({
    title: "Rover routes",
    listMode: "hide",
    elevationInfo: { mode: "on-the-ground" },
  });
  /** True-scale objects standing on the terrain. */
  const objects = new GraphicsLayer({
    title: "Objects",
    listMode: "hide",
    elevationInfo: { mode: "relative-to-ground" },
  });

  /** Elevation colors over the imagery; the guide turns it on and off. */
  const relief = new TileLayer({
    url: MARS_RELIEF,
    title: "Elevation (shaded relief)",
    copyright: "USGS Astrogeology Science Center, NASA, JPL, ESA, DLR, Esri",
    listMode: "hide",
    visible: false,
  });

  // Credits as Esri's Mars sample gives them; the services' own are shorter.
  const map = new Map({
    basemap: new Basemap({
      baseLayers: [
        new TileLayer({
          url: MARS_IMAGERY,
          title: "Mars imagery",
          copyright: "USGS Astrogeology Science Center, NASA, JPL, Esri",
        }),
        // Only once the camera is close enough for its detail to show.
        new TileLayer({
          url: MARS_CLOSE_UP,
          title: "Mars close-up imagery",
          copyright: "NASA, JPL, MSSS, Caltech Murray Lab, Esri",
          minScale: 3_000_000,
        }),
      ],
    }),
    ground: new Ground({
      layers: [
        new ElevationLayer({
          url: MARS_ELEVATION,
          copyright:
            "NASA, ESA, HRSC, Goddard Space Flight Center, USGS Astrogeology Science Center, Esri",
        }),
      ],
    }),
    layers: [relief, features, traverses, featureMarks, objects, missions],
  });

  // Once per scene: React runs startup twice in development, and both runs share this scene.
  let loading: Promise<void> | undefined;
  const loadFeatures = () => {
    loading ??= fetchFeatures(new FeatureLayer({ url: FEATURES_URL }))
      .then((items) =>
        features.applyEdits({ addFeatures: featureGraphics(items) }),
      )
      .then(() => undefined);
    // Let a failed load be retried.
    loading.catch(() => (loading = undefined));
    return loading;
  };

  return {
    map,
    data,
    missions,
    features,
    featureMarks,
    traverses,
    objects,
    relief,
    loadFeatures,
  };
}

export type MarsScene = ReturnType<typeof createMarsScene>;

/** Named features as graphics for the client-side layer. */
const featureGraphics = (items: Feature[]) =>
  items.map(
    (f, i) =>
      new Graphic({
        geometry: marsPoint(f),
        attributes: {
          ObjectId: i + 1,
          ...f,
          hemisphere: f.lat >= 0 ? "Northern" : "Southern",
        },
      }),
  );

const MISSION_FIELDS: FieldProperties[] = [
  { name: "ObjectId", type: "oid" },
  { name: "id", alias: "Mission id", type: "string" },
  { name: "name", alias: "Mission", type: "string" },
  { name: "country", alias: "Country", type: "string" },
  { name: "operator", alias: "Operator", type: "string" },
  { name: "outcome", alias: "Outcome", type: "string" },
  { name: "arrivalDate", alias: "Reached the surface", type: "date" },
  { name: "launchDate", alias: "Launched", type: "date" },
  { name: "lat", alias: "Latitude", type: "double" },
  { name: "lon", alias: "Longitude", type: "double" },
  { name: "site", alias: "Site", type: "string" },
  { name: "rover", alias: "Rover", type: "string" },
  {
    name: "approximate",
    alias: "Site not confirmed from orbit",
    type: "small-integer",
  },
  { name: "launchSiteId", alias: "Launch site id", type: "string" },
  { name: "vehicle", alias: "Rocket", type: "string" },
  { name: "rideshare", alias: "Shared the rocket with", type: "string" },
];

/** The hosted-layer shape of a mission: flags as 0/1, missing text as null. */
const missionAttributes = (m: Mission) => ({
  ObjectId: m.objectId,
  id: m.id,
  name: m.name,
  country: m.country,
  operator: m.operator,
  outcome: m.outcome,
  arrivalDate: m.arrivalDate,
  launchDate: m.launchDate,
  lat: m.lat,
  lon: m.lon,
  site: m.site,
  rover: m.rover ?? null,
  approximate: m.approximate ? 1 : 0,
  launchSiteId: m.launchSiteId,
  vehicle: m.vehicle,
  rideshare: m.rideshare ?? null,
});

function missionPopup() {
  const outcomes = OUTCOMES.map((o) => `"${o}", "${OUTCOME_LABEL[o]}"`).join(
    ", ",
  );
  return new PopupTemplate({
    title: "{name}",
    expressionInfos: [
      {
        name: "outcome",
        title: "Outcome",
        expression: `Decode($feature.outcome, ${outcomes}, "")`,
      },
    ],
    content: [
      {
        type: "fields",
        fieldInfos: [
          { fieldName: "expression/outcome" },
          { fieldName: "arrivalDate", label: "Reached the surface" },
          { fieldName: "country", label: "Country" },
          { fieldName: "operator", label: "Operator" },
          { fieldName: "site", label: "Site" },
          { fieldName: "rover", label: "Rover" },
          { fieldName: "vehicle", label: "Rocket" },
          { fieldName: "launchDate", label: "Launched" },
        ],
      },
    ],
  });
}

const GROUP_HEADING: Record<Outcome, string> = {
  soft: "Landed and worked",
  silent: "Landed, then went silent",
  crash: "Crashed or lost",
};

/** One icon per outcome (public/icons/) with the country's flag on its corner, for each pair that occurs. */
export function missionRenderer(missions: Mission[]): UniqueValueRenderer {
  const groups = OUTCOMES.map((outcome) => {
    const countries = [
      ...new Set(
        missions.filter((m) => m.outcome === outcome).map((m) => m.country),
      ),
    ].sort();
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

const ICON_SIZE: Record<Outcome, number> = {
  soft: 36,
  silent: 30,
  crash: 28,
};

/**
 * The icon floats a little above the site with a thin line down to the exact spot, so it never
 * sinks into crater walls and the landing point stays precise.
 */
function missionSymbol(outcome: Outcome, country: Country): PointSymbol3D {
  const size = ICON_SIZE[outcome];
  return new PointSymbol3D({
    symbolLayers: [
      new IconSymbol3DLayer({
        resource: { href: `/icons/${outcome}.svg` },
        size,
        anchor: "bottom",
      }),
      // The flag sits on the disc's top-right; anchorPosition is measured in flag sizes.
      new IconSymbol3DLayer({
        resource: { href: flagUrl(country) },
        size: size * 0.55,
        anchor: "relative",
        anchorPosition: { x: -0.7, y: 1.6 },
      }),
    ],
    verticalOffset: {
      screenLength: 18,
      maxWorldLength: 200_000,
      minWorldLength: 0,
    },
    callout: new LineCallout3D({
      size: 1,
      color: [255, 255, 255, 0.75],
      border: { color: [6, 8, 14, 0.6] },
    }),
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

function label({
  color,
  size,
  style,
  weight,
}: {
  color: string | number[];
  size: number;
  style?: "italic";
  weight?: "bold";
}) {
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
