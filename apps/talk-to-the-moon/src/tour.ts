/**
 * A guided tour: the demo in demo.md as suggested prompts. The assistant shows the first one; after
 * each reply it offers the step after the last one asked, so clicking through runs the whole demo.
 * Typing something else is fine: the tour waits and offers the same step again.
 */
export const TOUR = [
  "How many missions have been launched from each country?",
  "Where did the Apollo missions launch from?",
  "Where did those missions land?",
  "Show all missions by year.",
  "Go to an Apollo mission.",
  "Show the nearest crater.",
  "Place the tallest building on Earth inside it.",
  "Let me fly the lander.",
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
