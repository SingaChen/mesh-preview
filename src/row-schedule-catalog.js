/**
 * Official row-schedule promotion.
 *
 * The live official sheet shows the reviewed new-schedule bed and knitting
 * code. The previous official beds, readable maps, knitting codes, and
 * knitcode DATs stay byte-identical under public/archive/legacy-official-schedule
 * and open through the hidden legacy sheet ids. Old experiment sheet ids
 * canonicalize to the official ids so existing links do not keep a second copy.
 */

export const PROMOTED_SCHEDULES = [
  {
    key: "bunny",
    officialId: "faces-ring0",
    officialAliases: ["faces_ring0", "faces-ring1", "faces_ring1"],
    expSheetId: "bunny-exp-readable-row-schedule",
    legacyId: "legacy-faces-ring0",
    officialName: "Bunny",
    manifest: "manifest.json",
    experimentDir: "experiments/official-bunny-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/bunny",
    datFilename: "faces-ring0.dat",
    expDatFilename: "bunny-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-bunny-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/cylinder/faces_ring0_step4_bed.xls",
    sampleBedTxt: "public/sample/cylinder/faces_ring0_step4_bed.txt",
    sampleReadableMapTxt: "public/sample/cylinder/faces_ring0_step4_bed.txt",
    sampleKnitcode: "public/sample/cylinder/faces_ring0_knitcode.json",
  },
  {
    key: "standrad",
    officialId: "standrad-cylinder",
    officialAliases: ["standrad"],
    expSheetId: "standrad-exp-readable-row-schedule",
    legacyId: "legacy-standrad-cylinder",
    officialName: "Standrad Cylinder",
    manifest: "standrad-cylinder.json",
    experimentDir: "experiments/official-standrad-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/standrad",
    datFilename: "standrad-cylinder.dat",
    expDatFilename: "standrad-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-standrad-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/cylinder/standrad_cylinder_bed.xls",
    sampleBedTxt: "public/sample/cylinder/standrad_cylinder_bed.txt",
    sampleReadableMapTxt: "public/sample/cylinder/standrad_cylinder_readable_map.txt",
    sampleKnitcode: "public/sample/cylinder/standrad_cylinder_knitcode.json",
  },
  {
    key: "dense-standrad",
    officialId: "dense-standrad-cylinder",
    officialAliases: ["dense-standrad"],
    expSheetId: "dense-standrad-exp-readable-row-schedule",
    legacyId: "legacy-dense-standrad-cylinder",
    officialName: "Dense Standrad Cylinder",
    manifest: "dense-standrad-cylinder.json",
    experimentDir: "experiments/official-dense-standrad-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/dense-standrad",
    datFilename: "dense-standrad-cylinder.dat",
    expDatFilename: "dense-standrad-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-dense-standrad-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/dense-standrad/dense_standrad_cylinder_bed.xls",
    sampleBedTxt: "public/sample/dense-standrad/dense_standrad_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/dense-standrad/dense_standrad_cylinder_knitcode.json",
  },
  {
    key: "increase",
    officialId: "increase-cylinder",
    officialAliases: ["increase"],
    expSheetId: "increase-exp-readable-row-schedule",
    legacyId: "legacy-increase-cylinder",
    officialName: "Increase Cylinder",
    manifest: "increase-cylinder.json",
    experimentDir: "experiments/official-increase-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/increase",
    datFilename: "increase-cylinder.dat",
    expDatFilename: "increase-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-increase-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/increase/increase_cylinder_bed.xls",
    sampleBedTxt: "public/sample/increase/increase_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/increase/increase_cylinder_knitcode.json",
  },
  {
    key: "decrease",
    officialId: "decrease-cylinder",
    officialAliases: ["decrease"],
    expSheetId: "decrease-exp-readable-row-schedule",
    legacyId: "legacy-decrease-cylinder",
    officialName: "Decrease Cylinder",
    manifest: "decrease-cylinder.json",
    experimentDir: "experiments/official-decrease-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/decrease",
    datFilename: "decrease-cylinder.dat",
    expDatFilename: "decrease-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-decrease-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/decrease/decrease_cylinder_bed.xls",
    sampleBedTxt: "public/sample/decrease/decrease_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/decrease/decrease_cylinder_knitcode.json",
  },
  {
    key: "thin",
    officialId: "thin-cylinder",
    officialAliases: ["thin"],
    expSheetId: "thin-exp-readable-row-schedule",
    legacyId: "legacy-thin-cylinder",
    officialName: "Thin Cylinder",
    manifest: "thin-cylinder.json",
    experimentDir: "experiments/official-thin-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/thin",
    datFilename: "thin-cylinder.dat",
    expDatFilename: "thin-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-thin-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/thin/thin_cylinder_bed.xls",
    sampleBedTxt: "public/sample/thin/thin_cylinder_bed.txt",
    sampleReadableMapTxt: "public/sample/thin/thin_cylinder_bed.txt",
    sampleKnitcode: "public/sample/thin/thin_cylinder_knitcode.json",
  },
  {
    key: "fat",
    officialId: "fat-cylinder",
    officialAliases: ["fat"],
    expSheetId: "fat-exp-readable-row-schedule",
    legacyId: "legacy-fat-cylinder",
    officialName: "Fat Cylinder",
    manifest: "fat-cylinder.json",
    experimentDir: "experiments/official-fat-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/fat",
    datFilename: "fat-cylinder.dat",
    expDatFilename: "fat-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-fat-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/fat/fat_cylinder_bed.xls",
    sampleBedTxt: "public/sample/fat/fat_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/fat/fat_cylinder_knitcode.json",
  },
  {
    key: "dense-increase",
    officialId: "dense-increase-cylinder",
    officialAliases: ["dense-increase"],
    expSheetId: "dense-increase-exp-readable-row-schedule",
    legacyId: "legacy-dense-increase-cylinder",
    officialName: "Dense Increase Cylinder",
    manifest: "dense-increase-cylinder.json",
    experimentDir: "experiments/official-dense-increase-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/dense-increase",
    datFilename: "dense-increase-cylinder.dat",
    expDatFilename: "dense-increase-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-dense-increase-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/dense-increase/dense_increase_cylinder_bed.xls",
    sampleBedTxt: "public/sample/dense-increase/dense_increase_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/dense-increase/dense_increase_cylinder_knitcode.json",
  },
  {
    key: "dense-decrease",
    officialId: "dense-decrease-cylinder",
    officialAliases: ["dense-decrease"],
    expSheetId: "dense-decrease-exp-readable-row-schedule",
    legacyId: "legacy-dense-decrease-cylinder",
    officialName: "Dense Decrease Cylinder",
    manifest: "dense-decrease-cylinder.json",
    experimentDir: "experiments/official-dense-decrease-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/dense-decrease",
    datFilename: "dense-decrease-cylinder.dat",
    expDatFilename: "dense-decrease-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-dense-decrease-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/dense-decrease/dense_decrease_cylinder_bed.xls",
    sampleBedTxt: "public/sample/dense-decrease/dense_decrease_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/dense-decrease/dense_decrease_cylinder_knitcode.json",
  },
  {
    key: "dense-thin",
    officialId: "dense-thin-cylinder",
    officialAliases: ["dense-thin"],
    expSheetId: "dense-thin-exp-readable-row-schedule",
    legacyId: "legacy-dense-thin-cylinder",
    officialName: "Dense Thin Cylinder",
    manifest: "dense-thin-cylinder.json",
    experimentDir: "experiments/official-dense-thin-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/dense-thin",
    datFilename: "dense-thin-cylinder.dat",
    expDatFilename: "dense-thin-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-dense-thin-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/dense-thin/dense_thin_cylinder_bed.xls",
    sampleBedTxt: "public/sample/dense-thin/dense_thin_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/dense-thin/dense_thin_cylinder_knitcode.json",
  },
  {
    key: "dense-fat",
    officialId: "dense-fat-cylinder",
    officialAliases: ["dense-fat"],
    expSheetId: "dense-fat-exp-readable-row-schedule",
    legacyId: "legacy-dense-fat-cylinder",
    officialName: "Dense Fat Cylinder",
    manifest: "dense-fat-cylinder.json",
    experimentDir: "experiments/official-dense-fat-readable-row-schedule",
    archiveDir: "archive/legacy-official-schedule/dense-fat",
    datFilename: "dense-fat-cylinder.dat",
    expDatFilename: "dense-fat-exp-readable-row-schedule.dat",
    newKnitSource: "experiments/official-dense-fat-readable-row-schedule/exp-knitcode.json",
    sampleBedXls: "public/sample/dense-fat/dense_fat_cylinder_bed.xls",
    sampleBedTxt: "public/sample/dense-fat/dense_fat_cylinder_bed.txt",
    sampleReadableMapTxt: null,
    sampleKnitcode: "public/sample/dense-fat/dense_fat_cylinder_knitcode.json",
  },
];

export function scheduleBaseName(rel) {
  const parts = String(rel || "").split("/");
  return parts[parts.length - 1] || "";
}

export function sheetKey(sheet) {
  return String(sheet || "").trim().toLowerCase();
}

/** Experiment sheet ids open the official sheet. Every other id is unchanged. */
export function canonicalSheetId(sheet) {
  const key = sheetKey(sheet);
  const hit = PROMOTED_SCHEDULES.find((spec) => spec.expSheetId === key);
  return hit ? hit.officialId : key;
}

export function promotedByOfficial(sheet) {
  const key = sheetKey(sheet);
  return (
    PROMOTED_SCHEDULES.find((spec) => spec.officialId === key || spec.officialAliases.includes(key)) || null
  );
}

export function promotedByLegacy(sheet) {
  const key = sheetKey(sheet);
  return PROMOTED_SCHEDULES.find((spec) => spec.legacyId === key) || null;
}

export function promotedByAny(sheet) {
  const key = canonicalSheetId(sheet);
  return promotedByOfficial(key) || promotedByLegacy(sheet) || null;
}
