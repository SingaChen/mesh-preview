/**
 * Remap the Step3 stitch_map_bind onto the Step4 beds xls.
 *
 * Mapping is derived ONLY from the Step4 sheet row order:
 *   skip Flip rows, then skip the trailing home X.
 * The remaining 121 rows must match the Step3 bind 1:1
 * (dir / line_kind / column set; labels compared after stripping
 * the F/B bed prefix and absolute L/R on arrows).
 *
 * Usage:
 *   node scripts/remap-bind-step4.mjs            # write stitch_map_bind.json
 *   node scripts/remap-bind-step4.mjs --check    # validate + compare committed file
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { excelGlyphToken, parseExcelReadableMap } from "../src/excel-map.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cylDir = join(root, "public", "sample", "cylinder");

export const DEFAULT_PATHS = {
  step3Bind: join(cylDir, "stitch_map_bind_step3.json"),
  step4Xls: join(cylDir, "iteration_0_cut_readable_map_step4_beds.xls"),
  outBind: join(cylDir, "stitch_map_bind.json"),
};

export function stripBedPrefix(label) {
  return excelGlyphToken(label);
}

export function normalizeBindLabel(label) {
  return stripBedPrefix(label)
    .replace(/←[RL](\d+)/g, "←$1")
    .replace(/→[RL](\d+)/g, "→$1");
}

export function xlsLineKind(dir) {
  if (dir === "Flip") return "flip";
  if (dir === "X+") return "xfer_inc";
  if (dir === "X") return "xfer";
  if (dir === "R" || dir === "L") return "knit";
  throw new Error(`remap-bind-step4: unexpected xls dir ${JSON.stringify(dir)}`);
}

function occupiedColsFromXls(row) {
  return new Set((row?.cells || []).filter((c) => c.token).map((c) => c.col));
}

function occupiedColsFromBind(row) {
  return new Set((row?.cells || []).map((c) => c.col).filter((c) => c != null));
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function fail(msg) {
  throw new Error(`remap-bind-step4: ${msg}`);
}

/**
 * Split Step4 xls rows into Flip / home / rows aligned to the Step3 bind.
 * Home is the trailing X after Flips are removed — never a hand-picked index.
 */
export function splitStep4Rows(step4Rows, step3Bind) {
  if (!step4Rows?.length) fail("Step4 xls has no data rows");
  const expected = Number(step3Bind?.n_display_rows ?? step3Bind?.display_rows?.length);
  if (!Number.isFinite(expected) || expected < 1) fail("Step3 bind is missing n_display_rows");
  if ((step3Bind.display_rows || []).length !== expected) {
    fail(`Step3 display_rows length ${step3Bind.display_rows.length} != n_display_rows ${expected}`);
  }

  const flips = [];
  const nonFlip = [];
  for (const row of step4Rows) {
    if (row.dir === "Flip") flips.push(row);
    else nonFlip.push(row);
  }
  if (nonFlip.length !== expected + 1) {
    fail(
      `after dropping ${flips.length} Flip rows expected ${expected} bind rows + 1 home, got ${nonFlip.length}`,
    );
  }
  const home = nonFlip[nonFlip.length - 1];
  if (home.dir !== "X" || home !== step4Rows[step4Rows.length - 1]) {
    fail(`trailing home row must be the last xls row and dir=X, got dir=${home?.dir} row=${home?.row}`);
  }
  const aligned = nonFlip.slice(0, -1);
  if (aligned.length !== expected) fail(`aligned row count ${aligned.length} != ${expected}`);
  return { flips, home, aligned, expected };
}

/** step3 display_row → step4 display_row, derived from xls order only. */
export function buildStep3ToStep4(step4Rows, split) {
  const step3ToStep4 = [];
  let i = 0;
  for (const row of step4Rows) {
    if (row.dir === "Flip") continue;
    if (row === split.home) continue;
    if (i >= split.expected) fail(`extra non-flip row at step4 ${row.row}`);
    if (row.row !== step4Rows[row.row]?.row) fail(`xls row.row ${row.row} is not its own index`);
    step3ToStep4[i] = row.row;
    i += 1;
  }
  if (step3ToStep4.length !== split.expected) {
    fail(`mapping length ${step3ToStep4.length} != ${split.expected}`);
  }
  return step3ToStep4;
}

export function assertAlignedRowsMatch(aligned, step3Bind) {
  const bindRows = step3Bind.display_rows;
  const mismatches = [];
  for (let i = 0; i < aligned.length; i++) {
    const xls = aligned[i];
    const bind = bindRows[i];
    const kind = xlsLineKind(xls.dir);
    const xlsCols = occupiedColsFromXls(xls);
    const bindCols = occupiedColsFromBind(bind);
    const problems = [];
    if (xls.dir !== bind.dir) problems.push(`dir xls=${xls.dir} bind=${bind.dir}`);
    if (kind !== bind.line_kind) problems.push(`kind xls=${kind} bind=${bind.line_kind}`);
    if (xlsCols.size !== bindCols.size) {
      problems.push(`cell count xls=${xlsCols.size} bind=${bindCols.size}`);
    }
    if (!setEq(xlsCols, bindCols)) {
      problems.push(`cols xls=[${[...xlsCols].sort((a, b) => a - b)}] bind=[${[...bindCols].sort((a, b) => a - b)}]`);
    }
    // Knit glyphs must match after stripping the Step4 F/B prefix.
    // Transfer arrows are rewritten to absolute L/R and mirrored on the
    // back bed (B→R1 vs Step3 ←1) — only dir/kind/columns are required there.
    if (kind === "knit") {
      for (const cell of bind.cells || []) {
        const xlsCell = (xls.cells || []).find((c) => c.col === cell.col);
        const got = normalizeBindLabel(xlsCell?.token ?? "");
        const want = normalizeBindLabel(cell.label ?? "");
        if (got !== want) {
          problems.push(
            `label col ${cell.col}: xls=${JSON.stringify(xlsCell?.token)} bind=${JSON.stringify(cell.label)}`,
          );
        }
      }
    }
    if (problems.length) mismatches.push(`step3 ${i} / step4 ${xls.row}: ${problems.join("; ")}`);
  }
  if (mismatches.length) {
    fail(`xls vs Step3 bind mismatch (${mismatches.length}):\n  ${mismatches.slice(0, 12).join("\n  ")}`);
  }
}

function remapCell(cell, step3ToStep4) {
  if (!cell || typeof cell !== "object") return cell;
  if (cell.display_row == null) return { ...cell };
  const next = step3ToStep4[cell.display_row];
  if (next == null) fail(`no Step4 row for Step3 display_row ${cell.display_row}`);
  return { ...cell, display_row: next };
}

function cellsFromXls(row, { kind, lineKind }) {
  return (row.cells || [])
    .filter((c) => c.token)
    .map((c) => ({
      col: c.col,
      label: c.token,
      kind,
      term_type: -1,
      path_index: -1,
      term_index: -1,
      bindable: false,
    }));
}

export function remapBind(step3Bind, step4Rows) {
  const split = splitStep4Rows(step4Rows, step3Bind);
  assertAlignedRowsMatch(split.aligned, step3Bind);
  const step3ToStep4 = buildStep3ToStep4(step4Rows, split);

  const remappedRows = (step3Bind.display_rows || []).map((row) => ({
    ...row,
    display_row: step3ToStep4[row.display_row],
  }));
  const flipRows = split.flips.map((row) => ({
    display_row: row.row,
    line_kind: "flip",
    dir: "Flip",
    is_knit: false,
    is_transfer: false,
    is_flip: true,
    cells: cellsFromXls(row, { kind: "flip" }),
  }));
  const homeRow = {
    display_row: split.home.row,
    line_kind: "xfer_home",
    dir: "X",
    is_knit: false,
    is_transfer: true,
    is_flip: false,
    cells: cellsFromXls(split.home, { kind: "xfer" }),
  };
  const display_rows = [...remappedRows, ...flipRows, homeRow].sort((a, b) => a.display_row - b.display_row);
  if (display_rows.length !== step4Rows.length) {
    fail(`remapped display_rows ${display_rows.length} != step4 rows ${step4Rows.length}`);
  }
  for (let i = 0; i < display_rows.length; i++) {
    if (display_rows[i].display_row !== i) fail(`display_rows not dense at ${i}`);
  }

  const faces = (step3Bind.faces || []).map((face) => ({
    ...face,
    cells: (face.cells || []).map((cell) => remapCell(cell, step3ToStep4)),
  }));
  const term_to_cells = {};
  for (const [key, cells] of Object.entries(step3Bind.term_to_cells || {})) {
    term_to_cells[key] = (cells || []).map((cell) => remapCell(cell, step3ToStep4));
  }

  const notes = [
    ...(step3Bind.notes || []),
    "Step4 display_row remapped from the Step3 bind by skipping Flip rows (and the trailing home X) in step4_beds.xls — xls row order only, no hand-edited coordinates",
    "Flip (line_kind flip) and trailing home X (line_kind xfer_home) are non-bindable; path_index=term_index=-1; never highlight from stitch click",
  ];

  return {
    ...step3Bind,
    source: "remap_bind_step4: Step3 generate_step3_xfer bind + iteration_0_cut_readable_map_step4_beds.xls",
    notes,
    n_display_rows: display_rows.length,
    n_flip_rows: split.flips.length,
    n_xfer_home_rows: 1,
    step3_to_step4: step3ToStep4,
    display_rows,
    faces,
    term_to_cells,
  };
}

export function loadInputs({
  step3BindPath = DEFAULT_PATHS.step3Bind,
  step4XlsPath = DEFAULT_PATHS.step4Xls,
} = {}) {
  const step3Bind = JSON.parse(readFileSync(step3BindPath, "utf8"));
  const step4Map = parseExcelReadableMap(readFileSync(step4XlsPath));
  return { step3Bind, step4Map };
}

export function remapFromFiles(paths = {}) {
  const { step3Bind, step4Map } = loadInputs(paths);
  return { bind: remapBind(step3Bind, step4Map.rows), step4Map, step3Bind };
}

export function assertCommittedMatches(bind, outPath = DEFAULT_PATHS.outBind) {
  const committed = JSON.parse(readFileSync(outPath, "utf8"));
  const want = JSON.stringify(bind);
  const got = JSON.stringify(committed);
  if (want !== got) {
    fail(`committed ${outPath} does not match remapped output — re-run node scripts/remap-bind-step4.mjs`);
  }
}

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    write: argv.includes("--write") || !argv.includes("--check"),
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const { bind } = remapFromFiles();
  if (args.check) {
    assertCommittedMatches(bind);
    console.log(
      `remap-bind-step4 check ok: ${bind.n_display_rows} rows, ${bind.n_flip_rows} Flip, home @ ${bind.n_display_rows - 1}, map ${bind.step3_to_step4[0]}…${bind.step3_to_step4.at(-1)}`,
    );
    return bind;
  }
  if (args.write) {
    writeFileSync(DEFAULT_PATHS.outBind, `${JSON.stringify(bind, null, 2)}\n`);
    console.log(`wrote ${DEFAULT_PATHS.outBind} (${bind.n_display_rows} display rows)`);
  }
  return bind;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
