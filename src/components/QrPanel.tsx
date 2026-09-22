"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./QrPanel.module.scss";
import { lockScroll } from "@/lib/scroll";

// TODO: pon aquí tu número de cuenta de ahorros. Es lo que aparece
// debajo del código QR. Texto libre, p. ej. "1234 5678 9012 3456".
const SAVINGS_ACCOUNT = "32474171418";

export default function QrPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    lockScroll(open);
  }, [open]);

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta de ahorros (QR)"
        title="Cuenta de ahorros"
      >
        Qr
      </button>
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
                <strong>Cuenta de ahorros</strong>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  ✕
                </button>
              </header>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.qr}
                src="/qr.jpeg"
                alt="Código QR de la cuenta de ahorros"
                draggable={false}
              />
              <p className={styles.account}>{SAVINGS_ACCOUNT}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}