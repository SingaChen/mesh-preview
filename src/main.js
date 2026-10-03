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
  parseColoredObj,
  parseColsResample,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  parseStitchMapBind,
} from "./stitches.js";
import {
  formatPhysicalNeedle,
  formatPhysicalNeedles,
  isFacesRing0BedChart,
  isFlipDir,
  isTransferDir,
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
import { applyBaseChoice, defaultBaseLayers, isBaseHidden } from "./display.js";
import {
  buildReadableMapGrid,
  highlightKeysForStitch,
  highlightKeysFromStitches,
  stitchForMapCell,
} from "./readable-map.js";
import { ReadableMapView } from "./map-view.js";

const canvas = document.querySelector("#viewport");
const folderInput = document.querySelector("#folder-input");
const filesInput = document.querySelector("#files-input");
const openMenu = document.querySelector("#open-menu");
const openMenuBtn = document.querySelector("#open-menu-btn");
const openMenuList = document.querySelector("#open-menu-list");
const openFolderBtn = document.querySelector("#open-folder");
const openFilesBtn = document.querySelector("#open-files");
const sampleBtn = document.querySelector("#load-sample");
const facesRing0Btn = document.querySelector("#load-faces-ring0");
const fitBtn = document.querySelector("#fit-view");
const slider = document.querySelector("#mesh-slider");
const meshRow = document.querySelector("#mesh-row");
const colsRow = document.querySelector("#cols-row");
const facesRow = document.querySelector("#faces-row");
const modelsRow = document.querySelector("#models-row");
const termsRow = document.querySelector("#terms-row");
const colsLabel = document.querySelector("#cols-label");
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
let pickedStitch = null;
let showPhysNeedle = false;
let physPickKeys = null;
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
    ? `${project.name} · ${project.source === "manifest" ? "清单 manifest" : "自动发现 auto"}`
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
    colsLabel.textContent = formatHalfOpenRangeLabel("cols_resample", a, b, scene.columns.length);
  } else {
    colsLabel.textContent = "cols_resample: -";
  }

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
  return isExcelReadableMapName(name) || isFacesRing0BedChart(name) || (isXlsName(name) && /readable_map|step3/i.test(name));
}
