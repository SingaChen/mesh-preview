/**
 * The faces bed chart is one sheet: ring 0, then ring 1.
 * This entry writes that same sheet.
 *
 *   node scripts/build-step4-faces-ring1.mjs
 */

import { buildJoinedChart, renderReport, workbookBytes, DEFAULT_PATHS } from "./build-step4-faces-ring0.mjs";
import { writeFileSync } from "node:fs";

const built = buildJoinedChart();
writeFileSync(DEFAULT_PATHS.outXls, workbookBytes(built));
writeFileSync(DEFAULT_PATHS.outTxt, renderReport(built));
console.log(renderReport(built));
