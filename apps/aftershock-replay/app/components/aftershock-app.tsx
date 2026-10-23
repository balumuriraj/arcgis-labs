"use client";

import "@arcgis/ai-components/components/arcgis-assistant";
import "@arcgis/ai-components/components/arcgis-assistant-agent";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-time-slider";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-navigation";
import "@esri/calcite-components/components/calcite-navigation-logo";
import "@esri/calcite-components/components/calcite-notice";

import esriConfig from "@arcgis/core/config.js";
import type { ArcgisAssistant } from "@arcgis/ai-components/components/arcgis-assistant";
import type { ArcgisMap } from "@arcgis/map-components/components/arcgis-map";
import type { ArcgisTimeSlider } from "@arcgis/map-components/components/arcgis-time-slider";
import { useEffect, useRef, useState } from "react";
import { createSequenceAgent } from "../lib/sequence-agent";
import { ReplayController, type Action } from "../lib/replay-controller";
import { ChatCard } from "./chat-card";

esriConfig.portalUrl =
  process.env.NEXT_PUBLIC_ARCGIS_PORTAL_URL || "https://www.arcgis.com";

type Registration = Awaited<ReturnType<typeof createSequenceAgent>>;
type Slots = ArcgisAssistant["slottableRequests"];

export default function AftershockApp() {
  const mapRef = useRef<ArcgisMap>(null);
  const sliderRef = useRef<ArcgisTimeSlider>(null);
  const assistantRef = useRef<ArcgisAssistant>(null);
  const [mapReady, setMapReady] = useState(false);
  const [sliderReady, setSliderReady] = useState(false);
  const [controller, setController] = useState<ReplayController>();
  const [agent, setAgent] = useState<Registration>();
  const [slots, setSlots] = useState<Slots>([]);
  const [error, setError] = useState("");
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    const slider = sliderRef.current;
    if (!mapReady || !sliderReady || !map || !slider) return;
    let cancelled = false;
    const reportError = (reason: unknown) => {
      if (cancelled) return;
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error("Aftershock Replay:", reason);
      setError(message);
      const content = `Unable to complete that operation: ${message}`;
      assistantRef.current?.messages.add({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        blocks: [{ type: "text", data: { content } }],
      });
    };
    const replay = new ReplayController(map.view, slider, reportError);
    void (async () => {
      try {
        await replay.initialize();
        if (!cancelled) setDataReady(true);
      } catch (reason) {
        reportError(reason);
      }
      if (cancelled) return;
      setController(replay);
      try {
        const registration = await createSequenceAgent(replay);
        if (!cancelled) setAgent(registration);
      } catch (reason) {
        reportError(reason);
      }
    })();
    return () => {
      cancelled = true;
      replay.destroy();
    };
  }, [mapReady, sliderReady]);

  const reportError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("Aftershock Replay:", reason);
    setError(message);
    assistantRef.current?.messages.add({
      id: crypto.randomUUID(),
      role: "assistant",
      content: message,
      blocks: [{ type: "text", data: { content: message } }],
    });
  };

  const onAction = async (action: Action) => {
    if (!controller) throw new Error("The layer is still loading.");
    const result = await controller.action(action);
    assistantRef.current?.messages.add({
      id: crypto.randomUUID(),
      role: "assistant",
      content: result.text,
      blocks: [
        { type: "text", data: { content: result.text } },
        ...(result.cardId
          ? [{ type: "aftershock-card", data: { cardId: result.cardId } }]
          : []),
      ],
    });
  };

  return (
    <calcite-shell>
      <calcite-navigation slot="header">
        <calcite-navigation-logo
          slot="logo"
          heading="Aftershock Replay"
          description="Ridgecrest | July 2019"
        />
      </calcite-navigation>
      <calcite-panel>
        <arcgis-map
          id="aftershock-map"
          ref={mapRef}
          basemap="gray-vector"
          center="-117.6,35.8"
          zoom={9}
          onarcgisViewReadyChange={() => setMapReady(true)}
        >
          <arcgis-zoom slot="top-left" />
          <arcgis-time-slider
            slot="bottom-left"
            ref={sliderRef}
            reference-element="aftershock-map"
            time-zone="America/Los_Angeles"
            timeVisible={true}
            onarcgisReady={() => setSliderReady(true)}
          />
        </arcgis-map>
      </calcite-panel>
      <calcite-shell-panel slot="panel-end" width="l">
        {agent ? (
          <arcgis-assistant
            ref={assistantRef}
            heading="Aftershock Guide"
            description="Explore the sequence. Drive the timeline."
            alwaysUseAgentId="aftershock-guide"
            allowedAgentIds={["aftershock-guide"]}
            suggestedPrompts={
              dataReady
                ? [
                    "What was the biggest earthquake sequence here in July 2019?",
                    "When did it calm down?",
                    "Filter by magnitude",
                  ]
                : []
            }
            onarcgisError={(event) => reportError(event.detail)}
            onarcgisSlottableRequest={(event) =>
              setSlots([...event.currentTarget.slottableRequests])
            }
          >
            <arcgis-assistant-agent agent={agent} />
            <calcite-notice
              slot="entry-message"
              open
              icon
              kind={error ? "danger" : "info"}
              width="full"
            >
              <span slot="title">
                {error
                  ? "Something needs attention"
                  : dataReady
                    ? "Replay a sequence, not just an answer"
                    : "Loading earthquake layer..."}
              </span>
              <span slot="message">
                {error ||
                  "Ask about the biggest sequence, then use the cards to explore. All times are California local time. This is a historical M1.5+ catalog snapshot, not a safety forecast."}
              </span>
            </calcite-notice>
            <div slot="footer-content">
              {error ? (
                <calcite-notice open kind="danger" icon width="full">
                  <span slot="title">Unable to complete the operation</span>
                  <span slot="message">{error}</span>
                </calcite-notice>
              ) : null}
              <calcite-button
                appearance="outline"
                disabled={!dataReady}
                onClick={() => void onAction("find").catch(reportError)}
              >
                Explore sequence
              </calcite-button>
            </div>
            {controller
              ? slots.map((request) => {
                  const block = request.data?.block;
                  if (block?.type !== "aftershock-card") return null;
                  const cardId = block.data?.cardId;
                  if (
                    typeof cardId !== "string" ||
                    !controller.cards.has(cardId)
                  )
                    return null;
                  return (
                    <ChatCard
                      key={request.slotName}
                      slotName={request.slotName}
                      cardId={cardId}
                      controller={controller}
                      onAction={onAction}
                    />
                  );
                })
              : null}
          </arcgis-assistant>
        ) : (
          <calcite-panel heading="Aftershock Guide" loading>
            <p role="status">Loading the local earthquake layer and guide...</p>
            {error ? <p role="alert">{error}</p> : null}
          </calcite-panel>
        )}
      </calcite-shell-panel>
    </calcite-shell>
  );
}
