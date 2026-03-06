"use client";

import "@arcgis/ai-components/components/arcgis-assistant";
import "@arcgis/ai-components/components/arcgis-assistant-agent";
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-input";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-popover";
import "@esri/calcite-components/components/calcite-progress";
import "@esri/calcite-components/components/calcite-card";
import "@esri/calcite-components/components/calcite-dialog";

import type MapView from "@arcgis/core/views/MapView";
import { marked } from "marked";
import { useEffect, useMemo, useRef, useState } from "react";

const ROAST_MESSAGES: Record<RoastPersona, string[]> = {
  cartographer: [
    "Ah yes, a map. Technically. The way a crayon scribble is technically art. 🖍️",
    "Your projection choice is a personal attack on every cartographer who ever lived. 🗺️🔪",
    "I've seen better-composed maps in a kindergarten class. They had an excuse. 🚸",
    "The color ramp you chose has been banned by the International Cartographic Association. 🚫🌈",
    "North arrows weep when they see what you've done with direction. 🧭😭",
    "Your scale bar called — it wants to be removed from this embarrassment. 📏📞",
    "Somewhere, a geography professor is using this map as a cautionary tale. 👨‍🏫📉",
    "The legend is more confused than its own creator. 🤷‍♂️🔣",
    "Your symbology is screaming for a therapist. 🛋️🎨",
    "Even Ptolemy's hand-drawn maps had more visual hierarchy than this. 📜🏺",
  ],
  chef: [
    "You've served a half-baked map with raw layers and overcooked colors. 🍳🔥",
    "This map is like a dish with no seasoning — bland, confused, and offensive. 🧂❌",
    "Gordon Ramsay would throw this map out of the kitchen immediately. 🤬🍽️",
    "You've combined ingredients that should never share a legend. 🥗🤢",
    "This is not a map. This is a geospatial crime against cuisine. 🚨🍲",
    "Your color palette tastes like gas station sushi. 🍣⛽",
    "I wouldn't serve this map to my worst enemy — the presentation alone is a sin. 🗑️🕸️",
    "The layers in this map are as unbalanced as a soufflé in an earthquake. 🥮💥",
    "You've over-rendered everything and seasoned nothing. 🥘📉",
    "This map needed more time in the oven and a complete rethink of the recipe. ⏲️📖",
  ],
  movie: [
    "One star. Would not recommend to any human being with working eyes. ⭐👀",
    "This map has the visual storytelling of a PowerPoint from 2003. 💾📉",
    "I give this map a Razzie for worst supporting color scheme. 🏆🍅",
    "The plot of this map makes less sense than a Christopher Nolan film played backwards. ⏪🎞️",
    "Your symbology is the cinematic equivalent of shaky cam — unwatchable. 🎥🤢",
    "This map has third-act problems and a first-act that never got off the ground. 🎬📉",
    "Spielberg wept. Kubrick rolled over. Nolan is confused — and he likes confusing things. 😭📽️",
    "Pacing, composition, contrast — name a film technique, and this map failed it. 📉🎟️",
    "I've sat through three-hour director's cuts with less suffering than this legend. 🛋️🕰️",
    "This map reminds me of a sequel nobody asked for — derivative and disappointing. ♻️🍿",
  ],
  detective: [
    "The evidence is clear: this map is hiding something, and that something is quality. 🕵️‍♂️📂",
    "I've interrogated maps before. This one cracked immediately — it's guilty. 🔦🚔",
    "The symbology is suspicious. The projection is an alibi. Nothing adds up. 🤨🔍",
    "My investigation concludes: the real crime here is the color palette. 🩸🎨",
    "A classic misdirection — you drew a legend, but it tells us nothing. 🎩💨",
    "Every clue points to the same conclusion: this map had no plan. 📌🧵",
    "I deduce that the person who made this map has never used a map. 🧩🤦‍♂️",
    "The scale is inconsistent. The layers are untrustworthy. The motive is unclear. ⚖️📉",
    "No jury would acquit this cartography. 👨‍⚖️🔨",
    "Elementary, my dear mapmaker — this is a disaster. 🚬🔬",
  ],
  sports: [
    "And that map is OUT! Way outside the strike zone of acceptable cartography! ⚾❌",
    "That's a yellow card for the color scheme and a red card for the projection! 🟨🟥",
    "The crowd goes QUIET as they witness the worst symbology play of the season! 🏟️🤫",
    "Coach is going to need a timeout after seeing this map — possible career change! ⏱️📋",
    "That legend just fumbled in the fourth quarter and lost the entire game! 🏈🤦‍♂️",
    "The referee has flagged this map for illegal use of opacity! 🚩🦓",
    "That's an unforced error on the scale bar — devastating! 🎾💥",
    "And the crowd is booing! They've never seen a map choke this hard! 👎🍅",
    "Rookie mistake on the color ramp — you hate to see it at this level. 📉🧢",
    "That map just got benched. Permanently. 🪑🛑",
  ],
  hr: [
    "After careful review, this map does not align with our quality standards or any standards. 📋📉",
    "We'd like to schedule a performance improvement plan for your layer organization. 📅😬",
    "This map creates a hostile visual environment for end users. 🚩🏢",
    "Your projection choices raise significant concerns about cultural sensitivity. 😬🌍",
    "We've received multiple complaints from stakeholders regarding the color palette. 📧🤦‍♀️",
    "This map is not meeting KPIs in any measurable dimension. 📉📊",
    "We appreciate your effort, but this map is not a culture fit for our organization. 🚫👔",
    "The symbology choices suggest a misalignment with team values and basic aesthetics. 🤝❌",
    "After consultation with leadership, we recommend a full cartographic restart. 👔🔄",
    "Your map has been flagged for review. Please collect your projection and go. 📦🚪",
  ],
};

const ROAST_HEADINGS: Record<RoastPersona, string> = {
  cartographer: "🗺️ Cartographic Assessment Report",
  chef: "🧑‍🍳 Chef's Verdict on This Dish",
  movie: "🎬 Official Critical Review",
  detective: "🕵️ Investigation Findings",
  sports: "🏟️ Play-by-Play Analysis",
  hr: "📋 Performance Improvement Notice",
};

const YOUR_TURN_MESSAGES: Record<RoastPersona, string> = {
  cartographer:
    "👇 Your turn. Spot a cartographic sin in this projection disaster before I permanently revoke your GIS license. ✂️🧭",
  chef: "👇 Your turn, chef. Point out a raw ingredient in this geospatial kitchen nightmare before I shut the whole restaurant down. 🍳🤢",
  movie:
    "👇 Your turn to review. Spot a plot hole in this cartographic box office bomb before the credits roll. 🍿📉",
  detective:
    "👇 Your turn to play detective. Spot a clue at this cartographic crime scene, or I'm taking you off the case. 🚨🔍",
  sports:
    "👇 Your turn to make a play! Throw a flag on this cartographic fumble before you get benched for the rest of the season. 🏈🟨",
  hr: "👇 Your turn. Please identify a visual compliance violation in this deliverable before we have to discuss your severance package. 🚪📉",
};

const BUTTON_LABELS: Record<RoastPersona, { tryAgain: string; endGame: string }> = {
  cartographer: {
    tryAgain: "🗺️ Map Another Disaster",
    endGame: "🏳️ Surrender to Default Symbology",
  },
  chef: {
    tryAgain: "🍳 Serve the Next Course",
    endGame: "🗑️ Close the Kitchen",
  },
  movie: {
    tryAgain: "🎬 Roll the Tragic Sequel",
    endGame: "🚪 Walk Out of the Theater",
  },
  detective: {
    tryAgain: "🔍 Investigate New Crime Scene",
    endGame: "🛑 Retire from the Force",
  },
  sports: {
    tryAgain: "🏏 Bowl Another Over",
    endGame: "🏏 Return to the Pavilion",
  },
  hr: {
    tryAgain: "📅 Next Performance Review",
    endGame: "📦 Pack Up Your Desk",
  },
};

// Replace these with your preferred GIF URLs
const ROAST_GIF_POOL = [
  "https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif", // This is fine dog
  "https://media.giphy.com/media/3og0IFrHkIglEOg8Ba/giphy.gif", // Picard facepalm
  "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif", // Judge Judy dismissive
  "https://media.giphy.com/media/5t9IcXiBCyw60XPpGu/giphy.gif", // Trash fire
  "https://media.giphy.com/media/H4uE6w9G1uK4M/giphy.gif", // Accordion disaster guy
];
import { OopsRoastAgent } from "./oops-roast-agent";
import { MAX_ROAST_ATTEMPTS } from "./oops-roast-agent/constants";
import {
  clearRoastTurnHandler,
  setRoastTurnHandler,
} from "./oops-roast-agent/roast-events";
import { computeRank } from "./oops-roast-agent/scoring";
import type { CritiqueSignal, RoastPersona } from "./oops-roast-agent/types";

interface OopsAssistantProps {
  portalUrl: string;
  webmapId: string;
  initialPersona: RoastPersona;
  reloadKey: number;
  mapView: MapView | null;
  onApplyPersona: (persona: RoastPersona) => void;
  onReconfigure: (portalUrl: string, webmapId: string) => void;
}

function scoreStyle(score: number): React.CSSProperties {
  const color =
    score >= 30
      ? "var(--calcite-color-status-success)"
      : score >= 15
        ? "var(--calcite-color-status-warning)"
        : "var(--calcite-color-status-danger)";
  return {
    "--calcite-chip-background-color": color,
    "--calcite-chip-text-color": "var(--calcite-color-text-inverse)",
    "--calcite-chip-icon-color": "var(--calcite-color-text-inverse)",
  } as React.CSSProperties;
}

export function OopsAssistant({
  portalUrl,
  webmapId,
  initialPersona,
  reloadKey,
  mapView,
  onApplyPersona,
  onReconfigure,
}: OopsAssistantProps) {
  const [score, setScore] = useState(0);
  const [roastAttemptCount, setRoastAttemptCount] = useState(0);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [foundCriterionIds, setFoundCriterionIds] = useState<string[]>([]);
  const [signals, setSignals] = useState<CritiqueSignal[]>([]);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [persona, setPersona] = useState<RoastPersona>(initialPersona);
  const [pendingPersona, setPendingPersona] =
    useState<RoastPersona>(initialPersona);
  const [pendingPortalUrl, setPendingPortalUrl] = useState(portalUrl);
  const [pendingWebmapId, setPendingWebmapId] = useState(webmapId);
  const [layers, setLayers] = useState<Array<{ id: string; title: string }>>(
    [],
  );
  const assistantRef = useRef<HTMLArcgisAssistantElement>(null);
  const stylePopoverRef = useRef<HTMLCalcitePopoverElement>(null);
  const settingsPopoverRef = useRef<HTMLCalcitePopoverElement>(null);

  useEffect(() => {
    setRoastTurnHandler(
      ({ pointsAwarded, sessionClosed: closed, countAttempt, criterionId, signals: s }) => {
        setScore((score) => score + pointsAwarded);
        if (countAttempt) setRoastAttemptCount((c) => c + 1);
        if (criterionId) setFoundCriterionIds((ids) => [...ids, criterionId]);
        setSessionClosed(closed);
        if (s) setSignals(s);
      },
    );
    return () => clearRoastTurnHandler();
  }, []);

  const handlePersonaChange = (event: Event) => {
    const el = event.target as HTMLCalciteListElement;
    const selected = el.selectedItems?.[0] as
      | HTMLCalciteListItemElement
      | undefined;
    if (selected?.value) setPendingPersona(selected.value as RoastPersona);
  };

  useEffect(() => {
    if (!mapView) return;
    const extracted =
      mapView.map?.layers
        .toArray()
        .map((l) => ({ id: l.id, title: l.title ?? l.id })) ?? [];
    setLayers(extracted);
  }, [mapView]);

  const roastMessage = useMemo(() => {
    const messages = ROAST_MESSAGES[persona];
    return messages[Math.floor(Math.random() * messages.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, reloadKey]);

  const roastGif = useMemo(() => {
    return ROAST_GIF_POOL[Math.floor(Math.random() * ROAST_GIF_POOL.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const handleApplyPersona = () => {
    setPersona(pendingPersona);
    setScore(0);
    setRoastAttemptCount(0);
    setSessionClosed(false);
    setFoundCriterionIds([]);
    setReportContent(null);
    if (stylePopoverRef.current) stylePopoverRef.current.open = false;
    onApplyPersona(pendingPersona);
  };

  return (
    <>
    <arcgis-assistant
      heading={"OopsMap"}
      description={"Roast your map"}
      key={`${webmapId}-${reloadKey}`}
      reference-element="arcgis-map"
      ref={assistantRef}
      // log-enabled
    >
      <arcgis-assistant-agent
        agent={OopsRoastAgent}
        context={{
          mapView,
          persona,
          score,
          roastAttemptCount,
          sessionClosed,
          foundCriterionIds,
        }}
      ></arcgis-assistant-agent>

      <calcite-card>
        <img
          slot="thumbnail"
          alt="map roast reaction"
          src={roastGif}
          style={{ width: "100%", maxHeight: "160px", objectFit: "cover" }}
        />
        <span slot="heading">{ROAST_HEADINGS[persona]}</span>
        <span slot="description">
          {roastMessage}
          <br /> {YOUR_TURN_MESSAGES[persona]}
        </span>
      </calcite-card>

      {assistantRef.current?.messages?.length === 0 ? (
        <calcite-notice
          slot="entry-message"
          open
          color="blue"
          width="full"
          closable
        >
          {/* <div slot="title">How to play</div> */}
          <div slot="message">
            You get <strong>{MAX_ROAST_ATTEMPTS} shots 🎯</strong> to roast this
            map 🗺️. Be specific—vague complaining earns you nothing but my
            disdain 🙄. If your critique survives my elite judgment ⚖️, I'll
            award you Roast Points 🔥. After 3 turns ⏳, I deliver the final
            verdict and we can all go wash our eyes 🧼👀.
          </div>
        </calcite-notice>
      ) : null}

      <calcite-chip
        slot="header-actions-end"
        icon="exclamation-mark-triangle"
        label="Score"
        style={scoreStyle(score)}
      >
        {score} pts
      </calcite-chip>

      <calcite-action
        slot="header-actions-end"
        id="settings-action"
        icon="gear"
        text="Settings"
      ></calcite-action>

      <calcite-popover
        slot="header-actions-end"
        referenceElement="settings-action"
        label="Settings"
        placement="bottom-end"
        ref={settingsPopoverRef}
      >
        <div
          style={{
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            minWidth: "280px",
          }}
        >
          <calcite-label>
            Portal URL
            <calcite-input
              type="text"
              value={pendingPortalUrl}
              placeholder="https://www.arcgis.com"
              oncalciteInputInput={(e: CustomEvent) =>
                setPendingPortalUrl((e.target as HTMLInputElement).value)
              }
            />
          </calcite-label>
          <calcite-label>
            Web Map Item ID
            <calcite-input
              type="text"
              value={pendingWebmapId}
              placeholder="e.g. 680ecd73ae634c8a823984a2d49d29b7"
              oncalciteInputInput={(e: CustomEvent) =>
                setPendingWebmapId((e.target as HTMLInputElement).value.trim())
              }
            />
          </calcite-label>
          <calcite-button
            width="full"
            disabled={!pendingPortalUrl || !pendingWebmapId || undefined}
            onClick={() => {
              if (settingsPopoverRef.current)
                settingsPopoverRef.current.open = false;
              onReconfigure(pendingPortalUrl, pendingWebmapId);
            }}
          >
            Apply
          </calcite-button>
        </div>
      </calcite-popover>

      <calcite-action
        slot="header-actions-end"
        id="style-picker-action"
        icon="effects"
        text="Choose a style"
      ></calcite-action>

      <calcite-popover
        slot="header-actions-end"
        referenceElement="style-picker-action"
        label="Choose a style"
        placement="bottom-end"
        ref={stylePopoverRef}
      >
        <calcite-list
          label="styles"
          selection-mode="single"
          oncalciteListChange={handlePersonaChange}
        >
          <calcite-list-item
            label="Cartographer"
            value="cartographer"
            selected={pendingPersona === "cartographer" || undefined}
          />
          <calcite-list-item
            label="Chef"
            value="chef"
            selected={pendingPersona === "chef" || undefined}
          />
          <calcite-list-item
            label="Movie Critic"
            value="movie"
            selected={pendingPersona === "movie" || undefined}
          />
          <calcite-list-item
            label="Detective"
            value="detective"
            selected={pendingPersona === "detective" || undefined}
          />
          <calcite-list-item
            label="Sports Commentator"
            value="sports"
            selected={pendingPersona === "sports" || undefined}
          />
          <calcite-list-item
            label="HR Manager"
            value="hr"
            selected={pendingPersona === "hr" || undefined}
          />
        </calcite-list>
        <calcite-button width="full" onClick={handleApplyPersona}>
          Apply
        </calcite-button>
      </calcite-popover>

      <calcite-action
        slot="entry-actions-start"
        id="layer-picker-action"
        icon="layers"
        text="Target layer"
      />
      <calcite-popover
        slot="entry-actions-start"
        referenceElement="layer-picker-action"
        label="Target layer"
        placement="top-start"
        auto-close
      >
        <calcite-list label="layers" selection-mode="single">
          {layers.map((layer, index) => (
            <calcite-list-item
              key={layer.id}
              label={layer.title}
              value={layer.id}
              selected={index === 0}
            />
          ))}
        </calcite-list>
      </calcite-popover>

      {sessionClosed ? (
        <div slot="footer-content" style={{ display: "flex", gap: "0.5rem", padding: "0.5rem" }}>
          <calcite-button width="full" appearance="outline" onClick={() => onApplyPersona(persona)}>
            {BUTTON_LABELS[persona].tryAgain}
          </calcite-button>
          <calcite-button
            width="full"
            loading={isGeneratingReport || undefined}
            disabled={isGeneratingReport || undefined}
            onClick={async () => {
              setIsGeneratingReport(true);
              await assistantRef.current?.submitMessage("end game");
              const msgs = assistantRef.current?.messages;
              if (msgs && msgs.length > 0) {
                const lastMsg = msgs.getItemAt(msgs.length - 1);
                if (lastMsg?.role === "assistant") {
                  setReportContent((lastMsg as { role: string; content?: string }).content ?? null);
                }
              }
              setIsGeneratingReport(false);
              setIsReportOpen(true);
            }}
          >
            {BUTTON_LABELS[persona].endGame}
          </calcite-button>
        </div>
      ) : (
        <calcite-progress
          slot="footer-content"
          type="determinate"
          value={(roastAttemptCount / MAX_ROAST_ATTEMPTS) * 100}
          text={`${roastAttemptCount} of ${MAX_ROAST_ATTEMPTS} roasts used`}
        />
      )}
    </arcgis-assistant>

    {(() => {
      const foundSignals = signals.filter((s) => foundCriterionIds.includes(s.criterionId));
      const missedSignals = signals.filter((s) => !foundCriterionIds.includes(s.criterionId));
      const rank = computeRank(score);
      const rankColor = score >= 26 ? "green" : score >= 14 ? "yellow" : "red";
      return (
        <calcite-dialog
          open={isReportOpen || undefined}
          heading="Oops Report"
          modal
          oncalciteDialogClose={() => setIsReportOpen(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem" }}>
            <calcite-notice open color={rankColor} width="full">
              <div slot="message">
                Final Score: <strong>{score} pts</strong> — <em>{rank}</em>
              </div>
            </calcite-notice>

            {reportContent ? (
              <div
                style={{ lineHeight: "1.6" }}
                dangerouslySetInnerHTML={{ __html: marked.parse(reportContent) as string }}
              />
            ) : (
              <>
                <h3 style={{ margin: 0 }}>Issues You Found ({foundSignals.length})</h3>
                {foundSignals.length === 0 ? (
                  <p style={{ margin: 0, fontStyle: "italic" }}>You found nothing. Impressive in the worst way.</p>
                ) : (
                  foundSignals.map((s) => (
                    <calcite-notice key={s.criterionId} open color="green" width="full">
                      <div slot="title">{s.criterionId} — {s.layerTitle}</div>
                      <div slot="message">{s.verdictReason}</div>
                    </calcite-notice>
                  ))
                )}

                <h3 style={{ margin: 0 }}>Issues You Missed ({missedSignals.length})</h3>
                {missedSignals.length === 0 ? (
                  <p style={{ margin: 0, fontStyle: "italic" }}>You caught everything. Suspicious.</p>
                ) : (
                  missedSignals.map((s) => (
                    <calcite-notice key={s.criterionId} open color="red" width="full">
                      <div slot="title">{s.criterionId} ({s.severity}) — {s.layerTitle}</div>
                      <div slot="message">{s.verdictReason}</div>
                      {s.recommendedFix && <div slot="message">Fix: {s.recommendedFix}</div>}
                    </calcite-notice>
                  ))
                )}
              </>
            )}
          </div>

          <calcite-button slot="footer-end" onClick={() => setIsReportOpen(false)}>
            Close
          </calcite-button>
        </calcite-dialog>
      );
    })()}
    </>
  );
}
