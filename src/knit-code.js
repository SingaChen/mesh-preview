/** Accepted knitting-code tables. Display only — never recomputed. */

import { bedKnitTokens } from "./excel-map.js";
import { stitchForMapCell } from "./readable-map.js";

const BED_CLAUSE = "前床 1（红）一行，换后床新开一行 2（绿）";
const TURN_CLAUSE = "每次换行后沿行进方向的第一针为 11（前床 #FF67BD）或 12（后床 #906CB4）";

export const KNIT_CODE_CAPTION = `${BED_CLAUSE}；${TURN_CLAUSE}；空位为 0。列是物理针 0–12。`;

const CODE_NAMES = {
  1: "1 前床平针",
  11: "11 前床转向首针",
  2: "2 后床平针",
  12: "12 后床转向首针",
};

export const KNIT_CODE_LEGEND = [
  { code: 1, name: CODE_NAMES[1] },
  { code: 11, name: CODE_NAMES[11] },
  { code: 2, name: CODE_NAMES[2] },
  { code: 12, name: CODE_NAMES[12] },
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

/** Draft note for Decrease only. Standrad and Dense captions stay on the shared wording. */
const DECREASE_DRAFT_NOTE =
  "移针/翻针未画；换行后沿行进方向的第一针为 11 或 12，同一行其余短行折返格仍是 1 或 2。矫正稿。";

/** Caption for this table. Standrad keeps the accepted 0–12 / empty-B0 wording. */
export function knitCodeCaption(knit) {
  const span = needleSpan(knit);
  let caption = `${BED_CLAUSE}；${TURN_CLAUSE}。列是物理针 ${span}。`;
  if (hasEmptyCell(knit) && span === "0–12") caption = KNIT_CODE_CAPTION;
  else if (hasEmptyCell(knit)) {
    caption = `${BED_CLAUSE}；${TURN_CLAUSE}；空位为 0。列是物理针 ${span}。`;
  }
  if (knit?.model === "Decrease Cylinder") caption += DECREASE_DRAFT_NOTE;
  return caption;
}

function codesPresent(knit) {
  const found = new Set();
  for (const row of knit?.rows || []) {
    for (const code of row.cells) found.add(code);
  }
  return found;
}

/** Legend for the codes this table actually uses. Dense has no empty B0. */
export function knitCodeLegend(knit) {
  const found = codesPresent(knit);
  const items = [];
  for (const code of [1, 11, 2, 12]) {
    if (found.has(code)) items.push({ code, name: CODE_NAMES[code] });
  }
  if (!found.has(0)) return items;
  if (missingBackZero(knit) && needleSpan(knit) === "0–12") return KNIT_CODE_LEGEND;
  items.push({ code: 0, name: missingBackZero(knit) ? "0 空针（无B0）" : "0 空针" });
  return items;
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
  11: "#FF67BD",
  12: "#906CB4",
};

const ACCEPTED_CODES = [0, 1, 2, 11, 12];

/** 1 and 11 are front bed. 2 and 12 are back bed. Empty 0 is not a stitch. */
export function knitCodeBed(code) {
  const n = Number(code);
  if (n === 1 || n === 11) return "F";
  if (n === 2 || n === 12) return "B";
  return null;
}

/** Per-row travel. "none" is an operation row. Missing or unknown values are not a direction. */
const ROW_WINDINGS = new Set(["ccw", "cw", "none"]);

export function knitRowWinding(value) {
  return ROW_WINDINGS.has(value) ? value : null;
}

function paletteFrom(data) {
  const raw = data?.rules?.colors_tiffany_display || data?.colors_tiffany_display || {};
  const colors = { ...LOCKED_COLORS };
  for (const code of ACCEPTED_CODES) {
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
      row.every((code) => ACCEPTED_CODES.includes(code)),
  );
  if (!rowsOk) return null;

  let needles = Array.isArray(data.needles) ? data.needles.map((n) => Number(n)) : [];
  if (needles.length !== width || needles.some((n) => !Number.isInteger(n))) {
    needles = Array.from({ length: width }, (_, i) => i);
  }
  const labels = Array.isArray(data.row_labels) ? data.row_labels : [];
  const windings = Array.isArray(data.row_winding) ? data.row_winding : [];
  return {
    model: typeof data.model === "string" ? data.model : "",
    colors: paletteFrom(data),
    needles,
    rows: matrix.map((row, index) => ({
      index,
      label: typeof labels[index] === "string" ? labels[index] : "",
      winding: knitRowWinding(windings[index]),
      cells: row.slice(),
    })),
  };
}

export function knitCodeInk(code, colors) {
  const n = Number(code);
  const fill = colors?.[n] || LOCKED_COLORS[n] || LOCKED_COLORS[0];
  if (n === 1) return { code: 1, fill, text: "#ffffff", label: "1" };
  if (n === 11) return { code: 11, fill, text: "#111111", label: "11" };
  if (n === 2) return { code: 2, fill, text: "#111111", label: "2" };
  if (n === 12) return { code: 12, fill, text: "#111111", label: "12" };
  return { code: 0, fill: colors?.[0] || LOCKED_COLORS[0], text: "#ffffff", label: "" };
}

export function describeKnitCell(knit, rowIndex, needleIndex) {
  const row = knit?.rows?.[rowIndex];
  if (!row || needleIndex < 0 || needleIndex >= row.cells.length) return "";
  const code = row.cells[needleIndex];
  const needle = knit.needles[needleIndex];
  const kind = CODE_NAMES[code]?.replace(/^\d+\s/, "") || "空针";
  const value = code === 0 ? "0 空针" : `${code} ${kind}`;
  return `${row.label} · 物理针 ${needle} · ${value}`;
}

/**
 * Hover travel for one cell.
 * `winding` is that row's own field (`ccw` | `cw` | `none`). The code names the bed
 * only: 1 and 11 are front, 2 and 12 are back, 0 is empty. A row of front stitches
 * can still be clockwise. Counterclockwise sends the front bed right and the back
 * bed left; clockwise is the opposite. Operation rows have no arrow. Empty cells
 * are not stitches and are not operation rows, so they get no direction label.
 * Bottom-up display does not rewrite this: pass the chronological row's winding.
 *
 * @returns {{kind:"left"|"right"|"none", text:string, arrow?:string}|null}
 */
export function knitCellTravel(winding, code) {
  const n = Number(code);
  if (n === 0) return null;
  const bed = knitCodeBed(n);
  const wind = knitRowWinding(winding);
  if (wind == null || !bed) return null;
  if (wind === "none") return { kind: "none", text: "操作行，无方向" };
  const toRight = wind === "ccw" ? bed === "F" : bed === "B";
  return toRight
    ? { kind: "right", text: "向右", arrow: "→" }
    : { kind: "left", text: "向左", arrow: "←" };
}

function liveKnitCells(knit) {
  const cells = [];
  for (const row of knit?.rows || []) {
    const live = [];
    row.cells.forEach((code, needleIndex) => {
      const bed = knitCodeBed(code);
      if (!bed) return;
      const travel = knitCellTravel(row.winding, code);
      const phys = knit.needles?.[needleIndex];
      live.push({
        rowIndex: row.index,
        needleIndex,
        bed,
        phys: Number.isInteger(phys) ? phys : null,
        travel: travel?.kind === "left" || travel?.kind === "right" ? travel.kind : null,
      });
    });
    if (!live.length) continue;
    const kinds = new Set(live.map((cell) => cell.travel));
    if (kinds.size !== 1 || kinds.has(null) || live.some((cell) => cell.phys == null)) {
      for (const cell of live) cells.push({ ...cell, ordered: false });
      continue;
    }
    const dir = live[0].travel;
    live.sort((a, b) =>
      dir === "right" ? a.phys - b.phys || a.needleIndex - b.needleIndex : b.phys - a.phys || b.needleIndex - a.needleIndex,
    );
    for (const cell of live) cells.push({ ...cell, ordered: true });
  }
  return cells;
}

/**
 * Pair knitting-code cells with stitches already on the bed chart.
 * Bed tokens stay in carriage order, one queue per bed, so a needle knitted
 * twice in one course (a split row) binds to two stitches in that order.
 * A cell whose next token is a different needle stays unbound.
 * 11 binds as front bed, the same as 1. 12 binds as back bed, the same as 2.
 * Empty cells are not entries. The returned stitch is the growth-map stitch.
 */
export function bindKnitCodeStitches(knit, map, stitches = null, bind = null) {
  const byKey = new Map();
  const unmatched = [];
  const cells = liveKnitCells(knit);
  const queues = { F: [], B: [] };
  for (const token of bedKnitTokens(map)) {
    if ((token.bed !== "F" && token.bed !== "B") || !Number.isInteger(token.phys)) continue;
    queues[token.bed].push(token);
  }
  const cursor = { F: 0, B: 0 };
  for (const cell of cells) {
    const key = `${cell.rowIndex},${cell.needleIndex}`;
    const queue = queues[cell.bed];
    const token = cell.ordered ? queue?.[cursor[cell.bed]] : null;
    if (!cell.ordered || !token || token.phys !== cell.phys) {
      unmatched.push({ rowIndex: cell.rowIndex, needleIndex: cell.needleIndex, bed: cell.bed, phys: cell.phys });
      continue;
    }
    cursor[cell.bed] += 1;
    const stitch = stitchForMapCell(token.row, token.col, bind, stitches, map);
    if (!stitch) {
      unmatched.push({ rowIndex: cell.rowIndex, needleIndex: cell.needleIndex, bed: cell.bed, phys: cell.phys });
      continue;
    }
    byKey.set(key, stitch);
  }
  return {
    byKey,
    unmatched,
    knitCells: cells.length,
    bedTokens: queues.F.length + queues.B.length,
  };
}
