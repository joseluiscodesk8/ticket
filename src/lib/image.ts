export interface EncodedImage {
  dataUrl: string;
  base64: string;
  mediaType: string;
  bytes: number;
  width: number;
  height: number;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = src;
  });

const readAsDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// Re-codifica la imagen "contain" (sin recortar) al maxDim y calidad elegidos.
// El peso (bytes) es REAL, del blob resultante.
export const encodeImage = async (
  file: File,
  maxDim: number,
  quality: number,
): Promise<EncodedImage> => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no soportado");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir"))),
        "image/jpeg",
        quality,
      ),
    );
    const dataUrl = await readAsDataURL(blob);
    return {
      dataUrl,
      base64: dataUrl.split(",")[1] ?? "",
      mediaType: blob.type || "image/jpeg",
      bytes: blob.size,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Dimensiones reales del archivo original (lo que tomó la cámara).
export const imageFileSize = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
};