"use client";

import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-stepper";
import "@esri/calcite-components/components/calcite-stepper-item";
import { useRef, useState } from "react";
import type { RoastPersona } from "./oops-roast-agent/types";

const PERSONAS: { value: RoastPersona; label: string }[] = [
  { value: "cartographer", label: "Cartographer" },
  { value: "chef", label: "Chef" },
  { value: "movie", label: "Movie Critic" },
  { value: "detective", label: "Detective" },
  { value: "sports", label: "Sports Commentator" },
  { value: "hr", label: "HR Manager" },
];

interface OopsStepperProps {
  onComplete: (portalUrl: string, webmapId: string, persona: RoastPersona) => void;
  initialPortalUrl?: string;
  initialWebmapId?: string;
}

export function OopsStepper({ onComplete, initialPortalUrl, initialWebmapId }: OopsStepperProps) {
  const [step, setStep] = useState(() => initialWebmapId ? 1 : 0);
  const [portalUrl, setPortalUrl] = useState(initialPortalUrl ?? "https://www.arcgis.com");
  const [webmapId, setWebmapId] = useState(initialWebmapId ?? "");
  const [persona, setPersona] = useState<RoastPersona>("cartographer");
  const selectRef = useRef<HTMLCalciteSelectElement>(null);

  const steps = ["Welcome", "Portal", "Web Map", "Launch"];

  return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          <calcite-notice open color="blue" width="full">
            <div slot="title">Welcome to Oops Map</div>
            <div slot="message">
              This setup wizard will connect your ArcGIS portal and load a web map for AI-assisted exploration.
              Follow the steps to configure your portal URL and web map item ID.
            </div>
          </calcite-notice>
          <calcite-notice open color="yellow" width="full">
            <div slot="title">Login Required</div>
            <div slot="message">
              You will be prompted to sign in to your ArcGIS portal after completing this setup.
              Make sure you have access to the web map you want to load.
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
              <strong>https://www.arcgis.com</strong> for ArcGIS Online, or your organization's
              Enterprise portal URL (e.g. <strong>https://gis.myorg.com/portal</strong>).
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <calcite-button appearance="outline" width="half" onClick={() => setStep(0)}>
              Back
            </calcite-button>
            <calcite-button width="half" disabled={!portalUrl || undefined} onClick={() => setStep(2)}>
              Next
            </calcite-button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <calcite-notice open color="blue" width="full">
            <div slot="title">Web Map Item ID</div>
            <div slot="message">
              Enter the item ID of the web map you want to load. You can find this in the URL of
              the item page on your portal (e.g. <strong>https://www.arcgis.com/home/item.html?id=<em>YOUR_ID_HERE</em></strong>).
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
            <calcite-button appearance="outline" width="half" onClick={() => setStep(1)}>
              Back
            </calcite-button>
            <calcite-button width="half" disabled={!webmapId || undefined} onClick={() => setStep(3)}>
              Next
            </calcite-button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <calcite-notice open color="green" width="full">
            <div slot="title">Ready to Launch</div>
            <div slot="message">
              Your configuration looks good. Click <strong>Launch</strong> to load your map.
              You may be prompted to sign in to <strong>{portalUrl}</strong>.
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
            <calcite-select
              label=""
              ref={selectRef}
              oncalciteSelectChange={() =>
                setPersona((selectRef.current?.value as RoastPersona) ?? "cartographer")
              }
            >
              {PERSONAS.map(({ value, label }) => (
                <calcite-option key={value} value={value} selected={value === persona}>
                  {label}
                </calcite-option>
              ))}
            </calcite-select>
          </calcite-label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <calcite-button appearance="outline" width="half" onClick={() => setStep(2)}>
              Back
            </calcite-button>
            <calcite-button width="half" onClick={() => onComplete(portalUrl, webmapId, persona)}>
              Launch
            </calcite-button>
          </div>
        </div>
      )}
    </div>
  );
}
