import type MapView from "@arcgis/core/views/MapView.js";

export type WorldCupMapContext = {
  mapView: MapView;
};

export type AgentConfigWithContext = {
  configurable?: {
    context?: unknown;
  };
};

let mapContextPromise: Promise<WorldCupMapContext> | undefined;

export const getWorldCupMapContext = async (): Promise<WorldCupMapContext> => {
  mapContextPromise ??= (async (): Promise<WorldCupMapContext> => {
    const mapElement = document.querySelector<HTMLArcgisMapElement>("#world-cup-map");

    if (!mapElement) {
      throw new Error("Expected #world-cup-map for the World Cup Companion story.");
    }

    await mapElement.viewOnReady();

    if (!mapElement.view) {
      throw new Error("The World Cup Companion map is ready but does not expose a view.");
    }

    return {
      mapView: mapElement.view,
    };
  })().catch((error: unknown) => {
    // Don't cache a failure, so the next request can retry once the map exists.
    mapContextPromise = undefined;
    throw error;
  });

  return await mapContextPromise;
};

export const getWorldCupMapContextFromAgentConfig = (
  config: AgentConfigWithContext | undefined,
  agentName: string,
): WorldCupMapContext => {
  const context = config?.configurable?.context;

  if (!context || typeof context !== "object" || !("mapView" in context)) {
    throw new Error(`${agentName} requires WorldCupMapContext from arcgis-assistant-agent context.`);
  }

  return context as WorldCupMapContext;
};
