"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import styles from "./TicketCapture.module.scss";
import {
  useRoutesStore,
  type Route,
  type TicketPhoto,
} from "@/store/ticketStore";
import {
  CameraIcon,
  DollarIcon,
  PhoneIcon,
  PinIcon,
  TypewriterIcon,
  WhatsAppIcon,
  BillIcon,
  TransferIcon,
  RouteIcon,
  TrashIcon,
} from "./icons";
import { normalizeAddress } from "@/lib/address";
import { encodeImage, encodeTransformed, imageFileSize } from "@/lib/image";
import { isModelId } from "@/lib/models";
import { parseAmount } from "@/lib/money";

const WHATSAPP_NUMBER = "3001377118";
const SEND_MAX_DIM = 256;
const SEND_QUALITY = 1;

const MISSING = {
  address: "No hay dirección",
  phone: "No hay celular",
  price: "No hay precio",
} as const;

export default function TicketCapture({ route }: { route: Route }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  // Galería deshabilitada por ahora
  // const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<string | null>(null);
  const [viewer, setViewer] = useState<TicketPhoto | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const pressSuppressed = useRef(false);

  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  const addPhotos = useRoutesStore((s) => s.addPhotos);
  const removePhoto = useRoutesStore((s) => s.removePhoto);
  const setActiveIndex = useRoutesStore((s) => s.setActiveIndex);
  const updateActive = useRoutesStore((s) => s.updateActive);
  const updatePhoto = useRoutesStore((s) => s.updatePhoto);
  const modelVersion = useRoutesStore((s) => s.modelVersion);
  const openTokenPanel = useRoutesStore((s) => s.openTokenPanel);
  const recordUsage = useRoutesStore((s) => s.recordUsage);

  const active = route.photos[route.activeIndex];

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setQuotaHit(false);
    setPhoneMenuOpen(false);
    setPriceMenuOpen(false);
    try {
      const added = await Promise.all(
        Array.from(files).map(async (file) => {
          const [preview, dims] = await Promise.all([
            encodeImage(file, 1200, 0.85),
            imageFileSize(file),
          ]);
          return {
            id: crypto.randomUUID(),
            file,
            preview: preview.dataUrl,
            address: "",
            phone: "",
            price: "",
            total: "",
            cash: "",
            transfer: "",
            width: dims.width,
            height: dims.height,
          };
        }),
      );
      addPhotos(route.id, added);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer la imagen");
    }
  };

  const getPayload = async (photo: TicketPhoto) => {
    if ((photo.rotation ?? 0) % 360 !== 0) {
      return encodeTransformed(
        photo.file ?? photo.preview,
        photo.rotation!,
        SEND_MAX_DIM,
        SEND_QUALITY,
      );
    }
    if (photo.file) {
      return encodeImage(photo.file, SEND_MAX_DIM, SEND_QUALITY);
    }
    const [head, base64] = photo.preview.split(",");
    const mediaType = head.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
    const bytes = Math.ceil((photo.preview.length * 3) / 4);
    return {
      dataUrl: photo.preview,
      base64: base64 ?? "",
      mediaType,
      bytes,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
    };
  };

  const transcribeActive = async () => {
    if (!active || loading) return;
    setError(null);
    setQuotaHit(false);
    setLoading(true);
    try {
      const payload = await getPayload(active);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: payload.base64,
          mediaType: payload.mediaType,
          model: modelVersion,
          width: payload.width,
          height: payload.height,
          bytes: payload.bytes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error ?? "Error al transcribir") as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }
      updateActive(route.id, {
        address: normalizeAddress(data.address ?? ""),
        phone: data.phone ?? "",
        price: data.price ?? "",
        total: data.price ?? "",
      });
      const usedModel = isModelId(data.model) ? data.model : modelVersion;
      recordUsage(usedModel, data.usage?.total ?? 0);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      setQuotaHit(status === 429);
      setError(e instanceof Error ? e.message : "Error al transcribir");
    } finally {
      setLoading(false);
    }
  };

  const waLink = () => {
    if (!active) return "#";
    const parts = [
      `Dirección: ${active.address || MISSING.address}`,
      `Teléfono: ${active.phone || MISSING.phone}`,
      `Precio: ${active.price || MISSING.price}`,
      "",
      "¿ya pagó?",
    ];
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      parts.join("\n"),
    )}`;
  };

  const mapsLink = () =>
    active?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          active.address,
        )}`
      : "#";

  const routeAddrs = route.photos
    .map((p) => p.address.trim())
    .filter(Boolean);

  const cashVal = active?.cash ?? "";
  const transferVal = active?.transfer ?? "";
  const payMode =
    parseAmount(transferVal) > 0
      ? "transfer"
      : parseAmount(cashVal) > 0
        ? "cash"
        : "none";

  const restTransfer = (price?: string, total?: string): string => {
    const p = parseAmount(price ?? "");
    const t = parseAmount(total ?? "");
    if (Number.isNaN(p) || Number.isNaN(t)) return "";
    const diff = t - p;
    return diff > 0 ? String(diff) : "";
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const startPress = (id: string, e: React.PointerEvent) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    pressSuppressed.current = false;
    pressTimer.current = setTimeout(() => {
      pressSuppressed.current = true;
      setDelTarget(id);
    }, 550);
  };
  const movePress = (e: React.PointerEvent) => {
    const origin = pressOrigin.current;
    if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 10) {
      pressSuppressed.current = true;
      cancelPress();
    }
  };
  const endPress = cancelPress;

  const rotate = (photoId: string) => {
    const photo = route.photos.find((p) => p.id === photoId);
    if (!photo) return;
    updatePhoto(route.id, photoId, {
      rotation: ((((photo.rotation ?? 0) + 90) % 360) + 360) % 360,
    });
  };

  const handleTap = (photo: TicketPhoto) => {
    if (pressSuppressed.current) {
      pressSuppressed.current = false;
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      rotate(photo.id);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      setViewer(photo);
    }, 260);
  };

  const mapsRouteLink = () => {
    if (routeAddrs.length < 2) return "#";
    const last = routeAddrs[routeAddrs.length - 1];
    const waypoints = routeAddrs.slice(0, -1);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      last,
    )}&waypoints=${waypoints.map(encodeURIComponent).join("|")}`;
  };

  const waNumberLink = () =>
    active?.phone
      ? `https://wa.me/${active.phone.replace(/[^\d]/g, "")}`
      : "#";

  const telLink = () => (active?.phone ? `tel:${active.phone}` : "#");

  return (
    <div className={styles.container}>
      <div className={styles.cameraButtons}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => cameraRef.current?.click()}
          aria-label="Tomar foto"
          title="Tomar foto"
        >
          <CameraIcon />
        </button>
        {/*
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => galleryRef.current?.click()}
          aria-label="Elegir imágenes"
          title="Elegir imágenes"
        >
          <ImageIcon />
        </button>
        */}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/*
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      */}

      {route.photos.length > 0 && (
        <>
          <Swiper
            className={styles.swiper}
            modules={[Pagination]}
            pagination={{ clickable: true }}
            onSlideChange={(s) => {
              setActiveIndex(route.id, s.activeIndex);
              setPhoneMenuOpen(false);
              setPriceMenuOpen(false);
            }}
          >
            {route.photos.map((photo, i) => (
              <SwiperSlide key={photo.id} className={styles.slide}>
                <div
                  className={styles.slideInner}
                  onPointerDown={(e) => startPress(photo.id, e)}
                  onPointerMove={movePress}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                  onClick={() => handleTap(photo)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.slideImg}
                    src={photo.preview}
                    alt={`Ticket ${i + 1}`}
                    draggable={false}
                    style={{
                      transform: `rotate(${photo.rotation ?? 0}deg)`,
                      transition: "transform 0.18s ease",
                    }}
                  />
                  {delTarget === photo.id && (
                    <div className={styles.deleteOverlay}>
                      <button
                        type="button"
                        className={`${styles.menuRound} ${styles.menuRoundDanger}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(route.id, photo.id);
                          setDelTarget(null);
                        }}
                        aria-label={`Eliminar ticket ${i + 1}`}
                        title="Eliminar foto"
                      >
                        <TrashIcon />
                      </button>
                      <button
                        type="button"
                        className={`${styles.menuRound} ${styles.menuRoundClose}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDelTarget(null);
                        }}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          <button
            type="button"
            className={styles.btn}
            onClick={transcribeActive}
            disabled={loading}
            aria-busy={loading}
          >
            <motion.span
              style={{ display: "inline-flex" }}
              animate={loading ? { y: [0, -3, 2, -2, 0] } : { y: 0 }}
              transition={{
                duration: 0.45,
                repeat: loading ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <TypewriterIcon />
            </motion.span>
          </button>

          {error && (
            <div className={styles.errorWrap}>
              <p className={styles.error}>{error}</p>
              {quotaHit && (
                <button
                  type="button"
                  className={styles.quotaBtn}
                  onClick={openTokenPanel}
                >
                  Cambiar de versión
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className={styles.fields}>
        <div className={styles.field}>
          <label>Dirección</label>
          <div className={styles.controlRow}>
            <input
              type="text"
              value={active?.address ?? ""}
              onChange={(e) => updateActive(route.id, { address: e.target.value })}
              onBlur={() => {
                if (route.photos[route.activeIndex]?.address) {
                  updateActive(route.id, {
                    address: normalizeAddress(route.photos[route.activeIndex].address),
                  });
                }
              }}
              placeholder={MISSING.address}
              disabled={!active}
            />
            <button
              type="button"
              disabled={!active}
              title="Abrir en Google Maps"
              className={`${styles.actBtn} ${
                addressMenuOpen ? styles.actBtnActive : ""
              } ${!active?.address && routeAddrs.length < 2 ? styles.actBtnDisabled : ""}`}
              onClick={() => setAddressMenuOpen((v) => !v)}
            >
              <PinIcon />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {addressMenuOpen && (
              <motion.div
                className={styles.menuRow}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <a
                  href={mapsLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAddressMenuOpen(false)}
                  aria-label="Abrir dirección sola"
                  aria-disabled={!active?.address}
                  title="Abrir esta dirección en Google Maps"
                  className={`${styles.menuRound} ${
                    !active?.address ? styles.menuDisabled : ""
                  }`}
                >
                  <PinIcon />
                </a>
                <a
                  href={mapsRouteLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAddressMenuOpen(false)}
                  aria-label="Abrir ruta con todas las direcciones"
                  aria-disabled={routeAddrs.length < 2}
                  title={`Abrir ruta en Google Maps (${routeAddrs.length} direcciones agregadas)`}
                  className={`${styles.menuRound} ${
                    routeAddrs.length < 2 ? styles.menuDisabled : ""
                  }`}
                >
                  <RouteIcon />
                  {routeAddrs.length > 0 && (
                    <span className={styles.menuBadge}>{routeAddrs.length}</span>
                  )}
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.field}>
          <label>Teléfono</label>
          <div className={styles.controlRow}>
            <input
              type="tel"
              value={active?.phone ?? ""}
              onChange={(e) => updateActive(route.id, { phone: e.target.value })}
              placeholder={MISSING.phone}
              disabled={!active}
            />
            <button
              type="button"
              title="Acciones del número"
              disabled={!active?.phone}
              className={`${styles.actBtn} ${
                phoneMenuOpen ? styles.actBtnActive : ""
              }`}
              onClick={() => setPhoneMenuOpen((v) => !v)}
            >
              <PhoneIcon />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {phoneMenuOpen && active?.phone && (
              <motion.div
                className={styles.phoneMenu}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <a
                  href={waNumberLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setPhoneMenuOpen(false)}
                  aria-label="Enviar a WhatsApp"
                  title="Enviar a WhatsApp"
                >
                  <WhatsAppIcon />
                </a>
                <a
                  href={telLink()}
                  onClick={() => setPhoneMenuOpen(false)}
                  aria-label="Llamar"
                  title="Llamar"
                >
                  <PhoneIcon />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.field}>
          <label>Precio</label>
          <div className={styles.controlRow}>
            <input
              type="text"
              value={active?.price ?? ""}
              onChange={(e) => updateActive(route.id, { price: e.target.value })}
              placeholder={MISSING.price}
              disabled={!active}
            />
            <button
              type="button"
              disabled={!active}
              title={
                payMode === "cash"
                  ? "Efectivo"
                  : payMode === "transfer"
                    ? "Transferencia"
                    : "Marcar pago"
              }
              className={`${styles.actBtn} ${
                priceMenuOpen ? styles.actBtnActive : ""
              } ${
                payMode === "cash"
                  ? styles.actBtnCash
                  : payMode === "transfer"
                    ? styles.actBtnTransfer
                    : ""
              }`}
              onClick={() => setPriceMenuOpen((v) => !v)}
            >
              {payMode === "cash" ? (
                <BillIcon />
              ) : payMode === "transfer" ? (
                <TransferIcon />
              ) : (
                <DollarIcon />
              )}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {priceMenuOpen && active && (
              <motion.div
                className={styles.priceMenu}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className={styles.menuRow}>
                  <button
                    type="button"
                    onClick={() => {
                      updateActive(route.id, {
                        cash: active.price,
                        transfer: restTransfer(active.price, active.total),
                      });
                      setPriceMenuOpen(false);
                    }}
                    aria-label="Todo en efectivo"
                    title="Todo en efectivo"
                    className={`${styles.menuRound} ${styles.menuRoundCash}`}
                  >
                    <BillIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateActive(route.id, {
                        transfer: active.price,
                        cash: "",
                      });
                      setPriceMenuOpen(false);
                    }}
                    aria-label="Todo en transferencia"
                    title="Todo en transferencia"
                    className={`${styles.menuRound} ${styles.menuRoundTransfer}`}
                  >
                    <TransferIcon />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.wa}>
        <a
          href={waLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!active}
          className={`${styles.waBtn} ${active ? "" : styles.waBtnDisabled}`}
        >
          Enviar
        </a>
      </div>

      <AnimatePresence>
        {viewer && (
          <motion.div
            className={styles.viewer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewer(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.viewerImg}
              src={viewer.preview}
              alt="Foto ampliada"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `rotate(${viewer.rotation ?? 0}deg)`,
              }}
            />
            <div className={styles.viewerActions}>
              <a
                className={`${styles.viewerBtn} ${styles.viewerBtnAccent}`}
                href={viewer.preview}
                download={`ticket-${viewer.id}.jpg`}
                onClick={(e) => e.stopPropagation()}
                aria-label="Descargar foto"
                title="Descargar foto"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
              <button
                type="button"
                className={`${styles.viewerBtn} ${styles.viewerBtnClose}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer(null);
                }}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}