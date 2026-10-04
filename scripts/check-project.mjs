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
  isStandradCylinderBedChart,
  knitBedsByFace,
  KNIT_BED_RGB,
  parseExcelReadableMap,
  physicalNeedleGlyph,
} from "../src/excel-map.js";
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
  assert(
    facesMap.rows[frontDecAt + 1]?.dir === "X" &&
      frontShift.map((cell) => `${cell.token}/${cell.phys}`).join(",") ===
        [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((phys) => `F←/${phys}`).join(","),
    "the transfer after row 7R starts at F6, the last decrease cell, not at F7 or the far-end pair",
  );
  const frontCont = marked(facesMap.rows[frontDecAt + 4]);
  assert(facesMap.rows[frontDecAt + 2]?.dir === "Flip" && marked(facesMap.rows[frontDecAt + 2]).map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") === "⬇@B18", "balance flips B18→F18 immediately after the decrease transfer");
  assert(facesMap.rows[frontDecAt + 3]?.dir === "X", "the back rack follows that flip, before the remaining knit");
  assert(
    facesMap.rows[frontDecAt + 4]?.dir === "R" &&
      facesMap.rows[frontDecAt + 4].beds.includes("后18[1…18]") &&
      frontCont.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") ===
        "F·@F6 F·@F7 F·@F8 F·@F9 F·@F10 F·@F11 F·@F12 F·@F13 FvR@F14",
    "the remaining knit is the next course, on the post-balance window",
  );
  const frontNext = marked(joined[joined.indexOf(frontDec) + 2]);
  assert(
    frontNext.some((cell) => cell.token === "F^R" && cell.phys === 14) &&
      !frontNext.some((cell) => cell.bed === "B" && cell.phys === 0) &&
      joined[joined.indexOf(frontDec) + 2].beds.includes("后18[1…18]"),
    "the next course starts at F14 after balance leaves that end needle",
  );
  const backDec = joined.find((row) => row.cells.some((cell) => cell.token === "B-L1"));
  const backKnit = marked(backDec);
  const backDecCell = backKnit.find((cell) => cell.token === "B-L1");
  const backDot = backKnit[backKnit.indexOf(backDecCell) + 1];
  const backAt = facesMap.rows.indexOf(backDec);
  const backShift = marked(facesMap.rows[backAt + 1]);
  assert(
    backDecCell?.token === "B-L1" &&
      backDecCell?.phys === 17 &&
      backDecCell?.fill === "rgb(255,153,204)" &&
      backDot?.token === "B·" &&
      backDot?.phys === 16 &&
      backDot?.fill === "rgb(255,153,204)" &&
      backKnit.at(-1) === backDot &&
      !backKnit.some((cell) => cell.token === "BvR"),
    "the back decrease is L, knits through B-L1 at B17 and B· at B16, and stops on that last decrease cell",
  );
  assert(
    facesMap.rows[backAt + 1]?.dir === "X" &&
      backShift.every((cell) => cell.token === "B→") &&
      backShift.map((cell) => cell.phys).join(",") === [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].join(","),
    "the back decrease transfers starting at B16, the last decrease cell, through B0",
  );
  const backCont = marked(facesMap.rows[backAt + 2]);
  assert(
    facesMap.rows[backAt + 2]?.dir === "R" &&
      backCont.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") === "BvR@B16",
    "the back continuation is the remaining BvR at B16 after the transfer",
  );
  const backNext = marked(joined[joined.indexOf(backDec) + 2]);
  assert(backNext.some((cell) => cell.token === "B^R" && cell.phys === 16), "the next fold-return starts on that end stitch at B16");
  const ring0Inc = facesMap.rows.find((row) => row.cells.some((cell) => cell.token === "B+R1"));
  const ring0IncAt = facesMap.rows.indexOf(ring0Inc);
  const ring0IncCells = marked(ring0Inc);
  assert(
    facesMap.rows[ring0IncAt - 1]?.dir === "X+" &&
      facesMap.rows[ring0IncAt + 1]?.dir === "X" &&
      ring0IncCells.some((cell) => cell.token === "B+R1" && cell.phys === 17) &&
      ring0IncCells.some((cell) => cell.token === "B^R" && cell.phys === 18) &&
      ring0IncCells.some((cell) => cell.token === "BvL" && cell.phys === 19),
    "row 2L reverses, so it is a fold-return and starts on the previous end needle B17",
  );
  const ring0Return = marked(facesMap.rows[ring0IncAt + 2]);
  assert(
    facesMap.rows[ring0IncAt + 2]?.dir === "R" && ring0Return[0]?.token === "B^L" && ring0Return[0]?.phys === 18,
    "the next row also reverses, so the fold-return after the ring-0 rack starts on the shifted end stitch at B18",
  );
  const ring1Inc = facesMap.rows.find((row) => row.cells.some((cell) => cell.token === "F+R1"));
  const ring1IncAt = facesMap.rows.indexOf(ring1Inc);
  assert(
    facesMap.rows[ring1IncAt + 1]?.dir === "Flip" &&
      marked(facesMap.rows[ring1IncAt + 1]).some((cell) => cell.token === "⬆" && cell.bed === "F" && cell.phys === 19) &&
      facesMap.rows[ring1IncAt + 2]?.dir === "X" &&
      marked(ring1Inc).some((cell) => cell.token === "B^L" && cell.phys === 4) &&
      marked(ring1Inc).some((cell) => cell.token === "F+R1"),
    "course 7 knits the increase from B4, then flips and racks",
  );
  const course7Cells = marked(ring1Inc);
  const course7F17 = course7Cells.find((cell) => cell.token === "F·" && cell.bed === "F" && cell.phys === 17);
  const course7F18 = course7Cells.find((cell) => cell.token === "F·" && cell.bed === "F" && cell.phys === 18);
  const course7Turn = course7Cells.find((cell) => cell.token === "FvR" && cell.bed === "F" && cell.phys === 19);
  assert(
    course7F17?.faceIndex != null &&
      course7F18?.faceIndex === course7F17.faceIndex + 1 &&
      course7Turn?.faceIndex === course7F18.faceIndex + 1 &&
      course7Turn.col === 19 &&
      course7Cells.filter((cell) => cell.bed === "F" && cell.phys === 19).length === 1 &&
      !course7Cells.some((cell) => cell.bed === "B" && cell.phys === 18),
    "course 7 draws the turn stitchmesh on F19 and does not draw B18",
  );
  const course8 = marked(facesMap.rows[ring1IncAt + 3]);
  assert(
    facesMap.rows[ring1IncAt + 3]?.dir === "L" &&
      course8.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") === "FvL@F16 F·@F17 F·@F18 B^R@B18" &&
      course8.some((cell) => cell.token === "B^R" && cell.phys === 18) &&
      !course8.some((cell) => cell.phys === 17 && cell.bed === "B"),
    "row 17L starts on the balanced end stitch B18",
  );
  const face51 = highlightKeysForStitch({ index: 51 }, { map: facesMap, bind });
  const face123 = highlightKeysForStitch({ index: 123 }, { map: facesMap, bind });
  assert(face51.size === 2 && face123.size === 2, "each hang-1 decrease lights both span cells");
  const ring2 = joined[24];
  const ring2Cells = marked(ring2);
  assert(
    ring2.dir === "R" &&
      ring2Cells[0]?.token === "F·" &&
      ring2Cells[0]?.phys === 0 &&
      ring2Cells[0]?.faceIndex === 182 &&
      joined[23].dir === "R",
    "ring 2 keeps the bed and starts one needle further, at F0, because the direction did not reverse",
  );
  const face253 = highlightKeysForStitch({ index: 253 }, { map: facesMap, bind });
  assert(face253.size === 2, "ring 2's hang-1 increase lights both of its knit cells");
  for (const face of [266, 279, 282, 284]) {
    const keys = highlightKeysForStitch({ index: face }, { map: facesMap, bind });
    assert(keys.size === 2, `ring 2 decrease face ${face} lights both span cells`);
  }
  const ring3 = joined[41];
  const ring3Cells = marked(ring3);
  assert(
    ring3.dir === "R" &&
      ring3Cells[0]?.token === "F·" &&
      ring3Cells[0]?.phys === 0 &&
      ring3Cells[0]?.faceIndex === 292 &&
      joined[40].dir === "R",
    "ring 3 keeps the bed and starts one needle further, at F0, because the direction did not reverse",
  );
  const face328 = highlightKeysForStitch({ index: 328 }, { map: facesMap, bind });
  assert(face328.size === 2, "ring 3's hang-1 turn decrease lights both of its knit cells");
  const face374 = highlightKeysForStitch({ index: 374 }, { map: facesMap, bind });
  assert(face374.size === 3, "ring 3's hang-2 increase lights all three of its knit cells");
  for (const face of [385, 386]) {
    const keys = highlightKeysForStitch({ index: face }, { map: facesMap, bind });
    assert(keys.size === 3, `ring 3 hang-2 decrease face ${face} lights all three span cells`);
  }
  const ring4 = joined[68];
  const ring4Cells = marked(ring4);
  assert(
    ring4.dir === "R" &&
      ring4Cells[0]?.token === "F·" &&
      ring4Cells[0]?.phys === 0 &&
      ring4Cells[0]?.faceIndex === 398 &&
      joined[67].dir === "R",
    "ring 4 keeps the bed and starts one needle further, at F0, because the direction did not reverse",
  );
  for (const face of [418, 456, 461, 473]) {
    const keys = highlightKeysForStitch({ index: face }, { map: facesMap, bind });
    assert(keys.size === 2, `ring 4 decrease face ${face} lights both span cells`);
  }
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
  assert(onDisk.outputs.length === 1, "folder discovery still opens the cut body only");
  assert(
    /iteration_0_cut_KnittingStitches\.obj$/i.test(onDisk.outputs[0].stitchFile?.name || ""),
    "folder discovery keeps the iteration 0 stitchmesh",
  );
  assert(/step4_ring0\.xls$/i.test(onDisk.outputs[0].readableMapFile?.name || ""), "folder discovery prefers step4-ring0 when beds and step3 are also present");
  assert(
    !/standrad_cylinder_readable_map\.txt$/i.test(onDisk.outputs[0].readableMapTxtFile?.name || ""),
    "folder discovery does not swap in the Standrad Cylinder readable_map",
  );
  assert(
    !/standrad_cylinder_bed/i.test(onDisk.outputs[0].readableMapFile?.name || ""),
    "folder discovery does not swap in the Standrad Cylinder bed chart",
  );
  assert(
    /iteration_0_cut_cols_resample_field\.obj$/i.test(onDisk.outputs[0].colsResampleFile?.name || "") &&
      /iteration_0_cut_cols_resample\.xls$/i.test(onDisk.outputs[0].colsResampleXlsFile?.name || ""),
    "folder discovery keeps the cylinder cols_resample field and xls",
  );
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
assert(html.includes('id="load-faces-ring0"') && !html.includes('id="load-faces-ring1"') && mainSrc.includes("faces-ring0") && mainSrc.includes("isFacesRing0BedChart"), "Open menu loads the joined faces-ring bed chart");
assert(
  html.includes('id="load-standrad-cylinder"') &&
    html.includes("Standrad Cylinder") &&
    mainSrc.includes("standrad-cylinder.json") &&
    mainSrc.includes("loadStandradCylinder"),
  "Open menu loads Standrad Cylinder in the existing chooser",
);
{
  const data = JSON.parse(readFileSync(join(sampleDir, "standrad-cylinder.json"), "utf8"));
  assert(data.name === "Standrad Cylinder" && data.outputs?.length === 1, "Standrad Cylinder manifest is one sample");
  assert(data.outputs[0].label === "Standrad Cylinder", "chooser label stays Standrad Cylinder");
  const rels = collectManifestRefs(data);
  assert(
    rels.includes("cylinder/standrad_cylinder_KnittingStitches.obj") &&
      rels.includes("cylinder/standrad_cylinder_rings.json") &&
      rels.includes("cylinder/standrad_cylinder_readable_map.txt") &&
      rels.includes("cylinder/standrad_cylinder_bed.xls") &&
      rels.includes("cylinder/standrad_cylinder_cols_resample_field.obj") &&
      rels.includes("cylinder/standrad_cylinder_cols_resample.xls") &&
      !rels.some((rel) => /step4|knitout|\.dat$|faces_ring0_step4_bed/i.test(rel)),
    "Standrad Cylinder does not reference the faces-ring sheet or knitout",
  );
  const entries = [
    { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ...rels.map((rel) => ({
      name: rel.split("/").pop(),
      path: `sample/${rel}`,
      text: readFileSync(join(sampleDir, rel), "utf8"),
    })),
  ];
  const proj = projectFromManifest(data, indexFiles(entries), "sample/manifest.json");
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, "Standrad Cylinder resolves without borrowing other samples");
  const out = proj.outputs[0];
  assert(out.label === "Standrad Cylinder", "output label is Standrad Cylinder");
  assert(
    isStandradCylinderBedChart(out.readableMapFile?.name || "") &&
      /standrad_cylinder_readable_map\.txt$/i.test(out.readableMapTxtFile?.name || "") &&
      /standrad_cylinder_cols_resample_field\.obj$/i.test(out.colsResampleFile?.name || "") &&
      /standrad_cylinder_cols_resample\.xls$/i.test(out.colsResampleXlsFile?.name || "") &&
      !out.firstRowsFile &&
      !out.stitchMapBindFile,
    "Standrad Cylinder uses its own bed chart and cols_resample, not the cylinder sheets",
  );
  const bed = parseReadableMap(readFileSync(join(cylDir, "standrad_cylinder_readable_map.txt"), "utf8"));
  assert(
    bed.header?.rows === 7 &&
      bed.header?.cells === 175 &&
      bed.header?.circle === 25 &&
      bed.header?.front === 13 &&
      bed.header?.back === 12 &&
      bed.rows.length === 7 &&
      bed.cells.length === 175 &&
      bed.colMin === 0 &&
      bed.colMax === 24,
    "Standrad Cylinder readable_map is 7 rows and columns 0-24",
  );
  assert(
    bed.rows.every((row) => row.dir === "R" && row.colStart === 0 && row.colEnd === 24 && row.tokens.length === 25) &&
      bed.cells.every((cell) => cell.token === "·" && cell.dir === "R"),
    "every Standrad Cylinder bed cell is plain knit on an R row",
  );
  const parsed = parseColoredObj(readFileSync(join(cylDir, "standrad_cylinder_KnittingStitches.obj"), "utf8"));
  assert(parsed.verts.length === 700 && parsed.faces.length === 175, "Standrad Cylinder is 700 vertices and 175 faces");
  assert(parsed.faces.every((face) => face.indices.length === 4), "Standrad Cylinder faces are quads");
  assert(
    parsed.verts.every((v) => v.r === 0.55 && v.g === 0.55 && v.b === 0.55),
    "Standrad Cylinder vertex colors are plain-knit gray",
  );
  const ySpan = parsed.verts.reduce(
    (acc, vert) => ({ min: Math.min(acc.min, vert.y), max: Math.max(acc.max, vert.y) }),
    { min: Infinity, max: -Infinity },
  );
  assert(ySpan.min > -1e-6 && ySpan.max > 39.9 && ySpan.max < 40.1, "Standrad Cylinder stands with its height along Y");
  const boundBed = bindStitchesToMap(parsed.faces, bed);
  assert(boundBed.unboundFaces === 0 && boundBed.leftoverCells === 0, "each stitch face binds one bed cell");
  assert(boundBed.stitches[0].row === 0 && boundBed.stitches[0].col === 0, "first stitch is column 0");
  assert(boundBed.stitches[12].row === 0 && boundBed.stitches[12].col === 12, "front bed ends at column 12");
  assert(boundBed.stitches[13].row === 0 && boundBed.stitches[13].col === 13, "back bed starts at column 13");
  assert(boundBed.stitches[24].row === 0 && boundBed.stitches[24].col === 24, "row 0 ends at column 24");
  assert(boundBed.stitches[174].row === 6 && boundBed.stitches[174].col === 24, "last stitch is row 6 column 24");
  const bedGrid = buildReadableMapGrid(bed, boundBed.stitches);
  assert(
    bedGrid.source === "txt" && bedGrid.nRows === 7 && bedGrid.nCols === 25 && bedGrid.occupied === 175,
    "the source readable_map is still the 7 by 25 plain tube",
  );
  const excel = parseExcelReadableMap(readFileSync(join(cylDir, "standrad_cylinder_bed.xls")));
  assert(
    excel.source === "excel" && excel.sheet === "bed" && excel.bedsHeader === "此刻活针",
    "Standrad Cylinder right-hand map is the excel bed chart with 此刻活针",
  );
  assert(
    excel.rows.length === 7 &&
      excel.needleCols.length === 25 &&
      excel.colMin === 0 &&
      excel.colMax === 24 &&
      excel.rows[0].dir === "R" &&
      excel.rows[0].beds === "0针 · 前空 · 后空" &&
      excel.rows.slice(1).every((row) => row.dir === "R" && row.beds === "25针 · 前13[0…12] · 后12[1…12]"),
    "Standrad Cylinder bed chart width is the widest course (25 columns)",
  );
  const knitOf = (row) => row.cells.filter((cell) => cell.token);
  assert(
    excel.rows.every((row) => {
      const knit = knitOf(row);
      if (knit.length !== 25) return false;
      return knit.every((cell, i) => {
        const onFront = i < 13;
        const phys = onFront ? i : 12 - (i - 13);
        return (
          cell.kind === "plain" &&
          cell.token === (onFront ? "F·" : "B·") &&
          cell.bed === (onFront ? "F" : "B") &&
          cell.phys === phys &&
          cell.col === (onFront ? phys : 25 - phys) &&
          cell.faceIndex === cell.row * 25 + i &&
          cell.fill === (onFront ? "rgb(255,255,255)" : "rgb(204,255,255)")
        );
      });
    }),
    "each course is F0–F12 then B12–B1, plain knit, starting at F0",
  );
  const faceBeds = knitBedsByFace(excel);
  assert(
    faceBeds.get(0) === "F" &&
      faceBeds.get(12) === "F" &&
      faceBeds.get(13) === "B" &&
      faceBeds.get(24) === "B" &&
      faceBeds.get(25) === "F" &&
      faceBeds.get(174) === "B" &&
      faceBeds.size === 175,
    "each stitch face keeps its front or back bed",
  );
  const excelGrid = buildReadableMapGrid(excel);
  assert(
    excelGrid.source === "excel" &&
      excelGrid.theme === "excel" &&
      excelGrid.nRows === 7 &&
      excelGrid.nCols === 25 &&
      excelGrid.occupied === 175 &&
      excelGrid.bedsHeader === "此刻活针" &&
      excelBedsWidth(excelGrid) === MAP_BEDS_W,
    "the right-hand panel uses the excel renderer and the front/back column",
  );
  assert(
    highlightKeysForStitch({ index: 13 }, { map: excel }).has("0,13") &&
      highlightKeysForStitch({ index: 0 }, { map: excel }).has("0,0") &&
      highlightKeysForStitch({ index: 24 }, { map: excel }).has("0,24"),
    "faces sheet binds a stitch to its front or back cell",
  );
  const standradCols = parseColsResample({
    fieldText: readFileSync(join(cylDir, "standrad_cylinder_cols_resample_field.obj"), "utf8"),
    xls: readFileSync(join(cylDir, "standrad_cylinder_cols_resample.xls")),
  });
  assert(
    standradCols.length === 25 &&
      standradCols.every((col, i) => col.col === i && col.points.length === 8 && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    "cols_resample is 25 side-edge polylines climbing the tube",
  );
  const nearestVert = (point) => {
    let best = Infinity;
    for (const vert of parsed.verts) {
      const d = Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z);
      if (d < best) best = d;
    }
    return best;
  };
  assert(
    standradCols.every((col) => col.points.every((point) => nearestVert(point) < 1e-6)),
    "cols_resample points sit on stitchmesh vertices",
  );
  const faceEdges = (face) => {
    const hit = new Set();
    for (const vert of face.verts) {
      standradCols.forEach((col, index) => {
        if (col.points.some((point) => Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z) < 1e-6)) hit.add(index);
      });
    }
    return hit;
  };
  assert(
    parsed.faces.every((face) => faceEdges(face).size === 2),
    "each stitch column lies between two cols_resample side edges",
  );
  const standradFn = mainSrc.slice(mainSrc.indexOf("async function loadStandradCylinder"), mainSrc.indexOf("async function loadDecreaseCylinder"));
  assert(standradFn.includes("arrayBuffer"), "Standrad Cylinder loads the bed xls as bytes");
  assert(mainSrc.includes("isStandradCylinderBedChart"), "the excel map loader recognizes the Standrad Cylinder bed chart");
  const layout = parseFacesRingLayout(readFileSync(join(cylDir, "standrad_cylinder_rings.json"), "utf8"));
  const stitches = parsed.faces.map((face, index) => ({ index, verts: face.verts }));
  const chunks = facesRingChunksFromStitches(stitches, {
    nRings: layout.nFacesRing,
    termCounts: layout.termCounts,
    ringTypes: layout.ringTypes,
    colors: layout.colors,
  });
  assert(chunks.length === 7 && chunks.every((chunk) => chunk.faces.length === 25), "Standrad Cylinder is 7 rows by 25 columns");
  assert(
    chunks.every((chunk) => chunk.faces.every((stitch) => stitch.termType === 0 && stitch.termColor.r === 0.55)),
    "Standrad Cylinder is all plain knit",
  );
  const seam = parsed.verts[0];
  const twin = parsed.verts[99];
  assert(
    Math.hypot(seam.x - twin.x, seam.y - twin.y, seam.z - twin.z) < 1e-6,
    "Standrad Cylinder seam vertices coincide",
  );
}
{
  assert(
    html.includes('id="load-decrease-cylinder"') &&
      html.includes("Decrease Cylinder") &&
      mainSrc.includes("decrease-cylinder.json") &&
      mainSrc.includes("loadDecreaseCylinder"),
    "Open menu loads Decrease Cylinder in the existing chooser",
  );
  const data = JSON.parse(readFileSync(join(sampleDir, "decrease-cylinder.json"), "utf8"));
  assert(data.name === "Decrease Cylinder" && data.outputs?.length === 1, "Decrease Cylinder manifest is one sample");
  assert(data.outputs[0].label === "Decrease Cylinder", "chooser label stays Decrease Cylinder");
  const rels = collectManifestRefs(data).join("\n");
  assert(
    rels.includes("decrease/decrease_cylinder_KnittingStitches.obj") &&
      rels.includes("decrease/decrease_cylinder_cols_resample_field.obj") &&
      rels.includes("decrease/decrease_cylinder_cols_resample.xls") &&
      rels.includes("decrease/decrease_cylinder_faces_ring_layout.json") &&
      rels.includes("decrease/decrease_cylinder_bed.xls") &&
      !/knitout|\.dat$|faces_ring0|standrad_cylinder|readable_map/i.test(rels),
    "Decrease Cylinder binds its own stitchmesh, cols_resample, faces ring, and bed chart",
  );
  const decDir = join(sampleDir, "decrease");
  const entries = [
    { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ...collectManifestRefs(data).map((rel) => {
      const abs = join(sampleDir, rel);
      const name = rel.split("/").pop();
      if (/\.xlsx?$/i.test(rel)) return { name, path: `sample/${rel}`, buffer: readFileSync(abs) };
      return { name, path: `sample/${rel}`, text: readFileSync(abs, "utf8") };
    }),
  ];
  const proj = projectFromManifest(data, indexFiles(entries), "sample/manifest.json");
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, "Decrease Cylinder resolves without borrowing other samples");
  const out = proj.outputs[0];
  assert(out.label === "Decrease Cylinder", "output label is Decrease Cylinder");
  assert(
    isDecreaseCylinderBedChart(out.readableMapFile?.name || "") && !out.readableMapTxtFile,
    "Decrease Cylinder right-hand map is its own bed chart",
  );
  assert(
    /decrease_cylinder_cols_resample_field\.obj$/i.test(out.colsResampleFile?.name || "") &&
      /decrease_cylinder_cols_resample\.xls$/i.test(out.colsResampleXlsFile?.name || "") &&
      /decrease_cylinder_faces_ring_layout\.json$/i.test(out.facesRingLayoutFile?.name || ""),
    "Decrease Cylinder uses its own cols_resample field, xls, and faces ring",
  );
  const parsed = parseColoredObj(readFileSync(join(decDir, "decrease_cylinder_KnittingStitches.obj"), "utf8"));
  assert(parsed.verts.length === 527 && parsed.faces.length === 129, "Decrease Cylinder is the SingaLab stitchmesh");
  const ySpan = parsed.verts.reduce(
    (acc, vert) => ({ min: Math.min(acc.min, vert.y), max: Math.max(acc.max, vert.y) }),
    { min: Infinity, max: -Infinity },
  );
  assert(ySpan.min > -0.1 && ySpan.max > 39.9 && ySpan.max < 40.1, "Decrease Cylinder stands with its height along Y");
  const layout = parseFacesRingLayout(readFileSync(join(decDir, "decrease_cylinder_faces_ring_layout.json"), "utf8"));
  const stitches = parsed.faces.map((face, index) => ({ index, verts: face.verts }));
  const chunks = facesRingChunksFromStitches(stitches, {
    nRings: layout.nFacesRing,
    termCounts: layout.termCounts,
    ringTypes: layout.ringTypes,
    colors: layout.colors,
  });
  assert(
    chunks.length === 5 && chunks.map((chunk) => chunk.faces.length).join(",") === "23,23,22,19,42",
    "Decrease Cylinder faces ring is the exported 5 rings",
  );
  const decreaseCols = parseColsResample({
    fieldText: readFileSync(join(decDir, "decrease_cylinder_cols_resample_field.obj"), "utf8"),
    xls: readFileSync(join(decDir, "decrease_cylinder_cols_resample.xls")),
  });
  assert(
    decreaseCols.length === 24 &&
      decreaseCols.every((col, i) => col.col === i && col.points.length >= 2 && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    "cols_resample is 24 side-edge polylines climbing the cone",
  );
  const nearestVert = (point) => {
    let best = Infinity;
    for (const vert of parsed.verts) {
      const d = Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z);
      if (d < best) best = d;
    }
    return best;
  };
  assert(
    decreaseCols.every((col) => col.points.every((point) => nearestVert(point) < 1e-6)),
    "Decrease Cylinder cols_resample points sit on stitchmesh vertices",
  );
  const faceEdges = (face) => {
    const hit = new Set();
    for (const vert of face.verts) {
      decreaseCols.forEach((col, index) => {
        if (col.points.some((point) => Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z) < 1e-6)) hit.add(index);
      });
    }
    return hit;
  };
  assert(
    parsed.faces.every((face) => faceEdges(face).size >= 2),
    "each Decrease Cylinder stitch meets cols_resample side edges",
  );
  const decreaseBed = parseExcelReadableMap(readFileSync(join(decDir, "decrease_cylinder_bed.xls")));
  assert(
    decreaseBed.source === "excel" && decreaseBed.sheet === "bed" && decreaseBed.bedsHeader === "此刻活针",
    "Decrease Cylinder right-hand map is the excel bed chart",
  );
  assert(
    decreaseBed.needleCols.length === 24 && decreaseBed.colMin === 0 && decreaseBed.colMax === 23,
    "Decrease Cylinder bed chart width is the widest course (24 columns)",
  );
  const decreaseTxt = readFileSync(join(decDir, "decrease_cylinder_bed.txt"), "utf8");
  assert(
    decreaseTxt.includes("course 0 R  start F0  end B0  （24 针）") &&
      decreaseTxt.includes("course 1 R  start F0  end B1  （24 针）") &&
      decreaseTxt.includes("course 2 R  start F0  end B0  （23 针）") &&
      decreaseTxt.includes("course 3 R  start F0  end B1  （22 针）") &&
      decreaseTxt.includes("course 4 R  start F0  end B0  （47 针）") &&
      decreaseTxt.includes("表宽 24") &&
      decreaseTxt.includes("第一环落座之后 N=24，窗 F12[0…11] / B12[0…11]。") &&
      decreaseTxt.includes("第五环结束 N=14，窗 F7[0…6] / B7[0…6]。"),
    "Decrease Cylinder courses are the generator report",
  );
  const ring0 = decreaseBed.rows[0];
  const ring0Knit = ring0.cells.filter((cell) => cell.token);
  const ring0Seq = ring0Knit.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  assert(
    ring0.dir === "R" &&
      ring0.beds === "0针 · 前空 · 后空" &&
      ring0Seq ===
        "F·@F0 F·@F1 F·@F2 F·@F3 F·@F4 F·@F5 F·@F6 F·@F7 F·@F8 F·@F9 F·@F10 F·@F11 B·@B11 B·@B10 B·@B9 B·@B8 B·@B7 B·@B6 B·@B5 B·@B4 B·@B3 B+R1@B2 B·@B1 B·@B0" &&
      ring0Knit.every((cell) => cell.col === (cell.bed === "F" ? cell.phys : 23 - cell.phys)),
    "ring 0 knits F0–F11 then B11–B0 on an empty bed, and B0 holds the last loop",
  );
  const decreaseFn = mainSrc.slice(mainSrc.indexOf("async function loadDecreaseCylinder"), mainSrc.indexOf("async function loadSample"));
  assert(decreaseFn.includes("arrayBuffer"), "Decrease Cylinder loads the cols xls as bytes");
  assert(decreaseFn.includes("前床 F0–F11") && decreaseFn.includes("后床 B11–B0") && !decreaseFn.includes(".dat"), "Decrease Cylinder status quotes the seated bed and does not add a dat");
  assert(mainSrc.includes("isDecreaseCylinderBedChart"), "the excel map loader recognizes the Decrease Cylinder bed chart");
  assert(!/root\.rotation|camera\.up/.test(decreaseFn), "Decrease Cylinder does not rotate the viewer");
}
assert(!html.includes('class="actions"'), "Folder / Files / Sample are not a row of top-bar buttons");
assert(mainSrc.includes("setOpenMenu") && mainSrc.includes("open-menu-list"), "main wires the Open dropdown");
assert(html.includes('id="map-pane"') && html.includes('id="map-canvas"'), "right pane is the readable_map canvas");
{
  const stageHtml = html.slice(html.indexOf('id="stage-3d"'), html.indexOf('id="map-pane"'));
  const dockHtml = html.slice(html.indexOf('class="display-bar"'), html.indexOf('id="status"'));
  assert(stageHtml.includes('id="toggle-knit-bed"') && stageHtml.includes("床位") && stageHtml.includes("Bed"), "knit-bed switch sits on the 3D stitchmesh view");
  assert(/id="toggle-knit-bed"[^>]*aria-pressed="false"/.test(stageHtml), "knit-bed switch defaults off");
  assert(!dockHtml.includes("toggle-knit-bed"), "knit-bed switch does not join the Base / Warp / Stitch dock");
}
assert(mainSrc.includes("setShowKnitBed") && mainSrc.includes("knitBedsByFace") && mainSrc.includes("#toggle-knit-bed"), "main wires the knit-bed switch from the loaded sheet");
assert(viewerSrc.includes("showKnitBed = false") && viewerSrc.includes("KNIT_BED_RGB") && viewerSrc.includes('bed === "FB"'), "viewer recolors stitches by knit bed only while the switch is on");
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
  const ring0Path = join(cylDir, "iteration_0_cut_readable_map_step4_ring0.xls");
  const ring0Bytes = readFileSync(ring0Path);
  const ring0Hash = createHash("sha256").update(ring0Bytes).digest("hex");
  assert(
    ring0Hash === "13dbf950637420a31f626be8b4d6550328b95403bfc4d6dcc9fd96c03cf2b2d8",
    "frozen iteration_0 step4-ring0 xls bytes stay",
  );
  const ring0 = parseExcelReadableMap(ring0Bytes);
  assert(ring0.sheet === "step4-ring0" && ring0.rows.length === 160, `step4 sheet is 160 rows, got ${ring0.sheet} ${ring0.rows.length}`);
}

console.log("project checks ok");
