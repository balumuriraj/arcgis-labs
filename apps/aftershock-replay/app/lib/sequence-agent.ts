import { SkillAgent } from "@arcgis/ai-components/agent-utils/SkillAgent.js";
import { FunctionTool } from "@arcgis/ai-components/agent-utils/tools/FunctionTool.js";
import { createSchema } from "@arcgis/ai-components/agent-utils/createSchema.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import type { Action, ReplayController } from "./replay-controller";

const SKILL = `---
name: ridgecrest-replay
description: Explore the local July 2019 Ridgecrest earthquake sequence, control its map and shared timeline, and show small interactive evidence cards.
allowed-tools: explore_sequence timeline_control focus_event
---

# Aftershock Replay

Use only the earthquake layer and tool results, never your training knowledge.
All dates and times are California local time. The catalog is a static M1.5+
snapshot for one bounding box, not a complete catalog and not a hazard forecast.
If data fails to load or a tool fails, explain briefly; never invent an answer.
Do not answer questions about other places, years, live earthquakes, injuries,
fault mechanics, or safety from this data. State the scope briefly.

Call explore_sequence with action=find for the biggest sequence, mainshock,
or initial exploration. It queries the layer, establishes the largest event,
finds the nearby cluster, zooms, sets time, and emits an event card.
Never call an event a foreshock without a larger later nearby event established
by the tool. Significant means M4+ for this demo. The tool defines a geographic
sequence, not a scientific causal attribution.

For replay aftershocks or compare aftershocks use action=replay.
For what happened before, foreshocks, or the lead-up use action=before.
For play the gap use action=gap. For when did it calm down, the daily trend,
or events per day use action=daily. For statistics in the CURRENT selected window
use action=stats. Empty windows are retried over July automatically, preserving
the magnitude filter; report the widening honestly.

For ANY magnitude filter request use action=filter. It emits an inline slider
requiring explicit human confirmation. You cannot apply a filter yourself.
Do not ask a text question and do not claim that the filter is already applied.

Use timeline_control for play/pause, stepping, a time window, a single instant,
or cumulative events. Explicit dates must include the California UTC offset
(-07:00 for this catalog). Use focus_event for an exact event ID returned by tools.
Never guess an event ID.

Each exploration tool emits its own data card. Your final reply must be at most
one or two short sentences. Do NOT repeat magnitudes, dates, counts, gaps, or
other fields already in the card; do not add a table or narrative summary.
Prefer the short text returned by the tool. Do not call multiple exploration
actions for a single request unless the user explicitly asked for them.
`;

const ACTIONS: readonly Action[] = [
  "find",
  "replay",
  "before",
  "gap",
  "daily",
  "filter",
  "stats",
];

export async function createSequenceAgent(controller: ReplayController) {
  const explore = new FunctionTool({
    name: "explore_sequence",
    description:
      "Query the local earthquake sequence, drive the map/time slider, and emit one evidence card. Use find, replay, before, gap, daily, filter, or stats.",
    inputSchema: await createSchema({
      type: "object",
      properties: { action: { type: "string", enum: ACTIONS } },
      required: ["action"],
    }),
    resultMode: "terminal",
    execute: async (input: Record<string, unknown>, config) => {
      const action = ACTIONS.find((value) => value === input.action);
      if (!action) throw new Error("Unknown sequence action.");
      try {
        const result = await controller.action(action);
        if (result.cardId) {
          await sendUXSuggestion(
            { type: "aftershock-card", data: { cardId: result.cardId } },
            config,
          );
        }
        return result.text;
      } catch (error) {
        controller.reportError(error);
        return "The earthquake operation failed; see the error in chat. I cannot infer missing results.";
      }
    },
  });
  const timeline = new FunctionTool({
    name: "timeline_control",
    description:
      "Control the single shared time slider. Dates for window, instant, or cumulative require explicit ISO timestamps with UTC offset.",
    inputSchema: await createSchema({
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: [
            "play",
            "pause",
            "next",
            "previous",
            "window",
            "instant",
            "cumulative",
          ],
        },
        start: {
          type: "string",
          description:
            "ISO timestamp including -07:00 offset, within July 2019.",
        },
        end: {
          type: "string",
          description:
            "ISO timestamp including -07:00 offset, within July 2019.",
        },
      },
      required: ["command"],
    }),
    resultMode: "terminal",
    execute: async (input: Record<string, unknown>) => {
      try {
        const command = input.command;
        if (command === "play") await controller.slider.play();
        else if (command === "pause") await controller.slider.stop();
        else if (command === "next" || command === "previous")
          await controller.step(command);
        else {
          const parseDate = (value: unknown) => {
            if (
              typeof value !== "string" ||
              !/T.*(?:[+-]\d{2}:\d{2}|Z)$/u.test(value)
            ) {
              throw new Error(
                "Time controls need an explicit ISO timestamp with timezone.",
              );
            }
            const time = Date.parse(value);
            if (!Number.isFinite(time)) throw new Error("Invalid date.");
            return time;
          };
          const start = parseDate(input.start);
          const end = command === "instant" ? start : parseDate(input.end);
          await controller.window(
            start,
            end,
            command === "instant"
              ? "instant"
              : command === "cumulative"
                ? "cumulative-from-start"
                : "time-window",
          );
        }
        await controller.syncTime();
        return "The shared timeline is updated.";
      } catch (error) {
        controller.reportError(error);
        return "The timeline could not be updated; see the error in chat.";
      }
    },
  });
  const focus = new FunctionTool({
    name: "focus_event",
    description:
      "Jump the shared timeline to an exact catalog event ID and highlight it on the map. Never guess IDs.",
    inputSchema: await createSchema({
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    }),
    resultMode: "terminal",
    execute: async (input: Record<string, unknown>) => {
      try {
        await controller.focus(String(input.id));
        return "The event is highlighted at its exact time.";
      } catch (error) {
        controller.reportError(error);
        return "That event could not be highlighted; see the error in chat.";
      }
    },
  });
  return new SkillAgent({
    id: "aftershock-guide",
    name: "Aftershock Guide",
    description:
      "The guide for every question about the Ridgecrest July 2019 layer, earthquake sequences, foreshocks, aftershocks, time, replay, maps, and statistics.",
    systemPrompt:
      "You are a concise earthquake-sequence guide for Aftershock Replay. Follow the active skill. Only tools can establish facts or change the map. Never fill missing data from memory.",
    skillLoaders: [async () => SKILL],
    toolLoaders: {
      explore_sequence: async () => explore,
      timeline_control: async () => timeline,
      focus_event: async () => focus,
    },
    runtimeContextLoader: () => controller.context(),
  }).registration;
}
