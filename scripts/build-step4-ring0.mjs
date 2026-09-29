/**
 * Build iteration_0_cut_readable_map_step4_ring0.xls
 *
 * Ring 0 beds follow the stitch, on physical needles. Chart columns stay
 * the step3 columns (a transfer row shows the source column). Cast-on:
 * column <= 18 is front, phys = column; otherwise back, phys = 37 − column.
 * An X / X+ moves front phys with the chart and back phys against it, so
 * back phys stays 37 − column. After the increase knit, one X row recenters:
 * every front stitch F→ (phys + 1) and every back stitch B← (phys − 1).
 * Charts do not move. After that, back phys = 36 − column, and a new back
 * stitch uses that formula. No Flip.
 *
 * On every ring-0 row the sheet column is the physical needle for the front
 * (column = phys) and the mirrored needle for the back (column = 37 − phys).
 * That identity holds before the recenter. After it, both beds move one
 * column right: front phys increases by 1, and a back phys decrease of 1 is
 * a column increase of 1 because the back is mirrored.
 *
 * Ring 1 starts from those physical needles (both beds 0…18) and ends
 * there again. Counts change with each increase or decrease: N is the
 * stitches still on the needles, F = ceil(N/2), B = floor(N/2). Only the
 * shaping bed moves on that transfer row. The other bed keeps its needles.
 * The next row may flip one stitch at the fold so the counts match the new
 * F and B. The needle span is whatever that step leaves: the first decrease
 * can sit at front 0…18 / back 0…17, and a later decrease can sit elsewhere.
 * Nothing racks the back onto a fixed window. Knit rows
 * sit one left of the physical-needle column, so they line up with the step3
 * chart and the first front stitch is column 0. Transfer rows (X / X+) stay
 * on the physical-needle column: front = phys, back = 37 − phys. Only the
 * bed that gains or loses the stitch moves on that row. The other bed keeps
 * its needles, so a front decrease does not draw a back-bed run of arrows;
 * the next row's fold flip fills the missing stitch. Chart columns still
 * follow step3, including on the bed that did not move.
 * A negative step3 column is not a new front stitch: it is the back bed's
 * existing tail. Step4 draws that stitch once, at (37 − phys) − 1, the same
 * one-column shift as the knit row. Only a real increase, decrease,
 * or newly hung loop changes N. After each of those the counts are checked
 * again. One adjacent fold flip may run, and it has to be the only way to
 * land on F = ceil(N/2) and B = floor(N/2) with the front bed still starting
 * at needle 0. There is no slide onto a fixed back window. Rings 2–4 stay
 * on the step3 columns.
 *
 * Same-bed double occupancy throws and does not write a sheet.
 *
 *   node scripts/build-step4-ring0.mjs
 *   node scripts/build-step4-ring0.mjs --check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BIFF8_DEFAULT_PALETTE, fillCssFromXf, parseXlsWorkbook } from "../src/xls.js";
import { excelLegendKind } from "../src/excel-map.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cylDir = join(root, "public", "sample", "cylinder");

export const DEFAULT_PATHS = {
  step3Xls: join(cylDir, "iteration_0_cut_readable_map_step3_xfer.xls"),
  bind: join(cylDir, "stitch_map_bind.json"),
  outXls: join(cylDir, "iteration_0_cut_readable_map_step4_ring0.xls"),
};

const B_PLAIN = "rgb(204,255,255)";

function fail(msg) {
  throw new Error(`build-step4-ring0: ${msg}`);
}

function loadSheet(path, sheetName) {
  const book = parseXlsWorkbook(readFileSync(path));
  const step = book.sheets.find((s) => s.name.toLowerCase() === sheetName.toLowerCase());
  if (!step?.rows?.length) fail(`${path} is missing sheet ${sheetName}`);
  const needles = [];
  for (let c = 1; c < (step.rows[0] || []).length; c++) {
    const n = Number(step.rows[0][c]);
    if (!Number.isFinite(n)) continue;
    needles.push(n);
  }
  const rows = [];
  for (let r = 1; r < step.rows.length; r++) {
    const dir = String(step.rows[r]?.[0] ?? "");
    if (!dir) continue;
    const byCol = new Map();
    needles.forEach((needle, i) => {
      const sheetCol = i + 1;
      const token = String(step.rows[r][sheetCol] ?? "");
      const xfIndex = step.xfRows?.[r]?.[sheetCol];
      const xf = xfIndex == null ? null : book.styles?.xf?.[xfIndex] || null;
      const fill = fillCssFromXf(xf, book.styles?.palette) || null;
      byCol.set(needle, { col: needle, token, fill });
    });
    rows.push({
      dir,
      sheetRow: r,
      cells: needles.map((n) => byCol.get(n)),
    });
  }
  return {
    headerLabel: String(step.rows[0]?.[0] ?? "dir\\col"),
    needles,
    rows,
  };
}

/** First path-1 knit display_row. Ring 0 is every sheet row before that. */
export function ring0DisplayEnd(bind) {
  const faces = bind?.faces || [];
  const path0 = faces.filter((f) => f.path_index === 0);
  if (!path0.length) fail("bind has no path_index 0 face");
  const ring1 = faces
    .filter((f) => f.path_index === 1)
    .sort((a, b) => a.face_index - b.face_index)[0];
  if (!ring1) fail("bind has no path_index 1 face");
  const ring1Rows = (ring1.cells || [])
    .map((c) => c.display_row)
    .filter((n) => Number.isInteger(n));
  if (!ring1Rows.length) fail(`path 1 face ${ring1.face_index} has no display_row`);
  const rowEnd = Math.min(...ring1Rows);
  for (const face of path0) {
    for (const cell of face.cells || []) {
      if (cell.display_row >= rowEnd) {
        fail(`path 0 face ${face.face_index} display_row ${cell.display_row} is not before path 1`);
      }
    }
  }
  for (const face of faces) {
    if (!(face.path_index > 0)) continue;
    for (const cell of face.cells || []) {
      if (Number.isInteger(cell.display_row) && cell.display_row < rowEnd) {
        fail(`path ${face.path_index} face ${face.face_index} sits inside ring 0 at display_row ${cell.display_row}`);
      }
    }
  }
  return {
    rowEnd,
    ring1Face: ring1.face_index,
    path0First: Math.min(...path0.map((f) => f.face_index)),
    path0Last: Math.max(...path0.map((f) => f.face_index)),
  };
}

/** Inclusive display_row span of one bind path. `end` is exclusive. */
export function pathRowRange(bind, pathIndex) {
  const faces = (bind?.faces || []).filter((f) => f.path_index === pathIndex);
  if (!faces.length) fail(`bind has no path_index ${pathIndex} face`);
  let start = Infinity;
  let last = -Infinity;
  for (const face of faces) {
    for (const cell of face.cells || []) {
      if (!Number.isInteger(cell.display_row)) continue;
      start = Math.min(start, cell.display_row);
      last = Math.max(last, cell.display_row);
    }
  }
  if (!Number.isFinite(start)) fail(`path ${pathIndex} has no display_row`);
  return { pathIndex, start, end: last + 1, faces: faces.length };
}

/**
 * Absolute F/B arrow → step3 relative arrow.
 * Front keeps the machine direction and drops L/R. Back is mirrored.
 */
export function toRelativeToken(token) {
  const raw = String(token ?? "");
  const bed = raw.startsWith("F") ? "F" : raw.startsWith("B") ? "B" : "";
  const body = raw.replace(/^[FB](?=·|[.v^+\-←→↔])/, "");
  if (!bed) return body;
  const arrow = body.match(/^(←|→)[RL]?(\d+)?$/);
  if (!arrow) return body;
  const n = arrow[2] || "1";
  const dir = bed === "B" ? (arrow[1] === "←" ? "→" : "←") : arrow[1];
  return `${dir}${n}`;
}

/**
 * Sheet move token. One stitch keeps the arrow and drops the number:
 * F→R1 is F→, B←L1 is B←. Two or more stitches keep the count: F→2.
 */
export function absoluteMoveToken(bed, arrow, steps) {
  const n = Number(steps);
  if ((bed !== "F" && bed !== "B") || (arrow !== "←" && arrow !== "→") || !Number.isInteger(n) || n < 1) {
    fail(`bad move token ${bed} ${arrow} ${steps}`);
  }
  return n === 1 ? `${bed}${arrow}` : `${bed}${arrow}${n}`;
}

/**
 * Step3 relative arrow → absolute bed arrow.
 * F keeps the machine arrow (right-knit advance is →). B is the mirror.
 * A 1-stitch move omits the number.
 */
export function toAbsoluteToken(token, bed) {
  const raw = String(token ?? "");
  if (!raw || (bed !== "F" && bed !== "B")) return raw;
  const arrow = raw.match(/^(←|→)(\d+)$/);
  if (!arrow) return bed + raw;
  const dir = bed === "F" ? arrow[1] : arrow[1] === "←" ? "→" : "←";
  return absoluteMoveToken(bed, dir, Number(arrow[2]));
}

function occupied(row) {
  return (row?.cells || []).filter((c) => c?.token);
}

export function assertAlignedRow(step4Row, step3Row, step3Index) {
  const problems = [];
  if (step4Row.dir !== step3Row.dir) problems.push(`dir step4=${step4Row.dir} step3=${step3Row.dir}`);
  const a = occupied(step4Row);
  const b = occupied(step3Row);
  const cols4 = a.map((c) => c.col);
  const cols3 = b.map((c) => c.col);
  if (cols4.join(",") !== cols3.join(",")) {
    problems.push(`cols step4=[${cols4}] step3=[${cols3}]`);
  }
  const by3 = new Map(b.map((c) => [c.col, c]));
  for (const cell of a) {
    const other = by3.get(cell.col);
    const got = toRelativeToken(cell.token);
    const want = String(other?.token ?? "");
    const kind4 = excelLegendKind(cell.token, step4Row.dir);
    const kind3 = excelLegendKind(want, step3Row.dir);
    if (kind4 !== kind3) problems.push(`kind col ${cell.col}: step4=${kind4} step3=${kind3}`);
    if (got !== want) {
      problems.push(`label col ${cell.col}: step4=${JSON.stringify(cell.token)} relative=${JSON.stringify(got)} step3=${JSON.stringify(want)}`);
    }
  }
  if (problems.length) {
    fail(`row step3 ${step3Index} / step4 mismatch: ${problems.join("; ")}`);
  }
}

/**
 * Post-recenter ring-0 row: tokens still match step3, and both beds sit one
 * chart column to the right so column = phys on the front and 37 − phys on
 * the back.
 */
export function assertColumnShiftedRow(step4Row, step3Row, step3Index) {
  const problems = [];
  if (step4Row.dir !== step3Row.dir) problems.push(`dir step4=${step4Row.dir} step3=${step3Row.dir}`);
  const sheetOcc = occupied(step4Row);
  const stepOcc = occupied(step3Row);
  if (sheetOcc.length !== stepOcc.length) {
    problems.push(`count step4=${sheetOcc.length} step3=${stepOcc.length}`);
  }
  const cols = sheetOcc.map((c) => c.col);
  if (new Set(cols).size !== cols.length) problems.push(`duplicate display column [${cols}]`);
  const byChart = new Map();
  for (const cell of sheetOcc) {
    const bed = bedOf(cell.token);
    if (bed !== "F" && bed !== "B") {
      problems.push(`col ${cell.col} token ${cell.token} has no F/B`);
      continue;
    }
    const chart = chartColAfterRecenter(cell.col, bed);
    if (byChart.has(chart)) problems.push(`two cells claim chart ${chart}`);
    byChart.set(chart, cell);
    if (cell.phys != null) {
      const wantPhys = bed === "B" ? 36 - chart : chart + 1;
      if (cell.phys !== wantPhys) {
        problems.push(`phys chart ${chart}: ${cell.phys} !== ${wantPhys}`);
      }
    }
  }
  for (const cell of stepOcc) {
    const got = byChart.get(cell.col);
    if (!got) {
      problems.push(`missing chart col ${cell.col}`);
      continue;
    }
    const rel = toRelativeToken(got.token);
    if (rel !== String(cell.token ?? "")) {
      problems.push(`label chart ${cell.col}: sheet=${got.token} step3=${cell.token}`);
    }
    const bed = bedOf(got.token);
    const wantCol = displayColAfterRecenter(cell.col, bed);
    if (got.col !== wantCol) problems.push(`display chart ${cell.col}: sheet=${got.col} want=${wantCol}`);
  }
  if (problems.length) {
    fail(`row step3 ${step3Index} shifted mismatch: ${problems.join("; ")}`);
  }
}

function bedOf(token) {
  if (String(token).startsWith("F")) return "F";
  if (String(token).startsWith("B")) return "B";
  return "other";
}

export function summarizeRing0(rows) {
  return rows.map((row, i) => {
    const occ = occupied(row);
    const f = [];
    const b = [];
    let other = 0;
    for (const cell of occ) {
      const bed = bedOf(cell.token);
      const item = { col: cell.col, phys: cell.phys, token: cell.token, id: cell.id };
      if (bed === "F") f.push(item);
      else if (bed === "B") b.push(item);
      else other += 1;
    }
    const byCol = (list) => list.slice().sort((a, c) => a.col - c.col);
    const physOf = (list) => list.map((c) => c.phys).slice().sort((a, c) => a - c);
    return {
      display_row: i,
      dir: row.dir,
      n: occ.length,
      F: f.length,
      B: b.length,
      other,
      cols: occ.length ? [occ[0].col, occ[occ.length - 1].col] : [],
      fCols: byCol(f).map((c) => c.col),
      bCols: byCol(b).map((c) => c.col),
      fPhys: physOf(f),
      bPhys: physOf(b),
    };
  });
}

/** Step3 row → sheet row. The recenter X sits just after `recenterAfter`. */
export function sheetRowForStep3(step3Row, recenterAfter) {
  if (!Number.isInteger(step3Row) || !Number.isInteger(recenterAfter)) return step3Row;
  return step3Row > recenterAfter ? step3Row + 1 : step3Row;
}

/**
 * Sheet column for a ring-0 stitch. Front column is the physical needle.
 * Back column is the mirror, 37 − phys, before and after the recenter.
 * After the recenter that is chart+1 on both beds.
 */
export function columnForPhys(bed, phys) {
  if (bed === "F") return phys;
  if (bed === "B") return 37 - phys;
  fail(`column needs a bed, got ${bed}`);
}

/**
 * Ring 1 knit / wrap / flip column. Physical needles are unchanged
 * (front phys = chart + 1 after the ring-0 recenter). The sheet sits one
 * column left of that, on the step3 chart, so chart 0 is column 0.
 * Transfer rows do not use this: they keep columnForPhys, so the right
 * fold stays front at column 18. A decrease also draws the shaping-bed
 * stitch on the anchor itself, so the left shift starts at that needle
 * (sheet row 8 is F← on columns 6…18, chart 6 at column 7).
 */
export function columnForRing1(bed, phys) {
  return columnForPhys(bed, phys) - 1;
}

/** Knit rows use the chart column. X / X+ keep the physical-needle column. */
export function columnForRing1Row(dir, bed, phys) {
  if (dir === "X" || dir === "X+") return columnForPhys(bed, phys);
  return columnForRing1(bed, phys);
}

/**
 * After the recenter row, ring 0 draws both beds one column to the right.
 * Front phys + 1. Back phys − 1, and because the back is mirrored that is
 * also column + 1. Rings 1–4 are not passed through here.
 */
export function displayColAfterRecenter(chartCol, bed) {
  if (bed === "F" || bed === "B") return chartCol + 1;
  fail(`display column needs a bed, got ${bed} at chart ${chartCol}`);
}

/** Sheet column → step3 chart column, for a post-recenter ring-0 cell. */
export function chartColAfterRecenter(displayCol, bed) {
  if (bed === "F" || bed === "B") return displayCol - 1;
  fail(`chart column needs a bed, got ${bed} at display ${displayCol}`);
}

function parseIncN(label) {
  const m = String(label).match(/\+[RL](\d+)/);
  return m ? Number(m[1]) : 0;
}

function parseDecN(label) {
  const tagged = String(label).match(/-[RL](\d+)/);
  if (tagged) return Number(tagged[1]);
  const tail = String(label).match(/-(\d+)$/);
  return tail ? Number(tail[1]) : 0;
}

function knitOrderCells(row) {
  const sign = row.dir === "R" ? 1 : -1;
  return occupied(row).slice().sort((a, b) => (a.col - b.col) * sign);
}

function xferArrow(step, outward) {
  if (outward) return step === 1 ? "→" : "←";
  return step === 1 ? "←" : "→";
}

function passCols(live, pivot, step) {
  return [...live.keys()].filter((c) => (step === 1 ? c >= pivot : c <= pivot)).sort((a, b) => a - b);
}

function ints(from, to) {
  const out = [];
  const step = from <= to ? 1 : -1;
  for (let n = from; step > 0 ? n <= to : n >= to; n += step) out.push(n);
  return out;
}

function copyStitch(st) {
  return { id: st.id, bed: st.bed, phys: st.phys, chart: st.chart, birthChart: st.birthChart };
}

function assertNoSharedNeedle(stitches, where) {
  const seen = new Map();
  for (const st of stitches.values()) {
    const key = `${st.bed}:${st.phys}`;
    const prev = seen.get(key);
    if (prev != null) {
      fail(`${where}: 同一物理针两枚线圈 ${st.bed} 针 ${st.phys}（线圈 ${prev} 与 ${st.id}）`);
    }
    seen.set(key, st.id);
  }
}

function assertPhysFormula(stitches, backBase, where) {
  const shift = 37 - backBase;
  for (const st of stitches.values()) {
    if (st.bed === "B") {
      const want = backBase - st.chart;
      if (st.phys !== want) {
        fail(`${where}: 后床线圈 ${st.id} 列 ${st.chart} 物理针 ${st.phys}，换算应为 ${backBase}−列=${want}`);
      }
    } else if (st.bed === "F") {
      const want = st.chart + shift;
      if (st.phys !== want) {
        fail(`${where}: 前床线圈 ${st.id} 列 ${st.chart} 物理针 ${st.phys}，换算应为 列+${shift}=${want}`);
      }
    } else {
      fail(`${where}: 线圈 ${st.id} 没有床`);
    }
  }
}

function classifyBirth(col, prior, backBase, where) {
  if (!prior.length) {
    if (col <= 18) return { bed: "F", phys: col };
    return { bed: "B", phys: backBase - col };
  }
  let left = null;
  let right = null;
  for (const st of prior) {
    if (st.chart < col && (!left || st.chart > left.chart)) left = st;
    if (st.chart > col && (!right || st.chart < right.chart)) right = st;
  }
  const neigh = [left, right].filter(Boolean);
  if (!neigh.length) fail(`${where}: 新线圈列 ${col} 找不到已有线圈`);
  const beds = new Set(neigh.map((s) => s.bed));
  if (beds.size !== 1) {
    const side = (st) => (st ? `${st.bed} 列 ${st.chart}` : "空");
    fail(`${where}: 新线圈列 ${col} 夹在 ${side(left)} 与 ${side(right)} 之间，床位无法跟着线圈走`);
  }
  const bed = neigh[0].bed;
  const shift = 37 - backBase;
  return { bed, phys: bed === "B" ? backBase - col : col + shift };
}

function snapshotSources(ids, stitches) {
  const snap = new Map();
  for (const [col, id] of ids) {
    const st = stitches.get(id);
    if (!st) fail(`missing stitch ${id} at col ${col}`);
    snap.set(col, copyStitch(st));
  }
  return snap;
}

/** Chart update matches readable_map_steps._advance_live. Phys follows the bed. */
function applyChartMove(live, stitches, pivot, step, delta) {
  const next = new Map();
  for (const [col, id] of live) {
    let dest = col;
    if (step === 1 && col >= pivot) dest = col + delta;
    if (step === -1 && col <= pivot) dest = col + delta;
    if (next.has(dest)) fail(`transfer collision at col ${dest}`);
    const st = stitches.get(id);
    const chartDelta = dest - col;
    if (chartDelta !== 0) {
      if (st.bed === "F") st.phys += chartDelta;
      else if (st.bed === "B") st.phys -= chartDelta;
      else fail(`stitch ${id} has no bed during transfer`);
      st.chart = dest;
    }
    next.set(dest, id);
  }
  return next;
}

function applyRecenter(stitches) {
  const moves = [];
  for (const st of [...stitches.values()].sort((a, b) => a.chart - b.chart || a.id - b.id)) {
    const fromPhys = st.phys;
    if (st.bed === "F") st.phys += 1;
    else if (st.bed === "B") st.phys -= 1;
    else fail(`recenter stitch ${st.id} has no bed`);
    moves.push({
      id: st.id,
      bed: st.bed,
      col: st.chart,
      fromPhys,
      toPhys: st.phys,
      token: absoluteMoveToken(st.bed, st.bed === "F" ? "→" : "←", 1),
    });
  }
  return moves;
}

/**
 * Replay ring 0. Column identity follows the step3 X / X+ passes.
 * Physical needles follow 37 − column until the recenter after the
 * increase, then 36 − column. The recenter does not change chart columns.
 */
export function simulateRing0(step3Rows, rowEnd) {
  const ops = [];
  let pending = [];
  for (let i = 0; i < rowEnd; i++) {
    const dir = step3Rows[i].dir;
    if (dir === "X" || dir === "X+") pending.push(i);
    else if (dir === "R" || dir === "L") {
      ops.push({ knit: i, xfers: pending });
      pending = [];
    } else if (dir === "Flip") {
      fail(`ring 0 step3 row ${i} is Flip`);
    } else {
      fail(`unexpected step3 dir ${dir} inside ring 0 row ${i}`);
    }
  }
  if (pending.length) {
    fail(`ring 0 ends on a transfer row (${pending.join(",")}); that pass belongs to the next ring`);
  }

  let live = new Map();
  const stitches = new Map();
  const atRow = new Map();
  let nextId = 0;
  let backBase = 37;
  let recenterAfter = null;
  let recenterMoves = null;
  let increaseKnits = 0;
  const liveAt = [];
  const rememberLive = (label) => {
    const fPhys = [];
    const bPhys = [];
    for (const st of stitches.values()) {
      if (st.bed === "F") fPhys.push(st.phys);
      else bPhys.push(st.phys);
    }
    fPhys.sort((a, b) => a - b);
    bPhys.sort((a, b) => a - b);
    liveAt.push({ label, F: fPhys.length, B: bPhys.length, fPhys, bPhys });
  };

  for (const op of ops) {
    const krow = step3Rows[op.knit];
    const step = krow.dir === "R" ? 1 : -1;
    const kcells = knitOrderCells(krow);
    const incs = kcells.filter((c) => parseIncN(c.token));
    const decs = kcells.filter((c) => {
      const kind = excelLegendKind(c.token, krow.dir);
      return (kind === "decrease" || kind === "wrap-dec") && parseDecN(c.token);
    });
    const predicted = [];

    for (const cell of decs.slice().reverse()) {
      const n = Math.max(1, parseDecN(cell.token));
      const last = cell.col + step;
      for (let k = 0; k < n; k++) {
        const pivot = last - k * step;
        const cols = passCols(live, pivot, step);
        const arrow = xferArrow(step, false);
        const ids = new Map(cols.map((col) => [col, live.get(col)]));
        predicted.push({ dir: "X", arrow, cols, ids, snap: snapshotSources(ids, stitches) });
        live = applyChartMove(live, stitches, pivot, step, step === 1 ? -1 : 1);
        assertNoSharedNeedle(stitches, `step3 行 ${op.knit} 减针移圈后`);
        assertPhysFormula(stitches, backBase, `step3 行 ${op.knit} 减针移圈后`);
      }
    }
    for (const cell of incs.slice().reverse()) {
      const added = parseIncN(cell.token);
      const pivot0 = cell.col + step;
      const fresh = [];
      for (let g = 1; g <= added; g++) fresh.push(cell.col + step * g);
      const arrow = xferArrow(step, true);
      for (let k = 0; k < added; k++) {
        const cols = passCols(live, pivot0, step);
        for (const ncol of fresh) if (!cols.includes(ncol)) cols.push(ncol);
        cols.sort((a, b) => a - b);
        const ids = new Map();
        for (const col of cols) {
          if (!live.has(col)) fail(`X+ col ${col} on knit row ${op.knit} is not a live stitch`);
          ids.set(col, live.get(col));
        }
        predicted.push({ dir: "X+", arrow, cols, ids, snap: snapshotSources(ids, stitches) });
        live = applyChartMove(live, stitches, pivot0, step, step === 1 ? 1 : -1);
        assertNoSharedNeedle(stitches, `step3 行 ${op.knit} 加针移圈后`);
        assertPhysFormula(stitches, backBase, `step3 行 ${op.knit} 加针移圈后`);
      }
    }

    if (predicted.length !== op.xfers.length) {
      fail(`knit row ${op.knit}: simulated ${predicted.length} transfer passes, sheet has ${op.xfers.length}`);
    }
    op.xfers.forEach((ri, pi) => {
      const sheet = step3Rows[ri];
      const got = occupied(sheet);
      const want = predicted[pi];
      const problems = [];
      if (sheet.dir !== want.dir) problems.push(`dir sheet=${sheet.dir} sim=${want.dir}`);
      if (got.map((c) => c.col).join(",") !== want.cols.join(",")) {
        problems.push(`cols sheet=${got.map((c) => c.col)} sim=${want.cols}`);
      }
      for (const cell of got) {
        if (cell.token !== `${want.arrow}1`) problems.push(`token col ${cell.col} sheet=${cell.token} sim=${want.arrow}1`);
      }
      if (problems.length) fail(`transfer row ${ri} (knit ${op.knit} pass ${pi}): ${problems.join("; ")}`);
      atRow.set(ri, want.snap);
    });

    const prior = [...live.values()].map((id) => copyStitch(stitches.get(id)));
    const knitSnap = new Map();
    for (const cell of kcells) {
      let id = live.get(cell.col);
      if (id == null) {
        const placed = classifyBirth(cell.col, prior, backBase, `step3 行 ${op.knit}`);
        id = nextId;
        nextId += 1;
        const st = {
          id,
          bed: placed.bed,
          phys: placed.phys,
          chart: cell.col,
          birthChart: cell.col,
        };
        stitches.set(id, st);
        live.set(cell.col, id);
        assertNoSharedNeedle(stitches, `step3 行 ${op.knit} 新线圈列 ${cell.col}`);
        assertPhysFormula(stitches, backBase, `step3 行 ${op.knit} 新线圈列 ${cell.col}`);
      }
      const st = stitches.get(id);
      if (st.chart !== cell.col) fail(`step3 行 ${op.knit} 列 ${cell.col} 线圈 ${id} 的列是 ${st.chart}`);
      knitSnap.set(cell.col, { ...copyStitch(st), token: cell.token });
    }
    atRow.set(op.knit, knitSnap);
    rememberLive(`step3 行 ${op.knit} ${krow.dir} 织完`);

    if (incs.length) {
      increaseKnits += 1;
      if (recenterAfter != null) fail(`step3 行 ${op.knit}: ring 0 出现第二次加针，回正换算只定义了一次`);
      recenterMoves = applyRecenter(stitches);
      backBase -= 1;
      recenterAfter = op.knit;
      assertNoSharedNeedle(stitches, `回正行（插在 step3 行 ${op.knit} 之后）`);
      assertPhysFormula(stitches, backBase, `回正行（插在 step3 行 ${op.knit} 之后）`);
      rememberLive(`回正行（step3 行 ${op.knit} 之后）`);
    }
  }

  if (increaseKnits !== 1 || recenterAfter == null || !recenterMoves) {
    fail(`ring 0 expected one increase recenter, got ${increaseKnits}`);
  }
  if (backBase !== 36) fail(`after recenter back base is ${backBase}, expected 36`);

  const r0 = atRow.get(0);
  const r2 = atRow.get(2);
  const r3 = atRow.get(3);
  const at = (snap, col, where) => {
    const st = snap?.get(col);
    if (!st) fail(`${where} 列 ${col} 没有线圈`);
    return st;
  };
  const s = at(r2, 18, "step3 行 2 vL");
  const br = at(r2, 19, "step3 行 2 ^R");
  const v = at(r2, 20, "step3 行 2 +R1");
  const s0 = at(r0, 19, "step3 行 0 列 19");
  const v0 = at(r0, 20, "step3 行 0 列 20");
  if (s.id !== s0.id) fail(`行 2 列 18 线圈 ${s.id} 不是行 0 列 19 的线圈 ${s0.id}`);
  if (v.id !== v0.id) fail(`行 2 列 20 线圈 ${v.id} 不是行 0 列 20 的线圈 ${v0.id}`);
  if (s.token !== "vL" || s.bed !== "B" || s.phys !== 19) {
    fail(`行 2 vL 列 18 应为后床 19，得到 ${s.token} ${s.bed} ${s.phys}`);
  }
  if (br.token !== "^R" || br.bed !== "B" || br.phys !== 18) {
    fail(`行 2 B^R 列 19 应为后床 18，得到 ${br.token} ${br.bed} ${br.phys}`);
  }
  if (v.token !== "+R1" || v.bed !== "B" || v.phys !== 17) {
    fail(`行 2 V 列 20 应为后床 17，得到 ${v.token} ${v.bed} ${v.phys}`);
  }
  const moved = new Map(recenterMoves.map((m) => [m.id, m]));
  for (const [st, from, to] of [
    [s, 19, 18],
    [br, 18, 17],
    [v, 17, 16],
  ]) {
    const m = moved.get(st.id);
    if (!m || m.fromPhys !== from || m.toPhys !== to || m.bed !== "B" || m.token !== "B←") {
      fail(`回正移圈线圈 ${st.id} 期望 ${from}→${to}，得到 ${m ? `${m.fromPhys}→${m.toPhys} ${m.token}` : "缺失"}`);
    }
  }
  const caret = at(r3, 18, "step3 行 3 ^L");
  const v3 = at(r3, 20, "step3 行 3 列 20");
  const fresh = at(r3, 21, "step3 行 3 列 21");
  if (caret.id !== s.id || caret.token !== "^L" || caret.bed !== "B" || caret.phys !== 18) {
    fail(`行 3 ^L 列 18 应仍是 S、后床 18，得到 id ${caret.id} ${caret.token} ${caret.bed} ${caret.phys}`);
  }
  if (v3.id !== v.id || v3.bed !== "B" || v3.phys !== 16) {
    fail(`行 3 列 20 应仍是 V、后床 16，得到 id ${v3.id} ${v3.bed} ${v3.phys}`);
  }
  if (fresh.bed !== "B" || fresh.phys !== 15 || r2.has(21)) {
    fail(`行 3 列 21 新针应为后床 15，得到 ${fresh.bed} ${fresh.phys}`);
  }

  const fMoves = recenterMoves.filter((m) => m.bed === "F");
  const bMoves = recenterMoves.filter((m) => m.bed === "B");
  if (fMoves.map((m) => m.col).join(",") !== ints(-1, 17).join(",")) {
    fail(`回正前床列应为 -1…17，得到 ${fMoves.map((m) => m.col)}`);
  }
  if (bMoves.map((m) => m.col).join(",") !== "18,19,20") {
    fail(`回正后床列应为 18,19,20，得到 ${bMoves.map((m) => m.col)}`);
  }
  for (const m of fMoves) {
    if (m.token !== "F→" || m.toPhys !== m.fromPhys + 1 || m.fromPhys !== m.col) {
      fail(`回正前床列 ${m.col} 应从物理针 ${m.col} 以 F→ 移到 ${m.col + 1}，得到 ${m.fromPhys}→${m.toPhys} ${m.token}`);
    }
  }
  for (const m of bMoves) {
    if (m.token !== "B←" || m.toPhys !== m.fromPhys - 1) {
      fail(`回正后床列 ${m.col} 应 B←，得到 ${m.token} ${m.fromPhys}→${m.toPhys}`);
    }
  }

  const fronts = [...stitches.values()].filter((st) => st.bed === "F");
  const backs = [...stitches.values()].filter((st) => st.bed === "B");
  const fPhys = fronts.map((st) => st.phys).sort((a, b) => a - b);
  const bPhys = backs.map((st) => st.phys).sort((a, b) => a - b);
  const fCharts = fronts.map((st) => st.chart).sort((a, b) => a - b);
  const bCharts = backs.map((st) => st.chart).sort((a, b) => a - b);
  if (fPhys.join(",") !== ints(0, 18).join(",")) fail(`结束前床物理针应为 0…18，得到 ${fPhys}`);
  if (bPhys.join(",") !== ints(0, 18).join(",")) fail(`结束后床物理针应为 0…18，得到 ${bPhys}`);
  if (fCharts.join(",") !== ints(-1, 17).join(",")) fail(`结束前床列应为 -1…17，得到 ${fCharts}`);
  if (bCharts.join(",") !== ints(18, 36).join(",")) fail(`结束后床列应为 18…36，得到 ${bCharts}`);
  for (const st of fronts) {
    if (st.phys !== st.birthChart) fail(`前床线圈 ${st.id} 回正后物理针 ${st.phys} 不是出生列 ${st.birthChart}`);
  }
  const frontEnd = Math.max(...fPhys);
  const backStart = Math.max(...bPhys);
  if (frontEnd !== 18 || backStart !== 18) {
    fail(`结束时前床终点 ${frontEnd}、后床起点 ${backStart}，应都在 18`);
  }
  if (fronts.length !== 19 || backs.length !== 19) {
    fail(`结束应为 F19 B19，得到 F${fronts.length} B${backs.length}`);
  }

  return {
    N: fronts.length + backs.length,
    front: fronts.length,
    back: backs.length,
    frontPhys: fPhys,
    backPhys: bPhys,
    frontEnd,
    backStart,
    foldBoth18: frontEnd === 18 && backStart === 18,
    backBaseBefore: 37,
    backBaseAfter: backBase,
    recenterAfter,
    recenterMoves,
    atRow,
    anchors: { s, br, v, caret, v3, fresh },
    liveAt,
  };
}

const FLIP_FILL = "rgb(153,153,255)";

function listsOf(stitches) {
  const f = [];
  const b = [];
  for (const st of stitches.values()) (st.bed === "F" ? f : b).push(st);
  f.sort((a, c) => a.phys - c.phys || a.id - c.id);
  b.sort((a, c) => a.phys - c.phys || a.id - c.id);
  return { f, b, N: f.length + b.length };
}

function isContig(arr) {
  return arr.every((st, i) => i === 0 || st.phys === arr[i - 1].phys + 1);
}

/**
 * Recompute the target from the stitches still on the beds: F = ceil(N/2),
 * B = floor(N/2). One adjacent fold flip, or none, must already land there,
 * with the front bed still starting at needle 0. The back span is not a
 * fixed window (neither 0…B−1 nor (F−B)…F−1). More than one such result is
 * an uncovered choice.
 */
function rebalanceRing(stitches, anchorChart, where) {
  const saved = [...stitches.values()].map((st) => [st.id, st.bed, st.phys]);
  const restore = () => {
    for (const [id, bed, phys] of saved) {
      const st = stitches.get(id);
      st.bed = bed;
      st.phys = phys;
    }
  };
  const measure = () => {
    const { f, b, N } = listsOf(stitches);
    const tF = Math.ceil(N / 2);
    const tB = Math.floor(N / 2);
    if (f.length !== tF || b.length !== tB || !isContig(f) || !isContig(b)) return null;
    if (f[0].phys !== 0 || f.at(-1).phys !== tF - 1) return null;
    return 0;
  };
  const base = listsOf(stitches);
  const flips = [{ kind: "none" }];
  if (base.f.length && base.b.length) {
    const add = (side, src, toBed, destPhys) => {
      if (Math.abs(src.phys - destPhys) > 1) return;
      const occ = toBed === "F" ? base.f : base.b;
      if (occ.some((st) => st.phys === destPhys)) return;
      flips.push({
        kind: "flip",
        side,
        id: src.id,
        fromBed: src.bed,
        fromPhys: src.phys,
        toBed,
        toPhys: destPhys,
        chart: src.chart,
      });
    };
    add("right", base.b.at(-1), "F", base.f.at(-1).phys + 1);
    add("left", base.b[0], "F", base.f[0].phys - 1);
    add("right", base.f.at(-1), "B", base.b.at(-1).phys + 1);
    add("left", base.f[0], "B", base.b[0].phys - 1);
  }
  const hits = [];
  for (const flip of flips) {
    restore();
    if (flip.kind === "flip") {
      const st = stitches.get(flip.id);
      st.bed = flip.toBed;
      st.phys = flip.toPhys;
    }
    const k = measure();
    if (k != null) hits.push({ flip: flip.kind === "flip" ? flip : null, k });
  }
  restore();
  if (hits.length !== 1) {
    const { f, b, N } = listsOf(stitches);
    const described = hits.map((h) => (h.flip ? `${h.flip.side} ${h.flip.fromBed}${h.flip.fromPhys}→${h.flip.toBed}${h.flip.toPhys} 回正${h.k}` : `不翻针 回正${h.k}`));
    fail(
      `${where}: 折返对齐有 ${hits.length} 种结果（目标 F${Math.ceil(N / 2)} B${Math.floor(N / 2)}，现 F${f.length}[${base.f.map((s) => s.phys)}] B${b.length}[${base.b.map((s) => s.phys)}]，锚点列 ${anchorChart}）${described.length ? `：${described.join("；")}` : ""}`,
    );
  }
  const best = hits[0];
  if (best.flip) {
    const st = stitches.get(best.flip.id);
    st.bed = best.flip.toBed;
    st.phys = best.flip.toPhys;
  }
  if (best.k > 0) {
    for (const st of stitches.values()) st.phys += st.bed === "F" ? best.k : -best.k;
  }
  assertNoSharedNeedle(stitches, where);
  return best;
}

function sparseCells(list) {
  const placed = new Map();
  for (const cell of list) {
    if (placed.has(cell.col)) {
      const prev = placed.get(cell.col);
      fail(`表列 ${cell.col} 冲突（step3 列 ${prev.chart} 与 ${cell.chart}）`);
    }
    placed.set(cell.col, cell);
  }
  return placed;
}

/**
 * Ring 1 only. Starts from the ring-0 end (F19/B19, charts −1…36).
 * Negative step3 columns wrap onto the back-bed tail (low phys → high
 * sheet column). Stops on an uncovered shaping instead of guessing.
 */
export function simulateRing1(step3Rows, rowStart, rowEnd) {
  const stitches = new Map();
  const live = new Map();
  let nextId = 0;
  for (let chart = -1; chart <= 17; chart++) {
    const id = nextId++;
    stitches.set(id, { id, bed: "F", phys: chart + 1, chart });
    live.set(chart, id);
  }
  for (let chart = 18; chart <= 36; chart++) {
    const id = nextId++;
    stitches.set(id, { id, bed: "B", phys: 36 - chart, chart });
    live.set(chart, id);
  }
  const byRow = new Map();
  const inserts = [];
  const events = [];
  const trace = [];
  let decAnchor = null;

  const snapshotCounts = (label) => {
    const { f, b, N } = listsOf(stitches);
    trace.push({
      label,
      N,
      F: f.length,
      B: b.length,
      fPhys: f.map((st) => st.phys),
      bPhys: b.map((st) => st.phys),
    });
  };

  const drawKnit = (row, ri) => {
    const cells = occupied(row);
    const negs = cells.filter((c) => c.col < 0).sort((a, b) => b.col - a.col);
    const tail = [...stitches.values()].filter((st) => st.bed === "B").sort((a, b) => a.phys - b.phys || a.id - b.id);
    const used = new Set();
    const placed = [];
    negs.forEach((cell, i) => {
      const st = tail[i];
      if (!st) fail(`step3 行 ${ri} 负列 ${cell.col} 超出后床末尾（后床只有 ${tail.length} 针）`);
      if (used.has(st.id)) fail(`step3 行 ${ri} 负列 ${cell.col} 与本行已有圈冲突`);
      used.add(st.id);
      const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
      placed.push({
        col: columnForRing1(st.bed, st.phys),
        token: painted.token,
        fill: painted.fill,
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        chart: cell.col,
        wrap: true,
      });
    });
    const births = [];
    for (const cell of cells) {
      if (cell.col < 0) continue;
      const id = live.get(cell.col);
      if (id != null) {
        if (used.has(id)) fail(`step3 行 ${ri} 列 ${cell.col} 与绕回的是同一个圈 ${id}`);
        used.add(id);
        const st = stitches.get(id);
        const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
        placed.push({
          col: columnForRing1(st.bed, st.phys),
          token: painted.token,
          fill: painted.fill,
          phys: st.phys,
          bed: st.bed,
          id: st.id,
          chart: cell.col,
        });
      } else births.push(cell);
    }
    if (births.length > 1) fail(`step3 行 ${ri} 一行多针新生，列 ${births.map((c) => c.col).join(",")}`);
    for (const cell of births) {
      let left = null;
      let right = null;
      for (const st of stitches.values()) {
        if (st.chart < cell.col && (!left || st.chart > left.chart)) left = st;
        if (st.chart > cell.col && (!right || st.chart < right.chart)) right = st;
      }
      let bed;
      let phys;
      if (left && right) {
        if (left.bed !== right.bed) {
          fail(`step3 行 ${ri} 新圈列 ${cell.col} 夹在 ${left.bed}${left.phys} 与 ${right.bed}${right.phys} 之间`);
        }
        bed = left.bed;
        if (bed === "F") {
          if (right.phys !== left.phys + 2) fail(`step3 行 ${ri} 新圈列 ${cell.col} 前床空档 ${left.phys}…${right.phys}`);
          phys = left.phys + 1;
        } else if (left.phys === right.phys + 2) phys = right.phys + 1;
        else fail(`step3 行 ${ri} 新圈列 ${cell.col} 后床空档 ${left.phys}…${right.phys}`);
      } else if (left) {
        bed = left.bed;
        const sign = Math.sign(cell.col - left.chart);
        phys = left.phys + (bed === "F" ? sign : -sign);
        if ([...stitches.values()].some((st) => st.bed === bed && st.phys === phys)) {
          fail(`step3 行 ${ri} 新圈延伸到已被占用的 ${bed}${phys}`);
        }
      } else fail(`step3 行 ${ri} 新圈列 ${cell.col} 找不到相邻线圈`);
      const id = nextId++;
      const st = { id, bed, phys, chart: cell.col };
      stitches.set(id, st);
      live.set(cell.col, id);
      const painted = paintToken(cell, toAbsoluteToken(cell.token, bed));
      placed.push({
        col: columnForRing1(bed, phys),
        token: painted.token,
        fill: painted.fill,
        phys,
        bed,
        id,
        chart: cell.col,
        birth: true,
      });
    }
    const wraps = placed.filter((cell) => cell.wrap);
    if (wraps.length) {
      const ontoBack = wraps.reduce((best, cell) => (cell.chart > best.chart ? cell : best));
      const beforeFold = placed
        .filter((cell) => !cell.wrap)
        .reduce((best, cell) => (best == null || cell.chart < best.chart ? cell : best), null);
      if (beforeFold && ontoBack.col !== beforeFold.col) {
        ontoBack.foldLink = beforeFold.col;
        beforeFold.foldLink = ontoBack.col;
      }
    }
    return { placed: sparseCells(placed), births };
  };

  const shapingBedForMove = (cols, delta) => {
    for (const col of cols) {
      const dest = col + delta;
      if (cols.includes(dest) || !live.has(dest)) continue;
      const st = stitches.get(live.get(col));
      const onto = stitches.get(live.get(dest));
      if (st.bed !== onto.bed) fail(`step3 行移圈把 ${st.bed}${st.phys} 叠到 ${onto.bed}${onto.phys}`);
      return st.bed;
    }
    if (delta < 0) fail(`减针移圈没有叠到范围外的针`);
    const edge = Math.min(...cols);
    const st = stitches.get(live.get(edge));
    if (!st) fail(`加针移圈列 ${edge} 没有线圈`);
    return st.bed;
  };

  const drawMove = (row, ri) => {
    const cells = occupied(row);
    if (!cells.length) fail(`step3 行 ${ri} 移圈是空的`);
    const token = cells[0].token;
    if (!cells.every((cell) => cell.token === token)) fail(`step3 行 ${ri} 移圈符号不一致`);
    const arrow = token.match(/^(←|→)(\d+)$/);
    if (!arrow) fail(`step3 行 ${ri} 移圈符号 ${token} 无法换算`);
    if (Number(arrow[2]) !== 1) fail(`step3 行 ${ri} 是多针移圈 ${token}`);
    const delta = arrow[1] === "→" ? 1 : -1;
    let cols = cells.map((cell) => cell.col).sort((a, b) => (delta < 0 ? a - b : b - a));
    for (const col of cols) {
      if (!live.has(col)) fail(`step3 行 ${ri} 移圈列 ${col} 没有线圈`);
    }
    const shapeBed = shapingBedForMove(cols, delta);
    if (delta < 0) {
      const start = Math.min(...cols);
      if (decAnchor == null) fail(`step3 行 ${ri} 减针移圈没有锚点`);
      if (decAnchor !== start - 1) fail(`step3 行 ${ri} 减针锚点 ${decAnchor} 不挨着移圈起点 ${start}`);
      if (!live.has(decAnchor)) fail(`step3 行 ${ri} 减针锚点 ${decAnchor} 没有线圈`);
      const anchor = stitches.get(live.get(decAnchor));
      if (anchor.bed !== shapeBed) {
        fail(`step3 行 ${ri} 减针锚点在 ${anchor.bed}${anchor.phys}，成形床是 ${shapeBed}`);
      }
      cols = [decAnchor, ...cols];
    }
    const placed = [];
    const consumed = [];
    for (const col of cols) {
      const st = stitches.get(live.get(col));
      if (st.bed !== shapeBed) continue;
      placed.push({
        col: columnForPhys(st.bed, st.phys),
        token: toAbsoluteToken(token, st.bed),
        fill: cells.find((cell) => cell.col === col)?.fill || cells[0].fill || "rgb(204,204,255)",
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        chart: col,
      });
    }
    const drawn = sparseCells(placed);
    for (const col of cols) {
      const id = live.get(col);
      const st = stitches.get(id);
      const dest = col + delta;
      const onShape = st.bed === shapeBed;
      live.delete(col);
      if (live.has(dest)) {
        if (!onShape) fail(`step3 行 ${ri} 非成形床列 ${col} 的 chart 撞上 ${dest}`);
        if (row.dir === "X+") fail(`step3 行 ${ri} 加针移圈在列 ${dest} 撞针`);
        const onto = stitches.get(live.get(dest));
        if (st.bed !== onto.bed) fail(`step3 行 ${ri} 跨床减针 ${st.bed}${st.phys} → ${onto.bed}${onto.phys}`);
        consumed.push({ bed: st.bed, phys: st.phys, ontoBed: onto.bed, ontoPhys: onto.phys });
        stitches.delete(id);
      } else {
        if (onShape) st.phys += st.bed === "F" ? delta : -delta;
        st.chart = dest;
        live.set(dest, id);
      }
    }
    assertNoSharedNeedle(stitches, `step3 行 ${ri} 移圈后`);
    return { drawn, consumed };
  };

  const insertRepair = (anchor, where, step3After) => {
    const before = [...stitches.values()].map((st) => ({
      id: st.id,
      bed: st.bed,
      phys: st.phys,
    }));
    const best = rebalanceRing(stitches, anchor, where);
    const cells = [];
    if (best.flip) {
      const src = before.find((st) => st.id === best.flip.id);
      cells.push({
        col: columnForRing1(src.bed, src.phys),
        token: `${src.bed}↔${best.flip.toBed}`,
        fill: FLIP_FILL,
        phys: src.phys,
        bed: src.bed,
        id: src.id,
        chart: null,
      });
    }
    if (best.k > 0) {
      const afterFlip = new Map(before.map((st) => [st.id, { ...st }]));
      if (best.flip) {
        const flipped = afterFlip.get(best.flip.id);
        flipped.bed = best.flip.toBed;
        flipped.phys = best.flip.toPhys;
      }
      for (const src of afterFlip.values()) {
        const moveCol = columnForRing1(src.bed, src.phys);
        if (cells.some((cell) => cell.col === moveCol)) {
          fail(`${where}: 翻针和回正落在同一表列 ${moveCol}`);
        }
        cells.push({
          col: moveCol,
          token: absoluteMoveToken(src.bed, src.bed === "F" ? "→" : "←", best.k),
          fill: "rgb(204,204,255)",
          phys: src.phys,
          bed: src.bed,
          id: src.id,
          chart: null,
        });
      }
    }
    events.push({ after: step3After, flip: best.flip, k: best.k, where });
    if (cells.length) {
      inserts.push({
        after: step3After,
        dir: best.k > 0 ? "X" : "Flip",
        cells: sparseCells(cells),
      });
    }
    return best;
  };

  snapshotCounts("第二圈开始");
  for (let i = rowStart; i < rowEnd; i++) {
    const row = step3Rows[i];
    if (row.dir === "X" || row.dir === "X+") {
      const moved = drawMove(row, i);
      byRow.set(i, { dir: row.dir, step3: i, cells: moved.drawn });
      snapshotCounts(`step3 行 ${i} ${row.dir}`);
      if (row.dir === "X") {
        insertRepair(decAnchor ?? 0, `step3 行 ${i} 减针后`, i);
        decAnchor = null;
        snapshotCounts(`step3 行 ${i} 减针对齐后`);
      }
      continue;
    }
    if (row.dir !== "R" && row.dir !== "L") fail(`step3 行 ${i} 方向 ${row.dir} 不在第二圈规则里`);
    const dec = occupied(row).find((cell) => parseDecN(cell.token));
    const inc = occupied(row).find((cell) => parseIncN(cell.token));
    if (dec && parseDecN(dec.token) !== 1) fail(`step3 行 ${i} 多针减针 ${dec.token}`);
    if (inc && parseIncN(inc.token) !== 1) fail(`step3 行 ${i} 多针加针 ${inc.token}`);
    if (dec) decAnchor = dec.col;
    const knit = drawKnit(row, i);
    byRow.set(i, { dir: row.dir, step3: i, cells: knit.placed });
    assertNoSharedNeedle(stitches, `step3 行 ${i} 织完`);
    if (inc || knit.births.length) {
      const anchor = inc ? inc.col : knit.births[0].col;
      insertRepair(anchor, `step3 行 ${i} 加针后`, i);
    } else {
      const { f, b, N } = listsOf(stitches);
      if (f.length !== Math.ceil(N / 2) || b.length !== Math.floor(N / 2) || !isContig(f) || !isContig(b) || f[0].phys !== 0) {
        fail(`step3 行 ${i} 平针之后 F${f.length} B${b.length} 不在 F=ceil(N/2)、左折返前床 0`);
      }
    }
    snapshotCounts(`step3 行 ${i} ${row.dir}`);
  }
  const end = listsOf(stitches);
  return { byRow, inserts, events, trace, end };
}

function paintToken(cell, token) {
  if (!token) return { token: "", fill: cell.fill || "rgb(192,192,192)" };
  const glyph = token.replace(/^[FB](?=·|[.v^+\-←→↔])/, "");
  let fill = cell.fill;
  if ((glyph === "·" || glyph === ".") && token.startsWith("B")) fill = B_PLAIN;
  return { token, fill };
}

function icvForFill(fill) {
  const m = String(fill || "").match(/rgb\((\d+),(\d+),(\d+)\)/i);
  if (!m) return null;
  const rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
  const idx = BIFF8_DEFAULT_PALETTE.findIndex(
    (c, i) => i < 64 && c[0] === rgb[0] && c[1] === rgb[1] && c[2] === rgb[2],
  );
  if (idx < 0) fail(`no BIFF palette entry for ${fill}`);
  return idx;
}

function rec(opcode, payload) {
  const body = Buffer.from(payload);
  const out = Buffer.alloc(4 + body.length);
  out.writeUInt16LE(opcode, 0);
  out.writeUInt16LE(body.length, 2);
  body.copy(out, 4);
  return out;
}

function bof(dt) {
  const data = Buffer.alloc(16);
  data.writeUInt16LE(0x0600, 0);
  data.writeUInt16LE(dt, 2);
  data.writeUInt16LE(0x0dbb, 4);
  data.writeUInt16LE(1996, 6);
  return rec(0x0809, data);
}

function eof() {
  return rec(0x000a, Buffer.alloc(0));
}

function xfRecord(icvFore) {
  const data = Buffer.alloc(20);
  data.writeUInt16LE((1 << 10) & 0xffff, 16);
  data.writeUInt16LE(icvFore & 0x7f, 18);
  return rec(0x00e0, data);
}

function labelRecord(row, col, xf, text) {
  const s = String(text ?? "");
  const data = Buffer.alloc(9 + s.length * 2);
  data.writeUInt16LE(row, 0);
  data.writeUInt16LE(col, 2);
  data.writeUInt16LE(xf, 4);
  data.writeUInt16LE(s.length, 6);
  data.writeUInt8(1, 8);
  for (let i = 0; i < s.length; i++) data.writeUInt16LE(s.charCodeAt(i), 9 + i * 2);
  return rec(0x0204, data);
}

function numberRecord(row, col, xf, value) {
  const data = Buffer.alloc(14);
  data.writeUInt16LE(row, 0);
  data.writeUInt16LE(col, 2);
  data.writeUInt16LE(xf, 4);
  data.writeDoubleLE(value, 6);
  return rec(0x0203, data);
}

function boundsheet(offset, name) {
  const data = Buffer.alloc(8 + name.length);
  data.writeUInt32LE(offset, 0);
  data.writeUInt8(name.length, 6);
  data.write(name, 8, "latin1");
  return rec(0x0085, data);
}

function sheetFromGrid(name, headerLabel, needles, rows, xfIndexForFill) {
  const parts = [bof(0x0010)];
  const xf0 = xfIndexForFill("rgb(255,255,255)");
  parts.push(labelRecord(0, 0, xf0, headerLabel));
  needles.forEach((n, i) => parts.push(numberRecord(0, i + 1, xf0, n)));
  rows.forEach((row, i) => {
    const sheetRow = i + 1;
    parts.push(labelRecord(sheetRow, 0, xf0, row.dir));
    row.cells.forEach((cell, c) => {
      const fill = cell.fill || (cell.token ? null : "rgb(192,192,192)");
      const xf = xfIndexForFill(fill || "rgb(255,255,255)");
      parts.push(labelRecord(sheetRow, c + 1, xf, cell.token || ""));
    });
  });
  parts.push(eof());
  return { name, bytes: Buffer.concat(parts) };
}

function legendSheet(xfIndexForFill, ring, ring1) {
  const parts = [bof(0x0010)];
  const xf = xfIndexForFill("rgb(255,255,255)");
  const end = ring1?.end;
  const legend = [
    ["第一圈按线圈物理针回正", `回正前 B=37−列；回正行 F→、B←；之后 B=36−列。结束 F${ring.front}/B${ring.back}`],
    ["第二圈", `负数列是后床末尾绕回，不是新圈。每步按当时的 N 重算 F=ceil(N/2)、B=floor(N/2)。移圈只移动成形那一床；另一床针位不动。针数差由下一行折返翻针补上，针位范围不固定。结束 F${end?.f.length ?? "?"}/B${end?.b.length ?? "?"}`],
    ["绕回", "Step3 负数列仍是后床末尾原有的圈，表列 = (37−物理针)−1，与整行对齐到 step3 chart。同一个圈只有一列。点左折返时两端一起高亮"],
    ["F… / B…", "bed follows the stitch. Flip is B↔F or F↔B on the inserted row, before the recenter transfer"],
    ["F→ / B←", "1 stitch: arrow only (F→ F← B→ B←). 2 or more keeps the count (F→2). No R/L"],
    ["columns", "ring 0: front = phys, back = 37−phys. Ring 1 knits are that column minus 1 (chart, column 0). Ring 1 transfers keep the physical column. A decrease draws the shaping bed from the anchor needle, so sheet row 8 is F← on columns 6…18 and the right fold stays front at column 18. Rings 2–4 stay on step3 columns"],
    ["rows", "stitch_map_bind.json stays 121. The cellmap sheet maps each bind cell to its sheet row and column"],
  ];
  legend.forEach((pair, i) => {
    parts.push(labelRecord(i, 0, xf, pair[0]));
    parts.push(labelRecord(i, 1, xf, pair[1]));
  });
  parts.push(eof());
  return { name: "legend", bytes: Buffer.concat(parts) };
}

function cellMapSheet(entries, xf) {
  const parts = [bof(0x0010)];
  ["sheetRow", "sheetCol", "bindRow", "bindCol", "linkCol"].forEach((label, col) => {
    parts.push(labelRecord(0, col, xf, label));
  });
  entries.forEach((entry, i) => {
    const row = i + 1;
    parts.push(numberRecord(row, 0, xf, entry.sheetRow));
    parts.push(numberRecord(row, 1, xf, entry.sheetCol));
    parts.push(numberRecord(row, 2, xf, entry.bindRow));
    parts.push(numberRecord(row, 3, xf, entry.bindCol));
    if (entry.linkCol != null) parts.push(numberRecord(row, 4, xf, entry.linkCol));
  });
  parts.push(eof());
  return { name: "cellmap", bytes: Buffer.concat(parts) };
}

function writeCfb(workbook) {
  const sectorSize = 4096;
  const dataSectors = Math.ceil(workbook.length / sectorSize) || 1;
  const totalSectors = 2 + dataSectors;
  if (totalSectors > 1024) fail(`workbook needs ${totalSectors} sectors; FAT is one 4096 sector`);
  const fat = Buffer.alloc(sectorSize, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0);
  fat.writeUInt32LE(0xfffffffe, 4);
  for (let i = 0; i < dataSectors; i++) {
    const next = i + 1 < dataSectors ? 2 + i + 1 : 0xfffffffe;
    fat.writeUInt32LE(next, (2 + i) * 4);
  }
  const dir = Buffer.alloc(sectorSize, 0);
  const putName = (entry, name, type, start, size) => {
    const off = entry * 128;
    const chars = [...name, "\0"];
    for (let i = 0; i < chars.length; i++) dir.writeUInt16LE(chars[i].charCodeAt(0), off + i * 2);
    dir.writeUInt16LE(chars.length * 2, off + 64);
    dir[off + 66] = type;
    dir.writeUInt32LE(start >>> 0, off + 116);
    dir.writeUInt32LE(size >>> 0, off + 120);
  };
  putName(0, "Root Entry", 5, 0xfffffffe, 0);
  putName(1, "Workbook", 2, 2, workbook.length);
  const header = Buffer.alloc(512, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x003e, 0x18);
  header.writeUInt16LE(0x0003, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(12, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(1, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(0xfffffffe, 0x3c);
  header.writeUInt32LE(0xfffffffe, 0x44);
  header.writeUInt32LE(0, 0x48);
  header.writeUInt32LE(0, 0x4c);
  for (let i = 1; i < 109; i++) header.writeUInt32LE(0xffffffff, 0x4c + i * 4);
  const data = Buffer.alloc(dataSectors * sectorSize, 0);
  Buffer.from(workbook).copy(data, 0);
  return Buffer.concat([header, fat, dir, data]);
}

export function buildRing0Workbook(step3, bind) {
  if (step3.needles[0] !== -5 || step3.needles.at(-1) !== 36 || step3.needles.length !== 42) {
    fail(`expected needles −5…36 (42), got ${step3.needles[0]}…${step3.needles.at(-1)} (${step3.needles.length})`);
  }
  const span = ring0DisplayEnd(bind);
  if (span.rowEnd > step3.rows.length) fail(`ring 0 end ${span.rowEnd} past step3`);
  if (step3.rows.length !== 121) fail(`step3 has ${step3.rows.length} rows, expected 121`);
  for (let i = 0; i < span.rowEnd; i++) {
    const dir = step3.rows[i].dir;
    if (dir !== "R" && dir !== "L") continue;
    const owners = new Set();
    for (const face of bind.faces || []) {
      for (const cell of face.cells || []) {
        if (cell.display_row === i) owners.add(face.path_index);
      }
    }
    if (!owners.size || [...owners].some((p) => p !== 0)) {
      fail(`knit display_row ${i} is not exclusively path 0 (owners ${[...owners]})`);
    }
  }

  const ring = simulateRing0(step3.rows, span.rowEnd);
  if (ring.recenterAfter < 0 || ring.recenterAfter >= span.rowEnd) {
    fail(`recenter sits at step3 ${ring.recenterAfter}, outside ring 0 [0, ${span.rowEnd})`);
  }
  const ring1Span = pathRowRange(bind, 1);
  const ring2Span = pathRowRange(bind, 2);
  if (ring1Span.start !== span.rowEnd) fail(`ring 1 starts at step3 ${ring1Span.start}, ring 0 ends at ${span.rowEnd}`);
  if (ring2Span.start !== ring1Span.end) fail(`ring 2 starts at ${ring2Span.start}, ring 1 ends at ${ring1Span.end}`);
  for (let i = ring1Span.start; i < ring1Span.end; i++) {
    const dir = step3.rows[i].dir;
    if (dir !== "R" && dir !== "L") continue;
    const owners = new Set();
    for (const face of bind.faces || []) {
      for (const cell of face.cells || []) {
        if (cell.display_row === i) owners.add(face.path_index);
      }
    }
    if (!owners.size || [...owners].some((p) => p !== 1)) {
      fail(`knit display_row ${i} is not exclusively path 1 (owners ${[...owners]})`);
    }
  }
  const ring1 = simulateRing1(step3.rows, ring1Span.start, ring1Span.end);

  const rows = [];
  const step3ToSheet = [];
  for (let i = 0; i < span.rowEnd; i++) {
    const row = step3.rows[i];
    const snap = ring.atRow.get(i);
    if (!snap) fail(`ring 0 row ${i} has no stitch identities`);
    step3ToSheet[i] = rows.length;
    rows.push({
      dir: row.dir,
      step3: i,
      cells: row.cells.map((c) => {
        if (!c.token) return { col: c.col, token: "", fill: c.fill || "rgb(192,192,192)" };
        const st = snap.get(c.col);
        if (!st) fail(`row ${i} col ${c.col} has no stitch identity`);
        if (st.bed !== "F" && st.bed !== "B") fail(`row ${i} col ${c.col} stitch ${st.id} has no bed`);
        const painted = paintToken(c, toAbsoluteToken(c.token, st.bed));
        return { col: c.col, token: painted.token, fill: painted.fill, phys: st.phys, bed: st.bed, id: st.id, chart: c.col };
      }),
    });
    if (i === ring.recenterAfter) {
      const byCol = new Map(ring.recenterMoves.map((m) => [m.col, m]));
      rows.push({
        dir: "X",
        recenter: true,
        step3: null,
        cells: step3.needles.map((col) => {
          const m = byCol.get(col);
          if (!m) return { col, token: "", fill: "rgb(192,192,192)" };
          return { col, token: m.token, fill: "rgb(204,204,255)", phys: m.fromPhys, bed: m.bed, id: m.id, chart: null };
        }),
      });
    }
  }
  if (rows.some((r) => r.dir === "Flip")) fail("ring 0 output contains a Flip row");

  const extraCols = [];
  for (let i = ring.recenterAfter + 1; i < span.rowEnd; i++) {
    const sheetIndex = sheetRowForStep3(i, ring.recenterAfter);
    const row = rows[sheetIndex];
    const placed = new Map();
    for (const cell of occupied(row)) {
      const bed = cell.bed || bedOf(cell.token);
      const dest = displayColAfterRecenter(cell.col, bed);
      if (placed.has(dest)) {
        const prev = placed.get(dest);
        fail(
          `表行 ${sheetIndex}（step3 行 ${i}）: 列 ${dest} 同时有 ${prev.token}（来自列 ${prev.chartCol}，${prev.bed} 物理针 ${prev.phys}）和 ${cell.token}（来自列 ${cell.col}，${bed} 物理针 ${cell.phys}）`,
        );
      }
      placed.set(dest, { ...cell, col: dest, chartCol: cell.col, bed });
    }
    const seenPhys = new Map();
    for (const cell of placed.values()) {
      if (cell.phys == null) continue;
      const key = `${cell.bed}:${cell.phys}`;
      if (seenPhys.has(key)) {
        fail(`表行 ${sheetIndex}（step3 行 ${i}）: 同一物理针两枚线圈 ${cell.bed} 针 ${cell.phys}（线圈 ${seenPhys.get(key)} 与 ${cell.id}）`);
      }
      seenPhys.set(key, cell.id);
    }
    for (const col of placed.keys()) if (!step3.needles.includes(col)) extraCols.push(col);
    row.cells = placed;
    row.shifted = true;
  }
  const pushSparse = (row) => {
    for (const col of row.cells.keys()) if (!step3.needles.includes(col)) extraCols.push(col);
    rows.push(row);
  };
  for (let i = ring1Span.start; i < step3.rows.length; i++) {
    if (i < ring1Span.end) {
      const built = ring1.byRow.get(i);
      if (!built) fail(`ring 1 step3 row ${i} was not simulated`);
      step3ToSheet[i] = rows.length;
      pushSparse({ dir: built.dir, step3: i, cells: built.cells, shifted: true });
      for (const extra of ring1.inserts) {
        if (extra.after !== i) continue;
        pushSparse({ dir: extra.dir, step3: null, recenter: extra.dir === "X", flip: extra.dir === "Flip", cells: extra.cells, shifted: true });
      }
    } else {
      const row = step3.rows[i];
      step3ToSheet[i] = rows.length;
      rows.push({
        dir: row.dir,
        step3: i,
        cells: row.cells.map((c) => ({
          col: c.col,
          token: c.token,
          fill: c.fill,
          chart: c.token ? c.col : null,
        })),
      });
    }
  }
  let needles = step3.needles;
  if (extraCols.length) {
    const all = new Set([...needles, ...extraCols]);
    needles = [...all].sort((a, b) => a - b);
    for (let i = 1; i < needles.length; i++) {
      if (needles[i] !== needles[i - 1] + 1) {
        fail(`needle columns are not contiguous at ${needles[i - 1]} and ${needles[i]}`);
      }
    }
  }
  for (const row of rows) {
    if (row.shifted) {
      const placed = row.cells;
      row.cells = needles.map((col) => placed.get(col) || { col, token: "", fill: "rgb(192,192,192)" });
    } else if (needles !== step3.needles) {
      const byCol = new Map(row.cells.map((c) => [c.col, c]));
      row.cells = needles.map((col) => byCol.get(col) || { col, token: "", fill: "rgb(192,192,192)" });
    }
  }

  const recenterSheet = sheetRowForStep3(ring.recenterAfter, ring.recenterAfter) + 1;
  if (rows[recenterSheet]?.dir !== "X" || !rows[recenterSheet].recenter) {
    fail(`recenter is not sheet row ${recenterSheet}`);
  }
  for (let i = 0; i < step3.rows.length; i++) {
    const sheetRow = rows[step3ToSheet[i]];
    if (sheetRow?.step3 !== i) fail(`step3 row ${i} landed on sheet row ${step3ToSheet[i]}`);
    if (i <= ring.recenterAfter) {
      assertAlignedRow(sheetRow, step3.rows[i], i);
      for (const cell of occupied(sheetRow)) {
        if (bedOf(cell.token) === "other") fail(`row ${i} col ${cell.col} token ${cell.token} has no F/B`);
      }
    } else if (i < span.rowEnd) {
      assertColumnShiftedRow(sheetRow, step3.rows[i], i);
    } else if (i < ring1Span.end) {
      if (sheetRow.dir !== step3.rows[i].dir) fail(`step3 row ${i} dir drifted`);
      for (const cell of occupied(sheetRow)) {
        const bed = bedOf(cell.token);
        if (bed !== "F" && bed !== "B") fail(`第二圈表行 ${step3ToSheet[i]} 符号 ${cell.token} 没有床`);
        const wantCol = columnForRing1Row(sheetRow.dir, bed, cell.phys);
        if (cell.phys == null || cell.col !== wantCol) {
          fail(`第二圈表行 ${step3ToSheet[i]} 列 ${cell.col} 不是 ${sheetRow.dir} 的 ${bed} 列 ${wantCol}`);
        }
      }
    } else {
      if (sheetRow.dir !== step3.rows[i].dir) fail(`step3 row ${i} dir drifted`);
      const a = occupied(sheetRow);
      const b = occupied(step3.rows[i]);
      if (a.map((c) => `${c.col}:${c.token}`).join("|") !== b.map((c) => `${c.col}:${c.token}`).join("|")) {
        fail(`step3 row ${i} is not an unchanged step3 row`);
      }
    }
  }
  for (const cell of occupied(rows[recenterSheet])) {
    if (cell.token !== "F→" && cell.token !== "B←") {
      fail(`recenter col ${cell.col} token ${cell.token} is not F→ or B←`);
    }
    if (cell.fill !== "rgb(204,204,255)") fail(`recenter col ${cell.col} fill ${cell.fill}`);
  }
  const headerSet = new Set(needles);
  const ring2Sheet = step3ToSheet[ring2Span.start];
  if (ring1.inserts.length !== 2 || ring1.inserts.some((row) => row.dir !== "Flip")) {
    fail(`第二圈应只插入两行翻针，得到 ${ring1.inserts.map((row) => row.dir).join(",")}`);
  }
  if (rows.length !== step3.rows.length + 1 + ring1.inserts.length) {
    fail(`output rows ${rows.length}, expected ${step3.rows.length + 1 + ring1.inserts.length}`);
  }
  const flipOf = (event) => (event.flip ? `${event.flip.side} ${event.flip.fromBed}${event.flip.fromPhys}→${event.flip.toBed}${event.flip.toPhys} k=${event.k}` : `k=${event.k}`);
  const gotEvents = ring1.events.map(flipOf).join(" | ");
  const wantEvents = ["right B18→F18 k=0", "right F19→B18 k=0", "k=0", "k=0"].join(" | ");
  if (gotEvents !== wantEvents) fail(`第二圈对齐结果变了：${gotEvents}`);
  const spanOf = (label) => {
    const row = ring1.trace.find((item) => item.label === label);
    if (!row) fail(`第二圈缺少 ${label}`);
    const contig = (arr) => arr.every((phys, index) => index === 0 || phys === arr[index - 1] + 1);
    const legal =
      row.F === Math.ceil(row.N / 2) &&
      row.B === Math.floor(row.N / 2) &&
      row.fPhys.length === row.F &&
      row.bPhys.length === row.B &&
      row.fPhys[0] === 0 &&
      row.fPhys.at(-1) === row.F - 1 &&
      contig(row.fPhys) &&
      contig(row.bPhys);
    if (!legal) fail(`${label} 没有按当时的 N 合法化：N${row.N} F${row.F}[${row.fPhys}] B${row.B}[${row.bPhys}]`);
    return `N${row.N} F${row.F}[${row.fPhys[0]}…${row.fPhys.at(-1)}] B${row.B}[${row.bPhys[0]}…${row.bPhys.at(-1)}]`;
  };
  for (const row of ring1.trace) {
    if (/ X\+?$/.test(row.label)) continue;
    spanOf(row.label);
  }
  const wantSpans = [
    ["step3 行 7 减针对齐后", "N37 F19[0…18] B18[0…17]"],
    ["step3 行 11 R", "N38 F19[0…18] B19[0…18]"],
    ["step3 行 16 减针对齐后", "N37 F19[0…18] B18[1…18]"],
    ["step3 行 27 R", "N38 F19[0…18] B19[0…18]"],
  ];
  for (const [label, want] of wantSpans) {
    const got = spanOf(label);
    if (got !== want) fail(`${label} 范围是 ${got}，这一步重算后应是 ${want}`);
  }
  const frontDec = rows[step3ToSheet[7]];
  const frontDecCols = occupied(frontDec)
    .map((cell) => cell.col)
    .sort((a, b) => a - b);
  if (
    frontDec.dir !== "X" ||
    occupied(frontDec).some((cell) => cell.token !== "F←" || cell.bed !== "F") ||
    frontDecCols.join(",") !== [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].join(",")
  ) {
    fail(`表行 8 应从减针锚点画前床 F← 列 6…18，得到 ${frontDecCols.join(",")}`);
  }
  const backDec = rows[step3ToSheet[16]];
  const backDecCols = occupied(backDec)
    .map((cell) => cell.col)
    .sort((a, b) => a - b);
  if (
    occupied(backDec).some((cell) => cell.token !== "B→" || cell.bed !== "B") ||
    backDecCols[0] !== 21 ||
    backDecCols.at(-1) !== 37
  ) {
    fail(`后床减针应从锚点画 B→ 列 21…37，得到 ${backDecCols.join(",")}`);
  }
  const wrapsOf = (step3Row) =>
    [...(ring1.byRow.get(step3Row)?.cells.values() || [])]
      .filter((cell) => cell.wrap)
      .sort((a, b) => b.chart - a.chart)
      .map((cell) => `${cell.chart}:${cell.bed}${cell.phys}@${cell.col}`)
      .join(",");
  if (wrapsOf(9) !== "-1:B0@36,-2:B1@35,-3:B2@34,-4:B3@33") {
    fail(`step3 行 9 绕回 ${wrapsOf(9)}`);
  }
  if (wrapsOf(11) !== "-1:B0@36,-2:B1@35,-3:B2@34,-4:B3@33") {
    fail(`step3 行 11 绕回 ${wrapsOf(11)}`);
  }
  if (ring1.end.N !== 38 || ring1.end.f.length !== 19 || ring1.end.b.length !== 19) {
    fail(`第二圈结束 N=${ring1.end.N} F${ring1.end.f.length} B${ring1.end.b.length}`);
  }
  for (let i = 0; i < ring2Sheet; i++) {
    const row = rows[i];
    if (row.dir !== "X" && row.dir !== "X+") continue;
    for (const cell of occupied(row)) {
      const move = String(cell.token).match(/^[FB][←→](\d+)?$/);
      if (!move) fail(`表行 ${i} 移圈符号 ${cell.token} 应是 F→ / B←，两针及以上才写数字`);
      if (move[1] && Number(move[1]) < 2) fail(`表行 ${i} 移 1 针不写数字，得到 ${cell.token}`);
    }
  }
  const ring1Sheet = step3ToSheet[ring1Span.start];
  for (let i = 0; i < ring2Sheet; i++) {
    const row = rows[i];
    const seen = new Set();
    for (const cell of occupied(row)) {
      if (seen.has(cell.col)) fail(`表行 ${i} 列 ${cell.col} 有两枚线圈`);
      seen.add(cell.col);
      if (!headerSet.has(cell.col)) fail(`表头缺少列 ${cell.col}`);
      const bed = bedOf(cell.token);
      if (cell.phys == null) fail(`表行 ${i} 列 ${cell.col} 没有物理针`);
      const want = i >= ring1Sheet ? columnForRing1Row(row.dir, bed, cell.phys) : columnForPhys(bed, cell.phys);
      if (cell.col !== want) {
        const where = i < ring1Sheet ? (bed === "F" ? "物理针" : "37−物理针") : row.dir === "X" || row.dir === "X+" ? "移圈行物理针列" : "物理针列减 1（对齐 step3 chart）";
        fail(`表行 ${i} ${bed} 表列 ${cell.col} !== ${where} ${cell.phys}（应为 ${want}）`);
      }
    }
  }
  if (needles[0] !== -5 || needles.at(-1) !== 37) {
    fail(`ring0 header should be −5…37, got ${needles[0]}…${needles.at(-1)}`);
  }

  const fills = new Set(["rgb(255,255,255)", "rgb(192,192,192)", B_PLAIN]);
  for (const row of rows) {
    for (const cell of row.cells) if (cell.fill) fills.add(cell.fill);
  }
  const palette = [...fills].sort();
  const xfIndexForFill = (fill) => {
    const i = palette.indexOf(fill);
    if (i < 0) fail(`missing xf for ${fill}`);
    return i;
  };
  const cellMap = [];
  const seenBind = new Set();
  const seenSheet = new Set();
  for (let sheetRow = 0; sheetRow < rows.length; sheetRow++) {
    const row = rows[sheetRow];
    if (row.step3 == null || (row.dir !== "R" && row.dir !== "L")) continue;
    for (const cell of occupied(row)) {
      if (cell.chart == null) fail(`表行 ${sheetRow} 列 ${cell.col} 没有 step3 列`);
      const bindKey = `${row.step3},${cell.chart}`;
      const sheetKey = `${sheetRow},${cell.col}`;
      if (seenBind.has(bindKey)) fail(`bind ${bindKey} 映射了两次`);
      if (seenSheet.has(sheetKey)) fail(`表 ${sheetKey} 映射了两次`);
      seenBind.add(bindKey);
      seenSheet.add(sheetKey);
      cellMap.push({
        sheetRow,
        sheetCol: cell.col,
        bindRow: row.step3,
        bindCol: cell.chart,
        linkCol: cell.foldLink ?? null,
      });
    }
  }
  const dataSheet = sheetFromGrid("step4-ring0", step3.headerLabel || "dir\\col", needles, rows, xfIndexForFill);
  const legend = legendSheet(xfIndexForFill, ring, ring1);
  const mapSheet = cellMapSheet(cellMap, xfIndexForFill("rgb(255,255,255)"));
  const xfBytes = Buffer.concat(palette.map((fill) => xfRecord(icvForFill(fill))));
  const bofBytes = bof(0x0005);
  const eofBytes = eof();
  const sheets = [dataSheet, legend, mapSheet];
  const boundsheetLen = sheets.reduce((sum, sheet) => sum + boundsheet(0, sheet.name).length, 0);
  const globalLen = bofBytes.length + xfBytes.length + boundsheetLen + eofBytes.length;
  let cursor = globalLen;
  const bounds = sheets.map((sheet) => {
    const at = cursor;
    cursor += sheet.bytes.length;
    return boundsheet(at, sheet.name);
  });
  const global = Buffer.concat([bofBytes, xfBytes, ...bounds, eofBytes]);
  const workbook = Buffer.concat([global, ...sheets.map((sheet) => sheet.bytes)]);
  return {
    bytes: writeCfb(workbook),
    span,
    ring1Span,
    rows,
    needles,
    ring,
    ring1,
    step3ToSheet,
    cellMap,
    summary: summarizeRing0(rows.slice(0, span.rowEnd + 1)),
  };
}

export function loadInputs(paths = DEFAULT_PATHS) {
  return {
    step3: loadSheet(paths.step3Xls, "step3"),
    bind: JSON.parse(readFileSync(paths.bind, "utf8")),
  };
}

export function buildFromFiles(paths = DEFAULT_PATHS) {
  const { step3, bind } = loadInputs(paths);
  return buildRing0Workbook(step3, bind);
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const built = buildFromFiles();
  if (check) {
    const committed = readFileSync(DEFAULT_PATHS.outXls);
    if (!committed.equals(built.bytes)) {
      fail(`committed ${DEFAULT_PATHS.outXls} does not match the script — re-run node scripts/build-step4-ring0.mjs`);
    }
  } else {
    writeFileSync(DEFAULT_PATHS.outXls, built.bytes);
  }
  const { ring, span } = built;
  const { s, br, v, caret, v3, fresh } = ring.anchors;
  console.log(
    `build-step4-ring0 ${check ? "check " : ""}ok: ring0 step3 [0, ${span.rowEnd}) face ${span.ring1Face} starts path 1; N=${ring.N} F=${ring.front} B=${ring.back}; rows ${built.rows.length}; 回正插在 step3 行 ${ring.recenterAfter} 之后（表行 ${ring.recenterAfter + 1}）`,
  );
  console.log(`  表列公式：前床 列=物理针；后床 列=37−物理针。回正后两床都是 step3 列+1。`);
  for (const row of built.summary) {
    console.log(
      `  表行 ${row.display_row} ${row.dir} F=${row.F} 表列[${row.fCols.join(",")}] 物理针[${row.fPhys.join(",")}] B=${row.B} 表列[${row.bCols.join(",")}] 物理针[${row.bPhys.join(",")}]`,
    );
  }
  console.log("  回正行移圈：");
  for (const m of ring.recenterMoves) {
    console.log(`    列 ${m.col} ${m.bed} 物理针 ${m.fromPhys}→${m.toPhys} ${m.token}`);
  }
  const at = (sheetRow, id) => built.rows[sheetRow].cells.find((c) => c.id === id && c.token);
  const sRow = at(2, s.id);
  const brRow = at(2, br.id);
  const vRow = at(2, v.id);
  const after = sheetRowForStep3(3, ring.recenterAfter);
  const caretRow = at(after, caret.id);
  const brAfter = at(after, br.id);
  const v3Row = at(after, v3.id);
  const freshRow = at(after, fresh.id);
  console.log(
    `  回正前 第2行：S 表列 ${sRow.col} / 物理针 ${sRow.phys}；B^R 表列 ${brRow.col} / 物理针 ${brRow.phys}；V 表列 ${vRow.col} / 物理针 ${vRow.phys}`,
  );
  console.log(
    `  回正后 第4行：S 表列 ${caretRow.col} / 物理针 ${caretRow.phys}（线圈 ${caret.id}）；B^R 表列 ${brAfter.col} / 物理针 ${brAfter.phys}；V 表列 ${v3Row.col} / 物理针 ${v3Row.phys}；列21新针 表列 ${freshRow.col} / 物理针 ${freshRow.phys}`,
  );
  console.log(`  表头针位 ${built.needles[0]}…${built.needles.at(-1)}，共 ${built.needles.length} 列`);
  console.log("  每步之后床上仍挂着的线圈：");
  for (const live of ring.liveAt) {
    console.log(`    ${live.label} F=${live.F} [${live.fPhys.join(",")}] B=${live.B} [${live.bPhys.join(",")}]`);
  }
  console.log(
    `  ring 0 结束：前床物理针 ${ring.frontPhys.join(",")} 终点 ${ring.frontEnd}；后床物理针 ${ring.backPhys.join(",")} 起点 ${ring.backStart}；都在 18：${ring.foldBoth18 ? "是" : "否"}`,
  );
  const last0 = built.rows[sheetRowForStep3(span.rowEnd - 1, ring.recenterAfter)];
  const first1 = built.rows[sheetRowForStep3(span.rowEnd, ring.recenterAfter)];
  const colsOf = (row) => occupied(row).map((c) => c.col).join(",");
  console.log(`  ring0 末行（表行 ${last0 ? sheetRowForStep3(span.rowEnd - 1, ring.recenterAfter) : "?"}）表列 ${colsOf(last0)}`);
  console.log(`  ring1 首行（表行 ${sheetRowForStep3(span.rowEnd, ring.recenterAfter)}）表列 ${colsOf(first1)}`);
  console.log(`  总行数 ${built.rows.length}`);
  console.log("  第二圈：");
  for (const row of built.ring1.trace) {
    console.log(`    ${row.label} N=${row.N} F${row.F}[${row.fPhys[0]}…${row.fPhys.at(-1)}] B${row.B}[${row.bPhys[0]}…${row.bPhys.at(-1)}]`);
  }
  for (const event of built.ring1.events) {
    const flip = event.flip ? `${event.flip.side} ${event.flip.fromBed}${event.flip.fromPhys}→${event.flip.toBed}${event.flip.toPhys}` : "不翻针";
    console.log(`    对齐 step3 ${event.after}: ${flip}，回正 ${event.k} 针`);
  }
  return built;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
