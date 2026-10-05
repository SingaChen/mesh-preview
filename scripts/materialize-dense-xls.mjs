import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "public/sample/dense-standrad";
const names = [
  "dense_standrad_cylinder_bed.xls",
  "dense_standrad_cylinder_cols_resample.xls",
];

for (const name of names) {
  const encoded = join(dir, `${name}.b64`);
  if (!existsSync(encoded)) continue;
  const bytes = Buffer.from(readFileSync(encoded, "utf8"), "base64");
  const dest = join(dir, name);
  if (!existsSync(dest) || !readFileSync(dest).equals(bytes)) writeFileSync(dest, bytes);
}
