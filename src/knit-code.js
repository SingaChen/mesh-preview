/** Accepted knitting-code tables. Display only — never recomputed. */

export const KNIT_CODE_CAPTION =
  "前床 1（红）一行，换后床新开一行 2（绿）；空位为 0。列是物理针 0–12。";

export const KNIT_CODE_LEGEND = [
  { code: 1, name: "1 前床平针" },
  { code: 2, name: "2 后床平针" },
  { code: 0, name: "0 空针（无B0）" },
];

function needleSpan(knit) {
  const needles = knit?.needles;
  if (!Array.isArray(needles) || needles.length === 0) return "";
  return `${needles[0]}–${needles[needles.length - 1]}`;
}

function hasEmptyCell(knit) {
  return Boolean(knit?.rows?.some((row) => row.cells.includes(0)));
}

/** Empty cells sit only on physical needle 0, so the back bed has no B0. */
function missingBackZero(knit) {
  const needles = knit?.needles;
  if (!needles?.length || needles[0] !== 0) return false;
  return (knit.rows || []).every((row) => row.cells.every((code, index) => code !== 0 || index === 0));
}

/** Caption for this table. Standrad keeps the accepted 0–12 / empty-B0 wording. */
export function knitCodeCaption(knit) {
  const span = needleSpan(knit);
  if (hasEmptyCell(knit) && span === "0–12") return KNIT_CODE_CAPTION;
  if (hasEmptyCell(knit)) {
    return `前床 1（红）一行，换后床新开一行 2（绿）；空位为 0。列是物理针 ${span}。`;
  }
  return `前床 1（红）一行，换后床新开一行 2（绿）。列是物理针 ${span}。`;
}

/** Legend for the codes this table actually uses. Dense has no empty B0. */
export function knitCodeLegend(knit) {
  const front = { code: 1, name: "1 前床平针" };
  const back = { code: 2, name: "2 后床平针" };
  if (!hasEmptyCell(knit)) return [front, back];
  if (missingBackZero(knit) && needleSpan(knit) === "0–12") return KNIT_CODE_LEGEND;
  return [front, back, { code: 0, name: missingBackZero(knit) ? "0 空针（无B0）" : "0 空针" }];
}

/**
 * On-screen order. The parsed matrix stays chronological (index 0 = first ring);
 * the first ring is painted at the bottom and the last course at the top.
 */
export function knitCodeDisplayRows(knit) {
  const rows = knit?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const ordered = new Array(rows.length);
  for (let index = 0; index < rows.length; index++) {
    ordered[rows.length - 1 - index] = { row: rows[index], rowIndex: index };
  }
  return ordered;
}

/** Scroll offset that keeps the first rings, drawn at the bottom, in view. */
export function knitCodeInitialScrollTop(scrollHeight, clientHeight) {
  const height = Number(scrollHeight);
  const view = Number(clientHeight);
  if (!Number.isFinite(height) || !Number.isFinite(view)) return 0;
  return Math.max(0, height - view);
}

const LOCKED_COLORS = {
  0: "#000000",
  1: "#FF0000",
  2: "#00FF00",
};

function paletteFrom(data) {
  const raw = data?.rules?.colors_tiffany_display || data?.colors_tiffany_display || {};
  const colors = { ...LOCKED_COLORS };
  for (const code of [0, 1, 2]) {
    const value = raw[code] ?? raw[String(code)];
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
      colors[code] = value.toUpperCase();
    }
  }
  return colors;
}

/** @returns {object|null} Parsed table, or null when the file is not a knitting-code matrix. */
export function parseKnitCode(data) {
  const matrix = data?.matrix;
  if (!Array.isArray(matrix) || matrix.length === 0) return null;
  const width = matrix[0]?.length;
  if (!Number.isInteger(width) || width < 1) return null;
  const rowsOk = matrix.every(
    (row) =>
      Array.isArray(row) &&
      row.length === width &&
      row.every((code) => code === 0 || code === 1 || code === 2),
  );
  if (!rowsOk) return null;

  let needles = Array.isArray(data.needles) ? data.needles.map((n) => Number(n)) : [];
  if (needles.length !== width || needles.some((n) => !Number.isInteger(n))) {
    needles = Array.from({ length: width }, (_, i) => i);
  }
  const labels = Array.isArray(data.row_labels) ? data.row_labels : [];
  return {
    model: typeof data.model === "string" ? data.model : "",
    colors: paletteFrom(data),
    needles,
    rows: matrix.map((row, index) => ({
      index,
      label: typeof labels[index] === "string" ? labels[index] : "",
      cells: row.slice(),
    })),
  };
}

export function knitCodeInk(code, colors) {
  const n = Number(code);
  const fill = colors?.[n] || LOCKED_COLORS[n] || LOCKED_COLORS[0];
  if (n === 1) return { code: 1, fill, text: "#ffffff", label: "1" };
  if (n === 2) return { code: 2, fill, text: "#111111", label: "2" };
  return { code: 0, fill: colors?.[0] || LOCKED_COLORS[0], text: "#ffffff", label: "" };
}

export function describeKnitCell(knit, rowIndex, needleIndex) {
  const row = knit?.rows?.[rowIndex];
  if (!row || needleIndex < 0 || needleIndex >= row.cells.length) return "";
  const code = row.cells[needleIndex];
  const needle = knit.needles[needleIndex];
  const kind = code === 1 ? "前床平针" : code === 2 ? "后床平针" : "空针";
  const value = code === 0 ? "0 空针" : `${code} ${kind}`;
  return `${row.label} · 物理针 ${needle} · ${value}`;
}
