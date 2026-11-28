/**
 * Knitting-code DAT downloads. These are the on-screen tables written with
 * SingaLab DATFile, not the manufacturing beds in sheet-dat.js.
 * `source` is the knitting-code JSON this file was exported from.
 *
 * Official ids serve the new-schedule table under the stable official
 * filename. Experiment ids keep their reviewed DAT files, which are the same
 * bytes. Legacy ids serve the archived previous official bytes.
 */

import { PROMOTED_SCHEDULES, scheduleBaseName } from "./row-schedule-catalog.js";

const FILES = [];

for (const spec of PROMOTED_SCHEDULES) {
  FILES.push({
    id: spec.officialId,
    aliases: spec.officialAliases,
    filename: spec.datFilename,
    source: spec.newKnitSource,
  });
}

for (const spec of PROMOTED_SCHEDULES) {
  FILES.push({
    id: spec.expSheetId,
    filename: spec.expDatFilename,
    source: spec.newKnitSource,
  });
}

for (const spec of PROMOTED_SCHEDULES) {
  FILES.push({
    id: spec.legacyId,
    filename: `legacy-${spec.datFilename}`,
    path: `${spec.archiveDir}/${spec.datFilename}`,
    source: `public/${spec.archiveDir}/${scheduleBaseName(spec.sampleKnitcode)}`,
  });
}

const BY_SHEET = new Map();
for (const file of FILES) {
  const spec = {
    id: file.id,
    path: file.path || `knitcode-dat/${file.filename}`,
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
