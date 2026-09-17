"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./Routes.module.scss";
import TicketCapture from "./TicketCapture";
import Settlement from "./Settlement";
import TokenMeter from "./TokenMeter";
import TokenPanel from "./TokenPanel";
import QrPanel from "./QrPanel";
import { useRoutesStore } from "@/store/ticketStore";
import { TOKEN_TEST_UI } from "@/lib/testFlags";

export default function Routes() {
  const routes = useRoutesStore((s) => s.routes);
  const expandedId = useRoutesStore((s) => s.expandedId);
  const addRoute = useRoutesStore((s) => s.addRoute);
  const removeRoute = useRoutesStore((s) => s.removeRoute);
  const setExpanded = useRoutesStore((s) => s.setExpanded);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    useRoutesStore.persist.rehydrate();
  }, []);

  const nextNumber =
    routes.reduce(
      (max, r) => Math.max(max, Number(r.name.replace(/\D+/g, "")) || 0),
      0,
    ) + 1;

  const confirmAdd = () => {
    addRoute({
      id: crypto.randomUUID(),
      name: `Ruta ${nextNumber}`,
      photos: [],
      activeIndex: 0,
    });
    setShowAdd(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <div className={styles.leftActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowAdd((v) => !v)}
            aria-label="Agregar ruta"
            title="Agregar ruta"
          >
            +
          </button>
          {showAdd && (
            <button type="button" className={styles.btn} onClick={confirmAdd}>
              Agregar ruta {nextNumber}
            </button>
          )}
        </div>
        <div className={styles.rightActions}>
          {TOKEN_TEST_UI && <TokenMeter />}
          <QrPanel />
          <Settlement />
        </div>
      </div>

      {routes.map((route) => (
        <div
          key={route.id}
          className={`${styles.route} ${
            expandedId === route.id ? styles.routeOpen : ""
          }`}
        >
          <div className={styles.routeHeader}>
            <button
              type="button"
              className={`${styles.routeName} ${
                expandedId === route.id ? styles.routeNameActive : ""
              }`}
              onClick={() =>
                setExpanded(expandedId === route.id ? null : route.id)
              }
            >
              {route.name}
              <span className={styles.routeCount}>
                {route.photos.length} {route.photos.length === 1 ? "foto" : "fotos"}
              </span>
            </button>
            <button
              type="button"
              className={styles.routeDelete}
              onClick={() => removeRoute(route.id)}
              aria-label={`Borrar ${route.name}`}
              title="Borrar ruta"
            >
              ✕
            </button>
          </div>
          <AnimatePresence initial={false}>
            {expandedId === route.id && (
              <motion.div
                className={styles.routeBody}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
              >
                <TicketCapture route={route} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {TOKEN_TEST_UI && <TokenPanel />}
    </div>
  );
}