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

The guide suggests each prompt below in turn as a chip above the chat box, ending with the
lander easter egg: click it, then Ask. A visitor can click through the whole demo on their
own the same way. Off-script questions don't lose the place; the next chip waits. The chips
come from [src/tour.ts](./src/tour.ts), so change the prompts there and here together.

## The script

Prompts to type are in *italics*; [brackets] are what happens on screen.

"Here is an agentic app that contains a map with lunar mission launch sites. 

Let's ask it something. *'How many missions have been launched from each country?'*

[A table appears: USA 21, USSR 14, China 5, Japan 5, India 3, Europe, Israel and Russia 1 each.]

Okay. *'Where did the Apollo missions launch from?'*

[The answer: 23. The guide may mention that Israel's Beresheet and Japan's Hakuto-R
missions launched from there too.]

So far, a pretty normal agentic map. You ask about the data, you get an answer.

*'Where did those missions land?'*

[Stop talking. Let the camera leave Earth and land on the Moon. The map shows only the
23 Cape Canaveral missions, with a list.]

Those are the Cape Canaveral missions. Now everyone, over time. *'Show all missions by year.'*

[A bar chart of missions per year.]

Look at this. A burst of landings, and then nothing, for decades: nothing landed between
Luna 24, in 1976, and Chang'e 3, in 2013.

Let's visit one. *'Go to an Apollo mission.'*

[There were six Apollo landings, so the guide asks which one: a built-in
human-in-the-loop step. Pick Apollo 11. Close-up, a lunar module on the surface, a slow
orbit, and the site photo from orbit.]

It asked instead of guessing. *'Show the nearest crater.'*

[Collins crater is marked, 20 km from the landing site.]

Named for Michael Collins, who stayed in orbit while Armstrong and Aldrin walked on the
Moon. How big is it? *'Place the tallest building on Earth inside it.'*

[The guide works out that "it" is Collins crater and that the building is the Burj
Khalifa, 828 m. The tower appears at true scale, with a comparison card.]

Collins crater is about two and a half kilometers across: you could lay three Burj
Khalifas end to end inside it.

None of those answers were scripted. The agent has a few skills, and tools over real
NASA and IAU data, and it decides the steps itself. And this pattern works on any data,
not just the Moon."

## Facts behind the lines

All from the app's data, so the guide's answers will match what you say:

| Line | Figure |
| --- | --- |
| Missions by country | USA 21, USSR 14, China 5, Japan 5, India 3, Europe (ESA) 1, Israel 1, Russia 1 (51 total) |
| Cape Canaveral | 23 missions, including Beresheet (Israel) and Hakuto-R Missions 1 and 2 (Japan) |
| The quiet years | Luna 24 (August 1976) to Chang'e 3 (December 2013) |
| Apollo landings | Six: Apollo 11, 12, 14, 15, 16, and 17 |
| Nearest crater to Apollo 11 | Collins, 20 km from the landing site (Aldrin 47 km and Armstrong 49 km are also close) |
| Collins crater | 2.6 km across; the Burj Khalifa is 828 m tall (the crater is about 3 times wider) |

Avoid comparing the tower with the crater's depth: depths aren't in the data, and the
guide won't confirm it.

## Backups

Use these if you have time, or if a step above doesn't land:

- "What's named after the Apollo 11 crew?": Collins, Aldrin, and Armstrong marked around the site.
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
