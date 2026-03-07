"use client";

import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-stepper";
import "@esri/calcite-components/components/calcite-stepper-item";
import { useState } from "react";
import { PERSONA_OPTIONS } from "./oops-roast-agent/personas";
import type { RoastPersona } from "./oops-roast-agent/types";

interface OopsStepperProps {
  onComplete: (
    portalUrl: string,
    webmapId: string,
    persona: RoastPersona,
  ) => void;
  initialPortalUrl?: string;
  initialWebmapId?: string;
}

export function OopsStepper({
  onComplete,
  initialPortalUrl,
  initialWebmapId,
}: OopsStepperProps) {
  const [step, setStep] = useState(() => (initialWebmapId ? 1 : 0));
  const [portalUrl, setPortalUrl] = useState(
    initialPortalUrl ?? "https://www.arcgis.com",
  );
  const [webmapId, setWebmapId] = useState(initialWebmapId ?? "");
  const [persona, setPersona] = useState<RoastPersona>("cartographer");

  const handlePersonaChange = (event: Event) => {
    const el = event.target as HTMLCalciteListElement;
    const selected = el.selectedItems?.[0] as
      | HTMLCalciteListItemElement
      | undefined;
    if (selected?.value) {
      setPersona(selected.value as RoastPersona);
    }
  };

  const steps = ["Welcome", "Map Setup", "Launch"];

  return (
    <div
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <calcite-stepper numbered layout="horizontal">
        {steps.map((label, i) => (
          <calcite-stepper-item
            key={label}
            heading={label}
            {...(i === step ? { selected: true } : {})}
          />
        ))}
      </calcite-stepper>

      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <calcite-card>
            {/* Slotted calcite-card thumbnail requires a direct img element. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              slot="thumbnail"
              alt="map roast reaction"
              src={"/oopsMap.png"}
              style={{ width: "100%", objectFit: "cover" }}
            />
            <h1 slot="heading">Welcome to Oops Map</h1>
            <div slot="description">
              Let’s be honest: default symbology is a crime, and your web maps
              are probably guilty. OopsMap connects to your ArcGIS Portal to
              brutally roast your cartography choices. But this isn't just a
              critique—it's a game.
            </div>
          </calcite-card>
          <calcite-notice open color="yellow" width="full">
            <div slot="title">How this works</div>
            <div slot="message">
              <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
                <li>Enter your ArcGIS portal URL and the item ID of your web map.</li>
                <li>Pick a roast persona — each one judges your map from a different angle.</li>
                <li>Spot the flaw — submit your best roast across 3 rounds, and the AI scores how well you nailed it.</li>
                <li>After 3 rounds, get a final verdict and a full post-game breakdown.</li>
              </ol>
            </div>
          </calcite-notice>

          <calcite-notice
            open
            icon="exclamation-mark-triangle"
            appearance="outline-fill"
            kind="warning"
          >
            <div slot="message">
              OopsMap is not responsible for hurt feelings, imposter syndrome,
              or sudden urges to delete your entire GIS portfolio.
            </div>
          </calcite-notice>

          <calcite-button width="full" onClick={() => setStep(1)}>
            Get Started
          </calcite-button>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <calcite-notice open color="blue" width="full">
            <div slot="title">Portal URL</div>
            <div slot="message">
              Enter the URL of your ArcGIS portal. Use{" "}
              <strong>https://www.arcgis.com</strong> for ArcGIS Online, or your
              organization&apos;s Enterprise portal URL (e.g.{" "}
              <strong>https://gis.myorg.com/portal</strong>).
            </div>
          </calcite-notice>
          <calcite-label>
            Portal URL
            <calcite-input
              type="text"
              value={portalUrl}
              placeholder="https://www.arcgis.com"
              oncalciteInputInput={(e: CustomEvent) =>
                setPortalUrl((e.target as HTMLInputElement).value)
              }
            />
          </calcite-label>
          <calcite-notice open color="blue" width="full">
            <div slot="title">Web Map Item ID</div>
            <div slot="message">
              Enter the item ID of the web map you want to load. You can find
              this in the URL of the item page on your portal (e.g.{" "}
              <strong>
                https://www.arcgis.com/home/item.html?id=<em>YOUR_ID_HERE</em>
              </strong>
              ).
            </div>
          </calcite-notice>
          <calcite-label>
            Web Map Item ID
            <calcite-input
              type="text"
              value={webmapId}
              placeholder="e.g. 680ecd73ae634c8a823984a2d49d29b7"
              oncalciteInputInput={(e: CustomEvent) =>
                setWebmapId((e.target as HTMLInputElement).value.trim())
              }
            />
          </calcite-label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <calcite-button
              appearance="outline"
              width="half"
              onClick={() => setStep(0)}
            >
              Back
            </calcite-button>
            <calcite-button
              width="half"
              disabled={!portalUrl || !webmapId || undefined}
              onClick={() => setStep(2)}
            >
              Next
            </calcite-button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <calcite-notice open color="green" width="full">
            <div slot="title">Ready to Launch</div>
            <div slot="message">
              Your configuration looks good. Click <strong>Launch</strong> to
              load your map. You may be prompted to sign in to{" "}
              <strong>{portalUrl}</strong>.
            </div>
          </calcite-notice>
          <calcite-notice open color="blue" width="full">
            <div slot="title">Portal</div>
            <div slot="message">{portalUrl}</div>
          </calcite-notice>
          <calcite-notice open color="blue" width="full">
            <div slot="title">Web Map ID</div>
            <div slot="message">{webmapId}</div>
          </calcite-notice>
          <calcite-label>
            Roast Persona
            <calcite-list
              label="Roast personas"
              selection-mode="single"
              oncalciteListChange={handlePersonaChange}
            >
              {PERSONA_OPTIONS.map(({ value, label, emoji, description }) => (
                <calcite-list-item
                  key={value}
                  label={`${emoji} ${label}`}
                  description={description}
                  value={value}
                  selected={value === persona || undefined}
                />
              ))}
            </calcite-list>
          </calcite-label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <calcite-button
              appearance="outline"
              width="half"
              onClick={() => setStep(1)}
            >
              Back
            </calcite-button>
            <calcite-button
              width="half"
              onClick={() => onComplete(portalUrl, webmapId, persona)}
            >
              Launch
            </calcite-button>
          </div>
        </div>
      )}
    </div>
  );
}
