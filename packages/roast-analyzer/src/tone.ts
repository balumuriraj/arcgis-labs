import type { RoastFinding, ToneMode } from "./types";

const intros: Record<ToneMode, string[]> = {
  deadpan: [
    "Diagnostic update:",
    "Status report:",
    "Assessment complete:",
  ],
  playful: [
    "Plot twist:",
    "Data gossip:",
    "Snack break report:",
  ],
  serious: ["Analysis:", "Finding:", "Observation:"],
};

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function chooseByKey(options: string[], key: string): string {
  const choice = options[hashString(key) % options.length];
  return choice ?? options[0] ?? "";
}

export function renderRoast(finding: RoastFinding, tone: ToneMode): string {
  const intro = chooseByKey(intros[tone], finding.id);

  if (tone === "serious") {
    return `${intro} ${finding.summary}`;
  }

  return `${intro} ${finding.roastSeed}`;
}