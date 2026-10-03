/**
 * Second-ring bed chart. Continues on the bed the first ring left behind:
 * the next stitch after B0, going right, is F0. Needle count changes only
 * when this ring increases or decreases. Input is faces_ring ring 1.
 *
 *   node scripts/build-step4-faces-ring1.mjs
 *   node scripts/build-step4-faces-ring1.mjs --check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { coursesFromTypes, renderReport, seatContinuation, workbookBytes } from "./build-step4-faces-ring0.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cylDir = join(root, "public", "sample", "cylinder");
const facesRing = join(cylDir, "faces_ring_layout.json");
const outXls = join(cylDir, "faces_ring1_step4_bed.xls");
const outTxt = join(cylDir, "faces_ring1_step4_bed.txt");

function circleAfterRing0() {
  const seeds = [];
  for (let p = 0; p <= 18; p++) seeds.push({ bed: "F", phys: p });
  for (let p = 18; p >= 0; p--) seeds.push({ bed: "B", phys: p });
  return seeds;
}

export function buildRing1(path = facesRing) {
  const layout = JSON.parse(readFileSync(path, "utf8"));
  const ring = layout.rings[1];
  const types = ring.types.map((t) => Number(t));
  const hangs = ring.hangs.map((n) => Number(n));
  if (types.length !== ring.n_terms || hangs.length !== types.length) {
    throw new Error("faces-ring1-step4: ring 1 types and hangs do not match");
  }
  const courses = coursesFromTypes(types, hangs);
  const seated = seatContinuation(courses, circleAfterRing0());
  return {
    ...seated,
    types: types.length,
    termTypes: types,
    hangs,
    faceOffset: layout.rings[0].n_terms,
    sheetName: "ring1",
    title: "faces_ring1 step4 床图（第二环，接在第一环的床上）",
    inputLine:
      "输入只有 faces_ring_layout.json 的 ring 1（types 和 hangs）。第一环结束在 B0 向右，下一针绕回 F0。加减针才改针数。",
  };
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const built = buildRing1();
  const text = renderReport(built);
  const bytes = workbookBytes(built);
  if (check) {
    const prevXls = readFileSync(outXls);
    const prevTxt = readFileSync(outTxt, "utf8");
    if (!prevXls.equals(bytes) || prevTxt !== text) {
      throw new Error("faces-ring1-step4: committed bed chart does not match the generator");
    }
  } else {
    writeFileSync(outXls, bytes);
    writeFileSync(outTxt, text);
  }
  console.log(text);
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
