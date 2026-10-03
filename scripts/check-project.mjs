import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  indexFiles,
  isManifestShape,
  isOverlayName,
  projectFromDiscovery,
  projectFromManifest,
  readableMapRank,
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
  formatStitchPick,
  formatStitchPickParts,
  termTypeShortLabel,
  faceChunksFromFaces,
  facesRingChunksFromStitches,
  parseColoredObj,
  parseColsResample,
  parseColsResampleField,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  parseReadableMapHeader,
  parseReadableMapXfers,
  parseStitchMapBind,
  applyStitchMapBind,
  bindFaceForMapCell,
  stitchesInRingRange,
  termCountsForRings,
  uniqueColIdsFromXls,
  xlsScaleMatrixRowCount,
} from "../src/stitches.js";
import {
  bindRowForSheetRow,
  buildReadableMapGrid,
  cellFill,
  highlightKeysForMapCell,
  highlightKeysForStitch,
  highlightKeysFromStitches,
  recenterInsertIndex,
  sheetRowForBindRow,
  stitchForMapCell,
  tokenKind,
} from "../src/readable-map.js";
import { excelBedsWidth, hitTestContent, MAP_BEDS_W, MAP_CELL, MAP_CLICK_SLOP, MAP_HEAD_H, MAP_LABEL_W, panToKeepRectVisible, rowDirLabel } from "../src/map-view.js";
import { parseXlsWorkbook, rgbForIcv } from "../src/xls.js";
import {
  excelLegendKind,
  formatPhysicalNeedle,
  formatPhysicalNeedles,
  parseExcelReadableMap,
  physicalNeedleGlyph,
} from "../src/excel-map.js";
import {
  assertAlignedRow,
  buildFromFiles,
  settleAssignedWindows,
  toAbsoluteToken,
  toRelativeToken,
} from "./build-step4-ring0.mjs";
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
  refs.some((r) => /stitch_map_bind\.json$/.test(r)),
  "manifest must list desktop stitch_map_bind.json",
);
assert(
  refs.some((r) => /readable_map_step4_ring0\.xls$/.test(r)),
  "manifest must list the step4-ring0 Excel readable_map",
);
assert(
  existsSync(join(cylDir, "iteration_0_cut_readable_map_step3_xfer.xls")),
  "step3 xls stays on disk as fallback",
);
assert(
  existsSync(join(cylDir, "iteration_0_cut_readable_map_step4_beds.xls")),
  "historical step4 beds xls stays on disk",
);
assert(
  !readFileSync(join(root, "scripts", "build-step4-ring0.mjs"), "utf8").includes("step4_beds"),
  "ring0 beds come from the whole-ring live set, not step4_beds.xls",
);
assert(
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test.includes("build-step4-ring0.mjs --check"),
  "npm test must fail if the committed ring0 xls drifts",
);
assert(
  refs.some((r) => /readable_map\.txt$/.test(r)),
  "manifest still ships the txt companion for stitch col/row bind",
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
if (fromManifest.outputs.length !== 2) throw new Error("expected the faces-ring0 sheet plus the live step4 sample");
const facesOut = fromManifest.outputs[0];
const liveOut = fromManifest.outputs[1];
if (!/faces_ring0_step4_bed\.xls$/i.test(facesOut.readableMapFile?.name || "")) {
  throw new Error("first sample output must open faces_ring0_step4_bed.xls");
}
if (!/faces_ring0_step4_bed\.txt$/i.test(facesOut.readableMapTxtFile?.name || "")) {
  throw new Error("faces-ring0 output must keep its own txt");
}
if (!liveOut.stitchFile) throw new Error("expected stitch file");
if (!liveOut.readableMapFile) throw new Error("expected readable_map");
if (!/step4_ring0\.xls$/i.test(liveOut.readableMapFile.name)) {
  throw new Error("live sample must stay on the step4-ring0 xls");
}
if (!liveOut.readableMapTxtFile) throw new Error("expected readable_map txt companion");
if (!liveOut.colsResampleFile) throw new Error("expected cols_resample field");
if (!liveOut.colsResampleXlsFile) throw new Error("expected cols_resample xls");
if (liveOut.colsResampleJsonFile) throw new Error("sample should not ship a cols_resample sidecar");
if (!liveOut.firstRowsFile) throw new Error("expected first_rows xls");
if (!liveOut.facesRingLayoutFile) throw new Error("expected faces_ring_layout.json");
if (!liveOut.stitchMapBindFile) throw new Error("expected stitch_map_bind.json");
{
  const facesMap = parseExcelReadableMap(readFileSync(join(cylDir, "faces_ring0_step4_bed.xls")));
  assert(facesMap.sheet === "ring0" && facesMap.rows.length > 0, "faces_ring0 bed chart opens as sheet ring0");
  assert(facesMap.rows.some((row) => row.cells.some((cell) => cell.token.startsWith("F"))), "faces-ring0 chart has front-bed tokens");
  assert(facesMap.bedsHeader === "此刻活针", "faces-ring0 last column is the live-stitch count");
  assert(facesMap.rows[0].beds.startsWith("0针"), "first row starts with no seated stitches");
  const front0 = facesMap.rows[0].cells.find((cell) => cell.col === 0 && cell.token);
  assert(physicalNeedleGlyph(front0) === "F0" && front0.faceIndex === 0, "first knit cell is physical F0 and stitch face 0");
  const faceIds = new Set(facesMap.faceByCell.values());
  assert(faceIds.size === 46 && [...faceIds].every((id) => id >= 0 && id < 46), "every ring-0 stitch face is on a knit cell");
  const bind = parseStitchMapBind(readFileSync(join(cylDir, "stitch_map_bind.json"), "utf8"));
  const face0 = stitchForMapCell(0, 0, bind, null, facesMap);
  assert(face0?.index === 0, "clicking the first cell selects stitch face 0, not a step3 column");
  const term21 = highlightKeysForStitch({ index: 21 }, { map: facesMap, bind });
  assert(term21.size === 2, "the hang-1 increase term lights both of its knit cells");
}

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
if (!fromDiscovery.outputs[0].stitchMapBindFile) throw new Error("discovery should attach stitch_map_bind.json");
if (!/step4_ring0\.xls$/i.test(fromDiscovery.outputs[0].readableMapFile?.name || "")) {
  throw new Error("discovery should prefer the step4-ring0 xls over readable_map.txt");
}
assert(readableMapRank("iteration_0_cut_readable_map_step4_ring0.xls") > readableMapRank("iteration_0_cut_readable_map_step3_xfer.xls"), "ring0 outranks step3");
assert(readableMapRank("iteration_0_cut_readable_map_step3_xfer.xls") > readableMapRank("iteration_0_cut_readable_map_step4_beds.xls"), "step3 outranks the full step4 beds source");
{
  const diskEntries = readdirSync(cylDir)
    .map((name) => ({ name, path: `cylinder/${name}` }))
    .filter((e) => /\.(xls|xlsx|obj|json|txt)$/i.test(e.name));
  const onDisk = projectFromDiscovery(indexFiles(diskEntries));
  assert(/step4_ring0\.xls$/i.test(onDisk.outputs[0].readableMapFile?.name || ""), "folder discovery prefers step4-ring0 when beds and step3 are also present");
  const noRing0 = projectFromDiscovery(indexFiles(diskEntries.filter((e) => !/ring0/i.test(e.name))));
  assert(/step3_xfer\.xls$/i.test(noRing0.outputs[0].readableMapFile?.name || ""), "discovery falls back to step3 xls when ring0 is missing");
}
if (!fromDiscovery.outputs[0].readableMapTxtFile) throw new Error("discovery should keep the txt companion");
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
const mapHeader = parseReadableMapHeader(mapText);
assert(mapHeader?.rows === 65 && mapHeader?.cells === 479, "header is 65 machine rows / 479 cells");
assert(mapHeader.circle === 21 && mapHeader.front === 11 && mapHeader.back === 10, "header keeps first_row circle split");
assert(map.header?.cells === 479 && map.header?.circle === 21, "parseReadableMap keeps the txt header");
assert(map.colMin === -4 && map.colMax === 36, "needle columns come from col[start..end], including negatives");
const xfers = parseReadableMapXfers(mapText);
assert(xfers.length > 0 && xfers[0].moves[0].raw.includes("@"), "xfer lines are parsed from the same txt, not invented");
assert(map.xfers.length === xfers.length, "parseReadableMap keeps xfer arrows");
const grid = buildReadableMapGrid(map);
assert(grid.nRows === 65 && grid.nCols === 41, "2D grid is 65 machine rows × needles -4..36");
assert(grid.grid[0][4].token === "·" && grid.grid[0][4].col === 0, "row000 col0 is a knit token from the txt");
assert(tokenKind("·") === "knit" && tokenKind("-R2") === "decrease" && tokenKind("+L2") === "increase", "token kinds follow the written glyphs");
assert(grid.nRows === map.rows.length, "do not invent extra map rows beyond rowNNN");
assert(rowDirLabel(map.rows[0].row, map.rows[0].dir) === "0 R", "txt map left label uses the same 0-based row + dir");

const bound = bindStitchesToMap(parsed.faces, map);
if (bound.stitches.length !== 475) throw new Error("bind should keep every face");
const row0 = bound.stitches.filter((s) => s.row === 0);
if (row0.length !== 21) throw new Error(`row000 should bind 21 faces, got ${row0.length}`);
if (row0.some((s) => s.col < 0 || s.col > 20)) throw new Error("row000 columns should be 0..20");
if (bound.rowMin !== 0) throw new Error("bound rowMin should be 0");
if (bound.rowMax < 50) throw new Error("bound rowMax should reach the upper courses");
if (bound.columns.length < 20) throw new Error("expected dozens of needle columns");
if (bound.leftoverCells < 1) throw new Error("map has extra tail tokens with no faces");

const typedGrid = buildReadableMapGrid(map, bound.stitches);
const pickFace = bound.stitches[20];
assert(pickFace.row === 0 && pickFace.col === 20, "generation-order face 20 is row000 col 20");
const pickKeys = highlightKeysForStitch(pickFace, { map, grid: typedGrid });
assert(pickKeys.size === 1 && pickKeys.has("0,20"), "one stitch lights the bound row×needle cell");
assert(
  typedGrid.grid[0][20 - typedGrid.colMin].stitchIndex === 20,
  "grid stitchIndex stays generation-order face index",
);
assert(highlightKeysForStitch(null).size === 0, "empty pick has no map cells");
assert(
  highlightKeysForStitch({ index: 999 }, { map, grid: typedGrid }).size === 0,
  "unbound face index does not invent a cell",
);
{
  const multi = highlightKeysForStitch(
    { index: 7, row: 3, col: 4 },
    {
      grid: {
        grid: [
          [
            { row: 3, col: 4, stitchIndex: 7 },
            { row: 3, col: 5, stitchIndex: 7 },
          ],
        ],
      },
    },
  );
  assert(multi.has("3,4") && multi.has("3,5") && multi.size === 2, "one stitch can light every bound cell");
}
assert(
  highlightKeysFromStitches(bound.stitches.slice(0, 21)).size === 21,
  "slider highlight still uses the same row,col keys",
);
{
  const pan = panToKeepRectVisible({
    tx: 0,
    ty: 0,
    scale: 1,
    viewW: 200,
    viewH: 160,
    minX: 400,
    minY: 300,
    maxX: 422,
    maxY: 322,
    pad: 12,
  });
  assert(pan.tx < 0 && pan.ty < 0, "ensureVisible pans so an off-screen cell enters the view");
}

const excelBuf = readFileSync(join(cylDir, "iteration_0_cut_readable_map_step3_xfer.xls"));
const excelMap = parseExcelReadableMap(excelBuf);
assert(excelMap.source === "excel" && excelMap.sheet === "step3", "parse the step3 sheet, not txt");
assert(excelMap.rows.length === 121, `step3 has 121 data rows, got ${excelMap.rows.length}`);
assert(excelMap.needleCols.length === 42 && excelMap.colMin === -5 && excelMap.colMax === 36, "needles are −5…36 after live bed persists across rings");
assert(excelMap.headerLabel === "dir\\col", "corner header is dir\\col");
assert(excelMap.knitRows === 89, `mid-row decrease dump has 89 knit segments, got ${excelMap.knitRows}`);
{
  const knitOccupied = excelMap.cells.filter((c) => c.token && (c.dir === "R" || c.dir === "L")).length;
  assert(knitOccupied === 507, `decrease-span dump occupies 507 knit cells, got ${knitOccupied}`);
}
function knitOccupiedCols(row) {
  return (row?.cells || []).filter((c) => c.token || c.label).map((c) => c.col);
}
function knitStartCol(row) {
  const cols = knitOccupiedCols(row);
  if (!cols.length) return undefined;
  return row.dir === "L" ? Math.max(...cols) : Math.min(...cols);
}
function knitEndCol(row) {
  const cols = knitOccupiedCols(row);
  if (!cols.length) return undefined;
  return row.dir === "L" ? Math.min(...cols) : Math.max(...cols);
}
{
  const dirs = excelMap.rows.map((r) => r.dir);
  const hist = dirs.reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  assert(hist.R === 51 && hist.L === 38 && hist.X === 27 && hist["X+"] === 5, "row counts stay R/L plus mid-row xfer");
  assert(excelMap.rows[0].dir === "R" && excelMap.rows[1].dir === "X+" && excelMap.rows[2].dir === "L", "display starts R knit → X+ → L knit");
  assert(excelMap.rows[5].dir === "R" && excelMap.rows[6].dir === "R", "consecutive R knit segments are not merged");
  assert(excelMap.rows[5].row === 5 && excelMap.rows[6].row === 6, "each consecutive R keeps its own display_row");
  assert(excelMap.rows[5].knitRow === 4 && excelMap.rows[6].knitRow === 5, "knit identity increments per segment");
  assert(
    excelMap.rows[6].dir === "R" && excelMap.rows[7].dir === "X" && excelMap.rows[8].dir === "R",
    "decrease splits R around intercalated X",
  );
}
assert(excelMap.rows[0].cells.find((c) => c.col === 0)?.token === "·", "first R row writes · at needle 0");
assert(excelMap.rows[0].cells.find((c) => c.col === 20)?.token === "vR", "tokens stay as written, including vR");
assert(excelMap.rows[1].cells.find((c) => c.col === 0)?.token === "←1", "X+ after the opening R knit writes ←1");
assert(excelLegendKind("←1", "X+") === "transfer" && excelLegendKind("vL", "L") === "wrap", "legend kinds follow Singa tokens");
assert(excelLegendKind("F·", "R") === "plain" && excelLegendKind("B·", "R") === "plain", "F/B plain knits stay plain");
assert(excelLegendKind("⬇", "Flip") === "flip" && excelLegendKind("⬆", "Flip") === "flip", "bed flips use ⬇ and ⬆");
assert(excelLegendKind("BvR", "R") === "wrap" && excelLegendKind("B+R1", "L") === "increase", "F/B prefix still classifies wrap and increase");
assert(excelLegendKind("F←", "X+") === "transfer" && excelLegendKind("B→", "X") === "transfer" && excelLegendKind("F→2", "X") === "transfer", "1-stitch arrows and numbered multi-moves stay transfer");
assert(toAbsoluteToken("→1", "F") === "F→" && toAbsoluteToken("←1", "F") === "F←", "front 1-stitch move drops the number");
assert(toAbsoluteToken("←1", "B") === "B→" && toAbsoluteToken("→1", "B") === "B←", "back 1-stitch move is the mirror and drops the number");
assert(toAbsoluteToken("→2", "F") === "F→2" && toAbsoluteToken("←3", "B") === "B→3", "moves of 2 or more keep the count and drop R/L");
assert(toRelativeToken("F→") === "→1" && toRelativeToken("F←") === "←1" && toRelativeToken("B→") === "←1" && toRelativeToken("B←") === "→1", "short arrows map back to step3 ±1");
assert(toRelativeToken("F→2") === "→2" && toRelativeToken("B←2") === "→2", "numbered arrows map back to step3 with the same count");
{
  const make = (spec) => {
    const stitches = new Map();
    spec.forEach((item, id) => stitches.set(id, { id, bed: item[0], phys: item[1], chart: id }));
    return stitches;
  };
  const physOf = (stitches, bed) =>
    [...stitches.values()]
      .filter((st) => st.bed === bed)
      .map((st) => st.phys)
      .sort((a, b) => a - b)
      .join(",");
  const rack = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["B", 1],
    ["B", 2],
    ["B", 3],
  ]);
  const racked = settleAssignedWindows(rack, new Map(), new Set(), "试齐");
  assert(racked.length === 1 && racked[0].row.dir === "X" && racked[0].row.windowAlign, "equal counts one needle apart rack the offset bed");
  assert(racked[0].beds === "F0…F2 / B1…B3", "a rack row records the window it starts from");
  assert(
    racked[0].row.cells.map((cell) => `${cell.token}@${cell.phys}`).sort().join(",") === "B←@1,B←@2,B←@3",
    "the rack draws a 1-stitch arrow on each source needle",
  );
  assert(physOf(rack, "F") === "0,1,2" && physOf(rack, "B") === "0,1,2", "the back window lands on the front window");
  const aligned = make([
    ["F", 0],
    ["F", 1],
    ["B", 0],
    ["B", 1],
  ]);
  assert(settleAssignedWindows(aligned, new Map(), new Set(), "试齐").length === 0, "aligned windows do not insert a row");
  const spare = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["B", 1],
    ["B", 2],
  ]);
  assert(settleAssignedWindows(spare, new Map(), new Set(), "试差").length === 0, "the left-junction spare is not a rack or a flip");
  const packed = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["B", 0],
    ["B", 1],
  ]);
  const shifted = settleAssignedWindows(packed, new Map(), new Set(), "试空");
  assert(shifted.length === 1 && shifted[0].row.dir === "X" && shifted[0].row.windowAlign, "a right-fold empty racks the short bed onto the left junction");
  assert(
    shifted[0].row.cells.map((cell) => `${cell.token}@${cell.phys}`).sort().join(",") === "B→@0,B→@1",
    "the left-fold rack draws B→ on each source needle",
  );
  assert(physOf(packed, "F") === "0,1,2" && physOf(packed, "B") === "1,2", "the empty lands at back physical needle 0");
  const afterDec = make([
    ["F", 0],
    ["F", 1],
    ["B", 0],
    ["B", 1],
    ["B", 2],
  ]);
  const repaired = settleAssignedWindows(afterDec, new Map(), new Set(), "试翻移");
  assert(
    repaired.length === 2 && repaired[0].row.dir === "Flip" && repaired[0].row.cells[0].token === "⬇" && repaired[1].row.windowAlign,
    "a right-fold flip that leaves the empty on the short bed is followed by the whole-bed shift",
  );
  assert(physOf(afterDec, "F") === "0,1,2" && physOf(afterDec, "B") === "1,2", "after the flip and the shift the empty is at the left junction");
  const lowPack = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["F", 3],
    ["B", 0],
    ["B", 1],
  ]);
  const packedOff = settleAssignedWindows(lowPack, new Map(), new Set(), "试配");
  assert(
    packedOff.length === 2 &&
      packedOff[0].row.dir === "Flip" &&
      packedOff[0].row.cells[0].token === "⬆" &&
      packedOff[0].row.cells[0].phys === 3 &&
      packedOff[0].beds === "F0…F3 / B0…B1" &&
      !packedOff[1].row.windowAlign &&
      packedOff[1].row.cells.length === 1 &&
      packedOff[1].row.cells[0].token === "B←" &&
      packedOff[1].row.cells[0].phys === 3 &&
      packedOff[1].row.cells[0].bed === "B" &&
      packedOff[1].beds === "F0…F2 / B0…B1,B3",
    "one past the packed high flips, then moves only that coil Hi to Hi−1",
  );
  assert(physOf(lowPack, "F") === "0,1,2" && physOf(lowPack, "B") === "0,1,2", "the single coil lands on the packed high");
  const highPack = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["F", 3],
    ["F", 4],
    ["F", 5],
    ["F", 6],
    ["F", 7],
    ["F", 8],
    ["B", 0],
    ["B", 1],
    ["B", 2],
    ["B", 3],
    ["B", 4],
    ["B", 5],
    ["B", 6],
  ]);
  const highOff = settleAssignedWindows(highPack, new Map(), new Set(), "试高");
  assert(
    highOff.length === 2 &&
      highOff[0].row.cells[0].token === "⬆" &&
      highOff[0].row.cells[0].phys === 8 &&
      highOff[1].row.cells.length === 1 &&
      highOff[1].row.cells[0].token === "B←" &&
      highOff[1].row.cells[0].phys === 8 &&
      !highOff[1].row.windowAlign,
    "the same Hi to Hi−1 rule uses whatever index the windows have",
  );
  assert(physOf(highPack, "F") === "0,1,2,3,4,5,6,7" && physOf(highPack, "B") === "0,1,2,3,4,5,6,7", "index 8 packs onto 7");
  const backLong = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["F", 3],
    ["F", 4],
    ["B", 0],
    ["B", 1],
    ["B", 2],
    ["B", 3],
    ["B", 4],
    ["B", 5],
    ["B", 6],
  ]);
  const backOff = settleAssignedWindows(backLong, new Map(), new Set(), "试后");
  assert(
    backOff.length === 2 &&
      backOff[0].row.cells[0].token === "⬇" &&
      backOff[0].row.cells[0].phys === 6 &&
      backOff[0].row.cells[0].bed === "B" &&
      backOff[1].row.cells.length === 1 &&
      backOff[1].row.cells[0].token === "F←" &&
      backOff[1].row.cells[0].phys === 6 &&
      backOff[1].row.cells[0].bed === "F" &&
      !backOff[1].row.windowAlign,
    "an excess on the front uses the same single-coil step",
  );
  assert(physOf(backLong, "F") === "0,1,2,3,4,5" && physOf(backLong, "B") === "0,1,2,3,4,5", "the front coil packs onto the shared high");
  let wider = false;
  try {
    settleAssignedWindows(
      make([
        ["F", 0],
        ["F", 1],
        ["F", 2],
        ["F", 3],
        ["F", 4],
        ["B", 0],
        ["B", 1],
      ]),
      new Map(),
      new Set(),
      "试宽",
    );
  } catch (err) {
    wider = /不是空着的相邻针/.test(err.message);
  }
  assert(wider, "a gap wider than one past the packed high still stops");
  let stopped = false;
  try {
    settleAssignedWindows(
      make([
        ["F", 0],
        ["F", 1],
        ["F", 2],
        ["B", 2],
        ["B", 3],
        ["B", 4],
      ]),
      new Map(),
      new Set(),
      "试停",
    );
  } catch (err) {
    stopped = /NOTE:/.test(err.message);
  }
  assert(stopped, "an offset that is not one needle stops");
  const surplus = make([
    ["F", 0],
    ["F", 1],
    ["F", 2],
    ["F", 3],
    ["B", 2],
    ["B", 3],
  ]);
  const cleared = settleAssignedWindows(surplus, new Map(), new Set(), "试让");
  assert(
    cleared.length === 3 &&
      cleared[0].row.windowAlign &&
      cleared[0].beds === "F0…F3 / B2…B3" &&
      cleared[0].row.cells.map((cell) => `${cell.token}@${cell.phys}`).sort().join(",") === "B←@2,B←@3" &&
      cleared[1].row.dir === "Flip" &&
      cleared[1].beds === "F0…F3 / B1…B2" &&
      cleared[1].row.cells[0].token === "⬆" &&
      cleared[1].row.cells[0].phys === 3 &&
      /翻到 B3/.test(cleared[1].note) &&
      cleared[2].row.windowAlign &&
      cleared[2].beds === "F0…F2 / B1…B3" &&
      cleared[2].row.cells.map((cell) => `${cell.token}@${cell.phys}`).sort().join(",") === "B←@1,B←@2,B←@3",
    "a two-stitch front surplus frees the paired needle, flips onto it, then racks one needle",
  );
  assert(physOf(surplus, "F") === "0,1,2" && physOf(surplus, "B") === "0,1,2", "the two one-needle racks land both windows on 0…2");
  stopped = false;
  try {
    settleAssignedWindows(
      make([
        ["F", 0],
        ["F", 1],
        ["F", 2],
        ["F", 3],
        ["F", 4],
        ["F", 5],
        ["B", 0],
        ["B", 1],
      ]),
      new Map(),
      new Set(),
      "试停差",
    );
  } catch (err) {
    stopped = /NOTE:/.test(err.message);
  }
  assert(stopped, "a count gap of more than one stitch stops");
}
{
  const wrap = excelMap.rows[0].cells.find((c) => c.col === 20);
  const plain = excelMap.rows[0].cells.find((c) => c.col === 0);
  const xfer = excelMap.rows[1].cells.find((c) => c.col === 0);
  const inc = excelMap.rows[2].cells.find((c) => c.col === 20);
  const dec = excelMap.rows.find((r) => r.cells.some((c) => c.token === "-R1"))
    .cells.find((c) => c.token === "-R1");
  const lime = excelMap.rows[2].cells.find((c) => c.col === 19);
  const empty = excelMap.rows[0].cells.find((c) => c.col === -5);
  assert(wrap.fill === "rgb(255,204,0)", `gold wrap from XF, got ${wrap.fill}`);
  assert(plain.fill === "rgb(255,255,255)", `plain · is white, got ${plain.fill}`);
  assert(xfer.fill === "rgb(204,204,255)", `ice_blue transfer from XF, got ${xfer.fill}`);
  assert(inc.fill === "rgb(204,255,204)", `green increase from XF, got ${inc.fill}`);
  assert(dec.fill === "rgb(255,153,204)", `rose decrease from XF, got ${dec.fill}`);
  assert(lime.token === "^R" && lime.fill === "rgb(153,204,0)", `lime wrap+inc from XF, got ${lime.fill}`);
  assert(empty.fill === "rgb(192,192,192)", `empty cells keep Excel grey_25, got ${empty.fill}`);
  assert(cellFill(wrap).fill === wrap.fill && cellFill(plain).fill === plain.fill, "Excel view uses XF/legend fills, not Term.Type");
  assert(rgbForIcv(51).join(",") === "255,204,0" && rgbForIcv(31).join(",") === "204,204,255", "default palette matches gold / ice_blue");
}
const excelGrid = buildReadableMapGrid(excelMap, bound.stitches);
assert(excelGrid.source === "excel" && excelGrid.nRows === 121 && excelGrid.nCols === 42, "2D Excel grid is 121×42");
assert(excelGrid.grid[0][20 - excelGrid.colMin].token === "vR", "row0 col20 is vR");
assert(excelGrid.grid[1][0 - excelGrid.colMin].token === "←1", "X+ row is a real grid row, not a drawn arrow");
assert(excelGrid.grid[0][20 - excelGrid.colMin].termColor == null, "Excel cells do not carry Term.Type colors");
assert(excelGrid.xfers.length === 0, "do not invent extra xfer arrow rows on top of X/X+");
assert(excelGrid.grid[1][0 - excelGrid.colMin].isTransfer, "X+ cells are marked transfer / not stitch");
assert(excelGrid.grid[6][4 - excelGrid.colMin].token === "·", "pre-X knit segment still ends …4,5,6");
assert(excelGrid.grid[6][5 - excelGrid.colMin].token === "-R1" && excelGrid.grid[6][5 - excelGrid.colMin].isKnit, "decrease span stays on the first R segment");
assert(excelGrid.grid[6][6 - excelGrid.colMin].token === "·", "decrease hang+1 cell stays at col 6");
assert(excelGrid.grid[7][6 - excelGrid.colMin].isTransfer, "intercalated X after the decrease span is transfer");
{
  const firstDecXCols = knitOccupiedCols(excelMap.rows[7]);
  assert(
    excelMap.rows[7].dir === "X" &&
      firstDecXCols.length === 31 &&
      Math.min(...firstDecXCols) === 6 &&
      Math.max(...firstDecXCols) === 36,
    "first mid-row decrease X moves all hanging live needles 6…36, not one cell",
  );
  const laterDecXCols = knitOccupiedCols(excelMap.rows[97]);
  assert(
    excelMap.rows[97].dir === "X" &&
      laterDecXCols.length === 17 &&
      Math.min(...laterDecXCols) === 9 &&
      Math.max(...laterDecXCols) === 25,
    "later-ring decrease X also moves prior-path live needles, not one cell",
  );
}
assert(
  excelGrid.grid[8][6 - excelGrid.colMin].token === "·" && excelGrid.grid[8][6 - excelGrid.colMin].isKnit,
  "post-X remaining knit starts at col 6 (hang=1 rightward ⇒ −1 from unshifted 7)",
);
assert(
  excelGrid.grid[8][7 - excelGrid.colMin].token === "·" && excelGrid.grid[8][8 - excelGrid.colMin].token === "·",
  "post-X remainder continues 7,8",
);
assert(knitEndCol(excelMap.rows[6]) === 6 && knitStartCol(excelMap.rows[8]) === 6, "after mid-row X, next knit starts at the hang-shifted end@6");
assert(knitEndCol(excelMap.rows[9]) === -4 && knitStartCol(excelMap.rows[11]) === -4, "same-ring later knit N+1 starts at the previous shifted end@-4");
assert(knitEndCol(excelMap.rows[96]) === 9 && knitStartCol(excelMap.rows[98]) === 9, "later ring decrease hang stays in-ring: end@9 then next start@9");

const stitchBind = parseStitchMapBind(readFileSync(join(cylDir, "stitch_map_bind.json"), "utf8"));
assert(stitchBind?.faces.length === 475, `bind lists 475 faces, got ${stitchBind?.faces.length}`);
assert(stitchBind.n_unbound_faces === 0, "desktop dump binds every face");
assert(stitchBind.n_knit_rows === 89 && stitchBind.n_xfer_rows === 32, "89 knit segments + 32 transfer display rows");
assert(stitchBind.n_display_rows === 121, "display rows match the step3 sheet");
assert(stitchBind.n_multi_cell_terms === 29, "increase + decrease terms span multiple knit cells");
{
  const ringOrigins = [
    [0, 0, 0],
    [46, 6, 0],
    [182, 28, 0],
    [292, 50, 0],
    [398, 92, 0],
  ];
  for (const [face, display_row, col] of ringOrigins) {
    const cell = stitchBind.byIndex.get(face)?.cells[0];
    assert(
      cell?.display_row === display_row && cell?.col === col,
      `faces_ring first knit face ${face} starts @ ${display_row},${col}`,
    );
  }
}
assert(stitchBind.display_rows[0].dir === "R" && stitchBind.display_rows[1].dir === "X+" && stitchBind.display_rows[2].dir === "L", "bind display_rows start R then X+ then L");
assert(
  excelMap.rows.length === stitchBind.display_rows.length &&
    excelMap.rows.every((row, i) => row.dir === stitchBind.display_rows[i].dir && stitchBind.display_rows[i].display_row === i),
  "Excel display_row indices match stitch_map_bind",
);
assert(stitchBind.byIndex.get(20)?.cells[0].display_row === 0 && stitchBind.byIndex.get(20)?.cells[0].col === 20, "face 20 is display 0 × col 20");
assert(stitchBind.byIndex.get(21)?.cells.length === 2, "face 21 is a 2-cell increase");
assert(stitchBind.byIndex.get(51)?.cells.length === 2, "face 51 is a 2-cell -R1 decrease");
applyStitchMapBind(bound.stitches, stitchBind);
assert(bound.stitches[20].path_index === 0 && bound.stitches[20].term_index === 20, "face 20 keeps desktop path/term");
assert(bound.stitches[21].mapCells.length === 2, "increase face keeps both span cells");
assert(bound.stitches[51].mapCells.length === 2, "decrease face keeps hang+1 span cells");
{
  const pickKeys = highlightKeysForStitch(bound.stitches[20], { map: excelMap, grid: excelGrid });
  assert(pickKeys.size === 1 && pickKeys.has("0,20"), "face 20 lights only its bind knit cell 0,20");
  assert(excelGrid.grid[0][20 - excelGrid.colMin].knitRow === 0, "first R row is knit identity 0");
  const xCell = excelMap.cells.find((c) => c.token === "←1");
  assert(xCell && xCell.dir === "X+" && xCell.row === 1, "←1 lives on the X+ row after the opening R knit");
  assert(!pickKeys.has(`${xCell.row},${xCell.col}`), "stitch click never lights X/X+");
  const incKeys = highlightKeysForStitch(bound.stitches[21], { map: excelMap, grid: excelGrid });
  assert(incKeys.has("2,20") && incKeys.has("2,19") && incKeys.size === 2, "increase term lights every span cell");
  const triple = highlightKeysForStitch(bound.stitches[374], { map: excelMap, grid: excelGrid });
  assert(triple.has("73,10") && triple.has("73,11") && triple.has("73,12") && triple.size === 3, "+R2 span lights 3 in-ring hang-shifted cells");
  const decKeys = highlightKeysForStitch(bound.stitches[51], { map: excelMap, grid: excelGrid });
  assert(decKeys.has("6,5") && decKeys.has("6,6") && decKeys.size === 2, "-R1 decrease span lights hang+1 cells");
  const decTriple = highlightKeysForStitch(bound.stitches[385], { map: excelMap, grid: excelGrid });
  assert(
    decTriple.has("75,17") && decTriple.has("75,18") && decTriple.has("75,19") && decTriple.size === 3,
    "-R2 decrease span lights three in-ring hang-shifted knit cells",
  );
  const xferDirs = new Set(
    [...pickKeys, ...incKeys, ...triple, ...decKeys, ...decTriple].map((key) => {
      const [rs, cs] = key.split(",");
      return excelGrid.grid[Number(rs)][Number(cs) - excelGrid.colMin]?.dir;
    }),
  );
  assert([...xferDirs].every((d) => d === "R" || d === "L"), "bind highlights stay on R/L knit rows");
  assert(
    highlightKeysForStitch({ index: 20, row: 0, col: 20 }, { map: excelMap, grid: excelGrid }).size === 0,
    "Excel highlight without stitch_map_bind cells is empty",
  );
  const onlyCol = highlightKeysForStitch({ index: 999, col: 20 }, { map: excelMap, grid: excelGrid });
  assert(onlyCol.size === 0, "do not fall back to every token in a needle column");
  assert(
    highlightKeysFromStitches(bound.stitches.slice(0, 21), { map: excelMap, grid: excelGrid }).has("0,20"),
    "slider highlight uses bind cells on the Excel grid",
  );
  const sliderKeys = highlightKeysFromStitches(bound.stitches.slice(0, 22), { map: excelMap, grid: excelGrid });
  assert(sliderKeys.has("2,20") && sliderKeys.has("2,19"), "slider still lights the L knit increase on display 2");
  assert(![...sliderKeys].some((k) => k.startsWith("1,")), "slider highlight skips the intercalated X+ row");
}

{
  assert(stitchBind.byCell instanceof Map && stitchBind.byCell.get("0,20")?.face_index === 20, "bind builds reverse cell→face index on load");
  assert(bindFaceForMapCell(0, 20, stitchBind)?.face_index === 20, "bindFaceForMapCell uses display_row,col");
  const face20 = stitchForMapCell(0, 20, stitchBind, bound.stitches);
  assert(face20 === bound.stitches[20] && face20.index === 20, "knit cell 0,20 reverse-selects face 20");
  assert(stitchForMapCell(0, 20, stitchBind)?.index === 20, "bind-only reverse lookup still returns face_index");
  for (const col of [10, 11, 12]) {
    const hit = stitchForMapCell(73, col, stitchBind, bound.stitches);
    assert(hit === bound.stitches[374] && hit.index === 374, `+R2 span cell 73,${col} reverse-selects face 374`);
    const keys = highlightKeysForMapCell(73, col, { map: excelMap, grid: excelGrid, bind: stitchBind });
    assert(
      keys.has("73,10") && keys.has("73,11") && keys.has("73,12") && keys.size === 3,
      `clicking 73,${col} highlights the whole +R2 term`,
    );
  }
  for (const col of [5, 6]) {
    const hit = stitchForMapCell(6, col, stitchBind, bound.stitches);
    assert(hit === bound.stitches[51] && hit.index === 51, `-R1 span cell 6,${col} reverse-selects face 51`);
    const keys = highlightKeysForMapCell(6, col, { map: excelMap, grid: excelGrid, bind: stitchBind });
    assert(keys.has("6,5") && keys.has("6,6") && keys.size === 2, `clicking 6,${col} highlights the whole -R1 term`);
  }
  assert(stitchForMapCell(8, 6, stitchBind, bound.stitches)?.index === 52, "hang-shifted remainder starts at 8,6 (was unshifted 8,7)");
  assert(stitchForMapCell(8, 7, stitchBind, bound.stitches)?.index === 53, "next remainder cell is 8,7 (was unshifted 8,8)");
  assert(stitchForMapCell(8, 8, stitchBind, bound.stitches)?.index === 54, "post-X remainder continues 6,7,8");
  assert(knitEndCol(stitchBind.display_rows[6]) === 6 && knitStartCol(stitchBind.display_rows[8]) === 6, "bind knit chain: end@6 then after X start@6");
  assert(knitEndCol(stitchBind.display_rows[9]) === -4 && knitStartCol(stitchBind.display_rows[11]) === -4, "bind same-ring later-row chain: end@-4 then next start@-4");
  assert(stitchForMapCell(9, -4, stitchBind, bound.stitches)?.index === 79, "same-ring L knit ends on shifted col -4 (face 79)");
  assert(stitchForMapCell(11, -4, stitchBind, bound.stitches)?.index === 80, "same-ring next R knit after X+ starts on shifted col -4 (face 80)");
  assert(stitchForMapCell(96, 8, stitchBind, bound.stitches)?.index === 418, "later-ring decrease span starts at 96,8");
  assert(stitchForMapCell(96, 9, stitchBind, bound.stitches)?.index === 418, "later-ring decrease hang+1 lands on 96,9");
  assert(stitchForMapCell(98, 9, stitchBind, bound.stitches)?.index === 419, "later-ring row after that X starts at 98,9");
  assert(stitchForMapCell(1, 0, stitchBind, bound.stitches) == null, "X+ transfer cell has no stitch");
  assert(stitchForMapCell(7, 6, stitchBind, bound.stitches) == null, "mid-row X transfer cell has no stitch");
  assert(stitchForMapCell(7, 36, stitchBind, bound.stitches) == null, "wide decrease X far cell still has no stitch");
  assert(stitchForMapCell(0, -4, stitchBind, bound.stitches) == null, "empty gray cell has no stitch");
  assert(stitchForMapCell(0, -5, stitchBind, bound.stitches) == null, "new leftmost empty gray cell has no stitch");
  assert(highlightKeysForMapCell(1, 0, { map: excelMap, grid: excelGrid, bind: stitchBind }).size === 0, "transfer reverse highlight is empty");
  const contentHit = hitTestContent(
    excelGrid,
    MAP_LABEL_W + (20 - excelGrid.colMin) * MAP_CELL + 2,
    MAP_HEAD_H + 2,
  );
  assert(contentHit?.row === 0 && contentHit?.col === 20, "hitTestContent maps Excel content coords to 0,20");
  assert(hitTestContent(excelGrid, 10, 10) == null, "header / dir label is not a map cell");
  assert(MAP_CLICK_SLOP === 8, "map click slop matches the 3D canvas");
  assert(MAP_LABEL_W >= 56, "label column fits 3-digit display_row + dir");
  assert(rowDirLabel(0, "R") === "0 R", "Excel first column uses 0-based display_row + dir");
  assert(rowDirLabel(7, "X") === "7 X" && rowDirLabel(8, "R") === "8 R", "mid-row X stays on its own display_row");
  assert(rowDirLabel(12, "X+") === "12 X+" && rowDirLabel(120, "X+") === "120 X+", "3-digit row + X+ still has a space");
  assert(
    rowDirLabel(excelMap.rows[0].row, excelMap.rows[0].dir) === "0 R" &&
      rowDirLabel(excelMap.rows[7].row, excelMap.rows[7].dir) === "7 X" &&
      rowDirLabel(excelMap.rows[8].row, excelMap.rows[8].dir) === "8 R",
    "sample first-column labels match bind display_row",
  );
}

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

assert(termTypeShortLabel(0) === "平针 PLAIN", "Type 0 is the documented PLAIN / 平针 name");
assert(termTypeShortLabel(1) === "白" && termTypeShortLabel(6) === "蓝", "other Types use palette colour names only");
assert(termTypeShortLabel(null) === "" && termTypeShortLabel(99) === "", "unknown Type is not invented");
assert(!termTypeShortLabel(0).includes("左向"), "do not invent undocumented Type names");

const pick0 = bound.stitches.find((s) => s.termType === 0 && s.col != null);
const pick6 = bound.stitches.find((s) => s.termType === 6);
assert(pick0 && pick6, "sample has a gray PLAIN face and a blue Type 6 face");
assert(formatStitchPick(null) === "", "empty pick is an empty readout");
assert(formatStitchPick(pick0).includes(`列 col ${pick0.col}`), "readout keeps the map needle column");
assert(formatStitchPick(pick0).includes(`ring ${pick0.ring}`), "readout keeps face-ring index");
assert(formatStitchPick(pick0).includes(`term ${pick0.termInRing}`), "readout keeps termInRing");
assert(formatStitchPick(pick0).includes(`face ${pick0.index}`), "readout keeps global face index");
assert(formatStitchPick(pick0).includes("Type 0") && formatStitchPick(pick0).includes("平针"), "Type 0 readout says 平针");
assert(formatStitchPick(pick6).includes("Type 6") && formatStitchPick(pick6).includes("蓝"), "Type 6 readout uses 蓝");
{
  const parts = formatStitchPickParts(pick0);
  const expected = {
    title: `列 col ${pick0.col}`,
    detail: `ring ${pick0.ring} · term ${pick0.termInRing} · face ${pick0.index} · Type 0 平针 PLAIN`,
  };
  if (JSON.stringify(parts) !== JSON.stringify(expected)) {
    throw new Error(`chip splits column vs ring/term/type: ${JSON.stringify(parts)}`);
  }
}

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
assert(html.includes('id="stitch-pick"') && html.includes('id="stitch-pick-title"') && html.includes('id="stitch-pick-text"'), "HUD has a stitch-pick chip");
assert(html.includes('id="base-menu-btn"') && html.includes('id="base-menu-list"'), "Base is a same-size menu button, not a native select");
assert(!html.includes("<select") && !html.includes("base-mode"), "exclusive Base <select> is gone");
assert(html.includes('id="base-off"') && html.includes('id="base-wire"') && html.includes('id="base-faces"') && html.includes('id="base-points"'), "Base has Off / Wire / Faces / Points checkboxes");
assert(html.includes("base-menu-sep") && html.includes("隐藏") && html.includes("Off"), "Off stays in the Base menu, separated from draw layers");
assert(/id="base-off"[^>]*checked/.test(html), "Base defaults to Off checked");
assert(!/id="base-faces"[^>]*checked/.test(html) && !/id="base-wire"[^>]*checked/.test(html) && !/id="base-points"[^>]*checked/.test(html), "Wire / Faces / Points start unchecked");
assert(/id="base-menu-btn"[^>]*aria-pressed="false"/.test(html), "Base button starts unpressed when Off");
assert(html.includes("底模") && html.includes("Base"), "Base control is labelled 底模 / Base");
assert(html.includes('id="toggle-warp"') && html.includes("列") && html.includes("Warp"), "Warp toggle shows cols_resample");
assert(/id="toggle-warp"[^>]*aria-pressed="true"/.test(html), "Warp defaults on");
assert(html.includes('id="toggle-overlay"') && html.includes("针迹") && html.includes("Stitch"), "Stitch toggle stays");
assert(!html.includes("toggle-wire") && !html.includes("toggle-body"), "standalone Wire / Base toggles are gone");
assert(!html.includes("toggle-shade") && !html.includes("平面"), "Flat toggle is gone");
const mainSrc = readFileSync(join(root, "src", "main.js"), "utf8");
assert(mainSrc.includes("paintStitchPick") && mainSrc.includes("formatStitchPickParts") && mainSrc.includes("setSelectedStitch"), "click paints a stitch readout instead of isolating");
assert(mainSrc.includes("viewer.pickStitch"), "click still raycasts stitch faces");
assert(!/facesRange\.configure\(\s*nRings\s*,\s*\[\s*ring/.test(mainSrc), "click does not collapse faces_ring to the hit ring");
assert(!/termsRange\.configure\(\s*nTerms\s*,\s*\[\s*term/.test(mainSrc), "click does not collapse term to the hit face");
assert(mainSrc.includes("setBaseLayers") && mainSrc.includes("applyBaseChoice"), "main wires Base multi-select");
assert(mainSrc.includes("setShowWarp") && mainSrc.includes("#toggle-warp"), "main wires the Warp toggle");
assert(!mainSrc.includes("setWireframe") && !mainSrc.includes("toggle-wire"), "main no longer has a standalone Wire toggle");
assert(!mainSrc.includes("setFlat") && !mainSrc.includes("toggle-shade"), "main no longer wires Flat");
const viewerSrc = readFileSync(join(root, "src", "viewer.js"), "utf8");
assert(viewerSrc.includes("setBaseLayers") && viewerSrc.includes("setShowWarp"), "viewer has Base layers and Warp visibility");
assert(viewerSrc.includes("defaultBaseLayers"), "cut body starts from default Base layers");
assert(viewerSrc.includes("opacity: 0.42"), "Faces mode stays the semi-transparent underlay");
assert(viewerSrc.includes("_wireMaterial") && viewerSrc.includes("_pointsMaterial"), "Wire and Points are composable overlays");
assert(/size:\s*2\.8/.test(viewerSrc) && viewerSrc.includes("_pointsMaterial"), "Base points are substantially larger than the old 0.12/0.55 cloud");
assert(viewerSrc.includes("CanvasTexture") && viewerSrc.includes("alphaMap") && viewerSrc.includes("arc("), "Base points use a circular sprite, not square GL_POINTS");
assert(viewerSrc.includes("setSelectedStitch") && viewerSrc.includes("_rebuildSelectedOverlay"), "viewer can outline a picked face without rebuilding visibility");
assert(!viewerSrc.includes("setWireframe"), "wireframe is only a Base layer");
assert(!viewerSrc.includes("setFlat") && !viewerSrc.includes("flatShading"), "viewer dropped unused flat shading");
assert.deepEqual(defaultBaseLayers(), hiddenBaseLayers(), "default is Off / hidden");
assert(isBaseHidden(defaultBaseLayers()) && isBaseHidden(hiddenBaseLayers()), "Off hides the cut body");
assert.deepEqual(applyBaseChoice(defaultBaseLayers(), "off", true), hiddenBaseLayers(), "Off stays exclusive");
assert.deepEqual(applyBaseChoice(hiddenBaseLayers(), "off", false), { off: false, wire: false, faces: true, points: false }, "unchecking Off restores Faces");
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
assert(html.includes('id="load-faces-ring0"') && mainSrc.includes("faces-ring0") && mainSrc.includes("isFacesRing0BedChart"), "Open menu can load the faces-ring0 bed chart");
assert(!html.includes('class="actions"'), "Folder / Files / Sample are not a row of top-bar buttons");
assert(mainSrc.includes("setOpenMenu") && mainSrc.includes("open-menu-list"), "main wires the Open dropdown");
assert(html.includes('id="map-pane"') && html.includes('id="map-canvas"'), "right pane is the readable_map canvas");
assert(html.includes('id="map-phys"') && html.includes("物理针"), "map toolbar has a physical-needle toggle");
assert(/id="map-phys"[^>]*aria-pressed="false"/.test(html), "physical-needle toggle starts off");
assert(html.includes('id="pane-switch"') && html.includes('id="pane-map"'), "narrow screens can tab between 3D and Map");
assert(mainSrc.includes("ReadableMapView") && mainSrc.includes("buildReadableMapGrid"), "main mounts the 2D map");
assert(mainSrc.includes("parseExcelReadableMap") && mainSrc.includes("step4-ring0"), "main labels the ring0 sheet in the map header");
assert(mainSrc.includes("parseStitchMapBind") && mainSrc.includes("applyStitchMapBind"), "main loads desktop stitch_map_bind.json");
assert(mainSrc.includes("highlightKeysForStitch") && mainSrc.includes("setPickHighlight") && mainSrc.includes("ensureVisible"), "click lights bound map cells and pans them into view");
assert(mainSrc.includes("onCellPick") && mainSrc.includes("onMapCellPick") && mainSrc.includes("stitchForMapCell"), "map click reverse-selects the bound stitch");
assert(
  mainSrc.includes("stitchForMapCell(hit.row, hit.col, stitchMapBind(), stitches, scene?.readableMap)"),
  "map click passes the sheet so an inserted recenter row is not a bind row",
);
assert(mainSrc.includes("paintStitchPick(stitch)") && mainSrc.includes("isTransferDir") && mainSrc.includes("isFlipDir"), "map knit pick reuses paintStitchPick; X/X+ and Flip do not");
assert(
  mainSrc.includes("showPhysNeedle") && mainSrc.includes("formatPhysicalNeedle") && mainSrc.includes("formatPhysicalNeedles") && mainSrc.includes("#map-phys"),
  "the physical-needle toggle reads recorded bed and phys",
);
assert(!mainSrc.includes("excelMapAsBindMap"), "do not pair Excel cells in generation order");
assert(mainSrc.includes("dataset.mapCells"), "chip records the bound map cell keys for the pick");
assert(mainSrc.includes("paintStitchPick") && mainSrc.includes("pickedStitch"), "map pick highlight follows the stitch chip");
assert(mainSrc.includes("narrow-split") && mainSrc.includes("max-width: 719px"), "wide layout splits; phone uses a pane toggle");
const mapViewSrc = readFileSync(join(root, "src", "map-view.js"), "utf8");
assert(mapViewSrc.includes("pickHighlight") && mapViewSrc.includes("ensureVisible") && mapViewSrc.includes("panToKeepRectVisible"), "map view can outline a pick and ensureVisible");
assert(mapViewSrc.includes("hitTest") && mapViewSrc.includes("onCellPick") && mapViewSrc.includes("MAP_CLICK_SLOP"), "map view hit-tests cells and ignores pan/pinch");
assert(mapViewSrc.includes("isTransferDir"), "Excel view marks X/X+ rows as transfer / not stitch");
assert(mapViewSrc.includes("setShowPhysicalNeedles") && mapViewSrc.includes("physicalNeedleGlyph"), "physical mode replaces the cell symbol");
assert(mainSrc.includes("setShowPhysicalNeedles(showPhysNeedle)"), "the toolbar toggle redraws cells as bed plus physical needle");
const readableSrc = readFileSync(join(root, "src", "readable-map.js"), "utf8");
assert(readableSrc.includes("mapCellsForStitch"), "Excel pick uses stitch_map_bind cells");
assert(readableSrc.includes("stitchForMapCell") && readableSrc.includes("highlightKeysForMapCell"), "reverse lookup expands multi-cell terms");
assert(!readableSrc.includes("every occupied cell in that needle column"), "column-wide Excel fallback is gone");

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
assert(css.includes(".split") && css.includes(".map-pane") && css.includes("narrow-split"), "layout is a left-right split with a narrow fallback");
assert(css.includes(".stitch-pick") && css.includes(".hud-chips"), "stitch readout is a HUD chip under the mesh label");
assert(css.includes("#map-phys") && css.includes('.map-zoom .fit[aria-pressed="true"]'), "physical-needle toggle has a pressed state");

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

{
  const ring0 = parseExcelReadableMap(readFileSync(join(cylDir, "iteration_0_cut_readable_map_step4_ring0.xls")));
  const built = buildFromFiles();
  const step3 = parseExcelReadableMap(readFileSync(join(cylDir, "iteration_0_cut_readable_map_step3_xfer.xls")));
  assert(ring0.sheet === "step4-ring0" && ring0.rows.length === 160, `step4 sheet is 160 rows, got ${ring0.sheet} ${ring0.rows.length}`);
  assert(ring0.rows.length === step3.rows.length + 39, "sheet adds one ring-0 align row and 38 settle rows after the increase keeps F−1");
  assert(ring0.colMin === -5 && ring0.colMax === 37 && ring0.needleCols.length === 43, "ring0 needles are −5…37");
  assert(built.ring.N === 38 && built.ring.front === 19 && built.ring.back === 19, "ring 0 ends F19 B19");
  assert(built.ring.front - built.ring.back === 0, "finished circle stays inside F−B ∈ {0,1}");
  assert(built.ring.frontEnd === 18 && built.ring.backStart === 18 && built.ring.foldBoth18, "after the rack both beds end on physical 18");
  assert(built.ring.frontPhys[0] === 0 && built.ring.backPhys[0] === 0 && built.ring.backPhys.at(-1) === 18, "ring 0 ends with both windows on 0…18");
  assert(built.ring.baseN === 37 && built.ring.baseFront === 19 && built.ring.baseBack === 18, "stripped circumference is F19 B18");
  assert(built.ring.recenterAfter == null, "ring 0 does not insert a recenter row");
  assert(built.rows.length === ring0.rows.length, "builder row count matches the sheet");
  for (let i = 0; i < ring0.rows.length; i++) {
    const sheetTokens = ring0.rows[i].cells.map((c) => `${c.col}:${c.token}`).join("|");
    const builtTokens = built.rows[i].cells.map((c) => `${c.col}:${c.token}`).join("|");
    assert(ring0.rows[i].dir === built.rows[i].dir && sheetTokens === builtTokens, `sheet row ${i} matches the physical-column builder`);
  }
  const bPlain = ring0.rows.flatMap((r) => r.cells).find((c) => c.token === "B·");
  assert(bPlain && bPlain.fill === "rgb(204,255,255)", "back plain is turquoise from the XF, not a legend fallback");
  const path1 = built.step3ToSheet[built.span.rowEnd];
  assert(path1 === 7 && ring0.rows[path1].dir === step3.rows[built.span.rowEnd].dir, "path 1 starts on sheet row 7");
  {
    const tokenAtPath1 = (col) => ring0.rows[path1].cells.find((c) => c.col === col)?.token || "";
    assert(
      [0, 1, 2, 3, 4, 5, 6].map(tokenAtPath1).join(",") === "F·,F·,F·,F·,F·,F-R1,F·",
      "ring 1's first knit is the inherited needles F0…F6, with no extra stitch",
    );
    assert(tokenAtPath1(7) === "", "the opening short row does not fill column 7");
    assert(
      [0, 1, 2, 3, 4, 5, 6]
        .map((col) => physicalNeedleGlyph(ring0.rows[path1].cells.find((c) => c.col === col)))
        .join(",") === "F0,F1,F2,F3,F4,F5,F6",
      "the opening row starts at physical needle 0",
    );
  }
  assert(!ring0.rows.slice(0, path1).some((r) => r.dir === "Flip"), "Flip is not inside ring 0");
  const flipRows = ring0.rows.map((row, index) => (row.dir === "Flip" ? index : -1)).filter((index) => index >= 0);
  assert(
    flipRows.join(",") === "9,15,43,49,54,61,70,86,93,99,106,112,119,126",
    `flip rows follow the kept F−1 settle, got ${flipRows}`,
  );
  const bedMoves = ring0.rows.flatMap((r) => r.cells.map((c) => c.token)).filter((token) => /^[FB][←→]/.test(token));
  assert(bedMoves.includes("F→") && bedMoves.includes("F←") && bedMoves.includes("B→") && bedMoves.includes("B←"), "ring0 sheet uses the 1-stitch arrows this sample moves");
  assert(
    bedMoves.every((token) => {
      const m = token.match(/^[FB][←→](\d+)?$/);
      return m && (!m[1] || Number(m[1]) >= 2);
    }),
    "ring0 moves of 1 stitch omit R/L and the number",
  );
  const tokenAt = (row, col) => ring0.rows[row].cells.find((c) => c.col === col)?.token;
  const ring2Sheet = built.step3ToSheet[built.ring1Span.end];
  const trackedSheet = built.step3ToSheet[built.lockedCourseEnd];
  assert(ring2Sheet === 33, `ring 2 still starts at sheet row 33, got ${ring2Sheet}`);
  assert(built.step3ToSheet[44] === 57, `step3 row 44 stays at sheet row 57, got ${built.step3ToSheet[44]}`);
  assert(trackedSheet === 129, `step3 row 90 stays raw at sheet row 129, got ${trackedSheet}`);
  assert(built.phys.length > 0 && built.phys.every((entry) => entry.sheetRow < trackedSheet), "phys sheet stops before the unmatched decrease");
  for (let sheetRow = 0; sheetRow < built.rows.length; sheetRow++) {
    for (const src of built.rows[sheetRow].cells) {
      const got = ring0.rows[sheetRow].cells.find((cell) => cell.col === src.col);
      const tracked = src.token && sheetRow < trackedSheet;
      if (tracked) {
        assert(
          got.bed === src.bed && got.phys === src.phys && (got.bed === "F" || got.bed === "B") && Number.isInteger(got.phys),
          `phys sheet keeps row ${sheetRow} col ${src.col} ${src.bed}${src.phys}`,
        );
      } else {
        assert(got.bed == null && got.phys == null, `row ${sheetRow} col ${src.col} has no invented physical needle`);
      }
    }
  }
  const physAt = (row, col) => ring0.rows[row].cells.find((cell) => cell.col === col);
  assert(physAt(0, 18).bed === "F" && physAt(0, 18).phys === 18, "cast-on front column 18 is physical 18");
  assert(physAt(0, 19).bed === "B" && physAt(0, 19).phys === 18, "cast-on back column 19 is physical 18");
  assert(physAt(1, 19).bed === "B" && physAt(1, 19).phys === 18, "B→ records the source physical needle 18");
  assert(physAt(2, 18).bed === "B" && physAt(2, 18).phys === 19, "the moved stitch is physical 19 at sheet column 18");
  assert(physAt(2, 20).bed === "B" && physAt(2, 20).phys === 17 && physAt(2, 20).col === 20, "sheet column 20 is physical 17");
  assert(formatPhysicalNeedle(physAt(2, 18)).title === "后床 B" && formatPhysicalNeedle(physAt(2, 18)).detail === "物理针 19", "readout says back bed and physical 19");
  assert(formatPhysicalNeedle(physAt(0, 18)).title === "前床 F" && formatPhysicalNeedle(physAt(0, 18)).detail === "物理针 18", "readout says front bed and physical 18");
  assert(formatPhysicalNeedle(physAt(2, 20)).detail === "物理针 17", "readout does not substitute the sheet column");
  assert(physicalNeedleGlyph(physAt(2, 20)) === "B17" && physicalNeedleGlyph(physAt(2, 18)) === "B19", "cell text is bed plus physical needle, not the sheet column");
  assert(physicalNeedleGlyph(physAt(1, 19)) === "B18" && physicalNeedleGlyph(physAt(0, 18)) === "F18", "transfer and front knit cells use the recorded needle");
  assert(!/[←→+v^·]/.test([physAt(2, 18), physAt(2, 19), physAt(2, 20), physAt(1, 19)].map(physicalNeedleGlyph).join("")), "physical mode does not keep shaping symbols");
  assert(physicalNeedleGlyph(physAt(0, 37)) === "", "an empty cell stays blank");
  assert(physicalNeedleGlyph({ col: 17, token: "B·" }) === "—", "a bed glyph without recorded phys is not turned into a needle");
  const ring2Cell = ring0.rows[ring2Sheet].cells.find((cell) => cell.col === 0);
  assert(
    ring2Cell && physicalNeedleGlyph(ring2Cell) === "F0" && formatPhysicalNeedle(ring2Cell).detail === "物理针 0",
    "ring 2's first knit is the inherited F0",
  );
  assert(physicalNeedleGlyph(physAt(ring2Sheet, 1)) === "F1", "the next stitch on that short course is F1");
  const rawLater = ring0.rows[trackedSheet].cells.find((cell) => cell.token);
  assert(rawLater && formatPhysicalNeedle(rawLater).title === "无物理针" && physicalNeedleGlyph(rawLater) === "—", "step3 row 90 has no tracked physical needle");
  assert(formatPhysicalNeedle(physAt(0, 37)).title === "无物理针", "an empty cell does not invent a needle");
  assert(formatPhysicalNeedle({ col: 20, token: "B+R1", bed: "B" }).title === "无物理针", "a bed glyph without a recorded phys is not a needle");
  assert(formatPhysicalNeedle({ col: 17, token: "·" }).title === "无物理针", "the sheet column is not reported as a physical needle");
  const moved = formatPhysicalNeedles([
    { row: 1, col: 19, bed: "B", phys: 18 },
    { row: 2, col: 18, bed: "B", phys: 19 },
  ]);
  assert(moved.title === "物理针" && moved.detail.includes("行 1 列 19 后床 B 物理针 18") && moved.detail.includes("行 2 列 18 后床 B 物理针 19"), "a stitch that moved lists each recorded needle");
  assert(formatPhysicalNeedles([]).title === "无物理针" && formatPhysicalNeedles([{ row: 30, col: 0, token: "·" }]).title === "无物理针", "no records stay 无物理针");
  assert(formatPhysicalNeedles([{ row: 0, col: 0, bed: "F", phys: 0 }, { row: 4, col: 0, bed: "F", phys: 0 }]).detail === "物理针 0", "identical needles collapse to one readout");
  assert(step3.rows[2].cells.every((cell) => cell.bed == null && cell.phys == null), "step3 has no physical-needle sheet");
  assert(ring0.legend.some((row) => row.key === "phys" && /表列号不是物理针号/.test(row.note)), "legend says the column is not the physical needle");
  assert(tokenAt(0, 18) === "F·" && tokenAt(0, 19) === "B·" && tokenAt(0, 20) === "BvR" && tokenAt(0, 21) === "" && tokenAt(0, 37) === "", "cast-on packs the fold and does not reserve column 37");
  assert(tokenAt(1, 19) === "B→" && ring0.rows[1].cells.filter((c) => c.token).length === 1, "the increase is still one back B→ on column 19");
  assert(ring0.rows[1].cells.find((c) => c.token === "B→").fill === "rgb(204,204,255)", "shaping transfer fill is ice blue");
  assert(tokenAt(2, 18) === "BvL" && tokenAt(2, 19) === "B^R" && tokenAt(2, 20) === "B+R1" && tokenAt(2, 21) === "" && tokenAt(2, 37) === "", "the knit after B→ starts at column 20 and goes left: vL, ^R, +R1");
  assert(tokenAt(3, 18) === "B←" && tokenAt(3, 19) === "B←" && tokenAt(3, 20) === "B←" && tokenAt(3, 21) === "" && ring0.rows[3].cells.filter((c) => c.token).length === 3, "the align row racks the three back stitches one needle");
  assert(physAt(3, 18).phys === 19 && physAt(3, 19).phys === 18 && physAt(3, 20).phys === 17, "the rack records the source physical needles");
  assert(physicalNeedleGlyph(physAt(3, 18)) === "B19" && physicalNeedleGlyph(physAt(3, 20)) === "B17", "physical mode shows the source needle, not the arrow");
  assert(tokenAt(4, 19) === "B^L" && tokenAt(4, 20) === "B·" && tokenAt(4, 21) === "B·" && tokenAt(4, 22) === "B·" && tokenAt(4, 23) === "BvR" && tokenAt(4, 18) === "", "the next knit uses the aligned needles");
  assert(physAt(4, 19).phys === 18 && physAt(4, 23).phys === 14 && physicalNeedleGlyph(physAt(4, 19)) === "B18", "after the rack the same stitch is physical 18");
  assert(tokenAt(6, 36) === "B·" && tokenAt(6, 37) === "B·" && physAt(6, 37).phys === 0 && physAt(6, 36).phys === 1, "the back tail lands on physical 0 at column 37");
  assert(built.ring.anchors.castOnFold.phys === 18 && built.ring.anchors.s.phys === 19 && built.ring.anchors.v.phys === 17, "B→ moves physical 18 to 19 and leaves physical 17");
  assert(built.ring.anchors.br.phys === 18 && built.ring.anchors.caret.phys === 18 && built.ring.anchors.v3.phys === 16 && built.ring.anchors.fresh.phys === 15, "after the rack the next row is one needle toward the front window");
  assert(ring0.legend.some((row) => /去掉加减针后的整圈/.test(`${row.key} ${row.note}`)), "legend says ring 0 splits the stripped circumference");
  assert(ring0.legend.some((row) => /左衔接/.test(`${row.key} ${row.note}`)), "legend still withholds the spare until the left junction is reached");
  assert(ring0.legend.some((row) => /物理 17/.test(`${row.key} ${row.note}`)), "legend maps the unmoved back needle to sheet column 20");
  assert(!ring0.legend.some((row) => /空针在后床末尾|后床末尾空针/.test(`${row.key} ${row.note}`)), "legend no longer calls column 37 the spare the increase enters");
  assert(ring0.legend.some((row) => /没织上的是短行起针/.test(`${row.key} ${row.note}`)), "legend notes that partial cast-on is not a flip");
  assert(ring0.legend.some((row) => /错开一针/.test(`${row.key} ${row.note}`)), "legend racks a one-needle window offset instead of flipping");
  assert(ring0.legend.some((row) => /第一针是 F0/.test(`${row.key} ${row.note}`)), "legend says ring 1 inherits front needle 0");
  assert(ring0.legend.some((row) => /空针留在右折返/.test(`${row.key} ${row.note}`) && /整段 B→ 到 1…18/.test(`${row.key} ${row.note}`)), "legend moves a right-fold empty onto the left junction");
  assert(ring0.legend.some((row) => /不再把织行往左偏一格/.test(`${row.key} ${row.note}`)), "legend drops the ring-1 knit column offset");
  assert(stitchBind.n_display_rows === 121 && stitchBind.byIndex.get(20)?.cells[0].label === "vR", "stitch_map_bind.json is still the step3 dump");
  assert(recenterInsertIndex(excelMap, stitchBind) == null, "step3 sheet stays identity-mapped to bind rows");
  assert(recenterInsertIndex(ring0, stitchBind) == null, "several inserted rows are mapped by the cellmap sheet");
  assert(ring0.bindToSheet?.size > 0 && ring0.cellMap?.size === ring0.bindToSheet.size, "cellmap round-trips bind and sheet cells");
  assert(sheetRowForBindRow(3, 3) === 4 && bindRowForSheetRow(3, 3) == null && bindRowForSheetRow(4, 3) === 3, "bind row 3 is sheet row 4; the insert itself is not a bind row");
  const ringGrid = buildReadableMapGrid(ring0, bound.stitches);
  const gridPhys = ringGrid.grid[2][18 - ring0.colMin];
  assert(gridPhys.bed === "B" && gridPhys.phys === 19, "the map grid keeps the recorded physical needle");
  const ringKeys = highlightKeysForStitch(bound.stitches[20], { map: ring0, grid: ringGrid, bind: stitchBind });
  assert(ringKeys.size === 1 && ringKeys.has("0,20"), "face 20 lights the cast-on vR on physical column 20");
  const row3Stitch = bound.stitches.find((s) => s.mapCells?.some((c) => c.display_row === 3 && c.col === 18));
  assert(row3Stitch, "bind still has a face on display_row 3 col 18");
  const row3Keys = highlightKeysForStitch(row3Stitch, { map: ring0, grid: ringGrid, bind: stitchBind });
  assert(row3Keys.has("4,19") && !row3Keys.has("4,18") && !row3Keys.has("3,18"), "row 3 ^L is the moved stitch at column 19 after the rack");
  const step3Row3 = highlightKeysForStitch(row3Stitch, { map: excelMap, grid: excelGrid, bind: stitchBind });
  assert(step3Row3.has("3,18") && !step3Row3.has("3,19"), "step3 highlight of that face stays on bind row 3");
  assert(stitchForMapCell(1, 19, stitchBind, bound.stitches, ring0) == null, "clicking the increase transfer selects no face");
  assert(stitchForMapCell(3, 18, stitchBind, bound.stitches, ring0) == null, "clicking the whole-bed rack selects no face");
  assert(stitchForMapCell(4, 19, stitchBind, bound.stitches, ring0) === row3Stitch, "sheet row 4 col 19 selects the bind row 3 face");
  assert(stitchForMapCell(4, 20, stitchBind, bound.stitches, ring0) !== row3Stitch, "sheet row 4 col 20 is the next stitch, not the ^L");
  assert(stitchForMapCell(4, 37, stitchBind, bound.stitches, ring0) == null, "sheet row 4 col 37 is empty");
  assert(
    highlightKeysForMapCell(4, 19, { map: ring0, grid: ringGrid, bind: stitchBind }).has("4,19"),
    "clicking the ^L cell highlights that sheet cell",
  );
  const row6Stitch = bound.stitches.find((s) => s.mapCells?.some((c) => c.display_row === 6));
  const row6Col = row6Stitch.mapCells.find((c) => c.display_row === 6).col;
  const row6Map = ring0.bindToSheet.get(`${6},${row6Col}`);
  const row6Keys = highlightKeysForStitch(row6Stitch, { map: ring0, grid: ringGrid, bind: stitchBind });
  assert(row6Col === 0 && row6Map.sheetRow === 7 && row6Map.sheetCol === 0, "step3 column 0 on the opening row is inherited F0");
  assert(row6Keys.has("7,0") && !row6Keys.has("7,1") && !row6Keys.has("7,2"), "bind row 6 column 0 highlights sheet column 0");
  assert(stitchForMapCell(7, row6Map.sheetCol, stitchBind, bound.stitches, ring0) === row6Stitch, "clicking sheet row 7 maps back to bind row 6");
  assert(stitchForMapCell(9, 19, stitchBind, bound.stitches, ring0) == null, "the first ring-1 flip row selects no face");
  assert(stitchForMapCell(10, 37, stitchBind, bound.stitches, ring0) == null, "the whole-bed move after the first flip selects no face");
  assert(stitchForMapCell(15, 19, stitchBind, bound.stitches, ring0) == null, "the second ring-1 flip row selects no face");
  assert(stitchForMapCell(16, 18, stitchBind, bound.stitches, ring0) == null, "the whole-bed move after the second flip selects no face");
  const row8Moves = ring0.rows[8].cells.filter((c) => c.token);
  assert(
    row8Moves.every((c) => c.token === "F←") && row8Moves.map((c) => c.col).join(",") === [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].join(","),
    "sheet row 8 shifts the front bed from the decrease anchor, columns 6..18",
  );
  assert(tokenAt(8, 6) === "F←" && tokenAt(8, 5) === "" && tokenAt(8, 19) === "", "sheet row 8 draws the anchor and not the back bed");
  const row13Moves = ring0.rows[13].cells.filter((c) => c.token);
  assert(
    row13Moves.every((c) => c.token === "F→") && row13Moves.length === 17 && row13Moves[0].col === 2 && row13Moves.at(-1).col === 18,
    "sheet row 13 shifts only the front segment of the increase",
  );
  assert(tokenAt(13, 19) === "", "the increase transfer does not draw a back-bed move");
  assert(tokenAt(21, 20) === "" && tokenAt(21, 21) === "B→" && tokenAt(21, 37) === "B→", "the back decrease also starts at the anchor's physical column");
  assert(tokenAt(9, 19) === "⬇" && tokenAt(9, 18) === "" && tokenAt(15, 19) === "⬆" && tokenAt(15, 18) === "", "flips are drawn on the pre-flip physical column");
  const leftFoldRack = ring0.rows[10].cells.filter((c) => c.token);
  assert(
    leftFoldRack.length === 18 &&
      leftFoldRack.every((c) => c.token === "B→" && c.fill === "rgb(204,204,255)") &&
      leftFoldRack[0].col === 20 &&
      leftFoldRack.at(-1).col === 37 &&
      physAt(10, 37).phys === 0 &&
      physAt(10, 20).phys === 17,
    "sheet row 10 racks the back bed off the right-fold empty, B→ on source needles 0…17",
  );
  assert(tokenAt(12, 37) === "" && physAt(12, 36).bed === "B" && physAt(12, 36).phys === 1, "the next full knit leaves back physical 0 empty at the left fold");
  assert(
    tokenAt(14, 18) === "F·" &&
      tokenAt(14, 19) === "FvR" &&
      tokenAt(14, 20) === "" &&
      physicalNeedleGlyph(physAt(14, 19)) === "F19" &&
      physAt(14, 19).phys === 19 &&
      physAt(14, 19).bed === "F" &&
      !ring0.rows[14].cells.some((cell) => cell.bed === "B" && cell.phys === 18) &&
      tokenAt(15, 19) === "⬆" &&
      physicalNeedleGlyph(physAt(15, 19)) === "F19",
    "the short course after the increase ends at F19 and does not draw the facing B18",
  );
  assert(
    tokenAt(17, 16) === "FvL" &&
      tokenAt(17, 17) === "F·" &&
      tokenAt(17, 18) === "F·" &&
      tokenAt(17, 19) === "B^R" &&
      tokenAt(17, 20) === "" &&
      physicalNeedleGlyph(physAt(17, 19)) === "B18" &&
      physAt(17, 19).bed === "B" &&
      physAt(17, 19).phys === 18 &&
      physicalNeedleGlyph(physAt(17, 18)) === "F18" &&
      tokenAt(18, 18) === "F·" &&
      tokenAt(18, 19) === "BvR" &&
      physicalNeedleGlyph(physAt(18, 19)) === "B18" &&
      tokenAt(19, 18) === "F·" &&
      tokenAt(19, 19) === "B^R" &&
      physicalNeedleGlyph(physAt(19, 19)) === "B18" &&
      tokenAt(20, 17) === "F·" &&
      tokenAt(20, 18) === "F·" &&
      tokenAt(20, 19) === "B·" &&
      tokenAt(20, 20) === "B-R1" &&
      tokenAt(20, 21) === "B·" &&
      physicalNeedleGlyph(physAt(20, 18)) === "F18" &&
      physicalNeedleGlyph(physAt(20, 19)) === "B18" &&
      physicalNeedleGlyph(physAt(20, 20)) === "B17",
    "after the flip and rack, knit courses stay on course columns: 17L is B18 then F18, and the longer course continues F18, B18, B17 with no empty column",
  );
  const turn24 = built.step3ToSheet[19];
  const turn25 = built.step3ToSheet[20];
  const turn26 = built.step3ToSheet[21];
  const turn27 = built.step3ToSheet[22];
  assert(turn24 === 24 && turn25 === 25 && turn26 === 26 && turn27 === 27, "short-row turns stay on sheet rows 24…27");
  assert(
    physicalNeedleGlyph(physAt(11, 6)) === "F6" && physicalNeedleGlyph(physAt(11, 14)) === "F14",
    "the front decrease remainder stays on F6 and runs through F14",
  );
  assert(
    built.step3ToSheet[17] === 22 &&
      tokenAt(22, 21) === "BvR" &&
      physicalNeedleGlyph(physAt(22, 21)) === "B16",
    "the back decrease remainder stays on B16, the needle the split course ended on",
  );
  assert(
    built.lockedCourseEnd === 90 &&
      trackedSheet === 129 &&
      built.step3ToSheet[69] === 91 &&
      built.step3ToSheet[70] === 95 &&
      built.step3ToSheet[71] === 96 &&
      built.step3ToSheet[72] === 97 &&
      built.step3ToSheet[64] === 84 &&
      built.step3ToSheet[66] === 88 &&
      built.step3ToSheet[73] === 98 &&
      tokenAt(84, 24) === "B·" &&
      physicalNeedleGlyph(physAt(84, 24)) === "B8" &&
      tokenAt(88, 22) === "B·" &&
      physicalNeedleGlyph(physAt(88, 22)) === "B9" &&
      built.step3ToSheet[74] === 101 &&
      tokenAt(91, 0) === "F→" &&
      physicalNeedleGlyph(physAt(91, 0)) === "F0" &&
      physicalNeedleGlyph(physAt(91, 10)) === "F10" &&
      !tokenAt(91, 11) &&
      tokenAt(92, 1) === "F←" &&
      physicalNeedleGlyph(physAt(92, 1)) === "F1" &&
      physicalNeedleGlyph(physAt(92, 14)) === "F14" &&
      tokenAt(93, 23) === "⬇" &&
      physicalNeedleGlyph(physAt(93, 23)) === "B14" &&
      ring0.rows[91].beds === "F0…F14 / B0…B14" &&
      ring0.rows[92].beds === "F1…F14 / B0…B14" &&
      ring0.rows[95].beds === "F0…F14 / B1…B14" &&
      tokenAt(95, 9) === "FvL" &&
      physicalNeedleGlyph(physAt(95, 9)) === "F7" &&
      tokenAt(95, 11) === "F·" &&
      physicalNeedleGlyph(physAt(95, 11)) === "F9" &&
      tokenAt(96, 11) === "F→" &&
      physicalNeedleGlyph(physAt(96, 11)) === "F11" &&
      physicalNeedleGlyph(physAt(96, 14)) === "F14" &&
      tokenAt(96, 0) === "" &&
      ring0.rows[96].beds === "F0…F14 / B1…B14" &&
      tokenAt(97, 12) === "F→" &&
      physicalNeedleGlyph(physAt(97, 12)) === "F12" &&
      physicalNeedleGlyph(physAt(97, 15)) === "F15" &&
      ring0.rows[97].beds === "F0…F10,F12…F15 / B1…B14" &&
      tokenAt(98, 9) === "F^L" &&
      physicalNeedleGlyph(physAt(98, 9)) === "F7" &&
      tokenAt(98, 10) === "F+R2" &&
      physicalNeedleGlyph(physAt(98, 10)) === "F10" &&
      tokenAt(98, 12) === "FvR" &&
      physicalNeedleGlyph(physAt(98, 12)) === "F12" &&
      ring0.rows[98].beds === "F0…F10,F13…F16 / B1…B14" &&
      tokenAt(99, 16) === "⬆" &&
      physicalNeedleGlyph(physAt(99, 16)) === "F16" &&
      ring0.rows[99].beds === "F0…F16 / B1…B14" &&
      tokenAt(100, 21) === "B←" &&
      physicalNeedleGlyph(physAt(100, 21)) === "B16" &&
      ring0.rows[100].cells.filter((cell) => cell.token).length === 1 &&
      ring0.rows[100].beds === "F0…F15 / B1…B14,B16" &&
      tokenAt(101, 10) === "FvL" &&
      physicalNeedleGlyph(physAt(101, 10)) === "F10" &&
      physicalNeedleGlyph(physAt(101, 12)) === "F12" &&
      ring0.rows[101].beds === "F0…F15 / B1…B15" &&
      built.step3ToSheet[75] === 102 &&
      built.step3ToSheet[87] === 123 &&
      built.step3ToSheet[88] === 124 &&
      built.step3ToSheet[89] === 128 &&
      built.step3ToSheet[90] === 129 &&
      tokenAt(102, 17) === "B-R2" &&
      physicalNeedleGlyph(physAt(102, 17)) === "B14" &&
      tokenAt(123, 23) === "B-R1" &&
      physicalNeedleGlyph(physAt(123, 23)) === "B2" &&
      tokenAt(123, 24) === "B·" &&
      physicalNeedleGlyph(physAt(123, 24)) === "B1" &&
      ring0.rows[123].beds === "F0…F12 / B1…B12" &&
      tokenAt(124, 36) === "B→" &&
      physicalNeedleGlyph(physAt(124, 36)) === "B1" &&
      tokenAt(124, 37) === "" &&
      ring0.rows[124].beds === "F0…F12 / B1…B12" &&
      tokenAt(128, 24) === "B-R1" &&
      physicalNeedleGlyph(physAt(128, 24)) === "B0" &&
      ring0.rows[128].beds === "F0…F11 / B0…B11" &&
      ring0.rows[129].beds === "F0…F11 / B0…B11" &&
      ring0.rows[130].beds === "",
    "tracking keeps F−1 through the seat, starts sheet 95 at F9 and sheet 98 at F7, and sheet 129 records F0…F11 / B0…B11",
  );
  assert(
    tokenAt(23, 21) === "B^R" &&
      tokenAt(23, 20) === "BvL" &&
      physicalNeedleGlyph(physAt(23, 21)) === "B16" &&
      physicalNeedleGlyph(physAt(23, 20)) === "B17",
    "23L starts on B16 and ends on B17",
  );
  assert(
    tokenAt(turn24, 20) === "B^L" &&
      tokenAt(turn24, 21) === "BvR" &&
      physicalNeedleGlyph(physAt(turn24, 20)) === "B17" &&
      physicalNeedleGlyph(physAt(turn24, 21)) === "B16" &&
      [21, 20, 19, 18].map((col) => physicalNeedleGlyph(physAt(turn25, col))).join(",") === "B16,B17,B18,F18",
    "24R is B17 then B16, and 25L is B16, B17, B18, F18",
  );
  assert(
    tokenAt(turn26, 18) === "F^L" &&
      tokenAt(turn26, 25) === "BvR" &&
      [18, 19, 20, 21, 22, 23, 24, 25].map((col) => physicalNeedleGlyph(physAt(turn26, col))).join(",") ===
        "F18,B18,B17,B16,B15,B14,B13,B12" &&
      [25, 24, 23, 22].map((col) => physicalNeedleGlyph(physAt(turn27, col))).join(",") === "B12,B13,B14,B15" &&
      [32, 31].map((col) => physicalNeedleGlyph(physAt(31, col))).join(",") === "B5,B6" &&
      [31, 32, 33, 34, 35, 36].map((col) => physicalNeedleGlyph(physAt(32, col))).join(",") === "B6,B5,B4,B3,B2,B1",
    "26R starts on F18 and ends on B12, 27L is B12 through B15, 31L is B5 then B6, and 32R is B6 through B1",
  );
  const laterR = built.step3ToSheet[32];
  const laterL = built.step3ToSheet[33];
  const laterNext = built.step3ToSheet[34];
  assert(laterR === 37 && laterL === 38 && laterNext === 39, "the third-circle turn stays on sheet rows 37…39");
  assert(
    tokenAt(laterR, 31) === "BvR" &&
      physicalNeedleGlyph(physAt(laterR, 31)) === "B6" &&
      tokenAt(laterL, 31) === "B^R" &&
      tokenAt(laterL, 20) === "BvL" &&
      [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20]
        .map((col) => physicalNeedleGlyph(physAt(laterL, col)))
        .join(",") === "B6,B7,B8,B9,B10,B11,B12,B13,B14,B15,B16,B17" &&
      tokenAt(laterNext, 20) === "B^L" &&
      tokenAt(laterNext, 21) === "B·" &&
      tokenAt(laterNext, 22) === "BvR" &&
      [20, 21, 22].map((col) => physicalNeedleGlyph(physAt(laterNext, col))).join(",") === "B17,B16,B15",
    "37R ends on B6 and 38L rises on that needle through B17; the next course starts on B17",
  );
  assert(physicalNeedleGlyph(physAt(12, 0)) === "F0" && physAt(12, 0).bed === "F" && physAt(12, 0).phys === 0, "the front bed's first needle is F0 at column 0");
  assert(physicalNeedleGlyph(physAt(7, 0)) === "F0" && physicalNeedleGlyph(physAt(7, 1)) === "F1", "the opening row starts at F0 and the next stitch stays F1");
  const frontZero = ring0.bindToSheet.get("9,0");
  assert(frontZero && frontZero.sheetRow === 12 && frontZero.sheetCol === 0, "step3 row 9 col 0 is the inherited front needle 0");
  const row9Wrap = ring0.bindToSheet.get("9,-1");
  assert(row9Wrap && row9Wrap.sheetRow === 12 && row9Wrap.sheetCol === 36, "step3 row 9 col −1 wraps onto the first occupied back needle");
  const frontZeroStitch = stitchForMapCell(12, 0, stitchBind, bound.stitches, ring0);
  const row9WrapStitch = stitchForMapCell(12, 36, stitchBind, bound.stitches, ring0);
  assert(row9WrapStitch?.index === 76, "clicking the wrap selects the stitch that step3 addresses as column −1");
  assert(frontZeroStitch && frontZeroStitch !== row9WrapStitch, "F0 is the stitch at step3 column 0, not the wrapped column");
  const frontZeroKeys = highlightKeysForStitch(frontZeroStitch, { map: ring0, grid: ringGrid, bind: stitchBind });
  assert(frontZeroKeys.has("12,0") && frontZeroKeys.has("12,36"), "the left fold links F0 to the first back stitch, with physical 0 empty");
  const ring2 = ring0.bindToSheet.get("28,0");
  assert(ring2 && ring2.sheetRow === 33 && ring2.sheetCol === 0, "ring 2's first knit stays on sheet row 33 column 0");
  const ring1End = built.ring1.trace.find((item) => item.label === "step3 行 27 R");
  assert(
    ring1End &&
      ring1End.N === 37 &&
      ring1End.F === 19 &&
      ring1End.B === 18 &&
      ring1End.fPhys[0] === 0 &&
      ring1End.fPhys.at(-1) === 18 &&
      ring1End.bPhys[0] === 1 &&
      ring1End.bPhys.at(-1) === 18,
    "after sheet 32 the beds are F0…F18 / B1…B18",
  );
  assert(
    tokenAt(37, 17) === "F^L" &&
      tokenAt(37, 18) === "F·" &&
      tokenAt(37, 19) === "B·" &&
      physicalNeedleGlyph(physAt(37, 17)) === "F17" &&
      physicalNeedleGlyph(physAt(37, 18)) === "F18" &&
      physicalNeedleGlyph(physAt(37, 19)) === "B18" &&
      tokenAt(37, 20) === "B·",
    "ring 2's longer course continues F17, F18, B18 with no empty column",
  );
  assert(
    [0, 1, 2, 3, 4, 5].map((col) => tokenAt(40, col)).join(",") === "F←,F←,F←,F←,F←,F←" &&
      [0, 1, 2, 3, 4, 5].map((col) => physicalNeedleGlyph(physAt(40, col))).join(",") === "F0,F1,F2,F3,F4,F5",
    "the ring 2 increase transfer is F← on F0…F5",
  );
  assert(tokenAt(40, -1) === "", "unresolved negative columns are not drawn on that increase transfer");
  assert(
    built.step3ToSheet[36] === 41 &&
      ring0.rows[41].beds === "F-1…F4,F6…F18 / B1…B18" &&
      ring0.rows[42].dir === "X" &&
      ring0.rows[42].beds === "F-1…F18 / B1…B18" &&
      tokenAt(42, -1) === "F→" &&
      physicalNeedleGlyph(physAt(42, -1)) === "F-1" &&
      ring0.rows[43].dir === "Flip" &&
      tokenAt(43, 19) === "⬆" &&
      physicalNeedleGlyph(physAt(43, 19)) === "F19" &&
      ring0.rows[45].dir === "R" &&
      ring0.rows[45].beds === "F0…F18 / B0…B18" &&
      tokenAt(45, 4) === "F^L" &&
      physicalNeedleGlyph(physAt(45, 4)) === "F5" &&
      ring0.rows.slice(16, 42).every((row) => row.dir !== "Flip"),
    "the increase keeps F−1, the knit fills F5, and the balance seats that stitch on F0",
  );
  assert(built.step3ToSheet[40] === 48 && built.step3ToSheet[41] === 51, "the front decrease and the following knit stay on sheets 48 and 51");
  assert(
    [13, 14, 15, 16, 17, 18].map((col) => `${tokenAt(48, col)}/${physicalNeedleGlyph(physAt(48, col))}`).join(",") ===
      "F←/F13,F←/F14,F←/F15,F←/F16,F←/F17,F←/F18",
    "step3 row 40 shifts the front bed back from F13 through F18",
  );
  const backRealign = ring0.rows[50].cells.filter((cell) => cell.token);
  assert(
    ring0.rows[49].dir === "Flip" &&
      tokenAt(49, 19) === "⬇" &&
      physicalNeedleGlyph(physAt(49, 19)) === "B18" &&
      ring0.rows[50].dir === "X" &&
      backRealign.length === 18 &&
      backRealign.every((cell) => cell.token === "B→" && cell.bed === "B") &&
      physicalNeedleGlyph(physAt(50, 37)) === "B0" &&
      physicalNeedleGlyph(physAt(50, 20)) === "B17",
    "after the front decrease the back bed flips B18 onto F18 and then racks onto 1…18",
  );
  assert(
    ring0.rows[41].beds === "F-1…F4,F6…F18 / B1…B18" &&
      ring0.rows[45].beds === "F0…F18 / B0…B18" &&
      ring0.rows[48].beds === "F0…F18 / B0…B18" &&
      ring0.rows[51].beds === "F0…F18 / B1…B18" &&
      ring0.rows[95].beds === "F0…F14 / B1…B14" &&
      ring0.needleCols.at(-1) === 37 &&
      !ring0.needleCols.includes(NaN),
    "the far-right column is the start-of-row window and is not a needle column",
  );
  assert(ring0.legend.some((row) => row.key === "分布" && /这一行开始/.test(row.note)), "legend names the start-of-row window column");
  assert(excelBedsWidth(excelGrid) === 0, "step3 has no start-of-row window column");
  assert(excelBedsWidth(ringGrid) === MAP_BEDS_W, "step4 draws the window column when rows carry it");
  assert(
    hitTestContent(ringGrid, MAP_LABEL_W + ringGrid.nCols * MAP_CELL + 8, MAP_HEAD_H + 45 * MAP_CELL + 4, { excel: true }) == null,
    "the window column is not a needle cell",
  );
  assert(
    physicalNeedleGlyph(physAt(51, 12)) === "F13" &&
      physicalNeedleGlyph(physAt(51, 17)) === "F18" &&
      !tokenAt(51, 18) &&
      physicalNeedleGlyph(physAt(51, 19)) === "B18" &&
      physicalNeedleGlyph(physAt(51, 24)) === "B13" &&
      physicalNeedleGlyph(physAt(51, 25)) === "B12" &&
      tokenAt(51, 24) === "B-R1",
    "after that rack the next knit runs F13…F18, an empty column, then B18…B12, with -R1 on B13",
  );
  const backDec = ring0.rows[52].cells.filter((cell) => cell.token);
  assert(
    ring0.rows[52].dir === "X" &&
      backDec.length === 12 &&
      backDec.every((cell) => cell.token === "B→" && cell.bed === "B") &&
      physicalNeedleGlyph(physAt(52, 25)) === "B12" &&
      physicalNeedleGlyph(physAt(52, 36)) === "B1",
    "step3 row 42 shifts the back bed from B12 through B1",
  );
  let failed = false;
  try {
    assertAlignedRow(
      { dir: "R", cells: [{ col: 0, token: "F·" }] },
      { dir: "L", cells: [{ col: 0, token: "·" }] },
      0,
    );
  } catch (err) {
    failed = /mismatch/i.test(err.message);
  }
  assert(failed, "ring0 align must fail loudly when dir/kind/columns do not match");
}

console.log("project checks ok");
