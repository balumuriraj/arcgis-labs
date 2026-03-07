import {
  invokeStructuredPrompt,
  type ArcgisStructuredPromptOptions,
} from "@arcgis/ai-components/utils/index.js";
import { z } from "zod";
import type MapView from "@arcgis/core/views/MapView.js";
import { escapePromptTemplateBraces } from "./message-utils";
import type { VisibleLayerSummary } from "./types";

type RendererInsightResult = {
  layers: Array<{
    title: string;
    rendererDescription: string;
  }>;
};

const rendererInsightSchema = z.object({
  layers: z.array(
    z.object({
      title: z.string(),
      rendererDescription: z.string(),
    }),
  ),
});

const promptSchema =
  rendererInsightSchema as unknown as ArcgisStructuredPromptOptions<RendererInsightResult>["schema"];

function getRendererJson(renderer: unknown): unknown {
  if (!renderer || typeof renderer !== "object") {
    return null;
  }

  const candidate = renderer as { toJSON?: () => unknown };
  if (typeof candidate.toJSON === "function") {
    try {
      return candidate.toJSON();
    } catch {
      // Fall back to renderer object as-is.
    }
  }

  return renderer;
}

export async function enrichRendererSummaries(
  layers: VisibleLayerSummary[],
  mapView: MapView,
): Promise<VisibleLayerSummary[]> {
  if (layers.length === 0) {
    return layers;
  }

  // Collect raw renderer JSON from mapView layers, keyed by title.
  const rendererJsonByTitle = new Map<string, unknown>();
  const allMapLayers = mapView.map?.allLayers?.toArray() ?? [];

  for (const layer of allMapLayers) {
    const candidate = layer as {
      title?: string;
      type?: string;
      renderer?: unknown;
    };

    if (candidate.type !== "feature" || !candidate.renderer) {
      continue;
    }

    const title = (candidate.title?.trim() || "Untitled layer");
    rendererJsonByTitle.set(title, getRendererJson(candidate.renderer));
  }

  // Build compact per-layer input for the LLM.
  const layerInputs = layers.map((layer) => ({
    title: layer.title,
    currentSummary: layer.rendererSummary ?? "unknown",
    rendererJson: rendererJsonByTitle.get(layer.title) ?? null,
  }));

  const escapedInput = escapePromptTemplateBraces(JSON.stringify(layerInputs, null, 2));

  const promptText = [
    "You are a GIS expert analyzing map layer renderers for a map quality assessment game.",
    "For each layer in the JSON below, write exactly ONE sentence (max 100 characters) that:",
    "- Names the renderer type and the field or expression it drives",
    "- States the class/category count if applicable",
    "- Notes whether the renderer choice seems appropriate for the data or flags a potential concern",
    "Be specific and direct. Do not use vague phrases like 'effectively visualizes'.",
    "",
    "Input layers (title, currentSummary hint, raw rendererJson):",
    escapedInput,
    "",
    'Return JSON: { "layers": [{ "title": "...", "rendererDescription": "..." }] }',
    "Include one entry per input layer, using the exact same title string.",
  ].join("\n");

  try {
    const result = await invokeStructuredPrompt<RendererInsightResult>({
      promptText,
      schema: promptSchema,
      modelTier: "default",
      temperature: 0.1,
    });

    const parsedResult = rendererInsightSchema.safeParse(result);
    if (!parsedResult.success) {
      return layers;
    }

    const descriptionMap = new Map<string, string>(
      parsedResult.data.layers.map((l) => [l.title, l.rendererDescription]),
    );

    return layers.map((layer) => ({
      ...layer,
      rendererSummary: descriptionMap.get(layer.title) ?? layer.rendererSummary,
    }));
  } catch {
    // If enrichment fails, return the original layer summaries unchanged.
    return layers;
  }
}
