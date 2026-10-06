#!/usr/bin/env python3
"""faces_ring0 step4 bed chart -> knitout, physical slider mapping.

Wrong in bed_to_knitout.py: same-bed moves went through the opposite hook,
and whole-bed balance was a bare rack left at ±1. Later knits then ran at
that rack, so chart needle numbers (which are post-balance, rack 0) were wrong.

This version:
  * knits only R/L cells, direction + for R and - for L, carrier 1
  * flip is a same-index hook xfer at rack 0
  * every same-bed move (partial increase, decrease stack, whole-bed
    balance, front-bed shift) goes hook -> opposite slider -> new hook,
    then rack 0. Stitches the row does not name stay put.
  * an increase (+R{n} / +L{n}) is a knitout split: after stitch n,
    the next n cells in travel order are the new loops. Each is a
    same-bed split onto that needle (hook -> opposite slider with the
    carrier, rack, slider -> hook, rack 0), not a plain knit and not
    a skipped needle. Back-bed knits stay '+' with falling needle
    numbers, one pass per back stitch.
"""
import re
import sys
from pathlib import Path

BED = Path("/workspace/cmu-knitout/src/faces_ring0_step4_bed.txt")
OUT = Path("/workspace/cmu-knitout/out/faces_ring0_v2.k")

CELL_RE = re.compile(
    r"(?P<left>[FB][^\s@]*|⬆|⬇)@(?P<bed>[FB])(?P<needle>-?\d+)"
)
ARROW_RE = re.compile(r"^([FB])([←→])(\d*)$")
KNIT_RE = re.compile(r"^([FB])(·|\^[RL]|v[RL]|[+-][RL]\d+)$")
INC_RE = re.compile(r"^\+([RL])(\d+)$")
COUNT_RE = re.compile(
    r"(?P<n>\d+)针\s*·\s*前(?P<fc>\d+|空)(?:\[(?P<flo>-?\d+)…(?P<fhi>-?\d+)\])?"
    r"\s*·\s*后(?P<bc>\d+|空)(?:\[(?P<blo>-?\d+)…(?P<bhi>-?\d+)\])?"
)


def parse_rows(text: str):
    lines = text.splitlines()
    rows = []
    i = 0
    while i < len(lines):
        m = re.match(r"  row (\d+) (\S+)\s+(.*)$", lines[i])
        if not m:
            i += 1
            continue
        idx, direction, header = int(m.group(1)), m.group(2), m.group(3)
        cells = []
        note_parts = []
        j = i + 1
        while j < len(lines) and lines[j].startswith("    ") and not lines[j].startswith("  row "):
            stripped = lines[j].strip()
            found = list(CELL_RE.finditer(stripped))
            # Cell lines are only tokens. Notes may mention a cell in prose.
            if found and all(p.strip() == "" or CELL_RE.fullmatch(p) for p in stripped.split()):
                if cells:
                    raise ValueError(f"row {idx}: two cell lines")
                for fm in found:
                    cells.append(
                        {
                            "left": fm.group("left"),
                            "bed": fm.group("bed").lower(),
                            "needle": int(fm.group("needle")),
                            "raw": fm.group(0),
                        }
                    )
            else:
                note_parts.append(stripped)
            j += 1
        rows.append(
            {
                "idx": idx,
                "dir": direction,
                "header": header,
                "note": " ".join(note_parts),
                "cells": cells,
            }
        )
        i = j
    return rows


def arrow_of(cell):
    m = ARROW_RE.match(cell["left"])
    if not m:
        return None
    bed, arrow, num = m.group(1).lower(), m.group(2), m.group(3)
    if bed != cell["bed"]:
        raise ValueError(f"arrow bed mismatch {cell['raw']}")
    steps = int(num) if num else 1
    delta = steps if arrow == "→" else -steps
    return bed, cell["needle"], cell["needle"] + delta, delta


class Emitter:
    def __init__(self):
        self.lines = []
        self.racking = 0

    def add(self, line: str):
        self.lines.append(line)

    def comment(self, text: str):
        self.add(f"; {text}")

    def set_rack(self, value: int):
        if value != self.racking:
            self.add(f"rack {value}")
            self.racking = value

    def xfer(self, src: str, dst: str):
        self.add(f"xfer {src} {dst}")

    def knit(self, direction: str, needle: str):
        if self.racking != 0:
            raise RuntimeError(f"knit {needle} while rack is {self.racking}")
        self.add(f"knit {direction} {needle} 1")

    def split_same_bed(self, direction: str, bed: str, src: int, dst: int):
        """Knit stitch src, then split that loop onto dst on the same bed.

        knitout split knits the source and moves the previous loop to the
        target. Same-bed targets go through the opposite slider, matching
        same_bed_group: front rack = dst-src, back rack = src-dst.
        One split is opened and returned before the next instruction.
        """
        if bed == "b":
            slider = "fs"
            rack = src - dst
        elif bed == "f":
            slider = "bs"
            rack = dst - src
        else:
            raise ValueError(bed)
        if rack == 0:
            raise ValueError(f"split {bed}{src} onto itself")
        if abs(rack) > 4:
            raise ValueError(f"rack {rack} from split {bed}{src}->{bed}{dst}")
        self.set_rack(0)
        self.add(f"split {direction} {bed}{src} {slider}{src} 1")
        self.set_rack(rack)
        self.xfer(f"{slider}{src}", f"{bed}{dst}")
        self.set_rack(0)

    def same_bed_group(self, moves):
        """moves: list of (bed, src, dst), one bed and one delta.

        Back stitch src->dst (user example B18->B19):
            xfer bSrc fsSrc; rack (src-dst); xfer fsSrc bDst; rack 0
        Front stitch uses the back slider, rack = dst-src.
        All sources park on sliders before any of them return, so a
        decrease stack and a whole-bed shift cannot hop twice.
        """
        if not moves:
            return
        bed = moves[0][0]
        delta = moves[0][2] - moves[0][1]
        for b, src, dst in moves:
            if b != bed or (dst - src) != delta:
                raise ValueError(f"mixed move group {moves}")
        if bed == "b":
            slider = "fs"
            rack = -delta  # src - dst
        elif bed == "f":
            slider = "bs"
            rack = delta  # dst - src
        else:
            raise ValueError(bed)
        if abs(rack) > 4:
            raise ValueError(f"rack {rack} from delta {delta}")
        self.set_rack(0)
        for _, src, _ in moves:
            self.xfer(f"{bed}{src}", f"{slider}{src}")
        self.set_rack(rack)
        for _, src, dst in moves:
            self.xfer(f"{slider}{src}", f"{bed}{dst}")
        self.set_rack(0)

    def flip(self, cell):
        self.set_rack(0)
        n = cell["needle"]
        if cell["left"] == "⬇":
            if cell["bed"] != "b":
                raise ValueError(cell["raw"])
            self.xfer(f"b{n}", f"f{n}")
        elif cell["left"] == "⬆":
            if cell["bed"] != "f":
                raise ValueError(cell["raw"])
            self.xfer(f"f{n}", f"b{n}")
        else:
            raise ValueError(cell["raw"])


def occupied_summary(loops):
    front = sorted(n for b, n in loops if b == "f")
    back = sorted(n for b, n in loops if b == "b")
    return front, back


def header_needles(row):
    """Needles the row header already counts, when each bed is a solid span.

    A gapped span (count shorter than lo..hi) is left unknown: the header
    does not say which needle inside the span is empty.
    """
    m = COUNT_RE.search(row["header"])
    if not m:
        return None
    expected = set()
    for side, key_c, key_lo, key_hi in (
        ("f", "fc", "flo", "fhi"),
        ("b", "bc", "blo", "bhi"),
    ):
        raw_c = m.group(key_c)
        if raw_c is None:
            return None
        if raw_c == "空":
            continue
        want_c = int(raw_c)
        lo, hi = m.group(key_lo), m.group(key_hi)
        if lo is None:
            return None
        lo, hi = int(lo), int(hi)
        if hi - lo + 1 != want_c:
            return None
        expected.update((side, n) for n in range(lo, hi + 1))
    return expected


def sync_opened_loops(row, loops):
    """Count increase loops when the chart counts them: at open, not at knit.

    The header after a partial increase already includes the newborn. When
    that span is solid and it only adds needles, those needles are the new
    loops. A later tail shift can then move them. Gapped headers and any
    header that disagrees by more than a pure addition are left to check.
    """
    expected = header_needles(row)
    if expected is None:
        return
    if loops <= expected:
        loops |= expected - loops


def check_header(row, loops, warnings):
    m = COUNT_RE.search(row["header"])
    if not m:
        return
    front, back = occupied_summary(loops)
    want_n = int(m.group("n"))
    if len(loops) != want_n:
        warnings.append(
            f"row {row['idx']} count {len(loops)} != header {want_n} "
            f"F{front} B{back}"
        )
    for side, needles, key_c, key_lo, key_hi in (
        ("F", front, "fc", "flo", "fhi"),
        ("B", back, "bc", "blo", "bhi"),
    ):
        raw_c = m.group(key_c)
        if raw_c == "空":
            if needles:
                warnings.append(f"row {row['idx']} {side} expected empty, have {needles}")
            continue
        want_c = int(raw_c)
        if len(needles) != want_c:
            warnings.append(
                f"row {row['idx']} {side} count {len(needles)} != {want_c} {needles}"
            )
        lo, hi = m.group(key_lo), m.group(key_hi)
        if lo is None:
            continue
        lo, hi = int(lo), int(hi)
        if needles and (needles[0] != lo or needles[-1] != hi):
            warnings.append(
                f"row {row['idx']} {side} span {needles[0]}..{needles[-1]} != {lo}..{hi}"
            )


def convert(rows):
    e = Emitter()
    warnings = []
    loops = set()
    e.add(";!knitout-2")
    e.add(";;Carriers: 1 2 3 4 5 6 7 8 9 10")
    e.add("in 1")

    for row in rows:
        sync_opened_loops(row, loops)
        check_header(row, loops, warnings)
        e.comment(f"row {row['idx']} {row['dir']}")
        d = row["dir"]

        if d in ("R", "L"):
            if e.racking != 0:
                raise RuntimeError(f"row {row['idx']} knit at rack {e.racking}")
            direction = "+" if d == "R" else "-"
            cells = row["cells"]
            i = 0
            while i < len(cells):
                cell = cells[i]
                if not KNIT_RE.match(cell["left"]):
                    raise ValueError(f"row {row['idx']}: not a knit cell {cell['raw']}")
                if cell["left"][0].lower() != cell["bed"]:
                    raise ValueError(f"row {row['idx']}: bed mismatch {cell['raw']}")
                inc = INC_RE.match(cell["left"][1:])
                if inc:
                    added = int(inc.group(2))
                    targets = cells[i + 1 : i + 1 + added]
                    if len(targets) != added:
                        raise ValueError(
                            f"row {row['idx']}: {cell['raw']} needs {added} following loops"
                        )
                    for target in targets:
                        if not KNIT_RE.match(target["left"]):
                            raise ValueError(
                                f"row {row['idx']}: increase target {target['raw']} is not a knit cell"
                            )
                        if target["bed"] != cell["bed"]:
                            raise ValueError(
                                f"row {row['idx']}: {cell['raw']} splits onto {target['raw']}"
                            )
                        e.split_same_bed(direction, cell["bed"], cell["needle"], target["needle"])
                        loops.add((target["bed"], target["needle"]))
                    loops.add((cell["bed"], cell["needle"]))
                    i += 1 + added
                    continue
                e.knit(direction, f"{cell['bed']}{cell['needle']}")
                loops.add((cell["bed"], cell["needle"]))
                i += 1

        elif d == "Flip":
            for cell in row["cells"]:
                src = (cell["bed"], cell["needle"])
                if src not in loops:
                    warnings.append(f"row {row['idx']} flip empty {cell['raw']}")
                e.flip(cell)
                loops.discard(src)
                dst_bed = "f" if cell["bed"] == "b" else "b"
                loops.add((dst_bed, cell["needle"]))

        elif d in ("X", "X+"):
            moves = []
            for cell in row["cells"]:
                parsed = arrow_of(cell)
                if parsed is None:
                    raise ValueError(f"row {row['idx']}: expected arrow, got {cell['raw']}")
                bed, src, dst, _delta = parsed
                if (bed, src) not in loops:
                    warnings.append(
                        f"row {row['idx']} move empty {cell['raw']} -> {bed}{dst}"
                    )
                moves.append((bed, src, dst))
            # One physical rack per bed+delta. Chart order inside the group.
            groups = []
            for mv in moves:
                delta = mv[2] - mv[1]
                if groups and groups[-1][0] == (mv[0], delta):
                    groups[-1][1].append(mv)
                else:
                    groups.append(((mv[0], delta), [mv]))
            for (_key, group) in groups:
                dests = [(b, dst) for b, _s, dst in group]
                if len(dests) != len(set(dests)):
                    warnings.append(f"row {row['idx']} two stitches land on one needle")
                e.same_bed_group(group)
                # Simultaneous: sources leave, then destinations gain them.
                sources = {(b, s) for b, s, _d in group}
                incoming = {(b, dst) for b, _s, dst in group}
                loops -= sources
                loops |= incoming
            if e.racking != 0:
                raise RuntimeError(f"row {row['idx']} left rack at {e.racking}")
        else:
            raise ValueError(f"unknown row dir {d}")

    if e.racking != 0:
        raise RuntimeError(f"end rack {e.racking}")
    e.add("out 1")
    front, back = occupied_summary(loops)
    return e, warnings, front, back


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    bed_path = Path(argv[0]) if len(argv) >= 1 else BED
    out_path = Path(argv[1]) if len(argv) >= 2 else OUT
    text = bed_path.read_text(encoding="utf-8")
    rows = parse_rows(text)
    print(f"parsed {len(rows)} rows", file=sys.stderr)
    if [r["idx"] for r in rows] != list(range(len(rows))):
        raise SystemExit("row indices are not contiguous from 0")
    e, warnings, front, back = convert(rows)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(e.lines) + "\n", encoding="utf-8")
    print(f"wrote {out_path} lines={len(e.lines)}", file=sys.stderr)
    print(f"final F{front} ({len(front)}) B{back} ({len(back)})", file=sys.stderr)
    print(f"warnings={len(warnings)}", file=sys.stderr)
    for w in warnings:
        print(f"WARN {w}", file=sys.stderr)


if __name__ == "__main__":
    main()
