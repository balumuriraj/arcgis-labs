# Demo script

About three minutes. The app opens on a slowly spinning Earth showing the launch sites;
everything after that is driven by talking to the guide.

## Before you start

- Sign in through the assistant, and run one prompt ("Go to the Moon") to warm up the
  service and the map cache. Then reload so the demo opens on Earth.
- Use a wide window; the map and the chat panel both need room.
- Turn off "reduce motion" in the OS, or the trips between worlds skip their animation.
- For a public or commercial event, hide the LROC site photos with `?photos=off` (see
  [reference](./docs/reference.md#data)).

## The script

Prompts to type are in *italics*; [brackets] are what happens on screen.

"Here is an agentic app that contains a map with lunar mission launch sites. 

Let's ask it something. *'How many missions have been launched from each country?'*

[A table appears: USA 21, USSR 14, China 5, Japan 5, India 3, Europe, Israel and Russia 1 each.]

Okay. *'where did the Apollo missions launched from?'*

[The answer: 23. The guide may mention that Israel's Beresheet and Japan's Hakuto-R
missions launched from there too.]

So far, a pretty normal agentic map. You ask about the data, you get an answer.

*'Where did those missions land?'*

[Stop talking. Let the camera leave Earth and land on the Moon. The map shows only the
23 Cape Canaveral missions, with a list.]

Those are the Cape Canaveral missions. Let's see everyone. *'Show me every landing.'*

[Pause, while the globe fills: 28 successful landings.]

*'Show all missions by year.'*

[A bar chart of missions per year.]

Look at this. A burst of landings, and then nothing, for decades. *'Why did it go quiet?'*

[Let it answer. Nothing landed between Luna 24, in 1976, and Chang'e 3, in 2013.]

Let's go back to the most famous one. *'What's named after the Apollo 11 crew?'*

[Collins, Aldrin, and Armstrong are marked around the landing site.]

Three craters, named for Michael Collins, Buzz Aldrin, and Neil Armstrong. All within
fifty kilometers of where they landed.

One more. *'Stand the Burj Khalifa in Armstrong crater.'*

[The tower appears at true scale, with a comparison card.]

The tallest building on Earth. Armstrong crater is about four kilometers across: you
could lay five of these end to end inside it.

None of those answers were scripted. The agent has a few skills, and tools over real
NASA and IAU data, and it decides the steps itself. And this pattern works on any data,
not just the Moon."

## Facts behind the lines

All from the app's data, so the guide's answers will match what you say:

| Line | Figure |
| --- | --- |
| Missions by country | USA 21, USSR 14, China 5, Japan 5, India 3, Europe (ESA) 1, Israel 1, Russia 1 (51 total) |
| Cape Canaveral | 23 missions, including Beresheet (Israel) and Hakuto-R Missions 1 and 2 (Japan) |
| Every landing | 28 successful landings (crewed and robotic) |
| The quiet years | Luna 24 (August 1976) to Chang'e 3 (December 2013) |
| Apollo 11 crew craters | Collins 20 km, Aldrin 47 km, Armstrong 49 km from the landing site |
| Armstrong crater | 4.2 km across; the Burj Khalifa is 828 m tall |

Avoid comparing the tower with the crater's depth: depths aren't in the data, and the
guide won't confirm it.

## Backups

Use these if you have time, or if a step above doesn't land:

- "Take me to Apollo 11": close-up, a lunar module on the surface, a slow orbit, and the
  site photo from orbit.
- "What are the nearest craters to Apollo 11?": Collins, Moltke, Aldrin, Armstrong… with distances.
- "Take me to Chang'e": the guide asks which one, a built-in human-in-the-loop step.
- "Show the Moon as it was in 1969": the time slider jumps to the end of 1969.
- "Now put Mount Everest in Tycho", or "How big is a Saturn V next to Apollo 11?"
- "Compare average crater size on the near and far sides" (about 46 km vs 73 km)

## Easter egg

End on a smile: *"Let me fly the lander."* A lunar module appears with a chase camera.
Left and right arrows steer, up and down climb and descend, Esc lands.

## If something goes wrong

- **The guide asks a question:** answer it. That's the design: it asks instead of guessing.
- **The map is cluttered:** "Clear the map", or "Show everything" to restore every mission.
- **The camera is somewhere odd:** "Go to the Moon" or "Show everything" resets the view.
- **A step fails or hangs:** move on to the next one; each prompt stands on its own.
  Reload as a last resort, which brings you back to Earth.
