import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { columnHue, columnTrails, stitchesInRingRange, triangulate } from "./stitches.js";

const YARN = 0xe8d5c4;
const OVERLAY = 0x5eead4;

export class MeshViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.loader = new OBJLoader();
    this.wireframe = false;
    this.flat = false;
    this.showOverlay = true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x12161d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 400);
    this.camera.position.set(2.4, 1.4, 3.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.6;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 400;

    this.scene.add(new THREE.HemisphereLight(0xf4efe8, 0x2a3340, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3.2, 4.5, 2.4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
    fill.position.set(-3, 0.6, -2);
    this.scene.add(fill);

    const ground = new THREE.GridHelper(8, 16, 0x2c3542, 0x1d242e);
    ground.position.y = -1.3;
    this.scene.add(ground);
    this.ground = ground;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.mesh = null;
    this.overlay = null;
    this.stitchMesh = null;
    this.trailLines = null;
    this.colsGroup = null;
    this._stitchState = null;
    this._colsState = null;
    this._modelVisibility = new Map();
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._raf = 0;
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
    this.loop();
  }

  resize() {
    const parent = this.canvas.parentElement || this.canvas;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  loop = () => {
    this._raf = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  parseObj(text, name = "mesh") {
    const obj = this.loader.parse(text);
    const geom = mergeObjectGeometry(obj);
    if (!geom) {
      throw new Error(`OBJ 无可用面 / ${name} has no faces`);
    }
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    return geom;
  }

  setGeometries(meshGeom, overlayGeom = null) {
    this.clearMeshes();
    this._stitchState = null;
    this.mesh = new THREE.Mesh(meshGeom, this._meshMaterial());
    this.mesh.userData.modelName = "cut_iteration_0";
    this.root.add(this.mesh);
    if (overlayGeom) {
      this.overlay = new THREE.Mesh(overlayGeom, this._overlayMaterial());
      this.overlay.visible = this.showOverlay;
      this.root.add(this.overlay);
    }
  }

  setKnitView({ bodyGeom, bound, maxRow, highlightCol, colsColumns = null }) {
    this.clearMeshes();
    this._stitchState = {
      bound,
      maxRow,
      highlightCol,
      rowStart: 0,
      rowEnd: ringSliderN(bound),
    };
    this._colsState = colsColumns?.length ? { columns: colsColumns, start: 0, end: colsColumns.length } : null;
    if (bodyGeom) {
      this.mesh = new THREE.Mesh(bodyGeom, this._bodyMaterial());
      this.mesh.userData.modelName = "cut_iteration_0";
      this.root.add(this.mesh);
    }
    this._rebuildCols();
    this._rebuildStitches();
  }

  setDisplayScene({ bodyGeom, bodyName = "cut_iteration_0", colsColumns = null, bound = null }) {
    this.clearMeshes();
    this._stitchState = bound
      ? {
          bound,
          maxRow: Infinity,
          highlightCol: null,
          rowStart: 0,
          rowEnd: ringSliderN(bound),
        }
      : null;
    this._colsState = colsColumns?.length
      ? { columns: colsColumns, start: 0, end: colsColumns.length }
      : null;
    if (bodyGeom) {
      this.mesh = new THREE.Mesh(bodyGeom, this._bodyMaterial());
      this.mesh.userData.modelName = bodyName;
      this.root.add(this.mesh);
    }
    this._rebuildCols();
    this._rebuildStitches();
  }

  setModelVisible(name, visible) {
    this._modelVisibility.set(name, visible);
    if (this.mesh && this.mesh.userData.modelName === name) this.mesh.visible = visible;
    if (name === "cols_resample" && this.colsGroup) this.colsGroup.visible = visible;
    if (name === "KnittingStitches") {
      if (this.stitchMesh) this.stitchMesh.visible = visible && this.showOverlay;
      if (this.trailLines) this.trailLines.visible = visible && this.showOverlay;
    }
  }

  setColsResampleRange(start, end) {
    if (!this._colsState) return;
    this._colsState.start = start;
    this._colsState.end = end;
    this._rebuildCols();
    const vis = this._modelVisibility.get("cols_resample");
    if (this.colsGroup && vis === false) this.colsGroup.visible = false;
  }

  setFacesRingRange(start, end) {
    if (!this._stitchState) return;
    this._stitchState.rowStart = start;
    this._stitchState.rowEnd = end;
    this._rebuildStitches();
    const vis = this._modelVisibility.get("KnittingStitches");
    if (vis === false) {
      if (this.stitchMesh) this.stitchMesh.visible = false;
      if (this.trailLines) this.trailLines.visible = false;
    }
  }

  setGrowth(maxRow) {
    if (!this._stitchState) return;
    this._stitchState.maxRow = maxRow;
    this._rebuildStitches();
  }

  setHighlightCol(col) {
    if (!this._stitchState) return;
    this._stitchState.highlightCol = col;
    this._rebuildStitches();
  }

  pickStitch(clientX, clientY) {
    if (!this.stitchMesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObject(this.stitchMesh, false);
    if (!hits.length) return null;
    const idx = hits[0].face?.a;
    const attr = this.stitchMesh.geometry.getAttribute("stitchIndex");
    if (!attr || idx == null) return null;
    const stitchIndex = attr.getX(idx);
    return this._stitchState?.bound.stitches[stitchIndex] || null;
  }

  pickStitchCol(clientX, clientY) {
    return this.pickStitch(clientX, clientY)?.col ?? null;
  }

  _rebuildStitches() {
    if (this.stitchMesh) {
      this.root.remove(this.stitchMesh);
      this.stitchMesh.geometry.dispose();
      this.stitchMesh.material.dispose();
      this.stitchMesh = null;
    }
    if (this.trailLines) {
      this.root.remove(this.trailLines);
      this.trailLines.geometry.dispose();
      this.trailLines.material.dispose();
      this.trailLines = null;
    }

    const state = this._stitchState;
    if (!state) return;
    const { bound, maxRow, highlightCol, rowStart, rowEnd } = state;
    const columns = bound.columns;
    const lo = rowStart ?? 0;
    const hi = rowEnd ?? ringSliderN(bound);
    const visible = stitchesInRingRange(bound.stitches, lo, hi).filter((s) => {
      if (Number.isFinite(maxRow) && s.row != null && s.row > maxRow) return false;
      return true;
    });
    const solo = highlightCol != null;

    const positions = [];
    const colors = [];
    const stitchIndex = [];
    const color = new THREE.Color();

    for (const s of visible) {
      const dim = solo && s.col !== highlightCol;
      const hue = columnHue(s.col ?? columns[0], columns);
      color.setHSL(hue * 0.85, dim ? 0.25 : 0.78, dim ? 0.16 : s.col === highlightCol ? 0.64 : 0.52);
      const tris = triangulate(s.verts);
      for (const v of tris) {
        positions.push(v.x, v.y, v.z);
        colors.push(color.r, color.g, color.b);
        stitchIndex.push(s.index);
      }
    }

    if (positions.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geom.setAttribute("stitchIndex", new THREE.Float32BufferAttribute(stitchIndex, 1));
      geom.computeVertexNormals();
      this.stitchMesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.48,
          metalness: 0.06,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: this.showOverlay ? 0.96 : 0,
        }),
      );
      this.stitchMesh.userData.modelName = "KnittingStitches";
      this.stitchMesh.visible = this.showOverlay && this._modelVisibility.get("KnittingStitches") !== false;
      this.root.add(this.stitchMesh);
    }

    const trails = columnTrails(stitchesInRingRange(bound.stitches, lo, hi), {
      maxRow,
      onlyCol: highlightCol,
    });
    const linePos = [];
    const lineCol = [];
    for (const trail of trails) {
      const hue = columnHue(trail.col, columns);
      const dim = solo && trail.col !== highlightCol;
      color.setHSL(hue * 0.85, 0.9, dim ? 0.22 : 0.72);
      for (let i = 0; i + 1 < trail.points.length; i++) {
        const a = trail.points[i];
        const b = trail.points[i + 1];
        linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        lineCol.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
    if (linePos.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(lineCol, 3));
      this.trailLines = new THREE.LineSegments(
        geom,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: this.showOverlay ? 0.95 : 0,
        }),
      );
      this.trailLines.userData.modelName = "KnittingStitches";
      this.trailLines.visible = this.showOverlay && this._modelVisibility.get("KnittingStitches") !== false;
      this.root.add(this.trailLines);
    }
  }

  _rebuildCols() {
    if (this.colsGroup) {
      this.root.remove(this.colsGroup);
      this.colsGroup.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
      this.colsGroup = null;
    }
    const state = this._colsState;
    if (!state) return;
    const { columns, start, end } = state;
    const positions = [];
    const colors = [];
    const pointPos = [];
    const pointCol = [];
    for (let i = start; i < end; i++) {
      const col = columns[i];
      if (!col?.points?.length) continue;
      for (const p of col.points) {
        pointPos.push(p.x, p.y, p.z);
        pointCol.push(p.r ?? 0.2, p.g ?? 0.7, p.b ?? 1);
      }
      for (let k = 0; k + 1 < col.points.length; k++) {
        const a = col.points[k];
        const b = col.points[k + 1];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        colors.push(a.r ?? 0.2, a.g ?? 0.7, a.b ?? 1, b.r ?? 0.2, b.g ?? 0.7, b.b ?? 1);
      }
    }

    this.colsGroup = new THREE.Group();
    this.colsGroup.userData.modelName = "cols_resample";
    this.colsGroup.visible = this._modelVisibility.get("cols_resample") !== false;

    if (positions.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      this.colsGroup.add(
        new THREE.LineSegments(
          geom,
          new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }),
        ),
      );
    }
    if (pointPos.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(pointPos, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(pointCol, 3));
      this.colsGroup.add(
        new THREE.Points(
          geom,
          new THREE.PointsMaterial({ vertexColors: true, size: 0.35, sizeAttenuation: true }),
        ),
      );
    }
    this.root.add(this.colsGroup);
  }

  setWireframe(on) {
    this.wireframe = on;
    if (this.mesh) this.mesh.material.wireframe = on;
  }

  setFlat(on) {
    this.flat = on;
    if (this.mesh) {
      this.mesh.material.flatShading = on;
      this.mesh.material.needsUpdate = true;
    }
  }

  setShowOverlay(on) {
    this.showOverlay = on;
    const stitchOn = on && this._modelVisibility.get("KnittingStitches") !== false;
    if (this.overlay) this.overlay.visible = on;
    if (this.stitchMesh) {
      this.stitchMesh.visible = stitchOn;
      this.stitchMesh.material.opacity = stitchOn ? 0.96 : 0;
    }
    if (this.trailLines) {
      this.trailLines.visible = stitchOn;
      this.trailLines.material.opacity = stitchOn ? 0.95 : 0;
    }
  }

  fitToView() {
    const box = new THREE.Box3();
    if (this.mesh && this.mesh.visible) box.expandByObject(this.mesh);
    if (this.overlay && this.overlay.visible) box.expandByObject(this.overlay);
    if (this.stitchMesh && this.stitchMesh.visible) box.expandByObject(this.stitchMesh);
    if (this.colsGroup && this.colsGroup.visible) box.expandByObject(this.colsGroup);
    if (box.isEmpty()) return;

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const target = sphere.center.clone();
    const dist = Math.max(sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov) / 2), 0.4);
    const dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.5, 1);
    dir.normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(dir.multiplyScalar(dist * 1.15));
    this.camera.near = Math.max(dist / 200, 0.01);
    this.camera.far = dist * 40;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.ground.position.y = box.min.y - 0.02;
    const size = box.getSize(new THREE.Vector3()).length();
    this.ground.scale.setScalar(Math.max(1, size / 8));
  }

  _meshMaterial() {
    return new THREE.MeshStandardMaterial({
      color: YARN,
      roughness: 0.62,
      metalness: 0.04,
      side: THREE.DoubleSide,
      wireframe: this.wireframe,
      flatShading: this.flat,
    });
  }

  _bodyMaterial() {
    return new THREE.MeshStandardMaterial({
      color: YARN,
      roughness: 0.68,
      metalness: 0.03,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42,
      wireframe: this.wireframe,
      flatShading: this.flat,
    });
  }

  _bodyUnderStitchMaterial() {
    return this._bodyMaterial();
  }

  _overlayMaterial() {
    return new THREE.MeshBasicMaterial({
      color: OVERLAY,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  clearMeshes() {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    this.mesh = null;
    this.overlay = null;
    this.stitchMesh = null;
    this.trailLines = null;
    this.colsGroup = null;
    this._stitchState = null;
    this._colsState = null;
    this._modelVisibility = new Map();
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.clearMeshes();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function ringSliderN(bound) {
  if (Number.isFinite(bound?.nRings) && bound.nRings > 0) return bound.nRings;
  const rings = (bound?.stitches || []).map((s) => s.ring).filter((r) => r != null && Number.isFinite(r));
  if (rings.length) return Math.max(...rings) + 1;
  return bound?.stitches?.length ?? 0;
}

function mergeObjectGeometry(root) {
  const pieces = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geom = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone();
    geom.applyMatrix4(child.matrixWorld);
    pieces.push(geom);
  });
  if (!pieces.length) return null;
  const merged = pieces.length === 1 ? pieces[0] : mergePositions(pieces);
  for (const g of pieces) {
    if (g !== merged) g.dispose();
  }
  return merged;
}

function mergePositions(geoms) {
  let count = 0;
  for (const g of geoms) count += g.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  let offset = 0;
  for (const g of geoms) {
    const attr = g.getAttribute("position");
    pos.set(attr.array, offset);
    offset += attr.array.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return out;
}
