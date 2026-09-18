/**
 * SingaLab knitting-stitch faces + readable_map.
 *
 * Mapping (investigated on Single_Cylinder_Test 2026-09-16):
 * - KnittingStitches.obj lists one n-gon per stitch in generation order
 *   (first 21 faces are the base ring / row000, 21 needles on this dump).
 * - Vertex colours: gray 0.55 = normal, red = special/highlight, plus
 *   black/white/green/yellow/blue markers. Faces reuse copied verts.
 * - readable_map.txt walks the same generation order: each token
 *   (including the leftover "-" after a -R2 decrease) is one stitch
 *   cell with an explicit row id and needle column.
 * - The 2D map prefers iteration_*_readable_map_step4_beds.xls (step4
 *   sheet: dir\\col × needles, R/L/X/X+/Flip rows, F/B prefixes,
 *   absolute ←L1/→R1, Excel legend fills). Falls back to step3 xfer.
 *   Do not color that view from Term.Type. Stitch chip col/row still
 *   come from the txt companion when present; highlight binds by
 *   needle + knit-row, not generation-order onto X rows.
 * - This dump has 475 faces vs more map tokens (header 479 cells): leftover
 *   tokens are the last short rows with no stitch geometry. Do not invent
 *   rows; unmatched faces/cells stay unbound.
 * - Mobile faces_ring / row slider is per first_row face ring, not
 *   readable_map rowNNN (those are machine/carriage rows after
 *   readable_map_generate expands path terms; 65 on this dump).
 * - first_rows.xls is transposed: header col\\row, row_0..row_{n-1}.
 *   N_seed = ncols-1 (6 here). path_generate skips seed index 0, so
 *   slider N = N_seed-1 (5 first_row rings). Do not use 65 or 6 as N.
 * - faces_ring_layout.json { rings[].n_terms, types[], term_face_colors,
 *   edge_color } slices KnittingStitches in OBJ / generation order.
 *   Cylinder dump after knittingMapGenerate_Auto: 46, 136, 110, 106, 77
 *   (sum 475). Color only from rings[].types → term_face_colors.
 *   Missing Type is an error — never infer from vertex colours or fill
 *   default pink/white. Without a sidecar, faces split evenly and stay
 *   untyped.
 * - first_rows.xls / cols_resample.xls describe resampled field polylines.
 *   Desktop slider N is len(cols_resample) after extractRows (42 on this
 *   cylinder dump). Parse xls points_detail by col id 0..N-1, or sequential
 *   (i,i+1) chains in field.obj. Do not invent SHORT_* parent merges.
 */

import { findXlsSheet, parseXlsWorkbook } from "./xls.js";

const MANIFEST_PATH_KEYS = [
  "mesh",
  "obj",
  "path",
  "overlay",
  "field",
  "colsResample",
  "cols_resample",
  "colsResampleXls",
  "cols_resample_xls",
  "colsResampleJson",
  "cols_resample_json",
  "stitches",
  "stitch",
  "readableMap",
  "map",
  "readableMapTxt",
  "readable_map_txt",
  "firstRows",
  "first_rows",
  "facesRingLayout",
  "faces_ring_layout",
  "stitchMapBind",
  "stitch_map_bind",
];

export function collectManifestRefs(data) {
  const paths = new Set();
  for (const out of data.outputs || []) {
    if (!out || typeof out !== "object") continue;
    for (const key of MANIFEST_PATH_KEYS) {
      if (typeof out[key] === "string" && out[key]) paths.add(out[key]);
    }
  }
  return [...paths];
}

export function parseColoredObj(text) {
  const verts = [];
  const faces = [];
  const lines = [];

  for (const raw of String(text).split(/\r?\n/)) {
    if (raw.startsWith("v ")) {
      const n = raw.trim().split(/\s+/).slice(1).map(Number);
      verts.push({
        x: n[0],
        y: n[1],
        z: n[2],
        r: n.length >= 6 ? n[3] : null,
        g: n.length >= 6 ? n[4] : null,
        b: n.length >= 6 ? n[5] : null,
      });
    } else if (raw.startsWith("f ")) {
      const idx = raw
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => Number(t.split("/")[0]) - 1)
        .filter((i) => i >= 0 && i < verts.length);
      if (idx.length >= 3) {
        faces.push({
          indices: idx,
          verts: idx.map((i) => verts[i]),
        });
      }
    } else if (raw.startsWith("l ")) {
      const idx = raw
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => Number(t.split("/")[0]) - 1)
        .filter((i) => i >= 0 && i < verts.length);
      if (idx.length >= 2) lines.push(idx);
    }
  }

  return { verts, faces, lines };
}

export function parseReadableMapHeader(text) {
  const m = String(text).match(
    /readable_map:\s*(\d+)\s*rows,\s*(\d+)\s*cells(?:\s+circle=(\d+)\s+front=(\d+)\s+back=(\d+))?/i,
  );
  if (!m) return null;
  return {
    rows: Number(m[1]),
    cells: Number(m[2]),
    circle: m[3] != null ? Number(m[3]) : null,
    front: m[4] != null ? Number(m[4]) : null,
    back: m[5] != null ? Number(m[5]) : null,
  };
}

export function parseReadableMapXfers(text) {
  const xfers = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(\+)?xfer(\d+)\.(\d+):\s*(.*)$/i);
    if (!m) continue;
    const moves = [];
    for (const tok of m[4].trim().split(/\s+/).filter(Boolean)) {
      const tm = tok.match(/^([←→])(\d+)@(-?\d+)$/);
      if (!tm) continue;
      moves.push({
        dir: tm[1] === "→" ? 1 : -1,
        count: Number(tm[2]),
        col: Number(tm[3]),
        raw: tok,
      });
    }
    xfers.push({
      plus: Boolean(m[1]),
      row: Number(m[2]),
      index: Number(m[3]),
      moves,
    });
  }
  return xfers;
}

export function parseReadableMap(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*row(\d+)\s+dir=([RL])\s+col\[(-?\d+)\.\.(-?\d+)\](.*)$/);
    if (!m) continue;
    const rest = m[5];
    const tokenPart = rest.includes(":") ? rest.slice(rest.indexOf(":") + 1) : "";
    const tokens = tokenPart.trim().split(/\s+/).filter(Boolean);
    rows.push({
      row: Number(m[1]),
      dir: m[2],
      colStart: Number(m[3]),
      colEnd: Number(m[4]),
      tokens,
    });
  }

  const cells = [];
  for (const r of rows) {
    const cols = [];
    for (let c = r.colStart; c <= r.colEnd; c++) cols.push(c);
    r.tokens.forEach((token, i) => {
      cells.push({
        row: r.row,
        col: cols.length ? cols[Math.min(i, cols.length - 1)] : r.colStart,
        token,
        dir: r.dir,
      });
    });
  }

  const rowIds = rows.map((r) => r.row);
  const colStarts = rows.map((r) => r.colStart);
  const colEnds = rows.map((r) => r.colEnd);
  const cellCols = cells.map((c) => c.col);
  const allCols = [...colStarts, ...colEnds, ...cellCols];
  return {
    rows,
    cells,
    header: parseReadableMapHeader(text),
    xfers: parseReadableMapXfers(text),
    rowMin: rowIds.length ? Math.min(...rowIds) : 0,
    rowMax: rowIds.length ? Math.max(...rowIds) : 0,
    colMin: allCols.length ? Math.min(...allCols) : 0,
    colMax: allCols.length ? Math.max(...allCols) : 0,
  };
}

export function faceCentroid(face) {
  const n = face.verts.length || 1;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const v of face.verts) {
    x += v.x;
    y += v.y;
    z += v.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

export function bindStitchesToMap(faces, map) {
  const cells = map?.cells || [];
  const stitches = faces.map((face, index) => {
    const cell = cells[index] || null;
    return {
      index,
      verts: face.verts,
      centroid: faceCentroid(face),
      row: cell ? cell.row : null,
      col: cell ? cell.col : null,
      token: cell ? cell.token : null,
      dir: cell ? cell.dir : null,
      path_index: null,
      term_index: null,
      mapCells: [],
    };
  });

  const bound = stitches.filter((s) => s.row != null);
  const cols = [...new Set(bound.map((s) => s.col))].sort((a, b) => a - b);
  const rows = bound.map((s) => s.row);
  return {
    stitches,
    columns: cols,
    rowMin: rows.length ? Math.min(...rows) : 0,
    rowMax: rows.length ? Math.max(...rows) : 0,
    unboundFaces: stitches.length - bound.length,
    leftoverCells: Math.max(0, cells.length - faces.length),
  };
}

function asIntOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeBindCell(cell) {
  if (!cell || typeof cell !== "object") return null;
  const display_row = asIntOrNull(cell.display_row ?? cell.row);
  const col = asIntOrNull(cell.col);
  if (display_row == null || col == null) return null;
  return {
    display_row,
    col,
    label: cell.label != null ? String(cell.label) : "",
  };
}

function uniqueBindCells(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const cell = normalizeBindCell(raw);
    if (!cell) continue;
    const key = `${cell.display_row},${cell.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

/**
 * Desktop generate_step3_xfer + _display_lines dump.
 * face_index is row-major over path_list rings (same as KnittingStitches.obj).
 * Transfer X / X+ cells are not listed on faces (path_index=term_index=-1).
 */
export function parseStitchMapBind(data) {
  if (data == null || data === "") return null;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.faces)) return null;
  const byIndex = new Map();
  const faces = [];
  for (const raw of parsed.faces) {
    if (!raw || typeof raw !== "object") continue;
    const face_index = asIntOrNull(raw.face_index);
    if (face_index == null) continue;
    const rec = {
      face_index,
      path_index: asIntOrNull(raw.path_index),
      term_index: asIntOrNull(raw.term_index),
      term_type: raw.term_type,
      cells: uniqueBindCells(raw.cells),
      n_cells: asIntOrNull(raw.n_cells) ?? uniqueBindCells(raw.cells).length,
    };
    faces.push(rec);
    byIndex.set(face_index, rec);
  }
  const termToCells = {};
  const rawTerms = parsed.term_to_cells || parsed.termToCells || {};
  if (rawTerms && typeof rawTerms === "object") {
    for (const [key, cells] of Object.entries(rawTerms)) {
      termToCells[key] = uniqueBindCells(cells);
    }
  }
  const display_rows = Array.isArray(parsed.display_rows) ? parsed.display_rows : [];
  const byPathTerm = new Map();
  const byCell = new Map();
  const rememberCell = (row, col, rec) => {
    if (row == null || col == null || !rec) return;
    const key = `${row},${col}`;
    if (!byCell.has(key)) byCell.set(key, rec);
  };
  for (const rec of faces) {
    if (rec.path_index != null && rec.term_index != null && rec.path_index >= 0 && rec.term_index >= 0) {
      byPathTerm.set(`${rec.path_index},${rec.term_index}`, rec);
    }
    for (const cell of rec.cells) rememberCell(cell.display_row, cell.col, rec);
  }
  for (const [key, cells] of Object.entries(termToCells)) {
    const rec = byPathTerm.get(key);
    if (!rec) continue;
    for (const cell of cells) rememberCell(cell.display_row, cell.col, rec);
  }
  for (const row of display_rows) {
    if (row?.is_transfer || row?.is_knit === false) continue;
    if (row?.dir === "X" || row?.dir === "X+") continue;
    const display_row = asIntOrNull(row.display_row);
    if (display_row == null) continue;
    for (const cell of row.cells || []) {
      if (cell?.bindable === false) continue;
      const path_index = asIntOrNull(cell.path_index);
      const term_index = asIntOrNull(cell.term_index);
      if (path_index == null || term_index == null || path_index < 0 || term_index < 0) continue;
      const rec = byPathTerm.get(`${path_index},${term_index}`);
      if (!rec) continue;
      rememberCell(display_row, asIntOrNull(cell.col), rec);
    }
  }
  return {
    source: parsed.source || "stitch_map_bind",
    n_faces: asIntOrNull(parsed.n_faces) ?? faces.length,
    n_display_rows: asIntOrNull(parsed.n_display_rows),
    n_knit_rows: asIntOrNull(parsed.n_knit_rows),
    n_xfer_rows: asIntOrNull(parsed.n_xfer_rows),
    n_unbound_faces: asIntOrNull(parsed.n_unbound_faces) ?? 0,
    n_multi_cell_terms: asIntOrNull(parsed.n_multi_cell_terms),
    display_rows,
    faces,
    byIndex,
    byPathTerm,
    byCell,
    termToCells,
  };
}

/** Reverse: Excel `${display_row},${col}` → bind face. Built once in parseStitchMapBind. */
export function bindFaceForMapCell(row, col, bind) {
  if (!bind || row == null || col == null) return null;
  const key = `${Number(row)},${Number(col)}`;
  const indexed = bind.byCell?.get(key);
  if (indexed) return indexed;
  for (const rec of bind.faces || []) {
    if (rec.cells?.some((cell) => cell.display_row === row && cell.col === col)) return rec;
  }
  return null;
}

export function mapCellsForStitch(stitch, bind = null) {
  if (Array.isArray(stitch?.mapCells) && stitch.mapCells.length) {
    return stitch.mapCells;
  }
  const index = Number(stitch?.index);
  const rec =
    (Number.isFinite(index) && bind?.byIndex?.get(index)) ||
    (Number.isFinite(index) ? bind?.faces?.find((f) => f.face_index === index) : null);
  if (!rec) return [];
  if (rec.cells?.length) return rec.cells;
  const key = `${rec.path_index},${rec.term_index}`;
  return bind?.termToCells?.[key] || [];
}

/**
 * Annotate KnittingStitches faces from desktop stitch_map_bind.json.
 * Does not invent Term.Type or rematch by geometry.
 */
export function applyStitchMapBind(stitches, bind) {
  const list = stitches || [];
  if (!bind?.byIndex && !bind?.faces?.length) return list;
  for (const stitch of list) {
    const rec = bind.byIndex?.get(stitch.index) || bind.faces?.find((f) => f.face_index === stitch.index);
    if (!rec) {
      stitch.path_index = null;
      stitch.term_index = null;
      stitch.mapCells = [];
      continue;
    }
    const fromTerm =
      rec.path_index != null && rec.term_index != null
        ? bind.termToCells?.[`${rec.path_index},${rec.term_index}`]
        : null;
    const cells = uniqueBindCells([...(rec.cells || []), ...(fromTerm || [])]);
    stitch.path_index = rec.path_index;
    stitch.term_index = rec.term_index;
    stitch.mapCells = cells;
    if (cells.length) {
      stitch.col = cells[0].col;
      stitch.token = cells[0].label || stitch.token;
    }
  }
  return list;
}

export function columnHue(col, columns) {
  if (!columns.length) return 0;
  const i = columns.indexOf(col);
  if (i < 0) return 0;
  return columns.length === 1 ? 0 : i / (columns.length - 1);
}

export function triangulate(verts) {
  const tris = [];
  for (let i = 1; i + 1 < verts.length; i++) {
    tris.push(verts[0], verts[i], verts[i + 1]);
  }
  return tris;
}

/**
 * Each KnittingStitches n-gon is one faces_ring term (generation order).
 * Desktop still builds a flat term list this way; the mobile slider
 * regroups these terms into knitting-row chunks.
 */
export function faceChunksFromFaces(faces) {
  return (faces || []).map((face, index) => ({
    index,
    face,
    verts: face.verts,
  }));
}

function seedColumnIndex(header) {
  return header
    .map((h, i) => ({ h: String(h ?? "").trim(), i }))
    .filter((c) => /^row_\d+$/i.test(c.h));
}

/**
 * Transposed first_rows seed matrix. N_seed = row_* columns; slider
 * N_rings = N_seed-1 because path_generate skips the seed at index 0.
 */
export function parseFirstRows({ xls, workbook } = {}) {
  const book = workbook || (xls ? parseXlsWorkbook(xls) : null);
  const sheet =
    findXlsSheet(book, /first_rows/i) ||
    findXlsSheet(book, (s) => seedColumnIndex(s.rows[0] || []).length >= 2) ||
    book?.sheets?.[0];
  if (!sheet?.rows?.length) {
    return { nSeed: 0, nRings: 0, skipSeed: 1, seedNames: [], columns: [] };
  }
  const header = sheet.rows[0] || [];
  const seedCols = seedColumnIndex(header);
  const colI = headerIndex(header, "col", "col\\row");
  const columns = [];
  for (let r = 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const col = colI >= 0 ? asIntCol(row[colI]) : r - 1;
    if (col == null) continue;
    columns.push({
      col,
      seeds: seedCols.map((c) => {
        const v = Number(row[c.i]);
        return Number.isFinite(v) ? v : null;
      }),
    });
  }
  const nSeed = seedCols.length;
  return {
    nSeed,
    nRings: Math.max(0, nSeed - 1),
    skipSeed: 1,
    seedNames: seedCols.map((c) => c.h),
    columns,
  };
}

export const DEFAULT_TERM_FACE_COLORS = {
  0: [0.55, 0.55, 0.55, 1],
  1: [1, 1, 1, 1],
  2: [0, 0, 0, 1],
  3: [1, 0, 0, 1],
  4: [0, 1, 0, 1],
  5: [1, 1, 0, 1],
  6: [0, 0, 1, 1],
  7: [1, 0.35, 0.8, 1],
  8: [1, 0.35, 0.8, 1],
  9: [1, 0.35, 0.8, 1],
};

export function colorForTermType(type, palette = DEFAULT_TERM_FACE_COLORS) {
  if (type == null || type === "") return null;
  const c = palette?.[String(type)];
  if (!c) return null;
  return { r: Number(c[0]) || 0, g: Number(c[1]) || 0, b: Number(c[2]) || 0, a: c[3] ?? 1 };
}

/**
 * Short labels for a stitch-pick readout. Only Type 0 has a documented
 * stitch name (PLAIN / 平针). 1–9 use the documented palette colour
 * names. Do not invent 左向 or other desktop Type names here.
 */
export const TERM_TYPE_LABELS = {
  0: { zh: "平针", en: "PLAIN" },
  1: { zh: "白", en: "white" },
  2: { zh: "黑", en: "black" },
  3: { zh: "红", en: "red" },
  4: { zh: "绿", en: "green" },
  5: { zh: "黄", en: "yellow" },
  6: { zh: "蓝", en: "blue" },
  7: { zh: "粉", en: "pink" },
  8: { zh: "粉", en: "pink" },
  9: { zh: "粉", en: "pink" },
};

export function termTypeShortLabel(type) {
  if (type == null || type === "") return "";
  const n = Number(type);
  const lab = TERM_TYPE_LABELS[n];
  if (!lab) return "";
  return n === 0 ? `${lab.zh} ${lab.en}` : lab.zh;
}

export function formatStitchPickParts(stitch) {
  if (!stitch) return null;
  const col = stitch.col != null && stitch.col !== "" ? stitch.col : "—";
  const ring = stitch.ring != null && Number.isFinite(stitch.ring) ? stitch.ring : "—";
  const term = stitch.termInRing != null && Number.isFinite(stitch.termInRing) ? stitch.termInRing : "—";
  const face = stitch.index != null && Number.isFinite(stitch.index) ? stitch.index : "—";
  const type = stitch.termType != null && stitch.termType !== "" ? stitch.termType : "—";
  const short = termTypeShortLabel(stitch.termType);
  return {
    title: `列 col ${col}`,
    detail: `ring ${ring} · term ${term} · face ${face} · Type ${type}${short ? ` ${short}` : ""}`,
  };
}

export function formatStitchPick(stitch) {
  const parts = formatStitchPickParts(stitch);
  if (!parts) return "";
  return `${parts.title} · ${parts.detail}`;
}

function applySidecarType(stitch, type, colors, where) {
  if (type == null || type === "") {
    throw new Error(`missing Term.Type at ${where}`);
  }
  const color = colorForTermType(type, colors);
  if (!color) throw new Error(`unknown Term.Type ${type} at ${where}`);
  stitch.termType = Number(type);
  stitch.termColor = color;
}

export function parseFacesRingLayout(data) {
  if (data == null || data === "") return null;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== "object") return null;
  const raw = parsed.term_counts ?? parsed.termCounts;
  let termCounts = Array.isArray(raw)
    ? raw.map((n) => Math.max(0, Math.trunc(Number(n) || 0)))
    : null;
  let ringTypes = null;
  if (Array.isArray(parsed.rings) && parsed.rings.length) {
    termCounts = parsed.rings.map((r) => Math.max(0, Math.trunc(Number(r?.n_terms) || 0)));
    ringTypes = parsed.rings.map((r) => (Array.isArray(r?.types) ? r.types : []));
  }
  let nFacesRing = Number(parsed.n_faces_ring ?? parsed.nFacesRing);
  if (!Number.isFinite(nFacesRing)) nFacesRing = termCounts?.length ?? 0;
  else nFacesRing = Math.max(0, Math.trunc(nFacesRing));
  if (termCounts?.length) nFacesRing = termCounts.length;
  if (!nFacesRing && !termCounts) return null;
  const colors = parsed.term_face_colors || parsed.termFaceColors || DEFAULT_TERM_FACE_COLORS;
  const edge = parsed.edge_color || parsed.edgeColor || [0, 0, 0];
  return {
    termCounts,
    ringTypes,
    nFacesRing,
    colors,
    edgeColor: { r: Number(edge[0]) || 0, g: Number(edge[1]) || 0, b: Number(edge[2]) || 0 },
    termTotal: Number(parsed.term_total ?? parsed.termTotal) || termCounts?.reduce((a, b) => a + b, 0) || 0,
    source: "sidecar",
  };
}

/**
 * Prefer sidecar n_terms. If their sum is short of nFaces, fold the
 * remainder into the last ring so every KnittingStitches face is sliced.
 */
export function termCountsForRings(nFaces, nRings, termCounts) {
  const faces = Math.max(0, Math.trunc(nFaces) || 0);
  if (Array.isArray(termCounts) && termCounts.length) {
    const counts = termCounts.map((n) => Math.max(0, Math.trunc(Number(n) || 0)));
    const sum = counts.reduce((a, b) => a + b, 0);
    if (faces > sum && counts.length) counts[counts.length - 1] += faces - sum;
    return counts;
  }
  const n = Math.max(0, Math.trunc(nRings) || 0);
  if (!n) return [];
  const base = Math.floor(faces / n);
  const extra = faces % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Slice KnittingStitches terms in generation order into first_row rings.
 * Does not use readable_map rowNNN.
 */
export function facesRingChunksFromStitches(
  stitches,
  { nRings = 0, termCounts = null, ringTypes = null, colors = DEFAULT_TERM_FACE_COLORS } = {},
) {
  const list = stitches || [];
  const typed = Array.isArray(ringTypes);
  const counts = termCountsForRings(list.length, nRings, termCounts);
  const chunks = [];
  let offset = 0;
  for (let i = 0; i < counts.length; i++) {
    const end = Math.min(list.length, offset + counts[i]);
    const faces = list.slice(offset, end);
    const types = ringTypes?.[i] || [];
    faces.forEach((s, k) => {
      s.ring = i;
      s.termInRing = k;
      if (typed) {
        applySidecarType(s, types[k], colors, `ring ${i} term ${k}`);
      } else {
        s.termType = null;
        s.termColor = null;
      }
    });
    chunks.push({
      row: i,
      ring: i,
      index: i,
      faces,
      terms: faces,
    });
    offset = end;
  }
  const leftover = list.slice(offset);
  if (leftover.length && typed) {
    throw new Error(`faces_ring_layout types cover ${offset} faces, OBJ has ${list.length}`);
  }
  if (leftover.length && chunks.length) {
    const last = chunks[chunks.length - 1];
    leftover.forEach((s, k) => {
      s.ring = last.ring;
      s.termInRing = last.faces.length + k;
      s.termType = null;
      s.termColor = null;
    });
    last.faces.push(...leftover);
  } else {
    for (const s of leftover) {
      s.ring = null;
      s.termInRing = null;
      s.termType = null;
      s.termColor = null;
    }
  }
  return chunks;
}

export function stitchesInRingRange(stitches, start, end) {
  const lo = Number(start);
  const hi = Number(end);
  return (stitches || []).filter(
    (s) => s.ring != null && Number.isFinite(s.ring) && s.ring >= lo && s.ring < hi,
  );
}

/**
 * Desktop writes field.obj sequentially: for each column, append verts,
 * then `l` edges only between consecutive verts in that column. No groups.
 * A chain is a maximal run of edges (i, i+1). Isolated verts are length-1.
 */
export function parseColsResampleField(text) {
  const { verts, lines } = parseColoredObj(text);
  const consecutive = new Set();
  for (const idx of lines) {
    for (let k = 0; k + 1 < idx.length; k++) {
      const a = idx[k];
      const b = idx[k + 1];
      if (Math.abs(a - b) === 1) consecutive.add(Math.min(a, b));
    }
  }

  const columns = [];
  let i = 0;
  while (i < verts.length) {
    const points = [colorPoint(verts[i], 0)];
    while (i + 1 < verts.length && consecutive.has(i)) {
      i += 1;
      points.push(colorPoint(verts[i], points.length));
    }
    columns.push({
      col: columns.length,
      type: null,
      points,
    });
    i += 1;
  }
  return columns;
}

function headerIndex(header, ...names) {
  const lower = header.map((h) => String(h ?? "").trim().toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function isFilled(value) {
  return value !== "" && value != null && !(typeof value === "number" && Number.isNaN(value));
}

function asIntCol(value) {
  if (!isFilled(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function colorPoint(v, index) {
  return {
    index,
    x: v.x,
    y: v.y,
    z: v.z,
    r: v.r ?? 0.2,
    g: v.g ?? 0.7,
    b: v.b ?? 1,
  };
}

function fieldVertColors(fieldText) {
  if (!fieldText) return [];
  return parseColoredObj(fieldText).verts;
}

function columnsFromColGroups(groups) {
  const ids = [...groups.keys()].sort((a, b) => a - b);
  return ids.map((id) => {
    const list = groups.get(id) || [];
    list.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return {
      col: id,
      type: list[0]?.type ?? null,
      points: list,
    };
  });
}

function columnsFromPointsDetail(rows, fieldVerts) {
  if (!rows?.length) return [];
  const header = rows[0] || [];
  const colI = headerIndex(header, "col");
  const xI = headerIndex(header, "x");
  const yI = headerIndex(header, "y");
  const zI = headerIndex(header, "z");
  if (colI < 0 || xI < 0 || yI < 0 || zI < 0) return [];
  const typeI = headerIndex(header, "type");
  const idxI = headerIndex(header, "point_index", "index");
  const scaleI = headerIndex(header, "scale");
  const groups = new Map();
  let global = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const col = asIntCol(row[colI]);
    if (col == null) continue;
    if (!groups.has(col)) groups.set(col, []);
    const fv = fieldVerts[global];
    groups.get(col).push({
      index: idxI >= 0 && isFilled(row[idxI]) ? Number(row[idxI]) : groups.get(col).length,
      scale: scaleI >= 0 && isFilled(row[scaleI]) ? Number(row[scaleI]) : null,
      x: Number(row[xI]),
      y: Number(row[yI]),
      z: Number(row[zI]),
      r: fv?.r ?? 0.2,
      g: fv?.g ?? 0.7,
      b: fv?.b ?? 1,
      type: typeI >= 0 ? row[typeI] || null : null,
    });
    global += 1;
  }
  return columnsFromColGroups(groups);
}

function columnsFromSheet0(rows, fieldVerts) {
  if (!rows?.length) return [];
  const header = rows[0] || [];
  const colI = headerIndex(header, "col", "col\\row");
  if (colI < 0) return [];
  const typeI = headerIndex(header, "type");
  const xI = headerIndex(header, "x");
  const yI = headerIndex(header, "y");
  const zI = headerIndex(header, "z");
  const pCols = header
    .map((h, i) => (/^p_\d+$/i.test(String(h ?? "").trim()) ? i : -1))
    .filter((i) => i >= 0);
  const groups = new Map();
  let cursor = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const col = asIntCol(row[colI]);
    if (col == null) continue;
    const type = typeI >= 0 ? row[typeI] || null : null;
    const points = [];
    if (xI >= 0 && yI >= 0 && zI >= 0 && isFilled(row[xI])) {
      const fv = fieldVerts[cursor];
      points.push({
        index: 0,
        x: Number(row[xI]),
        y: Number(row[yI]),
        z: Number(row[zI]),
        r: fv?.r ?? 0.2,
        g: fv?.g ?? 0.7,
        b: fv?.b ?? 1,
        type,
      });
      cursor += 1;
    } else if (pCols.length) {
      const n = pCols.filter((i) => isFilled(row[i])).length;
      for (let k = 0; k < n; k++) {
        const fv = fieldVerts[cursor + k];
        if (!fv) continue;
        points.push({
          index: k,
          x: fv.x,
          y: fv.y,
          z: fv.z,
          r: fv.r ?? 0.2,
          g: fv.g ?? 0.7,
          b: fv.b ?? 1,
          type,
        });
      }
      cursor += n;
    } else {
      groups.set(col, groups.get(col) || []);
      continue;
    }
    if (!groups.has(col)) groups.set(col, []);
    groups.get(col).push(...points);
  }
  return columnsFromColGroups(groups);
}

export function xlsScaleMatrixRowCount(workbook) {
  if (!workbook?.sheets?.length) return 0;
  const sheet =
    findXlsSheet(workbook, /scale_matrix/i) ||
    findXlsSheet(workbook, (s) => headerIndex(s.rows[0] || [], "col", "col\\row") >= 0) ||
    workbook.sheets[0];
  if (!sheet?.rows?.length) return 0;
  const colI = headerIndex(sheet.rows[0] || [], "col", "col\\row");
  let n = 0;
  for (let r = 1; r < sheet.rows.length; r++) {
    if (colI >= 0) {
      if (asIntCol(sheet.rows[r]?.[colI]) != null) n += 1;
    } else if ((sheet.rows[r] || []).some(isFilled)) {
      n += 1;
    }
  }
  return n;
}

function assertColsLensMatch(parts) {
  const present = parts.filter((p) => p.n > 0);
  if (present.length < 2) return;
  const n = present[0].n;
  const mismatch = present.find((p) => p.n !== n);
  if (!mismatch) return;
  const detail = present.map((p) => `${p.name}=${p.n}`).join(" ");
  throw new Error(`cols_resample length mismatch: ${detail}`);
}

export function uniqueColIdsFromXls(workbook) {
  const ids = new Set();
  const sheet =
    findXlsSheet(workbook, /points_detail/i) ||
    findXlsSheet(workbook, (s) => headerIndex(s.rows[0] || [], "col") >= 0) ||
    workbook?.sheets?.[0];
  if (!sheet?.rows?.length) return [];
  const colI = headerIndex(sheet.rows[0] || [], "col", "col\\row");
  if (colI < 0) return [];
  for (let r = 1; r < sheet.rows.length; r++) {
    const id = asIntCol(sheet.rows[r]?.[colI]);
    if (id != null) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Desktop cols_resample: one polyline per scale_matrix row (ids 0..N-1).
 * Prefer xls points_detail grouped by those col ids; otherwise sequential
 * (i,i+1) chains in field.obj. Lengths must match when both exist.
 */
export function parseColsResample({ xls, workbook, fieldText } = {}) {
  const book = workbook || (xls ? parseXlsWorkbook(xls) : null);
  const fieldCols = fieldText ? parseColsResampleField(fieldText) : [];
  const fieldVerts = fieldVertColors(fieldText);

  let xlsCols = [];
  if (book) {
    const detail = findXlsSheet(book, /points_detail/i);
    xlsCols = columnsFromPointsDetail(detail?.rows, fieldVerts);
    if (!xlsCols.length) {
      const sheet0 =
        findXlsSheet(book, /scale_matrix/i) ||
        findXlsSheet(book, (s) => headerIndex(s.rows[0] || [], "col", "col\\row") >= 0) ||
        book.sheets[0];
      xlsCols = columnsFromSheet0(sheet0?.rows, fieldVerts);
    }
  }

  const nXlsRows = book ? xlsScaleMatrixRowCount(book) : 0;
  assertColsLensMatch([
    { name: "xls", n: xlsCols.length },
    { name: "scale_matrix", n: nXlsRows },
    { name: "field", n: fieldCols.length },
  ]);

  if (xlsCols.length) return xlsCols;
  return fieldCols;
}

export function columnTrails(stitches, { maxRow = Infinity, onlyCol = null } = {}) {
  const groups = new Map();
  for (const s of stitches) {
    if (s.col == null) continue;
    if (s.row != null && s.row > maxRow) continue;
    if (onlyCol != null && s.col !== onlyCol) continue;
    if (!groups.has(s.col)) groups.set(s.col, []);
    groups.get(s.col).push(s);
  }
  const trails = [];
  for (const [col, list] of groups) {
    list.sort((a, b) => {
      const ar = a.row ?? 0;
      const br = b.row ?? 0;
      if (ar !== br) return ar - br;
      return a.centroid.y - b.centroid.y;
    });
    if (list.length >= 2) trails.push({ col, points: list.map((s) => s.centroid) });
  }
  return trails;
}
