import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CYLINDER_FACES_RING_COUNTS,
  inferTermTypeFromVerts,
  parseColoredObj,
  TERM_TYPE_DEFAULT,
} from "../src/stitches.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const obj = readFileSync(join(root, "public", "sample", "cylinder", "iteration_0_cut_KnittingStitches.obj"), "utf8");
const parsed = parseColoredObj(obj);
const counts = CYLINDER_FACES_RING_COUNTS;
const nTyped = counts.reduce((a, b) => a + b, 0);
if (parsed.faces.length < nTyped) {
  throw new Error(`OBJ has ${parsed.faces.length} faces, expected at least ${nTyped}`);
}

let offset = 0;
const rings = counts.map((n, index) => {
  const types = [];
  for (let i = 0; i < n; i++) {
    types.push(inferTermTypeFromVerts(parsed.faces[offset + i]?.verts));
  }
  offset += n;
  return { index, n_terms: n, types };
});

const leftover = parsed.faces.length - nTyped;
const layout = {
  n_faces_ring: rings.length,
  n_obj_faces: parsed.faces.length,
  n_typed_terms: nTyped,
  leftover_faces: leftover,
  note:
    "faces_ring comes from path_generate(first_rows), not readable_map rowNNN. " +
    "Cylinder: 6 first_rows (row_0..row_5) → 5 rings. Types map by prefix in OBJ face order; " +
    `${nTyped} typed terms (${counts.join("+")}); leftover ${leftover} faces → default pink (type ${TERM_TYPE_DEFAULT}).`,
  rings,
};

const json = `${JSON.stringify(layout, null, 2)}\n`;
const dests = [
  join(root, "uploads", "faces_ring_layout.json"),
  join(root, "public", "sample", "cylinder", "faces_ring_layout.json"),
];
for (const dest of dests) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, json);
}

const hist = Array(10).fill(0);
for (const ring of rings) for (const t of ring.types) hist[t] += 1;
console.log(`wrote layout: ${counts.join("+")}=${nTyped} typed, leftover ${leftover}, types ${hist.join(",")}`);
