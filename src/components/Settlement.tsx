"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./Settlement.module.scss";
import { useRoutesStore } from "@/store/ticketStore";
import { formatCOP, parseAmount } from "@/lib/money";
import { DollarIcon } from "./icons";

const WHATSAPP_NUMBER = "3001377118";

type Row = {
  amount: number;
  address: string;
  phone: string;
};

export default function Settlement() {
  const routes = useRoutesStore((s) => s.routes);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const cash: Row[] = [];
    const transfers: Row[] = [];
    for (const route of routes) {
      for (const photo of route.photos) {
        const cashAmt = Number.isNaN(parseAmount(photo.cash ?? ""))
          ? 0
          : parseAmount(photo.cash ?? "");
        const transferAmt = Number.isNaN(parseAmount(photo.transfer ?? ""))
          ? 0
          : parseAmount(photo.transfer ?? "");
        const address = photo.address.trim();
        const phone = photo.phone.trim();
        if (cashAmt > 0) cash.push({ amount: cashAmt, address, phone });
        if (transferAmt > 0)
          transfers.push({ amount: transferAmt, address, phone });
      }
    }
    return { cash, transfers };
  }, [routes]);

  const totalCash = rows.cash.reduce((sum, r) => sum + r.amount, 0);
  const totalTransfer = rows.transfers.reduce((sum, r) => sum + r.amount, 0);
  const hasRows = rows.cash.length > 0 || rows.transfers.length > 0;

  const transferWaLink = () => {
    const lines: string[] = [];
    rows.transfers.forEach((row, i) => {
      if (i > 0) lines.push("");
      lines.push(
        `${row.address || "Sin dirección"}${row.phone ? ` ${row.phone}` : ""}`,
      );
      lines.push(`Transferido: ${formatCOP(row.amount)}`);
    });
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      lines.join("\n"),
    )}`;
  };

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
        {totalCash > 0 && <span className={styles.badge}>{formatCOP(totalCash)}</span>}
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
                Recibiste en efectivo:{" "}
                <strong className={styles.summaryTotal}>
                  {formatCOP(totalCash)}
                </strong>
              </p>
              {totalTransfer > 0 && (
                <p className={styles.summary}>
                  Recibiste en transferencia:{" "}
                  <strong className={styles.summaryTransfer}>
                    {formatCOP(totalTransfer)}
                  </strong>
                </p>
              )}
              {!hasRows ? (
                <p className={styles.empty}>Aún no hay pagos registrados.</p>
              ) : (
                <motion.ul className={styles.list}>
                  {rows.cash.map((e, i) => (
                    <motion.li
                      key={`c-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.18 }}
                    >
                      <span className={styles.amount}>{formatCOP(e.amount)}</span>
                      <div className={styles.meta}>
                        <span className={styles.address}>
                          {e.address || "Sin dirección"}
                        </span>
                      </div>
                    </motion.li>
                  ))}
                  {rows.transfers.map((e, i) => (
                    <motion.li
                      key={`t-${i}`}
                      className={styles.transferRow}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.04 * (rows.cash.length + i),
                        duration: 0.18,
                      }}
                    >
                      <span
                        className={`${styles.amount} ${styles.amountTransfer}`}
                      >
                        {formatCOP(e.amount)}
                      </span>
                      <div className={styles.meta}>
                        <span className={styles.address}>
                          {e.address || "Sin dirección"}
                        </span>
                        {e.phone && (
                          <span className={styles.phone}>{e.phone}</span>
                        )}
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
              {rows.transfers.length > 0 && (
                <a
                  className={styles.sendAllBtn}
                  href={transferWaLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Enviar todas las transferencias por WhatsApp"
                >
                  Enviar
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}