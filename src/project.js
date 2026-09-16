const OVERLAY_RE = /overlay|field|stitch|knittingstitches|readable_map|cols_resample|_type\.obj/i;

export function isOverlayName(name) {
  return OVERLAY_RE.test(basename(name));
}

export function basename(path) {
  const normalized = String(path).replaceAll("\\", "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

export function normalizePath(path) {
  return String(path)
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function indexFiles(entries) {
  const byPath = new Map();
  const byName = new Map();
  const objs = [];
  const jsons = [];
  const txts = [];

  for (const entry of entries) {
    const path = normalizePath(entry.path || entry.name);
    const name = basename(path);
    const rec = { ...entry, path, name };
    byPath.set(path.toLowerCase(), rec);
    byName.set(name.toLowerCase(), rec);
    const lower = name.toLowerCase();
    if (lower.endsWith(".obj")) objs.push(rec);
    if (lower.endsWith(".json")) jsons.push(rec);
    if (lower.endsWith(".txt")) txts.push(rec);
  }

  objs.sort((a, b) => naturalCompare(a.path, b.path));
  jsons.sort((a, b) => naturalCompare(a.path, b.path));
  txts.sort((a, b) => naturalCompare(a.path, b.path));
  return { byPath, byName, objs, jsons, txts };
}

function lookup(index, ref, fromDir = "") {
  if (!ref) return null;
  const rel = normalizePath(fromDir ? `${fromDir}/${ref}` : ref);
  return (
    index.byPath.get(rel.toLowerCase()) ||
    index.byPath.get(normalizePath(ref).toLowerCase()) ||
    index.byName.get(basename(ref).toLowerCase()) ||
    null
  );
}

function parentDir(path) {
  const norm = normalizePath(path);
  const i = norm.lastIndexOf("/");
  return i === -1 ? "" : norm.slice(0, i);
}

export function isManifestShape(data) {
  return Boolean(data && typeof data === "object" && Array.isArray(data.outputs));
}

export function projectFromManifest(data, index, manifestPath = "") {
  if (!isManifestShape(data)) {
    throw new Error("清单缺少 outputs 数组 / Manifest is missing outputs[]");
  }
  const fromDir = parentDir(manifestPath);
  const outputs = [];
  const warnings = [];

  for (const raw of data.outputs) {
    if (!raw || typeof raw !== "object") continue;
    const meshRef = raw.mesh || raw.obj || raw.path;
    const meshFile = lookup(index, meshRef, fromDir);
    if (!meshFile) {
      warnings.push(`缺少网格 / Missing mesh: ${meshRef || "(empty)"}`);
      continue;
    }
    const overlayRef = raw.overlay || raw.field;
    const overlayFile = overlayRef ? lookup(index, overlayRef, fromDir) : null;
    if (overlayRef && !overlayFile) {
      warnings.push(`缺少叠加 / Missing overlay: ${overlayRef}`);
    }
    const stitchRef = raw.stitches || raw.stitch;
    const stitchFile = stitchRef
      ? lookup(index, stitchRef, fromDir)
      : findStitchFile(index, meshFile);
    const mapRef = raw.readableMap || raw.map;
    const readableMapFile = mapRef
      ? lookup(index, mapRef, fromDir)
      : findReadableMap(index, meshFile);
    if (mapRef && !readableMapFile) {
      warnings.push(`缺少生长图 / Missing readable_map: ${mapRef}`);
    }
    outputs.push({
      label: raw.label || basename(meshFile.path),
      meshFile,
      overlayFile,
      stitchFile,
      readableMapFile,
    });
  }

  if (!outputs.length) {
    throw new Error("清单没有可用的 OBJ / Manifest has no resolvable OBJ meshes");
  }

  return {
    name: data.name || "project",
    source: "manifest",
    outputs,
    warnings,
  };
}

export function projectFromDiscovery(index) {
  const meshes = index.objs.filter((f) => !isOverlayName(f.name));
  const overlays = index.objs.filter((f) => isOverlayName(f.name));
  const list = meshes.length ? meshes : index.objs;

  if (!list.length) {
    throw new Error("未找到 OBJ / No .obj files in the selection");
  }

  const outputs = list.map((meshFile) => {
    const overlayFile =
      matchOverlay(meshFile, overlays) || (overlays.length === 1 ? overlays[0] : null);
    return {
      label: prettyLabel(meshFile.name),
      meshFile,
      overlayFile,
      stitchFile: findStitchFile(index, meshFile) || overlayFile,
      readableMapFile: findReadableMap(index, meshFile),
    };
  });

  return {
    name: inferProjectName(index),
    source: "discovery",
    outputs,
    warnings: [],
  };
}

function findStitchFile(index, meshFile) {
  const stitches = index.objs.filter((f) => /knittingstitches/i.test(f.name));
  if (!stitches.length) return null;
  return matchOverlay(meshFile, stitches) || stitches[0];
}

function findReadableMap(index, meshFile) {
  const maps = (index.txts || []).filter((f) => /readable_map/i.test(f.name));
  if (!maps.length) return null;
  const iter = meshFile?.name.match(/iteration[_\-]?(\d+)/i)?.[1];
  if (iter != null) {
    const hit = maps.find((m) => m.name.includes(`iteration_${iter}`) || m.name.includes(`iteration_${iter.padStart?.(2, "0")}`));
    if (hit) return hit;
  }
  return maps[0];
}

function matchOverlay(meshFile, overlays) {
  const iter = meshFile.name.match(/iteration[_\-]?(\d+)/i)?.[1];
  if (iter == null) return null;
  return (
    overlays.find((o) => {
      const oi = o.name.match(/iteration[_\-]?(\d+)/i)?.[1];
      return oi === iter;
    }) || null
  );
}

function prettyLabel(name) {
  return name.replace(/\.obj$/i, "").replaceAll("_", " ");
}

function inferProjectName(index) {
  const first = index.objs[0];
  if (!first) return "files";
  const top = first.path.split("/")[0];
  if (top && top !== first.name) return top;
  return "files";
}

export async function readEntryText(entry) {
  if (typeof entry.text === "string") return entry.text;
  if (entry.file && typeof entry.file.text === "function") return entry.file.text();
  throw new Error(`无法读取 / Cannot read ${entry.name || entry.path}`);
}
