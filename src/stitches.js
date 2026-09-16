/**
 * SingaLab knitting-stitch faces + first_rows / readable_map.
 *
 * Mapping (investigated on Single_Cylinder_Test 2026-09-16):
 * - KnittingStitches.obj lists one n-gon per stitch in generation order
 *   = flatten(faces_allin). This dump has 475 faces.
 * - Vertex colours: gray 0.55 = normal, red = special/highlight, plus
 *   black/white/green/yellow/blue markers. Faces reuse copied verts.
 * - first_rows.xls is the seed matrix that path_generate walks. Header is
 *   col\\row + row_0..row_{K-1} (K=6 here, 42 cols). Desktop skips
 *   index_r==0 and appends one faces_ring per later first_rows row, so
 *   slider N = K-1 (5 rings). first_rows IS the authority for ring count.
 * - Each faces_ring is the complete band between consecutive first_rows.
 *   Reconstruct band sizes by mapping face verts onto cols_resample points
 *   and placing them in that first_rows interval. Cylinder: 46+136+110+106+77.
 * - readable_map.txt still walks generation order with rowNNN / needle
 *   tokens (65 machine rows after wrap/inc/xfer). Do NOT use rowMax+1
 *   as slider N. Leftover map tokens with no geometry stay unbound.
 * - Optional faces_rings.json { term_counts, n_faces_ring } may override
 *   band sizes only when justified (len === N_rings, sum === face count).
 * - cols_resample.xls / field.obj: desktop N is len(cols_resample) (42).
 *   Parse points_detail by col id 0..N-1, or sequential (i,i+1) chains.
 *   Do not invent SHORT_* parent merges.
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
  "facesRings",
  "faces_rings",
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
    .filter((c) => /^row_\d+$/i.test(c.h))
    .sort((a, b) => Number(a.h.slice(4)) - Number(b.h.slice(4)));
}

/**
 * Transposed first_rows seed matrix (desktop first_rows_generate).
 * N_seed = row_* columns; slider N_rings = N_seed-1 because path_generate
 * skips the seed row at index_r==0 and emits one faces_ring per later row.
 */
export function parseFirstRows({ xls, workbook } = {}) {
  const book = workbook || (xls ? parseXlsWorkbook(xls) : null);
  const sheet =
    findXlsSheet(book, /first_rows/i) ||
    findXlsSheet(book, (s) => seedColumnIndex(s.rows[0] || []).length >= 2) ||
    book?.sheets?.[0];
  if (!sheet?.rows?.length) {
    return { nSeed: 0, nRings: 0, nCols: 0, skipSeed: 1, seedNames: [], columns: [], rows: [] };
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
        if (!isFilled(row[c.i])) return -1;
        const v = Number(row[c.i]);
        return Number.isFinite(v) ? Math.trunc(v) : -1;
      }),
    });
  }
  const nSeed = seedCols.length;
  const nCols = columns.length ? Math.max(...columns.map((c) => c.col)) + 1 : 0;
  const rows = Array.from({ length: nSeed }, () => Array(nCols).fill(-1));
  for (const rec of columns) {
    rec.seeds.forEach((v, k) => {
      rows[k][rec.col] = v;
    });
  }
  return {
    nSeed,
    nRings: Math.max(0, nSeed - 1),
    nCols,
    skipSeed: 1,
    seedNames: seedCols.map((c) => c.h),
    columns,
    rows,
  };
}

export function parseFacesRingsJson(data) {
  if (data == null || data === "") return null;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== "object") return null;
  const raw = parsed.term_counts ?? parsed.termCounts;
  const termCounts = Array.isArray(raw)
    ? raw.map((n) => Math.max(0, Math.trunc(Number(n) || 0)))
    : null;
  let nFacesRing = Number(parsed.n_faces_ring ?? parsed.nFacesRing ?? parsed.n_rings);
  if (!Number.isFinite(nFacesRing)) nFacesRing = termCounts?.length ?? 0;
  else nFacesRing = Math.max(0, Math.trunc(nFacesRing));
  if (termCounts?.length) nFacesRing = termCounts.length;
  if (!nFacesRing && !termCounts) return null;
  return { termCounts, nFacesRing, source: "sidecar" };
}

/** Accept only a dump whose ring count and face total match the mesh. */
export function justifiedTermCounts(termCounts, nFaces, nRings) {
  if (!Array.isArray(termCounts) || !termCounts.length) return null;
  const counts = termCounts.map((n) => Math.trunc(Number(n)));
  if (counts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (Number.isFinite(nRings) && nRings > 0 && counts.length !== nRings) return null;
  if (counts.reduce((a, b) => a + b, 0) !== nFaces) return null;
  return counts;
}

function seedAt(firstRows, rowK, col) {
  const v = firstRows?.rows?.[rowK]?.[col];
  return Number.isFinite(v) ? Math.trunc(v) : -1;
}

export function firstRowBandsForPoint(firstRows, col, idx) {
  const nRings = firstRows?.nRings || 0;
  const bands = [];
  const i = Math.trunc(idx);
  for (let b = 0; b < nRings; b++) {
    const a = seedAt(firstRows, b, col);
    const c = seedAt(firstRows, b + 1, col);
    if (a < 0 && c < 0) continue;
    // Column becoming active this band (prev seed -1): include lead-in
    // points 0..curr. Column going inactive (curr -1): keep the last seed.
    let lo;
    let hi;
    if (a < 0) {
      lo = 0;
      hi = c;
    } else if (c < 0) {
      lo = a;
      hi = a;
    } else {
      lo = Math.min(a, c);
      hi = Math.max(a, c);
    }
    if (i >= lo && i <= hi) bands.push(b);
  }
  return bands;
}

function isFirstRowsSeedPoint(firstRows, col, idx) {
  const nSeed = firstRows?.nSeed || 0;
  const i = Math.trunc(idx);
  for (let k = 0; k < nSeed; k++) {
    if (seedAt(firstRows, k, col) === i) return true;
  }
  return false;
}

function matchVertToColumnPoint(v, columns) {
  let best = null;
  let bestD = Infinity;
  for (const col of columns || []) {
    (col.points || []).forEach((p, idx) => {
      const d = (p.x - v.x) ** 2 + (p.y - v.y) ** 2 + (p.z - v.z) ** 2;
      if (d < bestD) {
        bestD = d;
        const pointIdx = Number.isFinite(p.index) ? Math.trunc(p.index) : idx;
        best = { col: col.col, idx: pointIdx, dist: Math.sqrt(d) };
      }
    });
  }
  return best;
}

const MATCH_EPS = 1e-3;

export function assignFaceToFirstRowRing(face, columns, firstRows) {
  const nRings = firstRows?.nRings || 0;
  if (!nRings || !face?.verts?.length || !columns?.length) return null;
  const hits = face.verts.map((v) => matchVertToColumnPoint(v, columns)).filter((h) => h && h.dist <= MATCH_EPS);
  if (hits.length !== face.verts.length) return null;
  const perVertBands = hits.map((h) => firstRowBandsForPoint(firstRows, h.col, h.idx));
  const interiors = hits.filter((h) => !isFirstRowsSeedPoint(firstRows, h.col, h.idx));
  const tally = (bandsList) => {
    const counts = Array(nRings).fill(0);
    for (const bands of bandsList) for (const b of bands) counts[b] += 1;
    let best = null;
    let bestN = 0;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > bestN) {
        bestN = counts[i];
        best = i;
      }
    }
    return bestN > 0 ? best : null;
  };
  if (interiors.length) {
    const voted = tally(interiors.map((h) => firstRowBandsForPoint(firstRows, h.col, h.idx)));
    if (voted != null) return voted;
  }
  let common = perVertBands[0] ? [...perVertBands[0]] : [];
  for (const list of perVertBands.slice(1)) {
    common = common.filter((b) => list.includes(b));
  }
  if (common.length) return Math.min(...common);
  return tally(perVertBands);
}

function assignRingsByCounts(stitches, counts) {
  let offset = 0;
  for (let i = 0; i < counts.length; i++) {
    const end = Math.min(stitches.length, offset + counts[i]);
    for (let j = offset; j < end; j++) stitches[j].ring = i;
    offset = end;
  }
  for (let j = offset; j < stitches.length; j++) stitches[j].ring = null;
}

function chunksFromAssignedRings(stitches, nRings) {
  const chunks = [];
  for (let i = 0; i < nRings; i++) {
    const faces = (stitches || []).filter((s) => s.ring === i);
    chunks.push({
      row: i,
      ring: i,
      index: i,
      faces,
      terms: faces,
    });
  }
  return chunks;
}

/**
 * Reconstruct one faces_ring per first_rows band (skip seed row 0).
 * Prefer flatten(faces_allin) / OBJ order. Optional term_counts are used
 * only when they are justified (len === N_rings, sum === nFaces).
 */
export function reconstructFacesRingTermCounts(faces, columns, firstRows) {
  const nRings = firstRows?.nRings || 0;
  const list = faces || [];
  if (!nRings || !list.length || !columns?.length) return null;
  const counts = Array(nRings).fill(0);
  for (const face of list) {
    const ring = assignFaceToFirstRowRing(face, columns, firstRows);
    if (ring == null) return null;
    counts[ring] += 1;
  }
  if (counts.reduce((a, b) => a + b, 0) !== list.length) return null;
  return counts;
}

export function applyFacesRingAssignment(stitches, faces, { columns = null, firstRows = null, termCounts = null } = {}) {
  const list = stitches || [];
  const nFaces = list.length;
  const nRings = firstRows?.nRings || 0;
  const sourceFaces = faces?.length ? faces : list.map((s) => ({ verts: s.verts }));
  const fromJson = justifiedTermCounts(termCounts, nFaces, nRings || termCounts?.length || 0);
  if (fromJson) {
    assignRingsByCounts(list, fromJson);
    return chunksFromAssignedRings(list, fromJson.length);
  }
  if (nRings && columns?.length && sourceFaces.length === list.length) {
    let ok = true;
    for (let i = 0; i < list.length; i++) {
      const ring = assignFaceToFirstRowRing(sourceFaces[i], columns, firstRows);
      if (ring == null) {
        ok = false;
        break;
      }
      list[i].ring = ring;
    }
    if (ok) return chunksFromAssignedRings(list, nRings);
  }
  for (const s of list) s.ring = null;
  return nRings ? chunksFromAssignedRings(list, nRings) : [];
}

export function facesRingChunksFromStitches(stitches, { nRings = 0, termCounts = null } = {}) {
  const list = stitches || [];
  const justified = justifiedTermCounts(termCounts, list.length, nRings || termCounts?.length || 0);
  if (justified) {
    assignRingsByCounts(list, justified);
    return chunksFromAssignedRings(list, justified.length);
  }
  if (nRings && list.some((s) => s.ring != null)) {
    return chunksFromAssignedRings(list, nRings);
  }
  return nRings ? chunksFromAssignedRings(list, nRings) : [];
}

export function stitchesInRowRange(stitches, start, end) {
  const lo = Number(start);
  const hi = Number(end);
  return (stitches || []).filter(
    (s) => s.row != null && Number.isFinite(s.row) && s.row >= lo && s.row < hi,
  );
}

export function stitchesInRingRange(stitches, start, end) {
  const list = stitches || [];
  const lo = Number(start);
  const hi = Number(end);
  const rings = list.map((s) => s.ring).filter((r) => r != null && Number.isFinite(r));
  if (!rings.length) return list;
  const n = Math.max(...rings) + 1;
  const showingAll = lo <= 0 && hi >= n;
  return list.filter((s) => {
    if (s.ring == null || !Number.isFinite(s.ring)) return showingAll;
    return s.ring >= lo && s.ring < hi;
  });
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
