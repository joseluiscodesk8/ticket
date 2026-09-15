"use client";

import { useRef, useState } from "react";
import styles from "./TicketCapture.module.scss";

const WHATSAPP_NUMBER = "3001377118";

const toBase64 = (file: File) =>
  new Promise<{ base64: string; mediaType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result =
        typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function TicketCapture() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waLink = () => {
    const text = encodeURIComponent(transcription);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setTranscription("");
    setPreview(URL.createObjectURL(file));

    setLoading(true);
    try {
      const { base64, mediaType } = await toBase64(file);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al transcribir");
      setTranscription(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al transcribir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => cameraRef.current?.click()}
        >
          Tomar foto
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => galleryRef.current?.click()}
        >
          Elegir imagen
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview && (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Ticket capturado" />
        </div>
      )}

      {loading && <p className={styles.loading}>Transcribiendo...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {transcription && (
        <div className={styles.result}>
          <h2>Texto transcrito</h2>
          <pre>{transcription}</pre>

          <p className={styles.paid}>¿ya pagó?</p>

          <div className={styles.wa}>
            <a
              href={waLink()}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.waBtn}
            >
              Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
