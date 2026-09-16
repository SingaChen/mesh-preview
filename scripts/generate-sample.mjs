/**
 * Writes a tiny SingaLab-style sample project: a knit panel that
 * rolls into a sleeve across three iterations, plus a stitch-field overlay.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sample");
mkdirSync(outDir, { recursive: true });

function sleevePoint(u, v, t) {
  const height = 2.4;
  const y = (v - 0.5) * height;
  const width = 2.2;
  const radius = width / (2 * Math.PI);
  const flare = 1 + 0.08 * t * (v * v);
  const wave = 0.02 * t * Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 3);
  const r = (radius + wave) * flare;
  const theta = u * t * Math.PI * 2;
  const xFlat = (u - 0.5) * width;
  const xCyl = r * Math.sin(theta);
  const zCyl = r * (1 - Math.cos(theta));
  return [xFlat * (1 - t) + xCyl * t, y, zCyl * t];
}

function gridMesh(nu, nv, pointAt) {
  const verts = [];
  const faces = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      verts.push(pointAt(i / nu, j / nv));
    }
  }
  const row = nu + 1;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * row + i + 1;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      faces.push([a, b, d], [a, d, c]);
    }
  }
  return { verts, faces };
}

function toObj(comment, { verts, faces }) {
  const lines = [`# ${comment}`, `o ${comment.replace(/\s+/g, "_")}`];
  for (const [x, y, z] of verts) {
    lines.push(`v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`);
  }
  for (const [a, b, c] of faces) {
    lines.push(`f ${a} ${b} ${c}`);
  }
  return `${lines.join("\n")}\n`;
}

function ribbon(a, b, width) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  // A stable perpendicular in the XY-ish plane.
  let px = -dy;
  let py = dx;
  let pz = 0;
  const plen = Math.hypot(px, py, pz);
  if (plen < 1e-6) {
    px = 0;
    py = -dz;
    pz = dy;
  }
  const n = Math.hypot(px, py, pz) || 1;
  const s = width / n;
  px *= s;
  py *= s;
  pz *= s;
  return [
    [a[0] - px, a[1] - py, a[2] - pz],
    [a[0] + px, a[1] + py, a[2] + pz],
    [b[0] + px, b[1] + py, b[2] + pz],
    [b[0] - px, b[1] - py, b[2] - pz],
  ];
}

function fieldOverlay(t) {
  const verts = [];
  const faces = [];
  const pushRibbon = (p0, p1) => {
    const q = ribbon(p0, p1, 0.012);
    const base = verts.length;
    verts.push(...q);
    faces.push([base + 1, base + 2, base + 3], [base + 1, base + 3, base + 4]);
  };

  const nu = 18;
  const nv = 10;
  for (let i = 0; i <= nu; i += 2) {
    const u = i / nu;
    for (let j = 0; j < nv; j++) {
      pushRibbon(sleevePoint(u, j / nv, t), sleevePoint(u, (j + 1) / nv, t));
    }
  }
  for (let j = 0; j <= nv; j += 2) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      pushRibbon(sleevePoint(i / nu, v, t), sleevePoint((i + 1) / nu, v, t));
    }
  }
  return { verts, faces };
}

const iterations = [
  { t: 0.08, name: "iteration_00_cut_body.obj", label: "iter 0 · cut" },
  { t: 0.55, name: "iteration_01_cut_body.obj", label: "iter 1 · cut" },
  { t: 1.0, name: "iteration_02_cut_body.obj", label: "iter 2 · sleeve" },
];

for (const it of iterations) {
  const mesh = gridMesh(20, 14, (u, v) => sleevePoint(u, v, it.t));
  writeFileSync(join(outDir, it.name), toObj(it.name, mesh));
}

writeFileSync(
  join(outDir, "iteration_01_KnittingStitches_field.obj"),
  toObj("iteration_01_KnittingStitches_field", fieldOverlay(0.55)),
);
writeFileSync(
  join(outDir, "iteration_02_KnittingStitches_field.obj"),
  toObj("iteration_02_KnittingStitches_field", fieldOverlay(1)),
);

const manifest = {
  name: "sample-sleeve",
  outputs: [
    { label: "iter 0 · cut", mesh: "iteration_00_cut_body.obj" },
    {
      label: "iter 1 · cut",
      mesh: "iteration_01_cut_body.obj",
      overlay: "iteration_01_KnittingStitches_field.obj",
    },
    {
      label: "iter 2 · sleeve",
      mesh: "iteration_02_cut_body.obj",
      overlay: "iteration_02_KnittingStitches_field.obj",
    },
  ],
};

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote sample project to ${outDir}`);
