"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./TokenPanel.module.scss";
import { useRoutesStore } from "@/store/ticketStore";
import { MODELS } from "@/lib/models";
import { lockScroll } from "@/lib/scroll";

export default function TokenPanel() {
  const open = useRoutesStore((s) => s.overlayOpen);
  const closeTokenPanel = useRoutesStore((s) => s.closeTokenPanel);
  const modelVersion = useRoutesStore((s) => s.modelVersion);
  const setModelVersion = useRoutesStore((s) => s.setModelVersion);

  useEffect(() => {
    lockScroll(open);
  }, [open]);

  const activeLabel =
    MODELS.find((m) => m.id === modelVersion)?.label ?? modelVersion;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className={styles.card}>
            <header className={styles.header}>
              <strong>Versión de Gemini</strong>
              <button
                type="button"
                className={styles.close}
                onClick={closeTokenPanel}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className={styles.modelRow}>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.label}
                  className={`${styles.modelBtn} ${
                    modelVersion === m.id ? styles.modelBtnActive : ""
                  }`}
                  onClick={() => setModelVersion(m.id)}
                >
                  {m.short}
                </button>
              ))}
            </div>

            <p className={styles.note}>
              Activa: <strong>{activeLabel}</strong>. Si recibes un 429, cambia
              de versión aquí para usar otros tokens.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}