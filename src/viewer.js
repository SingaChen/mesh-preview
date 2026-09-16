import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

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
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
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
    this.controls.maxDistance = 80;

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
    this.mesh = new THREE.Mesh(meshGeom, this._meshMaterial());
    this.root.add(this.mesh);
    if (overlayGeom) {
      this.overlay = new THREE.Mesh(overlayGeom, this._overlayMaterial());
      this.overlay.visible = this.showOverlay;
      this.root.add(this.overlay);
    }
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
    if (this.overlay) this.overlay.visible = on;
  }

  fitToView() {
    const box = new THREE.Box3();
    if (this.mesh) box.expandByObject(this.mesh);
    if (this.overlay && this.overlay.visible) box.expandByObject(this.overlay);
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
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
    this.clearMeshes();
    this.controls.dispose();
    this.renderer.dispose();
  }
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
