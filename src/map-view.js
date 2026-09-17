import { cellFill } from "./readable-map.js";

const CELL = 22;
const LABEL_W = 44;
const HEAD_H = 20;
const XFER_H = 10;
const PAD = 12;

export class ReadableMapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = null;
    this.highlight = new Set();
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this._cssW = 0;
    this._cssH = 0;
    this._pointers = new Map();
    this._pinch = null;
    this._panning = null;
    this._dirty = true;
    this._raf = 0;

    this._onWheel = (ev) => this._wheel(ev);
    this._onDown = (ev) => this._pointerDown(ev);
    this._onMove = (ev) => this._pointerMove(ev);
    this._onUp = (ev) => this._pointerUp(ev);
    this._onResize = () => this.resize();

    canvas.addEventListener("wheel", this._onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this._onDown);
    canvas.addEventListener("pointermove", this._onMove);
    canvas.addEventListener("pointerup", this._onUp);
    canvas.addEventListener("pointercancel", this._onUp);
    canvas.addEventListener("lostpointercapture", this._onUp);
    window.addEventListener("resize", this._onResize);
    this._ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
    this._ro?.observe(canvas);
    this.resize();
    this._loop();
  }

  setGrid(grid) {
    this.grid = grid;
    this.highlight = new Set();
    this.resize();
    this.fit();
  }

  setHighlight(keys) {
    this.highlight = keys instanceof Set ? keys : new Set(keys || []);
    this._dirty = true;
  }

  clear() {
    this.grid = null;
    this.highlight = new Set();
    this._dirty = true;
  }

  contentSize() {
    const g = this.grid;
    if (!g?.nRows) return { w: 0, h: 0 };
    const xferRows = new Set((g.xfers || []).map((x) => x.row)).size;
    return {
      w: LABEL_W + g.nCols * CELL,
      h: HEAD_H + g.nRows * CELL + xferRows * XFER_H,
    };
  }

  fit() {
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
    this.scale = Math.max(0.2, Math.min((cssW - PAD * 2) / w, (cssH - PAD * 2) / h, 2.4));
    this.tx = (cssW - w * this.scale) / 2;
    this.ty = (cssH - h * this.scale) / 2;
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

  _draw() {
    const ctx = this.ctx;
    const dpr = this.canvas.width / Math.max(1, this._cssW);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this._cssW, this._cssH);
    ctx.fillStyle = "#10151c";
    ctx.fillRect(0, 0, this._cssW, this._cssH);
    const g = this.grid;
    if (!g?.nRows) return;

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
        if (this.highlight.has(`${cell.row},${cell.col}`)) {
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
    } else if (this._pointers.size === 1) {
      this._panning = { x: ev.clientX, y: ev.clientY, tx: this.tx, ty: this.ty };
    }
  }

  _pointerMove(ev) {
    if (!this._pointers.has(ev.pointerId)) return;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
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
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    if (this._pointers.size === 1) {
      const [pt] = this._pointers.values();
      this._panning = { x: pt.x, y: pt.y, tx: this.tx, ty: this.ty };
    } else {
      this._panning = null;
    }
    try {
      this.canvas.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener("wheel", this._onWheel);
    this.canvas.removeEventListener("pointerdown", this._onDown);
    this.canvas.removeEventListener("pointermove", this._onMove);
    this.canvas.removeEventListener("pointerup", this._onUp);
    this.canvas.removeEventListener("pointercancel", this._onUp);
    this.canvas.removeEventListener("lostpointercapture", this._onUp);
    window.removeEventListener("resize", this._onResize);
    this._ro?.disconnect();
  }
}
