/**
 * 2D grid built from the exported readable_map.txt.
 * Tokens stay as written (· / [R / -R2 / …). Bound stitch Type colors
 * win when a cell is one of the 475 generation-order faces; leftover
 * map-only cells use token ink, not invented Term.Type.
 */

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

export function buildReadableMapGrid(map, stitches = []) {
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
    header: map.header || null,
    rows: map.rows,
  };
}

export function cellKey(row, col) {
  return `${row},${col}`;
}

export function highlightKeysFromStitches(stitches) {
  const keys = new Set();
  for (const s of stitches || []) {
    if (s?.row == null || s?.col == null) continue;
    keys.add(cellKey(s.row, s.col));
  }
  return keys;
}

/**
 * Readable_map cells bound to one KnittingStitches face.
 * Uses the existing generation-order pairing (cell i ↔ face i) plus
 * stitch.row/col from bindStitchesToMap. If several cells share that
 * stitchIndex, all of them light up. Does not invent extra pairings.
 */
export function highlightKeysForStitch(stitch, { map = null, grid = null } = {}) {
  const keys = new Set();
  if (!stitch) return keys;
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
