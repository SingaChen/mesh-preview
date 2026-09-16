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
  facesRingSliderN,
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
  facesRingChunksFromStitches,
  parseColoredObj,
  parseColsResample,
  parseColsResampleField,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  stitchesInRingRange,
  uniqueColIdsFromXls,
  xlsScaleMatrixRowCount,
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
assert(
  refs.some((r) => /first_rows\.xls$/.test(r)),
  "manifest must list first_rows xls",
);
assert(
  !refs.some((r) => /cols_resample_meta\.json$/.test(r)),
  "manifest must not list a cols_resample meta sidecar",
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
if (fromManifest.outputs[0].colsResampleJsonFile) throw new Error("sample should not ship a cols_resample sidecar");
if (!fromManifest.outputs[0].firstRowsFile) throw new Error("expected first_rows xls");

const fromDiscovery = projectFromDiscovery(index);
if (fromDiscovery.outputs.length !== 1) {
  throw new Error(`discovery should keep cut body only, got ${fromDiscovery.outputs.length}`);
}
if (!fromDiscovery.outputs[0].overlayFile) throw new Error("discovery should attach stitches");
if (!fromDiscovery.outputs[0].colsResampleFile) throw new Error("discovery should attach cols_resample field");
if (!fromDiscovery.outputs[0].colsResampleXlsFile) throw new Error("discovery should attach cols_resample xls");
if (fromDiscovery.outputs[0].colsResampleJsonFile) throw new Error("discovery should not require a cols_resample sidecar");
if (!fromDiscovery.outputs[0].firstRowsFile) throw new Error("discovery should attach first_rows xls");
if (!isOverlayName("iteration_0_cut_KnittingStitches.obj")) {
  throw new Error("overlay heuristic failed for KnittingStitches");
}

const stitchText = readFileSync(join(cylDir, "iteration_0_cut_KnittingStitches.obj"), "utf8");
const mapText = readFileSync(join(cylDir, "iteration_0_cut_readable_map.txt"), "utf8");
const fieldText = readFileSync(join(cylDir, "iteration_0_cut_cols_resample_field.obj"), "utf8");
const xlsBuf = readFileSync(join(cylDir, "iteration_0_cut_cols_resample.xls"));
const parsed = parseColoredObj(stitchText);
if (parsed.faces.length !== 475) throw new Error(`expected 475 stitch faces, got ${parsed.faces.length}`);
if (parsed.verts.length !== 1812) throw new Error(`expected 1812 stitch verts, got ${parsed.verts.length}`);

const map = parseReadableMap(mapText);
if (map.rows.length !== 65) throw new Error(`expected 65 readable rows, got ${map.rows.length}`);
if (map.rowMax !== 64) throw new Error(`expected rowMax 64, got ${map.rowMax}`);
if (map.cells.length < 475) throw new Error(`expected at least 475 map cells, got ${map.cells.length}`);
if (map.rows[0].tokens.length !== 21) throw new Error("row000 should list 21 needle tokens");

const bound = bindStitchesToMap(parsed.faces, map);
if (bound.stitches.length !== 475) throw new Error("bind should keep every face");
const row0 = bound.stitches.filter((s) => s.row === 0);
if (row0.length !== 21) throw new Error(`row000 should bind 21 faces, got ${row0.length}`);
if (row0.some((s) => s.col < 0 || s.col > 20)) throw new Error("row000 columns should be 0..20");
if (bound.rowMin !== 0) throw new Error("bound rowMin should be 0");
if (bound.rowMax < 50) throw new Error("bound rowMax should reach the upper courses");
if (bound.columns.length < 20) throw new Error("expected dozens of needle columns");
if (bound.leftoverCells < 1) throw new Error("map has extra tail tokens with no faces");

const chunks = faceChunksFromFaces(parsed.faces);
assert(chunks.length === 475, `faces_ring terms should be 475 faces, got ${chunks.length}`);
assert(chunks[0].index === 0 && chunks[474].index === 474, "terms stay in generation order");

const firstRowsBuf = readFileSync(join(cylDir, "iteration_0_cut_first_rows.xls"));
const firstRows = parseFirstRows({ xls: firstRowsBuf });
assert(firstRows.nSeed === 6, `first_rows seed columns are row_0..row_5, got ${firstRows.nSeed}`);
assert(firstRows.nRings === 5, `path_generate skips seed 0 so N_rings is 5, got ${firstRows.nRings}`);
assert(firstRows.columns.length === 42, `first_rows has one sheet row per needle col, got ${firstRows.columns.length}`);
assert(firstRows.nRings !== map.rows.length, "do not use readable_map 65 rowNNN ids as slider N");
assert(firstRows.nRings !== firstRows.nSeed, "do not use N_seed=6 as slider N; skip the seed column");

const sidecar = parseFacesRingLayout({
  term_counts: [10, 20, 30, 40, 375],
  n_faces_ring: 5,
});
assert(sidecar.nFacesRing === 5 && sidecar.termCounts[0] === 10, "sidecar term_counts slice generation order");
const fromSidecar = facesRingChunksFromStitches(bound.stitches, {
  nRings: sidecar.nFacesRing,
  termCounts: sidecar.termCounts,
});
assert(fromSidecar.map((c) => c.faces.length).join(",") === "10,20,30,40,375", "sidecar slices faces sequentially");
assert(fromSidecar[0].faces[0].index === 0 && fromSidecar[1].faces[0].index === 10, "rings stay in OBJ face order");

const rowChunks = facesRingChunksFromStitches(bound.stitches, { nRings: firstRows.nRings });
assert(rowChunks.length === 5, `row slider N is first_row rings, got ${rowChunks.length}`);
assert(rowChunks.length !== 65, "slider is not readable_map machine rows");
assert(rowChunks.length !== chunks.length, "slider is not per-term faces_ring");
assert(
  rowChunks.reduce((n, c) => n + c.faces.length, 0) === 475,
  "every stitch face belongs to exactly one first_row ring",
);
assert(
  rowChunks.every((c) => c.faces.length === 95),
  "without sidecar, faces split evenly across 5 rings until desktop term_counts arrive",
);

const windowed = sliceHalfOpen(rowChunks, 0, 1);
assert(windowed.length === 1 && windowed[0].faces.length === 95, "half-open [0,1) keeps one first_row ring");
const twoRows = sliceHalfOpen(rowChunks, 2, 4);
assert(twoRows.length === 2 && twoRows[0].ring === 2 && twoRows[1].ring === 3, "adjacent handles show two rings");
const ringFaces = stitchesInRingRange(bound.stitches, 0, 1);
assert(ringFaces.length === 95 && ringFaces.every((s) => s.ring === 0), "[0,1) shows only ring 0 terms");
assert(stitchesInRingRange(bound.stitches, 0, 5).length === 475, "default [0,N_rings) keeps every face");
assert(facesRingSliderN({ rowChunks, faceChunks: chunks }) === 5, "bound slider N prefers first_row rings");

const workbook = parseXlsWorkbook(xlsBuf);
const xlsColIds = uniqueColIdsFromXls(workbook);
const xlsRows = xlsScaleMatrixRowCount(workbook);
assert(xlsRows === 42, `scale_matrix should have 42 column rows, got ${xlsRows}`);
assert(xlsColIds.length === 42, `points_detail col ids should be 0..41, got ${xlsColIds.length}`);
assert(xlsColIds[0] === 0 && xlsColIds[41] === 41, "col ids stay contiguous 0..41");

const fieldCols = parseColsResampleField(fieldText);
assert(fieldCols.length === 42, `field.obj sequential chains should be 42, got ${fieldCols.length}`);

const columns = parseColsResample({ xls: xlsBuf, fieldText });
assert(columns.length === 42, `cylinder cols_resample should be 42, got ${columns.length}`);
assert(columns[0].col === 0 && columns[0].type === "FULL", "idx 0 is the first xls column");
assert(columns[41].col === 41, "idx 41 is the last xls column");
assert(columns[0].points.length === 12, "col 0 keeps its 12 export samples");
assert(
  columns.every((c, i) => c.points.length === fieldCols[i].points.length),
  "xls point counts must match field.obj chains 1:1",
);
assert(
  columns.reduce((n, c) => n + c.points.length, 0) === 459,
  "points_detail + field.obj both hold 459 samples",
);
const visCols = sliceHalfOpen(columns, 0, 1);
assert(visCols.length === 1 && visCols[0].col === 0, "cols_resample [0,1) keeps one column");
assert(sliceHalfOpen(columns, 0, 42).length === 42, "default [0,N) keeps every export column");

const fromFieldOnly = parseColsResample({ fieldText });
assert(fromFieldOnly.length === 42, `field-only sequential parse should be 42, got ${fromFieldOnly.length}`);

const fromSheet0 = parseColsResample({
  workbook: { sheets: workbook.sheets.filter((s) => s.name !== "points_detail") },
  fieldText,
});
assert(fromSheet0.length === 42, `scale_matrix fallback should be 42, got ${fromSheet0.length}`);
assert(fromSheet0[0].type === "FULL" && fromSheet0[0].points.length === 12, "scale_matrix keeps FULL col 0");

const toyField = [
  "v 0 0 0 1 0 0",
  "v 1 0 0 1 0 0",
  "l 1 2",
  "v 2 0 0 0 1 0",
  "v 3 0 0 0 0 1",
  "v 4 0 0 0 0 1",
  "l 4 5",
].join("\n");
const toyCols = parseColsResampleField(toyField);
assert(toyCols.length === 3, `single-vert columns stay their own chain, got ${toyCols.length}`);
assert(
  toyCols.map((c) => c.points.length).join(",") === "2,1,2",
  "desktop sequential chains do not invent merges",
);

assert.deepEqual = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};

assert.deepEqual(normalizeHalfOpenSlider([0, 42], 42), [0, 42], "full cols range");
assert.deepEqual(normalizeHalfOpenSlider([5, 5], 42), [5, 6], "end >= start+1");
assert.deepEqual(normalizeHalfOpenSlider([8, 3], 42), [3, 8], "swap if reversed");
assert.deepEqual(normalizeHalfOpenSlider([42, 42], 42), [41, 42], "clamp last element");
assert.deepEqual(normalizeHalfOpenSlider([-2, 99], 42), [0, 42], "clamp to 0..N");

assert(
  formatHalfOpenRangeLabel("cols_resample", 0, 42, 42) === "cols_resample: idx 0-41 / 42",
  "full-range label uses last inclusive index",
);
assert(
  formatHalfOpenRangeLabel("row", 2, 3, 5) === "row: idx 2 / 5",
  "single-ring label",
);
assert(formatHalfOpenRangeLabel("row", 0, 0, 5) === "row: - / 5", "empty ring label");
assert(
  formatHalfOpenRangeLabel("row", 0, 5, 5) === "row: idx 0-4 / 5",
  "full first_row ring range uses last inclusive index",
);

const models = [];
registerDisplayModel(models, { kind: "mesh", name: "cut_iteration_0", item: "cut" });
registerDisplayModel(models, { kind: "cols_resample", name: "cols_resample", item: "cols" });
registerDisplayModel(models, {
  kind: "faces_ring",
  name: "KnittingStitches",
  item: "stitches",
  faceChunks: chunks,
  rowChunks,
});
assert(
  models.map((m) => m.name).join(",") === "cols_resample,cut_iteration_0,KnittingStitches",
  `desktop order is cols_resample then cut then Sequence, got ${models.map((m) => m.name)}`,
);

const all = applyDisplayModelsRange(models, 0, 3, null);
assert(all.visibility.every(Boolean), "default [0,3) shows every model");
assert(all.bind?.name === "KnittingStitches", "rightmost faces_ring binds the row slider");
assert(all.resetRange === true, "first bind resets row range");
assert(facesRingSliderN(all.bind) === 5, "right-end binding exposes 5 first_row rings");
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
assert(onlyStitch.bind?.name === "KnittingStitches", "solo stitches still binds the row slider");

const keep = applyDisplayModelsRange(models, 1, 3, "stitches");
assert(keep.bind?.name === "KnittingStitches" && keep.resetRange === false, "dragging left handle does not rebind");

console.log("project checks ok");
