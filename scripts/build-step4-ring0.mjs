/**
 * Build iteration_0_cut_readable_map_step4_ring0.xls
 *
 * Ring 0 only. Step3 still says which chart columns an inc/dec pass moves.
 * Beds are a separate map of that cylinder onto the machine.
 *
 * Strip inc/dec, then split the remaining circumference: F = ceil(N/2) on
 * the front from physical needle 0, B = floor(N/2) on the back, mirrored
 * (column = 37 − phys). When F = B + 1 the extra empty needle belongs at
 * the left junction, where the back bed meets the front's start. It is not
 * a gap at the right fold and not a reserved high column. A row that has
 * not reached that junction does not arrange the empty anywhere. This
 * sample's stripped ring is 37 stitches, so the count is F19/B18, with the
 * beds touching: front columns 0…18, back packed from phys 18.
 *
 * An inc/dec row moves only the shaping bed. The other bed keeps its
 * needles; its chart index still follows step3 so the next row finds it.
 * A transfer changes the physical needle. The arrow is drawn on the source
 * column. The next knit row is drawn from the physical needles after the
 * move: front column = phys, back column = 37 − phys. Sheet column numbers
 * are that mapping, not the physical needle numbers. There is no knit-row
 * phys−1 offset on ring 0, and no recenter that slides both beds together.
 *
 * After every shaping row, count the needles already assigned to each bed
 * (stitches on the machine plus the plan slots not knitted yet) and compare
 * the two physical windows. Counts that miss F=ceil(N/2), B=floor(N/2) by
 * one stitch are a right-fold flip, not a rack. Counts that already match,
 * while the windows are the same length and exactly one needle apart, rack
 * the offset bed onto the other window: every live stitch on that bed and
 * every remaining plan slot. The arrow is drawn on the source needle of
 * each stitch already there; later rows use the new needles. Any other
 * window stops. The rule is not tied to one sheet row.
 *
 * Until a short row has knitted the whole ring, missing stitches are
 * cast-on, not an F/B excess, so those rows do not flip. The new stitch is
 * born on the single free physical needle between its chart neighbors. If
 * that gap is not one needle, the build stops. This sample's B→ takes the
 * back stitch from phys 18 to phys 19 and leaves the other on phys 17, so
 * the knit that follows starts at column 20. After that knit the assigned
 * beds are F19/B19, front 0…18 and back 1…19, so the back bed racks one
 * needle onto 0…18. The ring ends with both beds on 0…18 and no Flip. A
 * decrease on this sample still stops.
 *
 * Ring 1 inherits those end beds. Physical needles stay 0…18. Ring 0 may
 * have slid the front's chart index without moving the bed, so physical
 * needle 0 sits on the chart just before 0. A knit course that includes
 * the next chart and skips that needle still starts on it: the needle is
 * F0 at sheet column 0. Knits, transfers, flips, and whole-bed racks all
 * use the same columns: front = phys, back = 37 − phys. There is no
 * knit-row phys−1. After each inc/dec it uses the same window rule as
 * ring 0. Rings 2–4 stay on the step3 columns.
 *
 * The phys sheet copies the bed and physical needle already stored on each
 * ring 0 and ring 1 cell, including transfers and flips. It does not place
 * needles. Rings 2–4 have no tracked physical needle, so those cells are
 * left out.
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
const RACK_FILL = "rgb(204,204,255)";
const FLIP_FILL = "rgb(153,153,255)";

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

/** Ring 0: every occupied cell sits on its physical column. Knit tokens match step3 by chart. */
export function assertRing0PhysicalRow(step4Row, step3Row, step3Index) {
  const problems = [];
  if (step4Row.dir !== step3Row.dir) problems.push(`dir step4=${step4Row.dir} step3=${step3Row.dir}`);
  const sheetOcc = occupied(step4Row);
  const stepOcc = occupied(step3Row);
  const cols = sheetOcc.map((cell) => cell.col);
  if (new Set(cols).size !== cols.length) problems.push(`duplicate display column [${cols}]`);
  for (const cell of sheetOcc) {
    const bed = bedOf(cell.token);
    if (bed !== "F" && bed !== "B") {
      problems.push(`col ${cell.col} token ${cell.token} has no F/B`);
      continue;
    }
    if (cell.phys == null || cell.col !== columnForPhys(bed, cell.phys)) {
      problems.push(`col ${cell.col} is not ${bed} phys ${cell.phys}`);
    }
  }
  if (step3Row.dir === "X" || step3Row.dir === "X+") {
    const beds = new Set(sheetOcc.map((cell) => bedOf(cell.token)));
    if (beds.size !== 1) problems.push(`transfer beds ${[...beds]}`);
    const byChart = new Map(stepOcc.map((cell) => [cell.col, cell]));
    for (const cell of sheetOcc) {
      const src = byChart.get(cell.chart);
      if (!src) {
        problems.push(`chart ${cell.chart} is not on the step3 transfer`);
        continue;
      }
      if (toRelativeToken(cell.token) !== String(src.token ?? "")) {
        problems.push(`label chart ${cell.chart}: sheet=${cell.token} step3=${src.token}`);
      }
    }
    if (!sheetOcc.length) problems.push("empty transfer");
  } else {
    if (sheetOcc.length !== stepOcc.length) problems.push(`count step4=${sheetOcc.length} step3=${stepOcc.length}`);
    const byChart = new Map();
    for (const cell of sheetOcc) {
      if (byChart.has(cell.chart)) problems.push(`two cells claim chart ${cell.chart}`);
      byChart.set(cell.chart, cell);
    }
    for (const cell of stepOcc) {
      const got = byChart.get(cell.col);
      if (!got) {
        problems.push(`missing chart col ${cell.col}`);
        continue;
      }
      if (toRelativeToken(got.token) !== String(cell.token ?? "")) {
        problems.push(`label chart ${cell.col}: sheet=${got.token} step3=${cell.token}`);
      }
    }
  }
  if (problems.length) fail(`row step3 ${step3Index} physical mismatch: ${problems.join("; ")}`);
}

/** ⬆ is front→back, ⬇ is back→front. The bed is the stitch's bed before the flip. */
export function flipToken(fromBed, toBed) {
  if (fromBed === "F" && toBed === "B") return "⬆";
  if (fromBed === "B" && toBed === "F") return "⬇";
  fail(`翻针 ${fromBed}→${toBed} 没有符号`);
}

function bedOf(token) {
  const s = String(token);
  if (s.startsWith("F") || s === "⬆") return "F";
  if (s.startsWith("B") || s === "⬇") return "B";
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
 * Ring 1 uses columnForPhys for knits, wraps, transfers, flips, and racks.
 * The front's physical needle 0 is drawn at column 0 even when a chart
 * slide left it on the column before the course's first step3 cell.
 * The old knit column was phys−1, which drew the next needle as F1.
 */

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

function pairRing0Ops(step3Rows, rowEnd) {
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
  return ops;
}

function moveCharts(live, pivot, step, delta) {
  const next = new Map();
  for (const [col, id] of live) {
    let dest = col;
    if (step === 1 && col >= pivot) dest = col + delta;
    if (step === -1 && col <= pivot) dest = col + delta;
    if (next.has(dest)) fail(`transfer collision at col ${dest}`);
    next.set(dest, id);
  }
  return next;
}

/**
 * Birth charts of every stitch that is not an increase hole.
 * F = ceil(N/2) takes the low charts from physical needle 0.
 * B = floor(N/2) is packed against that, high phys at the right fold.
 * F = B+1 does not reserve a needle: the back slots still pack inward from
 * the fold. The left-junction empty is placed only by a row that has
 * reached it, which this cast-on has not.
 */
function planBaseBeds(step3Rows, rowEnd) {
  const ops = pairRing0Ops(step3Rows, rowEnd);
  let live = new Map();
  const baseCharts = [];
  for (const op of ops) {
    const krow = step3Rows[op.knit];
    const step = krow.dir === "R" ? 1 : -1;
    const kcells = knitOrderCells(krow);
    const decs = kcells.filter((c) => {
      const kind = excelLegendKind(c.token, krow.dir);
      return (kind === "decrease" || kind === "wrap-dec") && parseDecN(c.token);
    });
    if (decs.length) {
      fail(`step3 行 ${op.knit}: 第一圈这张样本没有减针。减针后的翻针还没定，先停`);
    }
    const incs = kcells.filter((c) => parseIncN(c.token));
    const fresh = new Set();
    if (op.xfers.length !== incs.reduce((sum, cell) => sum + parseIncN(cell.token), 0)) {
      fail(`knit row ${op.knit}: transfer rows ${op.xfers.length} do not match the increases`);
    }
    for (const cell of incs.slice().reverse()) {
      const added = parseIncN(cell.token);
      const pivot0 = cell.col + step;
      for (let g = 1; g <= added; g++) fresh.add(cell.col + step * g);
      for (let k = 0; k < added; k++) {
        const cols = passCols(live, pivot0, step);
        for (const ncol of fresh) if (!cols.includes(ncol)) cols.push(ncol);
        for (const col of cols) {
          if (!live.has(col)) fail(`X+ col ${col} on knit row ${op.knit} is not a live stitch`);
        }
        live = moveCharts(live, pivot0, step, step === 1 ? 1 : -1);
      }
    }
    for (const cell of kcells) {
      if (live.has(cell.col)) continue;
      if (fresh.has(cell.col)) {
        live.set(cell.col, "shaping");
        continue;
      }
      baseCharts.push(cell.col);
      live.set(cell.col, cell.col);
    }
  }
  baseCharts.sort((a, b) => a - b);
  if (!baseCharts.length) fail("ring 0 has no base circumference");
  for (let i = 0; i < baseCharts.length; i++) {
    if (baseCharts[i] !== baseCharts[0] + i) {
      fail(`去掉加减针后的整圈列不连续：${baseCharts.join(",")}`);
    }
  }
  if (baseCharts[0] !== 0) fail(`底圈不是从列 0 开始：${baseCharts[0]}`);
  const n = baseCharts.length;
  const frontN = Math.ceil(n / 2);
  const backN = Math.floor(n / 2);
  if (frontN !== backN && frontN !== backN + 1) {
    fail(`底圈 F${frontN}/B${backN} 差超过 1，先停`);
  }
  const spareAtEnd = frontN === backN + 1;
  const plan = new Map();
  baseCharts.forEach((chart, i) => {
    if (i < frontN) plan.set(chart, { bed: "F", phys: i, base: true });
    else plan.set(chart, { bed: "B", phys: spareAtEnd ? n - i : n - 1 - i, base: true });
  });
  return { plan, n, frontN, backN, spareAtEnd };
}

function chartNeighbors(stitches, chart) {
  let left = null;
  let right = null;
  for (const st of stitches.values()) {
    if (st.chart < chart && (!left || st.chart > left.chart)) left = st;
    if (st.chart > chart && (!right || st.chart < right.chart)) right = st;
  }
  return { left, right };
}

/** The one free physical needle between two chart neighbors. Anything else stops. */
function physInHole(left, right, where) {
  if (!left || !right) fail(`${where}: 新圈没有两边的线圈，先停`);
  if (left.bed !== right.bed) {
    fail(`${where}: 新圈夹在 ${left.bed}${left.phys} 与 ${right.bed}${right.phys} 之间，先停`);
  }
  const lo = Math.min(left.phys, right.phys);
  const hi = Math.max(left.phys, right.phys);
  if (hi !== lo + 2) {
    fail(`${where}: ${left.bed} 物理空档不是一针（${left.phys}…${right.phys}），先停`);
  }
  return { bed: left.bed, phys: lo + 1 };
}

function increaseShapeBed(fresh, live, stitches, where) {
  const beds = new Set();
  for (const col of fresh) {
    const id = live.get(col);
    if (id == null) fail(`${where}: 加针空档列 ${col} 上没有要让开的线圈`);
    const st = stitches.get(id);
    if (!st?.bed) fail(`${where}: 加针空档列 ${col} 还没有床`);
    beds.add(st.bed);
  }
  if (beds.size !== 1) {
    fail(`${where}: 加针空档跨了 ${[...beds].join("/")}，不确定成形床，先停`);
  }
  return [...beds][0];
}

function applySelectiveMove(live, stitches, pivot, step, delta, shapeBed) {
  const next = new Map();
  const moves = [];
  for (const [col, id] of live) {
    let dest = col;
    if (step === 1 && col >= pivot) dest = col + delta;
    if (step === -1 && col <= pivot) dest = col + delta;
    if (next.has(dest)) fail(`transfer collision at col ${dest}`);
    const st = stitches.get(id);
    const chartDelta = dest - col;
    if (chartDelta !== 0) {
      if (st.bed === shapeBed) {
        const fromPhys = st.phys;
        st.phys += st.bed === "F" ? chartDelta : -chartDelta;
        moves.push({
          id: st.id,
          bed: st.bed,
          chart: col,
          fromPhys,
          toPhys: st.phys,
        });
      }
      st.chart = dest;
    }
    next.set(dest, id);
  }
  moves.sort((a, b) => a.chart - b.chart || a.id - b.id);
  return { live: next, moves };
}

function spanText(phys) {
  return `${phys[0]}…${phys[phys.length - 1]}`;
}

function assignedPhys(stitches, plan, usedPlan, bed, where) {
  const phys = [];
  for (const st of stitches.values()) {
    if (st.bed === bed) phys.push(st.phys);
  }
  for (const [chart, slot] of plan) {
    if (usedPlan.has(chart) || slot.bed !== bed) continue;
    phys.push(slot.phys);
  }
  phys.sort((a, b) => a - b);
  for (let i = 1; i < phys.length; i++) {
    if (phys[i] === phys[i - 1]) {
      fail(`NOTE: ${where} ${bed} 物理针 ${phys[i]} 叠了两枚，先停`);
    }
  }
  if (!phys.length || phys.some((p, i) => i > 0 && p !== phys[i - 1] + 1)) {
    fail(`NOTE: ${where} ${bed === "F" ? "前床" : "后床"}物理窗不连续 [${phys.join(",")}]，先停`);
  }
  return phys;
}

function windowsMatch(a, b) {
  return a.length === b.length && a[0] === b[0] && a.at(-1) === b.at(-1);
}

/**
 * After shaping. Assigned needles are the live stitches plus plan slots
 * not knitted yet.
 * Counts off by one stitch → one right-fold flip.
 * Counts already F=ceil(N/2) and B=floor(N/2), windows the same length and
 * exactly one needle apart → rack that whole bed (live stitches and the
 * remaining plan) onto the window that already starts at 0.
 * Anything else stops. Not tied to a sheet row.
 */
export function settleAssignedWindows(stitches, plan, usedPlan, where) {
  const fixes = [];
  const measure = () => {
    const front = assignedPhys(stitches, plan, usedPlan, "F", where);
    const back = assignedPhys(stitches, plan, usedPlan, "B", where);
    const N = front.length + back.length;
    return { front, back, N, tF: Math.ceil(N / 2), tB: Math.floor(N / 2) };
  };

  let { front, back, tF, tB } = measure();
  if (front[0] !== 0) {
    fail(`NOTE: ${where} 前床不是从物理针 0 起（${spanText(front)}），先停`);
  }

  if (front.length !== tF || back.length !== tB) {
    const diffF = front.length - tF;
    if (Math.abs(diffF) !== 1) {
      fail(
        `NOTE: ${where} 前后床 F${front.length}[${spanText(front)}] B${back.length}[${spanText(back)}] 不是 F${tF}/B${tB}。右折返按差翻只覆盖差一针，先停`,
      );
    }
    const longBed = diffF > 0 ? "F" : "B";
    const shortBed = longBed === "F" ? "B" : "F";
    const longWin = longBed === "F" ? front : back;
    const shortWin = longBed === "F" ? back : front;
    const fromPhys = longWin.at(-1);
    const toPhys = shortWin.at(-1) + 1;
    if (Math.abs(fromPhys - toPhys) > 1 || shortWin.includes(toPhys)) {
      fail(
        `NOTE: ${where} 数目差一针，但右折返 ${longBed}${fromPhys}→${shortBed}${toPhys} 不相邻或目标已占用，先停`,
      );
    }
    const candidates = [...stitches.values()].filter((st) => st.bed === longBed && st.phys === fromPhys);
    if (candidates.length !== 1) {
      fail(`NOTE: ${where} 右折返多出来的 ${longBed}${fromPhys} 不是一枚已织线圈，先停`);
    }
    const st = candidates[0];
    const row = {
      dir: "Flip",
      step3: null,
      rightFoldFlip: true,
      cells: [
        {
          col: columnForPhys(st.bed, st.phys),
          token: flipToken(st.bed, shortBed),
          fill: FLIP_FILL,
          phys: st.phys,
          bed: st.bed,
          id: st.id,
          chart: st.chart,
        },
      ],
    };
    st.bed = shortBed;
    st.phys = toPhys;
    assertNoSharedNeedle(stitches, where);
    const after = measure();
    if (after.front.length !== after.tF || after.back.length !== after.tB || after.front[0] !== 0) {
      fail(`NOTE: ${where} 右折返翻了一针后仍不是 F${after.tF}/B${after.tB}，先停`);
    }
    fixes.push({
      row,
      note: `NOTE: ${where} 数目不是 F${tF}/B${tB}，在右折返把 ${longBed}${fromPhys} 翻到 ${shortBed}${toPhys}。`,
    });
    front = after.front;
    back = after.back;
    tF = after.tF;
    tB = after.tB;
  }

  if (tF === tB) {
    const offset = back[0] - front[0];
    const sameShift = back.at(-1) - front.at(-1) === offset;
    if (offset === 0 && sameShift) return fixes;
    if (Math.abs(offset) !== 1 || !sameShift) {
      fail(
        `NOTE: ${where} 数目 F${front.length}/B${back.length} 已齐，但物理窗不是错开一针（前 ${spanText(front)} 后 ${spanText(back)}），先停`,
      );
    }
    let bed;
    let delta;
    if (front[0] === 0) {
      bed = "B";
      delta = -offset;
    } else if (back[0] === 0) {
      bed = "F";
      delta = offset;
    } else {
      fail(`NOTE: ${where} 两床都不从物理针 0 起（前 ${spanText(front)} 后 ${spanText(back)}），先停`);
    }
    const movers = [...stitches.values()].filter((st) => st.bed === bed).sort((a, b) => a.phys - b.phys);
    if (!movers.length) fail(`NOTE: ${where} ${bed} 没有已织线圈可整段移，先停`);
    for (const st of movers) {
      if (st.phys + delta < 0) fail(`NOTE: ${where} 整段移针会落到负的物理针，先停`);
    }
    for (const [chart, slot] of plan) {
      if (usedPlan.has(chart) || slot.bed !== bed) continue;
      if (slot.phys + delta < 0) fail(`NOTE: ${where} 计划针整段移会落到负的物理针，先停`);
    }
    const token = absoluteMoveToken(bed, delta < 0 ? "←" : "→", Math.abs(delta));
    const cells = movers.map((st) => ({
      col: columnForPhys(bed, st.phys),
      token,
      fill: RACK_FILL,
      phys: st.phys,
      bed: st.bed,
      id: st.id,
      chart: st.chart,
    }));
    cells.sort((a, b) => a.col - b.col);
    if (new Set(cells.map((cell) => cell.col)).size !== cells.length) {
      fail(`NOTE: ${where} 整段移针表列重叠，先停`);
    }
    for (const st of movers) st.phys += delta;
    for (const [chart, slot] of plan) {
      if (usedPlan.has(chart) || slot.bed !== bed) continue;
      slot.phys += delta;
    }
    assertNoSharedNeedle(stitches, where);
    const landed = measure();
    const moved = bed === "B" ? landed.back : landed.front;
    const anchor = bed === "B" ? landed.front : landed.back;
    if (!windowsMatch(moved, anchor)) {
      fail(`NOTE: ${where} 整段移针后物理窗仍是前 ${spanText(landed.front)} 后 ${spanText(landed.back)}，先停`);
    }
    const bedName = bed === "B" ? "后床" : "前床";
    fixes.push({
      row: { dir: "X", step3: null, windowAlign: true, cells },
      note: `NOTE: ${where} 数目 F${front.length}/B${back.length} 已齐，物理窗前 ${spanText(front)}、后 ${spanText(back)} 错开一针。整段移${bedName} ${delta}，对齐到 ${spanText(anchor)}。`,
    });
    return fixes;
  }

  if (tF === tB + 1) {
    const spareAtLeft = back[0] === 1 && back.at(-1) === front.at(-1) && back.length === tB;
    const packed = back[0] === 0 && back.at(-1) === tB - 1;
    if (front.at(-1) === tF - 1 && (spareAtLeft || packed)) return fixes;
    fail(`NOTE: ${where} F${tF}/B${tB} 的空针不在左衔接（前 ${spanText(front)} 后 ${spanText(back)}），先停`);
  }

  fail(`NOTE: ${where} F${tF}/B${tB} 不满足 F≥B 且 |F−B|≤1，先停`);
}

function drawCell(cell, st) {
  const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
  const col = columnForPhys(st.bed, st.phys);
  return {
    col,
    token: painted.token,
    fill: painted.fill,
    phys: st.phys,
    bed: st.bed,
    id: st.id,
    chart: cell.col,
  };
}

/**
 * Replay ring 0 on physical needles.
 * Chart passes still match step3. Only the shaping bed changes phys.
 * Sheet columns are always columnForPhys, including knits.
 */
export function simulateRing0(step3Rows, rowEnd) {
  const ops = pairRing0Ops(step3Rows, rowEnd);
  const base = planBaseBeds(step3Rows, rowEnd);
  let live = new Map();
  const stitches = new Map();
  const atRow = new Map();
  const sheetRows = [];
  const notes = [];
  let nextId = 0;
  let notedPartial = false;
  const usedPlan = new Set();
  const alignAfter = [];
  const baseIds = new Set();
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

  const circumferenceOnNeedles = () => {
    let n = 0;
    for (const id of live.values()) if (baseIds.has(id)) n += 1;
    return n === baseIds.size && baseIds.size === base.n;
  };

  const rememberPartial = (where) => {
    if (notedPartial || circumferenceOnNeedles()) return;
    notedPartial = true;
    const have = [...live.values()].filter((id) => baseIds.has(id)).length;
    notes.push(
      `NOTE: ${where} 时底圈 ${base.n} 针才织了 ${have} 针。没织上的是短行起针，不是前后床针数差，所以这里不翻针。数目已经齐、但两床物理窗错开一针时，另把错开的那一床整段移齐。`,
    );
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
    if (decs.length) {
      fail(`step3 行 ${op.knit}: 第一圈这张样本没有减针。减针后的翻针还没定，先停`);
    }
    const fresh = new Set();
    let pass = 0;
    for (const cell of incs.slice().reverse()) {
      const added = parseIncN(cell.token);
      const pivot0 = cell.col + step;
      for (let g = 1; g <= added; g++) fresh.add(cell.col + step * g);
      const arrow = xferArrow(step, true);
      for (let k = 0; k < added; k++) {
        const cols = passCols(live, pivot0, step);
        for (const ncol of fresh) if (!cols.includes(ncol)) cols.push(ncol);
        cols.sort((a, b) => a - b);
        const ri = op.xfers[pass];
        const sheet = step3Rows[ri];
        const got = occupied(sheet);
        const problems = [];
        if (sheet.dir !== "X+") problems.push(`dir sheet=${sheet.dir} sim=X+`);
        if (got.map((c) => c.col).join(",") !== cols.join(",")) {
          problems.push(`cols sheet=${got.map((c) => c.col)} sim=${cols}`);
        }
        for (const src of got) {
          if (src.token !== `${arrow}1`) problems.push(`token col ${src.col} sheet=${src.token} sim=${arrow}1`);
        }
        if (problems.length) fail(`transfer row ${ri} (knit ${op.knit} pass ${pass}): ${problems.join("; ")}`);
        const shapeBed = increaseShapeBed(fresh, live, stitches, `step3 行 ${op.knit}`);
        const moved = applySelectiveMove(live, stitches, pivot0, step, step === 1 ? 1 : -1, shapeBed);
        live = moved.live;
        if (!moved.moves.length || moved.moves.some((m) => m.bed !== shapeBed || m.toPhys === m.fromPhys)) {
          fail(
            `step3 行 ${ri}: 加针应改成形床的物理针，得到 ${moved.moves.map((m) => `${m.bed}${m.fromPhys}→${m.toPhys}`).join(",") || "没有"}`,
          );
        }
        assertNoSharedNeedle(stitches, `step3 行 ${op.knit} 加针`);
        const token = toAbsoluteToken(`${arrow}1`, shapeBed);
        const srcFill = got.find((c) => c.col === moved.moves[0].chart)?.fill || got[0].fill || "rgb(204,204,255)";
        sheetRows.push({
          dir: "X+",
          step3: ri,
          cells: moved.moves.map((m) => ({
            col: columnForPhys(m.bed, m.fromPhys),
            token,
            fill: srcFill,
            phys: m.fromPhys,
            bed: m.bed,
            id: m.id,
            chart: m.chart,
          })),
        });
        atRow.set(ri, new Map(moved.moves.map((m) => [m.chart, { id: m.id, bed: m.bed, phys: m.fromPhys, chart: m.chart }])));
        pass += 1;
      }
    }
    if (pass !== op.xfers.length) fail(`knit row ${op.knit}: drew ${pass} transfers, sheet has ${op.xfers.length}`);

    const knitSnap = new Map();
    const knitCells = [];
    for (const cell of kcells) {
      let id = live.get(cell.col);
      if (id == null) {
        const where = `step3 行 ${op.knit} 列 ${cell.col}`;
        let placed;
        if (base.plan.has(cell.col) && !usedPlan.has(cell.col)) {
          usedPlan.add(cell.col);
          placed = base.plan.get(cell.col);
        } else if (fresh.has(cell.col)) {
          const { left, right } = chartNeighbors(stitches, cell.col);
          placed = physInHole(left, right, where);
          if ([...stitches.values()].some((st) => st.bed === placed.bed && st.phys === placed.phys)) {
            fail(`${where}: 空档 ${placed.bed}${placed.phys} 已被占`);
          }
        } else {
          fail(`${where} 不是底圈里还没织的针，也不是这次加针的空档`);
        }
        id = nextId;
        nextId += 1;
        const st = {
          id,
          bed: placed.bed,
          phys: placed.phys,
          chart: cell.col,
          birthChart: cell.col,
          base: Boolean(placed.base),
        };
        stitches.set(id, st);
        live.set(cell.col, id);
        if (placed.base) baseIds.add(id);
        assertNoSharedNeedle(stitches, where);
      }
      const st = stitches.get(id);
      if (st.chart !== cell.col) fail(`step3 行 ${op.knit} 列 ${cell.col} 线圈 ${id} 的列是 ${st.chart}`);
      knitSnap.set(cell.col, { ...copyStitch(st), token: cell.token });
      knitCells.push(drawCell(cell, st));
    }
    const knitCols = knitCells.map((c) => c.col);
    if (new Set(knitCols).size !== knitCols.length) {
      fail(`step3 行 ${op.knit} 物理表列重叠：${knitCols.join(",")}`);
    }
    sheetRows.push({ dir: krow.dir, step3: op.knit, cells: knitCells });
    atRow.set(op.knit, knitSnap);
    rememberLive(`step3 行 ${op.knit} ${krow.dir} 织完`);
    if (incs.length) {
      rememberPartial(`step3 行 ${op.knit} 加针后`);
      const where = `step3 行 ${op.knit} 加针后`;
      const fixes = settleAssignedWindows(stitches, base.plan, usedPlan, where);
      for (const fix of fixes) {
        sheetRows.push(fix.row);
        notes.push(fix.note);
      }
      if (fixes.length) {
        alignAfter.push(op.knit);
        rememberLive(`${where} 物理窗对齐后`);
      }
    }
  }

  if (usedPlan.size !== base.n) {
    fail(`底圈 ${base.n} 针只用了 ${usedPlan.size} 个出生列`);
  }
  if (!circumferenceOnNeedles()) {
    fail(`第一圈结束时底圈还没织完（${baseIds.size}/${base.n}）`);
  }
  const { f, b, N } = listsOf(stitches);
  const tF = Math.ceil(N / 2);
  const tB = Math.floor(N / 2);
  if (f.length !== tF || b.length !== tB || f[0]?.phys !== 0 || !isContig(f) || !isContig(b)) {
    fail(
      `第一圈结束 F${f.length}[${f.map((st) => st.phys)}] B${b.length}[${b.map((st) => st.phys)}] 不是 F${tF}/B${tB}、前床从 0 连续。不发明翻针。`,
    );
  }
  if (f.at(-1).phys !== tF - 1) {
    fail(`第一圈结束前床末针不是 ${tF - 1}，得到 ${f.map((st) => st.phys).join(",")}`);
  }
  if (tF === tB) {
    if (b[0].phys !== f[0].phys || b.at(-1).phys !== f.at(-1).phys) {
      fail(
        `NOTE: 第一圈结束数目已齐，物理窗前 ${f[0].phys}…${f.at(-1).phys} 后 ${b[0].phys}…${b.at(-1).phys} 没有对齐，先停`,
      );
    }
  } else if (tF === tB + 1) {
    fail(`结束仍差 1 针（F${tF}/B${tB}）。空针应在已经走到的左衔接，这张样本不该停在这里，先停`);
  } else {
    fail(`结束 F${tF} B${tB} 不满足 F≥B 且 |F−B|≤1`);
  }
  if (sheetRows.some((row) => row.dir === "Flip" || row.seat)) {
    fail("这张样本的第一圈数目齐之后是整床移，不是 Flip");
  }

  const r0 = atRow.get(0);
  const r2 = atRow.get(2);
  const r3 = atRow.get(3);
  const at = (snap, col, where) => {
    const st = snap?.get(col);
    if (!st) fail(`${where} 列 ${col} 没有线圈`);
    return st;
  };
  const s0 = at(r0, 19, "step3 行 0 列 19");
  const v0 = at(r0, 20, "step3 行 0 列 20");
  const s = at(r2, 18, "step3 行 2 vL");
  const br = at(r2, 19, "step3 行 2 ^R");
  const v = at(r2, 20, "step3 行 2 +R1");
  if (s.id !== s0.id) fail(`行 2 列 18 线圈 ${s.id} 不是行 0 列 19 的线圈 ${s0.id}`);
  if (v.id !== v0.id) fail(`行 2 列 20 线圈 ${v.id} 不是行 0 列 20 的线圈 ${v0.id}`);
  if (s0.bed !== "B" || s0.phys !== 18) fail(`起针列 19 应为后床 18（紧挨前床），得到 ${s0.bed} ${s0.phys}`);
  if (v0.bed !== "B" || v0.phys !== 17) fail(`起针列 20 应为后床 17，得到 ${v0.bed} ${v0.phys}`);
  if (s.token !== "vL" || s.bed !== "B" || s.phys !== 19) {
    fail(`行 2 vL 应在移圈后的后床物理针 19，得到 ${s.token} ${s.bed} ${s.phys}`);
  }
  if (br.token !== "^R" || br.bed !== "B" || br.phys !== 18) {
    fail(`行 2 ^R 应夹在物理 19 和 17 之间（物理 18），得到 ${br.token} ${br.bed} ${br.phys}`);
  }
  if (v.token !== "+R1" || v.bed !== "B" || v.phys !== 17) {
    fail(`行 2 +R1 应仍是后床 17，得到 ${v.token} ${v.bed} ${v.phys}`);
  }
  if (!(s.phys > br.phys && br.phys > v.phys)) {
    fail(`行 2 新线圈应夹在转入针和 +R1 之间：${s.phys}/${br.phys}/${v.phys}`);
  }
  const knit2 = sheetRows.find((row) => row.step3 === 2);
  const knit2cols = (knit2?.cells || [])
    .slice()
    .sort((a, b) => a.col - b.col)
    .map((c) => `${c.col}:${c.token}@${c.phys}`)
    .join(",");
  if (knit2cols !== "18:BvL@19,19:B^R@18,20:B+R1@17") {
    fail(`下一织行应按物理针映回表（从表列 20 / 物理 17 往左），得到 ${knit2cols}`);
  }
  const xfer = sheetRows.find((row) => row.dir === "X+");
  if (!xfer || xfer.cells.length !== 1 || xfer.cells[0].token !== "B→" || xfer.cells[0].col !== 19 || xfer.cells[0].id !== s.id || xfer.cells[0].phys !== 18) {
    fail(`加针移圈应画在移之前的列 19（物理 18），得到 ${xfer ? xfer.cells.map((c) => `${c.col}:${c.token}@${c.phys}`).join(",") : "缺失"}`);
  }
  const castOn = sheetRows.find((row) => row.step3 === 0);
  const castCols = new Map((castOn?.cells || []).map((c) => [c.col, c.token]));
  if (castCols.get(18) !== "F·" || castCols.get(19) !== "B·" || castCols.get(20) !== "BvR" || castCols.has(21) || castCols.has(37)) {
    fail(`起针应是列 18 F·、列 19 B·、列 20 BvR，不在列 19 留夹缝，也不在列 37 预留空针，得到 ${[...castCols].map(([col, token]) => `${col}:${token}`).join(",")}`);
  }
  for (const row of sheetRows) {
    if (row.step3 > 2) break;
    if (row.cells.some((cell) => cell.col === 37 || (cell.bed === "B" && cell.phys === 0))) {
      fail(`step3 行 ${row.step3} 还没走到左衔接，却在列 37 / 后床物理针 0 放了线圈`);
    }
  }
  const alignRows = sheetRows.filter((row) => row.windowAlign);
  if (alignAfter.join(",") !== "2" || alignRows.length !== 1) {
    fail(`这张样本应在 step3 行 2 成形后整段对齐一次，得到 ${alignAfter.join(",") || "没有"}`);
  }
  const knit2At = sheetRows.findIndex((row) => row.step3 === 2 && row.dir !== "X" && row.dir !== "X+");
  if (sheetRows[knit2At + 1] !== alignRows[0] || sheetRows[knit2At + 2]?.step3 !== 3) {
    fail("整段对齐应紧挨加针那一织行，后面的行再用新物理针");
  }
  const alignCols = alignRows[0].cells
    .map((cell) => `${cell.col}:${cell.token}@${cell.phys}`)
    .join(",");
  if (alignCols !== "18:B←@19,19:B←@18,20:B←@17" || alignRows[0].cells.some((cell) => cell.bed !== "B")) {
    fail(`后床整段应在移之前的物理针上画 B←，得到 ${alignCols}`);
  }
  const caret = at(r3, 18, "step3 行 3 ^L");
  const v3 = at(r3, 20, "step3 行 3 列 20");
  const freshSt = at(r3, 21, "step3 行 3 列 21");
  if (caret.id !== s.id || caret.token !== "^L" || caret.bed !== "B" || caret.phys !== 18) {
    fail(`对齐后行 3 ^L 应在后床物理针 18，得到 id ${caret.id} ${caret.token} ${caret.bed} ${caret.phys}`);
  }
  if (v3.id !== v.id || v3.bed !== "B" || v3.phys !== 16) {
    fail(`对齐后行 3 列 20 应是后床 16，得到 id ${v3.id} ${v3.bed} ${v3.phys}`);
  }
  if (freshSt.bed !== "B" || freshSt.phys !== 15 || r2.has(21)) {
    fail(`对齐后行 3 列 21 新起的底圈针应为后床 15，得到 ${freshSt.bed} ${freshSt.phys}`);
  }
  const knit3 = sheetRows.find((row) => row.step3 === 3);
  const knit3cols = (knit3?.cells || [])
    .slice()
    .sort((a, b) => a.col - b.col)
    .map((c) => `${c.col}:${c.token}@${c.phys}`)
    .join(",");
  if (knit3cols !== "19:B^L@18,20:B·@17,21:B·@16,22:B·@15,23:BvR@14") {
    fail(`对齐后的下一织行应按新物理针映回表，得到 ${knit3cols}`);
  }
  const r5 = atRow.get(5);
  const tail = at(r5, 36, "step3 行 5 列 36");
  if (tail.bed !== "B" || tail.phys !== 0 || tail.token !== "·") {
    fail(`后床最后一针应落在与前床对齐的物理针 0，得到 ${tail.token} ${tail.bed} ${tail.phys}`);
  }
  const tailCell = sheetRows.find((row) => row.step3 === 5)?.cells.find((cell) => cell.chart === 36);
  if (!tailCell || tailCell.col !== 37 || tailCell.phys !== 0 || tailCell.token !== "B·") {
    fail(`后床末针应画在列 37（物理针 0），得到 ${tailCell ? `${tailCell.col}:${tailCell.token}@${tailCell.phys}` : "缺失"}`);
  }
  notes.push(
    "NOTE: 移圈改的是物理针。B→ 画在移之前的表列 19，把那枚后床针从物理 18 右移到物理 19，旁边那枚仍在物理 17。移完后床占物理 19 和 17。下一织行再按物理针映回表：物理 17 → 表列 20，物理 19 → 表列 18，新线圈补在中间的物理 18（表列 19）。所以这一行 L 从表列 20 起往左，左到右是 vL、^R、+R1。表列号不是物理针号。左衔接这几行还没走到，不为差 1 预留空针。",
  );

  const fCharts = f.map((st) => st.chart).sort((a, b) => a - b);
  const bCharts = b.map((st) => st.chart).sort((a, b) => a - b);
  if (fCharts.join(",") !== ints(-1, 17).join(",")) fail(`结束前床 chart 应为 −1…17，得到 ${fCharts}`);
  if (bCharts.join(",") !== ints(18, 36).join(",")) fail(`结束后床 chart 应为 18…36，得到 ${bCharts}`);

  const endStitches = [...stitches.values()]
    .map((st) => ({ id: st.id, bed: st.bed, phys: st.phys, chart: st.chart }))
    .sort((a, b) => a.id - b.id);
  if (endStitches[0]?.bed !== "F" || endStitches.find((st) => st.bed === "F" && st.phys === 0) == null) {
    fail(`第一圈结束前床第一针不是物理针 0`);
  }

  return {
    N,
    front: f.length,
    back: b.length,
    frontPhys: f.map((st) => st.phys),
    backPhys: b.map((st) => st.phys),
    frontEnd: f.at(-1).phys,
    backStart: b.at(-1).phys,
    foldBoth18: f.at(-1).phys === 18 && b.at(-1).phys === 18,
    baseN: base.n,
    baseFront: base.frontN,
    baseBack: base.backN,
    recenterAfter: null,
    windowAligns: alignRows.length,
    alignAfter,
    sheetRows,
    notes,
    atRow,
    anchors: { s, br, v, caret, v3, fresh: freshSt, castOnFold: s0, xfer: xfer.cells[0] },
    liveAt,
    stitches: endStitches,
    nextId,
  };
}

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
 * Front physical needle 0 after a chart slide that did not move the bed.
 * Every front stitch must share that same chart-to-phys offset. The
 * returned stitch is the needle a course starts on when step3 begins on
 * the next chart and skips this one.
 */
function frontOriginStitch(stitches) {
  const front = [...stitches.values()].filter((st) => st.bed === "F").sort((a, b) => a.phys - b.phys);
  const origin = front[0];
  if (!origin || origin.phys !== 0) {
    fail(`第二圈继承的前床第一针不是 F0，得到 ${origin ? `${origin.bed}${origin.phys}` : "没有"}`);
  }
  const chartShift = origin.phys - origin.chart;
  for (const st of front) {
    if (st.phys - st.chart !== chartShift) {
      fail(
        `NOTE: 第二圈继承时前床 chart ${st.chart} 物理针 ${st.phys} 与第一针 chart ${origin.chart} 不是同一个偏差，先停`,
      );
    }
  }
  return origin;
}

/**
 * Ring 1 only. Copies ring 0's ending stitches (bed, phys, chart).
 * Knit and transfer columns are both columnForPhys.
 * If a chart slide left physical needle 0 on the chart before 0, a knit
 * course that includes the next chart and not this needle still knits it.
 * A negative step3 column that is already a live chart is that stitch.
 * Any other negative column wraps onto the back-bed tail, low phys toward
 * the high sheet column. After inc/dec, settleAssignedWindows applies the
 * same flip / rack rule as ring 0. Anything it does not cover stops with NOTE.
 */
export function simulateRing1(step3Rows, rowStart, rowEnd, seed) {
  if (!seed?.stitches?.length) fail("第二圈没有继承到第一圈末床位");
  const stitches = new Map();
  const live = new Map();
  let nextId = seed.nextId ?? 0;
  for (const src of seed.stitches) {
    if (stitches.has(src.id) || live.has(src.chart)) {
      fail(`第二圈继承的线圈冲突 id ${src.id} chart ${src.chart}`);
    }
    stitches.set(src.id, { id: src.id, bed: src.bed, phys: src.phys, chart: src.chart });
    live.set(src.chart, src.id);
    if (src.id >= nextId) nextId = src.id + 1;
  }
  const origin = frontOriginStitch(stitches);
  const chartShift = origin.phys - origin.chart;
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
    const charts = new Set(cells.map((cell) => cell.col));
    const nextChart = origin.chart + chartShift;
    if (origin.bed === "F" && charts.has(nextChart) && !charts.has(origin.chart)) {
      if (live.get(origin.chart) !== origin.id || origin.phys !== 0) {
        fail(`NOTE: step3 行 ${ri} 织到了前床第一针的下一列，但 F0 已经不在 chart ${origin.chart}，先停`);
      }
      const neighbor = cells.find((cell) => cell.col === nextChart);
      if (neighbor.token !== "·" && neighbor.token !== ".") {
        fail(`NOTE: step3 行 ${ri} 前床第一针的下一列是 ${neighbor.token}，不是平针，先停`);
      }
      cells.push({ col: origin.chart, token: "·", fill: neighbor.fill });
    }
    const negs = cells.filter((c) => c.col < 0).sort((a, b) => b.col - a.col);
    const wrapCells = negs.filter((cell) => !live.has(cell.col));
    const tail = [...stitches.values()].filter((st) => st.bed === "B").sort((a, b) => a.phys - b.phys || a.id - b.id);
    const used = new Set();
    const placed = [];
    const placeStitch = (cell, st, extra) => {
      const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
      placed.push({
        col: columnForPhys(st.bed, st.phys),
        token: painted.token,
        fill: painted.fill,
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        chart: cell.col,
        ...extra,
      });
    };
    wrapCells.forEach((cell, i) => {
      const st = tail[i];
      if (!st) fail(`step3 行 ${ri} 负列 ${cell.col} 超出后床末尾（后床只有 ${tail.length} 针）`);
      if (used.has(st.id)) fail(`step3 行 ${ri} 负列 ${cell.col} 与本行已有圈冲突`);
      used.add(st.id);
      placeStitch(cell, st, { wrap: true });
    });
    const births = [];
    for (const cell of cells) {
      if (wrapCells.includes(cell)) continue;
      const id = live.get(cell.col);
      if (id != null) {
        if (used.has(id)) fail(`step3 行 ${ri} 列 ${cell.col} 与绕回的是同一个圈 ${id}`);
        used.add(id);
        placeStitch(cell, stitches.get(id));
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
        col: columnForPhys(bed, phys),
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

  const insertRepair = (where, step3After) => {
    const fixes = settleAssignedWindows(stitches, new Map(), new Set(), where);
    events.push({
      after: step3After,
      where,
      fixes: fixes.map((fix) => ({ dir: fix.row.dir, note: fix.note })),
    });
    for (const fix of fixes) {
      inserts.push({
        after: step3After,
        dir: fix.row.dir,
        windowAlign: Boolean(fix.row.windowAlign),
        cells: sparseCells(fix.row.cells),
      });
    }
    return fixes;
  };

  snapshotCounts("第二圈开始");
  for (let i = rowStart; i < rowEnd; i++) {
    const row = step3Rows[i];
    if (row.dir === "X" || row.dir === "X+") {
      const moved = drawMove(row, i);
      byRow.set(i, { dir: row.dir, step3: i, cells: moved.drawn });
      snapshotCounts(`step3 行 ${i} ${row.dir}`);
      if (row.dir === "X") {
        insertRepair(`step3 行 ${i} 减针后`, i);
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
      insertRepair(`step3 行 ${i} 加针后`, i);
    } else {
      const { f, b, N } = listsOf(stitches);
      if (f.length !== Math.ceil(N / 2) || b.length !== Math.floor(N / 2) || !isContig(f) || !isContig(b) || f[0].phys !== 0) {
        fail(`step3 行 ${i} 平针之后 F${f.length} B${b.length} 不在 F=ceil(N/2)、左折返前床 0`);
      }
    }
    snapshotCounts(`step3 行 ${i} ${row.dir}`);
  }
  const end = listsOf(stitches);
  return { byRow, inserts, events, trace, end, chartShift };
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
    ["第一圈", `去掉加减针后的整圈是 F${ring.baseFront}/B${ring.baseBack}。前床从物理针 0 起，后床紧挨前床。表列由物理针映出：前床列=物理针，后床列=37−物理针，表列号不等于物理针号。移圈改物理针，下一织行再用新物理针映回表。F=B+1 的空针在左衔接，没走到不安排，不预留列 37，右折返不留夹缝。成形后数目差一针才在右折返按差翻；数目齐但物理窗错开一针，就把错开的那一床整段移齐，不靠 Flip。这张样本加针后前床 0…18、后床 1…19，整段移后床到 0…18。结束 F${ring.front}/B${ring.back}，两床都从物理针 0 起。这张样本没有第一圈 Flip。`],
    ["NOTE", ring.notes[0] || "第一圈整圈织完时已经 F≥B 且 |F−B|≤1，没有额外翻针。"],
    ["对齐", ring.notes.find((note) => note.includes("错开一针")) || ""],
    ["NOTE2", ring.notes.find((note) => note.includes("物理 17")) || "移圈改物理针，下一织行再映回表。"],
    ["第二圈", `继承第一圈末床位。前床仍是物理 0…18，第一针是 F0。第一圈把 chart 滑开后，这一针落在 chart 0 的前一格。织行只要织到下一格而跳过它，仍从这一针起，所以表列 0 是 F0，旁边的短行针仍是 F1…F7。织行和移圈同一套物理列，不再把织行往左偏一格。已经有线圈的负列就是那枚针，其余负列才绕回后床末尾。加减针后用和第一圈相同的规则：数目差一针在右折返翻，数目齐但错开一针就整床移，其它情况停。结束 F${end?.f.length ?? "?"}/B${end?.b.length ?? "?"}`],
    ["绕回", "Step3 负列如果已经是继承下来的线圈，就画在它自己的物理列上（前床物理针 0 在表列 0，文字 F0）。没有线圈的负列才是后床末尾绕回，表列 = 37−物理针。同一个圈只有一列。点左折返时两端一起高亮"],
    ["F… / B…", "bed follows the stitch. Flip is ⬇ back→front or ⬆ front→back on the inserted row"],
    ["F→ / B←", "1 stitch: arrow only (F→ F← B→ B←). 2 or more keeps the count (F→2). No R/L"],
    ["columns", "ring 0 and ring 1 knits, transfers, flips, and racks: front = phys, back = 37−phys. No knit phys−1. The front decrease is F← on columns 6…18. Rings 2–4 stay on step3 columns"],
    ["rows", "stitch_map_bind.json stays 121. The cellmap sheet maps each bind cell to its sheet row and column. Ring 0 inserts one whole-bed align row after shaping; ring 1 still inserts two Flip rows"],
    ["phys", "表 phys 只抄生成时已经跟踪的床和物理针。表列号不是物理针号。第 3–5 圈没有这份数据。"],
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

function physSheet(entries, xf) {
  const parts = [bof(0x0010)];
  ["sheetRow", "sheetCol", "bed", "phys"].forEach((label, col) => {
    parts.push(labelRecord(0, col, xf, label));
  });
  entries.forEach((entry, i) => {
    const row = i + 1;
    parts.push(numberRecord(row, 0, xf, entry.sheetRow));
    parts.push(numberRecord(row, 1, xf, entry.sheetCol));
    parts.push(labelRecord(row, 2, xf, entry.bed));
    parts.push(numberRecord(row, 3, xf, entry.phys));
  });
  parts.push(eof());
  return { name: "phys", bytes: Buffer.concat(parts) };
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
  if (ring.recenterAfter != null) fail("ring 0 no longer inserts a recenter row");
  const alignN = ring.windowAligns;
  if (alignN !== 1) fail(`第一圈应在成形后整段对齐一次，得到 ${alignN}`);
  if (ring.sheetRows.length !== span.rowEnd + alignN) {
    fail(`ring 0 sheet rows ${ring.sheetRows.length}, expected ${span.rowEnd + alignN}`);
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
  const ring1 = simulateRing1(step3.rows, ring1Span.start, ring1Span.end, ring);

  const rows = [];
  const step3ToSheet = [];
  const extraCols = [];
  const pushSparse = (row) => {
    for (const col of row.cells.keys()) if (!step3.needles.includes(col)) extraCols.push(col);
    rows.push(row);
  };
  for (const builtRow of ring.sheetRows) {
    if (builtRow.step3 != null) step3ToSheet[builtRow.step3] = rows.length;
    pushSparse({
      dir: builtRow.dir,
      step3: builtRow.step3,
      cells: sparseCells(builtRow.cells),
      shifted: true,
    });
  }
  if (rows.some((row) => row.dir === "Flip")) fail("ring 0 output contains a Flip row");
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

  for (let i = 0; i < step3.rows.length; i++) {
    const sheetRow = rows[step3ToSheet[i]];
    if (sheetRow?.step3 !== i) fail(`step3 row ${i} landed on sheet row ${step3ToSheet[i]}`);
    if (i < span.rowEnd) {
      assertRing0PhysicalRow(sheetRow, step3.rows[i], i);
    } else if (i < ring1Span.end) {
      if (sheetRow.dir !== step3.rows[i].dir) fail(`step3 row ${i} dir drifted`);
      for (const cell of occupied(sheetRow)) {
        const bed = bedOf(cell.token);
        if (bed !== "F" && bed !== "B") fail(`第二圈表行 ${step3ToSheet[i]} 符号 ${cell.token} 没有床`);
        const wantCol = columnForPhys(bed, cell.phys);
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
  const headerSet = new Set(needles);
  const ring2Sheet = step3ToSheet[ring2Span.start];
  if (ring1.inserts.length !== 2 || ring1.inserts.some((row) => row.dir !== "Flip")) {
    fail(`第二圈应只插入两行翻针，得到 ${ring1.inserts.map((row) => row.dir).join(",")}`);
  }
  if (rows.length !== step3.rows.length + ring1.inserts.length + alignN) {
    fail(`output rows ${rows.length}, expected ${step3.rows.length + ring1.inserts.length + alignN}`);
  }
  const flipOf = (event) =>
    event.fixes?.length
      ? event.fixes.map((fix) => `${fix.dir}:${fix.note}`).join(" || ")
      : "不移";
  const gotEvents = ring1.events.map(flipOf).join(" | ");
  const wantEvents = [
    "Flip:NOTE: step3 行 7 减针后 数目不是 F19/B18，在右折返把 B18 翻到 F18。",
    "Flip:NOTE: step3 行 11 加针后 数目不是 F19/B19，在右折返把 F19 翻到 B18。",
    "不移",
    "不移",
  ].join(" | ");
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
    fail(`前床减针应从锚点画 F← 列 6…18，得到 ${frontDecCols.join(",")}`);
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
  const flipGlyph = (sheetRow) =>
    occupied(rows[sheetRow])
      .map((cell) => `${cell.col}:${cell.token}`)
      .join(",");
  const flipSheets = rows.map((row, index) => (row.flip ? index : -1)).filter((index) => index >= 0);
  if (flipSheets.length !== 2) fail(`第二圈翻针行应为两行，得到 ${flipSheets}`);
  if (flipGlyph(flipSheets[0]) !== "19:⬇" || flipGlyph(flipSheets[1]) !== "19:⬆") {
    fail(`翻针应画在翻之前的物理表列：⬇ 与 ⬆ 都在列 19，得到 ${flipGlyph(flipSheets[0])} / ${flipGlyph(flipSheets[1])}`);
  }
  const wrapsOf = (step3Row) =>
    [...(ring1.byRow.get(step3Row)?.cells.values() || [])]
      .filter((cell) => cell.wrap)
      .sort((a, b) => b.chart - a.chart)
      .map((cell) => `${cell.chart}:${cell.bed}${cell.phys}@${cell.col}`)
      .join(",");
  const opening = rows[step3ToSheet[ring1Span.start]];
  const openingCells = occupied(opening).slice().sort((a, b) => a.col - b.col);
  if (
    openingCells.map((cell) => `${cell.col}:${cell.bed}${cell.phys}`).join(",") !==
    "0:F0,1:F1,2:F2,3:F3,4:F4,5:F5,6:F6,7:F7"
  ) {
    fail(
      `第二圈首行应从继承的 F0 起，画在表列 0…7（F0…F7），得到 ${openingCells.map((cell) => `${cell.col}:${cell.bed}${cell.phys}`).join(",")}`,
    );
  }
  const frontZero = [...(ring1.byRow.get(9)?.cells.values() || [])].find((cell) => cell.chart === -1);
  if (!frontZero || frontZero.bed !== "F" || frontZero.phys !== 0 || frontZero.col !== 0) {
    fail(
      `前床第一针应是 F0，画在表列 0，得到 ${frontZero ? `${frontZero.col}:${frontZero.bed}${frontZero.phys}` : "缺失"}`,
    );
  }
  if (wrapsOf(9) !== "-2:B0@37,-3:B1@36,-4:B2@35") {
    fail(`step3 行 9 绕回 ${wrapsOf(9)}`);
  }
  if (wrapsOf(11) !== "-2:B0@37,-3:B1@36,-4:B2@35") {
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
      const want = columnForPhys(bed, cell.phys);
      if (cell.col !== want) {
        const where = bed === "F" ? "物理针" : "37−物理针";
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
  const physEntries = [];
  const seenPhys = new Set();
  for (let sheetRow = 0; sheetRow < rows.length; sheetRow++) {
    for (const cell of occupied(rows[sheetRow])) {
      if (sheetRow >= ring2Sheet) continue;
      if ((cell.bed !== "F" && cell.bed !== "B") || !Number.isInteger(cell.phys)) continue;
      const key = `${sheetRow},${cell.col}`;
      if (seenPhys.has(key)) fail(`phys ${key} 记了两次`);
      seenPhys.add(key);
      physEntries.push({ sheetRow, sheetCol: cell.col, bed: cell.bed, phys: cell.phys });
    }
  }
  let tracked = 0;
  for (let sheetRow = 0; sheetRow < ring2Sheet; sheetRow++) tracked += occupied(rows[sheetRow]).length;
  if (physEntries.length !== tracked) {
    fail(`phys 表 ${physEntries.length} 行，第一圈和第二圈有符号的格子是 ${tracked}`);
  }
  const dataSheet = sheetFromGrid("step4-ring0", step3.headerLabel || "dir\\col", needles, rows, xfIndexForFill);
  const legend = legendSheet(xfIndexForFill, ring, ring1);
  const mapSheet = cellMapSheet(cellMap, xfIndexForFill("rgb(255,255,255)"));
  const phys = physSheet(physEntries, xfIndexForFill("rgb(255,255,255)"));
  const xfBytes = Buffer.concat(palette.map((fill) => xfRecord(icvForFill(fill))));
  const bofBytes = bof(0x0005);
  const eofBytes = eof();
  const sheets = [dataSheet, legend, mapSheet, phys];
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
    phys: physEntries,
    summary: summarizeRing0(rows.slice(0, ring.sheetRows.length)),
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
    `build-step4-ring0 ${check ? "check " : ""}ok: ring0 step3 [0, ${span.rowEnd}) face ${span.ring1Face} starts path 1; N=${ring.N} F=${ring.front} B=${ring.back}; rows ${built.rows.length}; 第一圈成形后整段对齐 ${ring.windowAligns} 行`,
  );
  console.log(`  表列公式：前床 列=物理针；后床 列=37−物理针。织行和移圈行相同。`);
  for (const row of built.summary) {
    console.log(
      `  表行 ${row.display_row} ${row.dir} F=${row.F} 表列[${row.fCols.join(",")}] 物理针[${row.fPhys.join(",")}] B=${row.B} 表列[${row.bCols.join(",")}] 物理针[${row.bPhys.join(",")}]`,
    );
  }
  for (const note of ring.notes) console.log(`  ${note}`);
  const at = (sheetRow, id) => built.rows[sheetRow].cells.find((c) => c.id === id && c.token);
  const sRow = at(2, s.id);
  const brRow = at(2, br.id);
  const vRow = at(2, v.id);
  const caretRow = at(built.step3ToSheet[3], caret.id);
  const v3Row = at(built.step3ToSheet[3], v3.id);
  const freshRow = at(built.step3ToSheet[3], fresh.id);
  console.log(
    `  加针后第2行：vL 表列 ${sRow.col} / 物理针 ${sRow.phys}；^R 表列 ${brRow.col} / 物理针 ${brRow.phys}；+R1 表列 ${vRow.col} / 物理针 ${vRow.phys}`,
  );
  console.log(
    `  对齐后 step3 行 3：^L 表列 ${caretRow.col} / 物理针 ${caretRow.phys}；chart 20 表列 ${v3Row.col} / 物理针 ${v3Row.phys}；新针 表列 ${freshRow.col} / 物理针 ${freshRow.phys}`,
  );
  console.log(`  表头针位 ${built.needles[0]}…${built.needles.at(-1)}，共 ${built.needles.length} 列`);
  console.log("  每步之后床上仍挂着的线圈：");
  for (const live of ring.liveAt) {
    console.log(`    ${live.label} F=${live.F} [${live.fPhys.join(",")}] B=${live.B} [${live.bPhys.join(",")}]`);
  }
  console.log(
    `  ring 0 结束：前床物理针 ${ring.frontPhys[0]}…${ring.frontEnd}；后床物理针 ${ring.backPhys[0]}…${ring.backStart}；右折返都在 18：${ring.foldBoth18 ? "是" : "否"}`,
  );
  const last0 = built.rows[built.step3ToSheet[span.rowEnd - 1]];
  const first1 = built.rows[built.step3ToSheet[span.rowEnd]];
  const colsOf = (row) => occupied(row).map((c) => c.col).join(",");
  console.log(`  ring0 末行（表行 ${built.step3ToSheet[span.rowEnd - 1]}）表列 ${colsOf(last0)}`);
  console.log(`  ring1 首行（表行 ${built.step3ToSheet[span.rowEnd]}）表列 ${colsOf(first1)}`);
  console.log(`  总行数 ${built.rows.length}`);
  console.log("  第二圈：");
  for (const row of built.ring1.trace) {
    console.log(`    ${row.label} N=${row.N} F${row.F}[${row.fPhys[0]}…${row.fPhys.at(-1)}] B${row.B}[${row.bPhys[0]}…${row.bPhys.at(-1)}]`);
  }
  for (const event of built.ring1.events) {
    const text = event.fixes?.length ? event.fixes.map((fix) => fix.note).join(" ") : "不翻针、不整床移";
    console.log(`    对齐 step3 ${event.after}: ${text}`);
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
