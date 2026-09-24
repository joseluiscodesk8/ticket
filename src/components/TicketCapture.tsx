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
import { dataUrlToFile, encodeCropped, encodeImage, encodeTransformed, imageFileSize } from "@/lib/image";
import { isModelId } from "@/lib/models";
import { isNotePhrase, parseAmount } from "@/lib/money";
import { lockScroll } from "@/lib/scroll";

const WHATSAPP_NUMBER = "3001377118";
const SEND_MAX_DIM = 256;
const SEND_QUALITY = 1;

// Quita todos los espacios del teléfono: siempre debe quedar pegado.
export const normalizePhone = (raw: string): string =>
  raw.replace(/\s+/g, "");

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
  const [cropActive, setCropActive] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const pressSuppressed = useRef(false);
  const cropDrag = useRef<{
    photoId: string;
    edge: "n" | "s" | "e" | "w";
    startX: number;
    startY: number;
    rect: { left: number; top: number; w: number; h: number };
    crop: { x: number; y: number; w: number; h: number };
  } | null>(null);

  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  useEffect(() => {
    lockScroll(Boolean(viewer));
  }, [viewer]);

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
    if (photo.crop) {
      return encodeCropped(
        photo.file ?? photo.preview,
        photo.crop,
        photo.rotation ?? 0,
        SEND_MAX_DIM,
        SEND_QUALITY,
      );
    }
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      let res: Response;
      try {
        res = await fetch("/api/transcribe", {
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
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // si no llega JSON, dejar data como null y reportar el estado
      }
      if (!res.ok) {
        const body =
          data && typeof data === "object"
            ? (data as { error?: string; detail?: string })
            : {};
        const err = new Error(
          body.error ?? `Error ${res.status} al transcribir`,
        ) as Error & { status?: number; data?: unknown };
        err.status = res.status;
        err.data = data;
        console.error("Transcripción falló:", {
          status: res.status,
          error: body.error,
          detail: body.detail,
          datos: data,
        });
        throw err;
      }
      const ok = data as {
        address?: string;
        phone?: string;
        price?: string;
        model?: string;
        usage?: { total?: number };
      };
      updateActive(route.id, {
        address: normalizeAddress(ok.address ?? ""),
        phone: normalizePhone(ok.phone ?? ""),
        price: ok.price ?? "",
        total: ok.price ?? "",
      });
      const usedModel = isModelId(ok.model) ? ok.model : modelVersion;
      recordUsage(usedModel, ok.usage?.total ?? 0);
    } catch (e) {
      const err = e as Error & { status?: number; data?: unknown };
      if (err.name === "AbortError") {
        console.error(
          "Transcripción: tiempo de espera agotado (posible internet lento o servidor saturado)",
        );
        setError(
          "El servidor tardó demasiado en responder. Puede ser internet lento, imagen muy pesada o el modelo saturado. Revisa la consola.",
        );
      } else if (err instanceof TypeError && /fetch|Network/i.test(err.message)) {
        console.error("Transcripción: error de red (sin conexión):", err);
        setError(
          "No hubo conexión con el servidor (revisa el internet). Revisa la consola.",
        );
      } else {
        const status = err.status;
        setQuotaHit(status === 429);
        const detail =
          err.data && typeof err.data === "object"
            ? (err.data as { detail?: string }).detail
            : undefined;
        console.error("Transcripción falló:", {
          status: err.status,
          message: err.message,
          detail,
          datos: err.data,
        });
        setError(
          detail
            ? `${err.message}. Detalle: ${detail}`
            : err.message ?? "Error al transcribir",
        );
      }
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
    parseAmount(transferVal) > 0 || isNotePhrase(transferVal)
      ? "transfer"
      : parseAmount(cashVal) > 0 || isNotePhrase(cashVal)
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
      rotation: (photo.rotation ?? 0) + 90,
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

  const savePhoto = async () => {
    if (!viewer) return;
    try {
      const file = await dataUrlToFile(viewer.preview, `ticket-${viewer.id}.jpg`);
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Ticket" });
          return;
        } catch (e) {
          if (e && typeof e === "object" && "name" in e && e.name === "AbortError") {
            return;
          }
        }
      }
    } catch {
      // si falla, se cae a la descarga normal
    }
    const a = document.createElement("a");
    a.href = viewer.preview;
    a.download = `ticket-${viewer.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const MIN_CROP = 0.06;

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const startCropDrag = (
    photo: TicketPhoto,
    edge: "n" | "s" | "e" | "w",
    e: React.PointerEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setCropActive(photo.id);
    const img = e.currentTarget.parentElement?.querySelector("img");
    const r = img?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    cropDrag.current = {
      photoId: photo.id,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      rect: { left: r.left, top: r.top, w: r.width, h: r.height },
      crop: photo.crop ?? { x: 0, y: 0, w: 1, h: 1 },
    };
  };

  const moveCropDrag = (e: React.PointerEvent) => {
    const d = cropDrag.current;
    if (!d) return;
    const isX = d.edge === "e" || d.edge === "w";
    const v = (isX ? e.clientX : e.clientY) - (isX ? d.rect.left : d.rect.top);
    const vMax = isX ? d.rect.w : d.rect.h;
    const pos = clamp(v / vMax, 0, 1);
    const c = { ...d.crop };
    if (isX) {
      const right = c.x + c.w;
      const a = d.edge === "e" ? right - pos : pos - c.x;
      const aMin = -Math.min(c.x, 1 - right);
      const aa = clamp(a, aMin, (c.w - MIN_CROP) / 2);
      c.x += aa;
      c.w -= 2 * aa;
    } else {
      const bottom = c.y + c.h;
      const a = d.edge === "s" ? bottom - pos : pos - c.y;
      const aMin = -Math.min(c.y, 1 - bottom);
      const aa = clamp(a, aMin, (c.h - MIN_CROP) / 2);
      c.y += aa;
      c.h -= 2 * aa;
    }
    updatePhoto(route.id, d.photoId, { crop: c });
  };

  const endCropDrag = (e: React.PointerEvent) => {
    cropDrag.current = null;
    setCropActive(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

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
                    style={
                      photo.crop
                        ? {
                            clipPath: `inset(${photo.crop.y * 100}% ${
                              (1 - photo.crop.x - photo.crop.w) * 100
                            }% ${(1 - photo.crop.y - photo.crop.h) * 100}% ${
                              photo.crop.x * 100
                            }%)`,
                            transform: `rotate(${photo.rotation ?? 0}deg)`,
                            transition: "transform 0.18s ease",
                          }
                        : {
                            transform: `rotate(${photo.rotation ?? 0}deg)`,
                            transition: "transform 0.18s ease",
                          }
                    }
                  />
                  {cropActive === photo.id && (
                    <div
                      className={styles.cropGuide}
                      style={{
                        top: `${(photo.crop?.y ?? 0) * 100}%`,
                        left: `${(photo.crop?.x ?? 0) * 100}%`,
                        width: `${(photo.crop?.w ?? 1) * 100}%`,
                        height: `${(photo.crop?.h ?? 1) * 100}%`,
                      }}
                    />
                  )}
                  <div
                    className={`${styles.cropEdge} ${styles.cropEdgeN}`}
                    style={{
                      top: `${(photo.crop?.y ?? 0) * 100}%`,
                      left: `${(photo.crop?.x ?? 0) * 100}%`,
                      width: `${(photo.crop?.w ?? 1) * 100}%`,
                    }}
                    onPointerDown={(e) => startCropDrag(photo, "n", e)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div
                    className={`${styles.cropEdge} ${styles.cropEdgeS}`}
                    style={{
                      top: `${((photo.crop?.y ?? 0) + (photo.crop?.h ?? 1)) * 100}%`,
                      left: `${(photo.crop?.x ?? 0) * 100}%`,
                      width: `${(photo.crop?.w ?? 1) * 100}%`,
                    }}
                    onPointerDown={(e) => startCropDrag(photo, "s", e)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div
                    className={`${styles.cropEdge} ${styles.cropEdgeE}`}
                    style={{
                      left: `${((photo.crop?.x ?? 0) + (photo.crop?.w ?? 1)) * 100}%`,
                      top: `${(photo.crop?.y ?? 0) * 100}%`,
                      height: `${(photo.crop?.h ?? 1) * 100}%`,
                    }}
                    onPointerDown={(e) => startCropDrag(photo, "e", e)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div
                    className={`${styles.cropEdge} ${styles.cropEdgeW}`}
                    style={{
                      left: `${(photo.crop?.x ?? 0) * 100}%`,
                      top: `${(photo.crop?.y ?? 0) * 100}%`,
                      height: `${(photo.crop?.h ?? 1) * 100}%`,
                    }}
                    onPointerDown={(e) => startCropDrag(photo, "w", e)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
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
              onChange={(e) =>
                  updateActive(route.id, { phone: normalizePhone(e.target.value) })
                }
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
              <button
                type="button"
                className={`${styles.viewerBtn} ${styles.viewerBtnAccent}`}
                onClick={(e) => {
                  e.stopPropagation();
                  savePhoto();
                }}
                aria-label="Guardar foto"
                title="Guardar foto"
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
              </button>
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