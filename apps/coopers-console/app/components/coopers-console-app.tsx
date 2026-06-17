"use client";

import "@arcgis/ai-components/components/arcgis-assistant";
import "@arcgis/ai-components/components/arcgis-assistant-agent";
import "@arcgis/ai-components/components/arcgis-assistant-data-exploration-agent";
import "@arcgis/ai-components/components/arcgis-assistant-help-agent";
import "@arcgis/ai-components/components/arcgis-assistant-message";
import "@arcgis/ai-components/components/arcgis-assistant-message-text";
import "@arcgis/ai-components/components/arcgis-assistant-navigation-agent";
import "@arcgis/ai-components/components/arcgis-assistant-speech-input";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-scene";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";
import "@esri/calcite-components/components/calcite-slider";

import esriConfig from "@arcgis/core/config";
import type { ArcgisAssistant } from "@arcgis/ai-components/components/arcgis-assistant";
import type { ArcgisAssistantMessage } from "@arcgis/ai-components/components/arcgis-assistant-message";
import type Layer from "@arcgis/core/layers/Layer";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Portal from "@arcgis/core/portal/Portal";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";
import WebMap from "@arcgis/core/WebMap";
import type { ArcgisMap } from "@arcgis/map-components/components/arcgis-map";
import type { ArcgisScene } from "@arcgis/map-components/components/arcgis-scene";
import esriId from "@arcgis/core/identity/IdentityManager.js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { StarfieldCanvas } from "./starfield-canvas";
import { ArcgisAssistantMessageReadAloud } from "@arcgis/ai-components/components/arcgis-assistant-message-read-aloud";
import tars from "../agents/tars";

const WEBMAP_ID = "956580a5b5a54addba6958b6ff876c74";
const PORTAL_URL = "https://jsapi.maps.arcgis.com";
const MAP_ELEMENT_ID = "coopers-console-map";
const PRIMARY_LAYER_COUNT_TARGET = 10000;

const TIMINGS = {
  landingFadeMs: 700,
  panelSlideMs: 1000,
  glassScanMs: 820,
  mapIntroMs: 4200,
  tarsGlowMs: 3600,
  statusPulseMs: 1600,
  viewFadeMs: 420,
  scanlineMs: 9000,
} as const;

const animationVars = {
  "--landing-fade-ms": `${TIMINGS.landingFadeMs}ms`,
  "--panel-slide-ms": `${TIMINGS.panelSlideMs}ms`,
  "--glass-scan-ms": `${TIMINGS.glassScanMs}ms`,
  "--tars-glow-ms": `${TIMINGS.tarsGlowMs}ms`,
  "--status-pulse-ms": `${TIMINGS.statusPulseMs}ms`,
  "--view-fade-ms": `${TIMINGS.viewFadeMs}ms`,
  "--scanline-ms": `${TIMINGS.scanlineMs}ms`,
} as CSSProperties;

type Phase = "landing" | "transitioning" | "active";
type AssistantSignInState = "idle" | "signing-in" | "ready" | "error";
type ViewMode = "orbit" | "misery";
type MapLoadState = "loading" | "ready" | "error";
type AssistantResponseMessage = ArcgisAssistantMessage["message"];
type VoiceInputDraftChangeEvent = CustomEvent<{ value: string }>;

function readTextAloud(text: string) {
  const content = text.trim();
  if (!content || typeof window.SpeechSynthesisUtterance !== "function") return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function getReducedMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

async function signInForAiModels() {
  esriConfig.portalUrl = PORTAL_URL;
  const portal = Portal.getDefault();

  await esriId.getCredential(`${portal.url}/sharing`);
  await portal.load();
}

function findPrimaryFeatureLayer(webMap: WebMap) {
  const layerQueue: Layer[] = webMap.layers.toArray();

  while (layerQueue.length > 0) {
    const layer = layerQueue.shift();

    if (!layer) continue;

    if (layer instanceof FeatureLayer || layer.type === "feature") {
      return layer as FeatureLayer;
    }

    const childLayers = (
      layer as Layer & { layers?: { toArray: () => Layer[] } }
    ).layers?.toArray();

    if (childLayers) {
      layerQueue.push(...childLayers);
    }
  }

  return null;
}

function TarsColumn({ humor }: { humor: number }) {
  return (
    <div className={humor >= 50 ? "tars-column high-humor" : "tars-column"}>
      <span className="tars-label">TARS</span>
      <div className="tars-segment segment-one" />
      <div className="tars-segment segment-two" />
      <div className="tars-segment segment-three" />
      <div className="tars-segment segment-four" />
    </div>
  );
}

export function CoopersConsoleApp() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [assistantSignInState, setAssistantSignInState] =
    useState<AssistantSignInState>("idle");
  const [activeView, setActiveView] = useState<ViewMode>("orbit");
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>("loading");
  const [webMap, setWebMap] = useState<WebMap | null>(null);
  const [featureCount, setFeatureCount] = useState<number | null>(null);
  const [humor, setHumor] = useState(100);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState<AssistantResponseMessage>();
  const [readAloud, setReadAloud] = useState(false);

  const readAloudRef = useRef<ArcgisAssistantMessageReadAloud | null>(null);
  const assistantRef = useRef<ArcgisAssistant | null>(null);
  const primaryLayerRef = useRef<FeatureLayer | null>(null);
  const sceneElementRef = useRef<ArcgisScene | null>(null);
  const mapElementRef = useRef<ArcgisMap | null>(null);
  const sceneViewRef = useRef<SceneView | null>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const idleRotationRef = useRef<number | null>(null);
  const sceneIntroPlayedRef = useRef(false);

  const miseryFillPercent = Math.min(
    100,
    Math.round(((featureCount ?? 0) / PRIMARY_LAYER_COUNT_TARGET) * 100),
  );
  const viewportStatus =
    activeView === "orbit"
      ? "3D ORBIT · EARTH LOCK ESTABLISHED"
      : "MISERY MAP · AUTHORED WEBMAP VIEW";
  useEffect(() => {
    esriConfig.portalUrl = PORTAL_URL;

    const portal = new Portal({ url: PORTAL_URL });
    const loadedWebMap = new WebMap({
      portalItem: {
        id: WEBMAP_ID,
        portal,
      },
    });
    let cancelled = false;
    let loadSettled = false;
    let destroyed = false;

    function destroyLoadedWebMap() {
      if (destroyed) return;
      destroyed = true;
      loadedWebMap.destroy();
    }

    loadedWebMap
      .load()
      .then(() => {
        loadSettled = true;

        if (cancelled) {
          destroyLoadedWebMap();
          return;
        }

        const primaryLayer = findPrimaryFeatureLayer(loadedWebMap);
        primaryLayerRef.current = primaryLayer;
        setWebMap(loadedWebMap);
        setMapLoadState("ready");
      })
      .catch((error: unknown) => {
        loadSettled = true;

        if (cancelled || isAbortError(error)) {
          destroyLoadedWebMap();
          return;
        }

        destroyLoadedWebMap();
        setMapLoadState("error");
      });

    return () => {
      cancelled = true;
      if (loadSettled) destroyLoadedWebMap();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (idleRotationRef.current !== null) {
        window.cancelAnimationFrame(idleRotationRef.current);
      }
    };
  }, []);

  const updateLayerCountFromView = useCallback(
    async (view: MapView | SceneView) => {
      const primaryLayer = primaryLayerRef.current;
      if (!primaryLayer) return;

      try {
        const layerView = await view.whenLayerView(primaryLayer);
        const query = primaryLayer.createQuery();
        query.where = query.where || "1=1";
        const count = await (
          layerView as {
            queryFeatureCount: (
              query: ReturnType<FeatureLayer["createQuery"]>,
            ) => Promise<number>;
          }
        ).queryFeatureCount(query);
        setFeatureCount(count);
      } catch {
        try {
          const fallbackQuery = primaryLayer.createQuery();
          fallbackQuery.where = fallbackQuery.where || "1=1";
          setFeatureCount(await primaryLayer.queryFeatureCount(fallbackQuery));
        } catch {
          setFeatureCount(null);
        }
      }
    },
    [],
  );

  const syncViewpointTo = useCallback((target: ViewMode) => {
    const sceneView = sceneViewRef.current;
    const mapView = mapViewRef.current;

    if (target === "misery" && sceneView?.viewpoint && mapView) {
      mapView.goTo(sceneView.viewpoint, { animate: false }).catch(() => {});
    }

    if (target === "orbit" && mapView?.viewpoint && sceneView) {
      sceneView.goTo(mapView.viewpoint, { animate: false }).catch(() => {});
    }
  }, []);

  const startIdleRotation = useCallback((view: SceneView) => {
    if (getReducedMotionPreference()) return;

    let longitude = view.camera.position.longitude ?? -98;

    function rotate() {
      longitude = ((longitude + 0.035 + 180) % 360) - 180;
      const camera = view.camera.clone();
      camera.position.longitude = longitude;
      view.goTo(camera, { animate: false }).catch(() => {});
      idleRotationRef.current = window.requestAnimationFrame(rotate);
    }

    idleRotationRef.current = window.requestAnimationFrame(rotate);
  }, []);

  const handleSceneReady = useCallback(
    async (event: Event) => {
      const sceneElement = event.target as ArcgisScene;
      const view = sceneElement.view as SceneView | undefined;
      if (!view) return;

      sceneElementRef.current = sceneElement;
      sceneViewRef.current = view;
      await updateLayerCountFromView(view);

      if (sceneIntroPlayedRef.current) return;
      sceneIntroPlayedRef.current = true;

      const reducedMotion = getReducedMotionPreference();
      const cameraTarget = view.camera.clone();
      cameraTarget.position.longitude = -97;
      cameraTarget.position.latitude = 33;
      cameraTarget.position.z = 18000000;
      cameraTarget.heading = 18;
      cameraTarget.tilt = 0;

      if (reducedMotion) {
        await view.goTo(cameraTarget, { animate: false }).catch(() => {});
        return;
      }

      await view
        .goTo(cameraTarget, {
          animate: true,
          duration: TIMINGS.mapIntroMs,
          easing: "ease-in-out",
        })
        .catch(() => {});
      startIdleRotation(view);
    },
    [startIdleRotation, updateLayerCountFromView],
  );

  const handleMapReady = useCallback(
    async (event: Event) => {
      const mapElement = event.target as ArcgisMap;
      const view = mapElement.view as MapView | undefined;
      if (!view) return;

      mapElementRef.current = mapElement;
      mapViewRef.current = view;
      syncViewpointTo("misery");
      await updateLayerCountFromView(view);
    },
    [syncViewpointTo, updateLayerCountFromView],
  );

  const handleInitiate = async () => {
    setAssistantSignInState("signing-in");

    try {
      await signInForAiModels();
      setAssistantSignInState("ready");
    } catch (error) {
      console.error("Error signing in:", error);
      setAssistantSignInState("error");
      return;
    }

    setPhase("transitioning");
    const transitionDuration = getReducedMotionPreference()
      ? 0
      : TIMINGS.panelSlideMs + TIMINGS.glassScanMs;

    window.setTimeout(() => {
      setPhase("active");
    }, transitionDuration);
  };

  const handleViewChange = (event: Event) => {
    const value = (event.target as HTMLCalciteSegmentedControlElement).value as
      | ViewMode
      | undefined;
    const nextView = value ?? "orbit";
    syncViewpointTo(nextView);
    setActiveView(nextView);
  };

  const handleHumorInput = (event: Event) => {
    const value = (event.target as HTMLCalciteSliderElement).value;
    setHumor(Number(value));
  };

  const handleVoiceInputStop = () => {
    if (!transcript) return;
    // Handle voice input stop event
    void assistantRef.current?.submitMessage(transcript);
  };

  const handleVoiceInputTranscription = (event: VoiceInputDraftChangeEvent) => {
    const transcription = event.detail.value.trim();
    setTranscript(transcription);
  };

  console.log("tars: ", tars);

  return (
    <main
      className={`coopers-console calcite-mode-dark phase-${phase}`}
      style={animationVars}
    >
      <StarfieldCanvas />

      <section className="landing" aria-hidden={phase !== "landing"}>
        <div className="landing-stack">
          <p className="eyebrow">ENDURANCE MISSION · TARS UNIT DIAGNOSTIC</p>
          <h1>COOPER&apos;S CONSOLE</h1>
          <p className="tagline">
            Orbital telemetry, human panic, machine sarcasm.
          </p>
          <div className="divider" />
          <calcite-button
            className="initiate-button"
            disabled={
              mapLoadState === "error" || assistantSignInState === "signing-in"
            }
            kind="brand"
            loading={
              mapLoadState === "loading" ||
              assistantSignInState === "signing-in"
            }
            onClick={handleInitiate}
            scale="l"
          >
            INITIATE SEQUENCE
          </calcite-button>
          {mapLoadState === "error" ? (
            <p className="load-error">
              WEBMAP LINK FAILED. CHECK PORTAL ACCESS.
            </p>
          ) : null}
          {assistantSignInState === "error" ? (
            <p className="load-error">
              ASSISTANT SIGN-IN FAILED. CHECK PORTAL ACCESS.
            </p>
          ) : null}
        </div>
      </section>

      <section className="viewport-panel" aria-label="Mission viewport">
        {webMap ? (
          <>
            <div
              className={
                activeView === "orbit" ? "view-layer active" : "view-layer"
              }
            >
              <arcgis-scene
                alpha-compositing-enabled
                camera-heading="0"
                camera-position="-97, 33, 43000000"
                camera-tilt="0"
                map={webMap}
                onarcgisViewReadyChange={handleSceneReady}
                popup-disabled
                ref={sceneElementRef}
              ></arcgis-scene>
            </div>

            <div
              className={
                activeView === "misery" ? "view-layer active" : "view-layer"
              }
            >
              <arcgis-map
                data-item-id={WEBMAP_ID}
                id={MAP_ELEMENT_ID}
                map={webMap}
                onarcgisViewReadyChange={handleMapReady}
                ref={mapElementRef}
              ></arcgis-map>
            </div>
          </>
        ) : (
          <div className="viewport-loader">
            <calcite-loader
              inline
              label="Loading WebMap"
              scale="l"
            ></calcite-loader>
          </div>
        )}

        <div className="hud" aria-hidden="true">
          <span className="corner top-left" />
          <span className="corner top-right" />
          <span className="corner bottom-left" />
          <span className="corner bottom-right" />
          <div className="hud-status">{viewportStatus}</div>
          <div className="misery-meter">
            <span>MISERY METER</span>
            <strong>
              {featureCount === null ? "--" : featureCount.toLocaleString()}
            </strong>
            <div className="meter-track">
              <div
                className="meter-fill"
                style={{ width: `${miseryFillPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="view-toggle">
          <calcite-segmented-control
            label-text="Viewport mode"
            oncalciteSegmentedControlChange={handleViewChange}
            scale="s"
            value={activeView}
          >
            <calcite-segmented-control-item checked value="orbit">
              3D ORBIT
            </calcite-segmented-control-item>
            <calcite-segmented-control-item value="misery">
              MISERY MAP
            </calcite-segmented-control-item>
          </calcite-segmented-control>
        </div>

        <div className="glass-scan" />
      </section>

      <section
        aria-hidden={phase === "landing"}
        aria-label="TARS command console"
        className="console-panel"
      >
        {phase !== "landing" ? (
          <>
            <TarsColumn humor={humor} />

            <div className="console-main">
              <arcgis-assistant
                ref={assistantRef}
                className="mission-assistant"
                // description={transcript}
                // entryMessage={`Boot sequence complete. Humor locked at ${humor} percent. I can navigate, inspect layers, and answer questions about ${primaryLayerTitle}.`}
                heading={""}
                referenceElement={`#${MAP_ELEMENT_ID}`}
                // suggestedPrompts={ASSISTANT_PROMPTS}
                onarcgisResponse={(event) => {
                  console.log(event);
                  setMessage(event.detail);
                  setReadAloud(true);
                  // readAloudRef.current?.click();
                  readTextAloud(event.detail.content ?? "");
                }}
              >
                {/* <arcgis-assistant-navigation-agent></arcgis-assistant-navigation-agent> */}
                {/* <arcgis-assistant-data-exploration-agent></arcgis-assistant-data-exploration-agent>
                <arcgis-assistant-help-agent></arcgis-assistant-help-agent>                 */}
                <arcgis-assistant-agent agent={tars}></arcgis-assistant-agent>
                <div slot="messages">
                  <arcgis-assistant-message message={message}>
                    <arcgis-assistant-message-text
                      slot="content"
                      content={message?.content}
                    ></arcgis-assistant-message-text>
                  </arcgis-assistant-message>
                </div>
                <span slot="chat-entry">
                  {transcript || "Waiting for input..."}
                </span>
                <header className="console-header" slot="chat-entry">
                  <div className="online-status">
                    <span className="status-dot" />
                    <span>TARS · ONLINE</span>
                  </div>
                  <div className="console-controls">
                    <div className="humor-control">
                      <span>HUMOR</span>
                      <calcite-slider
                        label-handles
                        label-ticks
                        max={100}
                        min={0}
                        oncalciteSliderInput={handleHumorInput}
                        scale="s"
                        step={25}
                        ticks={25}
                        value={humor}
                      ></calcite-slider>
                      <strong>{humor}%</strong>
                    </div>
                    <div className="assistant-input">
                      <arcgis-assistant-message-read-aloud
                        ref={readAloudRef}
                        message={message}
                        readAloudEnabled={readAloud}
                      ></arcgis-assistant-message-read-aloud>
                      <arcgis-assistant-speech-input
                        onarcgisVoiceInputStart={() => setTranscript("")}
                        onarcgisVoiceInputStop={handleVoiceInputStop}
                        onarcgisVoiceInputDraftChange={
                          handleVoiceInputTranscription
                        }
                      ></arcgis-assistant-speech-input>
                    </div>
                  </div>
                </header>
              </arcgis-assistant>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
