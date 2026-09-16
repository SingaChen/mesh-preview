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
  isManifestShape,
  projectFromDiscovery,
  projectFromManifest,
  readEntryBuffer,
  readEntryText,
} from "./project.js";
import {
  applyFacesRingLayout,
  bindStitchesToMap,
  collectManifestRefs,
  CYLINDER_FACES_RING_COUNTS,
  faceCentroid,
  faceChunksFromFaces,
  inferTermTypeFromVerts,
  parseColoredObj,
  parseColsResample,
  parseFacesRingLayout,
  parseFirstRows,
  parseReadableMap,
  termsSliderForFacesEnd,
} from "./stitches.js";
import { bindDualRange } from "./dual-range.js";
import {
  applyDisplayModelsRange,
  formatDisplayModelsLabel,
  formatFacesRingLabel,
  formatHalfOpenRangeLabel,
  formatTermsRangeLabel,
  registerDisplayModel,
} from "./range.js";

const canvas = document.querySelector("#viewport");
const folderInput = document.querySelector("#folder-input");
const filesInput = document.querySelector("#files-input");
const openFolderBtn = document.querySelector("#open-folder");
const openFilesBtn = document.querySelector("#open-files");
const sampleBtn = document.querySelector("#load-sample");
const fitBtn = document.querySelector("#fit-view");
const slider = document.querySelector("#mesh-slider");
const meshRow = document.querySelector("#mesh-row");
const colsRow = document.querySelector("#cols-row");
const facesRow = document.querySelector("#faces-row");
const termsRow = document.querySelector("#terms-row");
const modelsRow = document.querySelector("#models-row");
const colsLabel = document.querySelector("#cols-label");
const facesLabel = document.querySelector("#faces-label");
const termsLabel = document.querySelector("#terms-label");
const modelsLabel = document.querySelector("#models-label");
const labelEl = document.querySelector("#mesh-label");
const countEl = document.querySelector("#mesh-count");
const projectEl = document.querySelector("#project-name");
const statsEl = document.querySelector("#mesh-stats");
const statusEl = document.querySelector("#status");
const wireBtn = document.querySelector("#toggle-wire");
const shadeBtn = document.querySelector("#toggle-shade");
const overlayBtn = document.querySelector("#toggle-overlay");

const viewer = new MeshViewer(canvas);
const colsRange = bindDualRange(document.querySelector("#cols-range"));
const facesRange = bindDualRange(document.querySelector("#faces-range"));
const termsRange = bindDualRange(document.querySelector("#terms-range"));
const modelsRange = bindDualRange(document.querySelector("#models-range"));

let project = null;
let outputIndex = 0;
let scene = null;
const geomCache = new Map();
const textCache = new Map();

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", isError);
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

  const hasCols = Boolean(scene?.columns?.length);
  const hasStitches = Boolean(scene?.stitches?.rowChunks?.length);
  const hasModels = Boolean(scene?.models?.length);
  const showDyn = hasCols || hasStitches;
  colsRow.classList.toggle("hidden", !hasCols);
  facesRow.classList.toggle("hidden", !hasStitches);
  termsRow.classList.toggle("hidden", !hasStitches);
  modelsRow.classList.toggle("hidden", !hasModels);

  if (hasCols) {
    const [a, b] = colsRange.value;
    colsLabel.textContent = formatHalfOpenRangeLabel("cols_resample", a, b, scene.columns.length);
  } else {
    colsLabel.textContent = "cols_resample: -";
  }

  if (hasStitches) {
    const n = scene.stitches.rowChunks.length;
    const [a, b] = facesRange.value;
    facesLabel.textContent = formatFacesRingLabel(a, b, n);
    facesRange.setEnabled(true);
    const bind = termsSliderForFacesEnd(scene.stitches.rowChunks, b, b);
    const [ts, te] = termsRange.value;
    termsLabel.textContent = formatTermsRangeLabel(ts, te, bind.nTerms, bind.activeRing);
    termsRange.setEnabled(bind.nTerms > 0);
  } else {
    facesLabel.textContent = "faces_ring: -";
    termsLabel.textContent = "terms: -";
    facesRange.setEnabled(false);
    termsRange.setEnabled(false);
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

async function loadStitches(output) {
  const stitchEntry = output.stitchFile || output.overlayFile;
  const mapEntry = output.readableMapFile;
  if (!stitchEntry) return null;
  const stitchText = await loadText(stitchEntry);
  if (!stitchText) return null;
  const parsed = parseColoredObj(stitchText);
  if (!parsed.faces.length) return null;
  let bound = null;
  if (mapEntry) {
    const mapText = await loadText(mapEntry);
    const map = parseReadableMap(mapText);
    if (map.cells.length) bound = bindStitchesToMap(parsed.faces, map);
  }
  if (!bound) {
    bound = {
      stitches: parsed.faces.map((face, index) => ({
        index,
        verts: face.verts,
        centroid: faceCentroid(face),
        row: null,
        col: 0,
        token: null,
        dir: null,
      })),
      columns: [0],
      rowMin: 0,
      rowMax: 0,
      unboundFaces: 0,
      leftoverCells: 0,
    };
  }
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
  if (!layout && firstRows?.nRings === CYLINDER_FACES_RING_COUNTS.length) {
    let offset = 0;
    layout = parseFacesRingLayout({
      n_faces_ring: firstRows.nRings,
      leftover_faces: Math.max(0, bound.stitches.length - CYLINDER_FACES_RING_COUNTS.reduce((a, b) => a + b, 0)),
      rings: CYLINDER_FACES_RING_COUNTS.map((n, index) => {
        const types = bound.stitches.slice(offset, offset + n).map((s) => inferTermTypeFromVerts(s.verts));
        offset += n;
        return { index, n_terms: n, types };
      }),
    });
  }
  const assigned = applyFacesRingLayout(bound.stitches, layout);
  const rowChunks = assigned.chunks;
  bound.nRings = rowChunks.length;
  bound.rowChunks = rowChunks;
  bound.leftover = assigned.leftover;
  const faceChunks = faceChunksFromFaces(parsed.faces);
  return {
    bound,
    faceChunks,
    rowChunks,
    leftover: assigned.leftover,
    firstRows,
    layout,
    stitchEntry,
    mapEntry,
  };
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

function applyColsRange() {
  if (!scene?.columns?.length) return;
  const [start, end] = colsRange.value;
  viewer.setColsResampleRange(start, end);
  colsLabel.textContent = formatHalfOpenRangeLabel("cols_resample", start, end, scene.columns.length);
}

function bindTermsToFacesEnd({ force = false } = {}) {
  const rings = scene?.stitches?.rowChunks || [];
  const [, facesEnd] = facesRange.value;
  const bind = termsSliderForFacesEnd(rings, facesEnd, scene?.prevFacesEnd);
  scene.prevFacesEnd = facesEnd;
  if (force || bind.rebind) {
    termsRange.configure(bind.nTerms, bind.range);
  }
  return bind;
}

function applyKnitWindow() {
  const rings = scene?.stitches?.rowChunks || [];
  if (!rings.length) return;
  const [rs, re] = facesRange.value;
  const bind = bindTermsToFacesEnd();
  const [ts, te] = termsRange.value;
  viewer.setFacesRingRange(rs, re, ts, te);
  facesLabel.textContent = formatFacesRingLabel(rs, re, rings.length);
  termsLabel.textContent = formatTermsRangeLabel(ts, te, bind.nTerms, bind.activeRing);
}

function applyModelsRange() {
  if (!scene?.models?.length) return;
  const [start, end] = modelsRange.value;
  const result = applyDisplayModelsRange(scene.models, start, end, scene.prevFacesItem);
  for (let i = 0; i < scene.models.length; i++) {
    viewer.setModelVisible(scene.models[i].name, result.visibility[i]);
  }
  modelsLabel.textContent = formatDisplayModelsLabel(result.start, result.end, scene.models);
}

function applyAllFilters() {
  applyColsRange();
  applyModelsRange();
  applyKnitWindow();
  updateChrome();
}

colsRange.setOnChange(() => {
  applyColsRange();
  updateChrome();
});
facesRange.setOnChange(() => {
  applyKnitWindow();
  updateChrome();
});
termsRange.setOnChange(() => {
  applyKnitWindow();
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
  setStatus("加载中 / Loading…");
  try {
    const meshGeom = await loadGeometry(output.meshFile);
    const stitches = await loadStitches(output);
    const cols = await loadCols(output);
    viewer.setWireframe(wireBtn.getAttribute("aria-pressed") === "true");
    viewer.setFlat(shadeBtn.getAttribute("aria-pressed") === "true");
    viewer.setShowOverlay(overlayBtn.getAttribute("aria-pressed") === "true");

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

    scene = {
      models,
      columns: cols?.columns || null,
      stitches,
      facesBound: stitches
        ? {
            kind: "faces_ring",
            name: "KnittingStitches",
            item: "KnittingStitches",
            faceChunks: stitches.faceChunks,
            rowChunks: stitches.rowChunks,
          }
        : null,
      prevFacesItem: stitches ? "KnittingStitches" : null,
      prevFacesEnd: null,
      cutName,
    };

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
    modelsRange.configure(models.length, models.length ? [0, models.length] : [0, 0]);
    if (stitches?.rowChunks?.length) {
      facesRange.configure(stitches.rowChunks.length, [0, stitches.rowChunks.length]);
      bindTermsToFacesEnd({ force: true });
    } else {
      facesRange.configure(0, [0, 0]);
      termsRange.configure(0, [0, 0]);
    }

    applyAllFilters();

    const bits = [];
    if (meshGeom) {
      const pos = meshGeom.getAttribute("position");
      bits.push(`${pos?.count ?? 0} vtx`);
    }
    if (cols) bits.push(`${cols.columns.length} cols_resample`);
    if (stitches) {
      bits.push(`${stitches.rowChunks.length} faces_ring`);
      bits.push(`${stitches.layout?.nTyped ?? stitches.rowChunks.reduce((n, c) => n + c.n_terms, 0)} terms`);
    }
    bits.push(`${models.length} models`);
    statsEl.textContent = bits.join(" · ");
    setStatus("cols_resample / faces_ring / terms · dual-range like SingaLab");
    if (fit) viewer.fitToView();
  } catch (err) {
    statsEl.textContent = "";
    scene = null;
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
      setStatus("圆柱 · cols_resample / faces_ring / terms · drag to orbit");
    }
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

openFolderBtn.addEventListener("click", async () => {
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

openFilesBtn.addEventListener("click", () => clickInput(filesInput));
sampleBtn.addEventListener("click", () => loadSample());

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

fitBtn.addEventListener("click", () => viewer.fitToView());

wireBtn.addEventListener("click", () => {
  const on = wireBtn.getAttribute("aria-pressed") !== "true";
  pressed(wireBtn, on);
  viewer.setWireframe(on);
});

shadeBtn.addEventListener("click", () => {
  const on = shadeBtn.getAttribute("aria-pressed") !== "true";
  pressed(shadeBtn, on);
  viewer.setFlat(on);
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
  const stitch = viewer.pickStitch(ev.clientX, ev.clientY);
  const ring = stitch?.ring;
  if (ring == null) return;
  const n = scene.stitches.rowChunks.length;
  const [curA, curB] = facesRange.value;
  if (curA === ring && curB === ring + 1) {
    facesRange.configure(n, [0, n]);
  } else {
    facesRange.configure(n, [ring, ring + 1]);
  }
  applyKnitWindow();
  updateChrome();
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
