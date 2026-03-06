import type { EvidenceItem } from "@repo/roast-analyzer";
import styles from "../page.module.css";

interface EvidenceCardsProps {
  evidence: EvidenceItem[];
}

export function EvidenceCards({ evidence }: EvidenceCardsProps) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className={styles.evidenceGrid}>
      {evidence.map((item) => {
        return (
          <div key={`${item.label}-${item.value}`} className={styles.evidenceCard}>
            <span className={styles.evidenceLabel}>{item.label}</span>
            <span className={styles.evidenceValue}>{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}