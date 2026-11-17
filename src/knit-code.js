/** Accepted knitting-code tables. Display only — never recomputed. */

import { bedKnitTokens } from "./excel-map.js";
import { stitchForMapCell } from "./readable-map.js";

const BED_CLAUSE = "前床 1（红）一行，换后床新开一行 2（绿）";

export const KNIT_CODE_CAPTION = `${BED_CLAUSE}；空位为 0。列是物理针 0–12。`;

const CODE_NAMES = {
  1: "1 前床平针",
  11: "11 前床短行折返首针",
  2: "2 后床平针",
  12: "12 后床短行折返首针",
};

export const KNIT_CODE_LEGEND = [
  { code: 1, name: CODE_NAMES[1] },
  { code: 2, name: CODE_NAMES[2] },
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

/**
 * Garment-needle columns. Pad and frame columns are not needles.
 * Tables without column roles stay one column per needle.
 */
function garmentColumns(knit) {
  if (Array.isArray(knit?.columns) && knit.columns.length) {
    return knit.columns.filter((col) => Number.isInteger(col.needle));
  }
  const needles = Array.isArray(knit?.needles) ? knit.needles : [];
  return needles.map((needle, needleIndex) => ({ needleIndex, needle }));
}

/**
 * Empty garment cells sit only on physical needle 0, and no body row knits
 * that needle on the back bed. Standrad's back 13 now occupies the empty B0
 * cell, so the test is "never 2 or 12", not "the cell is 0". A tube that
 * knits B0 is not this case, even when pad columns are 0.
 */
function missingBackZero(knit) {
  const garment = garmentColumns(knit);
  if (!garment.length || garment[0].needle !== 0) return false;
  const rows = (knit?.rows || []).filter((row) => row.bind !== false);
  if (!rows.length) return false;
  const onlyAtNeedle0 = rows.every((row) =>
    garment.every((col) => row.cells[col.needleIndex] !== 0 || col.needle === 0),
  );
  const knitsBackZero = rows.some((row) => {
    const code = row.cells[garment[0].needleIndex];
    return code === 2 || code === 12;
  });
  return onlyAtNeedle0 && !knitsBackZero;
}

/** True when this sheet carries copied opening function rails. */
function hasCopiedOpening(knit) {
  return Boolean(knit?.rows?.some((row) => row.functionRails));
}

/**
 * Draft note for Decrease only. 11/12 are the first stitch after a short-row
 * winding reversal, not the first stitch of every visual row. Standrad and
 * Dense captions stay on the shared wording.
 */
const DECREASE_DRAFT_NOTE =
  "移针/翻针未画；短行折返（绕向 ccw↔cw）后，只把新绕向第一行沿行进方向的第一针标成 11（前床 #FF67BD）或 12（后床 #906CB4），其余短行织针仍是 1 或 2。前后床换行不是折返。矫正稿。";

/** Experiment tables use the same omission. They are not the Decrease draft. */
const EXPERIMENT_DRAW_NOTE =
  "移针/翻针未画；短行折返（绕向 ccw↔cw）后，只把新绕向第一行沿行进方向的第一针标成 11（前床 #FF67BD）或 12（后床 #906CB4），其余短行织针仍是 1 或 2。前后床换行不是折返。";

/** Standrad opening sits under the body. Rails on those rows are a template copy. */
export const KNIT_OPENING_NOTE =
  "主体下方是按幅宽适配的开头；开头功能行抄自模板，主体功能行不变。";

/** Caption for this table. Standrad keeps the accepted 0–12 / empty-B0 wording. */
export function knitCodeCaption(knit) {
  const span = needleSpan(knit);
  let caption = `${BED_CLAUSE}。列是物理针 ${span}。`;
  if (hasEmptyCell(knit) && span === "0–12") caption = KNIT_CODE_CAPTION;
  else if (hasEmptyCell(knit)) {
    caption = `${BED_CLAUSE}；空位为 0。列是物理针 ${span}。`;
  }
  if (knit?.model === "Decrease Cylinder") caption += DECREASE_DRAFT_NOTE;
  else if (String(knit?.model || "").includes("实验")) caption += EXPERIMENT_DRAW_NOTE;
  if (hasCopiedOpening(knit)) caption += KNIT_OPENING_NOTE;
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

/** Knitting-code table scale. 1 is the authored cell size. 0.05 is the overview floor. */
export const KNIT_ZOOM_MIN = 0.05;
export const KNIT_ZOOM_MAX = 3;

export function clampKnitZoom(scale) {
  const n = Number(scale);
  if (!Number.isFinite(n)) return 1;
  return Math.min(KNIT_ZOOM_MAX, Math.max(KNIT_ZOOM_MIN, n));
}

/**
 * Scale multiplier for one wheel delta in CSS pixels.
 * Positive deltaY (wheel away / scroll down) zooms out.
 */
export function knitZoomFactor(deltaY) {
  const dy = Number(deltaY);
  if (!Number.isFinite(dy) || dy === 0) return 1;
  return Math.exp(-dy * 0.0016);
}

/**
 * Scroll position that keeps the content point under the cursor after a
 * uniform scale change. viewportOffset is the cursor's distance from the
 * scroller's top or left edge.
 */
export function knitZoomedScroll(scroll, viewportOffset, oldScale, newScale) {
  const from = Number(oldScale);
  const to = Number(newScale);
  const origin = Number(scroll) || 0;
  const offset = Number(viewportOffset) || 0;
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) return origin;
  return (origin + offset) * (to / from) - offset;
}

/** Function-rail pairs on each side of a knitting-code table. */
export const KNIT_FUNCTION_PAIRS = 20;

/** Empty units between a function rail and that table's own knitting code. */
export const KNIT_FUNCTION_GAP = 5;

/** Shown with the table. Named rail cells are filled; unnamed "?" cells stay blank. */
export const KNIT_FUNCTION_RAIL_NOTE = "功能行已按行进方向和床位补全指定格，未指定的问号仍空。";

/**
 * Tiffany display colors for function numbers 1–20.
 * These are DATFile.getDefaultPalette(img_order=True): the file stores pairs
 * swapped, and the preview uses the swapped display order. 1, 2, 11, and 12
 * match the knit-code cells.
 */
export const KNIT_FUNCTION_COLORS = {
  1: "#FF0000",
  2: "#00FF00",
  3: "#FFFF00",
  4: "#0000FF",
  5: "#FF00FF",
  6: "#00FFFF",
  7: "#FFFFFF",
  8: "#4A8999",
  9: "#6C2490",
  10: "#B4B4D8",
  11: "#FF67BD",
  12: "#906CB4",
  13: "#999999",
  14: "#CF90C0",
  15: "#8080FF",
  16: "#51FFDE",
  17: "#5291DB",
  18: "#007C91",
  19: "#EBEB24",
  20: "#B276B2",
  // Same swapped display order for indicator values outside 1–20.
  22: "#FC9463",
  31: "#90D848",
  33: "#A77F01",
  37: "#FF00A0",
  39: "#ACACEB",
  41: "#D84890",
  44: "#D8B4D8",
  51: "#FF9090",
  52: "#C0FF90",
  73: "#B7BCBC",
  81: "#47869C",
  82: "#6DA5B4",
  99: "#7F0000",
  104: "#B2B273",
  105: "#7F7F00",
  107: "#B46C6C",
  116: "#A9E5E7",
  117: "#D8D8B4",
  120: "#90D8FC",
};

function srgbChannel(hex, index) {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  return 0.2126 * srgbChannel(hex, 0) + 0.7152 * srgbChannel(hex, 1) + 0.0722 * srgbChannel(hex, 2);
}

function contrastRatio(fill, ink) {
  const a = relativeLuminance(fill);
  const b = relativeLuminance(ink);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Ink for a function number. Light grounds (yellow, cyan, white, and the other
 * light Tiffany colors) use the dark ink. Dark grounds use white. Pure red
 * uses white, the same ink as knit code 1.
 */
export function knitFunctionTextColor(fill) {
  const hex = String(fill || "").toUpperCase();
  if (hex === "#FF0000") return "#ffffff";
  const dark = "#111111";
  const light = "#ffffff";
  return contrastRatio(hex, dark) >= contrastRatio(hex, light) ? dark : light;
}

/**
 * Columns for one knitting-code table, left to right.
 * The rails mirror around the knitting code.
 * Left pairs are ?n: ?, L20, ?, L19, …, ?, L1. The digit 1 sits against the gap.
 * Then 5 empty units, this table's own needles, 5 empty units.
 * Right pairs are n?: R1, ?, R2, ?, …, R20, ?. The digit 1 sits against the gap.
 * Rails line up across the rows of this table. There is no shared pattern width
 * and no alignment padding after the last needle.
 * The number cell is the pair's 本体. The "?" cell is its 指示.
 * A row with function_rails paints those values. Other rows use knitFunctionValue:
 * L1 and R1 bodies follow the row direction, named indicators are filled, and
 * every unnamed "?" cell stays empty. Pad and frame columns are not needles.
 */
export function knitPatternColumns(knit) {
  if (Array.isArray(knit?.columns) && knit.columns.length) return knit.columns;
  const needles = Array.isArray(knit?.needles) ? knit.needles : [];
  return needles.map((needle, needleIndex) => ({
    needleIndex,
    needle: Number.isInteger(needle) ? needle : null,
    kind: "needle",
    header: Number.isInteger(needle) ? String(needle) : "",
  }));
}

export function knitTableColumns(knit) {
  const columns = [];
  for (let pair = KNIT_FUNCTION_PAIRS; pair >= 1; pair -= 1) {
    columns.push({ role: "function", side: "L", pair, slot: "mark", header: "?" });
    columns.push({ role: "function", side: "L", pair, slot: "number", header: `L${pair}` });
  }
  for (let index = 0; index < KNIT_FUNCTION_GAP; index += 1) {
    columns.push({ role: "gap", side: "left", index, header: "" });
  }
  for (const col of knitPatternColumns(knit)) {
    columns.push({
      role: "pattern",
      needleIndex: col.needleIndex,
      needle: col.needle,
      kind: col.kind || (Number.isInteger(col.needle) ? "needle" : "pad"),
      header: col.header ?? (Number.isInteger(col.needle) ? String(col.needle) : ""),
    });
  }
  for (let index = 0; index < KNIT_FUNCTION_GAP; index += 1) {
    columns.push({ role: "gap", side: "right", index, header: "" });
  }
  for (let pair = 1; pair <= KNIT_FUNCTION_PAIRS; pair += 1) {
    columns.push({ role: "function", side: "R", pair, slot: "number", header: `R${pair}` });
    columns.push({ role: "function", side: "R", pair, slot: "mark", header: "?" });
  }
  return columns;
}

/**
 * Text drawn in a rail cell. Pass the row when the value depends on direction
 * or bed. With no row, L1/R1 have no direction (body 1) and L13/R3 have nothing
 * to read. This is not a knit code.
 */
export function knitRailCellText(column, row) {
  return knitFunctionValue(column, row).text;
}

/**
 * One drawn row. Pattern cells copy the locked matrix. Rail cells copy
 * knitFunctionValue. Gaps and unnamed "?" cells stay empty, and none of them
 * is drawn as knit-code 0.
 */
export function knitTableCells(knit, rowIndex) {
  const row = knit?.rows?.[rowIndex];
  if (!row) return [];
  return knitTableColumns(knit).map((col) => {
    if (col.role !== "pattern") {
      const value = knitFunctionValue(col, row);
      return {
        ...col,
        text: value.text,
        code: null,
        fill: value.fill,
        ink: value.fill ? knitFunctionTextColor(value.fill) : null,
        drawsEmptyNeedle: false,
      };
    }
    const code = row.cells[col.needleIndex];
    const ink = knitCodeInk(code, knit.colors);
    return {
      ...col,
      text: ink.label,
      code,
      fill: ink.fill,
      ink: ink.text,
      drawsEmptyNeedle: code === 0,
    };
  });
}

const LOCKED_COLORS = {
  0: "#000000",
  1: "#FF0000",
  2: "#00FF00",
  11: "#FF67BD",
  12: "#906CB4",
};

function isKnitCode(code) {
  return Number.isInteger(code) && code >= 0;
}

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
  const colors = { ...KNIT_FUNCTION_COLORS, ...LOCKED_COLORS };
  for (const [key, value] of Object.entries(raw)) {
    const code = Number(key);
    if (!isKnitCode(code)) continue;
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
      colors[code] = value.toUpperCase();
    }
  }
  return colors;
}

function patternColumnsFrom(data, width) {
  const roles = Array.isArray(data.column_roles) ? data.column_roles : null;
  let needles = Array.isArray(data.needles) ? data.needles.map((n) => Number(n)) : [];
  if (roles && roles.length === width) {
    const columns = roles.map((role, needleIndex) => {
      if (role === "pad" || role === "frame") {
        return { needleIndex, needle: null, kind: role, header: "" };
      }
      const needle = Number(role);
      if (!Number.isInteger(needle)) return { needleIndex, needle: null, kind: "pad", header: "" };
      return { needleIndex, needle, kind: "needle", header: String(needle) };
    });
    const garment = columns.filter((col) => col.kind === "needle").map((col) => col.needle);
    if (needles.length !== garment.length || needles.some((n, index) => n !== garment[index])) needles = garment;
    return { needles, columns };
  }
  if (needles.length !== width || needles.some((n) => !Number.isInteger(n))) {
    needles = Array.from({ length: width }, (_, i) => i);
  }
  return {
    needles,
    columns: needles.map((needle, needleIndex) => ({
      needleIndex,
      needle,
      kind: "needle",
      header: String(needle),
    })),
  };
}

/** @returns {object|null} Parsed table, or null when the file is not a knitting-code matrix. */
export function parseKnitCode(data) {
  const matrix = data?.matrix;
  if (!Array.isArray(matrix) || matrix.length === 0) return null;
  const width = matrix[0]?.length;
  if (!Number.isInteger(width) || width < 1) return null;
  const rowsOk = matrix.every(
    (row) => Array.isArray(row) && row.length === width && row.every((code) => isKnitCode(code)),
  );
  if (!rowsOk) return null;

  const { needles, columns } = patternColumnsFrom(data, width);
  const labels = Array.isArray(data.row_labels) ? data.row_labels : [];
  const windings = Array.isArray(data.row_winding) ? data.row_winding : [];
  const rails = Array.isArray(data.function_rails) ? data.function_rails : [];
  const binds = Array.isArray(data.row_bind) ? data.row_bind : null;
  const bedRows = Array.isArray(data.bed_row) ? data.bed_row : [];
  const colors = paletteFrom(data);
  return {
    model: typeof data.model === "string" ? data.model : "",
    colors,
    needles,
    columns,
    rows: matrix.map((row, index) => ({
      index,
      label: typeof labels[index] === "string" ? labels[index] : "",
      winding: knitRowWinding(windings[index]),
      cells: row.slice(),
      bind: binds ? binds[index] !== false : true,
      bedRow: Number.isInteger(bedRows[index]) ? bedRows[index] : null,
      functionRails: rails[index] && typeof rails[index] === "object" ? rails[index] : null,
      colors,
    })),
  };
}

export function knitCodeInk(code, colors) {
  const n = Number(code);
  const palette = { ...KNIT_FUNCTION_COLORS, ...LOCKED_COLORS, ...(colors || {}) };
  if (!isKnitCode(n) || n === 0) {
    return { code: 0, fill: palette[0] || LOCKED_COLORS[0], text: "#ffffff", label: "" };
  }
  const fill = palette[n] || "#000000";
  return { code: n, fill, text: knitFunctionTextColor(fill), label: String(n) };
}

export function describeKnitCell(knit, rowIndex, needleIndex) {
  const row = knit?.rows?.[rowIndex];
  if (!row || needleIndex < 0 || needleIndex >= row.cells.length) return "";
  const code = row.cells[needleIndex];
  const column = knit.columns?.[needleIndex];
  const needle = column ? column.needle : knit.needles?.[needleIndex];
  const named = CODE_NAMES[code];
  const value = code === 0 ? "0 空针" : named || String(code);
  if (!Number.isInteger(needle)) {
    const place = column?.kind === "frame" ? "边框" : "空位";
    return `${row.label} · ${place} · ${value}`;
  }
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
  if (!isKnitCode(n) || n === 0) return null;
  const wind = knitRowWinding(winding);
  if (wind == null) return null;
  if (wind === "none") return { kind: "none", text: "操作行，无方向" };
  const bed = knitCodeBed(n);
  // Codes without a bed follow the front-bed reading of this winding.
  const toRight = bed ? (wind === "ccw" ? bed === "F" : bed === "B") : wind === "ccw";
  return toRight
    ? { kind: "right", text: "向右", arrow: "→" }
    : { kind: "left", text: "向左", arrow: "←" };
}

/**
 * Bed of a whole row. Front rows contain only 1 and 11 among their live
 * stitches; back rows contain only 2 and 12. Empty 0 is ignored. A row with
 * no live stitch, or with both beds, has no bed — mixed beds are not a third
 * value.
 */
export function knitRowBed(row) {
  const beds = new Set();
  for (const code of row?.cells || []) {
    const bed = knitCodeBed(code);
    if (bed) beds.add(bed);
  }
  if (beds.size !== 1) return null;
  return beds.has("F") ? "F" : "B";
}

/** True when the row has at least one non-empty stitch. Operation rows do not. */
export function knitRowHasKnitting(row) {
  return (row?.cells || []).some((code) => knitCodeBed(code) != null);
}

/**
 * Displayed travel of a row, the same 向左 / 向右 a live stitch shows on hover.
 * Counterclockwise sends the front bed right and the back bed left; clockwise
 * is the opposite. `none` covers an operation row (row_winding none), a missing
 * winding, and a row whose bed cannot be read.
 */
export function knitRowTravelKind(row) {
  const wind = knitRowWinding(row?.winding);
  const bed = knitRowBed(row);
  if (!wind || wind === "none" || !bed) return "none";
  const travel = knitCellTravel(wind, bed === "F" ? 1 : 2);
  return travel?.kind === "left" || travel?.kind === "right" ? travel.kind : "none";
}

function railPaint(text, fill) {
  return { text: String(text), fill };
}

const RAIL_BLANK = { text: "", fill: null };

/**
 * One function cell. The number slot is the 本体. The "?" slot is the 指示.
 * Only the cells named below change; every other indicator stays empty.
 * L1 and R1 share the row direction: 向右 is 6, 向左 is 7, no direction is 1.
 * L13 follows the bed on knit rows and on operation rows that still have one.
 * R3 is 6 only while the row has knitting. R5 is 1 only when it does not.
 */
function explicitRailValue(column, row) {
  if (column?.role !== "function" || !Number.isInteger(column.pair)) return RAIL_BLANK;
  const bagName = column.slot === "number" ? `${column.side}_body` : column.slot === "mark" ? `${column.side}_ind` : "";
  const bag = bagName ? row.functionRails?.[bagName] : null;
  if (!bag || typeof bag !== "object") return RAIL_BLANK;
  const key = String(column.pair);
  if (!Object.prototype.hasOwnProperty.call(bag, key)) return RAIL_BLANK;
  const raw = bag[key];
  if (raw == null || raw === "") return RAIL_BLANK;
  const n = Number(raw);
  if (!Number.isInteger(n)) return RAIL_BLANK;
  const fill = row.colors?.[n] || KNIT_FUNCTION_COLORS[n] || null;
  return fill ? railPaint(n, fill) : { text: String(n), fill: null };
}

export function knitFunctionValue(column, row) {
  if (row?.functionRails) return explicitRailValue(column, row);
  if (column?.role !== "function" || !Number.isInteger(column.pair)) return RAIL_BLANK;
  const { side, pair, slot } = column;
  if (slot === "number") {
    if (pair === 1) {
      const kind = knitRowTravelKind(row);
      if (kind === "right") return railPaint(6, KNIT_FUNCTION_COLORS[6]);
      if (kind === "left") return railPaint(7, KNIT_FUNCTION_COLORS[7]);
      return railPaint(1, KNIT_FUNCTION_COLORS[1]);
    }
    if (pair >= 2 && pair <= KNIT_FUNCTION_PAIRS) return railPaint(pair, KNIT_FUNCTION_COLORS[pair]);
    return RAIL_BLANK;
  }
  if (slot !== "mark") return RAIL_BLANK;
  if (side === "L" && pair === 7) return railPaint(12, KNIT_FUNCTION_COLORS[12]);
  if (side === "L" && pair === 10) return railPaint(4, KNIT_FUNCTION_COLORS[4]);
  if (side === "L" && pair === 11) return railPaint(14, KNIT_FUNCTION_COLORS[14]);
  if (side === "L" && pair === 13) {
    const bed = knitRowBed(row);
    if (bed === "F") return railPaint(81, KNIT_FUNCTION_COLORS[81]);
    if (bed === "B") return railPaint(82, KNIT_FUNCTION_COLORS[82]);
    return RAIL_BLANK;
  }
  if (side === "R" && pair === 3) return knitRowHasKnitting(row) ? railPaint(6, KNIT_FUNCTION_COLORS[6]) : RAIL_BLANK;
  if (side === "R" && pair === 5) return knitRowHasKnitting(row) ? RAIL_BLANK : railPaint(1, KNIT_FUNCTION_COLORS[1]);
  if (side === "R" && pair === 6) return railPaint(5, KNIT_FUNCTION_COLORS[5]);
  if (side === "R" && pair === 11) return railPaint(1, KNIT_FUNCTION_COLORS[1]);
  return RAIL_BLANK;
}

function columnNeedle(knit, needleIndex) {
  const column = knit?.columns?.[needleIndex];
  if (column) return Number.isInteger(column.needle) ? column.needle : null;
  const phys = knit?.needles?.[needleIndex];
  return Number.isInteger(phys) ? phys : null;
}

function liveKnitCells(knit) {
  const cells = [];
  for (const row of knit?.rows || []) {
    if (row.bind === false) continue;
    const live = [];
    row.cells.forEach((code, needleIndex) => {
      const bed = knitCodeBed(code);
      if (!bed) return;
      const phys = columnNeedle(knit, needleIndex);
      if (!Number.isInteger(phys)) return;
      const travel = knitCellTravel(row.winding, code);
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

function rememberBind(byKey, unmatched, cell, token, bind, stitches, map) {
  const key = `${cell.rowIndex},${cell.needleIndex}`;
  if (!token) {
    unmatched.push({ rowIndex: cell.rowIndex, needleIndex: cell.needleIndex, bed: cell.bed, phys: cell.phys });
    return;
  }
  const stitch = stitchForMapCell(token.row, token.col, bind, stitches, map);
  if (!stitch) {
    unmatched.push({ rowIndex: cell.rowIndex, needleIndex: cell.needleIndex, bed: cell.bed, phys: cell.phys });
    return;
  }
  byKey.set(key, stitch);
}

/**
 * Pair knitting-code cells with stitches already on the bed chart.
 * Without bed_row, tokens stay in carriage order, one queue per bed, so a
 * needle knitted twice in one course (a split row) binds to two stitches in
 * that order. A cell whose next token is a different needle stays unbound.
 * A table that records bed_row looks the stitch up on that sheet row. One
 * sheet row can knit the same bed twice with other needles in between, and
 * the column walk is not that order. 11 binds as front, the same as 1.
 * 12 binds as back, the same as 2. Empty cells and color 13 are not entries.
 * The returned stitch is the growth-map stitch.
 */
export function bindKnitCodeStitches(knit, map, stitches = null, bind = null) {
  const byKey = new Map();
  const unmatched = [];
  const cells = liveKnitCells(knit);
  const tokens = [];
  for (const token of bedKnitTokens(map)) {
    if ((token.bed !== "F" && token.bed !== "B") || !Number.isInteger(token.phys)) continue;
    tokens.push(token);
  }
  const useBedRow = cells.some((cell) => Number.isInteger(knit?.rows?.[cell.rowIndex]?.bedRow));
  if (!useBedRow) {
    const queues = { F: [], B: [] };
    for (const token of tokens) queues[token.bed].push(token);
    const cursor = { F: 0, B: 0 };
    for (const cell of cells) {
      const queue = queues[cell.bed];
      const token = cell.ordered ? queue?.[cursor[cell.bed]] : null;
      if (!cell.ordered || !token || token.phys !== cell.phys) {
        unmatched.push({ rowIndex: cell.rowIndex, needleIndex: cell.needleIndex, bed: cell.bed, phys: cell.phys });
        continue;
      }
      cursor[cell.bed] += 1;
      rememberBind(byKey, unmatched, cell, token, bind, stitches, map);
    }
  } else {
    const buckets = new Map();
    for (const token of tokens) {
      const key = `${token.row},${token.bed},${token.phys}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(token);
      else buckets.set(key, [token]);
    }
    for (const cell of cells) {
      const bedRow = knit.rows[cell.rowIndex]?.bedRow;
      const bucket = Number.isInteger(bedRow) ? buckets.get(`${bedRow},${cell.bed},${cell.phys}`) : null;
      const token = bucket?.length ? bucket.shift() : null;
      rememberBind(byKey, unmatched, cell, token, bind, stitches, map);
    }
  }
  return {
    byKey,
    unmatched,
    knitCells: cells.length,
    bedTokens: tokens.length,
  };
}
