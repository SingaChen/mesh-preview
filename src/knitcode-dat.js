/**
 * Knitting-code DAT downloads. These are the on-screen tables written with
 * SingaLab DATFile, not the manufacturing beds in sheet-dat.js.
 * `source` is the knitting-code JSON this file was exported from.
 */

const FILES = [
  {
    id: "faces-ring0",
    aliases: ["faces_ring0", "faces-ring1", "faces_ring1"],
    filename: "faces-ring0.dat",
    source: "public/sample/cylinder/faces_ring0_knitcode.json",
  },
  {
    id: "standrad-cylinder",
    aliases: ["standrad"],
    filename: "standrad-cylinder.dat",
    source: "public/sample/cylinder/standrad_cylinder_knitcode.json",
  },
  {
    id: "dense-standrad-cylinder",
    aliases: ["dense-standrad"],
    filename: "dense-standrad-cylinder.dat",
    source: "public/sample/dense-standrad/dense_standrad_cylinder_knitcode.json",
  },
  {
    id: "decrease-cylinder",
    aliases: ["decrease"],
    filename: "decrease-cylinder.dat",
    source: "public/sample/decrease/decrease_cylinder_knitcode.json",
  },
  {
    id: "dense-decrease-cylinder",
    aliases: ["dense-decrease"],
    filename: "dense-decrease-cylinder.dat",
    source: "public/sample/dense-decrease/dense_decrease_cylinder_knitcode.json",
  },
  {
    id: "increase-cylinder",
    aliases: ["increase"],
    filename: "increase-cylinder.dat",
    source: "public/sample/increase/increase_cylinder_knitcode.json",
  },
  {
    id: "dense-increase-cylinder",
    aliases: ["dense-increase"],
    filename: "dense-increase-cylinder.dat",
    source: "public/sample/dense-increase/dense_increase_cylinder_knitcode.json",
  },
  {
    id: "thin-cylinder",
    aliases: ["thin"],
    filename: "thin-cylinder.dat",
    source: "public/sample/thin/thin_cylinder_knitcode.json",
  },
  {
    id: "dense-thin-cylinder",
    aliases: ["dense-thin"],
    filename: "dense-thin-cylinder.dat",
    source: "public/sample/dense-thin/dense_thin_cylinder_knitcode.json",
  },
  {
    id: "fat-cylinder",
    aliases: ["fat"],
    filename: "fat-cylinder.dat",
    source: "public/sample/fat/fat_cylinder_knitcode.json",
  },
  {
    id: "dense-fat-cylinder",
    aliases: ["dense-fat"],
    filename: "dense-fat-cylinder.dat",
    source: "public/sample/dense-fat/dense_fat_cylinder_knitcode.json",
  },
  {
    id: "standrad-exp-readable-row-schedule",
    filename: "standrad-exp-readable-row-schedule.dat",
    source: "experiments/official-standrad-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "dense-standrad-exp-readable-row-schedule",
    filename: "dense-standrad-exp-readable-row-schedule.dat",
    source: "experiments/official-dense-standrad-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "increase-exp-readable-row-schedule",
    filename: "increase-exp-readable-row-schedule.dat",
    source: "experiments/official-increase-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "decrease-exp-readable-row-schedule",
    filename: "decrease-exp-readable-row-schedule.dat",
    source: "experiments/official-decrease-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "thin-exp-readable-row-schedule",
    filename: "thin-exp-readable-row-schedule.dat",
    source: "experiments/official-thin-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "fat-exp-readable-row-schedule",
    filename: "fat-exp-readable-row-schedule.dat",
    source: "experiments/official-fat-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "dense-increase-exp-readable-row-schedule",
    filename: "dense-increase-exp-readable-row-schedule.dat",
    source: "experiments/official-dense-increase-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "dense-decrease-exp-readable-row-schedule",
    filename: "dense-decrease-exp-readable-row-schedule.dat",
    source: "experiments/official-dense-decrease-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "dense-thin-exp-readable-row-schedule",
    filename: "dense-thin-exp-readable-row-schedule.dat",
    source: "experiments/official-dense-thin-readable-row-schedule/exp-knitcode.json",
  },
  {
    id: "dense-fat-exp-readable-row-schedule",
    filename: "dense-fat-exp-readable-row-schedule.dat",
    source: "experiments/official-dense-fat-readable-row-schedule/exp-knitcode.json",
  },
];

const BY_SHEET = new Map();
for (const file of FILES) {
  const spec = {
    id: file.id,
    path: `knitcode-dat/${file.filename}`,
    filename: file.filename,
    source: file.source,
  };
  BY_SHEET.set(file.id, spec);
  for (const alias of file.aliases || []) BY_SHEET.set(alias, spec);
}

/** @returns {object|null} Public DAT for the knitting code on this sheet. */
export function datForKnitSheet(sheet) {
  const key = String(sheet || "").trim().toLowerCase();
  return BY_SHEET.get(key) || null;
}

/** One entry per file, in catalog order. Aliases are not repeated. */
export function knitDatCatalog() {
  return FILES.map((file) => BY_SHEET.get(file.id));
}
