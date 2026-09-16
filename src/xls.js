/**
 * Minimal OLE Compound File + BIFF8 reader for SingaLab .xls exports.
 * Returns workbook.sheets[] with { name, rows } (dense 2D cell values).
 */

const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

export function toUint8(data) {
  if (!data) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("xls: expected ArrayBuffer / Uint8Array");
}

function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

function readI32(view, offset) {
  return view.getInt32(offset, true);
}

function readF64(view, offset) {
  return view.getFloat64(offset, true);
}

function decodeUtf16(bytes, offset, units) {
  const codes = [];
  for (let i = 0; i < units; i++) {
    codes.push(bytes[offset + i * 2] | (bytes[offset + i * 2 + 1] << 8));
  }
  return String.fromCharCode(...codes);
}

function readCfb(bytes) {
  if (bytes.length < 512) throw new Error("xls: file too small");
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== CFB_SIG[i]) throw new Error("xls: not a Compound File");
  }
  const view = viewOf(bytes);
  const sectorShift = readU16(view, 0x1e);
  const sectorSize = 1 << sectorShift;
  const miniShift = readU16(view, 0x20);
  const miniSize = 1 << miniShift;
  const dirStart = readU32(view, 0x30);
  const miniCutoff = readU32(view, 0x38);
  const miniFatStart = readU32(view, 0x3c);
  const difatStart = readU32(view, 0x44);
  const difatCount = readU32(view, 0x48);

  const difat = [];
  for (let i = 0; i < 109; i++) {
    const id = readU32(view, 0x4c + i * 4);
    if (id !== FREESECT) difat.push(id);
  }
  let difatSec = difatStart;
  for (let n = 0; n < difatCount && difatSec < ENDOFCHAIN; n++) {
    const off = 512 + difatSec * sectorSize;
    const last = sectorSize / 4 - 1;
    for (let i = 0; i < last; i++) {
      const id = readU32(view, off + i * 4);
      if (id !== FREESECT) difat.push(id);
    }
    difatSec = readU32(view, off + last * 4);
  }

  const fat = [];
  for (const fatSec of difat) {
    const off = 512 + fatSec * sectorSize;
    for (let i = 0; i < sectorSize / 4; i++) fat.push(readU32(view, off + i * 4));
  }

  const chain = (start) => {
    const out = [];
    const seen = new Set();
    let cur = start;
    while (cur < ENDOFCHAIN) {
      if (seen.has(cur) || cur >= fat.length) break;
      seen.add(cur);
      out.push(cur);
      cur = fat[cur];
    }
    return out;
  };

  const readChain = (start, size) => {
    const secs = chain(start);
    const out = new Uint8Array(Math.max(0, size));
    let pos = 0;
    for (const sec of secs) {
      if (pos >= size) break;
      const off = 512 + sec * sectorSize;
      const n = Math.min(sectorSize, size - pos);
      out.set(bytes.subarray(off, off + n), pos);
      pos += n;
    }
    return out;
  };

  const dirBytes = (() => {
    const secs = chain(dirStart);
    const out = new Uint8Array(secs.length * sectorSize);
    secs.forEach((sec, i) => {
      const off = 512 + sec * sectorSize;
      out.set(bytes.subarray(off, off + sectorSize), i * sectorSize);
    });
    return out;
  })();

  const entries = [];
  for (let i = 0; i + 128 <= dirBytes.length; i += 128) {
    const dv = viewOf(dirBytes.subarray(i, i + 128));
    const nameLen = readU16(dv, 64);
    const name = decodeUtf16(dirBytes, i, Math.max(0, Math.floor(nameLen / 2) - 1)).replace(/\0+$/g, "");
    const type = dirBytes[i + 66];
    const start = readU32(dv, 116);
    const size = readU32(dv, 120);
    entries.push({ name, type, start, size });
  }

  const root = entries.find((e) => e.type === 5) || entries[0];
  const miniFat = [];
  if (root && miniFatStart < ENDOFCHAIN) {
    const mf = readChain(miniFatStart, chain(miniFatStart).length * sectorSize);
    const mv = viewOf(mf);
    for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(readU32(mv, i));
  }
  const miniStore = root ? readChain(root.start, root.size) : new Uint8Array(0);

  const readStream = (entry) => {
    if (!entry || entry.type !== 2) return null;
    if (entry.size < miniCutoff && miniFat.length) {
      const out = new Uint8Array(entry.size);
      let cur = entry.start;
      let pos = 0;
      const seen = new Set();
      while (cur < ENDOFCHAIN && pos < entry.size) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const n = Math.min(miniSize, entry.size - pos);
        out.set(miniStore.subarray(cur * miniSize, cur * miniSize + n), pos);
        pos += n;
        cur = miniFat[cur];
      }
      return out;
    }
    return readChain(entry.start, entry.size);
  };

  const stream = (want) => {
    const hit = entries.find((e) => e.type === 2 && e.name.toLowerCase() === want.toLowerCase());
    return hit ? readStream(hit) : null;
  };

  return { stream, entries };
}

function decodeRk(value) {
  const cent = value & 1;
  let num;
  if (value & 2) {
    num = value >> 2;
  } else {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setUint32(4, value & 0xfffffffc, true);
    num = dv.getFloat64(0, true);
  }
  return cent ? num / 100 : num;
}

function parseSst(records) {
  const first = records[0];
  if (first.length < 8) return [];
  const unique = first[4] | (first[5] << 8) | (first[6] << 16) | (first[7] << 24);
  const chunks = [first.subarray(8)];
  for (let i = 1; i < records.length; i++) chunks.push(records[i]);

  const strings = [];
  let ci = 0;
  let off = 0;

  const avail = () => (ci >= chunks.length ? 0 : chunks[ci].length - off);
  const need = (n) => {
    while (avail() < n && ci + 1 < chunks.length) {
      const left = chunks[ci].subarray(off);
      ci += 1;
      off = 0;
      const merged = new Uint8Array(left.length + chunks[ci].length);
      merged.set(left);
      merged.set(chunks[ci], left.length);
      chunks[ci] = merged;
    }
    return avail() >= n;
  };
  const take = (n) => {
    if (!need(n)) return null;
    const slice = chunks[ci].subarray(off, off + n);
    off += n;
    return slice;
  };

  for (let s = 0; s < unique; s++) {
    const hdr = take(3);
    if (!hdr) break;
    const cch = hdr[0] | (hdr[1] << 8);
    let flags = hdr[2];
    let rich = 0;
    let asian = 0;
    if (flags & 0x08) {
      const r = take(2);
      if (!r) break;
      rich = r[0] | (r[1] << 8);
    }
    if (flags & 0x04) {
      const a = take(4);
      if (!a) break;
      asian = a[0] | (a[1] << 8) | (a[2] << 16) | (a[3] << 24);
    }
    let chars = "";
    let remaining = cch;
    let wide = Boolean(flags & 1);
    while (remaining > 0) {
      if (avail() <= 0) {
        if (ci + 1 >= chunks.length) break;
        ci += 1;
        off = 0;
        const fl = take(1);
        if (!fl) break;
        wide = Boolean(fl[0] & 1);
      }
      const unit = wide ? 2 : 1;
      const can = Math.min(remaining, Math.floor(avail() / unit));
      if (can <= 0) {
        if (ci + 1 >= chunks.length) break;
        continue;
      }
      const raw = take(can * unit);
      if (!raw) break;
      if (wide) chars += decodeUtf16(raw, 0, can);
      else chars += String.fromCharCode(...raw);
      remaining -= can;
    }
    if (rich) take(rich * 4);
    if (asian) take(asian);
    strings.push(chars);
  }
  return strings;
}

function setCell(rows, r, c, value) {
  if (r < 0 || c < 0) return;
  while (rows.length <= r) rows.push([]);
  const row = rows[r];
  while (row.length <= c) row.push("");
  row[c] = value;
}

function parseBiffWorkbook(bytes) {
  const view = viewOf(bytes);
  const records = [];
  let pos = 0;
  while (pos + 4 <= bytes.length) {
    const opcode = readU16(view, pos);
    const len = readU16(view, pos + 2);
    if (pos + 4 + len > bytes.length) break;
    records.push({ opcode, data: bytes.subarray(pos + 4, pos + 4 + len), offset: pos });
    pos += 4 + len;
  }

  const sheetsMeta = [];
  const sstParts = [];
  for (const rec of records) {
    if (rec.opcode === 0x0085 && rec.data.length >= 8) {
      const dv = viewOf(rec.data);
      const offset = readU32(dv, 0);
      const nameLen = rec.data[6];
      const opt = rec.data[7];
      let name;
      if (opt & 1) name = decodeUtf16(rec.data, 8, nameLen);
      else name = String.fromCharCode(...rec.data.subarray(8, 8 + nameLen));
      sheetsMeta.push({ name, offset });
    } else if (rec.opcode === 0x00fc) {
      sstParts.push(rec.data);
    } else if (rec.opcode === 0x003c && sstParts.length) {
      sstParts.push(rec.data);
    }
  }
  const sst = sstParts.length ? parseSst(sstParts) : [];

  const parseSheet = (startOffset) => {
    const rows = [];
    let p = startOffset;
    while (p + 4 <= bytes.length) {
      const opcode = readU16(view, p);
      const len = readU16(view, p + 2);
      const data = bytes.subarray(p + 4, p + 4 + len);
      const dv = viewOf(data);
      p += 4 + len;
      if (opcode === 0x000a) break;
      if (data.length < 4 && opcode !== 0x0203) continue;
      if (opcode === 0x0203 && data.length >= 14) {
        setCell(rows, readU16(dv, 0), readU16(dv, 2), readF64(dv, 6));
      } else if (opcode === 0x027e && data.length >= 10) {
        setCell(rows, readU16(dv, 0), readU16(dv, 2), decodeRk(readU32(dv, 6)));
      } else if (opcode === 0x00bd && data.length >= 6) {
        const row = readU16(dv, 0);
        const first = readU16(dv, 2);
        const last = readU16(dv, data.length - 2);
        let col = first;
        let o = 4;
        while (col <= last && o + 6 <= data.length - 2) {
          setCell(rows, row, col, decodeRk(readU32(dv, o + 2)));
          o += 6;
          col += 1;
        }
      } else if (opcode === 0x00fd && data.length >= 10) {
        const idx = readU32(dv, 6);
        setCell(rows, readU16(dv, 0), readU16(dv, 2), sst[idx] ?? "");
      } else if (opcode === 0x0204 && data.length >= 8) {
        const n = readU16(dv, 6);
        let text;
        if (data.length >= 9 + n && data[8] <= 1) {
          const wide = data[8] === 1;
          text = wide
            ? decodeUtf16(data, 9, n)
            : String.fromCharCode(...data.subarray(9, 9 + n));
        } else {
          text = String.fromCharCode(...data.subarray(8, 8 + n));
        }
        setCell(rows, readU16(dv, 0), readU16(dv, 2), text);
      } else if (opcode === 0x0006 && data.length >= 14) {
        const row = readU16(dv, 0);
        const col = readU16(dv, 2);
        const result = readF64(dv, 6);
        if (Number.isFinite(result)) setCell(rows, row, col, result);
      }
    }
    return rows;
  };

  const sheets = sheetsMeta.map((meta) => ({
    name: meta.name,
    rows: parseSheet(meta.offset),
  }));
  return { sheets };
}

export function parseXlsWorkbook(data) {
  const bytes = toUint8(data);
  const cfb = readCfb(bytes);
  const book = cfb.stream("Workbook") || cfb.stream("Book");
  if (!book) throw new Error("xls: Workbook stream missing");
  return parseBiffWorkbook(book);
}

export function findXlsSheet(workbook, pred) {
  if (!workbook?.sheets?.length) return null;
  if (typeof pred === "string") {
    const want = pred.toLowerCase();
    return workbook.sheets.find((s) => s.name.toLowerCase() === want) || null;
  }
  if (pred instanceof RegExp) {
    return workbook.sheets.find((s) => pred.test(s.name)) || null;
  }
  if (typeof pred === "function") {
    return workbook.sheets.find(pred) || null;
  }
  return workbook.sheets[0] || null;
}
