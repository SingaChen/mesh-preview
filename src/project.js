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

export function isXlsName(name) {
  return /\.xlsx?$/i.test(basename(name));
}

export function isColsResampleXlsName(name) {
  const base = basename(name);
  return isXlsName(base) && /cols_resample/i.test(base) && !/first_rows/i.test(base);
}

export function isColsResampleJsonName(name) {
  const base = basename(name);
  return /\.json$/i.test(base) && /cols_resample/i.test(base) && !/manifest/i.test(base);
}

export function isFirstRowsXlsName(name) {
  const base = basename(name);
  return isXlsName(base) && /first_rows/i.test(base);
}

export function isFacesRingLayoutName(name) {
  const base = basename(name);
  return /\.json$/i.test(base) && /faces_ring_layout/i.test(base);
}

export function isStitchMapBindName(name) {
  const base = basename(name);
  return /\.json$/i.test(base) && /stitch_map_bind/i.test(base);
}

export function isExcelReadableMapName(name) {
  const base = basename(name);
  return isXlsName(base) && /readable_map|step[34]/i.test(base) && !/cols_resample|first_rows/i.test(base);
}

export function isTxtReadableMapName(name) {
  const base = basename(name);
  return /\.txt$/i.test(base) && /readable_map/i.test(base);
}

export function indexFiles(entries) {
  const byPath = new Map();
  const byName = new Map();
  const objs = [];
  const jsons = [];
  const txts = [];
  const xls = [];

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
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) xls.push(rec);
  }

  objs.sort((a, b) => naturalCompare(a.path, b.path));
  jsons.sort((a, b) => naturalCompare(a.path, b.path));
  txts.sort((a, b) => naturalCompare(a.path, b.path));
  xls.sort((a, b) => naturalCompare(a.path, b.path));
  return { byPath, byName, objs, jsons, txts, xls };
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
    const overlayRef = raw.overlay;
    const overlayFile = overlayRef ? lookup(index, overlayRef, fromDir) : null;
    if (overlayRef && !overlayFile) {
      warnings.push(`缺少叠加 / Missing overlay: ${overlayRef}`);
    }
    const colsRef = raw.colsResample || raw.cols_resample || raw.field;
    const colsXlsRef = raw.colsResampleXls || raw.cols_resample_xls;
    const colsJsonRef = raw.colsResampleJson || raw.cols_resample_json;
    const colsResampleFile = colsRef
      ? lookup(index, colsRef, fromDir)
      : findColsResampleField(index, meshFile);
    const colsResampleXlsFile = colsXlsRef
      ? lookup(index, colsXlsRef, fromDir)
      : isXlsName(colsRef || "")
        ? colsResampleFile
        : findColsResampleXls(index, meshFile);
    const colsResampleJsonFile = colsJsonRef
      ? lookup(index, colsJsonRef, fromDir)
      : findColsResampleJson(index, meshFile);
    if (colsRef && !colsResampleFile) {
      warnings.push(`缺少列场 / Missing cols_resample: ${colsRef}`);
    }
    if (colsXlsRef && !colsResampleXlsFile) {
      warnings.push(`缺少列表 / Missing cols_resample xls: ${colsXlsRef}`);
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
    const mapTxtRef = raw.readableMapTxt || raw.readable_map_txt;
    const readableMapTxtFile = mapTxtRef
      ? lookup(index, mapTxtRef, fromDir)
      : findReadableMapTxt(index, meshFile);
    if (mapTxtRef && !readableMapTxtFile) {
      warnings.push(`缺少生长图 txt / Missing readable_map txt: ${mapTxtRef}`);
    }
    const firstRowsRef = raw.firstRows || raw.first_rows;
    const firstRowsFile = firstRowsRef
      ? lookup(index, firstRowsRef, fromDir)
      : findFirstRowsXls(index, meshFile);
    const layoutRef = raw.facesRingLayout || raw.faces_ring_layout;
    const facesRingLayoutFile = layoutRef
      ? lookup(index, layoutRef, fromDir)
      : findFacesRingLayout(index, meshFile);
    if (firstRowsRef && !firstRowsFile) {
      warnings.push(`缺少 first_rows / Missing first_rows: ${firstRowsRef}`);
    }
    if (layoutRef && !facesRingLayoutFile) {
      warnings.push(`缺少环布局 / Missing faces_ring_layout: ${layoutRef}`);
    }
    const bindRef = raw.stitchMapBind || raw.stitch_map_bind;
    const stitchMapBindFile = bindRef
      ? lookup(index, bindRef, fromDir)
      : findStitchMapBind(index, meshFile);
    if (bindRef && !stitchMapBindFile) {
      warnings.push(`缺少针迹绑定 / Missing stitch_map_bind: ${bindRef}`);
    }
    outputs.push({
      label: raw.label || basename(meshFile.path),
      meshFile,
      overlayFile,
      colsResampleFile,
      colsResampleXlsFile,
      colsResampleJsonFile,
      stitchFile,
      readableMapFile,
      readableMapTxtFile,
      firstRowsFile,
      facesRingLayoutFile,
      stitchMapBindFile,
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
      colsResampleFile: findColsResampleField(index, meshFile),
      colsResampleXlsFile: findColsResampleXls(index, meshFile),
      colsResampleJsonFile: findColsResampleJson(index, meshFile),
      stitchFile: findStitchFile(index, meshFile) || overlayFile,
      readableMapFile: findReadableMap(index, meshFile),
      readableMapTxtFile: findReadableMapTxt(index, meshFile),
      firstRowsFile: findFirstRowsXls(index, meshFile),
      facesRingLayoutFile: findFacesRingLayout(index, meshFile),
      stitchMapBindFile: findStitchMapBind(index, meshFile),
    };
  });

  return {
    name: inferProjectName(index),
    source: "discovery",
    outputs,
    warnings: [],
  };
}

function findColsResampleField(index, meshFile) {
  const fields = index.objs.filter((f) => /cols_resample_field/i.test(f.name));
  if (!fields.length) return null;
  return matchOverlay(meshFile, fields) || fields[0];
}

function findColsResampleXls(index, meshFile) {
  const files = (index.xls || []).filter((f) => isColsResampleXlsName(f.name));
  if (!files.length) return null;
  return matchOverlay(meshFile, files) || files[0];
}

function findColsResampleJson(index, meshFile) {
  const files = (index.jsons || []).filter((f) => isColsResampleJsonName(f.name));
  if (!files.length) return null;
  return matchOverlay(meshFile, files) || files[0];
}

function findFirstRowsXls(index, meshFile) {
  const files = (index.xls || []).filter((f) => isFirstRowsXlsName(f.name));
  if (!files.length) return null;
  return matchOverlay(meshFile, files) || files[0];
}

function findFacesRingLayout(index, meshFile) {
  const files = (index.jsons || []).filter((f) => isFacesRingLayoutName(f.name));
  if (!files.length) return null;
  return matchOverlay(meshFile, files) || files[0];
}

function findStitchMapBind(index, meshFile) {
  const files = (index.jsons || []).filter((f) => isStitchMapBindName(f.name));
  if (!files.length) return null;
  return matchOverlay(meshFile, files) || files[0];
}

function findStitchFile(index, meshFile) {
  const stitches = index.objs.filter((f) => /knittingstitches/i.test(f.name));
  if (!stitches.length) return null;
  return matchOverlay(meshFile, stitches) || stitches[0];
}

function pickIterFile(files, meshFile) {
  if (!files.length) return null;
  const iter = meshFile?.name.match(/iteration[_\-]?(\d+)/i)?.[1];
  if (iter != null) {
    const hit = files.find(
      (m) => m.name.includes(`iteration_${iter}`) || m.name.includes(`iteration_${iter.padStart?.(2, "0")}`),
    );
    if (hit) return hit;
  }
  return files[0];
}

function excelReadableMapRank(name) {
  const n = String(name || "");
  if (/step4/i.test(n) && /beds/i.test(n)) return 4;
  if (/step4/i.test(n)) return 3;
  if (/step3/i.test(n) && /xfer/i.test(n)) return 2;
  if (/step3/i.test(n)) return 1;
  return 0;
}

function findReadableMap(index, meshFile) {
  const xlsMaps = (index.xls || []).filter((f) => isExcelReadableMapName(f.name));
  const preferred =
    [...xlsMaps].sort(
      (a, b) => excelReadableMapRank(b.name) - excelReadableMapRank(a.name) || naturalCompare(a.name, b.name),
    )[0] || pickIterFile(xlsMaps, meshFile);
  if (preferred) return preferred;
  return findReadableMapTxt(index, meshFile);
}

function findReadableMapTxt(index, meshFile) {
  const maps = (index.txts || []).filter((f) => isTxtReadableMapName(f.name));
  const classic = maps.find((f) => /readable_map\.txt$/i.test(f.name) && !/step[34]/i.test(f.name));
  return classic || pickIterFile(maps, meshFile);
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

export async function readEntryBuffer(entry) {
  if (!entry) return null;
  if (entry.buffer) {
    if (entry.buffer instanceof ArrayBuffer) return entry.buffer;
    if (ArrayBuffer.isView(entry.buffer)) {
      return entry.buffer.buffer.slice(
        entry.buffer.byteOffset,
        entry.buffer.byteOffset + entry.buffer.byteLength,
      );
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(entry.buffer)) {
      return entry.buffer.buffer.slice(entry.buffer.byteOffset, entry.buffer.byteOffset + entry.buffer.byteLength);
    }
  }
  if (entry.file && typeof entry.file.arrayBuffer === "function") return entry.file.arrayBuffer();
  throw new Error(`无法读取二进制 / Cannot read bytes ${entry.name || entry.path}`);
}
