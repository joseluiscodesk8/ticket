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

    const prefixed = upper.match(/^([A-Z]{1,10})(\d.*)$/);
    if (prefixed && STREET_TYPES[prefixed[1]]) {
      out.push(`${STREET_TYPES[prefixed[1]]}${prefixed[2]}`);
      return;
    }

    if (MARKER.test(upper)) {
      out.push("#");
      return;
    }

    if (upper === "N") {
      out.push("#");
      return;
    }

    if (SEPARATOR.test(token) && /\d$/.test(prev)) {
      out.push("#");
      return;
    }

    const cardinal = upper.match(/^(\d+)([EONS])$/);
    if (cardinal) {
      out.push(`${cardinal[1]}${CARDINALS[cardinal[2]]}`);
      return;
    }

    if (/^[A-Z]$/.test(upper) && /\d$/.test(prev)) {
      out[out.length - 1] = prev + (CARDINALS[upper] ?? "");
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
    .join("")
    .toLowerCase()
    .replace(/[.,;:]+\s*$/, "")
    .trim();
};

const STREET_TYPES: Record<string, string> = {
  C: "carrera",
  CRA: "carrera",
  CRAA: "carrera",
  CRRA: "carrera",
  KRA: "carrera",
  KRR: "carrera",
  KR: "carrera",
  CAR: "carrera",
  CR: "carrera",
  CRR: "carrera",
  SR: "carrera",
  CARRERA: "carrera",
  CL: "calle",
  CLL: "calle",
  CLLE: "calle",
  CAL: "calle",
  CALLE: "calle",
  AV: "avenida",
  AVE: "avenida",
  AVD: "avenida",
  AVDA: "avenida",
  AVEN: "avenida",
  AVEND: "avenida",
  AVENIDA: "avenida",
  DG: "diagonal",
  DGO: "diagonal",
  DGNA: "diagonal",
  DGN: "diagonal",
  DGNAL: "diagonal",
  DIAG: "diagonal",
  DIAGONAL: "diagonal",
  TV: "transversal",
  TRA: "transversal",
  TRAV: "transversal",
  TRV: "transversal",
  TRSV: "transversal",
  TRVN: "transversal",
  TRANSV: "transversal",
  TRANSVERSAL: "transversal",
};

const CARDINALS: Record<string, string> = {
  E: "este",
  O: "oeste",
  N: "norte",
  S: "sur",
};

const CARDINAL_WORDS = ["este", "oeste", "norte", "sur"];

const MARKER = /^(#|NO\.?|NRO\.?|NUM\.?|NUMERO|N°|Nº)$/i;

const SEPARATOR = /^[·xX,/—–-]+$/;