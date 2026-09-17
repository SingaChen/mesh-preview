/** Cut-body display modes for the 底模 / Base control. */
export const BASE_MODES = ["off", "wire", "faces", "points"];

export function normalizeBaseMode(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return BASE_MODES.includes(v) ? v : "faces";
}
