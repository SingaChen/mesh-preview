/**
 * Plain-tube bed chart for Standrad Cylinder.
 *
 * The faces-ring example (?sheet=faces-ring0) draws
 * faces_ring0_step4_bed.xls (dir, F·/B· fills, phys, faces, 此刻活针)
 * and a separate cols_resample field + xls. The bed chart is built
 * from standrad_cylinder_readable_map.txt. Every cell stays plain knit.
 * Front columns 0–12 are F, back columns 13–24 are B. There is no
 * increase, decrease, transfer, flip, or 37−phys mirror.
 *
 * cols_resample is the SingaLab side-edge field
 * (iteration_0_cut_cols_resample_field.obj): 25 polylines on the
 * stitchmesh vertices, not quad centroids. The regenerated tube stands
 * with its height along Y. This script refreshes the matching xls from
 * that field and does not rewrite the field.
 *
 * Does not read or write faces_ring0_step4_bed, the v2 knitout, or any .dat.
 *
 *   node scripts/build-standrad-cylinder-bed.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BIFF8_DEFAULT_PALETTE } from "../src/xls.js";
import { parseColoredObj, parseColsResample, parseColsResampleField, parseReadableMap } from "../src/stitches.js";
import { knitBedsByFace, parseExcelReadableMap } from "../src/excel-map.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cylDir = join(root, "public", "sample", "cylinder");

const PATHS = {
  map: join(cylDir, "standrad_cylinder_readable_map.txt"),
  mesh: join(cylDir, "standrad_cylinder_KnittingStitches.obj"),
  bedXls: join(cylDir, "standrad_cylinder_bed.xls"),
  field: join(cylDir, "standrad_cylinder_cols_resample_field.obj"),
  colsXls: join(cylDir, "standrad_cylinder_cols_resample.xls"),
};

const FILL = {
  plain: "rgb(255,255,255)",
  back: "rgb(204,255,255)",
};

const NCOLS = 25;
const NROWS = 7;
const FRONT = 13;
const BACK = 12;
const BEDS = "25针 · 前13[0…12] · 后12[13…24]";

function fail(msg) {
  throw new Error(`standrad-cylinder-bed: ${msg}`);
}

function loadTube() {
  const map = parseReadableMap(readFileSync(PATHS.map, "utf8"));
  if (map.header?.rows !== NROWS || map.header?.cells !== NROWS * NCOLS) {
    fail(`readable_map is ${map.header?.rows}×${map.header?.cells}, expected ${NROWS}×${NROWS * NCOLS}`);
  }
  if (map.header?.circle !== NCOLS || map.header?.front !== FRONT || map.header?.back !== BACK) {
    fail(`readable_map split is circle=${map.header?.circle} front=${map.header?.front} back=${map.header?.back}`);
  }
  if (map.colMin !== 0 || map.colMax !== NCOLS - 1 || map.rows.length !== NROWS) {
    fail("readable_map columns are not 0–24");
  }
  for (const row of map.rows) {
    if (row.dir !== "R" || row.tokens.length !== NCOLS) fail(`row ${row.row} is not a full R course`);
    if (row.tokens.some((token) => token !== "·")) fail(`row ${row.row} is not all plain knit`);
  }
  const parsed = parseColoredObj(readFileSync(PATHS.mesh, "utf8"));
  if (parsed.faces.length !== NROWS * NCOLS) fail(`stitchmesh has ${parsed.faces.length} faces`);
  return { map, faces: parsed.faces };
}

function bedChart() {
  const sheet = [];
  for (let row = 0; row < NROWS; row++) {
    const cells = [];
    for (let col = 0; col < NCOLS; col++) {
      const bed = col < FRONT ? "F" : "B";
      cells.push({
        col,
        bed,
        phys: col,
        token: `${bed}·`,
        fill: bed === "B" ? FILL.back : FILL.plain,
        face: row * NCOLS + col,
      });
    }
    sheet.push({ dir: "R", beds: BEDS, cells });
  }
  return sheet;
}

function sideEdgeColumns(fieldText, verts) {
  const columns = parseColsResampleField(fieldText);
  if (columns.length !== NCOLS) fail(`cols_resample field has ${columns.length} polylines, expected ${NCOLS}`);
  for (const col of columns) {
    if (col.points.length !== NROWS + 1) fail(`column ${col.col} has ${col.points.length} points, expected ${NROWS + 1}`);
    for (let i = 1; i < col.points.length; i++) {
      if (!(col.points[i].y > col.points[i - 1].y)) fail(`column ${col.col} does not climb the tube`);
    }
    for (const point of col.points) {
      let best = Infinity;
      for (const vert of verts) {
        const d = Math.hypot(point.x - vert.x, point.y - vert.y, point.z - vert.z);
        if (d < best) best = d;
        if (best <= 1e-6) break;
      }
      if (best > 1e-6) fail(`column ${col.col} is ${best} off the stitchmesh`);
    }
  }
  return columns;
}

function icvForFill(fill) {
  const m = String(fill || "").match(/rgb\((\d+),(\d+),(\d+)\)/i);
  if (!m) fail(`fill ${fill}`);
  const rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
  const idx = BIFF8_DEFAULT_PALETTE.findIndex((c, i) => i < 64 && c[0] === rgb[0] && c[1] === rgb[1] && c[2] === rgb[2]);
  if (idx < 0) fail(`no palette color for ${fill}`);
  return idx;
}

function rec(opcode, payload) {
  const body = Buffer.from(payload);
  const out = Buffer.alloc(4 + body.length);
  out.writeUInt16LE(opcode, 0);
  out.writeUInt16LE(body.length, 2);
  body.copy(out, 4);
  return out;
}

function bof(dt) {
  const data = Buffer.alloc(16);
  data.writeUInt16LE(0x0600, 0);
  data.writeUInt16LE(dt, 2);
  data.writeUInt16LE(0x0dbb, 4);
  data.writeUInt16LE(1996, 6);
  return rec(0x0809, data);
}

function eof() {
  return rec(0x000a, Buffer.alloc(0));
}

function xfRecord(icvFore) {
  const data = Buffer.alloc(20);
  data.writeUInt16LE((1 << 10) & 0xffff, 16);
  data.writeUInt16LE(icvFore & 0x7f, 18);
  return rec(0x00e0, data);
}

function labelRecord(row, col, xf, text) {
  const s = String(text ?? "");
  const data = Buffer.alloc(9 + s.length * 2);
  data.writeUInt16LE(row, 0);
  data.writeUInt16LE(col, 2);
  data.writeUInt16LE(xf, 4);
  data.writeUInt16LE(s.length, 6);
  data.writeUInt8(1, 8);
  for (let i = 0; i < s.length; i++) data.writeUInt16LE(s.charCodeAt(i), 9 + i * 2);
  return rec(0x0204, data);
}

function numberRecord(row, col, xf, value) {
  const data = Buffer.alloc(14);
  data.writeUInt16LE(row, 0);
  data.writeUInt16LE(col, 2);
  data.writeUInt16LE(xf, 4);
  data.writeDoubleLE(value, 6);
  return rec(0x0203, data);
}

function boundsheet(offset, name) {
  const data = Buffer.alloc(8 + name.length);
  data.writeUInt32LE(offset, 0);
  data.writeUInt8(name.length, 6);
  data.write(name, 8, "latin1");
  return rec(0x0085, data);
}

function sheetBytes(name, rows, xfIndexForFill) {
  const parts = [bof(0x0010)];
  for (const row of rows) {
    row.forEach((cell, c) => {
      const xf = xfIndexForFill(cell.fill || FILL.plain);
      if (typeof cell.value === "number") parts.push(numberRecord(cell.r, c, xf, cell.value));
      else parts.push(labelRecord(cell.r, c, xf, cell.value ?? ""));
    });
  }
  parts.push(eof());
  return { name, bytes: Buffer.concat(parts) };
}

function writeCfb(workbook) {
  const sectorSize = 4096;
  const dataSectors = Math.ceil(workbook.length / sectorSize) || 1;
  const totalSectors = 2 + dataSectors;
  if (totalSectors > 1024) fail(`workbook needs ${totalSectors} sectors`);
  const fat = Buffer.alloc(sectorSize, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0);
  fat.writeUInt32LE(0xfffffffe, 4);
  for (let i = 0; i < dataSectors; i++) {
    const next = i + 1 < dataSectors ? 2 + i + 1 : 0xfffffffe;
    fat.writeUInt32LE(next, (2 + i) * 4);
  }
  const dir = Buffer.alloc(sectorSize, 0);
  const putName = (entry, name, type, start, size) => {
    const off = entry * 128;
    const chars = [...name, "\0"];
    for (let i = 0; i < chars.length; i++) dir.writeUInt16LE(chars[i].charCodeAt(0), off + i * 2);
    dir.writeUInt16LE(chars.length * 2, off + 64);
    dir[off + 66] = type;
    dir.writeUInt32LE(start >>> 0, off + 116);
    dir.writeUInt32LE(size >>> 0, off + 120);
  };
  putName(0, "Root Entry", 5, 0xfffffffe, 0);
  putName(1, "Workbook", 2, 2, workbook.length);
  const header = Buffer.alloc(512, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x003e, 0x18);
  header.writeUInt16LE(0x0003, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(12, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(1, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(0xfffffffe, 0x3c);
  header.writeUInt32LE(0xfffffffe, 0x44);
  header.writeUInt32LE(0, 0x48);
  header.writeUInt32LE(0, 0x4c);
  for (let i = 1; i < 109; i++) header.writeUInt32LE(0xffffffff, 0x4c + i * 4);
  const data = Buffer.alloc(dataSectors * sectorSize, 0);
  Buffer.from(workbook).copy(data, 0);
  return Buffer.concat([header, fat, dir, data]);
}

function matrixSheet(matrix) {
  return matrix.map((line, r) => line.map((value) => ({ r, value: value ?? "", fill: FILL.plain })));
}

function workbookFromSheets(namedRows) {
  const fills = new Set([FILL.plain]);
  for (const rows of namedRows.map((item) => item.rows)) {
    for (const row of rows) for (const cell of row) if (cell.fill) fills.add(cell.fill);
  }
  const palette = [...fills];
  const xfIndexForFill = (fill) => {
    const i = palette.indexOf(fill || FILL.plain);
    if (i < 0) fail(`missing xf for ${fill}`);
    return i;
  };
  const sheets = namedRows.map((item) => sheetBytes(item.name, item.rows, xfIndexForFill));
  const xfBytes = Buffer.concat(palette.map((fill) => xfRecord(icvForFill(fill))));
  const bofBytes = bof(0x0005);
  const eofBytes = eof();
  const boundsheetLen = sheets.reduce((sum, sheet) => sum + boundsheet(0, sheet.name).length, 0);
  const globalLen = bofBytes.length + xfBytes.length + boundsheetLen + eofBytes.length;
  let cursor = globalLen;
  const bounds = sheets.map((sheet) => {
    const at = cursor;
    cursor += sheet.bytes.length;
    return boundsheet(at, sheet.name);
  });
  const workbook = Buffer.concat([bofBytes, xfBytes, ...bounds, eofBytes, ...sheets.map((sheet) => sheet.bytes)]);
  return writeCfb(workbook);
}

function bedWorkbook(sheet) {
  const needles = Array.from({ length: NCOLS }, (_, n) => n);
  const bedRows = [];
  const head = [{ r: 0, value: "dir\\col", fill: FILL.plain }];
  for (const n of needles) head.push({ r: 0, value: n, fill: FILL.plain });
  head.push({ r: 0, value: "此刻活针", fill: FILL.plain });
  bedRows.push(head);
  sheet.forEach((row, i) => {
    const line = [{ r: i + 1, value: row.dir, fill: FILL.plain }];
    for (const cell of row.cells) line.push({ r: i + 1, value: cell.token, fill: cell.fill });
    line.push({ r: i + 1, value: row.beds, fill: FILL.plain });
    bedRows.push(line);
  });
  const legend = [
    ["input", "standrad_cylinder_readable_map.txt. 7 rows, columns 0-24, every cell plain knit, every row dir=R."],
    ["beds", "Front bed columns 0-12 (13 needles, F0-F12). Back bed columns 13-24 (12 needles, B13-B24)."],
    ["此刻活针", `Last column is the seated front/back window: ${BEDS}.`],
    ["pattern", "Plain knit only. No increases, decreases, transfers, or flips."],
    ["draw", "Front column = physical needle. Back column = physical needle. This tube is not drawn as 37 - phys."],
    ["phys", "Sheet phys copies the bed and physical needle of each plain cell."],
    ["faces", "Sheet faces maps each knit cell to the KnittingStitches face. Face index is row * 25 + col."],
    ["cols_resample", "25 side-edge polylines from the SingaLab cols_resample field, on the stitchmesh vertices."],
  ];
  const phys = [["sheetRow", "sheetCol", "bed", "phys"]];
  const faces = [["sheetRow", "sheetCol", "face"]];
  sheet.forEach((row, sheetRow) => {
    for (const cell of row.cells) {
      phys.push([sheetRow, cell.col, cell.bed, cell.phys]);
      faces.push([sheetRow, cell.col, cell.face]);
    }
  });
  return workbookFromSheets([
    { name: "bed", rows: bedRows },
    { name: "legend", rows: matrixSheet(legend) },
    { name: "phys", rows: matrixSheet(phys) },
    { name: "faces", rows: matrixSheet(faces) },
  ]);
}

function colsWorkbook(columns) {
  const detail = [["col", "point_index", "x", "y", "z"]];
  const scale = [["col"]];
  columns.forEach((column) => {
    scale.push([column.col]);
    column.points.forEach((p, index) => detail.push([column.col, index, p.x, p.y, p.z]));
  });
  return workbookFromSheets([
    { name: "points_detail", rows: matrixSheet(detail) },
    { name: "scale_matrix", rows: matrixSheet(scale) },
  ]);
}

function assertBuilt(bedBytes, field, colsBytes) {
  const map = parseExcelReadableMap(bedBytes);
  if (map.sheet !== "bed" || map.bedsHeader !== "此刻活针") fail("bed sheet was not parsed");
  if (map.rows.length !== NROWS || map.needleCols.length !== NCOLS) fail("bed sheet size");
  for (const row of map.rows) {
    if (row.dir !== "R" || row.beds !== BEDS) fail(`row ${row.row} beds ${row.beds}`);
    for (const cell of row.cells) {
      const bed = cell.col < FRONT ? "F" : "B";
      if (cell.token !== `${bed}·` || cell.bed !== bed || cell.phys !== cell.col) {
        fail(`cell ${cell.row},${cell.col} is ${cell.token} ${cell.bed}${cell.phys}`);
      }
      if (cell.faceIndex !== cell.row * NCOLS + cell.col) fail(`face ${cell.faceIndex} at ${cell.row},${cell.col}`);
      if (cell.kind !== "plain") fail(`cell ${cell.row},${cell.col} kind ${cell.kind}`);
    }
  }
  const beds = knitBedsByFace(map);
  if (beds.get(0) !== "F" || beds.get(12) !== "F" || beds.get(13) !== "B" || beds.get(174) !== "B") {
    fail("front/back face beds");
  }
  const columns = parseColsResample({ xls: colsBytes, fieldText: field });
  if (columns.length !== NCOLS || columns.some((col, i) => col.col !== i || col.points.length !== NROWS + 1)) {
    fail(`cols_resample parsed ${columns.length}`);
  }
}

function main() {
  const { faces } = loadTube();
  const sheet = bedChart();
  const field = readFileSync(PATHS.field, "utf8");
  const columns = sideEdgeColumns(field, faces.flatMap((face) => face.verts));
  const bedBytes = bedWorkbook(sheet);
  const colsBytes = colsWorkbook(columns);
  assertBuilt(bedBytes, field, colsBytes);
  writeFileSync(PATHS.bedXls, bedBytes);
  writeFileSync(PATHS.colsXls, colsBytes);
  console.log(`standrad-cylinder-bed ok: ${NROWS}×${NCOLS} plain, ${BEDS}, cols_resample ${columns.length} side edges`);
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
