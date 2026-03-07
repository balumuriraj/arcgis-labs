import type MapView from "@arcgis/core/views/MapView.js";
import { MAX_FIELD_PREVIEW } from "./constants";
import type { VisibleLayerSummary } from "./types";

function collectPopupFieldInfos(popupTemplate: unknown): Array<{
  fieldName: string;
  dateFormat: string | null;
}> {
  if (!popupTemplate || typeof popupTemplate !== "object") {
    return [];
  }

  const candidate = popupTemplate as {
    fieldInfos?: unknown;
    content?: unknown;
  };

  const extractedInfos: Array<{
    fieldName: string;
    dateFormat: string | null;
  }> = [];

  const addFieldInfos = (rawFieldInfos: unknown) => {
    if (!Array.isArray(rawFieldInfos)) {
      return;
    }

    for (const entry of rawFieldInfos) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const fieldInfo = entry as {
        fieldName?: unknown;
        format?: { dateFormat?: unknown };
      };

      if (typeof fieldInfo.fieldName !== "string") {
        continue;
      }

      const dateFormat =
        typeof fieldInfo.format?.dateFormat === "string"
          ? fieldInfo.format.dateFormat
          : null;

      extractedInfos.push({
        fieldName: fieldInfo.fieldName,
        dateFormat,
      });
    }
  };

  addFieldInfos(candidate.fieldInfos);

  if (Array.isArray(candidate.content)) {
    for (const contentItem of candidate.content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const fieldsCandidate = contentItem as { fieldInfos?: unknown };
      addFieldInfos(fieldsCandidate.fieldInfos);
    }
  }

  const deduped = new Map<string, { fieldName: string; dateFormat: string | null }>();
  for (const info of extractedInfos) {
    const existing = deduped.get(info.fieldName);

    if (!existing) {
      deduped.set(info.fieldName, info);
      continue;
    }

    if (!existing.dateFormat && info.dateFormat) {
      deduped.set(info.fieldName, info);
    }
  }

  return [...deduped.values()];
}

function summarizeRenderer(renderer: unknown): string | null {
  if (!renderer || typeof renderer !== "object") {
    return null;
  }

  const candidate = renderer as {
    type?: unknown;
    symbol?: { type?: unknown };
    visualVariables?: unknown;
    field?: unknown;
    field2?: unknown;
    field3?: unknown;
    fieldDelimiter?: unknown;
    valueExpression?: unknown;
    uniqueValueInfos?: unknown;
    classBreakInfos?: unknown;
    normalizationField?: unknown;
    colorStops?: unknown;
    radius?: unknown;
    attributes?: unknown;
    dotValue?: unknown;
    defaultSymbol?: unknown;
    backgroundFillSymbol?: unknown;
    authoringInfo?: unknown;
  };

  const rendererType =
    typeof candidate.type === "string" ? candidate.type.trim() : "";
  if (rendererType.length === 0) {
    return null;
  }

  const visualVariableCount = Array.isArray(candidate.visualVariables)
    ? candidate.visualVariables.length
    : 0;
  const visualVariablesNote =
    visualVariableCount > 0 ? `; visual variables: ${visualVariableCount}` : "";

  if (rendererType === "simple") {
    const symbolType =
      candidate.symbol &&
      typeof candidate.symbol === "object" &&
      typeof candidate.symbol.type === "string"
        ? candidate.symbol.type
        : "unknown symbol";

    return `simple renderer; symbol=${symbolType}${visualVariablesNote}`;
  }

  if (rendererType === "unique-value") {
    const fields = [candidate.field, candidate.field2, candidate.field3]
      .filter((value): value is string => {
        return typeof value === "string" && value.trim().length > 0;
      })
      .map((value) => value.trim());

    const uniqueValueCount = Array.isArray(candidate.uniqueValueInfos)
      ? candidate.uniqueValueInfos.length
      : 0;

    const fieldDescriptor =
      fields.length > 0
        ? fields.join(
            typeof candidate.fieldDelimiter === "string" &&
              candidate.fieldDelimiter.length > 0
              ? candidate.fieldDelimiter
              : ", ",
          )
        : typeof candidate.valueExpression === "string" &&
            candidate.valueExpression.trim().length > 0
          ? "valueExpression"
          : "unknown field";

    return `unique-value renderer; fields=${fieldDescriptor}; classes=${uniqueValueCount}${visualVariablesNote}`;
  }

  if (rendererType === "class-breaks") {
    const breaksCount = Array.isArray(candidate.classBreakInfos)
      ? candidate.classBreakInfos.length
      : 0;

    const fieldDescriptor =
      typeof candidate.field === "string" && candidate.field.trim().length > 0
        ? candidate.field.trim()
        : typeof candidate.valueExpression === "string" &&
            candidate.valueExpression.trim().length > 0
          ? "valueExpression"
          : "unknown field";

    const normalizationNote =
      typeof candidate.normalizationField === "string" &&
      candidate.normalizationField.trim().length > 0
        ? `; normalization=${candidate.normalizationField.trim()}`
        : "";

    return `class-breaks renderer; field=${fieldDescriptor}; breaks=${breaksCount}${normalizationNote}${visualVariablesNote}`;
  }

  if (rendererType === "heatmap") {
    const colorStopCount = Array.isArray(candidate.colorStops)
      ? candidate.colorStops.length
      : 0;
    const radius =
      typeof candidate.radius === "number" ? `${candidate.radius}px` : "unknown";

    return `heatmap renderer; radius=${radius}; colorStops=${colorStopCount}`;
  }

  if (rendererType === "dot-density") {
    const attributeCount = Array.isArray(candidate.attributes)
      ? candidate.attributes.length
      : 0;
    const dotValue =
      typeof candidate.dotValue === "number" ? `${candidate.dotValue}` : "unknown";

    return `dot-density renderer; attributes=${attributeCount}; dotValue=${dotValue}`;
  }

  if (rendererType === "pie-chart") {
    const attributeCount = Array.isArray(candidate.attributes)
      ? candidate.attributes.length
      : 0;

    return `pie-chart renderer; attributes=${attributeCount}${visualVariablesNote}`;
  }

  if (rendererType === "dictionary") {
    const hasDefaultSymbol =
      candidate.defaultSymbol && typeof candidate.defaultSymbol === "object";
    const hasBackgroundFill =
      candidate.backgroundFillSymbol &&
      typeof candidate.backgroundFillSymbol === "object";

    return [
      "dictionary renderer",
      hasDefaultSymbol ? "defaultSymbol=true" : null,
      hasBackgroundFill ? "backgroundFill=true" : null,
      visualVariableCount > 0 ? `visual variables: ${visualVariableCount}` : null,
    ]
      .filter((item): item is string => typeof item === "string")
      .join("; ");
  }

  const authoringNote =
    candidate.authoringInfo && typeof candidate.authoringInfo === "object"
      ? "; has authoringInfo"
      : "";

  return `${rendererType} renderer${visualVariablesNote}${authoringNote}`;
}


export async function summarizeVisibleLayers(
  mapView: MapView,
): Promise<VisibleLayerSummary[]> {
  await mapView.when();

  const allLayers = mapView.map?.allLayers?.toArray() ?? [];
  const summarized = await Promise.all(
    allLayers.map(async (layer) => {
      const candidate = layer as unknown as {
        title?: string;
        type?: string;
        visible?: boolean;
        visibleAtCurrentScale?: boolean;
        url?: string;
        renderer?: unknown;
        popupEnabled?: boolean;
        popupTemplate?: {
          title?: string;
          fieldInfos?: unknown;
          content?: unknown;
        };
        definitionExpression?: string;
        opacity?: number;
        minScale?: number;
        maxScale?: number;
        fields?: Array<{ name?: string; type?: string }>;
        queryFeatureCount?: (query?: unknown) => Promise<number>;
        createQuery?: () => { where?: string };
        load?: () => Promise<unknown>;
      };

      if (
        candidate.type !== "feature" ||
        candidate.visible !== true ||
        candidate.visibleAtCurrentScale === false
      ) {
        return null;
      }

      if (typeof candidate.load === "function") {
        try {
          await candidate.load();
        } catch {
          // Continue with available metadata.
        }
      }

      let featureCount: number | null = null;

      if (
        candidate.type === "feature" &&
        typeof candidate.queryFeatureCount === "function"
      ) {
        try {
          const query = candidate.createQuery?.();
          if (query && (!query.where || query.where.trim().length === 0)) {
            query.where = "1=1";
          }

          featureCount = await candidate.queryFeatureCount(query);
        } catch {
          featureCount = null;
        }
      }

      const numericTypes = new Set([
        "small-integer",
        "integer",
        "single",
        "double",
        "long",
        "big-integer",
      ]);

      const numericFieldNames = (candidate.fields ?? [])
        .filter((field) => {
          return (
            typeof field.name === "string" &&
            typeof field.type === "string" &&
            numericTypes.has(field.type)
          );
        })
        .map((field) => field.name as string);

      const rendererFields: string[] = [];
      if (
        candidate.renderer &&
        typeof candidate.renderer === "object" &&
        "type" in candidate.renderer &&
        (candidate.renderer as { type?: string }).type === "unique-value"
      ) {
        const uvRenderer = candidate.renderer as {
          field?: string;
          field2?: string;
          field3?: string;
        };
        for (const f of [uvRenderer.field, uvRenderer.field2, uvRenderer.field3]) {
          if (typeof f === "string" && f.trim().length > 0) {
            rendererFields.push(f.trim());
          }
        }
      }

      const fieldPreview = (candidate.fields ?? [])
        .map((field) => field.name)
        .filter((fieldName): fieldName is string => {
          return typeof fieldName === "string" && fieldName.trim().length > 0;
        })
        .slice(0, MAX_FIELD_PREVIEW);

      const allCapsFieldNamesSample = (candidate.fields ?? [])
        .map((field) => field.name)
        .filter((fieldName): fieldName is string => {
          return (
            typeof fieldName === "string" &&
            fieldName.trim().length > 0 &&
            /^[A-Z0-9_]{3,}$/.test(fieldName)
          );
        })
        .slice(0, MAX_FIELD_PREVIEW);

      const popupFieldDateFormats = collectPopupFieldInfos(candidate.popupTemplate);

      const dateFieldNames = (candidate.fields ?? [])
        .filter((field) => {
          return (
            typeof field.name === "string" &&
            typeof field.type === "string" &&
            field.type.toLowerCase().includes("date")
          );
        })
        .map((field) => field.name as string);

      const dateFieldsWithFormatting = new Set(
        popupFieldDateFormats
          .filter((fieldInfo) => typeof fieldInfo.dateFormat === "string")
          .map((fieldInfo) => fieldInfo.fieldName),
      );

      const dateFieldsWithoutPopupFormat = dateFieldNames
        .filter((fieldName) => !dateFieldsWithFormatting.has(fieldName))
        .slice(0, MAX_FIELD_PREVIEW);

      const rendererSymbol =
        candidate.renderer &&
        typeof candidate.renderer === "object" &&
        "symbol" in candidate.renderer &&
        candidate.renderer.symbol &&
        typeof candidate.renderer.symbol === "object" &&
        "type" in candidate.renderer.symbol &&
        typeof candidate.renderer.symbol.type === "string"
          ? candidate.renderer.symbol.type
          : null;

      return {
        title: candidate.title?.trim() || "Untitled layer",
        type: candidate.type ?? "unknown",
        url: candidate.url ?? null,
        renderer:
          candidate.renderer &&
          typeof candidate.renderer === "object" &&
          "type" in candidate.renderer &&
          typeof candidate.renderer.type === "string"
            ? candidate.renderer.type
            : null,
        rendererSummary: summarizeRenderer(candidate.renderer),
        rendererSymbol,
        definitionExpression: candidate.definitionExpression ?? null,
        opacity:
          typeof candidate.opacity === "number" ? candidate.opacity : null,
        fieldPreview,
        allCapsFieldNamesSample,
        popupEnabled: candidate.popupEnabled !== false,
        popupTitle:
          typeof candidate.popupTemplate?.title === "string"
            ? candidate.popupTemplate.title
            : null,
        popupFieldDateFormats,
        dateFieldsWithoutPopupFormat,
        featureCount,
        minScale: typeof candidate.minScale === "number" ? candidate.minScale : null,
        maxScale: typeof candidate.maxScale === "number" ? candidate.maxScale : null,
        numericFieldNames,
        rendererFields,
      } satisfies VisibleLayerSummary;
    }),
  );

  return summarized
    .filter((item): item is VisibleLayerSummary => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function formatLayerSummary(layers: VisibleLayerSummary[]): string {
  if (layers.length === 0) {
    return "No visible feature layers were detected in the map context.";
  }

  return layers
    .map((layer, index) => {
      const opacity =
        layer.opacity === null
          ? "unknown"
          : `${Math.round(layer.opacity * 100)}%`;

      const fields =
        layer.fieldPreview.length > 0 ? layer.fieldPreview.join(", ") : "unknown";

      const featureCount =
        layer.featureCount === null ? "unknown" : `${layer.featureCount}`;

      const definition =
        layer.definitionExpression && layer.definitionExpression.trim().length > 0
          ? layer.definitionExpression
          : "none";

      const popupDateFormats =
        layer.popupFieldDateFormats.length > 0
          ? layer.popupFieldDateFormats
              .map((fieldInfo) => {
                return `${fieldInfo.fieldName}=${fieldInfo.dateFormat ?? "none"}`;
              })
              .join(", ")
          : "none";

      const fieldsWithoutDateFormatting =
        layer.dateFieldsWithoutPopupFormat.length > 0
          ? layer.dateFieldsWithoutPopupFormat.join(", ")
          : "none";

      const allCapsSample =
        layer.allCapsFieldNamesSample.length > 0
          ? layer.allCapsFieldNamesSample.join(", ")
          : "none";

      const minScale = layer.minScale === null ? "unknown" : `${layer.minScale}`;
      const maxScale = layer.maxScale === null ? "unknown" : `${layer.maxScale}`;

      return [
        `${index + 1}. Layer: ${layer.title}`,
        `   Type: ${layer.type}`,
        `   Min scale: ${minScale}`,
        `   Max scale: ${maxScale}`,
        `   Renderer: ${layer.renderer ?? "unknown"}`,
        `   Renderer summary: ${layer.rendererSummary ?? "unknown"}`,
        `   Renderer symbol: ${layer.rendererSymbol ?? "unknown"}`,
        `   Opacity: ${opacity}`,
        `   Definition expression: ${definition}`,
        `   Popup enabled: ${layer.popupEnabled}`,
        `   Popup title: ${layer.popupTitle ?? "none"}`,
        `   Popup date formats: ${popupDateFormats}`,
        `   Date fields missing popup format: ${fieldsWithoutDateFormatting}`,
        `   ALL_CAPS field sample: ${allCapsSample}`,
        `   Feature count: ${featureCount}`,
        `   Fields: ${fields}`,
        `   Numeric fields: ${layer.numericFieldNames.length > 0 ? layer.numericFieldNames.join(", ") : "none"}`,
        `   Renderer fields: ${layer.rendererFields.length > 0 ? layer.rendererFields.join(", ") : "none"}`,
      ].join("\n");
    })
    .join("\n\n");
}
