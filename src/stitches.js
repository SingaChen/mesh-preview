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
 *   Cylinder dump stuck_all n_terms: 46, 136, 110, 106, 73 (sum 471).
 *   Sample slicing folds the leftover 4 OBJ faces into the last ring
 *   → 46, 136, 110, 106, 77 (sum 475). Extra last-ring faces stay
 *   untyped / pink. Without a sidecar, faces split evenly across N_rings.
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
  "firstRows",
  "first_rows",
  "facesRingLayout",
  "faces_ring_layout",
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
  return {
    rows,
    cells,
    rowMin: rowIds.length ? Math.min(...rowIds) : 0,
    rowMax: rowIds.length ? Math.max(...rowIds) : 0,
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
  default: [1, 0.35, 0.8, 1],
};

export function colorForTermType(type, palette = DEFAULT_TERM_FACE_COLORS) {
  const key = type == null || type === "" ? "default" : String(type);
  const c = palette?.[key] || palette?.default || DEFAULT_TERM_FACE_COLORS.default;
  return { r: Number(c[0]) || 0, g: Number(c[1]) || 0, b: Number(c[2]) || 0, a: c[3] ?? 1 };
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
  const counts = termCountsForRings(list.length, nRings, termCounts);
  const chunks = [];
  let offset = 0;
  for (let i = 0; i < counts.length; i++) {
    const end = Math.min(list.length, offset + counts[i]);
    const faces = list.slice(offset, end);
    const types = ringTypes?.[i] || [];
    faces.forEach((s, k) => {
      const type = types[k] ?? null;
      s.ring = i;
      s.termInRing = k;
      s.termType = type;
      s.termColor = colorForTermType(type, colors);
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
  if (leftover.length && chunks.length) {
    const last = chunks[chunks.length - 1];
    leftover.forEach((s, k) => {
      s.ring = last.ring;
      s.termInRing = last.faces.length + k;
      s.termType = null;
      s.termColor = colorForTermType(null, colors);
    });
    last.faces.push(...leftover);
  } else {
    for (const s of leftover) {
      s.ring = null;
      s.termInRing = null;
      s.termType = null;
      s.termColor = colorForTermType(null, colors);
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
