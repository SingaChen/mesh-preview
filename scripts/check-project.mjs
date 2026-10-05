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
