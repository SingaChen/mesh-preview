/**
 * Build iteration_0_cut_readable_map_step4_ring0.xls
 *
 * Ring 0 (path 0) display rows — up to, but not including, the first knit
 * cell of path 1 — are copied from the Step4 beds workbook (F/B text + XF
 * color). Every later row is copied from the Step3 workbook. Flip rows are
 * never copied. A Flip that sits strictly between two ring-0 content rows
 * is a bed-balance Flip: the script stops. The Flip/home that only sits
 * after the last ring-0 row (preparing the next ring) is left out.
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
  step4Xls: join(cylDir, "iteration_0_cut_readable_map_step4_beds.xls"),
  bind: join(cylDir, "stitch_map_bind.json"),
  outXls: join(cylDir, "iteration_0_cut_readable_map_step4_ring0.xls"),
};

function fail(msg) {
  throw new Error(`build-step4-ring0: ${msg}`);
}

export class BalancedFlipError extends Error {
  constructor(detail) {
    super(`build-step4-ring0: ring 0 contains a balanced Flip (stopping, no output).\n${detail}`);
    this.name = "BalancedFlipError";
  }
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
 * Step4 absolute arrow → step3 relative arrow.
 * Front keeps the arrow and drops L/R. Back bed is mirrored
 * (step4 legend: back advance/retreat is opposite the front).
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
 * Pair each step3 row with the step4 row left after dropping Flip rows.
 * Returns internal (balanced) flips that fall inside ring 0, and the
 * boundary flips that sit after ring 0 and before the next ring.
 */
export function alignStep4(step3Rows, step4Rows, rowEnd) {
  const aligned = [];
  const flips = [];
  let j = 0;
  for (let i = 0; i < step3Rows.length; i++) {
    while (j < step4Rows.length && step4Rows[j].dir === "Flip") {
      flips.push({ step4: j, beforeStep3: i, row: step4Rows[j] });
      j += 1;
    }
    if (j >= step4Rows.length) fail(`step4 ended at step3 row ${i}`);
    if (i < rowEnd) assertAlignedRow(step4Rows[j], step3Rows[i], i);
    aligned.push({ step3: i, step4: j });
    j += 1;
  }
  const ring = aligned.filter((a) => a.step3 < rowEnd);
  if (!ring.length) fail("ring 0 aligned no step4 rows");
  const first = ring[0].step4;
  const last = ring[ring.length - 1].step4;
  const next = aligned.find((a) => a.step3 >= rowEnd);
  const internal = flips.filter((f) => f.step4 > first && f.step4 < last);
  const boundary = flips.filter((f) => f.step4 > last && (!next || f.step4 < next.step4));
  return { aligned, flips, internal, boundary, trailing: step4Rows.slice(j) };
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
    for (const cell of occ) counts[bedOf(cell.token)] += 1;
    return {
      display_row: i,
      dir: row.dir,
      n: occ.length,
      F: counts.F,
      B: counts.B,
      other: counts.other,
      cols: occ.length ? [occ[0].col, occ[occ.length - 1].col] : [],
    };
  });
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

const LEGEND = [
  ["step4-ring0", "只有第一圈（ring 0 / path 0）分了前后床 F/B"],
  ["later rows", "display rows from path 1 onward are step3, unchanged"],
  ["F… / B…", "bed prefix on ring 0 only; opening is left-half F / right-half B"],
  ["→R1 / ←L1", "ring 0 absolute transfer; later rows keep step3 →1 / ←1"],
  ["excluded", "end-of-ring Flip / home X is not copied; it prepares the next ring"],
  ["rows", "121 display rows, needles −5…36, stitch_map_bind.json unchanged"],
];

function legendSheet(xfIndexForFill) {
  const parts = [bof(0x0010)];
  const xf = xfIndexForFill("rgb(255,255,255)");
  LEGEND.forEach((pair, i) => {
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

export function buildRing0Workbook(step3, step4, bind) {
  if (step3.needles.join(",") !== step4.needles.join(",")) {
    fail(`needle columns differ step3=${step3.needles[0]}…${step3.needles.at(-1)} step4=${step4.needles[0]}…${step4.needles.at(-1)}`);
  }
  if (step3.needles[0] !== -5 || step3.needles.at(-1) !== 36 || step3.needles.length !== 42) {
    fail(`expected needles −5…36 (42), got ${step3.needles[0]}…${step3.needles.at(-1)} (${step3.needles.length})`);
  }
  const span = ring0DisplayEnd(bind);
  if (span.rowEnd > step3.rows.length) fail(`ring 0 end ${span.rowEnd} past step3`);
  for (let i = 0; i < span.rowEnd; i++) {
    const dir = step3.rows[i].dir;
    if (dir !== "R" && dir !== "L" && dir !== "X" && dir !== "X+") {
      fail(`unexpected step3 dir ${dir} inside ring 0 row ${i}`);
    }
    if (dir === "R" || dir === "L") {
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
  }
  const aligned = alignStep4(step3.rows, step4.rows, span.rowEnd);
  if (aligned.internal.length) {
    const lines = aligned.internal.map((f) => {
      const cols = occupied(f.row).map((c) => c.col);
      return `  step4 display ${f.step4} (before step3 ${f.beforeStep3}) dir=Flip cols ${cols[0]}…${cols.at(-1)} (${cols.length} cells) tokens ${occupied(f.row).map((c) => c.token).join(" ")}`;
    });
    throw new BalancedFlipError(
      `Ring 0 is step3 display rows [0, ${span.rowEnd}) (path 0 faces ${span.path0First}…${span.path0Last}; path 1 face ${span.ring1Face} starts at display_row ${span.rowEnd}).\n` +
        `These Flip rows sit between ring 0 content rows, so they rebalance F/B inside the ring rather than parking the end of the ring:\n${lines.join("\n")}`,
    );
  }
  const rows = step3.rows.map((row, i) => {
    if (i < span.rowEnd) {
      const src = step4.rows[aligned.aligned[i].step4];
      return {
        dir: src.dir,
        cells: src.cells.map((c) => ({ col: c.col, token: c.token, fill: c.fill })),
      };
    }
    return {
      dir: row.dir,
      cells: row.cells.map((c) => ({ col: c.col, token: c.token, fill: c.fill })),
    };
  });
  if (rows.length !== step3.rows.length) fail(`output rows ${rows.length} != step3 ${step3.rows.length}`);
  if (rows.some((r) => r.dir === "Flip")) fail("output still contains a Flip row");

  const fills = new Set(["rgb(255,255,255)", "rgb(192,192,192)"]);
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
  const legend = legendSheet(xfIndexForFill);
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
    summary: summarizeRing0(rows.slice(0, span.rowEnd)),
    boundary: aligned.boundary.map((f) => ({
      step4: f.step4,
      cols: occupied(f.row).map((c) => c.col),
    })),
    trailing: aligned.trailing.map((r) => r.dir),
  };
}

export function loadInputs(paths = DEFAULT_PATHS) {
  return {
    step3: loadSheet(paths.step3Xls, "step3"),
    step4: loadSheet(paths.step4Xls, "step4"),
    bind: JSON.parse(readFileSync(paths.bind, "utf8")),
  };
}

export function buildFromFiles(paths = DEFAULT_PATHS) {
  const { step3, step4, bind } = loadInputs(paths);
  return buildRing0Workbook(step3, step4, bind);
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
  const open = built.summary.find((r) => r.dir === "R" || r.dir === "L");
  console.log(
    `build-step4-ring0 ${check ? "check " : ""}ok: ring0 [0, ${built.span.rowEnd}) face ${built.span.ring1Face} starts path 1; opening N=${open?.n} F=${open?.F} B=${open?.B}; rows ${built.rows.length}; boundary flips ${built.boundary.map((b) => b.step4).join(",") || "none"}`,
  );
  for (const row of built.summary) {
    console.log(`  row ${row.display_row} ${row.dir} n=${row.n} F=${row.F} B=${row.B} other=${row.other} cols ${row.cols.join("…")}`);
  }
  return built;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(err instanceof BalancedFlipError ? 2 : 1);
  }
}
