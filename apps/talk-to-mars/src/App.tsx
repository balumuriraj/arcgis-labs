"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./register";
import { AGENT_ID, createMarsAgent } from "./agent/agent";
import { Cards } from "./cards/Cards";
import { createMarsApp, type MarsApp } from "./map/controller";
import { createEarthScene } from "./map/earth";
import { createMarsScene } from "./map/mars";
import { MARS_SR } from "./map/scale";
import { startTour } from "./tour";

// Prerelease SDK builds close the popup's content but leave the popup itself open.
const closePopup = (event: { target: HTMLArcgisPopupElement }) =>
  (event.target.open = false);

export default function App() {
  // The maps and layers are declared up front; the scene components own their views.
  const [mars] = useState(createMarsScene);
  const [earth] = useState(createEarthScene);
  const [app, setApp] = useState<MarsApp>();
  const [showWork, setShowWork] = useState(false);
  const agent = useMemo(() => app && createMarsAgent(app), [app]);

  const marsEl = useRef<HTMLArcgisSceneElement>(null);
  const earthEl = useRef<HTMLArcgisSceneElement>(null);
  const slider = useRef<HTMLArcgisTimeSliderElement>(null);
  const assistant = useRef<HTMLArcgisAssistantElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let created: MarsApp | undefined;
    let unmounted = false;
    const elements = {
      mars: marsEl.current!,
      earth: earthEl.current!,
      slider: slider.current!,
      assistant: assistant.current!,
      stage: stage.current!,
    };
    createMarsApp(elements, mars).then(
      (result) => {
        if (unmounted) return result.destroy();
        created = result;
        setApp(result);
      },
      (error: unknown) => console.error("Mars could not start:", error),
    );
    return () => {
      unmounted = true;
      created?.destroy();
    };
  }, [mars, earth]);

  // Suggested prompts that walk through the demo, one step at a time (tour.ts).
  useEffect(() => startTour(assistant.current!), []);

  return (
    <div className="mars-app">
      <calcite-shell>
        <calcite-navigation slot="header">
          <calcite-navigation-logo
            slot="logo"
            heading="Talk to Mars"
            description="An agentic map, 225 million km from the usual one"
            icon="globe"
          />
        </calcite-navigation>

        <div ref={stage} className="stage" data-world="earth">
          <arcgis-scene
            ref={marsEl}
            id="mars"
            map={mars.map}
            spatialReference={MARS_SR}
            aria-label="Mars"
          >
            <arcgis-popup slot="popup" onarcgisClose={closePopup} />
            <arcgis-zoom slot="top-left" />
            <arcgis-navigation-toggle slot="top-left" />
            <arcgis-compass slot="top-left" />
            <arcgis-expand
              slot="top-right"
              expandIcon="legend"
              expandTooltip="Legend"
              mode="floating"
            >
              <arcgis-legend legendStyle="classic" />
            </arcgis-expand>
            <arcgis-time-slider
              ref={slider}
              slot="bottom-left"
              layout="auto"
              mode="cumulative-from-start"
              playRate={160}
              timeZone="Etc/UTC"
            />
          </arcgis-scene>

          <arcgis-scene
            ref={earthEl}
            id="earth"
            map={earth.map}
            aria-label="Earth"
          >
            <arcgis-popup slot="popup" onarcgisClose={closePopup} />
            <arcgis-zoom slot="top-left" />
            <arcgis-compass slot="top-left" />
          </arcgis-scene>
        </div>

        {/* The guide's work: every step it takes, the tools it calls, how long they take, and what they cost. */}
        <calcite-shell-panel
          slot="panel-bottom"
          height="m"
          resizable
          collapsed={!showWork}
        >
          <arcgis-assistant-observation-panel referenceElement="assistant" />
        </calcite-shell-panel>

        <calcite-shell-panel slot="panel-end" width="l" resizable>
          <arcgis-assistant
            ref={assistant}
            id="assistant"
            runtime-events-enabled
            heading="Mars guide"
            entryMessage="Ask me anything. I'll drive the globe."
            alwaysUseAgentId={agent ? AGENT_ID : undefined}
            voice-input-enabled
          >
            <calcite-action
              slot="entry-actions-start"
              icon="activity-monitor"
              text={
                showWork ? "Hide the guide's work" : "Show the guide's work"
              }
              active={showWork}
              scale="s"
              onClick={() => setShowWork((shown) => !shown)}
            />
            {agent ? <arcgis-assistant-agent agent={agent} /> : null}
            {app ? <Cards app={app} /> : null}
          </arcgis-assistant>
        </calcite-shell-panel>
      </calcite-shell>
    </div>
  );
}
