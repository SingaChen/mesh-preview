/**
 * Build iteration_0_cut_readable_map_step4_ring0.xls
 *
 * Ring 0 beds follow the stitch, on physical needles. Chart columns stay
 * the step3 columns (a transfer row shows the source column). Cast-on:
 * column <= 18 is front, phys = column; otherwise back, phys = 37 − column.
 * An X / X+ moves front phys with the chart and back phys against it, so
 * back phys stays 37 − column. After the increase knit, one X row recenters:
 * every front stitch F→R1 (phys + 1) and every back stitch B←L1 (phys − 1).
 * Charts do not move. After that, back phys = 36 − column, and a new back
 * stitch uses that formula. No Flip. Rings 1–4 are copied from step3.
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

/**
 * Absolute F/B arrow → step3 relative arrow.
 * Front keeps the machine direction and drops L/R. Back is mirrored.
 */
export function toRelativeToken(token) {
  const raw = String(token ?? "");
  const bed = raw.startsWith("F") ? "F" : raw.startsWith("B") ? "B" : "";
  const body = raw.replace(/^[FB](?=·|[.v^+\-←→↔])/, "");
  const arrow = body.match(/^(←|→)[RL](\d+)$/);
  if (!arrow) return body;
  let dir = arrow[1];
  if (bed === "B") dir = dir === "←" ? "→" : "←";
  return `${dir}${arrow[2]}`;
}

/**
 * Step3 relative arrow → absolute bed arrow.
 * F advance follows the knit direction, and step3 already wrote that
 * machine arrow (right-knit advance is →, so F→R). B is the mirror.
 */
export function toAbsoluteToken(token, bed) {
  const raw = String(token ?? "");
  if (!raw || (bed !== "F" && bed !== "B")) return raw;
  const arrow = raw.match(/^(←|→)(\d+)$/);
  if (!arrow) return bed + raw;
  const n = arrow[2];
  if (bed === "F") return arrow[1] === "←" ? `F←L${n}` : `F→R${n}`;
  return arrow[1] === "←" ? `B→R${n}` : `B←L${n}`;
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
      token: st.bed === "F" ? "F→R1" : "B←L1",
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
    if (!m || m.fromPhys !== from || m.toPhys !== to || m.bed !== "B" || m.token !== "B←L1") {
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
    if (m.token !== "F→R1" || m.toPhys !== m.fromPhys + 1 || m.fromPhys !== m.col) {
      fail(`回正前床列 ${m.col} 应从物理针 ${m.col} 以 F→R1 移到 ${m.col + 1}，得到 ${m.fromPhys}→${m.toPhys} ${m.token}`);
    }
  }
  for (const m of bMoves) {
    if (m.token !== "B←L1" || m.toPhys !== m.fromPhys - 1) {
      fail(`回正后床列 ${m.col} 应 B←L1，得到 ${m.token} ${m.fromPhys}→${m.toPhys}`);
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

function legendSheet(xfIndexForFill, ring) {
  const parts = [bof(0x0010)];
  const xf = xfIndexForFill("rgb(255,255,255)");
  const legend = [
    ["第一圈按线圈物理针回正", `回正前 B=37−列；回正行 F→R1、B←L1；之后 B=36−列。结束 F${ring.front}/B${ring.back}`],
    ["later rows", "path 1 onward stays step3, unchanged"],
    ["F… / B…", "bed follows the stitch; ^L stays on the back"],
    ["→R1 / ←L1", "F advance = knit direction (right-knit →R); B mirrored. Recenter is its own X row"],
    ["excluded", "no Flip; the finished circle stays inside F−B ∈ {0,1}"],
    ["rows", "122 sheet rows (one inserted X), needles −5…36, stitch_map_bind.json still 121"],
  ];
  legend.forEach((pair, i) => {
    parts.push(labelRecord(i, 0, xf, pair[0]));
    parts.push(labelRecord(i, 1, xf, pair[1]));
  });
  parts.push(eof());
  return { name: "legend", bytes: Buffer.concat(parts) };
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
  const rows = [];
  for (let i = 0; i < step3.rows.length; i++) {
    const row = step3.rows[i];
    if (i >= span.rowEnd) {
      rows.push({
        dir: row.dir,
        cells: row.cells.map((c) => ({ col: c.col, token: c.token, fill: c.fill })),
      });
    } else {
      const snap = ring.atRow.get(i);
      if (!snap) fail(`ring 0 row ${i} has no stitch identities`);
      rows.push({
        dir: row.dir,
        cells: row.cells.map((c) => {
          if (!c.token) return { col: c.col, token: "", fill: c.fill || "rgb(192,192,192)" };
          const st = snap.get(c.col);
          if (!st) fail(`row ${i} col ${c.col} has no stitch identity`);
          if (st.bed !== "F" && st.bed !== "B") fail(`row ${i} col ${c.col} stitch ${st.id} has no bed`);
          const painted = paintToken(c, toAbsoluteToken(c.token, st.bed));
          return { col: c.col, token: painted.token, fill: painted.fill, phys: st.phys, bed: st.bed, id: st.id };
        }),
      });
    }
    if (i === ring.recenterAfter) {
      const byCol = new Map(ring.recenterMoves.map((m) => [m.col, m]));
      rows.push({
        dir: "X",
        recenter: true,
        cells: step3.needles.map((col) => {
          const m = byCol.get(col);
          if (!m) return { col, token: "", fill: "rgb(192,192,192)" };
          return { col, token: m.token, fill: "rgb(204,204,255)", phys: m.fromPhys, bed: m.bed, id: m.id };
        }),
      });
    }
  }
  if (rows.length !== step3.rows.length + 1) fail(`output rows ${rows.length} != ${step3.rows.length + 1}`);
  if (rows.some((r) => r.dir === "Flip")) fail("output contains a Flip row");
  const recenterSheet = sheetRowForStep3(ring.recenterAfter, ring.recenterAfter) + 1;
  if (rows[recenterSheet]?.dir !== "X" || !rows[recenterSheet].recenter) {
    fail(`recenter is not sheet row ${recenterSheet}`);
  }
  for (let i = 0; i < step3.rows.length; i++) {
    const sheetRow = rows[sheetRowForStep3(i, ring.recenterAfter)];
    if (i < span.rowEnd) {
      assertAlignedRow(sheetRow, step3.rows[i], i);
      for (const cell of occupied(sheetRow)) {
        if (bedOf(cell.token) === "other") fail(`row ${i} col ${cell.col} token ${cell.token} has no F/B`);
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
    if (cell.token !== "F→R1" && cell.token !== "B←L1") {
      fail(`recenter col ${cell.col} token ${cell.token} is not F→R1 or B←L1`);
    }
    if (cell.fill !== "rgb(204,204,255)") fail(`recenter col ${cell.col} fill ${cell.fill}`);
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
  const dataSheet = sheetFromGrid("step4-ring0", step3.headerLabel || "dir\\col", step3.needles, rows, xfIndexForFill);
  const legend = legendSheet(xfIndexForFill, ring);
  const xfBytes = Buffer.concat(palette.map((fill) => xfRecord(icvForFill(fill))));
  const bofBytes = bof(0x0005);
  const eofBytes = eof();
  const boundsheetLen = boundsheet(0, dataSheet.name).length + boundsheet(0, legend.name).length;
  const globalLen = bofBytes.length + xfBytes.length + boundsheetLen + eofBytes.length;
  const sheet1At = globalLen;
  const sheet2At = globalLen + dataSheet.bytes.length;
  const global = Buffer.concat([
    bofBytes,
    xfBytes,
    boundsheet(sheet1At, dataSheet.name),
    boundsheet(sheet2At, legend.name),
    eofBytes,
  ]);
  const workbook = Buffer.concat([global, dataSheet.bytes, legend.bytes]);
  return {
    bytes: writeCfb(workbook),
    span,
    rows,
    needles: step3.needles,
    ring,
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
  console.log(`  换算：回正前 后床=${ring.backBaseBefore}−列；回正后 后床=${ring.backBaseAfter}−列。前床回正后物理针=列+1=出生列。`);
  for (const row of built.summary) {
    console.log(
      `  表行 ${row.display_row} ${row.dir} F=${row.F} 物理针[${row.fPhys.join(",")}] B=${row.B} 物理针[${row.bPhys.join(",")}]`,
    );
  }
  console.log("  回正行移圈：");
  for (const m of ring.recenterMoves) {
    console.log(`    列 ${m.col} ${m.bed} 物理针 ${m.fromPhys}→${m.toPhys} ${m.token}`);
  }
  console.log(
    `  第2行 vL 列 ${s.chart}：${s.bed} 物理针 ${s.phys}（线圈 ${s.id}）；B^R 列 ${br.chart}：${br.bed} ${br.phys}；V 列 ${v.chart}：${v.bed} ${v.phys}`,
  );
  console.log(
    `  第3行 ^L 列 ${caret.chart}：${caret.bed} 物理针 ${caret.phys}（仍是线圈 ${caret.id}，表行 ${sheetRowForStep3(3, ring.recenterAfter)}）；列 20 V：${v3.bed} ${v3.phys}；列 21 新针：${fresh.bed} ${fresh.phys}`,
  );
  console.log("  每步之后床上仍挂着的线圈：");
  for (const live of ring.liveAt) {
    console.log(`    ${live.label} F=${live.F} [${live.fPhys.join(",")}] B=${live.B} [${live.bPhys.join(",")}]`);
  }
  console.log(
    `  ring 0 结束：前床物理针 ${ring.frontPhys.join(",")} 终点 ${ring.frontEnd}；后床物理针 ${ring.backPhys.join(",")} 起点 ${ring.backStart}；都在 18：${ring.foldBoth18 ? "是" : "否"}`,
  );
  console.log(`  总行数 ${built.rows.length}`);
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
