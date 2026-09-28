/**
 * Build iteration_0_cut_readable_map_step4_ring0.xls
 *
 * Ring 0 (path 0) is one closed loop: its knit rows plus the X / X+ that
 * belong to those rows. After those ops, N is the number of distinct needle
 * columns that still hold a stitch. Walk that loop from the ring's cast-on
 * stitch (transfers slide a stitch, they do not reorder it; a new increase
 * is inserted between the stitches the carriage is between). The first
 * ceil(N/2) stitches are F, the rest B. Each stitch keeps that bed on every
 * earlier cell, including the column it occupied before an X+.
 *
 * Inputs are step3_xfer.xls and stitch_map_bind.json only. No Flip rows.
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
    const counts = { F: 0, B: 0, other: 0 };
    const fCols = [];
    const bCols = [];
    for (const cell of occ) {
      const bed = bedOf(cell.token);
      counts[bed] += 1;
      if (bed === "F") fCols.push(cell.col);
      if (bed === "B") bCols.push(cell.col);
    }
    return {
      display_row: i,
      dir: row.dir,
      n: occ.length,
      F: counts.F,
      B: counts.B,
      other: counts.other,
      cols: occ.length ? [occ[0].col, occ[occ.length - 1].col] : [],
      fCols,
      bCols,
    };
  });
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

/** Same column update as readable_map_steps._advance_live / _retreat_live. */
function moveLive(live, pivot, step, delta) {
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

function insertOnLoop(seq, prevId, nextId, id) {
  if (prevId == null) {
    seq.push(id);
    return;
  }
  const ia = seq.indexOf(prevId);
  if (ia < 0) fail(`loop is missing stitch ${prevId}`);
  if (nextId == null) {
    seq.splice(ia + 1, 0, id);
    return;
  }
  const ib = seq.indexOf(nextId);
  if (ib < 0) fail(`loop is missing stitch ${nextId}`);
  if (ib === ia + 1) seq.splice(ib, 0, id);
  else if (ia === ib + 1) seq.splice(ia, 0, id);
  else fail(`new stitch ${id} is not between adjacent loop stitches ${prevId} and ${nextId}`);
}

/**
 * Replay ring-0 knit rows and the X / X+ that precede them.
 * Live columns follow readable_map_steps.generate_step3_xfer (§8).
 * Stitch identity follows the column through each pass.
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
    } else {
      fail(`unexpected step3 dir ${dir} inside ring 0 row ${i}`);
    }
  }
  if (pending.length) {
    fail(`ring 0 ends on a transfer row (${pending.join(",")}); that pass belongs to the next ring`);
  }

  let live = new Map();
  const seq = [];
  const born = [];
  const cellIds = new Map();
  let nextId = 0;

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
        predicted.push({ dir: "X", arrow, cols, ids });
        live = moveLive(live, pivot, step, step === 1 ? -1 : 1);
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
        predicted.push({ dir: "X+", arrow, cols, ids });
        live = moveLive(live, pivot0, step, step === 1 ? 1 : -1);
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
      cellIds.set(ri, want.ids);
    });

    const ids = new Map();
    const visited = [];
    for (let i = 0; i < kcells.length; i++) {
      const cell = kcells[i];
      let id = live.get(cell.col);
      if (id == null) {
        id = nextId;
        nextId += 1;
        born.push(id);
        let nextExisting = null;
        for (let j = i + 1; j < kcells.length; j++) {
          const later = live.get(kcells[j].col);
          if (later != null) {
            nextExisting = later;
            break;
          }
        }
        const prev = i > 0 ? visited[i - 1] : null;
        insertOnLoop(seq, prev, nextExisting, id);
        live.set(cell.col, id);
      }
      visited.push(id);
      ids.set(cell.col, id);
    }
    cellIds.set(op.knit, ids);
  }

  if (seq.length !== live.size) fail(`loop has ${seq.length} stitches but live has ${live.size}`);
  const colOf = new Map([...live.entries()].map(([col, id]) => [id, col]));
  for (const id of seq) {
    if (!colOf.has(id)) fail(`loop stitch ${id} is not on the bed`);
  }
  const knitOrderCols = seq.map((id) => colOf.get(id));
  const columnOrderCols = [...colOf.values()].sort((a, b) => a - b);
  const chronoCols = born.map((id) => colOf.get(id));
  const n = knitOrderCols.length;
  const front = Math.ceil(n / 2);
  const back = n - front;
  if (front + back !== n) fail(`F+B ${front}+${back} !== N ${n}`);
  if (Math.abs(front - back) > 1) fail(`|F−B|=${Math.abs(front - back)} > 1 (N=${n})`);
  const bedOfId = new Map();
  seq.forEach((id, i) => bedOfId.set(id, i < front ? "F" : "B"));
  const fCols = knitOrderCols.filter((_, i) => i < front);
  const bCols = knitOrderCols.filter((_, i) => i >= front);
  return {
    N: n,
    front,
    back,
    knitOrderCols,
    columnOrderCols,
    chronoCols,
    ordersAgree: knitOrderCols.join(",") === columnOrderCols.join(","),
    fCols,
    bCols,
    bedOfId,
    cellIds,
    liveCols: columnOrderCols,
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
    ["第一圈按整圈挂针数 N 分床", `N=${ring.N}，沿环路前 ${ring.front} 枚 F，后 ${ring.back} 枚 B`],
    ["later rows", "path 1 onward stays step3, unchanged"],
    ["F… / B…", "bed follows the stitch through X+ column changes"],
    ["→R1 / ←L1", "F advance = knit direction (right-knit →R); B mirrored"],
    ["excluded", "no balance Flip and no end-of-ring home Flip"],
    ["rows", "121 display rows, needles −5…36, stitch_map_bind.json unchanged"],
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
  const rows = step3.rows.map((row, i) => {
    if (i >= span.rowEnd) {
      return {
        dir: row.dir,
        cells: row.cells.map((c) => ({ col: c.col, token: c.token, fill: c.fill })),
      };
    }
    const ids = ring.cellIds.get(i);
    if (!ids) fail(`ring 0 row ${i} has no stitch identities`);
    return {
      dir: row.dir,
      cells: row.cells.map((c) => {
        if (!c.token) return { col: c.col, token: "", fill: c.fill || "rgb(192,192,192)" };
        const id = ids.get(c.col);
        if (id == null) fail(`row ${i} col ${c.col} has no stitch identity`);
        const bed = ring.bedOfId.get(id);
        if (bed !== "F" && bed !== "B") fail(`row ${i} col ${c.col} stitch ${id} has no bed`);
        const painted = paintToken(c, toAbsoluteToken(c.token, bed));
        return { col: c.col, token: painted.token, fill: painted.fill };
      }),
    };
  });
  if (rows.length !== 121) fail(`output rows ${rows.length} != 121`);
  if (rows.some((r) => r.dir === "Flip")) fail("output contains a Flip row");
  for (let i = 0; i < span.rowEnd; i++) {
    assertAlignedRow(rows[i], step3.rows[i], i);
    for (const cell of occupied(rows[i])) {
      if (bedOf(cell.token) === "other") fail(`row ${i} col ${cell.col} token ${cell.token} has no F/B`);
    }
  }
  for (let i = span.rowEnd; i < rows.length; i++) {
    if (rows[i].dir !== step3.rows[i].dir) fail(`row ${i} dir drifted from step3`);
    const a = occupied(rows[i]);
    const b = occupied(step3.rows[i]);
    if (a.map((c) => `${c.col}:${c.token}`).join("|") !== b.map((c) => `${c.col}:${c.token}`).join("|")) {
      fail(`row ${i} is not an unchanged step3 row`);
    }
  }
  const fSet = new Set(ring.fCols);
  const bSet = new Set(ring.bCols);
  if (fSet.size + bSet.size !== ring.N) fail(`F/B columns are not a partition of N (${fSet.size}+${bSet.size}!=${ring.N})`);

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
    summary: summarizeRing0(rows.slice(0, span.rowEnd)),
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
  console.log(
    `build-step4-ring0 ${check ? "check " : ""}ok: ring0 [0, ${span.rowEnd}) face ${span.ring1Face} starts path 1; N=${ring.N} F=${ring.front} B=${ring.back}; ordersAgree=${ring.ordersAgree}; rows ${built.rows.length}`,
  );
  console.log(`  knit-order cols: ${ring.knitOrderCols.join(",")}`);
  console.log(`  column-order cols: ${ring.columnOrderCols.join(",")}`);
  console.log(`  F cols: ${ring.fCols.join(",")}`);
  console.log(`  B cols: ${ring.bCols.join(",")}`);
  for (const row of built.summary) {
    console.log(
      `  row ${row.display_row} ${row.dir} n=${row.n} F=${row.F} [${row.fCols.join(",")}] B=${row.B} [${row.bCols.join(",")}]`,
    );
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
