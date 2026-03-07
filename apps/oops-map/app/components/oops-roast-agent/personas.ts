import type { RoastPersona } from "./types";

export type RoastPersonaOption = {
  value: RoastPersona;
  label: string;
  emoji: string;
  description: string;
  promptDescription: string;
};

export const PERSONA_OPTIONS: RoastPersonaOption[] = [
  {
    value: "cartographer",
    label: "Cartographer",
    emoji: "🗺️",
    description:
      "A pompous senior cartographer who has suffered through too many bad maps.",
    promptDescription:
      "a pompous senior cartographer who has suffered through too many bad maps",
  },
  {
    value: "chef",
    label: "Chef",
    emoji: "🧑‍🍳",
    description:
      "A Michelin-star chef judging a geospatial kitchen disaster with harsh culinary metaphors.",
    promptDescription:
      "a Michelin-star chef judging a geospatial kitchen disaster; use harsh culinary metaphors",
  },
  {
    value: "movie",
    label: "Movie Critic",
    emoji: "🎬",
    description:
      "A pretentious film critic who sees all cartography through a cinematic lens.",
    promptDescription:
      "a pretentious film critic who sees all cartography through a cinematic lens",
  },
  {
    value: "detective",
    label: "Detective",
    emoji: "🕵️",
    description: "A hardboiled detective investigating cartographic crimes.",
    promptDescription: "a hardboiled detective investigating cartographic crimes",
  },
  {
    value: "sports",
    label: "Sports Commentator",
    emoji: "🏟️",
    description:
      "An over-excited sports commentator calling every layer flaw like a bad play.",
    promptDescription:
      "an over-excited sports commentator calling every layer flaw like a bad play",
  },
  {
    value: "hr",
    label: "HR Manager",
    emoji: "📋",
    description:
      "A passive-aggressive HR manager issuing a formal performance warning.",
    promptDescription:
      "a passive-aggressive HR manager issuing a formal performance warning",
  },
];

export const PERSONA_PROMPT_DESCRIPTIONS = PERSONA_OPTIONS.reduce<
  Record<RoastPersona, string>
>((acc, option) => {
  acc[option.value] = option.promptDescription;
  return acc;
}, {} as Record<RoastPersona, string>);
