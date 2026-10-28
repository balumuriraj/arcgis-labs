/**
 * A guided tour: the demo in demo.md as suggested prompts. The assistant shows the first one; after
 * each reply it offers the step after the last one asked, so clicking through runs the whole demo.
 * Typing something else is fine: the tour waits and offers the same step again.
 */
export const TOUR = [
  "How many spacecraft have reached the surface of Mars, and how many worked?",
  "Show how Mars landings went, decade by decade.",
  "Show me every attempt.",
  "Show me the highs and lows of Mars.",
  "Turn the elevation colors off.",
  "Where has Perseverance driven?",
  "And Curiosity?",
  "Stand Mount Everest next to Olympus Mons.",
];

type Events = HTMLArcgisAssistantElement["@eventTypes"];

const normalize = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/, "");

/** The tour step a message asks, if any. */
export const stepOf = (text: string) =>
  TOUR.findIndex((prompt) => normalize(prompt) === normalize(text));

/** Starts offering the tour in the assistant. Returns a function that stops it. */
export function startTour(assistant: HTMLArcgisAssistantElement): () => void {
  let next = 0;
  /** The step being answered, until its reply arrives. */
  let asked = -1;
  const offer = () => {
    assistant.suggestedPrompts = next < TOUR.length ? [TOUR[next]] : [];
  };

  const onSubmit = (event: CustomEvent<Events["arcgisSubmit"]>) => {
    const { detail } = event;
    asked = stepOf(typeof detail === "string" ? detail : detail.prompt);
  };
  const onResponse = (event: CustomEvent<Events["arcgisResponse"]>) => {
    // A step that failed is offered again; one that worked moves the tour past it.
    if (asked >= 0 && !event.detail.error) next = Math.max(next, asked + 1);
    asked = -1;
    offer();
  };

  offer();
  assistant.addEventListener("arcgisSubmit", onSubmit);
  assistant.addEventListener("arcgisResponse", onResponse);
  return () => {
    assistant.removeEventListener("arcgisSubmit", onSubmit);
    assistant.removeEventListener("arcgisResponse", onResponse);
    assistant.suggestedPrompts = [];
  };
}
