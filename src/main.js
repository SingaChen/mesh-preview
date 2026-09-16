import { MeshViewer } from "./viewer.js";
import {
  clickInput,
  entriesFromFileList,
  hasDirectoryPicker,
  pickDirectoryEntries,
} from "./files.js";
import {
  indexFiles,
  isManifestShape,
  projectFromDiscovery,
  projectFromManifest,
  readEntryText,
} from "./project.js";
import {
  bindStitchesToMap,
  collectManifestRefs,
  parseColoredObj,
  parseReadableMap,
} from "./stitches.js";

const canvas = document.querySelector("#viewport");
const folderInput = document.querySelector("#folder-input");
const filesInput = document.querySelector("#files-input");
const openFolderBtn = document.querySelector("#open-folder");
const openFilesBtn = document.querySelector("#open-files");
const sampleBtn = document.querySelector("#load-sample");
const fitBtn = document.querySelector("#fit-view");
const slider = document.querySelector("#mesh-slider");
const meshRow = document.querySelector("#mesh-row");
const rowRow = document.querySelector("#row-row");
const colRow = document.querySelector("#col-row");
const rowSlider = document.querySelector("#row-slider");
const colSlider = document.querySelector("#col-slider");
const rowCountEl = document.querySelector("#row-count");
const colCountEl = document.querySelector("#col-count");
const labelEl = document.querySelector("#mesh-label");
const countEl = document.querySelector("#mesh-count");
const projectEl = document.querySelector("#project-name");
const statsEl = document.querySelector("#mesh-stats");
const statusEl = document.querySelector("#status");
const wireBtn = document.querySelector("#toggle-wire");
const shadeBtn = document.querySelector("#toggle-shade");
const overlayBtn = document.querySelector("#toggle-overlay");

const viewer = new MeshViewer(canvas);
let project = null;
let outputIndex = 0;
let knit = null;
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

function highlightColValue() {
  if (!knit || !colSlider.value || Number(colSlider.value) <= 0) return null;
  return knit.bound.columns[Number(colSlider.value) - 1] ?? null;
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
  overlayBtn.disabled = !current?.overlayFile && !current?.stitchFile && !knit;

  if (knit) {
    rowRow.classList.remove("hidden");
    colRow.classList.remove("hidden");
    rowSlider.max = String(knit.bound.rowMax);
    rowSlider.min = String(knit.bound.rowMin);
    rowSlider.disabled = knit.bound.rowMax <= knit.bound.rowMin;
    colSlider.max = String(knit.bound.columns.length);
    colSlider.min = "0";
    colSlider.disabled = knit.bound.columns.length < 1;
    const row = Number(rowSlider.value);
    const shown = knit.bound.stitches.filter((s) => s.row == null || s.row <= row).length;
    rowCountEl.textContent = `${row} / ${knit.bound.rowMax} · ${shown} st`;
    const col = highlightColValue();
    colCountEl.textContent =
      col == null ? `全部 All · ${knit.bound.columns.length}` : `col ${col}`;
  } else {
    rowRow.classList.add("hidden");
    colRow.classList.add("hidden");
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

async function loadKnit(output) {
  const stitchEntry = output.stitchFile || output.overlayFile;
  const mapEntry = output.readableMapFile;
  if (!stitchEntry || !mapEntry) return null;
  const [stitchText, mapText] = await Promise.all([loadText(stitchEntry), loadText(mapEntry)]);
  if (!stitchText || !mapText) return null;
  const parsed = parseColoredObj(stitchText);
  if (!parsed.faces.length) return null;
  const map = parseReadableMap(mapText);
  if (!map.cells.length) return null;
  const bound = bindStitchesToMap(parsed.faces, map);
  return { bound, stitchEntry, mapEntry };
}

function applyKnitFilters() {
  if (!knit) return;
  viewer.setGrowth(Number(rowSlider.value));
  viewer.setHighlightCol(highlightColValue());
  updateChrome();
}

async function showOutput(index, { fit = false } = {}) {
  if (!project) return;
  outputIndex = Math.min(Math.max(0, index), project.outputs.length - 1);
  const output = project.outputs[outputIndex];
  knit = null;
  setStatus("加载中 / Loading…");
  try {
    const meshGeom = await loadGeometry(output.meshFile);
    knit = await loadKnit(output);
    viewer.setWireframe(wireBtn.getAttribute("aria-pressed") === "true");
    viewer.setFlat(shadeBtn.getAttribute("aria-pressed") === "true");
    viewer.setShowOverlay(overlayBtn.getAttribute("aria-pressed") === "true");

    if (knit) {
      rowSlider.value = String(knit.bound.rowMax);
      colSlider.value = "0";
      viewer.setKnitView({
        bodyGeom: meshGeom,
        bound: knit.bound,
        maxRow: knit.bound.rowMax,
        highlightCol: null,
      });
      const mapped = knit.bound.stitches.filter((s) => s.row != null).length;
      statsEl.textContent = `${mapped} stitches · ${knit.bound.columns.length} cols · row ${knit.bound.rowMin}–${knit.bound.rowMax}`;
      setStatus("点按针迹可选列 · tap a stitch to solo its column");
    } else {
      const overlayGeom = output.overlayFile ? await loadGeometry(output.overlayFile) : null;
      viewer.setGeometries(meshGeom, overlayGeom);
      const pos = meshGeom.getAttribute("position");
      const faces = pos ? Math.round(pos.count / 3) : 0;
      statsEl.textContent = `${pos?.count ?? 0} vtx · ${faces} tri${
        overlayGeom ? " · overlay" : ""
      }`;
      setStatus("");
    }
    updateChrome();
    if (fit) viewer.fitToView();
  } catch (err) {
    statsEl.textContent = "";
    knit = null;
    updateChrome();
    setStatus(err.message || String(err), true);
  }
}

async function openEntries(entries) {
  if (!entries?.length) return;
  geomCache.clear();
  textCache.clear();
  knit = null;
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
    const res = await fetch(`${base}sample/manifest.json`);
    if (!res.ok) throw new Error("示例清单不可用 / Sample manifest missing");
    const data = await res.json();
    const paths = collectManifestRefs(data);
    const entries = [
      { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ];
    await Promise.all(
      paths.map(async (rel) => {
        const text = await fetch(`${base}sample/${rel}`).then((r) => {
          if (!r.ok) throw new Error(`缺少示例 / Missing sample ${rel}`);
          return r.text();
        });
        entries.push({ name: rel.split("/").pop(), path: `sample/${rel}`, text });
      }),
    );
    await openEntries(entries);
    if (!statusEl.classList.contains("error")) {
      setStatus("圆柱针迹 · 滑条看生长 / 点列看轨迹 · drag to orbit");
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

rowSlider.addEventListener("input", () => applyKnitFilters());
colSlider.addEventListener("input", () => applyKnitFilters());

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
  if (pointer.moved || !knit) return;
  const col = viewer.pickStitchCol(ev.clientX, ev.clientY);
  if (col == null) return;
  const idx = knit.bound.columns.indexOf(col);
  if (idx < 0) return;
  const next = Number(colSlider.value) === idx + 1 ? 0 : idx + 1;
  colSlider.value = String(next);
  applyKnitFilters();
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

updateChrome();
loadSample();
