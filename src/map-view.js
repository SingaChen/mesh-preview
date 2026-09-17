import { isTransferDir } from "./excel-map.js";
import { cellFill } from "./readable-map.js";

const CELL = 22;
const LABEL_W = 44;
const HEAD_H = 20;
const XFER_H = 10;
const PAD = 12;
/** Same slop as the 3D canvas: only treat pointerup as a click if movement is small. */
export const MAP_CLICK_SLOP = 8;
export const MAP_CELL = CELL;
export const MAP_LABEL_W = LABEL_W;
export const MAP_HEAD_H = HEAD_H;

function gridCellHit(grid, row, col) {
  const rr = row - (grid.rowMin || 0);
  const cc = col - grid.colMin;
  const cell = grid.grid?.[rr]?.[cc] || null;
  const meta = grid.rows?.[rr] || grid.rows?.find((rowMeta) => rowMeta.row === row);
  return {
    row,
    col,
    cell,
    dir: cell?.dir || meta?.dir || null,
  };
}

/** Content-space hit → {row, col, cell, dir} or null (header / label / outside). */
export function hitTestContent(grid, x, y, { excel = false, rowY = null } = {}) {
  if (!grid?.nRows || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < LABEL_W || y < HEAD_H) return null;
  const col = grid.colMin + Math.floor((x - LABEL_W) / CELL);
  if (col < grid.colMin || col > grid.colMax) return null;
  const isExcel = excel || grid.theme === "excel" || grid.source === "excel";
  if (isExcel) {
    const row = grid.rowMin + Math.floor((y - HEAD_H) / CELL);
    if (row < grid.rowMin || row > grid.rowMax) return null;
    return gridCellHit(grid, row, col);
  }
  for (let r = 0; r < grid.nRows; r++) {
    const row = grid.rowMin + r;
    const y0 = typeof rowY === "function" ? rowY(row) : HEAD_H + (row - grid.rowMin) * CELL;
    if (y >= y0 && y < y0 + CELL) return gridCellHit(grid, row, col);
  }
  return null;
}

/** Shift pan so a content-space rect stays inside the CSS view. */
export function panToKeepRectVisible({
  tx,
  ty,
  scale,
  viewW,
  viewH,
  minX,
  minY,
  maxX,
  maxY,
  pad = PAD,
}) {
  const s = Math.max(Number(scale) || 1, 0.01);
  const w = Math.max(1, Number(viewW) || 1);
  const h = Math.max(1, Number(viewH) || 1);
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  let nextTx = tx;
  let nextTy = ty;
  if (boxW * s >= innerW) nextTx = w / 2 - ((minX + maxX) / 2) * s;
  else {
    const left = pad - minX * s;
    const right = w - pad - maxX * s;
    if (nextTx < left) nextTx = left;
    else if (nextTx > right) nextTx = right;
  }
  if (boxH * s >= innerH) nextTy = h / 2 - ((minY + maxY) / 2) * s;
  else {
    const top = pad - minY * s;
    const bottom = h - pad - maxY * s;
    if (nextTy < top) nextTy = top;
    else if (nextTy > bottom) nextTy = bottom;
  }
  return { tx: nextTx, ty: nextTy };
}

export class ReadableMapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = null;
    this.highlight = new Set();
    this.pickHighlight = new Set();
    this._ensureKeys = null;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this._cssW = 0;
    this._cssH = 0;
    this._pointers = new Map();
    this._pinch = null;
    this._panning = null;
    this._pick = null;
    this._pinched = false;
    this.onCellPick = null;
    this._dirty = true;
    this._raf = 0;

    this._onWheel = (ev) => this._wheel(ev);
    this._onDown = (ev) => this._pointerDown(ev);
    this._onMove = (ev) => this._pointerMove(ev);
    this._onUp = (ev) => this._pointerUp(ev);
    this._onCancel = (ev) => this._pointerUp(ev);
    this._onResize = () => this.resize();

    canvas.addEventListener("wheel", this._onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this._onDown);
    canvas.addEventListener("pointermove", this._onMove);
    canvas.addEventListener("pointerup", this._onUp);
    canvas.addEventListener("pointercancel", this._onCancel);
    canvas.addEventListener("lostpointercapture", this._onCancel);
    window.addEventListener("resize", this._onResize);
    this._ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
    this._ro?.observe(canvas);
    this.resize();
    this._loop();
  }

  setGrid(grid) {
    this.grid = grid;
    this.highlight = new Set();
    this.pickHighlight = new Set();
    this._ensureKeys = null;
    this.resize();
    this.fit();
  }

  setHighlight(keys) {
    this.highlight = keys instanceof Set ? keys : new Set(keys || []);
    this._dirty = true;
  }

  setPickHighlight(keys) {
    this.pickHighlight = keys instanceof Set ? keys : new Set(keys || []);
    this._dirty = true;
  }

  ensureVisible(keys) {
    const set = keys instanceof Set ? keys : new Set(keys || []);
    this._ensureKeys = set.size ? set : null;
    this._applyEnsureVisible();
  }

  _cellContentRect(row, col) {
    return {
      x: LABEL_W + (col - this.grid.colMin) * CELL,
      y: this._rowY(row),
      w: CELL,
      h: CELL,
    };
  }

  _applyEnsureVisible() {
    const g = this.grid;
    const keys = this._ensureKeys;
    if (!g?.nRows || !keys?.size || this._cssW < 16 || this._cssH < 16) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const key of keys) {
      const [rs, cs] = String(key).split(",");
      const row = Number(rs);
      const col = Number(cs);
      if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
      const r = this._cellContentRect(row, col);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    if (!Number.isFinite(minX)) return;
    const next = panToKeepRectVisible({
      tx: this.tx,
      ty: this.ty,
      scale: this.scale,
      viewW: this._cssW,
      viewH: this._cssH,
      minX,
      minY,
      maxX,
      maxY,
      pad: PAD,
    });
    if (next.tx !== this.tx || next.ty !== this.ty) {
      this.tx = next.tx;
      this.ty = next.ty;
      this._dirty = true;
    }
  }

  clear() {
    this.grid = null;
    this.highlight = new Set();
    this.pickHighlight = new Set();
    this._ensureKeys = null;
    this._dirty = true;
  }

  isExcel() {
    return this.grid?.theme === "excel" || this.grid?.source === "excel";
  }

  contentSize() {
    const g = this.grid;
    if (!g?.nRows) return { w: 0, h: 0 };
    if (this.isExcel()) {
      return {
        w: LABEL_W + g.nCols * CELL,
        h: HEAD_H + g.nRows * CELL,
      };
    }
    const xferRows = new Set((g.xfers || []).map((x) => x.row)).size;
    return {
      w: LABEL_W + g.nCols * CELL,
      h: HEAD_H + g.nRows * CELL + xferRows * XFER_H,
    };
  }

  fit({ overview = false } = {}) {
    const { w, h } = this.contentSize();
    const cssW = Math.max(1, this._cssW);
    const cssH = Math.max(1, this._cssH);
    if (!w || !h) {
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this._dirty = true;
      return;
    }
    const widthScale = (cssW - PAD * 2) / w;
    const heightScale = (cssH - PAD * 2) / h;
    if (overview) {
      this.scale = Math.max(0.2, Math.min(widthScale, heightScale, 2.4));
      this.tx = (cssW - w * this.scale) / 2;
      this.ty = (cssH - h * this.scale) / 2;
    } else {
      this.scale = Math.max(0.85, Math.min(widthScale, 2.4));
      this.tx = Math.max(PAD, (cssW - w * this.scale) / 2);
      this.ty = PAD;
    }
    this._dirty = true;
  }

  zoomBy(factor, cx, cy) {
    const next = Math.min(6, Math.max(0.2, this.scale * factor));
    const k = next / this.scale;
    this.tx = cx - (cx - this.tx) * k;
    this.ty = cy - (cy - this.ty) * k;
    this.scale = next;
    this._dirty = true;
  }

  resize() {
    const cssW = Math.max(1, Math.round(this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 1));
    const cssH = Math.max(1, Math.round(this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 1));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this._cssW = cssW;
    this._cssH = cssH;
    this._dirty = true;
    this._applyEnsureVisible();
  }

  _loop = () => {
    this._raf = requestAnimationFrame(this._loop);
    if (this.canvas.clientWidth !== this._cssW || this.canvas.clientHeight !== this._cssH) this.resize();
    if (!this._dirty) return;
    this._draw();
    this._dirty = false;
  };

  _rowY(row) {
    const g = this.grid;
    const rr = row - g.rowMin;
    if (this.isExcel()) return HEAD_H + rr * CELL;
    let extra = 0;
    const seen = new Set();
    for (const x of g.xfers || []) {
      if (x.row < row && !seen.has(x.row)) {
        seen.add(x.row);
        extra += XFER_H;
      }
    }
    return HEAD_H + rr * CELL + extra;
  }

  _paintPick(ctx, x, y, picked, highlighted) {
    if (picked) {
      ctx.fillStyle = "rgba(94, 234, 212, 0.32)";
      ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      ctx.strokeStyle = "#5eead4";
      ctx.lineWidth = 2.6;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.2, y + 3.2, CELL - 6.4, CELL - 6.4);
    } else if (highlighted) {
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 1.2, y + 1.2, CELL - 2.4, CELL - 2.4);
    }
  }

  _drawExcel() {
    const ctx = this.ctx;
    const g = this.grid;
    ctx.save();
    ctx.translate(this.tx, this.ty);
    ctx.scale(this.scale, this.scale);

    ctx.font = "10px Calibri, 'Segoe UI', ui-sans-serif, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const headerFill = "#e7e6e6";
    const gridLine = "#b4b4b4";
    const labelInk = "#333333";

    ctx.fillStyle = headerFill;
    ctx.fillRect(0, 0, LABEL_W, HEAD_H);
    ctx.strokeStyle = gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, LABEL_W - 1, HEAD_H - 1);
    ctx.fillStyle = labelInk;
    ctx.font = "9px Calibri, 'Segoe UI', ui-sans-serif, sans-serif";
    ctx.fillText(g.headerLabel || "dir\\col", LABEL_W / 2, HEAD_H / 2);
    ctx.font = "10px Calibri, 'Segoe UI', ui-sans-serif, sans-serif";

    for (let c = 0; c < g.nCols; c++) {
      const col = g.colMin + c;
      const x = LABEL_W + c * CELL;
      ctx.fillStyle = headerFill;
      ctx.fillRect(x, 0, CELL, HEAD_H);
      ctx.strokeStyle = gridLine;
      ctx.strokeRect(x + 0.5, 0.5, CELL - 1, HEAD_H - 1);
      ctx.fillStyle = labelInk;
      ctx.fillText(String(col), x + CELL / 2, HEAD_H / 2);
    }

    for (let r = 0; r < g.nRows; r++) {
      const row = g.rowMin + r;
      const y = this._rowY(row);
      const meta = g.rows[r] || g.rows.find((rowMeta) => rowMeta.row === row);
      const transfer = isTransferDir(meta?.dir);
      ctx.fillStyle = transfer ? "#eef1f6" : "#ffffff";
      ctx.fillRect(0, y, LABEL_W, CELL);
      ctx.strokeStyle = gridLine;
      ctx.strokeRect(0.5, y + 0.5, LABEL_W - 1, CELL - 1);
      if (transfer) {
        ctx.fillStyle = "#c8c8e0";
        ctx.fillRect(0, y, 3, CELL);
      }
      ctx.fillStyle = transfer ? "#6b7280" : labelInk;
      ctx.textAlign = "center";
      ctx.fillText(String(meta?.dir || ""), LABEL_W / 2, y + CELL / 2);

      for (let c = 0; c < g.nCols; c++) {
        const cell = g.grid[r][c];
        const x = LABEL_W + c * CELL;
        const ink = cell ? cellFill(cell) : { fill: "#c0c0c0", text: "#111318" };
        ctx.fillStyle = ink.fill;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        const key = cell ? `${cell.row},${cell.col}` : `${row},${g.colMin + c}`;
        const picked = this.pickHighlight.has(key);
        this._paintPick(ctx, x, y, picked, this.highlight.has(key));
        if (cell?.token) {
          ctx.fillStyle = ink.text;
          const label = String(cell.token);
          ctx.font =
            label.length > 3
              ? "8px Calibri, 'Segoe UI', ui-sans-serif, sans-serif"
              : "11px Calibri, 'Segoe UI', ui-sans-serif, sans-serif";
          ctx.fillText(label, x + CELL / 2, y + CELL / 2);
          ctx.font = "10px Calibri, 'Segoe UI', ui-sans-serif, sans-serif";
        }
      }
    }

    ctx.restore();
  }

  _draw() {
    const ctx = this.ctx;
    const dpr = this.canvas.width / Math.max(1, this._cssW);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this._cssW, this._cssH);
    const excel = this.isExcel();
    ctx.fillStyle = excel ? "#ffffff" : "#10151c";
    ctx.fillRect(0, 0, this._cssW, this._cssH);
    const g = this.grid;
    if (!g?.nRows) return;
    if (excel) {
      this._drawExcel();
      return;
    }

    ctx.save();
    ctx.translate(this.tx, this.ty);
    ctx.scale(this.scale, this.scale);

    ctx.font = "10px ui-monospace, SF Mono, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let c = 0; c < g.nCols; c++) {
      const col = g.colMin + c;
      ctx.fillStyle = "#9aa6b5";
      ctx.fillText(String(col), LABEL_W + c * CELL + CELL / 2, HEAD_H / 2);
    }

    const xferByRow = new Map();
    for (const x of g.xfers || []) {
      if (!xferByRow.has(x.row)) xferByRow.set(x.row, []);
      xferByRow.get(x.row).push(x);
    }

    for (let r = 0; r < g.nRows; r++) {
      const row = g.rowMin + r;
      const y = this._rowY(row);
      const meta = g.rows.find((rowMeta) => rowMeta.row === row);
      ctx.fillStyle = "#9aa6b5";
      ctx.textAlign = "right";
      ctx.fillText(String(row).padStart(3, "0") + (meta?.dir || ""), LABEL_W - 4, y + CELL / 2);
      ctx.textAlign = "center";

      for (let c = 0; c < g.nCols; c++) {
        const cell = g.grid[r][c];
        const x = LABEL_W + c * CELL;
        if (!cell) {
          ctx.fillStyle = "#171d26";
          ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
          continue;
        }
        const ink = cellFill(cell);
        ctx.fillStyle = ink.fill;
        ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        const key = `${cell.row},${cell.col}`;
        const picked = this.pickHighlight.has(key);
        if (picked) {
          ctx.fillStyle = "rgba(94, 234, 212, 0.32)";
          ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
          ctx.strokeStyle = "#5eead4";
          ctx.lineWidth = 2.6;
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3.2, y + 3.2, CELL - 6.4, CELL - 6.4);
        } else if (this.highlight.has(key)) {
          ctx.strokeStyle = "#5eead4";
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x + 1.2, y + 1.2, CELL - 2.4, CELL - 2.4);
        } else {
          ctx.strokeStyle = "rgba(14,18,24,0.35)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        }
        ctx.fillStyle = ink.text;
        const label = String(cell.token);
        ctx.font = label.length > 3 ? "8px ui-monospace, SF Mono, Menlo, Consolas, monospace" : "10px ui-monospace, SF Mono, Menlo, Consolas, monospace";
        ctx.fillText(label, x + CELL / 2, y + CELL / 2);
        ctx.font = "10px ui-monospace, SF Mono, Menlo, Consolas, monospace";
      }

      const xfers = xferByRow.get(row);
      if (xfers) {
        const yy = y + CELL + 2;
        ctx.strokeStyle = "#5eead4";
        ctx.fillStyle = "#5eead4";
        ctx.lineWidth = 1;
        for (const xf of xfers) {
          for (const mv of xf.moves) {
            const cc = mv.col - g.colMin;
            if (cc < 0 || cc >= g.nCols) continue;
            const x = LABEL_W + cc * CELL + CELL / 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, yy + 4);
            ctx.lineTo(x + 5, yy + 4);
            if (mv.dir > 0) {
              ctx.moveTo(x + 2, yy + 1);
              ctx.lineTo(x + 5, yy + 4);
              ctx.lineTo(x + 2, yy + 7);
            } else {
              ctx.moveTo(x - 2, yy + 1);
              ctx.lineTo(x - 5, yy + 4);
              ctx.lineTo(x - 2, yy + 7);
            }
            ctx.stroke();
          }
        }
      }
    }

    if (g.header?.front != null && g.colMin <= 0 && g.colMax >= g.header.front - 1) {
      const splitX = LABEL_W + (g.header.front - g.colMin) * CELL;
      ctx.strokeStyle = "rgba(232,213,196,0.35)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(splitX, HEAD_H);
      ctx.lineTo(splitX, this.contentSize().h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  _wheel(ev) {
    ev.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoomBy(factor, ev.clientX - rect.left, ev.clientY - rect.top);
  }

  hitTest(clientX, clientY) {
    const g = this.grid;
    if (!g?.nRows) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.tx) / this.scale;
    const y = (clientY - rect.top - this.ty) / this.scale;
    return hitTestContent(g, x, y, {
      excel: this.isExcel(),
      rowY: (row) => this._rowY(row),
    });
  }

  _pointerDown(ev) {
    this.canvas.setPointerCapture(ev.pointerId);
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this._pointers.size === 2) {
      const pts = [...this._pointers.values()];
      this._pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale: this.scale,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        tx: this.tx,
        ty: this.ty,
      };
      this._panning = null;
      this._pick = null;
      this._pinched = true;
    } else if (this._pointers.size === 1) {
      this._panning = { x: ev.clientX, y: ev.clientY, tx: this.tx, ty: this.ty };
      this._pick = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false };
      this._pinched = false;
    }
  }

  _pointerMove(ev) {
    if (!this._pointers.has(ev.pointerId)) return;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this._pick && this._pick.pointerId === ev.pointerId) {
      if (Math.hypot(ev.clientX - this._pick.x, ev.clientY - this._pick.y) > MAP_CLICK_SLOP) {
        this._pick.moved = true;
      }
    }
    if (this._pointers.size >= 2 && this._pinch) {
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = this.canvas.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - rect.left;
      const cy = (pts[0].y + pts[1].y) / 2 - rect.top;
      const factor = dist / Math.max(1, this._pinch.dist);
      this.scale = Math.min(6, Math.max(0.2, this._pinch.scale * factor));
      const k = this.scale / this._pinch.scale;
      this.tx = cx - (this._pinch.cx - rect.left - this._pinch.tx) * k;
      this.ty = cy - (this._pinch.cy - rect.top - this._pinch.ty) * k;
      this._dirty = true;
      return;
    }
    if (this._panning) {
      this.tx = this._panning.tx + (ev.clientX - this._panning.x);
      this.ty = this._panning.ty + (ev.clientY - this._panning.y);
      this._dirty = true;
    }
  }

  _pointerUp(ev) {
    const candidate = this._pick;
    const isClick =
      ev.type === "pointerup" &&
      candidate &&
      candidate.pointerId === ev.pointerId &&
      !candidate.moved &&
      !this._pinched;
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    if (this._pointers.size === 1) {
      const [pt] = this._pointers.values();
      this._panning = { x: pt.x, y: pt.y, tx: this.tx, ty: this.ty };
    } else {
      this._panning = null;
    }
    if (candidate?.pointerId === ev.pointerId) this._pick = null;
    if (this._pointers.size === 0) this._pinched = false;
    try {
      this.canvas.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
    if (isClick && typeof this.onCellPick === "function") {
      this.onCellPick(this.hitTest(ev.clientX, ev.clientY));
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("pointerdown", this._onDown);
    this.canvas.removeEventListener("pointermove", this._onMove);
    this.canvas.removeEventListener("pointerup", this._onUp);
    this.canvas.removeEventListener("pointercancel", this._onCancel);
    this.canvas.removeEventListener("lostpointercapture", this._onCancel);
    window.removeEventListener("resize", this._onResize);
    this._ro?.disconnect();
  }
}
