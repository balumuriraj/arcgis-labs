"use client";

import type FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import type MapView from "@arcgis/core/views/MapView.js";
import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 4;

interface MapShellProps {
  layerUrl: string;
}

export function MapShell({ layerUrl }: MapShellProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const activeLayerRef = useRef<FeatureLayer | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [status, setStatus] = useState("Initializing map...");

  useEffect(() => {
    let isDisposed = false;

    const initialize = async () => {
      const [{ default: ArcgisMap }, { default: ArcgisMapView }] =
        await Promise.all([
          import("@arcgis/core/Map.js"),
          import("@arcgis/core/views/MapView.js"),
        ]);

      if (!mapNodeRef.current || isDisposed) {
        return;
      }

      const map = new ArcgisMap({ basemap: "topo-vector" });
      const view = new ArcgisMapView({
        container: mapNodeRef.current,
        map,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        constraints: {
          rotationEnabled: false,
        },
      });

      await view.when();

      if (isDisposed) {
        view.destroy();
        return;
      }

      viewRef.current = view;
      setIsMapReady(true);
      setStatus("Map ready. Update the layer URL to preview data.");
    };

    void initialize().catch(() => {
      if (!isDisposed) {
        setStatus("Map failed to initialize.");
      }
    });

    return () => {
      isDisposed = true;
      setIsMapReady(false);

      const view = viewRef.current;
      const map = view?.map;

      if (activeLayerRef.current && map) {
        map.remove(activeLayerRef.current);
        activeLayerRef.current.destroy();
        activeLayerRef.current = null;
      }

      if (view) {
        view.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !viewRef.current) {
      return;
    }

    let cancelled = false;

    const syncLayer = async () => {
      const view = viewRef.current;
      const map = view?.map;

      if (!view || !map) {
        return;
      }

      if (activeLayerRef.current) {
        map.remove(activeLayerRef.current);
        activeLayerRef.current.destroy();
        activeLayerRef.current = null;
      }

      const normalizedUrl = layerUrl.trim();
      if (normalizedUrl.length === 0) {
        setStatus("Map ready. Add a layer URL to display data.");
        return;
      }

      setStatus("Loading layer...");

      const { default: ArcgisFeatureLayer } = await import(
        "@arcgis/core/layers/FeatureLayer.js"
      );
      const layer = new ArcgisFeatureLayer({
        url: normalizedUrl,
        outFields: ["*"],
      });

      map.add(layer);

      try {
        await layer.when();

        if (cancelled) {
          map.remove(layer);
          layer.destroy();
          return;
        }

        activeLayerRef.current = layer;
        if (layer.fullExtent) {
          try {
            await view.goTo(layer.fullExtent, { duration: 900 });
          } catch {
            // Ignore interrupted navigation when users rapidly update the layer URL.
          }
        }

        setStatus("Layer loaded on map.");
      } catch {
        map.remove(layer);
        layer.destroy();
        if (!cancelled) {
          setStatus("Layer preview failed to load.");
        }
      }
    };

    void syncLayer();

    return () => {
      cancelled = true;
    };
  }, [isMapReady, layerUrl]);

  return (
    <>
      <div className={styles.mapContainer} ref={mapNodeRef} />
      <p className={styles.mapStatus}>{status}</p>
    </>
  );
}