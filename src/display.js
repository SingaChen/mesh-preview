/** Cut-body layers for the 底模 / Base multi-select. */
export const BASE_LAYER_KEYS = ["off", "wire", "faces", "points"];

export function defaultBaseLayers() {
  return { off: false, wire: false, faces: true, points: false };
}

export function hiddenBaseLayers() {
  return { off: true, wire: false, faces: false, points: false };
}

export function isBaseHidden(layers) {
  const s = normalizeBaseLayers(layers);
  return Boolean(s.off) || (!s.wire && !s.faces && !s.points);
}

export function normalizeBaseLayers(input) {
  if (typeof input === "string") {
    const v = input.trim().toLowerCase();
    if (v === "off") return hiddenBaseLayers();
    if (v === "wire") return { off: false, wire: true, faces: false, points: false };
    if (v === "points") return { off: false, wire: false, faces: false, points: true };
    return defaultBaseLayers();
  }
  if (!input || typeof input !== "object") return defaultBaseLayers();
  const wire = Boolean(input.wire);
  const faces = Boolean(input.faces);
  const points = Boolean(input.points);
  if (input.off || (!wire && !faces && !points)) return hiddenBaseLayers();
  return { off: false, wire, faces, points };
}

/** Off is exclusive. Checking a draw layer clears Off. Unchecking the last layer becomes Off. */
export function applyBaseChoice(state, layer, checked) {
  const key = String(layer ?? "").toLowerCase();
  if (key === "off") {
    return checked ? hiddenBaseLayers() : defaultBaseLayers();
  }
  if (key !== "wire" && key !== "faces" && key !== "points") {
    return normalizeBaseLayers(state);
  }
  const cur = normalizeBaseLayers(state);
  const next = { off: false, wire: cur.wire, faces: cur.faces, points: cur.points, [key]: Boolean(checked) };
  return normalizeBaseLayers(next);
}
