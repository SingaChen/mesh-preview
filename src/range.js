/**
 * SingaLab WholeGarmentKnitting Dynamic Controls — half-open [start, end).
 * Port of dependence/func_knitting.py helpers + display_models registry.
 */

export function normalizeHalfOpenSlider(value, nItems) {
  const n = Math.max(0, Number(nItems) || 0);
  let start = Number(value?.[0]);
  let end = Number(value?.[1]);
  if (!Number.isFinite(start)) start = 0;
  if (!Number.isFinite(end)) end = start + 1;
  start = Math.trunc(start);
  end = Math.trunc(end);
  if (start > end) [start, end] = [end, start];
  start = Math.max(0, Math.min(start, n));
  end = Math.max(0, Math.min(end, n));
  if (end <= start) {
    if (start >= n) {
      start = Math.max(0, n - 1);
      end = n;
    } else {
      end = start + 1;
    }
  }
  return [start, end];
}

export function formatHalfOpenRangeLabel(prefix, start, end, nItems) {
  if (end <= start) return `${prefix}: - / ${nItems}`;
  const last = end - 1;
  if (start === last) return `${prefix}: idx ${start} / ${nItems}`;
  return `${prefix}: idx ${start}-${last} / ${nItems}`;
}

export function formatDisplayModelsLabel(start, end, models) {
  const n = models.length;
  const base = formatHalfOpenRangeLabel("display_models", start, end, n);
  if (end <= start || end - 1 >= n) return base;
  const name = models[end - 1]?.name || "?";
  return `${base} | right=${name}`;
}

export function sliceHalfOpen(items, start, end) {
  const n = items.length;
  if (!n) return [];
  const [s, e] = normalizeHalfOpenSlider([start, end], n);
  return items.slice(s, e);
}

export function activeRingIndex(ringStart, ringEnd) {
  const s = Number(ringStart);
  const e = Number(ringEnd);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return e - 1;
}

/** Earlier rings in [r0, r1-1) stay full; active ring r1-1 uses [t0, t1). */
export function stitchesVisibleForSliders(stitches, ringStart, ringEnd, termStart, termEnd) {
  const active = activeRingIndex(ringStart, ringEnd);
  if (active == null) return [];
  const t0 = Number(termStart);
  const t1 = Number(termEnd);
  return (stitches || []).filter((s) => {
    if (s.ring == null || !Number.isFinite(s.ring)) return false;
    if (s.ring < ringStart || s.ring >= ringEnd) return false;
    if (s.ring < active) return true;
    const t = s.termInRing;
    if (t == null || !Number.isFinite(t)) return false;
    return t >= t0 && t < t1;
  });
}

export function facesRingSliderN(entry) {
  if (Array.isArray(entry?.rowChunks)) return entry.rowChunks.length;
  if (Array.isArray(entry?.faceChunks)) return entry.faceChunks.length;
  return 0;
}

export function isFacesRingBindable(entry) {
  return entry?.kind === "faces_ring" && facesRingSliderN(entry) >= 0 && (entry.rowChunks != null || entry.faceChunks != null);
}

export function registerDisplayModel(models, entry) {
  const rec = {
    item: entry.item ?? entry,
    kind: entry.kind,
    faceChunks: entry.faceChunks ?? entry.face_chunks ?? null,
    rowChunks: entry.rowChunks ?? entry.row_chunks ?? null,
    name: entry.name || entry.kind,
  };

  if (rec.kind === "faces_ring" && rec.name) {
    const idx = models.findIndex((old) => old.kind === "faces_ring" && old.name === rec.name);
    if (idx >= 0) {
      models[idx] = rec;
      return models;
    }
    models.push(rec);
    return models;
  }

  if (rec.kind === "cols_resample") {
    models.splice(0, 0, rec);
    return models;
  }

  models.push(rec);
  return models;
}

/**
 * Visibility + faces_ring binding for display_models [start, end).
 * When the rightmost visible model is a faces_ring with row/face chunks,
 * bind the row slider; otherwise clear. Rebind (reset row range) only if
 * the rightmost item changed.
 */
export function applyDisplayModelsRange(models, start, end, prevFacesItem = null) {
  const n = models.length;
  if (!n) {
    return {
      start: 0,
      end: 0,
      visibility: [],
      bind: null,
      clear: true,
      resetRange: false,
      rightmostIdx: null,
    };
  }

  const [s, e] = normalizeHalfOpenSlider([start, end], n);
  const rightmostIdx = e > s ? e - 1 : null;
  const visibility = models.map((_, i) => s <= i && i < e);

  let bind = null;
  let clear = false;
  let resetRange = false;

  if (rightmostIdx != null) {
    const rightmost = models[rightmostIdx];
    if (isFacesRingBindable(rightmost)) {
      bind = rightmost;
      resetRange = rightmost.item !== prevFacesItem;
    } else {
      clear = true;
    }
  } else {
    clear = true;
  }

  return { start: s, end: e, visibility, bind, clear, resetRange, rightmostIdx };
}
