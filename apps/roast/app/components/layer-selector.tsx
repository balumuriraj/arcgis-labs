import type { ToneMode } from "@repo/roast-analyzer";
import type { FormEvent } from "react";
import styles from "../page.module.css";

const toneOptions: Array<{ label: string; value: ToneMode }> = [
  { label: "Deadpan robot", value: "deadpan" },
  { label: "Playful", value: "playful" },
  { label: "Serious", value: "serious" },
];

interface LayerSelectorProps {
  layerUrl: string;
  tone: ToneMode;
  isLoading: boolean;
  error: string | null;
  onLayerUrlChange: (nextUrl: string) => void;
  onToneChange: (nextTone: ToneMode) => void;
  onSubmit: () => void;
}

export function LayerSelector({
  layerUrl,
  tone,
  isLoading,
  error,
  onLayerUrlChange,
  onToneChange,
  onSubmit,
}: LayerSelectorProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className={styles.section} onSubmit={handleSubmit}>
      <h2 className={styles.sectionTitle}>Layer input</h2>

      <label className={styles.label} htmlFor="layer-url-input">
        ArcGIS layer URL
      </label>
      <input
        id="layer-url-input"
        className={styles.input}
        value={layerUrl}
        onChange={(event) => onLayerUrlChange(event.target.value)}
        placeholder="https://.../FeatureServer/0"
        spellCheck={false}
      />

      <label className={styles.label} htmlFor="tone-select">
        Tone mode
      </label>
      <select
        id="tone-select"
        className={styles.select}
        value={tone}
        onChange={(event) => onToneChange(event.target.value as ToneMode)}
      >
        {toneOptions.map((option) => {
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.button}
          disabled={isLoading || layerUrl.trim().length === 0}
        >
          {isLoading ? "Roasting..." : "Roast layer"}
        </button>
      </div>

      <p className={styles.message}>
        Public `FeatureServer` or `MapServer` layer URLs are supported for MVP.
      </p>

      {error ? <p className={styles.message}>{error}</p> : null}
    </form>
  );
}