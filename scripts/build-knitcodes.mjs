/**
 * Build knitting-code tables from the live bed reports.
 *
 * Body rows walk each bed.txt in knitting order. One bed is one visual row.
 * X / X+ / Flip rows, transfers, flips, and whole-bed racks are omitted.
 * `node scripts/build-knitcodes.mjs --bunny` is the Official Bunny exception:
 * it draws that bed's Flip rows and still omits every transfer row.
 * 11/12 mark only the first stitch of the first visual row after a ccw↔cw
 * turn. The opening is the locked width adapter (W = the first body row's
 * needle count), left-aligned on needle 0. Body color 13 sits tight against
 * that row's knitted span. Standrad Cylinder is not rewritten.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bedKnitTokens, parseExcelReadableMap } from "../src/excel-map.js";
import { bindKnitCodeStitches, parseKnitCode } from "../src/knit-code.js";
import { parseFacesRingLayout } from "../src/stitches.js";

const root = join(import.meta.dirname, "..");
const sampleDir = join(root, "public/sample");
const TOKEN_RE = /(?:[FB][^\s@]*@[FB]-?\d+|⬆@[FB]-?\d+|⬇@[FB]-?\d+)/g;
const LEFT_PAD = 2;
const RIGHT_PAD = 6;

const MODELS = [
  { model: "Dense Standrad Cylinder", dir: "dense-standrad", prefix: "dense_standrad_cylinder", sheet: "dense-standrad-cylinder.json" },
  { model: "Decrease Cylinder", dir: "decrease", prefix: "decrease_cylinder", sheet: "decrease-cylinder.json", draft: true },
  { model: "Increase Cylinder", dir: "increase", prefix: "increase_cylinder", sheet: "increase-cylinder.json" },
  { model: "Thin Cylinder", dir: "thin", prefix: "thin_cylinder", sheet: "thin-cylinder.json" },
  { model: "Fat Cylinder", dir: "fat", prefix: "fat_cylinder", sheet: "fat-cylinder.json" },
  { model: "Dense Increase Cylinder", dir: "dense-increase", prefix: "dense_increase_cylinder", sheet: "dense-increase-cylinder.json" },
  { model: "Dense Thin Cylinder", dir: "dense-thin", prefix: "dense_thin_cylinder", sheet: "dense-thin-cylinder.json" },
  { model: "Dense Fat Cylinder", dir: "dense-fat", prefix: "dense_fat_cylinder", sheet: "dense-fat-cylinder.json" },
  { model: "Dense Decrease Cylinder", dir: "dense-decrease", prefix: "dense_decrease_cylinder", sheet: "dense-decrease-cylinder.json" },
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function isOperation(glyph, dir) {
  if (dir === "X" || dir === "X+" || dir === "Flip") return true;
  if (glyph === "⬆" || glyph === "⬇" || glyph.includes("↔")) return true;
  if (/^[←→]/.test(glyph) || /^[FB][←→]/.test(glyph)) return true;
  return false;
}

function parseBedTxt(text) {
  const courses = [];
  const rows = [];
  const ringLine = text.match(/(\d+)\s*环都在这一张表上/);
  const stopped = text.split("\n").find((line) => /未完成|generation stopped|只画到/.test(line)) || null;
  for (const line of text.split("\n")) {
    const course = line.match(/^  course (\d+) ([RL])  start (\S+)  end (\S+)  （(\d+) 针）/);
    if (course) {
      courses.push({
        course: Number(course[1]),
        dir: course[2],
        start: course[3],
        end: course[4],
        n: Number(course[5]),
      });
      continue;
    }
    const head = line.match(/^  row (\d+) (\S+)  /);
    if (head) {
      rows.push({ row: Number(head[1]), dir: head[2], tokens: [] });
      continue;
    }
    if (!rows.length) continue;
    const found = line.match(TOKEN_RE);
    if (!found || !line.trim().startsWith(found[0])) continue;
    const cur = rows[rows.length - 1];
    for (const raw of found) {
      const [glyph, loc] = raw.split("@");
      const at = loc.match(/^([FB])(-?\d+)$/);
      if (!at) throw new Error(`bad token ${raw}`);
      cur.tokens.push({
        raw,
        glyph,
        bed: at[1],
        phys: Number(at[2]),
        op: isOperation(glyph, cur.dir),
      });
    }
  }
  if (!courses.length) throw new Error("bed report has no courses");
  let ci = 0;
  let left = courses[0].n;
  for (const row of rows) {
    if (row.dir !== "R" && row.dir !== "L") continue;
    if (!courses[ci]) throw new Error(`row ${row.row} has no course left`);
    if (row.dir !== courses[ci].dir) {
      throw new Error(`row ${row.row} ${row.dir} is not course ${courses[ci].course} ${courses[ci].dir}`);
    }
    row.course = courses[ci].course;
    const knits = row.tokens.filter((token) => !token.op);
    left -= knits.length;
    if (left < 0) throw new Error(`row ${row.row} overshoots course ${courses[ci].course}`);
    if (left === 0) {
      ci += 1;
      left = courses[ci]?.n ?? 0;
    }
  }
  if (ci !== courses.length) throw new Error(`consumed ${ci} of ${courses.length} courses`);
  return {
    courses,
    rows,
    statedRings: ringLine ? Number(ringLine[1]) : null,
    stopped: stopped ? stopped.trim() : null,
  };
}

function visualRows(bed) {
  const visual = [];
  let prev = null;
  for (const row of bed.rows) {
    if (row.dir !== "R" && row.dir !== "L") continue;
    const knits = row.tokens.filter((token) => !token.op);
    if (!knits.length) continue;
    const winding = row.dir === "R" ? "ccw" : "cw";
    const runs = [];
    for (const token of knits) {
      const last = runs[runs.length - 1];
      if (!last || last.bed !== token.bed) runs.push({ bed: token.bed, tokens: [token] });
      else last.tokens.push(token);
    }
    const reversed = (prev === "ccw" && winding === "cw") || (prev === "cw" && winding === "ccw");
    runs.forEach((run, index) => {
      const turn = reversed && index === 0;
      visual.push({
        bedRow: row.row,
        course: row.course,
        dir: row.dir,
        winding,
        bed: run.bed,
        turn,
        tokens: run.tokens.map((token, tokenIndex) => ({
          ...token,
          code: run.bed === "F" ? (turn && tokenIndex === 0 ? 11 : 1) : turn && tokenIndex === 0 ? 12 : 2,
        })),
      });
    });
    prev = winding;
  }
  return visual;
}

function geometry(W) {
  const C = LEFT_PAD + 1 + W + 1 + RIGHT_PAD;
  const leftFrame = LEFT_PAD;
  const work0 = leftFrame + 1;
  const work1 = work0 + W - 1;
  const rightFrame = work1 + 1;
  if (rightFrame + RIGHT_PAD + 1 !== C) throw new Error("opening geometry");
  return { C, left_frame: leftFrame, work0, work1, right_frame: rightFrame };
}

function tile(motif, n) {
  if (n <= 0) return [];
  const times = Math.ceil(n / motif.length);
  return Array.from({ length: times }, () => motif).flat().slice(0, n);
}

function putFrames(row, left, right) {
  if (left >= 0 && left < row.length) row[left] = 13;
  if (right >= 0 && right < row.length) row[right] = 13;
}

function placeInner(row, start, values, leftFrame, rightFrame) {
  putFrames(row, leftFrame, rightFrame);
  values.forEach((value, index) => {
    const x = start + index;
    if (x >= 0 && x < row.length) row[x] = value == null ? 0 : value;
  });
}

/** Locked opening adapter. Rails and windings are copied, not produced here. */
function buildOpeningMatrix(W) {
  const g = geometry(W);
  const { C, left_frame: lf, right_frame: rf, work0: w0 } = g;
  const rows = [];
  const blank = () => Array(C).fill(0);
  const add = (kind, matrix) => rows.push({ kind, matrix });
  function fillWork(val, kind, { holeAt = null, lastForce = undefined, firstForce = undefined } = {}) {
    const row = blank();
    putFrames(row, lf, rf);
    const inner = Array.isArray(val) ? tile(val, W) : Array(W).fill(val);
    if (holeAt != null && holeAt >= 0 && holeAt < W) inner[holeAt] = 0;
    if (lastForce !== undefined) inner[inner.length - 1] = lastForce;
    if (firstForce !== undefined) inner[0] = firstForce;
    inner.forEach((value, index) => {
      row[w0 + index] = value == null ? 0 : value;
    });
    add(kind, row);
  }
  {
    const row = blank();
    placeInner(row, w0 + 1, tile([1, null, 2, null, 3, null, 4, null], W - 1), lf + 1, rf);
    add("row1_8cycle", row);
  }
  {
    const row = blank();
    placeInner(row, w0 + 1, tile([1, null, 2, null, 1, null, 2, null], W - 1), lf + 1, rf);
    add("row2_8cycle", row);
  }
  {
    const row = blank();
    const a = rf - 1;
    const b = rf + 2;
    putFrames(row, a, b);
    if (a + 1 >= 0 && a + 1 < C) row[a + 1] = 16;
    if (a + 2 >= 0 && a + 2 < C && a + 2 !== b) row[a + 2] = 16;
    add("row3_right16", row);
  }
  fillWork(16, "all16");
  fillWork(2, "all2");
  fillWork(1, "all1_hole", { holeAt: W - 2 });
  fillWork(2, "all2");
  fillWork(1, "all1");
  fillWork([2, null], "two_dot_end2", { lastForce: 2 });
  fillWork([null, 1], "dot_one_start1", { firstForce: 1 });
  {
    const row = blank();
    for (let x = lf + 3; x < rf - 1; x += 2) if (x >= 0 && x < C) row[x] = 6;
    add("op_6", row);
  }
  {
    const row = blank();
    for (let x = lf + 2; x < rf - 2; x += 2) if (x >= 0 && x < C) row[x] = 8;
    add("op_8", row);
  }
  const edge513 = () => {
    const row = blank();
    const inner = tile([51, null], W - 1);
    inner[inner.length - 1] = 3;
    placeInner(row, w0 + 1, inner, lf + 1, rf);
    add("edge_51_3", row);
  };
  const edge352 = () => {
    const row = blank();
    const inner = tile([52, null], W);
    inner[0] = 3;
    placeInner(row, w0, inner, lf, rf);
    add("edge_3_52", row);
  };
  edge513();
  edge352();
  edge513();
  edge352();
  fillWork(16, "all16");
  fillWork(2, "all2");
  fillWork(1, "all1");
  fillWork([116, 2], "cycle_116_2");
  fillWork([1, 117], "cycle_1_117");
  fillWork([51, null], "cycle_51_dot");
  fillWork([null, 52], "cycle_dot_52");
  fillWork([116, 2], "cycle_116_2");
  fillWork([1, 117], "cycle_1_117");
  const block16 = (left, right, kind) => {
    const row = blank();
    putFrames(row, left, right);
    for (let x = left + 1; x < right; x += 1) if (x >= 0 && x < C) row[x] = 16;
    add(kind, row);
  };
  block16(lf, lf + 2, "left_selvedge16");
  block16(lf, lf + 2, "left_selvedge16");
  block16(rf - 2, rf, "right_selvedge16");
  block16(rf - 2, C - 1, "right_extend16");
  block16(rf - 2, rf, "right_selvedge16");
  block16(rf - 2, C - 1, "right_extend16");
  block16(0, 4, "left_canvas16");
  block16(rf - 2, C - 1, "right_extend16");
  block16(0, 4, "left_canvas16");
  if (rows.length !== 34) throw new Error(`opening produced ${rows.length} rows`);
  return { rows, geometry: g };
}

function ringOf(face, counts) {
  let acc = 0;
  for (let index = 0; index < counts.length; index += 1) {
    if (face < acc + counts[index]) return index;
    acc += counts[index];
  }
  return null;
}

function labelFor(row, ring) {
  const tokens = row.tokens;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const span = tokens.length === 1 ? `${row.bed}${first.phys}` : `${row.bed}${first.phys}→${row.bed}${last.phys}`;
  const bedName = row.bed === "F" ? "前床" : "后床";
  const toRight = row.winding === "ccw" ? row.bed === "F" : row.bed === "B";
  const windText = `${row.winding === "ccw" ? "逆时针" : "顺时针"}${toRight ? "向右" : "向左"}`;
  return `第${ring}环 ${bedName}  ${span}（床图 row ${row.bedRow} / course ${row.course} ${row.dir}，${windText}）`;
}

function compact(row) {
  return row.map((code) => (code === 0 ? "." : String(code))).join(" ");
}

function garmentSlice(row, needle0Col, minP, maxP) {
  const out = [];
  for (let phys = minP; phys <= maxP; phys += 1) out.push(row[needle0Col + phys]);
  return out;
}

const TIFFANY = {
  0: "#000000",
  1: "#FF0000",
  2: "#00FF00",
  3: "#FFFF00",
  4: "#0000FF",
  5: "#FF00FF",
  6: "#00FFFF",
  7: "#FFFFFF",
  8: "#4A8999",
  9: "#6C2490",
  10: "#B4B4D8",
  11: "#FF67BD",
  12: "#906CB4",
  13: "#999999",
  14: "#CF90C0",
  15: "#8080FF",
  16: "#51FFDE",
  17: "#5291DB",
  18: "#007C91",
  19: "#EBEB24",
  20: "#B276B2",
  22: "#FC9463",
  31: "#90D848",
  33: "#A77F01",
  37: "#FF00A0",
  39: "#ACACEB",
  41: "#D84890",
  44: "#D8B4D8",
  51: "#FF9090",
  52: "#C0FF90",
  73: "#B7BCBC",
  81: "#47869C",
  82: "#6DA5B4",
  99: "#7F0000",
  104: "#B2B273",
  105: "#7F7F00",
  107: "#B46C6C",
  116: "#A9E5E7",
  117: "#D8D8B4",
  120: "#90D8FC",
};

function rulesFor(spec, info) {
  const plain = info.turns === 0;
  const rowTurn = plain
    ? "本表主体每一行都是 ccw，没有短行折返。前后床分成两行只是视觉换行，不是掉头，所以主体没有 11 或 12。调色板仍保留 11（前床 #FF67BD）和 12（后床 #906CB4）：它们只标短行折返后、新绕向第一行沿行进方向的第一个非空格。开头行不含 11/12。"
    : "11 和 12 只标短行折返后的第一针。短行折返是 row_winding 在 ccw 与 cw 之间反向（床图 R ↔ L），不从颜色推断绕向。前后床换行仍各画一行，但绕向相同，不是折返。反向之后，只改新绕向第一行沿该行行进方向的第一个非空格：前床 1→11，后床 2→12；空位 0 跳过。同一折返课后面的行，以及下一环沿同一绕向继续的行，仍是 1 或 2。逆时针前床向右、后床向左；顺时针相反。";
  const rules = {
    start: "F0 front left",
    front_direction: "a front-bed knit is one knitting-code row; counterclockwise front goes right, clockwise front goes left",
    back_direction: "switching beds starts a new knitting-code row; counterclockwise back goes left, clockwise back goes right",
    codes: {
      front_plain: 1,
      front_turn: 11,
      back_plain: 2,
      back_turn: 12,
      empty: 0,
      frame: 13,
    },
    colors_tiffany_display: TIFFANY,
    row_turn: rowTurn,
    palette_source: "SingaLab single-knitting-compiler dependence/datfile.py getDefaultPalette, displayed with func_tiffany.py byte-swap",
    source_bed: `${spec.sourceBed || `${spec.dir}/${spec.prefix}_bed.txt`} sha256 ${info.bedSha}`,
    operations_omitted: "移针、翻针、整床移位（床图 X / Flip 行）整行省略，不插入全 0 占位行；若去掉操作后该编织码行为空则丢弃",
    knit_frames: "每一编织行的 13 紧贴该行实际编织格子的左右两端，不留空档，也不另画外侧第二道 13。色 13 不绑定。开头行的 13 保持适配器原样，主体不回填开头指示。",
    winding: "床图 R → ccw（前床向右、后床向左）；床图 L → cw（前床向左、后床向右）。同一床图行拆成前、后两行时，两行继承该行绕向",
    display: "matrix 按编织时间顺序，index 0 为最先织的一行；彩色表视觉上自下而上（最先织的一行在底部）；物理针号小的在左。空针（代号 0）不是织针也不是操作行，没有方向",
    status: spec.experiment
      ? "由实验床图按编织顺序画出，未生成 .dat / .k"
      : spec.draft
        ? "矫正稿，已接入预览供矫正，未生成 .dat / .k"
        : "由当前床图按编织顺序画出，未生成 .dat / .k",
  };
  if (!plain) {
    rules.short_row_turns =
      "短行折返（床图绕向 R↔L，对应 row_winding 的 ccw↔cw）之后，只把新绕向第一行沿行进方向的第一个非空格标成 11（前床）或 12（后床）。不是这一格的短行织针，包括同行其余织针、同一绕向的前后床换行，仍是普通平针 1 或 2。11 与 12 是 DAT 已有代号。";
    rules.decreases =
      "减针格（如 F-R1 / B-R1 / B-L1 及其后的 F· / B·）仍是织针，按所在床普通平针 1 或 2 绘制。只有当减针格恰好是短行折返后新绕向第一行的第一个非空格时，才改为 11 或 12。其后的移针/翻针不画。";
  }
  if (info.stopped) rules.bed_stop = info.stopped;
  if (spec.draft) {
    rules.short_row_turns =
      "短行折返（F^R / F^L / B^R / B^L，对应 row_winding 的 ccw↔cw）之后，只把新绕向第一行沿行进方向的第一个非空格标成 11（前床）或 12（后床）。不是这一格的短行织针，包括同行的 Fv / Bv、同一绕向的前后床换行，以及未再反向的课中拆行，仍是普通平针 1 或 2。11 与 12 是 DAT 已有代号。矫正稿，未生成 .dat / .k。";
  }
  return rules;
}

function sourcePaths(spec) {
  if (spec.experiment) {
    const dir = join(root, "experiments", spec.dirName);
    return {
      bedPath: join(dir, "exp-readable-map.txt"),
      xlsPath: join(dir, "exp-readable-map.xls"),
      layoutPath: join(root, spec.layoutRel),
    };
  }
  return {
    bedPath: join(sampleDir, spec.dir, `${spec.prefix}_bed.txt`),
    xlsPath: join(sampleDir, spec.dir, `${spec.prefix}_bed.xls`),
    layoutPath: join(sampleDir, spec.dir, `${spec.prefix}_faces_ring_layout.json`),
  };
}

function buildModel(spec, standradOpening) {
  const paths = sourcePaths(spec);
  const bedText = readFileSync(paths.bedPath, "utf8");
  const bed = parseBedTxt(bedText);
  const visual = visualRows(bed);
  if (!visual.length) throw new Error(`${spec.model} has no knit rows`);
  const W = visual[0].tokens.length;
  const firstPhys = visual[0].tokens.map((token) => token.phys);
  if (firstPhys.some((phys, index) => phys !== index)) {
    throw new Error(`${spec.model} first row is not needles 0..${W - 1}: ${firstPhys.join(",")}`);
  }
  const phys = visual.flatMap((row) => row.tokens.map((token) => token.phys));
  const minP = Math.min(0, ...phys);
  const maxP = Math.max(0, ...phys);
  const needle0Col = Math.max(3, 1 - minP);
  const origin = needle0Col - 3;
  const canvas = Math.max(origin + (W + 10), needle0Col + maxP + 2);
  const opening = buildOpeningMatrix(W);
  const xls = parseExcelReadableMap(readFileSync(paths.xlsPath));
  if (xls.rows.length !== bed.rows.length) {
    throw new Error(`${spec.model} xls rows ${xls.rows.length} != txt rows ${bed.rows.length}`);
  }
  const byCell = new Map();
  for (const sheetRow of xls.rows) {
    for (const cell of sheetRow.cells) {
      if (!cell.token || (cell.bed !== "F" && cell.bed !== "B") || !Number.isInteger(cell.phys)) continue;
      const key = `${cell.row},${cell.bed},${cell.phys}`;
      if (byCell.has(key)) throw new Error(`${spec.model} duplicate bed cell ${key}`);
      byCell.set(key, cell);
    }
  }
  const layout = parseFacesRingLayout(readFileSync(paths.layoutPath, "utf8"));
  const labels = [];
  const ringsUsed = new Set();
  for (const row of visual) {
    const rings = new Set();
    for (const token of row.tokens) {
      const cell = byCell.get(`${row.bedRow},${token.bed},${token.phys}`);
      if (!cell || !Number.isInteger(cell.faceIndex)) throw new Error(`${spec.model} row ${row.bedRow} ${token.bed}${token.phys} has no face`);
      const ring = ringOf(cell.faceIndex, layout.termCounts);
      if (ring == null) throw new Error(`${spec.model} face ${cell.faceIndex} is outside term_counts`);
      rings.add(ring);
    }
    if (rings.size !== 1) throw new Error(`${spec.model} row ${row.bedRow} spans rings ${[...rings].join(",")}`);
    const ring = [...rings][0];
    ringsUsed.add(ring);
    labels.push(labelFor(row, ring + 1));
  }
  if (bed.statedRings != null && bed.statedRings !== layout.termCounts.length) {
    throw new Error(`${spec.model} bed says ${bed.statedRings} rings, layout has ${layout.termCounts.length}`);
  }
  const roles = [];
  const needles = [];
  for (let col = 0; col < canvas; col += 1) {
    const p = col - needle0Col;
    if (p >= minP && p <= maxP) {
      roles.push(p);
      needles.push(p);
    } else if (col === origin + 2 || col === origin + 3 + W) roles.push("frame");
    else roles.push("pad");
  }
  const matrix = [];
  const rowLabels = [];
  const windings = [];
  const binds = [];
  const bedRows = [];
  const rails = [];
  opening.rows.forEach((row, index) => {
    const placed = Array(canvas).fill(0);
    row.matrix.forEach((code, col) => {
      placed[origin + col] = code;
    });
    matrix.push(placed);
    rowLabels.push(`开头 ${index + 1}`);
    windings.push(standradOpening.row_winding[index]);
    binds.push(false);
    bedRows.push(null);
    rails.push(standradOpening.function_rails[index]);
  });
  const bodyMatrix = [];
  visual.forEach((row, index) => {
    const line = Array(canvas).fill(0);
    row.tokens.forEach((token) => {
      line[needle0Col + token.phys] = token.code;
    });
    const knitCols = [];
    line.forEach((code, col) => {
      if (code === 1 || code === 2 || code === 11 || code === 12) knitCols.push(col);
    });
    const lo = knitCols[0];
    const hi = knitCols[knitCols.length - 1];
    if (line[lo - 1] !== 0 || line[hi + 1] !== 0) {
      throw new Error(`${spec.model} body row ${index} has no empty cell for a tight 13`);
    }
    line[lo - 1] = 13;
    line[hi + 1] = 13;
    matrix.push(line);
    bodyMatrix.push(line);
    rowLabels.push(labels[index]);
    windings.push(row.winding);
    binds.push(true);
    bedRows.push(row.bedRow);
    rails.push(null);
  });
  const turns11 = visual.reduce((sum, row) => sum + row.tokens.filter((token) => token.code === 11).length, 0);
  const turns12 = visual.reduce((sum, row) => sum + row.tokens.filter((token) => token.code === 12).length, 0);
  const info = {
    bedSha: sha256(bedText),
    turns: turns11 + turns12,
    stopped: bed.stopped,
  };
  const rightFrame = origin + opening.geometry.right_frame;
  const doc = {
    model: spec.model,
    opening: {
      applied: true,
      n_opening_rows: 34,
      source_width: 10,
      target_width: W,
      opening_canvas: opening.geometry.C,
      placed_at_column: origin,
      needle0_column: needle0Col,
      geometry: opening.geometry,
      function_rails: "copied exactly from the unified opening template; not scaled",
      body_alignment: `garment needles ${minP}..${maxP} occupy columns ${needle0Col + minP}..${needle0Col + maxP}; needle 0 is column ${needle0Col}; opening frames stay on the W=${W} block (right frame column ${rightFrame}); later rows may pass that frame`,
      bind: "opening rows do not bind to the stitch mesh",
      kinds: opening.rows.map((row) => row.kind),
    },
    rules: rulesFor(spec, info),
    needles,
    column_roles: roles,
    n_rings: layout.termCounts.length,
    n_opening_rows: 34,
    n_body_rows: visual.length,
    n_rows: matrix.length,
    n_cols: canvas,
    row_labels: rowLabels,
    row_winding: windings,
    row_bind: binds,
    bed_row: bedRows,
    function_rails: rails,
    matrix,
  };
  const knit = parseKnitCode(doc);
  const bound = bindKnitCodeStitches(knit, xls, null, null);
  if (bound.unmatched.length || bound.knitCells !== bound.bedTokens || bound.byKey.size !== bound.knitCells) {
    throw new Error(
      `${spec.model} bind ${bound.byKey.size}/${bound.knitCells} tokens ${bound.bedTokens} unmatched ${JSON.stringify(bound.unmatched.slice(0, 6))}`,
    );
  }
  const xlsTokens = bedKnitTokens(xls).length;
  if (bound.bedTokens !== xlsTokens) throw new Error(`${spec.model} token count`);
  const seenRings = [...ringsUsed].sort((a, b) => a - b);
  const layoutRings = [...Array(layout.termCounts.length).keys()];
  const partial = Boolean(spec.partial || bed.stopped);
  if (partial) {
    if (seenRings.some((ring) => !layoutRings.includes(ring))) {
      throw new Error(`${spec.model} drew a ring outside the layout: ${seenRings.join(",")}`);
    }
    doc.n_rings = seenRings.length ? Math.max(...seenRings) + 1 : 0;
  } else if (seenRings.join(",") !== layoutRings.join(",")) {
    throw new Error(`${spec.model} rings drawn ${seenRings.join(",")} layout 0..${layout.termCounts.length - 1}`);
  }
  return {
    spec,
    doc,
    visual,
    bodyMatrix,
    W,
    minP,
    maxP,
    needle0Col,
    origin,
    canvas,
    rightFrame,
    bed,
    turns11,
    turns12,
    bound,
    layoutRings: layout.termCounts.length,
  };
}

function sameCodesIgnoring13(builtRow, needle0Col, oldRow) {
  if (!oldRow) return false;
  for (let phys = 0; phys < oldRow.length; phys += 1) {
    const code = builtRow[needle0Col + phys];
    const got = code === 13 ? 0 : code;
    if (got !== oldRow[phys]) return false;
  }
  return true;
}

function wireSheet(spec) {
  const path = join(sampleDir, spec.sheet);
  const text = readFileSync(path, "utf8");
  const rel = `${spec.dir}/${spec.prefix}_knitcode.json`;
  if (text.includes(`"knitCode"`)) {
    if (!text.includes(rel)) throw new Error(`${spec.sheet} knitCode is not ${rel}`);
    return;
  }
  const needle = `      "facesRingLayout": "${spec.dir}/${spec.prefix}_faces_ring_layout.json"`;
  if (!text.includes(needle)) throw new Error(`${spec.sheet} has no facesRingLayout line`);
  const next = text.replace(needle, `${needle},\n      "knitCode": "${rel}"`);
  writeFileSync(path, next);
}

function main() {
  const standrad = JSON.parse(readFileSync(join(sampleDir, "cylinder/standrad_cylinder_knitcode.json"), "utf8"));
  const check = buildOpeningMatrix(13);
  check.rows.forEach((row, index) => {
    if (row.matrix.join(",") !== standrad.matrix[index].join(",")) {
      throw new Error(`W=13 opening row ${index} ${row.kind} does not match Standrad`);
    }
  });
  if (standrad.function_rails.slice(0, 34).some((rails) => rails == null)) {
    throw new Error("Standrad opening rails are missing");
  }
  const reports = [];
  for (const spec of MODELS) {
    const priorPath = join(sampleDir, spec.dir, `${spec.prefix}_knitcode.json`);
    let prior = null;
    try {
      prior = JSON.parse(readFileSync(priorPath, "utf8"));
    } catch {
      prior = null;
    }
    const built = buildModel(spec, standrad);
    if (prior?.matrix && (spec.dir === "decrease" || spec.dir === "dense-standrad")) {
      if (prior.matrix.length !== built.visual.length) {
        throw new Error(`${spec.model} body rows ${built.visual.length} != locked ${prior.matrix.length}`);
      }
      built.bodyMatrix.forEach((row, index) => {
        if (!sameCodesIgnoring13(row, built.needle0Col, prior.matrix[index])) {
          throw new Error(`${spec.model} body row ${index} changed a locked knit code`);
        }
        if (built.visual[index].winding !== prior.row_winding[index]) {
          throw new Error(`${spec.model} winding ${index} changed`);
        }
      });
      if (spec.dir === "decrease") {
        built.visual.forEach((row, index) => {
          const label = built.doc.row_labels[34 + index];
          if (label !== prior.row_labels[index]) throw new Error(`Decrease label ${index}\n${label}\n${prior.row_labels[index]}`);
        });
      }
    }
    const text = `${JSON.stringify(built.doc, null, 2)}\n`;
    writeFileSync(priorPath, text);
    wireSheet(spec);
    const front = built.visual.find((row) => row.bed === "F");
    const back = built.visual.find((row) => row.bed === "B");
    const turn = built.visual.find((row) => row.turn);
    const wide = built.visual.find((row) => Math.max(...row.tokens.map((token) => token.phys)) >= built.W);
    const show = (row) => (row ? compact(built.bodyMatrix[built.visual.indexOf(row)]) : null);
    reports.push({
      model: spec.model,
      W: built.W,
      minNeedle: built.minP,
      maxNeedle: built.maxP,
      needle0Column: built.needle0Col,
      openingOrigin: built.origin,
      canvas: built.canvas,
      openingCanvas: built.W + 10,
      rightFrameColumn: built.rightFrame,
      openingRows: 34,
      bodyRows: built.visual.length,
      courses: built.bed.courses.length,
      lastCourse: built.bed.courses.at(-1),
      rings: built.layoutRings,
      stopped: built.bed.stopped,
      turn11: built.turns11,
      turn12: built.turns12,
      bindCells: built.bound.knitCells,
      hash: sha256(text.slice(text.indexOf('\n  "matrix": '))),
      front: show(front),
      back: show(back),
      short: show(turn),
      wide: show(wide),
    });
    console.log(
      `${spec.model}: W=${built.W} needles ${built.minP}..${built.maxP} canvas ${built.canvas} origin ${built.origin} body ${built.visual.length} bind ${built.bound.knitCells}`,
    );
  }
  writeFileSync("/tmp/knitcode-report.json", `${JSON.stringify(reports, null, 2)}\n`);
  console.log("wrote /tmp/knitcode-report.json");
}

const EXPERIMENT_SHEETS = [
  ["official-standrad-readable-row-schedule", "Standrad Cylinder 实验（新时序）", "standrad-exp-readable-row-schedule"],
  ["official-increase-readable-row-schedule", "Increase Cylinder 实验（新时序）", "increase-exp-readable-row-schedule"],
  ["official-decrease-readable-row-schedule", "Decrease Cylinder 实验（新时序）", "decrease-exp-readable-row-schedule"],
  ["official-thin-readable-row-schedule", "Thin Cylinder 实验（新时序）", "thin-exp-readable-row-schedule"],
  ["official-fat-readable-row-schedule", "Fat Cylinder 实验（新时序）", "fat-exp-readable-row-schedule"],
  ["official-dense-standrad-readable-row-schedule", "Dense Standrad Cylinder 实验（新时序）", "dense-standrad-exp-readable-row-schedule"],
  ["official-dense-increase-readable-row-schedule", "Dense Increase Cylinder 实验（新时序）", "dense-increase-exp-readable-row-schedule"],
  ["official-dense-decrease-readable-row-schedule", "Dense Decrease Cylinder 实验（新时序）", "dense-decrease-exp-readable-row-schedule"],
  ["official-dense-thin-readable-row-schedule", "Dense Thin Cylinder 实验（新时序）", "dense-thin-exp-readable-row-schedule"],
  ["official-dense-fat-readable-row-schedule", "Dense Fat Cylinder 实验（新时序）", "dense-fat-exp-readable-row-schedule"],
];

const SKIPPED_KNIT_SHEETS = [
  {
    sheetId: "bunny-exp-readable-row-schedule",
    reason: "Bunny 实验表不在这次范围内",
  },
  {
    id: "dense-bunny-4split",
    reason: "Dense Bunny 没有 faces_ring，也没有实验床图",
  },
  {
    id: "dense-bunny-le",
    reason: "Dense Bunny 没有 faces_ring，也没有实验床图",
  },
  {
    sheetId: "bunny-corridor-field-swallow",
    reason: "走廊抽列只有三维列线，没有床图，不生成编织码",
  },
];

function assertBodyCodes(spec, built) {
  const bodyCodes = new Set([0, 1, 2, 11, 12, 13]);
  built.bodyMatrix.forEach((row, index) => {
    for (const code of row) {
      if (!bodyCodes.has(code)) throw new Error(`${spec.model} body row ${index} has code ${code}`);
    }
    const live = [];
    row.forEach((code, col) => {
      if (code === 1 || code === 2 || code === 11 || code === 12) live.push(col);
    });
    if (!live.length) throw new Error(`${spec.model} body row ${index} has no knit`);
    if (row[live[0] - 1] !== 13 || row[live[live.length - 1] + 1] !== 13) {
      throw new Error(`${spec.model} body row ${index} 13 is not tight against the knit span`);
    }
  });
  built.visual.forEach((row, index) => {
    const turns = row.tokens.filter((token) => token.code === 11 || token.code === 12);
    if (row.turn) {
      if (turns.length !== 1 || row.tokens[0].code !== (row.bed === "F" ? 11 : 12)) {
        throw new Error(`${spec.model} turn row ${index} does not mark only its first stitch`);
      }
    } else if (turns.length) {
      throw new Error(`${spec.model} row ${index} has 11/12 without a winding reversal`);
    }
  });
  if (built.doc.n_opening_rows !== 34) throw new Error(`${spec.model} opening rows`);
  if (built.doc.function_rails.slice(34).some((rails) => rails != null)) {
    throw new Error(`${spec.model} copied opening rails onto a body row`);
  }
  if (built.doc.row_winding.slice(34).some((wind) => wind !== "ccw" && wind !== "cw")) {
    throw new Error(`${spec.model} body row has no travel direction`);
  }
}

function buildExperiments() {
  const standradPath = join(sampleDir, "cylinder/standrad_cylinder_knitcode.json");
  const standradBefore = readFileSync(standradPath);
  const standrad = JSON.parse(standradBefore.toString("utf8"));
  const check = buildOpeningMatrix(13);
  check.rows.forEach((row, index) => {
    if (row.matrix.join(",") !== standrad.matrix[index].join(",")) {
      throw new Error(`W=13 opening row ${index} ${row.kind} does not match Standrad`);
    }
  });
  const officialHashes = new Map();
  for (const spec of MODELS) {
    const path = join(sampleDir, spec.dir, `${spec.prefix}_knitcode.json`);
    officialHashes.set(path, sha256(readFileSync(path)));
  }
  officialHashes.set(standradPath, sha256(standradBefore));
  const reports = [];
  for (const [dirName, model, sheetId] of EXPERIMENT_SHEETS) {
    const schedulePath = join(root, "experiments", dirName, "exp-readable-map.json");
    const schedule = JSON.parse(readFileSync(schedulePath, "utf8"));
    const spec = {
      model,
      experiment: true,
      partial: Boolean(schedule.partialStop),
      sheetId,
      dirName,
      layoutRel: schedule.input.path,
      sourceBed: `experiments/${dirName}/exp-readable-map.txt`,
    };
    const built = buildModel(spec, standrad);
    assertBodyCodes(spec, built);
    const text = `${JSON.stringify(built.doc, null, 2)}\n`;
    writeFileSync(join(root, "experiments", dirName, "exp-knitcode.json"), text);
    reports.push({
      sheetId,
      added: true,
      partial: spec.partial,
      W: built.W,
      openingRows: built.doc.n_opening_rows,
      bodyRows: built.doc.n_body_rows,
      rows: built.doc.n_rows,
      rings: built.doc.n_rings,
      turn11: built.turns11,
      turn12: built.turns12,
      bindCells: built.bound.knitCells,
    });
    console.log(`${sheetId}: opening 34 + body ${built.doc.n_body_rows} = ${built.doc.n_rows} rows`);
  }
  for (const [path, hash] of officialHashes) {
    if (sha256(readFileSync(path)) !== hash) throw new Error(`official knit code changed: ${path}`);
  }
  if (sha256(readFileSync(standradPath)) !== sha256(standradBefore)) {
    throw new Error("Standrad knitting code changed");
  }
  const summary = { reports, skipped: SKIPPED_KNIT_SHEETS };
  writeFileSync("/tmp/exp-knitcode-report.json", `${JSON.stringify(summary, null, 2)}\n`);
  console.log("wrote /tmp/exp-knitcode-report.json");
}

function rowBlocks(text) {
  const blocks = new Map();
  for (const part of text.split(/\n(?=  row )/)) {
    const head = part.match(/^  row (\d+) (\S+)/);
    if (head) blocks.set(Number(head[1]), part);
  }
  return blocks;
}

/** ⬆@F is front→back (20). ⬇@B is back→front (30). The note has to say the same thing. */
function flipSpec(token, block) {
  const courseLine = block.split("\n").find((line) => /course \d+:/.test(line));
  if (!courseLine) throw new Error(`flip ${token.raw} has no course note`);
  const course = Number(courseLine.match(/course (\d+):/)[1]);
  const arrow = courseLine.match(/([FB])(\d+)→([FB])(\d+)/);
  if (!arrow) throw new Error(`flip note has no bed arrow: ${courseLine.trim()}`);
  const fromBed = arrow[1];
  const fromPhys = Number(arrow[2]);
  const toBed = arrow[3];
  const toPhys = Number(arrow[4]);
  if (fromPhys !== token.phys || toPhys !== token.phys) {
    throw new Error(`flip ${token.raw} note changes needle: ${courseLine.trim()}`);
  }
  if (token.glyph === "⬆" && token.bed === "F" && fromBed === "F" && toBed === "B") {
    return { code: 20, course, motion: `前床翻后床 F${token.phys}→B${token.phys}` };
  }
  if (token.glyph === "⬇" && token.bed === "B" && fromBed === "B" && toBed === "F") {
    return { code: 30, course, motion: `后床翻前床 B${token.phys}→F${token.phys}` };
  }
  throw new Error(`unrecognized flip ${token.raw} (${courseLine.trim()})`);
}

/**
 * Official Bunny only. Knit rows and the opening stay on the locked builder.
 * Flip rows are inserted in bed order. X / X+ transfer rows are left out.
 */
function buildBunny(standrad) {
  const bedPath = join(sampleDir, "cylinder/faces_ring0_step4_bed.txt");
  const xlsPath = join(sampleDir, "cylinder/faces_ring0_step4_bed.xls");
  const layoutPath = join(sampleDir, "cylinder/faces_ring_layout.json");
  const bedBytes = readFileSync(bedPath);
  const xlsBytes = readFileSync(xlsPath);
  if (sha256(bedBytes) !== "061985c9a5b659ff5b6064997741778a8b3249231c817231f4096f2b31034a6d") {
    throw new Error("official Bunny bed txt changed");
  }
  if (sha256(xlsBytes) !== "170e217b55d30ad35011d2b45c82e25a2f3fe38d9b7f2662324f1a2d85537335") {
    throw new Error("official Bunny bed xls changed");
  }
  const bedText = bedBytes.toString("utf8");
  const bed = parseBedTxt(bedText);
  if (bed.stopped) throw new Error(`official Bunny bed is unfinished: ${bed.stopped}`);
  const visual = visualRows(bed);
  if (!visual.length) throw new Error("Bunny has no knit rows");
  const xls = parseExcelReadableMap(xlsBytes);
  if (xls.rows.length !== bed.rows.length) {
    throw new Error(`Bunny xls rows ${xls.rows.length} != txt rows ${bed.rows.length}`);
  }
  for (let index = 0; index < bed.rows.length; index += 1) {
    if (bed.rows[index].row !== index) throw new Error(`bed row number ${bed.rows[index].row} is not ${index}`);
    if (xls.rows[index].dir !== bed.rows[index].dir) {
      throw new Error(`row ${index} xls ${xls.rows[index].dir} != txt ${bed.rows[index].dir}`);
    }
  }
  const byCell = new Map();
  for (const sheetRow of xls.rows) {
    for (const cell of sheetRow.cells) {
      if (!cell.token || (cell.bed !== "F" && cell.bed !== "B") || !Number.isInteger(cell.phys)) continue;
      const key = `${cell.row},${cell.bed},${cell.phys}`;
      if (byCell.has(key)) throw new Error(`Bunny duplicate bed cell ${key}`);
      byCell.set(key, cell);
    }
  }
  const layout = parseFacesRingLayout(readFileSync(layoutPath, "utf8"));
  if (bed.statedRings != null && bed.statedRings !== layout.termCounts.length) {
    throw new Error(`Bunny bed says ${bed.statedRings} rings, layout has ${layout.termCounts.length}`);
  }
  const ringsUsed = new Set();
  for (const row of visual) {
    const rings = new Set();
    for (const token of row.tokens) {
      const cell = byCell.get(`${row.bedRow},${token.bed},${token.phys}`);
      if (!cell || !Number.isInteger(cell.faceIndex)) {
        throw new Error(`Bunny row ${row.bedRow} ${token.bed}${token.phys} has no face`);
      }
      const ring = ringOf(cell.faceIndex, layout.termCounts);
      if (ring == null) throw new Error(`Bunny face ${cell.faceIndex} is outside term_counts`);
      rings.add(ring);
    }
    if (rings.size !== 1) throw new Error(`Bunny row ${row.bedRow} spans rings ${[...rings].join(",")}`);
    row.ring = [...rings][0];
    ringsUsed.add(row.ring);
    row.label = labelFor(row, row.ring + 1);
  }
  const knitsByRow = new Map();
  for (const row of visual) {
    const list = knitsByRow.get(row.bedRow) || [];
    list.push(row);
    knitsByRow.set(row.bedRow, list);
  }
  const blocks = rowBlocks(bedText);
  const sequence = [];
  let transfers = 0;
  for (const sheetRow of bed.rows) {
    if (sheetRow.dir === "R" || sheetRow.dir === "L") {
      const parts = knitsByRow.get(sheetRow.row) || [];
      if (!parts.length) throw new Error(`knit row ${sheetRow.row} produced no visual row`);
      for (const part of parts) sequence.push({ kind: "knit", visual: part });
      continue;
    }
    if (sheetRow.dir === "X" || sheetRow.dir === "X+") {
      transfers += 1;
      continue;
    }
    if (sheetRow.dir !== "Flip") throw new Error(`row ${sheetRow.row} dir ${sheetRow.dir}`);
    if (sheetRow.tokens.length !== 1) {
      throw new Error(`flip row ${sheetRow.row} has ${sheetRow.tokens.length} tokens`);
    }
    const token = sheetRow.tokens[0];
    const flip = flipSpec(token, blocks.get(sheetRow.row) || "");
    const cell = byCell.get(`${sheetRow.row},${token.bed},${token.phys}`);
    const occupied = xls.rows[sheetRow.row].cells.filter(
      (item) => item.token && (item.bed === "F" || item.bed === "B"),
    );
    if (occupied.length !== 1 || !cell || cell.bed !== token.bed || cell.phys !== token.phys) {
      throw new Error(`flip row ${sheetRow.row} ${token.raw} is not on the xls`);
    }
    if (cell.token !== token.glyph && cell.token !== token.raw) {
      throw new Error(`flip row ${sheetRow.row} xls token ${cell.token} is not ${token.raw}`);
    }
    if (cell.kind !== "flip") throw new Error(`flip row ${sheetRow.row} xls kind ${cell.kind}`);
    let ring = null;
    if (Number.isInteger(cell.faceIndex)) {
      ring = ringOf(cell.faceIndex, layout.termCounts);
      if (ring == null) throw new Error(`flip face ${cell.faceIndex} is outside the layout`);
    }
    const ringText = ring == null ? "" : `第${ring + 1}环 `;
    sequence.push({
      kind: "flip",
      bedRow: sheetRow.row,
      token,
      code: flip.code,
      label: `${ringText}翻针  ${flip.motion}（床图 row ${sheetRow.row} / course ${flip.course} Flip，操作行，无方向）`,
    });
  }
  if (sequence[0]?.kind !== "knit") throw new Error("Bunny knitting code does not start with a knit row");
  const W = sequence[0].visual.tokens.length;
  const firstPhys = sequence[0].visual.tokens.map((token) => token.phys);
  if (firstPhys.some((phys, index) => phys !== index)) {
    throw new Error(`Bunny first row is not needles 0..${W - 1}: ${firstPhys.join(",")}`);
  }
  const phys = [];
  for (const item of sequence) {
    if (item.kind === "knit") phys.push(...item.visual.tokens.map((token) => token.phys));
    else phys.push(item.token.phys);
  }
  const minP = Math.min(0, ...phys);
  const maxP = Math.max(0, ...phys);
  const needle0Col = Math.max(3, 1 - minP);
  const origin = needle0Col - 3;
  const canvas = Math.max(origin + (W + 10), needle0Col + maxP + 2);
  const opening = buildOpeningMatrix(W);
  const roles = [];
  const needles = [];
  for (let col = 0; col < canvas; col += 1) {
    const p = col - needle0Col;
    if (p >= minP && p <= maxP) {
      roles.push(p);
      needles.push(p);
    } else if (col === origin + 2 || col === origin + 3 + W) roles.push("frame");
    else roles.push("pad");
  }
  const matrix = [];
  const rowLabels = [];
  const windings = [];
  const binds = [];
  const bedRows = [];
  const rails = [];
  opening.rows.forEach((row, index) => {
    const placed = Array(canvas).fill(0);
    row.matrix.forEach((code, col) => {
      placed[origin + col] = code;
    });
    matrix.push(placed);
    rowLabels.push(`开头 ${index + 1}`);
    windings.push(standrad.row_winding[index]);
    binds.push(false);
    bedRows.push(null);
    rails.push(standrad.function_rails[index]);
  });
  const bodyMatrix = [];
  for (const item of sequence) {
    const line = Array(canvas).fill(0);
    if (item.kind === "knit") {
      const row = item.visual;
      row.tokens.forEach((token) => {
        line[needle0Col + token.phys] = token.code;
      });
      const knitCols = [];
      line.forEach((code, col) => {
        if (code === 1 || code === 2 || code === 11 || code === 12) knitCols.push(col);
      });
      const lo = knitCols[0];
      const hi = knitCols[knitCols.length - 1];
      if (line[lo - 1] !== 0 || line[hi + 1] !== 0) {
        throw new Error(`Bunny bed row ${row.bedRow} has no empty cell for a tight 13`);
      }
      line[lo - 1] = 13;
      line[hi + 1] = 13;
      matrix.push(line);
      bodyMatrix.push(line);
      rowLabels.push(row.label);
      windings.push(row.winding);
      binds.push(true);
      bedRows.push(row.bedRow);
      rails.push(null);
      continue;
    }
    line[needle0Col + item.token.phys] = item.code;
    if (line.some((code) => code === 13 || (code !== 0 && code !== item.code))) {
      throw new Error(`Bunny flip row ${item.bedRow} is not a single ${item.code}`);
    }
    matrix.push(line);
    bodyMatrix.push(line);
    rowLabels.push(item.label);
    windings.push("none");
    binds.push(false);
    bedRows.push(item.bedRow);
    rails.push(null);
  }
  const turns11 = visual.reduce((sum, row) => sum + row.tokens.filter((token) => token.code === 11).length, 0);
  const turns12 = visual.reduce((sum, row) => sum + row.tokens.filter((token) => token.code === 12).length, 0);
  const spec = {
    model: "Bunny",
    dir: "cylinder",
    prefix: "faces_ring0_step4",
    sourceBed: "cylinder/faces_ring0_step4_bed.txt",
  };
  const info = { bedSha: sha256(bedText), turns: turns11 + turns12, stopped: bed.stopped };
  const rules = rulesFor(spec, info);
  rules.operations_omitted =
    "移针、整床移位（床图 X / X+ 行）整行省略，不插入全 0 占位行。翻针（床图 Flip 行）画成一行操作。";
  rules.codes.front_to_back = 20;
  rules.codes.back_to_front = 30;
  rules.flip_rows =
    "床图 Flip 行画成一行操作。⬆@F 是前床翻后床，格子为 20。⬇@B 是后床翻前床，格子为 30。前后床翻针不拆行，也没有行进方向。空针保持 0，不加 13。移针（X / X+）仍整行不画。没有收针结尾。";
  rules.flip_palette =
    "20 用已抄录的 DAT Tiffany 显示色 #B276B2。这份调色板没有代号 30（已有项从 22 跳到 31），所以不为 30 另造颜色；格子里仍写出 30。";
  rules.flip_rails =
    "翻针行沿用织行功能轨，只改五处：L13 指示为 0，L1 本体为 1，R1 本体为 1，R3 指示为 0，R5 指示为 1。0 是功能指示，不是空针。未指定的问号仍空。织行的 L13 仍是 81/82，L1/R1 仍按方向为 6 或 7，有编织时 R3 为 6、R5 为空。";
  rules.knit_frames += " 翻针行不加 13。";
  const rightFrame = origin + opening.geometry.right_frame;
  const flipCount = sequence.filter((item) => item.kind === "flip").length;
  const doc = {
    model: "Bunny",
    opening: {
      applied: true,
      n_opening_rows: 34,
      source_width: 10,
      target_width: W,
      opening_canvas: opening.geometry.C,
      placed_at_column: origin,
      needle0_column: needle0Col,
      geometry: opening.geometry,
      function_rails: "copied exactly from the unified opening template; not scaled",
      body_alignment: `garment needles ${minP}..${maxP} occupy columns ${needle0Col + minP}..${needle0Col + maxP}; needle 0 is column ${needle0Col}; opening frames stay on the W=${W} block (right frame column ${rightFrame}); later rows may pass that frame`,
      bind: "opening rows do not bind to the stitch mesh",
      kinds: opening.rows.map((row) => row.kind),
    },
    rules,
    needles,
    column_roles: roles,
    n_rings: layout.termCounts.length,
    n_opening_rows: 34,
    n_knit_rows: visual.length,
    n_flip_rows: flipCount,
    n_transfer_rows_omitted: transfers,
    n_body_rows: sequence.length,
    n_rows: matrix.length,
    n_cols: canvas,
    row_labels: rowLabels,
    row_winding: windings,
    row_bind: binds,
    bed_row: bedRows,
    function_rails: rails,
    matrix,
  };
  const knit = parseKnitCode(doc);
  const bound = bindKnitCodeStitches(knit, xls, null, null);
  if (bound.unmatched.length || bound.knitCells !== bound.bedTokens || bound.byKey.size !== bound.knitCells) {
    throw new Error(
      `Bunny bind ${bound.byKey.size}/${bound.knitCells} tokens ${bound.bedTokens} unmatched ${JSON.stringify(bound.unmatched.slice(0, 6))}`,
    );
  }
  const xlsTokens = bedKnitTokens(xls).length;
  if (bound.bedTokens !== xlsTokens) throw new Error("Bunny token count");
  const seenRings = [...ringsUsed].sort((a, b) => a - b);
  const layoutRings = [...Array(layout.termCounts.length).keys()];
  if (seenRings.join(",") !== layoutRings.join(",")) {
    throw new Error(`Bunny rings drawn ${seenRings.join(",")} layout 0..${layout.termCounts.length - 1}`);
  }
  const flipRows = knit.rows.filter((row) => row.cells.some((code) => code === 20 || code === 30));
  if (flipRows.length !== flipCount) throw new Error("Bunny flip row count drifted");
  for (const row of flipRows) {
    const live = row.cells.filter((code) => code !== 0);
    if (row.winding !== "none" || live.length !== 1 || (live[0] !== 20 && live[0] !== 30) || row.cells.includes(13)) {
      throw new Error(`Bunny flip bed row ${row.bedRow} is not one 20 or 30`);
    }
  }
  return { doc, flipCount, transfers, knitRows: visual.length, W, minP, maxP, bound };
}

function writeBunny() {
  const standradPath = join(sampleDir, "cylinder/standrad_cylinder_knitcode.json");
  const standradBefore = readFileSync(standradPath);
  const standrad = JSON.parse(standradBefore.toString("utf8"));
  const check = buildOpeningMatrix(13);
  check.rows.forEach((row, index) => {
    if (row.matrix.join(",") !== standrad.matrix[index].join(",")) {
      throw new Error(`W=13 opening row ${index} ${row.kind} does not match Standrad`);
    }
  });
  const official = new Map();
  official.set(standradPath, sha256(standradBefore));
  for (const spec of MODELS) {
    const path = join(sampleDir, spec.dir, `${spec.prefix}_knitcode.json`);
    official.set(path, sha256(readFileSync(path)));
  }
  const built = buildBunny(standrad);
  const outPath = join(sampleDir, "cylinder/faces_ring0_knitcode.json");
  writeFileSync(outPath, `${JSON.stringify(built.doc, null, 2)}\n`);
  for (const [path, hash] of official) {
    if (sha256(readFileSync(path)) !== hash) throw new Error(`official knit code changed: ${path}`);
  }
  const flips = built.doc.row_labels.filter((label) => label.includes("翻针"));
  console.log(
    `Bunny: opening 34 + knit ${built.knitRows} + flip ${built.flipCount} = ${built.doc.n_rows} rows; omitted ${built.transfers} transfer rows; needles ${built.minP}..${built.maxP}; bind ${built.bound.knitCells}`,
  );
  console.log(flips.join("\n"));
}

const invokedDirectly = process.argv[1]?.endsWith("build-knitcodes.mjs");
if (invokedDirectly) {
  if (process.argv.includes("--experiments")) buildExperiments();
  else if (process.argv.includes("--bunny")) writeBunny();
  else main();
}
