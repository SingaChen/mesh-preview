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
knit + f7 1
knit + b7 1
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
knit + f7 1
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 2 X+
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
rack -1
xfer bs0 f-1
xfer bs1 f0
xfer bs2 f1
rack 0
; row 3 X+
xfer f-1 bs-1
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
rack -1
xfer bs-1 f-2
xfer bs0 f-1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
rack 0
; row 4 X+
xfer f-2 bs-2
xfer f-1 bs-1
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
rack -1
xfer bs-2 f-3
xfer bs-1 f-2
xfer bs0 f-1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
rack 0
; row 5 X+
xfer f-3 bs-3
xfer f-2 bs-2
xfer f-1 bs-1
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
rack -1
xfer bs-3 f-4
xfer bs-2 f-3
xfer bs-1 f-2
xfer bs0 f-1
xfer bs1 f0
xfer bs2 f1
xfer bs3 f2
xfer bs4 f3
xfer bs5 f4
xfer bs6 f5
rack 0
; row 6 L
knit - b1 1
knit - b2 1
knit - b3 1
knit - b4 1
knit - b5 1
knit - b6 1
knit - b7 1
knit - f7 1
knit - f6 1
knit - f5 1
knit - f4 1
knit - f3 1
knit - f2 1
knit - f1 1
knit - f0 1
knit - f-1 1
knit - f-2 1
knit - f-3 1
knit - f-4 1
; row 7 X
xfer f-4 bs-4
xfer f-3 bs-3
xfer f-2 bs-2
xfer f-1 bs-1
xfer f0 bs0
xfer f1 bs1
xfer f2 bs2
xfer f3 bs3
xfer f4 bs4
xfer f5 bs5
xfer f6 bs6
xfer f7 bs7
rack 1
xfer bs-4 f-3
xfer bs-3 f-2
xfer bs-2 f-1
xfer bs-1 f0
xfer bs0 f1
xfer bs1 f2
xfer bs2 f3
xfer bs3 f4
xfer bs4 f5
xfer bs5 f6
xfer bs6 f7
xfer bs7 f8
rack 0
; row 8 X
xfer f-3 bs-3
xfer f-2 bs-2
xfer f-1 bs-1
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
xfer bs-3 f-2
xfer bs-2 f-1
xfer bs-1 f0
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
; row 9 X
xfer f-2 bs-2
xfer f-1 bs-1
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
rack 1
xfer bs-2 f-1
xfer bs-1 f0
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
rack 0
; row 10 X
xfer f-1 bs-1
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
xfer bs-1 f0
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
; row 11 X
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack -1
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
xfer fs1 b2
rack 0
; row 12 X
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
rack -1
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
xfer fs4 b5
xfer fs3 b4
xfer fs2 b3
rack 0
; row 13 Flip
xfer f11 b11
; row 14 X
xfer b11 fs11
rack 1
xfer fs11 b10
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
rack 1
xfer fs10 b9
xfer fs9 b8
xfer fs8 b7
xfer fs7 b6
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
rack 0
; row 16 Flip
xfer f10 b10
; row 17 X
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
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
rack 0
; row 18 X+
xfer b6 fs6
xfer b5 fs5
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs6 b5
xfer fs5 b4
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 19 X+
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
; row 20 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
; row 21 X
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
; row 22 L
knit - b7 1
knit - b8 1
; row 23 X+
xfer b4 fs4
xfer b3 fs3
xfer b2 fs2
xfer b1 fs1
rack 1
xfer fs4 b3
xfer fs3 b2
xfer fs2 b1
xfer fs1 b0
rack 0
; row 24 R
knit + b8 1
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
; row 25 X+
xfer b10 fs10
xfer b9 fs9
xfer b8 fs8
xfer b7 fs7
xfer b6 fs6
xfer b5 fs5
rack -1
xfer fs10 b11
xfer fs9 b10
xfer fs8 b9
xfer fs7 b8
xfer fs6 b7
xfer fs5 b6
rack 0
; row 26 L
knit - b4 1
knit - b5 1
knit - b6 1
; row 27 Flip
xfer b11 f11
; row 28 X
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
; row 29 R
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
; row 30 R
knit + f0 1
knit + f1 1
knit + f2 1
knit + f3 1
knit + f4 1
knit + f5 1
knit + f6 1
knit + f7 1
knit + f8 1
knit + f9 1
knit + f10 1
knit + f11 1
; row 31 L
knit - f11 1
knit - f10 1
knit - f9 1
knit - f8 1
knit - f7 1
knit - f6 1
knit - f5 1
knit - f4 1
knit - f3 1
knit - f2 1
knit - f1 1
knit - f0 1
knit - b1 1
knit - b2 1
knit - b3 1
knit - b4 1
knit - b5 1
; row 32 R
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
knit + f0 1
knit + f1 1
knit + f2 1
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
knit + b10 1
; row 33 L
knit - b10 1
knit - b11 1
; row 34 R
knit + b11 1
knit + b10 1
knit + b9 1
knit + b8 1
knit + b7 1
; row 35 L
knit - b7 1
knit - b8 1
knit - b9 1
; row 36 R
knit + b9 1
knit + b8 1
knit + b7 1
knit + b6 1
knit + b5 1
knit + b4 1
knit + b3 1
knit + b2 1
knit + b1 1
out 1
