/** Tooltip when the open sheet has no committed knitting .dat. */
export const NO_DAT_TITLE = "此 sheet 暂无 .dat";

const FACES_RING0 = {
  path: "sample/cylinder/faces_ring0_v2.dat",
  filename: "faces_ring0_v2.dat",
};

const DENSE_STANDRAD = {
  path: "sample/dense-standrad/dense_standrad_cylinder.dat",
  filename: "dense_standrad_cylinder.dat",
};

const STANDRAD = {
  path: "sample/cylinder/standrad_cylinder.dat",
  filename: "standrad_cylinder.dat",
};

const DECREASE = {
  path: "sample/decrease/decrease_cylinder.dat",
  filename: "decrease_cylinder.dat",
};

const INCREASE = {
  path: "sample/increase/increase_cylinder.dat",
  filename: "increase_cylinder.dat",
};

const THIN = {
  path: "sample/thin/thin_cylinder.dat",
  filename: "thin_cylinder.dat",
};

const FAT = {
  path: "sample/fat/fat_cylinder.dat",
  filename: "fat_cylinder.dat",
};

/** Sheet ids from ?sheet= and the Open menu, including the short aliases. */
const SHEET_DAT = {
  "faces-ring0": FACES_RING0,
  faces_ring0: FACES_RING0,
  "faces-ring1": FACES_RING0,
  faces_ring1: FACES_RING0,
  "dense-standrad-cylinder": DENSE_STANDRAD,
  "dense-standrad": DENSE_STANDRAD,
  "standrad-cylinder": STANDRAD,
  standrad: STANDRAD,
  "decrease-cylinder": DECREASE,
  decrease: DECREASE,
  "increase-cylinder": INCREASE,
  increase: INCREASE,
  "thin-cylinder": THIN,
  thin: THIN,
  "fat-cylinder": FAT,
  fat: FAT,
};

export function datForSheet(sheet) {
  const key = String(sheet || "").trim().toLowerCase();
  return SHEET_DAT[key] || null;
}
