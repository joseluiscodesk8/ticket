export const MODELS = [
  { id: "gemini-3.6-flash", label: "3.6 Flash", short: "3.6" },
  { id: "gemini-3.5-flash", label: "3.5 Flash", short: "3.5" },
  { id: "gemini-3.5-flash-lite", label: "3.5 Flash Lite", short: "3.5L" },
  { id: "gemini-3.1-flash-lite", label: "3.1 Flash Lite", short: "3.1L" },
  { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite", short: "2.5L" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const MODEL_IDS = MODELS.map((m) => m.id) as ModelId[];

export const isModelId = (value: unknown): value is ModelId =>
  typeof value === "string" && (MODEL_IDS as readonly string[]).includes(value);

export const DEFAULT_MODEL: ModelId = "gemini-3.5-flash";

// Cupo de prueba por versión (número editable en el panel).
// Define cuántos tokens "trae" cada versión para ir jugando con la barra.
// Cuando sepas el real, lo pones aquí (o lo editan en el panel) y si llega un
// 429 ya sabes que se acabó y se "rehace" con el reset de esa versión.
export const DEFAULT_MANUAL_QUOTAS: Record<ModelId, number> = {
  "gemini-3.6-flash": 45000,
  "gemini-3.5-flash": 45000,
  "gemini-3.5-flash-lite": 90000,
  "gemini-3.1-flash-lite": 90000,
  "gemini-2.5-flash-lite": 90000,
};