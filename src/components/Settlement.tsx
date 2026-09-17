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
    const list: {
      cash: number;
      transfer: number;
      address: string;
      phone: string;
    }[] = [];
    for (const route of routes) {
      for (const photo of route.photos) {
        const cash = Number.isNaN(parseAmount(photo.cash ?? ""))
          ? 0
          : parseAmount(photo.cash ?? "");
        const transfer = Number.isNaN(parseAmount(photo.transfer ?? ""))
          ? 0
          : parseAmount(photo.transfer ?? "");
        if (cash <= 0 && transfer <= 0) continue;
        list.push({
          cash,
          transfer,
          address: photo.address.trim(),
          phone: photo.phone.trim(),
        });
      }
    }
    return list;
  }, [routes]);

  const total = entries.reduce((sum, e) => sum + e.cash, 0);

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
                <strong>Liquidación</strong>
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
              <p className={styles.summary}>
                Recibiste todo este efectivo:{" "}
                <strong className={styles.summaryTotal}>
                  {formatCOP(total)}
                </strong>
              </p>
              {entries.length === 0 ? (
                <p className={styles.empty}>Aún no hay pagos registrados.</p>
              ) : (
                <motion.ul className={styles.list}>
                  {entries.map((e, i) => (
                    <motion.li
                      key={`${e.address}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.18 }}
                    >
                      <span className={styles.amount}>
                        {e.cash > 0 ? formatCOP(e.cash) : "—"}
                      </span>
                      <div className={styles.meta}>
                        <span className={styles.address}>
                          {e.address || "Sin dirección"}
                        </span>
                        {e.transfer > 0 && (
                          <>
                            <span className={styles.transferNote}>
                              {e.cash > 0
                                ? `El resto (${formatCOP(e.transfer)})`
                                : `Todo (${formatCOP(e.transfer)})`}{" "}
                              fue pagado en transferencia
                            </span>
                            {e.phone && (
                              <span className={styles.phone}>{e.phone}</span>
                            )}
                          </>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}