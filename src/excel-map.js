/**
 * step3 Excel readable_map (Singa iteration_0_cut_readable_map_step3_xfer.xls).
 * Grid axes, tokens, X/X+ transfer rows, and legend / XF fills — not Term.Type.
 */

import {
  BIFF8_DEFAULT_PALETTE,
  fillCssFromXf,
  findXlsSheet,
  parseXlsWorkbook,
  rgbForIcv,
} from "./xls.js";

export const EXCEL_LEGEND_FILLS = {
  wrap: "rgb(255,204,0)",
  increase: "rgb(204,255,204)",
  "wrap-inc": "rgb(153,204,0)",
  decrease: "rgb(255,153,204)",
  "wrap-dec": "rgb(255,102,0)",
  transfer: "rgb(204,204,255)",
  plain: "rgb(255,255,255)",
  empty: "rgb(192,192,192)",
};

export function isExcelReadableMapName(name) {
  const base = String(name || "")
    .replaceAll("\\", "/")
    .split("/")
    .pop();
  if (!/\.xlsx?$/i.test(base)) return false;
  if (/cols_resample|first_rows/i.test(base)) return false;
  return /readable_map|step3/i.test(base);
}

export function isKnitDir(dir) {
  return dir === "R" || dir === "L";
}

export function isTransferDir(dir) {
  return dir === "X" || dir === "X+";
}

function tokenString(value) {
  if (value == null || value === "") return "";
  return String(value);
}

export function excelLegendKind(token, dir) {
  const t = tokenString(token);
  if (isTransferDir(dir) || /^[←→]\d+$/.test(t)) return "transfer";
  if (/^[v^][LR]-/.test(t)) return "wrap-dec";
  if (/^[v^][LR]$/.test(t)) return "wrap";
  if (/^\+[RL]/.test(t)) return "increase";
  if (/^-[RL]/.test(t)) return "decrease";
  if (t === "·" || t === ".") return "plain";
  if (!t) return "empty";
  return "plain";
}

export function contrastText(fill) {
  const m = String(fill || "").match(/rgb\((\d+),(\d+),(\d+)\)/i);
  if (!m) return "#111318";
  const r = Number(m[1]) / 255;
  const g = Number(m[2]) / 255;
  const b = Number(m[3]) / 255;
  const lum = r * 0.3 + g * 0.59 + b * 0.11;
  return lum > 0.55 ? "#111318" : "#f4f4f4";
}

export function excelInk(kind, fill) {
  const resolved = fill || EXCEL_LEGEND_FILLS[kind] || EXCEL_LEGEND_FILLS.plain;
  return { fill: resolved, text: contrastText(resolved) };
}

function headerNeedles(headerRow) {
  const cols = [];
  for (let c = 1; c < headerRow.length; c++) {
    const n = Number(headerRow[c]);
    if (!Number.isFinite(n)) continue;
    cols.push({ sheetCol: c, needle: n });
  }
  return cols;
}

function sheetXfFill(sheet, styles, r, c) {
  const xfIndex = sheet.xfRows?.[r]?.[c];
  if (xfIndex == null) return { xf: null, fill: null };
  const xf = styles?.xf?.[xfIndex] || null;
  return { xf: xfIndex, fill: fillCssFromXf(xf, styles?.palette) };
}

function parseLegendSheet(sheet) {
  const rows = [];
  for (const row of sheet?.rows || []) {
    const key = tokenString(row?.[0]);
    const note = tokenString(row?.[1]);
    if (!key && !note) continue;
    rows.push({ key, note });
  }
  return rows;
}

export function parseExcelReadableMap(data, { workbook } = {}) {
  const book = workbook || parseXlsWorkbook(data);
  const step =
    findXlsSheet(book, "step3") ||
    findXlsSheet(book, (s) => /step\s*3/i.test(s.name)) ||
    book.sheets.find((s) => tokenString(s.rows?.[0]?.[0]).includes("dir"));
  if (!step?.rows?.length) {
    throw new Error("xls: missing step3 readable_map sheet");
  }
  const styles = book.styles || { xf: [], palette: BIFF8_DEFAULT_PALETTE };
  const headerRow = step.rows[0] || [];
  const headerLabel = tokenString(headerRow[0]) || "dir\\col";
  const needles = headerNeedles(headerRow);
  if (!needles.length) {
    throw new Error("xls: step3 header has no needle columns");
  }
  const colMin = Math.min(...needles.map((n) => n.needle));
  const colMax = Math.max(...needles.map((n) => n.needle));
  const legend = parseLegendSheet(findXlsSheet(book, "legend"));

  const rows = [];
  const cells = [];
  let knitRow = 0;
  for (let r = 1; r < step.rows.length; r++) {
    const raw = step.rows[r] || [];
    const xfRow = step.xfRows?.[r] || [];
    const dir = tokenString(raw[0]);
    if (!dir) continue;
    const knit = isKnitDir(dir) ? knitRow : null;
    if (isKnitDir(dir)) knitRow += 1;
    const rowCells = [];
    for (const { sheetCol, needle } of needles) {
      const token = tokenString(raw[sheetCol]);
      const { xf, fill } = sheetXfFill(step, styles, r, sheetCol);
      const kind = excelLegendKind(token, dir);
      const resolvedFill = fill || EXCEL_LEGEND_FILLS[kind] || null;
      const cell = {
        row: rows.length,
        sheetRow: r,
        col: needle,
        token,
        dir,
        knitRow: knit,
        xf,
        fill: resolvedFill,
        kind,
        source: "excel",
      };
      rowCells.push(cell);
      if (token || xfRow[sheetCol] != null) cells.push(cell);
    }
    rows.push({
      row: rows.length,
      sheetRow: r,
      dir,
      knitRow: knit,
      cells: rowCells,
    });
  }

  return {
    source: "excel",
    theme: "excel",
    sheet: step.name,
    headerLabel,
    needleCols: needles.map((n) => n.needle),
    rows,
    cells,
    header: {
      rows: rows.length,
      cells: cells.filter((c) => c.token).length,
      sheet: step.name,
      colMin,
      colMax,
    },
    legend,
    styles,
    xfers: [],
    rowMin: 0,
    rowMax: Math.max(0, rows.length - 1),
    colMin,
    colMax,
    knitRows: knitRow,
  };
}

/** Generation-order fallback when no txt companion exists. Skip X/X+. */
export function excelMapAsBindMap(map) {
  const cells = [];
  const knitRows = [];
  for (const row of map?.rows || []) {
    if (!isKnitDir(row.dir)) continue;
    const occupied = row.cells.filter((c) => c.token);
    const ordered =
      row.dir === "L"
        ? [...occupied].sort((a, b) => b.col - a.col)
        : [...occupied].sort((a, b) => a.col - b.col);
    const tokens = [];
    for (const c of ordered) {
      tokens.push(c.token);
      cells.push({
        row: row.knitRow,
        col: c.col,
        token: c.token,
        dir: row.dir,
      });
    }
    knitRows.push({
      row: row.knitRow,
      dir: row.dir === "L" ? "L" : "R",
      colStart: occupied.length ? Math.min(...occupied.map((c) => c.col)) : 0,
      colEnd: occupied.length ? Math.max(...occupied.map((c) => c.col)) : 0,
      tokens,
    });
  }
  const cols = cells.map((c) => c.col);
  return {
    source: "excel-bind",
    rows: knitRows,
    cells,
    header: map?.header || null,
    xfers: [],
    rowMin: knitRows.length ? 0 : 0,
    rowMax: knitRows.length ? knitRows.length - 1 : 0,
    colMin: cols.length ? Math.min(...cols) : map?.colMin || 0,
    colMax: cols.length ? Math.max(...cols) : map?.colMax || 0,
  };
}

export function namedExcelColorRgb(name) {
  switch (String(name || "").toLowerCase()) {
    case "gold":
      return rgbForIcv(51);
    case "green":
    case "light_green":
      return rgbForIcv(42);
    case "lime":
      return rgbForIcv(50);
    case "rose":
      return rgbForIcv(45);
    case "orange":
      return rgbForIcv(53);
    case "ice_blue":
    case "iceblue":
      return rgbForIcv(31);
    default:
      return null;
  }
}
