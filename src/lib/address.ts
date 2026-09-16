export const normalizeAddress = (raw: string): string => {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  const tokens = s.split(" ").filter(Boolean);

  const out: string[] = [];

  tokens.forEach((token, i) => {
    const upper = token.toUpperCase().replace(/[.,;]+$/, "");
    const prev = out[out.length - 1] ?? "";

    if (i === 0 && STREET_TYPES[upper]) {
      out.push(STREET_TYPES[upper]);
      return;
    }

    if (MARKER.test(upper)) {
      out.push("#");
      return;
    }

    const cardinal = upper.match(/^(\d+)([EONS])$/);
    if (cardinal) {
      out.push(`${cardinal[1]} ${CARDINALS[cardinal[2]]}`);
      return;
    }

    if (/^[A-Z]$/.test(upper) && /\d$/.test(prev)) {
      out[out.length - 1] = CARDINALS[upper] ?? prev + upper;
      return;
    }

    if (
      /^\d$/.test(token) &&
      /^\d$/.test(prev) &&
      out.length > 1 &&
      out[out.length - 2] === "#"
    ) {
      out[out.length - 1] = prev + token;
      return;
    }

    if (/^\d+$/.test(token) && /^\d+$/.test(prev) && (token.length === 1 || prev.length === 1)) {
      out[out.length - 1] = prev + token;
      return;
    }

    out.push(token);
  });

  if (!out.includes("#")) {
    const firstNum = out.findIndex((t) => /^\d/.test(t));
    if (firstNum !== -1) {
      let i = firstNum + 1;
      while (i < out.length && CARDINAL_WORDS.includes(out[i])) i++;
      let j = i;
      while (j < out.length && !/^\d/.test(out[j])) j++;
      if (j < out.length) out.splice(j, 0, "#");
    }
  }

  if (out.includes("#")) {
    const hash = out.indexOf("#");
    const tail = out.slice(hash + 1);
    const merged = tail.reduce<string[]>((acc, t) => {
      const last = acc[acc.length - 1] ?? "";
      if (/^\d+$/.test(t) && /^\d+$/.test(last)) {
        acc[acc.length - 1] = last + t;
        return acc;
      }
      acc.push(t);
      return acc;
    }, []);
    out.splice(hash + 1, tail.length, ...merged);
  }

  return out
    .join(" ")
    .replace(/\s*#\s*/g, " # ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+\s*$/, "")
    .trim();
};

const STREET_TYPES: Record<string, string> = {
  C: "Carrera",
  CRA: "Carrera",
  KRA: "Carrera",
  KR: "Carrera",
  CAR: "Carrera",
  CR: "Carrera",
  CL: "Calle",
  CLL: "Calle",
  CALLE: "Calle",
  AV: "Avenida",
  AVE: "Avenida",
  AVD: "Avenida",
  AVDA: "Avenida",
  DG: "Diagonal",
  DIAG: "Diagonal",
  TV: "Transversal",
  TRA: "Transversal",
  TRV: "Transversal",
  TRANSV: "Transversal",
};

const CARDINALS: Record<string, string> = {
  E: "Este",
  O: "Oeste",
  N: "Norte",
  S: "Sur",
};

const CARDINAL_WORDS = ["Este", "Oeste", "Norte", "Sur"];

const MARKER = /^(#|NO\.?|NRO\.?|NUM\.?|NUMERO|N°|Nº)$/i;