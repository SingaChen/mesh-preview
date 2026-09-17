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
import { parseExcelReadableMap } from "./excel-map.js";
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
import { buildReadableMapGrid, highlightKeysForStitch, highlightKeysFromStitches } from "./readable-map.js";
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
const geomCache = new Map();
const textCache = new Map();

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", isError);
}

function paintStitchPick(stitch) {
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
    const keys = highlightKeysForStitch(pickedStitch, {
      map: scene?.readableMap,
      grid: mapView?.grid,
    });
    stitchPickEl.dataset.mapCells = [...keys].join(" ");
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
  return isExcelReadableMapName(name) || (isXlsName(name) && /readable_map|step3/i.test(name));
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
  colsLabel.textContent = formatHalfOpenRangeLabel("cols_resample", start, end, scene.columns.length);
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
  paintStitchPick(null);
  setStatus("加载中 / Loading…");
  try {
    const meshGeom = await loadGeometry(output.meshFile);
    const stitches = await loadStitches(output);
    const cols = await loadCols(output);
    viewer.setBaseLayers(baseLayers);
    viewer.setShowOverlay(overlayBtn.getAttribute("aria-pressed") === "true");
    viewer.setShowWarp(warpBtn.getAttribute("aria-pressed") === "true");

    const models = [];
    const cutName = modelNameFromFile(output.meshFile, "cut_iteration_0");
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
    scene = {
      models,
      columns: cols?.columns || null,
      stitches,
      facesBound: stitches,
      prevFacesItem: stitches ? "KnittingStitches" : null,
      prevActiveRing: null,
      cutName,
      readableMap,
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
    if (meshGeom) {
      const pos = meshGeom.getAttribute("position");
      bits.push(`${pos?.count ?? 0} vtx`);
    }
    if (cols) bits.push(`${cols.columns.length} cols_resample`);
    if (stitches) bits.push(`${stitches.rowChunks.length} faces_ring`);
    if (stitches?.layout?.termTotal) bits.push(`${stitches.layout.termTotal} terms`);
    else bits.push(`${models.length} models`);
    statsEl.textContent = bits.join(" · ");
    setStatus("三滑块半开区间 [start,end) · dual-range like SingaLab");
    syncViewportAfterLayout(fit ? () => viewer.fitToView() : undefined);
  } catch (err) {
    statsEl.textContent = "";
    scene = null;
    paintReadableMap();
    updateChrome();
    setStatus(err.message || String(err), true);
  }
}

async function openEntries(entries) {
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
  outputIndex = project.outputs.length - 1;
  const warn = project.warnings[0];
  if (warn) setStatus(warn, true);
  await showOutput(outputIndex, { fit: true });
}

async function loadSample() {
  setStatus("加载示例 / Loading sample…");
  const base = import.meta.env.BASE_URL;
  try {
    const res = await fetch(`${base}sample/manifest.json`, { cache: "reload" });
    if (!res.ok) throw new Error("示例清单不可用 / Sample manifest missing");
    const data = await res.json();
    const paths = collectManifestRefs(data);
    const entries = [
      { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ];
    await Promise.all(
      paths.map(async (rel) => {
        const res = await fetch(`${base}sample/${rel}`, { cache: "reload" });
        if (!res.ok) throw new Error(`缺少示例 / Missing sample ${rel}`);
        const name = rel.split("/").pop();
        if (/\.xlsx?$/i.test(rel)) {
          entries.push({ name, path: `sample/${rel}`, buffer: await res.arrayBuffer() });
        } else {
          entries.push({ name, path: `sample/${rel}`, text: await res.text() });
        }
      }),
    );
    await openEntries(entries);
    if (!statusEl.classList.contains("error")) {
      setStatus("左 3D · 右 step3 Excel · 窄屏切 3D/图");
    }
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
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
sampleBtn.addEventListener("click", () => {
  setOpenMenu(false);
  loadSample();
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
    syncPaneLayout();
    return;
  }
  const stitches = scene?.stitches?.bound?.stitches || [];
  const grid = buildReadableMapGrid(map, stitches);
  mapView?.setGrid(grid);
  const h = map.header;
  if (mapMeta) {
    mapMeta.textContent =
      map.source === "excel"
        ? `step3 ${map.rows.length}×${map.needleCols.length} · ${map.colMin}…${map.colMax} · Excel`
        : h
          ? `${h.rows} rows · ${h.cells} cells · circle ${h.circle ?? "—"}`
          : `${map.rows.length} rows · ${map.cells.length} cells`;
  }
  paintMapHighlight();
  syncPaneLayout();
  requestAnimationFrame(() => {
    mapView?.resize();
    if (pickedStitch) {
      const keys = highlightKeysForStitch(pickedStitch, {
        map: scene?.readableMap,
        grid: mapView.grid,
      });
      mapView.ensureVisible(keys);
    } else {
      mapView?.fit();
    }
  });
}

function paintMapHighlight() {
  if (!mapView) return;
  if (pickedStitch) {
    const keys = highlightKeysForStitch(pickedStitch, {
      map: scene?.readableMap,
      grid: mapView.grid,
    });
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
  mapView.setHighlight(highlightKeysFromStitches(visible, { map: scene?.readableMap, grid: mapView.grid }));
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
        const keys = highlightKeysForStitch(pickedStitch, {
          map: scene?.readableMap,
          grid: mapView.grid,
        });
        mapView.ensureVisible(keys);
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
    baseMenuBtn.setAttribute("aria-pressed", isBaseHidden(baseLayers) ? "false" : "true");
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

let pointer = { x: 0, y: 0, moved: false };
canvas.addEventListener("pointerdown", (ev) => {
  pointer = { x: ev.clientX, y: ev.clientY, moved: false };
});
canvas.addEventListener("pointermove", (ev) => {
  if (Math.hypot(ev.clientX - pointer.x, ev.clientY - pointer.y) > 8) pointer.moved = true;
});
canvas.addEventListener("pointerup", (ev) => {
  if (pointer.moved || !scene?.stitches?.rowChunks?.length) return;
  paintStitchPick(viewer.pickStitch(ev.clientX, ev.clientY));
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
loadSample();
