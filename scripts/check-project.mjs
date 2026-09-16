import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  indexFiles,
  isManifestShape,
  isOverlayName,
  projectFromDiscovery,
  projectFromManifest,
} from "../src/project.js";

const sampleDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sample");
const names = [
  "manifest.json",
  "iteration_00_cut_body.obj",
  "iteration_01_cut_body.obj",
  "iteration_02_cut_body.obj",
  "iteration_01_KnittingStitches_field.obj",
  "iteration_02_KnittingStitches_field.obj",
];

const entries = names.map((name) => ({
  name,
  path: `sample/${name}`,
  text: readFileSync(join(sampleDir, name), "utf8"),
}));

const index = indexFiles(entries);
const manifest = JSON.parse(entries[0].text);
if (!isManifestShape(manifest)) throw new Error("sample manifest invalid");

const fromManifest = projectFromManifest(manifest, index, "sample/manifest.json");
if (fromManifest.outputs.length !== 3) throw new Error("expected 3 manifest outputs");
if (!fromManifest.outputs[2].overlayFile) throw new Error("expected overlay on last output");

const fromDiscovery = projectFromDiscovery(index);
if (fromDiscovery.outputs.length !== 3) throw new Error("discovery should skip overlay-only mesh");
if (!fromDiscovery.outputs[2].overlayFile) throw new Error("discovery should match iteration overlay");
if (!isOverlayName("KnittingStitches_field.obj")) throw new Error("overlay heuristic failed");

console.log("project checks ok");
