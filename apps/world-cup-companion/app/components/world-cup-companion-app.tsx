"use client";

import "@arcgis/ai-components/components/arcgis-assistant";
import "@arcgis/ai-components/components/arcgis-assistant-agent";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-map";

import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";

import { useState } from "react";
import { agent as conditionsAgent } from "../agents/conditions-agent";
import { agent as matchesAgent } from "../agents/matches-agent";
import { agent as ticketsAgent } from "../agents/tickets-agent";
import { getWorldCupMapContext } from "../support/utils";
import {
  AssistantSlottableContent,
  type AssistantSlottableRequestDetail,
} from "./assistant-slottable-content";

export function WorldCupCompanionApp() {
  const [slottableRequests, setSlottableRequests] = useState<
    AssistantSlottableRequestDetail[]
  >([]);

  return (
    <calcite-shell>
      <calcite-panel>
        <arcgis-map id="world-cup-map" item-id="d4a56a260c0e42a1b0fdf2143318da19">
          <arcgis-expand slot="top-left">
            <arcgis-legend></arcgis-legend>
          </arcgis-expand>
        </arcgis-map>
      </calcite-panel>
      <calcite-shell-panel slot="panel-end" width="l">
        <arcgis-assistant
          heading="World Cup Companion"
          description="World Cup map, tickets, and conditions demo"
          reference-element="#world-cup-map"
          suggestedPrompts={[
            "Show me Argentina's group matches",
            "What's the forecast in Dallas on June 22?",
            "Tickets for Argentina vs Austria",
          ]}
          keepSuggestedPrompts={true}
          logEnabled={true}
          feedbackEnabled={true}
          onarcgisSlottableRequest={(event) => {
            const nextRequest = event.detail;

            setSlottableRequests(
              (currentRequests: AssistantSlottableRequestDetail[]) => {
                const remainingRequests = currentRequests.filter(
                  (request) => request.slotName !== nextRequest.slotName,
                );
                return !nextRequest.data
                  ? remainingRequests
                  : [...remainingRequests, nextRequest];
              },
            );
          }}
        >
          <arcgis-assistant-agent
            agent={matchesAgent}
            context={getWorldCupMapContext}
          ></arcgis-assistant-agent>
          <arcgis-assistant-agent
            agent={ticketsAgent}
            context={getWorldCupMapContext}
          ></arcgis-assistant-agent>
          <arcgis-assistant-agent
            agent={conditionsAgent}
          ></arcgis-assistant-agent>

          <AssistantSlottableContent slottableRequests={slottableRequests} />

          <calcite-icon slot="header-actions-start" icon="soccer" scale="l" style={{ marginLeft: "0.5rem" }}></calcite-icon>

          <calcite-notice
            slot="entry-message"
            open
            icon
            kind="brand"
            width="full"
          >
            <div slot="title">World Cup Companion</div>
            <div slot="message">
              Ask about World Cup matches, mocked ticket tiers, or match-day
              weather.
            </div>
          </calcite-notice>
        </arcgis-assistant>
      </calcite-shell-panel>
    </calcite-shell>
  );
}
