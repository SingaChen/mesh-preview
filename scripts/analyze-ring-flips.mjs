/**
 * Ring 1–4 flip walk. Read-only: does not write a sheet or touch the viewer.
 *
 *   node scripts/analyze-ring-flips.mjs
 *
 * Beds follow the physical-needle anchor (front 0…edge, back mirrored from
 * the right fold). After every +R/−R the script checks F−B. It flips one
 * fold needle only when the difference is −1 or 2, then recenters so the
 * cast-on front needle 0 sits at physical 0 again. No end-of-ring homing.
 *
 * Transfer columns are checked against step3_xfer.xls. Increase X+ rows
 * sit before the knit; decrease X rows sit after it (the committed sheet,
 * not the later “both before the knit” note in readable_map_steps.md).
 * A −Rn / +Rn of n>1 is one shaping: n passes, one balance check after.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseXlsWorkbook } from "../src/xls.js";
import { excelLegendKind } from "../src/excel-map.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const xlsPath = join(root, "public/sample/cylinder/iteration_0_cut_readable_map_step3_xfer.xls");
const bindPath = join(root, "public/sample/cylinder/stitch_map_bind.json");

/** Original circle is chart columns 0…36. Front occupies 0…18. */
const EDGE0 = 18;

function loadSheet(path) {
  const book = parseXlsWorkbook(readFileSync(path));
  const step = book.sheets.find((s) => s.name.toLowerCase().includes("step3"));
  if (!step?.rows?.length) throw new Error(`missing step3 sheet in ${path}`);
  const needles = [];
  for (let c = 1; c < step.rows[0].length; c++) {
    const n = Number(step.rows[0][c]);
    if (Number.isFinite(n)) needles.push(n);
  }
  const rows = [];
  for (let r = 1; r < step.rows.length; r++) {
    const dir = String(step.rows[r]?.[0] ?? "");
    if (!dir) continue;
    const cells = [];
    needles.forEach((needle, i) => {
      const token = String(step.rows[r][i + 1] ?? "");
      if (token) cells.push({ col: needle, token });
    });
    rows.push({ dir, cells });
  }
  return rows;
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
function knitOrder(row) {
  const sign = row.dir === "R" ? 1 : -1;
  return [...row.cells].sort((a, b) => (a.col - b.col) * sign);
}

const bind = JSON.parse(readFileSync(bindPath, "utf8"));
const pathOfRow = new Map();
const pathEnd = new Map();
for (const face of bind.faces) {
  for (const cell of face.cells || []) {
    if (!Number.isInteger(cell.display_row)) continue;
    pathOfRow.set(cell.display_row, face.path_index);
    const prev = pathEnd.get(face.path_index);
    if (prev == null || cell.display_row > prev) pathEnd.set(face.path_index, cell.display_row);
  }
}

const rows = loadSheet(xlsPath);
const ops = [];
{
  let i = 0;
  const lead = [];
  while (i < rows.length) {
    const dir = rows[i].dir;
    if (dir === "X+") {
      lead.push(i);
      i++;
      continue;
    }
    if (dir === "X") throw new Error(`X row ${i} is not attached to a knit`);
    if (dir !== "R" && dir !== "L") throw new Error(`unexpected dir ${dir} at ${i}`);
    const op = { knit: i, lead: lead.splice(0), trail: [] };
    i++;
    while (i < rows.length && rows[i].dir === "X") {
      op.trail.push(i);
      i++;
    }
    ops.push(op);
  }
  if (lead.length) throw new Error(`orphan X+ rows ${lead}`);
}

let nextId = 0;
let live = new Map();
let sheetShift = 0;
let anchorId = null;
const issues = [];
const shaping = [];
const plainBirths = [];
let flipCount = 0;

function counts() {
  let F = 0;
  let B = 0;
  for (const stitch of live.values()) {
    if (stitch.bed === "F") F += 1;
    else if (stitch.bed === "B") B += 1;
  }
  return { F, B, N: live.size, diff: F - B };
}
function bedList(bed) {
  return [...live.entries()].filter(([, stitch]) => stitch.bed === bed).map(([col, stitch]) => ({ col, ...stitch }));
}
function maxOf(bed) {
  return bedList(bed).reduce((best, stitch) => (!best || stitch.phys > best.phys ? stitch : best), null);
}
function sameBedClash() {
  const seen = new Map();
  const out = [];
  for (const [col, stitch] of live) {
    const key = `${stitch.bed}:${stitch.phys}`;
    if (seen.has(key)) out.push(`${key} @ ${seen.get(key)} and ${col}`);
    else seen.set(key, col);
  }
  return out;
}
function frontShape() {
  const fronts = bedList("F");
  if (!fronts.length) return { ok: false, why: "no F" };
  const origins = new Set(fronts.map((stitch) => stitch.col - stitch.phys));
  const phys = fronts.map((stitch) => stitch.phys).sort((a, b) => a - b);
  const contig = phys.every((p, i) => p === phys[0] + i);
  return {
    ok: origins.size === 1 && contig,
    origins: [...origins],
    phys0: phys[0],
    physN: phys.at(-1),
    contig,
    n: fronts.length,
  };
}

/** Mover that lands on a stationary stitch is the one consumed. */
function moveStitches(pivotMachine, step, delta) {
  const next = new Map();
  const lost = [];
  const entries = [...live.entries()].sort((a, b) => a[0] - b[0]);
  for (const [col, stitch] of entries) {
    const moves = step === 1 ? col >= pivotMachine : col <= pivotMachine;
    if (!moves) next.set(col, stitch);
  }
  for (const [col, stitch] of entries) {
    const moves = step === 1 ? col >= pivotMachine : col <= pivotMachine;
    if (!moves) continue;
    const dest = col + delta;
    const physDelta = stitch.bed === "B" ? -delta : delta;
    if (next.has(dest)) {
      const kept = next.get(dest);
      lost.push({
        id: stitch.id,
        bed: stitch.bed,
        phys: stitch.phys,
        from: col,
        at: dest,
        kept: kept.id,
        keptBed: kept.bed,
        keptPhys: kept.phys,
      });
    } else {
      next.set(dest, { ...stitch, phys: stitch.phys + physDelta });
    }
  }
  live = next;
  return lost;
}

function birthAt(machineCol, prior) {
  const keys = [...prior.keys()];
  const left = keys.filter((col) => col < machineCol).sort((a, b) => b - a)[0];
  const right = keys.filter((col) => col > machineCol).sort((a, b) => a - b)[0];
  const lb = left == null ? null : prior.get(left);
  const rb = right == null ? null : prior.get(right);
  if (!lb && !rb) {
    const bed = machineCol <= EDGE0 ? "F" : "B";
    const phys = bed === "F" ? machineCol : EDGE0 * 2 + 1 - machineCol;
    return { bed, phys, how: "cast-on" };
  }
  if (lb && rb && lb.bed !== rb.bed) {
    return {
      bed: null,
      phys: null,
      how: `fold-hole L ${lb.bed}p${lb.phys}@${left} R ${rb.bed}p${rb.phys}@${right}`,
    };
  }
  if (lb && (!rb || lb.bed === rb.bed)) {
    const bed = lb.bed;
    const phys = bed === "F" ? lb.phys + (machineCol - left) : lb.phys - (machineCol - left);
    return { bed, phys, how: rb ? "between" : "extend-right" };
  }
  const bed = rb.bed;
  const phys = bed === "F" ? rb.phys - (right - machineCol) : rb.phys + (right - machineCol);
  return { bed, phys, how: "extend-left" };
}

function recenter(tag) {
  const info = frontShape();
  if (!info.ok) {
    issues.push({ kind: "recenter-front", tag, ...info });
    return { d: 0, aligned: false, edge: null, bHi: null };
  }
  const anchor = anchorId == null ? null : [...live.values()].find((stitch) => stitch.id === anchorId && stitch.bed === "F");
  const d = anchor ? -anchor.phys : -info.phys0;
  if (d !== 0) {
    const next = new Map();
    for (const [col, stitch] of live) {
      const ncol = col + d;
      const nphys = stitch.bed === "F" ? stitch.phys + d : stitch.phys - d;
      if (next.has(ncol)) issues.push({ kind: "recenter-chart-clash", tag, ncol });
      next.set(ncol, { ...stitch, phys: nphys });
    }
    live = next;
    sheetShift += d;
  }
  const edge = maxOf("F")?.phys ?? null;
  const backs = bedList("B").map((stitch) => stitch.phys).sort((a, b) => b - a);
  const bHi = backs.length ? backs[0] : null;
  const contig = backs.every((p, i) => p === backs[0] - i);
  const aligned = bHi == null || (contig && bHi === edge);
  if (!contig) issues.push({ kind: "back-gap", tag, edge, bHi, backs });
  const clash = sameBedClash();
  if (clash.length) issues.push({ kind: "phys-clash", tag, clash });
  return { d, aligned, edge, bHi, bLo: backs.at(-1) ?? null, contig, clash };
}

function applyFlip(rec) {
  const diff = rec.before.diff;
  if (diff === 0 || diff === 1) {
    rec.action = "不翻";
    rec.after = { ...rec.before };
    return;
  }
  if (diff === -1) {
    const back = maxOf("B");
    const front = maxOf("F");
    const destPhys = front.phys + 1;
    const occupied = bedList("F").find((stitch) => stitch.phys === destPhys);
    rec.action = "翻";
    rec.flip = {
      dir: "B→F",
      id: back.id,
      fromPhys: back.phys,
      toPhys: destPhys,
      occupied: occupied ? occupied.col : null,
    };
    const stitch = live.get(back.col);
    stitch.bed = "F";
    stitch.phys = destPhys;
    rec.after = counts();
    flipCount += 1;
    return;
  }
  if (diff === 2) {
    const front = maxOf("F");
    rec.action = "翻";
    rec.flip = {
      dir: "F→B",
      id: front.id,
      fromPhys: front.phys,
      toPhys: front.phys,
      occupied: null,
    };
    live.get(front.col).bed = "B";
    rec.after = counts();
    flipCount += 1;
    return;
  }
  rec.action = "未覆盖";
  rec.after = { ...rec.before };
  issues.push({ kind: "diff-uncovered", knit: rec.knit, path: rec.path, diff, F: rec.before.F, B: rec.before.B });
}

function matchPass(ri, pred, dir, knit) {
  const sheet = rows[ri].cells.map((cell) => cell.col);
  const sim = pred.cols.map((col) => col - sheetShift);
  const tokenOk = rows[ri].cells.every((cell) => cell.token === `${pred.arrow}1`);
  if (rows[ri].dir !== dir || sheet.join(",") !== sim.join(",") || !tokenOk) {
    issues.push({
      kind: "xfer",
      ri,
      knit,
      dir,
      sheet0: sheet[0],
      sim0: sim[0],
      sheetN: sheet.length,
      simN: sim.length,
    });
  }
}

const snaps = new Map();
function snap(label) {
  const c = counts();
  snaps.set(label, {
    ...c,
    foldF: maxOf("F")?.phys ?? null,
    foldB: maxOf("B")?.phys ?? null,
  });
}

const seenPath = new Set();
for (const op of ops) {
  const path = pathOfRow.get(op.knit);
  if (!seenPath.has(path)) {
    snap(`start-${path}`);
    seenPath.add(path);
  }
  const krow = rows[op.knit];
  const step = krow.dir === "R" ? 1 : -1;
  const kcells = knitOrder(krow);
  const incs = kcells.filter((cell) => parseIncN(cell.token));
  const decs = kcells.filter((cell) => {
    const kind = excelLegendKind(cell.token, krow.dir);
    return (kind === "decrease" || kind === "wrap-dec") && parseDecN(cell.token);
  });
  const rowEdgeSheet = step === 1
    ? Math.max(...krow.cells.map((cell) => cell.col))
    : Math.min(...krow.cells.map((cell) => cell.col));

  if (incs.length > 1 || decs.length > 1) {
    issues.push({ kind: "multi-cell", knit: op.knit, incs: incs.length, decs: decs.length });
  }
  if (incs.length && decs.length) {
    issues.push({ kind: "inc-and-dec", knit: op.knit });
  }

  const incPasses = [];
  const incLost = [];
  for (const cell of incs.slice().reverse()) {
    const added = parseIncN(cell.token);
    const pivot0 = cell.col + step + sheetShift;
    const fresh = [];
    for (let g = 1; g <= added; g++) fresh.push(cell.col + step * g + sheetShift);
    const arrow = step === 1 ? "→" : "←";
    for (let k = 0; k < added; k++) {
      const cols = [...live.keys()].filter((col) => (step === 1 ? col >= pivot0 : col <= pivot0));
      for (const ncol of fresh) if (!cols.includes(ncol)) cols.push(ncol);
      cols.sort((a, b) => a - b);
      incPasses.push({ cols, arrow });
      incLost.push(...moveStitches(pivot0, step, step === 1 ? 1 : -1));
    }
  }
  if (incPasses.length !== op.lead.length) {
    issues.push({ kind: "inc-n", knit: op.knit, sim: incPasses.length, sheet: op.lead.length });
  } else {
    op.lead.forEach((ri, pi) => matchPass(ri, incPasses[pi], "X+", op.knit));
  }

  const born = [];
  const prior = new Map(live);
  for (const cell of kcells) {
    const mcol = cell.col + sheetShift;
    if (live.has(mcol)) continue;
    const assigned = birthAt(mcol, prior);
    const id = nextId++;
    if (!assigned.bed) {
      issues.push({ kind: "birth", knit: op.knit, col: cell.col, token: cell.token, how: assigned.how });
      live.set(mcol, { id, bed: "U", phys: 0 });
    } else {
      live.set(mcol, { id, bed: assigned.bed, phys: assigned.phys });
      if (anchorId == null && assigned.bed === "F" && assigned.phys === 0) anchorId = id;
    }
    born.push({ id, col: cell.col, token: cell.token, ...assigned });
  }

  const decPasses = [];
  const decLost = [];
  for (const cell of decs.slice().reverse()) {
    const n = Math.max(1, parseDecN(cell.token));
    const arrow = step === 1 ? "←" : "→";
    for (let k = 0; k < n; k++) {
      const pivot = rowEdgeSheet + sheetShift - k * step;
      const cols = [...live.keys()]
        .filter((col) => (step === 1 ? col >= pivot : col <= pivot))
        .sort((a, b) => a - b);
      decPasses.push({ cols, arrow });
      decLost.push(...moveStitches(pivot, step, step === 1 ? -1 : 1));
    }
  }
  if (decPasses.length !== op.trail.length) {
    issues.push({ kind: "dec-n", knit: op.knit, sim: decPasses.length, sheet: op.trail.length });
  } else {
    op.trail.forEach((ri, pi) => matchPass(ri, decPasses[pi], "X", op.knit));
  }

  if (incs.length || decs.length) {
    const lost = [...incLost, ...decLost];
    const rec = {
      path,
      knit: op.knit,
      dir: krow.dir,
      marks: [...incs.map((cell) => `${cell.token}@${cell.col}`), ...decs.map((cell) => `${cell.token}@${cell.col}`)],
      nInc: incs.reduce((sum, cell) => sum + parseIncN(cell.token), 0),
      nDec: decs.reduce((sum, cell) => sum + parseDecN(cell.token), 0),
      born,
      lost: lost.map((item) => ({
        bed: item.bed,
        phys: item.phys,
        sheetCol: item.from - sheetShift,
        keptBed: item.keptBed,
        keptPhys: item.keptPhys,
      })),
      xfer: [...op.lead, ...op.trail],
      before: counts(),
    };
    if (lost.some((item) => item.bed !== item.keptBed)) {
      issues.push({ kind: "cross-bed-merge", knit: op.knit, path, lost: rec.lost });
    }
    applyFlip(rec);
    const placed = recenter(`knit ${op.knit}`);
    rec.recenter = placed;
    rec.final = counts();
    rec.fold = placed.edge;
    rec.foldB = placed.bHi;
    if (path > 0 && placed.bHi != null && !placed.aligned) {
      issues.push({
        kind: "fold-gap",
        knit: op.knit,
        path,
        foldF: placed.edge,
        foldB: placed.bHi,
      });
    }
    shaping.push(rec);
  } else if (born.length) {
    const c = counts();
    plainBirths.push({
      path,
      knit: op.knit,
      dir: krow.dir,
      born,
      ...c,
    });
    if (op.knit > 5 && c.diff !== 0 && c.diff !== 1) {
      issues.push({ kind: "plain-balance", knit: op.knit, path, F: c.F, B: c.B, diff: c.diff });
    }
  }
  if (op.knit === pathEnd.get(path)) snap(`end-${path}`);
}

const xferIssues = issues.filter((item) => item.kind === "xfer" || item.kind === "inc-n" || item.kind === "dec-n");
if (xferIssues.length) {
  console.error(JSON.stringify(xferIssues, null, 2));
  throw new Error(`transfer columns diverged from step3 (${xferIssues.length})`);
}

function bedText(rec) {
  if (rec.nInc) {
    return rec.born.map((item) => `${item.bed}（新针表列 ${item.col} ${item.token}，物理 ${item.phys}）`).join("；");
  }
  return rec.lost.map((item) => `${item.bed}（并掉物理 ${item.phys}，表列 ${item.sheetCol}）`).join("；");
}
function flipText(rec) {
  if (rec.action === "翻" && rec.flip.dir === "B→F") {
    return `是，后床物理 ${rec.flip.fromPhys} → 前床物理 ${rec.flip.toPhys}`;
  }
  if (rec.action === "翻" && rec.flip.dir === "F→B") {
    return `是，前床物理 ${rec.flip.fromPhys} → 后床物理 ${rec.flip.toPhys}`;
  }
  if (rec.action === "未覆盖") return "否";
  return "否";
}
function foldText(rec) {
  if (rec.fold == null) return "—";
  if (rec.foldB == null) return `前 ${rec.fold}`;
  if (rec.fold === rec.foldB) return String(rec.fold);
  return `前 ${rec.fold} / 后 ${rec.foldB}`;
}
function markText(rec) {
  const n = rec.nInc || rec.nDec;
  const kind = rec.nInc ? "加" : "减";
  return `${kind}${n} ${rec.marks.join(" ")}`;
}

const lines = [];
lines.push("各圈起止（脚本）");
lines.push("| 圈 | 起点针数 | 起点 F | 起点 B | 起点 F−B | 起点折边 | 终点针数 | 终点 F | 终点 B | 终点 F−B | 终点折边 |");
lines.push("|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|");
for (const path of [0, 1, 2, 3, 4]) {
  const a = snaps.get(`start-${path}`);
  const b = snaps.get(`end-${path}`);
  const foldA = a.foldF === a.foldB ? String(a.foldF ?? "—") : `前 ${a.foldF} / 后 ${a.foldB}`;
  const foldB = b.foldF === b.foldB ? String(b.foldF ?? "—") : `前 ${b.foldF} / 后 ${b.foldB}`;
  lines.push(`| ${path} | ${a.N} | ${a.F} | ${a.B} | ${a.diff} | ${foldA} | ${b.N} | ${b.F} | ${b.B} | ${b.diff} | ${foldB} |`);
}

lines.push("");
lines.push("加减针（第 1–4 圈）");
lines.push("| 圈 | 织行 | 移圈行 | 方向 | 加减 | 落在哪张床 | 加减后 F | 加减后 B | F−B | 翻针 | 翻后 F | 翻后 B | 回正后折边 |");
lines.push("|---:|---:|---|:---:|---|---|---:|---:|---:|---|---:|---:|---|");
let shownFlips = 0;
for (const rec of shaping) {
  if (rec.path < 1) continue;
  if (rec.action === "翻") shownFlips += 1;
  const xfer = rec.xfer.length ? rec.xfer.join(",") : "—";
  lines.push(
    `| ${rec.path} | ${rec.knit} | ${xfer} | ${rec.dir} | ${markText(rec)} | ${bedText(rec)} | ${rec.before.F} | ${rec.before.B} | ${rec.before.diff} | ${flipText(rec)} | ${rec.after.F} | ${rec.after.B} | ${foldText(rec)} |`,
  );
}

lines.push("");
lines.push(`第 1–4 圈翻针次数：${shownFlips}`);
lines.push(`全程翻针次数（含第 0 圈）：${flipCount}`);

const uncoveredDiff = issues.filter((item) => item.kind === "diff-uncovered" && item.path >= 1);
const plain = issues.filter((item) => item.kind === "plain-balance" && item.path >= 1);
const folds = issues.filter((item) => item.kind === "fold-gap");
const merges = issues.filter((item) => item.kind === "cross-bed-merge");
const multi = issues.filter((item) => item.kind === "multi-cell" || item.kind === "inc-and-dec" || item.kind === "birth");
const wide = shaping.filter((rec) => rec.path >= 1 && (rec.nInc > 1 || rec.nDec > 1));

lines.push("");
lines.push("未覆盖");
lines.push(`- 加减针后 F−B 不是 −1、0、1、2，因此不翻：${uncoveredDiff.map((item) => `行 ${item.knit}（F${item.F} B${item.B} 差 ${item.diff}）`).join("；")}`);
lines.push(`- 一次加减超过 1 针：${wide.map((rec) => `行 ${rec.knit} ${rec.marks.join(" ")} → 差 ${rec.before.diff}`).join("；")}`);
lines.push(`- 非加减针行新挂针后 F−B 离开 {0,1}：${plain.map((item) => {
  const row = plainBirths.find((entry) => entry.knit === item.knit);
  const bits = row.born.map((itemBorn) => `${itemBorn.token}@${itemBorn.col} ${itemBorn.bed}物理${itemBorn.phys}`).join(", ");
  return `行 ${item.knit}（${bits}）→ F${item.F} B${item.B} 差 ${item.diff}`;
}).join("；")}`);
lines.push(`- 回正后前床终点 ≠ 后床起点：${folds.map((item) => `行 ${item.knit} 前 ${item.foldF} / 后 ${item.foldB}`).join("；")}`);
lines.push(`- 并针跨床：${merges.length ? merges.map((item) => `行 ${item.knit} ${item.lost.map((lost) => `${lost.bed}物理${lost.phys}→留${lost.keptBed}物理${lost.keptPhys}`).join(",")}`).join("；") : "无"}`);
lines.push(`- 一行多个加减针格、同行又加又减、折边两侧同时邻接的新针：${multi.length ? JSON.stringify(multi) : "无"}`);

console.log(lines.join("\n"));
