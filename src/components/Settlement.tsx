"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./Settlement.module.scss";
import { useRoutesStore } from "@/store/ticketStore";
import { formatCOP, parseAmount } from "@/lib/money";
import { DollarIcon } from "./icons";

export default function Settlement() {
  const routes = useRoutesStore((s) => s.routes);
  const [open, setOpen] = useState(false);

  const entries = useMemo(() => {
    const list: { amount: number; address: string }[] = [];
    for (const route of routes) {
      for (const photo of route.photos) {
        if (photo.payment !== "E") continue;
        const amount = parseAmount(photo.price);
        if (Number.isNaN(amount) || amount <= 0) continue;
        list.push({ amount, address: photo.address.trim() });
      }
    }
    return list;
  }, [routes]);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Liquidación"
        title="Liquidación de efectivo"
      >
        <DollarIcon />
        {total > 0 && <span className={styles.badge}>{formatCOP(total)}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <p className={styles.summary}>
              Recibiste todo este efectivo:{" "}
              <strong className={styles.summaryTotal}>
                {formatCOP(total)}
              </strong>
            </p>
            {entries.length === 0 ? (
              <p className={styles.empty}>Aún no hay efectivo registrado.</p>
            ) : (
              <motion.ul className={styles.list}>
                {entries.map((e, i) => (
                  <motion.li
                    key={`${e.address}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.18 }}
                  >
                    <span className={styles.amount}>{formatCOP(e.amount)}</span>
                    <span className={styles.address}>
                      {e.address || "Sin dirección"}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}