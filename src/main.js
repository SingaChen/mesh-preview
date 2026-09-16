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

const canvas = document.querySelector("#viewport");
const folderInput = document.querySelector("#folder-input");
const filesInput = document.querySelector("#files-input");
const openFolderBtn = document.querySelector("#open-folder");
const openFilesBtn = document.querySelector("#open-files");
const sampleBtn = document.querySelector("#load-sample");
const fitBtn = document.querySelector("#fit-view");
const slider = document.querySelector("#mesh-slider");
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
const geomCache = new Map();

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", isError);
}

function pressed(btn, on) {
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function updateChrome() {
  const n = project?.outputs.length || 0;
  const current = project?.outputs[outputIndex];
  slider.max = String(Math.max(0, n - 1));
  slider.value = String(outputIndex);
  slider.disabled = n < 2;
  labelEl.textContent = current?.label || "—";
  countEl.textContent = n ? `${outputIndex + 1} / ${n}` : "0 / 0";
  projectEl.textContent = project
    ? `${project.name} · ${project.source === "manifest" ? "清单 manifest" : "自动发现 auto"}`
    : "未打开项目 / No project";
  overlayBtn.disabled = !current?.overlayFile;
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

async function showOutput(index, { fit = false } = {}) {
  if (!project) return;
  outputIndex = Math.min(Math.max(0, index), project.outputs.length - 1);
  const output = project.outputs[outputIndex];
  updateChrome();
  setStatus("加载中 / Loading…");
  try {
    const meshGeom = await loadGeometry(output.meshFile);
    const overlayGeom = output.overlayFile ? await loadGeometry(output.overlayFile) : null;
    viewer.setGeometries(meshGeom, overlayGeom);
    viewer.setWireframe(wireBtn.getAttribute("aria-pressed") === "true");
    viewer.setFlat(shadeBtn.getAttribute("aria-pressed") === "true");
    viewer.setShowOverlay(overlayBtn.getAttribute("aria-pressed") === "true");
    if (fit) viewer.fitToView();
    const pos = meshGeom.getAttribute("position");
    const faces = pos ? Math.round(pos.count / 3) : 0;
    statsEl.textContent = `${pos?.count ?? 0} vtx · ${faces} tri${
      overlayGeom ? " · overlay" : ""
    }`;
    setStatus("");
  } catch (err) {
    statsEl.textContent = "";
    setStatus(err.message || String(err), true);
  }
}

async function openEntries(entries) {
  if (!entries?.length) return;
  geomCache.clear();
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
    const paths = new Set();
    for (const out of data.outputs) {
      if (out.mesh) paths.add(out.mesh);
      if (out.overlay) paths.add(out.overlay);
    }
    const entries = [
      { name: "manifest.json", path: "sample/manifest.json", text: JSON.stringify(data) },
    ];
    await Promise.all(
      [...paths].map(async (rel) => {
        const text = await fetch(`${base}sample/${rel}`).then((r) => {
          if (!r.ok) throw new Error(`缺少示例 / Missing sample ${rel}`);
          return r.text();
        });
        entries.push({ name: rel, path: `sample/${rel}`, text });
      }),
    );
    await openEntries(entries);
    setStatus("示例已加载 · 单指旋转 / 双指缩放 / Sample ready · drag to orbit");
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
    // Fall through to the input picker (Android Chrome).
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

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

updateChrome();
loadSample();
