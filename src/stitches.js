/**
 * SingaLab knitting-stitch faces + readable_map.
 *
 * Mapping (investigated on Single_Cylinder_Test 2026-09-16):
 * - KnittingStitches.obj lists one n-gon per stitch in generation order
 *   (first 35 faces are the base ring / row000, 35 needles).
 * - Vertex colours: gray 0.55 = normal, red = special/highlight, plus
 *   black/white/green/yellow/blue markers. Faces reuse copied verts.
 * - readable_map.txt walks the same generation order: each token
 *   (including the leftover "-" after a -R2 decrease) is one stitch
 *   cell with an explicit row id and needle column.
 * - This OBJ has 450 faces vs 479 map tokens: leftover tokens are the
 *   last short rows (65–68) that have no stitch geometry. Do not invent
 *   rows; unmatched faces/cells stay unbound.
 * - first_rows.xls / cols_resample.xls describe resampled field polylines.
 *   Desktop slider N is len(cols_smooth2) (42 on the cylinder sample), not
 *   raw xls fragment rows (FULL/SHORT_* over-count) and not field OBJ
 *   connected components. Face terms come from OBJ generation order.
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
 * Same as SingaLab face_chunks: one chunk per term, not a height split.
 */
export function faceChunksFromFaces(faces) {
  return (faces || []).map((face, index) => ({
    index,
    face,
    verts: face.verts,
  }));
}

/**
 * cols_resample_field.obj v-runs. Do NOT use this for column identity:
 * connected components over/under-count vs desktop len(cols_smooth2).
 */
export function parseColsResampleField(text) {
  const columns = [];
  let points = [];
  let mode = null;

  const flush = () => {
    if (!points.length) return;
    columns.push({ points });
    points = [];
  };

  for (const raw of String(text).split(/\r?\n/)) {
    if (raw.startsWith("v ")) {
      if (mode === "l") flush();
      mode = "v";
      const n = raw.trim().split(/\s+/).slice(1).map(Number);
      points.push({
        x: n[0],
        y: n[1],
        z: n[2],
        r: n.length >= 6 ? n[3] : 0,
        g: n.length >= 6 ? n[4] : 0.15,
        b: n.length >= 6 ? n[5] : 1,
      });
    } else if (raw.startsWith("l ")) {
      mode = "l";
    }
  }
  flush();
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

function fieldVertColors(fieldText) {
  if (!fieldText) return [];
  return parseColoredObj(fieldText).verts;
}

function denseColumns(groups) {
  const ids = [...groups.keys()].sort((a, b) => a - b);
  if (!ids.length) return [];
  const min = Math.min(0, ids[0]);
  const max = ids[ids.length - 1];
  const columns = [];
  for (let id = min; id <= max; id++) {
    const list = groups.get(id) || [];
    list.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    columns.push({
      col: id,
      type: list[0]?.type ?? null,
      points: list,
    });
  }
  return columns;
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
  return denseColumns(groups);
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
  return denseColumns(groups);
}

function parseSidecarMeta(data) {
  if (!data) return {};
  return typeof data === "string" ? JSON.parse(data) : data;
}

function columnsFromSidecar(data) {
  if (!data) return [];
  const parsed = parseSidecarMeta(data);
  const raw = parsed.columns || parsed.cols_resample || parsed.cols;
  if (!Array.isArray(raw) || !raw.some((col) => Array.isArray(col?.points) && col.points.length)) {
    return [];
  }
  return raw.map((col, i) => ({
    col: col.col ?? col.id ?? i,
    type: col.type ?? null,
    points: (col.points || []).map((p, k) => ({
      index: p.index ?? k,
      x: Number(p.x),
      y: Number(p.y),
      z: Number(p.z),
      r: p.r ?? 0.2,
      g: p.g ?? 0.7,
      b: p.b ?? 1,
      type: p.type ?? col.type ?? null,
    })),
  }));
}

const SEED_TYPES = new Set(["FULL", "SHORT_BEGIN"]);
const CHILD_TYPES = new Set(["SHORT_INNER", "SHORT_END"]);

function colTypeName(col) {
  return String(col?.type ?? col?.points?.[0]?.type ?? "").trim().toUpperCase();
}

function pointAngleY(p) {
  return Math.atan2(Number(p.z) || 0, Number(p.x) || 0);
}

function circularMeanAngle(points) {
  let sx = 0;
  let sy = 0;
  for (const p of points || []) {
    const a = pointAngleY(p);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx);
}

function angleDelta(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

function medianNumber(values) {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function flattenMergedColumn(members, index) {
  const points = [];
  let type = null;
  for (const m of members) {
    if (!type && m.type) type = m.type;
    if (String(m.type || "").toUpperCase() === "FULL") type = m.type;
    for (const p of m.points || []) points.push(p);
  }
  points.sort((a, b) => {
    const dy = (a.y ?? 0) - (b.y ?? 0);
    if (dy) return dy;
    return (a.index ?? 0) - (b.index ?? 0);
  });
  return {
    col: index,
    type,
    points,
    sources: members.map((m) => m.col),
  };
}

function applyXlsColGroups(fragments, groups) {
  const byId = new Map(fragments.map((c) => [c.col, c]));
  return groups
    .map((ids) => (Array.isArray(ids) ? ids : []).map((id) => byId.get(id)).filter(Boolean))
    .filter((members) => members.length)
    .map((members, i) => flattenMergedColumn(members, i));
}

/**
 * Rebuild desktop logical columns from xls FULL/SHORT_* fragments.
 * Seeds are FULL + SHORT_BEGIN; SHORT_INNER/END attach if their cylinder
 * angle (Y-axis) is within 0.45 * unitW / R_median. Leftovers cluster
 * with the same threshold and become extra parents (cylinder → 42).
 */
export function mergeColsResampleParents(fragments, meta = {}) {
  if (!fragments?.length) return [];
  const hasShort = fragments.some((c) => /^SHORT_/.test(colTypeName(c)));
  const targetN = Number.isFinite(Number(meta.n)) ? Math.trunc(Number(meta.n)) : null;
  if (!hasShort && (targetN == null || fragments.length === targetN)) {
    return fragments;
  }

  const unitW = Number(meta.unitW) > 0 ? Number(meta.unitW) : 5;
  const attach = Number(meta.attachFactor) > 0 ? Number(meta.attachFactor) : 0.45;
  const annotated = fragments.map((c, i) => {
    const points = c.points || [];
    const rs = points.map((p) => Math.hypot(p.x || 0, p.z || 0));
    return {
      ...c,
      _i: i,
      _type: colTypeName(c),
      _ang: points.length ? circularMeanAngle(points) : 0,
      _r: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    };
  });

  const seeds = annotated.filter((f) => SEED_TYPES.has(f._type));
  const kids = annotated.filter((f) => CHILD_TYPES.has(f._type));
  const other = annotated.filter((f) => !SEED_TYPES.has(f._type) && !CHILD_TYPES.has(f._type));
  if (!seeds.length) return fragments;

  const R = medianNumber(annotated.map((f) => f._r).filter((r) => r > 0)) || 1;
  const thresh = (attach * unitW) / R;
  const groups = seeds.map((s) => [s]);
  const leftovers = [];
  for (const k of kids) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = angleDelta(k._ang, seeds[i]._ang);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD <= thresh) groups[best].push(k);
    else leftovers.push(k);
  }

  const parent = leftovers.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < leftovers.length; i++) {
    for (let j = i + 1; j < leftovers.length; j++) {
      if (angleDelta(leftovers[i]._ang, leftovers[j]._ang) <= thresh) {
        parent[find(j)] = find(i);
      }
    }
  }
  const clustered = new Map();
  for (let i = 0; i < leftovers.length; i++) {
    const root = find(i);
    if (!clustered.has(root)) clustered.set(root, []);
    clustered.get(root).push(leftovers[i]);
  }
  let extras = [...clustered.values()];

  if (targetN != null && seeds.length + extras.length + other.length > targetN) {
    while (seeds.length + extras.length + other.length > targetN && extras.length > 1) {
      let bi = 0;
      let bj = 1;
      let bd = Infinity;
      for (let i = 0; i < extras.length; i++) {
        const ai = circularMeanAngle(extras[i].flatMap((f) => f.points || []));
        for (let j = i + 1; j < extras.length; j++) {
          const aj = circularMeanAngle(extras[j].flatMap((f) => f.points || []));
          const d = angleDelta(ai, aj);
          if (d < bd) {
            bd = d;
            bi = i;
            bj = j;
          }
        }
      }
      extras = extras
        .filter((_, k) => k !== bi && k !== bj)
        .concat([[...extras[bi], ...extras[bj]]]);
    }
  }

  const all = [...groups, ...extras, ...other.map((f) => [f])];
  all.sort((a, b) => {
    const seedKey = (members) => {
      const seedCols = members.filter((m) => SEED_TYPES.has(m._type)).map((m) => m.col ?? m._i);
      if (seedCols.length) return Math.min(...seedCols);
      return Math.min(...members.map((m) => m.col ?? m._i));
    };
    return seedKey(a) - seedKey(b);
  });
  return all.map((members, i) => flattenMergedColumn(members, i));
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
 * Column identity/count is desktop len(cols_smooth2): merge xls FULL/SHORT_*
 * fragments (or honor a sidecar n / groups). Field OBJ only supplies colours.
 */
export function parseColsResample({ xls, workbook, sidecar, fieldText } = {}) {
  const meta = parseSidecarMeta(sidecar);
  const fromJson = columnsFromSidecar(meta);
  if (fromJson.length) return fromJson;

  const book = workbook || (xls ? parseXlsWorkbook(xls) : null);
  const fieldVerts = fieldVertColors(fieldText);
  let fragments = [];
  if (book) {
    const detail = findXlsSheet(book, /points_detail/i);
    fragments = columnsFromPointsDetail(detail?.rows, fieldVerts);
    if (!fragments.length) {
      const sheet0 =
        findXlsSheet(book, (s) => headerIndex(s.rows[0] || [], "col", "col\\row") >= 0) ||
        book.sheets[0];
      fragments = columnsFromSheet0(sheet0?.rows, fieldVerts);
    }
  }
  if (!fragments.length) return [];

  const groups = meta.groups || meta.xlsCols || meta.polylines;
  if (Array.isArray(groups) && groups.length) {
    const merged = applyXlsColGroups(fragments, groups);
    if (merged.length) return merged;
  }
  return mergeColsResampleParents(fragments, meta);
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
