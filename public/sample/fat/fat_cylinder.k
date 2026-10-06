;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
in 1
; row 0 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 1 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 2 X+
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack 1
xfer fs2 b1
xfer fs1 b0
xfer fs0 b-1
rack 0
; row 3 X+
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
rack 1
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
xfer fs0 b-1
xfer fs-1 b-2
rack 0
; row 4 X+
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
xfer b-2 fs-2
rack 1
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
xfer fs0 b-1
xfer fs-1 b-2
xfer fs-2 b-3
rack 0
; row 5 X+
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
xfer b-2 fs-2
xfer b-3 fs-3
rack 1
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
xfer fs0 b-1
xfer fs-1 b-2
xfer fs-2 b-3
xfer fs-3 b-4
rack 0
; row 6 X+
xfer f6 bs6
xfer f7 bs7
rack 1
xfer bs6 f7
xfer bs7 f8
rack 0
; row 7 X+
xfer f7 bs7
xfer f8 bs8
rack 1
xfer bs7 f8
xfer bs8 f9
rack 0
; row 8 X+
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
rack 1
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
xfer bs8 f9
xfer bs9 f10
rack 0
; row 9 X+
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
rack 1
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
xfer bs8 f9
xfer bs9 f10
xfer bs10 f11
rack 0
; row 10 R
knit + f0 1
knit + f1 1
split + f2 bs2 1
rack 1
xfer bs2 f3
rack 0
split + f4 bs4 1
rack 1
xfer bs4 f5
rack 0
knit + f6 1
split + f7 bs7 1
rack 1
xfer bs7 f8
rack 0
split + f7 bs7 1
rack 2
xfer bs7 f9
rack 0
split + f10 bs10 1
rack 1
xfer bs10 f11
rack 0
split + b6 fs6 1
rack 1
xfer fs6 b5
rack 0
split + b4 fs4 1
rack 1
xfer fs4 b3
rack 0
split + b2 fs2 1
rack 1
xfer fs2 b1
rack 0
split + b0 fs0 1
rack 1
xfer fs0 b-1
rack 0
knit + b-2 1
split + b-3 fs-3 1
rack 1
xfer fs-3 b-4
rack 0
; row 11 X
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
xfer b-2 fs-2
xfer b-3 fs-3
xfer b-4 fs-4
rack -1
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
xfer fs-1 b0
xfer fs-2 b-1
xfer fs-3 b-2
xfer fs-4 b-3
rack 0
; row 12 X
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
xfer b-2 fs-2
xfer b-3 fs-3
rack -1
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
xfer fs-1 b0
xfer fs-2 b-1
xfer fs-3 b-2
rack 0
; row 13 X
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
xfer b-2 fs-2
rack -1
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
xfer fs-1 b0
xfer fs-2 b-1
rack 0
; row 14 X
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
xfer b-1 fs-1
rack -1
xfer fs9 b10
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
xfer fs-1 b0
rack 0
; row 15 X
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs10 b11
xfer fs9 b10
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 16 X+
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
xfer f11 bs11
rack 1
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
xfer bs8 f9
xfer bs9 f10
xfer bs10 f11
xfer bs11 f12
rack 0
; row 17 R
knit + f0 1
knit + f1 1
split + f2 bs2 1
rack 1
xfer bs2 f3
rack 0
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
knit + f12 1
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 18 Flip
xfer f12 b12
; row 19 X
xfer b12 fs12
xfer b11 fs11
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs12 b11
xfer fs11 b10
xfer fs10 b9
xfer fs9 b8
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 20 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
; row 21 L
knit - f3 1
knit - f2 1
knit - f1 1
knit - f0 1
knit - b0 1
knit - b1 1
knit - b2 1
knit - b3 1
; row 22 R
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
; row 23 L
knit - f5 1
knit - f4 1
; row 24 R
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
; row 25 L
knit - f8 1
knit - f7 1
knit - f6 1
; row 26 R
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
; row 27 L
knit - f11 1
knit - f10 1
; row 28 R
knit + f10 1
knit + f11 1
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
; row 29 L
knit - b6 1
knit - b7 1
knit - b8 1
knit - b9 1
knit - b10 1
knit - b11 1
; row 30 R
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
; row 31 L
knit - b4 1
knit - b5 1
; row 32 R
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
; row 33 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
; row 34 L
knit - f4 1
knit - f3 1
; row 35 R
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
; row 36 L
knit - f6 1
knit - f5 1
; row 37 R
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
; row 38 L
knit - f9 1
knit - f8 1
; row 39 R
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
knit + b11 1
; row 40 L
knit - b11 1
knit - f11 1
; row 41 R
knit + f11 1
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
knit + b5 1
; row 42 L
knit - b5 1
knit - b6 1
; row 43 R
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
; row 44 L
knit - b3 1
knit - b4 1
; row 45 R
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
; row 46 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
; row 47 L
knit - f3 1
knit - f2 1
knit - f1 1
knit - f0 1
knit - b0 1
knit - b1 1
knit - b2 1
knit - b3 1
; row 48 R
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
; row 49 L
knit - f5 1
knit - f4 1
; row 50 R
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
; row 51 L
knit - f8 1
knit - f7 1
knit - f6 1
; row 52 R
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
; row 53 L
knit - f11 1
knit - f10 1
knit - f9 1
; row 54 R
knit + f9 1
knit + f10 1
knit + f11 1
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
; row 55 L
knit - b8 1
knit - b9 1
knit - b10 1
knit - b11 1
; row 56 R
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
; row 57 L
knit - b6 1
knit - b7 1
; row 58 R
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
; row 59 L
knit - b4 1
knit - b5 1
; row 60 R
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
; row 61 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
; row 62 X
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
xfer f11 bs11
rack -1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
xfer bs10 f9
xfer bs11 f10
rack 0
; row 63 Flip
xfer b11 f11
; row 64 X
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs10 b11
xfer fs9 b10
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 65 R
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
knit + b11 1
; row 66 L
knit - b11 1
knit - f11 1
knit - f10 1
; row 67 X
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
rack 1
xfer bs0 f1
xfer bs1 f2
xfer bs2 f3
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
xfer bs8 f9
xfer bs9 f10
xfer bs10 f11
rack 0
; row 68 X
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
xfer f11 bs11
rack -1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
xfer bs10 f9
xfer bs11 f10
rack 0
; row 69 X
xfer b11 fs11
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs11 b10
xfer fs10 b9
xfer fs9 b8
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 70 L
knit - f9 1
knit - f8 1
; row 71 X
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
rack 1
xfer bs0 f1
xfer bs1 f2
xfer bs2 f3
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
xfer bs8 f9
rack 0
; row 72 X
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
rack -1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
xfer bs10 f9
rack 0
; row 73 Flip
xfer b10 f10
; row 74 X
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs9 b10
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 75 L
knit - f7 1
knit - f6 1
; row 76 X
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
rack 1
xfer bs0 f1
xfer bs1 f2
xfer bs2 f3
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
rack 0
; row 77 X
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
xfer f10 bs10
rack -1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
xfer bs10 f9
rack 0
; row 78 X
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs10 b9
xfer fs9 b8
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 79 L
knit - f5 1
knit - f4 1
; row 80 X
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
rack 1
xfer bs0 f1
xfer bs1 f2
xfer bs2 f3
xfer bs3 f4
xfer bs4 f5
rack 0
; row 81 X
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
rack -1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
rack 0
; row 82 Flip
xfer b9 f9
; row 83 X
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 84 L
knit - f3 1
knit - f2 1
knit - f1 1
knit - f0 1
knit - b1 1
; row 85 R
knit + b1 1
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
; row 86 X
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
xfer f8 bs8
xfer f9 bs9
rack -1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
xfer bs7 f6
xfer bs8 f7
xfer bs9 f8
rack 0
; row 87 X
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs9 b8
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 88 R
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + b8 1
knit + b7 1
; row 89 X
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 90 R
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
; row 91 L
knit - b2 1
knit - b3 1
knit - b4 1
knit - b5 1
; row 92 X
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
rack 1
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
rack 0
; row 93 Flip
xfer f8 b8
; row 94 X
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 95 L
knit - b4 1
knit - b5 1
; row 96 X
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
rack 1
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
rack 0
; row 97 X
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
xfer b0 fs0
rack -1
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
xfer fs0 b1
rack 0
; row 98 L
knit - b6 1
knit - b7 1
; row 99 R
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 100 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
; row 101 L
knit - f5 1
knit - f4 1
; row 102 R
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + b7 1
; row 103 Flip
xfer b7 f7
; row 104 Flip
xfer f7 b7
; row 105 X
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 106 R
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
knit + b0 1
out 1
