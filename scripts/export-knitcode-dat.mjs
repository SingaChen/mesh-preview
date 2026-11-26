/**
 * Export every completed knitting-code table to a DAT the preview can download.
 * Matrices come from the same cells the table draws. Bytes are written by
 * scripts/save_knitcode_dat.py, which calls SingaLab DATFile.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { knitDatMatrix, parseKnitCode } from "../src/knit-code.js";
import { knitDatCatalog } from "../src/knitcode-dat.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jobs = knitDatCatalog().map((item) => {
  const data = JSON.parse(readFileSync(join(root, item.source), "utf8"));
  const knit = parseKnitCode(data);
  if (!knit) throw new Error(`not a knitting-code table: ${item.source}`);
  const matrix = knitDatMatrix(knit);
  if (matrix.length !== knit.rows.length) {
    throw new Error(`${item.id} dat rows ${matrix.length} != table rows ${knit.rows.length}`);
  }
  return { path: join(root, "public", item.path), matrix };
});

const dir = mkdtempSync(join(tmpdir(), "knitcode-dat-"));
const payload = join(dir, "matrices.json");
writeFileSync(payload, JSON.stringify(jobs));
const result = spawnSync("python3", [join(root, "scripts/save_knitcode_dat.py"), payload], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PYTHONPATH: join(root, "scripts") },
});
rmSync(dir, { recursive: true, force: true });
if (result.status !== 0) process.exit(result.status || 1);
