/**
 * SingaLab opened heat-cut mesh (`diagnostics/cut_heat_export.md`).
 *
 * `{name}_cut.obj` is `v x y z r g b` with RGB in [0, 1] (matplotlib turbo).
 * Optional `{name}_cut_phi.json` / `{name}_cut_phi.npy` store φ in OBJ `v` order.
 * Baked vertex colors win. φ is only used when those colors are missing, mapped
 * with the JSON `phi_min` / `phi_max` (t = 0 when the range is empty).
 *
 * Do not weld vertices by position. The cut seam keeps coincident duplicates
 * (48 pairs on the single-cylinder sample). Merging them closes the opening
 * and shifts φ off the `v` line it belongs to.
 */

const PHI_JSON_KEYS = ["phi", "heat", "values", "scalars", "vertex_heat"];

// Matplotlib `_cm_listed._turbo_data`, 256 RGB samples, little-endian float32.
const TURBO_B64 =
  "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";

export function isCutHeatMeshPath(filePath) {
  const norm = String(filePath || "").replaceAll("\\", "/");
  const name = norm.split("/").pop() || norm;
  // `{name}_cut.obj` only. `cut_iteration_0.obj` and stitch/field OBJs are not this mesh.
  return /_cut\.obj$/i.test(name);
}

export function isCutHeatScalarName(name) {
  return /_phi\.(json|npy)$/i.test(String(name || "").split("/").pop() || "");
}

/** Companion paths next to `dir/{name}_cut.obj`: `{name}_cut_phi.json`, then `.npy`. */
export function heatScalarRelPaths(objPath) {
  const norm = String(objPath || "").replaceAll("\\", "/").replace(/\.obj$/i, "");
  return [`${norm}_phi.json`, `${norm}_phi.npy`];
}

/** `{ phi, phiMin, phiMax }` or null. `phi_min` / `phi_max` stay null when the file omits them. */
export function parsePhiJson(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    return null;
  }
  const arr = phiArray(data);
  if (!arr) return null;
  const phi = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const n = Number(arr[i]);
    if (!Number.isFinite(n)) return null;
    phi[i] = n;
  }
  const range = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  return {
    phi,
    phiMin: finiteOrNull(range?.phi_min),
    phiMax: finiteOrNull(range?.phi_max),
    nVertices: Number.isInteger(range?.n_vertices) ? range.n_vertices : null,
  };
}

function phiArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  for (const key of PHI_JSON_KEYS) {
    if (Array.isArray(data[key])) return data[key];
  }
  return null;
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseNpy(input) {
  const bytes = asUint8(input);
  if (!bytes || bytes.length < 10) return null;
  if (bytes[0] !== 0x93 || bytes[1] !== 0x4e || bytes[2] !== 0x55 || bytes[3] !== 0x4d || bytes[4] !== 0x50 || bytes[5] !== 0x59) {
    return null;
  }
  const major = bytes[6];
  let headerLen = 0;
  let dataStart = 0;
  if (major === 1) {
    headerLen = bytes[8] | (bytes[9] << 8);
    dataStart = 10 + headerLen;
  } else if (major === 2 || major === 3) {
    if (bytes.length < 12) return null;
    headerLen = bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24);
    dataStart = 12 + headerLen;
  } else {
    return null;
  }
  if (headerLen <= 0 || dataStart > bytes.length) return null;
  const header = new TextDecoder("latin1").decode(bytes.subarray(dataStart - headerLen, dataStart));
  const descr = header.match(/['"]descr['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
  const shapeRaw = header.match(/['"]shape['"]\s*:\s*\(([^)]*)\)/)?.[1] ?? "";
  if (!descr) return null;
  const dims = shapeRaw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));
  if (!dims.length || dims.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const fortran = /['"]fortran_order['"]\s*:\s*True/.test(header);
  const wide = dims.filter((n) => n > 1);
  if (fortran && wide.length > 1) return null;
  const count = dims.reduce((prod, n) => prod * n, 1);
  const kind = descr.replace(/^[<>=|]/, "");
  const endian = descr[0] === ">" ? ">" : "<";
  const width = kind === "f8" ? 8 : kind === "f4" ? 4 : 0;
  if (!width) return null;
  if (dataStart + count * width > bytes.length) return null;
  const out = new Float64Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset + dataStart, count * width);
  const little = endian === "<";
  for (let i = 0; i < count; i++) {
    const n = width === 8 ? view.getFloat64(i * width, little) : view.getFloat32(i * width, little);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

/** Little-endian float64 .npy (version 1.0). Used for the sample and tests. */
export function encodeNpyFloat64(values) {
  const arr = values instanceof Float64Array ? values : Float64Array.from(values);
  let header = `{'descr': '<f8', 'fortran_order': False, 'shape': (${arr.length},), }`;
  const prefix = 10;
  const unpadded = prefix + header.length + 1;
  const pad = (64 - (unpadded % 64)) % 64;
  header = `${header}${" ".repeat(pad)}\n`;
  const out = new Uint8Array(prefix + header.length + arr.byteLength);
  out.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0], 0);
  out[8] = header.length & 255;
  out[9] = (header.length >> 8) & 255;
  for (let i = 0; i < header.length; i++) out[prefix + i] = header.charCodeAt(i);
  out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), prefix + header.length);
  return out;
}

let turboLut = null;

function matplotlibTurboLut() {
  if (turboLut) return turboLut;
  const bin = atob(TURBO_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  turboLut = new Float64Array(256 * 3);
  for (let i = 0; i < turboLut.length; i++) turboLut[i] = view.getFloat32(i * 4, true);
  return turboLut;
}

/** Matplotlib turbo, linearly interpolated on the frozen 256-sample LUT. t is clamped. */
export function turbo(x) {
  const lut = matplotlibTurboLut();
  const t = clamp01(x);
  const scaled = t * 255;
  const i = Math.min(255, Math.floor(scaled));
  const f = scaled - i;
  const j = Math.min(255, i + 1);
  return [
    (1 - f) * lut[i * 3] + f * lut[j * 3],
    (1 - f) * lut[i * 3 + 1] + f * lut[j * 3 + 1],
    (1 - f) * lut[i * 3 + 2] + f * lut[j * 3 + 2],
  ];
}

/**
 * Map φ to turbo RGB. Uses the given phi_min / phi_max when both are finite.
 * t is 0 when the span is empty or not finite; otherwise clip((φ-min)/(max-min), 0, 1).
 */
export function colorsFromPhi(phi, phiMin, phiMax) {
  let min = Number(phiMin);
  let max = Number(phiMax);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = Infinity;
    max = -Infinity;
    for (let i = 0; i < phi.length; i++) {
      const n = Number(phi[i]);
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  const span = max - min;
  const colors = new Float32Array(phi.length * 3);
  for (let i = 0; i < phi.length; i++) {
    const t = Number.isFinite(span) && span > 0 ? clamp01((Number(phi[i]) - min) / span) : 0;
    const [r, g, b] = turbo(t);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return { colors, min, max };
}

export function parseCutHeatObj(text) {
  const positions = [];
  const colorSlots = [];
  const vcs = [];
  const faces = [];

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("v ") || line.startsWith("v\t")) {
      const n = line.split(/\s+/).slice(1).map(Number);
      if (n.length < 3 || !n.slice(0, 3).every(Number.isFinite)) continue;
      positions.push(n[0], n[1], n[2]);
      if (n.length >= 6 && n.slice(3, 6).every(Number.isFinite)) colorSlots.push(normalizeRgb(n[3], n[4], n[5]));
      else colorSlots.push(null);
    } else if (line.startsWith("vc ") || line.startsWith("vc\t")) {
      const n = line.split(/\s+/).slice(1).map(Number);
      if (n.length >= 3 && n.slice(0, 3).every(Number.isFinite)) vcs.push(normalizeRgb(n[0], n[1], n[2]));
    } else if (line.startsWith("f ") || line.startsWith("f\t")) {
      const count = positions.length / 3;
      const idx = [];
      let bad = false;
      for (const tok of line.split(/\s+/).slice(1)) {
        const rawIndex = Number(tok.split("/")[0]);
        if (!Number.isInteger(rawIndex) || rawIndex === 0) {
          bad = true;
          break;
        }
        const index = rawIndex < 0 ? count + rawIndex : rawIndex - 1;
        if (index < 0 || index >= count) {
          bad = true;
          break;
        }
        idx.push(index);
      }
      if (!bad && idx.length >= 3) faces.push(idx);
    }
  }

  const vertexCount = positions.length / 3;
  if (vcs.length) {
    for (let i = 0; i < vertexCount; i++) {
      if (!colorSlots[i] && vcs[i]) colorSlots[i] = vcs[i];
    }
  }
  const colors = colorSlots.length === vertexCount && colorSlots.every(Boolean) ? new Float32Array(vertexCount * 3) : null;
  if (colors) {
    for (let i = 0; i < vertexCount; i++) {
      colors[i * 3] = colorSlots[i][0];
      colors[i * 3 + 1] = colorSlots[i][1];
      colors[i * 3 + 2] = colorSlots[i][2];
    }
  }
  return { positions: Float32Array.from(positions), colors, faces, vertexCount };
}

/**
 * Triangulated cut mesh. Vertices stay in OBJ order — positions are not welded.
 * `scalar` may be a φ array, or `{ phi, phiMin, phiMax }` from the JSON sidecar.
 * Baked `v` colors win. φ colors the mesh only when those channels are absent.
 * Returns `{ ok:false, reason }` when nothing can be colored — callers stay quiet.
 */
export function buildCutHeatMesh(objText, scalar) {
  let parsed;
  try {
    parsed = parseCutHeatObj(objText);
  } catch {
    return { ok: false, reason: "obj" };
  }
  if (!parsed.vertexCount || !parsed.faces.length) return { ok: false, reason: "empty" };

  const field = phiField(scalar);
  let source = null;
  let vertexColors = null;
  if (parsed.colors) {
    vertexColors = parsed.colors;
    source = "obj";
  } else if (field && usableScalar(field.phi, parsed.vertexCount)) {
    vertexColors = colorsFromPhi(field.phi, field.phiMin, field.phiMax).colors;
    source = "phi";
  } else {
    return { ok: false, reason: field ? "length" : "no-heat" };
  }

  let corners = 0;
  for (const face of parsed.faces) corners += (face.length - 2) * 3;
  const positions = new Float32Array(corners * 3);
  const colors = new Float32Array(corners * 3);
  let cursor = 0;
  for (const face of parsed.faces) {
    for (let k = 1; k < face.length - 1; k++) {
      const ids = [face[0], face[k], face[k + 1]];
      for (const id of ids) {
        positions[cursor] = parsed.positions[id * 3];
        colors[cursor] = vertexColors[id * 3];
        positions[cursor + 1] = parsed.positions[id * 3 + 1];
        colors[cursor + 1] = vertexColors[id * 3 + 1];
        positions[cursor + 2] = parsed.positions[id * 3 + 2];
        colors[cursor + 2] = vertexColors[id * 3 + 2];
        cursor += 3;
      }
    }
  }
  return {
    ok: true,
    source,
    vertexCount: parsed.vertexCount,
    triangleCount: corners / 3,
    positions,
    colors,
  };
}

function phiField(scalar) {
  if (!scalar) return null;
  if (typeof scalar.length === "number" && typeof scalar !== "string") {
    return { phi: scalar, phiMin: null, phiMax: null };
  }
  if (scalar.phi && typeof scalar.phi.length === "number") return scalar;
  return null;
}

function usableScalar(scalar, vertexCount) {
  if (!scalar || scalar.length !== vertexCount) return false;
  for (let i = 0; i < scalar.length; i++) {
    if (!Number.isFinite(Number(scalar[i]))) return false;
  }
  return true;
}

function normalizeRgb(r, g, b) {
  const scale = Math.max(r, g, b) > 1 ? 255 : 1;
  return [clamp01(r / scale), clamp01(g / scale), clamp01(b / scale)];
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function asUint8(input) {
  if (!input) return null;
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}
