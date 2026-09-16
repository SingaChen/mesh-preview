import { normalizeHalfOpenSlider } from "./range.js";

/**
 * Two stacked <input type="range"> thumbs on one track.
 * Values are half-open [start, end) with end >= start + 1.
 */
export function bindDualRange(root, { onChange } = {}) {
  const startEl = root.querySelector(".dual-start");
  const endEl = root.querySelector(".dual-end");
  const fill = root.querySelector(".dual-fill");
  let n = 1;
  let start = 0;
  let end = 1;
  let enabled = true;
  let emit = onChange || (() => {});

  function paint() {
    startEl.min = "0";
    endEl.min = "0";
    startEl.max = String(n);
    endEl.max = String(n);
    startEl.value = String(start);
    endEl.value = String(end);
    const denom = n || 1;
    if (fill) {
      fill.style.left = `${(start / denom) * 100}%`;
      fill.style.width = `${((end - start) / denom) * 100}%`;
    }
    startEl.disabled = !enabled || n < 1;
    endEl.disabled = !enabled || n < 1;
    root.classList.toggle("disabled", !enabled || n < 1);
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-valuemax", String(n));
    root.setAttribute("aria-valuetext", `${start}–${end}`);
  }

  function apply(nextStart, nextEnd, notify) {
    const [s, e] = normalizeHalfOpenSlider([nextStart, nextEnd], n);
    const changed = s !== start || e !== end;
    start = s;
    end = e;
    paint();
    if (notify && changed) emit({ start, end, n });
  }

  function nearestThumb(clientX) {
    const rect = root.getBoundingClientRect();
    const t = rect.width ? (clientX - rect.left) / rect.width : 0;
    const startPos = n ? start / n : 0;
    const endPos = n ? end / n : 1;
    return Math.abs(t - startPos) <= Math.abs(t - endPos) ? "start" : "end";
  }

  function raise(which) {
    startEl.style.zIndex = which === "start" ? "4" : "3";
    endEl.style.zIndex = which === "end" ? "4" : "3";
  }

  root.addEventListener("pointerdown", (ev) => {
    raise(nearestThumb(ev.clientX));
  });

  startEl.addEventListener("input", () => apply(Number(startEl.value), end, true));
  endEl.addEventListener("input", () => apply(start, Number(endEl.value), true));

  paint();

  return {
    get value() {
      return [start, end];
    },
    get n() {
      return n;
    },
    setEnabled(on) {
      enabled = Boolean(on);
      paint();
    },
    configure(nItems, range, { notify = false } = {}) {
      n = Math.max(0, Number(nItems) || 0);
      const fallback = n ? [0, n] : [0, 0];
      const next = range && range.length === 2 ? range : fallback;
      apply(next[0], n ? next[1] : 0, notify);
      if (!notify) paint();
    },
    setOnChange(fn) {
      emit = fn || (() => {});
    },
  };
}

export function dualRangeMarkup() {
  return `<div class="dual-range" role="group">
      <div class="dual-track"><div class="dual-fill"></div></div>
      <input class="dual-start" type="range" min="0" max="1" value="0" step="1" aria-label="start" />
      <input class="dual-end" type="range" min="0" max="1" value="1" step="1" aria-label="end" />
    </div>`;
}
