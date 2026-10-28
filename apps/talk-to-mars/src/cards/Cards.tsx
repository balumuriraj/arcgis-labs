import { useSyncExternalStore } from "react";
import type { Feature } from "../data";
import type { MarsApp } from "../map/controller";
import { ChartCard } from "./ChartCard";
import type { ChartRequest } from "./charts";
import {
  FeatureCard,
  FeatureListCard,
  ObjectCard,
  RouteCard,
} from "./FeatureCards";
import { MissionCard, MissionListCard } from "./MissionCards";
import { QueryCard, type QueryResults } from "./QueryCard";

/** The data each card type receives from a tool (see `showCard` in agent/tools.ts). */
export type CardData = {
  "query-results": QueryResults & { title: string };
  "mission-card": { id: string };
  "mission-list": { title: string; ids: string[] };
  "feature-card": Feature;
  "feature-list": {
    title: string;
    total: number;
    items: (Feature & { km?: number })[];
    from?: string;
  };
  "object-card": {
    name: string;
    heightM: number;
    widthM: number;
    at: string;
    featureSizeKm?: number;
    featureWiderThanTallBy?: number;
  };
  "route-card": {
    missionId: string;
    rover: string;
    drivenKm: number;
    drives: number;
    lastSol: number | null;
    retrieved: string;
    source: string;
  };
  chart: ChartRequest;
};
type CardBlock = {
  [K in keyof CardData]: { type: K; data: CardData[K] };
}[keyof CardData];

function useSlottableRequests(assistant: HTMLArcgisAssistantElement) {
  return useSyncExternalStore(
    (notify) => {
      assistant.addEventListener("arcgisSlottableRequest", notify);
      return () =>
        assistant.removeEventListener("arcgisSlottableRequest", notify);
    },
    () => assistant.slottableRequests,
  );
}

const CARD_TYPES = new Set<string>([
  "query-results",
  "mission-card",
  "mission-list",
  "feature-card",
  "feature-list",
  "object-card",
  "route-card",
  "chart",
] satisfies (keyof CardData)[]);

/**
 * The assistant asks for a slot for every block in a reply; React renders this app's cards into
 * theirs. Other blocks (the reply text, the SDK's own UI) must stay unslotted: even an empty
 * slotted element would replace their default content.
 */
export function Cards({ app }: { app: MarsApp }) {
  const requests = useSlottableRequests(app.assistant);
  return requests.map((request) => {
    const block =
      request.name === "block"
        ? (request.data.block as CardBlock | undefined)
        : undefined;
    if (!block || !CARD_TYPES.has(block.type)) return null;
    return (
      <div key={request.slotName} slot={request.slotName}>
        <Card app={app} block={block} />
      </div>
    );
  });
}

function Card({ app, block }: { app: MarsApp; block: CardBlock }) {
  switch (block.type) {
    case "query-results":
      return <QueryCard data={block.data} />;
    case "mission-card":
      return <MissionCard app={app} data={block.data} />;
    case "mission-list":
      return <MissionListCard app={app} data={block.data} />;
    case "feature-card":
      return <FeatureCard data={block.data} />;
    case "feature-list":
      return <FeatureListCard app={app} data={block.data} />;
    case "object-card":
      return <ObjectCard app={app} data={block.data} />;
    case "route-card":
      return <RouteCard app={app} data={block.data} />;
    case "chart":
      return <ChartCard app={app} data={block.data} />;
    default:
      return null;
  }
}
