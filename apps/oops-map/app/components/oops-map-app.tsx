"use client";

import "@arcgis/ai-components/components/arcgis-assistant-data-exploration-agent";
import "@arcgis/ai-components/components/arcgis-assistant-help-agent";
import "@arcgis/ai-components/components/arcgis-assistant-navigation-agent";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-table";
import "@esri/calcite-components/components/calcite-table-row";
import "@esri/calcite-components/components/calcite-table-cell";
import "@esri/calcite-components/components/calcite-table-header";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-option";

import esriConfig from "@arcgis/core/config";
import type MapView from "@arcgis/core/views/MapView";
import type { ArcgisMap } from "@arcgis/map-components/components/arcgis-map";
import { useEffect, useState } from "react";

function getUrlParam(key: string) {
  return new URLSearchParams(window.location.search).get(key);
}
import { OopsAssistant } from "./oops-assistant";
import { OopsStepper } from "./oops-stepper";
import type { RoastPersona } from "./oops-roast-agent/types";

// const DEFAULT_WEBMAP_ID = "680ecd73ae634c8a823984a2d49d29b7";
// const DEFAULT_WEBMAP_ID = "956580a5b5a54addba6958b6ff876c74";

export function OopsMapApp() {
  const [portalUrl, setPortalUrl] = useState(() => getUrlParam("portal") ?? "https://www.arcgis.com");
  const [webmapId, setWebmapId] = useState(() => getUrlParam("webmap") ?? "");
  const [persona, setPersona] = useState<RoastPersona>(
    () => (getUrlParam("persona") as RoastPersona) ?? "cartographer",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [setupDone, setSetupDone] = useState(
    () => !!getUrlParam("portal") && !!getUrlParam("webmap"),
  );

  useEffect(() => {
    const portal = getUrlParam("portal");
    if (portal) esriConfig.portalUrl = portal;
  }, []);

  const handleSetupComplete = (newPortalUrl: string, itemId: string, newPersona?: RoastPersona) => {
    esriConfig.portalUrl = newPortalUrl;
    const url = new URL(window.location.href);
    url.searchParams.set("portal", newPortalUrl);
    url.searchParams.set("webmap", itemId);
    window.history.replaceState({}, "", url.toString());
    setPortalUrl(newPortalUrl);
    setWebmapId(itemId);
    if (newPersona) setPersona(newPersona);
    setSetupDone(true);
  };

  const handleMapViewReady = (event: CustomEvent) => {
    const mapElement = event.target as ArcgisMap;
    setMapView((mapElement.view as MapView) ?? null);
  };

  return (
    <main className="calcite-mode-dark oops-map-app">
      <calcite-shell>
        <calcite-shell-panel
          title="Oops"
          slot="panel-start"
          width="l"
          id="assistant-panel"
        >
          {!setupDone ? (
            <OopsStepper
              onComplete={handleSetupComplete}
              initialPortalUrl={portalUrl}
              initialWebmapId={webmapId}
            />
          ) : (
            <OopsAssistant
              portalUrl={portalUrl}
              webmapId={webmapId}
              initialPersona={persona}
              reloadKey={reloadKey}
              mapView={mapView}
              onApplyPersona={(newPersona) => {
                setPersona(newPersona);
                const url = new URL(window.location.href);
                url.searchParams.set("persona", newPersona);
                window.history.replaceState({}, "", url.toString());
                setReloadKey((k) => k + 1);
              }}
              onReconfigure={handleSetupComplete}
            />
          )}
        </calcite-shell-panel>

        <calcite-panel>
          <arcgis-map
            key={`${webmapId}-${reloadKey}`}
            id="arcgis-map"
            item-id={webmapId}
            basemap={webmapId ? undefined : "dark-gray-vector"}
            // zoom={2}
            // center={[-98, 39]}
            onarcgisViewReadyChange={handleMapViewReady}
          >
            <arcgis-legend slot="top-left"></arcgis-legend>
          </arcgis-map>
        </calcite-panel>
      </calcite-shell>
    </main>
  );
}
