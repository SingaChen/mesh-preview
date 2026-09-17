/**
 * Keep PerspectiveCamera.aspect in sync with the canvas CSS box.
 * A stale aspect (constructor default 1, or only window.resize) plus
 * CSS stretching the drawing buffer makes the cylinder look squashed.
 */

export function displayedSize(el) {
  if (!el) return { width: 1, height: 1 };
  const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
  const width = Math.max(1, Math.round(Number(rect?.width) || Number(el.clientWidth) || 0));
  const height = Math.max(1, Math.round(Number(rect?.height) || Number(el.clientHeight) || 0));
  return { width, height };
}

export function aspectFromSize(width, height) {
  return Math.max(1, Number(width) || 1) / Math.max(1, Number(height) || 1);
}

export function drawingMatchesDisplay(bufferWidth, bufferHeight, cssWidth, cssHeight, pixelRatio = 1) {
  const pr = Number(pixelRatio) || 1;
  return (
    Math.round(Number(bufferWidth) || 0) === Math.round((Number(cssWidth) || 0) * pr) &&
    Math.round(Number(bufferHeight) || 0) === Math.round((Number(cssHeight) || 0) * pr)
  );
}

export function needsViewportSync({ cssWidth, cssHeight, aspect, bufferWidth, bufferHeight, pixelRatio }) {
  const nextAspect = aspectFromSize(cssWidth, cssHeight);
  if (!Number.isFinite(aspect) || Math.abs(aspect - nextAspect) > 1e-6) return true;
  return !drawingMatchesDisplay(bufferWidth, bufferHeight, cssWidth, cssHeight, pixelRatio);
}
