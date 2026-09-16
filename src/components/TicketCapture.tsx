"use client";

import { useRef, useState } from "react";
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
} from "./icons";
import { normalizeAddress } from "@/lib/address";

const WHATSAPP_NUMBER = "3001377118";

const MISSING = {
  address: "No hay dirección",
  phone: "No hay celular",
  price: "No hay precio",
} as const;

const toBase64 = (blob: Blob) =>
  new Promise<{ base64: string; mediaType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result =
        typeof reader.result === "string" ? reader.result : "";
      resolve({ base64: result.split(",")[1] ?? "", mediaType: blob.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const compressImage = (file: File, maxDim = 1200, quality = 0.85) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas no soportado"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });

export default function TicketCapture({ route }: { route: Route }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  // Galería deshabilitada por ahora
  // const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);

  const addPhotos = useRoutesStore((s) => s.addPhotos);
  const setActiveIndex = useRoutesStore((s) => s.setActiveIndex);
  const updateActive = useRoutesStore((s) => s.updateActive);

  const active = route.photos[route.activeIndex];

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setPhoneMenuOpen(false);
    setPriceMenuOpen(false);
    try {
      const added = await Promise.all(
        Array.from(files).map(async (file) => ({
          id: crypto.randomUUID(),
          file,
          preview: await compressImage(file),
          address: "",
          phone: "",
          price: "",
        })),
      );
      addPhotos(route.id, added);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer la imagen");
    }
  };

  const getPayload = async (photo: TicketPhoto) => {
    if (photo.file) {
      return toBase64(photo.file);
    }
    const [head, base64] = photo.preview.split(",");
    const mediaType = head.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
    return { base64: base64 ?? "", mediaType };
  };

  const transcribeActive = async () => {
    if (!active || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { base64, mediaType } = await getPayload(active);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al transcribir");
      updateActive(route.id, {
        address: normalizeAddress(data.address ?? ""),
        phone: data.phone ?? "",
        price: data.price ?? "",
      });
    } catch (e) {
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.slideImg}
                  src={photo.preview}
                  alt={`Ticket ${i + 1}`}
                />
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

          {error && <p className={styles.error}>{error}</p>}
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
            <a
              href={mapsLink()}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!active?.address}
              title="Abrir en Google Maps"
              className={`${styles.actBtn} ${
                !active?.address ? styles.actBtnDisabled : ""
              }`}
            >
              <PinIcon />
            </a>
          </div>
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
                active?.payment === "E"
                  ? "Efectivo"
                  : active?.payment === "T"
                    ? "Transferencia"
                    : "Marcar pago"
              }
              className={`${styles.actBtn} ${
                priceMenuOpen ? styles.actBtnActive : ""
              } ${
                active?.payment === "E"
                  ? styles.actBtnCash
                  : active?.payment === "T"
                    ? styles.actBtnTransfer
                    : ""
              }`}
              onClick={() => setPriceMenuOpen((v) => !v)}
            >
              {active?.payment === "E" ? (
                <BillIcon />
              ) : active?.payment === "T" ? (
                "T"
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
                <button
                  type="button"
                  onClick={() => {
                    updateActive(route.id, { payment: "T" });
                    setPriceMenuOpen(false);
                  }}
                  aria-label="Transferencia"
                  title="Transferencia"
                >
                  T
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateActive(route.id, { payment: "E" });
                    setPriceMenuOpen(false);
                  }}
                  aria-label="Efectivo"
                  title="Efectivo"
                >
                  <BillIcon />
                </button>
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
    </div>
  );
}