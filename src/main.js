import corridorManifest from "../experiments/bunny-corridor-field-swallow/manifest.json";
import corridorMeshUrl from "../experiments/bunny-corridor-field-swallow/official_bunny_cut_smoothed.obj?url";
import corridorPolylineUrl from "../experiments/bunny-corridor-field-swallow/columns_polyline.obj?url";
import corridorTypeUrl from "../experiments/bunny-corridor-field-swallow/columns_type.obj?url";
import corridorOrderUrl from "../experiments/bunny-corridor-field-swallow/columns_order.json?url";
import sideNeumannManifest from "../experiments/bunny-exp-side-neumann-swallow/manifest.json";
import sideNeumannSummary from "../experiments/bunny-exp-side-neumann-swallow/summary.json";
import sideNeumannPolylineUrl from "../experiments/bunny-exp-side-neumann-swallow/columns_polyline.obj?url";
import sideNeumannTypeUrl from "../experiments/bunny-exp-side-neumann-swallow/columns_type.obj?url";
import sideNeumannOrderUrl from "../experiments/bunny-exp-side-neumann-swallow/columns_order.json?url";
import sideNeumannUniformManifest from "../experiments/bunny-exp-side-neumann-uniform-swallow/manifest.json";
import sideNeumannUniformSummary from "../experiments/bunny-exp-side-neumann-uniform-swallow/summary.json";
import sideNeumannUniformPolylineUrl from "../experiments/bunny-exp-side-neumann-uniform-swallow/columns_polyline.obj?url";
import sideNeumannUniformTypeUrl from "../experiments/bunny-exp-side-neumann-uniform-swallow/columns_type.obj?url";
import sideNeumannUniformOrderUrl from "../experiments/bunny-exp-side-neumann-uniform-swallow/columns_order.json?url";
import sideNeumannWeightedManifest from "../experiments/bunny-exp-side-neumann-weighted-swallow/manifest.json";
import sideNeumannWeightedSummary from "../experiments/bunny-exp-side-neumann-weighted-swallow/summary.json";
import sideNeumannWeightedPolylineUrl from "../experiments/bunny-exp-side-neumann-weighted-swallow/columns_polyline.obj?url";
import sideNeumannWeightedTypeUrl from "../experiments/bunny-exp-side-neumann-weighted-swallow/columns_type.obj?url";
import sideNeumannWeightedOrderUrl from "../experiments/bunny-exp-side-neumann-weighted-swallow/columns_order.json?url";
import { NEW_SCHEDULE_ASSETS } from "./row-schedule-assets.js";
import {
  canonicalSheetId,
  promotedByLegacy,
  promotedByOfficial,
  scheduleBaseName,
  sheetKey,
} from "./row-schedule-catalog.js";
import { MeshViewer } from "./viewer.js";
import {
  clickInput,
  entriesFromFileList,
  hasDirectoryPicker,
  pickDirectoryEntries,
} from "./files.js";
import {
  basename,
  indexFiles,
  isExcelReadableMapName,
  isManifestShape,
  isXlsName,
  projectFromDiscovery,
  projectFromManifest,
  readEntryBuffer,
  readEntryText,
} from "./project.js";
import {
  applyStitchMapBind,
  bindStitchesToMap,
  collectManifestRefs,
  faceChunksFromFaces,
  facesRingChunksFromStitches,
  formatStitchPickParts,
  applyExtractColumnColors,
  extractTypeLegend,
  formatExtractRangeLabel,
  formatExtractStatus,
  parseColoredObj,
  parseColsResample,
  parseExtractColumns,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  parseStitchMapBind,
} from "./stitches.js";
import {
  formatPhysicalNeedle,
  formatPhysicalNeedles,
  isFacesRing0BedChart,
  isBunnyExpReadableMap,
  isDecreaseCylinderBedChart,
  isIncreaseCylinderBedChart,
  isThinCylinderBedChart,
  isFatCylinderBedChart,
  isStandradCylinderBedChart,
  isDenseStandradCylinderBedChart,
  isDenseIncreaseCylinderBedChart,
  isDenseDecreaseCylinderBedChart,
  isDenseThinCylinderBedChart,
  isDenseFatCylinderBedChart,
  isFlipDir,
  isTransferDir,
  knitBedsByFace,
  parseExcelReadableMap,
} from "./excel-map.js";
import { bindDualRange } from "./dual-range.js";
import {
  activeRingIndex,
  applyDisplayModelsRange,
  facesRingSliderN,
  formatDisplayModelsLabel,
  formatHalfOpenRangeLabel,
  registerDisplayModel,
  stitchesVisibleForSliders,
} from "./range.js";
import { applyBaseChoice, defaultBaseLayers, facesBaseLayers, isBaseHidden } from "./display.js";
import {
  buildReadableMapGrid,
  highlightKeysForStitch,
  highlightKeysFromStitches,
  stitchForMapCell,
} from "./readable-map.js";
import { ReadableMapView } from "./map-view.js";
import {
  bindKnitCodeStitches,
  describeKnitCell,
  KNIT_FUNCTION_RAIL_NOTE,
  clampKnitZoom,
  displayKnitModel,
  knitCodeCaption,
  knitCodeDisplayRows,
  knitCodeInitialScrollTop,
  knitCodeInk,
  knitCodeLegend,
  knitCellTravel,
  knitZoomedScroll,
  knitZoomFactor,
  knitTableCells,
  knitTableColumns,
  parseKnitCode,
} from "./knit-code.js";
import { NO_DAT_TITLE, datForSheet } from "./sheet-dat.js";
import { datForKnitSheet } from "./knitcode-dat.js";

const canvas = document.querySelector("#viewport");
const folderInput = document.querySelector("#folder-input");
const filesInput = document.querySelector("#files-input");
const openMenu = document.querySelector("#open-menu");
const openMenuBtn = document.querySelector("#open-menu-btn");
const openMenuList = document.querySelector("#open-menu-list");
const exportBtn = document.querySelector("#export-dat");
const exportSlot = document.querySelector("#export-slot");
const knitDatBtn = document.querySelector("#knit-dat");
const openFolderBtn = document.querySelector("#open-folder");
const openFilesBtn = document.querySelector("#open-files");
const facesRing0Btn = document.querySelector("#load-faces-ring0");
const BUNNY_CORRIDOR_SHEET = "bunny-corridor-field-swallow";
const BUNNY_CORRIDOR_LABEL = "Bunny 走廊抽列（实验）";
const BUNNY_CORRIDOR_MENU_TITLE = "实验走廊抽列预览，不是官方 Bunny";
const BUNNY_CORRIDOR_BANNER = "实验 · 走廊抽列 · 不是官方 Bunny";
const BUNNY_CORRIDOR_STATUS =
  "Bunny 走廊抽列（实验） · 9 FULL · 111 短柱 · 120 列 · 平滑切口 · 没有针床 · 不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_SHEET = "bunny-exp-side-neumann-swallow";
const BUNNY_SIDE_NEUMANN_LABEL = "Exp: Side-Neumann swallow";
const BUNNY_SIDE_NEUMANN_MENU_TITLE = "实验 Side-Neumann 抽列，不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_BANNER = "实验 · Side-Neumann swallow · 不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_STATUS = [
  BUNNY_SIDE_NEUMANN_LABEL,
  `${sideNeumannSummary.n_columns} columns`,
  `${sideNeumannSummary.n_full} FULL`,
  `${sideNeumannSummary.n_short} short`,
  sideNeumannSummary.column0_is_left_seam ? "column 0 left seam" : "",
  sideNeumannSummary.last_is_right_seam ? "last column right seam" : "",
  "不是官方 Bunny",
]
  .filter(Boolean)
  .join(" · ");
const BUNNY_SIDE_NEUMANN_UNIFORM_SHEET = "bunny-exp-side-neumann-uniform-swallow";
const BUNNY_SIDE_NEUMANN_UNIFORM_LABEL = "Exp: Side-Neumann one-pass swallow";
const BUNNY_SIDE_NEUMANN_UNIFORM_MENU_TITLE = "实验 Side-Neumann 一次吞列，不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_UNIFORM_BANNER = "实验 · Side-Neumann one-pass swallow · 不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_UNIFORM_STATUS = [
  BUNNY_SIDE_NEUMANN_UNIFORM_LABEL,
  `${sideNeumannUniformSummary.n_columns} columns`,
  `${sideNeumannUniformSummary.n_full_height} full-height`,
  `${sideNeumannUniformSummary.n_short} short`,
  sideNeumannUniformSummary.column0_is_left_seam ? "column 0 left seam" : "",
  sideNeumannUniformSummary.last_is_right_seam ? "last column right seam" : "",
  "不是官方 Bunny",
]
  .filter(Boolean)
  .join(" · ");
const BUNNY_SIDE_NEUMANN_WEIGHTED_SHEET = "bunny-exp-side-neumann-weighted-swallow";
const BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL = "Exp: Side-Neumann σ-weighted swallow";
const BUNNY_SIDE_NEUMANN_WEIGHTED_MENU_TITLE = "实验 Side-Neumann 正σ一次吞列，不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_WEIGHTED_BANNER = "实验 · Side-Neumann σ-weighted swallow · 不是官方 Bunny";
const BUNNY_SIDE_NEUMANN_WEIGHTED_STATUS = [
  BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL,
  `${sideNeumannWeightedSummary.n_columns} columns`,
  `${sideNeumannWeightedSummary.n_full_height} full-height`,
  `${sideNeumannWeightedSummary.n_short} short`,
  sideNeumannWeightedSummary.column0_is_left_seam ? "column 0 left seam" : "",
  sideNeumannWeightedSummary.last_is_right_seam ? "last column right seam" : "",
  "不是官方 Bunny",
]
  .filter(Boolean)
  .join(" · ");
const bunnyCorridorBtn = document.querySelector("#load-bunny-corridor-field-swallow");
const bunnySideNeumannBtn = document.querySelector("#load-bunny-exp-side-neumann-swallow");
const bunnySideNeumannUniformBtn = document.querySelector("#load-bunny-exp-side-neumann-uniform-swallow");
const bunnySideNeumannWeightedBtn = document.querySelector("#load-bunny-exp-side-neumann-weighted-swallow");
if (bunnyCorridorBtn) {
  bunnyCorridorBtn.textContent = BUNNY_CORRIDOR_LABEL;
  bunnyCorridorBtn.title = BUNNY_CORRIDOR_MENU_TITLE;
}
if (bunnySideNeumannBtn) {
  bunnySideNeumannBtn.textContent = BUNNY_SIDE_NEUMANN_LABEL;
  bunnySideNeumannBtn.title = BUNNY_SIDE_NEUMANN_MENU_TITLE;
}
if (bunnySideNeumannUniformBtn) {
  bunnySideNeumannUniformBtn.textContent = BUNNY_SIDE_NEUMANN_UNIFORM_LABEL;
  bunnySideNeumannUniformBtn.title = BUNNY_SIDE_NEUMANN_UNIFORM_MENU_TITLE;
}
if (bunnySideNeumannWeightedBtn) {
  bunnySideNeumannWeightedBtn.textContent = BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL;
  bunnySideNeumannWeightedBtn.title = BUNNY_SIDE_NEUMANN_WEIGHTED_MENU_TITLE;
}
const standradBtn = document.querySelector("#load-standrad-cylinder");
const denseStandradBtn = document.querySelector("#load-dense-standrad-cylinder");
const decreaseBtn = document.querySelector("#load-decrease-cylinder");
const denseDecreaseBtn = document.querySelector("#load-dense-decrease-cylinder");
const increaseBtn = document.querySelector("#load-increase-cylinder");
const denseIncreaseBtn = document.querySelector("#load-dense-increase-cylinder");
const thinBtn = document.querySelector("#load-thin-cylinder");
const denseThinBtn = document.querySelector("#load-dense-thin-cylinder");
const fatBtn = document.querySelector("#load-fat-cylinder");
const denseFatBtn = document.querySelector("#load-dense-fat-cylinder");
const denseBunny4SplitBtn = document.querySelector("#load-dense-bunny-4split");
const denseBunnyLeBtn = document.querySelector("#load-dense-bunny-le");
const fitBtn = document.querySelector("#fit-view");
const slider = document.querySelector("#mesh-slider");
const meshRow = document.querySelector("#mesh-row");
const colsRow = document.querySelector("#cols-row");
const facesRow = document.querySelector("#faces-row");
const modelsRow = document.querySelector("#models-row");
const termsRow = document.querySelector("#terms-row");
const colsLabel = document.querySelector("#cols-label");
const colsSub = document.querySelector("#cols-sub");
const colColor = document.querySelector("#col-color");
const colColorType = document.querySelector("#col-color-type");
const colColorField = document.querySelector("#col-color-field");
const colLegend = document.querySelector("#col-legend");
const facesLabel = document.querySelector("#faces-label");
const modelsLabel = document.querySelector("#models-label");
const termsLabel = document.querySelector("#terms-label");
const termsSub = document.querySelector("#terms-sub");
const labelEl = document.querySelector("#mesh-label");
const countEl = document.querySelector("#mesh-count");
const projectEl = document.querySelector("#project-name");
const statsEl = document.querySelector("#mesh-stats");
const stitchPickEl = document.querySelector("#stitch-pick");
const stitchPickTitle = document.querySelector("#stitch-pick-title");
const stitchPickText = document.querySelector("#stitch-pick-text");
const statusEl = document.querySelector("#status");
const overlayBtn = document.querySelector("#toggle-overlay");
const knitBedBtn = document.querySelector("#toggle-knit-bed");
const warpBtn = document.querySelector("#toggle-warp");
const baseMenu = document.querySelector("#base-menu");
const baseMenuBtn = document.querySelector("#base-menu-btn");
const baseMenuList = document.querySelector("#base-menu-list");
const baseChecks = {
  off: document.querySelector("#base-off"),
  wire: document.querySelector("#base-wire"),
  faces: document.querySelector("#base-faces"),
  points: document.querySelector("#base-points"),
};
let baseLayers = defaultBaseLayers();
const hideChromeBtn = document.querySelector("#hide-chrome");
const showChromeBtn = document.querySelector("#show-chrome");
const mapPane = document.querySelector("#map-pane");
const mapCanvas = document.querySelector("#map-canvas");
const mapMeta = document.querySelector("#map-meta");
const mapEmpty = document.querySelector("#map-empty");
const paneSwitch = document.querySelector("#pane-switch");
const pane3dBtn = document.querySelector("#pane-3d");
const paneMapBtn = document.querySelector("#pane-map");
const mapZoomIn = document.querySelector("#map-zoom-in");
const mapZoomOut = document.querySelector("#map-zoom-out");
const mapFitBtn = document.querySelector("#map-fit");
const mapPhysBtn = document.querySelector("#map-phys");
const mapHeading = document.querySelector("#map-heading");
const mapModeReadable = document.querySelector("#map-mode-readable");
const mapModeKnit = document.querySelector("#map-mode-knit");
const knitCodeEl = document.querySelector("#knit-code");
const knitTitle = document.querySelector("#knit-title");
const knitNote = document.querySelector("#knit-note");
const knitLegend = document.querySelector("#knit-legend");
const knitDetail = document.querySelector("#knit-detail");
const knitRailNote = document.querySelector("#knit-rail-note");
const knitScroll = document.querySelector("#knit-scroll");

const viewer = new MeshViewer(canvas);
const mapView = mapCanvas ? new ReadableMapView(mapCanvas) : null;
const narrowSplitMq = window.matchMedia("(max-width: 719px)");
let mobilePane = "3d";
const colsRange = bindDualRange(document.querySelector("#cols-range"));
const facesRange = bindDualRange(document.querySelector("#faces-range"));
const modelsRange = bindDualRange(document.querySelector("#models-range"));
const termsRange = bindDualRange(document.querySelector("#terms-range"));

let project = null;
let outputIndex = 0;
let scene = null;
let columnColorMode = "type";
let pickedStitch = null;
let showPhysNeedle = false;
let physPickKeys = null;
let mapMode = "readable";
let knitScale = 1;
let knitPinGeneration = 0;
let knitPan = null;
let knitSwallowClick = false;
let knitRenderKey = null;
let knitDir = null;
let knitTravelAnchor = null;
const geomCache = new Map();
const textCache = new Map();

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", isError);
}

function stitchMapBind() {
  return scene?.stitches?.stitchBind || null;
}

function mapKeysForStitch(stitch) {
  return highlightKeysForStitch(stitch, {
    map: scene?.readableMap,
    grid: mapView?.grid,
    bind: stitchMapBind(),
  });
}

function readableCell(row, col) {
  return scene?.readableMap?.rows?.[row]?.cells?.find((cell) => cell.col === col) || null;
}

function showPhysChip(parts, keys) {
  if (!stitchPickEl) return;
  stitchPickEl.hidden = false;
  if (stitchPickTitle) stitchPickTitle.textContent = parts.title;
  if (stitchPickText) stitchPickText.textContent = parts.detail;
  stitchPickEl.dataset.mapCells = [...keys].join(" ");
}

function paintPhysicalCell(row, col, stitch) {
  const parts = formatPhysicalNeedle(readableCell(row, col));
  physPickKeys = new Set([`${row},${col}`]);
  pickedStitch = stitch || null;
  viewer.setSelectedStitch(stitch || null);
  showPhysChip(parts, physPickKeys);
  paintMapHighlight();
  highlightKnitCodeForPick();
}

function paintPhysicalStitch(stitch) {
  if (!stitch) {
    paintStitchPick(null);
    return;
  }
  const keys = mapKeysForStitch(stitch);
  const records = [...keys].map((key) => {
    const comma = key.indexOf(",");
    const row = Number(key.slice(0, comma));
    const col = Number(key.slice(comma + 1));
    return readableCell(row, col) || { row, col };
  });
  physPickKeys = keys;
  pickedStitch = stitch;
  viewer.setSelectedStitch(stitch);
  showPhysChip(formatPhysicalNeedles(records), keys);
  paintMapHighlight();
  highlightKnitCodeForPick();
}

function onMapCellPick(hit) {
  if (!hit) return;
  const stitches = scene?.stitches?.bound?.stitches || [];
  const stitch = stitchForMapCell(hit.row, hit.col, stitchMapBind(), stitches, scene?.readableMap);
  if (showPhysNeedle) {
    paintPhysicalCell(hit.row, hit.col, stitch);
    return;
  }
  if (stitch) {
    paintStitchPick(stitch);
    return;
  }
  if (hit.cell?.isTransfer || isTransferDir(hit.dir) || hit.cell?.isFlip || isFlipDir(hit.dir)) return;
  paintStitchPick(null);
}

if (mapView) mapView.onCellPick = onMapCellPick;

function paintStitchPick(stitch) {
  physPickKeys = null;
  pickedStitch = stitch || null;
  const parts = formatStitchPickParts(stitch);
  viewer.setSelectedStitch(parts ? stitch : null);
  if (stitchPickEl) {
    if (!parts) {
      stitchPickEl.hidden = true;
      if (stitchPickTitle) stitchPickTitle.textContent = "针迹 Stitch";
      if (stitchPickText) stitchPickText.textContent = "";
      delete stitchPickEl.dataset.mapCells;
    } else {
      stitchPickEl.hidden = false;
      if (stitchPickTitle) stitchPickTitle.textContent = parts.title;
      if (stitchPickText) stitchPickText.textContent = parts.detail;
    }
  }
  paintMapHighlight();
  if (stitchPickEl && pickedStitch) {
    stitchPickEl.dataset.mapCells = [...mapKeysForStitch(pickedStitch)].join(" ");
  }
  highlightKnitCodeForPick();
}

function pressed(btn, on) {
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function currentOutput() {
  return project?.outputs[outputIndex] || null;
}

function modelNameFromFile(entry, fallback) {
  if (!entry) return fallback;
  return basename(entry.name || entry.path).replace(/\.obj$/i, "") || fallback;
}

function updateChrome() {
  const n = project?.outputs.length || 0;
  const current = currentOutput();
  slider.max = String(Math.max(0, n - 1));
  slider.value = String(outputIndex);
  slider.disabled = n < 2;
  meshRow.classList.toggle("hidden", n < 2);
  labelEl.textContent = current?.label || "—";
  countEl.textContent = n ? `${outputIndex + 1} / ${n}` : "0 / 0";
  projectEl.textContent = project
    ? project.banner
      ? `${project.name} · ${project.banner}`
      : `${project.name} · ${project.source === "manifest" ? "清单 manifest" : "自动发现 auto"}`
    : "未打开项目 / No project";
  overlayBtn.disabled = !current?.overlayFile && !current?.stitchFile && !scene?.stitches;
  if (warpBtn) warpBtn.disabled = !scene?.columns?.length;

  const hasCols = Boolean(scene?.columns?.length);
  const hasStitches = Boolean(scene?.stitches?.rowChunks?.length);
  const knitFocus = hasStitches;
  const hasModels = Boolean(scene?.models?.length) && !knitFocus;
  colsRow.classList.toggle("hidden", !hasCols);
  facesRow.classList.toggle("hidden", !hasStitches);
  termsRow?.classList.toggle("hidden", !hasStitches);
  modelsRow.classList.toggle("hidden", !hasModels);

  if (hasCols) {
    const [a, b] = colsRange.value;
    colsLabel.textContent = scene.extract
      ? formatExtractRangeLabel(scene.columns, a, b)
      : formatHalfOpenRangeLabel("cols_resample", a, b, scene.columns.length);
  } else {
    colsLabel.textContent = "cols_resample: -";
  }
  if (colsSub) colsSub.hidden = !scene?.extract;
  document.querySelector("#cols-range")?.setAttribute("aria-label", scene?.extract ? "index_column" : "cols_resample");
  paintColumnColorControls();

  if (hasStitches) {
    const [a, b] = facesRange.value;
    facesLabel.textContent = formatHalfOpenRangeLabel("row", a, b, scene.stitches.rowChunks.length);
    facesRange.setEnabled(true);
    paintTermChrome();
  } else {
    facesLabel.textContent = "row: -";
    facesRange.setEnabled(false);
    if (termsLabel) termsLabel.textContent = "term: -";
    termsRange?.setEnabled(false);
  }

  if (hasModels) {
    const [a, b] = modelsRange.value;
    modelsLabel.textContent = formatDisplayModelsLabel(a, b, scene.models);
  } else {
    modelsLabel.textContent = "display_models: -";
  }
}

async function sampleEntry(rel, res) {
  const name = rel.split("/").pop();
  const path = `sample/${rel}`;
  if (/\.(xlsx?|npy)$/i.test(rel)) return { name, path, buffer: await res.arrayBuffer() };
  return { name, path, text: await res.text() };
}

async function loadGeometry(entry) {
  if (!entry) return null;
  const key = entry.path || entry.name;
  if (geomCache.has(key)) return geomCache.get(key);
  const text = await readEntryText(entry);
  const geom = viewer.parseObj(text, entry.name);
  geomCache.set(key, geom);
  return geom;
}

async function loadText(entry) {
  if (!entry) return "";
  const key = `txt:${entry.path || entry.name}`;
  if (textCache.has(key)) return textCache.get(key);
  const text = await readEntryText(entry);
  textCache.set(key, text);
  return text;
}

async function loadBuffer(entry) {
  if (!entry) return null;
  const key = `bin:${entry.path || entry.name}`;
  if (textCache.has(key)) return textCache.get(key);
  const buffer = await readEntryBuffer(entry);
  textCache.set(key, buffer);
  return buffer;
}

function isMapXlsEntry(entry) {
  if (!entry) return false;
  const name = entry.name || entry.path || "";
  return (
    isExcelReadableMapName(name) ||
    isFacesRing0BedChart(name) ||
    isBunnyExpReadableMap(name) ||
    isDecreaseCylinderBedChart(name) ||
    isIncreaseCylinderBedChart(name) ||
    isThinCylinderBedChart(name) ||
    isFatCylinderBedChart(name) ||
    isStandradCylinderBedChart(name) ||
    isDenseStandradCylinderBedChart(name) ||
    isDenseIncreaseCylinderBedChart(name) ||
    isDenseDecreaseCylinderBedChart(name) ||
    isDenseThinCylinderBedChart(name) ||
    isDenseFatCylinderBedChart(name) ||
    (isXlsName(name) && /readable_map|step3/i.test(name))
  );
}

function sheetQuery() {
  try {
    return new URLSearchParams(location.search).get("sheet") || "";
  } catch {
    return "";
  }
}

function setSheetQuery(sheet) {
  const url = new URL(location.href);
  const next = sheet ? canonicalSheetId(sheet) : "";
  if (next) url.searchParams.set("sheet", next);
  else url.searchParams.delete("sheet");
  history.replaceState(null, "", url);
  syncExportButton();
  syncKnitDatButton();
}

function syncExportButton() {
  if (!exportBtn) return;
  const spec = datForSheet(sheetQuery());
  exportBtn.disabled = !spec;
  const title = spec ? spec.filename : NO_DAT_TITLE;
  exportBtn.title = title;
  if (exportSlot) exportSlot.title = title;
}

function downloadSheetDat() {
  const spec = datForSheet(sheetQuery());
  if (!spec || exportBtn?.disabled) return;
  const a = document.createElement("a");
  a.href = `${import.meta.env.BASE_URL}${spec.path}`;
  a.download = spec.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function syncKnitDatButton() {
  if (!knitDatBtn) return;
  const showingKnit = mapMode === "knit" && Boolean(scene?.knitCode?.rows?.length);
  const spec = showingKnit ? datForKnitSheet(sheetQuery()) : null;
  knitDatBtn.hidden = !spec;
  knitDatBtn.disabled = !spec;
  knitDatBtn.title = spec ? spec.filename : "此编织码暂无 .dat";
}

function downloadKnitDat() {
  const spec = datForKnitSheet(sheetQuery());
  if (!spec || knitDatBtn?.hidden || knitDatBtn?.disabled) return;
  const a = document.createElement("a");
  a.href = `${import.meta.env.BASE_URL}${spec.path}`;
  a.download = spec.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function outputIndexForSheet(next, sheet) {
  const outputs = next?.outputs || [];
  if (!outputs.length) return 0;
  const want = String(sheet || "").toLowerCase();
  if (want === "faces-ring0" || want === "faces_ring0" || want === "faces-ring1" || want === "faces_ring1") {
    const hit = outputs.findIndex((out) => isFacesRing0BedChart(out.readableMapFile?.name || out.readableMapFile?.path || ""));
    if (hit >= 0) return hit;
  }
  return outputs.length - 1;
}

async function loadExcelOrTxtMap(entry) {
  if (!entry) return null;
  if (isMapXlsEntry(entry)) {
    const buf = await loadBuffer(entry);
    if (!buf) return null;
    const map = parseExcelReadableMap(buf);
    return map?.rows?.length ? map : null;
  }
  const mapText = await loadText(entry);
  const map = parseReadableMap(mapText);
  return map?.cells?.length ? map : null;
}

async function loadReadableMap(output) {
  const excel = await loadExcelOrTxtMap(output.readableMapFile);
  if (excel) return excel;
  return loadExcelOrTxtMap(output.readableMapTxtFile);
}

async function loadKnitCode(output) {
  if (!output?.knitCodeFile) return null;
  try {
    const text = await loadText(output.knitCodeFile);
    if (!text) return null;
    return parseKnitCode(JSON.parse(text));
  } catch {
    return null;
  }
}

async function loadStitches(output) {
  const stitchEntry = output.stitchFile || output.overlayFile;
  const mapEntry = output.readableMapFile;
  if (!stitchEntry) return null;
  const stitchText = await loadText(stitchEntry);
  if (!stitchText) return null;
  const parsed = parseColoredObj(stitchText);
  if (!parsed.faces.length) return null;
  let bound = null;
  let parsedMap = null;
  const displayMap = await loadReadableMap(output);
  const txtEntry =
    output.readableMapTxtFile || (mapEntry && !isMapXlsEntry(mapEntry) ? mapEntry : null);
  let bindMap = null;
  if (txtEntry) {
    const mapText = await loadText(txtEntry);
    bindMap = parseReadableMap(mapText);
  }
  parsedMap = displayMap || bindMap;
  if (bindMap?.cells?.length) bound = bindStitchesToMap(parsed.faces, bindMap);
  if (!bound) {
    bound = {
      stitches: parsed.faces.map((face, index) => ({
        index,
        verts: face.verts,
        row: index,
        col: 0,
        token: null,
        dir: null,
        path_index: null,
        term_index: null,
        mapCells: [],
      })),
      columns: [0],
      rowMin: 0,
      rowMax: parsed.faces.length ? parsed.faces.length - 1 : 0,
      unboundFaces: 0,
      leftoverCells: 0,
    };
  }
  let stitchBind = null;
  if (output.stitchMapBindFile) {
    const bindText = await loadText(output.stitchMapBindFile);
    if (bindText) stitchBind = parseStitchMapBind(bindText);
  }
  if (stitchBind) applyStitchMapBind(bound.stitches, stitchBind);
  let firstRows = null;
  if (output.firstRowsFile) {
    const buf = await loadBuffer(output.firstRowsFile);
    if (buf) firstRows = parseFirstRows({ xls: buf });
  }
  let layout = null;
  if (output.facesRingLayoutFile) {
    const text = await loadText(output.facesRingLayoutFile);
    if (text) layout = parseFacesRingLayout(text);
  }
  const nRings = layout?.nFacesRing || firstRows?.nRings || 0;
  const faceChunks = faceChunksFromFaces(parsed.faces);
  const rowChunks = facesRingChunksFromStitches(bound.stitches, {
    nRings,
    termCounts: layout?.termCounts,
    ringTypes: layout?.ringTypes,
    colors: layout?.colors,
  });
  bound.edgeColor = layout?.edgeColor || { r: 0, g: 0, b: 0 };
  return { bound, faceChunks, rowChunks, firstRows, layout, stitchBind, stitchEntry, mapEntry, map: parsedMap };
}

function paintColumnColorControls() {
  const extract = scene?.extract || null;
  const mode = scene?.columnColorMode || columnColorMode;
  if (colColor) colColor.hidden = !extract || (!extract.colors.type && !extract.colors.field);
  if (colColorType) {
    colColorType.hidden = !extract?.colors.type;
    colColorType.setAttribute("aria-pressed", mode === "type" ? "true" : "false");
  }
  if (colColorField) {
    colColorField.hidden = !extract?.colors.field;
    colColorField.setAttribute("aria-pressed", mode === "field" ? "true" : "false");
  }
  paintColumnLegend();
}

function paintColumnLegend() {
  if (!colLegend) return;
  const extract = scene?.extract || null;
  colLegend.replaceChildren();
  if (!extract) {
    colLegend.hidden = true;
    return;
  }
  const mode = scene.columnColorMode;
  if (mode === "field" && extract.colors.field) {
    const src = extract.order?.field_source || "field";
    const scale = extract.order?.scale_ran;
    const text = document.createElement("span");
    text.textContent = scale == null ? `field · ${src}` : `field · ${src} · scale_ran=${scale}`;
    colLegend.append(text);
    colLegend.hidden = false;
    return;
  }
  if (mode === "type" && extract.colors.type) {
    for (const item of extractTypeLegend(extract.columns)) {
      const row = document.createElement("span");
      row.className = "col-legend-item";
      if (item.color && !item.mixed) {
        const swatch = document.createElement("i");
        swatch.className = "col-swatch";
        const r = Math.round(item.color.r * 255);
        const g = Math.round(item.color.g * 255);
        const b = Math.round(item.color.b * 255);
        swatch.style.background = `rgb(${r}, ${g}, ${b})`;
        row.append(swatch);
      }
      row.append(`${item.type} ${item.n}${item.mixed ? " mixed" : ""}`);
      colLegend.append(row);
    }
    colLegend.hidden = false;
    return;
  }
  const text = document.createElement("span");
  text.textContent = "无类型色、无场色 / no type or field colors";
  colLegend.append(text);
  colLegend.hidden = false;
}

function chooseColumnColorMode(extract) {
  if (columnColorMode === "type" && extract.colors.type) return "type";
  if (columnColorMode === "field" && extract.colors.field) return "field";
  if (extract.colors.type) return "type";
  if (extract.colors.field) return "field";
  return "none";
}

async function loadExtractColumns(output) {
  const [polylineText, typeText, fieldText, orderText] = await Promise.all([
    loadText(output.columnsPolylineFile),
    output.columnsTypeFile ? loadText(output.columnsTypeFile) : Promise.resolve(""),
    output.columnsFieldFile ? loadText(output.columnsFieldFile) : Promise.resolve(""),
    output.columnsOrderFile ? loadText(output.columnsOrderFile) : Promise.resolve(""),
  ]);
  const order = orderText ? JSON.parse(orderText) : null;
  return parseExtractColumns({ polylineText, typeText, fieldText, order });
}

async function loadCols(output) {
  if (!output.colsResampleXlsFile && !output.colsResampleFile) {
    return null;
  }
  const [fieldText, xls] = await Promise.all([
    output.colsResampleFile ? loadText(output.colsResampleFile) : Promise.resolve(""),
    output.colsResampleXlsFile ? loadBuffer(output.colsResampleXlsFile) : Promise.resolve(null),
  ]);
  const columns = parseColsResample({ xls, fieldText });
  return columns.length
    ? { columns, entry: output.colsResampleXlsFile || output.colsResampleFile }
    : null;
}

function activeRingFromSlider() {
  const [a, b] = facesRange.value;
  return activeRingIndex(a, b);
}

function activeRingChunk() {
  const active = activeRingFromSlider();
  if (active == null || !scene?.stitches?.rowChunks) return null;
  return scene.stitches.rowChunks[active] || null;
}

function paintTermChrome() {
  if (!termsLabel) return;
  const chunk = activeRingChunk();
  const n = chunk?.faces.length ?? 0;
  const active = activeRingFromSlider();
  if (termsSub) termsSub.textContent = active == null ? "term" : `ring ${active}`;
  if (!n || active == null) {
    termsLabel.textContent = "term: -";
    termsRange.setEnabled(false);
    return;
  }
  const [t0, t1] = termsRange.value;
  termsLabel.textContent = formatHalfOpenRangeLabel("term", t0, t1, n);
  termsRange.setEnabled(true);
}

function applyColsRange() {
  if (!scene?.columns?.length) return;
  const [start, end] = colsRange.value;
  viewer.setColsResampleRange(start, end);
  colsLabel.textContent = scene.extract
    ? formatExtractRangeLabel(scene.columns, start, end)
    : formatHalfOpenRangeLabel("cols_resample", start, end, scene.columns.length);
}

function setColumnColorMode(mode) {
  if (!scene?.extract) return;
  if (mode === "type" && !scene.extract.colors.type) return;
  if (mode === "field" && !scene.extract.colors.field) return;
  columnColorMode = mode;
  scene.columnColorMode = mode;
  applyExtractColumnColors(scene.columns, mode);
  applyColsRange();
  if (statsEl) statsEl.textContent = `${scene.columns.length} columns · ${mode}`;
  updateChrome();
}

function syncTermSlider({ reset = false } = {}) {
  const chunk = activeRingChunk();
  const n = chunk?.faces.length ?? 0;
  const active = activeRingFromSlider();
  if (!n || active == null) {
    termsRange.configure(0, [0, 0]);
    termsRange.setEnabled(false);
    scene.prevActiveRing = null;
    return;
  }
  if (reset || scene.prevActiveRing !== active) {
    termsRange.configure(n, [0, n]);
    scene.prevActiveRing = active;
  } else if (termsRange.n !== n) {
    termsRange.configure(n, [0, n]);
  }
  termsRange.setEnabled(true);
}

function applyFacesRange({ resetTerms } = {}) {
  if (!scene?.stitches?.rowChunks?.length) return;
  const [start, end] = facesRange.value;
  const active = activeRingIndex(start, end);
  const shouldReset = resetTerms ?? scene.prevActiveRing !== active;
  syncTermSlider({ reset: shouldReset });
  applyTermsRange();
  facesLabel.textContent = formatHalfOpenRangeLabel("row", start, end, scene.stitches.rowChunks.length);
}

function applyTermsRange() {
  if (!scene?.stitches?.rowChunks?.length) return;
  const [r0, r1] = facesRange.value;
  if (r1 <= r0) {
    viewer.setKnitRange(r0, r1, 0, 0);
    paintTermChrome();
    paintMapHighlight();
    return;
  }
  const [t0, t1] = termsRange.value;
  viewer.setKnitRange(r0, r1, t0, t1);
  paintTermChrome();
  paintMapHighlight();
}

function applyModelsRange() {
  if (!scene?.models?.length || scene?.stitches?.rowChunks?.length) return;
  const [start, end] = modelsRange.value;
  const result = applyDisplayModelsRange(scene.models, start, end, scene.prevFacesItem);
  for (let i = 0; i < scene.models.length; i++) {
    const model = scene.models[i];
    viewer.setModelVisible(model.name, result.visibility[i]);
  }
  modelsLabel.textContent = formatDisplayModelsLabel(result.start, result.end, scene.models);
}

function applyAllFilters() {
  applyColsRange();
  if (scene?.stitches?.rowChunks?.length) applyFacesRange({ resetTerms: true });
  else applyModelsRange();
  updateChrome();
}

colsRange.setOnChange(() => {
  applyColsRange();
  updateChrome();
});
facesRange.setOnChange(() => {
  applyFacesRange();
  updateChrome();
});
termsRange.setOnChange(() => {
  applyTermsRange();
  updateChrome();
});
modelsRange.setOnChange(() => {
  applyModelsRange();
  updateChrome();
});

async function showOutput(index, { fit = false } = {}) {
  if (!project) return;
  outputIndex = Math.min(Math.max(0, index), project.outputs.length - 1);
  const output = project.outputs[outputIndex];
  scene = null;
  mapMode = "readable";
  knitRenderKey = null;
  paintStitchPick(null);
  setStatus("加载中 / Loading…");
  try {
    const meshGeom = output.meshFile ? await loadGeometry(output.meshFile) : null;
    const extract = output.columnExtract ? await loadExtractColumns(output) : null;
    if (extract && !extract.columns.length) {
      throw new Error(extract.problems[0] || "没有列折线 / No column polylines");
    }
    if (extract) {
      columnColorMode = chooseColumnColorMode(extract);
      if (columnColorMode === "type" || columnColorMode === "field") {
        applyExtractColumnColors(extract.columns, columnColorMode);
      }
    }
    const stitches = output.columnExtract ? null : await loadStitches(output);
    const cols = extract
      ? { columns: extract.columns, entry: output.columnsPolylineFile, kind: "extract" }
      : await loadCols(output);
    viewer.setBaseLayers(baseLayers);
    viewer.setShowOverlay(overlayBtn.getAttribute("aria-pressed") === "true");
    viewer.setShowKnitBed(knitBedBtn?.getAttribute("aria-pressed") === "true");
    viewer.setShowWarp(warpBtn.getAttribute("aria-pressed") === "true");

    const models = [];
    const cutName = modelNameFromFile(output.meshFile, "cut_iteration_0");
    if (!output.columnExtract) {
      registerDisplayModel(models, {
        kind: "mesh",
        name: cutName,
        item: cutName,
      });
      if (cols) {
        registerDisplayModel(models, {
          kind: "cols_resample",
          name: "cols_resample",
          item: "cols_resample",
        });
      }
    }
    if (stitches) {
      registerDisplayModel(models, {
        kind: "faces_ring",
        name: "KnittingStitches",
        item: "KnittingStitches",
        faceChunks: stitches.faceChunks,
        rowChunks: stitches.rowChunks,
      });
    }

    const readableMap = stitches?.map || (await loadReadableMap(output));
    const knitCode = output.columnExtract ? null : await loadKnitCode(output);
    const knitBind = knitCode
      ? bindKnitCodeStitches(knitCode, readableMap, stitches?.bound?.stitches, stitches?.stitchBind)
      : null;
    viewer.setKnitBeds(knitBedsByFace(readableMap));
    scene = {
      models,
      columns: cols?.columns || null,
      extract: extract
        ? { ...extract, columns: cols.columns }
        : null,
      columnColorMode: extract ? columnColorMode : null,
      stitches,
      facesBound: stitches,
      prevFacesItem: stitches ? "KnittingStitches" : null,
      prevActiveRing: null,
      cutName,
      readableMap,
      knitCode,
      knitBind,
    };
    paintReadableMap();

    if (stitches || cols) {
      viewer.setDisplayScene({
        bodyGeom: meshGeom,
        bodyName: cutName,
        colsColumns: cols?.columns || null,
        bound: stitches?.bound || null,
      });
    } else {
      const overlayGeom = output.overlayFile ? await loadGeometry(output.overlayFile) : null;
      viewer.setGeometries(meshGeom, overlayGeom);
    }

    paintBaseChecks();

    if (cols) colsRange.configure(cols.columns.length, [0, cols.columns.length]);
    else colsRange.configure(0, [0, 0]);
    if (stitches?.rowChunks?.length) {
      facesRange.configure(stitches.rowChunks.length, [0, stitches.rowChunks.length]);
      modelsRange.configure(0, [0, 0]);
    } else {
      facesRange.configure(0, [0, 0]);
      termsRange.configure(0, [0, 0]);
      modelsRange.configure(models.length, models.length ? [0, models.length] : [0, 0]);
    }

    applyAllFilters();

    const bits = [];
    if (extract) {
      bits.push(`${extract.columns.length} columns`);
      if (columnColorMode === "type" || columnColorMode === "field") bits.push(columnColorMode);
    } else {
      if (meshGeom) {
        const pos = meshGeom.getAttribute("position");
        bits.push(`${pos?.count ?? 0} vtx`);
      }
      if (cols) bits.push(`${cols.columns.length} cols_resample`);
      if (stitches) bits.push(`${stitches.rowChunks.length} faces_ring`);
      if (stitches?.layout?.termTotal) bits.push(`${stitches.layout.termTotal} terms`);
      else bits.push(`${models.length} models`);
    }
    statsEl.textContent = bits.join(" · ");
    if (extract) {
      const summary = formatExtractStatus(output.label, extract);
      const text = extract.problems.length ? `${summary} · ${extract.problems.join(" · ")}` : summary;
      setStatus(text, extract.problems.length > 0);
    } else {
      setStatus("三滑块半开区间 [start,end) · dual-range like SingaLab");
    }
    syncViewportAfterLayout(fit ? () => viewer.fitToView() : undefined);
  } catch (err) {
    statsEl.textContent = "";
    scene = null;
    paintBaseChecks();
    paintReadableMap();
    updateChrome();
    setStatus(err.message || String(err), true);
  }
}

async function openEntries(entries, { sheet } = {}) {
  if (!entries?.length) return;
  geomCache.clear();
  textCache.clear();
  scene = null;
  const index = indexFiles(entries);
  let next;
  const preferred =
    index.byName.get("manifest.json") ||
    index.jsons.find((j) => j.name.toLowerCase().endsWith("manifest.json")) ||
    index.jsons[0];

  if (preferred) {
    try {
      const data = JSON.parse(await readEntryText(preferred));
      if (isManifestShape(data)) {
        next = projectFromManifest(data, index, preferred.path);
      }
    } catch (err) {
      if (index.jsons.includes(preferred) && !index.objs.length) {
        setStatus(err.message || String(err), true);
        return;
      }
    }
  }

  if (!next) next = projectFromDiscovery(index);
  project = next;
  outputIndex = sheet ? outputIndexForSheet(project, sheet) : project.outputs.length - 1;
  const warn = project.warnings[0];
  if (warn) setStatus(warn, true);
  await showOutput(outputIndex, { fit: true });
}

function isStandradSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "standrad-cylinder" || want === "standrad";
}

function isDenseStandradSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-standrad-cylinder" || want === "dense-standrad";
}

function isDenseDecreaseSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-decrease-cylinder" || want === "dense-decrease";
}

function isDenseIncreaseSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-increase-cylinder" || want === "dense-increase";
}

function isDenseThinSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-thin-cylinder" || want === "dense-thin";
}

function isDenseFatSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-fat-cylinder" || want === "dense-fat";
}

function isDenseBunny4SplitSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-bunny-4split";
}

function isDenseBunnyLeSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "dense-bunny-le";
}

function isDecreaseSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "decrease-cylinder" || want === "decrease";
}

function isIncreaseSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "increase-cylinder" || want === "increase";
}

function isThinSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "thin-cylinder" || want === "thin";
}

function isFatSheet(sheet) {
  const want = String(sheet || "").toLowerCase();
  return want === "fat-cylinder" || want === "fat";
}

function applyNewSchedule(data) {
  const output = data.outputs?.[0];
  if (!output) return;
  output.readableMap = "exp-readable-map.xls";
  output.readableMapTxt = "exp-readable-map.txt";
  delete output.knit_code;
  delete output.knittingCode;
  delete output.knitting_code;
  output.knitCode = "exp-knitcode.json";
  delete output.stitchMapBind;
  delete output.stitch_map_bind;
}

function applyLegacySchedule(data, spec) {
  const output = data.outputs?.[0];
  if (!output) return;
  output.label = `${spec.officialName}（旧官方时序）`;
  output.readableMap = scheduleBaseName(spec.sampleBedXls);
  if (spec.sampleReadableMapTxt) output.readableMapTxt = scheduleBaseName(spec.sampleReadableMapTxt);
  delete output.knit_code;
  delete output.knittingCode;
  delete output.knitting_code;
  output.knitCode = scheduleBaseName(spec.sampleKnitcode);
  data.name = spec.officialName;
}

async function appendNewSchedule(entries, spec) {
  const assets = NEW_SCHEDULE_ASSETS[spec.officialId];
  if (!assets) throw new Error(`缺少新时序 / Missing new schedule ${spec.officialName}`);
  const [xlsRes, txtRes, knitRes] = await Promise.all([
    fetch(assets.xlsUrl),
    fetch(assets.txtUrl),
    fetch(assets.knitUrl),
  ]);
  if (!xlsRes.ok || !txtRes.ok || !knitRes.ok) {
    throw new Error(`新时序床图不可用 / New-schedule bed missing ${spec.officialName}`);
  }
  const dir = spec.experimentDir;
  entries.push({
    name: "exp-readable-map.xls",
    path: `${dir}/exp-readable-map.xls`,
    buffer: await xlsRes.arrayBuffer(),
  });
  entries.push({
    name: "exp-readable-map.txt",
    path: `${dir}/exp-readable-map.txt`,
    text: await txtRes.text(),
  });
  entries.push({
    name: "exp-knitcode.json",
    path: `${dir}/exp-knitcode.json`,
    text: await knitRes.text(),
  });
}

async function appendLegacyFiles(entries, spec) {
  const names = [scheduleBaseName(spec.sampleBedXls)];
  if (spec.sampleReadableMapTxt) names.push(scheduleBaseName(spec.sampleReadableMapTxt));
  names.push(scheduleBaseName(spec.sampleKnitcode));
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      const res = await fetch(`${base}${spec.archiveDir}/${name}`, { cache: "reload" });
      if (!res.ok) throw new Error(`缺少旧官方备份 / Missing legacy ${name}`);
      if (/\.xlsx?$/i.test(name)) {
        entries.push({ name, path: `${spec.archiveDir}/${name}`, buffer: await res.arrayBuffer() });
      } else {
        entries.push({ name, path: `${spec.archiveDir}/${name}`, text: await res.text() });
      }
    }),
  );
}

async function openPublishedSample({ manifest, missing, status, sheet, banner, loading }) {
  const key = sheetKey(sheet || sheetQuery());
  if (loading) setStatus(loading);
  else setStatus(`加载 ${missing}…`);
  const base = import.meta.env.BASE_URL;
  try {
    const manifestRes = await fetch(`${base}sample/${manifest}`, { cache: "reload" });
    if (!manifestRes.ok) throw new Error(`缺少 ${missing} / Missing ${missing}`);
    const data = await manifestRes.json();
    const legacy = promotedByLegacy(key);
    const official = legacy ? null : promotedByOfficial(key);
    if (legacy) applyLegacySchedule(data, legacy);
    else if (official) applyNewSchedule(data);
    const paths = collectManifestRefs(data).filter((rel) => !(legacy || official) || rel.includes("/"));
    // Isolated index: name this manifest.json so the chooser does not
    // also pull the faces-ring / cylinder sheets.
    const entries = [{ name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) }];
    await Promise.all(
      paths.map(async (rel) => {
        const res = await fetch(`${base}sample/${rel}`, { cache: "reload" });
        if (!res.ok) throw new Error(`缺少 ${missing} / Missing ${rel}`);
        entries.push(await sampleEntry(rel, res));
      }),
    );
    if (legacy) await appendLegacyFiles(entries, legacy);
    else if (official) await appendNewSchedule(entries, official);
    await openEntries(entries, { sheet: key });
    if (project && banner) project.banner = banner;
    updateChrome();
    if (status && !statusEl.classList.contains("error")) setStatus(status);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadLegacySchedule(spec) {
  if (sheetKey(sheetQuery()) !== spec.legacyId) setSheetQuery(spec.legacyId);
  await openPublishedSample({
    manifest: spec.manifest,
    missing: spec.officialName,
    sheet: spec.legacyId,
    banner: "旧官方时序",
    status: `旧官方时序 · ${spec.officialName}`,
    loading: `加载旧官方时序 ${spec.officialName}…`,
  });
}

async function loadStandradCylinder() {
  await openPublishedSample({
    manifest: "standrad-cylinder.json",
    missing: "Standrad Cylinder",
    sheet: "standrad-cylinder",
    status: "Standrad Cylinder · cols_resample 25 · 前床 F0–F12 · 后床 B12–B1",
  });
}

async function loadDenseStandradCylinder() {
  await openPublishedSample({
    manifest: "dense-standrad-cylinder.json",
    missing: "Dense Standrad Cylinder",
    sheet: "dense-standrad-cylinder",
    status: "Dense Standrad Cylinder · cols_resample 50 · 表宽 50 · 前床 F0–F24 · 后床 B24–B0 · 15 环落座 50",
  });
}

async function loadDecreaseCylinder() {
  await openPublishedSample({
    manifest: "decrease-cylinder.json",
    missing: "Decrease Cylinder",
    sheet: "decrease-cylinder",
    status: "Decrease Cylinder · cols_resample 23 · 表宽 24 · 前床 F0–F11 · 后床 B11–B1 · 5 环落座 23、23、19、18、14",
  });
}

async function loadIncreaseCylinder() {
  await openPublishedSample({
    manifest: "increase-cylinder.json",
    missing: "Increase Cylinder",
    sheet: "increase-cylinder",
    status: "Increase Cylinder · cols_resample 22 · 表宽 24 · 前床 F0–F6 · 后床 B6–B0 · 5 环落座 14、18、21、22、22",
  });
}

async function loadThinCylinder() {
  try {
    await openPublishedSample({
      manifest: "thin-cylinder.json",
      missing: "Thin Cylinder",
      status: "Thin Cylinder · cols_resample 34 · 表宽 26 · 前床 F0–F11 · 后床 B11–B1 · 13 环落座 23、23、23、20、13、13、13、13、20、23、24、24、23",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadFatCylinder() {
  try {
    await openPublishedSample({
      manifest: "fat-cylinder.json",
      missing: "Fat Cylinder",
      status: "Fat Cylinder · cols_resample 24 · 表宽 28 · 前床 F0–F6 · 后床 B6–B1 · 10 环落座 13、14、24、24、24、24、24、23、13、13",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseDecreaseCylinder() {
  try {
    await openPublishedSample({
      manifest: "dense-decrease-cylinder.json",
      missing: "Dense Decrease Cylinder",
      status: "Dense Decrease Cylinder · cols_resample 46 · 表宽 46 · 前床 F0–F22 · 后床 B22–B0 · 12 环落座 46、46、46、46、46、44、40、29、28、27、27、27",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseIncreaseCylinder() {
  try {
    await openPublishedSample({
      manifest: "dense-increase-cylinder.json",
      missing: "Dense Increase Cylinder",
      status: "Dense Increase Cylinder · cols_resample 46 · 表宽 48 · 前床 F0–F13 · 后床 B13–B1 · 10 环落座 27、27、29、29、33、41、46、46、46、46",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseThinCylinder() {
  try {
    await openPublishedSample({
      manifest: "dense-thin-cylinder.json",
      missing: "Dense Thin Cylinder",
      status: "Dense Thin Cylinder · cols_resample 69 · 表宽 53 · 前床 F0–F23 · 后床 B23–B1 · 24 环落座 47、47、47、47、47、46、36、28、27、26、26、25、25、25、25、26、26、28、34、38、46、47、47、47",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseFatCylinder() {
  try {
    await openPublishedSample({
      manifest: "dense-fat-cylinder.json",
      missing: "Dense Fat Cylinder",
      status: "Dense Fat Cylinder · cols_resample 47 · 表宽 54 · 前床 F0–F12 · 后床 B12–B1 · 20 环落座 25、26、26、28、36、43、47、47、47、47、47、47、47、47、46、29、26、26、25、25",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseBunny4Split() {
  try {
    await openPublishedSample({
      manifest: "dense-bunny-4split.json",
      missing: "Dense Bunny 4split",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadDenseBunnyLe() {
  try {
    await openPublishedSample({
      manifest: "dense-bunny-le.json",
      missing: "Dense Bunny LE",
    });
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

function isBunnyCorridorSheet(sheet = sheetQuery()) {
  return String(sheet || "").trim().toLowerCase() === BUNNY_CORRIDOR_SHEET;
}

function isBunnySideNeumannSheet(sheet = sheetQuery()) {
  return String(sheet || "").trim().toLowerCase() === BUNNY_SIDE_NEUMANN_SHEET;
}

function isBunnySideNeumannUniformSheet(sheet = sheetQuery()) {
  return String(sheet || "").trim().toLowerCase() === BUNNY_SIDE_NEUMANN_UNIFORM_SHEET;
}

async function loadBunnySideNeumannUniformSwallow() {
  if (!isBunnySideNeumannUniformSheet()) setSheetQuery(BUNNY_SIDE_NEUMANN_UNIFORM_SHEET);
  setStatus(`加载 ${BUNNY_SIDE_NEUMANN_UNIFORM_LABEL}…`);
  try {
    const data = {
      name: BUNNY_SIDE_NEUMANN_UNIFORM_LABEL,
      outputs: [
        {
          ...sideNeumannUniformManifest.outputs[0],
          label: BUNNY_SIDE_NEUMANN_UNIFORM_LABEL,
        },
      ],
    };
    const dir = "experiments/bunny-exp-side-neumann-uniform-swallow";
    const files = [
      ["columns_polyline.obj", sideNeumannUniformPolylineUrl],
      ["columns_type.obj", sideNeumannUniformTypeUrl],
      ["columns_order.json", sideNeumannUniformOrderUrl],
    ];
    const entries = [{ name: "manifest.json", path: `${dir}/manifest.json`, text: JSON.stringify(data) }];
    await Promise.all(
      files.map(async ([name, url]) => {
        const file = await fetch(url);
        if (!file.ok) throw new Error(`缺少 Side-Neumann 一次吞列 / Missing ${name}`);
        entries.push({ name, path: `${dir}/${name}`, text: await file.text() });
      }),
    );
    baseLayers = defaultBaseLayers();
    await openEntries(entries);
    if (project) {
      project.name = BUNNY_SIDE_NEUMANN_UNIFORM_LABEL;
      project.banner = BUNNY_SIDE_NEUMANN_UNIFORM_BANNER;
    }
    updateChrome();
    paintBaseChecks();
    if (!statusEl.classList.contains("error")) setStatus(BUNNY_SIDE_NEUMANN_UNIFORM_STATUS);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

function isBunnySideNeumannWeightedSheet(sheet = sheetQuery()) {
  return String(sheet || "").trim().toLowerCase() === BUNNY_SIDE_NEUMANN_WEIGHTED_SHEET;
}

async function loadBunnySideNeumannWeightedSwallow() {
  if (!isBunnySideNeumannWeightedSheet()) setSheetQuery(BUNNY_SIDE_NEUMANN_WEIGHTED_SHEET);
  setStatus(`加载 ${BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL}…`);
  try {
    const data = {
      name: BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL,
      outputs: [
        {
          ...sideNeumannWeightedManifest.outputs[0],
          label: BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL,
        },
      ],
    };
    const dir = "experiments/bunny-exp-side-neumann-weighted-swallow";
    const files = [
      ["columns_polyline.obj", sideNeumannWeightedPolylineUrl],
      ["columns_type.obj", sideNeumannWeightedTypeUrl],
      ["columns_order.json", sideNeumannWeightedOrderUrl],
    ];
    const entries = [{ name: "manifest.json", path: `${dir}/manifest.json`, text: JSON.stringify(data) }];
    await Promise.all(
      files.map(async ([name, url]) => {
        const file = await fetch(url);
        if (!file.ok) throw new Error(`缺少 Side-Neumann 正σ吞列 / Missing ${name}`);
        entries.push({ name, path: `${dir}/${name}`, text: await file.text() });
      }),
    );
    baseLayers = defaultBaseLayers();
    await openEntries(entries);
    if (project) {
      project.name = BUNNY_SIDE_NEUMANN_WEIGHTED_LABEL;
      project.banner = BUNNY_SIDE_NEUMANN_WEIGHTED_BANNER;
    }
    updateChrome();
    paintBaseChecks();
    if (!statusEl.classList.contains("error")) setStatus(BUNNY_SIDE_NEUMANN_WEIGHTED_STATUS);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadBunnySideNeumannSwallow() {
  if (!isBunnySideNeumannSheet()) setSheetQuery(BUNNY_SIDE_NEUMANN_SHEET);
  setStatus(`加载 ${BUNNY_SIDE_NEUMANN_LABEL}…`);
  try {
    const data = {
      name: BUNNY_SIDE_NEUMANN_LABEL,
      outputs: [
        {
          ...sideNeumannManifest.outputs[0],
          label: BUNNY_SIDE_NEUMANN_LABEL,
        },
      ],
    };
    const dir = "experiments/bunny-exp-side-neumann-swallow";
    const files = [
      ["columns_polyline.obj", sideNeumannPolylineUrl],
      ["columns_type.obj", sideNeumannTypeUrl],
      ["columns_order.json", sideNeumannOrderUrl],
    ];
    const entries = [{ name: "manifest.json", path: `${dir}/manifest.json`, text: JSON.stringify(data) }];
    await Promise.all(
      files.map(async ([name, url]) => {
        const file = await fetch(url);
        if (!file.ok) throw new Error(`缺少 Side-Neumann 抽列 / Missing ${name}`);
        entries.push({ name, path: `${dir}/${name}`, text: await file.text() });
      }),
    );
    baseLayers = defaultBaseLayers();
    await openEntries(entries);
    if (project) {
      project.name = BUNNY_SIDE_NEUMANN_LABEL;
      project.banner = BUNNY_SIDE_NEUMANN_BANNER;
    }
    updateChrome();
    paintBaseChecks();
    if (!statusEl.classList.contains("error")) setStatus(BUNNY_SIDE_NEUMANN_STATUS);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

async function loadBunnyCorridorFieldSwallow() {
  if (!isBunnyCorridorSheet()) setSheetQuery(BUNNY_CORRIDOR_SHEET);
  setStatus(`加载 ${BUNNY_CORRIDOR_LABEL}…`);
  try {
    const data = {
      name: BUNNY_CORRIDOR_LABEL,
      outputs: [
        {
          ...corridorManifest.outputs[0],
          label: BUNNY_CORRIDOR_LABEL,
        },
      ],
    };
    const dir = "experiments/bunny-corridor-field-swallow";
    const files = [
      ["official_bunny_cut_smoothed.obj", corridorMeshUrl],
      ["columns_polyline.obj", corridorPolylineUrl],
      ["columns_type.obj", corridorTypeUrl],
      ["columns_order.json", corridorOrderUrl],
    ];
    const entries = [{ name: "manifest.json", path: `${dir}/manifest.json`, text: JSON.stringify(data) }];
    await Promise.all(
      files.map(async ([name, url]) => {
        const file = await fetch(url);
        if (!file.ok) throw new Error(`缺少走廊抽列 / Missing ${name}`);
        entries.push({ name, path: `${dir}/${name}`, text: await file.text() });
      }),
    );
    baseLayers = facesBaseLayers();
    await openEntries(entries);
    if (project) {
      project.name = BUNNY_CORRIDOR_LABEL;
      project.banner = BUNNY_CORRIDOR_BANNER;
    }
    updateChrome();
    paintBaseChecks();
    if (!statusEl.classList.contains("error")) setStatus(BUNNY_CORRIDOR_STATUS);
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}


async function loadSample(sheet = sheetQuery()) {
  const want = sheetKey(sheet) || "faces-ring0";
  if (!sheetQuery()) setSheetQuery(want);
  await openPublishedSample({
    manifest: "manifest.json",
    missing: "Bunny",
    sheet: want,
    status: "Bunny · faces_ring 接在一张床图上",
    loading: "加载 Bunny / Loading Bunny…",
  });
}

function setOpenMenu(open) {
  if (!openMenuBtn || !openMenuList) return;
  openMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  openMenuList.hidden = !open;
}

openMenuBtn?.addEventListener("click", (ev) => {
  ev.stopPropagation();
  setOpenMenu(openMenuBtn.getAttribute("aria-expanded") !== "true");
});

exportBtn?.addEventListener("click", () => {
  downloadSheetDat();
});

knitDatBtn?.addEventListener("click", () => {
  downloadKnitDat();
});

document.addEventListener("pointerdown", (ev) => {
  if (openMenu && !openMenu.contains(ev.target)) setOpenMenu(false);
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    setOpenMenu(false);
    setBaseMenuOpen(false);
  }
});

openFolderBtn.addEventListener("click", async () => {
  setOpenMenu(false);
  try {
    if (hasDirectoryPicker()) {
      const entries = await pickDirectoryEntries();
      await openEntries(entries);
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  clickInput(folderInput);
});

openFilesBtn.addEventListener("click", () => {
  setOpenMenu(false);
  clickInput(filesInput);
});
facesRing0Btn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("faces-ring0");
  loadSample("faces-ring0");
});
standradBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("standrad-cylinder");
  loadStandradCylinder();
});
denseStandradBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-standrad-cylinder");
  loadDenseStandradCylinder();
});
decreaseBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("decrease-cylinder");
  loadDecreaseCylinder();
});
increaseBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("increase-cylinder");
  loadIncreaseCylinder();
});
thinBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("thin-cylinder");
  loadThinCylinder();
});
fatBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("fat-cylinder");
  loadFatCylinder();
});
denseDecreaseBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-decrease-cylinder");
  loadDenseDecreaseCylinder();
});
denseIncreaseBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-increase-cylinder");
  loadDenseIncreaseCylinder();
});
denseThinBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-thin-cylinder");
  loadDenseThinCylinder();
});
denseFatBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-fat-cylinder");
  loadDenseFatCylinder();
});
denseBunny4SplitBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-bunny-4split");
  loadDenseBunny4Split();
});
denseBunnyLeBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery("dense-bunny-le");
  loadDenseBunnyLe();
});
bunnyCorridorBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery(BUNNY_CORRIDOR_SHEET);
  loadBunnyCorridorFieldSwallow();
});
bunnySideNeumannBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery(BUNNY_SIDE_NEUMANN_SHEET);
  loadBunnySideNeumannSwallow();
});
bunnySideNeumannUniformBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery(BUNNY_SIDE_NEUMANN_UNIFORM_SHEET);
  loadBunnySideNeumannUniformSwallow();
});
bunnySideNeumannWeightedBtn?.addEventListener("click", () => {
  setOpenMenu(false);
  setSheetQuery(BUNNY_SIDE_NEUMANN_WEIGHTED_SHEET);
  loadBunnySideNeumannWeightedSwallow();
});

folderInput.addEventListener("change", async () => {
  const entries = entriesFromFileList(folderInput.files);
  folderInput.value = "";
  await openEntries(entries);
});

filesInput.addEventListener("change", async () => {
  const entries = entriesFromFileList(filesInput.files);
  filesInput.value = "";
  await openEntries(entries);
});

slider.addEventListener("input", () => {
  showOutput(Number(slider.value));
});

function setChromeCollapsed(collapsed) {
  document.body.classList.toggle("chrome-collapsed", collapsed);
  if (hideChromeBtn) {
    hideChromeBtn.hidden = collapsed;
    hideChromeBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
  if (showChromeBtn) {
    showChromeBtn.hidden = !collapsed;
    showChromeBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
  syncViewportAfterLayout();
}

function syncViewportAfterLayout(after) {
  viewer.resize();
  mapView?.resize();
  requestAnimationFrame(() => {
    viewer.resize();
    mapView?.resize();
    after?.();
  });
}

function stoppedMapSuffix(map) {
  const note = map?.legend?.find((row) => row.key === "stopped")?.note || "";
  const hit = String(note).match(/ring (\d+) course (\d+)/);
  if (!hit) return "";
  return ` · 停在 ring ${hit[1]} course ${hit[2]}（后床低于 0，规则等 Singa）`;
}

function ensureKnitDir() {
  if (knitDir) return knitDir;
  knitDir = document.createElement("div");
  knitDir.id = "knit-dir";
  knitDir.className = "knit-dir";
  knitDir.hidden = true;
  knitDir.setAttribute("role", "tooltip");
  const arrow = document.createElement("span");
  arrow.className = "knit-dir-arrow";
  const text = document.createElement("span");
  text.className = "knit-dir-text";
  knitDir.append(arrow, text);
  document.body.append(knitDir);
  return knitDir;
}

function knitTravelArrow(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 36 24");
  svg.setAttribute("width", "40");
  svg.setAttribute("height", "28");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", kind === "left" ? "M32 12H6M16 4L6 12l10 8" : "M4 12H30M20 4l10 8-10 8");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "3.4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function placeKnitTravel(anchor) {
  if (!knitDir || knitDir.hidden || !anchor?.isConnected) return;
  const rect = anchor.getBoundingClientRect();
  const tip = knitDir.getBoundingClientRect();
  const gap = 10;
  let top = rect.top - tip.height - gap;
  if (top < 8) top = rect.bottom + gap;
  // Start the chip at the cell so it stays off the sticky row label.
  let left = rect.left;
  const maxLeft = Math.max(8, window.innerWidth - tip.width - 8);
  left = Math.min(Math.max(8, left), maxLeft);
  knitDir.style.top = `${Math.round(top)}px`;
  knitDir.style.left = `${Math.round(left)}px`;
}

function hideKnitTravel() {
  knitTravelAnchor?.removeAttribute("aria-describedby");
  knitTravelAnchor = null;
  if (!knitDir) return;
  knitDir.hidden = true;
  knitDir.style.visibility = "";
  knitDir.classList.remove("is-left", "is-right", "is-none");
  knitDir.querySelector(".knit-dir-arrow")?.replaceChildren();
  const text = knitDir.querySelector(".knit-dir-text");
  if (text) text.textContent = "";
}

function showKnitTravel(anchor, travel) {
  if (!anchor || !travel) {
    hideKnitTravel();
    return;
  }
  const tip = ensureKnitDir();
  const arrow = tip.querySelector(".knit-dir-arrow");
  const text = tip.querySelector(".knit-dir-text");
  arrow.replaceChildren();
  if (travel.kind === "left" || travel.kind === "right") arrow.append(knitTravelArrow(travel.kind));
  text.textContent = travel.text;
  tip.classList.toggle("is-left", travel.kind === "left");
  tip.classList.toggle("is-right", travel.kind === "right");
  tip.classList.toggle("is-none", travel.kind === "none");
  knitTravelAnchor?.removeAttribute("aria-describedby");
  knitTravelAnchor = anchor;
  anchor.setAttribute("aria-describedby", "knit-dir");
  tip.hidden = false;
  tip.style.visibility = "hidden";
  placeKnitTravel(anchor);
  tip.style.visibility = "visible";
}

function renderKnitCode(knit) {
  hideKnitTravel();
  if (!knitScroll || !knit) return;
  knitScale = 1;
  knitScroll.style.setProperty("--knit-scale", "1");
  if (knitTitle) {
    const legacy = promotedByLegacy(sheetQuery());
    const model = displayKnitModel(knit.model);
    knitTitle.textContent = `${legacy ? `${model}（旧官方时序）` : model} knitting code`;
  }
  if (knitNote) knitNote.textContent = knitCodeCaption(knit);
  if (knitRailNote) {
    const opening = knit.rows?.some((row) => row.functionRails);
    knitRailNote.textContent = opening
      ? `${KNIT_FUNCTION_RAIL_NOTE} 开头功能行抄自模板，主体功能行不变。`
      : KNIT_FUNCTION_RAIL_NOTE;
  }
  if (knitLegend) {
    knitLegend.replaceChildren();
    for (const item of knitCodeLegend(knit)) {
      const span = document.createElement("span");
      span.className = "knit-swatch-item";
      const swatch = document.createElement("i");
      swatch.className = "knit-swatch";
      swatch.style.background = knitCodeInk(item.code, knit.colors).fill;
      span.append(swatch, document.createTextNode(item.name));
      knitLegend.append(span);
    }
  }
  if (knitDetail) knitDetail.textContent = "悬停看行进方向，点一格查看这一针";
  const columns = knitTableColumns(knit);
  const table = document.createElement("table");
  table.className = "knit-grid";
  table.dataset.patternWidth = String(columns.filter((col) => col.role === "pattern").length);
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const [className, text] of [
    ["idx", "行"],
    ["desc", "说明"],
  ]) {
    const th = document.createElement("th");
    th.className = className;
    th.textContent = text;
    headRow.append(th);
  }
  for (const col of columns) {
    const th = document.createElement("th");
    th.className = col.role === "pattern" ? "pattern" : col.role;
    th.dataset.role = col.role;
    if (col.role === "function") {
      th.dataset.side = col.side;
      th.dataset.pair = String(col.pair);
      th.dataset.slot = col.slot;
    } else if (col.role === "gap") {
      th.dataset.side = col.side;
    } else {
      if (col.kind) th.dataset.kind = col.kind;
      if (Number.isInteger(col.needle)) th.dataset.needle = String(col.needle);
    }
    th.textContent = col.header;
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  // Last course at the top, first ring at the bottom. Data order is unchanged.
  for (const { row, rowIndex } of knitCodeDisplayRows(knit)) {
    const tr = document.createElement("tr");
    const idx = document.createElement("td");
    idx.className = "idx";
    idx.textContent = String(row.index);
    const desc = document.createElement("td");
    desc.className = "desc";
    desc.textContent = row.label;
    tr.append(idx, desc);
    for (const cell of knitTableCells(knit, rowIndex)) {
      const td = document.createElement("td");
      if (cell.role !== "pattern") {
        td.className = cell.role === "gap" ? "gap" : "fn";
        td.dataset.role = cell.role;
        td.dataset.side = cell.side;
        if (cell.role === "function") {
          td.dataset.pair = String(cell.pair);
          td.dataset.slot = cell.slot;
        }
        const spacer = document.createElement("span");
        spacer.className = "rail-cell";
        if (String(cell.text).length > 2) spacer.classList.add("is-wide-code");
        spacer.textContent = cell.text;
        if (cell.fill) {
          td.style.background = cell.fill;
          td.style.color = cell.ink;
        } else {
          spacer.setAttribute("aria-hidden", "true");
        }
        td.append(spacer);
        tr.append(td);
        continue;
      }
      td.className = "pattern";
      td.dataset.role = "pattern";
      if (cell.kind) td.dataset.kind = cell.kind;
      if (Number.isInteger(cell.needle)) td.dataset.needle = String(cell.needle);
      const code = cell.code;
      const needleIndex = cell.needleIndex;
      const ink = knitCodeInk(code, knit.colors);
      const detail = describeKnitCell(knit, rowIndex, needleIndex);
      const travel = knitCellTravel(row.winding, code);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "knit-cell";
      if (String(ink.label).length > 2) button.classList.add("is-wide-code");
      button.style.background = ink.fill;
      button.style.color = ink.text;
      button.textContent = ink.label;
      button.setAttribute("aria-label", travel ? `${detail}，${travel.text}` : detail);
      button.dataset.rowIndex = String(rowIndex);
      if (Number.isInteger(cell.needle)) button.dataset.needle = String(cell.needle);
      button.dataset.code = String(code);
      if (row.bind === false) button.dataset.opening = "true";
      button.dataset.winding = row.winding || "";
      button.dataset.travel = travel?.kind || "";
      if (travel?.text) button.dataset.travelText = travel.text;
      const bound = scene?.knitBind?.byKey?.get(`${rowIndex},${needleIndex}`) || null;
      if (Number.isInteger(bound?.index)) button.dataset.face = String(bound.index);
      button.setAttribute("aria-pressed", "false");
      const showTravel = () => {
        if (travel) showKnitTravel(button, travel);
        else hideKnitTravel();
      };
      button.addEventListener("pointerenter", showTravel);
      button.addEventListener("pointerleave", () => {
        if (knitTravelAnchor === button) hideKnitTravel();
      });
      button.addEventListener("focus", showTravel);
      button.addEventListener("blur", () => {
        if (knitTravelAnchor === button) hideKnitTravel();
      });
      button.addEventListener("click", () => {
        if (knitDetail) knitDetail.textContent = detail;
        if (code === 0 || !bound) {
          paintStitchPick(null);
          pressKnitCell(button);
          return;
        }
        if (showPhysNeedle) paintPhysicalStitch(bound);
        else paintStitchPick(bound);
        highlightKnitCodeForPick(button);
      });
      td.append(button);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  knitScroll.replaceChildren(table);
  knitRenderKey = knit;
  if (pickedStitch) highlightKnitCodeForPick();
  else pinKnitCodeScroll();
}

function pressKnitCell(button) {
  for (const cell of knitScroll?.querySelectorAll(".knit-cell") || []) {
    cell.setAttribute("aria-pressed", cell === button ? "true" : "false");
  }
}

function scrollKnitCellIntoView(button) {
  const scroller = knitScroll;
  if (!scroller || !button || mapMode !== "knit") return;
  for (let pass = 0; pass < 4; pass++) {
    const scRect = scroller.getBoundingClientRect();
    const elRect = button.getBoundingClientRect();
    if (scRect.height < 1 || elRect.height < 1) return;
    const head = scroller.querySelector("thead");
    const headBottom = head ? head.getBoundingClientRect().bottom : scRect.top;
    const desc = button.closest("tr")?.querySelector(".desc");
    const descRight = desc ? desc.getBoundingClientRect().right : scRect.left;
    let dx = 0;
    let dy = 0;
    const margin = 6;
    if (elRect.top < headBottom + margin) dy -= headBottom + margin - elRect.top;
    if (elRect.bottom > scRect.bottom - margin) dy += elRect.bottom - (scRect.bottom - margin);
    if (elRect.left < descRight + margin) dx -= descRight + margin - elRect.left;
    if (elRect.right > scRect.right - margin) dx += elRect.right - (scRect.right - margin);
    if (dx === 0 && dy === 0) return;
    scroller.scrollTop += dy;
    scroller.scrollLeft += dx;
  }
}

function highlightKnitCodeForPick(prefer) {
  const face = Number.isInteger(pickedStitch?.index) ? String(pickedStitch.index) : null;
  const pressed = [];
  for (const cell of knitScroll?.querySelectorAll(".knit-cell") || []) {
    const on = face != null && cell.dataset.face === face;
    cell.setAttribute("aria-pressed", on ? "true" : "false");
    if (on) pressed.push(cell);
  }
  if (mapMode !== "knit" || !pressed.length) return;
  const target = prefer && pressed.includes(prefer) ? prefer : pressed[0];
  scrollKnitCellIntoView(target);
  requestAnimationFrame(() => {
    if (target.getAttribute("aria-pressed") === "true") scrollKnitCellIntoView(target);
  });
}

function syncKnitScaleLabel() {
  const knit = scene?.knitCode;
  if (!mapMeta || mapMode !== "knit" || !knit?.rows?.length) return;
  const first = knit.needles[0];
  const last = knit.needles[knit.needles.length - 1];
  const pct = Math.round(knitScale * 100);
  mapMeta.textContent = pct === 100
    ? `${knit.rows.length} 行 · 针 ${first}…${last}`
    : `${knit.rows.length} 行 · 针 ${first}…${last} · ${pct}%`;
}

function zoomKnitToward(next, clientX, clientY, anchor) {
  const scroller = knitScroll;
  if (!scroller) return;
  const scale = clampKnitZoom(next);
  if (Math.abs(scale - knitScale) < 1e-4) return;
  knitPinGeneration += 1;
  const node = anchor instanceof Element ? anchor.closest(".knit-grid th, .knit-grid td") : null;
  const sticky = node?.closest(".idx, .desc, thead");
  if (node && scroller.contains(node) && !sticky) {
    const before = node.getBoundingClientRect();
    const relX = before.width > 0 ? (clientX - before.left) / before.width : 0.5;
    const relY = before.height > 0 ? (clientY - before.top) / before.height : 0.5;
    knitScale = scale;
    scroller.style.setProperty("--knit-scale", String(scale));
    const after = node.getBoundingClientRect();
    scroller.scrollLeft += after.left + relX * after.width - clientX;
    scroller.scrollTop += after.top + relY * after.height - clientY;
  } else {
    const rect = scroller.getBoundingClientRect();
    const left = knitZoomedScroll(scroller.scrollLeft, clientX - rect.left, knitScale, scale);
    const top = knitZoomedScroll(scroller.scrollTop, clientY - rect.top, knitScale, scale);
    knitScale = scale;
    scroller.style.setProperty("--knit-scale", String(scale));
    scroller.scrollLeft = left;
    scroller.scrollTop = top;
  }
  syncKnitScaleLabel();
  if (knitTravelAnchor?.isConnected) placeKnitTravel(knitTravelAnchor);
}

function knitWheelPixels(ev) {
  let dx = ev.deltaX;
  let dy = ev.deltaY;
  if (ev.deltaMode === 1) {
    dx *= 16;
    dy *= 16;
  } else if (ev.deltaMode === 2) {
    dx *= knitScroll?.clientWidth || 800;
    dy *= knitScroll?.clientHeight || 600;
  }
  return { dx, dy };
}

function onKnitWheel(ev) {
  if (!knitScroll || knitCodeEl?.hidden) return;
  const { dx, dy } = knitWheelPixels(ev);
  ev.preventDefault();
  const pinch = ev.ctrlKey || ev.metaKey;
  const sideways = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 0.5;
  if (!pinch && (ev.shiftKey || sideways)) {
    if (ev.shiftKey && Math.abs(dy) >= Math.abs(dx)) knitScroll.scrollLeft += dy;
    else knitScroll.scrollLeft += dx;
    if (!ev.shiftKey && sideways) knitScroll.scrollTop += dy;
    return;
  }
  if (dy === 0) return;
  zoomKnitToward(knitScale * knitZoomFactor(dy), ev.clientX, ev.clientY, ev.target);
}

function onKnitPointerDown(ev) {
  knitSwallowClick = false;
  if (ev.button !== 0 || !ev.isPrimary || ev.pointerType === "touch" || !knitScroll) return;
  knitPan = {
    id: ev.pointerId,
    x: ev.clientX,
    y: ev.clientY,
    left: knitScroll.scrollLeft,
    top: knitScroll.scrollTop,
    moved: false,
  };
}

function onKnitPointerMove(ev) {
  if (!knitPan || ev.pointerId !== knitPan.id || !knitScroll) return;
  const dx = ev.clientX - knitPan.x;
  const dy = ev.clientY - knitPan.y;
  if (!knitPan.moved && Math.hypot(dx, dy) < 5) return;
  if (!knitPan.moved) {
    knitPan.moved = true;
    knitScroll.classList.add("is-panning");
    knitScroll.setPointerCapture(ev.pointerId);
  }
  ev.preventDefault();
  knitScroll.scrollLeft = knitPan.left - dx;
  knitScroll.scrollTop = knitPan.top - dy;
}

function onKnitPointerEnd(ev) {
  if (!knitPan || ev.pointerId !== knitPan.id) return;
  if (knitPan.moved) knitSwallowClick = true;
  knitScroll?.classList.remove("is-panning");
  knitPan = null;
}

function pinKnitCodeScroll() {
  if (!knitScroll) return;
  const token = ++knitPinGeneration;
  const pin = () => {
    if (token !== knitPinGeneration || knitScale !== 1) return;
    knitScroll.scrollTop = knitCodeInitialScrollTop(knitScroll.scrollHeight, knitScroll.clientHeight);
    const pattern =
      knitScroll.querySelector('tbody td.pattern[data-needle="0"]') ||
      knitScroll.querySelector("tbody td.pattern");
    const desc = knitScroll.querySelector("tbody td.desc");
    if (!pattern || !desc) return;
    const delta = pattern.getBoundingClientRect().left - desc.getBoundingClientRect().right;
    if (Math.abs(delta) > 1) knitScroll.scrollLeft += delta;
  };
  pin();
  requestAnimationFrame(pin);
  document.fonts?.ready?.then(pin);
}

function paintMapChrome() {
  const knit = scene?.knitCode;
  const hasKnit = Boolean(knit?.rows?.length);
  if (!hasKnit) mapMode = "readable";
  const showingKnit = mapMode === "knit" && hasKnit;
  if (mapModeReadable) pressed(mapModeReadable, !showingKnit);
  if (mapModeKnit) {
    mapModeKnit.disabled = !hasKnit;
    mapModeKnit.title = hasKnit ? "knitting code" : "此 sheet 暂无编织码";
    pressed(mapModeKnit, showingKnit);
  }
  mapPane?.classList.toggle("show-knit-code", showingKnit);
  if (knitCodeEl) knitCodeEl.hidden = !showingKnit;
  if (!showingKnit) hideKnitTravel();
  for (const btn of [mapZoomIn, mapZoomOut, mapFitBtn, mapPhysBtn]) {
    if (btn) btn.disabled = showingKnit;
  }
  if (mapHeading) {
    mapHeading.replaceChildren();
    const legacy = !showingKnit ? promotedByLegacy(sheetQuery()) : null;
    if (legacy) {
      mapHeading.append(document.createTextNode(`${legacy.officialName}（旧官方时序）`));
    } else {
      mapHeading.append(document.createTextNode(showingKnit ? "编织码 " : "生长图 "));
      const en = document.createElement("span");
      en.className = "en";
      en.textContent = showingKnit ? "Code" : "Map";
      mapHeading.append(en);
    }
  }
  syncKnitDatButton();
  if (showingKnit) {
    if (knitRenderKey !== knit) renderKnitCode(knit);
    const first = knit.needles[0];
    const last = knit.needles[knit.needles.length - 1];
    const pct = Math.round(knitScale * 100);
    if (mapMeta) {
      mapMeta.textContent = pct === 100
        ? `${knit.rows.length} 行 · 针 ${first}…${last}`
        : `${knit.rows.length} 行 · 针 ${first}…${last} · ${pct}%`;
    }
  }
}

function setMapMode(mode) {
  const next = mode === "knit" && scene?.knitCode?.rows?.length ? "knit" : "readable";
  if (next === mapMode) return;
  mapMode = next;
  paintMapChrome();
  if (next === "readable") {
    requestAnimationFrame(() => {
      paintReadableMap();
      mapView?.resize();
    });
  } else {
    requestAnimationFrame(() => highlightKnitCodeForPick());
  }
}

function paintReadableMap() {
  const map = scene?.readableMap;
  const hasMap = Boolean(map?.rows?.length || map?.cells?.length);
  if (mapPane) {
    mapPane.hidden = !hasMap;
    mapPane.classList.toggle("excel-map", map?.source === "excel");
  }
  if (mapEmpty) mapEmpty.hidden = hasMap;
  if (!hasMap) {
    mapView?.clear();
    if (mapMeta) mapMeta.textContent = "readable_map";
    paintMapChrome();
    syncPaneLayout();
    return;
  }
  const stitches = scene?.stitches?.bound?.stitches || [];
  const grid = buildReadableMapGrid(map, stitches);
  mapView?.setGrid(grid);
  const h = map.header;
  if (mapMeta) {
    const legacy = promotedByLegacy(sheetQuery());
    const excelMeta =
      map.source === "excel"
        ? `${map.sheet === "step4-ring0" ? "step4-ring0" : map.sheet === "ring0" ? "Bunny" : map.sheet || "step3"} ${map.rows.length}×${map.needleCols.length} · ${map.colMin}…${map.colMax} · Excel${map.sheet === "step4-ring0" ? " · 第二圈继承床位，前床第一针 F0" : map.sheet === "ring0" ? " · 第一环和第二环接在一张表上" : ""}${stoppedMapSuffix(map)}`
        : h
          ? `${h.rows} rows · ${h.cells} cells · circle ${h.circle ?? "—"}`
          : `${map.rows.length} rows · ${map.cells.length} cells`;
    mapMeta.textContent = legacy ? `旧官方时序 · ${excelMeta}` : excelMeta;
  }
  paintMapHighlight();
  paintMapChrome();
  syncPaneLayout();
  requestAnimationFrame(() => {
    mapView?.resize();
    if (pickedStitch) {
      mapView.ensureVisible(mapKeysForStitch(pickedStitch));
    } else {
      mapView?.fit();
    }
  });
}

function paintMapHighlight() {
  if (!mapView) return;
  if (physPickKeys) {
    mapView.setHighlight(new Set());
    mapView.setPickHighlight(physPickKeys);
    mapView.ensureVisible(physPickKeys);
    return;
  }
  if (pickedStitch) {
    const keys = mapKeysForStitch(pickedStitch);
    mapView.setHighlight(new Set());
    mapView.setPickHighlight(keys);
    mapView.ensureVisible(keys);
    return;
  }
  mapView.setPickHighlight(new Set());
  mapView.ensureVisible(new Set());
  if (!scene?.stitches?.bound?.stitches?.length) {
    mapView.setHighlight(new Set());
    return;
  }
  const [r0, r1] = facesRange.value;
  const [t0, t1] = termsRange.value;
  const visible = stitchesVisibleForSliders(scene.stitches.bound.stitches, r0, r1, t0, t1);
  mapView.setHighlight(
    highlightKeysFromStitches(visible, {
      map: scene?.readableMap,
      grid: mapView.grid,
      bind: stitchMapBind(),
    }),
  );
}

function syncPaneLayout() {
  const hasMap = Boolean(scene?.readableMap?.cells?.length) && mapPane && !mapPane.hidden;
  const narrow = narrowSplitMq.matches;
  document.body.classList.toggle("narrow-split", narrow && hasMap);
  if (paneSwitch) paneSwitch.hidden = !(narrow && hasMap);
  if (!hasMap) {
    document.body.classList.remove("show-map", "show-3d");
    return;
  }
  if (narrow) {
    document.body.classList.toggle("show-map", mobilePane === "map");
    document.body.classList.toggle("show-3d", mobilePane === "3d");
    if (pane3dBtn) pane3dBtn.setAttribute("aria-pressed", mobilePane === "3d" ? "true" : "false");
    if (paneMapBtn) paneMapBtn.setAttribute("aria-pressed", mobilePane === "map" ? "true" : "false");
  } else {
    document.body.classList.remove("show-map", "show-3d");
  }
  syncViewportAfterLayout();
}

function setMobilePane(pane) {
  mobilePane = pane === "map" ? "map" : "3d";
  syncPaneLayout();
  if (mobilePane === "map") {
    requestAnimationFrame(() => {
      mapView?.resize();
      if (pickedStitch) {
        mapView.ensureVisible(mapKeysForStitch(pickedStitch));
      } else {
        mapView?.fit();
      }
    });
  }
}

fitBtn.addEventListener("click", () => {
  viewer.resize();
  viewer.fitToView();
});

mapZoomIn?.addEventListener("click", () => {
  mapView?.zoomBy(1.2, (mapView._cssW || 1) / 2, (mapView._cssH || 1) / 2);
});
mapZoomOut?.addEventListener("click", () => {
  mapView?.zoomBy(1 / 1.2, (mapView._cssW || 1) / 2, (mapView._cssH || 1) / 2);
});
mapFitBtn?.addEventListener("click", () => {
  mapView?.resize();
  mapView?.fit({ overview: true });
});
knitScroll?.addEventListener(
  "scroll",
  () => {
    if (knitTravelAnchor?.isConnected) placeKnitTravel(knitTravelAnchor);
    else if (knitTravelAnchor) hideKnitTravel();
  },
  { passive: true },
);
knitScroll?.addEventListener("wheel", onKnitWheel, { passive: false });
knitScroll?.addEventListener("pointerdown", onKnitPointerDown);
knitScroll?.addEventListener("pointermove", onKnitPointerMove);
knitScroll?.addEventListener("pointerup", onKnitPointerEnd);
knitScroll?.addEventListener("pointercancel", onKnitPointerEnd);
knitScroll?.addEventListener(
  "click",
  (ev) => {
    if (!knitSwallowClick) return;
    knitSwallowClick = false;
    ev.preventDefault();
    ev.stopPropagation();
  },
  true,
);
knitScroll?.addEventListener("dblclick", (ev) => {
  if (ev.target instanceof Element && ev.target.closest(".knit-cell")) return;
  zoomKnitToward(1, ev.clientX, ev.clientY, ev.target);
});
window.addEventListener("resize", () => {
  if (knitTravelAnchor?.isConnected) placeKnitTravel(knitTravelAnchor);
});
mapModeReadable?.addEventListener("click", () => setMapMode("readable"));
mapModeKnit?.addEventListener("click", () => {
  if (mapModeKnit.disabled) return;
  setMapMode("knit");
});
mapPhysBtn?.addEventListener("click", () => {
  showPhysNeedle = mapPhysBtn.getAttribute("aria-pressed") !== "true";
  pressed(mapPhysBtn, showPhysNeedle);
  mapView?.setShowPhysicalNeedles(showPhysNeedle);
  if (showPhysNeedle) {
    if (pickedStitch) paintPhysicalStitch(pickedStitch);
  } else {
    paintStitchPick(pickedStitch);
  }
});
pane3dBtn?.addEventListener("click", () => setMobilePane("3d"));
paneMapBtn?.addEventListener("click", () => setMobilePane("map"));
narrowSplitMq.addEventListener?.("change", () => syncPaneLayout());
narrowSplitMq.addListener?.(() => syncPaneLayout());

hideChromeBtn?.addEventListener("click", () => setChromeCollapsed(true));
showChromeBtn?.addEventListener("click", () => setChromeCollapsed(false));

function setBaseMenuOpen(open) {
  if (!baseMenuBtn || !baseMenuList) return;
  baseMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  baseMenuList.hidden = !open;
}

function paintBaseChecks() {
  if (baseChecks.off) baseChecks.off.checked = Boolean(baseLayers.off);
  if (baseChecks.wire) baseChecks.wire.checked = Boolean(baseLayers.wire);
  if (baseChecks.faces) baseChecks.faces.checked = Boolean(baseLayers.faces);
  if (baseChecks.points) baseChecks.points.checked = Boolean(baseLayers.points);
  if (baseMenuBtn) {
    baseMenuBtn.setAttribute("aria-pressed", !isBaseHidden(baseLayers) ? "true" : "false");
  }
}

function onBaseCheck(layer, checked) {
  baseLayers = applyBaseChoice(baseLayers, layer, checked);
  paintBaseChecks();
  viewer.setBaseLayers(baseLayers);
}

baseMenuBtn?.addEventListener("click", (ev) => {
  ev.stopPropagation();
  setBaseMenuOpen(baseMenuBtn.getAttribute("aria-expanded") !== "true");
});

document.addEventListener("pointerdown", (ev) => {
  if (baseMenu && !baseMenu.contains(ev.target)) setBaseMenuOpen(false);
});

for (const [layer, el] of Object.entries(baseChecks)) {
  el?.addEventListener("change", () => onBaseCheck(layer, el.checked));
}

paintBaseChecks();

colColorType?.addEventListener("click", () => setColumnColorMode("type"));
colColorField?.addEventListener("click", () => setColumnColorMode("field"));

warpBtn.addEventListener("click", () => {
  const on = warpBtn.getAttribute("aria-pressed") !== "true";
  pressed(warpBtn, on);
  viewer.setShowWarp(on);
});

overlayBtn.addEventListener("click", () => {
  const on = overlayBtn.getAttribute("aria-pressed") !== "true";
  pressed(overlayBtn, on);
  viewer.setShowOverlay(on);
});

knitBedBtn?.addEventListener("click", () => {
  const on = knitBedBtn.getAttribute("aria-pressed") !== "true";
  pressed(knitBedBtn, on);
  viewer.setShowKnitBed(on);
});

let pointer = { x: 0, y: 0, moved: false };
canvas.addEventListener("pointerdown", (ev) => {
  pointer = { x: ev.clientX, y: ev.clientY, moved: false };
});
canvas.addEventListener("pointermove", (ev) => {
  if (Math.hypot(ev.clientX - pointer.x, ev.clientY - pointer.y) > 8) pointer.moved = true;
});
canvas.addEventListener("pointerup", (ev) => {
  if (pointer.moved || !scene?.stitches?.rowChunks?.length) return;
  const stitch = viewer.pickStitch(ev.clientX, ev.clientY);
  if (showPhysNeedle) paintPhysicalStitch(stitch);
  else paintStitchPick(stitch);
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
    .then((reg) => {
      reg.update();
    })
    .catch(() => {});
}

updateChrome();
syncExportButton();
syncKnitDatButton();
if (sheetQuery() && canonicalSheetId(sheetQuery()) !== sheetKey(sheetQuery())) setSheetQuery(sheetQuery());
const legacySchedule = promotedByLegacy(sheetQuery());
if (legacySchedule) loadLegacySchedule(legacySchedule);
else if (isBunnySideNeumannWeightedSheet(sheetQuery())) loadBunnySideNeumannWeightedSwallow();
else if (isBunnySideNeumannUniformSheet(sheetQuery())) loadBunnySideNeumannUniformSwallow();
else if (isBunnySideNeumannSheet(sheetQuery())) loadBunnySideNeumannSwallow();
else if (isBunnyCorridorSheet(sheetQuery())) loadBunnyCorridorFieldSwallow();
else if (isDenseBunny4SplitSheet(sheetQuery())) loadDenseBunny4Split();
else if (isDenseBunnyLeSheet(sheetQuery())) loadDenseBunnyLe();
else if (isDenseFatSheet(sheetQuery())) loadDenseFatCylinder();
else if (isFatSheet(sheetQuery())) loadFatCylinder();
else if (isDenseThinSheet(sheetQuery())) loadDenseThinCylinder();
else if (isThinSheet(sheetQuery())) loadThinCylinder();
else if (isDenseIncreaseSheet(sheetQuery())) loadDenseIncreaseCylinder();
else if (isIncreaseSheet(sheetQuery())) loadIncreaseCylinder();
else if (isDenseDecreaseSheet(sheetQuery())) loadDenseDecreaseCylinder();
else if (isDecreaseSheet(sheetQuery())) loadDecreaseCylinder();
else if (isDenseStandradSheet(sheetQuery())) loadDenseStandradCylinder();
else if (isStandradSheet(sheetQuery())) loadStandradCylinder();
else {
  if (!sheetQuery()) setSheetQuery("faces-ring0");
  loadSample(sheetQuery() || "faces-ring0");
}
