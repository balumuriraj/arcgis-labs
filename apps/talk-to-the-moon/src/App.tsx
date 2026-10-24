"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./register";
import { AGENT_ID, createMoonAgent } from "./agent/agent";
import { Cards } from "./cards/Cards";
import { createMoonApp, type MoonApp } from "./map/controller";
import { createEarthScene } from "./map/earth";
import { createMoonScene } from "./map/moon";

const SUGGESTED_PROMPTS = [
  "Go to the Moon",
  "Show me every place we've landed on the Moon",
  "Show the Moon as it was in 1969",
  "Why did it go quiet?",
  "Stand the Burj Khalifa in Tycho crater",
  "What are the nearest craters to Apollo 11?",
];

// SDK 6.0.0-next.14 closes the popup's content but leaves the popup itself open.
const closePopup = (event: { target: HTMLArcgisPopupElement }) => (event.target.open = false);

export default function App() {
  // The maps and layers are declared up front; the scene components own their views.
  const [moon] = useState(createMoonScene);
  const [earth] = useState(createEarthScene);
  const [app, setApp] = useState<MoonApp>();
  const agent = useMemo(() => app && createMoonAgent(app), [app]);

  const moonEl = useRef<HTMLArcgisSceneElement>(null);
  const earthEl = useRef<HTMLArcgisSceneElement>(null);
  const slider = useRef<HTMLArcgisTimeSliderElement>(null);
  const assistant = useRef<HTMLArcgisAssistantElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let created: MoonApp | undefined;
    let unmounted = false;
    const elements = { moon: moonEl.current!, earth: earthEl.current!, slider: slider.current!, assistant: assistant.current!, stage: stage.current! };
    createMoonApp(elements, moon, earth).then(
      (result) => {
        if (unmounted) return result.destroy();
        created = result;
        setApp(result);
      },
      (error: unknown) => console.error("The Moon could not start:", error),
    );
    return () => {
      unmounted = true;
      created?.destroy();
    };
  }, [moon, earth]);

  return (
    <div className="moon-app">
      <calcite-shell>
        <calcite-navigation slot="header">
          <calcite-navigation-logo
            slot="logo"
            heading="Talk to the Moon"
            description="An agentic map, 384,400 km from the usual one"
            icon="globe"
          />
        </calcite-navigation>

        <div ref={stage} className="stage" data-world="earth">
          <arcgis-scene ref={moonEl} id="moon" map={moon.map} aria-label="The Moon">
            <arcgis-popup slot="popup" onarcgisClose={closePopup} />
            <arcgis-zoom slot="top-left" />
            <arcgis-navigation-toggle slot="top-left" />
            <arcgis-compass slot="top-left" />
            <arcgis-expand slot="top-right" expandIcon="legend" expandTooltip="Legend" mode="floating">
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

          <arcgis-scene ref={earthEl} id="earth" map={earth.map} aria-label="Earth">
            <arcgis-popup slot="popup" onarcgisClose={closePopup} />
            <arcgis-zoom slot="top-left" />
            <arcgis-compass slot="top-left" />
          </arcgis-scene>
        </div>

        <calcite-shell-panel slot="panel-end" width="l" resizable>
          <arcgis-assistant
            ref={assistant}
            heading="Moon guide"
            entryMessage="Ask me anything. I'll drive the globe."
            alwaysUseAgentId={agent ? AGENT_ID : undefined}
            suggestedPrompts={agent ? SUGGESTED_PROMPTS : undefined}
            voice-input-enabled
            read-aloud-enabled={process.env.NEXT_PUBLIC_READ_ALOUD === "true"}
          >
            {agent ? <arcgis-assistant-agent agent={agent} /> : null}
            {app ? <Cards app={app} /> : null}
          </arcgis-assistant>
        </calcite-shell-panel>
      </calcite-shell>
    </div>
  );
}
