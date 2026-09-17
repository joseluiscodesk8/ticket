// Fórmula oficial de Gemini: 258 tokens por cada "tile" de 768x768
// de la imagen enviada (o 258 tokens si es <= 384px).
export function estimateImageTokens(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 0;
  if (width <= 0 || height <= 0) return 0;
  if (width <= 384 && height <= 384) return 258;
  const tilesW = Math.ceil(width / 768);
  const tilesH = Math.ceil(height / 768);
  return tilesW * tilesH * 258;
}

// Tokens fijos del prompt (instrucciones + plantilla).
export const PROMPT_TOKENS = 220;

// Salida esperada (JSON de 3 campos): un rango estimado.
export const OUTPUT_RANGE = { low: 120, high: 260 } as const;

export interface Dims {
  width: number;
  height: number;
}

// Tamaño final tras escalar "contain" con maxDim (sin recortar).
export function containedSize(width: number, height: number, maxDim: number): Dims {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export interface TokenEstimate {
  image: number;
  input: number;
  low: number;
  high: number;
}

// Estimación de una solicitud completa a partir de la imagen FINAL que se enviará.
export function estimateRequestTokens(width: number, height: number): TokenEstimate {
  const image = estimateImageTokens(width, height);
  const input = PROMPT_TOKENS + image;
  return {
    image,
    input,
    low: input + OUTPUT_RANGE.low,
    high: input + OUTPUT_RANGE.high,
  };
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}