import { createHash } from "node:crypto";
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
  isDecreaseCylinderBedChart,
  isIncreaseCylinderBedChart,
  isThinCylinderBedChart,
  isStandradCylinderBedChart,
  knitBedsByFace,
  KNIT_BED_RGB,
  parseExcelReadableMap,
  physicalNeedleGlyph,
} from "../src/excel-map.js";
import { aspectFromSize, displayedSize, drawingMatchesDisplay, needsViewportSync } from "../src/viewport.js";
import { buildOwnBedChart, renderReport } from "./build-step4-faces-ring0.mjs";
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
assert(!existsSync(join(root, "scripts", "build-step4-ring0.mjs")), "the older Step3 step4 generator is not in the repo");
assert(
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test.includes("build-step4-faces-ring0.mjs --check") &&
    !JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test.includes("build-step4-ring0.mjs"),
  "npm test checks the faces-ring Step4 generator",
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
if (fromManifest.outputs.length !== 2) throw new Error("expected the joined faces-ring sheet plus the live step4 sample");
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
  const faceIds = new Set();
  for (const value of facesMap.faceByCell.values()) {
    for (const face of Array.isArray(value) ? value : [value]) faceIds.add(face);
  }
  assert(faceIds.has(0) && faceIds.has(46) && faceIds.has(182) && faceIds.has(292) && faceIds.has(398) && faceIds.size === 475, "the one sheet maps ring 0 through ring 4 stitch faces");
  const knitBeds = knitBedsByFace(facesMap);
  let frontBeds = 0;
  let backBeds = 0;
  let bothBeds = 0;
  for (const bed of knitBeds.values()) {
    if (bed === "F") frontBeds += 1;
    else if (bed === "B") backBeds += 1;
    else if (bed === "FB") bothBeds += 1;
  }
  assert(knitBeds.size === 475 && knitBeds.get(0) === "F" && frontBeds === 254 && backBeds === 219 && bothBeds === 2, "each face takes the bed of its knit course");
  assert(knitBeds.get(385) === "FB" && knitBeds.get(465) === "FB", "fold-crossing knit spans stay on both beds");
  assert(
    KNIT_BED_RGB.F.map((c) => Math.round(c * 255)).join(",") === "255,176,32",
    "front bed draws amber rgb(255,176,32)",
  );
  assert(
    KNIT_BED_RGB.B.map((c) => Math.round(c * 255)).join(",") === "56,156,255",
    "back bed draws blue rgb(56,156,255)",
  );
  const bind = parseStitchMapBind(readFileSync(join(cylDir, "stitch_map_bind.json"), "utf8"));
  const face0 = stitchForMapCell(0, 0, bind, null, facesMap);
  assert(face0?.index === 0, "clicking the first cell selects stitch face 0, not a step3 column");
  const term21 = highlightKeysForStitch({ index: 21 }, { map: facesMap, bind });
  assert(term21.size === 2, "the hang-1 increase term lights both of its knit cells");
  const joined = facesMap.rows.filter((row) => row.dir === "R" || row.dir === "L");
  assert(joined.length === 89, "ring 4 adds thirteen courses on the same sheet, so the knit rows are 89");
  assert(joined[0].cells.some((cell) => cell.bed === "F" && cell.phys === 0), "the sheet still starts at F0");
  assert(joined[5].cells.some((cell) => cell.bed === "F" && cell.phys === 0), "ring 1 continues at F0 on the same sheet");
  const marked = (row) => (row?.cells || []).filter((cell) => cell.token);
  const frontDec = joined.find((row) => row.cells.some((cell) => cell.token === "F-R1"));
  const frontKnit = marked(frontDec);
  const frontDecAt = facesMap.rows.indexOf(frontDec);
  const frontDecCell = frontKnit.find((cell) => cell.token === "F-R1");
  const frontShift = marked(facesMap.rows[frontDecAt + 1]);
  const frontDot = frontKnit[frontKnit.indexOf(frontDecCell) + 1];
  assert(
    frontKnit.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") ===
      "F·@F0 F·@F1 F·@F2 F·@F3 F·@F4 F-R1@F5 F·@F6" &&
      frontDecCell?.fill === "rgb(255,153,204)" &&
      frontDot?.token === "F·" &&
      frontDot?.fill === "rgb(255,153,204)" &&
      !frontKnit.some((cell) => cell.bed === "B"),
    "row 7R knits F0…F4, then F-R1 at F5 and F· at F6, and stops on that last decrease cell",
  );
