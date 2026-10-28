import assert from "node:assert/strict";
import { test } from "node:test";
import { TOUR, startTour, stepOf } from "../src/tour";

/** A stand-in for the assistant: its two events and its suggested prompts. */
function fakeAssistant() {
  const target = new EventTarget() as EventTarget & { suggestedPrompts: string[] };
  target.suggestedPrompts = [];
  const ask = (prompt: string, error = false) => {
    target.suggestedPrompts = []; // The assistant clears them on submit.
    target.dispatchEvent(new CustomEvent("arcgisSubmit", { detail: { prompt, displayText: prompt, parts: [] } }));
    target.dispatchEvent(new CustomEvent("arcgisResponse", { detail: { role: "assistant", content: "ok", error: error ? "failed" : undefined } }));
  };
  return { assistant: target as unknown as HTMLArcgisAssistantElement, target, ask };
}

test("steps match however they're typed", () => {
  assert.equal(stepOf("  where did those missions land  "), TOUR.indexOf("Where did those missions land?"));
  assert.equal(stepOf("Something else"), -1);
});

test("clicking through offers each step in turn, then nothing", () => {
  const { assistant, target, ask } = fakeAssistant();
  const stop = startTour(assistant);
  for (const prompt of TOUR) {
    assert.deepEqual(target.suggestedPrompts, [prompt]);
    ask(prompt);
  }
  assert.deepEqual(target.suggestedPrompts, []);
  stop();
});

test("an off-script question keeps the tour where it was", () => {
  const { assistant, target, ask } = fakeAssistant();
  const stop = startTour(assistant);
  ask(TOUR[0]);
  ask("How far away is the Moon?");
  assert.deepEqual(target.suggestedPrompts, [TOUR[1]]);
  stop();
});

test("jumping ahead continues from there; a failed step is offered again", () => {
  const { assistant, target, ask } = fakeAssistant();
  const stop = startTour(assistant);
  ask(TOUR[6]);
  assert.deepEqual(target.suggestedPrompts, [TOUR[7]]);
  ask(TOUR[7], true);
  assert.deepEqual(target.suggestedPrompts, [TOUR[7]]);
  stop();
  assert.deepEqual(target.suggestedPrompts, [], "stopping clears the chips");
});
