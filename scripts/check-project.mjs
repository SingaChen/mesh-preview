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
  applyDisplayModelsRange,
  formatDisplayModelsLabel,
  formatHalfOpenRangeLabel,
  normalizeHalfOpenSlider,
  registerDisplayModel,
  sliceHalfOpen,
} from "../src/range.js";
import {
  bindStitchesToMap,
  collectManifestRefs,
  faceChunksFromFaces,
  parseColoredObj,
  parseColsResample,
  parseColsResampleField,
  parseReadableMap,
  uniqueColIdsFromXls,
} from "../src/stitches.js";
import { parseXlsWorkbook } from "../src/xls.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sampleDir = join(root, "public", "sample");
const cylDir = join(sampleDir, "cylinder");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const manifest = JSON.parse(readFileSync(join(sampleDir, "manifest.json"), "utf8"));
if (!isManifestShape(manifest)) throw new Error("sample manifest invalid");
if (manifest.name !== "Single_Cylinder_Test") throw new Error("default sample must be the cylinder");

const refs = collectManifestRefs(manifest);
for (const rel of refs) {
  readFileSync(join(sampleDir, rel));
}
assert(
  refs.some((r) => /cols_resample_field/.test(r)),
  "manifest must list cols_resample field obj",
);
assert(
  refs.some((r) => /cols_resample\.xls$/.test(r)),
  "manifest must list cols_resample xls",
);

const entries = [
  { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(manifest) },
  ...refs.map((rel) => {
    const full = join(sampleDir, rel);
    const name = rel.split("/").pop();
    if (/\.xlsx?$/i.test(rel)) {
      return { name, path: `sample/${rel}`, buffer: readFileSync(full) };
    }
    return { name, path: `sample/${rel}`, text: readFileSync(full, "utf8") };
  }),
];

const index = indexFiles(entries);
const fromManifest = projectFromManifest(manifest, index, "sample/manifest.json");
if (fromManifest.outputs.length !== 1) throw new Error("expected 1 cylinder output");
if (!fromManifest.outputs[0].stitchFile) throw new Error("expected stitch file");
if (!fromManifest.outputs[0].readableMapFile) throw new Error("expected readable_map");
if (!fromManifest.outputs[0].colsResampleFile) throw new Error("expected cols_resample field");
if (!fromManifest.outputs[0].colsResampleXlsFile) throw new Error("expected cols_resample xls");

const fromDiscovery = projectFromDiscovery(index);
if (fromDiscovery.outputs.length !== 1) {
  throw new Error(`discovery should keep cut body only, got ${fromDiscovery.outputs.length}`);
}
if (!fromDiscovery.outputs[0].overlayFile) throw new Error("discovery should attach stitches");
if (!fromDiscovery.outputs[0].colsResampleFile) throw new Error("discovery should attach cols_resample field");
if (!fromDiscovery.outputs[0].colsResampleXlsFile) throw new Error("discovery should attach cols_resample xls");
if (!isOverlayName("iteration_0_cut_KnittingStitches.obj")) {
  throw new Error("overlay heuristic failed for KnittingStitches");
}

const stitchText = readFileSync(join(cylDir, "iteration_0_cut_KnittingStitches.obj"), "utf8");
const mapText = readFileSync(join(cylDir, "iteration_0_cut_readable_map.txt"), "utf8");
const fieldText = readFileSync(join(cylDir, "iteration_0_cut_cols_resample_field.obj"), "utf8");
const xlsBuf = readFileSync(join(cylDir, "iteration_0_cut_cols_resample.xls"));
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

const chunks = faceChunksFromFaces(parsed.faces);
assert(chunks.length === 450, `faces_ring terms should be 450 faces, got ${chunks.length}`);
assert(chunks[0].index === 0 && chunks[449].index === 449, "terms stay in generation order");

const windowed = sliceHalfOpen(chunks, 10, 12);
assert(windowed.length === 2, "half-open [10,12) keeps two terms");
assert(windowed[0].index === 10 && windowed[1].index === 11, "adjacent handles show two consecutive terms");
const one = sliceHalfOpen(chunks, 7, 8);
assert(one.length === 1 && one[0].index === 7, "adjacent handles show one term");

const fieldOnly = parseColsResampleField(fieldText);
assert(fieldOnly.length === 67, `field OBJ v-runs are 67 stubs, got ${fieldOnly.length}`);
assert(fieldOnly.length !== 84, "do not treat field component count as desktop N");

const workbook = parseXlsWorkbook(xlsBuf);
const xlsColIds = uniqueColIdsFromXls(workbook);
assert(xlsColIds.length === 84, `xls unique col ids should be 84, got ${xlsColIds.length}`);
assert(xlsColIds[0] === 0 && xlsColIds[83] === 83, "xls col ids are 0..83");

const columns = parseColsResample({ xls: xlsBuf, fieldText });
assert(columns.length === xlsColIds.length, `column count must match xls unique col ids, got ${columns.length}`);
assert(columns.length === 84, `cylinder cols_resample should be 84, got ${columns.length}`);
assert(columns[0].col === 0 && columns[0].points.length === 12, "col 0 is FULL with 12 samples");
assert(columns[3].col === 3 && columns[3].points.length === 1, "single-point SHORT_* columns stay in the list");
assert(columns[columns.length - 1].col === 83 && columns[columns.length - 1].points.length === 2, "last column is col 83");
assert(
  columns.reduce((n, c) => n + c.points.length, 0) === 435,
  "points_detail has 435 tagged points",
);
const visCols = sliceHalfOpen(columns, 0, 1);
assert(visCols.length === 1 && visCols[0].col === 0, "cols_resample [0,1) keeps one column");
assert(sliceHalfOpen(columns, 0, 84).length === 84, "default [0,N) keeps every xls column");

const fromSheet0 = parseColsResample({
  workbook: { sheets: workbook.sheets.filter((s) => s.name !== "points_detail") },
  fieldText,
});
assert(fromSheet0.length === 84, `sheet0 fallback should still be 84, got ${fromSheet0.length}`);
assert(fromSheet0[0].points.length === 12, "sheet0 + field verts reconstruct col 0");

assert.deepEqual = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};

assert.deepEqual(normalizeHalfOpenSlider([0, 84], 84), [0, 84], "full cols range");
assert.deepEqual(normalizeHalfOpenSlider([5, 5], 84), [5, 6], "end >= start+1");
assert.deepEqual(normalizeHalfOpenSlider([8, 3], 84), [3, 8], "swap if reversed");
assert.deepEqual(normalizeHalfOpenSlider([84, 84], 84), [83, 84], "clamp last element");
assert.deepEqual(normalizeHalfOpenSlider([-2, 99], 84), [0, 84], "clamp to 0..N");

assert(
  formatHalfOpenRangeLabel("cols_resample", 0, 84, 84) === "cols_resample: idx 0-83 / 84",
  "full-range label uses last inclusive index",
);
assert(
  formatHalfOpenRangeLabel("faces_ring", 12, 13, 450) === "faces_ring: idx 12 / 450",
  "single-element label",
);
assert(formatHalfOpenRangeLabel("faces_ring", 0, 0, 450) === "faces_ring: - / 450", "empty label");

const models = [];
registerDisplayModel(models, { kind: "mesh", name: "cut_iteration_0", item: "cut" });
registerDisplayModel(models, { kind: "cols_resample", name: "cols_resample", item: "cols" });
registerDisplayModel(models, {
  kind: "faces_ring",
  name: "KnittingStitches",
  item: "stitches",
  faceChunks: chunks,
});
assert(
  models.map((m) => m.name).join(",") === "cols_resample,cut_iteration_0,KnittingStitches",
  `desktop order is cols_resample then cut then Sequence, got ${models.map((m) => m.name)}`,
);

const all = applyDisplayModelsRange(models, 0, 3, null);
assert(all.visibility.every(Boolean), "default [0,3) shows every model");
assert(all.bind?.name === "KnittingStitches", "rightmost faces_ring binds faces_ring slider");
assert(all.resetRange === true, "first bind resets term range");
assert(
  formatDisplayModelsLabel(0, 3, models) ===
    "display_models: idx 0-2 / 3 | right=KnittingStitches",
  "display_models label includes right=",
);

const mid = applyDisplayModelsRange(models, 0, 2, all.bind.item);
assert(mid.visibility[2] === false, "end=2 hides KnittingStitches");
assert(mid.clear === true, "rightmost cut body clears faces_ring binding");
assert(
  formatDisplayModelsLabel(0, 2, models) === "display_models: idx 0-1 / 3 | right=cut_iteration_0",
  "right=cut when stitches hidden",
);

const onlyStitch = applyDisplayModelsRange(models, 2, 3, null);
assert(onlyStitch.visibility[0] === false && onlyStitch.visibility[1] === false, "solo last model");
assert(onlyStitch.bind?.name === "KnittingStitches", "solo stitches still binds faces_ring");

const keep = applyDisplayModelsRange(models, 1, 3, "stitches");
assert(keep.bind?.name === "KnittingStitches" && keep.resetRange === false, "dragging left handle does not rebind");

console.log("project checks ok");
