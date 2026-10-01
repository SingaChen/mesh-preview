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
 * one stitch are a right-fold flip, not a rack. When that miss is heading
 * toward equal packed windows and the same-index pair is the needle just
 * past the packed high, the flip lands there and only that one coil moves
 * from Hi to Hi−1. That step is never a whole-bed rack, and the index is
 * whatever the windows are, not one sample needle. Counts that already match,
 * while the windows are the same length and exactly one needle apart, rack
 * the offset bed onto the other window: every live stitch on that bed and
 * every remaining plan slot. When the counts are already F = B + 1 but the
 * empty needle is the short bed's high end (right fold) instead of physical
 * needle 0 (left junction), the same whole-bed move shifts that short bed
 * by one so the empty lands at the left junction. The arrow is drawn on the
 * source needle of each stitch already there; later rows use the new
 * needles. A spare that is already at the left junction is left alone. Any
 * other window stops. The rule is not tied to one sheet row.
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
 * Ring 1 inherits those end beds and keeps knitting on those physical
 * needles, starting at front needle 0. Step3 columns are the old transfer
 * index. They do not re-pick the start. On the front, column C is the
 * stitch at physical needle C, so the first stitch of the ring is F0.
 * On the back, column C is still the stitch whose chart is C. A negative
 * column that is not one of those stitches wraps onto the back tail.
 * Knits and transfers use that same lookup, then transfers, flips, and
 * whole-bed moves draw with front = phys, back = 37 − phys. A knit
 * course does not. Its sheet column is the course column itself, and
 * the cell label is the needle. A course column at or below the front
 * bed's last physical needle is that front needle, even when a back
 * stitch still carries the same chart. A course column past the front
 * continues from the back fold inward: the next column is the highest
 * back needle, then the next lower one, with no empty cell and no
 * stacking. A short course stops on its last column and does not draw
 * a needle it did not reach. That fold recount is not a turn. A decrease
 * transfer splits the course. On the back, that transfer repacks the
 * needles, and every later course — the remainder and the courses after
 * it, in either direction — keeps a column past the front on this same
 * recount, so the chain stays on those physical needles. On the
 * second and third circles, when the next knit reverses on the column
 * where the previous knit stopped, and nothing has transferred or
 * flipped, the course only rises: the first stitch is that same needle,
 * and each later column is one step in the new direction. It does not
 * take an extra needle toward or away from the fold, and it does not
 * copy the previous row's other labels. This sample's increase knit ends at F19
 * on column 19. The flip row still shows that stitch. After that flip
 * the stitch is B19, and the rack leaves it at B18, so the next knit
 * that reaches column 19 starts on B18 and column 18 is F18. A longer
 * course past that column keeps going F18, B18, B17, … on consecutive
 * columns. The left-fold wrap tail still uses 37 − phys, because those
 * step3 columns are negative. Before the back decrease repacks the bed,
 * a transfer column is still the chart index: the back decrease therefore
 * moves the chart-20 needle, while the knit that carries -R1 draws the
 * course needle on that column. A decrease anchor is the stitch on the
 * -R1 chart, not that column read as a physical needle: the front's chart
 * sits one needle left of its needle, so the column would slide the
 * anchor. Arrows start on that stitch. A front pass that also names the
 * back includes the front needle at the fold, because column 18 is the
 * back stitch and the front's last needle has no column of its own.
 * After that repack, a transfer column is the same physical needle a
 * knit course column is: on the front, that needle; past the front, the
 * next back needle inward from the fold. The move is still only the
 * shaping bed. After each inc/dec it uses the same window rule as ring
 * 0: a one-stitch count gap flips at the right fold, an equal-count
 * one-needle offset racks the offset bed, and an |F−B|=1 empty that the
 * flip left on the right fold racks the short bed so the empty sits at
 * the left junction. There is no physical needle below 0. A shaping stitch
 * whose next needle would be negative leaves the bed; it is not parked
 * on F−1 and racked back onto the high end. The following knit fills the
 * one-needle gap that shift left behind. On this sample the third-circle
 * increase therefore returns to F0…F18 / B1…B18, the empty already at
 * the left fold, and the window rule does not move. Ring 2 keeps those
 * course columns, including the same rise-only turn. The same decrease
 * then moves the front from the first named needle through the end of
 * that bed. Counts are equal and one needle apart, so the next row racks
 * only the back bed. The following back decrease consumes the needle at
 * the left fold and leaves the empty already there. The next decrease
 * leaves the front two stitches longer, both beds ending on the same
 * needle, with the back starting two higher. A right-fold flip moves
 * the extra stitch onto the other bed at that same physical index.
 * The pair is occupied, so the short bed racks one needle toward 0
 * first and the flip lands on the vacated pair. The windows are then
 * one apart, and the one-needle rack aligns them. An empty needle one
 * past the pair is not a flip target. The next circle keeps those beds.
 * Its decreases use the same same-index flip and one-needle rack. A
 * decrease marker on the first moved column is already in the pass.
 * After a decrease the front bed is seated on physical needle 0, the
 * same whole-bed rack an increase already uses, before the flip and
 * the left-fold empty are decided. Step3 row 69 lands the front on
 * 1…14 with the back already on 1…14. That rack moves the front onto
 * 0…13. Counts are equal and one needle apart, so the next row racks
 * the back bed onto 0…13. A front increase does not rack the whole
 * front bed. Only the front needles after the increase position move,
 * one needle per transfer pass, and that move is the increase transfer.
 * Needles at the increase position and before it stay. Columns past
 * the end of the bed are not stitches, so they do not pull the rest of
 * the front along. The increase knit places the new stitches before
 * any front/back balance. Step3 row 71 is that increase: +R2 sits on
 * F10, so the pass moves F11…F13, then F12…F14, and leaves holes at
 * 11 and 12. F0…F10 stay. Row 73 fills those holes and leaves the
 * front on 0…15 with the back on 0…13, one stitch off the equal packed
 * window 0…14. The same rule flips F15 onto B15, then moves only that
 * coil from 15 to 14. The beds are then F0…F14 / B0…B14.
 *
 * A -Rn marker is n one-needle decrease passes after that knit, not one
 * multi-needle move on the knit row. The marker column stays the anchor
 * for every pass. The pass that still has k decreases left starts k
 * columns after the marker, so the stitches between them wait. The beds
 * are not balanced between those passes. After the last pass the existing
 * settle runs: seat the front on 0, then the same-index flip and the
 * one-needle rack, or the single excess coil from Hi to Hi−1 when that
 * is the window. A pass moves only the stitches named from anchor+k
 * through that block's fold-side edge. The neighbor outside the block
 * is the landing needle, not a source. Before a repack, a last pass
 * whose chart stitch sits in that outside slot includes the chart
 * stitch: it is the edge the transfer columns started one past, and
 * the landing needle is the one beyond it. A course stitch that only
 * fills the landing slot after a repack stays put. Columns the recount
 * would place below physical needle 0, or below the live low needle of
 * that bed, are not stitches and do not pull the rest.
 * On this sample step3 row 75 is -R2 on B12. The first pass moves
 * B10…B0 and lands on B11; the second moves B11…B1 and lands on B12.
 * The pair at the right
 * fold is the short bed's high needle and it is occupied, so the settle
 * racks the back bed −1, flips F14 onto B14, then racks the back bed
 * onto 0…13. Row 78 is the same -R2 pattern and lands on F0…F12 /
 * B0…B12. The -R1 on row 84 already leaves the empty at the left
 * junction, so that settle does not move. Row 86 repeats the occupied
 * pair and lands on F0…F11 / B0…B11. Step3 row 87 is an R-direction
 * -R1 on the back, not a fold. The course column is the chart stitch,
 * visited toward lower needles: B2 then B1. The transfer moves B1 onto
 * B0. B0 is the landing and is not a source. There is no needle below 0.
 * Balance then sees the back window B0,B2…B11 and stops; that gap is
 * not one span.
 *
 * The phys sheet copies the bed and physical needle already stored on each
 * tracked cell, including transfers and flips. It does not place needles.
 * Cells from step3 row 89 on have no tracked physical needle, so they
 * are left out. The far-right 分布 column is the live F/B window at the start
 * of that row. It is the state machine's needles, including a gap when
 * the window is not one span. Step3 row 89 records F0…F11 / B0,B2…B11, the
 * window tracking ended on; later rows are blank.
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
 * Ring 1 uses columnForPhys for wraps, transfers, flips, and racks.
 * Knit courses follow visit order when a front needle and a facing
 * back needle would otherwise share that column.
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
    if (chartDelta !== 0 && st.bed === shapeBed) {
      const fromPhys = st.phys;
      const nextPhys = fromPhys + (st.bed === "F" ? chartDelta : -chartDelta);
      // There is no physical needle below 0. The stitch leaves the bed.
      // It is not parked on a negative index and racked back later.
      if (nextPhys < 0) {
        stitches.delete(id);
        moves.push({ id, bed: st.bed, chart: col, fromPhys, toPhys: nextPhys });
        continue;
      }
      st.phys = nextPhys;
      moves.push({
        id: st.id,
        bed: st.bed,
        chart: col,
        fromPhys,
        toPhys: st.phys,
      });
    }
    if (chartDelta !== 0) st.chart = dest;
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
 * Move every live stitch on `bed`, and any unused plan slot on that bed,
 * by `delta` physical needles. Arrows are drawn on the source needles.
 */
function rackWholeBed(stitches, plan, usedPlan, bed, delta, where) {
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
  return cells;
}

/**
 * After shaping. Assigned needles are the live stitches plus plan slots
 * not knitted yet.
 * Counts off by one stitch → one right-fold flip onto the other bed at
 * the same physical index. The usual target is the empty needle just
 * past the short window. When the counts are heading toward equal
 * packed windows (both beds 0…H) and that pair is exactly H+1, with
 * the short bed ending at H−1, the flip still lands on H+1. Only that
 * one coil then moves from Hi to Hi−1, onto the packed high. Not a
 * whole-bed rack, and not a walk across a wider gap. If the pair is
 * occupied and it is the short bed's high needle, one ±1 rack of the
 * short bed toward 0 vacates it first, then the flip runs. Any other
 * empty target stops.
 * Counts already F=ceil(N/2) and B=floor(N/2), windows the same length and
 * exactly one needle apart → rack that whole bed (live stitches and the
 * remaining plan) onto the window that already starts at 0.
 * Counts already F = B + 1, but the empty is the short bed's high needle
 * (right fold) → the same whole-bed move shifts the short bed by +1 so
 * the empty sits at physical needle 0, the left junction. An empty that
 * is already there is left alone.
 * A two-needle stagger still stops. Not a two-needle rack, and not tied
 * to a sheet row.
 */
export function settleAssignedWindows(stitches, plan, usedPlan, where, options = {}) {
  const fixes = [];
  const measure = () => {
    const front = assignedPhys(stitches, plan, usedPlan, "F", where);
    const back = assignedPhys(stitches, plan, usedPlan, "B", where);
    const N = front.length + back.length;
    return { front, back, N, tF: Math.ceil(N / 2), tB: Math.floor(N / 2) };
  };

  let { front, back, tF, tB } = measure();
  // After shaping, seat a front window that does not start at 0
  // back onto physical needle 0 before the flip and the left-fold empty
  // are decided. Increase and decrease use the same rack. A stitch that
  // would have landed below 0 has already left the bed, so this rack
  // does not start from a negative needle.
  if (options.seatFront && front[0] !== 0) {
    // One needle per row. A front that starts two above 0 takes two
    // racks, not one two-needle rack.
    let guard = 0;
    while (front[0] !== 0) {
      if (++guard > 8) {
        fail(`NOTE: ${where} 前床从 ${spanText(front)} 起，一次只移一针仍回不到 0，先停`);
      }
      const delta = front[0] > 0 ? -1 : 1;
      const beforeFront = spanText(front);
      const beforeBack = spanText(back);
      const beds = bedsAtStart(stitches);
      const cells = rackWholeBed(stitches, plan, usedPlan, "F", delta, where);
      const landed = measure();
      if (landed.front[0] !== front[0] + delta) {
        fail(
          `NOTE: ${where} 前床从 ${beforeFront} 整段移 ${delta} 后是 ${spanText(landed.front)}，先停`,
        );
      }
      const parked = landed.front[0] === 0 ? `前床从物理针 0 起（${spanText(landed.front)}）` : `前床来到 ${spanText(landed.front)}`;
      fixes.push({
        row: { dir: "X", step3: null, windowAlign: true, cells },
        beds,
        note: `NOTE: ${where} 前床落到 ${beforeFront}（后 ${beforeBack}）。整段移前床 ${delta}，${parked}。`,
      });
      front = landed.front;
      back = landed.back;
      tF = landed.tF;
      tB = landed.tB;
    }
  }
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
    let longWin = longBed === "F" ? front : back;
    let shortWin = longBed === "F" ? back : front;
    let fromPhys = longWin.at(-1);
    const pair = fromPhys;
    if (shortWin.includes(pair)) {
      if (shortWin.at(-1) !== pair || shortWin[0] < 1) {
        fail(
          `NOTE: ${where} 数目差一针，右折返配对 ${shortBed}${pair} 上有线圈，整段移一针空不出它，先停`,
        );
      }
      const beforeFront = spanText(front);
      const beforeBack = spanText(back);
      const beds = bedsAtStart(stitches);
      const cells = rackWholeBed(stitches, plan, usedPlan, shortBed, -1, where);
      const landed = measure();
      const landedShort = shortBed === "B" ? landed.back : landed.front;
      if (landedShort.at(-1) !== pair - 1 || landedShort.includes(pair)) {
        fail(
          `NOTE: ${where} 整段移 ${shortBed} -1 后没有空出配对 ${shortBed}${pair}（前 ${spanText(landed.front)} 后 ${spanText(landed.back)}），先停`,
        );
      }
      const bedName = shortBed === "B" ? "后床" : "前床";
      fixes.push({
        row: { dir: "X", step3: null, windowAlign: true, cells },
        beds,
        note: `NOTE: ${where} 右折返配对 ${shortBed}${pair} 上有线圈（前 ${beforeFront}、后 ${beforeBack}）。先整段移${bedName} -1，空出 ${shortBed}${pair}（前 ${spanText(landed.front)}、后 ${spanText(landed.back)}）。`,
      });
      front = landed.front;
      back = landed.back;
      tF = landed.tF;
      tB = landed.tB;
      longWin = longBed === "F" ? front : back;
      shortWin = longBed === "F" ? back : front;
      fromPhys = longWin.at(-1);
      if (fromPhys !== pair) {
        fail(`NOTE: ${where} 空出配对针后长床高位不再是 ${pair}，先停`);
      }
    }
    const toPhys = pair;
    const shortHi = shortWin.at(-1);
    const adjacentEmpty = shortHi + 1 === toPhys && !shortWin.includes(toPhys);
    // Equal packed windows share high needle H = tF−1. The excess coil
    // is the same-index pair at H+1, and the short bed already ends at
    // H−1, so H itself is the one empty needle. Any wider gap is not
    // this move.
    const packedHigh = tF - 1;
    const onePastPacked =
      tF === tB &&
      longWin[0] === 0 &&
      shortWin[0] === 0 &&
      toPhys === packedHigh + 1 &&
      shortHi === packedHigh - 1 &&
      !shortWin.includes(toPhys);
    if (!adjacentEmpty && !onePastPacked) {
      // An increase finishes its transfers and the new stitches first.
      // A pair this rule cannot flip yet waits. It is not a reason to
      // stop the increase.
      if (options.deferUnreadyFlip) return fixes;
      fail(
        `NOTE: ${where} 数目差一针，但右折返配对 ${longBed}${fromPhys}→${shortBed}${toPhys} 不是空着的相邻针，先停`,
      );
    }
    const candidates = [...stitches.values()].filter((st) => st.bed === longBed && st.phys === fromPhys);
    if (candidates.length !== 1) {
      fail(`NOTE: ${where} 右折返多出来的 ${longBed}${fromPhys} 不是一枚已织线圈，先停`);
    }
    const st = candidates[0];
    const beds = bedsAtStart(stitches);
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
    fixes.push({
      row,
      beds,
      note: `NOTE: ${where} 数目不是 F${tF}/B${tB}，在右折返把 ${longBed}${fromPhys} 翻到 ${shortBed}${toPhys}。`,
    });
    if (onePastPacked) {
      // One coil, one needle: Hi → Hi−1. Do not measure while the
      // window is still gapped, and do not rack the rest of the bed.
      const from = st.phys;
      const dest = from - 1;
      if (from !== packedHigh + 1 || dest !== packedHigh) {
        fail(`NOTE: ${where} 多出来的 ${shortBed}${from} 不是齐窗高位 ${packedHigh} 的下一针，先停`);
      }
      const blocked = [...stitches.values()].some(
        (other) => other !== st && other.bed === shortBed && other.phys === dest,
      );
      if (blocked) {
        fail(`NOTE: ${where} 翻到 ${shortBed}${from} 之后，齐窗高位 ${shortBed}${dest} 上有线圈，单针收不回去，先停`);
      }
      const moveBeds = bedsAtStart(stitches);
      st.phys = dest;
      assertNoSharedNeedle(stitches, where);
      fixes.push({
        row: {
          dir: "X",
          step3: null,
          cells: [
            {
              col: columnForPhys(shortBed, from),
              token: absoluteMoveToken(shortBed, "←", 1),
              fill: RACK_FILL,
              phys: from,
              bed: shortBed,
              id: st.id,
              chart: st.chart,
            },
          ],
        },
        beds: moveBeds,
        note: `NOTE: ${where} 多出来的 ${shortBed}${from} 正在齐窗高位的下一针，只把这一针收到 ${shortBed}${dest}，不整床移。`,
      });
    }
    const after = measure();
    if (after.front.length !== after.tF || after.back.length !== after.tB || after.front[0] !== 0) {
      fail(`NOTE: ${where} 右折返翻了一针后仍不是 F${after.tF}/B${after.tB}，先停`);
    }
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
    const beforeFront = spanText(front);
    const beforeBack = spanText(back);
    const beds = bedsAtStart(stitches);
    const cells = rackWholeBed(stitches, plan, usedPlan, bed, delta, where);
    const landed = measure();
    const moved = bed === "B" ? landed.back : landed.front;
    const anchor = bed === "B" ? landed.front : landed.back;
    if (!windowsMatch(moved, anchor)) {
      fail(`NOTE: ${where} 整段移针后物理窗仍是前 ${spanText(landed.front)} 后 ${spanText(landed.back)}，先停`);
    }
    const bedName = bed === "B" ? "后床" : "前床";
    fixes.push({
      row: { dir: "X", step3: null, windowAlign: true, cells },
      beds,
      note: `NOTE: ${where} 数目 F${front.length}/B${back.length} 已齐，物理窗前 ${beforeFront}、后 ${beforeBack} 错开一针。整段移${bedName} ${delta}，对齐到 ${spanText(anchor)}。`,
    });
    return fixes;
  }

  if (tF === tB + 1) {
    const frontFull = front[0] === 0 && front.at(-1) === tF - 1 && front.length === tF;
    const spareAtLeft = frontFull && back[0] === 1 && back.at(-1) === front.at(-1) && back.length === tB;
    if (spareAtLeft) return fixes;
    const packed = frontFull && back[0] === 0 && back.at(-1) === tB - 1 && back.length === tB;
    if (!packed) {
      fail(`NOTE: ${where} F${tF}/B${tB} 的空针不在左衔接（前 ${spanText(front)} 后 ${spanText(back)}），先停`);
    }
    const beforeFront = spanText(front);
    const beforeBack = spanText(back);
    const beds = bedsAtStart(stitches);
    const cells = rackWholeBed(stitches, plan, usedPlan, "B", 1, where);
    const landed = measure();
    const emptyAtLeft =
      landed.tF === landed.tB + 1 &&
      landed.front[0] === 0 &&
      landed.front.at(-1) === landed.tF - 1 &&
      landed.front.length === landed.tF &&
      landed.back[0] === 1 &&
      landed.back.at(-1) === landed.front.at(-1) &&
      landed.back.length === landed.tB;
    if (!emptyAtLeft) {
      fail(`NOTE: ${where} 整段移针后空针仍不在左衔接（前 ${spanText(landed.front)} 后 ${spanText(landed.back)}），先停`);
    }
    fixes.push({
      row: { dir: "X", step3: null, windowAlign: true, cells },
      beds,
      note: `NOTE: ${where} 数目 F${tF}/B${tB} 已是差一针，但空针在右折返（前 ${beforeFront}、后 ${beforeBack}）。整段移后床 +1，空针落到左衔接 ${spanText(landed.back)}。`,
    });
    return fixes;
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
        const beds = bedsAtStart(stitches);
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
          beds,
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

    const knitBeds = bedsAtStart(stitches);
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
    sheetRows.push({ dir: krow.dir, step3: op.knit, cells: knitCells, beds: knitBeds });
    atRow.set(op.knit, knitSnap);
    rememberLive(`step3 行 ${op.knit} ${krow.dir} 织完`);
    if (incs.length) {
      rememberPartial(`step3 行 ${op.knit} 加针后`);
      const where = `step3 行 ${op.knit} 加针后`;
      const fixes = settleAssignedWindows(stitches, base.plan, usedPlan, where);
      for (const fix of fixes) {
        if (!fix.beds) fail(`${where} 对齐行没有起始床位`);
        sheetRows.push({ ...fix.row, beds: fix.beds });
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

/** One bed's needles at a moment. A gap stays a gap; it is not written as one span. */
function bedSpan(phys, bed) {
  if (!phys.length) return `${bed}—`;
  const runs = [];
  let start = phys[0];
  let prev = phys[0];
  const push = (from, to) => {
    runs.push(from === to ? `${bed}${from}` : `${bed}${from}…${bed}${to}`);
  };
  for (let i = 1; i < phys.length; i++) {
    if (phys[i] === prev + 1) {
      prev = phys[i];
      continue;
    }
    push(start, prev);
    start = prev = phys[i];
  }
  push(start, prev);
  return runs.join(",");
}

/** Loop distribution on the machine, before the row that is about to be drawn. */
export function bedsAtStart(stitches) {
  const { f, b } = listsOf(stitches);
  return formatBedWindow(
    f.map((st) => st.phys),
    b.map((st) => st.phys),
  );
}

export function formatBedWindow(frontPhys, backPhys) {
  return `${bedSpan(frontPhys, "F")} / ${bedSpan(backPhys, "B")}`;
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
 * Front physical needle 0. Every front stitch must share one chart-to-phys
 * offset when ring 1 inherits the bed. A step3 column then names that
 * physical needle, not the chart the old index still carries.
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
 * Step3 columns are the old transfer index. Front column C is physical
 * needle C. Back column C is the stitch still on chart C. The same lookup
 * is used for knits and transfers, then drawn with columnForPhys.
 * A negative column that does not resolve wraps onto the back-bed tail,
 * low phys toward the high sheet column. After inc/dec,
 * settleAssignedWindows applies the same flip / rack rule as ring 0.
 * Anything it does not cover stops with NOTE.
 */
export function simulateRing1(step3Rows, rowStart, rowEnd, seed, turnBefore = rowStart) {
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
  const stitchOnChart = (col) => {
    const id = live.get(col);
    return id == null ? null : stitches.get(id);
  };
  const frontAtPhys = (phys) => {
    for (const st of stitches.values()) {
      if (st.bed === "F" && st.phys === phys) return st;
    }
    return null;
  };
  // Transfers still resolve a column by chart. A back stitch whose chart
  // is C hides the front needle at physical needle C. Knit courses do
  // not use this lookup; they walk the course instead.
  const stitchAt = (col) => {
    const charted = stitchOnChart(col);
    if (charted?.bed === "B") return charted;
    const front = frontAtPhys(col);
    if (front) return front;
    if (charted?.bed === "F" && charted.phys !== col) return null;
    return charted;
  };
  const byRow = new Map();
  const inserts = [];
  const events = [];
  const trace = [];
  let decAnchor = null;
  // How many one-needle decrease passes the last -Rn marker still owes.
  // -R1 settles after its single pass. -Rn keeps the same anchor and
  // finishes every pass before the beds are balanced.
  let decreaseLeft = 0;
  // A back decrease has repacked the bed. Later course columns past the
  // front use the fold recount, in either direction.
  let recountPastFront = false;
  // The stitch and course column where the previous knit stopped.
  // Cleared by a transfer, flip, or whole-bed move.
  let carriedTurn = null;
  // Needle and column of that same knit end. A decrease transfer does not
  // clear it. The next course that starts on this column stays on this
  // needle and then steps one needle per column. Whole-bed racks may
  // change which stitch sits there; the column still means this needle.
  let courseEnd = null;
  const PAST_BED = { pastBed: true };
  // An increase whose same-index pair is neither an empty neighbor nor
  // a free path past the short bed. The flip waits for a later row.
  let balancePending = false;

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

  /**
   * Sheet columns on a knit follow the course, not the mirror formula.
   * When a back stitch was drawn on a front needle's column, and the
   * course arrived along that front needle, the cell is the front needle.
   * A facing back stitch the course does not continue onto is left off
   * the row. If later cells do continue onto the back, that facing needle
   * and those cells sit in the following columns.
   */
  const seatCourseContinuity = (placed, courseCells, dir, where) => {
    const course = courseCells
      .slice()
      .sort((a, b) => (dir === "L" ? b.col - a.col : a.col - b.col));
    const collisions = placed.filter((cell) => {
      if (cell.bed !== "B" || cell.wrap || cell.stair) return false;
      const front = frontAtPhys(cell.col);
      return front && !placed.some((item) => item.id === front.id);
    });
    collisions.sort((a, b) => course.findIndex((cell) => cell.col === a.chart) - course.findIndex((cell) => cell.col === b.chart));
    for (const backCell of collisions) {
      const front = frontAtPhys(backCell.col);
      const at = course.findIndex((cell) => cell.col === backCell.chart);
      if (at < 0 || !front) {
        fail(`NOTE: ${where} 表列 ${backCell.col} 的后床 ${backCell.bed}${backCell.phys} 对不上这一行的行程，先停`);
      }
      const prevChart = course[at - 1];
      const prev = prevChart ? placed.find((item) => item.chart === prevChart.col && !item.wrap) : null;
      const continuesFront =
        prev &&
        prev.bed === "F" &&
        (dir === "L" ? prev.phys === front.phys + 1 : prev.phys === front.phys - 1);
      if (!continuesFront) {
        fail(
          `NOTE: ${where} 前床 ${front.bed}${front.phys} 与后床 ${backCell.bed}${backCell.phys} 都要表列 ${backCell.col}，行程不是沿前床接到这一针，先停`,
        );
      }
      const rest = [];
      for (let i = at + 1; i < course.length; i++) {
        const next = placed.find((item) => item.chart === course[i].col && !item.wrap && item !== backCell);
        if (!next || next.bed !== "B") break;
        rest.push(next);
      }
      const painted = paintToken(course[at], toAbsoluteToken(course[at].token, "F"));
      const hidden = {
        id: backCell.id,
        bed: backCell.bed,
        phys: backCell.phys,
        token: backCell.token,
        fill: backCell.fill,
      };
      backCell.col = front.phys;
      backCell.token = painted.token;
      backCell.fill = painted.fill;
      backCell.phys = front.phys;
      backCell.bed = "F";
      backCell.id = front.id;
      backCell.chart = course[at].col;
      if (!rest.length) continue;
      const step = dir === "L" ? -1 : 1;
      const taken = new Set(placed.map((item) => item.col));
      for (const item of rest) taken.delete(item.col);
      let col = front.phys + step;
      if (col < -5 || col > 37 || taken.has(col)) {
        fail(
          `NOTE: ${where} 行程从 ${front.bed}${front.phys} 继续接到 ${hidden.bed}${hidden.phys}，表列 ${col} 放不下，先停`,
        );
      }
      const already = rest.find((item) => item.id === hidden.id);
      if (already && rest[0] !== already) {
        fail(
          `NOTE: ${where} 后床 ${hidden.bed}${hidden.phys} 不是行程接到后床的第一针，先停`,
        );
      }
      let prevCol = front.phys;
      const chain = already ? rest : [null, ...rest];
      for (const item of chain) {
        if (item == null) {
          placed.push({
            col,
            token: hidden.token,
            fill: hidden.fill,
            phys: hidden.phys,
            bed: hidden.bed,
            id: hidden.id,
            chart: null,
            along: prevCol,
            noBind: true,
          });
        } else {
          item.col = col;
          item.along = prevCol;
        }
        taken.add(col);
        prevCol = col;
        col += step;
        if (item !== chain.at(-1) && (col < -5 || col > 37 || taken.has(col))) {
          fail(`NOTE: ${where} 行程接到后床时表列 ${col} 放不下，先停`);
        }
      }
    }
  };

  const drawKnit = (row, ri) => {
    const cells = occupied(row);
    const negs = cells.filter((c) => c.col < 0).sort((a, b) => b.col - a.col);
    const wrapCells = negs.filter((cell) => stitchAt(cell.col) == null);
    const tail = [...stitches.values()].filter((st) => st.bed === "B").sort((a, b) => a.phys - b.phys || a.id - b.id);
    const fronts = [...stitches.values()].filter((st) => st.bed === "F");
    const backs = [...stitches.values()].filter((st) => st.bed === "B");
    const frontHi = fronts.reduce((hi, st) => Math.max(hi, st.phys), -1);
    const backHi = backs.reduce((hi, st) => Math.max(hi, st.phys), -1);
    const backAt = new Map(backs.map((st) => [st.phys, st]));
    const courseCols = cells.filter((cell) => !wrapCells.includes(cell)).map((cell) => cell.col);
    const crosses = courseCols.some((col) => col <= frontHi) && courseCols.some((col) => col > frontHi);
    // The sheet column is the course column. A course that reaches the
    // front takes the front needle at that phys, then, past the front,
    // the back needles inward from the fold. A course that stays on the
    // back keeps the chart lookup, so a column with no stitch can still
    // be born; it is still drawn on the course column, not at 37 − phys.
    const stitchOnCourse = (col) => {
      if (col <= frontHi) {
        const front = frontAtPhys(col);
        if (front) return front;
        return null;
      }
      // Before a back decrease, a course that stays on the back keeps
      // the chart lookup, so an empty column can still be born. After
      // that decrease the bed is repacked, and this column is the next
      // physical back needle inward from the fold — the same recount a
      // crossing course already uses — on the remainder and every later
      // course.
      if (!crosses && !recountPastFront) return stitchAt(col);
      const phys = backHi - (col - frontHi - 1);
      const back = backAt.get(phys);
      if (!back) {
        // No needle below 0. The cell is not a stitch and it is not a new
        // one; the course simply does not draw it.
        if (phys < 0) return PAST_BED;
        fail(
          `NOTE: step3 行 ${ri} 列 ${col} 越过前床 ${frontHi} 后要接到后床物理针 ${phys}，这一针不在，先停`,
        );
      }
      return back;
    };
    const courseList = cells.filter((cell) => !wrapCells.includes(cell));
    const visitOrder = courseList.slice().sort((a, b) => (row.dir === "L" ? b.col - a.col : a.col - b.col));
    // The cap started again on the column where the previous knit finished.
    // Stay on that needle, then one needle per column. A step off the bed
    // is not drawn.
    const walked = new Map();
    // Fold recount is for a course that stays on the bed. An R decrease
    // whose recount would step below needle 0 is not a fold: each column
    // is the stitch on that chart, visited toward lower back needles.
    // A column with no stitch is not drawn, and it is not a negative needle.
    let recountOffBed = false;
    if (row.dir === "R" && courseEnd && visitOrder.length && visitOrder[0].col === courseEnd.col) {
      for (const cell of visitOrder) {
        if (cell.col <= frontHi) continue;
        if (backHi - (cell.col - frontHi - 1) < 0) {
          recountOffBed = true;
          break;
        }
      }
    }
    if (recountOffBed) {
      for (const cell of visitOrder) {
        const st = stitchAt(cell.col);
        if (st && st.bed === "B" && st.phys >= 0) walked.set(cell.col, st);
        else walked.set(cell.col, PAST_BED);
      }
    }
    const used = new Set();
    const placed = [];
    const placeStitch = (cell, st, extra) => {
      const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
      placed.push({
        col: extra?.wrap ? columnForPhys(st.bed, st.phys) : cell.col,
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
      const walkedSt = walked.get(cell.col);
      const st = walkedSt !== undefined ? walkedSt : stitchOnCourse(cell.col);
      if (st === PAST_BED) continue;
      if (st) {
        if (used.has(st.id)) fail(`step3 行 ${ri} 列 ${cell.col} 与本行已有圈冲突 ${st.id}`);
        used.add(st.id);
        placeStitch(cell, st);
      } else births.push(cell);
    }
    // One new stitch still uses the single-hole path below. Several new
    // stitches are allowed only when they are adjacent columns and they
    // exactly fill one front gap that the increase transfers opened.
    if (births.length > 1) {
      const ordered = births.slice().sort((a, b) => a.col - b.col);
      for (let n = 1; n < ordered.length; n++) {
        if (ordered[n].col !== ordered[n - 1].col + 1) {
          fail(`step3 行 ${ri} 一行多针新生，列 ${ordered.map((c) => c.col).join(",")} 不连续`);
        }
      }
      const gapLeft = frontAtPhys(ordered[0].col - 1);
      const gapRight = frontAtPhys(ordered.at(-1).col + 1);
      if (
        !gapLeft ||
        !gapRight ||
        gapLeft.bed !== "F" ||
        gapRight.bed !== "F" ||
        gapRight.phys !== gapLeft.phys + ordered.length + 1
      ) {
        fail(
          `step3 行 ${ri} 新圈列 ${ordered.map((c) => c.col).join(",")} 前床空档不是 ${ordered.length} 针（${gapLeft ? gapLeft.phys : "无"}…${gapRight ? gapRight.phys : "无"}）`,
        );
      }
      const bias = gapLeft.phys - gapLeft.chart;
      if (gapRight.phys - gapRight.chart !== bias) {
        fail(`NOTE: step3 行 ${ri} 新圈列 ${ordered[0].col} 两侧前床偏差不一致，先停`);
      }
      for (let n = 0; n < ordered.length; n++) {
        const cell = ordered[n];
        const phys = gapLeft.phys + 1 + n;
        if (cell.col !== phys) fail(`step3 行 ${ri} 新圈列 ${cell.col} 不在前床空档 ${phys}`);
        const bornChart = cell.col - bias;
        if (live.has(bornChart)) fail(`NOTE: step3 行 ${ri} 新圈列 ${cell.col} 的 chart ${bornChart} 已被占用，先停`);
        if ([...stitches.values()].some((st) => st.bed === "F" && st.phys === phys)) {
          fail(`step3 行 ${ri} 新圈延伸到已被占用的 F${phys}`);
        }
        const id = nextId++;
        const st = { id, bed: "F", phys, chart: bornChart };
        stitches.set(id, st);
        live.set(bornChart, id);
        const painted = paintToken(cell, toAbsoluteToken(cell.token, "F"));
        placed.push({
          col: cell.col,
          token: painted.token,
          fill: painted.fill,
          phys,
          bed: "F",
          id,
          chart: cell.col,
          birth: true,
        });
      }
    }
    for (const cell of births.length > 1 ? [] : births) {
      let left = null;
      let right = null;
      for (const st of stitches.values()) {
        if (st.chart < cell.col && (!left || st.chart > left.chart)) left = st;
        if (st.chart > cell.col && (!right || st.chart < right.chart)) right = st;
      }
      const gapLeft = frontAtPhys(cell.col - 1);
      const gapRight = frontAtPhys(cell.col + 1);
      let bed;
      let phys;
      let bornChart = cell.col;
      if (gapLeft && gapRight && gapRight.phys === gapLeft.phys + 2) {
        const bias = gapLeft.phys - gapLeft.chart;
        if (gapRight.phys - gapRight.chart !== bias) {
          fail(`NOTE: step3 行 ${ri} 新圈列 ${cell.col} 两侧前床偏差不一致，先停`);
        }
        bornChart = cell.col - bias;
        if (live.has(bornChart)) {
          fail(`NOTE: step3 行 ${ri} 新圈列 ${cell.col} 的 chart ${bornChart} 已被占用，先停`);
        }
        bed = "F";
        phys = cell.col;
      } else if (left && right) {
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
      const st = { id, bed, phys, chart: bornChart };
      stitches.set(id, st);
      if (live.has(bornChart)) fail(`NOTE: step3 行 ${ri} 新圈 chart ${bornChart} 已被占用，先停`);
      live.set(bornChart, id);
      const painted = paintToken(cell, toAbsoluteToken(cell.token, bed));
      placed.push({
        col: cell.col,
        token: painted.token,
        fill: painted.fill,
        phys,
        bed,
        id,
        chart: cell.col,
        birth: true,
      });
    }
    const courseCells = cells.filter((cell) => !wrapCells.includes(cell));
    const visit = courseCells.slice().sort((a, b) => (row.dir === "L" ? b.col - a.col : a.col - b.col));
    // A turn rises onto the needle the previous course just finished.
    // The fold recount would step one needle past that, because it starts
    // again from the front. Walk one needle per column from the turn
    // instead. Other rows keep the recount.
    const turnStitch = carriedTurn ? stitches.get(carriedTurn.id) : null;
    const firstItem = visit.length
      ? placed.find((item) => !item.wrap && !item.birth && item.chart === visit[0].col)
      : null;
    const turnHere =
      ri < turnBefore &&
      turnStitch &&
      firstItem &&
      firstItem.id !== turnStitch.id &&
      carriedTurn.dir !== row.dir &&
      carriedTurn.col === visit[0].col;
    if (turnHere) {
      const stepNeedle = (st, dir) => {
        if (dir === "R") {
          if (st.bed === "F") return frontAtPhys(st.phys + 1) || backAt.get(backHi) || null;
          return backAt.get(st.phys - 1) || null;
        }
        if (st.bed === "B") {
          if (st.phys < backHi) return backAt.get(st.phys + 1) || null;
          return frontAtPhys(frontHi);
        }
        return frontAtPhys(st.phys - 1);
      };
      const seen = new Set(placed.filter((item) => item.wrap).map((item) => item.id));
      let st = turnStitch;
      for (const cell of visit) {
        const item = placed.find((placedCell) => !placedCell.wrap && !placedCell.birth && placedCell.chart === cell.col);
        if (!item || !st) {
          fail(
            `NOTE: step3 行 ${ri} 折返停在 ${turnStitch.bed}${turnStitch.phys}，下一列没有相邻的针，先停`,
          );
        }
        if (seen.has(st.id)) {
          fail(`NOTE: step3 行 ${ri} 折返从 ${turnStitch.bed}${turnStitch.phys} 接着走时 ${st.bed}${st.phys} 重复，先停`);
        }
        seen.add(st.id);
        if (item.id !== st.id) {
          const painted = paintToken(cell, toAbsoluteToken(cell.token, st.bed));
          item.token = painted.token;
          item.fill = painted.fill;
          item.phys = st.phys;
          item.bed = st.bed;
          item.id = st.id;
          item.stair = true;
        }
        st = stepNeedle(st, row.dir);
      }
    }
    seatCourseContinuity(placed, courseCells, row.dir, `step3 行 ${ri}`);
    const body = placed.filter((cell) => !cell.wrap && cell.chart != null && !cell.noBind);
    body.sort((a, b) => a.chart - b.chart);
    for (let n = 1; n < body.length; n++) {
      if (body[n].chart !== body[n - 1].chart + 1 || body[n].col !== body[n - 1].col + 1) {
        fail(
          `NOTE: step3 行 ${ri} 行程 ${body[n - 1].bed}${body[n - 1].phys}→${body[n].bed}${body[n].phys} 表列 ${body[n - 1].col}→${body[n].col} 不连续，先停`,
        );
      }
    }
    const wraps = placed.filter((cell) => cell.wrap);
    let endItem = null;
    for (let n = visit.length - 1; n >= 0; n--) {
      const item = placed.find((cell) => !cell.wrap && cell.chart === visit[n].col);
      if (item) {
        endItem = item;
        break;
      }
    }
    carriedTurn = endItem ? { dir: row.dir, col: endItem.chart, id: endItem.id } : null;
    courseEnd = endItem
      ? { dir: row.dir, col: endItem.chart, bed: endItem.bed, phys: endItem.phys, walked: recountOffBed }
      : null;
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

  // Before the back decrease, a transfer column is the chart index.
  // After that repack, it is the same physical needle a knit column is.
  const stitchOnTransfer = (col) => {
    if (!recountPastFront) return stitchAt(col);
    const fronts = [...stitches.values()].filter((st) => st.bed === "F");
    const backs = [...stitches.values()].filter((st) => st.bed === "B");
    const frontHi = fronts.reduce((hi, st) => Math.max(hi, st.phys), -1);
    const backHi = backs.reduce((hi, st) => Math.max(hi, st.phys), -1);
    if (col <= frontHi) return frontAtPhys(col);
    const phys = backHi - (col - frontHi - 1);
    if (phys >= 0) return backs.find((st) => st.phys === phys) || null;
    // The fold slot is below 0, so it is not a needle. An R decrease that
    // already resolved its course by chart keeps that lookup: the stitch
    // on this column, if one is on the bed.
    if (courseEnd?.walked && courseEnd.dir === "R") {
      const charted = stitchAt(col);
      if (charted && charted.bed === "B" && charted.phys >= 0) return charted;
    }
    return null;
  };

  const shapingBedForMove = (cols, delta, increase, at) => {
    for (const col of cols) {
      const st = at(col);
      if (!st) fail(`移圈列 ${col} 没有线圈`);
      const dest = col + delta;
      if (cols.includes(dest)) continue;
      const onto = at(dest);
      if (!onto || onto.id === st.id) continue;
      if (st.bed !== onto.bed) fail(`step3 行移圈把 ${st.bed}${st.phys} 叠到 ${onto.bed}${onto.phys}`);
      return st.bed;
    }
    if (!increase) {
      if (delta < 0) fail(`减针移圈没有叠到范围外的针`);
      const edge = Math.min(...cols);
      const st = at(edge);
      if (!st) fail(`加针移圈列 ${edge} 没有线圈`);
      return st.bed;
    }
    // → leaves the gap on the low edge; ← leaves it on the high edge.
    // A shaping stitch that would land below physical needle 0 leaves the bed.
    const edge = delta < 0 ? Math.max(...cols) : Math.min(...cols);
    const st = at(edge);
    if (!st) fail(`加针移圈列 ${edge} 没有线圈`);
    return st.bed;
  };

  // The +Rn marker on the knit this transfer belongs to. On the front,
  // that course column is the physical needle of the increase. Needles
  // after it, in the carriage direction, are the ones the pass may move.
  const increaseMarkerPhys = (ri) => {
    for (let j = ri + 1; j < step3Rows.length; j++) {
      const next = step3Rows[j];
      if (next.dir === "X" || next.dir === "X+") continue;
      if (next.dir !== "R" && next.dir !== "L") return null;
      const marker = occupied(next).find((cell) => parseIncN(cell.token));
      if (!marker) return null;
      const st = stitchOnTransfer(marker.col);
      if (st?.bed === "F") return st.phys;
      const front = frontAtPhys(marker.col);
      return front ? front.phys : null;
    }
    return null;
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
    const increase = row.dir === "X+";
    let cols = cells.map((cell) => cell.col).sort((a, b) => (delta < 0 ? a - b : b - a));
    const maxCol = Math.max(...cols);
    const frontHiNow = () => {
      let hi = -1;
      for (const st of stitches.values()) if (st.bed === "F" && st.phys > hi) hi = st.phys;
      return hi;
    };
    // A knit wraps an unresolved negative column onto the back tail.
    // An increase transfer does not. Those columns are not a second set of
    // back-tail stitches. A shaping stitch that would land below physical
    // needle 0 leaves the bed instead of occupying F−1.
    // A → increase may also name the empty destination past the last
    // stitch, a hole a previous pass already opened, and columns the
    // recount would place below needle 0. Those are slots past the bed,
    // not missing stitches, and they do not rack the rest of the front.
    // Any other positive column still has to resolve.
    const impliedBackPhys = (col) => {
      if (!recountPastFront) return null;
      let frontHi = -1;
      let backHi = -1;
      for (const st of stitches.values()) {
        if (st.bed === "F" && st.phys > frontHi) frontHi = st.phys;
        if (st.bed === "B" && st.phys > backHi) backHi = st.phys;
      }
      if (col <= frontHi) return null;
      return backHi - (col - frontHi - 1);
    };
    cols = cols.filter((col) => {
      if (stitchOnTransfer(col)) return true;
      if (col < 0) return false;
      // Past the bed. A recounted needle below 0 is not a stitch, on an
      // increase or a decrease, and it does not pull the rest of the bed.
      const implied = impliedBackPhys(col);
      if (implied != null && implied < 0) return false;
      if (implied != null) {
        let lo = Infinity;
        for (const st of stitches.values()) if (st.bed === "B" && st.phys < lo) lo = st.phys;
        if (implied < lo) return false;
      }
      if (increase && delta > 0 && (col === maxCol || col <= frontHiNow())) return false;
      fail(`step3 行 ${ri} 移圈列 ${col} 没有线圈`);
    });
    if (!cols.length) fail(`step3 行 ${ri} 移圈没有对上的线圈`);
    const shapeBed = shapingBedForMove(cols, delta, increase, stitchOnTransfer);
    const selected = [];
    const seen = new Set();
    for (const col of cols) {
      const st = stitchOnTransfer(col);
      if (!st) fail(`step3 行 ${ri} 移圈列 ${col} 没有线圈`);
      if (seen.has(st.id)) continue;
      seen.add(st.id);
      selected.push(st);
    }
    // The columns from anchor+k are this pass, through the fold-side
    // edge of that block. The neighbor just outside is where that edge
    // lands. It is not a source. Before a repack, the last pass of a
    // marker that sits one column before the block names its edge by
    // chart, and the transfer columns start one past that stitch, so
    // the chart stitch joins the pass and the landing needle is the
    // one beyond it. A course stitch that only occupies the landing
    // slot after a repack does not join.
    if (!increase && delta < 0) {
      const start = Math.min(...cols);
      if (decAnchor == null || decreaseLeft < 1) fail(`step3 行 ${ri} 减针移圈没有锚点`);
      // One decrease: the marker sits one column before the moved block,
      // or on the first moved column. A -Rn marker is n one-needle passes.
      // The pass that still has k decreases left starts k columns after
      // the marker, so the stitches between them wait for the later passes.
      const ahead = decreaseLeft;
      if (decAnchor !== start && decAnchor !== start - ahead) {
        fail(
          `NOTE: step3 行 ${ri} 减针锚点 ${decAnchor} 与移圈起点 ${start} 隔了 ${start - decAnchor} 列，这一趟还要收 ${ahead} 针，先停`,
        );
      }
      const onShape = selected.filter((st) => st.bed === shapeBed);
      if (!onShape.length) fail(`NOTE: step3 行 ${ri} 减针移圈在成形床上没有线圈，先停`);
      const lo = Math.min(...onShape.map((st) => st.chart));
      const chartAnchor = stitchOnChart(decAnchor);
      if (
        ahead === 1 &&
        chartAnchor &&
        chartAnchor.bed === shapeBed &&
        !seen.has(chartAnchor.id) &&
        chartAnchor.chart === lo - 1 &&
        // After the bed is repacked this chart slot is the landing
        // neighbor. It is not a source.
        !recountPastFront
      ) {
        seen.add(chartAnchor.id);
        selected.push(chartAnchor);
      }
    }
    // R travel on the back steps toward lower needles. The decrease moves
    // with that travel. The last needle on the bed is the landing, not a
    // source, and the pass does not invent a needle below it.
    const travelDown =
      !increase &&
      delta < 0 &&
      courseEnd?.walked &&
      courseEnd.dir === "R" &&
      shapeBed === "B";
    if (travelDown) {
      const onShape = selected.filter((st) => st.bed === shapeBed);
      const landingPhys = Math.min(...onShape.map((st) => st.phys));
      for (let n = selected.length - 1; n >= 0; n--) {
        if (selected[n].bed === shapeBed && selected[n].phys === landingPhys) {
          seen.delete(selected[n].id);
          selected.splice(n, 1);
        }
      }
      if (!selected.some((st) => st.bed === shapeBed)) {
        fail(`NOTE: step3 行 ${ri} 减针落点之外没有可移的线圈，先停`);
      }
    }
    // Column 18 is the back stitch at the fold, so a front pass that also
    // names the back does not have a column for the front's last needle.
    // That needle is still on the pass: from the first selected front
    // needle through the end of the front bed.
    if (shapeBed === "F" && selected.some((st) => st.bed === "B")) {
      const fronts = [...stitches.values()].filter((st) => st.bed === "F");
      const lo = Math.min(...selected.filter((st) => st.bed === "F").map((st) => st.phys));
      const hi = Math.max(...fronts.map((st) => st.phys));
      for (const st of fronts) {
        if (st.phys < lo || st.phys > hi || seen.has(st.id)) continue;
        seen.add(st.id);
        selected.push(st);
      }
    }
    // A front increase moves only the needles after the increase position.
    // The marker stitch and everything before it stay. This is not a
    // whole-bed rack, and balance waits until the knit has placed the
    // new stitches.
    if (increase && shapeBed === "F") {
      const site = increaseMarkerPhys(ri);
      if (site == null) fail(`NOTE: step3 行 ${ri} 前床加针找不到加针位，先停`);
      for (const st of selected) {
        if (st.bed !== "F") continue;
        const after = delta > 0 ? st.phys > site : st.phys < site;
        if (!after) {
          fail(
            `NOTE: step3 行 ${ri} 加针只移加针位 ${shapeBed}${site} 之后的前床针，${st.bed}${st.phys} 不在加针位之后，先停`,
          );
        }
      }
    }
    const placed = [];
    for (const st of selected) {
      if (st.bed !== shapeBed) continue;
      let srcCol = null;
      for (const cell of cells) {
        if (stitchOnTransfer(cell.col)?.id === st.id) {
          srcCol = cell.col;
          break;
        }
      }
      const src = srcCol == null ? cells[0] : cells.find((cell) => cell.col === srcCol);
      placed.push({
        col: columnForPhys(st.bed, st.phys),
        token: toAbsoluteToken(token, st.bed),
        fill: src?.fill || cells[0].fill || "rgb(204,204,255)",
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        chart: srcCol ?? st.chart,
      });
    }
    const drawn = sparseCells(placed);
    const consumed = [];
    const ordered = selected.slice().sort((a, b) => (travelDown ? a.phys - b.phys : delta < 0 ? a.chart - b.chart : b.chart - a.chart));
    for (const st of ordered) {
      if (travelDown && st.bed === shapeBed) {
        const destPhys = st.phys - 1;
        if (destPhys < 0) fail(`NOTE: step3 行 ${ri} 减针 ${st.bed}${st.phys} 的下一针不在针床上，先停`);
        const onto = [...stitches.values()].find((other) => other.bed === st.bed && other.phys === destPhys);
        if (live.get(st.chart) === st.id) live.delete(st.chart);
        if (!onto || onto.id === st.id) {
          st.phys = destPhys;
          live.set(st.chart, st.id);
        } else if (onto.bed !== st.bed) {
          fail(`step3 行 ${ri} 跨床减针 ${st.bed}${st.phys} → ${onto.bed}${onto.phys}`);
        } else {
          consumed.push({ bed: st.bed, phys: st.phys, ontoBed: onto.bed, ontoPhys: onto.phys });
          stitches.delete(st.id);
        }
        continue;
      }
      const dest = st.chart + delta;
      const onShape = st.bed === shapeBed;
      if (live.get(st.chart) === st.id) live.delete(st.chart);
      if (live.has(dest)) {
        if (!onShape) fail(`step3 行 ${ri} 非成形床 chart ${st.chart} 撞上 ${dest}`);
        if (row.dir === "X+") fail(`step3 行 ${ri} 加针移圈在 chart ${dest} 撞针`);
        const onto = stitches.get(live.get(dest));
        if (!onto || st.bed !== onto.bed) {
          fail(`step3 行 ${ri} 跨床减针 ${st.bed}${st.phys} → ${onto ? `${onto.bed}${onto.phys}` : dest}`);
        }
        consumed.push({ bed: st.bed, phys: st.phys, ontoBed: onto.bed, ontoPhys: onto.phys });
        stitches.delete(st.id);
      } else {
        let leftBed = false;
        if (onShape) {
          const nextPhys = st.phys + (st.bed === "F" ? delta : -delta);
          // No needle below 0. The stitch leaves; the other bed is not
          // redefined to make room for it, and a later rack does not
          // bring it back onto the high end.
          if (nextPhys < 0) {
            stitches.delete(st.id);
            leftBed = true;
          } else {
            st.phys = nextPhys;
          }
        }
        if (!leftBed) {
          st.chart = dest;
          live.set(dest, st.id);
        }
      }
    }
    const rebuilt = new Map();
    for (const st of stitches.values()) {
      if (rebuilt.has(st.chart)) fail(`NOTE: step3 行 ${ri} 移圈后 chart ${st.chart} 有两枚线圈，先停`);
      rebuilt.set(st.chart, st.id);
    }
    live.clear();
    for (const [chart, id] of rebuilt) live.set(chart, id);
    assertNoSharedNeedle(stitches, `step3 行 ${ri} 移圈后`);
    return { drawn, consumed };
  };

  const insertRepair = (where, step3After, seatFront = false, deferUnreadyFlip = false) => {
    const fixes = settleAssignedWindows(stitches, new Map(), new Set(), where, { seatFront, deferUnreadyFlip });
    const liveNow = listsOf(stitches);
    const balanced =
      liveNow.f.length === Math.ceil(liveNow.N / 2) &&
      liveNow.b.length === Math.floor(liveNow.N / 2) &&
      isContig(liveNow.f) &&
      isContig(liveNow.b) &&
      liveNow.f[0].phys === 0;
    const deferred = deferUnreadyFlip && !balanced;
    if (!deferred) {
      events.push({
        after: step3After,
        where,
        fixes: fixes.map((fix) => ({ dir: fix.row.dir, note: fix.note })),
      });
    }
    for (const fix of fixes) {
      if (!fix.beds) fail(`${where} 对齐行没有起始床位`);
      inserts.push({
        after: step3After,
        dir: fix.row.dir,
        windowAlign: Boolean(fix.row.windowAlign),
        cells: sparseCells(fix.row.cells),
        beds: fix.beds,
      });
    }
    return { fixes, deferred };
  };

  snapshotCounts("第二圈开始");
  let blocked = null;
  for (let i = rowStart; i < rowEnd; i++) {
    const row = step3Rows[i];
    const beds = bedsAtStart(stitches);
    if (row.dir === "X" || row.dir === "X+") {
      carriedTurn = null;
      const rowBeds = bedsAtStart(stitches);
      const moved = drawMove(row, i);
      byRow.set(i, { dir: row.dir, step3: i, cells: moved.drawn, beds: rowBeds });
      snapshotCounts(`step3 行 ${i} ${row.dir}`);
      if (row.dir === "X") {
        const followedDecrease = decAnchor != null && decreaseLeft > 0;
        if (followedDecrease) decreaseLeft -= 1;
        const backDecrease =
          followedDecrease && [...moved.drawn.values()].some((cell) => cell.bed === "B");
        if (backDecrease) recountPastFront = true;
        // The remaining passes of this -Rn still have to move. Balancing
        // between them shifts the needles the next pass is about to use.
        if (decreaseLeft > 0) continue;
        try {
          const repaired = insertRepair(`step3 行 ${i} 减针后`, i, true);
          balancePending = repaired.deferred;
        } catch (err) {
          if (!String(err.message).includes("NOTE:")) throw err;
          blocked = { after: i, note: String(err.message).replace(/^build-step4-ring0: /, "") };
          break;
        }
        decAnchor = null;
        decreaseLeft = 0;
        snapshotCounts(`step3 行 ${i} 减针对齐后`);
      } else if (decreaseLeft > 0) {
        fail(`NOTE: step3 行 ${i} 减针还剩 ${decreaseLeft} 次一针移圈，这一行是 ${row.dir}，先停`);
      }
      continue;
    }
    if (row.dir !== "R" && row.dir !== "L") fail(`step3 行 ${i} 方向 ${row.dir} 不在第二圈规则里`);
    const dec = occupied(row).find((cell) => parseDecN(cell.token));
    const inc = occupied(row).find((cell) => parseIncN(cell.token));
    if (decreaseLeft > 0) {
      fail(`NOTE: step3 行 ${i} 减针还剩 ${decreaseLeft} 次一针移圈，先遇到织行，先停`);
    }
    if (dec) {
      // -Rn is n one-needle decrease passes after this knit, not one
      // multi-needle move on the knit row.
      decAnchor = dec.col;
      decreaseLeft = parseDecN(dec.token);
    } else {
      decAnchor = null;
      decreaseLeft = 0;
    }
    const knit = drawKnit(row, i);
    if (inc && parseIncN(inc.token) !== 1 && knit.births.length !== parseIncN(inc.token)) {
      fail(`step3 行 ${i} 多针加针 ${inc.token}`);
    }
    byRow.set(i, { dir: row.dir, step3: i, cells: knit.placed, beds });
    assertNoSharedNeedle(stitches, `step3 行 ${i} 织完`);
    if (inc || knit.births.length) {
      const repaired = insertRepair(`step3 行 ${i} 加针后`, i, true, true);
      balancePending = repaired.deferred;
      carriedTurn = null;
    } else if (balancePending) {
      const repaired = insertRepair(`step3 行 ${i} 加针后`, i, true, true);
      balancePending = repaired.deferred;
      const { f, b } = listsOf(stitches);
      if (balancePending && (!isContig(f) || !isContig(b) || f[0].phys !== 0)) {
        fail(
          `NOTE: step3 行 ${i} 加针后的平衡还没做，平针窗前 ${spanText(f.map((st) => st.phys))} 后 ${spanText(b.map((st) => st.phys))} 先停`,
        );
      }
    } else {
      const { f, b, N } = listsOf(stitches);
      if (f.length !== Math.ceil(N / 2) || b.length !== Math.floor(N / 2) || !isContig(f) || !isContig(b) || f[0].phys !== 0) {
        fail(`step3 行 ${i} 平针之后 F${f.length} B${b.length} 不在 F=ceil(N/2)、左折返前床 0`);
      }
    }
    snapshotCounts(`step3 行 ${i} ${row.dir}`);
  }
  const end = listsOf(stitches);
  return { byRow, inserts, events, trace, end, chartShift, blocked };
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

function colInfo(first, last, widthChars) {
  const data = Buffer.alloc(12);
  data.writeUInt16LE(first, 0);
  data.writeUInt16LE(last, 2);
  data.writeUInt16LE(Math.round(widthChars * 256), 4);
  return rec(0x007d, data);
}

function sheetFromGrid(name, headerLabel, needles, rows, xfIndexForFill) {
  const parts = [bof(0x0010)];
  const xf0 = xfIndexForFill("rgb(255,255,255)");
  const bedsCol = needles.length + 1;
  parts.push(colInfo(bedsCol, bedsCol, 36));
  parts.push(labelRecord(0, 0, xf0, headerLabel));
  needles.forEach((n, i) => parts.push(numberRecord(0, i + 1, xf0, n)));
  parts.push(labelRecord(0, bedsCol, xf0, "分布"));
  rows.forEach((row, i) => {
    const sheetRow = i + 1;
    parts.push(labelRecord(sheetRow, 0, xf0, row.dir));
    row.cells.forEach((cell, c) => {
      const fill = cell.fill || (cell.token ? null : "rgb(192,192,192)");
      const xf = xfIndexForFill(fill || "rgb(255,255,255)");
      parts.push(labelRecord(sheetRow, c + 1, xf, cell.token || ""));
    });
    parts.push(labelRecord(sheetRow, bedsCol, xf0, row.beds || ""));
  });
  parts.push(eof());
  return { name, bytes: Buffer.concat(parts) };
}

function legendSheet(xfIndexForFill, ring, ring1) {
  const parts = [bof(0x0010)];
  const xf = xfIndexForFill("rgb(255,255,255)");
  const end = ring1?.trace?.find((item) => item.label === "step3 行 27 R");
  const legend = [
    ["第一圈", `去掉加减针后的整圈是 F${ring.baseFront}/B${ring.baseBack}。前床从物理针 0 起，后床紧挨前床。表列由物理针映出：前床列=物理针，后床列=37−物理针，表列号不等于物理针号。移圈改物理针，下一织行再用新物理针映回表。F=B+1 的空针在左衔接，没走到不安排，不预留列 37，右折返不留夹缝。成形后数目差一针才在右折返按差翻；数目齐但物理窗错开一针，就把错开的那一床整段移齐，不靠 Flip。这张样本加针后前床 0…18、后床 1…19，整段移后床到 0…18。结束 F${ring.front}/B${ring.back}，两床都从物理针 0 起。这张样本没有第一圈 Flip。`],
    ["NOTE", ring.notes[0] || "第一圈整圈织完时已经 F≥B 且 |F−B|≤1，没有额外翻针。"],
    ["对齐", ring.notes.find((note) => note.includes("错开一针")) || ""],
    ["NOTE2", ring.notes.find((note) => note.includes("物理 17")) || "移圈改物理针，下一织行再映回表。"],
    ["第二圈", `继承第一圈末床位，在这些物理针上接着织。前床仍是物理 0…18，第一针是 F0。Step3 列是旧的移针序号，不再用它把起点定到 chart 0（那一针现在是 F1）。前床列 C 就是物理针 C，所以短行表列 0…6 是 F0…F6，不另补一针。后床列 C 仍是 chart C 上的那一针。对不上这些针的负列才绕回后床末尾。织行和移圈用同一套查找，再按物理列画出来，不再把织行往左偏一格。前床这一趟如果同时点到后床，就从锚点收到前床末针。锚点是 -R1 那一格 chart 上的线圈，不把这一格再读成物理针，所以这张样本箭头从继承时的 F6 起，表列 6…18。加减针后用和第一圈相同的规则：数目差一针在右折返翻，数目齐但错开一针就整床移。差一针时若空针留在右折返，就把短床整段移一针，空针落到左衔接；已经在左衔接则不动。这张样本前床减针后把 B18 翻到 F18，后床还是 0…17，随即整段 B→ 到 1…18。后面加针把 F19 翻到 B19，数目齐了但后床 1…19、前床 0…18，再整段 B← 对齐到 0…18。结束 F${end?.F ?? "?"}/B${end?.B ?? "?"}`],
    ["绕回", "Step3 负列如果已经对上某枚针，就画在它自己的物理列上。对不上的负列才是后床末尾绕回，表列 = 37−物理针。前床物理针 0 由列 0 织到，不占负列。同一个圈只有一列。点左折返时两端一起高亮"],
    ["F… / B…", "bed follows the stitch. Flip is ⬇ back→front or ⬆ front→back on the inserted row"],
    ["F→ / B←", "1 stitch: arrow only (F→ F← B→ B←). 2 or more keeps the count (F→2). No R/L"],
    ["columns", "ring 0, and ring 1 transfers, flips, racks, and the left-fold wrap tail: front = phys, back = 37−phys. A ring 1 knit is drawn on its course column. That column is the front needle when one exists there; past the front it is the next back needle inward from the fold. Labels are the needles. No stacking and no empty column between F and B. This sample's increase knit ends at F19 on column 19. After the flip and rack, column 19 is B18 and column 18 is F18, including on longer courses. The front decrease is F← on columns 6…18, from the inherited anchor. A short row that turns on the previous course's last column stays on that needle and then steps one needle per column. After the back decrease the chain stays on the repacked needles: 22R ends on B16, so 23L starts on B16 and ends on B17; 24R is B17 then B16; 25L is B16, B17, B18, F18; 26R starts on that F18 and ends on B12; 27L starts on B12 and ends on B15; 32R is B6 through B1. The same turn on the third circle: 37R ends on B6, so 38L starts on B6 and runs to B17, and the next course starts on that B17. The third-circle increase moves F0 off the bed and the knit fills the gap, so the window stays F0…F18 / B1…B18. Step3 row 40 moves the front F12…F18. Counts are equal and one needle apart, so the next row racks only the back bed onto 0…17. There is no flip on that decrease. Step3 row 44 leaves the front two stitches longer, both beds ending on 17, with the back starting two higher. The right-fold pair of F17 is B17. That needle is occupied, so the back bed racks −1 first and the flip lands on B17. The windows are then one apart, and the locked one-needle rack aligns them. The fourth circle seats the front on needle 0 after a decrease, the same rack an increase uses. Step3 row 69 lands the front on 1…14 and racks it onto 0…13, then racks the back bed onto 0…13. A front increase moves only the front needles after the increase position. It does not rack the whole front. Step3 row 71 draws F→ on F11…F13; step3 row 72 draws F→ on F12…F14. F0…F10 stay, and the holes are at 11 and 12. Step3 row 73 fills those holes (F9…F12, with F+R2 on F10) before any balance. The window is then F0…F15 / B0…B13. The flip lands on B15, past the back bed, and only that coil moves B15→B14. Step3 row 74 knits F10…F12 on F0…F14 / B0…B14. A -Rn marker is n one-needle passes after the knit. Step3 row 75 draws -R2 on B12, then B→ on B10…B0 (lands on B11) and B→ on B11…B1 (lands on B12). The occupied pair racks the back bed, flips F14 onto B14, and racks onto F0…F13 / B0…B13. Row 78 repeats that onto F0…F12 / B0…B12. Row 86 repeats it onto F0…F11 / B0…B11. Step3 row 87 is an R-direction -R1: the chart stitches are B2 then B1. The next row moves only B1 onto B0. Balance stops on the gapped back window B0,B2…B11"],
    ["rows", "stitch_map_bind.json stays 121. The cellmap sheet maps each bind cell to its sheet row and column. Ring 0 inserts one whole-bed align row after shaping. Ring 1 inserts two Flip rows, and after each flip a whole-bed move: the first puts the empty needle on the left fold, the second realigns equal counts. Ring 2's increase does not insert a flip or a rack: the stitch that would land below 0 leaves, and the knit fills the gap. The following front decrease racks only the back bed one needle, onto 0…17. Step3 row 44 racks the back bed −1 to free the paired needle, flips onto that same-index needle, then the one-needle rack aligns the windows. The fourth circle adds one rack, a flip and a rack, another flip and a rack, one more rack, and after step3 row 69 two racks that seat the front on needle 0 and then align the back. Step3 row 71 moves only the front needles after the increase and does not insert a whole-bed rack. After the increase knit on step3 row 73, one Flip lands on B15 and one single-needle row moves that coil to B14. A -Rn marker is n one-needle passes, then the existing settle. Step3 row 75 is -R2: two back passes, then a rack, a flip of F14 onto B14, and a rack onto F0…F13 / B0…B13. Row 78 repeats that group onto F0…F12 / B0…B12. Row 84's -R1 leaves the empty at the left junction and inserts no row. Row 86 repeats the rack, flip, and rack onto F0…F11 / B0…B11. Step3 row 87 knits that -R1 as B2 then B1, and row 88 moves B1 onto B0. Balance does not insert a row: the back window is no longer one span"],
    ["phys", "表 phys 只抄生成时已经跟踪的床和物理针。表列号不是物理针号。第四圈跟踪到 step3 行 88。从 step3 行 89 起没有这份数据。"],
    ["分布", "最右列是这一行开始时机器上的线圈窗，例如 F0…F18 / B1…B18。空档写成断开的窗，不并成一段。step3 行 89 记下跟踪结束时的窗；后面的行不再写。"],
    ["NOTE3", "第三圈接到第二圈末床位，前 0…18、后 1…18。step3 行 35 的加针把 F0 移出针床：没有低于 0 的物理针，负列也不绕回后床。行 36 在空档织进新圈，窗回到前 0…18、后 1…18，数目已是差一针且空针在左衔接，不翻、不移。行 40 的减针按物理针把前床 F12…F18 收一针，移完前 0…17、后仍是 1…18。数目齐、错开一针，只整段移后床到 0…17，不翻针。行 42 的后床减针收到左折返，空针已在左衔接，不移。行 44 减针后前 0…17、后 2…17，前床多两针，高位都在 17。右折返的配对针是同一物理号的 B17。B17 上有线圈，先整段移后床 -1 空出 B17，再把 F17 翻到 B17，窗变成前 0…16、后 1…17。数目齐、错开一针，再整段移后床对齐到 0…16。不是一次移两针。第三圈结束时前 0…16、后 1…16。第四圈接着这副床。行 53 数目齐、错开一针，只整段移后床。行 57 把 B15 翻到 F15，再把空针移到左衔接。行 63 把 F15 翻到 B15，再对齐。行 65 把空针移到左衔接，结束时前 0…14、后 1…14。行 69 的减针让前床落到 1…14，后床已经是 1…14。和加针一样先整段移前床 -1，前床从 0 起（0…13）。数目齐、错开一针，再整段移后床对齐到 0…13。行 71 的加针位在 F10。只把加针位之后的 F11…F13 右移一针，F0…F10 不动。行 72 再把 F12…F14 右移一针，空档留在 11 和 12。行 73 先把这两针织进 F11、F12，窗变成前 0…15、后 0…13。右折返先把 F15 翻到 B15，再只把这一针从 B15 收到 B14，不整床移。窗变成前 0…14、后 0…14。行 74 在这副窗上织 F10…F12。行 75 的 -R2 是两次一针移圈，先移后床 B10…B0（落到 B11），再移 B11…B1（落到 B12），两次之间不对齐。配对针 B14 上有线圈，先整段移后床空出 B14，再把 F14 翻到 B14，再对齐到前 0…13、后 0…13。行 78 同样是 -R2，对齐到前 0…12、后 0…12。行 84 的 -R1 空针已在左衔接，不移。行 86 再空出 B12、把 F12 翻到 B12、对齐到前 0…11、后 0…11。行 87 是 R 向 -R1，按 chart 顺着后床往低针走，先织 B2 再织 B1。行 88 只把 B1 收到 B0，B0 是落点，不是来源。没有低于 0 的物理针。平衡时后床是 0 和 2…11，中间断开，先停。行 89 记下前 0…11、后 0,2…11，后面的行不再写。+R2、−R2 以及成对的一针移圈没有写成多针成形。"],
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
  const ring3Span = pathRowRange(bind, 3);
  if (ring1Span.start !== span.rowEnd) fail(`ring 1 starts at step3 ${ring1Span.start}, ring 0 ends at ${span.rowEnd}`);
  if (ring2Span.start !== ring1Span.end) fail(`ring 2 starts at ${ring2Span.start}, ring 1 ends at ${ring1Span.end}`);
  if (ring3Span.start !== ring2Span.end) fail(`ring 4 starts at ${ring3Span.start}, ring 3 ends at ${ring2Span.end}`);
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
  // Same physical-column transfer through the next circle.
  // A later row that the locked rules do not cover stops; that row stays raw.
  const ring1 = simulateRing1(step3.rows, ring1Span.start, ring3Span.end, ring, ring3Span.end);
  if (ring1.blocked?.after !== 88 || !/后床物理窗不连续 \[0,2,3,4,5,6,7,8,9,10,11\]/.test(ring1.blocked.note || "")) {
    fail(`行 88 把 B1 收到 B0 之后，平衡应停在不连续的后床，得到 ${ring1.blocked ? ring1.blocked.note : "走完"}`);
  }
  const lockedCourseEnd = ring1.blocked.after + 1;
  if (lockedCourseEnd <= ring3Span.start || lockedCourseEnd > ring3Span.end) {
    fail(`locked course end ${lockedCourseEnd} is outside ring 4`);
  }

  const rows = [];
  const step3ToSheet = [];
  const extraCols = [];
  const pushSparse = (row) => {
    if (!row.beds || !row.beds.includes(" / ")) fail(`表行 ${rows.length} ${row.dir} 没有起始床位`);
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
      beds: builtRow.beds,
    });
  }
  if (rows.some((row) => row.dir === "Flip")) fail("ring 0 output contains a Flip row");
  for (let i = ring1Span.start; i < step3.rows.length; i++) {
    if (i < lockedCourseEnd) {
      const built = ring1.byRow.get(i);
      if (!built) fail(`step3 row ${i} was not simulated`);
      for (const extra of ring1.inserts) {
        if (extra.before !== i) continue;
        pushSparse({
          dir: extra.dir,
          step3: null,
          recenter: extra.dir === "X",
          flip: extra.dir === "Flip",
          cells: extra.cells,
          shifted: true,
          beds: extra.beds,
        });
      }
      step3ToSheet[i] = rows.length;
      pushSparse({ dir: built.dir, step3: i, cells: built.cells, shifted: true, beds: built.beds });
      for (const extra of ring1.inserts) {
        if (extra.after !== i) continue;
        pushSparse({
          dir: extra.dir,
          step3: null,
          recenter: extra.dir === "X",
          flip: extra.dir === "Flip",
          cells: extra.cells,
          shifted: true,
          beds: extra.beds,
        });
      }
    } else {
      const row = step3.rows[i];
      step3ToSheet[i] = rows.length;
      const beds =
        i === lockedCourseEnd
          ? formatBedWindow(
              ring1.end.f.map((st) => st.phys),
              ring1.end.b.map((st) => st.phys),
            )
          : "";
      rows.push({
        dir: row.dir,
        step3: i,
        beds,
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
    } else if (i < lockedCourseEnd) {
      if (sheetRow.dir !== step3.rows[i].dir) fail(`step3 row ${i} dir drifted`);
      for (const cell of occupied(sheetRow)) {
        const bed = bedOf(cell.token);
        if (bed !== "F" && bed !== "B") fail(`第二圈表行 ${step3ToSheet[i]} 符号 ${cell.token} 没有床`);
        const wantCol = columnForPhys(bed, cell.phys);
        const alongCourse = Number.isInteger(cell.along) && Math.abs(cell.col - cell.along) === 1;
        const knitCourse =
          (sheetRow.dir === "R" || sheetRow.dir === "L") && !cell.wrap && cell.chart === cell.col;
        if (cell.phys == null || (cell.col !== wantCol && !alongCourse && !knitCourse)) {
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
  const trackedSheet = step3ToSheet[lockedCourseEnd];
  const ring1Inserts = ring1.inserts.filter((row) => row.after < ring2Span.start);
  if (
    ring1Inserts.length !== 4 ||
    ring1Inserts.map((row) => `${row.dir}${row.windowAlign ? ":align" : ""}`).join(",") !== "Flip,X:align,Flip,X:align"
  ) {
    fail(`第二圈应在两次翻针之后各接一次整床移，得到 ${ring1Inserts.map((row) => row.dir).join(",")}`);
  }
  if (rows.length !== step3.rows.length + ring1.inserts.length + alignN) {
    fail(`output rows ${rows.length}, expected ${step3.rows.length + ring1.inserts.length + alignN}`);
  }
  const flipOf = (event) =>
    event.fixes?.length
      ? event.fixes.map((fix) => `${fix.dir}:${fix.note}`).join(" || ")
      : "不移";
  const gotEvents = ring1.events
    .filter((event) => event.after < ring2Span.start)
    .map(flipOf)
    .join(" | ");
  const wantEvents = [
    "Flip:NOTE: step3 行 7 减针后 数目不是 F19/B18，在右折返把 B18 翻到 F18。 || X:NOTE: step3 行 7 减针后 数目 F19/B18 已是差一针，但空针在右折返（前 0…18、后 0…17）。整段移后床 +1，空针落到左衔接 1…18。",
    "Flip:NOTE: step3 行 11 加针后 数目不是 F19/B19，在右折返把 F19 翻到 B19。 || X:NOTE: step3 行 11 加针后 数目 F19/B19 已齐，物理窗前 0…18、后 1…19 错开一针。整段移后床 -1，对齐到 0…18。",
    "不移",
  ].join(" | ");
  if (gotEvents !== wantEvents) fail(`第二圈对齐结果变了：${gotEvents}`);
  const spanOf = (label) => {
    const row = ring1.trace.find((item) => item.label === label);
    if (!row) fail(`第二圈缺少 ${label}`);
    const contig = (arr) => arr.every((phys, index) => index === 0 || phys === arr[index - 1] + 1);
    const countsOk =
      row.F === Math.ceil(row.N / 2) &&
      row.B === Math.floor(row.N / 2) &&
      row.fPhys.length === row.F &&
      row.bPhys.length === row.B &&
      row.fPhys[0] === 0 &&
      row.fPhys.at(-1) === row.F - 1 &&
      contig(row.fPhys) &&
      contig(row.bPhys);
    const emptyOk =
      row.F === row.B
        ? row.bPhys[0] === 0 && row.bPhys.at(-1) === row.fPhys.at(-1)
        : row.F === row.B + 1 && row.bPhys[0] === 1 && row.bPhys.at(-1) === row.fPhys.at(-1);
    // Increase balance waits until the same-index pair is an adjacent
    // empty needle. Until then the front is one stitch over the target
    // and the back one under, both still starting at 0.
    const deferredOk =
      row.F === Math.ceil(row.N / 2) + 1 &&
      row.B === Math.floor(row.N / 2) - 1 &&
      row.fPhys.length === row.F &&
      row.bPhys.length === row.B &&
      row.fPhys[0] === 0 &&
      row.bPhys[0] === 0 &&
      contig(row.fPhys) &&
      contig(row.bPhys) &&
      row.fPhys.at(-1) === row.bPhys.at(-1) + 2;
    if ((!countsOk || !emptyOk) && !deferredOk) {
      fail(`${label} 没有按当时的 N 合法化：N${row.N} F${row.F}[${row.fPhys}] B${row.B}[${row.bPhys}]`);
    }
    return `N${row.N} F${row.F}[${row.fPhys[0]}…${row.fPhys.at(-1)}] B${row.B}[${row.bPhys[0]}…${row.bPhys.at(-1)}]`;
  };
  for (const row of ring1.trace) {
    if (/ X\+?$/.test(row.label)) continue;
    spanOf(row.label);
  }
  const wantSpans = [
    ["step3 行 7 减针对齐后", "N37 F19[0…18] B18[1…18]"],
    ["step3 行 11 R", "N38 F19[0…18] B19[0…18]"],
    ["step3 行 16 减针对齐后", "N37 F19[0…18] B18[1…18]"],
    ["step3 行 27 R", "N37 F19[0…18] B18[1…18]"],
    ["step3 行 36 L", "N37 F19[0…18] B18[1…18]"],
    ["step3 行 40 减针对齐后", "N36 F18[0…17] B18[0…17]"],
    ["step3 行 42 减针对齐后", "N35 F18[0…17] B17[1…17]"],
    ["step3 行 43 R", "N35 F18[0…17] B17[1…17]"],
    ["step3 行 44 减针对齐后", "N34 F17[0…16] B17[0…16]"],
    ["step3 行 49 R", "N33 F17[0…16] B16[1…16]"],
    ["step3 行 50 R", "N33 F17[0…16] B16[1…16]"],
    ["step3 行 57 减针对齐后", "N31 F16[0…15] B15[1…15]"],
    ["step3 行 68 L", "N29 F15[0…14] B14[1…14]"],
    ["step3 行 69 减针对齐后", "N28 F14[0…13] B14[0…13]"],
    ["step3 行 70 L", "N28 F14[0…13] B14[0…13]"],
    ["step3 行 73 R", "N30 F15[0…14] B15[0…14]"],
    ["step3 行 74 L", "N30 F15[0…14] B15[0…14]"],
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
  const inheritedFrontAnchor = ring.stitches.find((st) => st.bed === "F" && st.chart === 5);
  const frontAnchorArrow = occupied(frontDec).find((cell) => cell.col === 6);
  if (
    !inheritedFrontAnchor ||
    inheritedFrontAnchor.phys !== 6 ||
    !frontAnchorArrow ||
    frontAnchorArrow.id !== inheritedFrontAnchor.id ||
    frontAnchorArrow.phys !== 6
  ) {
    fail(
      `前床减针锚点应仍是继承时的 F6，得到继承 ${inheritedFrontAnchor ? `id ${inheritedFrontAnchor.id} F${inheritedFrontAnchor.phys}` : "缺失"}，箭头 ${frontAnchorArrow ? `id ${frontAnchorArrow.id} F${frontAnchorArrow.phys}` : "缺失"}`,
    );
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
  if (flipSheets.join(",") !== "9,15,52,68,76,91,98,104,113") {
    fail(`翻针行 ${flipSheets.join(",")}`);
  }
  if (
    flipGlyph(flipSheets[0]) !== "19:⬇" ||
    flipGlyph(flipSheets[1]) !== "19:⬆" ||
    flipGlyph(flipSheets[2]) !== "17:⬆" ||
    flipGlyph(flipSheets[3]) !== "22:⬇" ||
    flipGlyph(flipSheets[4]) !== "15:⬆" ||
    flipGlyph(flipSheets[5]) !== "15:⬆" ||
    flipGlyph(flipSheets[6]) !== "14:⬆" ||
    flipGlyph(flipSheets[7]) !== "13:⬆" ||
    flipGlyph(flipSheets[8]) !== "12:⬆"
  ) {
    fail(`翻针应画在翻之前的物理表列，得到 ${flipSheets.map(flipGlyph).join(" / ")}`);
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
    "0:F0,1:F1,2:F2,3:F3,4:F4,5:F5,6:F6"
  ) {
    fail(
      `第二圈首行应从继承的 F0 起，画在表列 0…6（F0…F6），得到 ${openingCells.map((cell) => `${cell.col}:${cell.bed}${cell.phys}`).join(",")}`,
    );
  }
  const frontZero = [...(ring1.byRow.get(9)?.cells.values() || [])].find((cell) => cell.bed === "F" && cell.phys === 0);
  if (!frontZero || frontZero.col !== 0 || frontZero.chart !== 0 || frontZero.wrap) {
    fail(
      `前床第一针应是 F0，由 step3 列 0 画在表列 0，得到 ${frontZero ? `${frontZero.col}:${frontZero.bed}${frontZero.phys}/c${frontZero.chart}` : "缺失"}`,
    );
  }
  if (wrapsOf(9) !== "-1:B1@36,-2:B2@35,-3:B3@34,-4:B4@33") {
    fail(`step3 行 9 绕回 ${wrapsOf(9)}`);
  }
  if (wrapsOf(11) !== "-1:B1@36,-2:B2@35,-3:B3@34,-4:B4@33") {
    fail(`step3 行 11 绕回 ${wrapsOf(11)}`);
  }
  const incKnit = rows[step3ToSheet[11]];
  const atInc = (col) => occupied(incKnit).find((cell) => cell.col === col);
  const incFront = atInc(19);
  if (!incFront || incFront.token !== "FvR" || incFront.phys !== 19 || incFront.bed !== "F" || incFront.id !== 19) {
    fail(`加针后的短行程末针应是 F19，得到 ${incFront ? `${incFront.col}:${incFront.token}/${incFront.bed}${incFront.phys}#${incFront.id}` : "空"}`);
  }
  if (occupied(incKnit).some((cell) => cell.bed === "B" && cell.phys === 18)) {
    fail(`加针后的短行程没有走到 B18，不应把它画上这一行`);
  }
  const incFlip = rows[step3ToSheet[11] + 1];
  const flipCell = occupied(incFlip).find((cell) => cell.col === 19);
  if (!incFlip?.flip || !flipCell || flipCell.token !== "⬆" || flipCell.bed !== "F" || flipCell.phys !== 19) {
    fail(`F19 应出现在翻针行列 19，得到 ${flipCell ? `${flipCell.token}/${flipCell.bed}${flipCell.phys}` : "空"}`);
  }
  const foldCourse = rows[step3ToSheet[12]];
  const atFold = (col) => occupied(foldCourse).find((cell) => cell.col === col);
  const foldBack = atFold(19);
  const foldFront = atFold(18);
  if (
    foldCourse.dir !== "L" ||
    !foldBack ||
    foldBack.token !== "B^R" ||
    foldBack.bed !== "B" ||
    foldBack.phys !== 18 ||
    foldBack.id !== 19 ||
    !foldFront ||
    foldFront.token !== "F·" ||
    foldFront.bed !== "F" ||
    foldFront.phys !== 18 ||
    atFold(17)?.phys !== 17 ||
    atFold(17)?.bed !== "F" ||
    atFold(16)?.phys !== 16 ||
    atFold(16)?.bed !== "F" ||
    atFold(20)
  ) {
    const got = occupied(foldCourse)
      .slice()
      .sort((a, b) => a.col - b.col)
      .map((cell) => `${cell.col}:${cell.token}/${cell.bed}${cell.phys}#${cell.id}`)
      .join(" ");
    fail(`翻针整床移之后的短行程应从 B18 接到 F18，中间不空列，得到 ${got}`);
  }
  const longKnit = rows[step3ToSheet[15]];
  const longCols = [14, 15, 16, 17, 18, 19, 20, 21].map((col) => occupied(longKnit).find((cell) => cell.col === col));
  const longText = longCols.map((cell) => (cell ? `${cell.col}:${cell.bed}${cell.phys}` : "空")).join(" ");
  if (
    longText !== "14:F14 15:F15 16:F16 17:F17 18:F18 19:B18 20:B17 21:B16" ||
    longCols[6]?.token !== "B-R1"
  ) {
    fail(`越过折返的行程应是 F14…F18 然后 B18、B17、B16，中间不空列，得到 ${longText}`);
  }
  const ring1End = ring1.trace.find((item) => item.label === "step3 行 27 R");
  if (
    !ring1End ||
    ring1End.N !== 37 ||
    ring1End.F !== 19 ||
    ring1End.B !== 18 ||
    ring1End.fPhys[0] !== 0 ||
    ring1End.fPhys.at(-1) !== 18 ||
    ring1End.bPhys[0] !== 1 ||
    ring1End.bPhys.at(-1) !== 18
  ) {
    fail(
      `第二圈结束应是 N37、前 0…18、后 1…18，得到 ${ring1End ? `N${ring1End.N} F${ring1End.F}[${ring1End.fPhys[0]}…${ring1End.fPhys.at(-1)}] B${ring1End.B}[${ring1End.bPhys[0]}…${ring1End.bPhys.at(-1)}]` : "缺失"}`,
    );
  }
  const laterEvents = ring1.events.filter((event) => event.after >= ring2Span.start).map(flipOf);
  const wantLater = [
    "不移",
    "X:NOTE: step3 行 40 减针后 数目 F18/B18 已齐，物理窗前 0…17、后 1…18 错开一针。整段移后床 -1，对齐到 0…17。",
    "不移",
    "X:NOTE: step3 行 44 减针后 右折返配对 B17 上有线圈（前 0…17、后 2…17）。先整段移后床 -1，空出 B17（前 0…17、后 1…16）。 || Flip:NOTE: step3 行 44 减针后 数目不是 F17/B17，在右折返把 F17 翻到 B17。 || X:NOTE: step3 行 44 减针后 数目 F17/B17 已齐，物理窗前 0…16、后 1…17 错开一针。整段移后床 -1，对齐到 0…16。",
    "不移",
    "X:NOTE: step3 行 53 减针后 数目 F16/B16 已齐，物理窗前 0…15、后 1…16 错开一针。整段移后床 -1，对齐到 0…15。",
    "Flip:NOTE: step3 行 57 减针后 数目不是 F16/B15，在右折返把 B15 翻到 F15。 || X:NOTE: step3 行 57 减针后 数目 F16/B15 已是差一针，但空针在右折返（前 0…15、后 0…14）。整段移后床 +1，空针落到左衔接 1…15。",
    "Flip:NOTE: step3 行 63 减针后 数目不是 F15/B15，在右折返把 F15 翻到 B15。 || X:NOTE: step3 行 63 减针后 数目 F15/B15 已齐，物理窗前 0…14、后 1…15 错开一针。整段移后床 -1，对齐到 0…14。",
    "X:NOTE: step3 行 65 减针后 数目 F15/B14 已是差一针，但空针在右折返（前 0…14、后 0…13）。整段移后床 +1，空针落到左衔接 1…14。",
    "X:NOTE: step3 行 69 减针后 前床落到 1…14（后 1…14）。整段移前床 -1，前床从物理针 0 起（0…13）。 || X:NOTE: step3 行 69 减针后 数目 F14/B14 已齐，物理窗前 0…13、后 1…14 错开一针。整段移后床 -1，对齐到 0…13。",
    "Flip:NOTE: step3 行 73 加针后 数目不是 F15/B15，在右折返把 F15 翻到 B15。 || X:NOTE: step3 行 73 加针后 多出来的 B15 正在齐窗高位的下一针，只把这一针收到 B14，不整床移。",
    "X:NOTE: step3 行 77 减针后 右折返配对 B14 上有线圈（前 0…14、后 2…14）。先整段移后床 -1，空出 B14（前 0…14、后 1…13）。 || Flip:NOTE: step3 行 77 减针后 数目不是 F14/B14，在右折返把 F14 翻到 B14。 || X:NOTE: step3 行 77 减针后 数目 F14/B14 已齐，物理窗前 0…13、后 1…14 错开一针。整段移后床 -1，对齐到 0…13。",
    "X:NOTE: step3 行 80 减针后 右折返配对 B13 上有线圈（前 0…13、后 2…13）。先整段移后床 -1，空出 B13（前 0…13、后 1…12）。 || Flip:NOTE: step3 行 80 减针后 数目不是 F13/B13，在右折返把 F13 翻到 B13。 || X:NOTE: step3 行 80 减针后 数目 F13/B13 已齐，物理窗前 0…12、后 1…13 错开一针。整段移后床 -1，对齐到 0…12。",
    "不移",
    "X:NOTE: step3 行 86 减针后 右折返配对 B12 上有线圈（前 0…12、后 2…12）。先整段移后床 -1，空出 B12（前 0…12、后 1…11）。 || Flip:NOTE: step3 行 86 减针后 数目不是 F12/B12，在右折返把 F12 翻到 B12。 || X:NOTE: step3 行 86 减针后 数目 F12/B12 已齐，物理窗前 0…11、后 1…12 错开一针。整段移后床 -1，对齐到 0…11。",
  ];
  if (laterEvents.join(" | ") !== wantLater.join(" | ")) {
    fail(`第三圈对齐结果变了：${laterEvents.join(" | ")}`);
  }
  const courseText = (step3Row) =>
    [...(ring1.byRow.get(step3Row)?.cells.values() || [])]
      .sort((a, b) => a.col - b.col)
      .map((cell) => `${cell.col}:${cell.token}/${cell.bed}${cell.phys}`)
      .join(" ");
  if (courseText(28) !== "0:F·/F0 1:FvR/F1") {
    fail(`第三圈首行应是 F0、F1，得到 ${courseText(28)}`);
  }
  if (courseText(35) !== "0:F←/F0 1:F←/F1 2:F←/F2 3:F←/F3 4:F←/F4 5:F←/F5") {
    fail(`加针移圈应画在 F0…F5，得到 ${courseText(35)}`);
  }
  const incCourse = courseText(36);
  if (!incCourse.startsWith("4:FvL/F4 5:F·/F5 6:F+L1/F6") || !incCourse.includes("18:F·/F18 19:B·/B18") || !incCourse.endsWith("22:B^R/B15")) {
    fail(`加针行程应从 F4 接到后床，得到 ${incCourse}`);
  }
  if (courseText(17) !== "21:BvR/B16") fail(`后床减针余段应停在 B16，得到 ${courseText(17)}`);
  if (courseText(18) !== "20:BvL/B17 21:B^R/B16") fail(`23L 应从 B16 接到 B17，得到 ${courseText(18)}`);
  if (courseText(19) !== "20:B^L/B17 21:BvR/B16") fail(`24R 应是 B17 然后 B16，得到 ${courseText(19)}`);
  if (courseText(20) !== "18:FvL/F18 19:B·/B18 20:B·/B17 21:B^R/B16") {
    fail(`25L 应是 B16、B17、B18、F18，得到 ${courseText(20)}`);
  }
  if (!courseText(21).startsWith("18:F^L/F18 19:B·/B18") || !courseText(21).endsWith("25:BvR/B12")) {
    fail(`26R 应从 F18 接到 B12，得到 ${courseText(21)}`);
  }
  if (courseText(22) !== "22:BvL/B15 23:B·/B14 24:B·/B13 25:B^R/B12") {
    fail(`27L 应从 B12 接到 B15，得到 ${courseText(22)}`);
  }
  if (courseText(26) !== "31:BvL/B6 32:B^R/B5") fail(`31L 应是 B5 然后 B6，得到 ${courseText(26)}`);
  if (courseText(27) !== "31:B^L/B6 32:B·/B5 33:B·/B4 34:B·/B3 35:B·/B2 36:B·/B1") {
    fail(`32R 应是 B6…B1，得到 ${courseText(27)}`);
  }
  if (courseText(40) !== "12:F←/F12 13:F←/F13 14:F←/F14 15:F←/F15 16:F←/F16 17:F←/F17 18:F←/F18") {
    fail(`前床减针应从 F12 收到前床末针，得到 ${courseText(40)}`);
  }
  const bedsAt = (sheetRow) => rows[sheetRow]?.beds ?? "";
  if (bedsAt(step3ToSheet[28]) !== "F0…F18 / B1…B18") {
    fail(`第三圈开始应是 F0…F18 / B1…B18，得到 ${bedsAt(step3ToSheet[28])}`);
  }
  if (bedsAt(step3ToSheet[35]) !== "F0…F18 / B1…B18") {
    fail(`加针移圈开始应仍是 F0…F18 / B1…B18，得到 ${bedsAt(step3ToSheet[35])}`);
  }
  if (bedsAt(step3ToSheet[36]) !== "F0…F4,F6…F18 / B1…B18") {
    fail(`加针织行开始应留着 F5 的空档，得到 ${bedsAt(step3ToSheet[36])}`);
  }
  if (bedsAt(step3ToSheet[37]) !== "F0…F18 / B1…B18") {
    fail(`加针织完应回到 F0…F18 / B1…B18，得到 ${bedsAt(step3ToSheet[37])}`);
  }
  if (bedsAt(step3ToSheet[40]) !== "F0…F18 / B1…B18") {
    fail(`step3 行 40 开始应仍是 F0…F18 / B1…B18，得到 ${bedsAt(step3ToSheet[40])}`);
  }
  if (bedsAt(step3ToSheet[40] + 1) !== "F0…F17 / B1…B18") {
    fail(`减针后床对齐之前应是 F0…F17 / B1…B18，得到 ${bedsAt(step3ToSheet[40] + 1)}`);
  }
  if (bedsAt(step3ToSheet[41]) !== "F0…F17 / B0…B17") {
    fail(`减针对齐后的织行应是 F0…F17 / B0…B17，得到 ${bedsAt(step3ToSheet[41])}`);
  }
  if (bedsAt(step3ToSheet[42]) !== "F0…F17 / B0…B17") {
    fail(`step3 行 42 开始应是 F0…F17 / B0…B17，得到 ${bedsAt(step3ToSheet[42])}`);
  }
  if (bedsAt(step3ToSheet[43]) !== "F0…F17 / B1…B17") {
    fail(`step3 行 43 开始应是 F0…F17 / B1…B17，得到 ${bedsAt(step3ToSheet[43])}`);
  }
  if (bedsAt(step3ToSheet[44]) !== "F0…F17 / B1…B17") {
    fail(`step3 行 44 开始应记下 F0…F17 / B1…B17，得到 ${bedsAt(step3ToSheet[44])}`);
  }
  if (bedsAt(step3ToSheet[44] + 1) !== "F0…F17 / B2…B17") {
    fail(`空出配对针的整段移应是 F0…F17 / B2…B17，得到 ${bedsAt(step3ToSheet[44] + 1)}`);
  }
  if (bedsAt(step3ToSheet[44] + 2) !== "F0…F17 / B1…B16") {
    fail(`翻针开始应是 F0…F17 / B1…B16，得到 ${bedsAt(step3ToSheet[44] + 2)}`);
  }
  if (bedsAt(step3ToSheet[44] + 3) !== "F0…F16 / B1…B17") {
    fail(`对齐之前应是错开一针，得到 ${bedsAt(step3ToSheet[44] + 3)}`);
  }
  if (bedsAt(step3ToSheet[45]) !== "F0…F16 / B0…B16") {
    fail(`行 44 对齐后的织行应是 F0…F16 / B0…B16，得到 ${bedsAt(step3ToSheet[45])}`);
  }
  if (bedsAt(step3ToSheet[46]) !== "F0…F16 / B0…B16") {
    fail(`step3 行 46 开始应是 F0…F16 / B0…B16，得到 ${bedsAt(step3ToSheet[46])}`);
  }
  if (bedsAt(step3ToSheet[47]) !== "F0…F16 / B1…B16") {
    fail(`行 46 减针后空针应已在左衔接，得到 ${bedsAt(step3ToSheet[47])}`);
  }
  if (bedsAt(step3ToSheet[49]) !== "F0…F16 / B1…B16") {
    fail(`第三圈末行应是 F0…F16 / B1…B16，得到 ${bedsAt(step3ToSheet[49])}`);
  }
  if (bedsAt(step3ToSheet[50]) !== "F0…F16 / B1…B16") {
    fail(`第四圈开始应是 F0…F16 / B1…B16，得到 ${bedsAt(step3ToSheet[50])}`);
  }
  if (bedsAt(step3ToSheet[53]) !== "F0…F16 / B1…B16") {
    fail(`step3 行 53 开始应是 F0…F16 / B1…B16，得到 ${bedsAt(step3ToSheet[53])}`);
  }
  if (bedsAt(step3ToSheet[54]) !== "F0…F15 / B0…B15") {
    fail(`行 53 对齐后应是 F0…F15 / B0…B15，得到 ${bedsAt(step3ToSheet[54])}`);
  }
  if (bedsAt(step3ToSheet[57]) !== "F0…F15 / B0…B15") {
    fail(`step3 行 57 开始应是 F0…F15 / B0…B15，得到 ${bedsAt(step3ToSheet[57])}`);
  }
  if (bedsAt(step3ToSheet[58]) !== "F0…F15 / B1…B15") {
    fail(`行 57 翻针移床后应是 F0…F15 / B1…B15，得到 ${bedsAt(step3ToSheet[58])}`);
  }
  if (bedsAt(step3ToSheet[63]) !== "F0…F15 / B1…B15") {
    fail(`step3 行 63 开始应是 F0…F15 / B1…B15，得到 ${bedsAt(step3ToSheet[63])}`);
  }
  if (bedsAt(step3ToSheet[64]) !== "F0…F14 / B0…B14") {
    fail(`行 63 对齐后应是 F0…F14 / B0…B14，得到 ${bedsAt(step3ToSheet[64])}`);
  }
  if (bedsAt(step3ToSheet[66]) !== "F0…F14 / B1…B14") {
    fail(`行 65 移床后应是 F0…F14 / B1…B14，得到 ${bedsAt(step3ToSheet[66])}`);
  }
  if (bedsAt(step3ToSheet[68]) !== "F0…F14 / B1…B14") {
    fail(`第四圈末行应是 F0…F14 / B1…B14，得到 ${bedsAt(step3ToSheet[68])}`);
  }
  if (bedsAt(step3ToSheet[69]) !== "F0…F14 / B1…B14") {
    fail(`step3 行 69 开始应仍是 F0…F14 / B1…B14，得到 ${bedsAt(step3ToSheet[69])}`);
  }
  if (bedsAt(step3ToSheet[69] + 1) !== "F1…F14 / B1…B14") {
    fail(`行 69 减针后、前床回 0 之前应是 F1…F14 / B1…B14，得到 ${bedsAt(step3ToSheet[69] + 1)}`);
  }
  if (bedsAt(step3ToSheet[69] + 2) !== "F0…F13 / B1…B14") {
    fail(`前床回到 0 之后应是 F0…F13 / B1…B14，得到 ${bedsAt(step3ToSheet[69] + 2)}`);
  }
  if (bedsAt(step3ToSheet[70]) !== "F0…F13 / B0…B13") {
    fail(`step3 行 70 开始应是 F0…F13 / B0…B13，得到 ${bedsAt(step3ToSheet[70])}`);
  }
  if (bedsAt(step3ToSheet[71]) !== "F0…F13 / B0…B13") {
    fail(`step3 行 71 开始应仍是 F0…F13 / B0…B13，得到 ${bedsAt(step3ToSheet[71])}`);
  }
  if (bedsAt(step3ToSheet[72]) !== "F0…F10,F12…F14 / B0…B13") {
    fail(`step3 行 72 开始应留着 F11 的空档，得到 ${bedsAt(step3ToSheet[72])}`);
  }
  if (bedsAt(step3ToSheet[73]) !== "F0…F10,F13…F15 / B0…B13") {
    fail(`step3 行 73 开始应留着 11 和 12 的空档，得到 ${bedsAt(step3ToSheet[73])}`);
  }
  if (bedsAt(step3ToSheet[73] + 1) !== "F0…F15 / B0…B13") {
    fail(`加针后的翻针应记前 0…15、后 0…13，得到 ${bedsAt(step3ToSheet[73] + 1)}`);
  }
  if (bedsAt(step3ToSheet[73] + 2) !== "F0…F14 / B0…B13,B15") {
    fail(`单针收回之前应是 F0…F14 / B0…B13,B15，得到 ${bedsAt(step3ToSheet[73] + 2)}`);
  }
  if (bedsAt(step3ToSheet[74]) !== "F0…F14 / B0…B14") {
    fail(`加针对齐后的织行应是 F0…F14 / B0…B14，得到 ${bedsAt(step3ToSheet[74])}`);
  }
  if (bedsAt(step3ToSheet[75]) !== "F0…F14 / B0…B14") {
    fail(`step3 行 75 开始应仍是 F0…F14 / B0…B14，得到 ${bedsAt(step3ToSheet[75])}`);
  }
  if (courseText(75) !== "10:F^L/F10 11:F·/F11 12:F·/F12 13:F·/F13 14:F·/F14 15:B·/B14 16:B·/B13 17:B-R2/B12 18:B·/B11 19:B·/B10") {
    fail(`step3 行 75 应是 -R2 在 B12，得到 ${courseText(75)}`);
  }
  if (courseText(76) !== "27:B→/B10 28:B→/B9 29:B→/B8 30:B→/B7 31:B→/B6 32:B→/B5 33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1 37:B→/B0") {
    fail(`step3 行 76 应只把 B10…B0 收一针，得到 ${courseText(76)}`);
  }
  if (bedsAt(step3ToSheet[77]) !== "F0…F14 / B1…B14") {
    fail(`step3 行 77 开始应是 F0…F14 / B1…B14，得到 ${bedsAt(step3ToSheet[77])}`);
  }
  if (courseText(77) !== "26:B→/B11 27:B→/B10 28:B→/B9 29:B→/B8 30:B→/B7 31:B→/B6 32:B→/B5 33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1") {
    fail(`step3 行 77 应把 B11…B1 收到 B12，得到 ${courseText(77)}`);
  }
  if (bedsAt(step3ToSheet[77] + 1) !== "F0…F14 / B2…B14") {
    fail(`空出 B14 应是 F0…F14 / B2…B14，得到 ${bedsAt(step3ToSheet[77] + 1)}`);
  }
  if (bedsAt(step3ToSheet[77] + 2) !== "F0…F14 / B1…B13") {
    fail(`F14 翻到 B14 开始应是 F0…F14 / B1…B13，得到 ${bedsAt(step3ToSheet[77] + 2)}`);
  }
  if (bedsAt(step3ToSheet[78]) !== "F0…F13 / B0…B13") {
    fail(`行 77 对齐后应是 F0…F13 / B0…B13，得到 ${bedsAt(step3ToSheet[78])}`);
  }
  if (courseText(78) !== "18:B-R2/B9 19:B·/B8 20:B·/B7") {
    fail(`step3 行 78 应是 -R2 在 B9，得到 ${courseText(78)}`);
  }
  if (courseText(79) !== "30:B→/B7 31:B→/B6 32:B→/B5 33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1 37:B→/B0") {
    fail(`step3 行 79 应只把 B7…B0 收一针，得到 ${courseText(79)}`);
  }
  if (courseText(80) !== "29:B→/B8 30:B→/B7 31:B→/B6 32:B→/B5 33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1") {
    fail(`step3 行 80 应把 B8…B1 收到 B9，得到 ${courseText(80)}`);
  }
  if (bedsAt(step3ToSheet[81]) !== "F0…F12 / B0…B12") {
    fail(`行 80 对齐后应是 F0…F12 / B0…B12，得到 ${bedsAt(step3ToSheet[81])}`);
  }
  if (courseText(83) !== "18:B^L/B7 19:B·/B6 20:B-R1/B5 21:B·/B4") {
    fail(`step3 行 83 应是 -R1 在 B5，得到 ${courseText(83)}`);
  }
  if (courseText(84) !== "33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1 37:B→/B0") {
    fail(`step3 行 84 应把 B4…B0 收到 B5，得到 ${courseText(84)}`);
  }
  if (bedsAt(step3ToSheet[85]) !== "F0…F12 / B1…B12") {
    fail(`行 84 之后空针应已在左衔接，得到 ${bedsAt(step3ToSheet[85])}`);
  }
  if (courseText(86) !== "35:B→/B2 36:B→/B1") {
    fail(`step3 行 86 应把 B2…B1 收到 B3，得到 ${courseText(86)}`);
  }
  if (bedsAt(step3ToSheet[87]) !== "F0…F11 / B0…B11") {
    fail(`行 86 对齐后应记下 F0…F11 / B0…B11，得到 ${bedsAt(step3ToSheet[87])}`);
  }
  if (courseText(87) !== "23:B-R1/B2 24:B·/B1") {
    fail(`step3 行 87 应顺着 R 向织 B2 再织 B1，得到 ${courseText(87)}`);
  }
  if (courseText(88) !== "36:B→/B1") {
    fail(`step3 行 88 应只把 B1 收到 B0，得到 ${courseText(88)}`);
  }
  if (bedsAt(step3ToSheet[88]) !== "F0…F11 / B0…B11") {
    fail(`行 88 开始应是 F0…F11 / B0…B11，得到 ${bedsAt(step3ToSheet[88])}`);
  }
  if (bedsAt(step3ToSheet[89]) !== "F0…F11 / B0,B2…B11") {
    fail(`行 88 之后应记下断开的后床，得到 ${bedsAt(step3ToSheet[89])}`);
  }
  if (bedsAt(step3ToSheet[90]) !== "") {
    fail(`跟踪停下之后不再写床位，得到 ${bedsAt(step3ToSheet[90])}`);
  }
  if (step3ToSheet[75] !== 94 || step3ToSheet[87] !== 115 || step3ToSheet[88] !== 116 || step3ToSheet[89] !== 117 || step3ToSheet[78] !== 100 || step3ToSheet[86] !== 111) {
    fail(`-R2 之后的表行号变了：75→${step3ToSheet[75]} 78→${step3ToSheet[78]} 86→${step3ToSheet[86]} 87→${step3ToSheet[87]} 88→${step3ToSheet[88]} 89→${step3ToSheet[89]}`);
  }
  if (courseText(69) !== "0:F→/F0 1:F→/F1 2:F→/F2 3:F→/F3 4:F→/F4 5:F→/F5 6:F→/F6 7:F→/F7 8:F→/F8 9:F→/F9 10:F→/F10 11:F→/F11") {
    fail(`step3 行 69 应把前床 F0…F11 收一针，得到 ${courseText(69)}`);
  }
  if (courseText(70) !== "9:FvL/F9 10:F·/F10 11:F·/F11") {
    fail(`step3 行 70 应是 F9…F11，得到 ${courseText(70)}`);
  }
  if (courseText(71) !== "11:F→/F11 12:F→/F12 13:F→/F13") {
    fail(`step3 行 71 应只把加针位之后的 F11…F13 右移一针，得到 ${courseText(71)}`);
  }
  if (courseText(72) !== "12:F→/F12 13:F→/F13 14:F→/F14") {
    fail(`step3 行 72 应只把加针位之后的 F12…F14 右移一针，得到 ${courseText(72)}`);
  }
  if (courseText(73) !== "9:F^L/F9 10:F+R2/F10 11:F·/F11 12:FvR/F12") {
    fail(`step3 行 73 应先把加针织进 F11、F12，得到 ${courseText(73)}`);
  }
  if (courseText(74) !== "10:FvL/F10 11:F·/F11 12:F^R/F12") {
    fail(`加针对齐后的短行程应停在 F10…F12，得到 ${courseText(74)}`);
  }
  const incFold = rows[step3ToSheet[73] + 1];
  const incFoldCell = occupied(incFold)[0];
  if (
    incFold?.dir !== "Flip" ||
    occupied(incFold).length !== 1 ||
    !incFoldCell ||
    incFoldCell.token !== "⬆" ||
    incFoldCell.bed !== "F" ||
    incFoldCell.phys !== 15 ||
    incFoldCell.col !== 15
  ) {
    fail(
      `行 73 之后应把 F15 翻到 B15，得到 ${incFoldCell ? `${incFoldCell.col}:${incFoldCell.token}/${incFoldCell.bed}${incFoldCell.phys}` : "空"}`,
    );
  }
  const incPack = rows[step3ToSheet[73] + 2];
  const incPackCells = occupied(incPack);
  if (
    incPack?.dir !== "X" ||
    incPackCells.length !== 1 ||
    incPackCells[0].token !== "B←" ||
    incPackCells[0].bed !== "B" ||
    incPackCells[0].phys !== 15 ||
    incPackCells[0].col !== 22
  ) {
    fail(
      `翻针之后应只把 B15 收到 B14，得到 ${incPackCells.map((cell) => `${cell.col}:${cell.token}/${cell.bed}${cell.phys}`).join(" ")}`,
    );
  }
  const seatFrontRow = rows[step3ToSheet[69] + 1];
  const seatFrontCols = occupied(seatFrontRow)
    .map((cell) => cell.col)
    .sort((a, b) => a - b);
  if (
    seatFrontRow.dir !== "X" ||
    occupied(seatFrontRow).some((cell) => cell.token !== "F←" || cell.bed !== "F") ||
    seatFrontCols.join(",") !== [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].join(",")
  ) {
    fail(`行 69 之后应整段移前床 F← 列 1…14，得到 ${seatFrontCols.join(",")}`);
  }
  const seatBackRow = rows[step3ToSheet[69] + 2];
  const seatBackCols = occupied(seatBackRow)
    .slice()
    .sort((a, b) => a.col - b.col);
  if (
    seatBackRow.dir !== "X" ||
    seatBackCols.length !== 14 ||
    seatBackCols.some((cell) => cell.token !== "B←" || cell.bed !== "B") ||
    seatBackCols[0].col !== 23 ||
    seatBackCols[0].phys !== 14 ||
    seatBackCols.at(-1).col !== 36 ||
    seatBackCols.at(-1).phys !== 1
  ) {
    fail(
      `前床回 0 之后应整段移后床 B← 列 23…36，得到 ${seatBackCols.map((cell) => `${cell.col}:${cell.token}/${cell.bed}${cell.phys}`).join(" ")}`,
    );
  }
  const incMoved = ring1.trace.find((item) => item.label === "step3 行 35 X+");
  if (
    !incMoved ||
    incMoved.fPhys.join(",") !== "0,1,2,3,4,6,7,8,9,10,11,12,13,14,15,16,17,18" ||
    incMoved.B !== 18 ||
    incMoved.bPhys[0] !== 1 ||
    incMoved.bPhys.at(-1) !== 18
  ) {
    fail(`加针移圈后 F0 离开针床，前床在 F5 留空，后床仍是 1…18`);
  }
  const decRow = ring1.trace.find((item) => item.label === "step3 行 40 X");
  const decSettled = ring1.trace.find((item) => item.label === "step3 行 40 减针对齐后");
  if (
    !decRow ||
    decRow.F !== 18 ||
    decRow.fPhys[0] !== 0 ||
    decRow.fPhys.at(-1) !== 17 ||
    decRow.B !== 18 ||
    decRow.bPhys[0] !== 1 ||
    decRow.bPhys.at(-1) !== 18
  ) {
    fail(`step3 行 40 移圈后应是前 0…17、后 1…18`);
  }
  if (
    !decSettled ||
    decSettled.F !== 18 ||
    decSettled.fPhys[0] !== 0 ||
    decSettled.fPhys.at(-1) !== 17 ||
    decSettled.B !== 18 ||
    decSettled.bPhys[0] !== 0 ||
    decSettled.bPhys.at(-1) !== 17
  ) {
    fail(`step3 行 40 对齐后应是前 0…17、后 0…17`);
  }
  if (
    !courseText(41).startsWith("12:F·/F12") ||
    !courseText(41).includes("17:F·/F17 18:B·/B17") ||
    !courseText(41).endsWith("24:B-R1/B11 25:B·/B10")
  ) {
    fail(`减针对齐后的织行应从 F12 接到 B10，-R1 在 B11，得到 ${courseText(41)}`);
  }
  if (courseText(42) !== "27:B→/B10 28:B→/B9 29:B→/B8 30:B→/B7 31:B→/B6 32:B→/B5 33:B→/B4 34:B→/B3 35:B→/B2 36:B→/B1 37:B→/B0") {
    fail(`后床减针应从 B10 收到 B0，得到 ${courseText(42)}`);
  }
  if (courseText(43) !== "25:B·/B10 26:B·/B9 27:B-R1/B8 28:B·/B7") {
    fail(`step3 行 43 应是 B10…B7，-R1 在 B8，得到 ${courseText(43)}`);
  }
  const held = ring1.trace.find((item) => item.label === "step3 行 39 R");
  if (!held || held.N !== 37 || held.F !== 19 || held.B !== 18 || held.fPhys[0] !== 0 || held.bPhys[0] !== 1) {
    fail(`停在第 40 行之前应是 N37、前 0…18、后 1…18`);
  }
  for (let i = 0; i < trackedSheet; i++) {
    const row = rows[i];
    if (row.dir !== "X" && row.dir !== "X+") continue;
    for (const cell of occupied(row)) {
      const move = String(cell.token).match(/^[FB][←→](\d+)?$/);
      if (!move) fail(`表行 ${i} 移圈符号 ${cell.token} 应是 F→ / B←，两针及以上才写数字`);
      if (move[1] && Number(move[1]) < 2) fail(`表行 ${i} 移 1 针不写数字，得到 ${cell.token}`);
    }
  }
  const ring1Sheet = step3ToSheet[ring1Span.start];
  for (let i = 0; i < trackedSheet; i++) {
    const row = rows[i];
    const seen = new Set();
    for (const cell of occupied(row)) {
      if (seen.has(cell.col)) fail(`表行 ${i} 列 ${cell.col} 有两枚线圈`);
      seen.add(cell.col);
      if (!headerSet.has(cell.col)) fail(`表头缺少列 ${cell.col}`);
      const bed = bedOf(cell.token);
      if (cell.phys == null) fail(`表行 ${i} 列 ${cell.col} 没有物理针`);
      const want = columnForPhys(bed, cell.phys);
      const alongCourse = Number.isInteger(cell.along) && Math.abs(cell.col - cell.along) === 1;
      const knitCourse =
        i >= ring1Sheet && (row.dir === "R" || row.dir === "L") && !cell.wrap && cell.chart === cell.col;
      if (cell.col !== want && !alongCourse && !knitCourse) {
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
      if (cell.noBind) continue;
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
      if (sheetRow >= trackedSheet) continue;
      if ((cell.bed !== "F" && cell.bed !== "B") || !Number.isInteger(cell.phys)) continue;
      const key = `${sheetRow},${cell.col}`;
      if (seenPhys.has(key)) fail(`phys ${key} 记了两次`);
      seenPhys.add(key);
      physEntries.push({ sheetRow, sheetCol: cell.col, bed: cell.bed, phys: cell.phys });
    }
  }
  let tracked = 0;
  for (let sheetRow = 0; sheetRow < trackedSheet; sheetRow++) tracked += occupied(rows[sheetRow]).length;
  if (physEntries.length !== tracked) {
    fail(`phys 表 ${physEntries.length} 行，已跟踪的有符号格子是 ${tracked}`);
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
    lockedCourseEnd,
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
  console.log(`  表列公式：移圈、翻针、整床移仍是前床列=物理针、后床列=37−物理针。织行画在行程列上，跟踪到 step3 行 ${built.lockedCourseEnd - 1}。`);
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
