import { createFunctionTool, createLLMAgent, createSchema } from "@arcgis/ai-components/agent-utils/index.js";
import { sendUXSuggestion } from "@arcgis/ai-components/utils/index.js";
import { getWeather, type WeatherCardData } from "../support/utils";

type WeatherInput = Record<string, unknown>;

const weatherSchema = await createSchema({
  city: { type: "string", required: true, description: "Forecast city extracted from the user prompt." },
  date: {
    type: "string",
    required: true,
    description: "Forecast date extracted from the user prompt. Format: YYYY-MM-DD.",
  },
});

const getWeatherTool = await createFunctionTool({
  name: "get_weather",
  description:
    "Gets an external match-day forecast for a World Cup city and date, then emits a custom weather card. Use this for forecast and conditions prompts.",
  inputSchema: weatherSchema,
  resultMode: "terminal",
  execute: async (input: WeatherInput, config): Promise<string> => {
    console.log("get_weather input: ", input);

    const city = input.city;
    const date = input.date;

    if (typeof city !== "string" || !city.trim()) {
      throw new Error("city is required and must be a non-empty string.");
    }
    if (typeof date !== "string" || !date.trim()) {
      throw new Error("date is required and must be a non-empty string.");
    }

    const weather = await getWeather({ city: city.trim(), date: date.trim() });

    await sendUXSuggestion(
      {
        type: "weather-card",
        data: { ...weather } satisfies WeatherCardData,
      },
      config,
    );

    return `Forecast for match day.`;
  },
});

const rootAgent = await createLLMAgent({
  name: "World Cup Conditions Agent",
  description:
    "Use this agent for weather, match-day conditions, and city forecasts for World Cup match prompts. It extracts the requested city and date from the prompt and calls the weather tool with those values.",
  tools: [getWeatherTool],
  prompt: String.raw`
You are the World Cup Companion conditions agent.

Use the available tools to get weather for the requested city and date. Do not invent forecasts, dates, or weather details that are not returned by the tools.

Before calling any tool:
1. Extract the user's intent.
2. Extract the city from the user prompt.
3. Extract the date from the user prompt and normalize it for the date input field.

For weather, forecast, or match-day conditions prompts:
1. Call get_weather with the extracted city and date.
2. Reply with a concise summary based only on the tool result and custom weather card.
`,
});

export const agent = rootAgent.registration;
