import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  indexFiles,
  isManifestShape,
  isOverlayName,
  projectFromDiscovery,
  projectFromManifest,
} from "../src/project.js";
import {
  bindStitchesToMap,
  collectManifestRefs,
  parseColoredObj,
  parseReadableMap,
} from "../src/stitches.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sampleDir = join(root, "public", "sample");
const cylDir = join(sampleDir, "cylinder");

const manifest = JSON.parse(readFileSync(join(sampleDir, "manifest.json"), "utf8"));
if (!isManifestShape(manifest)) throw new Error("sample manifest invalid");
if (manifest.name !== "Single_Cylinder_Test") throw new Error("default sample must be the cylinder");

const refs = collectManifestRefs(manifest);
for (const rel of refs) {
  readFileSync(join(sampleDir, rel), "utf8");
}

const entries = [
  { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(manifest) },
  ...refs.map((rel) => ({
    name: rel.split("/").pop(),
    path: `sample/${rel}`,
    text: readFileSync(join(sampleDir, rel), "utf8"),
  })),
];

const index = indexFiles(entries);
const fromManifest = projectFromManifest(manifest, index, "sample/manifest.json");
if (fromManifest.outputs.length !== 1) throw new Error("expected 1 cylinder output");
if (!fromManifest.outputs[0].stitchFile) throw new Error("expected stitch file");
if (!fromManifest.outputs[0].readableMapFile) throw new Error("expected readable_map");

const fromDiscovery = projectFromDiscovery(index);
if (fromDiscovery.outputs.length !== 1) {
  throw new Error(`discovery should keep cut body only, got ${fromDiscovery.outputs.length}`);
}
if (!fromDiscovery.outputs[0].overlayFile) throw new Error("discovery should attach stitches");
if (!isOverlayName("iteration_0_cut_KnittingStitches.obj")) {
  throw new Error("overlay heuristic failed for KnittingStitches");
}

const stitchText = readFileSync(join(cylDir, "iteration_0_cut_KnittingStitches.obj"), "utf8");
const mapText = readFileSync(join(cylDir, "iteration_0_cut_readable_map.txt"), "utf8");
const parsed = parseColoredObj(stitchText);
if (parsed.faces.length !== 450) throw new Error(`expected 450 stitch faces, got ${parsed.faces.length}`);
if (parsed.verts.length !== 1716) throw new Error(`expected 1716 stitch verts, got ${parsed.verts.length}`);

const map = parseReadableMap(mapText);
if (map.rows.length !== 69) throw new Error(`expected 69 readable rows, got ${map.rows.length}`);
if (map.rowMax !== 68) throw new Error(`expected rowMax 68, got ${map.rowMax}`);
if (map.cells.length < 450) throw new Error(`expected at least 450 map cells, got ${map.cells.length}`);
if (map.rows[0].tokens.length !== 35) throw new Error("row000 should list 35 needle tokens");

const bound = bindStitchesToMap(parsed.faces, map);
if (bound.stitches.length !== 450) throw new Error("bind should keep every face");
const row0 = bound.stitches.filter((s) => s.row === 0);
if (row0.length !== 35) throw new Error(`row000 should bind 35 faces, got ${row0.length}`);
if (row0.some((s) => s.col < 0 || s.col > 34)) throw new Error("row000 columns should be 0..34");
if (bound.rowMin !== 0) throw new Error("bound rowMin should be 0");
if (bound.rowMax < 60) throw new Error("bound rowMax should reach the upper courses");
if (bound.columns.length < 30) throw new Error("expected dozens of needle columns");
if (bound.leftoverCells < 1) throw new Error("map has extra tail tokens with no faces");

const grown = bound.stitches.filter((s) => s.row != null && s.row <= 0);
if (grown.length !== 35) throw new Error("growth at row 0 should show the first course only");

console.log("project checks ok");
