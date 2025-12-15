// src/utils/numbers.js
// Conversión segura de valores numéricos en forma de string a Number o fallback a string

export const toNumberOrString = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.').trim();
  const n = Number(s);
  return Number.isNaN(n) ? String(v) : n;
};

