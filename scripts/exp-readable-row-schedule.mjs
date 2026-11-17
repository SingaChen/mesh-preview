/**
 * Opt-in experiment for the official Bunny readable map only.
 *
 * Scheduling, not targets: for each readable-map knit row (a live-needle
 * row, not a knitting-code bed row and not a whole course),
 *   1. open that row's increase sites in traversal order;
 *   2. balance after each completed opening and keep the new holes;
 *   3. knit the whole row, including decrease-group stitches and holes;
 *   4. then stack each decrease in traversal order, re-finding the
 *      remaining sites by stitch id, and balance after each one.
 *
 * Default Step4 output is not written. Official Bunny inputs are read
 * only. This file does not regenerate faces_ring, cols, or any other model.
 *
 *   node scripts/exp-readable-row-schedule.mjs
 *   node scripts/exp-readable-row-schedule.mjs --check
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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
  if (!n) return 0;
  if (cell.kind !== "inc" && cell.kind !== "wrapInc") return 0;
  if (!String(cell.label).includes("+")) return 0;
  return n;
}

function headerDec(cell) {
  const n = decAdded(cell.label);
  if (!n) return 0;
  if (cell.kind !== "dec" && cell.kind !== "wrapDec") return 0;
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
      note: `${where}: 实验：织这一行之前，把 ${marker.origin || marker.id} 所在的 ${markerBed}${markerPhys} 往后开口。空针先记下，这一行里只织一次。`,
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
      origin: `hole:t${cell.tIdx}:g${g}`,
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

function applyDecrease(state, group, where, course) {
  const snap = snapState(state);
  const before = bedSnapshot(state.stitches);
  const atNow = membersOf(state.stitches, group.ids);
  if (atNow.some((item) => item.missing)) {
    return { ok: false, phase: "decrease-identity", error: `${where}: 减针项 ${group.term} 的线圈已经不在床上`, before, atKnit: group.atKnit, atNow };
  }
  const members = group.ids.map((id) => state.stitches.get(id));
  const nowCross = crossesFold(state.stitches, members);
  if (nowCross !== group.crossAtKnit) {
    return {
      ok: false,
      phase: "decrease-geometry",
      error: `${where}: 项 ${group.term} 在织的时候${group.crossAtKnit ? "跨床" : "同床"}，平衡之后变成${nowCross ? "跨床" : "同床"}。不改减针落点。`,
      before,
      atKnit: group.atKnit,
      atNow,
    };
  }
  const rows = [];
  try {
    if (nowCross) {
      if (!chainOk(members)) {
        restoreState(state, snap);
        return {
          ok: false,
          phase: "decrease-geometry",
          error: `${where}: 项 ${group.term} 的跨床减针不再是相邻折点`,
          before,
          atKnit: group.atKnit,
          atNow,
        };
      }
      const stacked = stackCrossBedGroup(state.stitches, members, state.waleToId, course, where);
      rows.push(...stacked.transfers.map((row) => ({ ...row, course, note: `实验：整行织完后，按线圈身份套项 ${group.term}。${row.note}` })));
    } else if (!relationHolds(members, group.side)) {
      restoreState(state, snap);
      return {
        ok: false,
        phase: "decrease-geometry",
        error: `${where}: 项 ${group.term} 织完时是 ${group.side} 向同床减针，平衡后的针位不再保持这个落点`,
        before,
        atKnit: group.atKnit,
        atNow,
      };
    } else {
      const passed = sameBedPasses(state, group, members, where, course);
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
  return { ok: true, rows, before, after: bedSnapshot(state.stitches), atNow };
}

function sameBedPasses(state, group, members, where, course) {
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
        note: `${where}: 实验：第 ${k + 1} 次移圈前，折点 ${other}${partner.phys} 翻到 ${recvBed}${recvPhys}。`,
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
        note: `${where}: 实验：${fromBed}${source.phys} 套到接收圈 ${first.origin || first.id}（${first.bed}${first.phys}）。`,
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
      note: `${where}: 实验：整行织完后，第 ${k + 1} 次从 ${recvBed}${recvPhys} 套到 ${first.bed}${first.phys}（${first.origin || first.id}）。`,
    });
  }
  if (allowed.size) {
    return { ok: false, phase: "decrease-target", error: `${where}: 减针组里还有线圈没有按原身份套完` };
  }
  return { ok: true, rows };
}

function knitCellsOf(plan, groups) {
  const sideOf = new Map(groups.map((group) => [group.ids[0], group.side]));
  return plan.map(({ item, st }) => {
    let label = item.cell.label;
    const nDec = headerDec(item.cell);
    if (nDec) label = `-${sideOf.get(st.id) || "R"}${nDec}`;
    const painted = paint(st.bed, label, item.cell.kind);
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
      hole: Boolean(st.hole),
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

/**
 * Later rings. One knit row is the longest prefix that can be knitted,
 * after that prefix's own increase openings, without visiting a live
 * needle twice. A decrease or increase span stays on one row. Decrease
 * transfers wait until that row has been knitted.
 */
function seatContinuationExperiment(courses, carried, prevDirIn, courseOffset, termOffset) {
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
    const fold = isFoldReturn(course, prevDir);
    let index = 0;
    let rowInCourse = 0;
    let courseStart = null;
    let knitted = 0;
    while (index < course.cells.length) {
      const cuts = cutPoints(course.cells, index);
      let chosen = null;
      let firstFail = null;
      for (const end of cuts) {
        const probe = cloneState(state);
        const tried = prepareRow(probe, course, index, end, fold, where, courseNo);
        if (!tried.ok) {
          if (!firstFail) firstFail = { ...tried, end, term: course.cells[index].tIdx };
          break;
        }
        chosen = end;
      }
      if (chosen == null) {
        stop = blockerFrom(firstFail, courseNo, course, index, bedSnapshot(state.stitches));
        break;
      }
      const snap = snapState(state);
      const beforeOpen = bedSnapshot(state.stitches);
      const prepared = prepareRow(state, course, index, chosen, fold, where, courseNo);
      if (!prepared.ok) {
        restoreState(state, snap);
        stop = blockerFrom(prepared, courseNo, course, index, bedSnapshot(state.stitches));
        break;
      }
      const more = chosen < course.cells.length;
      const splitNote = more && firstFail && firstFail.phase === "duplicate-needle" ? `${where}: ${LIVE_ROW_NOTE}` : "";
      for (const row of prepared.rows) sheet.push(row);
      const cells = knitCellsOf(prepared.knitPlan, prepared.groups);
      try {
        settleColumns(cells, prepared.dirSign, where);
      } catch (err) {
        restoreState(state, snap);
        stop = blockerFrom(
          { phase: "columns", error: err instanceof Error ? err.message : String(err) },
          courseNo,
          course,
          index,
          bedSnapshot(state.stitches),
        );
        break;
      }
      const seenId = new Set();
      for (const cell of cells) {
        if (seenId.has(cell.id)) {
          restoreState(state, snap);
          stop = blockerFrom(
            { phase: "duplicate-stitch", error: `${where}: 线圈 ${cell.origin || cell.id} 在同一织行织了两次`, term: cell.tIdx },
            courseNo,
            course,
            index,
            bedSnapshot(state.stitches),
          );
          break;
        }
        seenId.add(cell.id);
      }
      if (stop) break;
      if (ci === 0 && index === 0) {
        const startSt = prepared.knitPlan[0].st;
        if (startSt.bed !== "F" || startSt.phys !== 0) {
          stop = blockerFrom(
            {
              phase: "ring-start",
              error: `${where}: 开口并平衡之后，这一环的第一针在 ${startSt.bed}${startSt.phys}，不是 F0`,
              before: beforeOpen,
              after: bedSnapshot(state.stitches),
              term: prepared.knitPlan[0].item.cell.tIdx,
            },
            courseNo,
            course,
            index,
            bedSnapshot(state.stitches),
          );
          break;
        }
      }
      const dirName = course.dir === 0 ? "R" : "L";
      const note = [
        `${where}: 实验织行。先做这一行的加针开口，每完成一处就平衡；然后整行织完，包括减针组和开口空针；减针等这一行织完再按走向逐个处理。`,
        splitNote,
      ]
        .filter(Boolean)
        .join(" ");
      sheet.push({
        dir: dirName,
        kind: "knit",
        course: courseNo,
        cells,
        beds: prepared.beds,
        note,
      });
      if (!courseStart) courseStart = cells[0];
      knitted += cells.length;
      remember({
        type: "knit-row",
        course: courseNo,
        dir: dirName,
        from: index,
        to: chosen,
        holes: prepared.holeIds,
        cells: cells.map((cell) => ({
          tIdx: cell.tIdx,
          label: cell.label,
          id: cell.id,
          origin: cell.origin,
          bed: cell.bed,
          phys: cell.phys,
          hole: cell.hole,
        })),
      });
      let decreaseFailed = false;
      for (const group of prepared.groups) {
        const decreased = applyDecrease(state, group, where, courseNo);
        if (!decreased.ok) {
          stop = blockerFrom(decreased, courseNo, course, index, bedSnapshot(state.stitches));
          stop.term = group.term;
          stop.groupAtKnit = group.atKnit;
          decreaseFailed = true;
          break;
        }
        for (const row of decreased.rows) sheet.push(row);
        const balanced = tryBalance(state, where, courseNo, `项 ${group.term} 减针之后平衡。`);
        if (!balanced.ok) {
          stop = blockerFrom({ ...balanced, term: group.term, atKnit: group.atKnit }, courseNo, course, index, bedSnapshot(state.stitches));
          decreaseFailed = true;
          break;
        }
        for (const row of balanced.rows) sheet.push(row);
        remember({
          type: "decrease",
          course: courseNo,
          term: group.term,
          ids: group.ids,
          side: group.side,
          crossAtKnit: group.crossAtKnit,
          atKnit: group.atKnit,
          after: membersOf(state.stitches, group.ids.filter((id) => state.stitches.has(id))),
          balance: balanced.after.text,
        });
      }
      if (decreaseFailed) break;
      const endId = rowEndId(state, cells, prepared.groups);
      const endSt = endId == null ? null : state.stitches.get(endId);
      if (!endSt) {
        stop = blockerFrom(
          { phase: "row-end", error: `${where}: 织完并移圈之后，这一行的终点线圈不在床上` },
          courseNo,
          course,
          index,
          bedSnapshot(state.stitches),
        );
        break;
      }
      state.cursor = endSt;
      index = chosen;
      rowInCourse += 1;
    }
    if (stop) break;
    const endSt = state.cursor;
    coursesOut.push({
      course: courseNo,
      dir: course.dir === 0 ? "R" : "L",
      start: `${courseStart.bed}${courseStart.phys}`,
      end: `${endSt.bed}${endSt.phys}`,
      n: knitted,
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
    label: cell?.label || null,
    before: reason?.before || bedNow,
    after: reason?.after || null,
    aborted: reason?.aborted || null,
    atKnit: reason?.atKnit || null,
    atNow: reason?.atNow || null,
    needle: reason?.needle || null,
    marker: reason?.marker || null,
    holes: reason?.holes || null,
    collision: reason?.collision || null,
  };
}

function rowSig(row) {
  const cells = row.cells.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  return `${row.course}|${row.kind}|${row.dir}|${row.beds}|${cells}|${row.note || ""}`;
}

function seatRingExperiment(courses, planInfo) {
  const plan = planInfo.plan;
  let live = new Map();
  const stitches = new Map();
  const sheet = [];
  const coursesOut = [];
  const events = [];
  let nextId = 0;
  let prevEnd = null;
  let stop = null;

  const birth = (placed, wale, base) => {
    const id = nextId;
    nextId += 1;
    const st = {
      id,
      bed: placed.bed,
      phys: placed.phys,
      wale,
      base: Boolean(base),
      origin: base ? `base:w${wale}` : `hole:r0:w${wale}`,
      hole: !base,
    };
    stitches.set(id, st);
    live.set(wale, id);
    return st;
  };

  const state = () => ({ stitches, waleToId: live, plan, nextId, cursor: prevEnd ? stitches.get(prevEnd.id) : null });

  let prevDir = null;
  for (let ci = 0; ci < courses.length && !stop; ci++) {
    const course = courses[ci];
    const fold = isFoldReturn(course, prevDir);
    const step = course.dir === 0 ? 1 : -1;
    const where = `course ${ci}`;
    const incs = course.cells.filter((cell) => incAdded(cell.label));
    const decs = course.cells.filter((cell) => decAdded(cell.label) && (cell.kind === "dec" || cell.kind === "wrapDec"));
    if (decs.length) {
      stop = blockerFrom({ phase: "ring0-decrease", error: `${where}: 第一环出现减针，落座规则没有这一步` }, ci, course, 0, bedSnapshot(stitches));
      break;
    }
    const fresh = new Set();
    const seatedAtStart = new Set(live.keys());
    const transferIncs = incs.filter((cell) => seatedAtStart.has(cell.wale));
    if (transferIncs.length && live.size > 0) {
      for (const cell of transferIncs.slice().reverse()) {
        const added = incAdded(cell.label);
        const pivot = cell.wale + step;
        const siteWales = [];
        for (let g = 1; g <= added; g++) {
          const wale = cell.wale + step * g;
          fresh.add(wale);
          siteWales.push(wale);
        }
        const before = bedSnapshot(stitches);
        for (let k = 0; k < added; k++) {
          let moved;
          try {
            const shapeBed = shapeBedOf(fresh, live, stitches, where);
            const beds = liveWindow(stitches);
            moved = applyIncrease(live, stitches, pivot, step, shapeBed);
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
              note: `${where}: 实验：织这一行之前开口（项 ${cell.tIdx}）。开口完成后再平衡，不把后面的减针插进来。`,
            });
          } catch (err) {
            stop = blockerFrom(
              { phase: "ring0-increase", error: err instanceof Error ? err.message : String(err), before, term: cell.tIdx },
              ci,
              course,
              course.cells.findIndex((item) => item.tIdx === cell.tIdx),
              bedSnapshot(stitches),
            );
            break;
          }
        }
        if (stop) break;
        for (const wale of siteWales) {
          if (live.has(wale)) continue;
          try {
            const { left, right } = neighbors(live, stitches, wale);
            const placed = physInHole(left, right, `${where} wale ${wale}`);
            const st = birth(placed, wale, false);
            st.hole = true;
            st.origin = `hole:r0:t${cell.tIdx}:w${wale}`;
            assertNoShare(stitches, where);
          } catch (err) {
            stop = blockerFrom(
              { phase: "ring0-hole", error: err instanceof Error ? err.message : String(err), before, term: cell.tIdx },
              ci,
              course,
              course.cells.findIndex((item) => item.tIdx === cell.tIdx),
              bedSnapshot(stitches),
            );
            break;
          }
        }
        if (stop) break;
        const balanced = tryBalance(state(), where, ci, `第一环项 ${cell.tIdx} 开口之后平衡。`);
        live = state().waleToId;
        nextId = state().nextId;
        if (!balanced.ok) {
          stop = blockerFrom({ ...balanced, term: cell.tIdx }, ci, course, course.cells.findIndex((item) => item.tIdx === cell.tIdx), bedSnapshot(stitches));
          break;
        }
        for (const row of balanced.rows) sheet.push(row);
        events.push({ type: "ring0-increase", course: ci, term: cell.tIdx, after: balanced.after.text });
      }
    }
    if (stop) break;

    try {
    const dirSign = course.dir === 0 ? 1 : -1;
    const knitBeds = liveWindow(stitches);
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
        st = fold ? endSt : stepCircle(endSt, dirSign, stitches);
        claimWale(live, stitches, st, cell.wale);
      } else {
        let id = live.get(cell.wale);
        if (id != null && used.has(id)) id = null;
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
            const pair = neighbors(live, stitches, cell.wale);
            placed = physInHole(pair.left, pair.right, `${where} wale ${cell.wale}`);
          } else if (!placed && prevKnit) {
            st = stepCircle(prevKnit, dirSign, stitches);
            claimWale(live, stitches, st, cell.wale);
          } else if (!placed) fail(`${where} wale ${cell.wale} is neither a base stitch nor this increase`);
          if (!st && placed) {
            st = birth(placed, cell.wale, placed.base);
            if (placed.base) st.hole = false;
            assertNoShare(stitches, where);
          }
        }
        if (!st && id != null) st = stitches.get(id);
      }
      if (!st || !stitches.has(st.id)) fail(`${where}: wale ${cell.wale} has no stitch`);
      const slotNow = plan.get(cell.wale);
      if (slotNow && !slotNow.used && st.bed === slotNow.bed && st.phys === slotNow.phys) slotNow.used = true;
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
        origin: st.origin || null,
        role: "knit",
        label: cell.label,
        kind: cell.kind,
        tIdx: cell.tIdx,
        hole: Boolean(st.hole),
      });
    }
    const segments = rowsByLiveNeedle(knitCells);
    for (const segment of segments) settleColumns(segment, dirSign, where);
    const start = knitCells[0];
    const end = knitCells.at(-1);
    if (prevEnd && fold) {
      const endSt = stitches.get(prevEnd.id);
      if (!endSt) fail(`${where}: fold-return lost the previous end stitch`);
      if (start.id !== endSt.id) {
        fail(`${where}: fold-return starts at ${start.bed}${start.phys}, not the end stitch ${endSt.bed}${endSt.phys}`);
      }
    } else if (prevEnd) {
      const endSt = stitches.get(prevEnd.id);
      if (!endSt) fail(`${where}: previous end stitch left the bed`);
      if (start.id === endSt.id) fail(`${where}: a course that is not a fold-return stays on the end stitch ${endSt.bed}${endSt.phys}`);
      const further = stepCircle(endSt, dirSign, stitches);
      if (start.id !== further.id) {
        fail(`${where}: start ${start.bed}${start.phys} is not one needle further than ${endSt.bed}${endSt.phys} (${further.bed}${further.phys})`);
      }
    }
    const dirName = course.dir === 0 ? "R" : "L";
    segments.forEach((segment, segIndex) => {
      const row = { dir: dirName, kind: "knit", course: ci, cells: segment, beds: knitBeds };
      if (segIndex < segments.length - 1) row.note = `${where}: ${LIVE_ROW_NOTE}`;
      sheet.push(row);
    });
    coursesOut.push({
      course: ci,
      dir: dirName,
      start: `${start.bed}${start.phys}`,
      end: `${end.bed}${end.phys}`,
      n: knitCells.length,
    });
    prevEnd = { id: end.id, bed: end.bed, phys: end.phys };
    if (incs.length && !transferIncs.length) {
      try {
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
      } catch (err) {
        stop = blockerFrom(
          { phase: "balance", error: err instanceof Error ? err.message : String(err), before: bedSnapshot(stitches) },
          ci,
          course,
          0,
          bedSnapshot(stitches),
        );
        break;
      }
    } else if (incs.length && transferIncs.length) {
      const balanced = tryBalance(state(), where, ci, "这一行织完后再次核对床位。");
      if (!balanced.ok) {
        stop = blockerFrom(balanced, ci, course, 0, bedSnapshot(stitches));
        break;
      }
      for (const row of balanced.rows) sheet.push(row);
    }
    if (stop) break;
    const endSt = stitches.get(prevEnd.id);
    if (endSt) prevEnd = { id: endSt.id, bed: endSt.bed, phys: endSt.phys };
    prevDir = course.dir;
    events.push({
      type: "ring0-knit",
      course: ci,
      n: knitCells.length,
      segments: segments.length,
      bed: bedSnapshot(stitches).text,
    });
    } catch (err) {
      stop = blockerFrom(
        { phase: "ring0-knit", error: err instanceof Error ? err.message : String(err), before: bedSnapshot(stitches) },
        ci,
        course,
        0,
        bedSnapshot(stitches),
      );
      break;
    }
  }

  const produced = seatRing(courses, planBeds(baseWalesOf(courses)));
  const early = (rows) => rows.filter((row) => row.course < 2).map(rowSig);
  const got = early(sheet);
  const expect = early(produced.sheet);
  if (got.length !== expect.length || got.some((line, i) => line !== expect[i])) {
    const at = got.findIndex((line, i) => line !== expect[i]);
    fail(`ring 0 courses 0-1 drifted from the production seater at row ${at}: ${got[at]} != ${expect[at]}`);
  }

  if (stop) {
    return {
      partial: true,
      stop,
      sheet,
      courses: coursesOut,
      events,
      bed: { stitches, waleToId: live, cursor: prevEnd ? stitches.get(prevEnd.id) : null, nextId },
      prevDir,
    };
  }
  for (const slot of plan.values()) {
    if (!slot.used) fail(`a base stitch was never knitted (${slot.bed}${slot.phys})`);
  }
  return {
    partial: false,
    sheet,
    courses: coursesOut,
    events,
    prevDir,
    bed: { stitches, waleToId: live, cursor: stitches.get(prevEnd.id), nextId },
    seated: produced.seated,
  };
}

function loadLayout(path) {
  const layout = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(layout.rings) || layout.rings.length < 2) fail(`${path} is not the official Bunny faces_ring`);
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

function buildExperiment(path) {
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
      const seated = seatContinuationExperiment(local, carried, prevDir, courseOffset, termOffset);
      const shifted = seated.sheet.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => ({
          ...cell,
          tIdx: Number.isInteger(cell.tIdx) ? cell.tIdx + termOffset : cell.tIdx,
        })),
      }));
      sheets.push(shifted);
      courses.push(...seated.courses);
      events.push(...seated.events.map((event) => ({ ...event, ring: index })));
      const drawn = seated.partial ? coveredFrom(shifted, termOffset) : ring.types.length;
      if (seated.partial && drawn > ring.types.length) fail(`ring ${index} names ${drawn} terms`);
      takeTerms(ring.types, ring.hangs, drawn);
      courseOffset += seated.courses.length;
      carried = seated.bed;
      prevDir = seated.prevDir;
      if (seated.partial) {
        partialStop = describeStop(seated.stop, index);
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
      title: "官方 Bunny 实验床图：织行先开口并逐次平衡，整行织完再逐个减针",
      inputLine:
        "实验调度，只读 public/sample/cylinder/faces_ring_layout.json 的官方 Bunny rings（types 和 hangs）。没有重算 mesh、faces_ring、cols_resample，没有用 Dense Bunny。每一行先做本行的加针开口，每完成一处就平衡，并记下开口空针；然后整行织完，减针组和新空针都在这一行里织，减针移圈不插在织的过程中；整行结束后按走向逐个减针，每减完一处就平衡，剩下的减针按线圈身份重新找针，不沿用旧针号。",
      scopeLine: partialStop
        ? `${partialStop.sentence} Later rows were not invented.`
        : "Official Bunny only. Experimental readable-map row schedule. Production bed files were not written.",
      partialStop,
      courseInput: "faces_ring_layout.json",
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
  const expIncrease = focusRows(exp, (row) => row.cells.some((cell) => headerInc(cell)));
  const expDecrease = focusRows(exp, (row) => row.cells.some((cell) => headerDec(cell)));
  const expMixed = focusRows(exp, (row) => row.cells.some((cell) => headerInc(cell)) && row.cells.some((cell) => headerDec(cell)));
  const openings = rowIndexes(exp, (row) => row.kind === "increase");
  const divRows = div?.experiment?.sheetRow != null ? [div.experiment.sheetRow] : openings.slice(-1);
  const baseDiv = div?.baseline?.sheetRow != null ? [div.baseline.sheetRow] : [];
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
<title>官方 Bunny 实验织行对照</title>
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
  <strong>官方 Bunny · 实验织行时序</strong>
  <p>只读现有 faces_ring。每一织行先开口并在每处开口后平衡，整行织完再逐个减针、逐次平衡。这不是 knitting code，也不改官方床图。</p>
</header>
<main>
  <div class="banner ${report.extent.generatorFinished ? "ok" : ""}" id="status">${escapeHtml(report.statusLine)}</div>
  <div class="banner" id="divergence-note">${escapeHtml(report.divergenceLine)}</div>
  <div class="banner" id="blocker">${escapeHtml(blockerText)}</div>
  <div id="focus-divergence">${tableHtml(exp, divRows, "实验：停住之前的开口")}${tableHtml(base, baseDiv.length ? [Math.max(0, baseDiv[0] - 1), baseDiv[0]] : [], "基线：同一处开口，以及实验没织到的下一针")}</div>
  <div id="focus-opening">${tableHtml(exp, openings, "实验：移圈加针开口（平衡在这一行之后失败）")}</div>
  <div id="focus-increase">${tableHtml(exp, expIncrease.slice(0, 1), "实验：第一处加针织行（空床出生，和基线相同）")}</div>
  <div id="focus-decrease">${tableHtml(exp, expDecrease.slice(0, 1), "实验：第一处减针织行")}</div>
  <div id="focus-mixed">${tableHtml(exp, expMixed.slice(0, 1), "实验：同一织行里既有加针也有减针")}</div>
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
    ["blocker", "blocker"],
    ["focus-increase", "increase-region"],
    ["focus-opening", "blocked-opening"],
    ["focus-decrease", "decrease-region"],
    ["focus-mixed", "mixed-region"],
    ["focus-divergence", "earliest-difference"],
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
  const statusLine = built.partialStop
    ? `未完成。${built.partialStop.sentence} 已织 ${validation.extent.knitCells} 针、项 ${validation.extent.termsKnitted} / ${layout.term_total}。减针行和加减针同一行都还没走到。`
    : `生成器跑完了 ${validation.extent.courses} 课、${validation.extent.knitRows} 个织行。`;
  let divergenceLine = "和基线的织针序没有差异。";
  if (div?.kind === "needle") {
    divergenceLine = `最早针位差异在织针序 ${div.knitIndex}：项 ${div.experiment.tIdx} ${div.experiment.label}。基线 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}，course ${div.baseline.course}）。实验 ${div.experiment.bed}${div.experiment.phys}（表行 ${div.experiment.sheetRow}，course ${div.experiment.course}，线圈 ${div.experiment.origin || div.experiment.id}）。时序把这一针放到了另一枚针上，项序还在。`;
  } else if (div?.kind === "term-or-label") {
    divergenceLine = `最早项序差异在织针序 ${div.knitIndex}：基线项 ${div.baseline?.tIdx} ${div.baseline?.label}，实验项 ${div.experiment?.tIdx} ${div.experiment?.label}。`;
  } else if (div?.kind === "length") {
    const next = div.baseline
      ? `基线下一针是 course ${div.baseline.course} 项 ${div.baseline.tIdx} ${div.baseline.label}，在 ${div.baseline.bed}${div.baseline.phys}（表行 ${div.baseline.sheetRow}）。`
      : "";
    divergenceLine = `已织的 ${div.experimentCount} 针和基线一致，项号、标签、针位、线圈 id 都没变。实验在下一针之前停住。${next}基线一共 ${div.baselineCount} 针。分歧不在针位，而在 course 2 开口之后立刻平衡：基线把这次平衡留到整行织完。`;
  }
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
    output: {
      directory: "experiments/official-bunny-readable-row-schedule",
      files: ["exp-readable-map.txt", "exp-readable-map.xls", "exp-readable-map.json", "validation-report.json", "compare.html"],
    },
    status: built.partialStop ? "partial" : "complete",
    statusLine,
    divergenceLine,
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
      "基线在减针跨度织完后立刻移圈并平衡，余下的针在平衡后的床上织。实验把本行加针开口提前到织之前，并且每开口一次就平衡；减针留到整行织完，再按线圈身份逐个移圈、逐次平衡。所以同一项可能织在开口/平衡之后的针上，减针组后面的项也不再吃到前一个减针的挪移。",
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
  let shots = { ok: false, reason: "skipped" };
  if (!noShot) shots = await shoot(paths.html, OUT_DIR);
  report.screenshots = shots;
  writeFileSync(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  console.log(statusLine);
  console.log(divergenceLine);
  if (built.partialStop) console.log(built.partialStop.message);
  console.log(shots.ok ? `screenshots ${shots.written.length}` : `screenshots skipped: ${shots.reason}`);
  return report;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}
