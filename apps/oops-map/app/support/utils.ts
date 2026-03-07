import type { RoastPersona } from "../components/oops-roast-agent/types";

export type RoastGifBucket = "valid" | "invalid" | "verdict";

export const ROAST_GIFS = {
  // 🧭 THE CARTOGRAPHER (Nerds, Math, Geography, Judgment)
  cartographer: {
    valid: [
      "/roast-gifs/cartographer/valid-01.gif", // Dwight Schrute nodding intensely
      "/roast-gifs/cartographer/valid-02.gif", // Nerd pushing up glasses
      "/roast-gifs/cartographer/valid-03.gif", // "Exactly!" pointing
      "/roast-gifs/cartographer/valid-04.gif", // The Simpsons nerd agreement
    ],
    invalid: [
      "/roast-gifs/cartographer/invalid-01.gif", // Confused Math Lady calculating
      "/roast-gifs/cartographer/invalid-02.gif", // Neil deGrasse Tyson facepalm
      "/roast-gifs/cartographer/invalid-03.gif", // Captain Picard ultimate facepalm
      "/roast-gifs/cartographer/invalid-04.gif", // Squinting really hard
    ],
    verdict: [
      "/roast-gifs/cartographer/verdict-01.gif", // The classic Dumpster Fire
      "/roast-gifs/cartographer/verdict-02.gif", // Burning map/paper
      "/roast-gifs/cartographer/verdict-03.gif", // "I award you no points, and may God have mercy on your soul"
      "/roast-gifs/cartographer/verdict-04.gif", // Mic drop and walk away
    ]
  },

  // 🧑‍🍳 THE CHEF (Gordon Ramsay, Cooking Disasters, Perfection)
  chef: {
    valid: [
      "/roast-gifs/chef/valid-01.gif", // Perfect Chef's Kiss
      "/roast-gifs/chef/valid-02.gif", // Gordon Ramsay nodding "Finally"
      "/roast-gifs/chef/valid-03.gif", // Salt Bae sprinkle
      "/roast-gifs/chef/valid-04.gif", // "Delicious" satisfied nod
    ],
    invalid: [
      "/roast-gifs/chef/invalid-01.gif", // Gordon Ramsay "Idiot Sandwich"
      "/roast-gifs/chef/invalid-02.gif", // Gordon Ramsay absolute disgust
      "/roast-gifs/chef/invalid-03.gif", // Spitting out terrible food
      "/roast-gifs/chef/invalid-04.gif", // Throwing the plate in the trash
    ],
    verdict: [
      "/roast-gifs/chef/verdict-01.gif", // Spongebob kitchen on fire chaos
      "/roast-gifs/chef/verdict-02.gif", // Gordon Ramsay walking out
      "/roast-gifs/chef/verdict-03.gif", // "It's RAW!" yelling
      "/roast-gifs/chef/verdict-04.gif", // Shutting down the kitchen
    ]
  },

  // 🎬 THE MOVIE CRITIC (Hollywood, Popcorn, Applause, Boredom)
  movie: {
    valid: [
      "/roast-gifs/movie/valid-01.gif", // Leonardo DiCaprio Gatsby Toast
      "/roast-gifs/movie/valid-02.gif", // Shia LaBeouf intense clapping
      "/roast-gifs/movie/valid-03.gif", // Orson Welles Citizen Kane clap
      "/roast-gifs/movie/valid-04.gif", // Robert Redford mountain nod
    ],
    invalid: [
      "/roast-gifs/movie/invalid-01.gif", // Simon Cowell rolling eyes
      "/roast-gifs/movie/invalid-02.gif", // Steve Carell looking completely exhausted
      "/roast-gifs/movie/invalid-03.gif", // Throwing popcorn at the screen
      "/roast-gifs/movie/invalid-04.gif", // Sleeping in the movie theater
    ],
    verdict: [
      "/roast-gifs/movie/verdict-01.gif", // Curtains closing dramatically
      "/roast-gifs/movie/verdict-02.gif", // Walking away from an explosion
      "/roast-gifs/movie/verdict-03.gif", // Throwing the script away
      "/roast-gifs/movie/verdict-04.gif", // "Cut! That's a wrap" slate clap
    ]
  },

  // 🕵️ THE DETECTIVE (Clues, Sleuthing, Handcuffs, Confusion)
  detective: {
    valid: [
      "/roast-gifs/detective/valid-01.gif", // Pointing "You got it"
      "/roast-gifs/detective/valid-02.gif", // Sherlock thinking/nodding
      "/roast-gifs/detective/valid-03.gif", // Magnifying glass zoom in
      "/roast-gifs/detective/valid-04.gif", // "I knew it!" realization
    ],
    invalid: [
      "/roast-gifs/detective/invalid-01.gif", // Inspector Clouseau clueless
      "/roast-gifs/detective/invalid-02.gif", // John Travolta looking around empty room
      "/roast-gifs/detective/invalid-03.gif", // Disappointed head shake
      "/roast-gifs/detective/invalid-04.gif", // Confused squinting at evidence
    ],
    verdict: [
      "/roast-gifs/detective/verdict-01.gif", // Slamming "CASE CLOSED" stamp
      "/roast-gifs/detective/verdict-02.gif", // Handcuffs locking
      "/roast-gifs/detective/verdict-03.gif", // Throwing the case file in the trash
      "/roast-gifs/detective/verdict-04.gif", // Putting on sunglasses (CSI Miami style)
    ]
  },

  // 🏟️ THE SPORTS COMMENTATOR (Referees, Penalties, Victories, Fumbles)
  sports: {
    valid: [
      "/roast-gifs/sports/valid-01.gif", // Coach super saiyan fist pump
      "/roast-gifs/sports/valid-02.gif", // Fan going absolutely wild
      "/roast-gifs/sports/valid-03.gif", // Perfect 10 scorecard
      "/roast-gifs/sports/valid-04.gif", // Touchdown celebration dance
    ],
    invalid: [
      "/roast-gifs/sports/invalid-01.gif", // Referee pulling a Red Card
      "/roast-gifs/sports/invalid-02.gif", // Referee throwing the penalty flag
      "/roast-gifs/sports/invalid-03.gif", // Facepalm on the bench
      "/roast-gifs/sports/invalid-04.gif", // Massive swing and a miss (Airball)
    ],
    verdict: [
      "/roast-gifs/sports/verdict-01.gif", // Game over / scoreboard zeroes
      "/roast-gifs/sports/verdict-02.gif", // Pouring the Gatorade cooler
      "/roast-gifs/sports/verdict-03.gif", // "You're Out!" umpire yell
      "/roast-gifs/sports/verdict-04.gif", // Dejected player walking off field
    ]
  },

  // 📋 THE HR REP (Corporate, Office Space, Paperwork, Firing)
  hr: {
    valid: [
      "/roast-gifs/hr/valid-01.gif", // Michael Scott "Thank you!" slam
      "/roast-gifs/hr/valid-02.gif", // Stanley Hudson nodding with approval
      "/roast-gifs/hr/valid-03.gif", // Ron Swanson proud smile
      "/roast-gifs/hr/valid-04.gif", // Firm, successful corporate handshake
    ],
    invalid: [
      "/roast-gifs/hr/invalid-01.gif", // Disappointed corporate stare
      "/roast-gifs/hr/invalid-02.gif", // Office worker dumping paper in shredder
      "/roast-gifs/hr/invalid-03.gif", // Milton clutching his stapler
      "/roast-gifs/hr/invalid-04.gif", // Office Space printer smash
    ],
    verdict: [
      "/roast-gifs/hr/verdict-01.gif", // Packing up desk in a cardboard box
      "/roast-gifs/hr/verdict-02.gif", // Big red REJECTED stamp
      "/roast-gifs/hr/verdict-03.gif", // "You're Fired" Vince McMahon
      "/roast-gifs/hr/verdict-04.gif", // Security escorting someone out
    ]
  }
} satisfies Record<RoastPersona, Record<RoastGifBucket, string[]>>;

export function getRoastGifPool(
  persona: RoastPersona,
  bucket: RoastGifBucket,
): string[] {
  return ROAST_GIFS[persona][bucket];
}

function resolveRoastGifUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function pickRoastGif(
  persona: RoastPersona,
  bucket: RoastGifBucket,
): string {
  const pool = getRoastGifPool(persona, bucket);
  return resolveRoastGifUrl(
    pool[Math.floor(Math.random() * pool.length)] ??
      ROAST_GIFS.cartographer[bucket][0]!,
  );
}

export function formatRoastGifList(
  persona: RoastPersona,
  bucket: RoastGifBucket,
): string {
  return [
    "**GIF List (use one URL in the image tag at the top of your chosen format):**",
    ...getRoastGifPool(persona, bucket).map(
      (gif, index) => `${index + 1}. ${resolveRoastGifUrl(gif)}`,
    ),
  ].join("\n");
}
