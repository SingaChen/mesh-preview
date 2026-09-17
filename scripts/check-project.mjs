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
  activeRingIndex,
  applyDisplayModelsRange,
  facesRingSliderN,
  formatDisplayModelsLabel,
  formatHalfOpenRangeLabel,
  normalizeHalfOpenSlider,
  registerDisplayModel,
  sliceHalfOpen,
  stitchesVisibleForSliders,
} from "../src/range.js";
import {
  bindStitchesToMap,
  collectManifestRefs,
  colorForTermType,
  faceChunksFromFaces,
  facesRingChunksFromStitches,
  parseColoredObj,
  parseColsResample,
  parseColsResampleField,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  stitchesInRingRange,
  termCountsForRings,
  uniqueColIdsFromXls,
  xlsScaleMatrixRowCount,
} from "../src/stitches.js";
import { parseXlsWorkbook } from "../src/xls.js";
import { aspectFromSize, displayedSize, drawingMatchesDisplay, needsViewportSync } from "../src/viewport.js";
import { applyBaseChoice, defaultBaseLayers, hiddenBaseLayers, isBaseHidden, normalizeBaseLayers } from "../src/display.js";

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
  refs.some((r) => /faces_ring_layout\.json$/.test(r)),
  "manifest must list faces_ring_layout.json",
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
if (!fromManifest.outputs[0].facesRingLayoutFile) throw new Error("expected faces_ring_layout.json");

const fromDiscovery = projectFromDiscovery(index);
if (fromDiscovery.outputs.length !== 1) {
  throw new Error(`discovery should keep cut body only, got ${fromDiscovery.outputs.length}`);
}
if (!fromDiscovery.outputs[0].overlayFile) throw new Error("discovery should attach stitches");
if (!fromDiscovery.outputs[0].colsResampleFile) throw new Error("discovery should attach cols_resample field");
if (!fromDiscovery.outputs[0].colsResampleXlsFile) throw new Error("discovery should attach cols_resample xls");
if (fromDiscovery.outputs[0].colsResampleJsonFile) throw new Error("discovery should not require a cols_resample sidecar");
if (!fromDiscovery.outputs[0].firstRowsFile) throw new Error("discovery should attach first_rows xls");
if (!fromDiscovery.outputs[0].facesRingLayoutFile) throw new Error("discovery should attach faces_ring_layout.json");
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

const evenChunks = facesRingChunksFromStitches(bound.stitches, { nRings: firstRows.nRings });
assert(evenChunks.length === 5, `row slider N is first_row rings, got ${evenChunks.length}`);
assert(evenChunks.length !== 65, "slider is not readable_map machine rows");
assert(evenChunks.length !== chunks.length, "slider is not per-term faces_ring");
assert(
  evenChunks.reduce((n, c) => n + c.faces.length, 0) === 475,
  "every stitch face belongs to exactly one first_row ring without sidecar",
);
assert(
  evenChunks.every((c) => c.faces.length === 95),
  "without sidecar, faces split evenly across 5 rings",
);

const windowed = sliceHalfOpen(evenChunks, 0, 1);
assert(windowed.length === 1 && windowed[0].faces.length === 95, "half-open [0,1) keeps one even-split ring");
const twoRows = sliceHalfOpen(evenChunks, 2, 4);
assert(twoRows.length === 2 && twoRows[0].ring === 2 && twoRows[1].ring === 3, "adjacent handles show two rings");
const ringFaces = stitchesInRingRange(bound.stitches, 0, 1);
assert(ringFaces.length === 95 && ringFaces.every((s) => s.ring === 0), "[0,1) shows only ring 0 terms");
assert(stitchesInRingRange(bound.stitches, 0, 5).length === 475, "even-split [0,N) keeps every face");
assert(facesRingSliderN({ rowChunks: evenChunks, faceChunks: chunks }) === 5, "bound slider N prefers first_row rings");

const layoutText = readFileSync(join(cylDir, "faces_ring_layout.json"), "utf8");
const layout = parseFacesRingLayout(layoutText);
assert(layout.nFacesRing === 5, `sidecar n_faces_ring is 5, got ${layout.nFacesRing}`);
assert(layout.termCounts.join(",") === "46,136,110,106,77", `sidecar n_terms, got ${layout.termCounts}`);
assert(layout.termTotal === 475, `term_total is 475, got ${layout.termTotal}`);
assert(layout.edgeColor.r === 0 && layout.edgeColor.g === 0 && layout.edgeColor.b === 0, "edge_color is black");
assert(layout.ringTypes?.length === 5 && layout.ringTypes[0].length === 46, "each ring carries Term.Type[]");
assert(layout.ringTypes[4].length === 77, "last ring types cover all 77 faces");
assert(
  termCountsForRings(475, 5, layout.termCounts).join(",") === "46,136,110,106,77",
  "prefix counts already sum to 475",
);

const rowChunks = facesRingChunksFromStitches(bound.stitches, {
  nRings: layout.nFacesRing,
  termCounts: layout.termCounts,
  ringTypes: layout.ringTypes,
  colors: layout.colors,
});
assert(rowChunks.length === 5, `real layout still has 5 rings, got ${rowChunks.length}`);
assert(rowChunks.map((c) => c.faces.length).join(",") === "46,136,110,106,77", "rings are 46+136+110+106+77");
assert(
  rowChunks.reduce((n, c) => n + c.faces.length, 0) === 475,
  "every KnittingStitches face belongs to a ring",
);
assert(
  !rowChunks.every((c) => c.faces.length === 95),
  "real layout must not even-split 475/5",
);
assert(rowChunks[0].faces[0].index === 0, "ring 0 starts at OBJ face 0");
assert(rowChunks[1].faces[0].index === 46, "ring 1 starts after 46 terms");
assert(rowChunks[4].faces[0].index === 46 + 136 + 110 + 106, "ring 4 starts at face 398");
assert(rowChunks[4].faces.length === 77 && rowChunks[4].faces[76].index === 474, "last ring width is 77");
assert(
  rowChunks.every((c) => c.faces.every((s, i) => s.termType === layout.ringTypes[c.ring][i])),
  "every face Type is exactly rings[].types, no inference",
);

const typeHist = {};
for (const s of bound.stitches) {
  if (s.termType == null) throw new Error(`missing Term.Type on face ${s.index}`);
  typeHist[s.termType] = (typeHist[s.termType] || 0) + 1;
}
assert(bound.stitches.length === 475, "475 faces");
assert(Object.values(typeHist).reduce((a, b) => a + b, 0) === 475, "sum of types is 475");
assert(typeHist[0] === 331, `Type0=331, got ${typeHist[0]}`);
assert(typeHist[1] === 60, `Type1=60, got ${typeHist[1]}`);
assert(typeHist[2] === 55 && typeHist[3] === 22 && typeHist[4] === 2 && typeHist[5] === 3 && typeHist[6] === 2, "remaining hist matches dump");
assert(bound.stitches.filter((s) => s.termType === 0).every((s) => s.termColor.r === 0.55), "Type 0 is gray only");
assert(bound.stitches.filter((s) => s.termType === 1).every((s) => s.termColor.r === 1 && s.termColor.g === 1), "Type 1 is white only");
assert(
  bound.stitches.every((s) => !(s.termColor.r === 1 && s.termColor.g === 1 && s.termColor.b === 1) || s.termType === 1),
  "white faces are Type 1 only",
);
assert(bound.stitches.every((s) => s.ring != null), "no face is left outside a ring");

let missingFailed = false;
try {
  facesRingChunksFromStitches(bound.stitches.slice(0, 10), {
    nRings: 1,
    termCounts: [10],
    ringTypes: [[]],
    colors: layout.colors,
  });
} catch (err) {
  missingFailed = /missing Term.Type/.test(err.message);
}
assert(missingFailed, "incomplete types[] must fail, never invent a color");

const gray = colorForTermType(0, layout.colors);
const white = colorForTermType(1, layout.colors);
const black = colorForTermType(2, layout.colors);
const red = colorForTermType(3, layout.colors);
const green = colorForTermType(4, layout.colors);
const yellow = colorForTermType(5, layout.colors);
const blue = colorForTermType(6, layout.colors);
const pink = colorForTermType(7, layout.colors);
assert(gray.r === 0.55 && gray.g === 0.55 && gray.b === 0.55, "type 0 PLAIN gray");
assert(white.r === 1 && white.g === 1 && white.b === 1, "type 1 LEFT_APEX white");
assert(black.r === 0 && black.g === 0 && black.b === 0, "type 2 RIGHT_APEX black");
assert(red.r === 1 && red.g === 0 && red.b === 0, "type 3 DOWN_APEX red");
assert(green.r === 0 && green.g === 1 && green.b === 0, "type 4 UP_APEX green");
assert(yellow.r === 1 && yellow.g === 1 && yellow.b === 0, "type 5 RIGHT_DOWN yellow");
assert(blue.r === 0 && blue.g === 0 && blue.b === 1, "type 6 RIGHT_UP blue");
assert(pink.r === 1 && pink.g === 0.35 && pink.b === 0.8, "type 7 LEFT_DOWN pink");
assert(colorForTermType(8).g === 0.35 && colorForTermType(9).g === 0.35, "types 8/9 pink");
assert(colorForTermType(null) == null && colorForTermType(99) == null, "missing/unknown Type is not invented");

assert(rowChunks[0].faces[20].termType === 2 && rowChunks[0].faces[20].termColor.r === 0, "ring0 term 20 is black apex");
assert(rowChunks[0].faces[21].termType === 6 && rowChunks[0].faces[21].termColor.b === 1, "ring0 term 21 is blue");
assert(rowChunks[0].faces[22].termType === 1 && rowChunks[0].faces[22].termColor.r === 1, "ring0 term 22 is white apex");
assert(
  rowChunks.every((c) => c.faces.every((s) => s.termColor && Number.isFinite(s.termColor.r))),
  "every typed term has a Term.Type color",
);

assert(activeRingIndex(0, 5) === 4, "full [0,5) active ring is the last / max ring");
assert(activeRingIndex(1, 5) === 4, "second slider 1-5 active ring is 4");
assert(activeRingIndex(0, 1) === 0, "single first ring is active");
assert(activeRingIndex(2, 2) == null, "empty range disables the term slider");

const fullTyped = stitchesVisibleForSliders(bound.stitches, 0, 5, 0, 77);
assert(fullTyped.length === 475, `full rings + full last-ring terms show 475, got ${fullTyped.length}`);
assert(fullTyped.filter((s) => s.ring === 4).length === 77, "default last ring shows all 77 terms");
assert(
  fullTyped.filter((s) => s.ring === 4 && s.index >= 471).every((s) => s.termType === layout.ringTypes[4][s.termInRing]),
  "last-ring tail Types come from sidecar types[], not verts",
);

const lastOne = stitchesVisibleForSliders(bound.stitches, 0, 5, 0, 1);
assert(lastOne.length === 46 + 136 + 110 + 106 + 1, "earlier rings stay full; only max ring is term-filtered");
assert(lastOne.filter((s) => s.ring === 4).length === 1, "third slider [0,1) keeps one term in the max ring");
assert(lastOne.filter((s) => s.ring < 4).every((s) => s.termInRing != null), "rings [0,4) keep every term");

const clipped = stitchesVisibleForSliders(bound.stitches, 1, 5, 10, 20);
assert(clipped.filter((s) => s.ring === 0).length === 0, "rings < r0 are hidden");
assert(clipped.filter((s) => s.ring === 1).length === 136, "ring 1 in [r0, r1-1) is fully visible");
assert(clipped.filter((s) => s.ring === 2).length === 110, "ring 2 fully visible");
assert(clipped.filter((s) => s.ring === 3).length === 106, "ring 3 fully visible");
assert(clipped.filter((s) => s.ring === 4).length === 10, "active ring 4 uses term [10,20)");
assert(clipped.every((s) => s.ring < 5), "rings >= r1 stay hidden");

assert(stitchesVisibleForSliders(bound.stitches, 0, 1, 5, 8).length === 3, "single-ring term window");
assert(stitchesVisibleForSliders(bound.stitches, 2, 2, 0, 10).length === 0, "empty second range hides everything");
assert(stitchesInRingRange(bound.stitches, 0, 5).length === 475, "ring range helper covers every face");

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
assert(
  formatHalfOpenRangeLabel("term", 0, 46, 46) === "term: idx 0-45 / 46",
  "first-ring term label",
);
assert(
  formatHalfOpenRangeLabel("term", 0, 77, 77) === "term: idx 0-76 / 77",
  "last-ring full term label after folding remainder",
);
assert(formatHalfOpenRangeLabel("term", 0, 0, 77) === "term: - / 77", "empty term label");

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

const html = readFileSync(join(root, "index.html"), "utf8");
assert(html.includes('id="base-menu-btn"') && html.includes('id="base-menu-list"'), "Base is a same-size menu button, not a native select");
assert(!html.includes("<select") && !html.includes("base-mode"), "exclusive Base <select> is gone");
assert(html.includes('id="base-off"') && html.includes('id="base-wire"') && html.includes('id="base-faces"') && html.includes('id="base-points"'), "Base has Off / Wire / Faces / Points checkboxes");
assert(html.includes("base-menu-sep") && html.includes("隐藏") && html.includes("Off"), "Off stays in the Base menu, separated from draw layers");
assert(/id="base-faces"[^>]*checked/.test(html), "Base defaults to Faces checked");
assert(html.includes("底模") && html.includes("Base"), "Base control is labelled 底模 / Base");
assert(html.includes('id="toggle-warp"') && html.includes("列") && html.includes("Warp"), "Warp toggle shows cols_resample");
assert(/id="toggle-warp"[^>]*aria-pressed="true"/.test(html), "Warp defaults on");
assert(html.includes('id="toggle-overlay"') && html.includes("针迹") && html.includes("Stitch"), "Stitch toggle stays");
assert(!html.includes("toggle-wire") && !html.includes("toggle-body"), "standalone Wire / Base toggles are gone");
assert(!html.includes("toggle-shade") && !html.includes("平面"), "Flat toggle is gone");
const mainSrc = readFileSync(join(root, "src", "main.js"), "utf8");
assert(mainSrc.includes("setBaseLayers") && mainSrc.includes("applyBaseChoice"), "main wires Base multi-select");
assert(mainSrc.includes("setShowWarp") && mainSrc.includes("#toggle-warp"), "main wires the Warp toggle");
assert(!mainSrc.includes("setWireframe") && !mainSrc.includes("toggle-wire"), "main no longer has a standalone Wire toggle");
assert(!mainSrc.includes("setFlat") && !mainSrc.includes("toggle-shade"), "main no longer wires Flat");
const viewerSrc = readFileSync(join(root, "src", "viewer.js"), "utf8");
assert(viewerSrc.includes("setBaseLayers") && viewerSrc.includes("setShowWarp"), "viewer has Base layers and Warp visibility");
assert(viewerSrc.includes("defaultBaseLayers"), "cut body starts from default Faces");
assert(viewerSrc.includes("opacity: 0.42"), "Faces mode stays the semi-transparent underlay");
assert(viewerSrc.includes("_wireMaterial") && viewerSrc.includes("_pointsMaterial"), "Wire and Points are composable overlays");
assert(/size:\s*18/.test(viewerSrc) && /sizeAttenuation:\s*false/.test(viewerSrc), "Base points are a large screen-space size");
assert(!viewerSrc.includes("setWireframe"), "wireframe is only a Base layer");
assert(!viewerSrc.includes("setFlat") && !viewerSrc.includes("flatShading"), "viewer dropped unused flat shading");
assert.deepEqual(defaultBaseLayers(), { off: false, wire: false, faces: true, points: false }, "default is Faces only");
assert(isBaseHidden(hiddenBaseLayers()) && !isBaseHidden(defaultBaseLayers()), "Off hides the cut body");
assert.deepEqual(applyBaseChoice(defaultBaseLayers(), "off", true), hiddenBaseLayers(), "Off clears Wire/Faces/Points");
assert.deepEqual(applyBaseChoice(hiddenBaseLayers(), "points", true), { off: false, wire: false, faces: false, points: true }, "checking a layer clears Off");
assert.deepEqual(
  applyBaseChoice({ off: false, wire: false, faces: true, points: false }, "wire", true),
  { off: false, wire: true, faces: true, points: false },
  "Wire and Faces can be on together",
);
assert.deepEqual(applyBaseChoice({ off: false, wire: false, faces: true, points: false }, "faces", false), hiddenBaseLayers(), "unchecking the last layer becomes Off");
assert.deepEqual(normalizeBaseLayers({ wire: true, faces: true, points: true }), { off: false, wire: true, faces: true, points: true }, "all three draw layers compose");
assert(viewerSrc.includes("ResizeObserver"), "viewer observes stage/canvas layout, not only window.resize");
assert(viewerSrc.includes("displayedSize") && viewerSrc.includes("visualViewport"), "aspect tracks the CSS canvas box");
assert(!/scale\.set\((?!Scalar)/.test(viewerSrc), "mesh scale stays uniform");
assert(mainSrc.includes("setChromeCollapsed") && mainSrc.includes("hide-chrome"), "main can stow the control chrome");
assert(mainSrc.includes("syncViewportAfterLayout"), "layout changes resync camera.aspect");

assert(html.includes('id="hide-chrome"') && html.includes("收起"), "dock has a Hide / 收起 control");
assert(html.includes('id="show-chrome"') && html.includes("控件"), "collapsed chrome has a UI chip to restore");
assert(html.includes('id="base-menu-btn"') && html.includes('id="toggle-warp"') && html.includes('id="toggle-overlay"'), "bottom chrome is Base / Warp / Stitch");
assert(/grid-template-columns:\s*1fr 1fr 1fr/.test(readFileSync(join(root, "src", "style.css"), "utf8")), "Base button shares the same 3-column size as Warp and Stitch");
assert(html.includes('id="open-menu"') && html.includes('id="open-menu-btn"'), "top bar uses one Open menu");
assert(html.includes('id="load-sample"') && html.includes('id="open-folder"') && html.includes('id="open-files"'), "Sample / Folder / Files stay as menu items");
assert(!html.includes('class="actions"'), "Folder / Files / Sample are not a row of top-bar buttons");
assert(mainSrc.includes("setOpenMenu") && mainSrc.includes("open-menu-list"), "main wires the Open dropdown");

const css = readFileSync(join(root, "src", "style.css"), "utf8");
assert(/\.dock\s*\{[^}]*overflow:\s*visible/.test(css), "dock does not clip the upward Base menu");
assert(/\.dyn-controls\s*\{[^}]*overflow-y:\s*auto/.test(css), "slider stack still scrolls inside the dock");
assert(/--touch:\s*44px/.test(css), "toggle / menu hit targets stay at least 44px");
assert(/--dual-h:\s*36px/.test(css) && /--track-h:\s*4px/.test(css), "mobile dual sliders are skinny");
assert(/--thumb:\s*28px/.test(css), "slider handles stay large enough to grab");
assert(css.includes(".open-menu") && css.includes(".open-menu-list"), "Open control is a dropdown, not a 3-column grid");
assert(!/\.actions\s*\{/.test(css), "old .actions button row is gone");
assert(css.includes("chrome-collapsed"), "collapsed chrome hides topbar + dock");
assert(css.includes(".stage canvas") && css.includes("width: 100%") && css.includes("height: 100%"), "canvas CSS fills the stage");

assert(aspectFromSize(800, 400) === 2, "wide stage is aspect 2, not the constructor default 1");
assert(aspectFromSize(390, 844) === 390 / 844, "phone portrait uses true canvas aspect");
assert(displayedSize({ clientWidth: 800, clientHeight: 400 }).width === 800, "displayedSize reads the CSS box");
assert(displayedSize({ getBoundingClientRect: () => ({ width: 390.4, height: 511.6 }) }).height === 512, "displayedSize rounds the painted box");
assert(
  !drawingMatchesDisplay(800, 800, 800, 400, 1),
  "tall drawing buffer in a short CSS box is the squash bug",
);
assert(drawingMatchesDisplay(800, 400, 800, 400, 1), "matched buffer and CSS box is not stretched");
assert(
  needsViewportSync({ cssWidth: 800, cssHeight: 400, aspect: 1, bufferWidth: 800, bufferHeight: 800, pixelRatio: 1 }),
  "stale aspect=1 or mismatched buffer must resync",
);
assert(
  !needsViewportSync({ cssWidth: 800, cssHeight: 400, aspect: 2, bufferWidth: 800, bufferHeight: 400, pixelRatio: 1 }),
  "matching aspect and buffer is clean",
);

console.log("project checks ok");
