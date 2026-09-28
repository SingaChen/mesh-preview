/**
 * 2D grid from readable_map.txt or Singa step3 Excel.
 * Excel look wins for the xls view (legend / XF fills, not Term.Type).
 * Txt leftovers still use token ink; bound txt cells may use Type colors.
 */

import { excelInk, excelLegendKind, isKnitDir, isTransferDir } from "./excel-map.js";
import { bindFaceForMapCell, mapCellsForStitch } from "./stitches.js";

export function tokenKind(token) {
  const t = String(token ?? "");
  if (t === "·" || t === ".") return "knit";
  if (t.startsWith("+")) return "increase";
  if (t.startsWith("-")) return "decrease";
  if (/R/.test(t) && !/L/.test(t)) return "turn-r";
  if (/L/.test(t)) return "turn-l";
  return "other";
}

/** Ink for leftover map cells that have no bound stitch Type. */
export function tokenInk(token) {
  switch (tokenKind(token)) {
    case "knit":
      return { fill: "#8c8c8c", text: "#111318" };
    case "increase":
      return { fill: "#2f8f4e", text: "#f4fff6" };
    case "decrease":
      return { fill: "#c43c3c", text: "#fff4f4" };
    case "turn-r":
      return { fill: "#e8e8e8", text: "#151515" };
    case "turn-l":
      return { fill: "#1a1a1a", text: "#f2f2f2" };
    default:
      return { fill: "#3a4554", text: "#eef2f7" };
  }
}

export function cellFill(cell) {
  if (cell?.source === "excel" || cell?.theme === "excel") {
    return excelInk(cell.kind || excelLegendKind(cell.token, cell.dir), cell.fill);
  }
  const c = cell?.termColor;
  if (c && Number.isFinite(c.r)) {
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    return { fill: `rgb(${r},${g},${b})`, text: lum > 0.55 ? "#151515" : "#f4f4f4" };
  }
  return tokenInk(cell?.token);
}

function emptyExcelGrid(map) {
  return {
    grid: [],
    rowMin: 0,
    rowMax: 0,
    colMin: 0,
    colMax: 0,
    nRows: 0,
    nCols: 0,
    occupied: 0,
    xfers: [],
    header: map?.header || null,
    headerLabel: map?.headerLabel || "dir\\col",
    rows: [],
    source: "excel",
    theme: "excel",
    knitRows: 0,
  };
}

export function buildExcelReadableMapGrid(map) {
  if (!map?.rows?.length) return emptyExcelGrid(map);
  const rowMin = 0;
  const rowMax = map.rows.length - 1;
  const colMin = map.colMin;
  const colMax = map.colMax;
  const nRows = rowMax - rowMin + 1;
  const nCols = colMax - colMin + 1;
  const grid = Array.from({ length: nRows }, () => Array(nCols).fill(null));
  let occupied = 0;
  for (const row of map.rows) {
    for (const cell of row.cells || []) {
      const rr = cell.row - rowMin;
      const cc = cell.col - colMin;
      if (rr < 0 || rr >= nRows || cc < 0 || cc >= nCols) continue;
      if (!grid[rr][cc] && cell.token) occupied += 1;
      grid[rr][cc] = {
        row: cell.row,
        sheetRow: cell.sheetRow,
        col: cell.col,
        token: cell.token,
        dir: cell.dir,
        knitRow: cell.knitRow,
        isKnit: isKnitDir(cell.dir),
        isTransfer: isTransferDir(cell.dir),
        xf: cell.xf,
        fill: cell.fill,
        kind: cell.kind,
        source: "excel",
        stitchIndex: null,
        termType: null,
        termColor: null,
      };
    }
  }
  return {
    grid,
    rowMin,
    rowMax,
    colMin,
    colMax,
    nRows,
    nCols,
    occupied,
    xfers: [],
    header: map.header || null,
    headerLabel: map.headerLabel || "dir\\col",
    rows: map.rows,
    source: "excel",
    theme: "excel",
    knitRows: map.knitRows ?? map.rows.filter((r) => isKnitDir(r.dir)).length,
  };
}

export function buildReadableMapGrid(map, stitches = []) {
  if (map?.source === "excel") return buildExcelReadableMapGrid(map);
  if (!map?.rows?.length) {
    return {
      grid: [],
      rowMin: 0,
      rowMax: 0,
      colMin: 0,
      colMax: 0,
      nRows: 0,
      nCols: 0,
      occupied: 0,
      xfers: [],
      header: map?.header || null,
      rows: [],
      source: "txt",
      theme: "txt",
    };
  }
  const rowMin = map.rowMin;
  const rowMax = map.rowMax;
  const colMin = map.colMin;
  const colMax = map.colMax;
  const nRows = rowMax - rowMin + 1;
  const nCols = colMax - colMin + 1;
  const grid = Array.from({ length: nRows }, () => Array(nCols).fill(null));
  let occupied = 0;
  (map.cells || []).forEach((cell, i) => {
    const rr = cell.row - rowMin;
    const cc = cell.col - colMin;
    if (rr < 0 || rr >= nRows || cc < 0 || cc >= nCols) return;
    const stitch = i < stitches.length ? stitches[i] : null;
    if (!grid[rr][cc]) occupied += 1;
    grid[rr][cc] = {
      row: cell.row,
      col: cell.col,
      token: cell.token,
      dir: cell.dir,
      stitchIndex: stitch?.index ?? i,
      termType: stitch?.termType ?? null,
      termColor: stitch?.termColor ?? null,
      source: "txt",
    };
  });
  return {
    grid,
    rowMin,
    rowMax,
    colMin,
    colMax,
    nRows,
    nCols,
    occupied,
    xfers: map.xfers || [],
    header: map?.header || null,
    rows: map.rows,
    source: "txt",
    theme: "txt",
  };
}

export function cellKey(row, col) {
  return `${row},${col}`;
}

function isExcelView(map, grid) {
  return map?.source === "excel" || grid?.source === "excel" || grid?.theme === "excel";
}

function excelRowDir(grid, displayRow) {
  const meta = grid?.rows?.[displayRow] || grid?.rows?.find((row) => row.row === displayRow);
  return meta?.dir || null;
}

/**
 * Readable_map cells bound to one KnittingStitches face.
 * Excel: only desktop stitch_map_bind.json cells (display_row + needle).
 * Never highlight X / X+ transfer rows. No column-wide fallback.
 * Txt: existing generation-order pairing (cell i ↔ face i) plus row/col.
 */
export function highlightKeysForStitch(stitch, { map = null, grid = null, bind = null } = {}) {
  const keys = new Set();
  if (!stitch) return keys;
  if (isExcelView(map, grid)) {
    const cells = mapCellsForStitch(stitch, bind);
    for (const cell of cells) {
      const row = cell.display_row;
      const col = cell.col;
      if (row == null || col == null) continue;
      const mapped = grid?.grid?.[row - (grid.rowMin || 0)]?.[col - grid.colMin];
      const dir = mapped?.dir || excelRowDir(grid, row);
      if (isTransferDir(dir) || mapped?.isTransfer) continue;
      keys.add(cellKey(row, col));
    }
    return keys;
  }
  if (stitch.row != null && stitch.col != null) keys.add(cellKey(stitch.row, stitch.col));
  const index = Number(stitch.index);
  if (!Number.isFinite(index)) return keys;
  const cell = map?.cells?.[index];
  if (cell?.row != null && cell?.col != null) keys.add(cellKey(cell.row, cell.col));
  const rows = grid?.grid;
  if (!rows) return keys;
  for (const row of rows) {
    for (const mapped of row || []) {
      if (!mapped || mapped.stitchIndex !== index) continue;
      if (mapped.row == null || mapped.col == null) continue;
      keys.add(cellKey(mapped.row, mapped.col));
    }
  }
  return keys;
}

export function highlightKeysFromStitches(stitches, { map = null, grid = null, bind = null } = {}) {
  if (isExcelView(map, grid)) {
    const keys = new Set();
    for (const s of stitches || []) {
      for (const key of highlightKeysForStitch(s, { map, grid, bind })) keys.add(key);
    }
    return keys;
  }
  const keys = new Set();
  for (const s of stitches || []) {
    if (s?.row == null || s?.col == null) continue;
    keys.add(cellKey(s.row, s.col));
  }
  return keys;
}

function findBoundStitch(rec, stitches) {
  if (!rec) return null;
  const list = stitches || [];
  return (
    list.find((s) => s.index === rec.face_index) ||
    list.find(
      (s) =>
        s.path_index != null &&
        s.term_index != null &&
        s.path_index === rec.path_index &&
        s.term_index === rec.term_index,
    ) ||
    null
  );
}

/**
 * Reverse bind: Excel display_row + needle → KnittingStitches face.
 * Any cell of a multi-cell increase span resolves to the same face.
 * Transfer / empty cells have no face.
 */
export function stitchForMapCell(row, col, bind, stitches = null) {
  const rec = bindFaceForMapCell(row, col, bind);
  if (!rec) return null;
  if (Array.isArray(stitches)) return findBoundStitch(rec, stitches);
  return {
    index: rec.face_index,
    face_index: rec.face_index,
    path_index: rec.path_index,
    term_index: rec.term_index,
    mapCells: rec.cells,
  };
}

/** Same keys as clicking the bound stitch face (whole term span). */
export function highlightKeysForMapCell(row, col, { map = null, grid = null, bind = null } = {}) {
  const rec = bindFaceForMapCell(row, col, bind);
  if (!rec) return new Set();
  return highlightKeysForStitch(
    {
      index: rec.face_index,
      path_index: rec.path_index,
      term_index: rec.term_index,
      mapCells: rec.cells,
    },
    { map, grid, bind },
  );
}
