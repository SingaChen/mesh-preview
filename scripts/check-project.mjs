import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  indexFiles,
  isColumnFieldObjName,
  isColumnOrderName,
  isColumnPolylineName,
  isColumnTypeObjName,
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
  applyExtractColumnColors,
  extractTypeLegend,
  formatExtractRangeLabel,
  formatExtractStatus,
  parseColoredObj,
  parseColsResample,
  parseColsResampleField,
  parseExtractColumns,
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
import {
  BUNNY_FLIP_NOTE,
  KNIT_CODE_CAPTION,
  KNIT_CODE_LEGEND,
  KNIT_OPENING_NOTE,
  KNIT_FUNCTION_COLORS,
  KNIT_FUNCTION_GAP,
  KNIT_FUNCTION_PAIRS,
  KNIT_FUNCTION_RAIL_NOTE,
  bindKnitCodeStitches,
  describeKnitCell,
  knitCellTravel,
  knitCodeCaption,
  knitCodeDisplayRows,
  KNIT_ZOOM_MAX,
  KNIT_ZOOM_MIN,
  clampKnitZoom,
  knitCodeInitialScrollTop,
  knitCodeInk,
  knitZoomedScroll,
  knitZoomFactor,
  knitCodeLegend,
  knitFunctionTextColor,
  knitFunctionValue,
  knitRailCellText,
  knitRowBed,
  knitRowHasKnitting,
  knitRowTravelKind,
  knitRowWinding,
  knitTableCells,
  knitTableColumns,
  parseKnitCode,
} from "../src/knit-code.js";
import { excelBedsWidth, hitTestContent, MAP_BEDS_W, MAP_CELL, MAP_CLICK_SLOP, MAP_HEAD_H, MAP_LABEL_W, panToKeepRectVisible, rowDirLabel, rowPurposeLabel, rowSideLabel } from "../src/map-view.js";
import { parseXlsWorkbook, rgbForIcv } from "../src/xls.js";
import {
  excelLegendKind,
  formatPhysicalNeedle,
  formatPhysicalNeedles,
  isDecreaseCylinderBedChart,
  isIncreaseCylinderBedChart,
  isStandradCylinderBedChart,
  isDenseStandradCylinderBedChart,
  isDenseIncreaseCylinderBedChart,
  isDenseDecreaseCylinderBedChart,
  isDenseThinCylinderBedChart,
  isDenseFatCylinderBedChart,
  isFatCylinderBedChart,
  knitBedsByFace,
  KNIT_BED_RGB,
  parseExcelReadableMap,
  physicalNeedleGlyph,
} from "../src/excel-map.js";
import { aspectFromSize, displayedSize, drawingMatchesDisplay, needsViewportSync } from "../src/viewport.js";
import { applyBaseChoice, defaultBaseLayers, hiddenBaseLayers, isBaseHidden, normalizeBaseLayers } from "../src/display.js";
import { NO_DAT_TITLE, datForSheet } from "../src/sheet-dat.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sampleDir = join(root, "public", "sample");
const cylDir = join(sampleDir, "cylinder");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function knitMatrixSuffixHash(path) {
  const text = readFileSync(path, "utf8");
  const key = '\n  "matrix": ';
  const at = text.indexOf(key);
  if (at < 0) throw new Error(`knitting code is missing its matrix: ${path}`);
  return createHash("sha256").update(text.slice(at)).digest("hex");
}

/** Hash 14 body rows × 13 work columns in the same pretty suffix as the locked 13-wide table. */
function knitBodyWorkHash(matrix, start = 34, col0 = 3, col1 = 16) {
  const slice = matrix.slice(start, start + 14).map((row) => row.slice(col0, col1));
  const pretty = JSON.stringify(slice, null, 2);
  const wrapped =
    '\n  "matrix": ' +
    pretty
      .split("\n")
      .map((line, index) => (index === 0 ? line : `  ${line}`))
      .join("\n") +
    "\n}";
  return createHash("sha256").update(wrapped).digest("hex");
}

function liveKnitCount(knit) {
  return knit.rows.reduce(
    (sum, row) => sum + row.cells.filter((code) => code === 1 || code === 2 || code === 11 || code === 12).length,
    0,
  );
}

function needleSlice(knit, row) {
  return knit.columns.filter((col) => col.kind === "needle").map((col) => row.cells[col.needleIndex]);
}

/** Body rows only, garment-needle columns, so 11/12 are read on physical needles. */
function bodyNeedleTable(knit) {
  const cols = knit.columns.filter((col) => col.kind === "needle");
  return {
    ...knit,
    needles: cols.map((col) => col.needle),
    rows: knit.rows.filter((row) => row.bind !== false).map((row) => ({
      ...row,
      cells: cols.map((col) => row.cells[col.needleIndex]),
    })),
  };
}

/**
 * 11/12 mark only the first non-empty cell of the first knit-code row after a
 * short-row winding reversal (ccw ↔ cw). Front ↔ back with the same winding,
 * and a later row of that same winding, stay 1 or 2. Empty 0 is skipped.
 */
function assertShortRowTurnCodes(knit, label, { frame = false } = {}) {
  const allowed = frame ? [0, 1, 2, 11, 12, 13] : [0, 1, 2, 11, 12];
  let prev = null;
  for (const row of knit.rows) {
    const live = [];
    row.cells.forEach((code, index) => {
      assert(allowed.includes(code), `${label} row ${row.index} has code ${code}`);
      const bed = code === 1 || code === 11 ? "F" : code === 2 || code === 12 ? "B" : null;
      if (!bed) return;
      assert(row.winding === "ccw" || row.winding === "cw", `${label} row ${row.index} has a travel winding`);
      const toRight = row.winding === "ccw" ? bed === "F" : bed === "B";
      live.push({ index, code, bed, phys: knit.needles[index], toRight });
    });
    assert(live.length > 0, `${label} row ${row.index} has a stitch`);
    assert(live.every((cell) => cell.toRight === live[0].toRight), `${label} row ${row.index} travels one way`);
    const toRight = live[0].toRight;
    live.sort(
      (a, b) => (toRight ? a.phys - b.phys : b.phys - a.phys) || (toRight ? a.index - b.index : b.index - a.index),
    );
    const first = live[0];
    const turned = live.filter((cell) => cell.code === 11 || cell.code === 12);
    const reversed = (prev === "ccw" && row.winding === "cw") || (prev === "cw" && row.winding === "ccw");
    if (reversed) {
      assert(
        turned.length === 1 && turned[0].index === first.index && first.code === (first.bed === "F" ? 11 : 12),
        `${label} row ${row.index} marks only its first ${first.bed} stitch at needle ${first.phys} after ${prev}→${row.winding}`,
      );
    } else {
      assert(turned.length === 0, `${label} row ${row.index} is not a short-row turn`);
    }
    for (const cell of live) {
      if (reversed && cell.index === first.index) continue;
      assert(cell.code === (cell.bed === "F" ? 1 : 2), `${label} row ${row.index} keeps ordinary stitches`);
    }
    if (row.winding === "ccw" || row.winding === "cw") prev = row.winding;
  }
}

/**
 * Function rails wrap each table at that table's own width.
 * No shared 25-wide pattern, and no padding column drawn as knit-code 0.
 */
function assertFunctionRails(knit, width, label) {
  assert(KNIT_FUNCTION_PAIRS === 20 && KNIT_FUNCTION_GAP === 5, "function rails are 20 pairs and a 5-unit gap");
  assert(knitRailCellText() === "" && knitRailCellText({ role: "gap" }) === "", "a gap cell has no text");
  assert(
    knitRailCellText({ role: "function", slot: "mark", pair: 1 }) === "" &&
      knitRailCellText({ role: "function", slot: "number", pair: 1 }) === "1" &&
      knitRailCellText({ role: "function", slot: "number", pair: 20 }) === "20" &&
      knitRailCellText({ role: "function", side: "L", slot: "mark", pair: 7 }) === "12" &&
      knitRailCellText({ role: "function", side: "R", slot: "mark", pair: 3 }) === "" &&
      knitRailCellText({ role: "function", side: "R", slot: "mark", pair: 5 }) === "1",
    "a row with no direction leaves L1 at 1, and only named indicators have text",
  );
  const columns = knitTableColumns(knit);
  const patternAt = columns.findIndex((col) => col.role === "pattern");
  const lastPattern = columns.findLastIndex((col) => col.role === "pattern");
  const left = columns.filter((col) => col.role === "function" && col.side === "L");
  const right = columns.filter((col) => col.role === "function" && col.side === "R");
  assert(columns.length === 40 + 5 + width + 5 + 40, `${label} row is 40 + 5 + ${width} + 5 + 40`);
  assert(left.length === 40 && right.length === 40, `${label} has 20 pairs on each side`);
  assert(
    columns.slice(0, 40).every((col) => col.role === "function" && col.side === "L") &&
      columns.slice(40, 45).every((col) => col.role === "gap" && col.side === "left") &&
      columns.slice(45, 45 + width).every((col) => col.role === "pattern") &&
      columns.slice(45 + width, 50 + width).every((col) => col.role === "gap" && col.side === "right") &&
      columns.slice(50 + width).every((col) => col.role === "function" && col.side === "R"),
    `${label} lays out left rail, 5-gap, its own needles, 5-gap, right rail`,
  );
  assert(
    left[0].header === "?" &&
      left[0].slot === "mark" &&
      left[0].pair === 20 &&
      left[1].header === "L20" &&
      left[1].slot === "number" &&
      left[1].pair === 20 &&
      left[38].header === "?" &&
      left[38].slot === "mark" &&
      left[38].pair === 1 &&
      left[39].header === "L1" &&
      left[39].slot === "number" &&
      left[39].pair === 1 &&
      columns[patternAt - 7].header === "?" &&
      columns[patternAt - 7].pair === 1 &&
      columns[patternAt - 6].header === "L1" &&
      columns[patternAt - 6].slot === "number" &&
      columns.slice(patternAt - 5, patternAt).every((col) => col.role === "gap" && col.side === "left"),
    `${label} reads ? 20 … ? 1 then 5 empty units, with the L1 body against the gap`,
  );
  assert(
    columns.slice(lastPattern + 1, lastPattern + 6).every((col) => col.role === "gap" && col.side === "right") &&
      columns[lastPattern + 6].header === "R1" &&
      columns[lastPattern + 6].slot === "number" &&
      columns[lastPattern + 6].pair === 1 &&
      columns[lastPattern + 7].header === "?" &&
      columns[lastPattern + 7].pair === 1 &&
      columns.at(-2).header === "R20" &&
      columns.at(-2).slot === "number" &&
      columns.at(-1).header === "?" &&
      columns.at(-1).slot === "mark" &&
      columns.at(-1).pair === 20,
    `${label} reads 5 empty units then 1 ? … 20 ?, with the R1 body against the gap`,
  );
  assert(
    left.filter((col) => col.slot === "number").map((col) => col.pair).join(",") ===
      Array.from({ length: 20 }, (_, i) => 20 - i).join(",") &&
      right.filter((col) => col.slot === "number").map((col) => col.pair).join(",") ===
        Array.from({ length: 20 }, (_, i) => i + 1).join(",") &&
      left.every((col, index) => col.slot === (index % 2 === 0 ? "mark" : "number")) &&
      right.every((col, index) => col.slot === (index % 2 === 0 ? "number" : "mark")),
    `${label} mirrors ?n on the left and n? on the right`,
  );
  const pattern = columns.filter((col) => col.role === "pattern");
  const garment = pattern.filter((col) => Number.isInteger(col.needle));
  assert(
    pattern.length === width &&
      (garment.length === pattern.length
        ? pattern.map((col) => col.header).join(",") === knit.needles.join(",")
        : garment.map((col) => col.header).join(",") === knit.needles.join(",") &&
          pattern.every((col) => col.header === (Number.isInteger(col.needle) ? String(col.needle) : ""))) &&
      columns.every((col) => col.role === "function" || col.role === "gap" || col.role === "pattern"),
    `${label} does not pad past its last column, and pad/frame columns are not garment needles`,
  );
  const headerKey = columns.map((col) => `${col.role}:${col.side || ""}:${col.pair || ""}:${col.slot || ""}:${col.header}`).join("|");
  knit.rows.forEach((row, rowIndex) => {
    const drawn = knitTableCells(knit, rowIndex);
    const again = knitTableColumns(knit).map((col) => `${col.role}:${col.side || ""}:${col.pair || ""}:${col.slot || ""}:${col.header}`).join("|");
    assert(again === headerKey, `${label} rails stay aligned on every row`);
    const drawnPattern = drawn.filter((col) => col.role === "pattern");
    const rails = drawn.filter((col) => col.role !== "pattern");
    assert(
      drawnPattern.map((col) => col.code).join(",") === row.cells.join(",") &&
        drawnPattern.filter((col) => col.drawsEmptyNeedle).length === row.cells.filter((code) => code === 0).length,
      `${label} row ${rowIndex} draws the locked matrix and no extra knit-code 0`,
    );
    if (row.functionRails) {
      for (const col of drawn) {
        if (col.role === "gap") {
          assert(
            col.text === "" && col.fill == null && col.ink == null && col.code == null && col.drawsEmptyNeedle === false,
            `${label} row ${rowIndex} gap stays empty`,
          );
          continue;
        }
        if (col.role !== "function") continue;
        const bag = col.slot === "number" ? row.functionRails[`${col.side}_body`] : row.functionRails[`${col.side}_ind`];
        const key = String(col.pair);
        const has = bag && Object.prototype.hasOwnProperty.call(bag, key);
        const raw = has ? bag[key] : null;
        if (raw == null) {
          assert(
            col.text === "" && col.fill == null && col.ink == null && col.code == null && col.drawsEmptyNeedle === false,
            `${label} row ${rowIndex} ${col.side}${col.pair} ${col.slot} stays empty`,
          );
        } else {
          const fill = knit.colors?.[Number(raw)] || KNIT_FUNCTION_COLORS[Number(raw)];
          assert(
            col.text === String(raw) &&
              col.fill === fill &&
              col.ink === knitFunctionTextColor(fill) &&
              col.code == null &&
              col.drawsEmptyNeedle === false,
            `${label} row ${rowIndex} ${col.side}${col.pair} ${col.slot} copies ${raw} not a width-scaled rail`,
          );
        }
      }
      return;
    }
    const paint = (col, text, fill) =>
      col &&
      col.text === text &&
      col.fill === fill &&
      col.ink === knitFunctionTextColor(fill) &&
      col.code == null &&
      col.drawsEmptyNeedle === false;
    const at = (side, pair, slot) =>
      drawn.find((col) => col.role === "function" && col.side === side && col.pair === pair && col.slot === slot);
    const kind = knitRowTravelKind(row);
    const bed = knitRowBed(row);
    const knitting = knitRowHasKnitting(row);
    const body = kind === "right" ? ["6", "#00FFFF"] : kind === "left" ? ["7", "#FFFFFF"] : ["1", "#FF0000"];
    const l13 = at("L", 13, "mark");
    const r3 = at("R", 3, "mark");
    const r5 = at("R", 5, "mark");
    const indicatorsOk = row.role === "flip"
      ? l13.text === "0" && l13.fill === "#000000" && r3.text === "0" && r3.fill === "#000000" && paint(r5, "1", "#FF0000")
      : row.role === "transfer-front" || row.role === "transfer-back"
        ? paint(l13, row.role === "transfer-front" ? "81" : "82", row.role === "transfer-front" ? "#47869C" : "#6DA5B4") &&
          r3.text === "0" && r3.fill === "#000000" && paint(r5, "1", "#FF0000")
        : knitting
          ? (bed === "F"
              ? paint(l13, "81", "#47869C")
              : bed === "B"
                ? paint(l13, "82", "#6DA5B4")
                : l13.text === "" && l13.fill == null) &&
            paint(r3, "6", "#00FFFF") && r5.text === "" && r5.fill == null
          : l13.text === "" && l13.fill == null && r3.text === "" && r3.fill == null && paint(r5, "1", "#FF0000");
    const bodies = drawn.filter((col) => col.role === "function" && col.slot === "number" && col.pair !== 1);
    const namedMarks = new Set(["L7", "L10", "L11", "L13", "R3", "R5", "R6", "R11"]);
    const unnamed = drawn.filter((col) => col.slot === "mark" && !namedMarks.has(`${col.side}${col.pair}`));
    const gaps = drawn.filter((col) => col.role === "gap");
    assert(
      paint(at("L", 1, "number"), body[0], body[1]) &&
        paint(at("R", 1, "number"), body[0], body[1]) &&
        at("L", 1, "number").text === at("R", 1, "number").text &&
        bodies.length === 38 &&
        bodies.every((col) => paint(col, String(col.pair), KNIT_FUNCTION_COLORS[col.pair])) &&
        paint(at("L", 7, "mark"), "12", "#906CB4") &&
        paint(at("L", 10, "mark"), "4", "#0000FF") &&
        paint(at("L", 11, "mark"), "14", "#CF90C0") &&
        paint(at("R", 6, "mark"), "5", "#FF00FF") &&
        paint(at("R", 11, "mark"), "1", "#FF0000") &&
        indicatorsOk &&
        unnamed.every((col) => col.text === "" && col.fill == null && col.ink == null && col.code == null && col.drawsEmptyNeedle === false) &&
        gaps.every((col) => col.text === "" && col.fill == null && col.ink == null && col.code == null && col.drawsEmptyNeedle === false) &&
        drawn[patternAt - 6].slot === "number" &&
        drawn[patternAt - 6].pair === 1 &&
        drawn[patternAt - 7].text === "" &&
        drawn[patternAt - 7].slot === "mark" &&
        drawn[patternAt - 7].pair === 1 &&
        drawn[lastPattern + 6].slot === "number" &&
        drawn[lastPattern + 6].pair === 1 &&
        drawn[lastPattern + 7].text === "" &&
        drawn[lastPattern + 7].pair === 1 &&
        drawn[0].text === "" &&
        drawn[0].pair === 20 &&
        drawn[1].text === "20" &&
        drawn[1].fill === "#B276B2" &&
        drawn.at(-1).text === "" &&
        drawn.at(-1).pair === 20 &&
        drawn.at(-2).text === "20" &&
        drawn.at(-2).fill === "#B276B2" &&
        ((label !== "Standrad" && label !== "Dense Standrad") ||
          (rowIndex % 2 === 0 ? kind === "right" && bed === "F" && body[0] === "6" : kind === "left" && bed === "B" && body[0] === "7")),
      `${label} row ${rowIndex} fills L1/R1 from travel and only the named indicators`,
    );
  });
}

function railCell(knit, rowIndex, side, pair, slot) {
  return knitTableCells(knit, rowIndex).find(
    (col) => col.role === "function" && col.side === side && col.pair === pair && col.slot === slot,
  );
}

function assertStandradOpening(knit, raw) {
  const front = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const back = [13, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  const pattern = knitTableColumns(knit).filter((col) => col.role === "pattern");
  assert(
    raw.n_rows === 48 &&
      raw.n_cols === 23 &&
      raw.n_opening_rows === 34 &&
      raw.n_body_rows === 14 &&
      knit.rows.length === 48 &&
      knit.needles.length === 13 &&
      knit.needles.every((needle, index) => needle === index) &&
      pattern.length === 23 &&
      pattern[0].kind === "pad" &&
      pattern[0].header === "" &&
      pattern[2].kind === "frame" &&
      pattern[2].header === "" &&
      pattern[3].kind === "needle" &&
      pattern[3].needle === 0 &&
      pattern[3].header === "0" &&
      pattern[15].needle === 12 &&
      pattern[16].kind === "frame" &&
      pattern.slice(17).every((col) => col.kind === "pad" && col.header === ""),
    "Standrad opening canvas is 23 columns and needle 0 stays at column 3",
  );
  assert(
    knit.rows[0].cells.join(",") === "0,0,0,13,1,0,2,0,3,0,4,0,1,0,2,0,13,0,0,0,0,0,0" &&
      knit.rows[1].cells.join(",") === "0,0,0,13,1,0,2,0,1,0,2,0,1,0,2,0,13,0,0,0,0,0,0" &&
      knit.rows[0].winding === "ccw" &&
      knit.rows[1].winding === "cw",
    "opening rows 1–2 keep the 8-column cycle and the inset frame",
  );
  assert(
    knit.rows[12].cells[15] === 3 &&
      knit.rows[12].cells[14] === 51 &&
      knit.rows[13].cells[3] === 3 &&
      knit.rows[14].cells.join(",") === knit.rows[12].cells.join(",") &&
      knit.rows[15].cells.join(",") === knit.rows[13].cells.join(","),
    "opening rows 13–16 keep the edge 3 on 51 and 3/52",
  );
  assert(
    knit.rows.slice(0, 34).every((row) => row.bind === false && row.functionRails) &&
      knit.rows.slice(34).every((row, index) => {
        const slice = row.cells.slice(3, 16);
        const expect = index % 2 === 0 ? front : back;
        return (
          row.bind === true &&
          row.functionRails == null &&
          row.winding === "ccw" &&
          slice.join(",") === expect.join(",") &&
          row.cells.every((code, col) => {
            const backRow = index % 2 === 1;
            if (col === 16) return code === 13;
            if (col === 2) return code === (backRow ? 0 : 13);
            if (col >= 3 && col <= 15) return true;
            return code === 0;
          })
        );
      }) &&
      knit.rows[10].winding === "none" &&
      knit.rows[11].winding === "none" &&
      !knit.rows[10].cells.includes(13) &&
      !knit.rows[11].cells.includes(13) &&
      raw.row_winding.slice(34).every((winding) => winding === "ccw") &&
      raw.function_rails.slice(34).every((rails) => rails == null) &&
      raw.row_bind.slice(0, 34).every((flag) => flag === false) &&
      !raw.rules.row_turn.includes("每一行都算一次换行") &&
      raw.rules.row_turn.includes("没有短行折返") &&
      raw.rules.knit_frames.includes("紧贴该行实际编织格子") &&
      raw.rules.knit_frames.includes("翻针行和移针行不加 13"),
    "14 body rows keep the live work slice, with 13 tight against the knitted cells, ccw winding, and generator rails",
  );
  assert(
    railCell(knit, 4, "L", 12, "mark").text === "10" &&
      railCell(knit, 4, "L", 11, "mark").text === "13" &&
      railCell(knit, 4, "L", 10, "mark").text === "3" &&
      railCell(knit, 4, "R", 6, "mark").text === "22" &&
      railCell(knit, 4, "R", 19, "number").text === "120" &&
      railCell(knit, 4, "R", 19, "number").fill === "#90D8FC" &&
      railCell(knit, 4, "L", 1, "mark").text === "" &&
      railCell(knit, 4, "R", 20, "mark").text === "" &&
      railCell(knit, 3, "L", 12, "mark").text === "10",
    "an opening knit row copies the template rails, including L12 indicator 10",
  );
  assert(
    railCell(knit, 34, "L", 1, "number").text === "6" &&
      railCell(knit, 34, "L", 1, "number").fill === "#00FFFF" &&
      railCell(knit, 34, "R", 1, "number").text === "6" &&
      railCell(knit, 34, "L", 13, "mark").text === "81" &&
      railCell(knit, 34, "L", 11, "mark").text === "14" &&
      railCell(knit, 34, "L", 10, "mark").text === "4" &&
      railCell(knit, 34, "R", 6, "mark").text === "5" &&
      railCell(knit, 34, "L", 12, "mark").text === "" &&
      railCell(knit, 35, "L", 1, "number").text === "7" &&
      railCell(knit, 35, "L", 13, "mark").text === "82",
    "a body front ccw row keeps L1/R1 6, L13 81, L11 14, and R6 5",
  );
  const shown = knitCodeDisplayRows(knit);
  assert(
    shown.length === 48 &&
      shown[0].rowIndex === 47 &&
      shown[0].row.label === "第7环 后床  B12→B1（床图 row 6 / course 6 R，逆时针向左）" &&
      shown[47].rowIndex === 0 &&
      shown[47].row.label === "开头 1" &&
      knit.rows[34].label === "第1环 前床  F0→F12（床图 row 0 / course 0 R，逆时针向右）",
    "opening is drawn under the body, with the first knitted row at the bottom",
  );
  assert(
    knitCodeCaption(knit).startsWith(KNIT_CODE_CAPTION) &&
      knitCodeCaption(knit).includes("按幅宽适配的开头") &&
      knitCodeCaption(knit).includes("开头功能行抄自模板") &&
      knitCodeCaption(knit).includes("主体功能行不变") &&
      knitCodeLegend(knit)
        .map((item) => `${item.code}:${item.name}`)
        .join("|") === KNIT_CODE_LEGEND.map((item) => `${item.code}:${item.name}`).join("|"),
    "Standrad caption names the width-adapted opening and the legend still names 0–12",
  );
  assert(
    knit.colors[51] === "#FF9090" &&
      knit.colors[52] === "#C0FF90" &&
      knit.colors[116] === "#A9E5E7" &&
      knit.colors[117] === "#D8D8B4" &&
      knit.colors[13] === "#999999" &&
      knit.colors[16] === "#51FFDE" &&
      knit.colors[120] === "#90D8FC" &&
      knit.colors[99] === "#7F0000" &&
      knitCodeInk(51, knit.colors).text === "#111111" &&
      knitCodeInk(1, knit.colors).text === "#ffffff" &&
      knitCodeInk(4, knit.colors).text === "#ffffff" &&
      knitCodeInk(99, knit.colors).text === "#ffffff" &&
      knitCodeInk(6, knit.colors).text === "#111111" &&
      knitCodeInk(16, knit.colors).text === "#111111" &&
      knitCodeInk(116, knit.colors).text === "#111111" &&
      knitCodeInk(0, knit.colors).label === "",
    "opening DAT colors keep the Tiffany display palette and the contrast rule",
  );
  assert(
    knitCellTravel(knit.rows[34].winding, knit.rows[34].cells[3])?.text === "向右" &&
      knitCellTravel(knit.rows[35].winding, knit.rows[35].cells[15])?.text === "向左" &&
      knit.rows[35].cells[2] === 0 &&
      knit.rows[35].cells[3] === 13 &&
      knit.rows[35].cells[4] === 2 &&
      knitCellTravel(knit.rows[0].winding, 1)?.text === "向右" &&
      knitCellTravel(knit.rows[0].winding, 2)?.text === "向左" &&
      knitCellTravel(knit.rows[10].winding, 6)?.text === "操作行，无方向" &&
      knitCellTravel(knit.rows[0].winding, 0) == null &&
      describeKnitCell(knit, 34, 3) === "第1环 前床  F0→F12（床图 row 0 / course 0 R，逆时针向右） · 物理针 0 · 1 前床平针" &&
      describeKnitCell(knit, 35, 3) === "第1环 后床  B12→B1（床图 row 0 / course 0 R，逆时针向左） · 物理针 0 · 13" &&
      describeKnitCell(knit, 0, 0).includes("空位"),
    "body travel is unchanged, and opening non-zero cells can show that row's direction",
  );
  const bodyKnit = {
    ...knit,
    rows: knit.rows.filter((row) => row.bind !== false).map((row) => ({
      ...row,
      cells: pattern.filter((col) => col.kind === "needle").map((col) => row.cells[col.needleIndex]),
    })),
  };
  assertShortRowTurnCodes(bodyKnit, "Standrad body", { frame: true });
  assert(
    knit.rows.every((row) => !row.cells.includes(11) && !row.cells.includes(12)),
    "Standrad has no 11 or 12",
  );
  const standradObj = parseColoredObj(readFileSync(join(cylDir, "standrad_cylinder_KnittingStitches.obj"), "utf8"));
  const standradStitches = standradObj.faces.map((face, index) => ({ index, verts: face.verts }));
  const standradLayout = parseFacesRingLayout(readFileSync(join(cylDir, "standrad_cylinder_rings.json"), "utf8"));
  facesRingChunksFromStitches(standradStitches, {
    nRings: standradLayout.nFacesRing,
    termCounts: standradLayout.termCounts,
    ringTypes: standradLayout.ringTypes,
    colors: standradLayout.colors,
  });
  const standradBedMap = parseExcelReadableMap(readFileSync(join(cylDir, "standrad_cylinder_bed.xls")));
  const standradBind = bindKnitCodeStitches(knit, standradBedMap, standradStitches, null);
  const standradF0 = standradBind.byKey.get("34,3");
  assert(
    standradBind.bedTokens === 175 &&
      standradBind.knitCells === 175 &&
      standradBind.unmatched.length === 0 &&
      standradBind.byKey.size === 175 &&
      standradF0?.index === 0 &&
      standradF0.ring === 0 &&
      standradF0.termInRing === 0 &&
      !standradBind.byKey.has("35,3") &&
      !standradBind.byKey.has("0,4") &&
      !standradBind.byKey.has("34,2") &&
      !standradBind.byKey.has("34,16") &&
      !standradBind.byKey.has("35,2") &&
      !standradBind.byKey.has("35,16") &&
      [...standradBind.byKey.keys()].every((key) => Number(key.split(",")[0]) >= 34),
    "opening rows do not bind, frame 13s stay unbound, and body work cells still bind 175/175",
  );
}

{
  const railSpecs = [
    ["Standrad", "cylinder/standrad_cylinder_knitcode.json", 23, null],
    ["Dense Standrad", "dense-standrad/dense_standrad_cylinder_knitcode.json", 35, "98b00ea724e9a071aaab4f0bb8f2df4ab9f6f3409746787937677fb01d9e5bb4"],
    ["Decrease", "decrease/decrease_cylinder_knitcode.json", 22, "f0c5402bbd8796bccc8e1f0dc6eecdabc504a0945a21bba0e5fe967e95dc6b12"],
  ];
  const widths = [];
  for (const [label, rel, width, hash] of railSpecs) {
    const path = join(sampleDir, rel);
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (label === "Standrad") {
      assert(
        knitBodyWorkHash(raw.matrix) === "89099fb437ade1bec61ab04cd3ae12e0def7c1360faf966ae9a7846dfad4f867",
        "Standrad body work-slice sha256 keeps the back 13 against the 2s",
      );
    } else {
      assert(knitMatrixSuffixHash(path) === hash, `${label} matrix-suffix sha256 stays ${hash}`);
    }
    const knit = parseKnitCode(raw);
    assertFunctionRails(knit, width, label);
    widths.push(knitTableColumns(knit).filter((col) => col.role === "pattern").length);
    if (label === "Standrad") assertStandradOpening(knit, raw);
  }
  assert(
    widths.join(",") === "23,35,22" && new Set(widths).size === 3,
    "Standrad stays 23 columns, Dense Standrad is 35, and Decrease is 22",
  );
  assert(
    KNIT_FUNCTION_COLORS[1] === "#FF0000" &&
      KNIT_FUNCTION_COLORS[2] === "#00FF00" &&
      KNIT_FUNCTION_COLORS[3] === "#FFFF00" &&
      KNIT_FUNCTION_COLORS[4] === "#0000FF" &&
      KNIT_FUNCTION_COLORS[5] === "#FF00FF" &&
      KNIT_FUNCTION_COLORS[6] === "#00FFFF" &&
      KNIT_FUNCTION_COLORS[7] === "#FFFFFF" &&
      KNIT_FUNCTION_COLORS[8] === "#4A8999" &&
      KNIT_FUNCTION_COLORS[9] === "#6C2490" &&
      KNIT_FUNCTION_COLORS[10] === "#B4B4D8" &&
      KNIT_FUNCTION_COLORS[11] === "#FF67BD" &&
      KNIT_FUNCTION_COLORS[12] === "#906CB4" &&
      KNIT_FUNCTION_COLORS[13] === "#999999" &&
      KNIT_FUNCTION_COLORS[14] === "#CF90C0" &&
      KNIT_FUNCTION_COLORS[15] === "#8080FF" &&
      KNIT_FUNCTION_COLORS[16] === "#51FFDE" &&
      KNIT_FUNCTION_COLORS[17] === "#5291DB" &&
      KNIT_FUNCTION_COLORS[18] === "#007C91" &&
      KNIT_FUNCTION_COLORS[19] === "#EBEB24" &&
      KNIT_FUNCTION_COLORS[20] === "#B276B2" &&
      knitCodeInk(1).fill === KNIT_FUNCTION_COLORS[1] &&
      knitCodeInk(1).text === "#ffffff" &&
      knitCodeInk(2).fill === KNIT_FUNCTION_COLORS[2] &&
      knitCodeInk(2).text === "#111111" &&
      knitCodeInk(11).fill === KNIT_FUNCTION_COLORS[11] &&
      knitCodeInk(11).text === "#111111" &&
      knitCodeInk(12).fill === KNIT_FUNCTION_COLORS[12] &&
      knitCodeInk(12).text === "#111111" &&
      knitFunctionTextColor("#FF0000") === "#ffffff" &&
      knitFunctionTextColor("#FFFF00") === "#111111" &&
      knitFunctionTextColor("#00FFFF") === "#111111" &&
      knitFunctionTextColor("#FFFFFF") === "#111111" &&
      knitFunctionTextColor("#51FFDE") === "#111111" &&
      knitFunctionTextColor("#EBEB24") === "#111111" &&
      knitFunctionTextColor("#0000FF") === "#ffffff" &&
      knitFunctionTextColor("#6C2490") === "#ffffff" &&
      knitFunctionTextColor("#007C91") === "#ffffff" &&
      KNIT_FUNCTION_COLORS[81] === "#47869C" &&
      KNIT_FUNCTION_COLORS[82] === "#6DA5B4" &&
      knitFunctionTextColor("#47869C") === "#111111" &&
      knitFunctionTextColor("#6DA5B4") === "#111111",
    "function digits use the Tiffany display colors, and light grounds keep dark type",
  );
  const decrease = parseKnitCode(JSON.parse(readFileSync(join(sampleDir, "decrease/decrease_cylinder_knitcode.json"), "utf8")));
  const decreaseBody = (rowIndex) => {
    const drawn = knitTableCells(decrease, rowIndex);
    const body = drawn.find((col) => col.side === "L" && col.pair === 1 && col.slot === "number");
    const bedMark = drawn.find((col) => col.side === "L" && col.pair === 13 && col.slot === "mark");
    return { winding: decrease.rows[rowIndex].winding, body: body.text, fill: body.fill, bed: bedMark.text };
  };
  const cwFrontIndex = decrease.rows.find((row) => row.label.startsWith("第3环 前床  F3→F0")).index;
  const ccwFront = decreaseBody(34);
  const cwFront = decreaseBody(cwFrontIndex);
  const ccwBack = decreaseBody(35);
  const cwBack = decreaseBody(cwFrontIndex + 1);
  assert(
    ccwFront.winding === "ccw" &&
      ccwFront.body === "6" &&
      ccwFront.fill === "#00FFFF" &&
      ccwFront.bed === "81" &&
      cwFront.winding === "cw" &&
      cwFront.body === "7" &&
      cwFront.fill === "#FFFFFF" &&
      cwFront.bed === "81" &&
      ccwBack.winding === "ccw" &&
      ccwBack.body === "7" &&
      ccwBack.bed === "82" &&
      cwBack.winding === "cw" &&
      cwBack.body === "6" &&
      cwBack.fill === "#00FFFF" &&
      cwBack.bed === "82",
    "Decrease clockwise swaps L1/R1 against a counterclockwise row of the same bed",
  );
  const ops = parseKnitCode({
    needles: [0, 1],
    row_winding: ["none", "none", "none"],
    row_labels: ["operation front", "operation back", "operation empty"],
    matrix: [
      [1, 1],
      [2, 0],
      [0, 0],
    ],
  });
  const opCell = (rowIndex, side, pair, slot) =>
    knitTableCells(ops, rowIndex).find((col) => col.side === side && col.pair === pair && col.slot === slot);
  assert(
    knitRowTravelKind(ops.rows[0]) === "none" &&
      opCell(0, "L", 1, "number").text === "1" &&
      opCell(0, "L", 1, "number").fill === "#FF0000" &&
      opCell(0, "R", 1, "number").text === "1" &&
      opCell(0, "L", 13, "mark").text === "81" &&
      opCell(0, "R", 3, "mark").text === "6" &&
      opCell(0, "R", 5, "mark").text === "" &&
      opCell(1, "L", 13, "mark").text === "82" &&
      opCell(1, "L", 13, "mark").fill === "#6DA5B4" &&
      opCell(2, "L", 1, "number").text === "1" &&
      opCell(2, "L", 13, "mark").text === "" &&
      opCell(2, "R", 3, "mark").text === "" &&
      opCell(2, "R", 5, "mark").text === "1" &&
      opCell(2, "R", 5, "mark").fill === "#FF0000" &&
      opCell(2, "L", 7, "mark").text === "12" &&
      opCell(2, "L", 10, "mark").text === "4" &&
      opCell(2, "L", 11, "mark").text === "14" &&
      opCell(2, "R", 6, "mark").text === "5" &&
      opCell(2, "R", 11, "mark").text === "1" &&
      opCell(2, "L", 8, "mark").text === "" &&
      knitFunctionValue({ role: "function", side: "L", pair: 13, slot: "mark" }, ops.rows[2]).fill == null,
    "operation rows keep the constant indicators, and no-knit rows clear R3 and fill R5",
  );
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
  refs.some((r) => /faces_ring0_step4_bed\.xls$/.test(r)),
  "manifest must list the faces-ring0 bed chart",
);
assert(
  !refs.some((r) => /iteration_0_cut_readable_map_step4_ring0\.xls$/.test(r) || /iteration_0_cut_readable_map\.txt$/.test(r)),
  "manifest must not list the removed 示例 bed",
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
  refs.some((r) => /faces_ring0_step4_bed\.txt$/.test(r)),
  "manifest keeps the faces-ring0 txt companion",
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
if (fromManifest.outputs.length !== 1) throw new Error("expected only the faces-ring0 sample output");
const facesOut = fromManifest.outputs[0];
if (!/faces_ring0_step4_bed\.xls$/i.test(facesOut.readableMapFile?.name || "")) {
  throw new Error("sample output must open faces_ring0_step4_bed.xls");
}
if (!/faces_ring0_step4_bed\.txt$/i.test(facesOut.readableMapTxtFile?.name || "")) {
  throw new Error("faces-ring0 output must keep its own txt");
}
if (!facesOut.stitchFile) throw new Error("expected stitch file");
if (!facesOut.readableMapFile) throw new Error("expected readable_map");
if (!facesOut.colsResampleFile) throw new Error("expected cols_resample field");
if (!facesOut.colsResampleXlsFile) throw new Error("expected cols_resample xls");
if (facesOut.colsResampleJsonFile) throw new Error("sample should not ship a cols_resample sidecar");
if (!facesOut.firstRowsFile) throw new Error("expected first_rows xls");
if (!facesOut.facesRingLayoutFile) throw new Error("expected faces_ring_layout.json");
if (!facesOut.stitchMapBindFile) throw new Error("expected stitch_map_bind.json");
{
  const zoomed = knitZoomedScroll(200, 40, 1, 2);
  const mainText = readFileSync(join(root, "src", "main.js"), "utf8");
  const cssText = readFileSync(join(root, "src", "style.css"), "utf8");
  assert(
    KNIT_ZOOM_MIN === 0.05 &&
      KNIT_ZOOM_MAX === 3 &&
      clampKnitZoom(0.01) === 0.05 &&
      clampKnitZoom(0.05) === 0.05 &&
      clampKnitZoom(0.1) === 0.1 &&
      clampKnitZoom(9) === 3 &&
      clampKnitZoom(1.25) === 1.25 &&
      clampKnitZoom("nope") === 1 &&
      knitZoomFactor(0) === 1 &&
      knitZoomFactor(100) < 1 &&
      knitZoomFactor(-100) > 1 &&
      Math.abs(zoomed - 440) < 1e-9 &&
      mainText.includes("onKnitWheel") &&
      mainText.includes('{ passive: false }') &&
      mainText.includes("zoomKnitToward") &&
      cssText.includes("--knit-scale") &&
      cssText.includes("--knit-fit: min(1, var(--knit-scale))") &&
      cssText.includes("--knit-line: calc(1px * var(--knit-fit))") &&
      cssText.includes("--knit-border:") &&
      cssText.includes("--knit-hair:") &&
      cssText.includes("--knit-idx: calc(40px * var(--knit-fit))") &&
      cssText.includes("font-size: calc(13px * var(--knit-fit))") &&
      cssText.includes("left: var(--knit-idx)"),
    "knitting-code wheel zoom stays between 0.05× and 3× and anchors on the cursor",
  );
}
{
  const bedText = readFileSync(join(cylDir, "faces_ring0_step4_bed.txt"), "utf8");
  const shaFile = (name) => createHash("sha256").update(readFileSync(join(cylDir, name))).digest("hex");
  assert(
    shaFile("faces_ring0_step4_bed.txt") === "061985c9a5b659ff5b6064997741778a8b3249231c817231f4096f2b31034a6d" &&
      shaFile("faces_ring0_step4_bed.xls") === "170e217b55d30ad35011d2b45c82e25a2f3fe38d9b7f2662324f1a2d85537335" &&
      shaFile("faces_ring0_v2.dat") === "c8a902477e63db902931386067fda9355d293a17304fe046af695e1b180b90e4" &&
      shaFile("faces_ring0_v2.k") === "1458e5427ab4f4604080567c17920b38200e20d52a93ecac0ce784b229bd2850" &&
      shaFile("iteration_0_cut_cols_resample_field.obj") === "e02cb833c957f76454103d8c04f9ae623d7d1f3737069806e7bc1f09f3d80ca6" &&
      shaFile("iteration_0_cut_cols_resample_type.obj") === "3807252b4c17a350d9b2d370d826bc6ea9095e39aad9132142f5fc61d935c82b" &&
      shaFile("iteration_0_cut_cols_resample.xls") === "97cd70e63c7a060d636921f32dca785c90faa1b0d1c1b7c7759c4d11fa6180e8" &&
      !existsSync(join(cylDir, "faces_ring0_knitcode.dat")) &&
      !existsSync(join(cylDir, "faces_ring0_knitcode.k")),
    "official Bunny bed, dat, k, and columns stay put and no knitting-code .dat/.k is exported",
  );
  assert(
    facesOut.knitCodeFile?.name === "faces_ring0_knitcode.json",
    "faces-ring0 manifest hangs the Bunny knitting-code table",
  );
  const bunnyRaw = JSON.parse(readFileSync(join(cylDir, "faces_ring0_knitcode.json"), "utf8"));
  const bunny = parseKnitCode(bunnyRaw);
  const bunnyMap = parseExcelReadableMap(readFileSync(join(cylDir, "faces_ring0_step4_bed.xls")));
  const bunnyBind = bindKnitCodeStitches(bunny, bunnyMap, null, null);
  const sheetOps = [];
  for (const part of bedText.split(/\n(?=  row )/)) {
    const head = part.match(/^  row (\d+) (\S+)/);
    if (!head) continue;
    const token = part.match(/(⬆|⬇)@([FB])(\d+)/);
    const arrow = part.match(/course (\d+):[^\n]*([FB])(\d+)→([FB])(\d+)/);
    sheetOps.push({
      row: Number(head[1]),
      dir: head[2],
      glyph: token?.[1] || "",
      bed: token?.[2] || "",
      phys: token ? Number(token[3]) : null,
      course: arrow ? Number(arrow[1]) : null,
      from: arrow ? `${arrow[2]}${arrow[3]}` : "",
      to: arrow ? `${arrow[4]}${arrow[5]}` : "",
    });
  }
  const flips = sheetOps.filter((row) => row.dir === "Flip");
  const transfers = [];
  for (const part of bedText.split(/\n(?=  row )/)) {
    const head = part.match(/^  row (\d+) (\S+)/);
    if (!head || (head[2] !== "X" && head[2] !== "X+")) continue;
    const note = part.match(/course \d+:.*/)?.[0] || "";
    const tokens = [...part.matchAll(/([FB][←→])@[FB](-?\d+)/g)].map((match) => ({
      glyph: match[1],
      phys: Number(match[2]),
    }));
    const move = /移圈|套到/.test(note) || (head[2] === "X+" && /partial increase move|Transfer this increase/.test(note));
    const rack = /Rack|clear B\d+ with a|front seats toward|counts match and the beds are one needle apart/.test(note);
    transfers.push({ row: Number(head[1]), dir: head[2], note, tokens, kind: move ? "move" : rack ? "rack" : "other" });
  }
  const knits = sheetOps.filter((row) => row.dir === "R" || row.dir === "L");
  const drawnFlips = bunny.rows.filter((row) => row.role === "flip");
  const shiftOf = {
    "F←": { code: 21, companion: 30, delta: -1, role: "transfer-front" },
    "F→": { code: 24, companion: 30, delta: 1, role: "transfer-front" },
    "B←": { code: 31, companion: 20, delta: -1, role: "transfer-back" },
    "B→": { code: 34, companion: 20, delta: 1, role: "transfer-back" },
  };
  const codeAt = (row, phys) => {
    const needleIndex = bunny.columns.findIndex((col) => col.needle === phys);
    return { needleIndex, code: row.cells[needleIndex] };
  };
  const railAt = (rowIndex, side, pair, slot) =>
    knitTableCells(bunny, rowIndex).find(
      (col) => col.role === "function" && col.side === side && col.pair === pair && col.slot === slot,
    );
  const bedRows = new Set(bunny.rows.map((row) => row.bedRow).filter((row) => row != null));
  assert(
    bunny.model === "Bunny" &&
      flips.length === 16 &&
      drawnFlips.length === 16 &&
      bunnyRaw.n_flip_rows === 16 &&
      bunnyRaw.n_transfer_pairs === 68 &&
      bunnyRaw.n_loop_move_pairs === 33 &&
      bunnyRaw.n_balance_pairs === 35 &&
      bunnyRaw.n_transfer_rows_omitted === 0 &&
      bunnyRaw.n_rows === 291 &&
      bunnyRaw.n_cols === 29 &&
      bunnyRaw.n_knit_rows === 105 &&
      bunnyRaw.n_opening_rows === 34 &&
      transfers.length === 68 &&
      transfers.filter((row) => row.kind === "move").length === 33 &&
      transfers.filter((row) => row.kind === "rack").length === 35 &&
      transfers.every((row) => row.kind !== "other") &&
      knits.length > 0 &&
      knits.every((row) => bedRows.has(row.row)) &&
      transfers.every((row) => bunny.rows.filter((item) => item.bedRow === row.row).length === 2) &&
      flips.every((row) => bedRows.has(row.row)) &&
      bunny.rows.filter((row) => row.bedRow == null).length === 34 &&
      bunny.rows.at(-1).bedRow === Math.max(...sheetOps.map((row) => row.row)) &&
      bunny.needles[0] === -1 &&
      bunny.needles.at(-1) === 19 &&
      !bunny.rows.some((row) => row.label.includes("收针") || row.label.includes("结尾")),
    "Bunny draws every official flip and all 68 transfer rows, with no omitted rack",
  );
  for (const flip of flips) {
    const rows = bunny.rows.filter((row) => row.bedRow === flip.row);
    const forward = flip.glyph === "⬆" && flip.bed === "F" && flip.from === `F${flip.phys}` && flip.to === `B${flip.phys}`;
    const back = flip.glyph === "⬇" && flip.bed === "B" && flip.from === `B${flip.phys}` && flip.to === `F${flip.phys}`;
    const code = forward ? 20 : back ? 30 : 0;
    const placed = rows.length === 1 ? codeAt(rows[0], flip.phys) : { code: null };
    const live = rows.length === 1 ? rows[0].cells.filter((value) => value !== 0) : [];
    assert(
      rows.length === 1 &&
        code !== 0 &&
        placed.code === code &&
        live.length === 1 &&
        live[0] === code &&
        !rows[0].cells.includes(13) &&
        rows[0].winding === "none" &&
        rows[0].bind === false &&
        rows[0].functionRails == null &&
        rows[0].label.includes(code === 20 ? "前床翻后床" : "后床翻前床") &&
        rows[0].label.includes(`course ${flip.course}`) &&
        rows[0].label.includes("无方向") &&
        !rows[0].label.includes("向左") &&
        !rows[0].label.includes("向右"),
      `bed flip row ${flip.row} draws ${code} on needle ${flip.phys}`,
    );
    const l13 = railAt(rows[0].index, "L", 13, "mark");
    const l1 = railAt(rows[0].index, "L", 1, "number");
    const r1 = railAt(rows[0].index, "R", 1, "number");
    const r3 = railAt(rows[0].index, "R", 3, "mark");
    const r5 = railAt(rows[0].index, "R", 5, "mark");
    const unspecified = railAt(rows[0].index, "L", 8, "mark");
    const ink = knitCodeInk(code, bunny.colors);
    assert(
      l13.text === "0" &&
        l13.fill === "#000000" &&
        l13.ink === "#ffffff" &&
        l1.text === "1" &&
        l1.fill === "#FF0000" &&
        r1.text === "1" &&
        r3.text === "0" &&
        r3.fill === "#000000" &&
        r5.text === "1" &&
        r5.fill === "#FF0000" &&
        unspecified.text === "" &&
        unspecified.fill == null &&
        railAt(rows[0].index, "L", 7, "mark").text === "12" &&
        knitCellTravel(rows[0].winding, code)?.text === "操作行，无方向" &&
        !String(knitCellTravel(rows[0].winding, code)?.text || "").includes("向左") &&
        !String(knitCellTravel(rows[0].winding, code)?.text || "").includes("向右") &&
        describeKnitCell(bunny, rows[0].index, placed.needleIndex).includes(code === 20 ? "前床翻后床" : "后床翻前床") &&
        ink.label === String(code) &&
        (code === 20
          ? ink.fill === "#B276B2" && ink.text === "#111111"
          : ink.fill === "#7373B2" && ink.text === "#ffffff"),
      `flip row ${flip.row} uses the flip rails and shows ${code}`,
    );
  }
  const examples = [
    [6, 30, 18],
    [22, 20, 19],
    [36, 20, 18],
    [140, 30, 9],
    [165, 20, 7],
  ];
  for (const [bedRow, code, phys] of examples) {
    const row = bunny.rows.find((item) => item.bedRow === bedRow && item.role === "flip");
    assert(codeAt(row, phys).code === code, `map flip row ${bedRow} is ${code} on needle ${phys}`);
  }
  const codeCounts = { 21: 0, 24: 0, 31: 0, 34: 0 };
  for (const move of transfers.filter((row) => row.kind === "move")) {
    const pair = bunny.rows.filter((row) => row.bedRow === move.row);
    const spec = shiftOf[move.tokens[0]?.glyph];
    const sources = move.tokens.map((token) => token.phys);
    const same = move.tokens.every((token) => token.glyph === move.tokens[0].glyph);
    const shift = pair[0];
    const companion = pair[1];
    const placed = (row, phys) => (row ? codeAt(row, phys).code : null);
    const sourceOk = Boolean(spec) && sources.every((phys) => placed(shift, phys) === spec.code);
    const destOk = Boolean(spec) && sources.every((phys) => placed(companion, phys + spec.delta) === spec.companion);
    const elsewhere = (row, needles, code) =>
      bunny.needles.every((phys) => needles.includes(phys) || placed(row, phys) !== code);
    const l13s = pair.map((row) => railAt(row.index, "L", 13, "mark"));
    const wanted = spec?.role === "transfer-front" ? "81" : "82";
    if (spec) codeCounts[spec.code] += 1;
    assert(
      pair.length === 2 &&
        same &&
        spec &&
        shift.role === spec.role &&
        companion.role === spec.role &&
        shift.winding === "none" &&
        companion.winding === "none" &&
        shift.bind === false &&
        companion.bind === false &&
        shift.functionRails == null &&
        !shift.cells.includes(13) &&
        !companion.cells.includes(13) &&
        sourceOk &&
        destOk &&
        elsewhere(shift, sources, spec.code) &&
        Boolean(spec) &&
        elsewhere(companion, sources.map((phys) => phys + spec.delta), spec.companion) &&
        l13s.every((cell) => cell.text === wanted && (wanted === "81" ? cell.fill === "#47869C" : cell.fill === "#6DA5B4")) &&
        pair.every((row) => railAt(row.index, "L", 1, "number").text === "1") &&
        pair.every((row) => railAt(row.index, "R", 1, "number").text === "1") &&
        pair.every((row) => railAt(row.index, "R", 3, "mark").text === "0" && railAt(row.index, "R", 3, "mark").fill === "#000000") &&
        pair.every((row) => railAt(row.index, "R", 5, "mark").text === "1") &&
        pair.every((row) => railAt(row.index, "L", 8, "mark").text === "") &&
        shift.label.startsWith("移针  ") &&
        companion.label.startsWith("移针回翻") &&
        !shift.label.includes("向左") &&
        !shift.label.includes("向右") &&
        !companion.label.includes("向左") &&
        !companion.label.includes("向右") &&
        knitCellTravel(shift.winding, spec.code)?.text === "操作行，无方向" &&
        knitCellTravel(companion.winding, spec.companion)?.text === "操作行，无方向",
      `bed transfer row ${move.row} draws ${spec?.code || "?"} then ${spec?.companion || "?"} one needle along the arrow`,
    );
  }
  assert(
    codeCounts[21] === 5 && codeCounts[24] === 7 && codeCounts[31] === 5 && codeCounts[34] === 16,
    "loop moves are 5 front-left, 7 front-right, 5 back-left, and 16 back-right",
  );
  const row5 = transfers.find((row) => row.row === 5);
  const row28 = transfers.find((row) => row.row === 28);
  const row63 = bunny.rows.filter((row) => row.bedRow === 63);
  assert(
    row5.kind === "move" &&
      row5.tokens[0].glyph === "F←" &&
      row28.kind === "move" &&
      row28.tokens[0].glyph === "B→" &&
      codeAt(row63[1], -1).code === 30 &&
      codeAt(row63[0], 0).code === 21 &&
      bunny.rows.find((row) => row.bedRow === 5 && row.label.startsWith("移针  "))?.label ===
        "移针  前床左移 21 · F2…F18（床图 row 5 / course 3 X，操作行，无方向）" &&
      bunny.rows.find((row) => row.bedRow === 28 && row.label.startsWith("移针  "))?.label ===
        "移针  后床右移 34 · B0…B15（床图 row 28 / course 16 X，操作行，无方向）",
    "the earlier loop-move pairs keep their needle-index direction",
  );
  const heads = new Map();
  for (const part of bedText.split(/\n(?=  row )/)) {
    const head = part.match(/^  row (\d+) /);
    if (head) heads.set(Number(head[1]), part.split("\n")[0]);
  }
  const spanOf = (line, bed) => {
    const patterns = bed === "F"
      ? [/前\d+\[(-?\d+)…(-?\d+)\]/, /F\d+\[(-?\d+)…(-?\d+)\]/]
      : [/后\d+\[(-?\d+)…(-?\d+)\]/, /B\d+\[(-?\d+)…(-?\d+)\]/];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return [Number(match[1]), Number(match[2])];
    }
    return null;
  };
  const balanceCounts = { 21: 0, 24: 0, 31: 0, 34: 0 };
  for (const rack of transfers.filter((row) => row.kind === "rack")) {
    const before = { F: spanOf(heads.get(rack.row), "F"), B: spanOf(heads.get(rack.row), "B") };
    const after = { F: spanOf(heads.get(rack.row + 1), "F"), B: spanOf(heads.get(rack.row + 1), "B") };
    const changed = ["F", "B"].filter((bed) => before[bed] && after[bed] && (before[bed][0] !== after[bed][0] || before[bed][1] !== after[bed][1]));
    const bed = changed[0];
    const delta = after[bed][0] - before[bed][0];
    const spec = bed === "F"
      ? delta < 0
        ? { code: 21, companion: 30, delta, role: "transfer-front" }
        : { code: 24, companion: 30, delta, role: "transfer-front" }
      : delta < 0
        ? { code: 31, companion: 20, delta, role: "transfer-back" }
        : { code: 34, companion: 20, delta, role: "transfer-back" };
    const pair = bunny.rows.filter((row) => row.bedRow === rack.row);
    const sources = [];
    for (let phys = before[bed][0]; phys <= before[bed][1]; phys += 1) sources.push(phys);
    const word = /front seats toward/.test(rack.note) ? "回座" : /Rack the back \+1|clear B\d+ with a/.test(rack.note) ? "整床横移" : "平衡";
    const placed = (row, phys) => codeAt(row, phys).code;
    balanceCounts[spec.code] += 1;
    assert(
      changed.length === 1 &&
        (delta === 1 || delta === -1) &&
        delta === after[bed][1] - before[bed][1] &&
        pair.length === 2 &&
        pair.every((row) => row.role === spec.role && row.winding === "none" && row.bind === false && !row.cells.includes(13)) &&
        sources.every((phys) => placed(pair[0], phys) === spec.code) &&
        sources.every((phys) => placed(pair[1], phys + delta) === spec.companion) &&
        pair[0].label.includes(word) &&
        pair[1].label.includes(word) &&
        !pair[0].label.includes("向左") &&
        !pair[0].label.includes("向右") &&
        railAt(pair[0].index, "L", 13, "mark").text === (spec.role === "transfer-front" ? "81" : "82") &&
        railAt(pair[1].index, "L", 13, "mark").text === (spec.role === "transfer-front" ? "81" : "82"),
      `balance bed row ${rack.row} follows the window by ${delta} on ${bed}`,
    );
  }
  const row65 = bunny.rows.filter((row) => row.bedRow === 65);
  assert(
    balanceCounts[21] === 4 &&
      balanceCounts[24] === 1 &&
      balanceCounts[31] === 23 &&
      balanceCounts[34] === 7 &&
      row65[0].label.includes("前床右移 24") &&
      row65[0].label.includes("F-1…F16") &&
      row65[0].label.includes("回座") &&
      row65[1].label.includes("落在 F0…F17") &&
      codeAt(row65[0], -1).code === 24 &&
      codeAt(row65[0], 16).code === 24 &&
      codeAt(row65[1], 0).code === 30 &&
      codeAt(row65[1], 17).code === 30 &&
      railAt(row65[0].index, "L", 13, "mark").text === "81" &&
      railAt(row65[1].index, "L", 13, "mark").text === "81" &&
      railAt(row65[0].index, "R", 3, "mark").text === "0" &&
      railAt(row65[0].index, "R", 5, "mark").text === "1",
    "bed row 65 reseats F-1…F16 one needle higher as 24, then 30 on F0…F17",
  );
  for (const row of bunny.rows) {
    if (row.bedRow == null || (row.winding !== "ccw" && row.winding !== "cw")) continue;
    const live = [];
    row.cells.forEach((code, index) => {
      if (code === 1 || code === 2 || code === 11 || code === 12) live.push(index);
    });
    const l13 = railAt(row.index, "L", 13, "mark");
    const l1 = railAt(row.index, "L", 1, "number");
    const r1 = railAt(row.index, "R", 1, "number");
    assert(
      live.length > 0 &&
        row.cells[live[0] - 1] === 13 &&
        row.cells[live[live.length - 1] + 1] === 13 &&
        !row.cells.includes(20) &&
        !row.cells.includes(30) &&
        !row.cells.includes(21) &&
        !row.cells.includes(24) &&
        !row.cells.includes(31) &&
        !row.cells.includes(34) &&
        row.functionRails == null &&
        (l13.text === "81" || l13.text === "82") &&
        (l1.text === "6" || l1.text === "7") &&
        l1.text === r1.text &&
        railAt(row.index, "R", 3, "mark").text === "6" &&
        railAt(row.index, "R", 5, "mark").text === "" &&
        (knitCellTravel(row.winding, row.cells[live[0]])?.text === "向左" ||
          knitCellTravel(row.winding, row.cells[live[0]])?.text === "向右"),
      `knit bed row ${row.bedRow} keeps its direction, 13s, and rails`,
    );
  }
  const columns = knitTableColumns(bunny);
  const decreaseKnit = parseKnitCode(
    JSON.parse(readFileSync(join(sampleDir, "decrease/decrease_cylinder_knitcode.json"), "utf8")),
  );
  assert(
    Object.keys(KNIT_FUNCTION_COLORS).length === 256 &&
      KNIT_FUNCTION_COLORS[20] === "#B276B2" &&
      KNIT_FUNCTION_COLORS[21] === "#FCB46C" &&
      KNIT_FUNCTION_COLORS[22] === "#FC9463" &&
      KNIT_FUNCTION_COLORS[24] === "#FCD8FC" &&
      KNIT_FUNCTION_COLORS[30] === "#7373B2" &&
      KNIT_FUNCTION_COLORS[31] === "#90D848" &&
      KNIT_FUNCTION_COLORS[34] === "#EBEBAC" &&
      knitCodeInk(20).fill === "#B276B2" &&
      knitCodeInk(20).label === "20" &&
      knitCodeInk(21).fill === "#FCB46C" &&
      knitCodeInk(24).fill === "#FCD8FC" &&
      knitCodeInk(30).label === "30" &&
      knitCodeInk(30).fill === "#7373B2" &&
      knitCodeInk(30).text === "#ffffff" &&
      knitCodeInk(31).fill === "#90D848" &&
      knitCodeInk(34).fill === "#EBEBAC" &&
      columns.filter((col) => col.role === "gap" && col.side === "left").length === KNIT_FUNCTION_GAP &&
      columns.filter((col) => col.role === "gap" && col.side === "right").length === KNIT_FUNCTION_GAP &&
      KNIT_FUNCTION_GAP === 5 &&
      columns.filter((col) => col.role === "function" && col.side === "L").length === KNIT_FUNCTION_PAIRS * 2 &&
      knitCodeCaption(bunny).includes("翻针已画：前床翻后床 20，后床翻前床 30") &&
      knitCodeCaption(bunny).includes("移针已画成两行") &&
      knitCodeCaption(bunny).includes("平衡、整床横移和回座用同样的两行") &&
      !knitCodeCaption(bunny).includes("移针未画") &&
      !knitCodeCaption(bunny).includes("平衡不画") &&
      !knitCodeCaption(bunny).includes("移针/翻针未画") &&
      knitCodeCaption(bunny).includes("开头功能行抄自模板") &&
      knitCodeCaption(decreaseKnit).includes("平衡、整床横移和回座用同样的两行") &&
      !knitCodeCaption(decreaseKnit).includes("移针/翻针未画") &&
      knitCodeLegend(bunny)
        .map((item) => item.code)
        .join(",") === "1,11,2,12,20,21,24,30,31,34,0" &&
      bunnyBind.unmatched.length === 0 &&
      bunnyBind.knitCells === bunnyBind.bedTokens &&
      bunnyBind.byKey.size === bunnyBind.knitCells &&
      bunny.rows
        .filter((row) => row.role === "flip" || row.role === "transfer-front" || row.role === "transfer-back")
        .every((row) => ![...bunnyBind.byKey.keys()].some((key) => key.startsWith(`${row.index},`))),
    "flip colours, rails, caption, and stitch binding stay inside the locked knit-code rules",
  );
  const diskEntries = readdirSync(cylDir)
    .map((name) => ({ name, path: `cylinder/${name}` }))
    .filter((entry) => /\.(xls|xlsx|obj|json|txt)$/i.test(entry.name));
  const discovered = projectFromDiscovery(indexFiles(diskEntries));
  assert(!discovered.outputs[0].knitCodeFile, "folder discovery does not attach Standrad knitting code to Bunny");
}

function assertOfficialStripeTables() {
  const bunnyPath = join(sampleDir, "cylinder/faces_ring0_knitcode.json");
  assert(
    createHash("sha256").update(readFileSync(bunnyPath)).digest("hex") ===
      "47b8cf229adfe257eecc169b50a9b757f4e3b590b0730717b7e127abb19d4603",
    "Official Bunny knitting code stays the audited table",
  );
  const standrad = JSON.parse(readFileSync(join(sampleDir, "cylinder/standrad_cylinder_knitcode.json"), "utf8"));
  const tables = [
    ["cylinder/standrad_cylinder_knitcode.json", 14, 0, 0, 0, 48, 0, 12, 0],
    ["increase/increase_cylinder_knitcode.json", 24, 1, 7, 5, 83, -2, 11, 0],
    ["decrease/decrease_cylinder_knitcode.json", 32, 5, 8, 10, 107, 0, 11, 0],
    ["thin/thin_cylinder_knitcode.json", 56, 8, 20, 18, 174, -2, 11, 2],
    ["fat/fat_cylinder_knitcode.json", 83, 7, 19, 17, 196, -4, 12, 0],
    ["dense-standrad/dense_standrad_cylinder_knitcode.json", 30, 0, 0, 0, 64, 0, 24, 0],
    ["dense-increase/dense_increase_cylinder_knitcode.json", 86, 3, 19, 12, 185, -2, 22, 0],
    ["dense-decrease/dense_decrease_cylinder_knitcode.json", 103, 12, 19, 17, 221, 0, 22, 1],
    ["dense-thin/dense_thin_cylinder_knitcode.json", 214, 22, 44, 40, 438, -4, 23, 2],
    ["dense-fat/dense_fat_cylinder_knitcode.json", 275, 15, 43, 40, 490, -5, 23, 0],
  ];
  for (const [rel, knits, flips, loops, balances, rows, lo, hi, closes] of tables) {
    const raw = JSON.parse(readFileSync(join(sampleDir, rel), "utf8"));
    const knit = parseKnitCode(raw);
    const mark = (row, side, pair) =>
      knitTableCells(knit, row.index).find((col) => col.role === "function" && col.side === side && col.pair === pair && col.slot === "mark");
    assert(
      raw.n_opening_rows === 34 &&
        raw.n_knit_rows === knits &&
        raw.n_flip_rows === flips &&
        raw.n_loop_move_pairs === loops &&
        raw.n_balance_pairs === balances &&
        raw.n_transfer_pairs === loops + balances &&
        raw.n_transfer_rows_omitted === 0 &&
        raw.n_rows === rows &&
        raw.n_rows === 34 + knits + flips + (loops + balances) * 2 &&
        knit.needles[0] === lo &&
        knit.needles.at(-1) === hi &&
        (raw.close_calls || []).length === closes &&
        JSON.stringify(raw.function_rails.slice(0, 34)) === JSON.stringify(standrad.function_rails.slice(0, 34)) &&
        JSON.stringify(raw.row_winding.slice(0, 34)) === JSON.stringify(standrad.row_winding.slice(0, 34)) &&
        !raw.row_labels.some((label) => label.includes("收针") || label.includes("结尾")) &&
        !raw.rules.operations_omitted.includes("整行省略") &&
        raw.rules.colors_tiffany_display["20"] === "#B276B2" &&
        raw.rules.colors_tiffany_display["30"] === "#7373B2" &&
        raw.rules.colors_tiffany_display["81"] === "#47869C" &&
        raw.rules.colors_tiffany_display["82"] === "#6DA5B4" &&
        Object.keys(raw.rules.colors_tiffany_display).length === 256,
      `${raw.model} keeps the locked official counts, opening, and palette`,
    );
    const byBed = new Map();
    for (const row of knit.rows) {
      if (row.bedRow == null) continue;
      const list = byBed.get(row.bedRow) || [];
      list.push(row);
      byBed.set(row.bedRow, list);
    }
    for (const row of knit.rows) {
      if (row.bedRow == null) continue;
      if (row.winding === "ccw" || row.winding === "cw") {
        const live = [];
        row.cells.forEach((code, index) => {
          if (code === 1 || code === 2 || code === 11 || code === 12) live.push(index);
        });
        const frames = [];
        row.cells.forEach((code, index) => {
          if (code === 13) frames.push(index);
        });
        assert(
          row.role == null && live.length > 0 && frames.length === 2 && frames[0] === live[0] - 1 && frames[1] === live.at(-1) + 1,
          `${raw.model} knit row ${row.index} keeps tight 13s`,
        );
        const front = row.cells.includes(1) || row.cells.includes(11);
        assert(mark(row, "L", 13).text === (front ? "81" : "82") && mark(row, "R", 5).text === "", `${raw.model} knit rails ${row.index}`);
      } else {
        assert(row.winding === "none" && row.bind === false && !row.cells.includes(13), `${raw.model} operation row ${row.index} has no direction and no 13`);
        const code = row.cells.find((value) => value !== 0);
        if (row.role === "flip") {
          assert((code === 20 || code === 30) && mark(row, "L", 13).text === "0" && mark(row, "R", 3).text === "0" && mark(row, "R", 5).text === "1", `${raw.model} flip rails ${row.bedRow}`);
        } else {
          const shift = byBed.get(row.bedRow).find((item) => item.label.startsWith("移针  "));
          const companion = byBed.get(row.bedRow).find((item) => item.label.startsWith("移针回翻"));
          const shiftCode = shift.cells.find((value) => value !== 0);
          const delta = shiftCode === 21 || shiftCode === 31 ? -1 : 1;
          const companionCode = shiftCode === 21 || shiftCode === 24 ? 30 : 20;
          const sources = knit.needles.filter((needle) => shift.cells[knit.columns.find((col) => col.needle === needle).needleIndex] === shiftCode);
          const landed = sources.every((needle) => companion.cells[knit.columns.find((col) => col.needle === needle + delta).needleIndex] === companionCode);
          const want = row.role === "transfer-front" ? "81" : "82";
          assert(
            byBed.get(row.bedRow).length === 2 &&
              landed &&
              companion.cells.filter((value) => value === companionCode).length === sources.length &&
              mark(row, "L", 13).text === want &&
              mark(row, "R", 3).text === "0" &&
              mark(row, "R", 5).text === "1" &&
              (code === shiftCode || code === companionCode),
            `${raw.model} transfer pair ${row.bedRow}`,
          );
        }
      }
    }
  }
  const stray = [];
  for (const entry of readdirSync(sampleDir, { recursive: true })) {
    if (/knitcode\.(dat|k)$/i.test(String(entry))) stray.push(entry);
  }
  assert(stray.length === 0, "no knitting-code .dat or .k was exported");
}

assertOfficialStripeTables();
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
assert(
  !fromDiscovery.outputs[0].readableMapFile && !fromDiscovery.outputs[0].readableMapTxtFile,
  "sample manifest refs no longer carry the iter-0 readable_map",
);
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
  assert(!onDisk.outputs[0].knitCodeFile, "folder discovery does not attach Standrad knitting code to Bunny");
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
if (!isOverlayName("iteration_0_cut_KnittingStitches.obj")) {
  throw new Error("overlay heuristic failed for KnittingStitches");
}

const stitchText = readFileSync(join(cylDir, "iteration_0_cut_KnittingStitches.obj"), "utf8");
const mapText = readFileSync(join(cylDir, "iteration_0_cut_readable_map.txt"), "utf8");
const fieldText = readFileSync(join(cylDir, "iteration_0_cut_cols_resample_field.obj"), "utf8");
const xlsBuf = readFileSync(join(cylDir, "iteration_0_cut_cols_resample.xls"));
const parsed = parseColoredObj(stitchText);
if (parsed.faces.length !== 462) throw new Error(`expected 462 stitch faces, got ${parsed.faces.length}`);
if (parsed.verts.length !== 1760) throw new Error(`expected 1760 stitch verts, got ${parsed.verts.length}`);

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
if (bound.stitches.length !== 462) throw new Error("bind should keep every face");
const row0 = bound.stitches.filter((s) => s.row === 0);
if (row0.length !== 21) throw new Error(`row000 should bind 21 faces, got ${row0.length}`);
if (row0.some((s) => s.col < 0 || s.col > 20)) throw new Error("row000 columns should be 0..20");
if (bound.rowMin !== 0) throw new Error("bound rowMin should be 0");
if (bound.rowMax !== 58) throw new Error(`462 faces on the frozen map stop at row 58, got ${bound.rowMax}`);
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
  const face385 = { index: 385, mapCells: stitchBind.byIndex.get(385)?.cells || [] };
  const decTriple = highlightKeysForStitch(face385, { map: excelMap, grid: excelGrid });
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
  assert(stitchForMapCell(96, 8, stitchBind)?.index === 418, "later-ring decrease span starts at 96,8");
  assert(stitchForMapCell(96, 9, stitchBind)?.index === 418, "later-ring decrease hang+1 lands on 96,9");
  assert(stitchForMapCell(98, 9, stitchBind)?.index === 419, "later-ring row after that X starts at 98,9");
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
  assert(MAP_LABEL_W >= 96, "label column fits 3-digit row, Flip, and a two-character purpose");
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
assert(chunks.length === 462, `faces_ring terms should be 462 faces, got ${chunks.length}`);
assert(chunks[0].index === 0 && chunks[461].index === 461, "terms stay in generation order");

const firstRowsBuf = readFileSync(join(cylDir, "iteration_0_cut_first_rows.xls"));
const firstRows = parseFirstRows({ xls: firstRowsBuf });
assert(firstRows.nSeed === 7, `first_rows seed columns are row_0..row_6, got ${firstRows.nSeed}`);
assert(firstRows.nRings === 6, `path_generate skips seed 0 so N_rings is 6, got ${firstRows.nRings}`);
assert(firstRows.columns.length === 45, `first_rows has one sheet row per resampled col, got ${firstRows.columns.length}`);
assert(firstRows.nRings !== map.rows.length, "do not use readable_map 65 rowNNN ids as slider N");
assert(firstRows.nRings !== firstRows.nSeed, "do not use N_seed=7 as slider N; skip the seed column");

const sidecar = parseFacesRingLayout({
  term_counts: [10, 20, 30, 40, 375],
  n_faces_ring: 5,
});
assert(sidecar.nFacesRing === 5 && sidecar.termCounts[0] === 10, "sidecar term_counts slice generation order");
const sidecarFaces = Array.from({ length: 475 }, (_, index) => ({ index }));
const fromSidecar = facesRingChunksFromStitches(sidecarFaces, {
  nRings: sidecar.nFacesRing,
  termCounts: sidecar.termCounts,
});
assert(fromSidecar.map((c) => c.faces.length).join(",") === "10,20,30,40,375", "sidecar slices faces sequentially");
assert(fromSidecar[0].faces[0].index === 0 && fromSidecar[1].faces[0].index === 10, "rings stay in OBJ face order");

const evenChunks = facesRingChunksFromStitches(bound.stitches, { nRings: firstRows.nRings });
assert(evenChunks.length === 6, `row slider N is first_row rings, got ${evenChunks.length}`);
assert(evenChunks.length !== 65, "slider is not readable_map machine rows");
assert(evenChunks.length !== chunks.length, "slider is not per-term faces_ring");
assert(
  evenChunks.reduce((n, c) => n + c.faces.length, 0) === 462,
  "every stitch face belongs to exactly one first_row ring without sidecar",
);
assert(
  evenChunks.map((c) => c.faces.length).join(",") === "77,77,77,77,77,77",
  "without sidecar, 462 faces split as floor(462/6) across the six rings",
);

const windowed = sliceHalfOpen(evenChunks, 0, 1);
assert(windowed.length === 1 && windowed[0].faces.length === 77, "half-open [0,1) keeps one even-split ring");
const twoRows = sliceHalfOpen(evenChunks, 2, 4);
assert(twoRows.length === 2 && twoRows[0].ring === 2 && twoRows[1].ring === 3, "adjacent handles show two rings");
const ringFaces = stitchesInRingRange(bound.stitches, 0, 1);
assert(ringFaces.length === 77 && ringFaces.every((s) => s.ring === 0), "[0,1) shows only ring 0 terms");
assert(stitchesInRingRange(bound.stitches, 0, 6).length === 462, "even-split [0,N) keeps every face");
assert(facesRingSliderN({ rowChunks: evenChunks, faceChunks: chunks }) === 6, "bound slider N prefers first_row rings");

const layoutText = readFileSync(join(cylDir, "faces_ring_layout.json"), "utf8");
const layout = parseFacesRingLayout(layoutText);
assert(layout.nFacesRing === 6, `sidecar n_faces_ring is 6, got ${layout.nFacesRing}`);
assert(layout.termCounts.join(",") === "42,93,99,126,62,40", `sidecar n_terms, got ${layout.termCounts}`);
assert(layout.termTotal === 462, `term_total is 462, got ${layout.termTotal}`);
assert(layout.edgeColor.r === 0.15 && layout.edgeColor.g === 0.15 && layout.edgeColor.b === 0.15, "edge_color is 0.15 gray");
assert(layout.ringTypes?.length === 6 && layout.ringTypes[0].length === 42, "each ring carries Term.Type[]");
assert(layout.ringTypes[5].length === 40, "last ring types cover all 40 faces");
assert(
  termCountsForRings(462, 6, layout.termCounts).join(",") === "42,93,99,126,62,40",
  "prefix counts already sum to 462",
);

const rowChunks = facesRingChunksFromStitches(bound.stitches, {
  nRings: layout.nFacesRing,
  termCounts: layout.termCounts,
  ringTypes: layout.ringTypes,
  colors: layout.colors,
});
assert(rowChunks.length === 6, `real layout still has 6 rings, got ${rowChunks.length}`);
assert(rowChunks.map((c) => c.faces.length).join(",") === "42,93,99,126,62,40", "rings are 42+93+99+126+62+40");
assert(
  rowChunks.reduce((n, c) => n + c.faces.length, 0) === 462,
  "every KnittingStitches face belongs to a ring",
);
assert(
  rowChunks.map((c) => c.faces.length).join(",") !== "77,77,77,77,77,77",
  "real layout must not even-split 462/6",
);
assert(rowChunks[0].faces[0].index === 0, "ring 0 starts at OBJ face 0");
assert(rowChunks[1].faces[0].index === 42, "ring 1 starts after 42 terms");
assert(rowChunks[5].faces[0].index === 42 + 93 + 99 + 126 + 62, "ring 5 starts at face 422");
assert(rowChunks[5].faces.length === 40 && rowChunks[5].faces[39].index === 461, "last ring width is 40");
assert(
  rowChunks.every((c) => c.faces.every((s, i) => s.termType === layout.ringTypes[c.ring][i])),
  "every face Type is exactly rings[].types, no inference",
);

const typeHist = {};
for (const s of bound.stitches) {
  if (s.termType == null) throw new Error(`missing Term.Type on face ${s.index}`);
  typeHist[s.termType] = (typeHist[s.termType] || 0) + 1;
}
assert(bound.stitches.length === 462, "462 faces");
assert(Object.values(typeHist).reduce((a, b) => a + b, 0) === 462, "sum of types is 462");
assert(typeHist[0] === 313, `Type0=313, got ${typeHist[0]}`);
assert(typeHist[1] === 62, `Type1=62, got ${typeHist[1]}`);
assert(typeHist[2] === 55 && typeHist[3] === 22 && typeHist[4] === 3 && typeHist[5] === 6 && typeHist[6] === 1, "remaining hist matches dump");
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

assert(rowChunks[0].faces[22].termType === 2 && rowChunks[0].faces[22].termColor.r === 0, "ring0 term 22 is black apex");
assert(rowChunks[2].faces[9].termType === 6 && rowChunks[2].faces[9].termColor.b === 1, "ring2 term 9 is blue");
assert(rowChunks[0].faces[25].termType === 1 && rowChunks[0].faces[25].termColor.r === 1, "ring0 term 25 is white apex");
assert(
  rowChunks.every((c) => c.faces.every((s) => s.termColor && Number.isFinite(s.termColor.r))),
  "every typed term has a Term.Type color",
);

assert(activeRingIndex(0, 5) === 4, "full [0,5) active ring is the last / max ring");
assert(activeRingIndex(1, 5) === 4, "second slider 1-5 active ring is 4");
assert(activeRingIndex(0, 1) === 0, "single first ring is active");
assert(activeRingIndex(2, 2) == null, "empty range disables the term slider");

const fullTyped = stitchesVisibleForSliders(bound.stitches, 0, 6, 0, 40);
assert(fullTyped.length === 462, `full rings + full last-ring terms show 462, got ${fullTyped.length}`);
assert(fullTyped.filter((s) => s.ring === 5).length === 40, "default last ring shows all 40 terms");
assert(
  fullTyped.filter((s) => s.ring === 5 && s.index >= 458).every((s) => s.termType === layout.ringTypes[5][s.termInRing]),
  "last-ring tail Types come from sidecar types[], not verts",
);

const lastOne = stitchesVisibleForSliders(bound.stitches, 0, 6, 0, 1);
assert(lastOne.length === 42 + 93 + 99 + 126 + 62 + 1, "earlier rings stay full; only max ring is term-filtered");
assert(lastOne.filter((s) => s.ring === 5).length === 1, "third slider [0,1) keeps one term in the max ring");
assert(lastOne.filter((s) => s.ring < 5).every((s) => s.termInRing != null), "rings [0,5) keep every term");

const clipped = stitchesVisibleForSliders(bound.stitches, 1, 6, 10, 20);
assert(clipped.filter((s) => s.ring === 0).length === 0, "rings < r0 are hidden");
assert(clipped.filter((s) => s.ring === 1).length === 93, "ring 1 in [r0, r1-1) is fully visible");
assert(clipped.filter((s) => s.ring === 2).length === 99, "ring 2 fully visible");
assert(clipped.filter((s) => s.ring === 3).length === 126, "ring 3 fully visible");
assert(clipped.filter((s) => s.ring === 4).length === 62, "ring 4 fully visible");
assert(clipped.filter((s) => s.ring === 5).length === 10, "active ring 5 uses term [10,20)");
assert(clipped.every((s) => s.ring < 6), "rings >= r1 stay hidden");

assert(stitchesVisibleForSliders(bound.stitches, 0, 1, 5, 8).length === 3, "single-ring term window");
assert(stitchesVisibleForSliders(bound.stitches, 2, 2, 0, 10).length === 0, "empty second range hides everything");
assert(stitchesInRingRange(bound.stitches, 0, 6).length === 462, "ring range helper covers every face");

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
assert(xlsRows === 45, `scale_matrix should have 45 column rows, got ${xlsRows}`);
assert(xlsColIds.length === 45, `points_detail col ids should be 0..44, got ${xlsColIds.length}`);
assert(xlsColIds[0] === 0 && xlsColIds[44] === 44, "col ids stay contiguous 0..44");

const fieldCols = parseColsResampleField(fieldText);
assert(fieldCols.length === 45, `field.obj sequential chains should be 45, got ${fieldCols.length}`);

const columns = parseColsResample({ xls: xlsBuf, fieldText });
assert(columns.length === 45, `cylinder cols_resample should be 45, got ${columns.length}`);
assert(columns[0].col === 0 && columns[0].type === "FULL", "idx 0 is the first xls column");
assert(columns[44].col === 44, "idx 44 is the last xls column");
assert(columns[0].points.length === 11, "col 0 keeps its 11 export samples");
assert(
  columns.every((c, i) => c.points.length === fieldCols[i].points.length),
  "xls point counts must match field.obj chains 1:1",
);
assert(
  columns.reduce((n, c) => n + c.points.length, 0) === 445,
  "points_detail + field.obj both hold 445 samples",
);
const visCols = sliceHalfOpen(columns, 0, 1);
assert(visCols.length === 1 && visCols[0].col === 0, "cols_resample [0,1) keeps one column");
assert(sliceHalfOpen(columns, 0, 45).length === 45, "default [0,N) keeps every export column");

const fromFieldOnly = parseColsResample({ fieldText });
assert(fromFieldOnly.length === 45, `field-only sequential parse should be 45, got ${fromFieldOnly.length}`);

const fromSheet0 = parseColsResample({
  workbook: { sheets: workbook.sheets.filter((s) => s.name !== "points_detail") },
  fieldText,
});
assert(fromSheet0.length === 45, `scale_matrix fallback should be 45, got ${fromSheet0.length}`);
assert(fromSheet0[0].type === "FULL" && fromSheet0[0].points.length === 11, "scale_matrix keeps FULL col 0");

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
assert(facesRingSliderN(all.bind) === 6, "right-end binding exposes 6 first_row rings");
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
assert(!html.includes('id="base-cut-heat"') && !html.includes("base-cut-heat-row") && !html.includes("切开热力场"), "Base menu has no cut heat row");
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
assert(!mainSrc.includes("loadCutHeatMesh") && !mainSrc.includes("setShowCutHeat") && !mainSrc.includes("cut-heat.js"), "main does not load a cut heat overlay");
assert(mainSrc.includes("setShowWarp") && mainSrc.includes("#toggle-warp"), "main wires the Warp toggle");
assert(!mainSrc.includes("setWireframe") && !mainSrc.includes("toggle-wire"), "main no longer has a standalone Wire toggle");
assert(!mainSrc.includes("setFlat") && !mainSrc.includes("toggle-shade"), "main no longer wires Flat");
const viewerSrc = readFileSync(join(root, "src", "viewer.js"), "utf8");
assert(viewerSrc.includes("setBaseLayers") && viewerSrc.includes("setShowWarp"), "viewer has Base layers and Warp visibility");
assert(!viewerSrc.includes("setCutHeat") && !viewerSrc.includes("showCutHeat") && !viewerSrc.includes("_cutHeatMaterial"), "viewer does not swap in a heat-colored cut");
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
assert(
  html.includes('id="load-faces-ring0"') && html.includes('id="open-folder"') && html.includes('id="open-files"') && !html.includes('id="load-sample"') && !html.includes("示例"),
  "Bunny / Folder / Files stay as menu items and 示例 is gone",
);
assert(
  /id="load-faces-ring0"[^>]*>Bunny<\/button>/.test(html) &&
    !html.includes("前两环") &&
    !mainSrc.includes("前两环") &&
    mainSrc.includes("加载 Bunny / Loading Bunny…") &&
    mainSrc.includes("Bunny · faces_ring 接在一张床图上") &&
    mainSrc.includes('map.sheet === "ring0" ? "Bunny"'),
  "faces-ring0 is labeled Bunny in the Open menu, status, and sheet header",
);
assert(manifest.outputs[0].label === "Bunny", "faces-ring0 output label is Bunny");
assert(
  html.includes('id="load-bunny-exp-readable-row-schedule"') &&
    html.includes("Bunny 实验（新时序）") &&
    !html.includes("未跑完") &&
    html.indexOf('id="load-bunny-exp-readable-row-schedule"') > html.indexOf('id="load-faces-ring0"') &&
    mainSrc.includes('const BUNNY_EXP_SHEET = "bunny-exp-readable-row-schedule"') &&
    mainSrc.includes("loadBunnyExpReadableRow") &&
    mainSrc.includes("exp-readable-map.xls") &&
    mainSrc.includes("preview-chrome.json") &&
    !existsSync(join(cylDir, "exp-readable-map.xls")) &&
    !existsSync(join(cylDir, "exp-readable-map.txt")) &&
    existsSync(join(root, "experiments/official-bunny-readable-row-schedule/exp-readable-map.xls")) &&
    !existsSync(join(root, "experiments/official-bunny-readable-row-schedule/exp-readable-map.dat")) &&
    !existsSync(join(root, "experiments/official-bunny-readable-row-schedule/exp-knitcode.json")) &&
    !existsSync(join(root, "experiments/bunny-corridor-field-swallow/exp-knitcode.json")),
  "the timing experiment is its own sheet and does not replace the official Bunny bed",
);
const cylinderExpSheets = [
  ["standrad", "Standrad", "load-standrad-cylinder"],
  ["dense-standrad", "Dense Standrad", "load-dense-standrad-cylinder"],
  ["decrease", "Decrease", "load-decrease-cylinder"],
  ["dense-decrease", "Dense Decrease", "load-dense-decrease-cylinder"],
  ["increase", "Increase", "load-increase-cylinder"],
  ["dense-increase", "Dense Increase", "load-dense-increase-cylinder"],
  ["thin", "Thin", "load-thin-cylinder"],
  ["dense-thin", "Dense Thin", "load-dense-thin-cylinder"],
  ["fat", "Fat", "load-fat-cylinder"],
  ["dense-fat", "Dense Fat", "load-dense-fat-cylinder"],
];
const cylinderExpSrc = readFileSync(join(root, "src", "cylinder-exp-sheets.js"), "utf8");
for (const [key, label, officialId] of cylinderExpSheets) {
  const sheetId = `${key}-exp-readable-row-schedule`;
  const buttonId = `load-${sheetId}`;
  const dir = join(root, "experiments", `official-${key}-readable-row-schedule`);
  assert(
    html.includes(`id="${buttonId}"`) &&
      html.includes(`${label} 实验（新时序）`) &&
      html.indexOf(`id="${buttonId}"`) > html.indexOf(`id="${officialId}"`) &&
      cylinderExpSrc.includes(`sheetId: "${sheetId}"`) &&
      mainSrc.includes("loadCylinderExp") &&
      mainSrc.includes("cylinder-exp-sheets.js") &&
      existsSync(join(dir, "exp-readable-map.xls")) &&
      existsSync(join(dir, "exp-readable-map.txt")) &&
      existsSync(join(dir, "exp-knitcode.json")) &&
      existsSync(join(dir, "validation-report.json")) &&
      !existsSync(join(dir, "exp-readable-map.dat")) &&
      !existsSync(join(dir, "exp-readable-map.k")) &&
      !existsSync(join(dir, "exp-knitcode.dat")) &&
      mainSrc.includes('output.knitCode = "exp-knitcode.json"'),
    `${label} timing experiment is its own sheet`,
  );
  const report = JSON.parse(readFileSync(join(dir, "validation-report.json"), "utf8"));
  assert(report.sheetId === sheetId && report.baseline?.unchanged === true, `${label} report keeps the official bed hash`);
  assert(report.firstRing?.identical === true, `${label} first ring matches the official seating`);
}
assert(html.includes('id="load-faces-ring0"') && !html.includes('id="load-faces-ring1"') && mainSrc.includes("faces-ring0") && mainSrc.includes("isFacesRing0BedChart"), "Open menu loads the joined faces-ring bed chart");
assert(!mainSrc.includes("#load-sample") && !mainSrc.includes("load-sample"), "main no longer wires 示例");
assert(
  mainSrc.includes('setSheetQuery("faces-ring0")') && mainSrc.includes('loadSample(sheetQuery() || "faces-ring0")'),
  "default sample load is the faces-ring0 sheet",
);
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
      rels.includes("cylinder/standrad_cylinder_knitcode.json") &&
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
      /standrad_cylinder_knitcode\.json$/i.test(out.knitCodeFile?.name || "") &&
      !out.firstRowsFile &&
      !out.stitchMapBindFile,
    "Standrad Cylinder uses its own bed chart, cols_resample, and knitting code, not the cylinder sheets",
  );
  const standradKnitPath = join(cylDir, "standrad_cylinder_knitcode.json");
  const standradRaw = JSON.parse(readFileSync(standradKnitPath, "utf8"));
  assert(
    knitBodyWorkHash(standradRaw.matrix) ===
      "89099fb437ade1bec61ab04cd3ae12e0def7c1360faf966ae9a7846dfad4f867",
    "Standrad body work-slice sha256 keeps the back 13 against the 2s",
  );
  const knit = parseKnitCode(standradRaw);
  assert(knit?.model === "Standrad Cylinder", "Standrad knitting code keeps its model name");
  assertStandradOpening(knit, standradRaw);
  assert(
    knitCellTravel("ccw", 11)?.text === "向右" &&
      knitCellTravel("cw", 11)?.text === "向左" &&
      knitCellTravel("ccw", 12)?.text === "向左" &&
      knitCellTravel("cw", 12)?.text === "向右" &&
      knitCellTravel("none", 11)?.text === "操作行，无方向" &&
      knitCellTravel("none", 12)?.kind === "none" &&
      knitCellTravel(knit.rows[34].winding, 1)?.arrow === "→" &&
      knit.rows[35].cells[15] === 2 &&
      knitCellTravel(knit.rows[35].winding, 2)?.arrow === "←",
    "Standrad front goes right, back goes left, and 11/12 still follow the bed",
  );
  assert(
    knitCodeInk(1, knit.colors).label === "1" &&
      knitCodeInk(1, knit.colors).fill === "#FF0000" &&
      knitCodeInk(1, knit.colors).text === "#ffffff" &&
      knitCodeInk(2, knit.colors).label === "2" &&
      knitCodeInk(2, knit.colors).fill === "#00FF00" &&
      knitCodeInk(2, knit.colors).text === "#111111" &&
      knitCodeInk(11, knit.colors).label === "11" &&
      knitCodeInk(11, knit.colors).fill === "#FF67BD" &&
      knitCodeInk(11, knit.colors).text === "#111111" &&
      knitCodeInk(12, knit.colors).label === "12" &&
      knitCodeInk(12, knit.colors).fill === "#906CB4" &&
      knitCodeInk(12, knit.colors).text === "#111111" &&
      knitCodeInk(11).fill === "#FF67BD" &&
      knitCodeInk(12).fill === "#906CB4" &&
      knitCodeInk(0, knit.colors).label === "" &&
      knitCodeInk(0, knit.colors).fill === "#000000",
    "knitting-code cells use the Tiffany DAT colors, and empty 0 stays blank",
  );
  assert(
    describeKnitCell(knit, 34, 3) === "第1环 前床  F0→F12（床图 row 0 / course 0 R，逆时针向右） · 物理针 0 · 1 前床平针" &&
      describeKnitCell(knit, 36, 3) === "第2环 前床  F0→F12（床图 row 1 / course 1 R，逆时针向右） · 物理针 0 · 1 前床平针" &&
      describeKnitCell(knit, 35, 3) === "第1环 后床  B12→B1（床图 row 0 / course 0 R，逆时针向左） · 物理针 0 · 13" &&
      describeKnitCell(knit, 35, 15) === "第1环 后床  B12→B1（床图 row 0 / course 0 R，逆时针向左） · 物理针 12 · 2 后床平针",
    "a knitting-code cell names its pass, physical needle, and code",
  );
  assert(
    parseKnitCode({ matrix: [] }) == null &&
      parseKnitCode({ matrix: [[-1]] }) == null &&
      parseKnitCode({ matrix: [[1.5]] }) == null &&
      parseKnitCode({ matrix: [["x"]] }) == null &&
      parseKnitCode({ matrix: [[3]] })?.rows[0].cells[0] === 3 &&
      parseKnitCode({ matrix: [[11, 12, 0, 1, 2]] })?.rows[0].cells.join(",") === "11,12,0,1,2",
    "a knitting-code file rejects non-integers and keeps integer DAT codes",
  );
  assert(KNIT_CODE_CAPTION.includes("空位为 0") && KNIT_CODE_CAPTION.includes("0–12"), "knitting-code caption matches the accepted table");
  const standradShown = knitCodeDisplayRows(knit);
  assert(
    knit.rows[34].label === "第1环 前床  F0→F12（床图 row 0 / course 0 R，逆时针向右）" &&
      standradShown.length === 48 &&
      standradShown[0].rowIndex === 47 &&
      standradShown[0].row.label === "第7环 后床  B12→B1（床图 row 6 / course 6 R，逆时针向左）" &&
      standradShown[0].row.winding === knit.rows[47].winding &&
      standradShown[47].row === knit.rows[0] &&
      standradShown[47].rowIndex === 0 &&
      standradShown[47].row.label === "开头 1" &&
      knit.rows.every(
        (row, index) => standradShown[47 - index].row === row && standradShown[47 - index].row.winding === row.winding,
      ),
    "Standrad knitting code stays chronological in data and is drawn with the first knitted row at the bottom",
  );
  assert(
    knitCodeInitialScrollTop(400, 400) === 0 &&
      knitCodeInitialScrollTop(900, 400) === 500 &&
      knitCodeInitialScrollTop(100, 0) === 100,
    "a tall knitting-code table opens scrolled to the first rings at the bottom",
  );
  const mixed = parseKnitCode({
    row_labels: ["前", "后", "操作", "空"],
    row_winding: ["ccw", "cw", "none", "ccw"],
    matrix: [
      [1, 1],
      [2, 2],
      [1, 2],
      [0, 1],
    ],
  });
  const mixedShown = knitCodeDisplayRows(mixed);
  const right = knitCellTravel("ccw", 1);
  const back = knitCellTravel("ccw", 2);
  const cwFront = knitCellTravel("cw", 1);
  const cwBack = knitCellTravel("cw", 2);
  const operation = knitCellTravel("none", 1);
  const operationBack = knitCellTravel("none", 2);
  assert(
    mixed.rows.map((row) => row.winding).join(",") === "ccw,cw,none,ccw" &&
      mixedShown.map((item) => item.row.winding).join(",") === "ccw,none,cw,ccw" &&
      mixedShown[0].row === mixed.rows[3] &&
      mixedShown[3].row === mixed.rows[0] &&
      right?.text === "向右" &&
      right.arrow === "→" &&
      right.kind === "right" &&
      back?.text === "向左" &&
      back.arrow === "←" &&
      cwFront?.text === "向左" &&
      cwFront.kind === "left" &&
      cwBack?.text === "向右" &&
      cwBack.kind === "right" &&
      operation?.text === "操作行，无方向" &&
      operation.kind === "none" &&
      operation.arrow == null &&
      operationBack?.text === "操作行，无方向" &&
      operationBack.arrow == null &&
      knitCellTravel("ccw", 11)?.text === right.text &&
      knitCellTravel("ccw", 12)?.text === back.text &&
      knitCellTravel("cw", 11)?.text === cwFront.text &&
      knitCellTravel("cw", 12)?.text === cwBack.text,
    "cw and operation rows keep their winding through the bottom-up reverse",
  );
  const unguessed = parseKnitCode({
    matrix: [
      [1, 1, 1],
      [2, 2, 2],
    ],
    row_winding: ["cw"],
  });
  assert(
    knitCellTravel("ccw", 0) == null &&
      knitCellTravel("cw", 0) == null &&
      knitCellTravel("none", 0) == null &&
      knitCellTravel(null, 1) == null &&
      knitCellTravel(undefined, 2) == null &&
      knitCellTravel("CCW", 1) == null &&
      knitRowWinding("ccw") === "ccw" &&
      knitRowWinding("none") === "none" &&
      knitRowWinding("clockwise") == null &&
      unguessed.rows[0].winding === "cw" &&
      unguessed.rows[1].winding == null &&
      knitCellTravel(unguessed.rows[0].winding, 1)?.text === "向左" &&
      knitCellTravel(unguessed.rows[1].winding, 2) == null,
    "empty cells and missing windings have no direction and are not called operation rows",
  );
  assert(
    fromManifest.outputs[0].knitCodeFile?.name === "faces_ring0_knitcode.json",
    "Bunny publishes faces_ring0_knitcode.json",
  );
  for (const name of readdirSync(sampleDir).filter(
    (item) =>
      item.endsWith(".json") &&
      item !== "manifest.json" &&
      item !== "standrad-cylinder.json" &&
      item !== "dense-standrad-cylinder.json" &&
      item !== "decrease-cylinder.json" &&
      item !== "increase-cylinder.json" &&
      item !== "thin-cylinder.json" &&
      item !== "fat-cylinder.json" &&
      item !== "dense-increase-cylinder.json" &&
      item !== "dense-thin-cylinder.json" &&
      item !== "dense-fat-cylinder.json" &&
      item !== "dense-decrease-cylinder.json",
  )) {
    const sheet = JSON.parse(readFileSync(join(sampleDir, name), "utf8"));
    if (!sheet?.outputs) continue;
    assert(
      !collectManifestRefs(sheet).some((rel) => /knitcode|knit_code|knitting_code|knittingcode/i.test(rel)),
      `${name} does not publish a knitting-code table`,
    );
  }
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
  assert(standradFn.includes("sampleEntry"), "Standrad Cylinder loads the bed xls as bytes");
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
      rels.includes("decrease/decrease_cylinder_knitcode.json") &&
      !/knitout|faces_ring0|standrad_cylinder|readable_map/i.test(rels),
    "Decrease Cylinder binds its own stitchmesh, cols_resample, faces ring, bed chart, and knitting code",
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
      /decrease_cylinder_faces_ring_layout\.json$/i.test(out.facesRingLayoutFile?.name || "") &&
      /decrease_cylinder_knitcode\.json$/i.test(out.knitCodeFile?.name || ""),
    "Decrease Cylinder uses its own cols_resample field, xls, faces ring, and knitting code",
  );
  const decreaseKnitPath = join(decDir, "decrease_cylinder_knitcode.json");
  assert(
    knitMatrixSuffixHash(decreaseKnitPath) ===
      "f0c5402bbd8796bccc8e1f0dc6eecdabc504a0945a21bba0e5fe967e95dc6b12",
    "Decrease knitting-code matrix bytes stay the opened short-row table",
  );
  const decreaseRaw = JSON.parse(readFileSync(decreaseKnitPath, "utf8"));
  const decreaseKnit = parseKnitCode(decreaseRaw);
  const decreaseShown = knitCodeDisplayRows(decreaseKnit);
  const bodyRows = decreaseKnit.rows.filter((row) => row.bind !== false);
  const frontCells = bodyRows.reduce((sum, row) => sum + row.cells.filter((code) => code === 1 || code === 11).length, 0);
  const backCells = bodyRows.reduce((sum, row) => sum + row.cells.filter((code) => code === 2 || code === 12).length, 0);
  const turnFront = bodyRows.reduce((sum, row) => sum + row.cells.filter((code) => code === 11).length, 0);
  const turnBack = bodyRows.reduce((sum, row) => sum + row.cells.filter((code) => code === 12).length, 0);
  const bodyWind = decreaseRaw.row_winding.slice(34);
  const needleCol = (phys) => decreaseKnit.columns.find((col) => col.needle === phys).needleIndex;
  const needlesOf = (row) => decreaseKnit.needles.map((phys) => row.cells[needleCol(phys)]).join(",");
  const cwFront = decreaseKnit.rows.find((row) => row.label.startsWith("第3环 前床  F3→F0"));
  const cwBack = decreaseKnit.rows.find((row) => row.label.startsWith("第3环 后床  B9→B10"));
  const skipFront = decreaseKnit.rows.find((row) => row.label.startsWith("第3环 前床  F4→F10"));
  assert(
    decreaseKnit?.model === "Decrease Cylinder" &&
      decreaseRaw.n_rows === 107 &&
      decreaseRaw.n_opening_rows === 34 &&
      decreaseRaw.n_knit_rows === 32 &&
      decreaseRaw.n_body_rows === 73 &&
      decreaseRaw.n_flip_rows === 5 &&
      decreaseRaw.n_transfer_pairs === 18 &&
      decreaseRaw.n_loop_move_pairs === 8 &&
      decreaseRaw.n_balance_pairs === 10 &&
      decreaseRaw.n_transfer_rows_omitted === 0 &&
      decreaseRaw.n_cols === 22 &&
      decreaseRaw.n_rings === 5 &&
      decreaseKnit.rows.length === 107 &&
      decreaseKnit.needles.length === 12 &&
      decreaseKnit.needles.every((n, i) => n === i) &&
      needleCol(0) === 3 &&
      decreaseKnit.colors[11] === "#FF67BD" &&
      decreaseKnit.colors[12] === "#906CB4" &&
      decreaseRaw.row_winding.length === 107 &&
      bodyWind.filter((winding) => winding === "ccw").length === 23 &&
      bodyWind.filter((winding) => winding === "cw").length === 9 &&
      decreaseKnit.rows.every((row, index) => row.winding === decreaseRaw.row_winding[index]) &&
      decreaseKnit.rows.slice(0, 34).every((row) => row.bind === false && row.functionRails) &&
      bodyRows.every((row) => row.bind === true && row.functionRails == null) &&
      decreaseKnit.rows[34].winding === "ccw" &&
      decreaseKnit.rows.at(-1).winding === "ccw" &&
      needlesOf(decreaseKnit.rows[34]) === "1,1,1,1,1,1,1,1,1,1,1,1" &&
      decreaseKnit.rows[34].cells[2] === 13 &&
      decreaseKnit.rows[34].cells[15] === 13 &&
      decreaseKnit.rows[35].cells[2] === 0 &&
      needlesOf(decreaseKnit.rows[35]) === "13,2,2,2,2,2,2,2,2,2,2,2" &&
      cwFront.winding === "cw" &&
      cwFront.cells[needleCol(3)] === 11 &&
      decreaseKnit.rows[cwFront.index + 1].winding === "cw" &&
      decreaseKnit.rows[cwFront.index + 1].cells[needleCol(0)] === 2 &&
      decreaseKnit.rows[cwFront.index + 2].winding === "ccw" &&
      decreaseKnit.rows[cwFront.index + 2].cells[needleCol(0)] === 12 &&
      bodyRows.slice(0, 4).every((row) => row.cells.every((code) => code === 0 || code === 1 || code === 2 || code === 13)) &&
      bodyRows.slice(24).every((row) => !row.cells.includes(11) && !row.cells.includes(12)) &&
      needlesOf(cwFront) === "1,1,1,11,13,0,0,0,0,0,0,0" &&
      needlesOf(cwBack) === "0,0,0,0,0,0,0,0,13,12,2,13" &&
      needlesOf(skipFront) === "0,0,0,13,11,1,1,1,1,1,1,13" &&
      frontCells === 78 &&
      backCells === 70 &&
      turnFront === 4 &&
      turnBack === 6 &&
      decreaseKnit.rows.every((row) => row.cells.some((code) => code !== 0)) &&
      decreaseRaw.rules.status === "由当前床图按编织顺序画出，未生成 .dat / .k" &&
      decreaseRaw.rules.short_row_turns.includes("11") &&
      decreaseRaw.rules.short_row_turns.includes("仍是普通平针 1 或 2") &&
      decreaseRaw.rules.short_row_turns.includes("ccw") &&
      decreaseRaw.rules.row_turn.includes("不是折返") &&
      !decreaseRaw.rules.short_row_turns.includes("暂按所在床的普通平针") &&
      !decreaseRaw.rules.row_turn.includes("每一行都算一次换行") &&
      !decreaseRaw.rules.decreases.includes("若它是该行沿行进方向的第一个非空格"),
    "Decrease knitting code keeps the 32 body rows and adds the width-12 opening",
  );
  assertShortRowTurnCodes(bodyNeedleTable(decreaseKnit), "Decrease", { frame: true });
  assert(
    knitCodeCaption(decreaseKnit) ===
      `前床 1（红）一行，换后床新开一行 2（绿）；空位为 0。列是物理针 0–11。${BUNNY_FLIP_NOTE}${KNIT_OPENING_NOTE}` &&
      !knitCodeCaption(decreaseKnit).includes("无B0") &&
      !knitCodeCaption(decreaseKnit).includes("0–12") &&
      !knitCodeCaption(decreaseKnit).includes("暂按普通平针") &&
      !knitCodeCaption(decreaseKnit).includes("矫正稿") &&
      !knitCodeCaption(decreaseKnit).includes("移针/翻针未画") &&
      knitCodeLegend(decreaseKnit).map((item) => `${item.code}:${item.name}`).join("|") ===
        "1:1 前床平针|11:11 前床短行折返首针|2:2 后床平针|12:12 后床短行折返首针|20:20 前床翻后床|21:21 前床左移|30:30 后床翻前床|31:31 后床左移|34:34 后床右移|0:0 空针",
    "Decrease caption names needles 0–11, the drawn transfers, and empty cells 0 空针",
  );
  const otherEmpty = parseKnitCode({
    model: "Other",
    needles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    matrix: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
  });
  assert(
    knitCodeCaption(otherEmpty) ===
      "前床 1（红）一行，换后床新开一行 2（绿）；空位为 0。列是物理针 0–11。" &&
      !knitCodeCaption(otherEmpty).includes("矫正稿"),
    "a model outside the official tables does not get the draft note",
  );
  {
    const decreaseObj = parseColoredObj(readFileSync(join(decDir, "decrease_cylinder_KnittingStitches.obj"), "utf8"));
    const decreaseStitches = decreaseObj.faces.map((face, index) => ({ index, verts: face.verts }));
    const decreaseLayout = parseFacesRingLayout(readFileSync(join(decDir, "decrease_cylinder_faces_ring_layout.json"), "utf8"));
    facesRingChunksFromStitches(decreaseStitches, {
      nRings: decreaseLayout.nFacesRing,
      termCounts: decreaseLayout.termCounts,
      ringTypes: decreaseLayout.ringTypes,
      colors: decreaseLayout.colors,
    });
    const decreaseBedMap = parseExcelReadableMap(readFileSync(join(decDir, "decrease_cylinder_bed.xls")));
    const decreaseBind = bindKnitCodeStitches(decreaseKnit, decreaseBedMap, decreaseStitches, null);
    const plainF3 = decreaseKnit.rows.find((row) => row.label.startsWith("第3环 前床  F0→F3"));
    const turnF3 = decreaseKnit.rows.find((row) => row.label.startsWith("第3环 前床  F3（"));
    const spanA = decreaseBind.byKey.get(`${plainF3.index},${needleCol(2)}`);
    const spanB = decreaseBind.byKey.get(`${plainF3.index},${needleCol(3)}`);
    const splitA = decreaseBind.byKey.get(`${plainF3.index},${needleCol(3)}`);
    const splitB = decreaseBind.byKey.get(`${turnF3.index},${needleCol(3)}`);
    const shared = new Map();
    for (const stitch of decreaseBind.byKey.values()) shared.set(stitch.index, (shared.get(stitch.index) || 0) + 1);
    assert(
      decreaseBind.bedTokens === 148 &&
        decreaseBind.knitCells === 148 &&
        decreaseBind.unmatched.length === 0 &&
        decreaseBind.byKey.size === 148 &&
        spanA &&
        spanB &&
        spanA.index === spanB.index &&
        plainF3.cells[needleCol(0)] === 1 &&
        plainF3.cells[needleCol(3)] === 1 &&
        turnF3.cells[needleCol(3)] === 1 &&
        turnF3.cells.filter((code) => code === 1 || code === 11).length === 1 &&
        splitA &&
        splitB &&
        splitA.index !== splitB.index &&
        [...shared.values()].some((count) => count > 1),
      `Decrease knitting code binds the 148 knit cells: ${JSON.stringify(decreaseBind.unmatched)}`,
    );
  }
  assert(
    decreaseShown.length === 107 &&
      decreaseShown[106].row === decreaseKnit.rows[0] &&
      decreaseShown[106].rowIndex === 0 &&
      decreaseShown[106].row.label === "开头 1" &&
      decreaseShown[72].row === decreaseKnit.rows[34] &&
      decreaseShown[72].rowIndex === 34 &&
      decreaseShown[72].row.winding === "ccw" &&
      needlesOf(decreaseShown[72].row) === "1,1,1,1,1,1,1,1,1,1,1,1" &&
      decreaseShown[71].row === decreaseKnit.rows[35] &&
      decreaseShown[71].row.cells[needleCol(0)] === 13 &&
      decreaseShown[71].row.cells[2] === 0 &&
      decreaseShown[0].row === decreaseKnit.rows[106] &&
      decreaseShown[0].row.winding === "ccw" &&
      cwFront?.winding === "cw" &&
      cwFront.cells[needleCol(3)] === 11 &&
      knitCellTravel(decreaseKnit.rows[34].winding, 1)?.text === "向右" &&
      knitCellTravel(decreaseKnit.rows[34].winding, 1)?.arrow === "→" &&
      knitCellTravel(decreaseKnit.rows[35].winding, 2)?.text === "向左" &&
      knitCellTravel(decreaseKnit.rows[35].winding, 12)?.text === "向左" &&
      knitCellTravel(decreaseKnit.rows[35].winding, 2)?.arrow === "←" &&
      knitCellTravel(decreaseKnit.rows[35].winding, decreaseKnit.rows[35].cells[2]) == null &&
      knitCellTravel(cwFront.winding, cwFront.cells[needleCol(3)])?.text === "向左" &&
      knitCellTravel(cwFront.winding, 1)?.text === "向左" &&
      knitCellTravel(cwFront.winding, 1)?.arrow === "←" &&
      knitCellTravel(cwBack.winding, cwBack.cells[needleCol(9)])?.text === "向右" &&
      skipFront.cells[needleCol(4)] === 11 &&
      knitCellTravel(skipFront.winding, skipFront.cells[needleCol(4)])?.text === "向右",
    "Decrease knitting code draws the opening under the body, and cw front goes left",
  );
  const parsed = parseColoredObj(readFileSync(join(decDir, "decrease_cylinder_KnittingStitches.obj"), "utf8"));
  assert(parsed.verts.length === 545 && parsed.faces.length === 139, "Decrease Cylinder is the SingaLab stitchmesh");
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
    chunks.length === 5 && chunks.map((chunk) => chunk.faces.length).join(",") === "23,23,61,18,14",
    "Decrease Cylinder faces ring is the exported 5 rings",
  );
  const decreaseCols = parseColsResample({
    fieldText: readFileSync(join(decDir, "decrease_cylinder_cols_resample_field.obj"), "utf8"),
    xls: readFileSync(join(decDir, "decrease_cylinder_cols_resample.xls")),
  });
  assert(
    decreaseCols.length === 23 &&
      decreaseCols.every((col, i) => col.col === i) &&
      decreaseCols.filter((col) => col.type === "SHORT_BEGIN").length === 9 &&
      decreaseCols.filter((col) => col.type === "FULL").length === 14 &&
      decreaseCols.every((col) => col.points.length >= 2 && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    "cols_resample is 23 side edges; 9 SHORT_BEGIN and 14 FULL climb",
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
    decreaseTxt.includes("course 0 R  start F0  end B1  （23 针）") &&
      decreaseTxt.includes("course 1 R  start F0  end B1  （23 针）") &&
      decreaseTxt.includes("course 2 R  start F0  end F3  （5 针）") &&
      decreaseTxt.includes("course 3 L  start F3  end B0  （5 针）") &&
      decreaseTxt.includes("course 6 R  start F4  end B9  （9 针）") &&
      decreaseTxt.includes("表宽 24") &&
      decreaseTxt.includes("第一环落座之后 N=23，窗 F12[0…11] / B11[1…11]。") &&
      decreaseTxt.includes("第五环结束 N=14，窗 F7[0…6] / B7[0…6]。") &&
      decreaseTxt.includes("5 环都在这一张表上。"),
    "Decrease Cylinder courses are the generator report",
  );
  const ring0 = decreaseBed.rows[0];
  const ring0Knit = ring0.cells.filter((cell) => cell.token);
  const ring0Seq = ring0Knit.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  assert(
    ring0.dir === "R" &&
      ring0.beds === "0针 · 前空 · 后空" &&
      ring0Seq ===
        "F·@F0 F·@F1 F·@F2 F·@F3 F·@F4 F·@F5 F·@F6 F·@F7 F·@F8 F·@F9 F·@F10 F·@F11 B·@B11 B·@B10 B·@B9 B·@B8 B·@B7 B·@B6 B·@B5 B·@B4 B·@B3 B·@B2 B·@B1" &&
      ring0Knit.every((cell) => cell.col === (cell.bed === "F" ? cell.phys : 23 - cell.phys)),
    "ring 0 knits F0–F11 then B11–B1 on an empty bed",
  );
  const decreaseFn = mainSrc.slice(mainSrc.indexOf("async function loadDecreaseCylinder"), mainSrc.indexOf("async function loadIncreaseCylinder"));
  assert(decreaseFn.includes("sampleEntry"), "Decrease Cylinder loads the cols xls as bytes");
  assert(decreaseFn.includes("前床 F0–F11") && decreaseFn.includes("后床 B11–B1"), "Decrease Cylinder status quotes the seated bed");
  assert(mainSrc.includes("isDecreaseCylinderBedChart"), "the excel map loader recognizes the Decrease Cylinder bed chart");
  assert(!/root\.rotation|camera\.up/.test(decreaseFn), "Decrease Cylinder does not rotate the viewer");
}
{
  assert(
    html.includes('id="load-increase-cylinder"') &&
      html.includes("Increase Cylinder") &&
      mainSrc.includes("increase-cylinder.json") &&
      mainSrc.includes("loadIncreaseCylinder"),
    "Open menu loads Increase Cylinder in the existing chooser",
  );
  const data = JSON.parse(readFileSync(join(sampleDir, "increase-cylinder.json"), "utf8"));
  assert(data.name === "Increase Cylinder" && data.outputs?.length === 1, "Increase Cylinder manifest is one sample");
  assert(data.outputs[0].label === "Increase Cylinder", "chooser label stays Increase Cylinder");
  const rels = collectManifestRefs(data).join("\n");
  assert(
    rels.includes("increase/increase_cylinder_KnittingStitches.obj") &&
      rels.includes("increase/increase_cylinder_cols_resample_field.obj") &&
      rels.includes("increase/increase_cylinder_cols_resample.xls") &&
      rels.includes("increase/increase_cylinder_faces_ring_layout.json") &&
      rels.includes("increase/increase_cylinder_bed.xls") &&
      rels.includes("increase/increase_cylinder_knitcode.json") &&
      !/knitout|faces_ring0|standrad_cylinder|decrease_cylinder|readable_map/i.test(rels),
    "Increase Cylinder binds its own stitchmesh, cols_resample, faces ring, bed chart, and knitting code",
  );
  const incDir = join(sampleDir, "increase");
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
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, "Increase Cylinder resolves without borrowing other samples");
  const out = proj.outputs[0];
  assert(out.label === "Increase Cylinder", "output label is Increase Cylinder");
  assert(
    isIncreaseCylinderBedChart(out.readableMapFile?.name || "") && !out.readableMapTxtFile,
    "Increase Cylinder right-hand map is its own bed chart",
  );
  assert(
    /increase_cylinder_cols_resample_field\.obj$/i.test(out.colsResampleFile?.name || "") &&
      /increase_cylinder_cols_resample\.xls$/i.test(out.colsResampleXlsFile?.name || "") &&
      /increase_cylinder_faces_ring_layout\.json$/i.test(out.facesRingLayoutFile?.name || ""),
    "Increase Cylinder uses its own cols_resample field, xls, and faces ring",
  );
  const parsed = parseColoredObj(readFileSync(join(incDir, "increase_cylinder_KnittingStitches.obj"), "utf8"));
  assert(parsed.verts.length === 516 && parsed.faces.length === 133, "Increase Cylinder is the SingaLab stitchmesh");
  const ySpan = parsed.verts.reduce(
    (acc, vert) => ({ min: Math.min(acc.min, vert.y), max: Math.max(acc.max, vert.y) }),
    { min: Infinity, max: -Infinity },
  );
  assert(ySpan.min > -0.1 && ySpan.max > 39.9 && ySpan.max < 40.1, "Increase Cylinder stands with its height along Y");
  const layout = parseFacesRingLayout(readFileSync(join(incDir, "increase_cylinder_faces_ring_layout.json"), "utf8"));
  const stitches = parsed.faces.map((face, index) => ({ index, verts: face.verts }));
  const chunks = facesRingChunksFromStitches(stitches, {
    nRings: layout.nFacesRing,
    termCounts: layout.termCounts,
    ringTypes: layout.ringTypes,
    colors: layout.colors,
  });
  assert(
    chunks.length === 5 && chunks.map((chunk) => chunk.faces.length).join(",") === "14,14,18,65,22",
    "Increase Cylinder faces ring is the exported 5 rings",
  );
  const increaseCols = parseColsResample({
    fieldText: readFileSync(join(incDir, "increase_cylinder_cols_resample_field.obj"), "utf8"),
    xls: readFileSync(join(incDir, "increase_cylinder_cols_resample.xls")),
  });
  assert(
    increaseCols.length === 22 &&
      increaseCols[0].type === "FULL" &&
      increaseCols.every((col, i) => col.col === i && col.points.length >= 2 && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    "cols_resample is 22 side-edge polylines climbing the cone",
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
    increaseCols.every((col) => col.points.every((point) => nearestVert(point) < 1e-6)),
    "Increase Cylinder cols_resample points sit on stitchmesh vertices",
  );
  const faceEdges = (face) => {
    const hit = new Set();
    for (const vert of face.verts) {
      increaseCols.forEach((col, index) => {
        if (col.points.some((point) => Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z) < 1e-6)) hit.add(index);
      });
    }
    return hit;
  };
  assert(
    parsed.faces.every((face) => faceEdges(face).size >= 2),
    "each Increase Cylinder stitch meets cols_resample side edges",
  );
  const increaseBed = parseExcelReadableMap(readFileSync(join(incDir, "increase_cylinder_bed.xls")));
  assert(
    increaseBed.source === "excel" && increaseBed.sheet === "bed" && increaseBed.bedsHeader === "此刻活针",
    "Increase Cylinder right-hand map is the excel bed chart",
  );
  assert(
    increaseBed.needleCols.length === 24 && increaseBed.colMin === 0 && increaseBed.colMax === 23,
    "Increase Cylinder bed chart width is the widest course (24 columns)",
  );
  const increaseTxt = readFileSync(join(incDir, "increase_cylinder_bed.txt"), "utf8");
  assert(
    increaseTxt.includes("course 0 R  start F0  end B0  （14 针）") &&
      increaseTxt.includes("course 2 R  start F0  end B-1  （21 针）") &&
      increaseTxt.includes("第一环落座之后 N=14，窗 F7[0…6] / B7[0…6]。") &&
      increaseTxt.includes("第二环结束 N=18，窗 F9[0…8] / B9[0…8]。") &&
      increaseTxt.includes("第五环结束 N=22，窗 F11[0…10] / B11[0…10]。") &&
      increaseTxt.includes("表宽 24") &&
      increaseTxt.includes("每一环的第一针都在 F0。后一环不重新落座，第一针是前一环结束之后沿本行方向的下一针。加减针数是该项的 n_extra。") &&
      increaseTxt.includes("5 环都在这一张表上。"),
    "Increase Cylinder courses are the generator report",
  );
  const ring0 = increaseBed.rows[0];
  const ring0Knit = ring0.cells.filter((cell) => cell.token);
  const ring0Seq = ring0Knit.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  assert(
    ring0.dir === "R" &&
      ring0.beds === "0针 · 前空 · 后空" &&
      ring0Seq === "F·@F0 F·@F1 F·@F2 F·@F3 F·@F4 F·@F5 F·@F6 B·@B6 B·@B5 B·@B4 B·@B3 B·@B2 B·@B1 B·@B0" &&
      ring0Knit.every((cell) => cell.col === (cell.bed === "F" ? cell.phys : 21 - cell.phys)),
    "ring 0 knits F0–F6 then B6–B0 on an empty bed",
  );
  const increaseFn = mainSrc.slice(mainSrc.indexOf("async function loadIncreaseCylinder"), mainSrc.indexOf("async function loadSample"));
  assert(increaseFn.includes("sampleEntry") && mainSrc.includes("arrayBuffer"), "Increase Cylinder loads the cols xls as bytes");
  assert(
    increaseFn.includes("前床 F0–F6") && increaseFn.includes("后床 B6–B0") && increaseFn.includes("表宽 24"),
    "Increase Cylinder status quotes the seated bed",
  );
  assert(mainSrc.includes("isIncreaseCylinderBedChart"), "the excel map loader recognizes the Increase Cylinder bed chart");
  assert(!/root\.rotation|camera\.up/.test(increaseFn), "Increase Cylinder does not rotate the viewer");
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
assert(html.includes('id="map-mode-readable"') && html.includes('id="map-mode-knit"') && html.includes("生长图") && html.includes("编织码"), "map panel toggles between the readable map and knitting code");
assert(/id="map-mode-readable"[^>]*aria-pressed="true"/.test(html), "readable map is the default panel mode");
assert(/id="map-mode-knit"[^>]*disabled/.test(html), "knitting code starts unavailable");
assert(mainSrc.includes('mapMode = "readable"') && mainSrc.includes("此 sheet 暂无编织码") && mainSrc.includes("parseKnitCode"), "opening a sheet stays on the readable map and disables knitting code when the sheet has none");
assert(
  mainSrc.includes("knitCodeDisplayRows") &&
    mainSrc.includes("knitCodeInitialScrollTop") &&
    mainSrc.includes("knitCodeCaption") &&
    mainSrc.includes("knitCodeLegend") &&
    mainSrc.includes("pinKnitCodeScroll") &&
    mainSrc.includes("knitCellTravel(row.winding, code)") &&
    mainSrc.includes("bindKnitCodeStitches") &&
    mainSrc.includes("highlightKnitCodeForPick") &&
    mainSrc.includes('knitDir.id = "knit-dir"') &&
    !mainSrc.includes("向右") &&
    !mainSrc.includes("向左"),
  "every knitting-code table is drawn bottom-up and opens on the first rings",
);
assert(
  mainSrc.includes("knitTableColumns") &&
    mainSrc.includes("knitTableCells") &&
    mainSrc.includes("spacer.textContent = cell.text") &&
    mainSrc.includes("cell.fill") &&
    mainSrc.includes("KNIT_FUNCTION_RAIL_NOTE") &&
    mainSrc.includes('td.className = cell.role === "gap" ? "gap" : "fn"') &&
    mainSrc.includes('className = "rail-cell"') &&
    html.includes(KNIT_FUNCTION_RAIL_NOTE) &&
    html.includes('id="knit-rail-note"'),
  "the knitting-code renderer paints DAT-colored function numbers around the matrix",
);
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
assert(
  css.includes("chrome-collapsed") && /body\.chrome-collapsed \.dock\s*\{[^}]*display:\s*none/.test(css),
  "collapsed chrome hides the dock",
);
assert(
  /body\.chrome-collapsed \.topbar \.brand/.test(css) && css.includes(".sheet-actions"),
  "collapsed chrome keeps Open and Export together and hides the title",
);
assert(css.includes(".stage canvas") && css.includes("width: 100%") && css.includes("height: 100%"), "canvas CSS fills the stage");
assert(css.includes(".split") && css.includes(".map-pane") && css.includes("narrow-split"), "layout is a left-right split with a narrow fallback");
assert(css.includes(".stitch-pick") && css.includes(".hud-chips"), "stitch readout is a HUD chip under the mesh label");
assert(
  css.includes(".knit-dir") && /\.knit-dir\.is-none \.knit-dir-arrow\s*\{[^}]*display:\s*none/.test(css),
  "operation rows hide the travel arrow",
);
assert(
  css.includes('.knit-grid td.fn[data-slot="mark"]') &&
    css.includes("background: #3a3428") &&
    css.includes("background: #5c6d84") &&
    !css.includes("background: #243044") &&
    !/\.knit-grid td\.fn\[[^\]]+\]\s*\{[^}]*#000000/.test(css) &&
    !/\.knit-grid td\.gap\s*\{[^}]*#000000/.test(css),
  "gaps stay gray and function number colors are not a fixed knit-code 0 fill",
);
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

{
  assert(
    html.includes('id="load-dense-standrad-cylinder"') &&
      html.includes("Dense Standrad Cylinder") &&
      mainSrc.includes("dense-standrad-cylinder.json") &&
      mainSrc.includes("loadDenseStandradCylinder") &&
      mainSrc.includes('setSheetQuery("dense-standrad-cylinder")'),
    "Open menu loads Dense Standrad Cylinder in the existing chooser",
  );
  const data = JSON.parse(readFileSync(join(sampleDir, "dense-standrad-cylinder.json"), "utf8"));
  assert(data.name === "Dense Standrad Cylinder" && data.outputs?.length === 1, "Dense Standrad Cylinder manifest is one sample");
  assert(data.outputs[0].label === "Dense Standrad Cylinder", "chooser label stays Dense Standrad Cylinder");
  const rels = collectManifestRefs(data).join("\n");
  assert(
    rels.includes("dense-standrad/dense_standrad_cylinder_KnittingStitches.obj") &&
      rels.includes("dense-standrad/dense_standrad_cylinder_cols_resample_field.obj") &&
      rels.includes("dense-standrad/dense_standrad_cylinder_cols_resample.xls") &&
      rels.includes("dense-standrad/dense_standrad_cylinder_faces_ring_layout.json") &&
      rels.includes("dense-standrad/dense_standrad_cylinder_bed.xls") &&
      rels.includes("dense-standrad/dense_standrad_cylinder_knitcode.json") &&
      !/knitout|faces_ring0|\/standrad_cylinder|increase_cylinder|decrease_cylinder|thin_cylinder|fat_cylinder|readable_map/i.test(rels),
    "Dense Standrad Cylinder binds its own stitchmesh, cols_resample, faces ring, bed chart, and knitting code",
  );
  const denseDir = join(sampleDir, "dense-standrad");
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
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, "Dense Standrad Cylinder resolves without borrowing other samples");
  const out = proj.outputs[0];
  assert(out.label === "Dense Standrad Cylinder", "output label is Dense Standrad Cylinder");
  assert(
    isDenseStandradCylinderBedChart(out.readableMapFile?.name || "") && !out.readableMapTxtFile,
    "Dense Standrad Cylinder right-hand map is its own bed chart",
  );
  assert(
    /dense_standrad_cylinder_cols_resample_field\.obj$/i.test(out.colsResampleFile?.name || "") &&
      /dense_standrad_cylinder_cols_resample\.xls$/i.test(out.colsResampleXlsFile?.name || "") &&
      /dense_standrad_cylinder_faces_ring_layout\.json$/i.test(out.facesRingLayoutFile?.name || "") &&
      /dense_standrad_cylinder_knitcode\.json$/i.test(out.knitCodeFile?.name || ""),
    "Dense Standrad Cylinder uses its own cols_resample field, xls, faces ring, and knitting code",
  );
  const denseKnitPath = join(denseDir, "dense_standrad_cylinder_knitcode.json");
  const denseText = readFileSync(denseKnitPath, "utf8");
  assert(
    knitMatrixSuffixHash(denseKnitPath) === "98b00ea724e9a071aaab4f0bb8f2df4ab9f6f3409746787937677fb01d9e5bb4",
    "Dense Standrad knitting-code matrix bytes stay the opened plain-tube table",
  );
  const denseRaw = JSON.parse(denseText);
  const denseKnit = parseKnitCode(denseRaw);
  const denseShown = knitCodeDisplayRows(denseKnit);
  assert(
    denseKnit?.model === "Dense Standrad Cylinder" &&
      denseRaw.n_rows === 64 &&
      denseRaw.n_opening_rows === 34 &&
      denseRaw.n_body_rows === 30 &&
      denseRaw.n_cols === 35 &&
      denseKnit.rows.length === 64 &&
      denseKnit.needles.length === 25 &&
      denseKnit.needles.every((n, i) => n === i) &&
      denseKnit.columns.find((col) => col.needle === 0).needleIndex === 3 &&
      denseKnit.colors[0] === "#000000" &&
      denseKnit.colors[1] === "#FF0000" &&
      denseKnit.colors[2] === "#00FF00" &&
      denseKnit.colors[11] === "#FF67BD" &&
      denseKnit.colors[12] === "#906CB4" &&
      denseKnit.rows[34].label.startsWith("第1环 前床  F0→F24") &&
      denseKnit.rows[35].label.startsWith("第1环 后床  B24→B0") &&
      denseKnit.rows[63].label.startsWith("第15环 后床  B24→B0") &&
      denseKnit.rows.slice(0, 34).every((row) => row.bind === false && row.functionRails) &&
      denseKnit.rows.slice(34).every((row, index) => {
        const needles = needleSlice(denseKnit, row);
        return (
          row.bind === true &&
          row.functionRails == null &&
          row.cells.length === 35 &&
          needles.every((code) => code === (index % 2 === 0 ? 1 : 2)) &&
          row.cells[2] === 13 &&
          row.cells[28] === 13
        );
      }) &&
      !denseKnit.rows.slice(34).some((row) => needleSlice(denseKnit, row).includes(0)) &&
      denseKnit.rows.reduce((sum, row) => sum + row.cells.filter((code) => code === 11).length, 0) === 0 &&
      denseKnit.rows.reduce((sum, row) => sum + row.cells.filter((code) => code === 12).length, 0) === 0 &&
      !denseRaw.rules.row_turn.includes("每一行都算一次换行") &&
      denseRaw.rules.row_turn.includes("没有短行折返"),
    "Dense Standrad knitting code keeps the 30×25 plain tube and adds the width-25 opening",
  );
  assertShortRowTurnCodes(bodyNeedleTable(denseKnit), "Dense Standrad", { frame: true });
  assert(
    denseShown.length === 64 &&
      denseShown[0].row === denseKnit.rows[63] &&
      denseShown[0].rowIndex === 63 &&
      denseShown[63].row === denseKnit.rows[0] &&
      denseShown[63].rowIndex === 0 &&
      denseShown[63].row.label === "开头 1" &&
      denseShown[29].row === denseKnit.rows[34] &&
      denseShown[29].row.winding === "ccw" &&
      needleSlice(denseKnit, denseShown[29].row).every((code) => code === 1) &&
      denseRaw.row_winding.length === 64 &&
      denseRaw.row_winding.slice(34).every((winding) => winding === "ccw") &&
      denseKnit.rows.every((row, index) => row.winding === denseRaw.row_winding[index]) &&
      knitCellTravel(denseKnit.rows[34].winding, 1)?.text === "向右" &&
      knitCellTravel(denseKnit.rows[35].winding, 12)?.text === "向左" &&
      denseKnit.rows[35].cells[27] === 2 &&
      knitCellTravel(denseKnit.rows[35].winding, denseKnit.rows[35].cells[27])?.text === "向左" &&
      denseKnit.rows[36].cells[3] === 1 &&
      knitCellTravel(denseKnit.rows[36].winding, 11)?.text === "向右",
    "Dense Standrad knitting code draws the opening under the body",
  );
  assert(
    knitCodeCaption(denseKnit) ===
      `前床 1（红）一行，换后床新开一行 2（绿）；空位为 0。列是物理针 0–24。${BUNNY_FLIP_NOTE}${KNIT_OPENING_NOTE}` &&
      !knitCodeCaption(denseKnit).includes("无B0") &&
      !knitCodeCaption(denseKnit).includes("0–12") &&
      !knitCodeCaption(denseKnit).includes("每次换行") &&
      knitCodeLegend(denseKnit).map((item) => `${item.code}:${item.name}`).join("|") ===
        "1:1 前床平针|2:2 后床平针|0:0 空针",
    "Dense Standrad caption names needles 0–24 and does not claim an empty B0",
  );
  {
    const denseObj = parseColoredObj(readFileSync(join(denseDir, "dense_standrad_cylinder_KnittingStitches.obj"), "utf8"));
    const denseStitches = denseObj.faces.map((face, index) => ({ index, verts: face.verts }));
    const denseLayout = parseFacesRingLayout(readFileSync(join(denseDir, "dense_standrad_cylinder_faces_ring_layout.json"), "utf8"));
    facesRingChunksFromStitches(denseStitches, {
      nRings: denseLayout.nFacesRing,
      termCounts: denseLayout.termCounts,
      ringTypes: denseLayout.ringTypes,
      colors: denseLayout.colors,
    });
    const denseBedMap = parseExcelReadableMap(readFileSync(join(denseDir, "dense_standrad_cylinder_bed.xls")));
    const denseBind = bindKnitCodeStitches(denseKnit, denseBedMap, denseStitches, null);
    const denseF0 = denseBind.byKey.get("34,3");
    const denseBack = denseBind.byKey.get("35,27");
    const denseLive = liveKnitCount({ rows: denseKnit.rows.filter((row) => row.bind !== false) });
    assert(
      denseBind.bedTokens === denseLive &&
        denseBind.knitCells === denseLive &&
        denseBind.unmatched.length === 0 &&
        denseBind.byKey.size === denseLive &&
        denseLive === 750 &&
        denseF0?.index === 0 &&
        denseF0.ring === 0 &&
        denseF0.termInRing === 0 &&
        denseBack?.index === 25 &&
        denseBack.ring === 0 &&
        denseBack.termInRing === 25 &&
        denseBack.index !== denseF0.index,
      "Dense Standrad knitting code binds every knit cell, including the first back-bed stitch",
    );
  }
  assert(
    describeKnitCell(denseKnit, 34, 3) === "第1环 前床  F0→F24（床图 row 0 / course 0 R，逆时针向右） · 物理针 0 · 1 前床平针" &&
      describeKnitCell(denseKnit, 36, 3) === "第2环 前床  F0→F24（床图 row 1 / course 1 R，逆时针向右） · 物理针 0 · 1 前床平针" &&
      describeKnitCell(denseKnit, 35, 3) === "第1环 后床  B24→B0（床图 row 0 / course 0 R，逆时针向左） · 物理针 0 · 2 后床平针" &&
      describeKnitCell(denseKnit, 35, 27) === "第1环 后床  B24→B0（床图 row 0 / course 0 R，逆时针向左） · 物理针 24 · 2 后床平针",
    "a Dense knitting-code cell names its pass, physical needle, and code",
  );
  const parsed = parseColoredObj(readFileSync(join(denseDir, "dense_standrad_cylinder_KnittingStitches.obj"), "utf8"));
  assert(parsed.verts.length === 3000 && parsed.faces.length === 750, "Dense Standrad Cylinder is 3000 vertices and 750 faces");
  assert(parsed.faces.every((face) => face.indices.length === 4), "Dense Standrad Cylinder faces are quads");
  assert(
    parsed.verts.every((v) => v.r === 0.55 && v.g === 0.55 && v.b === 0.55),
    "Dense Standrad Cylinder vertex colors are plain-knit gray",
  );
  const ySpan = parsed.verts.reduce(
    (acc, vert) => ({ min: Math.min(acc.min, vert.y), max: Math.max(acc.max, vert.y) }),
    { min: Infinity, max: -Infinity },
  );
  assert(ySpan.min > -1e-6 && ySpan.max > 39.9 && ySpan.max < 40.1, "Dense Standrad Cylinder stands with its height along Y");
  const layout = parseFacesRingLayout(readFileSync(join(denseDir, "dense_standrad_cylinder_faces_ring_layout.json"), "utf8"));
  const stitches = parsed.faces.map((face, index) => ({ index, verts: face.verts }));
  const chunks = facesRingChunksFromStitches(stitches, {
    nRings: layout.nFacesRing,
    termCounts: layout.termCounts,
    ringTypes: layout.ringTypes,
    colors: layout.colors,
  });
  assert(
    chunks.length === 15 && chunks.every((chunk) => chunk.faces.length === 50),
    "Dense Standrad Cylinder is 15 rings of 50 terms",
  );
  assert(
    chunks.every((chunk) => chunk.faces.every((stitch) => stitch.termType === 0)),
    "Dense Standrad Cylinder is all plain knit",
  );
  const denseCols = parseColsResample({
    fieldText: readFileSync(join(denseDir, "dense_standrad_cylinder_cols_resample_field.obj"), "utf8"),
    xls: readFileSync(join(denseDir, "dense_standrad_cylinder_cols_resample.xls")),
  });
  assert(
    denseCols.length === 50 &&
      denseCols.every((col, i) => col.col === i && col.points.length === 16 && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    "Dense Standrad Cylinder cols_resample is 50 side edges climbing the tube",
  );
  const excel = parseExcelReadableMap(readFileSync(join(denseDir, "dense_standrad_cylinder_bed.xls")));
  assert(
    excel.source === "excel" && excel.sheet === "bed" && excel.bedsHeader === "此刻活针",
    "Dense Standrad Cylinder right-hand map is the excel bed chart",
  );
  assert(
    excel.rows.length === 15 &&
      excel.needleCols.length === 50 &&
      excel.colMin === 0 &&
      excel.colMax === 49 &&
      excel.rows[0].dir === "R" &&
      excel.rows[0].beds === "0针 · 前空 · 后空" &&
      excel.rows.slice(1).every((row) => row.dir === "R" && row.beds === "50针 · 前25[0…24] · 后25[0…24]"),
    "Dense Standrad Cylinder bed chart width is the widest course (50 columns)",
  );
  const knitOf = (row) => row.cells.filter((cell) => cell.token);
  const ring0Seq = knitOf(excel.rows[0]).map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ");
  const expectRing0 = [
    ...Array.from({ length: 25 }, (_, i) => `F·@F${i}`),
    ...Array.from({ length: 25 }, (_, i) => `B·@B${24 - i}`),
  ].join(" ");
  assert(ring0Seq === expectRing0, "course 0 knits F0–F24 then B24–B0 on an empty bed");
  assert(
    excel.rows.every((row) => knitOf(row).length === 50 && knitOf(row).every((cell) => cell.kind === "plain")),
    "every Dense Standrad Cylinder course is 50 plain knits",
  );
  const denseTxt = readFileSync(join(denseDir, "dense_standrad_cylinder_bed.txt"), "utf8");
  assert(
    denseTxt.includes("course 0 R  start F0  end B0  （50 针）") &&
      denseTxt.includes("course 14 R  start F0  end B0  （50 针）") &&
      denseTxt.includes("第一环落座之后 N=50，窗 F25[0…24] / B25[0…24]。") &&
      denseTxt.includes("第15环结束 N=50，窗 F25[0…24] / B25[0…24]。") &&
      denseTxt.includes("表宽 50") &&
      denseTxt.includes("15 环都在这一张表上。"),
    "Dense Standrad Cylinder courses are the generator report",
  );
  const denseFn = mainSrc.slice(mainSrc.indexOf("async function loadDenseStandradCylinder"), mainSrc.indexOf("async function loadDecreaseCylinder"));
  assert(denseFn.includes("sampleEntry"), "Dense Standrad Cylinder loads the bed xls as bytes");
  assert(
    denseFn.includes("前床 F0–F24") && denseFn.includes("后床 B24–B0") && denseFn.includes("表宽 50") && denseFn.includes("15 环落座 50"),
    "Dense Standrad Cylinder status quotes the seated bed",
  );
  assert(mainSrc.includes("isDenseStandradCylinderBedChart"), "the excel map loader recognizes the Dense Standrad Cylinder bed chart");
  assert(!/root\.rotation|camera\.up/.test(denseFn), "Dense Standrad Cylinder does not rotate the viewer");
}

function assertTightBodyFrames(knit, label) {
  const body = knit.rows.filter((row) => row.bind !== false);
  assert(body.length > 0, `${label} has body rows`);
  for (const row of body) {
    const live = [];
    row.cells.forEach((code, index) => {
      if (code === 1 || code === 2 || code === 11 || code === 12) live.push(index);
    });
    const frames = [];
    row.cells.forEach((code, index) => {
      if (code === 13) frames.push(index);
    });
    assert(
      live.length > 0 && frames.length === 2 && frames[0] === live[0] - 1 && frames[1] === live[live.length - 1] + 1,
      `${label} row ${row.index} keeps both 13s tight on the knitted span`,
    );
  }
}

function assertAdaptedKnitCodes() {
  const standrad = JSON.parse(readFileSync(join(sampleDir, "cylinder/standrad_cylinder_knitcode.json"), "utf8"));
  const specs = [
    ["increase-cylinder", "Increase Cylinder", "increase/increase_cylinder_knitcode.json", "increase/increase_cylinder_KnittingStitches.obj", "increase/increase_cylinder_bed.xls", "f7bc32f6030572db9aede0d6413f26b5448495413789e7c2cb3996fc529fb0ab", 7, -2, 11, 17, 0, 24, 141, 66, "0,13,1,1,1,1,1,1,11,13,0,0,0,0", 42, "0,13,1,1,1,1,1,1,1,1,1,13,0,0"],
    ["thin-cylinder", "Thin Cylinder", "thin/thin_cylinder_knitcode.json", "thin/thin_cylinder_KnittingStitches.obj", "thin/thin_cylinder_bed.xls", "a57c842a63afb1d8cdfebbf1ff26a5330ae7a1e365cf6bf2e1b803fdeea465f7", 12, -2, 11, 22, 0, 56, 310, 39, "0,13,1,1,11,13,0,0,0,0,0,0,0,0", 141, "2,2,2,2,2,2,2,2,2,13,0,0,0,0"],
    ["fat-cylinder", "Fat Cylinder", "fat/fat_cylinder_knitcode.json", "fat/fat_cylinder_KnittingStitches.obj", "fat/fat_cylinder_bed.xls", "ebda55d016a0d30e2b3dc5805fdfd7a507163f3dfbbf3cc5e2d65e86afd803be", 7, -4, 12, 19, 2, 83, 355, 74, "0,0,0,13,1,1,11,13,0,0,0,0,0,0,0,0,0", 56, "0,0,0,13,1,1,1,1,1,1,1,1,1,1,1,1,1"],
    ["dense-increase-cylinder", "Dense Increase Cylinder", "dense-increase/dense_increase_cylinder_knitcode.json", "dense-increase/dense_increase_cylinder_KnittingStitches.obj", "dense-increase/dense_increase_cylinder_bed.xls", "7cb2709a1b59c80705f933ac3172e6258e3e30b3a9b91f5382e562f071f726c2", 14, -2, 22, 27, 0, 86, 654, 100, "0,13,1,1,1,1,1,1,1,1,11,13,0,0,0,0,0,0,0,0,0,0,0,0,0", 42, "0,13,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,13,0,0,0,0,0,0,0"],
    ["dense-thin-cylinder", "Dense Thin Cylinder", "dense-thin/dense_thin_cylinder_knitcode.json", "dense-thin/dense_thin_cylinder_KnittingStitches.obj", "dense-thin/dense_thin_cylinder_bed.xls", "efbfb8ee87ec25404bc2d752035d6aeca44997ba35fc6f2fdf7c42319ae74e95", 24, -4, 23, 36, 2, 214, 1315, 45, "0,0,0,13,1,1,11,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0", 259, "0,0,13,2,2,2,2,2,2,2,2,2,2,2,2,2,2,13,0,0,0,0,0,0,0,0,0,0"],
    ["dense-fat-cylinder", "Dense Fat Cylinder", "dense-fat/dense_fat_cylinder_knitcode.json", "dense-fat/dense_fat_cylinder_KnittingStitches.obj", "dense-fat/dense_fat_cylinder_bed.xls", "3875eb748d13af537f37c4fe84eda4534fb09da04748caa13daa216ab8af923b", 13, -5, 23, 31, 3, 275, 1431, 87, "0,0,0,0,0,0,0,0,0,0,0,0,13,1,1,11,13,0,0,0,0,0,0,0,0,0,0,0,0", 38, "0,0,0,0,13,1,1,1,1,1,1,1,1,1,1,1,1,1,1,13,0,0,0,0,0,0,0,0,0"],
    ["dense-decrease-cylinder", "Dense Decrease Cylinder", "dense-decrease/dense_decrease_cylinder_knitcode.json", "dense-decrease/dense_decrease_cylinder_KnittingStitches.obj", "dense-decrease/dense_decrease_cylinder_bed.xls", "4d5dc3ebf061abb380b0e08e8844b6f85a2ea44d10a153a2636e2a7339e9ab47", 23, 0, 22, 33, 0, 103, 667, 43, "1,1,1,1,11,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0", null, null],
  ];
  for (const [sheet, title, rel, objRel, bedRel, hash, W, minNeedle, maxNeedle, canvas, origin, bodyRows, bindCount, shortIndex, shortNeedles, wideIndex, wideNeedles] of specs) {
    const sheetDoc = JSON.parse(readFileSync(join(sampleDir, `${sheet}.json`), "utf8"));
    assert(sheetDoc.outputs[0].knitCode === rel, `${title} sheet catalog points at its knitting code`);
    const path = join(sampleDir, rel);
    assert(knitMatrixSuffixHash(path) === hash, `${title} matrix-suffix sha256 stays ${hash}`);
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const knit = parseKnitCode(raw);
    const body = knit.rows.filter((row) => row.bind !== false);
    const needle0 = knit.columns.find((col) => col.needle === 0);
    const openingWidth = W + 10;
    assert(
      raw.model === title &&
        raw.n_opening_rows === 34 &&
        raw.n_knit_rows === bodyRows &&
        raw.n_body_rows === raw.n_rows - 34 &&
        raw.n_rows === 34 + raw.n_knit_rows + raw.n_flip_rows + raw.n_transfer_pairs * 2 &&
        raw.n_transfer_rows_omitted === 0 &&
        raw.n_cols === canvas &&
        raw.opening.target_width === W &&
        raw.opening.opening_canvas === openingWidth &&
        raw.opening.placed_at_column === origin &&
        raw.opening.needle0_column === needle0.needleIndex &&
        knit.needles[0] === minNeedle &&
        knit.needles.at(-1) === maxNeedle &&
        needle0.needleIndex === origin + 3 &&
        knit.rows.slice(0, 34).every((row) => row.bind === false && row.functionRails) &&
        body.length === bodyRows &&
        body.every((row) => row.bind === true && row.functionRails == null) &&
        JSON.stringify(raw.function_rails.slice(0, 34)) === JSON.stringify(standrad.function_rails.slice(0, 34)) &&
        JSON.stringify(raw.row_winding.slice(0, 34)) === JSON.stringify(standrad.row_winding.slice(0, 34)) &&
        knit.rows.slice(0, 34).every((row) =>
          row.cells.every((code, col) => (col < origin || col >= origin + openingWidth ? code === 0 : true)),
        ) &&
        knit.rows[0].cells[origin + 3] === 13 &&
        knit.rows[0].cells[origin + 3 + W] === 13 &&
        needleSlice(knit, body[0]).slice(0 - minNeedle, W - minNeedle).every((code) => code === 1),
      `${title} opening is the W=${W} template, left-aligned at needle 0`,
    );
    assertTightBodyFrames(knit, title);
    assert(
      needleSlice(knit, knit.rows[shortIndex]).join(",") === shortNeedles,
      `${title} short-row sample keeps the turn mark and a tight 13`,
    );
    if (wideIndex != null) {
      assert(
        needleSlice(knit, knit.rows[wideIndex]).join(",") === wideNeedles,
        `${title} inset or widened row keeps the locked needle slice`,
      );
    }
    const liveNeedles = (row) =>
      knit.columns
        .filter((col) => col.kind === "needle" && [1, 2, 11, 12].includes(row.cells[col.needleIndex]))
        .map((col) => col.needle);
    const wider = body.some((row) => Math.max(...liveNeedles(row)) > W - 1);
    const negative = body.some((row) => Math.min(...liveNeedles(row)) < 0);
    assert(wider === maxNeedle > W - 1 && negative === minNeedle < 0, `${title} only widens or uses a negative needle when the bed does`);
    if (title === "Dense Fat Cylinder") {
      const block = knit.rows.slice(0, 34).map((row) => row.cells.slice(origin, origin + openingWidth));
      assert(
        JSON.stringify(block) === JSON.stringify(standrad.matrix.slice(0, 34)),
        "Dense Fat reuses the Standrad W=13 opening without stretching it",
      );
    }
    assertFunctionRails(knit, canvas, title);
    assertShortRowTurnCodes(bodyNeedleTable(knit), title, { frame: true });
    const obj = parseColoredObj(readFileSync(join(sampleDir, objRel), "utf8"));
    const stitches = obj.faces.map((face, index) => ({ index, verts: face.verts }));
    const map = parseExcelReadableMap(readFileSync(join(sampleDir, bedRel)));
    const bound = bindKnitCodeStitches(knit, map, stitches, null);
    const boundRows = [...bound.byKey.keys()].map((key) => Number(key.split(",")[0]));
    assert(
      bound.knitCells === bindCount &&
        bound.byKey.size === bindCount &&
        bound.unmatched.length === 0 &&
        bound.bedTokens === bindCount &&
        boundRows.every((row) => row >= 34) &&
        [...bound.byKey.keys()].every((key) => {
          const [row, col] = key.split(",").map(Number);
          const code = knit.rows[row].cells[col];
          return code === 1 || code === 2 || code === 11 || code === 12;
        }),
      `${title} binds ${bindCount} knit cells and leaves 13s and the opening unbound`,
    );
  }
}

assertAdaptedKnitCodes();

function plainRightCourse(frontHi, backHi, backLo) {
  return [
    ...Array.from({ length: frontHi + 1 }, (_, i) => `F·@F${i}`),
    ...Array.from({ length: backHi - backLo + 1 }, (_, i) => `B·@B${backHi - i}`),
  ].join(" ");
}

function assertDenseCylinderSample(spec) {
  assert(
    html.includes(`id="load-${spec.sheet}"`) &&
      html.includes(spec.title) &&
      mainSrc.includes(`${spec.sheet}.json`) &&
      mainSrc.includes(spec.loader) &&
      mainSrc.includes(`setSheetQuery("${spec.sheet}")`),
    `Open menu loads ${spec.title} in the existing chooser`,
  );
  const data = JSON.parse(readFileSync(join(sampleDir, `${spec.sheet}.json`), "utf8"));
  assert(data.name === spec.title && data.outputs?.length === 1, `${spec.title} manifest is one sample`);
  assert(data.outputs[0].label === spec.title, `chooser label stays ${spec.title}`);
  const rels = collectManifestRefs(data);
  for (const rel of spec.rels) assert(rels.includes(rel), `${spec.title} binds ${rel}`);
  assert(!rels.some((rel) => /knitout|faces_ring0|readable_map|\/cylinder\/|\/increase\/|\/decrease\/|\/thin\/|\/fat\/|\/dense-standrad\//.test(rel) && !rel.startsWith(`${spec.dir}/`)), `${spec.title} does not borrow another sample`);
  const dir = join(sampleDir, spec.dir);
  const entries = [
    { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ...rels.map((rel) => {
      const abs = join(sampleDir, rel);
      const name = rel.split("/").pop();
      if (/\.xlsx?$/i.test(rel)) return { name, path: `sample/${rel}`, buffer: readFileSync(abs) };
      return { name, path: `sample/${rel}`, text: readFileSync(abs, "utf8") };
    }),
  ];
  const proj = projectFromManifest(data, indexFiles(entries), "sample/manifest.json");
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, `${spec.title} resolves without borrowing other samples`);
  const out = proj.outputs[0];
  assert(spec.bedChart(out.readableMapFile?.name || "") && !out.readableMapTxtFile, `${spec.title} right-hand map is its own bed chart`);
  const parsed = parseColoredObj(readFileSync(join(dir, `${spec.prefix}_KnittingStitches.obj`), "utf8"));
  assert(parsed.verts.length === spec.verts && parsed.faces.length === spec.faces, `${spec.title} stitchmesh is ${spec.verts} vertices and ${spec.faces} faces`);
  assert(parsed.faces.every((face) => face.indices.length >= 3), `${spec.title} faces have at least three vertices`);
  const ySpan = parsed.verts.reduce(
    (acc, vert) => ({ min: Math.min(acc.min, vert.y), max: Math.max(acc.max, vert.y) }),
    { min: Infinity, max: -Infinity },
  );
  assert(ySpan.max > spec.yMaxLo && ySpan.max < spec.yMaxHi && ySpan.min > -1, `${spec.title} stands with its height along Y`);
  const layout = parseFacesRingLayout(readFileSync(join(dir, `${spec.prefix}_faces_ring_layout.json`), "utf8"));
  assert(
    layout.termCounts.join(",") === spec.terms.join(","),
    `${spec.title} n_terms are ${spec.terms.join(",")}`,
  );
  const stitches = parsed.faces.map((face, index) => ({ index, verts: face.verts }));
  const chunks = facesRingChunksFromStitches(stitches, {
    nRings: layout.nFacesRing,
    termCounts: layout.termCounts,
    ringTypes: layout.ringTypes,
    colors: layout.colors,
  });
  assert(
    chunks.length === spec.terms.length && chunks.every((chunk, i) => chunk.faces.length === spec.terms[i]),
    `${spec.title} rings follow n_terms`,
  );
  const cols = parseColsResample({
    fieldText: readFileSync(join(dir, `${spec.prefix}_cols_resample_field.obj`), "utf8"),
    xls: readFileSync(join(dir, `${spec.prefix}_cols_resample.xls`)),
  });
  assert(
    cols.length === spec.cols && cols.every((col, i) => col.col === i && col.points.every((p, k) => k === 0 || p.y > col.points[k - 1].y)),
    `${spec.title} cols_resample is ${spec.cols} climbing side edges`,
  );
  const excel = parseExcelReadableMap(readFileSync(join(dir, `${spec.prefix}_bed.xls`)));
  assert(excel.source === "excel" && excel.sheet === "bed" && excel.bedsHeader === "此刻活针", `${spec.title} right-hand map is the excel bed chart`);
  assert(
    excel.needleCols.length === spec.width && excel.colMin === spec.colMin && excel.colMax === spec.colMax,
    `${spec.title} bed chart width is ${spec.width}`,
  );
  const knitOf = (row) => row.cells.filter((cell) => cell.token);
  const first = excel.rows.find((row) => row.dir === "R" || row.dir === "L");
  assert(
    knitOf(first).map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") === spec.firstCourse,
    `${spec.title} first course is the generator's empty-bed knit`,
  );
  const txt = readFileSync(join(dir, `${spec.prefix}_bed.txt`), "utf8");
  for (const phrase of spec.txt) assert(txt.includes(phrase), `${spec.title} report includes ${phrase}`);
  const fn = mainSrc.slice(mainSrc.indexOf(`async function ${spec.loader}`), mainSrc.indexOf(`async function ${spec.loader}`) + 900);
  for (const phrase of spec.status) assert(fn.includes(phrase), `${spec.title} status quotes ${phrase}`);
  assert(mainSrc.includes(spec.recognizer), `the excel map loader recognizes the ${spec.title} bed chart`);
  assert(!/root\.rotation|camera\.up/.test(fn), `${spec.title} does not rotate the viewer`);
}

assertDenseCylinderSample({
  sheet: "dense-decrease-cylinder",
  title: "Dense Decrease Cylinder",
  loader: "loadDenseDecreaseCylinder",
  dir: "dense-decrease",
  prefix: "dense_decrease_cylinder",
  recognizer: "isDenseDecreaseCylinderBedChart",
  bedChart: isDenseDecreaseCylinderBedChart,
  rels: [
    "dense-decrease/dense_decrease_cylinder_KnittingStitches.obj",
    "dense-decrease/dense_decrease_cylinder_cols_resample_field.obj",
    "dense-decrease/dense_decrease_cylinder_cols_resample.xls",
    "dense-decrease/dense_decrease_cylinder_faces_ring_layout.json",
    "dense-decrease/dense_decrease_cylinder_bed.xls",
  ],
  verts: 2503,
  faces: 648,
  yMaxLo: 39.9,
  yMaxHi: 40.1,
  terms: [46, 46, 46, 46, 130, 98, 40, 87, 28, 27, 27, 27],
  cols: 46,
  width: 46,
  colMin: 0,
  colMax: 45,
  firstCourse: plainRightCourse(22, 22, 0),
  txt: [
    "course 0 R  start F0  end B0  （46 针）",
    "第一环落座之后 N=46，窗 F23[0…22] / B23[0…22]。",
    "第三环结束 N=46，窗 F23[0…22] / B23[0…22]。",
    "第12环结束 N=27，窗 F14[0…13] / B13[1…13]。",
    "表宽 46",
    "12 环都在这一张表上。",
  ],
  status: ["前床 F0–F22", "后床 B22–B0", "表宽 46", "12 环落座 46、46、46、46、46、44、40、29、28、27、27、27"],
});

assertDenseCylinderSample({
  sheet: "dense-increase-cylinder",
  title: "Dense Increase Cylinder",
  loader: "loadDenseIncreaseCylinder",
  dir: "dense-increase",
  prefix: "dense_increase_cylinder",
  recognizer: "isDenseIncreaseCylinderBedChart",
  bedChart: isDenseIncreaseCylinderBedChart,
  rels: [
    "dense-increase/dense_increase_cylinder_KnittingStitches.obj",
    "dense-increase/dense_increase_cylinder_cols_resample_field.obj",
    "dense-increase/dense_increase_cylinder_cols_resample.xls",
    "dense-increase/dense_increase_cylinder_faces_ring_layout.json",
    "dense-increase/dense_increase_cylinder_bed.xls",
  ],
  verts: 2451,
  faces: 635,
  yMaxLo: 39.9,
  yMaxHi: 40.2,
  terms: [27, 27, 27, 29, 29, 33, 127, 66, 138, 132],
  cols: 46,
  width: 48,
  colMin: 0,
  colMax: 47,
  firstCourse: plainRightCourse(13, 13, 1),
  txt: [
    "course 0 R  start F0  end B1  （27 针）",
    "第一环落座之后 N=27，窗 F14[0…13] / B13[1…13]。",
    "第四环结束 N=29，窗 F15[0…14] / B14[1…14]。",
    "第10环结束 N=46，窗 F23[0…22] / B23[0…22]。",
    "表宽 48",
    "10 环都在这一张表上。",
  ],
  status: ["前床 F0–F13", "后床 B13–B1", "表宽 48", "10 环落座 27、27、29、29、33、41、46、46、46、46"],
});

assertDenseCylinderSample({
  sheet: "dense-thin-cylinder",
  title: "Dense Thin Cylinder",
  loader: "loadDenseThinCylinder",
  dir: "dense-thin",
  prefix: "dense_thin_cylinder",
  recognizer: "isDenseThinCylinderBedChart",
  bedChart: isDenseThinCylinderBedChart,
  rels: [
    "dense-thin/dense_thin_cylinder_KnittingStitches.obj",
    "dense-thin/dense_thin_cylinder_cols_resample_field.obj",
    "dense-thin/dense_thin_cylinder_cols_resample.xls",
    "dense-thin/dense_thin_cylinder_faces_ring_layout.json",
    "dense-thin/dense_thin_cylinder_bed.xls",
  ],
  verts: 4880,
  faces: 1271,
  yMaxLo: 79.9,
  yMaxHi: 80.1,
  terms: [47, 47, 47, 47, 47, 130, 74, 28, 27, 26, 26, 25, 25, 25, 25, 25, 26, 26, 28, 34, 127, 85, 133, 141],
  cols: 69,
  width: 53,
  colMin: -1,
  colMax: 51,
  firstCourse: plainRightCourse(23, 23, 1),
  txt: [
    "course 0 R  start F0  end B1  （47 针）",
    "第一环落座之后 N=47，窗 F24[0…23] / B23[1…23]。",
    "第19环结束 N=34，窗 F17[0…16] / B17[0…16]。",
    "第20环结束 N=38，窗 F19[0…18] / B19[0…18]。",
    "第24环结束 N=47，窗 F24[0…23] / B23[1…23]。",
    "course 69: rack B +1 so the right fold can flip one stitch (F17[0…16] / B21[-4…16] → F17[0…16] / B21[-3…17]).",
    "course 69: right-fold flip B17→F17 (same index).",
    "course 69: rack B +1 so the right fold can flip one stitch (F18[0…17] / B20[-2…17] → F18[0…17] / B20[-1…18]).",
    "course 69: right-fold flip B18→F18 (same index).",
    "course 69: counts match and the beds are one needle apart. Rack B +1 (F19[0…18] / B19[-1…17] → F19[0…18] / B19[0…18]).",
    "表宽 53",
    "24 环都在这一张表上。",
  ],
  status: ["前床 F0–F23", "后床 B23–B1", "表宽 53", "24 环落座 47、47、47、47、47、46、36、28、27、26、26、25、25、25、25、26、26、28、34、38、46、47、47、47"],
});

{
  const denseThinTxt = readFileSync(join(sampleDir, "dense-thin/dense_thin_cylinder_bed.txt"), "utf8");
  assert(denseThinTxt.includes("24 环都在这一张表上。"), "Dense Thin Cylinder bed covers all 24 faces_ring rings");
  assert(!denseThinTxt.includes("未完成") && !denseThinTxt.includes("generation stopped"), "Dense Thin Cylinder bed is the finished 24-ring sheet");
}

{
  const thinTxt = readFileSync(join(sampleDir, "thin/thin_cylinder_bed.txt"), "utf8");
  assert(thinTxt.includes("13 环都在这一张表上。"), "Thin Cylinder bed covers all 13 faces_ring rings");
  assert(thinTxt.includes("course 0 R  start F0  end B1  （23 针）"), "Thin Cylinder first course is 23 stitches");
  assert(thinTxt.includes("第13环结束 N=23，窗 F12[0…11] / B11[1…11]。"), "Thin Cylinder last ring seat");
  assert(!thinTxt.includes("未完成") && !thinTxt.includes("10 环都在这一张表上"), "Thin Cylinder bed is the finished 13-ring sheet");
  const thinBed = parseExcelReadableMap(readFileSync(join(sampleDir, "thin/thin_cylinder_bed.xls")));
  const thinKnit = thinBed.rows.find((row) => row.dir === "R" || row.dir === "L").cells.filter((cell) => cell.token);
  assert(
    thinBed.needleCols.length === 26 && thinBed.colMin === 0 && thinBed.colMax === 25 &&
      thinKnit.map((cell) => `${cell.token}@${cell.bed}${cell.phys}`).join(" ") === plainRightCourse(11, 11, 1),
    "Thin Cylinder bed chart is 26 columns and starts F0–F11 then B11–B1",
  );
  const thinFn = mainSrc.slice(mainSrc.indexOf("async function loadThinCylinder"), mainSrc.indexOf("async function loadThinCylinder") + 900);
  assert(
    thinFn.includes("表宽 26") && thinFn.includes("前床 F0–F11") && thinFn.includes("后床 B11–B1") &&
      thinFn.includes("13 环落座 23、23、23、20、13、13、13、13、20、23、24、24、23"),
    "Thin Cylinder status quotes the 13-ring bed",
  );
}

assertDenseCylinderSample({
  sheet: "dense-fat-cylinder",
  title: "Dense Fat Cylinder",
  loader: "loadDenseFatCylinder",
  dir: "dense-fat",
  prefix: "dense_fat_cylinder",
  recognizer: "isDenseFatCylinderBedChart",
  bedChart: isDenseFatCylinderBedChart,
  rels: [
    "dense-fat/dense_fat_cylinder_KnittingStitches.obj",
    "dense-fat/dense_fat_cylinder_cols_resample_field.obj",
    "dense-fat/dense_fat_cylinder_cols_resample.xls",
    "dense-fat/dense_fat_cylinder_faces_ring_layout.json",
    "dense-fat/dense_fat_cylinder_bed.xls",
  ],
  verts: 5204,
  faces: 1387,
  yMaxLo: 79.93,
  yMaxHi: 80.0,
  terms: [25, 25, 26, 26, 28, 41, 133, 135, 63, 115, 137, 137, 85, 85, 135, 37, 78, 26, 25, 25],
  cols: 47,
  width: 54,
  colMin: -1,
  colMax: 52,
  firstCourse: plainRightCourse(12, 12, 1),
  txt: [
    "第一环落座之后 N=25，窗 F13[0…12] / B12[1…12]。",
    "第五环结束 N=36，窗 F18[0…17] / B18[0…17]。",
    "第20环结束 N=25，窗 F13[0…12] / B12[1…12]。",
    "表宽 54",
    "20 环都在这一张表上。",
  ],
  status: ["前床 F0–F12", "后床 B12–B1", "表宽 54", "20 环落座 25、26、26、28、36、43、47、47、47、47、47、47、47、47、46、29、26、26、25、25"],
});

assertDenseCylinderSample({
  sheet: "fat-cylinder",
  title: "Fat Cylinder",
  loader: "loadFatCylinder",
  dir: "fat",
  prefix: "fat_cylinder",
  recognizer: "isFatCylinderBedChart",
  bedChart: isFatCylinderBedChart,
  rels: [
    "fat/fat_cylinder_KnittingStitches.obj",
    "fat/fat_cylinder_cols_resample_field.obj",
    "fat/fat_cylinder_cols_resample.xls",
    "fat/fat_cylinder_faces_ring_layout.json",
    "fat/fat_cylinder_bed.xls",
  ],
  verts: 1270,
  faces: 333,
  yMaxLo: 79.93,
  yMaxHi: 80.0,
  terms: [13, 13, 14, 24, 70, 46, 70, 31, 39, 13],
  cols: 24,
  width: 28,
  colMin: 0,
  colMax: 27,
  firstCourse: plainRightCourse(6, 6, 1),
  txt: [
    "course 0 R  start F0  end B1  （13 针）",
    "course 50 R  start F6  end B1  （22 针）",
    "第一环落座之后 N=13，窗 F7[0…6] / B6[1…6]。",
    "第8环结束 N=23，窗 F12[0…11] / B11[1…11]。",
    "第9环结束 N=13，窗 F7[0…6] / B6[1…6]。",
    "第10环结束 N=13，窗 F7[0…6] / B6[1…6]。",
    "F^L@F6 B·@B6 B·@B5 B·@B4 B·@B3 B·@B2 B·@B1 B·@B0 F·@F0 F·@F1 F·@F2 F·@F3 F·@F4",
    "F-R1@F5 F·@F6",
    "F·@F6 B·@B6 B·@B5 B·@B4 B·@B3 B·@B2 B·@B1",
    "表宽 28",
    "10 环都在这一张表上。",
  ],
  status: ["前床 F0–F6", "后床 B6–B1", "表宽 28", "10 环落座 13、14、24、24、24、24、24、23、13、13"],
});

{
  const fatTxt = readFileSync(join(sampleDir, "fat/fat_cylinder_bed.txt"), "utf8");
  assert(fatTxt.includes("10 环都在这一张表上。"), "Fat Cylinder bed covers all 10 faces_ring rings");
  assert(!fatTxt.includes("未完成") && !fatTxt.includes("generation stopped"), "Fat Cylinder bed is the finished 10-ring sheet");
}

{
  const exportAt = html.indexOf('id="export-dat"');
  const openAt = html.indexOf('id="open-menu-btn"');
  const headerEnd = html.indexOf("</header>");
  assert(exportAt > 0 && openAt > exportAt && headerEnd > openAt, "Export sits in the top bar beside Open");
  assert(html.includes(NO_DAT_TITLE) && /id="export-dat"[^>]*disabled/.test(html), "Export starts disabled with the no-dat tooltip");
  assert(!/id="export-dat"[^>]*\shidden\b/.test(html), "Export stays in the layout when a sheet has no dat");
  assert(mainSrc.includes("syncExportButton") && mainSrc.includes("downloadSheetDat") && mainSrc.includes("datForSheet"), "main downloads the dat for the current sheet");
  assert(/\.btn:disabled\s*\{[^}]*opacity:\s*0\.45/.test(css), "a sheet without a dat greys the Export button");
  const faces = datForSheet("faces-ring0");
  const dense = datForSheet("dense-standrad-cylinder");
  assert(faces?.filename === "faces_ring0_v2.dat" && faces.path === "sample/cylinder/faces_ring0_v2.dat", "Bunny sheet still exports the committed v2 dat");
  assert(
    dense?.filename === "dense_standrad_cylinder.dat" && dense.path === "sample/dense-standrad/dense_standrad_cylinder.dat",
    "Dense Standrad Cylinder exports dense_standrad_cylinder.dat",
  );
  assert(datForSheet("faces_ring0") === faces && datForSheet("faces-ring1") === faces && datForSheet("dense-standrad") === dense, "sheet aliases share the same dat");
  const standrad = datForSheet("standrad-cylinder");
  const decrease = datForSheet("decrease-cylinder");
  const increase = datForSheet("increase-cylinder");
  const thin = datForSheet("thin-cylinder");
  const fat = datForSheet("fat-cylinder");
  assert(standrad?.filename === "standrad_cylinder.dat" && standrad.path === "sample/cylinder/standrad_cylinder.dat", "Standrad Cylinder exports standrad_cylinder.dat");
  assert(decrease?.filename === "decrease_cylinder.dat" && decrease.path === "sample/decrease/decrease_cylinder.dat", "Decrease Cylinder exports decrease_cylinder.dat");
  assert(increase?.filename === "increase_cylinder.dat" && increase.path === "sample/increase/increase_cylinder.dat", "Increase Cylinder exports increase_cylinder.dat");
  assert(thin?.filename === "thin_cylinder.dat" && thin.path === "sample/thin/thin_cylinder.dat", "Thin Cylinder exports thin_cylinder.dat");
  assert(fat?.filename === "fat_cylinder.dat" && fat.path === "sample/fat/fat_cylinder.dat", "Fat Cylinder exports fat_cylinder.dat");
  assert(
    datForSheet("standrad") === standrad &&
      datForSheet("decrease") === decrease &&
      datForSheet("increase") === increase &&
      datForSheet("thin") === thin &&
      datForSheet("fat") === fat,
    "complete cylinder aliases share the same dat",
  );
  for (const sheet of ["", "dense-decrease-cylinder", "dense-increase-cylinder", "dense-thin-cylinder", "dense-fat-cylinder", "dense-bunny-4split", "dense-bunny-le", "bunny-corridor-field-swallow", "bunny-exp-readable-row-schedule", "standrad-exp-readable-row-schedule", "dense-standrad-exp-readable-row-schedule", "increase-exp-readable-row-schedule", "decrease-exp-readable-row-schedule", "thin-exp-readable-row-schedule", "fat-exp-readable-row-schedule", "dense-increase-exp-readable-row-schedule", "dense-decrease-exp-readable-row-schedule", "dense-thin-exp-readable-row-schedule", "dense-fat-exp-readable-row-schedule"]) {
    assert(datForSheet(sheet) == null, `${sheet || "sample"} has no dat export`);
  }
  {
    const dir = join(root, "experiments/bunny-corridor-field-swallow");
    const shaFile = (name) => createHash("sha256").update(readFileSync(join(dir, name))).digest("hex");
    assert(shaFile("columns_polyline.obj") === "529046efbe2814c568da710f2df9e1eae3950d814777a82f7f0d0d5a27e0b5a0", "corridor polyline matches the unsmoothed no-postprocess columns");
    assert(shaFile("columns_type.obj") === "6044697ecf6a80429d53cb582328e62c591703bbd06e341acb95afe415c1ef68", "corridor type matches the unsmoothed no-postprocess columns");
    assert(shaFile("columns_order.json") === "44849615fd2fd8967262418d1b763fd2ebba7917c4cff09da0a4e15b5db784b1", "corridor order matches the unsmoothed no-postprocess columns");
    assert(shaFile("official_bunny_cut_smoothed.obj") === "1d4f7163dfcd51de8d44982483797ff5a238d23e7f4d60703ab89172f6f49e23", "corridor smoothed cut stays the f776726 mesh");
    assert(!existsSync(join(dir, "official_bunny_cut.obj")), "the unsmoothed cut is not copied");
    const names = readdirSync(dir);
    assert(
      names.slice().sort().join("\n") ===
        ["columns_order.json", "columns_polyline.obj", "columns_type.obj", "manifest.json", "official_bunny_cut_smoothed.obj"].join("\n"),
      "corridor sheet keeps the cut mesh and the three column files",
    );
    assert(!names.some((name) => /\.(dat|k|xls|txt)$/i.test(name)), "corridor preview does not add a bed, dat, or knitting code");
    assert(!existsSync(join(sampleDir, "bunny-corridor-field-swallow")), "corridor assets stay out of public/sample");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    assert(manifest.name.includes("实验") && manifest.outputs.length === 1, "corridor manifest is one experiment output");
    const rels = collectManifestRefs(manifest);
    assert(
      rels.includes("official_bunny_cut_smoothed.obj") &&
        rels.includes("columns_polyline.obj") &&
        rels.includes("columns_type.obj") &&
        rels.includes("columns_order.json") &&
        rels.length === 4,
      "corridor manifest lists the smoothed cut and the three column files",
    );
    assert(!rels.some((rel) => /cols_resample|readable_map|faces_ring|KnittingStitches|\.xls|\.dat$|\.k$/i.test(rel)), "corridor manifest does not invent a bed");
    const entries = [
      { name: "manifest.json", path: "experiments/bunny-corridor-field-swallow/manifest.json", text: JSON.stringify(manifest) },
      ...rels.map((rel) => ({
        name: rel,
        path: `experiments/bunny-corridor-field-swallow/${rel}`,
        text: readFileSync(join(dir, rel), "utf8"),
      })),
    ];
    const proj = projectFromManifest(manifest, indexFiles(entries), "experiments/bunny-corridor-field-swallow/manifest.json");
    assert(proj.warnings.length === 0 && proj.outputs.length === 1, `corridor sheet resolves: ${proj.warnings.join("; ")}`);
    const out = proj.outputs[0];
    assert(out.columnExtract === true && /official_bunny_cut_smoothed\.obj$/i.test(out.meshFile?.name || ""), "corridor sheet draws the smoothed cut with the columns");
    assert(!out.readableMapFile && !out.readableMapTxtFile && !out.knitCodeFile && !out.stitchFile && !out.colsResampleFile && !out.colsResampleXlsFile, "corridor sheet has no bed or knitting code");
    const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry.text]));
    const extract = parseExtractColumns({
      polylineText: byName["columns_polyline.obj"],
      typeText: byName["columns_type.obj"],
      order: JSON.parse(byName["columns_order.json"]),
    });
    assert(extract.problems.length === 0, `corridor columns disagree: ${extract.problems.join("; ")}`);
    assert(extract.columns.length === 120 && extract.colors.type && !extract.colors.field, "corridor preview has 120 type-colored columns and no field file");
    const counts = {};
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const col of extract.columns) {
      counts[col.type] = (counts[col.type] || 0) + 1;
      for (const point of col.points) {
        y0 = Math.min(y0, point.y);
        y1 = Math.max(y1, point.y);
      }
    }
    assert(counts.FULL === 9 && counts.SHORT === 111 && Object.keys(counts).length === 2, `corridor types ${JSON.stringify(counts)}`);
    assert(extract.columns.every((col, i) => col.col === i), "corridor index_column is 0..119");
    const order = JSON.parse(byName["columns_order.json"]);
    const shortRuns = [];
    let shortRun = 0;
    for (const rec of order) {
      if (rec.type === "FULL") {
        if (shortRun) shortRuns.push(shortRun);
        shortRun = 0;
      } else {
        shortRun += 1;
      }
    }
    if (shortRun) shortRuns.push(shortRun);
    assert(shortRuns.join(",") === "4,10,15,3,14,10,5,14,36", `corridor shorts per gap ${shortRuns.join(",")}`);
    const vertexBlocks = (text) => {
      const blocks = [];
      let cur = null;
      for (const line of text.split("\n")) {
        if (line.startsWith("# index=")) {
          if (cur) blocks.push(cur);
          cur = [];
        } else if (line.startsWith("v ") && cur) cur.push(line);
      }
      if (cur) blocks.push(cur);
      return blocks;
    };
    const polyBlocks = vertexBlocks(byName["columns_polyline.obj"]);
    const typeBlocks = vertexBlocks(byName["columns_type.obj"]);
    const fullRidges = [
      [0, "3bea6133d1b5b07c614da0d82481df64b3274426bc44ab665c6a0a76d1f4ea8a", "504d7e62590a7fcee333c423578c032e5344efd6873738c86fa046068ecc8b99"],
      [5, "315194e7cafabbbf0cbada72b40c5641b024bb4af1c511e552a95a2b043b3b88", "527a6123588446a52db5d46c591b6ad0c32e603366804024f83197aefe777acd"],
      [16, "a6bb4b91ade47d3ab5e6fbdbdf34ec7a2d674b6f4319f8e50e42585cddafa0c6", "e2073c576309213e681fb5bd8b749e4816959849e738b451c0414abe1223908e"],
      [32, "714e638305d409b9eaaf751b41263ea0c770ced62002eda6a3105dd99fa0caf8", "8ab6819762634963e2666cffa20ccc2670900a4dd94e0c12581b9f0535c598b9"],
      [36, "8402db3de4b7f86e5785f8146f7875245b46e5d245947c8dcc92e920f9931dd8", "d39fae72f4f5912f9ff2a343fa019cc81982f01d4c07da65661680add7e134df"],
      [51, "5105761e89455e87e4a23017b053fcce3e588663ed243a889effcd748a8d9d9d", "2749b012abfda77ada54e4124a140ae084b728ef0f180073a45bd49c449d7131"],
      [62, "6fb8f936a90c682f55a80ea7427602b8b826e15be3a72fe1ab7ec144f4cdb040", "1ea36940d32d819cbbf90735e6e21abb37152f7e4663323aaee0aafc341454b1"],
      [68, "c631b983605ebe995ab61a0001c0e49e081dab5800090a0b60762d16c662540e", "3e9efc0278a9cf6231e173f2e6b9daec2bddd17776ccd986b1d43ad2f584dff1"],
      [83, "3f3b45ce1984c5e5dcbec0852bc2458170dab15fb58778098dc3151647f71223", "450b9b6eb61480189a5a887c09caf5c9b8d40ff5255cd067f261d4a1198a3d16"],
    ];
    for (const [index, polyHash, typeHash] of fullRidges) {
      const ph = createHash("sha256").update(`${polyBlocks[index].join("\n")}\n`).digest("hex");
      const th = createHash("sha256").update(`${typeBlocks[index].join("\n")}\n`).digest("hex");
      assert(order[index]?.type === "FULL" && ph === polyHash && th === typeHash, `FULL ridge at index ${index} stays the unsmoothed no-postprocess geometry`);
    }
    const full = extract.columns.find((col) => col.type === "FULL");
    assert(full.points.at(-1).y > full.points[0].y, "corridor height stays on Y");
    let meshY0 = Infinity;
    let meshY1 = -Infinity;
    for (const line of byName["official_bunny_cut_smoothed.obj"].split(/\n/)) {
      if (!line.startsWith("v ")) continue;
      const y = Number(line.split(/\s+/)[2]);
      meshY0 = Math.min(meshY0, y);
      meshY1 = Math.max(meshY1, y);
    }
    assert(y0 >= meshY0 - 1e-3 && y1 <= meshY1 + 1e-3, "corridor columns sit on the smoothed cut");
    assert(
      html.includes('id="load-bunny-corridor-field-swallow"') &&
        html.includes("Bunny 走廊抽列（实验）") &&
        html.includes("实验走廊抽列预览，不是官方 Bunny") &&
        html.indexOf('id="load-bunny-corridor-field-swallow"') > html.indexOf('id="load-faces-ring0"') &&
        /id="load-faces-ring0"[^>]*>Bunny<\/button>/.test(html),
      "Open menu keeps official Bunny and adds the corridor experiment",
    );
    assert(
      mainSrc.includes('const BUNNY_CORRIDOR_SHEET = "bunny-corridor-field-swallow"') &&
        mainSrc.includes("loadBunnyCorridorFieldSwallow") &&
        mainSrc.includes("facesBaseLayers") &&
        mainSrc.includes("9 FULL · 111 短柱 · 120 列") &&
        mainSrc.includes("没有针床"),
      "the corridor sheet loads from its own id and shows the cut",
    );
  }
  const sha256 = (rel) => createHash("sha256").update(readFileSync(join(sampleDir, rel))).digest("hex");
  assert(
    sha256("cylinder/faces_ring0_v2.dat") === "c8a902477e63db902931386067fda9355d293a17304fe046af695e1b180b90e4",
    "faces_ring0_v2.dat bytes stay",
  );
  assert(
    sha256("cylinder/iteration_0_cut_cols_resample_field.obj") === "07a83f8672d57c43c56f7d63f62a2b7a0e34a91b02bd6645d12213f0c902e6a5",
    "Bunny cols_resample field is the SingaLab same-height warp",
  );
  assert(
    sha256("cylinder/iteration_0_cut_cols_resample_type.obj") === "eb9765be134e08009353350a953e04b76c7d6d0b46a3ccba1d68b39b12677132",
    "Bunny cols_resample type matches that warp",
  );
  assert(
    sha256("cylinder/iteration_0_cut_cols_resample.xls") === "a9153334ad27e51e4b47de67f358bf1e8bf621fb215daa80fc37793b2f3a1a8f",
    "Bunny cols_resample xls matches that warp",
  );
  assert(
    sha256("cylinder/iteration_0_cut_KnittingStitches.obj") === "d2ba976386cd6caec0bab4a614e2eee68439c6ae545f40b6985b71e93b418908",
    "Bunny KnittingStitches matches that warp run",
  );
  assert(
    sha256("cylinder/faces_ring_layout.json") === "e55c6eccbfc6d051b8d02013095825ca9a4bab986f9f8a2d30382e088bc42d23",
    "Bunny faces_ring matches that warp run",
  );
  assert(
    sha256("cylinder/iteration_0_cut_first_rows.xls") === "a357679e27e53510b23f6dafac321c04d3c72a951816b77ed7ea7690649e6593",
    "Bunny first_rows matches that warp run",
  );
  assert(
    sha256("cylinder/cut_iteration_0.obj") === "57c203cd218bc90d29aec109f714e857081ec1153ed9e20458950a9839514114",
    "Bunny cut mesh bytes stay",
  );
  assert(
    sha256("cylinder/faces_ring0_step4_bed.xls") === "b26e069c09f27b74cd6883b61802ba587963ea76454986642dcc220343f82afd",
    "Bunny step4 bed xls stays",
  );
  assert(
    sha256("cylinder/faces_ring0_step4_bed.txt") === "61a4c1537f5254196356b96209bb1cf29bd8737794f6376eaa6f88a36cf3d828",
    "Bunny step4 bed txt stays",
  );
  assert(
    sha256("cylinder/stitch_map_bind.json") === "b6203ac1af58cabf218dbd59981049ff980dacb735592332558349f5c14744e6",
    "Bunny stitch_map_bind bytes stay",
  );
  assert(
    sha256("dense-standrad/dense_standrad_cylinder.dat") === "53b5b4d804454bc2864f156999c95cca3c13958b0001e45d708c36f6e554278d",
    "dense_standrad_cylinder.dat bytes stay",
  );
  assert(
    sha256("dense-standrad/dense_standrad_cylinder.k") === "21fac25da6fa79ce0ae21e20c8c04303e25fc1d0d3fd4df445b8af7dd8a575d6",
    "dense_standrad_cylinder.k bytes stay",
  );
  assert(sha256("cylinder/standrad_cylinder.dat") === "f6c5914f87ba264d7214c9c3c3988280d42498eae4bda46068f9e90c1f02f35c", "standrad_cylinder.dat bytes stay");
  assert(sha256("cylinder/standrad_cylinder.k") === "b371531d17e884b4cd2e0576242b4055a9163e82a2d58d4af7ac45739498c489", "standrad_cylinder.k bytes stay");
  assert(sha256("decrease/decrease_cylinder.dat") === "3e166201139705137ac6d72acb7c5ba34769ebf520eea53902b347178b2325b2", "decrease_cylinder.dat bytes stay");
  assert(sha256("decrease/decrease_cylinder.k") === "54ee98c44c49bb560d3c6711244a1df1d4869a52bc3fffedd7c464efbcafac71", "decrease_cylinder.k bytes stay");
  assert(sha256("increase/increase_cylinder.dat") === "2f9361b3f6636ca634ffdc14d42734854004ee4127d03d5c5021efb310923723", "increase_cylinder.dat bytes stay");
  assert(sha256("increase/increase_cylinder.k") === "ebd9121d42514719dba4d66899873941fa70ebd2a38668da6fd9f5541cb2ede9", "increase_cylinder.k bytes stay");
  assert(sha256("thin/thin_cylinder.dat") === "06dfb76b5fe20786cda385084fa90a42563114f578d8e81787695ac3522ce5a0", "thin_cylinder.dat bytes stay");
  assert(sha256("thin/thin_cylinder.k") === "9b88134acd72871563b3809bbed8535a7afb1199bf9fd1f34cb0a43e920b03f0", "thin_cylinder.k bytes stay");
  assert(sha256("fat/fat_cylinder.dat") === "2a36f8cdd7b61f8c7fbf2deedda75b8c97415bd1ba9873a56d6aaf36cd5e9d83", "fat_cylinder.dat bytes stay");
  assert(sha256("fat/fat_cylinder.k") === "590263f4f65e24aab3911b3339eb16862090052a27f17a981535b3e0902c118b", "fat_cylinder.k bytes stay");
  assert(readFileSync(join(sampleDir, "increase/increase_cylinder.k"), "utf8").includes("\nsplit "), "increase knitout uses split");
  assert(!readFileSync(join(sampleDir, "cylinder/standrad_cylinder.k"), "utf8").includes("\nsplit "), "standrad has no increase split");
}

assert(!fromManifest.outputs[0].columnExtract && fromManifest.outputs[0].meshFile, "Bunny stays a cut-mesh sample");
assert(fromManifest.warnings.length === 0, `cylinder sample resolves without warnings: ${fromManifest.warnings.join("; ")}`);
assert(
  fromManifest.outputs.every((out) => /cut_iteration_0\.obj$/i.test(out.meshFile?.path || "")),
  "cylinder outputs still use the cut body mesh",
);
assert(!existsSync(join(cylDir, "cut_heat")), "cut heat sample folder is gone");
assert(!refs.some((rel) => /cutHeat|cut_heat/i.test(rel)), "manifest does not reference a cut heat overlay");
assert(!css.includes(".base-check:has(input:disabled)"), "the greyed cut heat row style is gone");

assert(isColumnPolylineName("columns_polyline.obj") && !isColumnPolylineName("iteration_0_cut_cols_resample_field.obj"), "column polyline name stays specific");
assert(isColumnTypeObjName("columns_type.obj") && !isColumnTypeObjName("iteration_0_cut_cols_resample_type.obj"), "column type name does not swallow cols_resample type");
assert(isColumnFieldObjName("columns_field.obj") && !isColumnFieldObjName("iteration_0_cut_cols_resample_field.obj"), "column field name does not swallow cols_resample field");
assert(isColumnOrderName("columns_order.json") && !isColumnOrderName("faces_ring_layout.json"), "column order name stays specific");
assert(
  html.includes('id="load-dense-bunny-4split"') &&
    html.includes("Dense Bunny 4split") &&
    html.includes('id="load-dense-bunny-le"') &&
    html.includes("Dense Bunny LE") &&
    html.indexOf('id="load-dense-bunny-4split"') > html.indexOf('id="load-faces-ring0"') &&
    html.indexOf('id="load-dense-bunny-le"') > html.indexOf('id="load-dense-bunny-4split"'),
  "Open menu lists the two Dense Bunny column extracts after Bunny",
);
assert(html.includes('id="col-color-type"') && html.includes('id="col-color-field"') && html.includes('id="col-legend"') && html.includes('id="cols-sub"'), "column extracts can switch type and field colors");
assert(/id="col-color"[^>]*hidden/.test(html) && /id="cols-sub"[^>]*hidden/.test(html), "type/field switch stays hidden until a column extract is open");
assert(mainSrc.includes("parseExtractColumns") && mainSrc.includes("dense-bunny-4split.json") && mainSrc.includes("dense-bunny-le.json"), "main loads the two column extracts");
assert(mainSrc.includes('setSheetQuery("dense-bunny-4split")') && mainSrc.includes('setSheetQuery("dense-bunny-le")'), "column extracts have their own sheet ids");
assert(!mainSrc.includes("loadCutHeatMesh") && !html.includes("切开热力场"), "column extracts do not restore the cut heat row");

{
  const toyPoly = "v 0 0 0\nv 1 0 0\nv 2 0 0\nv 2 1 0\nl 1 2\nl 3 4\n";
  const toyType = "v 0 0 0 1 0 0\nv 1 0 0 1 0 0\nv 2 0 0 0 0 1\nv 2 1 0 0 0 1\nl 1 2\nl 3 4\n";
  const toyField = "v 0 0 0 0.2 0.15 0.8\nv 1 0 0 0.9 0.15 0.1\nv 2 0 0 0.4 0.15 0.6\nv 2 1 0 0.4 0.15 0.6\nl 1 2\nl 3 4\n";
  const toyOrder = {
    n_exported: 2,
    n_full: 1,
    n_short: 1,
    type_counts: { FULL: 1, SHORT_BEGIN: 1 },
    point_source: "smooth_points",
    field_source: "scale_values_smooth",
    scale_ran: false,
    phagocytosis: { n: 2, n_raw: 3, n_in_batch_merges: 1 },
    columns: [
      { index_column: 0, type: "FULL", n_points: 2 },
      { index_column: 1, type: "SHORT_BEGIN", n_points: 2 },
    ],
  };
  const toy = parseExtractColumns({ polylineText: toyPoly, typeText: toyType, fieldText: toyField, order: toyOrder });
  assert(toy.problems.length === 0 && toy.columns.length === 2 && toy.colors.type && toy.colors.field, "toy extract keeps both color files when positions match");
  assert(toy.columns[0].type === "FULL" && toy.columns[1].type === "SHORT_BEGIN" && toy.columns[0].col === 0, "toy order attaches index_column and type");
  assert(toy.columns[0].points[0].x === 0 && toy.columns[0].points[0].y === 0 && toy.columns[0].points[0].z === 0, "toy geometry stays on the polyline");
  applyExtractColumnColors(toy.columns, "type");
  assert(toy.columns[0].points[0].r === 1 && toy.columns[0].points[0].g === 0 && toy.columns[1].points[0].b === 1, "type colors come from columns_type");
  assert(toy.columns[0].points[0].x === 0, "type coloring does not move the polyline");
  applyExtractColumnColors(toy.columns, "field");
  assert(toy.columns[0].points[0].r === 0.2 && toy.columns[0].points[1].r === 0.9 && toy.columns[0].points[0].g === 0.15, "field colors come from columns_field");
  assert(formatExtractRangeLabel(toy.columns, 0, 1) === "index_column: idx 0 / 2 · FULL", "a single column shows its type");
  assert(formatExtractRangeLabel(toy.columns, 0, 2) === "index_column: idx 0-1 / 2", "a column range stays index_column, not cols_resample");
  const bareOrder = parseExtractColumns({ polylineText: toyPoly, typeText: toyType, order: toyOrder.columns });
  assert(
    bareOrder.problems.length === 0 && bareOrder.columns[0].type === "FULL" && bareOrder.columns[1].type === "SHORT_BEGIN" && bareOrder.colors.type,
    "a columns_order array still attaches type",
  );
  const legend = extractTypeLegend(toy.columns);
  assert(legend.map((row) => `${row.type}:${row.n}`).join(",") === "FULL:1,SHORT_BEGIN:1" && legend[0].color.r === 1, "legend counts types already on the columns");
  assert(formatExtractStatus("Toy", toy).includes("scale_ran=false") && formatExtractStatus("Toy", toy).includes("merges=1"), "status reports the order file's scale and phagocytosis");
  const shifted = parseExtractColumns({
    polylineText: toyPoly,
    typeText: "v 5 0 0 0 1 0\nv 6 0 0 0 1 0\nv 2 0 0 0 0 1\nv 2 1 0 0 0 1\nl 1 2\nl 3 4\n",
    order: toyOrder,
  });
  assert(!shifted.colors.type && shifted.problems.some((p) => p.includes("columns_type")) && shifted.columns[0].type === "FULL", "a moved type obj is not used as color and does not invent a new polyline");
  const badOrder = parseExtractColumns({
    polylineText: toyPoly,
    order: { ...toyOrder, columns: [{ index_column: 0, type: "FULL", n_points: 9 }, toyOrder.columns[1]] },
  });
  assert(badOrder.columns.every((col) => col.type == null) && badOrder.problems.some((p) => p.includes("columns_order")), "mismatched n_points does not borrow a type");
}

function assertDenseBunnyColumns(spec) {
  const data = JSON.parse(readFileSync(join(sampleDir, spec.manifest), "utf8"));
  assert(data.name === spec.title && data.outputs?.length === 1 && data.outputs[0].label === spec.title, `${spec.title} manifest is one labeled extract`);
  const rels = collectManifestRefs(data);
  assert(
    rels.includes(`${spec.dir}/columns_polyline.obj`) &&
      rels.includes(`${spec.dir}/columns_type.obj`) &&
      rels.includes(`${spec.dir}/columns_field.obj`) &&
      rels.includes(`${spec.dir}/columns_order.json`) &&
      rels.length === 4,
    `${spec.title} manifest lists only the four column files`,
  );
  assert(
    !rels.some((rel) => /cols_resample|faces_ring|KnittingStitches|readable_map|stitch_map|\.xls|\.dat$|\.k$|cut_iteration/i.test(rel)),
    `${spec.title} does not reference a mesh, bed, stitchmesh, or cols_resample`,
  );
  const sha256 = (rel) => createHash("sha256").update(readFileSync(join(sampleDir, rel))).digest("hex");
  assert(sha256(`${spec.dir}/columns_polyline.obj`) === spec.sha.polyline, `${spec.title} polyline bytes stay`);
  assert(sha256(`${spec.dir}/columns_type.obj`) === spec.sha.type, `${spec.title} type bytes stay`);
  assert(sha256(`${spec.dir}/columns_field.obj`) === spec.sha.field, `${spec.title} field bytes stay`);
  assert(sha256(`${spec.dir}/columns_order.json`) === spec.sha.order, `${spec.title} order bytes stay`);
  const entries = [
    { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ...rels.map((rel) => ({
      name: rel.split("/").pop(),
      path: `sample/${rel}`,
      text: readFileSync(join(sampleDir, rel), "utf8"),
    })),
  ];
  const proj = projectFromManifest(data, indexFiles(entries), "sample/manifest.json");
  assert(proj.warnings.length === 0 && proj.outputs.length === 1, `${spec.title} resolves without warnings`);
  const out = proj.outputs[0];
  assert(out.columnExtract === true && out.meshFile == null && out.overlayFile == null, `${spec.title} has no mesh`);
  assert(!out.stitchFile && !out.colsResampleFile && !out.colsResampleXlsFile && !out.facesRingLayoutFile && !out.readableMapFile && !out.readableMapTxtFile && !out.firstRowsFile && !out.stitchMapBindFile, `${spec.title} does not attach knitting files`);
  const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry.text]));
  const extract = parseExtractColumns({
    polylineText: byName["columns_polyline.obj"],
    typeText: byName["columns_type.obj"],
    fieldText: byName["columns_field.obj"],
    order: JSON.parse(byName["columns_order.json"]),
  });
  assert(extract.problems.length === 0, `${spec.title} files disagree: ${extract.problems.join("; ")}`);
  assert(extract.columns.length === spec.n && extract.colors.type && extract.colors.field, `${spec.title} has ${spec.n} colored columns`);
  assert(extract.columns[0].col === 0 && extract.columns[spec.n - 1].col === spec.n - 1, `${spec.title} index_column is 0..${spec.n - 1}`);
  assert(extract.columns.every((col, i) => col.col === i), `${spec.title} column order matches index_column`);
  const counts = {};
  for (const col of extract.columns) counts[col.type] = (counts[col.type] || 0) + 1;
  for (const [key, value] of Object.entries(spec.types)) {
    assert(counts[key] === value, `${spec.title} type ${key} is ${counts[key]}, expected ${value}`);
  }
  assert(Object.keys(counts).length === Object.keys(spec.types).length, `${spec.title} type counts match the order file`);
  assert(extract.order.scale_ran === spec.scaleRan && extract.order.point_source === "smooth_points", `${spec.title} keeps the file's scale and point source`);
  assert(extract.order.phagocytosis.n === spec.n && extract.order.phagocytosis.n_raw === spec.raw && extract.order.phagocytosis.n_in_batch_merges === spec.merges, `${spec.title} phagocytosis counts stay on the order file`);
  const typeChains = parseColsResampleField(byName["columns_type.obj"]);
  const fieldChains = parseColsResampleField(byName["columns_field.obj"]);
  applyExtractColumnColors(extract.columns, "type");
  assert(
    extract.columns[0].points[0].r === typeChains[0].points[0].r &&
      extract.columns[0].points[0].g === typeChains[0].points[0].g &&
      extract.columns[0].points[0].b === typeChains[0].points[0].b &&
      extract.columns[0].points[0].x === typeChains[0].points[0].x,
    `${spec.title} type view uses columns_type colors on the polyline`,
  );
  applyExtractColumnColors(extract.columns, "field");
  const head = extract.columns[0].points[0];
  const tail = extract.columns[0].points[extract.columns[0].points.length - 1];
  assert(head.r === fieldChains[0].points[0].r && head.g === fieldChains[0].points[0].g && head.b === fieldChains[0].points[0].b, `${spec.title} field view uses columns_field colors`);
  assert(head.x === fieldChains[0].points[0].x && head.y === fieldChains[0].points[0].y && head.z === fieldChains[0].points[0].z, `${spec.title} field coloring does not replace the polyline`);
  if (spec.fieldChanges) assert(head.r !== tail.r || head.b !== tail.b, `${spec.title} field color varies along the column`);
  const status = formatExtractStatus(spec.title, extract);
  for (const bit of spec.status) assert(status.includes(bit), `${spec.title} status missing ${bit}`);
  assert(!status.includes("cols_resample") && !status.includes("faces_ring"), `${spec.title} status does not invent cols_resample or faces_ring`);
  const discovered = projectFromDiscovery(indexFiles(entries.filter((entry) => entry.name !== "manifest.json")));
  assert(discovered.outputs.length === 1 && discovered.outputs[0].columnExtract && discovered.outputs[0].meshFile == null, `${spec.title} folder opens as columns only`);
}

assertDenseBunnyColumns({
  manifest: "dense-bunny-4split.json",
  title: "Dense Bunny 4split",
  dir: "dense-bunny-4split",
  n: 126,
  raw: 126,
  merges: 0,
  scaleRan: true,
  fieldChanges: true,
  types: { SHORT_END: 13, FULL: 11, SHORT_BEGIN: 65, SHORT_INNER: 37 },
  sha: {
    polyline: "c6aae4e5f6f3d9b111be99fb400e7702c09f870be49cd4f34786089eaee9f021",
    type: "4821815f3ce65fcb49cc25a7a5e49d11bec39b73ad59320de20efc8c93f90b31",
    field: "33c05a71d1607e0743027595ba45e4595db10efd11a5a008749b2260ce4c0479",
    order: "45b4c06e1b24cf777811e28ca333ff235828e11de5001e2d0e76480c4f9da85a",
  },
  status: ["126 columns", "index 0–125", "FULL=11", "SHORT_BEGIN=65", "SHORT_INNER=37", "SHORT_END=13", "smooth_points", "scale_values_smooth", "scale_ran=true", "merges=0"],
});
assertDenseBunnyColumns({
  manifest: "dense-bunny-le.json",
  title: "Dense Bunny LE",
  dir: "dense-bunny-le",
  n: 985,
  raw: 1434,
  merges: 449,
  scaleRan: false,
  fieldChanges: true,
  types: { SHORT_INNER: 877, SHORT_BEGIN: 78, SHORT_END: 25, FULL: 5 },
  sha: {
    polyline: "e35ee9329140fe19ca225a8a585534cba2e88daa7fbe029e2167a6e35e5360ab",
    type: "be6f2212226db1067e18f56024c1980e5b2346bf99bfe14e1a05249c9b32a442",
    field: "d227a431a86b5774d31862445b49c04968460f7ebc4fb056d2d9942b5098d330",
    order: "4cb6ed2d3b05cef8e857dc45152d1a980303ab821bf1ed54b9851a998684814e",
  },
  status: ["985 columns", "index 0–984", "FULL=5", "SHORT_INNER=877", "SHORT_BEGIN=78", "SHORT_END=25", "smooth_points", "scale_ran=false", "merges=449"],
});

function purposeFromSheetKind(row) {
  const tokens = (row?.cells || []).map((cell) => cell?.token).filter(Boolean);
  if (!tokens.length) return "";
  if (row.kind === "knit") return "织针";
  if (row.kind === "increase" || row.kind === "decrease") return "移针";
  if (row.kind === "balance") return "平衡";
  if (row.kind === "flip") return /right-fold flip/i.test(row.note || "") ? "平衡" : "移针";
  return "";
}

{
  const thinExp = parseExcelReadableMap(
    readFileSync(join(root, "experiments/official-thin-readable-row-schedule/exp-readable-map.xls")),
  );
  const thinExpect = {
    22: "移针",
    23: "平衡",
    42: "移针",
    69: "织针",
    70: "移针",
    71: "平衡",
    72: "平衡",
  };
  for (const [index, purpose] of Object.entries(thinExpect)) {
    const row = thinExp.rows[index];
    assert(rowPurposeLabel(row) === purpose, `Thin experiment row ${index} purpose is ${rowPurposeLabel(row)}, expected ${purpose}`);
    assert(
      rowSideLabel(Number(index), row) === `${index} ${row.dir} ${purpose}`,
      `Thin experiment row ${index} reads ${rowSideLabel(Number(index), row)}`,
    );
  }
  assert(rowSideLabel(70, thinExp.rows[70]) === "70 X+ 移针", "Thin experiment row 70 keeps X+ and adds 移针");
  assert(rowSideLabel(71, thinExp.rows[71]) === "71 X 平衡", "Thin experiment row 71 is a balance rack, not a transfer");
  assert(rowSideLabel(72, thinExp.rows[72]) === "72 Flip 平衡", "Thin experiment row 72 flip restores the bed");
  assert(thinExp.rows[42].dir === "Flip" && rowPurposeLabel(thinExp.rows[42]) === "移针", "a decrease Flip is 移针");
  assert(thinExp.rows[22].dir === "X" && thinExp.rows[23].dir === "X", "rows 22 and 23 are both X");
  assert(rowPurposeLabel(thinExp.rows[22]) === "移针" && rowPurposeLabel(thinExp.rows[23]) === "平衡", "X alone does not choose 移针 or 平衡");
}

{
  const officialThin = parseExcelReadableMap(readFileSync(join(sampleDir, "thin/thin_cylinder_bed.xls")));
  const officialExpect = { 21: "织针", 22: "移针", 23: "平衡", 26: "平衡", 29: "移针", 62: "移针", 70: "平衡", 75: "移针" };
  for (const [index, purpose] of Object.entries(officialExpect)) {
    assert(
      rowPurposeLabel(officialThin.rows[index]) === purpose && rowSideLabel(Number(index), officialThin.rows[index]).endsWith(purpose),
      `official Thin row ${index} ${officialThin.rows[index].dir} is ${rowPurposeLabel(officialThin.rows[index])}, expected ${purpose}`,
    );
  }
}

assert(rowPurposeLabel({ dir: "R", cells: [] }) === "", "a row with no operation has no purpose");
assert(rowPurposeLabel({ dir: "X", cells: [{ token: "" }] }) === "", "an empty transfer cell is not labeled");
assert(
  rowPurposeLabel({ dir: "X", kind: "balance", beds: "20针 · 前10[0…9] · 后10[0…9]", cells: [{ token: "B→" }] }) === "平衡",
  "row kind balance wins over a live-window beds string",
);
assert(
  rowPurposeLabel({ dir: "X", kind: "decrease", beds: "F10[0…9] / B10[0…9]", cells: [{ token: "F←" }] }) === "移针",
  "row kind decrease wins over a balance-shaped window",
);
assert(
  rowPurposeLabel({
    dir: "Flip",
    kind: "flip",
    note: "course 27: right-fold flip B10→F10 (same index).",
    beds: "16针 · 前8[0…7] · 后8[0…7]",
    cells: [{ token: "⬇" }],
  }) === "平衡",
  "a right-fold flip note is 平衡",
);
assert(
  rowPurposeLabel({
    dir: "Flip",
    note: "course 22: 第 1 次移圈前，折点 B8 翻到 F8。",
    beds: "16针 · 前8[0…7] · 后8[0…7]",
    cells: [{ token: "⬇" }],
  }) === "移针",
  "a decrease flip note is 移针",
);
assert(
  rowPurposeLabel({ dir: "X", beds: "", cells: [{ token: "←1" }] }) === "",
  "an X row with no window, kind, or note is not labeled from the letter",
);
assert(
  rowPurposeLabel({ dir: "X+", beds: "", cells: [{ token: "←1" }] }) === "移针",
  "an X+ opening without a bed window is still the shaping transfer",
);

{
  const expDirs = readdirSync(join(root, "experiments")).filter((name) =>
    existsSync(join(root, "experiments", name, "exp-readable-map.json")),
  );
  assert(expDirs.length >= 11, `expected the cylinder and bunny experiment sheets, got ${expDirs.length}`);
  for (const name of expDirs) {
    const sheet = JSON.parse(readFileSync(join(root, "experiments", name, "exp-readable-map.json"), "utf8")).sheet;
    const map = parseExcelReadableMap(readFileSync(join(root, "experiments", name, "exp-readable-map.xls")));
    assert(map.rows.length === sheet.length, `${name} xls rows ${map.rows.length} != json ${sheet.length}`);
    for (let i = 0; i < sheet.length; i++) {
      const got = rowPurposeLabel(map.rows[i]);
      const expected = purposeFromSheetKind(sheet[i]);
      assert(got === expected, `${name} row ${i} ${map.rows[i].dir} purpose ${got} != sheet kind ${sheet[i].kind} (${expected})`);
    }
  }
}

function bedTxtRows(text) {
  const lines = String(text).split("\n");
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^  row (\d+) (\S+)  /);
    if (!header) continue;
    const notes = [];
    let cells = "";
    let j = i + 1;
    while (j < lines.length && lines[j].startsWith("    ")) {
      const textLine = lines[j].trim();
      if (/^(?:[FB]|[⬆⬇←→])/.test(textLine)) cells = textLine;
      else notes.push(textLine);
      j++;
    }
    rows.push({ index: Number(header[1]), dir: header[2], cells, note: notes.join(" ") });
  }
  return rows;
}

function purposeFromBedNote(row) {
  if (!row.cells) return "";
  if (row.dir === "R" || row.dir === "L") return "织针";
  const note = row.note || "";
  if (/right-fold flip|\bRack\b|\brack\b|fold gap|counts match|seats toward|steps to|same-index flip|one needle apart|left junction/i.test(note)) {
    return "平衡";
  }
  if (/移圈|套到|开口|翻到|increase/i.test(note)) return "移针";
  return "UNPARSED";
}

{
  const beds = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!existsSync(path)) continue;
      if (name.endsWith("_bed.txt") || name.endsWith("step4_bed.txt")) beds.push(path);
      else if (name !== "node_modules" && !name.includes(".")) {
        try {
          if (readdirSync(path).length) walk(path);
        } catch {
          /* file */
        }
      }
    }
  };
  walk(sampleDir);
  assert(beds.length >= 10, `official bed texts found: ${beds.length}`);
  for (const txtPath of beds) {
    const rows = bedTxtRows(readFileSync(txtPath, "utf8"));
    const map = parseExcelReadableMap(readFileSync(txtPath.replace(/\.txt$/, ".xls")));
    assert(rows.length === map.rows.length, `${txtPath} txt rows ${rows.length} != xls ${map.rows.length}`);
    for (let i = 0; i < rows.length; i++) {
      const expected = purposeFromBedNote(rows[i]);
      assert(expected !== "UNPARSED", `${txtPath} row ${i} note was not classified: ${rows[i].note}`);
      assert(
        rowPurposeLabel(map.rows[i]) === expected,
        `${txtPath} row ${i} ${rows[i].dir} purpose ${rowPurposeLabel(map.rows[i])} != note ${expected}`,
      );
    }
  }
}

console.log("project checks ok");
