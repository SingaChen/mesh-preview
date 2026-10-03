#!/usr/bin/env python3
"""Convert faces_ring0_step4_bed.txt to knitout per Singa locked mapping.

Default input is public/sample/cylinder/faces_ring0_step4_bed.txt.
Default output is public/sample/cylinder/faces_ring0.k.
knitout-to-dat.js is CMU's SWGN2 backend and stays outside this repo.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BED = ROOT / "public/sample/cylinder/faces_ring0_step4_bed.txt"
OUT = ROOT / "public/sample/cylinder/faces_ring0.k"

CELL_RE = re.compile(
    r"(?P<token>(?P<left>[FB][^\s@]*|⬆|⬇)@(?P<bed>[FB])(?P<needle>-?\d+))"
)
ARROW_RE = re.compile(r"^([FB])([←→])(\d*)$")


def parse_rows(text: str):
    lines = text.splitlines()
    rows = []
    i = 0
    while i < len(lines):
        m = re.match(r"  row (\d+) (\S+)\s+(.*)$", lines[i])
        if not m:
            i += 1
            continue
        idx, direction, header_rest = int(m.group(1)), m.group(2), m.group(3)
        cells_line = ""
        note = ""
        if i + 1 < len(lines) and lines[i + 1].startswith("    "):
            nxt = lines[i + 1].strip()
            # cell line vs note-only
            if CELL_RE.search(nxt) or nxt.startswith("⬆") or nxt.startswith("⬇"):
                cells_line = nxt
                j = i + 2
            else:
                j = i + 1
            # gather following indented note lines that aren't a new row
            notes = []
            while j < len(lines) and lines[j].startswith("    ") and not re.match(r"  row ", lines[j]):
                # stop if next row somehow
                if re.match(r"  row \d+", lines[j]):
                    break
                notes.append(lines[j].strip())
                j += 1
                # usually one note line
                if j < len(lines) and re.match(r"  row \d+", lines[j]):
                    break
            note = " ".join(notes)
            i = j
        else:
            i += 1
        cells = list(CELL_RE.finditer(cells_line)) if cells_line else []
        rows.append(
            {
                "idx": idx,
                "dir": direction,
                "header": header_rest,
                "cells_line": cells_line,
                "note": note,
                "cells": cells,
            }
        )
    return rows


def is_whole_bed_rack(note: str) -> bool:
    n = note
    if re.search(r"\bRack\b", n, re.I):
        return True
    if re.search(r"rack the back", n, re.I):
        return True
    if re.search(r"−1 rack|-1 rack", n, re.I):
        return True
    if re.search(r"front seats toward F0", n, re.I):
        return True
    return False


def rack_delta_from_note(note: str):
    """Return signed integer delta for a whole-bed rack note."""
    # Prefer explicit Rack B -1 / +1
    m = re.search(r"Rack\s*B\s*([+-]?\d+)", note, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"Rack the back\s*([+−-]?\d+)", note, re.I)
    if m:
        s = m.group(1).replace("−", "-")
        return int(s)
    m = re.search(r"back\s*([+−-])\s*1", note, re.I)
    if m:
        return 1 if m.group(1) in "+＋" else -1
    m = re.search(r"([−-])1\s*rack", note, re.I)
    if m:
        return -1
    m = re.search(r"\+1\s*rack|rack.*\+1", note, re.I)
    if m and re.search(r"\+1", note):
        # careful: "Rack the back +1"
        if re.search(r"back\s*\+1|\+1 so", note, re.I) or re.search(r"Rack the back \+1", note):
            return 1
    m = re.search(r"front seats toward F0 by\s*([+−-]?\d+)", note, re.I)
    if m:
        return int(m.group(1).replace("−", "-"))
    # clear ... with a -1 rack
    if re.search(r"clear .* with a\s*[−-]1\s*rack", note, re.I):
        return -1
    if re.search(r"Rack the back \+1|back \+1 so", note):
        return 1
    if re.search(r"Rack the back [−-]1|back [−-]1 so", note):
        return -1
    raise ValueError(f"cannot parse rack delta from note: {note[:160]}")


def arrow_move(cell):
    """Return (bed_lower, src_needle, dst_needle) for an arrow transfer cell, or None."""
    left = cell.group("left")
    bed = cell.group("bed").lower()
    needle = int(cell.group("needle"))
    if left in ("⬆", "⬇"):
        return None
    m = ARROW_RE.match(left)
    if not m:
        return None
    bed2, arrow, num = m.group(1).lower(), m.group(2), m.group(3)
    assert bed2 == bed
    steps = int(num) if num else 1
    if arrow == "→":
        dst = needle + steps
    else:
        dst = needle - steps
    return bed, needle, dst


class Emitter:
    def __init__(self):
        self.lines = []
        self.racking = 0.0
        self.rack_lines = []
        self.xfer_lines = []

    def add(self, line: str):
        self.lines.append(line)

    def comment(self, c: str):
        self.lines.append(f"; {c}")

    def set_rack(self, value: float):
        # absolute rack in knitout
        if abs(value) > 8:
            raise ValueError(f"rack {value} out of range")
        # avoid no-op duplicates unless we want to show intentional rack pairs
        self.add(f"rack {self._fmt_rack(value)}")
        self.rack_lines.append(self.lines[-1])
        self.racking = float(value)

    def _fmt_rack(self, value: float) -> str:
        if float(value) == int(value):
            return str(int(value))
        return str(value)

    def ensure_rack(self, value: float):
        if self.racking != float(value):
            self.set_rack(value)

    def xfer(self, a: str, b: str):
        self.add(f"xfer {a} {b}")
        self.xfer_lines.append(self.lines[-1])

    def knit(self, direction: str, needle: str):
        self.add(f"knit {direction} {needle} 1")

    def same_bed_move(self, bed: str, src: int, dst: int):
        """Move one stitch on the same bed via opposite bed. Ends at rack 0."""
        if src == dst:
            return
        self.ensure_rack(0)
        if bed == "b":
            # bSrc -> fSrc -> bDst; R such that front = back + R => src = dst + R
            self.xfer(f"b{src}", f"f{src}")
            R = src - dst
            self.set_rack(R)
            self.xfer(f"f{src}", f"b{dst}")
            self.set_rack(0)
        else:
            # fSrc -> bSrc -> fDst; R such that front = back + R => dst = src + R
            self.xfer(f"f{src}", f"b{src}")
            R = dst - src
            self.set_rack(R)
            self.xfer(f"b{src}", f"f{dst}")
            self.set_rack(0)

    def same_bed_moves(self, moves):
        """moves: list of (bed, src, dst). Group by bed+delta and order safely."""
        if not moves:
            return
        # All moves in one X row should share bed and delta typically
        for bed, src, dst in moves:
            pass
        # Order to avoid collisions
        # Positive delta: high src first; negative: low src first
        def key(m):
            bed, src, dst = m
            delta = dst - src
            return (bed, -src if delta > 0 else src)

        for bed, src, dst in sorted(moves, key=key):
            self.same_bed_move(bed, src, dst)

    def flip_cell(self, cell):
        left = cell.group("left")
        bed = cell.group("bed").lower()
        needle = int(cell.group("needle"))
        self.ensure_rack(0)
        if left == "⬇":
            # back -> front same index
            assert bed == "b"
            self.xfer(f"b{needle}", f"f{needle}")
        elif left == "⬆":
            assert bed == "f"
            self.xfer(f"f{needle}", f"b{needle}")
        else:
            raise ValueError(f"bad flip token {cell.group(0)}")


def convert(rows):
    e = Emitter()
    e.add(";!knitout-2")
    e.add(";;Carriers: 1 2 3 4 5 6 7 8 9 10")
    e.add("in 1")

    for row in rows:
        d = row["dir"]
        note = row["note"]
        e.comment(f"row {row['idx']} {d}")

        if d in ("R", "L"):
            direction = "+" if d == "R" else "-"
            for cell in row["cells"]:
                bed = cell.group("bed").lower()
                needle = int(cell.group("needle"))
                # All R/L cells are knits (plain, wrap, inc, dec markers)
                e.knit(direction, f"{bed}{needle}")

        elif d == "Flip":
            for cell in row["cells"]:
                e.flip_cell(cell)

        elif d in ("X", "X+"):
            if is_whole_bed_rack(note):
                delta = rack_delta_from_note(note)
                # Whole-bed shift: emit a rack instruction. Use the signed delta as the
                # absolute racking target for this moment (chart shifts are ±1).
                e.set_rack(delta)
            else:
                moves = []
                for cell in row["cells"]:
                    mv = arrow_move(cell)
                    if mv is None:
                        # unexpected non-arrow on X row
                        left = cell.group("left")
                        if left in ("⬆", "⬇"):
                            e.flip_cell(cell)
                        else:
                            raise ValueError(
                                f"row {row['idx']}: non-arrow cell on X: {cell.group(0)}"
                            )
                    else:
                        moves.append(mv)
                e.same_bed_moves(moves)
        else:
            raise ValueError(f"unknown row dir {d}")

    e.add("out 1")
    return e


def main():
    bed = Path(sys.argv[1]) if len(sys.argv) > 1 else BED
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    text = bed.read_text(encoding="utf-8")
    rows = parse_rows(text)
    print(f"parsed {len(rows)} rows", file=sys.stderr)
    e = convert(rows)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(e.lines) + "\n", encoding="utf-8")
    print(f"wrote {out} lines={len(e.lines)}", file=sys.stderr)
    print(f"rack_ops={len(e.rack_lines)} xfer_ops={len(e.xfer_lines)}", file=sys.stderr)


if __name__ == "__main__":
    main()
