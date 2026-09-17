"use client";

import styles from "./TokenMeter.module.scss";
import {
  getLimit,
  getRemaining,
  useRoutesStore,
} from "@/store/ticketStore";
import { formatTokens } from "@/lib/tokens";

const R = 25;
const C = 2 * Math.PI * R;

export default function TokenMeter() {
  const limit = useRoutesStore(getLimit);
  const remaining = useRoutesStore(getRemaining);
  const openTokenPanel = useRoutesStore((s) => s.openTokenPanel);

  const pct =
    limit != null && remaining != null
      ? Math.max(0, Math.min(1, remaining / limit))
      : null;

  const dash = pct != null ? pct * C : C;
  const stroke =
    pct == null
      ? "var(--c-text-soft)"
      : pct > 0.5
        ? "var(--c-green)"
        : pct > 0.2
          ? "#e8a33d"
          : "var(--c-danger)";

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={openTokenPanel}
      aria-label="Tokens restantes"
      title="Ver consumo de tokens"
    >
      <svg className={styles.ring} viewBox="0 0 64 64">
        <circle className={styles.track} cx="32" cy="32" r={R} />
        <circle
          className={styles.progress}
          cx="32"
          cy="32"
          r={R}
          stroke={stroke}
          strokeDasharray={C}
          strokeDashoffset={C - dash}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className={styles.value}>
        {remaining != null ? formatTokens(remaining) : "—"}
      </span>
    </button>
  );
}