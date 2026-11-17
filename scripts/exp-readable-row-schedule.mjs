/**
 * Opt-in readable-map schedule experiment.
 *
 * The unit is one 课 (course), not one drawn 行. Locked 2026-11-17:
 *   1. increases and no decreases: open each site, balance after each, then knit the whole course;
 *   2. decreases and no increases: knit the whole course, then each decrease in traversal order, balance after each;
 *   3. both: all increase openings (balance after each), then the whole knit, then the decreases.
 * Ring 0 is the official seatRing path, including when balance runs. A pre-knit
 * balance that still sees an unclaimed planned needle is postponed until that
 * course has been knitted. After the knit, a decrease uses the beds those
 * stitches occupy now. A pair that was cross-bed at knit time and is same-bed
 * after earlier decreases is a same-bed decrease on the current bed. This does
 * not write knitting code or DAT, and it does not write official beds.
 *
 *   npm run exp:bunny-readable-row
 *   node scripts/exp-readable-row-schedule.mjs --check
 *   node scripts/exp-readable-row-schedule.mjs --cylinders
 *   node scripts/exp-readable-row-schedule.mjs --check --cylinders
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FILL,
  LIVE_ROW_NOTE,
  applyIncrease,
  assertNoShare,
  balanceBeds,
  baseWalesOf,
  buildOwnBedChart,
  claimWale,
  columnForPhys,
  coursesFromTypes,
  decAdded,
  fitChartWidth,
  flipToken,
  incAdded,
  isFoldReturn,
  listsOf,
  liveWindow,
  moveToken,
  neighbors,
  paint,
  physInHole,
  planBeds,
  renderReport,
  rightFoldPair,
  rowsByLiveNeedle,
  buildFromFacesRing,
  seatRing,
  settleColumns,
  shapeBedOf,
  shiftFollowingLoops,
  shiftTravelTail,
  stackCrossBedGroup,
  stepCircle,
  workbookBytes,
} from "./build-step4-faces-ring0.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(root, "public/sample/cylinder/faces_ring_layout.json");
const BASE_XLS = join(root, "public/sample/cylinder/faces_ring0_step4_bed.xls");
const BASE_TXT = join(root, "public/sample/cylinder/faces_ring0_step4_bed.txt");
const OUT_DIR = join(root, "experiments/official-bunny-readable-row-schedule");

function fail(msg) {
  throw new Error(`exp-readable-row: ${msg}`);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function bedSnapshot(stitches) {
  const front = [...stitches.values()].filter((st) => st.bed === "F").sort((a, b) => a.phys - b.phys || a.id - b.id);
  const back = [...stitches.values()].filter((st) => st.bed === "B").sort((a, b) => a.phys - b.phys || a.id - b.id);
  const span = (list) => (list.length ? `${list[0].phys}…${list.at(-1).phys}` : "—");
  const brief = (st) => ({
    id: st.id,
    origin: st.origin || null,
    bed: st.bed,
    phys: st.phys,
    wale: st.wale ?? null,
  });
  return {
    n: stitches.size,
    text: `F${front.length}[${span(front)}] / B${back.length}[${span(back)}]`,
    live: liveWindow(stitches),
    front: front.map(brief),
    back: back.map(brief),
  };
}

function membersOf(stitches, ids) {
  return ids.map((id) => {
    const st = stitches.get(id);
    if (!st) return { id, missing: true };
    return { id, origin: st.origin || null, bed: st.bed, phys: st.phys, wale: st.wale ?? null };
  });
}

function snapState(state) {
  return {
    stitches: [...state.stitches].map(([id, st]) => [id, { ...st }]),
    waleToId: [...state.waleToId],
    plan: state.plan ? [...state.plan].map(([key, slot]) => [key, { ...slot }]) : null,
    nextId: state.nextId,
    cursorId: state.cursor ? state.cursor.id : null,
  };
}

function restoreState(state, snap) {
  state.stitches.clear();
  for (const [id, st] of snap.stitches) state.stitches.set(id, { ...st });
  state.waleToId.clear();
  for (const [key, id] of snap.waleToId) state.waleToId.set(key, id);
  state.nextId = snap.nextId;
  state.cursor = snap.cursorId == null ? null : state.stitches.get(snap.cursorId) || null;
  if (state.plan && snap.plan) {
    state.plan.clear();
    for (const [key, slot] of snap.plan) state.plan.set(key, { ...slot });
  }
}

function cloneState(state) {
  const stitches = new Map();
  for (const [id, st] of state.stitches) stitches.set(id, { ...st });
  return {
    stitches,
    waleToId: new Map(state.waleToId),
    plan: state.plan ? new Map([...state.plan].map(([key, slot]) => [key, { ...slot }])) : null,
    nextId: state.nextId,
    cursor: state.cursor ? stitches.get(state.cursor.id) || null : null,
  };
}

function headerInc(cell) {
  const n = incAdded(cell.label);
  if (!n || !String(cell.label).includes("+")) return 0;
  if (cell.kind && cell.kind !== "inc" && cell.kind !== "wrapInc") return 0;
  return n;
}

function headerDec(cell) {
  const n = decAdded(cell.label);
  if (!n || !String(cell.label).includes("-")) return 0;
  if (cell.kind && cell.kind !== "dec" && cell.kind !== "wrapDec") return 0;
  return n;
}

function spanWidth(cells, index) {
  const cell = cells[index];
  const n = headerInc(cell) || headerDec(cell);
  if (!n) return 1;
  const width = n + 1;
  if (index + width > cells.length) fail(`term ${cell.tIdx} span runs off the course`);
  for (let k = 0; k < width; k++) {
    if (cells[index + k].tIdx !== cell.tIdx) fail(`term ${cell.tIdx} span is not contiguous`);
  }
  return width;
}

function cutPoints(cells, start) {
  const cuts = [];
  let i = start;
  while (i < cells.length) {
    i += spanWidth(cells, i);
    cuts.push(i);
  }
  return cuts;
}

function xferCells(moves, token, role) {
  return moves.map((m) => ({
    col: columnForPhys(m.bed, m.from),
    token,
    fill: FILL.xfer,
    phys: m.from,
    bed: m.bed,
    id: m.id,
    role,
  }));
}

function pushFixes(rows, fixes, course, label) {
  for (const fix of fixes) {
    rows.push({
      dir: fix.dir,
      kind: fix.kind,
      course,
      cells: fix.cells,
      beds: fix.beds,
      note: `实验：${label}${fix.note}`,
    });
  }
}

function assignmentClash(stitches, plan, message) {
  const matched = /([FB])(-?\d+) is assigned twice/.exec(message || "");
  if (!matched) return null;
  const bed = matched[1];
  const phys = Number(matched[2]);
  const live = [...stitches.values()]
    .filter((st) => st.bed === bed && st.phys === phys)
    .map((st) => ({
      id: st.id,
      origin: st.origin || null,
      bed: st.bed,
      phys: st.phys,
      wale: st.wale ?? null,
    }));
  const unusedPlan = [];
  if (plan) {
    for (const [wale, slot] of plan) {
      if (!slot.used && slot.bed === bed && slot.phys === phys) unusedPlan.push({ wale, bed: slot.bed, phys: slot.phys });
    }
  }
  return {
    needle: `${bed}${phys}`,
    live,
    unusedPlan,
    why: "平衡把活线圈和还没织到的计划针合成同一个窗口。开口已经把活线圈移到这枚针上，这一行还没织，计划针没有被认领。",
  };
}

function tryBalance(state, where, course, label) {
  const snap = snapState(state);
  const before = bedSnapshot(state.stitches);
  try {
    const fixes = balanceBeds(state.stitches, state.plan || new Map(), where);
    const rows = [];
    pushFixes(rows, fixes, course, label);
    state.cursor = state.cursor ? state.stitches.get(state.cursor.id) || null : null;
    return { ok: true, rows, before, after: bedSnapshot(state.stitches), fixes: fixes.length };
  } catch (err) {
    const aborted = bedSnapshot(state.stitches);
    const message = err instanceof Error ? err.message : String(err);
    const collision = assignmentClash(state.stitches, state.plan, message);
    restoreState(state, snap);
    return {
      ok: false,
      phase: "balance",
      error: message,
      before,
      aborted,
      collision,
      rows: [],
    };
  }
}

function freshWales(cells, step) {
  const fresh = new Set();
  for (const cell of cells) {
    const added = headerInc(cell);
    if (!added) continue;
    for (let g = 1; g <= added; g++) fresh.add(cell.wale + step * g);
  }
  return fresh;
}

function walkRow(state, cells, step, dirSign, fold, atCourseStart, where) {
  const fresh = freshWales(cells, step);
  const placed = [];
  const groups = [];
  let group = null;
  let at = null;
  const startStitch = () => {
    if (!state.cursor || !state.stitches.has(state.cursor.id)) return { error: `${where}: 没有上一行终点针` };
    if (!atCourseStart) return { stitch: stepCircle(state.cursor, dirSign, state.stitches) };
    if (fold || state.waleToId.size === 0) return { stitch: state.cursor };
    return { stitch: stepCircle(state.cursor, dirSign, state.stitches) };
  };
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (fresh.has(cell.wale)) {
      if (!at) return { ok: false, phase: "walk", error: `${where}: 加针空针 ${cell.wale} 没有开口针` };
      placed.push({ cell, hole: true, markerId: at.id });
      if (group) return { ok: false, phase: "walk", error: `${where}: 减针跨度里出现了加针空针` };
      continue;
    }
    if (i === 0) {
      const started = startStitch();
      if (started.error) return { ok: false, phase: "walk", error: started.error };
      at = started.stitch;
    } else {
      if (!at) return { ok: false, phase: "walk", error: `${where}: 行走丢了当前针` };
      at = stepCircle(at, dirSign, state.stitches);
    }
    if (!at || !state.stitches.has(at.id)) return { ok: false, phase: "walk", error: `${where}: 下一项没有线圈` };
    claimWale(state.waleToId, state.stitches, at, cell.wale);
    placed.push({ cell, hole: false, id: at.id });
    const nDec = headerDec(cell);
    if (nDec) {
      if (group) return { ok: false, phase: "walk", error: `${where}: 减针跨度还没结束又遇到减针` };
      group = { ids: [at.id], hang: nDec, term: cell.tIdx, headerLabel: cell.label };
      groups.push(group);
    } else if (group) {
      const inSpan = cell.kind === "dec" || cell.kind === "wrapDec";
      if (!inSpan || cell.tIdx !== group.term) {
        return { ok: false, phase: "walk", error: `${where}: 减针跨度被 ${cell.kind} 打断` };
      }
      group.ids.push(at.id);
      if (group.ids.length === group.hang + 1) group = null;
    }
  }
  if (group) return { ok: false, phase: "walk", error: `${where}: 减针跨度不完整` };
  return { ok: true, placed, groups, fresh };
}

function openSite(state, marker, cell, added, dirSign, step, where, course) {
  const delta = marker.bed === "F" ? dirSign : -dirSign;
  const rows = [];
  const holes = [];
  const markerBed = marker.bed;
  const markerPhys = marker.phys;
  for (let k = 0; k < added; k++) {
    const beds = liveWindow(state.stitches);
    let moves;
    try {
      moves = shiftTravelTail(state.stitches, marker, delta, `${where} increase`);
    } catch (err) {
      return { ok: false, phase: "increase-shift", error: err instanceof Error ? err.message : String(err) };
    }
    if (!moves.length) continue;
    const token = moveToken(marker.bed, moves[0].from, moves[0].to);
    if (moves.some((m) => moveToken(m.bed, m.from, m.to) !== token || m.bed !== marker.bed)) {
      return { ok: false, phase: "increase-shift", error: `${where}: 加针开口不是 ${marker.bed} 上的同一次挪移` };
    }
    rows.push({
      dir: "X+",
      kind: "increase",
      course,
      cells: xferCells(moves, token, "increase"),
      beds,
      note: `${where}: 实验：织这一课之前，在 ${marker.origin || marker.id} 所在的 ${markerBed}${markerPhys} 开口。空针先记下，这一课里只织一次。`,
    });
  }
  for (let g = 1; g <= added; g++) {
    const phys = marker.phys + delta * g;
    const wale = cell.wale + step * g;
    if ([...state.stitches.values()].some((st) => st.bed === marker.bed && st.phys === phys)) {
      return {
        ok: false,
        phase: "increase-hole",
        error: `${where}: 开口空针 ${marker.bed}${phys} 上已经有线圈`,
        holes,
      };
    }
    const st = {
      id: state.nextId++,
      bed: marker.bed,
      phys,
      wale,
      base: false,
      hole: true,
      origin: `hole:c${course}:t${cell.tIdx}:g${g}`,
      markerId: marker.id,
    };
    const prior = state.waleToId.get(wale);
    if (prior != null && prior !== st.id) {
      const other = state.stitches.get(prior);
      if (other && other.wale === wale) other.wale = null;
    }
    state.stitches.set(st.id, st);
    state.waleToId.set(wale, st.id);
    holes.push(st.id);
  }
  try {
    assertNoShare(state.stitches, where);
  } catch (err) {
    return { ok: false, phase: "increase-hole", error: err instanceof Error ? err.message : String(err), holes };
  }
  return { ok: true, rows, holes, markerId: marker.id, markerOrigin: marker.origin || null };
}

function prepareRow(state, course, start, end, fold, where, courseNo) {
  const step = course.dir === 0 ? 1 : -1;
  const dirSign = step;
  const cells = course.cells.slice(start, end);
  const walked = walkRow(state, cells, step, dirSign, fold, start === 0, where);
  if (!walked.ok) return walked;
  const rows = [];
  const holeIds = [];
  const sites = walked.placed.filter((item) => headerInc(item.cell));
  for (const site of sites) {
    const marker = state.stitches.get(site.id);
    if (!marker) return { ok: false, phase: "increase-open", error: `${where}: 加针项 ${site.cell.tIdx} 没有线圈` };
    const before = bedSnapshot(state.stitches);
    const opened = openSite(state, marker, site.cell, headerInc(site.cell), dirSign, step, where, courseNo);
    if (!opened.ok) return { ...opened, before, term: site.cell.tIdx, marker: membersOf(state.stitches, [site.id]) };
    rows.push(...opened.rows);
    holeIds.push(...opened.holes);
    const balanced = tryBalance(state, where, courseNo, `项 ${site.cell.tIdx} 加针开口之后平衡。`);
    if (!balanced.ok) {
      return {
        ...balanced,
        term: site.cell.tIdx,
        marker: { id: marker.id, origin: marker.origin || null },
        holes: opened.holes,
      };
    }
    rows.push(...balanced.rows);
  }
  const seen = new Set();
  const knitPlan = [];
  for (const item of walked.placed) {
    const st = item.hole ? state.stitches.get(state.waleToId.get(item.cell.wale)) : state.stitches.get(item.id);
    if (!st) {
      return { ok: false, phase: "knit", error: `${where}: 项 ${item.cell.tIdx} 开口之后找不到线圈` };
    }
    if (item.hole && !st.hole) {
      return { ok: false, phase: "knit", error: `${where}: 项 ${item.cell.tIdx} 的空针不是这次开口记下的新圈` };
    }
    const key = `${st.bed}:${st.phys}`;
    if (seen.has(key)) {
      return {
        ok: false,
        phase: "duplicate-needle",
        error: `${where}: ${key} 会在同一织行里被织两次`,
        needle: key,
        term: item.cell.tIdx,
      };
    }
    seen.add(key);
    knitPlan.push({ item, st });
  }
  for (const group of walked.groups) {
    const members = group.ids.map((id) => state.stitches.get(id));
    if (members.some((st) => !st)) return { ok: false, phase: "decrease-bind", error: `${where}: 减针组丢了线圈` };
    const towardHigh = (members[0].bed === "F" ? dirSign : -dirSign) > 0;
    group.side = towardHigh ? "R" : "L";
    group.crossAtKnit = crossesFold(state.stitches, members);
    group.atKnit = membersOf(state.stitches, group.ids);
    group.dirSign = dirSign;
  }
  return {
    ok: true,
    rows,
    knitPlan,
    groups: walked.groups,
    holeIds,
    beds: liveWindow(state.stitches),
    dirSign,
  };
}

function crossesFold(stitches, members) {
  const edge = rightFoldPair(stitches);
  if (!edge) return false;
  return members.some((st) => st.id === edge.lastFront.id) && members.some((st) => st.id === edge.nextBack.id);
}

function chainOk(members) {
  for (let i = 1; i < members.length; i++) {
    const prev = members[i - 1];
    const cur = members[i];
    if (prev.bed !== cur.bed) {
      if (prev.phys !== cur.phys) return false;
    } else if (Math.abs(prev.phys - cur.phys) !== 1) return false;
  }
  return true;
}

function relationHolds(members, side) {
  const forward = side === "R" ? 1 : side === "L" ? -1 : 0;
  if (!forward) return false;
  const bed = members[0].bed;
  for (let i = 0; i < members.length; i++) {
    if (members[i].bed !== bed) return false;
    if (members[i].phys !== members[0].phys + forward * i) return false;
  }
  return true;
}

function sideFromCurrent(members) {
  if (relationHolds(members, "R")) return "R";
  if (relationHolds(members, "L")) return "L";
  return null;
}

function placeLine(items) {
  return (items || [])
    .map((item) => `${item.origin || item.id}@${item.missing ? "缺" : `${item.bed}${item.phys}`}`)
    .join("，");
}

function bedName(bed) {
  return bed === "F" ? "前床" : bed === "B" ? "后床" : String(bed || "");
}

function applyDecrease(state, group, where, course) {
  const snap = snapState(state);
  const before = bedSnapshot(state.stitches);
  const atNow = membersOf(state.stitches, group.ids);
  if (atNow.some((item) => item.missing)) {
    return { ok: false, phase: "decrease-identity", error: `${where}: 减针项 ${group.term} 的线圈已经不在床上`, before, atKnit: group.atKnit, atNow };
  }
  const members = group.ids.map((id) => state.stitches.get(id));
  const nowCross = crossesFold(state.stitches, members);
  let retargeted = nowCross !== Boolean(group.crossAtKnit);
  let side = group.side;
  let landingNote = "";
  if (!nowCross && !relationHolds(members, side)) {
    const nowSide = sideFromCurrent(members);
    if (!nowSide) {
      return {
        ok: false,
        phase: "decrease-geometry",
        error: `${where}: 项 ${group.term} 现在 ${members.length} 针都在${bedName(members[0].bed)}（${placeLine(atNow)}），不是沿走向相邻的同床减针，不能按当前床从第二格套到第一格。`,
        before,
        atKnit: group.atKnit,
        atNow,
      };
    }
    side = nowSide;
    retargeted = true;
    landingNote = `织的时候${group.crossAtKnit ? "跨床" : `同床 ${group.side} 向`}，现在都在${bedName(members[0].bed)}，按当前床 ${side} 向从第二格套到第一格。`;
  } else if (retargeted && !nowCross) {
    landingNote = `织的时候跨床，现在都在${bedName(members[0].bed)}，按当前床做减针。`;
  } else if (retargeted && nowCross) {
    landingNote = "织的时候同床，现在这两针跨床，按当前床套圈。";
  }
  const rows = [];
  try {
    if (nowCross) {
      if (!chainOk(members)) {
        restoreState(state, snap);
        return {
          ok: false,
          phase: "decrease-geometry",
          error: retargeted
            ? `${where}: 项 ${group.term} 现在跨床（${placeLine(atNow)}），但已经不是相邻折点，不能按当前床套圈。`
            : `${where}: 项 ${group.term} 的跨床减针不再是相邻折点`,
          before,
          atKnit: group.atKnit,
          atNow,
        };
      }
      const stacked = stackCrossBedGroup(state.stitches, members, state.waleToId, course, where);
      rows.push(
        ...stacked.transfers.map((row) => ({
          ...row,
          course,
          note: `实验：${landingNote}整课织完后，按线圈身份套项 ${group.term}。${row.note}`,
        })),
      );
    } else {
      const passed = sameBedPasses(state, { ...group, side }, members, where, course, landingNote);
      if (!passed.ok) {
        restoreState(state, snap);
        return { ...passed, before, atKnit: group.atKnit, atNow: membersOf(state.stitches, group.ids) };
      }
      rows.push(...passed.rows);
    }
    assertNoShare(state.stitches, where);
  } catch (err) {
    const aborted = bedSnapshot(state.stitches);
    restoreState(state, snap);
    return {
      ok: false,
      phase: "decrease-transfer",
      error: err instanceof Error ? err.message : String(err),
      before,
      aborted,
      atKnit: group.atKnit,
      atNow,
    };
  }
  const landingSentence = retargeted
    ? `${where}: 项 ${group.term} 织的时候${group.crossAtKnit ? "跨床" : "同床"}（${placeLine(group.atKnit)}），减针时${nowCross ? "跨床" : `同在${bedName(members[0].bed)}`}（${placeLine(atNow)}）。按当前床${nowCross ? "套圈" : `、${side} 向，从第二格套到第一格`}。`
    : "";
  return {
    ok: true,
    rows,
    before,
    after: bedSnapshot(state.stitches),
    atNow,
    retargeted,
    crossNow: nowCross,
    sideUsed: side,
    landingSentence,
  };
}

function sameBedPasses(state, group, members, where, course, landingNote = "") {
  const first = members[0];
  const recv = members[1];
  const recvPhys = recv.phys;
  const recvBed = recv.bed;
  const rows = [];
  const allowed = new Set(group.ids.slice(1));
  for (let k = 0; k < group.hang; k++) {
    const beds = liveWindow(state.stitches);
    let source = [...state.stitches.values()].find((st) => st.bed === recvBed && st.phys === recvPhys && st.id !== first.id);
    if (!source) {
      const other = recvBed === "F" ? "B" : "F";
      const partner = [...state.stitches.values()].find((st) => st.bed === other && st.phys === recvPhys && st.id !== first.id);
      if (!partner) {
        return { ok: false, phase: "decrease-transfer", error: `${where}: 第 ${k + 1} 次移圈时 ${recvBed}${recvPhys} 上没有组内线圈` };
      }
      if (!allowed.has(partner.id)) {
        return { ok: false, phase: "decrease-target", error: `${where}: 第 ${k + 1} 次会套到组外线圈 ${partner.origin || partner.id}` };
      }
      rows.push({
        dir: "Flip",
        kind: "flip",
        course,
        cells: [
          {
            col: columnForPhys(other, partner.phys),
            token: flipToken(other, recvBed),
            fill: FILL.flip,
            phys: partner.phys,
            bed: other,
            id: partner.id,
            role: "flip",
          },
        ],
        beds,
        note: `${where}: 实验：${landingNote}第 ${k + 1} 次移圈前，折点 ${other}${partner.phys} 翻到 ${recvBed}${recvPhys}。`,
      });
      partner.bed = recvBed;
      assertNoShare(state.stitches, `${where} decrease ${k + 1}`);
      source = partner;
    }
    if (!allowed.has(source.id)) {
      return { ok: false, phase: "decrease-target", error: `${where}: 第 ${k + 1} 次会套到组外线圈 ${source.origin || source.id}` };
    }
    allowed.delete(source.id);
    if (source.bed !== first.bed && source.phys === first.phys) {
      const fromBed = source.bed;
      state.stitches.delete(source.id);
      for (const [wale, mapped] of [...state.waleToId]) if (mapped === source.id) state.waleToId.delete(wale);
      rows.push({
        dir: "Flip",
        kind: "decrease",
        course,
        cells: [
          {
            col: columnForPhys(fromBed, source.phys),
            token: flipToken(fromBed, first.bed),
            fill: FILL.flip,
            phys: source.phys,
            bed: fromBed,
            id: source.id,
            role: "decrease",
            stacked: true,
          },
        ],
        beds,
        note: `${where}: 实验：${landingNote}${fromBed}${source.phys} 套到接收圈 ${first.origin || first.id}（${first.bed}${first.phys}）。`,
      });
      continue;
    }
    const moved = shiftFollowingLoops(state.stitches, source, group.side, `${where} decrease ${k + 1}`);
    if (moved.landingId !== first.id) {
      return { ok: false, phase: "decrease-target", error: `${where}: 第 ${k + 1} 次套到了 ${moved.landingId}，不是接收圈 ${first.id}` };
    }
    if (moved.moves[0].from !== recvPhys) {
      return { ok: false, phase: "decrease-target", error: `${where}: 第 ${k + 1} 次没有从接收针 ${recvBed}${recvPhys} 开始` };
    }
    for (const [wale, mapped] of [...state.waleToId]) if (mapped === moved.stackedId) state.waleToId.delete(wale);
    rows.push({
      dir: "X",
      kind: "decrease",
      course,
      cells: moved.cells,
      beds,
      note: `${where}: 实验：${landingNote}整课织完后，第 ${k + 1} 次从 ${recvBed}${recvPhys} 套到 ${first.bed}${first.phys}（${first.origin || first.id}）。`,
    });
  }
  if (allowed.size) {
    return { ok: false, phase: "decrease-target", error: `${where}: 减针组里还有线圈没有按原身份套完` };
  }
  return { ok: true, rows };
}

function knitCellsOf(plan, groups) {
  const sideOf = new Map(groups.map((group) => [group.ids[0], group.side]));
  const spanOf = new Map();
  for (const group of groups) {
    group.ids.forEach((id, index) => spanOf.set(id, { index, len: group.ids.length }));
  }
  const seenHeader = new Set();
  return plan.map(({ item, st }) => {
    let label = item.cell.label;
    const nDec = headerDec(item.cell);
    if (nDec && item.cell.kind !== "dec" && item.cell.kind !== "wrapDec" && !String(label).includes("-")) {
      label = item.cell.label;
    }
    if (nDec) label = `-${sideOf.get(st.id) || "R"}${nDec}`;
    const painted = paint(st.bed, label, item.cell.kind);
    const span = spanOf.get(st.id);
    const spanStart = Boolean(span && span.index === 0 && !seenHeader.has(st.id));
    if (span) seenHeader.add(st.id);
    return {
      col: columnForPhys(st.bed, st.phys),
      token: painted.token,
      fill: painted.fill,
      phys: st.phys,
      bed: st.bed,
      id: st.id,
      origin: st.origin || null,
      role: "knit",
      label,
      kind: item.cell.kind,
      tIdx: item.cell.tIdx,
      hole: Boolean(item.hole),
      spanStart,
      spanLen: spanStart ? span.len : 0,
    };
  });
}

function rowEndId(state, knitCells, groups) {
  let endId = knitCells.at(-1).id;
  if (state.stitches.has(endId)) return endId;
  const group = groups.find((item) => item.ids.includes(endId));
  if (group && state.stitches.has(group.ids[0])) return group.ids[0];
  return null;
}

function splitKeepingSpans(cells, where) {
  const rows = [];
  let row = [];
  const key = (cell) => `${cell.bed}:${cell.phys}`;
  let i = 0;
  while (i < cells.length) {
    const take = cells[i].spanStart ? cells[i].spanLen : 1;
    if (take < 1) return { ok: false, error: `${where}: 减针跨度长度不对` };
    const chunk = cells.slice(i, i + take);
    if (chunk.length !== take) return { ok: false, error: `${where}: 减针跨度超出这一课` };
    const keys = chunk.map(key);
    if (new Set(keys).size !== keys.length) {
      return { ok: false, error: `${where}: 减针跨度 ${keys.join(" ")} 自己重复了活针` };
    }
    const occupied = new Set(row.map(key));
    if (row.length && keys.some((item) => occupied.has(item))) {
      rows.push(row);
      row = [];
    }
    row.push(...chunk);
    i += take;
  }
  if (row.length) rows.push(row);
  if (!rows.length) return { ok: false, error: `${where}: 这一课没有织针` };
  return { ok: true, rows };
}

function openCourseIncreases(state, walked, dirSign, step, where, courseNo) {
  const sites = walked.placed.filter((item) => headerInc(item.cell));
  const rows = [];
  const holeIds = [];
  const postponed = [];
  let omittedBalances = 0;
  for (const site of sites.slice().reverse()) {
    const marker = state.stitches.get(site.id);
    if (!marker) {
      return { ok: false, phase: "increase-open", error: `${where}: 加针项 ${site.cell.tIdx} 没有线圈`, term: site.cell.tIdx };
    }
    const before = bedSnapshot(state.stitches);
    const opened = openSite(state, marker, site.cell, headerInc(site.cell), dirSign, step, where, courseNo);
    if (!opened.ok) return { ...opened, before, term: site.cell.tIdx, marker: membersOf(state.stitches, [site.id]) };
    rows.push(...opened.rows);
    holeIds.push(...opened.holes);
    const balanced = tryBalance(state, where, courseNo, `项 ${site.cell.tIdx} 加针开口之后平衡。`);
    if (!balanced.ok) {
      if (balanced.collision?.unusedPlan?.length) {
        postponed.push({
          term: site.cell.tIdx,
          label: site.cell.label,
          collision: balanced.collision,
          before: balanced.before,
          error: balanced.error,
        });
        continue;
      }
      return {
        ...balanced,
        term: site.cell.tIdx,
        marker: { id: marker.id, origin: marker.origin || null },
        holes: opened.holes,
      };
    }
    if (balanced.rows.length) rows.push(...balanced.rows);
    else omittedBalances += 1;
  }
  return { ok: true, rows, holeIds, postponed, omittedBalances };
}

/**
 * Later rings. One 课 at a time, using the 2026-11-17 schedule.
 * Increase sites still open later-first so each split stays on the next needle.
 * Balance after each completed increase, unless that balance would put a live
 * stitch on an unclaimed planned needle: that balance waits until the course
 * has been knitted. Decreases wait until every knit row of the course is drawn.
 */
function seatContinuationExperiment(courses, carried, prevDirIn, courseOffset) {
  const state = {
    stitches: carried.stitches,
    waleToId: carried.waleToId,
    plan: null,
    nextId: carried.nextId,
    cursor: carried.cursor,
  };
  for (const st of state.stitches.values()) if (!st.origin) st.origin = `carried:${st.id}`;
  const sheet = [];
  const coursesOut = [];
  const events = [];
  let prevDir = prevDirIn;
  let stop = null;
  let ci = 0;
  const remember = (event) => events.push(event);

  for (; ci < courses.length; ci++) {
    const course = courses[ci];
    const courseNo = courseOffset + ci;
    const where = `course ${courseNo}`;
    const step = course.dir === 0 ? 1 : -1;
    const dirSign = step;
    const fold = isFoldReturn(course, prevDir);
    const beforeCourse = bedSnapshot(state.stitches);
    const snap = snapState(state);
    const walked = walkRow(state, course.cells, step, dirSign, fold, true, where);
    if (!walked.ok) {
      restoreState(state, snap);
      stop = blockerFrom(walked, courseNo, course, 0, bedSnapshot(state.stitches));
      break;
    }
    if (ci === 0) {
      const first = walked.placed.find((item) => !item.hole);
      const st = first ? state.stitches.get(first.id) : null;
      if (!st || st.bed !== "F" || st.phys !== 0) {
        restoreState(state, snap);
        stop = blockerFrom(
          {
            phase: "ring-start",
            error: `${where}: 开口之前，这一环的第一针在 ${st ? `${st.bed}${st.phys}` : "空"}，不是 F0`,
            before: beforeCourse,
            term: first?.cell?.tIdx ?? course.cells[0]?.tIdx ?? null,
          },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
    }
    const incHeaders = walked.placed.filter((item) => headerInc(item.cell)).length;
    const decHeaders = walked.groups.length;
    const schedule = incHeaders && decHeaders ? "inc-then-knit-then-dec" : incHeaders ? "inc-then-knit" : decHeaders ? "knit-then-dec" : "knit";
    const opened = openCourseIncreases(state, walked, dirSign, step, where, courseNo);
    if (!opened.ok) {
      stop = blockerFrom(opened, courseNo, course, 0, bedSnapshot(state.stitches));
      break;
    }
    for (const row of opened.rows) sheet.push(row);
    for (const group of walked.groups) {
      const members = group.ids.map((id) => state.stitches.get(id));
      if (members.some((st) => !st)) {
        stop = blockerFrom(
          { phase: "decrease-bind", error: `${where}: 减针项 ${group.term} 在开口之后丢了线圈`, term: group.term },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
      const towardHigh = (members[0].bed === "F" ? dirSign : -dirSign) > 0;
      group.side = towardHigh ? "R" : "L";
      group.crossAtKnit = crossesFold(state.stitches, members);
      group.atKnit = membersOf(state.stitches, group.ids);
      group.dirSign = dirSign;
    }
    if (stop) break;
    const knitPlan = [];
    for (const item of walked.placed) {
      const st = item.hole ? state.stitches.get(state.waleToId.get(item.cell.wale)) : state.stitches.get(item.id);
      if (!st) {
        stop = blockerFrom(
          { phase: "knit", error: `${where}: 项 ${item.cell.tIdx} 开口之后找不到线圈`, term: item.cell.tIdx },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
      if (item.hole && !st.hole) {
        stop = blockerFrom(
          { phase: "knit", error: `${where}: 项 ${item.cell.tIdx} 的空针不是这次开口记下的新圈`, term: item.cell.tIdx },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
      knitPlan.push({ item, st });
    }
    if (stop) break;
    const knitCells = knitCellsOf(knitPlan, walked.groups);
    const split = splitKeepingSpans(knitCells, where);
    if (!split.ok) {
      stop = blockerFrom({ phase: "duplicate-needle", error: split.error }, courseNo, course, 0, bedSnapshot(state.stitches));
      break;
    }
    const knitBeds = liveWindow(state.stitches);
    const dirName = course.dir === 0 ? "R" : "L";
    const scheduleNote =
      schedule === "inc-then-knit-then-dec"
        ? "先做完全部加针开口，每完成一处就平衡；然后整课织一次，包括开口空针和将要减掉的针；再按走向逐个减针，每减完一处就平衡。"
        : schedule === "inc-then-knit"
          ? "先做完全部加针开口，每完成一处就平衡；然后整课织一次，包括开口空针。"
          : schedule === "knit-then-dec"
            ? "先把整课织完，包括将要减掉的针，减针移圈不插在织的过程中；再按走向逐个减针，每减完一处就平衡。"
            : "这一课没有加减针，整课织一次。";
    const postponeNote = opened.postponed.length
      ? `项 ${opened.postponed.map((item) => item.term).join("、")} 的开口平衡碰到了还没认领的计划针，这次平衡改到整课织完之后。`
      : "";
    try {
      split.rows.forEach((segment, segIndex) => {
        settleColumns(segment, dirSign, where);
        const needles = new Set();
        const ids = new Set();
        for (const cell of segment) {
          const key = `${cell.bed}:${cell.phys}`;
          if (needles.has(key) || ids.has(cell.id)) {
            throw new Error(`${where}: ${key} 会在同一织行里被织两次`);
          }
          needles.add(key);
          ids.add(cell.id);
        }
        const bits = [`${where}: 实验课。${scheduleNote}`];
        if (postponeNote) bits.push(postponeNote);
        if (segIndex < split.rows.length - 1) bits.push(LIVE_ROW_NOTE);
        sheet.push({
          dir: dirName,
          kind: "knit",
          course: courseNo,
          cells: segment,
          beds: knitBeds,
          note: bits.join(""),
        });
      });
    } catch (err) {
      stop = blockerFrom(
        { phase: "columns", error: err instanceof Error ? err.message : String(err) },
        courseNo,
        course,
        0,
        bedSnapshot(state.stitches),
      );
      break;
    }
    const courseStart = knitCells[0];
    remember({
      type: "course-schedule",
      course: courseNo,
      dir: dirName,
      schedule,
      increases: incHeaders,
      decreases: decHeaders,
      postponed: opened.postponed,
      omittedIncreaseBalances: opened.omittedBalances || 0,
      knitRows: split.rows.length,
      start: `${courseStart.bed}${courseStart.phys}`,
    });
    if (opened.postponed.length) {
      const balanced = tryBalance(state, where, courseNo, "这一课的计划针已经随整课织完认领，补做开口时推迟的平衡。");
      if (!balanced.ok) {
        stop = blockerFrom(
          { ...balanced, term: opened.postponed[0].term, postponed: opened.postponed },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
      for (const row of balanced.rows) sheet.push(row);
      remember({
        type: "postponed-balance",
        course: courseNo,
        terms: opened.postponed.map((item) => item.term),
        after: balanced.after.text,
      });
    }
    for (const group of walked.groups) {
      const decreased = applyDecrease(state, group, where, courseNo);
      if (!decreased.ok) {
        stop = blockerFrom(decreased, courseNo, course, 0, bedSnapshot(state.stitches));
        stop.term = group.term;
        stop.groupAtKnit = group.atKnit;
        break;
      }
      for (const row of decreased.rows) sheet.push(row);
      const balanced = tryBalance(state, where, courseNo, `项 ${group.term} 减针之后平衡。`);
      if (!balanced.ok) {
        stop = blockerFrom(
          { ...balanced, term: group.term, atKnit: group.atKnit },
          courseNo,
          course,
          0,
          bedSnapshot(state.stitches),
        );
        break;
      }
      for (const row of balanced.rows) sheet.push(row);
      remember({
        type: "decrease",
        course: courseNo,
        term: group.term,
        ids: group.ids,
        side: group.side,
        hang: group.hang,
        crossAtKnit: group.crossAtKnit,
        crossNow: decreased.crossNow,
        sideAtKnit: group.side,
        sideUsed: decreased.sideUsed,
        landing: decreased.retargeted ? "current-bed" : group.crossAtKnit ? "cross-bed" : "same-bed",
        landingSentence: decreased.landingSentence || "",
        atKnit: group.atKnit,
        atDecrease: decreased.atNow,
        bedsBefore: decreased.before?.text || "",
        bedsAfter: balanced.after.text,
        transfers: decreased.rows.map((row) => ({
          dir: row.dir,
          kind: row.kind,
          cells: row.cells.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" "),
          note: row.note,
        })),
        after: membersOf(state.stitches, group.ids.filter((id) => state.stitches.has(id))),
        balance: balanced.after.text,
        balanceRows: balanced.rows.length,
      });
    }
    if (stop) break;
    const endId = rowEndId(state, knitCells, walked.groups);
    const endSt = endId == null ? null : state.stitches.get(endId);
    if (!endSt) {
      stop = blockerFrom(
        { phase: "row-end", error: `${where}: 整课织完并移圈之后，终点线圈不在床上` },
        courseNo,
        course,
        0,
        bedSnapshot(state.stitches),
      );
      break;
    }
    state.cursor = endSt;
    coursesOut.push({
      course: courseNo,
      dir: dirName,
      start: `${courseStart.bed}${courseStart.phys}`,
      end: `${endSt.bed}${endSt.phys}`,
      n: knitCells.length,
    });
    prevDir = course.dir;
  }

  return {
    sheet,
    courses: coursesOut,
    events,
    prevDir,
    stop,
    bed: { stitches: state.stitches, waleToId: state.waleToId, cursor: state.cursor, nextId: state.nextId },
    partial: Boolean(stop),
  };
}

function blockerFrom(reason, courseNo, course, index, bedNow) {
  const cell = course?.cells?.[index] || null;
  return {
    phase: reason?.phase || "stop",
    error: reason?.error || "stopped",
    course: courseNo,
    dir: course?.dir === 0 ? "R" : "L",
    index,
    term: reason?.term ?? cell?.tIdx ?? null,
    label: reason?.label || cell?.label || null,
    before: reason?.before || bedNow,
    after: reason?.after || null,
    aborted: reason?.aborted || null,
    atKnit: reason?.atKnit || null,
    atNow: reason?.atNow || null,
    needle: reason?.needle || null,
    marker: reason?.marker || null,
    holes: reason?.holes || null,
    collision: reason?.collision || null,
    postponed: reason?.postponed || null,
  };
}

function rowSig(row) {
  const cells = row.cells.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  return `${row.course}|${row.kind}|${row.dir}|${row.beds}|${cells}|${row.note || ""}`;
}

function seatRingExperiment(courses, planInfo) {
  const produced = seatRing(courses, planInfo);
  const last = produced.courses.at(-1);
  return {
    partial: false,
    stop: null,
    sheet: produced.sheet,
    courses: produced.courses,
    events: [],
    prevDir: last ? (last.dir === "R" ? 0 : 1) : null,
    bed: produced.bed,
    seated: produced.seated,
  };
}

function loadLayout(path) {
  const layout = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(layout.rings) || layout.rings.length < 2) fail(`${path} needs at least two faces_ring rings`);
  return layout;
}

function coveredFrom(sheet, offset) {
  const have = new Set();
  for (const row of sheet) {
    if (row.kind !== "knit") continue;
    for (const cell of row.cells) if (Number.isInteger(cell.tIdx)) have.add(cell.tIdx);
  }
  let n = offset;
  while (have.has(n)) n += 1;
  return n - offset;
}

function buildExperiment(path, copy = null) {
  const layout = loadLayout(path);
  const ring0 = layout.rings[0];
  const courses0 = coursesFromTypes(ring0.types, ring0.hangs);
  const planInfo = planBeds(baseWalesOf(courses0));
  const first = seatRingExperiment(courses0, planInfo);
  const sheets = [first.sheet];
  const courses = [...first.courses];
  const events = [...first.events];
  const termTypes = [];
  const hangs = [];
  const ringBreaks = [];
  const ringSeats = [];
  let termOffset = 0;
  let courseOffset = first.courses.length;
  let carried = first.bed;
  let prevDir = first.prevDir;
  let partialStop = null;

  const takeTerms = (types, hangList, n) => {
    termTypes.push(...types.slice(0, n));
    hangs.push(...hangList.slice(0, n));
    termOffset += n;
  };

  if (first.partial) {
    const n = coveredFrom(first.sheet, 0);
    takeTerms(ring0.types, ring0.hangs, n);
    partialStop = describeStop(first.stop, 0);
    ringSeats.push({ label: `实验停在第一环 course ${first.stop.course}`, seated: seatLoose(carried.stitches), partial: true });
  } else {
    takeTerms(ring0.types, ring0.hangs, ring0.types.length);
    ringSeats.push({ label: "第一环落座之后", seated: first.seated });
    for (let index = 1; index < layout.rings.length; index++) {
      const ring = layout.rings[index];
      const local = coursesFromTypes(ring.types, ring.hangs);
      ringBreaks.push(termOffset);
      const ringTerm = termOffset;
      const seated = seatContinuationExperiment(local, carried, prevDir, courseOffset);
      const shifted = seated.sheet.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => ({
          ...cell,
          tIdx: Number.isInteger(cell.tIdx) ? cell.tIdx + termOffset : cell.tIdx,
        })),
      }));
      sheets.push(shifted);
      courses.push(...seated.courses);
      events.push(
        ...seated.events.map((event) => ({
          ...event,
          ring: index,
          ...(Number.isInteger(event.term) ? { globalTerm: ringTerm + event.term } : {}),
        })),
      );
      const drawn = seated.partial ? coveredFrom(shifted, termOffset) : ring.types.length;
      if (seated.partial && drawn > ring.types.length) fail(`ring ${index} names ${drawn} terms`);
      takeTerms(ring.types, ring.hangs, drawn);
      courseOffset += seated.courses.length;
      carried = seated.bed;
      prevDir = seated.prevDir;
      if (seated.partial) {
        partialStop = describeStop(seated.stop, index);
        if (Number.isInteger(seated.stop?.term)) {
          partialStop.localTerm = seated.stop.term;
          partialStop.globalTerm = ringTerm + seated.stop.term;
          partialStop.sentence += ` 环内项 ${seated.stop.term}，全表项 ${partialStop.globalTerm}。`;
        }
        ringSeats.push({
          label: `实验停在第 ${index + 1} 环 course ${seated.stop.course}`,
          seated: seatLoose(carried.stitches),
          partial: true,
        });
        break;
      }
      const seat = seatLoose(carried.stitches);
      if (seat.front[0] !== 0) {
        partialStop = {
          ring: index,
          course: seated.courses.at(-1)?.course ?? courseOffset,
          dir: seated.courses.at(-1)?.dir || "",
          message: `ring ${index} finished off F0 (${seat.text})`,
          sentence: `generation stopped after ring ${index}: front is not on F0 (${seat.text}).`,
        };
        ringSeats.push({ label: partialStop.sentence, seated: seat, partial: true });
        break;
      }
      ringSeats.push({ label: `第 ${index + 1} 环结束`, seated: seat });
    }
  }

  const sheet = sheets.flat();
  const fitted = sheet.length ? fitChartWidth(sheet) : { width: 0, mirror: 0, widest: null };
  const labels = ["第一环", "第二环", "第三环", "第四环", "第五环", "第六环", "第七环"];
  return {
    built: {
      sheet,
      courses,
      seated: ringSeats.at(-1)?.seated || seatLoose(carried.stitches),
      ringSeats,
      ownBed: true,
      chartWidth: fitted.width,
      chartMirror: fitted.mirror,
      widestCourse: fitted.widest,
      baseN: planInfo.n,
      baseFront: planInfo.frontN,
      baseBack: planInfo.backN,
      types: termTypes.length,
      termTypes,
      hangs,
      ringBreaks,
      sheetName: "bed",
      title: copy?.title || "官方 Bunny 实验床图：第一环用官方落座，之后按 2026-11-17 的课级时序",
      inputLine:
        copy?.inputLine ||
        "实验调度，只读 public/sample/cylinder/faces_ring_layout.json 的官方 Bunny rings（types 和 hangs）。没有重算 mesh、faces_ring、cols_resample，没有用 Dense Bunny，也没有编织码或 DAT。第一环的加针开口和平衡时机与官方 seatRing 相同，不在计划针还没认领时先平衡。后面的课：只有加针就逐处开口并逐次平衡再整课织一次；只有减针就先整课织完再按走向逐个减针、逐次平衡；又有加针又有减针就先做完全部加针，再整课织一次，再逐个减针。同一活针不会在一行里织两次。减针剩下的位点按线圈身份找，不沿用旧针号。",
      scopeLine: partialStop
        ? `${partialStop.sentence} Later rows were not invented.`
        : copy?.scopeDone || "Official Bunny only. Experimental readable-map row schedule. Production bed files were not written.",
      partialStop,
      courseInput: copy?.courseInput || "faces_ring_layout.json",
    },
    events,
    partialStop,
    labels,
  };
}

function describeStop(stop, ring) {
  const message = stop?.error || "stopped";
  const clash = stop?.collision;
  let sentence = `实验停在第 ${ring + 1} 环 course ${stop?.course ?? "?"} ${stop?.dir || ""}（${message}）。`;
  if (clash) {
    const live = clash.live
      .map((st) => `线圈 ${st.id}（${st.origin || "无来源"}，wale ${st.wale}）在 ${st.bed}${st.phys}`)
      .join("，");
    const planned = clash.unusedPlan.map((slot) => `未织计划针 wale ${slot.wale} 仍占 ${slot.bed}${slot.phys}`).join("，");
    sentence += ` ${clash.needle} 同时被 ${live || "没有活线圈"} 和 ${planned || "没有计划针"} 占用。${clash.why}`;
  }
  return {
    ring,
    course: stop?.course ?? 0,
    dir: stop?.dir || "",
    message,
    sentence,
    detail: stop,
  };
}

function seatLoose(stitches) {
  try {
    const win = listsOf(stitches);
    const front = win.f.map((st) => st.phys);
    const back = win.b.map((st) => st.phys);
    const N = win.N;
    return {
      front,
      back,
      N,
      tF: Math.ceil(N / 2),
      tB: Math.floor(N / 2),
      text: liveWindow(stitches),
    };
  } catch {
    return { front: [], back: [], N: 0, tF: 0, tB: 0, text: "空" };
  }
}

function flattenKnits(sheet) {
  const out = [];
  sheet.forEach((row, sheetRow) => {
    if (row.kind !== "knit") return;
    row.cells.forEach((cell, cellIndex) => {
      out.push({
        sheetRow,
        cellIndex,
        course: row.course,
        dir: row.dir,
        tIdx: cell.tIdx,
        label: cell.label,
        token: cell.token,
        bed: cell.bed,
        phys: cell.phys,
        id: cell.id,
        origin: cell.origin || null,
        hole: Boolean(cell.hole),
      });
    });
  });
  return out;
}

function firstDivergence(baseline, experiment) {
  const base = flattenKnits(baseline.sheet);
  const exp = flattenKnits(experiment.sheet);
  const n = Math.min(base.length, exp.length);
  for (let i = 0; i < n; i++) {
    const b = base[i];
    const e = exp[i];
    if (b.tIdx !== e.tIdx || b.label !== e.label || b.bed !== e.bed || b.phys !== e.phys) {
      return {
        knitIndex: i,
        kind: b.tIdx !== e.tIdx || b.label !== e.label ? "term-or-label" : "needle",
        baseline: b,
        experiment: e,
      };
    }
  }
  if (base.length !== exp.length) {
    return {
      knitIndex: n,
      kind: "length",
      baselineCount: base.length,
      experimentCount: exp.length,
      baseline: base[n] || null,
      experiment: exp[n] || null,
    };
  }
  return null;
}

function countKinds(sheet) {
  const counts = {};
  for (const row of sheet) counts[row.kind] = (counts[row.kind] || 0) + 1;
  return counts;
}

function validate(built, baseline, events, inputMeta) {
  const expKnits = flattenKnits(built.sheet);
  const baseKnits = flattenKnits(baseline.sheet);
  const divergence = firstDivergence(baseline, built);
  const problems = [];
  const rowDup = [];
  built.sheet.forEach((row, index) => {
    if (row.kind !== "knit") return;
    const needles = new Set();
    const ids = new Set();
    for (const cell of row.cells) {
      const key = `${cell.bed}:${cell.phys}`;
      if (needles.has(key)) rowDup.push({ sheetRow: index, needle: key });
      needles.add(key);
      if (ids.has(cell.id)) rowDup.push({ sheetRow: index, id: cell.id });
      ids.add(cell.id);
    }
  });
  if (rowDup.length) problems.push({ check: "noDuplicateKnit", rowDup });

  const holes = new Map();
  for (const cell of expKnits) {
    if (!cell.hole) continue;
    const key = cell.origin || `id:${cell.id}`;
    holes.set(key, (holes.get(key) || 0) + 1);
  }
  const holeRepeats = [...holes].filter(([, n]) => n !== 1).map(([origin, n]) => ({ origin, n }));
  if (holeRepeats.length) problems.push({ check: "increaseHolesKnittedOnce", holeRepeats });

  const expTerms = expKnits.map((cell) => cell.tIdx).filter((tIdx) => Number.isInteger(tIdx));
  let dropped = null;
  for (let i = 1; i < expTerms.length; i++) {
    if (expTerms[i] < expTerms[i - 1]) {
      dropped = { at: i, tIdx: expTerms[i], prev: expTerms[i - 1] };
      break;
    }
  }
  const uniqueTerms = [...new Set(expTerms)].sort((a, b) => a - b);
  let missingTerm = null;
  if (uniqueTerms.length && uniqueTerms[0] !== 0) missingTerm = { expected: 0, got: uniqueTerms[0] };
  for (let i = 1; i < uniqueTerms.length && !missingTerm; i++) {
    if (uniqueTerms[i] !== uniqueTerms[i - 1] + 1) missingTerm = { after: uniqueTerms[i - 1], next: uniqueTerms[i] };
  }
  if (dropped || missingTerm) problems.push({ check: "termOrder", dropped, missingTerm });
  const sharedTermCells = [];
  const termCounts = new Map();
  for (const tIdx of expTerms) termCounts.set(tIdx, (termCounts.get(tIdx) || 0) + 1);
  for (const [tIdx, cells] of termCounts) if (cells > 1) sharedTermCells.push({ tIdx, cells });

  const knittedCourses = new Set();
  for (const row of built.sheet) {
    if (row.kind === "knit") knittedCourses.add(row.course);
    if (row.kind === "increase" && knittedCourses.has(row.course)) {
      problems.push({ check: "increaseAfterThisCourseKnit", course: row.course, sheetNote: row.note || "" });
    }
    if ((row.kind === "decrease" || row.kind === "flip") && row.cells.some((cell) => cell.role === "decrease" || cell.stacked)) {
      if (!knittedCourses.has(row.course)) problems.push({ check: "decreaseBeforeKnit", course: row.course });
    }
  }

  const decreaseEvents = events.filter((event) => event.type === "decrease");
  const unresolved = decreaseEvents.filter((event) => event.atKnit?.some((item) => item.missing));

  const loop = {
    baselineKnitCells: baseKnits.length,
    experimentKnitCells: expKnits.length,
    experimentTerms: built.types,
    baselineTerms: baseline.types,
    finalLive: built.seated?.N ?? null,
    baselineFinalLive: baseline.seated?.N ?? null,
  };

  const termsKnitted = uniqueTerms.length && uniqueTerms[0] === 0 && !missingTerm ? uniqueTerms.length : 0;
  const prefix = Math.min(baseKnits.length, expKnits.length);
  let bindingPrefix = prefix;
  for (let i = 0; i < prefix; i++) {
    const b = baseKnits[i];
    const e = expKnits[i];
    if (b.tIdx !== e.tIdx || b.label !== e.label || b.bed !== e.bed || b.phys !== e.phys || b.id !== e.id) {
      bindingPrefix = i;
      break;
    }
  }
  const stopBed = [
    ...(built.partialStop?.detail?.before?.front || []),
    ...(built.partialStop?.detail?.before?.back || []),
  ];
  const knittedIds = new Set(expKnits.map((cell) => cell.id));
  const pendingHoles = stopBed.filter((st) => String(st.origin || "").startsWith("hole:") && !knittedIds.has(st.id));
  if (built.partialStop?.detail?.phase === "balance") {
    problems.push({
      check: "balanceAfterOpening",
      course: built.partialStop.course,
      term: built.partialStop.detail.term,
      label: built.partialStop.detail.label,
      collision: built.partialStop.detail.collision,
    });
  }

  const extent = {
    courses: built.courses.length,
    baselineCourses: baseline.courses.length,
    knitRows: built.sheet.filter((row) => row.kind === "knit").length,
    baselineKnitRows: baseline.sheet.filter((row) => row.kind === "knit").length,
    knitCells: expKnits.length,
    termsKnitted,
    termsTotal: inputMeta.termTotal,
    sharedTermCells,
    completed: !built.partialStop && expKnits.length === baseKnits.length && !divergence,
    generatorFinished: !built.partialStop,
    decreaseRegionsReached: built.sheet.some((row) => row.kind === "knit" && row.cells.some((cell) => headerDec(cell))),
    mixedRegionsReached: built.sheet.some(
      (row) => row.kind === "knit" && row.cells.some((cell) => headerInc(cell)) && row.cells.some((cell) => headerDec(cell)),
    ),
  };

  return {
    divergence,
    problems,
    decreaseEvents: decreaseEvents.length,
    unresolvedPending: unresolved,
    loop,
    binding: {
      prefixCells: bindingPrefix,
      identicalToBaseline: bindingPrefix === expKnits.length && expKnits.length > 0,
      note: "已织前缀的项号、标签、针位和线圈 id 与基线一致。开口空针还没织到，所以不在这个前缀里。",
    },
    pendingIncreaseHoles: pendingHoles,
    extent,
    rowKindCounts: countKinds(built.sheet),
    baselineRowKindCounts: countKinds(baseline.sheet),
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rowIndexes(sheet, predicate) {
  const hits = [];
  sheet.forEach((row, index) => {
    if (predicate(row)) hits.push(index);
  });
  return hits;
}

function focusRows(sheet, predicate) {
  return rowIndexes(sheet, (row) => row.kind === "knit" && predicate(row));
}

function windowFor(sheet, indexes) {
  let lo = Infinity;
  let hi = -Infinity;
  const rows = [];
  for (const index of indexes) {
    const from = Math.max(0, index - 1);
    const to = Math.min(sheet.length - 1, index + 2);
    for (let i = from; i <= to; i++) {
      rows.push(i);
      for (const cell of sheet[i].cells) {
        if (Number.isInteger(cell.col)) {
          lo = Math.min(lo, cell.col);
          hi = Math.max(hi, cell.col);
        }
      }
    }
  }
  return { rows: [...new Set(rows)], lo: Number.isFinite(lo) ? lo : 0, hi: Number.isFinite(hi) ? hi : 0 };
}

function tableHtml(sheet, indexes, title) {
  if (!indexes.length) {
    return `<section class="focus"><h2>${escapeHtml(title)}</h2><p class="miss">实验表里没有这一类织行。</p></section>`;
  }
  const span = windowFor(sheet, indexes);
  const cols = [];
  for (let c = span.lo; c <= span.hi; c++) cols.push(c);
  const body = span.rows
    .map((index) => {
      const row = sheet[index];
      const byCol = new Map(row.cells.map((cell) => [cell.col, cell]));
      const tds = cols
        .map((col) => {
          const cell = byCol.get(col);
          if (!cell) return "<td></td>";
          return `<td style="background:${cell.fill || "#fff"}">${escapeHtml(cell.token || "")}</td>`;
        })
        .join("");
      const mark = indexes.includes(index) ? " hit" : "";
      return `<tr class="${mark}"><th>${index} ${escapeHtml(row.dir)} c${row.course}</th>${tds}</tr>`;
    })
    .join("");
  const head = cols.map((col) => `<th>${col}</th>`).join("");
  return `<section class="focus"><h2>${escapeHtml(title)}</h2><div class="scroller"><table><tr><th>行</th>${head}</tr>${body}</table></div></section>`;
}

function renderHtml(report) {
  const exp = report.experimentSheet;
  const base = report.baselineSheet;
  const div = report.divergence;
  const ringCourses = report.firstRing?.courses ?? 0;
  const expIncrease = focusRows(exp, (row) => row.cells.some((cell) => headerInc(cell)));
  const expDecrease = focusRows(exp, (row) => row.cells.some((cell) => headerDec(cell)));
  const expMixed = focusRows(exp, (row) => row.cells.some((cell) => headerInc(cell)) && row.cells.some((cell) => headerDec(cell)));
  const firstRingRows = exp.map((row, index) => (row.course < ringCourses ? index : -1)).filter((index) => index >= 0);
  const openings = rowIndexes(exp, (row) => row.kind === "increase");
  const divRows = div?.experiment?.sheetRow != null ? [div.experiment.sheetRow] : [];
  const baseDiv = div?.baseline?.sheetRow != null ? [div.baseline.sheetRow] : [];
  const firstRingTitle =
    report.firstRingFocusTitle || "实验：第一环 course 0–2。这几行应与官方床图相同；表里再往下是第二环。";
  const stopRow = report.partialStop ? exp.length - 1 : -1;
  const blocker = report.partialStop?.detail || null;
  const clash = blocker?.collision;
  const clashText = clash
    ? `\n${clash.needle}：活线圈 ${clash.live.map((st) => `#${st.id} ${st.origin} wale ${st.wale}`).join("、") || "无"}；未织计划针 ${clash.unusedPlan.map((slot) => `wale ${slot.wale}`).join("、") || "无"}。\n${clash.why}`
    : "";
  const blockerText = blocker
    ? `${report.partialStop.sentence}\n平衡前 ${blocker.before?.text || blocker.before?.live || "—"}，床没有被改动（中止快照 ${blocker.aborted?.text || "同前"}）。${clashText}`
    : "没有硬阻塞。";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(report.htmlTitle || "官方 Bunny 实验织行对照")}</title>
<style>
  body { margin: 0; font: 14px/1.4 "Segoe UI", sans-serif; color: #1b1b1b; background: #f6f4ef; }
  header { padding: 16px 20px; background: #1f3a34; color: #fff; }
  header p { margin: 6px 0 0; max-width: 900px; }
  main { padding: 16px 20px 40px; }
  .banner { padding: 12px 14px; background: #fff; border-left: 6px solid #b45309; margin: 12px 0; white-space: pre-wrap; }
  .ok { border-left-color: #047857; }
  .focus { margin: 18px 0; background: #fff; padding: 10px; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  .scroller { overflow-x: auto; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #ddd; min-width: 34px; height: 28px; text-align: center; font: 12px/1.1 ui-monospace, monospace; padding: 2px; }
  th { background: #eee; font-weight: 600; }
  tr.hit td { outline: 2px solid #b45309; }
  .miss { color: #7c2d12; }
  .pair { display: grid; grid-template-columns: 1fr; gap: 8px; }
</style>
</head>
<body>
<header>
  <strong>${escapeHtml(report.htmlHeader || "官方 Bunny · 实验课级时序")}</strong>
  <p>${escapeHtml(report.htmlBlurb || "只读现有 faces_ring。第一环沿用官方落座和平衡时机。之后按课：加针逐处开口并逐次平衡，整课织完，再逐个减针、逐次平衡。这不是 knitting code，也不改官方床图。")}</p>
</header>
<main>
  <div class="banner ${report.extent.generatorFinished && report.firstRing?.identical ? "ok" : ""}" id="status">${escapeHtml(report.statusLine)}</div>
  <div class="banner" id="first-ring">${escapeHtml(report.firstRingLine || "")}</div>
  <div class="banner" id="divergence-note">${escapeHtml(report.divergenceLine)}</div>
  <div class="banner" id="blocker">${escapeHtml(blockerText)}</div>
  <div id="focus-first-ring">${tableHtml(exp, firstRingRows, firstRingTitle)}</div>
  <div id="focus-divergence">${tableHtml(exp, divRows, "实验：和官方床图最早不同的织针")}${tableHtml(base, baseDiv, "官方：同一织针")}</div>
  <div id="focus-opening">${tableHtml(exp, openings.slice(0, 2), "实验：加针开口")}</div>
  <div id="focus-increase">${tableHtml(exp, expIncrease.slice(0, 1), "实验：第一处加针织行")}</div>
  <div id="focus-decrease">${tableHtml(exp, expDecrease.slice(0, 2), "实验：第一处减针所在的课")}</div>
  <div id="focus-mixed">${tableHtml(exp, expMixed.slice(0, 2), "实验：同一课里既有加针也有减针")}</div>
  <div id="focus-stop">${stopRow >= 0 ? tableHtml(exp, [stopRow], "实验：停住的位置") : "<section class=\"focus\"><h2>实验跑完了，没有提前停住的行。</h2></section>"}</div>
  <section class="focus"><h2>实验全表（${exp.length} 行）</h2>${fullTable(exp)}</section>
  <section class="focus"><h2>基线全表（${base.length} 行）</h2>${fullTable(base)}</section>
</main>
</body>
</html>
`;
}

function fullTable(sheet) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of sheet) {
    for (const cell of row.cells) {
      if (!Number.isInteger(cell.col)) continue;
      lo = Math.min(lo, cell.col);
      hi = Math.max(hi, cell.col);
    }
  }
  if (!Number.isFinite(lo)) return "<p>空表</p>";
  const cols = [];
  for (let c = lo; c <= hi; c++) cols.push(c);
  const head = `<tr><th>行</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const body = sheet
    .map((row, index) => {
      const byCol = new Map(row.cells.map((cell) => [cell.col, cell]));
      const tds = cols
        .map((col) => {
          const cell = byCol.get(col);
          if (!cell) return "<td></td>";
          return `<td style="background:${cell.fill || "#fff"}">${escapeHtml(cell.token || "")}</td>`;
        })
        .join("");
      return `<tr><th>${index} ${escapeHtml(row.dir)}</th>${tds}</tr>`;
    })
    .join("");
  return `<div class="scroller"><table>${head}${body}</table></div>`;
}

function sheetJson(sheet) {
  return sheet.map((row, index) => ({
    index,
    dir: row.dir,
    kind: row.kind,
    course: row.course,
    beds: row.beds,
    note: row.note || "",
    cells: row.cells.map((cell) => ({
      token: cell.token,
      fill: cell.fill,
      col: cell.col,
      bed: cell.bed,
      phys: cell.phys,
      id: cell.id,
      origin: cell.origin || null,
      role: cell.role || null,
      label: cell.label || null,
      kind: cell.kind || null,
      tIdx: Number.isInteger(cell.tIdx) ? cell.tIdx : null,
      hole: Boolean(cell.hole),
      stacked: Boolean(cell.stacked),
    })),
  }));
}

function hashFile(path) {
  return sha256(readFileSync(path));
}

function sheetRowBlocks(text) {
  const rows = [];
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^  row \d+ /.test(lines[i])) continue;
    const block = [lines[i]];
    while (i + 1 < lines.length && lines[i + 1].startsWith("    ")) block.push(lines[++i]);
    rows.push(block.join("\n"));
  }
  return rows;
}

function firstSheetMismatch(expSheet, baseSheet, ringCourses) {
  const exp = expSheet.filter((row) => row.course < ringCourses);
  const base = baseSheet.filter((row) => row.course < ringCourses);
  const n = Math.max(exp.length, base.length);
  for (let i = 0; i < n; i++) {
    const e = exp[i];
    const b = base[i];
    if (!e || !b) {
      return { row: i, kind: "row-count", experiment: e ? rowSig(e) : null, baseline: b ? rowSig(b) : null };
    }
    if (rowSig(e) !== rowSig(b)) {
      const cells = Math.max(e.cells.length, b.cells.length);
      let cell = null;
      for (let c = 0; c < cells; c++) {
        const ec = e.cells[c];
        const bc = b.cells[c];
        const es = ec ? `${ec.token}@${ec.bed}${ec.phys}` : null;
        const bs = bc ? `${bc.token}@${bc.bed}${bc.phys}` : null;
        if (es !== bs) {
          cell = { index: c, experiment: es, baseline: bs };
          break;
        }
      }
      return {
        row: i,
        course: e.course,
        kind: cell ? "cell" : e.beds !== b.beds ? "beds" : "note",
        cell,
        experimentBeds: e.beds,
        baselineBeds: b.beds,
        experimentNote: e.note || "",
        baselineNote: b.note || "",
      };
    }
  }
  return null;
}

function decreaseSchedule(sheet) {
  const byCourse = new Map();
  sheet.forEach((row, index) => {
    const list = byCourse.get(row.course) || [];
    list.push({ index, row });
    byCourse.set(row.course, list);
  });
  const courses = [...byCourse.keys()].sort((a, b) => a - b);
  for (const course of courses) {
    const rows = byCourse.get(course);
    const knits = rows.filter((item) => item.row.kind === "knit");
    const hasDec = knits.some((item) => item.row.cells.some((cell) => headerDec(cell)));
    if (!hasDec) continue;
    const hasInc = knits.some((item) => item.row.cells.some((cell) => headerInc(cell)));
    const lastKnit = Math.max(...knits.map((item) => item.index));
    const transfers = rows.filter((item) => item.row.kind === "decrease" || item.row.cells.some((cell) => cell.role === "decrease"));
    const postKnit = transfers.length > 0 && transfers.every((item) => item.index > lastKnit);
    const first = knits.find((item) => item.row.cells.some((cell) => headerDec(cell)));
    const header = first.row.cells.find((cell) => headerDec(cell));
    return {
      course,
      mixed: hasInc,
      sheetRow: first.index,
      term: header?.tIdx ?? null,
      label: header?.label || header?.token || "",
      postKnitDecrease: postKnit,
      knitRows: knits.length,
      decreaseRows: transfers.length,
    };
  }
  return null;
}

async function shoot(htmlPath, outDir) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { ok: false, reason: "playwright is not installed" };
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  const shots = [
    ["status", "status"],
    ["first-ring", "first-ring-note"],
    ["blocker", "blocker"],
    ["focus-first-ring", "first-ring-region"],
    ["focus-increase", "increase-region"],
    ["focus-decrease", "decrease-region"],
    ["focus-mixed", "mixed-region"],
    ["focus-divergence", "earliest-difference"],
    ["focus-stop", "stop-location"],
  ];
  const written = [];
  for (const [id, name] of shots) {
    const handle = await page.$(`#${id}`);
    if (!handle) continue;
    const file = join(outDir, `${name}.png`);
    await handle.screenshot({ path: file });
    written.push(relative(root, file));
  }
  await browser.close();
  return { ok: true, written };
}

function mainPaths() {
  return {
    txt: join(OUT_DIR, "exp-readable-map.txt"),
    xls: join(OUT_DIR, "exp-readable-map.xls"),
    json: join(OUT_DIR, "exp-readable-map.json"),
    report: join(OUT_DIR, "validation-report.json"),
    html: join(OUT_DIR, "compare.html"),
  };
}

async function run(argv) {
  const check = argv.includes("--check");
  const noShot = argv.includes("--no-screenshots");
  const beforeXls = hashFile(BASE_XLS);
  const beforeTxt = hashFile(BASE_TXT);
  const inputBuf = readFileSync(INPUT);
  const inputHash = sha256(inputBuf);
  const layout = JSON.parse(inputBuf.toString("utf8"));
  const baseline = buildOwnBedChart(INPUT);
  const { built, events } = buildExperiment(INPUT);
  let text = "";
  let bytes = null;
  let renderError = null;
  try {
    text = renderReport(built);
    bytes = workbookBytes(built);
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
    text = `${built.title}\n${renderError}\n`;
  }
  const validation = validate(built, baseline, events, { termTotal: layout.term_total });
  const div = validation.divergence;
  const officialRing = buildFromFacesRing(INPUT);
  const ringCourses = officialRing.courses.length;
  const firstRing = firstSheetMismatch(built.sheet, officialRing.sheet, ringCourses) || firstSheetMismatch(built.sheet, baseline.sheet, ringCourses);
  const firstDecrease = decreaseSchedule(built.sheet);
  const officialBlocks = sheetRowBlocks(readFileSync(BASE_TXT, "utf8"));
  const experimentBlocks = sheetRowBlocks(text);
  const ringRows = officialRing.sheet.length;
  let txtMismatch = null;
  for (let i = 0; i < ringRows; i++) {
    if (experimentBlocks[i] !== officialBlocks[i]) {
      txtMismatch = { row: i, experiment: experimentBlocks[i] || null, official: officialBlocks[i] || null };
      break;
    }
  }
  const firstRingIdentical = !firstRing && !txtMismatch;
  let firstRingLine = firstRingIdentical
    ? `第一环 ${ringCourses} 课、${ringRows} 行与官方 seatRing 以及 faces_ring0_step4_bed.txt 的对应行相同（针号、记号、行注）。`
    : firstRing
      ? `第一环不一致。第 ${firstRing.row} 行 course ${firstRing.course ?? "?"}：${firstRing.cell ? `实验 ${firstRing.cell.experiment}，官方 ${firstRing.cell.baseline}` : firstRing.kind}。没有改认领规则去凑齐。`
      : `第一环床图文字不一致。官方 txt 第 ${txtMismatch.row} 行：\n${txtMismatch.official}\n实验：\n${txtMismatch.experiment}`;
  const statusLine = built.partialStop
    ? `未完成。${built.partialStop.sentence} 已生成 ${validation.extent.courses} 课 / 官方 ${validation.extent.baselineCourses} 课，织 ${validation.extent.knitCells} 针、项 ${validation.extent.termsKnitted} / ${layout.term_total}。`
    : `生成完成。实验 ${validation.extent.courses} 课，官方 ${validation.extent.baselineCourses} 课；实验 ${validation.extent.knitRows} 个织行，官方 ${validation.extent.baselineKnitRows} 个织行。`;
  let divergenceLine = "第一环之后，和官方床图的织针序没有差异。";
  if (!firstRingIdentical) {
    divergenceLine = "第一环已经和官方床图不同，后面的差异先不算。";
  } else if (div?.kind === "needle") {
    divergenceLine = `第一环之后最早的针位差异在织针序 ${div.knitIndex}：项 ${div.experiment.tIdx} ${div.experiment.label}。官方 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}，course ${div.baseline.course}）。实验 ${div.experiment.bed}${div.experiment.phys}（表行 ${div.experiment.sheetRow}，course ${div.experiment.course}，线圈 ${div.experiment.origin || div.experiment.id}）。`;
  } else if (div?.kind === "term-or-label") {
    divergenceLine = `第一环之后最早的项序差异在织针序 ${div.knitIndex}：官方项 ${div.baseline?.tIdx} ${div.baseline?.label}，实验项 ${div.experiment?.tIdx} ${div.experiment?.label}。`;
  } else if (div?.kind === "length") {
    const next = div.baseline
      ? `官方下一针是 course ${div.baseline.course} 项 ${div.baseline.tIdx} ${div.baseline.label}，在 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}）。`
      : "";
    divergenceLine = `已织的 ${div.experimentCount} 针和官方前缀一致。实验在下一针之前停住。${next}官方一共 ${div.baselineCount} 针。`;
  }
  if (firstDecrease) {
    divergenceLine += firstDecrease.postKnitDecrease
      ? ` 第一处减针是 course ${firstDecrease.course} 项 ${firstDecrease.term} ${firstDecrease.label}（表行 ${firstDecrease.sheetRow}，${firstDecrease.mixed ? "加减针同一课" : "只有减针"}）。减针移圈排在这一课全部织行之后。`
      : ` 第一处减针是 course ${firstDecrease.course}，但减针移圈没有排在整课织完之后。`;
  } else if (!built.partialStop) {
    divergenceLine += " 整张表没有减针课。";
  } else {
    divergenceLine += " 还没有走到减针课。";
  }
  const postponed = events.filter((event) => event.type === "postponed-balance" || (event.postponed && event.postponed.length));
  const officialAssets = {
    "faces_ring_layout.json": hashFile(INPUT),
    "faces_ring0_step4_bed.xls": beforeXls,
    "faces_ring0_step4_bed.txt": beforeTxt,
    "stitch_map_bind.json": hashFile(join(root, "public/sample/cylinder/stitch_map_bind.json")),
    "faces_ring0_v2.dat": hashFile(join(root, "public/sample/cylinder/faces_ring0_v2.dat")),
    "cut_iteration_0.obj": hashFile(join(root, "public/sample/cylinder/cut_iteration_0.obj")),
  };
  const report = {
    experiment: "official-bunny-readable-row-schedule",
    input: {
      path: "public/sample/cylinder/faces_ring_layout.json",
      sha256: inputHash,
      source: layout.source,
      model: layout.model,
      nFacesRing: layout.n_faces_ring,
      termTotal: layout.term_total,
      termCounts: layout.term_counts,
    },
    baseline: {
      xls: "public/sample/cylinder/faces_ring0_step4_bed.xls",
      xlsSha256: beforeXls,
      txt: "public/sample/cylinder/faces_ring0_step4_bed.txt",
      txtSha256: beforeTxt,
    },
    officialAssets,
    output: {
      directory: "experiments/official-bunny-readable-row-schedule",
      files: ["exp-readable-map.txt", "exp-readable-map.xls", "exp-readable-map.json", "validation-report.json", "compare.html"],
    },
    status: !firstRingIdentical ? "first-ring-mismatch" : built.partialStop ? "partial" : "complete",
    statusLine,
    firstRingLine,
    divergenceLine,
    firstRing: {
      courses: ringCourses,
      rows: ringRows,
      identical: firstRingIdentical,
      mismatch: firstRing,
      txtMismatch,
    },
    firstDecrease,
    postponedBalances: postponed,
    partialStop: built.partialStop,
    divergence: div,
    extent: validation.extent,
    checks: {
      problems: validation.problems,
      decreaseEvents: validation.decreaseEvents,
      unresolvedPending: validation.unresolvedPending,
      loop: validation.loop,
      binding: validation.binding,
      pendingIncreaseHoles: validation.pendingIncreaseHoles,
      rowKindCounts: validation.rowKindCounts,
      baselineRowKindCounts: validation.baselineRowKindCounts,
      renderError,
    },
    timing:
      "第一环使用官方 seatRing：加针开口之后先整课织完，计划针认领了再平衡。后面的课按 2026-11-17：加针逐处开口并逐次平衡，整课织完，再按线圈身份逐个减针、逐次平衡。减针不再插在课的中途。",
  };
  const chromeLabel = built.partialStop || !firstRingIdentical ? "Bunny 实验（新时序，未跑完）" : "Bunny 实验（新时序）";
  const chrome = {
    label: chromeLabel,
    menuTitle: built.partialStop
      ? `实验课级时序，停在 ${built.partialStop.sentence} 不是官方 Bunny`
      : "实验课级时序的 readable map，不是官方 Bunny",
    banner: built.partialStop || !firstRingIdentical ? "实验时序 · 未跑完 · 右侧不是官方床图" : "实验时序 · 不是官方床图",
    status: built.partialStop
      ? `${chromeLabel} · 左侧是官方 Bunny 网格 · ${built.partialStop.sentence}`
      : `${chromeLabel} · 左侧是官方 Bunny 网格 · 右侧是实验课级时序，不是官方床图`,
    metaPrefix: built.partialStop || !firstRingIdentical ? "未跑完" : "实验时序",
  };
  const mapJson = {
    input: report.input,
    partialStop: built.partialStop,
    courses: built.courses,
    events,
    sheet: sheetJson(built.sheet),
  };
  const htmlReport = {
    ...report,
    experimentSheet: sheetJson(built.sheet),
    baselineSheet: sheetJson(baseline.sheet),
  };
  const html = renderHtml(htmlReport);
  if (hashFile(BASE_XLS) !== beforeXls || hashFile(BASE_TXT) !== beforeTxt) {
    fail("official Bunny bed files changed while the experiment ran");
  }
  if (check) {
    const paths = mainPaths();
    const txtOk = readFileSync(paths.txt, "utf8") === text;
    const xlsOk = bytes && readFileSync(paths.xls).equals(bytes);
    const reportOnDisk = JSON.parse(readFileSync(paths.report, "utf8"));
    const reportOk = reportOnDisk.status === report.status && reportOnDisk.input.sha256 === report.input.sha256 && reportOnDisk.divergenceLine === report.divergenceLine;
    if (!txtOk || !xlsOk || !reportOk) fail(`committed experiment outputs drifted txt=${txtOk} xls=${xlsOk} report=${reportOk}`);
    console.log(`check ok ${report.status} terms ${validation.extent.termsKnitted}/${layout.term_total}`);
    return report;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const paths = mainPaths();
  writeFileSync(paths.txt, text);
  if (bytes) writeFileSync(paths.xls, bytes);
  writeFileSync(paths.json, JSON.stringify(mapJson));
  writeFileSync(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(paths.html, html);
  writeFileSync(join(OUT_DIR, "preview-chrome.json"), `${JSON.stringify(chrome, null, 2)}\n`);
  let shots = { ok: false, reason: "skipped" };
  if (!noShot) shots = await shoot(paths.html, OUT_DIR);
  report.screenshots = shots;
  writeFileSync(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  console.log(statusLine);
  console.log(firstRingLine);
  console.log(divergenceLine);
  if (built.partialStop) console.log(built.partialStop.message);
  console.log(shots.ok ? `screenshots ${shots.written.length}` : `screenshots skipped: ${shots.reason}`);
  if (!firstRingIdentical) fail(firstRingLine);
  return report;
}

const CYLINDERS = [
  ["standrad", "Standrad", "Standrad Cylinder", "standrad-cylinder.json", "public/sample/cylinder/standrad_cylinder_rings.json", "public/sample/cylinder/standrad_cylinder_bed", ["public/sample/cylinder/standrad_cylinder.dat", "public/sample/cylinder/standrad_cylinder.k", "public/sample/cylinder/standrad_cylinder_knitcode.json", "public/sample/cylinder/standrad_cylinder_KnittingStitches.obj", "public/sample/cylinder/standrad_cylinder_readable_map.txt"]],
  ["dense-standrad", "Dense Standrad", "Dense Standrad Cylinder", "dense-standrad-cylinder.json", "public/sample/dense-standrad/dense_standrad_cylinder_faces_ring_layout.json", "public/sample/dense-standrad/dense_standrad_cylinder_bed", ["public/sample/dense-standrad/dense_standrad_cylinder.dat", "public/sample/dense-standrad/dense_standrad_cylinder.k", "public/sample/dense-standrad/dense_standrad_cylinder_knitcode.json", "public/sample/dense-standrad/dense_standrad_cylinder_KnittingStitches.obj"]],
  ["increase", "Increase", "Increase Cylinder", "increase-cylinder.json", "public/sample/increase/increase_cylinder_faces_ring_layout.json", "public/sample/increase/increase_cylinder_bed", ["public/sample/increase/increase_cylinder.dat", "public/sample/increase/increase_cylinder.k", "public/sample/increase/increase_cylinder_knitcode.json", "public/sample/increase/increase_cylinder_KnittingStitches.obj"]],
  ["decrease", "Decrease", "Decrease Cylinder", "decrease-cylinder.json", "public/sample/decrease/decrease_cylinder_faces_ring_layout.json", "public/sample/decrease/decrease_cylinder_bed", ["public/sample/decrease/decrease_cylinder.dat", "public/sample/decrease/decrease_cylinder.k", "public/sample/decrease/decrease_cylinder_knitcode.json", "public/sample/decrease/decrease_cylinder_KnittingStitches.obj"]],
  ["thin", "Thin", "Thin Cylinder", "thin-cylinder.json", "public/sample/thin/thin_cylinder_faces_ring_layout.json", "public/sample/thin/thin_cylinder_bed", ["public/sample/thin/thin_cylinder.dat", "public/sample/thin/thin_cylinder.k", "public/sample/thin/thin_cylinder_knitcode.json", "public/sample/thin/thin_cylinder_KnittingStitches.obj"]],
  ["fat", "Fat", "Fat Cylinder", "fat-cylinder.json", "public/sample/fat/fat_cylinder_faces_ring_layout.json", "public/sample/fat/fat_cylinder_bed", ["public/sample/fat/fat_cylinder.dat", "public/sample/fat/fat_cylinder.k", "public/sample/fat/fat_cylinder_knitcode.json", "public/sample/fat/fat_cylinder_KnittingStitches.obj"]],
  ["dense-increase", "Dense Increase", "Dense Increase Cylinder", "dense-increase-cylinder.json", "public/sample/dense-increase/dense_increase_cylinder_faces_ring_layout.json", "public/sample/dense-increase/dense_increase_cylinder_bed", ["public/sample/dense-increase/dense_increase_cylinder.dat", "public/sample/dense-increase/dense_increase_cylinder.k", "public/sample/dense-increase/dense_increase_cylinder_knitcode.json", "public/sample/dense-increase/dense_increase_cylinder_KnittingStitches.obj"]],
  ["dense-decrease", "Dense Decrease", "Dense Decrease Cylinder", "dense-decrease-cylinder.json", "public/sample/dense-decrease/dense_decrease_cylinder_faces_ring_layout.json", "public/sample/dense-decrease/dense_decrease_cylinder_bed", ["public/sample/dense-decrease/dense_decrease_cylinder.dat", "public/sample/dense-decrease/dense_decrease_cylinder.k", "public/sample/dense-decrease/dense_decrease_cylinder_knitcode.json", "public/sample/dense-decrease/dense_decrease_cylinder_KnittingStitches.obj"]],
  ["dense-thin", "Dense Thin", "Dense Thin Cylinder", "dense-thin-cylinder.json", "public/sample/dense-thin/dense_thin_cylinder_faces_ring_layout.json", "public/sample/dense-thin/dense_thin_cylinder_bed", ["public/sample/dense-thin/dense_thin_cylinder.dat", "public/sample/dense-thin/dense_thin_cylinder.k", "public/sample/dense-thin/dense_thin_cylinder_knitcode.json", "public/sample/dense-thin/dense_thin_cylinder_KnittingStitches.obj"]],
  ["dense-fat", "Dense Fat", "Dense Fat Cylinder", "dense-fat-cylinder.json", "public/sample/dense-fat/dense_fat_cylinder_faces_ring_layout.json", "public/sample/dense-fat/dense_fat_cylinder_bed", ["public/sample/dense-fat/dense_fat_cylinder.dat", "public/sample/dense-fat/dense_fat_cylinder.k", "public/sample/dense-fat/dense_fat_cylinder_knitcode.json", "public/sample/dense-fat/dense_fat_cylinder_KnittingStitches.obj"]],
].map(([key, shortName, officialName, manifest, inputRel, bedStem, extraRels]) => ({
  key,
  shortName,
  officialName,
  manifest,
  sheetId: `${key}-exp-readable-row-schedule`,
  dirName: `official-${key}-readable-row-schedule`,
  inputRel,
  bedXlsRel: `${bedStem}.xls`,
  bedTxtRel: `${bedStem}.txt`,
  extraRels,
}));

const SKIPPED_CYLINDERS = [
  {
    id: "dense-bunny-4split",
    reason: "public/sample/dense-bunny-4split 只有 columns（polyline、type、field、order），没有 faces_ring，也没有可落座的床图。",
  },
  {
    id: "dense-bunny-le",
    reason: "public/sample/dense-bunny-le 只有 columns（polyline、type、field、order），没有 faces_ring，也没有可落座的床图。",
  },
];

function hashIfExists(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return null;
  return hashFile(abs);
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkFiles(path, acc);
    else acc.push(path);
  }
  return acc;
}

function snapshotOfficial() {
  const map = {};
  for (const path of walkFiles(join(root, "public/sample"))) {
    const rel = relative(root, path);
    if (!/(?:_bed\.(?:xls|txt)$|faces_ring|rings\.json|\.dat$|\.k$|knitcode\.json|KnittingStitches\.obj$|cols_resample|columns_)/i.test(rel)) continue;
    map[rel] = hashFile(path);
  }
  return map;
}

function sameHashes(before, after) {
  const changed = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) if (before[key] !== after[key]) changed.push(key);
  return changed.sort();
}

function cylinderCopy(spec) {
  return {
    title: `${spec.shortName} 实验床图：第一环用官方落座，之后按 2026-11-17 的课级时序`,
    inputLine: `实验调度，只读 ${spec.inputRel} 的 rings（types 和 hangs）。没有重算 mesh、faces_ring、cols_resample，没有改官方床图、编织码、.dat 或 .k。第一环的加针开口和平衡时机与官方 seatRing 相同，不在计划针还没认领时先平衡。后面的课：只有加针就逐处开口并逐次平衡再整课织一次；只有减针就先整课织完再按走向逐个减针、逐次平衡；又有加针又有减针就先做完全部加针，再整课织一次，再逐个减针。同一活针不会在一行里织两次。减针剩下的位点按线圈身份找，不沿用旧针号。床已经合法（F≥B、|F−B|≤1、前床低端 F0）时省略空平衡行，需要的横移和翻针不省略。`,
    scopeDone: `${spec.shortName} only. Experimental readable-map course schedule. Official bed, faces_ring, knitting code, DAT, and .k files were not written.`,
    courseInput: basename(spec.inputRel),
  };
}

function auditLaterSchedule(sheet, ringCourses) {
  const problems = [];
  const by = new Map();
  sheet.forEach((row, index) => {
    if (!(row.course >= ringCourses)) return;
    const list = by.get(row.course) || [];
    list.push({ index, row });
    by.set(row.course, list);
  });
  for (const [course, rows] of by) {
    const knits = rows.filter((item) => item.row.kind === "knit");
    if (!knits.length) {
      problems.push({ check: "courseWithoutKnit", course });
      continue;
    }
    const firstKnit = knits[0].index;
    const lastKnit = knits[knits.length - 1].index;
    for (const item of rows) {
      if (item.row.kind === "increase" && item.index > firstKnit) {
        problems.push({ check: "increaseAfterKnit", course, sheetRow: item.index });
      }
      const decreaseTransfer =
        item.row.kind === "decrease" || item.row.cells.some((cell) => cell.role === "decrease" || cell.stacked);
      if (decreaseTransfer && item.index < lastKnit) {
        problems.push({ check: "decreaseBeforeCourseFinished", course, sheetRow: item.index });
      }
    }
  }
  return problems;
}

function ringStartsOf(built, events) {
  const starts = [];
  if (built.courses[0]) {
    starts.push({
      ring: 0,
      course: built.courses[0].course,
      start: built.courses[0].start,
      schedule: "official-seatRing",
    });
  }
  const seen = new Set();
  for (const event of events) {
    if (event.type !== "course-schedule" || event.ring == null || seen.has(event.ring)) continue;
    seen.add(event.ring);
    starts.push({ ring: event.ring, course: event.course, start: event.start, schedule: event.schedule });
  }
  return starts;
}

function currentBedLandings(events) {
  return events
    .filter((event) => event.type === "decrease" && event.landing === "current-bed")
    .map((event) => ({
      ring: event.ring ?? null,
      course: event.course,
      localTerm: event.term,
      globalTerm: event.globalTerm ?? null,
      atKnit: event.atKnit || [],
      atDecrease: event.atDecrease || [],
      bedsBefore: event.bedsBefore || "",
      bedsAfterBalance: event.bedsAfter || "",
      crossAtKnit: Boolean(event.crossAtKnit),
      crossNow: Boolean(event.crossNow),
      sideAtKnit: event.sideAtKnit || "",
      sideUsed: event.sideUsed || "",
      balanceRows: event.balanceRows,
      transfers: event.transfers || [],
      balance: event.balance || "",
      sentence: event.landingSentence || "",
    }));
}

function chromeForCylinder(spec, built, firstRingIdentical) {
  const unfinished = Boolean(built.partialStop) || !firstRingIdentical;
  const label = unfinished ? `${spec.shortName} 实验（新时序，未跑完）` : `${spec.shortName} 实验（新时序）`;
  return {
    label,
    menuTitle: built.partialStop
      ? `实验课级时序，停在 ${built.partialStop.sentence} 不是官方 ${spec.shortName}`
      : `实验课级时序的 readable map，不是官方 ${spec.shortName}`,
    banner: unfinished ? "实验时序 · 未跑完 · 右侧不是官方床图" : "实验时序 · 不是官方床图",
    status: built.partialStop
      ? `${label} · 左侧是官方 ${spec.officialName} 网格 · ${built.partialStop.sentence}`
      : `${label} · 左侧是官方 ${spec.officialName} 网格 · 右侧是实验课级时序，不是官方床图`,
    metaPrefix: unfinished ? "未跑完" : "实验时序",
    sheetId: spec.sheetId,
  };
}

function loadBaseline(input) {
  try {
    return { built: buildOwnBedChart(input), mode: "full", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      return { built: buildOwnBedChart(input, { partialOnError: true }), mode: "partial", error: message };
    } catch (err2) {
      const second = err2 instanceof Error ? err2.message : String(err2);
      return { built: null, mode: "unavailable", error: `${message} | ${second}` };
    }
  }
}

async function runCylinder(spec, { check }) {
  if (spec.dirName.includes("bunny")) fail("the official Bunny experiment sheet is left as it is");
  const input = join(root, spec.inputRel);
  const bedXls = join(root, spec.bedXlsRel);
  const bedTxt = join(root, spec.bedTxtRel);
  const beforeXls = hashFile(bedXls);
  const beforeTxt = hashFile(bedTxt);
  const extraBefore = Object.fromEntries(spec.extraRels.map((rel) => [rel, hashIfExists(rel)]));
  const inputBuf = readFileSync(input);
  const inputHash = sha256(inputBuf);
  const layout = JSON.parse(inputBuf.toString("utf8"));
  const baselineInfo = loadBaseline(input);
  if (!baselineInfo.built) fail(`${spec.shortName}: official bed could not be rebuilt in memory (${baselineInfo.error})`);
  const baseline = baselineInfo.built;
  const { built, events } = buildExperiment(input, cylinderCopy(spec));
  let text = "";
  let bytes = null;
  let renderError = null;
  try {
    text = renderReport(built);
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
    text = `${built.title}\n${renderError}\n`;
  }
  if (!renderError) {
    try {
      bytes = workbookBytes(built);
    } catch (err) {
      renderError = err instanceof Error ? err.message : String(err);
    }
  }
  const validation = validate(built, baseline, events, { termTotal: layout.term_total });
  const div = validation.divergence;
  let officialRing = null;
  let ringSeatError = null;
  try {
    officialRing = buildFromFacesRing(input);
  } catch (err) {
    ringSeatError = err instanceof Error ? err.message : String(err);
  }
  const ringCourses = officialRing ? officialRing.courses.length : built.courses.length ? 1 : 0;
  const firstRing = officialRing
    ? firstSheetMismatch(built.sheet, officialRing.sheet, ringCourses) || firstSheetMismatch(built.sheet, baseline.sheet, ringCourses)
    : { kind: "seatRing-threw", error: ringSeatError };
  const firstDecrease = decreaseSchedule(built.sheet);
  const officialBlocks = sheetRowBlocks(readFileSync(bedTxt, "utf8"));
  const experimentBlocks = sheetRowBlocks(text);
  const ringRows = officialRing ? officialRing.sheet.length : 0;
  let txtMismatch = null;
  if (officialRing) {
    for (let i = 0; i < ringRows; i++) {
      if (experimentBlocks[i] !== officialBlocks[i]) {
        txtMismatch = { row: i, experiment: experimentBlocks[i] || null, official: officialBlocks[i] || null };
        break;
      }
    }
  }
  let decreasePrefix = null;
  if (!officialRing) {
    const expKnits = flattenKnits(built.sheet);
    const baseKnits = flattenKnits(baseline.sheet);
    let i = 0;
    let mismatch = null;
    while (i < expKnits.length && i < baseKnits.length) {
      if (headerDec(expKnits[i].label || "") || headerDec(baseKnits[i].label || "")) break;
      const same =
        expKnits[i].tIdx === baseKnits[i].tIdx &&
        expKnits[i].label === baseKnits[i].label &&
        expKnits[i].bed === baseKnits[i].bed &&
        expKnits[i].phys === baseKnits[i].phys &&
        expKnits[i].token === baseKnits[i].token;
      if (!same) {
        mismatch = { knitIndex: i, experiment: expKnits[i], baseline: baseKnits[i] };
        break;
      }
      i += 1;
    }
    decreasePrefix = { matchedKnits: i, mismatch };
  }
  const bedName = basename(spec.bedTxtRel);
  const firstRingIdentical = Boolean(officialRing) && !firstRing && !txtMismatch;
  let firstRingLine = firstRingIdentical
    ? `第一环 ${ringCourses} 课、${ringRows} 行与官方 seatRing 以及 ${bedName} 的对应行相同（针号、记号、行注）。`
    : firstRing && firstRing.kind !== "seatRing-threw"
      ? `第一环不一致。第 ${firstRing.row} 行 course ${firstRing.course ?? "?"}：${firstRing.cell ? `实验 ${firstRing.cell.experiment}，官方 ${firstRing.cell.baseline}` : firstRing.kind}。没有改认领规则去凑齐。`
      : officialRing
        ? `第一环床图文字不一致。官方 txt 第 ${txtMismatch.row} 行：\n${txtMismatch.official}\n实验：\n${txtMismatch.experiment}`
        : decreasePrefix?.mismatch
          ? `官方第一环 seatRing 不能整环落座（${ringSeatError}）。无减针前缀在织针序 ${decreasePrefix.mismatch.knitIndex} 就和官方床图不同。`
          : `官方第一环 seatRing 不能整环落座（${ringSeatError}）。无减针前缀 ${decreasePrefix?.matchedKnits ?? 0} 针与官方床图相同，第一处预定分歧在减针。`;
  const statusLine = built.partialStop
    ? `未完成。${built.partialStop.sentence} 已生成 ${validation.extent.courses} 课 / 官方 ${validation.extent.baselineCourses} 课，织 ${validation.extent.knitCells} 针、项 ${validation.extent.termsKnitted} / ${layout.term_total}。`
    : `生成完成。实验 ${validation.extent.courses} 课，官方 ${validation.extent.baselineCourses} 课；实验 ${validation.extent.knitRows} 个织行，官方 ${validation.extent.baselineKnitRows} 个织行。`;
  let divergenceLine = "第一环之后，和官方床图的织针序没有差异。";
  if (!firstRingIdentical) {
    divergenceLine = officialRing
      ? "第一环已经和官方床图不同，后面的差异先不算。"
      : firstRingLine;
  } else if (div?.kind === "needle") {
    divergenceLine = `第一环之后最早的针位差异在织针序 ${div.knitIndex}：项 ${div.experiment.tIdx} ${div.experiment.label}。官方 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}，course ${div.baseline.course}）。实验 ${div.experiment.bed}${div.experiment.phys}（表行 ${div.experiment.sheetRow}，course ${div.experiment.course}，线圈 ${div.experiment.origin || div.experiment.id}）。`;
  } else if (div?.kind === "term-or-label") {
    divergenceLine = `第一环之后最早的项序差异在织针序 ${div.knitIndex}：官方项 ${div.baseline?.tIdx} ${div.baseline?.label}，实验项 ${div.experiment?.tIdx} ${div.experiment?.label}。`;
  } else if (div?.kind === "length") {
    const next = div.baseline
      ? `官方下一针是 course ${div.baseline.course} 项 ${div.baseline.tIdx} ${div.baseline.label}，在 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}）。`
      : "";
    divergenceLine = `已织的 ${div.experimentCount} 针和官方前缀一致。实验在下一针之前停住。${next}官方一共 ${div.baselineCount} 针。`;
  }
  if (firstRingIdentical) {
    if (firstDecrease) {
      divergenceLine += firstDecrease.postKnitDecrease
        ? ` 第一处减针是 course ${firstDecrease.course} 项 ${firstDecrease.term} ${firstDecrease.label}（表行 ${firstDecrease.sheetRow}，${firstDecrease.mixed ? "加减针同一课" : "只有减针"}）。减针移圈排在这一课全部织行之后。`
        : ` 第一处减针是 course ${firstDecrease.course}，但减针移圈没有排在整课织完之后。`;
    } else if (!built.partialStop) {
      divergenceLine += " 整张表没有减针课。";
    } else {
      divergenceLine += " 还没有走到减针课。";
    }
  }
  const postponed = events.filter((event) => event.type === "postponed-balance" || (event.postponed && event.postponed.length));
  const ringStarts = ringStartsOf(built, events);
  const offF0 = ringStarts.filter((item) => item.start !== "F0");
  const scheduleProblems = officialRing ? auditLaterSchedule(built.sheet, ringCourses) : [];
  if (offF0.length) scheduleProblems.push({ check: "ringStart", rings: offF0 });
  const omittedIncreaseBalances = events
    .filter((event) => event.type === "course-schedule")
    .reduce((sum, event) => sum + (event.omittedIncreaseBalances || 0), 0);
  const omittedDecreaseBalances = events.filter((event) => event.type === "decrease" && event.balanceRows === 0).length;
  const hardProblems = [...validation.problems, ...scheduleProblems];
  const extraAfter = Object.fromEntries(spec.extraRels.map((rel) => [rel, hashIfExists(rel)]));
  const afterXls = hashFile(bedXls);
  const afterTxt = hashFile(bedTxt);
  const officialChanged = afterXls !== beforeXls || afterTxt !== beforeTxt || spec.extraRels.some((rel) => extraBefore[rel] !== extraAfter[rel]);
  if (officialChanged) fail(`${spec.shortName}: official bed or protected files changed while the experiment ran`);
  const status = !firstRingIdentical ? "first-ring-mismatch" : built.partialStop ? "partial" : hardProblems.length || renderError ? "checks-failed" : "complete";
  const report = {
    experiment: spec.dirName,
    sheetId: spec.sheetId,
    menuLabel: `${spec.shortName} 实验（新时序）`,
    input: {
      path: spec.inputRel,
      sha256: inputHash,
      source: layout.source,
      model: layout.model,
      nFacesRing: layout.n_faces_ring,
      termTotal: layout.term_total,
      termCounts: layout.term_counts,
    },
    baseline: {
      xls: spec.bedXlsRel,
      xlsSha256: beforeXls,
      xlsSha256After: afterXls,
      txt: spec.bedTxtRel,
      txtSha256: beforeTxt,
      txtSha256After: afterTxt,
      unchanged: !officialChanged,
      rebuild: baselineInfo.mode,
      rebuildError: baselineInfo.error,
    },
    officialAssets: {
      [basename(spec.inputRel)]: inputHash,
      [basename(spec.bedXlsRel)]: beforeXls,
      [basename(spec.bedTxtRel)]: beforeTxt,
      ...extraBefore,
    },
    output: {
      directory: `experiments/${spec.dirName}`,
      files: ["exp-readable-map.txt", "exp-readable-map.xls", "exp-readable-map.json", "validation-report.json", "compare.html", "preview-chrome.json"],
      dat: null,
      knitCode: null,
    },
    status,
    statusLine,
    firstRingLine,
    divergenceLine,
    firstRing: {
      courses: ringCourses,
      rows: ringRows,
      identical: firstRingIdentical,
      mismatch: firstRing,
      txtMismatch,
      seatRingError: ringSeatError,
      noDecreasePrefix: decreasePrefix,
    },
    firstDecrease,
    postponedBalances: postponed,
    omittedNoOpBalances: {
      increaseOpenings: omittedIncreaseBalances,
      decreases: omittedDecreaseBalances,
    },
    ringStarts,
    partialStop: built.partialStop,
    divergence: div,
    extent: validation.extent,
    compare: {
      experimentCourses: validation.extent.courses,
      officialCourses: validation.extent.baselineCourses,
      experimentKnitRows: validation.extent.knitRows,
      officialKnitRows: validation.extent.baselineKnitRows,
      experimentSheetRows: built.sheet.length,
      officialSheetRows: baseline.sheet.length,
    },
    checks: {
      problems: hardProblems,
      decreaseEvents: validation.decreaseEvents,
      unresolvedPending: validation.unresolvedPending,
      loop: validation.loop,
      binding: validation.binding,
      pendingIncreaseHoles: validation.pendingIncreaseHoles,
      rowKindCounts: validation.rowKindCounts,
      baselineRowKindCounts: validation.baselineRowKindCounts,
      renderError,
    },
    currentBedLandings: currentBedLandings(events),
    timing:
      "第一环使用官方 seatRing：加针开口之后先整课织完，计划针认领了再平衡。后面的课按 2026-11-17：加针逐处开口并逐次平衡，整课织完，再按线圈身份逐个减针、逐次平衡。减针落点按减针当时的床位，不冻结织当时的跨床关系。床已经合法时省略空平衡行。",
    deepLink: `?sheet=${spec.sheetId}`,
  };
  const chrome = chromeForCylinder(spec, built, firstRingIdentical);
  const paths = {
    dir: join(root, "experiments", spec.dirName),
    txt: join(root, "experiments", spec.dirName, "exp-readable-map.txt"),
    xls: join(root, "experiments", spec.dirName, "exp-readable-map.xls"),
    json: join(root, "experiments", spec.dirName, "exp-readable-map.json"),
    report: join(root, "experiments", spec.dirName, "validation-report.json"),
    html: join(root, "experiments", spec.dirName, "compare.html"),
    chrome: join(root, "experiments", spec.dirName, "preview-chrome.json"),
  };
  const html = renderHtml({
    ...report,
    htmlTitle: `${spec.shortName} 实验织行对照`,
    htmlHeader: `${spec.officialName} · 实验课级时序`,
    htmlBlurb:
      "只读现有 faces_ring。第一环沿用官方落座和平衡时机。之后按课：加针逐处开口并逐次平衡，整课织完，再逐个减针、逐次平衡。减针落点按此时床位。这不是 knitting code，也不改官方床图。",
    firstRingFocusTitle: `实验：第一环 ${ringCourses} 课、${ringRows} 行。这几行应与官方床图相同。`,
    experimentSheet: sheetJson(built.sheet),
    baselineSheet: sheetJson(baseline.sheet),
  });
  if (!check && existsSync(paths.report)) {
    const onDisk = JSON.parse(readFileSync(paths.report, "utf8"));
    if (onDisk.status === "complete") {
      const txtOk = existsSync(paths.txt) && readFileSync(paths.txt, "utf8") === text;
      const xlsOk = Boolean(bytes) && existsSync(paths.xls) && readFileSync(paths.xls).equals(bytes);
      if (!txtOk || !xlsOk) {
        fail(`${spec.shortName}: completed experiment sheet would change (txt=${txtOk} xls=${xlsOk}); leaving it in place`);
      }
      return onDisk;
    }
  }
  if (check) {
    const txtOk = existsSync(paths.txt) && readFileSync(paths.txt, "utf8") === text;
    const xlsOk = Boolean(bytes) && existsSync(paths.xls) && readFileSync(paths.xls).equals(bytes);
    const reportOnDisk = JSON.parse(readFileSync(paths.report, "utf8"));
    const reportOk =
      reportOnDisk.status === report.status &&
      reportOnDisk.input.sha256 === report.input.sha256 &&
      reportOnDisk.divergenceLine === report.divergenceLine &&
      reportOnDisk.firstRingLine === report.firstRingLine &&
      reportOnDisk.baseline.unchanged === true &&
      reportOnDisk.baseline.xlsSha256 === beforeXls &&
      reportOnDisk.baseline.txtSha256 === beforeTxt;
    if (!txtOk || !xlsOk || !reportOk) {
      fail(`${spec.shortName}: committed experiment outputs drifted txt=${txtOk} xls=${xlsOk} report=${reportOk}`);
    }
    return report;
  }
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.txt, text);
  if (bytes) writeFileSync(paths.xls, bytes);
  writeFileSync(
    paths.json,
    JSON.stringify({
      input: report.input,
      partialStop: built.partialStop,
      courses: built.courses,
      events,
      sheet: sheetJson(built.sheet),
    }),
  );
  writeFileSync(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(paths.html, html);
  writeFileSync(paths.chrome, `${JSON.stringify(chrome, null, 2)}\n`);
  if (hashFile(bedXls) !== beforeXls || hashFile(bedTxt) !== beforeTxt) {
    fail(`${spec.shortName}: official bed hash changed after writing the experiment`);
  }
  return report;
}

async function runCylinders(argv) {
  const check = argv.includes("--check");
  const onlyAt = argv.indexOf("--only");
  const only = onlyAt >= 0 ? argv[onlyAt + 1] : "";
  const specs = CYLINDERS.filter((spec) => !only || spec.key === only || spec.sheetId === only);
  if (!specs.length) fail(`no official cylinder ${only || ""}`);
  const before = snapshotOfficial();
  const results = [];
  for (const spec of specs) {
    console.log(`\n== ${spec.shortName}`);
    const report = await runCylinder(spec, { check });
    results.push({
      sheetId: spec.sheetId,
      menuLabel: report.menuLabel,
      directory: report.output.directory,
      deepLink: report.deepLink,
      status: report.status,
      completed: report.status === "complete",
      firstRingIdentical: report.firstRing.identical,
      officialUnchanged: report.baseline.unchanged,
      officialXlsSha256: report.baseline.xlsSha256,
      courses: report.compare,
      postponed: (report.postponedBalances || []).map((event) => ({
        type: event.type,
        course: event.course,
        terms: event.terms || (event.postponed || []).map((item) => item.term),
      })),
      omittedNoOpBalances: report.omittedNoOpBalances,
      currentBedLandings: (report.currentBedLandings || []).map((item) => ({
        ring: item.ring,
        course: item.course,
        localTerm: item.localTerm,
        globalTerm: item.globalTerm,
        sentence: item.sentence,
        bedsBefore: item.bedsBefore,
        bedsAfterBalance: item.bedsAfterBalance,
      })),
      ringStarts: report.ringStarts,
      partialStop: report.partialStop
        ? { ring: report.partialStop.ring, course: report.partialStop.course, dir: report.partialStop.dir, sentence: report.partialStop.sentence }
        : null,
      statusLine: report.statusLine,
      firstRingLine: report.firstRingLine,
      divergenceLine: report.divergenceLine,
    });
    console.log(report.statusLine);
    console.log(report.firstRingLine);
    console.log(report.divergenceLine);
  }
  const after = snapshotOfficial();
  const changed = sameHashes(before, after);
  if (changed.length) fail(`official sample files changed: ${changed.join(", ")}`);
  const summary = {
    skipped: SKIPPED_CYLINDERS,
    officialBunnySheet: "bunny-exp-readable-row-schedule",
    officialFilesUnchanged: changed.length === 0,
    officialFileCount: Object.keys(before).length,
    models: results,
  };
  const summaryDir = join(root, "experiments/official-cylinder-readable-row-schedules");
  const summaryPath = join(summaryDir, "summary.json");
  if (!check) {
    if (only && existsSync(summaryPath)) {
      const prior = JSON.parse(readFileSync(summaryPath, "utf8"));
      const byId = new Map((prior.models || []).map((item) => [item.sheetId, item]));
      for (const item of results) byId.set(item.sheetId, item);
      summary.models = CYLINDERS.map((spec) => byId.get(spec.sheetId)).filter(Boolean);
    }
    mkdirSync(summaryDir, { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  } else if (existsSync(summaryPath)) {
    const onDisk = JSON.parse(readFileSync(join(summaryDir, "summary.json"), "utf8"));
    const brief = (list) => list.map((item) => `${item.sheetId}:${item.status}:${item.firstRingIdentical}`).join(",");
    if (brief(onDisk.models || []) !== brief(results)) fail("cylinder summary drifted");
  }
  console.log(`official hashes unchanged (${Object.keys(before).length} files)`);
  const bad = results.filter((item) => item.status === "first-ring-mismatch" || item.status === "checks-failed" || item.status === "error");
  if (bad.length) fail(`cylinder experiment needs attention: ${bad.map((item) => `${item.sheetId} ${item.status}`).join("; ")}`);
  return summary;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const argv = process.argv.slice(2);
  const job = argv.includes("--cylinders") ? runCylinders(argv) : run(argv);
  job.catch((err) => {
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}
