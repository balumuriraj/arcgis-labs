"use client";

import "@arcgis/map-components/components/arcgis-scene";

import Basemap from "@arcgis/core/Basemap";
import Map from "@arcgis/core/Map";
import BaseElevationLayer, {
  type FetchTileOptions,
} from "@arcgis/core/layers/BaseElevationLayer";
import ElevationLayer from "@arcgis/core/layers/ElevationLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import type { ElevationTileData } from "@arcgis/core/layers/support/types";
import type { ArcgisScene } from "@arcgis/map-components/components/arcgis-scene";
import { useEffect, useRef, type CSSProperties } from "react";

type ElevationLoadOptions = Parameters<BaseElevationLayer["load"]>[0];

class ExaggeratedElevationLayer extends BaseElevationLayer {
  private _elevation!: ElevationLayer;

  exaggeration = 70;

  override load(options?: ElevationLoadOptions): Promise<this> {
    void options;

    this._elevation = new ElevationLayer({
      url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/TopoBathy3D/ImageServer",
    });

    const loadPromise = this._elevation.load().then(() => {
        this.tileInfo = this._elevation.tileInfo;
        this.spatialReference = this._elevation.spatialReference;
        this.fullExtent = this._elevation.fullExtent;
        return this;
      });

    this.addResolvingPromise(loadPromise);

    return loadPromise;
  }

  override fetchTile(
    level: number,
    row: number,
    col: number,
    options?: FetchTileOptions,
  ): Promise<ElevationTileData> {
    return this._elevation.fetchTile(level, row, col, options).then((data) => {
      const exaggeration = this.exaggeration;
      const values = Float32Array.from(data.values);

      for (let index = 0; index < values.length; index += 1) {
        const value = values.at(index);

        if (value !== undefined) {
          values[index] = value * exaggeration;
        }
      }

      return {
        ...data,
        values,
      };
    });
  }
}

const sceneEnvironment = {
  background: {
    type: "color",
    color: [255, 252, 244, 0],
  },
  starsEnabled: false,
  atmosphereEnabled: false,
  lighting: {
    type: "virtual",
  },
} as unknown as ArcgisScene["environment"];

const sceneConstraints = {
  altitude: {
    min: 5000000,
  },
} as unknown as ArcgisScene["constraints"];

const scenePopup = {
  dockEnabled: true,
  dockOptions: {
    position: "top-right",
    breakpoint: false,
    buttonEnabled: false,
  },
  visibleElements: {
    collapseButton: false,
  },
} as unknown as ArcgisScene["popup"];

const introSceneStyle: CSSProperties = {
  background: "radial-gradient(#12bff2, #0269a1)",
  filter: "saturate(1.2) drop-shadow(0 0 20px white)",
};

export function OopsIntroScene() {
  const sceneRef = useRef<ArcgisScene | null>(null);

  useEffect(() => {
    const sceneElement = sceneRef.current;

    if (!sceneElement) {
      return;
    }

    let animationId: number;
    let longitude = -55.039;

    function startRotation() {
      const view = sceneElement!.view;
      if (!view) return;

      function animate() {
        longitude = ((longitude + 0.05 + 180) % 360) - 180;
        const camera = view.camera.clone();
        camera.position.longitude = longitude;
        view.goTo(camera, { animate: false }).catch(() => {});
        animationId = requestAnimationFrame(animate);
      }

      animationId = requestAnimationFrame(animate);
    }

    sceneElement.addEventListener("arcgisViewReadyChange", startRotation);

    const basemap = new Basemap({
      baseLayers: [
        new TileLayer({
          url: "https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/terrain_with_heavy_bathymetry/MapServer",
          copyright:
            'Bathymetry, topography and satellite imagery from <a href="https://visibleearth.nasa.gov/view_cat.php?categoryID=1484" target="_blank">NASA Visible Earth</a> | <a href="http://www.aag.org/global_ecosystems" target="_blank">World Ecological Land Units, AAG</a> | Oceans, glaciers and water bodies from <a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>',
        }),
      ],
    });

    const elevationLayer = new ExaggeratedElevationLayer();
    const sceneMap = new Map({
      basemap,
      ground: {
        layers: [elevationLayer],
      },
    });

    sceneElement.map = sceneMap;
    sceneElement.environment = sceneEnvironment;
    sceneElement.constraints = sceneConstraints;
    sceneElement.popup = scenePopup;

    return () => {
      sceneElement.removeEventListener("arcgisViewReadyChange", startRotation);
      cancelAnimationFrame(animationId);
      sceneElement.map = undefined;

      sceneMap.destroy();
    };
  }, []);

  return (
    <arcgis-scene
      ref={sceneRef}
      style={introSceneStyle}
      camera-position="-55.039, 14.948, 19921223.3"
      camera-tilt="0.13"
      camera-heading="2.03"
      alpha-compositing-enabled
    ></arcgis-scene>
  );
}