/**
 * First-ring physical bed chart from faces_ring only.
 *
 * Reads public/sample/cylinder/faces_ring_layout.json ring 0 (the first
 * faces_ring path; the layout already skipped the seed row). Does not
 * open Step1, Step2, or Step3 xls/txt/maps, and does not use their
 * column numbers as needle identity.
 *
 * faces_ring_layout stores one Term.Type per stitch, in chain order.
 * Direction is the path chain: a Type 2/5/6 pair flips a right-going
 * course, a Type 1 pair flips a left-going course. Each of those flips
 * is a fold-return short row and its own course. The next course starts
 * on the needle that turn ended on. The ring finishes when its terms
 * finish; the stitch after that is the next ring, and it is not filled.
 * Increase and decrease needle counts are that term's hang: Term.remain,
 * which path_generate stores as n_extra = |a-b| from the term's points.
 * rings[0].hangs[] is that count. A missing list is an error. Hang is
 * never defaulted to 1 because a type exists. Non-shaping terms are 0.
 *
 * Seating, after the ring is on the machine:
 *   F = ceil(N/2), B = floor(N/2), front low end is physical F0.
 *   The extra stitch when the counts differ by 1 is the fold gap.
 * Identity is F# / B#. A combined chart may draw back = 37 − phys.
 * Course start is the previous course's end, plus transfers and any
 * whole-bed balance since that end. A row is a fold-return if and only
 * if its travel direction reverses from the previous row. The first
 * label is not that test: a reversed row that opens on +R1 is still a
 * fold-return. A fold-return starts on that same end stitch, on the
 * needle it occupies after the shift. Do not step one extra needle on
 * a fold-return. A course whose direction does not reverse starts one
 * needle further in its own travel direction. Do not stay on the end
 * needle when the course is not a fold-return. Do not classify a
 * reversed row as a normal row.
 * Increase: if a row has n increase sites, do those transfers first
 * to open every site, then knit the whole row once. Do not
 * transfer-and-knit at each site. While the course travels, every
 * needle that currently holds a loop is knitted. When a shift moves
 * a stitch onto a new needle, the course cell that owns that
 * stitchmesh is drawn on the new needle. The turn mark moves with
 * that stitch, and the row ends there. Do not add a second cell
 * with no stitchmesh, and do not leave the stitchmesh on the old
 * needle. An empty needle is not knitted. The increase is finished
 * when that knit reaches its end; balance after the knit. The next course is
 * counted from the post-balance needles. A stitch that would sit
 * below 0 (F−1) is kept and balanced onto F0.
 * Decrease, on a bed that is already seated: a hang of n occupies
 * n+1 cells, all in the decrease color. The first is -Rn or -Ln.
 * The rest are plain dots on that bed. Knit through the last of
 * those cells, then transfer. The rest of that row is the next
 * course. The transfer starts at the second decrease cell, and
 * every repeat starts there again, not at the next needle after it.
 * That loop stacks onto the first cell and leaves the bed. Every
 * loop still ahead of it, toward the end being decreased, steps
 * one needle onto the first cell. The first cell only receives.
 * Hang n repeats the transfer n times from that same receiving
 * needle. R decreases the high end of the shaping bed (higher
 * physical index). L decreases the low end. The sheet order is the
 * knitting order: the cells through the last decrease cell, then
 * those transfers. Balance runs as soon as those transfers finish,
 * before the remaining stitches are knitted. The remaining knit is
 * the next course, counted on the post-balance window.
 * Balance is a whole-bed shift so
 * F≥B and |F−B|≤1, front low end at F0, extra stitch at the fold
 * gap. The next row starts on the end stitch's needle after that
 * shift. Flips only at the right fold, same physical index, one by
 * one. F17→B18 is not a flip.
 * A 1-needle transfer omits the number (F→, B←).
 * A fold-return short row is its own course. It is not glued into
 * the next long row. Finishing the ring is not a fold-return: the
 * next stitch is the next ring.
 *
 * Rings 0, 1, and 2 are one sheet. Ring 2 continues on the bed ring 1
 * left behind. Its first stitch is the next stitch after ring 1, not
 * a fold-return close.
 *
 *   node scripts/build-step4-faces-ring0.mjs
 *   node scripts/build-step4-faces-ring0.mjs --check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BIFF8_DEFAULT_PALETTE } from "../src/xls.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cylDir = join(root, "public", "sample", "cylinder");

export const DEFAULT_PATHS = {
  facesRing: join(cylDir, "faces_ring_layout.json"),
  outXls: join(cylDir, "faces_ring0_step4_bed.xls"),
  outTxt: join(cylDir, "faces_ring0_step4_bed.txt"),
};

const FILL = {
  plain: "rgb(255,255,255)",
  back: "rgb(204,255,255)",
  wrap: "rgb(255,204,0)",
  inc: "rgb(204,255,204)",
  wrapInc: "rgb(153,204,0)",
  dec: "rgb(255,153,204)",
  wrapDec: "rgb(255,102,0)",
  xfer: "rgb(204,204,255)",
  flip: "rgb(153,153,255)",
  empty: "rgb(192,192,192)",
};

const MIRROR = 37;

function fail(msg) {
  throw new Error(`faces-ring0-step4: ${msg}`);
}

function loadRing0(path) {
  const layout = JSON.parse(readFileSync(path, "utf8"));
  const rings = layout?.rings;
  if (!Array.isArray(rings) || !rings.length) fail(`${path} has no faces_ring`);
  const ring = rings[0];
  const types = ring?.types;
  if (!Array.isArray(types) || types.length !== ring.n_terms) {
    fail(`ring 0 types (${types?.length}) do not match n_terms ${ring?.n_terms}`);
  }
  if (ring.row !== 0) fail(`first faces_ring row is ${ring.row}, expected 0`);
  const hangs = ring?.hangs;
  if (!Array.isArray(hangs) || hangs.length !== types.length) {
    fail("ring 0 hangs[] must be the per-term n_extra from the faces_ring record");
  }
  const hangNums = hangs.map((n, i) => {
    const v = Number(n);
    if (!Number.isInteger(v) || v < 0) fail(`term ${i} hang ${n} is not a non-negative integer`);
    return v;
  });
  return { types: types.map((t) => Number(t)), hangs: hangNums, nRings: rings.length };
}

/** Path-chain direction. 0 = knit right, 1 = knit left. */
export function assignDirections(types) {
  const dir = [0];
  let d = 0;
  for (let i = 0; i < types.length - 1; i++) {
    const cur = types[i];
    const nxt = types[i + 1];
    const flip =
      ((cur === 2 || cur === 5 || cur === 6) && d === 0 && (nxt === 2 || nxt === 5 || nxt === 6)) ||
      (cur === 1 && d === 1 && nxt === 1);
    if (flip) d = 1 - d;
    dir.push(d);
  }
  return dir;
}

function hangOf(hangs, index) {
  if (!hangs) fail("hangs[] is required; do not substitute 1");
  return hangs[index];
}

function advance(col, direction, steps = 1) {
  return col + (direction === 0 ? steps : -steps);
}

/**
 * Courses along the ring. Wales are the walk cursor of this ring.
 * They are not Step3 columns and they are not needle numbers.
 */
export function coursesFromTypes(types, hangs) {
  const dir = assignDirections(types);
  const rows = [];
  let col = 0;
  let direction = dir[0];
  let pending = false;

  const ensure = (d) => {
    if (!rows.length) {
      rows.push({ dir: d, cells: [] });
      direction = d;
      return;
    }
    if (rows.at(-1).dir !== d && !rows.at(-1).cells.length) {
      rows.at(-1).dir = d;
      direction = d;
    }
  };
  const occupied = () => rows.at(-1).cells.length > 0;
  const emit = (label, kind, tIdx, ttype, adv = 1) => {
    ensure(direction);
    rows.at(-1).cells.push({ label, kind, wale: col, tIdx, ttype });
    if (adv) col = advance(col, direction, adv);
  };
  // A fold-return short row ends here. The next course starts on this
  // needle. Later flips do the same. Running out of terms ends the ring;
  // that is not another turnaround, and the next ring is not filled.
  const close = (wrapCol, nextDir) => {
    rows.push({ dir: nextDir, cells: [] });
    direction = nextDir;
    col = wrapCol;
    pending = true;
  };
  const stackStart = (tIdx, ttype) => {
    if (!pending) return;
    const side = direction === 0 ? "R" : "L";
    emit(`^${side}`, "wrap", tIdx, ttype, 0);
    pending = false;
  };

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const td = dir[i];
    const nxt = i + 1 < types.length ? dir[i + 1] : td;
    const hang = hangOf(hangs, i);

    if (t === 4 || t === 6 || t === 8) {
      const added = hang;
      const n = added + 1;
      const side = t === 8 ? "L" : t === 6 ? "R" : td === 0 ? "R" : "L";
      if (t === 4) {
        ensure(td);
        if (td !== direction && !occupied()) {
          direction = td;
          rows.at(-1).dir = td;
        }
        stackStart(i, t);
        for (let k = 0; k < n; k++) emit(k === 0 ? `+${side}${added}` : "·", "inc", i, t, 1);
        continue;
      }
      ensure(td);
      const asEnd = occupied();
      if (td !== direction && !asEnd) {
        direction = td;
        rows.at(-1).dir = td;
      }
      pending = false;
      const wrapLabel = asEnd ? `v${side}` : `^${side}`;
      const first = col;
      for (let k = 0; k < n; k++) {
        let label;
        let kind;
        if (n === 1) {
          label = `+${side}${added}|${wrapLabel}`;
          kind = "wrapInc";
        } else if (k === 0) {
          label = `+${side}${added}`;
          kind = "inc";
        } else if (k === n - 1) {
          label = wrapLabel;
          kind = "wrapInc";
        } else {
          label = "·";
          kind = "inc";
        }
        emit(label, kind, i, t, 1);
      }
      if (asEnd) close(advance(first, direction, n - 1), i + 1 < types.length ? nxt : direction);
      continue;
    }

    if (t === 3) {
      if (hang < 1) fail(`term ${i} decrease hang is ${hang}`);
      const side = td === 0 ? "R" : "L";
      const n = hang + 1;
      ensure(td);
      if (td !== direction && !occupied()) {
        direction = td;
        rows.at(-1).dir = td;
      }
      stackStart(i, t);
      for (let k = 0; k < n; k++) emit(k === 0 ? `-${side}${hang}` : "·", "dec", i, t, 1);
      continue;
    }

    if (t === 1 || t === 2 || t === 5 || t === 7) {
      const side = t === 1 || t === 7 ? "L" : "R";
      const mark = t === 5 || t === 7 ? `-${hang}` : "";
      const kind = mark ? "wrapDec" : "wrap";
      ensure(td);
      if (!occupied()) {
        if (td !== direction) {
          direction = td;
          rows.at(-1).dir = td;
        }
        emit(`^${side}${mark}`, kind, i, t, 1);
        pending = false;
        continue;
      }
      const wrapCol = col;
      emit(`v${side}${mark}`, kind, i, t, 1);
      close(wrapCol, i + 1 < types.length ? nxt : direction);
      continue;
    }

    ensure(td);
    if (td !== direction && !occupied()) {
      direction = td;
      rows.at(-1).dir = td;
    }
    stackStart(i, t);
    emit("·", "plain", i, t, 1);
  }
  return rows.filter((row) => row.cells.length);
}

function incAdded(label) {
  const m = String(label).match(/\+[RL](\d+)/);
  return m ? Number(m.group ? m[1] : m[1]) : 0;
}

function decAdded(label) {
  const tagged = String(label).match(/-[RL](\d+)/);
  if (tagged) return Number(tagged[1]);
  const tail = String(label).match(/-(\d+)$/);
  return tail ? Number(tail[1]) : 0;
}

/**
 * A row is a fold-return if and only if its travel direction reverses
 * from the previous row. The opening label is not the test.
 */
function isFoldReturn(course, prevDir) {
  return prevDir != null && course.dir !== prevDir;
}

function decSide(label) {
  const tagged = String(label).match(/-([RL])/);
  if (tagged) return tagged[1];
  const wrapped = String(label).match(/[v^]([RL])/);
  return wrapped ? wrapped[1] : "";
}

/** Birth wales of stitches that are not increase holes. */
export function baseWalesOf(courses) {
  let live = new Set();
  const base = [];
  for (const course of courses) {
    const step = course.dir === 0 ? 1 : -1;
    const incs = course.cells.filter((c) => incAdded(c.label));
    const fresh = new Set();
    for (const cell of incs.slice().reverse()) {
      const added = incAdded(cell.label);
      const pivot = cell.wale + step;
      for (let g = 1; g <= added; g++) fresh.add(cell.wale + step * g);
      for (let k = 0; k < added; k++) {
        const next = new Set();
        for (const w of live) {
          let dest = w;
          if (step === 1 && w >= pivot) dest = w + 1;
          if (step === -1 && w <= pivot) dest = w - 1;
          next.add(dest);
        }
        live = next;
      }
    }
    for (const cell of course.cells) {
      if (live.has(cell.wale)) continue;
      if (fresh.has(cell.wale)) {
        live.add(cell.wale);
        continue;
      }
      base.push(cell.wale);
      live.add(cell.wale);
    }
  }
  base.sort((a, b) => a - b);
  if (!base.length) fail("ring has no circumference");
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== base[0] + i) fail(`base wales are not one span: ${base.join(",")}`);
  }
  if (base[0] !== 0) fail(`base wales do not start at 0: ${base[0]}`);
  return base;
}

export function planBeds(base) {
  const n = base.length;
  const frontN = Math.ceil(n / 2);
  const backN = Math.floor(n / 2);
  if (!(frontN === backN || frontN === backN + 1)) fail(`F${frontN}/B${backN} is not a one-stitch split`);
  const spare = frontN === backN + 1;
  const plan = new Map();
  base.forEach((wale, i) => {
    if (i < frontN) plan.set(wale, { bed: "F", phys: i, used: false });
    else plan.set(wale, { bed: "B", phys: spare ? n - i : n - 1 - i, used: false });
  });
  return { plan, n, frontN, backN, spare };
}

export function moveToken(bed, fromPhys, toPhys) {
  const steps = toPhys - fromPhys;
  if (!steps) fail(`${bed} move has no distance`);
  const arrow = steps > 0 ? "→" : "←";
  const n = Math.abs(steps);
  return n === 1 ? `${bed}${arrow}` : `${bed}${arrow}${n}`;
}

export function columnForPhys(bed, phys) {
  if (bed === "F") return phys;
  if (bed === "B") return MIRROR - phys;
  fail(`column needs a bed, got ${bed}`);
}

function assertNoShare(stitches, where) {
  const seen = new Map();
  for (const st of stitches.values()) {
    const key = `${st.bed}:${st.phys}`;
    const prev = seen.get(key);
    if (prev != null) fail(`${where}: ${st.bed}${st.phys} holds stitch ${prev} and ${st.id}`);
    seen.set(key, st.id);
  }
}

function listsOf(stitches) {
  const f = [];
  const b = [];
  for (const st of stitches.values()) (st.bed === "F" ? f : b).push(st);
  f.sort((a, c) => a.phys - c.phys || a.id - c.id);
  b.sort((a, c) => a.phys - c.phys || a.id - c.id);
  return { f, b, N: f.length + b.length };
}

function spanText(phys) {
  if (!phys.length) return "—";
  return `${phys[0]}…${phys[phys.length - 1]}`;
}

function assignedPhys(stitches, plan, bed, where) {
  const phys = [];
  for (const st of stitches.values()) if (st.bed === bed) phys.push(st.phys);
  for (const slot of plan.values()) if (!slot.used && slot.bed === bed) phys.push(slot.phys);
  phys.sort((a, b) => a - b);
  for (let i = 1; i < phys.length; i++) {
    if (phys[i] === phys[i - 1]) fail(`${where}: ${bed}${phys[i]} is assigned twice`);
  }
  if (!phys.length || phys.some((p, i) => i > 0 && p !== phys[i - 1] + 1)) {
    fail(`${where}: ${bed} window is not one span [${phys.join(",")}]`);
  }
  return phys;
}

function windowText(stitches, plan, where) {
  const front = assignedPhys(stitches, plan, "F", where);
  const back = assignedPhys(stitches, plan, "B", where);
  const N = front.length + back.length;
  return {
    front,
    back,
    N,
    tF: Math.ceil(N / 2),
    tB: Math.floor(N / 2),
    text: `F${front.length}[${spanText(front)}] / B${back.length}[${spanText(back)}]`,
  };
}

function rackBed(stitches, plan, bed, delta, where) {
  const movers = [...stitches.values()].filter((st) => st.bed === bed).sort((a, b) => a.phys - b.phys);
  if (!movers.length) {
    // The other bed is not knitted yet. The ring is still walking, so the
    // planned needles slide and the coils are seated when that course knits.
    let moved = false;
    for (const slot of plan.values()) {
      if (slot.used || slot.bed !== bed) continue;
      if (slot.phys + delta < 0) fail(`${where}: rack would drop a planned ${bed} needle below 0`);
      slot.phys += delta;
      moved = true;
    }
    if (!moved) fail(`${where}: ${bed} has no needle to rack`);
    return [];
  }
  for (const st of movers) {
    if (st.phys + delta < 0) fail(`${where}: rack would drop ${bed}${st.phys} below 0`);
  }
  for (const slot of plan.values()) {
    if (slot.used || slot.bed !== bed) continue;
    if (slot.phys + delta < 0) fail(`${where}: rack would drop a planned ${bed} needle below 0`);
  }
  const token = moveToken(bed, 0, delta);
  const cells = movers.map((st) => ({
    col: columnForPhys(bed, st.phys),
    token,
    fill: FILL.xfer,
    phys: st.phys,
    bed,
    id: st.id,
    role: "rack",
  }));
  for (const st of movers) st.phys += delta;
  for (const slot of plan.values()) {
    if (slot.used || slot.bed !== bed) continue;
    slot.phys += delta;
  }
  assertNoShare(stitches, where);
  cells.sort((a, b) => a.col - b.col);
  return cells;
}

/** The arrow points at the bed the stitch lands on. The cell stays on the source needle. */
function flipToken(fromBed, toBed) {
  if (fromBed === "B" && toBed === "F") return "⬇";
  if (fromBed === "F" && toBed === "B") return "⬆";
  fail(`flip ${fromBed}→${toBed} is not a bed change`);
}

/**
 * Balance last. Seat the front on F0 (F−1 racks onto F0, it is not
 * dropped). A one-stitch count gap flips at the right fold onto the
 * same physical index. F17→B18 is not a flip. Equal counts one needle
 * apart rack the offset bed. An |F−B|=1 empty left on the right fold
 * racks the short bed so the gap sits at the left junction.
 */
export function balanceBeds(stitches, plan, where) {
  const fixes = [];
  const measure = () => windowText(stitches, plan, where);
  let win = measure();

  if (win.front[0] !== 0) {
    let guard = 0;
    while (win.front[0] !== 0) {
      if (++guard > 8) fail(`${where}: front ${spanText(win.front)} does not reach F0 one needle at a time`);
      const delta = win.front[0] > 0 ? -1 : 1;
      const before = win.text;
      const cells = rackBed(stitches, plan, "F", delta, where);
      win = measure();
      fixes.push({
        dir: "X",
        kind: "balance",
        cells,
        beds: before,
        note: `${where}: front seats toward F0 by ${delta > 0 ? "+1" : "−1"} (${before} → ${win.text}).`,
      });
    }
  }

  if (win.front.length !== win.tF || win.back.length !== win.tB) {
    const diff = win.front.length - win.tF;
    if (Math.abs(diff) !== 1) {
      fail(`${where}: ${win.text} is not F${win.tF}/B${win.tB}, and the gap is not one stitch`);
    }
    const longBed = diff > 0 ? "F" : "B";
    const shortBed = longBed === "F" ? "B" : "F";
    let longWin = longBed === "F" ? win.front : win.back;
    let shortWin = longBed === "F" ? win.back : win.front;
    let pair = longWin.at(-1);
    // Several decreases on one row can walk the short bed's low end up
    // while its high end stays past the flip index. Rack that bed back
    // to 0 one needle at a time, then the same-index flip can run.
    if (shortWin.includes(pair) && shortWin[0] > 0 && shortWin.at(-1) !== pair) {
      let guard = 0;
      while (shortWin[0] > 0) {
        if (++guard > 8) fail(`${where}: ${shortBed} low end ${shortWin[0]} does not reach 0`);
        const before = win.text;
        const cells = rackBed(stitches, plan, shortBed, -1, where);
        win = measure();
        fixes.push({
          dir: "X",
          kind: "balance",
          cells,
          beds: before,
          note: `${where}: rack ${shortBed} −1 so the low end returns toward 0 (${before} → ${win.text}).`,
        });
        longWin = longBed === "F" ? win.front : win.back;
        shortWin = longBed === "F" ? win.back : win.front;
        pair = longWin.at(-1);
      }
    }
    if (shortWin.includes(pair)) {
      if (shortWin.at(-1) !== pair || shortWin[0] < 1) {
        fail(`${where}: right-fold pair ${shortBed}${pair} is occupied and a −1 rack cannot clear it (${win.text})`);
      }
      const before = win.text;
      const cells = rackBed(stitches, plan, shortBed, -1, where);
      win = measure();
      fixes.push({
        dir: "X",
        kind: "balance",
        cells,
        beds: before,
        note: `${where}: clear ${shortBed}${pair} with a −1 rack before the same-index flip (${before} → ${win.text}).`,
      });
      longWin = longBed === "F" ? win.front : win.back;
      shortWin = longBed === "F" ? win.back : win.front;
    }
    const fromPhys = longWin.at(-1);
    const toPhys = fromPhys;
    if (fromPhys !== pair) fail(`${where}: long-bed high end moved off ${pair}`);
    if (shortWin.includes(toPhys)) fail(`${where}: flip target ${shortBed}${toPhys} is occupied`);
    const shortHi = shortWin.at(-1);
    const adjacent = shortHi + 1 === toPhys;
    const onePast = longWin[0] === 0 && toPhys === shortHi + 2 && !shortWin.includes(shortHi + 1);
    if (!adjacent && !onePast) {
      fail(`${where}: ${longBed}${fromPhys}→${shortBed}${toPhys} is not the empty right-fold pair`);
    }
    const candidates = [...stitches.values()].filter((st) => st.bed === longBed && st.phys === fromPhys);
    if (candidates.length !== 1) fail(`${where}: ${longBed}${fromPhys} is not one live stitch`);
    const st = candidates[0];
    if (st.phys !== toPhys) fail(`${where}: flip ${st.bed}${st.phys}→${shortBed}${toPhys} changes index`);
    const before = win.text;
    const rowCells = [
      {
        col: columnForPhys(st.bed, st.phys),
        token: flipToken(st.bed, shortBed),
        fill: FILL.flip,
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        role: "flip",
      },
    ];
    st.bed = shortBed;
    assertNoShare(stitches, where);
    if (!onePast) win = measure();
    fixes.push({
      dir: "Flip",
      kind: "flip",
      cells: rowCells,
      beds: before,
      note: `${where}: right-fold flip ${longBed}${fromPhys}→${shortBed}${toPhys} (same index).`,
    });
    if (onePast) {
      const from = st.phys;
      const dest = from - 1;
      const blocked = [...stitches.values()].some((other) => other !== st && other.bed === shortBed && other.phys === dest);
      if (blocked) fail(`${where}: ${shortBed}${dest} is occupied, the extra coil cannot step back`);
      const src = from;
      st.phys = dest;
      assertNoShare(stitches, where);
      win = measure();
      fixes.push({
        dir: "X",
        kind: "balance",
        cells: [
          {
            col: columnForPhys(shortBed, src),
            token: moveToken(shortBed, src, dest),
            fill: FILL.xfer,
            phys: src,
            bed: shortBed,
            id: st.id,
            role: "rack",
          },
        ],
        beds: before,
        note: `${where}: only ${shortBed}${src} steps to ${shortBed}${dest}.`,
      });
    }
  }

  win = measure();
  if (win.front[0] !== 0) fail(`${where}: front is not on F0 (${spanText(win.front)})`);
  if (win.tF === win.tB) {
    const offset = win.back[0] - win.front[0];
    const same = win.back.at(-1) - win.front.at(-1) === offset;
    if (offset === 0 && same) return fixes.filter((fix) => fix.cells.length);
    if (Math.abs(offset) !== 1 || !same) {
      fail(`${where}: equal counts are not one needle apart (${win.text})`);
    }
    const bed = win.front[0] === 0 ? "B" : "F";
    const delta = bed === "B" ? -offset : offset;
    const before = win.text;
    const cells = rackBed(stitches, plan, bed, delta, where);
    win = measure();
    fixes.push({
      dir: "X",
      kind: "balance",
      cells,
      beds: before,
      note: `${where}: counts match and the beds are one needle apart. Rack ${bed} ${delta > 0 ? "+" : ""}${delta} (${before} → ${win.text}).`,
    });
    return fixes.filter((fix) => fix.cells.length);
  }

  if (win.tF === win.tB + 1) {
    const frontFull = win.front[0] === 0 && win.front.at(-1) === win.tF - 1 && win.front.length === win.tF;
    const spareAtLeft = frontFull && win.back[0] === 1 && win.back.at(-1) === win.front.at(-1) && win.back.length === win.tB;
    if (spareAtLeft) return fixes.filter((fix) => fix.cells.length);
    const packed = frontFull && win.back[0] === 0 && win.back.at(-1) === win.tB - 1 && win.back.length === win.tB;
    if (!packed) fail(`${where}: the one-stitch gap is not a right-fold empty (${win.text})`);
    const before = win.text;
    const cells = rackBed(stitches, plan, "B", 1, where);
    win = measure();
    const seated = win.back[0] === 1 && win.back.at(-1) === win.front.at(-1);
    if (!seated) fail(`${where}: racking the back did not put the gap at the left fold (${win.text})`);
    fixes.push({
      dir: "X",
      kind: "balance",
      cells,
      beds: before,
      note: `${where}: the extra stitch is the fold gap. Rack the back +1 so the empty needle is at the left junction (${win.text}).`,
    });
    return fixes.filter((fix) => fix.cells.length);
  }
  fail(`${where}: F${win.tF}/B${win.tB} is not F≥B and |F−B|≤1`);
}

function neighbors(live, stitches, wale) {
  let left = null;
  let right = null;
  for (const [w, id] of live) {
    const st = stitches.get(id);
    if (w < wale && (!left || w > left.wale)) left = st;
    if (w > wale && (!right || w < right.wale)) right = st;
  }
  return { left, right };
}

function physInHole(left, right, where) {
  if (!left || !right) fail(`${where}: new stitch has no neighbors`);
  if (left.bed !== right.bed) fail(`${where}: new stitch sits between ${left.bed}${left.phys} and ${right.bed}${right.phys}`);
  const lo = Math.min(left.phys, right.phys);
  const hi = Math.max(left.phys, right.phys);
  if (hi !== lo + 2) fail(`${where}: hole is not one needle (${left.phys}…${right.phys})`);
  return { bed: left.bed, phys: lo + 1 };
}

function kindFill(kind, bed) {
  if (kind === "plain") return bed === "B" ? FILL.back : FILL.plain;
  if (kind === "wrap") return FILL.wrap;
  if (kind === "inc") return FILL.inc;
  if (kind === "wrapInc") return FILL.wrapInc;
  if (kind === "dec") return FILL.dec;
  if (kind === "wrapDec") return FILL.wrapDec;
  return FILL.plain;
}

function paint(bed, label, kind) {
  return { token: `${bed}${label}`, fill: kindFill(kind, bed) };
}

/**
 * One decrease transfer, starting at the second decrease cell.
 * `side` is R or L. R decreases the high end of this bed (higher
 * physical index): the receiving stitch and every loop above it step
 * one needle toward the low end, and the receiving stitch stacks onto
 * the first cell. L decreases the low end, the other way. The first
 * cell only receives. Call this again from the same physical needle
 * to stack the next loop onto that same cell.
 */
export function shiftFollowingLoops(stitches, start, side, where) {
  const bed = start.bed;
  const forward = side === "R" ? 1 : side === "L" ? -1 : 0;
  if (forward !== 1 && forward !== -1) fail(`${where}: decrease side ${side} is not R or L`);
  const step = -forward;
  const landingPhys = start.phys + step;
  const landing = [...stitches.values()].find((st) => st.bed === bed && st.phys === landingPhys);
  if (!landing) fail(`${where}: ${bed}${landingPhys} is not there to receive ${bed}${start.phys}`);
  if (landing.id === start.id) fail(`${where}: ${bed}${start.phys} would move onto itself`);
  const ahead = [...stitches.values()]
    .filter((st) => st.bed === bed && (st.phys - start.phys) * forward > 0)
    .sort((a, b) => (a.phys - b.phys) * forward);
  const moves = [{ id: start.id, bed, from: start.phys, to: landingPhys, stacked: true }];
  stitches.delete(start.id);
  for (const st of ahead) {
    const from = st.phys;
    const to = from + step;
    const occ = [...stitches.values()].find((other) => other.bed === bed && other.phys === to);
    if (occ) fail(`${where}: ${bed}${from}→${bed}${to} lands on ${occ.id}`);
    moves.push({ id: st.id, bed, from, to, stacked: false });
    st.phys = to;
  }
  assertNoShare(stitches, where);
  const token = moveToken(bed, 0, step);
  const cells = moves.map((m) => ({
    col: columnForPhys(bed, m.from),
    token,
    fill: FILL.xfer,
    phys: m.from,
    bed,
    id: m.id,
    role: "decrease",
    stacked: m.stacked,
  }));
  cells.sort((a, b) => a.col - b.col);
  return { cells, stackedId: start.id, moves, landingPhys, landingId: landing.id };
}

/**
 * Decrease transfer on the shaping bed only.
 * L moves the low end forward (higher index). R moves the high end
 * forward (lower index). The landing neighbor is not a source.
 * The stacked edge pair still moves: B0,B1 → B1,B2 when the low
 * end is chosen and B2 is free. An occupied landing receives the
 * inner stitch. That stack is drawn, then the inner leaves the bed.
 * The outer stitch still moves onto the needle the inner left.
 */
export function decreaseEdge(stitches, live, bed, end, where) {
  const onBed = [...stitches.values()].filter((st) => st.bed === bed).sort((a, b) => a.phys - b.phys);
  if (onBed.length < 2) fail(`${where}: ${bed} decrease needs an edge pair`);
  if (end !== "L" && end !== "R") fail(`${where}: decrease end ${end} is not L or R`);
  const low = end === "L";
  const edge = low ? onBed[0] : onBed.at(-1);
  const inner = low ? onBed[1] : onBed.at(-2);
  const step = low ? 1 : -1;
  if (inner.phys !== edge.phys + step) {
    fail(`${where}: ${bed} edge ${edge.phys} and ${inner.phys} are not one step apart`);
  }
  const landingPhys = inner.phys + step;
  const landing = onBed.find((st) => st.phys === landingPhys) || null;
  if (landing && (landing.id === edge.id || landing.id === inner.id)) {
    fail(`${where}: landing ${bed}${landingPhys} is a source`);
  }
  const moves = [];
  const consumed = [];
  if (landing) {
    moves.push({ id: inner.id, bed, from: inner.phys, to: landingPhys, stacked: true });
    consumed.push(inner.id);
    if (live && live.get(inner.wale) === inner.id) live.delete(inner.wale);
    stitches.delete(inner.id);
    const from = edge.phys;
    const to = from + step;
    const occ = [...stitches.values()].find((other) => other.bed === bed && other.phys === to);
    if (occ && occ.id !== edge.id) fail(`${where}: ${bed}${from}→${to} lands on ${occ.id}`);
    moves.push({ id: edge.id, bed, from, to, stacked: false });
    edge.phys = to;
  } else {
    for (const st of [inner, edge]) {
      const from = st.phys;
      const to = from + step;
      const occ = [...stitches.values()].find((other) => other.bed === bed && other.phys === to && other.id !== st.id);
      if (occ) fail(`${where}: ${bed}${from}→${to} lands on ${occ.id}`);
      moves.push({ id: st.id, bed, from, to, stacked: false });
      st.phys = to;
    }
  }
  assertNoShare(stitches, where);
  const token = moveToken(bed, 0, step);
  const cells = moves.map((m) => ({
    col: columnForPhys(bed, m.from),
    token,
    fill: FILL.xfer,
    phys: m.from,
    bed,
    id: m.id,
    role: "decrease",
    stacked: Boolean(m.stacked),
  }));
  cells.sort((a, b) => a.col - b.col);
  return { cells, consumed, moves, landingPhys, landingId: landing ? landing.id : null };
}

function shapeBedOf(fresh, live, stitches, where) {
  const beds = new Set();
  for (const wale of fresh) {
    const id = live.get(wale);
    if (id == null) fail(`${where}: increase hole wale ${wale} has no stitch to move`);
    beds.add(stitches.get(id).bed);
  }
  if (beds.size !== 1) fail(`${where}: increase hole crosses ${[...beds].join("/")}`);
  return [...beds][0];
}

function applyIncrease(live, stitches, pivot, step, shapeBed) {
  const delta = step === 1 ? 1 : -1;
  const next = new Map();
  const moves = [];
  const entries = [...live.entries()].sort((a, b) => a[0] - b[0]);
  for (const [wale, id] of entries) {
    let dest = wale;
    if (step === 1 && wale >= pivot) dest = wale + delta;
    if (step === -1 && wale <= pivot) dest = wale + delta;
    const st = stitches.get(id);
    if (dest !== wale && st.bed === shapeBed) {
      const chartDelta = dest - wale;
      const to = st.phys + (st.bed === "F" ? chartDelta : -chartDelta);
      moves.push({ id, bed: st.bed, from: st.phys, to, wale });
      st.phys = to;
    }
    if (next.has(dest)) fail(`increase collides on wale ${dest}`);
    st.wale = dest;
    next.set(dest, id);
  }
  moves.sort((a, b) => a.wale - b.wale);
  return { live: next, moves };
}

function liveWindow(stitches) {
  const { f, b, N } = listsOf(stitches);
  const side = (name, list) => {
    if (!list.length) return `${name}空`;
    return `${name}${list.length}[${spanText(list.map((st) => st.phys))}]`;
  };
  return `${N}针 · ${side("前", f)} · ${side("后", b)}`;
}

/**
 * Knit the first ring onto physical needles.
 * Increase transfers open every site before the one knit, then balance.
 * This ring has no decrease. A later ring decreases on the seated bed.
 */
function orderedCircle(stitches) {
  const front = [...stitches.values()].filter((st) => st.bed === "F").sort((a, b) => a.phys - b.phys);
  const back = [...stitches.values()].filter((st) => st.bed === "B").sort((a, b) => b.phys - a.phys);
  return [...front, ...back];
}

function stepCircle(stitch, dirSign, stitches) {
  const circle = orderedCircle(stitches);
  const at = circle.findIndex((st) => st.id === stitch.id);
  if (at < 0) fail("previous stitch is no longer on the bed");
  return circle[(at + dirSign + circle.length) % circle.length];
}

/** Keep each cell on its needle column. A mirror collision draws the later cell onward. */
function settleColumns(knitCells, dirSign, where) {
  const taken = new Set();
  for (const cell of knitCells) {
    let col = cell.col;
    let guard = 0;
    while (taken.has(col)) {
      if (++guard > knitCells.length + 2) fail(`${where}: visit-order columns do not fit`);
      col += dirSign;
    }
    cell.col = col;
    taken.add(col);
  }
}

function rekeyWale(stitches, live, stitch, wale, where) {
  if (live.get(wale) != null && live.get(wale) !== stitch.id) {
    fail(`${where}: wale ${wale} is already ${live.get(wale)}`);
  }
  if (live.get(stitch.wale) === stitch.id) live.delete(stitch.wale);
  stitch.wale = wale;
  live.set(wale, stitch.id);
}

/** The course cell takes this stitch. A previous owner of the wale lets go. */
function claimWale(live, stitches, stitch, wale) {
  const prior = live.get(wale);
  if (prior != null && prior !== stitch.id) {
    const other = stitches.get(prior);
    if (other && other.wale === wale) other.wale = null;
    live.delete(wale);
  }
  if (stitch.wale != null && stitch.wale !== wale && live.get(stitch.wale) === stitch.id) {
    live.delete(stitch.wale);
  }
  stitch.wale = wale;
  live.set(wale, stitch.id);
}

/**
 * Needles left by ring 0, in the wale numbers ring 1's walk uses.
 * F0 is wale 0. Wales at or after the increase pivot are the pre-shift
 * numbers; seatRing's increase moves them forward. B3..B0 keep the
 * negative wales from the leftward short row.
 */
export function ring0BedSeeds() {
  const seeds = [];
  for (let p = 0; p <= 18; p++) seeds.push({ bed: "F", phys: p, wale: p });
  for (let p = 18; p >= 4; p--) seeds.push({ bed: "B", phys: p, wale: 19 + (18 - p) });
  seeds.push({ bed: "B", phys: 3, wale: -4 });
  seeds.push({ bed: "B", phys: 2, wale: -3 });
  seeds.push({ bed: "B", phys: 1, wale: -2 });
  seeds.push({ bed: "B", phys: 0, wale: -1 });
  return seeds;
}

export function seatRing(courses, planInfo, carried = null) {
  const plan = planInfo?.plan || new Map();
  let live = new Map();
  const stitches = new Map();
  const sheet = [];
  const coursesOut = [];
  let nextId = 0;
  let prevEnd = null;

  const birth = (placed, wale, base) => {
    const id = nextId;
    nextId += 1;
    const st = { id, bed: placed.bed, phys: placed.phys, wale, base: Boolean(base) };
    stitches.set(id, st);
    live.set(wale, id);
    return st;
  };

  if (carried) {
    for (const seed of carried) birth({ bed: seed.bed, phys: seed.phys, base: true }, seed.wale, true);
  }

  let prevDir = null;
  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const fold = isFoldReturn(course, prevDir);
    const step = course.dir === 0 ? 1 : -1;
    const where = `course ${ci}`;
    const incs = course.cells.filter((c) => incAdded(c.label));
    const decs = course.cells.filter((c) => decAdded(c.label) && (c.kind === "dec" || c.kind === "wrapDec"));

    if (decs.length) fail(`${where}: decrease waits until the course reaches it, on a bed that is already seated`);

    const fresh = new Set();
    for (const cell of incs.slice().reverse()) {
      const added = incAdded(cell.label);
      const pivot = cell.wale + step;
      for (let g = 1; g <= added; g++) fresh.add(cell.wale + step * g);
      for (let k = 0; k < added; k++) {
        const shapeBed = shapeBedOf(fresh, live, stitches, where);
        const beds = liveWindow(stitches);
        const moved = applyIncrease(live, stitches, pivot, step, shapeBed);
        live = moved.live;
        if (!moved.moves.length) fail(`${where}: increase did not move the shaping bed`);
        const token = moveToken(shapeBed, moved.moves[0].from, moved.moves[0].to);
        if (moved.moves.some((m) => moveToken(m.bed, m.from, m.to) !== token || m.bed !== shapeBed)) {
          fail(`${where}: increase moves are not one partial shift of ${shapeBed}`);
        }
        assertNoShare(stitches, where);
        sheet.push({
          dir: "X+",
          kind: "increase",
          course: ci,
          cells: moved.moves.map((m) => ({
            col: columnForPhys(m.bed, m.from),
            token,
            fill: FILL.xfer,
            phys: m.from,
            bed: m.bed,
            id: m.id,
            role: "increase",
          })),
          beds,
          note: `${where}: partial increase move on ${shapeBed}, then the increase, balance after the knit.`,
        });
      }
    }

    const dirSign = course.dir === 0 ? 1 : -1;
    const knitBeds = liveWindow(stitches);
    // The increase transfer already opened every hole. Put the new
    // stitch on that needle before the knit, so a non-fold-return can
    // start there instead of on the previous end stitch.
    for (const wale of [...fresh].sort((a, b) => a - b)) {
      if (live.has(wale)) continue;
      const { left, right } = neighbors(live, stitches, wale);
      const placed = physInHole(left, right, `${where} wale ${wale}`);
      birth(placed, wale, false);
      assertNoShare(stitches, where);
    }
    const knitCells = [];
    const used = new Set();
    let prevKnit = null;
    for (let index = 0; index < course.cells.length; index++) {
      const cell = course.cells[index];
      let st = null;
      if (index === 0 && prevEnd) {
        const endSt = stitches.get(prevEnd.id);
        if (!endSt) fail(`${where}: previous end stitch left the bed`);
        // Direction reversed: the end stitch, on the needle it occupies
        // after transfers. Same direction: one needle further. Do not
        // stay on the end needle, and do not step off it on a reversal.
        st = fold ? endSt : stepCircle(endSt, dirSign, stitches);
        claimWale(live, stitches, st, cell.wale);
      } else {
        let id = live.get(cell.wale);
        if (id != null && used.has(id)) id = null;
        if (id == null && carried && !fresh.has(cell.wale)) {
          if (!prevKnit) fail(`${where}: wale ${cell.wale} has no previous stitch to wrap onto`);
          const next = stepCircle(prevKnit, dirSign, stitches);
          rekeyWale(stitches, live, next, cell.wale, where);
          id = next.id;
        }
        if (id == null && fresh.has(cell.wale) && prevKnit) {
          st = stepCircle(prevKnit, dirSign, stitches);
          claimWale(live, stitches, st, cell.wale);
        }
        if (!st && id == null) {
          let placed;
          const slot = plan.get(cell.wale);
          if (!placed && slot && !slot.used) {
            slot.used = true;
            placed = { bed: slot.bed, phys: slot.phys, base: true };
          } else if (!placed && fresh.has(cell.wale) && !live.has(cell.wale)) {
            const { left, right } = neighbors(live, stitches, cell.wale);
            placed = physInHole(left, right, `${where} wale ${cell.wale}`);
          } else if (!placed && prevKnit) {
            st = stepCircle(prevKnit, dirSign, stitches);
            claimWale(live, stitches, st, cell.wale);
          } else if (!placed) fail(`${where} wale ${cell.wale} is neither a base stitch nor this increase`);
          if (!st && placed) {
            st = birth(placed, cell.wale, placed.base);
            assertNoShare(stitches, where);
          }
        }
        if (!st && id != null) st = stitches.get(id);
      }
      if (!st || !stitches.has(st.id)) fail(`${where}: wale ${cell.wale} has no stitch`);
      if (used.has(st.id)) fail(`${where}: stitch ${st.id} is knitted twice`);
      used.add(st.id);
      prevKnit = st;
      const painted = paint(st.bed, cell.label, cell.kind);
      knitCells.push({
        col: columnForPhys(st.bed, st.phys),
        token: painted.token,
        fill: painted.fill,
        phys: st.phys,
        bed: st.bed,
        id: st.id,
        role: "knit",
        label: cell.label,
        tIdx: cell.tIdx,
      });
    }
    const seenNeedle = new Set();
    for (const cell of knitCells) {
      const key = `${cell.bed}:${cell.phys}`;
      if (seenNeedle.has(key)) fail(`${where}: ${cell.bed}${cell.phys} is knitted twice in one course`);
      seenNeedle.add(key);
    }
    settleColumns(knitCells, dirSign, where);
    const start = knitCells[0];
    const end = knitCells.at(-1);
    if (prevEnd && fold) {
      const endSt = stitches.get(prevEnd.id);
      if (!endSt) fail(`${where}: fold-return lost the previous end stitch`);
      if (start.id !== endSt.id) {
        fail(
          `${where}: fold-return starts at ${start.bed}${start.phys}, not the end stitch ${endSt.bed}${endSt.phys}`,
        );
      }
    } else if (prevEnd) {
      const endSt = stitches.get(prevEnd.id);
      if (!endSt) fail(`${where}: previous end stitch left the bed`);
      if (start.id === endSt.id) {
        fail(`${where}: a course that is not a fold-return stays on the end stitch ${endSt.bed}${endSt.phys}`);
      }
      const further = stepCircle(endSt, dirSign, stitches);
      if (start.id !== further.id) {
        fail(
          `${where}: start ${start.bed}${start.phys} is not one needle further than ${endSt.bed}${endSt.phys} (${further.bed}${further.phys})`,
        );
      }
    }
    sheet.push({
      dir: course.dir === 0 ? "R" : "L",
      kind: "knit",
      course: ci,
      cells: knitCells,
      beds: knitBeds,
    });
    coursesOut.push({
      course: ci,
      dir: course.dir === 0 ? "R" : "L",
      start: `${start.bed}${start.phys}`,
      end: `${end.bed}${end.phys}`,
      n: knitCells.length,
    });
    prevEnd = { id: end.id, bed: end.bed, phys: end.phys };

    if (incs.length) {
      const fixes = balanceBeds(stitches, plan, where);
      for (const fix of fixes) {
        sheet.push({
          dir: fix.dir,
          kind: fix.kind,
          course: ci,
          cells: fix.cells,
          beds: fix.beds,
          note: fix.note,
        });
      }
      const endSt = stitches.get(prevEnd.id);
      if (endSt) prevEnd = { id: endSt.id, bed: endSt.bed, phys: endSt.phys };
    }
    prevDir = course.dir;
  }

  if (!carried) {
    for (const slot of plan.values()) {
      if (!slot.used) fail(`a base stitch was never knitted (${slot.bed}${slot.phys})`);
    }
  }
  const seated = windowText(stitches, plan, "seated");
  const liveNow = listsOf(stitches);
  if (seated.front[0] !== 0) fail(`seated front does not start at F0 (${spanText(seated.front)})`);
  if (seated.front.length !== seated.tF || seated.back.length !== seated.tB) {
    fail(`seated ${seated.text} is not F${seated.tF}/B${seated.tB}`);
  }
  return {
    sheet,
    courses: coursesOut,
    seated,
    live: liveNow,
    baseN: carried ? carried.length : planInfo.n,
    baseFront: carried ? carried.filter((seed) => seed.bed === "F").length : planInfo.frontN,
    baseBack: carried ? carried.filter((seed) => seed.bed === "B").length : planInfo.backN,
  };
}

/**
 * Ring 1 continues on the bed ring 0 left behind.
 * Seeds are the live needles in right-going order, starting at F0.
 * A new wale steps one needle along that circle. Increase transfers
 * open every site first, then the whole row is knitted once. A shift
 * moves the course cell with its stitch onto the new needle; the turn
 * ends the row there. Balance
 * runs after that knit, and the next course uses the post-balance
 * needles. A decrease of hang n is n+1 cells. Knit through the last
 * of them. The transfer starts at the first dot and repeats from that
 * same needle n times, stacking onto the first cell. A decrease is
 * finished when that transfer is done, so balance runs before the
 * remaining stitches. Those stitches are the next course, counted on
 * the post-balance window.
 */
export function seatContinuation(courses, seeds, prevDir = null, carried = null) {
  const stitches = carried ? carried.stitches : new Map();
  let nextId = carried ? carried.nextId : 0;
  if (!carried) {
    if (!seeds?.length) fail("continuation has no bed to seat");
    for (const seed of seeds) {
      const st = { id: nextId++, bed: seed.bed, phys: seed.phys, wale: null, base: true };
      stitches.set(st.id, st);
    }
  }
  const waleToId = carried ? carried.waleToId : new Map();
  const sheet = [];
  const coursesOut = [];
  let prevEnd = null;
  let cursor = carried ? carried.cursor : stitches.get(0);
  if (!cursor || !stitches.has(cursor.id)) fail("continuation has no cursor");

  const liveFromWales = () => {
    const live = new Map();
    for (const st of stitches.values()) {
      if (st.wale != null) live.set(st.wale, st.id);
    }
    return live;
  };

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const step = course.dir === 0 ? 1 : -1;
    const dirSign = course.dir === 0 ? 1 : -1;
    const where = `course ${ci}`;
    const incs = course.cells.filter((c) => incAdded(c.label));
    const decs = course.cells.filter((c) => decAdded(c.label) && (c.kind === "dec" || c.kind === "wrapDec"));
    const fresh = new Set();
    for (const cell of incs) {
      const added = incAdded(cell.label);
      for (let g = 1; g <= added; g++) fresh.add(cell.wale + step * g);
    }

    const fold = isFoldReturn(course, prevDir);
    const bindWalk = () => {
      const placed = [];
      let at = cursor;
      course.cells.forEach((cell, index) => {
        if (index === 0 && fold) {
          if (!cursor || !stitches.has(cursor.id)) fail(`${where}: fold-return has no end stitch`);
          at = cursor;
        } else if (index === 0 && waleToId.size === 0) at = cursor;
        else if (index === 0) {
          // Direction did not reverse. One needle further in this course's
          // direction. Do not stay on the end stitch the wale still names.
          const endSt = cursor && stitches.get(cursor.id);
          if (!endSt) fail(`${where}: previous end stitch left the bed`);
          at = stepCircle(endSt, dirSign, stitches);
        } else {
          if (!at) fail(`${where}: walk has no cursor`);
          if (fresh.has(cell.wale) && waleToId.has(cell.wale) && stitches.get(waleToId.get(cell.wale))?.base === false) {
            at = stitches.get(waleToId.get(cell.wale));
          } else at = stepCircle(at, dirSign, stitches);
        }
        if (at.wale != null && at.wale !== cell.wale && waleToId.get(at.wale) === at.id) waleToId.delete(at.wale);
        const prior = waleToId.get(cell.wale);
        if (prior != null && prior !== at.id) {
          const other = stitches.get(prior);
          if (other && other.wale === cell.wale) other.wale = null;
        }
        waleToId.set(cell.wale, at.id);
        at.wale = cell.wale;
        placed.push({ cell, id: at.id });
      });
      return placed;
    };

    const finishKnit = (knitCells) => {
      const seenNeedle = new Set();
      for (const cell of knitCells) {
        const key = `${cell.bed}:${cell.phys}`;
        if (seenNeedle.has(key)) {
          const seq = knitCells.map((c) => `${c.token}@${c.bed}${c.phys}`).join(" ");
          fail(`${where}: ${cell.bed}${cell.phys} is knitted twice in one course (${seq})`);
        }
        seenNeedle.add(key);
      }
      settleColumns(knitCells, dirSign, where);
    };

    if (decs.length && incs.length) fail(`${where}: a course does not increase and decrease together`);

    if (decs.length) {
      const prefix = [];
      let knitBeds = null;
      const transfers = [];
      const notes = [];
      const pending = [];
      let courseStart = null;
      let knitted = 0;
      let at = cursor;
      let spanLeft = 0;
      let spanHang = 0;
      let spanSide = "";
      let spanBed = "";
      let pastSpan = false;
      let firstId = null;
      let recvBed = "";
      let recvPhys = null;
      course.cells.forEach((cell, index) => {
        if (index === 0) {
          if (fold) {
            if (!cursor || !stitches.has(cursor.id)) fail(`${where}: fold-return has no end stitch`);
            at = cursor;
          } else if (waleToId.size === 0) at = cursor;
          else {
            const endSt = cursor && stitches.get(cursor.id);
            if (!endSt) fail(`${where}: previous end stitch left the bed`);
            at = stepCircle(endSt, dirSign, stitches);
          }
        }
        const st = at;
        if (!st || !stitches.has(st.id)) fail(`${where}: walk has no cursor`);
        if (st.wale != null && st.wale !== cell.wale && waleToId.get(st.wale) === st.id) waleToId.delete(st.wale);
        waleToId.set(cell.wale, st.id);
        st.wale = cell.wale;
        if (!knitBeds) knitBeds = liveWindow(stitches);
        const nDec = decAdded(cell.label);
        const isHeader = nDec && (cell.kind === "dec" || cell.kind === "wrapDec");
        // R removes the high physical end, L the low end. On the front the
        // carriage moves toward higher needles when the course goes right;
        // on the back it moves toward lower needles. The letter follows
        // that end, so a right-going decrease on the back is L.
        let label = cell.label;
        if (isHeader) {
          const towardHigh = (st.bed === "F" ? dirSign : -dirSign) > 0;
          spanSide = towardHigh ? "R" : "L";
          label = `-${spanSide}${nDec}`;
        }
        const painted = paint(st.bed, label, cell.kind);
        if (pastSpan) {
          pending.push({ cell, id: st.id });
        } else {
          prefix.push({
            col: columnForPhys(st.bed, st.phys),
            token: painted.token,
            fill: painted.fill,
            phys: st.phys,
            bed: st.bed,
            id: st.id,
            role: "knit",
            label,
            tIdx: cell.tIdx,
          });
        }
        if (isHeader) {
          if (pastSpan) fail(`${where}: a later decrease on this course is not split around its own transfer`);
          if (spanLeft) fail(`${where}: a decrease span started inside another`);
          firstId = st.id;
          spanHang = nDec;
          spanLeft = nDec;
          spanBed = st.bed;
          recvBed = "";
          recvPhys = null;
        } else if (spanLeft > 0) {
          if (cell.kind !== "dec" || st.bed !== spanBed) {
            fail(`${where}: decrease span expected a ${spanBed} dot, got ${cell.kind} ${st.bed}${st.phys}`);
          }
          if (recvPhys == null) {
            recvBed = st.bed;
            recvPhys = st.phys;
          }
          spanLeft -= 1;
        }
        if (spanHang && spanLeft === 0) {
          const first = stitches.get(firstId);
          if (!first) fail(`${where}: the first decrease cell left the bed`);
          if (recvPhys == null) fail(`${where}: decrease has no receiving needle`);
          const recvName = `${recvBed}${recvPhys}`;
          const movedNotes = [];
          const passes = spanHang;
          for (let k = 0; k < passes; k++) {
            const beds = liveWindow(stitches);
            const source = [...stitches.values()].find((item) => item.bed === recvBed && item.phys === recvPhys);
            if (!source) fail(`${where}: ${recvName} has no loop for decrease pass ${k + 1}`);
            const moved = shiftFollowingLoops(stitches, source, spanSide, `${where} decrease ${k + 1}`);
            if (moved.landingId !== first.id) {
              fail(`${where}: pass ${k + 1} stacked onto ${moved.landingId}, not the first needle ${first.bed}${first.phys}`);
            }
            if (moved.moves[0].from !== recvPhys) fail(`${where}: pass ${k + 1} did not start at ${recvName}`);
            for (const [wale, mapped] of [...waleToId]) {
              if (mapped === moved.stackedId) waleToId.delete(wale);
            }
            const stack = moved.moves[0];
            const rest = moved.moves.slice(1);
            let described = `${stack.bed}${stack.from} 套到 ${stack.bed}${stack.to}`;
            if (rest.length) {
              const tails = rest.map((m) => `${m.bed}${m.from}`);
              described += `，${tails[0]}…${tails.at(-1)} 各退一针`;
            }
            movedNotes.push(described);
            transfers.push({
              dir: "X",
              kind: "decrease",
              course: ci,
              cells: moved.cells,
              beds,
              note: `${where}: 第 ${k + 1} 次移圈从 ${recvName} 起。${described}。都套上第一格 ${first.bed}${first.phys}，第一格不是移圈源。`,
            });
          }
          const spanCells = prefix.slice(-passes - 1);
          const drawnSpan = spanCells.map((c) => `${c.token}@${c.bed}${c.phys}`).join(" ");
          const more = course.cells.slice(index + 1).some((item) => decAdded(item.label) && (item.kind === "dec" || item.kind === "wrapDec"));
          let line = `${where}: 先织到减针最后一格。减 ${passes} 针占 ${passes + 1} 格，都是减针色：${drawnSpan}。然后从 ${recvName} 起移 ${passes} 次（${movedNotes.join("；")}）。`;
          spanHang = 0;
          if (more) {
            // Another decrease is still on this row. Keep knitting it
            // after the transfer. Balance waits until the row's shaping ends.
            line += `这一行还有减针，移圈之后接着织，整床平衡等这一行的减针做完。`;
            notes.push(line);
            if (!prefix.length) fail(`${where}: decrease row has no knit cells`);
            finishKnit(prefix);
            if (!courseStart) courseStart = prefix[0];
            knitted += prefix.length;
            const dirName = course.dir === 0 ? "R" : "L";
            sheet.push({
              dir: dirName,
              kind: "knit",
              course: ci,
              cells: prefix.slice(),
              beds: knitBeds,
              note: notes.join(" "),
            });
            for (const row of transfers) sheet.push(row);
            prefix.length = 0;
            transfers.length = 0;
            notes.length = 0;
            knitBeds = null;
            pastSpan = false;
            at = stepCircle(first, dirSign, stitches);
            if (!at || !stitches.has(at.id)) fail(`${where}: the next needle after the decrease is not on the bed`);
            if (at.id === first.id) fail(`${where}: continuation returned to the first decrease cell`);
          } else {
            line += `移圈一结束就平衡床位。`;
            pastSpan = true;
            if (index + 1 < course.cells.length) {
              at = stepCircle(first, dirSign, stitches);
              if (!at || !stitches.has(at.id)) fail(`${where}: the next needle after the decrease is not on the bed`);
              if (at.id === first.id) fail(`${where}: continuation returned to the first decrease cell`);
              line += ` 剩下的针是下一课，针号等平衡之后再数。`;
            } else {
              line += ` 减针格后面没有剩下的针。`;
            }
            notes.push(line);
          }
        } else if (index + 1 < course.cells.length) {
          at = stepCircle(st, dirSign, stitches);
          if (!at || !stitches.has(at.id)) fail(`${where}: the next needle is not on the bed`);
        }
      });
      if (!prefix.length) fail(`${where}: decrease row has no knit cells`);
      finishKnit(prefix);
      const seenId = new Set();
      for (const cell of prefix) {
        if (seenId.has(cell.id)) fail(`${where}: stitch ${cell.id} is knitted twice`);
        seenId.add(cell.id);
      }
      for (const item of pending) {
        if (seenId.has(item.id)) fail(`${where}: stitch ${item.id} is knitted twice`);
        seenId.add(item.id);
      }
      const start = courseStart || prefix[0];
      const dirName = course.dir === 0 ? "R" : "L";
      sheet.push({
        dir: dirName,
        kind: "knit",
        course: ci,
        cells: prefix,
        beds: knitBeds,
        note: notes.join(" "),
      });
      for (const row of transfers) sheet.push(row);
      const fixes = balanceBeds(stitches, new Map(), where);
      for (const fix of fixes) {
        sheet.push({
          dir: fix.dir,
          kind: fix.kind,
          course: ci,
          cells: fix.cells,
          beds: fix.beds,
          note: fix.note,
        });
      }
      let endId = firstId;
      let restCount = pending.length;
      if (pending.length) {
        const continuation = pending.map((item) => {
          const st = stitches.get(item.id);
          if (!st) fail(`${where}: a remaining stitch left the bed during balance`);
          const painted = paint(st.bed, item.cell.label, item.cell.kind);
          return {
            col: columnForPhys(st.bed, st.phys),
            token: painted.token,
            fill: painted.fill,
            phys: st.phys,
            bed: st.bed,
            id: st.id,
            role: "knit",
            label: item.cell.label,
            tIdx: item.cell.tIdx,
          };
        });
        finishKnit(continuation);
        restCount = continuation.length;
        const first = continuation[0];
        const last = continuation.at(-1);
        endId = last.id;
        sheet.push({
          dir: dirName,
          kind: "knit",
          course: ci,
          cells: continuation,
          beds: liveWindow(stitches),
          note: `${where}: 平衡之后的下一课，从 ${first.bed}${first.phys} 织到 ${last.bed}${last.phys}。`,
        });
      }
      const endSt = stitches.get(endId);
      if (!endSt) fail(`${where}: the row end left the bed`);
      const knitEnd = `${endSt.bed}${endSt.phys}`;
      coursesOut.push({
        course: ci,
        dir: dirName,
        start: `${start.bed}${start.phys}`,
        end: knitEnd,
        n: knitted + prefix.length + restCount,
      });
      cursor = endSt;
      prevEnd = { id: endSt.id, bed: endSt.bed, phys: endSt.phys };
    }

    const placed = decs.length ? [] : bindWalk();
    for (const cell of incs.slice().reverse()) {
      const added = incAdded(cell.label);
      const marker = stitches.get(waleToId.get(cell.wale));
      if (!marker) fail(`${where}: increase ${cell.label} has no stitch`);
      const { list, i } = (() => {
        const list = orderedCircle(stitches);
        return { list, i: list.findIndex((st) => st.id === marker.id) };
      })();
      const pivotSt = list[(i + dirSign + list.length) % list.length];
      for (const st of stitches.values()) st.wale = orderedCircle(stitches).findIndex((item) => item.id === st.id);
      const pivot = pivotSt.wale;
      for (let k = 0; k < added; k++) {
        const live = liveFromWales();
        const beds = liveWindow(stitches);
        const moved = applyIncrease(live, stitches, pivot, step, marker.bed);
        if (!moved.moves.length) fail(`${where}: increase did not move the shaping bed`);
        const token = moveToken(marker.bed, moved.moves[0].from, moved.moves[0].to);
        sheet.push({
          dir: "X+",
          kind: "increase",
          course: ci,
          cells: moved.moves.map((m) => ({
            col: columnForPhys(m.bed, m.from),
            token,
            fill: FILL.xfer,
            phys: m.from,
            bed: m.bed,
            id: m.id,
            role: "increase",
          })),
          beds,
          note: `${where}: partial increase move on ${marker.bed}, then the increase, balance after the knit.`,
        });
      }
      const hole = orderedCircle(stitches);
      const markerAt = hole.findIndex((st) => st.id === marker.id);
      const newborn = {
        id: nextId++,
        bed: marker.bed,
        phys: marker.phys + (marker.bed === "F" ? dirSign : -dirSign),
        wale: cell.wale + step,
        base: false,
      };
      const occupied = [...stitches.values()].some((st) => st.bed === newborn.bed && st.phys === newborn.phys);
      if (occupied) fail(`${where}: increase hole ${newborn.bed}${newborn.phys} is occupied`);
      stitches.set(newborn.id, newborn);
      waleToId.set(newborn.wale, newborn.id);
      void markerAt;
    }

    let knitPlan = null;
    if (!decs.length) {
      let shiftFrom = null;
      let shapeBed = null;
      knitPlan = [];
      for (const item of placed) {
        const cell = item.cell;
        let id = fresh.has(cell.wale) ? waleToId.get(cell.wale) : item.id;
        if (fresh.has(cell.wale)) {
          shiftFrom = item.id;
          shapeBed = stitches.get(item.id)?.bed || null;
        } else if (shiftFrom != null) {
          const current = stitches.get(item.id);
          const displaced = stitches.get(shiftFrom);
          if (current && displaced && current.bed === shapeBed) {
            id = shiftFrom;
            shiftFrom = item.id;
          } else if (displaced) {
            // The shift pushed this stitch past the last needle drawn on
            // the shaping bed. The course cell keeps its stitchmesh and
            // is drawn on the new needle. The row ends with that stitch.
            id = displaced.id;
            shiftFrom = null;
          }
        }
        const st = stitches.get(id);
        if (!st) continue;
        knitPlan.push({ cell, id: st.id });
      }
    }

    if (knitPlan) {
      const knitBeds = liveWindow(stitches);
      const knitCells = [];
      for (const item of knitPlan) {
        const st = stitches.get(item.id);
        if (!st) fail(`${where}: knit stitch ${item.id} left the bed`);
        const painted = paint(st.bed, item.cell.label, item.cell.kind);
        knitCells.push({
          col: columnForPhys(st.bed, st.phys),
          token: painted.token,
          fill: painted.fill,
          phys: st.phys,
          bed: st.bed,
          id: st.id,
          role: "knit",
          label: item.cell.label,
          tIdx: item.cell.tIdx,
        });
      }
      finishKnit(knitCells);
      const start = knitCells[0];
      const end = knitCells.at(-1);
      sheet.push({
        dir: course.dir === 0 ? "R" : "L",
        kind: "knit",
        course: ci,
        cells: knitCells,
        beds: knitBeds,
      });
      coursesOut.push({
        course: ci,
        dir: course.dir === 0 ? "R" : "L",
        start: `${start.bed}${start.phys}`,
        end: `${end.bed}${end.phys}`,
        n: knitCells.length,
      });
      cursor = stitches.get(end.id);
      prevEnd = { id: end.id, bed: end.bed, phys: end.phys };
    }

    if (incs.length) {
      const fixes = balanceBeds(stitches, new Map(), where);
      for (const fix of fixes) {
        sheet.push({
          dir: fix.dir,
          kind: fix.kind,
          course: ci,
          cells: fix.cells,
          beds: fix.beds,
          note: fix.note,
        });
      }
      const endSt = stitches.get(prevEnd.id);
      if (endSt) {
        cursor = endSt;
        prevEnd = { id: endSt.id, bed: endSt.bed, phys: endSt.phys };
      }
    }
    prevDir = course.dir;
  }

  const seated = windowText(stitches, new Map(), "seated");
  if (seated.front[0] !== 0) fail(`seated front does not start at F0 (${spanText(seated.front)})`);
  if (seated.front.length !== seated.tF || seated.back.length !== seated.tB) {
    fail(`seated ${seated.text} is not F${seated.tF}/B${seated.tB}`);
  }
  const frontN = carried
    ? [...stitches.values()].filter((st) => st.bed === "F").length
    : seeds.filter((seed) => seed.bed === "F").length;
  const backN = carried
    ? [...stitches.values()].filter((st) => st.bed === "B").length
    : seeds.filter((seed) => seed.bed === "B").length;
  return {
    sheet,
    courses: coursesOut,
    seated,
    live: listsOf(stitches),
    baseN: frontN + backN,
    baseFront: frontN,
    baseBack: backN,
    bed: { stitches, waleToId, cursor, nextId },
  };
}

function icvForFill(fill) {
  const m = String(fill || "").match(/rgb\((\d+),(\d+),(\d+)\)/i);
  if (!m) return 1;
  const rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
  const idx = BIFF8_DEFAULT_PALETTE.findIndex((c, i) => i < 64 && c[0] === rgb[0] && c[1] === rgb[1] && c[2] === rgb[2]);
  if (idx < 0) fail(`no palette color for ${fill}`);
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

function sheetBytes(name, rows, xfIndexForFill) {
  const parts = [bof(0x0010)];
  for (const row of rows) {
    row.forEach((cell, c) => {
      const xf = xfIndexForFill(cell.fill || FILL.plain);
      if (typeof cell.value === "number") parts.push(numberRecord(cell.r, c, xf, cell.value));
      else parts.push(labelRecord(cell.r, c, xf, cell.value ?? ""));
    });
  }
  parts.push(eof());
  return { name, bytes: Buffer.concat(parts) };
}

function writeCfb(workbook) {
  const sectorSize = 4096;
  const dataSectors = Math.ceil(workbook.length / sectorSize) || 1;
  const totalSectors = 2 + dataSectors;
  if (totalSectors > 1024) fail(`workbook needs ${totalSectors} sectors`);
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

function collectRows(header, needles, bodyRows, matrixes) {
  const rows = [];
  const head = [{ r: 0, value: header, fill: FILL.plain }];
  needles.forEach((n) => head.push({ r: 0, value: n, fill: FILL.plain }));
  head.push({ r: 0, value: "此刻活针", fill: FILL.plain });
  rows.push(head);
  bodyRows.forEach((row, i) => {
    const line = [{ r: i + 1, value: row.dir, fill: FILL.plain }];
    for (const needle of needles) {
      const cell = row.byCol.get(needle);
      line.push({
        r: i + 1,
        value: cell?.token || "",
        fill: cell?.token ? cell.fill : FILL.empty,
      });
    }
    line.push({ r: i + 1, value: row.beds || "", fill: FILL.plain });
    rows.push(line);
  });
  const extras = matrixes.map((matrix) =>
    matrix.map((line, r) => line.map((value) => ({ r, value: value ?? "", fill: FILL.plain }))),
  );
  return { bedRows: rows, extras };
}

export function renderReport(built) {
  const lines = [];
  lines.push(built.title || "faces_ring0 step4 床图（只含第一环）");
  lines.push(built.inputLine || "输入只有 faces_ring_layout.json 的 ring 0（types 和 hangs）。加减针数是该项的 n_extra，不是缺省 1。");
  lines.push("Step1、Step2、Step3 的 xls / txt / map 都不是输入，没有读取、没有拼接，也没有把它们的列号、负列或标签当成针号。");
  lines.push(`底圈 N=${built.baseN}，拆成 F=${built.baseFront}、B=${built.baseBack}。前床低端是物理针 F0。差 1 针时多出来的那一针是折返空档。`);
  if (built.afterFirst) {
    lines.push(`第一环落座之后 N=${built.afterFirst.N}，窗 ${built.afterFirst.text}。`);
  }
  if (built.afterSecond) {
    lines.push(`第二环结束 N=${built.afterSecond.N}，窗 ${built.afterSecond.text}。`);
  }
  lines.push(
    `${built.afterSecond ? "第三环结束" : built.afterFirst ? "两环结束" : "落座之后"} N=${built.seated.N}，窗 ${built.seated.text}。目标 F=${built.seated.tF} / B=${built.seated.tB}。`,
  );
  lines.push("针号是 F# / B#。合图时后床列 = 37 − 物理针，这只是画法，不是从 Step3 抄来的列。");
  lines.push(built.afterSecond ? "第四环起没有填。" : built.ringBreak ? "第三环起没有填。" : "后面的环没有填。");
  lines.push("");
  lines.push("行程（织行）起点针、终点针：");
  for (const course of built.courses) {
    lines.push(`  course ${course.course} ${course.dir}  start ${course.start}  end ${course.end}  （${course.n} 针）`);
  }
  lines.push("");
    lines.push("表行（格子按织的顺序，不是按表列从左到右）：");
  built.sheet.forEach((row, i) => {
    const cells = row.cells.map((c) => `${c.token}@${c.bed}${c.phys}`).join(" ");
    lines.push(`  row ${i} ${row.dir}  这一行开始时 ${row.beds}`);
    lines.push(`    ${cells}`);
    if (row.note) lines.push(`    ${row.note}`);
  });
  lines.push("");
  lines.push(
    built.afterSecond
      ? "第二环从第一环的下一针 F0 接在这张表里。第三环不重新落座，第一针是第二环结束之后沿本行方向的下一针；换环本身不是折返。一行相对上一行反向才是折返。每一次折返短行单独成课。第四环起不填。"
      : built.ringBreak
        ? "第二环从第一环的下一针 F0 接在这张表里。每一次折返短行单独成课。第三环起不填。"
        : "每一次折返短行单独成课。一行相对上一行反向才是折返，第一针停在上一行终点针在移圈和整床移动之后所占的那一针。方向没有反向的下一行，从那一针沿本行方向再走一针。走完这一环的项之后，下一针是下一环的起点，这里不填。",
  );
  const breaks = built.ringBreaks || (built.ringBreak != null ? [built.ringBreak] : []);
  const names = ["第一环", "第二环", "第三环"];
  const parts = breaks.length
    ? breaks.concat(built.types).map((end, i) => {
        const at = i === 0 ? 0 : breaks[i - 1];
        return { name: names[i] || `第${i + 1}环`, types: built.termTypes.slice(at, end), hangs: built.hangs.slice(at, end), at };
      })
    : [{ name: "", types: built.termTypes, hangs: built.hangs, at: 0 }];
  if (built.afterSecond) {
    let prevDir = null;
    built.sheet.forEach((row, i) => {
      if (row.dir !== "R" && row.dir !== "L") return;
      if (row.course < built.courses.length - built.ring2Courses) {
        prevDir = row.dir;
        return;
      }
      const fold = prevDir != null && row.dir !== prevDir;
      const start = row.cells[0];
      lines.push(
        `  第三环 row ${i} course ${row.course} ${row.dir} 起点 ${start.bed}${start.phys} ${fold ? "折返" : "续走"}`,
      );
      prevDir = row.dir;
    });
  }
  for (const part of parts) {
    const shaping = part.types
      .map((t, i) => ({ i: i + part.at, t, h: part.hangs[i] }))
      .filter((x) => x.t === 3 || x.t === 4 || x.t === 5 || x.t === 6 || x.t === 7 || x.t === 8);
    const shapingText = shaping.map((x) => `term ${x.i} Type ${x.t} hang ${x.h}`).join("，");
    lines.push(`${part.name ? part.name + " " : ""}加减针 hang（n_extra）：${shapingText || "无"}。`);
    const shapingOther = shaping.filter((x) => x.h !== 1);
    if (shapingOther.length) {
      lines.push(`其中 hang 不是 1 的：${shapingOther.map((x) => `term ${x.i} hang ${x.h}`).join("，")}。`);
    } else {
      lines.push(part.name ? `${part.name}里没有 hang 不是 1 的项。` : "加减针里没有 hang 不是 1 的项。");
    }
  }
  const other = built.hangs
    .map((h, i) => ({ i, h, t: built.termTypes[i] }))
    .filter((x) => x.h !== 1 && !(x.t === 3 || x.t === 4 || x.t === 5 || x.t === 6 || x.t === 7 || x.t === 8));
  lines.push(`其余 ${other.length} 项不是加减针，hang 为 0。`);
  return `${lines.join("\n")}\n`;
}

function assertChart(built) {
  const knit = built.sheet.filter((row) => row.kind === "knit");
  if (knit.length !== built.courses.length) fail("knit rows and course report diverged");
  for (const row of built.sheet) {
    for (const cell of row.cells) {
      if (/^[FB][←→]1$/.test(cell.token)) fail(`1-needle transfer must omit the number: ${cell.token}`);
      if (cell.role === "flip") {
        const target = cell.token === "⬇" ? "F" : "B";
        if (cell.bed === target) fail("flip did not change bed");
      }
    }
    if (row.kind === "flip") {
      if (row.cells.length !== 1) fail("a flip moves one stitch");
      const cell = row.cells[0];
      if (cell.token !== "⬇" && cell.token !== "⬆") fail(`flip token ${cell.token}`);
    }
  }
  if (built.seated.front[0] !== 0) fail("seated front low end is not F0");
  if (Math.abs(built.seated.front.length - built.seated.back.length) > 1) fail("seated |F−B| > 1");
  if (built.seated.front.length < built.seated.back.length) fail("seated front is shorter than the back");
  const later = built.sheet.some((row) => /ring\s*1|第二环/.test(row.note || ""));
  if (later) fail("later ring was filled");
}

export function buildFromFacesRing(path = DEFAULT_PATHS.facesRing) {
  const ring = loadRing0(path);
  const courses = coursesFromTypes(ring.types, ring.hangs);
  const base = baseWalesOf(courses);
  const planInfo = planBeds(base);
  const seated = seatRing(courses, planInfo);
  assertChart(seated);
  return {
    ...seated,
    nRings: ring.nRings,
    types: ring.types.length,
    termTypes: ring.types,
    hangs: ring.hangs,
  };
}

function shiftTerm(cell, offset) {
  const next = { ...cell };
  if (Number.isInteger(next.tIdx)) next.tIdx += offset;
  if (Array.isArray(next.extraIdx)) next.extraIdx = next.extraIdx.map((term) => term + offset);
  return next;
}

function loadJoinedRing(layout, index) {
  const ring = layout.rings?.[index];
  if (!ring) fail(`faces_ring has no ring ${index}`);
  const types = ring.types?.map((t) => Number(t));
  const hangs = ring.hangs?.map((n) => Number(n));
  if (!types || types.length !== ring.n_terms || !hangs || hangs.length !== types.length) {
    fail(`ring ${index} types and hangs do not match`);
  }
  hangs.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 0) fail(`ring ${index} term ${i} hang ${n} is not a non-negative integer`);
  });
  return { types, hangs };
}

function shiftSheet(rows, courseOffset, termOffset) {
  return rows.map((row) => ({
    ...row,
    course: row.course + courseOffset,
    note: row.note ? row.note.replace(/course (\d+)/g, (_, n) => `course ${Number(n) + courseOffset}`) : row.note,
    cells: row.cells.map((cell) => shiftTerm(cell, termOffset)),
  }));
}

/** Rings 0, 1, and 2 on one bed. Ring 2 keeps ring 1's stitches. */
export function buildJoinedChart(path = DEFAULT_PATHS.facesRing) {
  const first = buildFromFacesRing(path);
  const layout = JSON.parse(readFileSync(path, "utf8"));
  const ring1 = loadJoinedRing(layout, 1);
  const seeds = [];
  for (let p = 0; p <= 18; p++) seeds.push({ bed: "F", phys: p });
  for (let p = 18; p >= 0; p--) seeds.push({ bed: "B", phys: p });
  const last = first.courses.at(-1);
  const prevDir = last ? (last.dir === "R" ? 0 : 1) : null;
  const second = seatContinuation(coursesFromTypes(ring1.types, ring1.hangs), seeds, prevDir);
  const ring2 = loadJoinedRing(layout, 2);
  const prev2 = second.courses.at(-1);
  const prevDir2 = prev2 ? (prev2.dir === "R" ? 0 : 1) : null;
  const third = seatContinuation(coursesFromTypes(ring2.types, ring2.hangs), null, prevDir2, second.bed);
  const n0 = first.courses.length;
  const n1 = second.courses.length;
  const term1 = first.types + ring1.types.length;
  const sheet = [
    ...first.sheet,
    ...shiftSheet(second.sheet, n0, first.types),
    ...shiftSheet(third.sheet, n0 + n1, term1),
  ];
  return {
    sheet,
    courses: [
      ...first.courses,
      ...second.courses.map((course) => ({ ...course, course: course.course + n0 })),
      ...third.courses.map((course) => ({ ...course, course: course.course + n0 + n1 })),
    ],
    seated: third.seated,
    afterFirst: first.seated,
    afterSecond: second.seated,
    baseN: first.baseN,
    baseFront: first.baseFront,
    baseBack: first.baseBack,
    types: term1 + ring2.types.length,
    termTypes: [...first.termTypes, ...ring1.types, ...ring2.types],
    hangs: [...first.hangs, ...ring1.hangs, ...ring2.hangs],
    ringBreak: first.types,
    ringBreaks: [first.types, term1],
    ring2Courses: third.courses.length,
    sheetName: "ring0",
    title: "faces_ring step4 床图（第一环、第二环、第三环接在一起）",
    inputLine:
      "输入只有 faces_ring_layout.json 的 ring 0、ring 1 和 ring 2（types 和 hangs）。第二环从第一环结束的下一针 F0 接着织。第三环不重新落座，第一针是第二环结束之后的下一针。加减针数是该项的 n_extra。",
  };
}

export function workbookBytes(built) {
  const cols = built.sheet.flatMap((row) => row.cells.map((c) => c.col));
  const lo = Math.min(...cols);
  const hi = Math.max(...cols);
  const needles = [];
  for (let n = lo; n <= hi; n++) needles.push(n);
  const body = built.sheet.map((row) => ({
    dir: row.dir,
    beds: row.beds,
    byCol: new Map(row.cells.map((c) => [c.col, c])),
  }));
  const courseRows = [["course", "dir", "start", "end", "stitches"]];
  for (const course of built.courses) {
    courseRows.push([String(course.course), course.dir, course.start, course.end, String(course.n)]);
  }
  courseRows.push([]);
  courseRows.push(["baseN", String(built.baseN), `F${built.baseFront}`, `B${built.baseBack}`]);
  courseRows.push(["seatedN", String(built.seated.N), `F${built.seated.tF}`, `B${built.seated.tB}`, built.seated.text]);
  courseRows.push(["input", built.afterSecond ? "faces_ring rings 0, 1, and 2" : built.ringBreak ? "faces_ring ring 0 then ring 1" : "faces_ring ring 0 only"]);
  courseRows.push(["not_input", "Step1 Step2 Step3 xls txt maps"]);
  const legendRows = [
    ["input", built.inputLine || "faces_ring_layout.json rings[0].types and hangs[] (Term.remain / n_extra). Hang is not defaulted to 1."],
    ["not_input", "Step1, Step2, and Step3 xls/txt/maps were not read, joined, or used as column hints."],
    ["scope", built.afterSecond ? "Rings 0, 1, and 2 on one sheet. Ring 2 continues the seated bed. Later rings are not filled." : built.ringBreak ? "Ring 0 and ring 1 on one sheet. Later rings are not filled." : "First faces_ring only. Later rings are not filled."],
    ["N", `Base circumference ${built.baseN} splits F${built.baseFront}/B${built.baseBack}. After the ring is seated, N=${built.seated.N}, ${built.seated.text}. Front low end is F0.`],
    ["draw", "Front column = physical needle. Back column = 37 - phys. That drawing convention is not a Step3 column."],
    ["此刻活针", "Last column is how many stitches are already seated when the row starts. 0针 means the beds are still empty. It is not a needle number."],
    ["phys", "Sheet phys copies the bed and physical needle already tracked on each cell."],
    ["faces", "Sheet faces maps a knit cell to the ring-0 KnittingStitches face. Face index is the term index. Step3 columns are not used."],
    ["move", "1 needle omits the number (F→, B←). A number appears only for 2 or more."],
    ["flip", "Right fold only, same physical index."],
  ];
  const faceOffset = built.faceOffset || 0;
  const physRows = [["sheetRow", "sheetCol", "bed", "phys"]];
  const faceRows = [["sheetRow", "sheetCol", "face"]];
  built.sheet.forEach((row, sheetRow) => {
    for (const cell of row.cells) {
      if ((cell.bed === "F" || cell.bed === "B") && Number.isInteger(cell.phys)) {
        physRows.push([sheetRow, cell.col, cell.bed, cell.phys]);
      }
      if (Number.isInteger(cell.tIdx) || (Array.isArray(cell.extraIdx) && cell.extraIdx.length)) {
        const terms = [];
        if (Number.isInteger(cell.tIdx)) terms.push(cell.tIdx);
        if (Array.isArray(cell.extraIdx)) terms.push(...cell.extraIdx);
        for (const term of terms) faceRows.push([sheetRow, cell.col, faceOffset + term]);
      }
    }
  });
  const knitFaces = new Set(faceRows.slice(1).map((row) => row[2]));
  for (let i = 0; i < built.types; i++) {
    if (!knitFaces.has(faceOffset + i)) fail(`term ${i} has no knit cell on the chart`);
  }
  const { bedRows, extras } = collectRows("dir\\col", needles, body, [courseRows, legendRows, physRows, faceRows]);
  const fills = new Set([FILL.plain]);
  for (const row of [...bedRows, ...extras.flat()]) {
    for (const cell of row) if (cell.fill) fills.add(cell.fill);
  }
  const palette = [...fills];
  const xfIndexForFill = (fill) => {
    const i = palette.indexOf(fill || FILL.plain);
    if (i < 0) fail(`missing xf for ${fill}`);
    return i;
  };
  const sheets = [
    sheetBytes(built.sheetName || "ring0", bedRows, xfIndexForFill),
    sheetBytes("courses", extras[0], xfIndexForFill),
    sheetBytes("legend", extras[1], xfIndexForFill),
    sheetBytes("phys", extras[2], xfIndexForFill),
    sheetBytes("faces", extras[3], xfIndexForFill),
  ];
  const xfBytes = Buffer.concat(palette.map((fill) => xfRecord(icvForFill(fill))));
  const bofBytes = bof(0x0005);
  const eofBytes = eof();
  const boundsheetLen = sheets.reduce((sum, sheet) => sum + boundsheet(0, sheet.name).length, 0);
  const globalLen = bofBytes.length + xfBytes.length + boundsheetLen + eofBytes.length;
  let cursor = globalLen;
  const bounds = sheets.map((sheet) => {
    const at = cursor;
    cursor += sheet.bytes.length;
    return boundsheet(at, sheet.name);
  });
  const workbook = Buffer.concat([bofBytes, xfBytes, ...bounds, eofBytes, ...sheets.map((sheet) => sheet.bytes)]);
  return writeCfb(workbook);
}

function selfCheckNegativeSeat() {
  const stitches = new Map([[0, { id: 0, bed: "F", phys: 0, wale: 0 }]]);
  const live = new Map([[0, 0]]);
  applyIncrease(live, stitches, 0, -1, "F");
  if (stitches.get(0).phys !== -1) fail(`increase must keep F−1, got ${stitches.get(0).phys}`);
  stitches.set(1, { id: 1, bed: "B", phys: 0, wale: 1 });
  const plan = new Map();
  const fixes = balanceBeds(stitches, plan, "F−1 seat");
  if (stitches.get(0).phys !== 0 || stitches.get(0).bed !== "F") {
    fail(`balance must seat the kept stitch on F0, got ${stitches.get(0).bed}${stitches.get(0).phys}`);
  }
  if (!fixes.some((fix) => fix.cells.some((cell) => cell.token === "F→"))) {
    fail("seating F−1 onto F0 should be a 1-needle F→");
  }
}

function selfCheckDecreaseSpan() {
  const courses = coursesFromTypes([3, 0], [1, 0]);
  const cells = courses[0].cells;
  if (cells.length !== 3) fail(`hang-1 decrease should add a dot cell, got ${cells.length}`);
  if (cells[0].label !== "-R1" || cells[0].kind !== "dec") fail(`decrease header ${cells[0].label}/${cells[0].kind}`);
  if (cells[1].label !== "·" || cells[1].kind !== "dec" || cells[1].tIdx !== cells[0].tIdx) {
    fail(`decrease dot ${cells[1].label}/${cells[1].kind}`);
  }
  const wider = coursesFromTypes([3], [2]);
  if (wider[0].cells.length !== 3 || wider[0].cells[0].label !== "-R2") {
    fail(`hang-2 decrease span ${wider[0].cells.map((c) => c.label)}`);
  }
  if (!wider[0].cells.slice(1).every((c) => c.kind === "dec" && c.label === "·")) {
    fail("hang-2 decrease dots are not plain decrease cells");
  }
}

function selfCheckFollowingLoops() {
  const stitches = new Map();
  for (let phys = 0; phys <= 5; phys++) stitches.set(phys, { id: phys, bed: "F", phys, wale: phys });
  const moved = shiftFollowingLoops(stitches, stitches.get(2), "R", "transfer starts at the receiving needle");
  const phys = [...stitches.values()].map((st) => st.phys).sort((a, b) => a - b);
  if (phys.join(",") !== "0,1,2,3,4") fail(`following loops phys ${phys}`);
  if (stitches.has(2)) fail("the receiving needle should leave the bed");
  if (stitches.get(1).phys !== 1) fail("the first needle should stay and only receive");
  if (moved.landingId !== 1 || moved.landingPhys !== 1) fail("the loop did not stack onto the first needle");
  if (moved.moves.some((m) => m.id === 1)) fail("the first decrease cell is a transfer source");
  const drawn = [...moved.cells].sort((a, b) => a.phys - b.phys).map((c) => `${c.token}@${c.phys}${c.stacked ? "*" : ""}`).join(",");
  if (drawn !== "F←@2*,F←@3,F←@4,F←@5") fail(`following loops drew ${drawn}`);
  if (moved.cells.some((c) => /1$/.test(c.token))) fail("1-needle transfer must omit the number");
}

function selfCheckDoubleDecrease() {
  const stitches = new Map();
  for (let phys = 0; phys <= 5; phys++) stitches.set(phys, { id: phys, bed: "F", phys, wale: phys });
  const recvPhys = 2;
  for (let k = 0; k < 2; k++) {
    const source = [...stitches.values()].find((st) => st.bed === "F" && st.phys === recvPhys);
    const moved = shiftFollowingLoops(stitches, source, "R", `double decrease ${k + 1}`);
    if (moved.moves[0].from !== recvPhys || moved.landingId !== 1 || moved.landingPhys !== 1) {
      fail(`pass ${k + 1} did not start at F2 and stack onto F1`);
    }
  }
  const ids = [...stitches.values()].map((st) => st.id).sort((a, b) => a - b);
  if (ids.join(",") !== "0,1,4,5") fail(`two passes should stack F2 and F3 onto F1, left ${ids}`);
  if (stitches.get(1).phys !== 1) fail("the first needle moved");
  const phys = [...stitches.values()].map((st) => st.phys).sort((a, b) => a - b);
  if (phys.join(",") !== "0,1,2,3") fail(`double stack phys ${phys}`);
}

function assertRunningDecrease(built) {
  const rows = built.sheet;
  const hits = [];
  rows.forEach((row, index) => {
    if (row.kind !== "knit") return;
    const dec = row.cells.find((cell) => decAdded(cell.label || ""));
    if (dec) hits.push({ index, row, dec });
  });
  if (hits.length !== 6) fail(`expected six knitted decreases, got ${hits.length}`);
  for (const { index, row, dec } of hits) {
    const prev = rows[index - 1];
    if (prev && prev.kind === "decrease" && prev.course !== row.course) {
      fail(`decrease at ${dec.bed}${dec.phys} moved the bed before the knit reached it`);
    }
    const hang = decAdded(dec.label || "");
    const decAt = row.cells.indexOf(dec);
    const span = row.cells.slice(decAt, decAt + hang + 1);
    if (span.length !== hang + 1) fail(`decrease ${dec.label} does not occupy ${hang + 1} cells`);
    if (row.cells.length !== decAt + span.length) {
      fail(`course ${row.course} kept knitting after the last decrease cell`);
    }
    if (span.some((cell) => cell.fill !== FILL.dec || cell.bed !== dec.bed)) {
      fail(`decrease span at ${dec.bed}${dec.phys} is not all decrease-colored on that bed`);
    }
    if (span.slice(1).some((cell) => cell.label !== "·")) fail(`decrease ${dec.label} dot is not a plain dot`);
    const side = decSide(dec.label || "");
    const forward = side === "R" ? 1 : -1;
    for (let i = 1; i < span.length; i++) {
      if (span[i].phys !== span[0].phys + forward * i) fail(`decrease span is not consecutive at ${dec.bed}${dec.phys}`);
    }
    const first = span[0];
    const recv = span[1];
    const arrow = forward > 0 ? "←" : "→";
    for (let k = 0; k < hang; k++) {
      const shift = rows[index + 1 + k];
      if (!shift || shift.kind !== "decrease") fail(`decrease pass ${k + 1} after ${recv.bed}${recv.phys} is missing`);
      if (!shift.cells.length || shift.cells.some((cell) => cell.token !== `${dec.bed}${arrow}` || cell.bed !== dec.bed)) {
        fail(`transfer ${k + 1} from ${recv.bed}${recv.phys} did not step back on that bed`);
      }
      const stack = shift.cells.find((cell) => cell.stacked);
      if (!stack || stack.phys !== recv.phys) {
        fail(`pass ${k + 1} does not start at the receiving needle ${recv.bed}${recv.phys}`);
      }
      if (shift.cells.some((cell) => cell.phys === first.phys)) {
        fail(`the first decrease cell is a transfer source at ${first.bed}${first.phys}`);
      }
    }
    const afterX = index + 1 + hang;
    let cursor = afterX;
    while (
      rows[cursor] &&
      rows[cursor].course === row.course &&
      rows[cursor].kind !== "knit"
    ) {
      cursor += 1;
    }
    const later = rows[cursor] && rows[cursor].kind === "knit" && rows[cursor].course === row.course ? rows[cursor] : null;
    if (!later && rows.slice(afterX, cursor).some((item) => item.kind === "knit")) {
      fail(`course ${row.course} knitted again before balance`);
    }
    const between = rows.slice(afterX, cursor);
    if (between.some((item) => item.kind === "knit")) {
      fail(`course ${row.course} knitted the rest of the row before balance`);
    }
    const laterIsNextDecrease = later && later.cells.some((cell) => decAdded(cell.label || ""));
    if (laterIsNextDecrease) {
      if (between.some((item) => item.kind === "balance" || item.kind === "flip")) {
        fail(`course ${row.course} balanced before a later decrease on the same row`);
      }
      continue;
    }
    const knitted = later ? [...row.cells, ...later.cells] : row.cells;
    if (dec.bed === "F" && knitted.some((cell) => cell.bed === "B")) {
      fail(`front decrease row appended the back-bed tail`);
    }
    if (later && later.cells.some((cell) => span.some((item) => item.id === cell.id))) {
      fail(`a decrease cell is knitted again`);
    }
    const endRow = later || row;
    const nextKnit = rows.slice(cursor + (later ? 1 : 0)).find((item) => item.kind === "knit");
    if (!nextKnit) fail(`course ${row.course} has no following row`);
    if (nextKnit.course === row.course) fail(`course ${row.course} has another knit after the remaining row`);
    const reversed = nextKnit.dir !== endRow.dir;
    if (reversed && nextKnit.cells[0].id !== endRow.cells.at(-1).id) {
      fail(`course ${row.course} fold-return does not start on the end stitch`);
    }
    if (!reversed && nextKnit.cells[0].id === endRow.cells.at(-1).id) {
      fail(`course ${row.course} stayed on the end stitch without reversing`);
    }
    const tail = rows.slice(cursor + (later ? 1 : 0), rows.indexOf(nextKnit));
    if (tail.some((item) => item.course === row.course && (item.kind === "flip" || item.kind === "balance"))) {
      fail(`course ${row.course} balanced after the remaining knit`);
    }
  }
}

function selfCheckDecrease() {
  const stitches = new Map();
  const live = new Map();
  for (const [id, phys] of [[0, 0], [1, 1]]) {
    stitches.set(id, { id, bed: "B", phys, wale: phys });
    live.set(phys, id);
  }
  const moved = decreaseEdge(stitches, live, "B", "L", "decrease example");
  const phys = [...stitches.values()].map((st) => st.phys).sort((a, b) => a - b);
  if (phys.join(",") !== "1,2") fail(`B0,B1 should move onto B1,B2, got ${phys}`);
  if (moved.moves.some((m) => m.from === 2 || m.to === 0)) fail("landing or a backward step was a source");
  const tokens = new Set(moved.cells.map((c) => c.token));
  if (tokens.size !== 1 || ![...tokens][0].startsWith("B→")) fail(`edge pair token ${[...tokens]}`);
  if (/1$/.test([...tokens][0])) fail("1-needle decrease must omit the number");
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  selfCheckDecrease();
  selfCheckDecreaseSpan();
  selfCheckFollowingLoops();
  selfCheckDoubleDecrease();
  selfCheckNegativeSeat();
  const built = buildJoinedChart();
  assertRunningDecrease(built);
  const text = renderReport(built);
  const bytes = workbookBytes(built);
  if (check) {
    const prevXls = readFileSync(DEFAULT_PATHS.outXls);
    const prevTxt = readFileSync(DEFAULT_PATHS.outTxt, "utf8");
    if (!prevXls.equals(bytes) || prevTxt !== text) {
      fail("committed faces_ring0 bed chart does not match the generator");
    }
  } else {
    writeFileSync(DEFAULT_PATHS.outXls, bytes);
    writeFileSync(DEFAULT_PATHS.outTxt, text);
  }
  console.log(text);
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
