/**
 * SingaLab knitting-stitch faces + first_rows / faces_ring_layout.
 *
 * Mapping (investigated on Single_Cylinder_Test 2026-09-16):
 * - KnittingStitches.obj lists one n-gon per stitch in generation order
 *   = flatten(faces_allin). This dump has 475 faces.
 * - Desktop path_generate(cols_resample, first_rows) skips index_r==0,
 *   then each later first_rows seed row emits one faces_ring (a ring of
 *   Terms). Cylinder first_rows has 6 seed rows (row_0..row_5) → 5 rings.
 * - Do NOT use readable_map's 65 rowNNN machine/carriage rows as slider N.
 *   readable_map still labels tokens; leftover map cells have no geometry.
 * - Sidecar faces_ring_layout.json is the desktop term dump:
 *   n_faces_ring, rings[i].n_terms, rings[i].types[] (Term.Type in path
 *   order). Cylinder: 46+136+110+106+73 = 471 typed terms. Map types by
 *   prefix in OBJ face order; leftover 4 faces → default pink (type 7).
 * - Term.Type palette (build_and_show_knitting_stitches):
 *   0 gray, 1 white, 2 black, 3 red, 4 green, 5 yellow, 6 blue,
 *   7–9 / default pink. Edges are black (#000000).
 * - Slider 2 is half-open over first_row rings. Slider 3 is terms inside
 *   the MAX ring of slider 2 (desktop update_slider_stitch).
 * - cols_resample.xls / field.obj: desktop N is len(cols_resample) (42).
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

/** Desktop Term.Type face colors (RGB 0..1). 7–9 share default pink. */
export const TERM_TYPE_PALETTE = [
  [0.55, 0.55, 0.55],
  [1, 1, 1],
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0.35, 0.8],
  [1, 0.35, 0.8],
  [1, 0.35, 0.8],
];

export const TERM_TYPE_DEFAULT = 7;
export const STITCH_EDGE_HEX = "#000000";

export const CYLINDER_FACES_RING_COUNTS = [46, 136, 110, 106, 73];

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
 */
export function faceChunksFromFaces(faces) {
  return (faces || []).map((face, index) => ({
    index,
    face,
    verts: face.verts,
  }));
}

export function termTypeRgb(type) {
  const i = Math.trunc(Number(type));
  if (!Number.isFinite(i) || i < 0 || i > 9) return TERM_TYPE_PALETTE[TERM_TYPE_DEFAULT];
  return TERM_TYPE_PALETTE[i] || TERM_TYPE_PALETTE[TERM_TYPE_DEFAULT];
}

function colorDist2(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function inferTermTypeFromVerts(verts) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const v of verts || []) {
    if (v?.r == null || v?.g == null || v?.b == null) continue;
    if (![v.r, v.g, v.b].every(Number.isFinite)) continue;
    r += v.r;
    g += v.g;
    b += v.b;
    n += 1;
  }
  if (!n) return TERM_TYPE_DEFAULT;
  const avg = [r / n, g / n, b / n];
  let best = TERM_TYPE_DEFAULT;
  let bestD = Infinity;
  for (let i = 0; i <= 6; i++) {
    const d = colorDist2(avg, TERM_TYPE_PALETTE[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const pinkD = colorDist2(avg, TERM_TYPE_PALETTE[TERM_TYPE_DEFAULT]);
  if (pinkD + 1e-6 < bestD) return TERM_TYPE_DEFAULT;
  return best;
}

function seedColumnIndex(header) {
  return header
    .map((h, i) => ({ h: String(h ?? "").trim(), i }))
    .filter((c) => /^row_\d+$/i.test(c.h))
    .sort((a, b) => Number(a.h.slice(4)) - Number(b.h.slice(4)));
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

function asTypeList(raw, n) {
  const out = [];
  const src = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < n; i++) {
    const v = Number(src[i]);
    out.push(Number.isFinite(v) ? Math.trunc(v) : TERM_TYPE_DEFAULT);
  }
  return out;
}

/**
 * Desktop faces_ring_layout.json:
 * { n_faces_ring, rings: [{ n_terms, types[] }] }
 * Also accepts term_counts / nFacesRing aliases.
 */
export function parseFacesRingLayout(data) {
  if (data == null || data === "") return null;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (!parsed || typeof parsed !== "object") return null;

  let rings = [];
  if (Array.isArray(parsed.rings) && parsed.rings.length) {
    rings = parsed.rings.map((ring, index) => {
      const typesRaw = ring?.types ?? ring?.type ?? [];
      const nTerms = Math.max(
        0,
        Math.trunc(Number(ring?.n_terms ?? ring?.nTerms ?? typesRaw.length) || 0),
      );
      const types = asTypeList(typesRaw, nTerms);
      return { index, n_terms: nTerms, types };
    });
  } else {
    const raw = parsed.term_counts ?? parsed.termCounts;
    const counts = Array.isArray(raw) ? raw.map((n) => Math.max(0, Math.trunc(Number(n) || 0))) : [];
    const typesAll = Array.isArray(parsed.types) ? parsed.types : [];
    let offset = 0;
    rings = counts.map((n, index) => {
      const types = asTypeList(typesAll.slice(offset, offset + n), n);
      offset += n;
      return { index, n_terms: n, types };
    });
  }

  let nFacesRing = Number(parsed.n_faces_ring ?? parsed.nFacesRing ?? parsed.n_rings);
  if (!Number.isFinite(nFacesRing)) nFacesRing = rings.length;
  else nFacesRing = Math.max(0, Math.trunc(nFacesRing));
  if (rings.length) nFacesRing = rings.length;

  const nTyped = rings.reduce((s, r) => s + r.n_terms, 0);
  const leftoverFaces = Math.max(0, Math.trunc(Number(parsed.leftover_faces ?? parsed.leftoverFaces) || 0));
  if (!nFacesRing && !rings.length) return null;
  return {
    nFacesRing,
    rings,
    nTyped,
    leftoverFaces,
    nObjFaces: Number(parsed.n_obj_faces ?? parsed.nObjFaces) || nTyped + leftoverFaces,
    source: "sidecar",
  };
}

export function applyFacesRingLayout(stitches, layout) {
  const list = stitches || [];
  const rings = layout?.rings || [];
  let offset = 0;
  const chunks = [];
  for (let i = 0; i < rings.length; i++) {
    const n = rings[i].n_terms;
    const types = rings[i].types || [];
    const faces = [];
    for (let k = 0; k < n; k++) {
      const s = list[offset + k];
      if (!s) break;
      const inferred = Number.isFinite(Number(types[k])) ? Math.trunc(Number(types[k])) : inferTermTypeFromVerts(s.verts);
      s.ring = i;
      s.termIndex = k;
      s.type = inferred;
      faces.push(s);
    }
    chunks.push({
      row: i,
      ring: i,
      index: i,
      n_terms: faces.length,
      types: faces.map((f) => f.type),
      faces,
      terms: faces,
    });
    offset += n;
  }
  const leftover = [];
  for (let i = offset; i < list.length; i++) {
    list[i].ring = null;
    list[i].termIndex = null;
    list[i].type = TERM_TYPE_DEFAULT;
    leftover.push(list[i]);
  }
  return { chunks, leftover, nTyped: offset, nFacesRing: chunks.length };
}

/**
 * Desktop update_knittingStitch: include every ring in [start, end);
 * clip terms only on the last (max) ring via the stitch/term slider.
 * Leftover untyped faces (471 vs 475) show when the last ring is in
 * window and the term window reaches that ring's end.
 */
export function stitchesInFacesAndTermRange(chunks, leftover, ringStart, ringEnd, termStart, termEnd) {
  const rings = chunks || [];
  const n = rings.length;
  if (!n) return [];
  let rs = Math.trunc(Number(ringStart));
  let re = Math.trunc(Number(ringEnd));
  if (!Number.isFinite(rs)) rs = 0;
  if (!Number.isFinite(re)) re = n;
  if (rs > re) [rs, re] = [re, rs];
  rs = Math.max(0, Math.min(rs, n));
  re = Math.max(0, Math.min(re, n));
  if (re <= rs) return [];
  const active = re - 1;
  const terms = rings[active]?.terms || rings[active]?.faces || [];
  const nTerms = terms.length;
  let ts = Math.trunc(Number(termStart));
  let te = Math.trunc(Number(termEnd));
  if (!Number.isFinite(ts)) ts = 0;
  if (!Number.isFinite(te)) te = nTerms;
  if (ts > te) [ts, te] = [te, ts];
  ts = Math.max(0, Math.min(ts, nTerms));
  te = Math.max(0, Math.min(te, nTerms));
  if (nTerms && te <= ts) te = Math.min(nTerms, ts + 1);
  const out = [];
  for (let i = rs; i < active; i++) {
    out.push(...(rings[i].terms || rings[i].faces || []));
  }
  out.push(...terms.slice(ts, te));
  if (active === n - 1 && te === nTerms && leftover?.length) {
    out.push(...leftover);
  }
  return out;
}

export function stitchesInRingRange(stitches, start, end) {
  const lo = Number(start);
  const hi = Number(end);
  return (stitches || []).filter(
    (s) => s.ring != null && Number.isFinite(s.ring) && s.ring >= lo && s.ring < hi,
  );
}

export function stitchesInRowRange(stitches, start, end) {
  return stitchesInRingRange(stitches, start, end);
}

/**
 * When faces_ring end (max) changes, rebind the term slider to
 * len(path) of that ring — desktop update_slider_stitch.
 */
export function termsSliderForFacesEnd(rings, facesEnd, prevFacesEnd = null) {
  const n = rings?.length || 0;
  if (!n) {
    return { activeRing: null, nTerms: 0, range: [0, 0], rebind: true };
  }
  let end = Math.trunc(Number(facesEnd));
  if (!Number.isFinite(end)) end = n;
  end = Math.max(1, Math.min(end, n));
  const activeRing = end - 1;
  const nTerms = rings[activeRing]?.n_terms ?? rings[activeRing]?.terms?.length ?? 0;
  const prev = prevFacesEnd == null ? null : Math.trunc(Number(prevFacesEnd));
  return {
    activeRing,
    nTerms,
    range: nTerms ? [0, nTerms] : [0, 0],
    rebind: prev !== end,
  };
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
