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
 * Course start is the previous course's end, plus transfers since.
 * Nothing moved → fold return on that needle. A whole-bed balance
 * leaves the next knit one needle outward from the seat, in the
 * travel direction, when the end stitch itself was consumed.
 * Increase: partial move, then the increase knit, then balance.
 * A stitch that would sit below 0 (F−1) is kept and balanced onto F0.
 * Decrease, once those stitches are already on the bed: knit up to
 * that stitch, transfer, then keep knitting the rest of the same row.
 * The landing needle is the inward neighbor. It only receives the
 * stitch: it is not a transfer source and it is not knitted again.
 * The rest of the row starts at the next needle past that landing,
 * in the travel direction. If balance then racks a whole bed by one,
 * that rest and the next row's start use the needle after the rack.
 * The pre-rack needle is not still occupied.
 * Flips only at the right fold, same physical index.
 * A 1-needle transfer omits the number (F→, B←).
 *
 * Later rings are not filled.
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
      const side = td === 0 ? "R" : "L";
      ensure(td);
      if (td !== direction && !occupied()) {
        direction = td;
        rows.at(-1).dir = td;
      }
      stackStart(i, t);
      emit(`-${side}${hang}`, "dec", i, t, 1);
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

function flipToken(fromBed, toBed) {
  if (fromBed === "F" && toBed === "B") return "⬇";
  if (fromBed === "B" && toBed === "F") return "⬆";
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
    const pair = longWin.at(-1);
    if (shortWin.includes(pair)) {
      if (shortWin.at(-1) !== pair || shortWin[0] < 1) {
        fail(`${where}: right-fold pair ${shortBed}${pair} is occupied and a −1 rack cannot clear it`);
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
    win = measure();
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
 * Decrease transfer on the shaping bed only.
 * L moves the low end forward (higher index). R moves the high end
 * forward (lower index). The landing neighbor is not a source.
 * The stacked edge pair still moves: B0,B1 → B1,B2 when the low
 * end is chosen and B2 is free. An occupied landing that is not a
 * source receives the inner stitch as the stack and that source is
 * consumed; the outer stitch still moves onto the needle it left.
 */
export function decreaseEdge(stitches, live, bed, end, where) {
  const onBed = [...stitches.values()].filter((st) => st.bed === bed).sort((a, b) => a.phys - b.phys);
  if (onBed.length < 2) fail(`${where}: ${bed} decrease needs an edge pair`);
  const low = end === "L";
  const edge = low ? onBed[0] : onBed.at(-1);
  const inner = low ? onBed[1] : onBed.at(-2);
  const landingPhys = low ? inner.phys + 1 : inner.phys - 1;
  const landing = onBed.find((st) => st.phys === landingPhys) || null;
  if (landing && (landing.id === edge.id || landing.id === inner.id)) {
    fail(`${where}: landing ${bed}${landingPhys} is a source`);
  }
  const step = low ? 1 : -1;
  const sources = [inner, edge];
  const consumed = [];
  if (landing) {
    consumed.push(inner.id);
    if (live.get(inner.wale) === inner.id) live.delete(inner.wale);
    stitches.delete(inner.id);
  }
  const moves = [];
  const ordered = landing ? [edge] : [inner, edge];
  for (const st of ordered) {
    const from = st.phys;
    const to = from + step;
    const occ = [...stitches.values()].find((other) => other.bed === bed && other.phys === to);
    if (occ && occ.id !== st.id) fail(`${where}: ${bed}${from}→${to} lands on ${occ.id}`);
    moves.push({ id: st.id, bed, from, to });
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
  }));
  cells.sort((a, b) => a.col - b.col);
  return { cells, consumed, moves, landingPhys };
}

/**
 * The course has already knitted the decrease stitch. Every needle on
 * that bed still ahead of it steps one needle back toward it. The
 * nearest lands on the decrease stitch: that is the loop from behind,
 * and it is drawn, then taken off the bed. The rest of the tail fills
 * the gap. `dirSign` is +1 when the course travels right.
 */
export function shiftTailTowardDecrease(stitches, marker, dirSign, where) {
  const bed = marker.bed;
  const forward = bed === "F" ? dirSign : -dirSign;
  if (forward !== 1 && forward !== -1) fail(`${where}: bad travel`);
  const behind = [...stitches.values()]
    .filter((st) => st.bed === bed && (st.phys - marker.phys) * forward > 0)
    .sort((a, b) => (a.phys - b.phys) * forward);
  if (!behind.length) fail(`${where}: ${bed}${marker.phys} has no needle behind it to decrease`);
  const step = -forward;
  const incoming = behind[0];
  const fromIn = incoming.phys;
  const toIn = fromIn + step;
  if (toIn !== marker.phys) {
    fail(`${where}: ${bed}${fromIn} does not stack onto ${bed}${marker.phys}`);
  }
  const moves = [{ id: incoming.id, bed, from: fromIn, to: toIn, stacked: true }];
  stitches.delete(incoming.id);
  for (const st of behind.slice(1)) {
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
  return { cells, stackedId: incoming.id, moves };
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
 * Increase: partial move, knit, balance.
 * This ring has no decrease. A decrease on an already seated bed is
 * seated mid-course by shiftTailTowardDecrease.
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

function rekeyWale(stitches, live, stitch, wale, where) {
  if (live.get(wale) != null && live.get(wale) !== stitch.id) {
    fail(`${where}: wale ${wale} is already ${live.get(wale)}`);
  }
  if (live.get(stitch.wale) === stitch.id) live.delete(stitch.wale);
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

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
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

    const knitBeds = liveWindow(stitches);
    const knitCells = [];
    let prevKnit = null;
    for (const cell of course.cells) {
      let id = live.get(cell.wale);
      if (id == null && carried && !fresh.has(cell.wale)) {
        if (!prevKnit) fail(`${where}: wale ${cell.wale} has no previous stitch to wrap onto`);
        const dirSign = course.dir === 0 ? 1 : -1;
        const next = stepCircle(prevKnit, dirSign, stitches);
        rekeyWale(stitches, live, next, cell.wale, where);
        id = next.id;
      }
      if (id == null) {
        let placed;
        const slot = plan.get(cell.wale);
        if (slot && !slot.used) {
          slot.used = true;
          placed = { bed: slot.bed, phys: slot.phys, base: true };
        } else if (fresh.has(cell.wale)) {
          const { left, right } = neighbors(live, stitches, cell.wale);
          placed = physInHole(left, right, `${where} wale ${cell.wale}`);
        } else fail(`${where} wale ${cell.wale} is neither a base stitch nor this increase`);
        const st = birth(placed, cell.wale, placed.base);
        id = st.id;
        assertNoShare(stitches, where);
      }
      const st = stitches.get(id);
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
    const cols = knitCells.map((c) => c.col);
    if (new Set(cols).size !== cols.length) {
      // The course left the front and continued onto the facing back needles.
      // Mirror columns would stack those two beds. Draw the rest in visit order.
      const step = course.dir === 0 ? 1 : -1;
      let col = knitCells[0].col;
      const taken = new Set();
      for (const cell of knitCells) {
        let guard = 0;
        while (taken.has(col)) {
          if (++guard > knitCells.length + 2) fail(`${where}: visit-order columns do not fit`);
          col += step;
        }
        cell.col = col;
        taken.add(col);
        col += step;
      }
    }
    const start = knitCells[0];
    const end = knitCells.at(-1);
    // A fold-return starts on the previous end, after whatever transfers
    // happened since. The course after this ring is not filled.
    if (prevEnd && !incs.length && !decs.length) {
      const endSt = stitches.get(prevEnd.id);
      if (endSt && start.id !== prevEnd.id) {
        const travel = course.dir === 0 ? 1 : -1;
        const outward = endSt.bed === "F" ? travel : -travel;
        const seat = endSt.phys;
        const expected = seat + outward;
        if (start.bed === endSt.bed && start.phys !== seat && start.phys !== expected) {
          fail(
            `${where}: start ${start.bed}${start.phys} is neither the fold return ${endSt.bed}${seat} nor one needle outward (${endSt.bed}${expected})`,
          );
        }
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

    if (incs.length || decs.length) {
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
  }

  if (!carried) {
    for (const slot of plan.values()) {
      if (!slot.used) fail("a base stitch was never knitted");
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
 * A new wale steps one needle along that circle. An increase inserts one
 * needle before its knit. A decrease stays on one row: knit up to it,
 * transfer onto the inward neighbor, balance, then knit the rest of
 * that same row from the post-balance needle.
 */
export function seatContinuation(courses, seeds) {
  const stitches = new Map();
  let nextId = 0;
  for (const seed of seeds) {
    const st = { id: nextId++, bed: seed.bed, phys: seed.phys, wale: null, base: true };
    stitches.set(st.id, st);
  }
  const waleToId = new Map();
  const sheet = [];
  const coursesOut = [];
  let prevEnd = null;
  let cursor = stitches.get(0);

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

    const bindWalk = () => {
      const placed = [];
      let at = cursor;
      course.cells.forEach((cell, index) => {
        const known = waleToId.get(cell.wale);
        const still = known != null ? stitches.get(known) : null;
        if (index === 0 && still) at = still;
        else if (index === 0 && waleToId.size === 0) at = cursor;
        else {
          if (!at) fail(`${where}: walk has no cursor`);
          if (fresh.has(cell.wale) && waleToId.has(cell.wale) && stitches.get(waleToId.get(cell.wale))?.base === false) {
            at = stitches.get(waleToId.get(cell.wale));
          } else at = stepCircle(at, dirSign, stitches);
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
      const cols = knitCells.map((c) => c.col);
      if (new Set(cols).size !== cols.length) {
        const draw = course.dir === 0 ? 1 : -1;
        let col = knitCells[0].col;
        const taken = new Set();
        for (const cell of knitCells) {
          let guard = 0;
          while (taken.has(col)) {
            if (++guard > knitCells.length + 2) fail(`${where}: visit-order columns do not fit`);
            col += draw;
          }
          cell.col = col;
          taken.add(col);
          col += draw;
        }
      }
    };

    if (decs.length && incs.length) fail(`${where}: a course does not increase and decrease together`);

    if (decs.length) {
      const knitCells = [];
      let knitBeds = null;
      const transfers = [];
      const balances = [];
      const notes = [];
      let at = cursor;
      course.cells.forEach((cell, index) => {
        if (index === 0) {
          const known = waleToId.get(cell.wale);
          const still = known != null ? stitches.get(known) : null;
          if (still) at = still;
          else if (waleToId.size === 0) at = cursor;
          else at = stepCircle(cursor, dirSign, stitches);
        }
        const st = at;
        if (!st || !stitches.has(st.id)) fail(`${where}: walk has no cursor`);
        waleToId.set(cell.wale, st.id);
        st.wale = cell.wale;
        if (!knitBeds) knitBeds = liveWindow(stitches);
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
        const nDec = decAdded(cell.label);
        const isDec = nDec && (cell.kind === "dec" || cell.kind === "wrapDec");
        if (isDec) {
          const landBefore = `${st.bed}${st.phys}`;
          for (let k = 0; k < nDec; k++) {
            const beds = liveWindow(stitches);
            const moved = shiftTailTowardDecrease(stitches, st, dirSign, `${where} decrease ${k + 1}`);
            if (moved.moves.some((m) => m.id === st.id)) fail(`${where}: landing ${landBefore} was used as a transfer source`);
            for (const [wale, id] of [...waleToId]) {
              if (id === moved.stackedId) waleToId.delete(wale);
            }
            const stack = moved.moves[0];
            transfers.push({
              dir: "X",
              kind: "decrease",
              course: ci,
              cells: moved.cells,
              beds,
              note: `${where}: 落针 ${landBefore} 只接 ${stack.bed}${stack.from}，不是移圈源。`,
            });
          }
          const peek = index + 1 < course.cells.length ? stepCircle(st, dirSign, stitches) : null;
          const contBefore = peek ? `${peek.bed}${peek.phys}` : "";
          const fixes = balanceBeds(stitches, new Map(), where);
          for (const fix of fixes) balances.push(fix);
          const landAfter = `${st.bed}${st.phys}`;
          const peekAfter = index + 1 < course.cells.length ? stepCircle(st, dirSign, stitches) : null;
          const contAfter = peekAfter ? `${peekAfter.bed}${peekAfter.phys}` : "";
          if (peekAfter && peekAfter.id === st.id) fail(`${where}: the landing ${landAfter} would be knitted again`);
          let line = `${where}: 同一行。织到 ${landBefore}，移圈，再从落针的下一针接着织。落针只接圈。`;
          if (contBefore) {
            line += ` 平衡前接着织的下一针是 ${contBefore}，整床平衡后是 ${contAfter}。`;
            if (contBefore !== contAfter) line += ` 不再把 ${contBefore} 当成还占着这针。`;
            else if (fixes.length) line += ` 整床平衡没有改这一行后半段的针号。`;
          }
          if (landBefore !== landAfter) line += ` 落针随整床从 ${landBefore} 到 ${landAfter}。`;
          if (!fixes.length) line += ` 平衡没有再整床摇。`;
          notes.push(line);
        }
        if (index + 1 < course.cells.length) {
          at = stepCircle(st, dirSign, stitches);
          if (!at || !stitches.has(at.id)) fail(`${where}: the next needle is not on the bed`);
          if (isDec && at.id === st.id) fail(`${where}: continuation returned to the landing`);
        }
      });
      finishKnit(knitCells);
      const start = knitCells[0];
      const end = knitCells.at(-1);
      const endSt = stitches.get(end.id);
      if (!endSt) fail(`${where}: the row end left the bed`);
      const endNow = `${endSt.bed}${endSt.phys}`;
      if (end.bed !== endSt.bed || end.phys !== endSt.phys) {
        fail(`${where}: continuation cell ${end.bed}${end.phys} is not the post-balance needle ${endNow}`);
      }
      sheet.push({
        dir: course.dir === 0 ? "R" : "L",
        kind: "knit",
        course: ci,
        cells: knitCells,
        beds: knitBeds,
        note: `${notes.join(" ")} 这一行收到 ${endNow}，下一行从 ${endNow} 起。`,
      });
      coursesOut.push({
        course: ci,
        dir: course.dir === 0 ? "R" : "L",
        start: `${start.bed}${start.phys}`,
        end: endNow,
        n: knitCells.length,
      });
      for (const row of transfers) sheet.push(row);
      for (const fix of balances) {
        sheet.push({
          dir: fix.dir,
          kind: fix.kind,
          course: ci,
          cells: fix.cells,
          beds: fix.beds,
          note: fix.note,
        });
      }
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

    if (!decs.length) {
      let shiftFrom = null;
      let shapeBed = null;
      const knitBeds = liveWindow(stitches);
      const knitCells = [];
      for (const item of placed) {
        const cell = item.cell;
        let id = fresh.has(cell.wale) ? waleToId.get(cell.wale) : item.id;
        if (fresh.has(cell.wale)) {
          shiftFrom = item.id;
          shapeBed = stitches.get(item.id)?.bed || null;
        } else if (shiftFrom != null) {
          const current = stitches.get(item.id);
          if (current && current.bed === shapeBed) {
            id = shiftFrom;
            shiftFrom = item.id;
          } else shiftFrom = null;
        }
        const st = stitches.get(id);
        if (!st) continue;
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
      finishKnit(knitCells);
      const start = knitCells[0];
      const end = knitCells.at(-1);
      sheet.push({ dir: course.dir === 0 ? "R" : "L", kind: "knit", course: ci, cells: knitCells, beds: knitBeds });
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
      if (endSt) cursor = endSt;
    }
  }

  const seated = windowText(stitches, new Map(), "seated");
  if (seated.front[0] !== 0) fail(`seated front does not start at F0 (${spanText(seated.front)})`);
  if (seated.front.length !== seated.tF || seated.back.length !== seated.tB) {
    fail(`seated ${seated.text} is not F${seated.tF}/B${seated.tB}`);
  }
  const frontN = seeds.filter((seed) => seed.bed === "F").length;
  const backN = seeds.filter((seed) => seed.bed === "B").length;
  return {
    sheet,
    courses: coursesOut,
    seated,
    live: listsOf(stitches),
    baseN: seeds.length,
    baseFront: frontN,
    baseBack: backN,
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
  lines.push(
    `${built.afterFirst ? "两环结束" : "落座之后"} N=${built.seated.N}，窗 ${built.seated.text}。目标 F=${built.seated.tF} / B=${built.seated.tB}。`,
  );
  lines.push("针号是 F# / B#。合图时后床列 = 37 − 物理针，这只是画法，不是从 Step3 抄来的列。");
  lines.push(built.ringBreak ? "第三环起没有填。" : "后面的环没有填。");
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
    built.ringBreak
      ? "第二环从第一环的下一针 F0 接在这张表里。每一次折返短行单独成课。第三环起不填。"
      : "每一次折返短行单独成课，从上一针被移圈之后的那一针起。整床平衡把终点针收进一针时，下一课从落座后沿行程方向向外的那一针起。走完这一环的项之后，下一针是下一环的起点，这里不填。",
  );
  const parts = built.ringBreak
    ? [
        { name: "第一环", types: built.termTypes.slice(0, built.ringBreak), hangs: built.hangs.slice(0, built.ringBreak), at: 0 },
        { name: "第二环", types: built.termTypes.slice(built.ringBreak), hangs: built.hangs.slice(built.ringBreak), at: built.ringBreak },
      ]
    : [{ name: "", types: built.termTypes, hangs: built.hangs, at: 0 }];
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
        const target = cell.token === "⬇" ? "B" : "F";
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

/** Ring 0, then ring 1 on the same bed, one chart. */
export function buildJoinedChart(path = DEFAULT_PATHS.facesRing) {
  const first = buildFromFacesRing(path);
  const layout = JSON.parse(readFileSync(path, "utf8"));
  const ring = layout.rings[1];
  const types = ring.types.map((t) => Number(t));
  const hangs = ring.hangs.map((n) => Number(n));
  if (types.length !== ring.n_terms || hangs.length !== types.length) {
    fail("ring 1 types and hangs do not match");
  }
  const seeds = [];
  for (let p = 0; p <= 18; p++) seeds.push({ bed: "F", phys: p });
  for (let p = 18; p >= 0; p--) seeds.push({ bed: "B", phys: p });
  const second = seatContinuation(coursesFromTypes(types, hangs), seeds);
  const n0 = first.courses.length;
  const sheet = [
    ...first.sheet,
    ...second.sheet.map((row) => ({
      ...row,
      course: row.course + n0,
      note: row.note ? row.note.replace(/course (\d+)/g, (_, n) => `course ${Number(n) + n0}`) : row.note,
      cells: row.cells.map((cell) => shiftTerm(cell, first.types)),
    })),
  ];
  return {
    sheet,
    courses: [...first.courses, ...second.courses.map((course) => ({ ...course, course: course.course + n0 }))],
    seated: second.seated,
    afterFirst: first.seated,
    baseN: first.baseN,
    baseFront: first.baseFront,
    baseBack: first.baseBack,
    types: first.types + types.length,
    termTypes: [...first.termTypes, ...types],
    hangs: [...first.hangs, ...hangs],
    ringBreak: first.types,
    sheetName: "ring0",
    title: "faces_ring step4 床图（第一环和第二环接在一起）",
    inputLine:
      "输入只有 faces_ring_layout.json 的 ring 0 和 ring 1（types 和 hangs）。第二环从第一环结束的下一针 F0 接着织。加减针数是该项的 n_extra。",
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
  courseRows.push(["input", built.ringBreak ? "faces_ring ring 0 then ring 1" : "faces_ring ring 0 only"]);
  courseRows.push(["not_input", "Step1 Step2 Step3 xls txt maps"]);
  const legendRows = [
    ["input", built.inputLine || "faces_ring_layout.json rings[0].types and hangs[] (Term.remain / n_extra). Hang is not defaulted to 1."],
    ["not_input", "Step1, Step2, and Step3 xls/txt/maps were not read, joined, or used as column hints."],
    ["scope", built.ringBreak ? "Ring 0 and ring 1 on one sheet. Later rings are not filled." : "First faces_ring only. Later rings are not filled."],
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

function selfCheckContinueAfterRack() {
  const stitches = new Map();
  for (let phys = 0; phys <= 4; phys++) stitches.set(phys, { id: phys, bed: "F", phys, wale: phys });
  const marker = stitches.get(1);
  shiftTailTowardDecrease(stitches, marker, 1, "racked decrease");
  const before = stepCircle(marker, 1, stitches);
  if (`${before.bed}${before.phys}` !== "F2") fail(`pre-balance continue is ${before.bed}${before.phys}`);
  for (const st of stitches.values()) st.phys += 1;
  const after = stepCircle(marker, 1, stitches);
  if (after.id !== before.id) fail("the rack changed which stitch the row continues on");
  if (`${after.bed}${after.phys}` !== "F3") fail(`post-balance continue is ${after.bed}${after.phys}`);
  const parked = [...stitches.values()].find((st) => st.phys === 2);
  if (!parked || parked.id !== marker.id) fail("the pre-balance continue needle should now hold the landing");
}

function selfCheckTailDecrease() {
  const stitches = new Map();
  for (let phys = 0; phys <= 4; phys++) stitches.set(phys, { id: phys, bed: "F", phys, wale: phys });
  const moved = shiftTailTowardDecrease(stitches, stitches.get(2), 1, "tail decrease");
  const phys = [...stitches.values()].map((st) => st.phys).sort((a, b) => a - b);
  if (phys.join(",") !== "0,1,2,3") fail(`tail decrease phys ${phys}`);
  if (moved.stackedId !== 3) fail("the needle behind F2 should be the loop that stacks");
  if (moved.cells.map((c) => c.phys).join(",") !== "3,4") fail(`tail decrease drew ${moved.cells.map((c) => c.phys)}`);
  if (moved.cells.some((c) => c.token !== "F←")) fail(`tail token ${moved.cells.map((c) => c.token)}`);
  if (stitches.has(3)) fail("the stacked loop should leave the bed");
  const back = new Map();
  for (let p = 0; p <= 4; p++) back.set(p, { id: p, bed: "B", phys: p, wale: p });
  const backMove = shiftTailTowardDecrease(back, back.get(2), 1, "back tail");
  const backPhys = [...back.values()].map((st) => st.phys).sort((a, b) => a - b);
  if (backPhys.join(",") !== "1,2,3,4") fail(`back tail phys ${backPhys}`);
  if (backMove.stackedId !== 1 || backMove.cells[0].token !== "B→" || backMove.cells[0].phys !== 1) {
    fail(`back stack should be B1→B2, got ${backMove.cells.map((c) => `${c.token}@${c.phys}`)}`);
  }
}

function assertRunningDecrease(built) {
  const rows = built.sheet;
  const hits = [];
  rows.forEach((row, index) => {
    if (row.kind !== "knit") return;
    const dec = row.cells.find((cell) => decAdded(cell.label || ""));
    if (dec) hits.push({ index, row, dec });
  });
  if (hits.length !== 2) fail(`expected two knitted decreases, got ${hits.length}`);
  const seenCourse = new Set();
  for (const { index, row, dec } of hits) {
    if (seenCourse.has(row.course)) fail(`course ${row.course} split the decrease across two knit rows`);
    seenCourse.add(row.course);
    const prev = rows[index - 1];
    if (prev && prev.kind === "decrease") fail(`decrease at ${dec.bed}${dec.phys} moved the bed before the knit reached it`);
    const shift = rows[index + 1];
    if (!shift || shift.kind !== "decrease") fail(`decrease at ${dec.bed}${dec.phys} is not followed by the tail shift`);
    if (shift.cells.some((cell) => cell.bed === dec.bed && cell.phys === dec.phys)) {
      fail(`landing ${dec.bed}${dec.phys} is a transfer source`);
    }
    const forward = dec.bed === "F" ? (row.dir === "R" ? 1 : -1) : row.dir === "R" ? -1 : 1;
    const stackPhys = dec.phys + forward;
    const stack = shift.cells.find((cell) => cell.bed === dec.bed && cell.phys === stackPhys);
    if (!stack) fail(`missing the loop that stacks from ${dec.bed}${stackPhys} onto ${dec.bed}${dec.phys}`);
    const arrow = forward > 0 ? "←" : "→";
    if (shift.cells.some((cell) => cell.token !== `${dec.bed}${arrow}` || cell.bed !== dec.bed)) {
      fail(`tail shift at ${dec.bed}${dec.phys} is not one step back on that bed`);
    }
    const decAt = row.cells.indexOf(dec);
    const later = row.cells.slice(decAt + 1);
    if (!later.length) fail(`course ${row.course} does not continue on the decrease row`);
    if (later.some((cell) => cell.id === dec.id)) fail(`landing ${dec.bed}${dec.phys} is knitted again`);
    const again = rows[index + 2];
    if (again && again.kind === "knit" && again.course === row.course) {
      fail(`course ${row.course} continued on a second knit row`);
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
  selfCheckTailDecrease();
  selfCheckContinueAfterRack();
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
