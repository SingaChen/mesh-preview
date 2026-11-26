#!/usr/bin/env python3
"""Write knitting-code matrices with SingaLab's DATFile.

The encoder is `save_matrix_to_dat` from SingaLab branch
`single-knitting-compiler` (`csv2dat.py`), which calls
`dependence/datfile.py` `DATFile`. This script does not reimplement the
palette, header, or run-length encoding.

The matrix is the on-screen knitting-code table, top row first. The flip
below is the one in `save_matrix_to_dat`: matrix row 0 becomes the top of
the image, and the first course (the bottom of the table) is file y=0.
"""

import json
import sys
from pathlib import Path

from dependence.datfile import DATFile


def save_matrix_to_dat(matrix, save_path):
    """
    将matrix保存为DAT文件（与 ui_functions.save_dat 效果相同，但直接接受matrix）

    注意：read_csv 返回的 matrix 尺寸 = 原始CSV尺寸（经过放大再缩小后恢复原尺寸）
    所以这里直接使用 matrix 的尺寸，不需要再缩放。

    参数:
        matrix: 二维列表，包含整数索引值（0-255）
                - 如果matrix是从 read_csv_to_matrix 来的：原始CSV尺寸
                - 如果matrix是从 read_csv 来的：也是原始CSV尺寸（已缩放回原尺寸）
        save_path: 输出DAT文件路径
    """
    if matrix is None or len(matrix) == 0:
        raise ValueError("Cannot save: matrix is None or empty.")

    # 获取matrix尺寸
    height = len(matrix)
    width = len(matrix[0]) if height > 0 else 0

    if width == 0:
        raise ValueError("Cannot save: matrix width is 0.")

    # 创建DATFile对象
    dat_file = DATFile()

    # 直接使用matrix的尺寸（因为matrix已经是最终需要的尺寸）
    # read_csv 的流程：CSV → 放大20倍 → pixmap → 缩小20倍 → matrix（恢复原尺寸）
    # save_dat 的流程：pixmap（放大后的）→ 缩小20倍 → DAT（原尺寸）
    # 所以这里直接使用matrix尺寸即可
    out_width = width
    out_height = height

    dat_file.allocatePixels(out_width, out_height)

    # 将matrix中的索引值写入dat_file
    # 注意：根据save_dat的逻辑，需要反转y坐标（height-y-1）
    for y in range(out_height):
        for x in range(out_width):
            # 获取索引值，确保在0-255范围内
            # 注意：save_dat中使用 height-y-1 来反转y坐标
            idx = int(matrix[height - y - 1][x]) % 256
            # 注意：setPixel的参数是 (y, x, value)
            dat_file.setPixel(y, x, idx)

    # 保存文件
    dat_file.write(save_path)
    print(f"DAT文件已保存到: {save_path}")
    print(f"Matrix尺寸: {width}x{height}, 输出尺寸: {out_width}x{out_height}")


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text())
    for job in jobs:
        path = Path(job["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        save_matrix_to_dat(job["matrix"], str(path))


if __name__ == "__main__":
    main()
