import { LayerRoastApp } from "./components/layer-roast-app";
import styles from "./page.module.css";

export default function Page() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Layer Roast</h1>
        <p className={styles.subtitle}>
          Explore existing ArcGIS layers with evidence-first diagnostics and
          adjustable personality modes.
        </p>
      </header>
      <LayerRoastApp />
    </main>
  );
}