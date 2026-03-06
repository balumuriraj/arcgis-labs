import type { RoastFindingWithText, RoastApiResponse } from "./types";
import { EvidenceCards } from "./evidence-cards";
import styles from "../page.module.css";

const countFormatter = new Intl.NumberFormat("en-US");

const severityClass: Record<RoastFindingWithText["severity"], string> = {
  low: styles.badgeLow ?? "",
  medium: styles.badgeMedium ?? "",
  high: styles.badgeHigh ?? "",
};

interface RoastPanelProps {
  result: RoastApiResponse | null;
  isLoading: boolean;
}

export function RoastPanel({ result, isLoading }: RoastPanelProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Roast findings</h2>

      {isLoading && !result ? (
        <p className={styles.emptyState}>Crunching sample statistics...</p>
      ) : null}

      {!result && !isLoading ? (
        <p className={styles.emptyState}>
          Run a roast to inspect null patterns, outliers, stale updates, and
          category imbalances.
        </p>
      ) : null}

      {result ? (
        <>
          <p className={styles.meta}>
            {result.layerTitle} · {result.geometryType} · Features{" "}
            {countFormatter.format(result.featureCount)} · Sampled{" "}
            {countFormatter.format(result.sampledFeatureCount)}
          </p>

          {result.notes.length > 0 ? (
            <ul className={styles.notes}>
              {result.notes.map((note) => (
                <li className={styles.noteItem} key={note}>
                  {note}
                </li>
              ))}
            </ul>
          ) : null}

          {result.findings.length === 0 ? (
            <p className={styles.emptyState}>
              No major issues crossed the MVP thresholds for this sample.
            </p>
          ) : (
            <div className={styles.findings}>
              {result.findings.map((finding) => {
                return (
                  <article className={styles.finding} key={finding.id}>
                    <div className={styles.findingHeader}>
                      <h3>{finding.title}</h3>
                      <span
                        className={`${styles.badge} ${severityClass[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <p className={styles.roastLine}>{finding.roastText}</p>
                    <p className={styles.summary}>{finding.summary}</p>
                    <p className={styles.confidence}>
                      Confidence {Math.round(finding.confidence * 100)}% · Score{" "}
                      {finding.score}
                    </p>
                    <p className={styles.suggestedFix}>
                      <strong>Fix:</strong> {finding.suggestedFix}
                    </p>
                    <EvidenceCards evidence={finding.evidence} />
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}