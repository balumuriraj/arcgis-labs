"use client";

import type { ToneMode } from "@repo/roast-analyzer";
import { useState } from "react";
import styles from "../page.module.css";
import { LayerSelector } from "./layer-selector";
import { MapShell } from "./map-shell";
import { RoastPanel } from "./roast-panel";
import type { RoastApiResponse } from "./types";

const DEFAULT_LAYER_URL =
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/3";
const DEFAULT_TONE: ToneMode = "deadpan";

function isRoastApiResponse(payload: unknown): payload is RoastApiResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Partial<RoastApiResponse>;
  return (
    typeof candidate.layerTitle === "string" &&
    Array.isArray(candidate.findings) &&
    Array.isArray(candidate.notes)
  );
}

export function LayerRoastApp() {
  const [layerUrl, setLayerUrl] = useState(DEFAULT_LAYER_URL);
  const [tone, setTone] = useState<ToneMode>(DEFAULT_TONE);
  const [result, setResult] = useState<RoastApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const roastLayer = async () => {
    const normalizedUrl = layerUrl.trim();
    if (normalizedUrl.length === 0) {
      setError("A layer URL is required.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          layerUrl: normalizedUrl,
          tone,
          maxFindings: 6,
        }),
      });

      const payload = (await response.json()) as
        | RoastApiResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          typeof payload === "object" && payload && "error" in payload
            ? payload.error ?? "Roast request failed."
            : "Roast request failed.",
        );
      }

      if (!isRoastApiResponse(payload)) {
        throw new Error("Unexpected roast response shape.");
      }

      setResult(payload);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unexpected roast request failure.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.workspace}>
      <aside className={styles.controlPanel}>
        <LayerSelector
          layerUrl={layerUrl}
          tone={tone}
          isLoading={isLoading}
          error={error}
          onLayerUrlChange={setLayerUrl}
          onToneChange={setTone}
          onSubmit={roastLayer}
        />
        <RoastPanel result={result} isLoading={isLoading} />
      </aside>

      <section className={styles.mapPanel}>
        <h2 className={styles.sectionTitle}>Map preview</h2>
        <MapShell layerUrl={layerUrl} />
      </section>
    </section>
  );
}