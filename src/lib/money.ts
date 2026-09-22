export const NOTE_PAYED = "ya pagó";
export const NOTE_NOT_PAY = "no paga";
export const NOTE_PHRASES: string[] = [NOTE_PAYED, NOTE_NOT_PAY];

export const isNotePhrase = (value: string): boolean =>
  NOTE_PHRASES.includes(value.trim().toLowerCase());

export const parseAmount = (raw: string): number => {
  const s = raw.replace(/[^0-9.,]/g, "");
  if (!s) return NaN;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    const sep = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const normalized = s
      .split("")
      .map((c) => (c === "." || c === "," ? (c === sep ? sep : "") : c))
      .join("");
    return parseFloat(normalized);
  }

  const sepChar = hasDot ? "." : ",";
  if (sepChar) {
    const decimals = s.length - s.lastIndexOf(sepChar) - 1;
    if (decimals === 3) {
      return parseInt(s.replaceAll(sepChar, ""), 10);
    }
    return parseFloat(s);
  }

  return parseInt(s, 10);
};

export const formatCOP = (n: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);