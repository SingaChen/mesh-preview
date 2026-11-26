# import fs
import struct

LEFT_SPACE = 10 + 20*2 + 5
RIGHT_SPACE = 5 + 20*2 + 10
TOP_SPACE = 1 + 2 + 5
BOTTOM_SPACE = 5
BED_NEEDLES = 541


class DATFile:
    def __init__(self, width=0, height=0, filename=None):
        self.filename = filename or 'output.dat'
        self.fullWidth = self.fullHeight = self.fullSize = 0
        self.maxWidth = BED_NEEDLES
        self.width = self.height = 0
        self.data = []
        self.allocate(width, height)
        self.needlePos = 'right'
        self.streaming = False

    def allocate(self, w, h):
        self.width = w or 0
        self.height = h or 0
        size = self.width * self.height
        if size <= 0:
            self.data = []
            return
        self.fullWidth = self.width + LEFT_SPACE + RIGHT_SPACE
        self.fullHeight = self.height + BOTTOM_SPACE + TOP_SPACE
        size = self.fullWidth * self.fullHeight
        if len(self.data) != size:
            self.data = [None] * size

    def allocatePixels(self, w, h):
        self.fullWidth = w
        self.fullHeight = h
        assert w > 0 and h > 0, 'Width and height must be strictly positive'
        size = self.fullWidth * self.fullHeight
        if len(self.data) != size:
            self.data = [None] * size

    def setPixel(self, y, x, value):
        assert y >= 0 and y < self.fullHeight and x >= 0 and x < self.fullWidth, 'Out-of-bound raw write access y=' + \
            str(y) + ', x=' + str(x)
        self.data[self.fullWidth * y + x] = value

    def getPixel(self, y, x):
        assert y >= 0 and y < self.fullHeight and x >= 0 and x < self.fullWidth, 'Out-of-bound raw read access y=' + \
            str(y) + ', x=' + str(x)
        return self.data[self.fullWidth * y + x]

    def write(self, filename=None):
        fname = filename or self.filename

        # write dat file
        array = bytes(self.toBuffer())
        try:
            with open(fname, 'wb') as file:
                file.write(array)
        except:
            with open(fname, 'wb') as file:
                file.write(array)

    def toBuffer(self, margin=None, callback=None):
        if margin and callable(margin):
            callback = margin
            margin = 0

        data = self.data
        width = self.fullWidth
        height = self.fullHeight
        if margin:
            data = DATFile.pad(data, width, height, margin)
            if isinstance(margin, list):
                height += (margin[0] or 0) + (margin[2] or 0)
                width += (margin[1] or 0) + (margin[3] or 0)
            else:
                height += 2 * margin
                width += 2 * margin

        indexLength = DATFile.RLEncode(data, width, height)
        palette = self.getDefaultPalette()
        buffer = bytearray(0x600 + len(indexLength))

        # 使用 struct.pack 将数据打包为字节序列
        packed_data = struct.pack("<HHHHHHHHH",
                                  0,  # x-min
                                  0,  # y-min
                                  width - 1,  # x-max
                                  height - 1,  # y-max
                                  1000,  # magic number
                                  0, 0, 0,  # 其他字段
                                  1000  # magic number
                                  )  # magic number

        # 将打包的数据复制到字节缓冲区中
        buffer[:len(packed_data)] = packed_data

        # Palette begins at offset 0x200
        paletteData = bytearray(palette)
        buffer[0x200:0x500] = paletteData
        # Actual data is in byte pairs, index and length
        indexLengthData = bytearray(indexLength)
        buffer[0x600:] = indexLengthData

        if callback:
            callback(buffer)
        return buffer

    def pad(data, w, h, margin):
        if isinstance(margin, list):
            top = margin[0] if len(margin) > 0 else 0
            right = margin[1] if len(margin) > 1 else 0
            bot = margin[2] if len(margin) > 2 else 0
            left = margin[3] if len(margin) > 3 else 0
        else:
            top = right = bot = left = margin

        width = w + left + right
        height = h + top + bot
        new_data = [0] * (width * height)

        for i in range(bot * width + left, (w * h) + (bot * width + left), width):
            for col in range(w):
                new_data[i + col] = data[col + (i - bot * width - left)]

        return new_data

    def RLEncode(data, w, h):
        indexLength = []
        totalCount = 0
        for y in range(h):
            index = data[y * w] if y * w < len(data) else 0
            assert 0 <= index < 256, "Indexing into 256 size palette: " + \
                str(index)

            length = 0
            for x in range(w):
                next_index = data[y * w + x] if y * w + x < len(data) else 0
                length = length + 1 if index == next_index else length
                assert length <= w, "Length cannot be greater than width."

                if next_index != index or length == 0xff or x + 1 == w:
                    indexLength.append(index)
                    indexLength.append(length)
                    totalCount += length

                    if next_index != index and x + 1 == w:
                        indexLength.append(next_index)
                        indexLength.append(1)
                        totalCount += 1

                    index = next_index
                    length = 0 if length == 0xff else 1

            assert length == 1 or length == 0, "Run length encoding is per row, should have pushed at the end of a row."

        assert totalCount == w * h, "Total length (" + str(totalCount) + ") and data size (" + str(
            w) + " x " + str(h) + " = " + str(w * h) + ") are different."

        return indexLength

    def getDefaultPalette(self, img_order=False):
        # copied palette from argyle example pattern using DAT viewer
        # palette_str = "ff 00 ff 00 ff 00 ff 00 6c 4a ff b4 99 90 80 cf 52 51 eb 00 fc b2 fc fc fc fc 64 d8 eb a0 90 73 9d 73 d8 eb ff b4 ac d7 d8 7f d8 90 ca d8 ae bc 80 9f ff dc fc c0 d8 fc 90 ff fd b4 00 a0 32 32 00 35 d8 d8 a8 c0 ff 99 b7 00 e2 c5 90 c0 90 90 4a 00 90 6d 00 00 66 33 85 99 78 ca b4 90 7d ff ff ff 7f 69 fa 81 fc ac 7f b2 b4 b4 b4 d4 ff 90 ff c0 c0 73 d8 a9 bf b4 ff 90 d8 b2 aa 00 d8 00 fb 90 81 9d 37 ac dd bf b9 3f ef d7 de fd fe 73 2f 8d fb ff fe ed 06 f5 ea ed ad 3d fc fa ef fd 66 8d 7f 7a 5f 79 9b 71 ff ee a8 ff 9f db f5 ff cd f3 e0 fe c8 79 73 1f bf e5 f3 f6 e0 de f0 cc 4b 64 40 a1 f7 1a e0 67 ff 64 f5 3f 97 ef 14 96 d7 67 b7 ee ba ea 6c bd 26 4e 64 2f bf 9f 7f f3 aa ff e6 bf 57 eb 06 fe 4f ed 6a ef 62 b7 dd cf 66 6b b2 7a 5a f7 9c 4c 96 9d 00 00 6e c8 00 64 00 00 ff ff 00 00 ff ff 24 89 67 b4 99 6c 80 90 91 ff eb 7c b4 76 6c 94 b4 d8 c8 90 ac 66 d8 73 7f b2 d8 eb 00 b4 ac c3 48 00 d8 6c a7 b4 8d 9a 60 7f 90 76 fc ff fc fc ff 90 eb 90 ff ff ca e9 d5 af 6c 6c 54 60 ff 66 bc a0 c5 ae cf ff b4 d8 89 70 c0 a5 99 66 c1 ad 7a d6 30 28 6c 48 8f 00 99 66 00 3f a3 64 d8 eb 7f b2 6c 90 d8 95 bf 6c cf cf 90 b2 d8 e5 6a d8 dd d8 b4 73 00 00 9d 96 fd 65 df 5a 9d ac f3 df f7 6e ff db ff fb fb ab 31 c7 fa af 6a af 03 9d fe ea 0c 9f de a7 f5 7d 00 c7 ff 67 bf 7f 7f 87 fc ce bf 2f 6f be ba fd f2 5f 2d df c8 7f 5b b5 77 6f 8f db 92 7e f0 5f ff 9d 40 ba f7 ec 6d fb 64 64 96 e3 c7 f7 d3 ff af 7f f5 f6 73 f7 b2 5a 5f 88 89 b7 bc fd 7f e9 7f 7e 2f fa 7c f7 03 a5 c7 ea fb 8d ff ff 79 5b 00 e7 8d 67 b9 ec 59 f7 00 bd 96 af 00 00 7d 64 00 00 00 00 ff ff ff ff 90 99 bd d8 99 b4 ff c0 db de 24 91 6c b2 48 63 fc fc c8 fc eb 00 48 b2 01 73 48 ac a0 6c eb e1 90 7f fc d8 e1 d8 f5 46 ff ff 90 75 b4 90 48 90 c0 cf c7 90 ff ff e9 e9 00 ed b4 d8 b4 b4 ff ff bc a0 b2 b7 c0 cf fc fc 99 99 cf b4 ff ff ff ff 03 ff 9c 91 d8 b4 a5 8f d2 bb 00 24 b9 0c 6c ac 00 73 6c 48 d8 95 bf 6c 90 90 cf b2 b4 e7 69 90 ad fc 6c 73 00 7f 49 00 fe fd a5 6f 7f ff 7b be ab 11 67 ff b9 55 9d 7f fb de 7f 7f 7f fb f0 93 fe fb eb bf ef 5d f7 fc 8a de ff 96 3a bd df bb f8 3d b0 cf 9e fe 5f fd f3 d9 ff 93 c8 bd aa 37 fd 81 7f be ff 7f f0 91 4b 4c 40 4b 67 ce ff a9 7d ff 64 d3 6f f7 b4 f7 ad cf fc e9 cd 7f 81 af 64 f7 51 f5 a4 7d df 3f cf f7 fd f9 7f df f0 4d 5f fb ff fb 4f df a9 f0 8a 45 ba 96 fc bd 09 b7 00 f2 00 00 00 00 00 64"
        palette_R = "ff 00 ff 00 ff 00 ff 00 6c 4a ff b4 99 90 80 cf 52 51 eb 00 fc b2 fc fc fc fc 64 d8 eb a0 90 73 a7 73 d8 eb ff b4 ac d7 d8 7f d8 90 ca d8 ae b4 80 9f ff dc fc c0 d8 fc 90 ff fd b4 05 a0 32 32 00 35 d8 d8 a8 c0 fa 99 b7 00 e2 c5 90 c0 90 8d 47 00 90 6d 00 00 66 33 85 99 78 ca b4 90 7d ff ff ff 7f 69 fa 81 fc ac 7f b2 b4 b4 b4 d4 ff 90 ff c0 c0 73 d8 a9 bf b4 ff 90 d8 b2 aa 00 d8 00 fb 90 81 9d 37 ac dd bf b9 3f ef d7 de fd fe 73 2f 8d fb ff fe ed 03 f5 ea ed ad 3d fc fa ef fd 63 8d 7f 77 5f 79 73 71 ff ee a8 ff 9f db f5 ff cd f3 e0 fe c8 79 73 1f bf e5 f3 f6 e0 de f0 cc 4b 64 40 a1 f7 1a e0 67 ff 64 f5 3f 97 ef 14 96 d7 67 b7 ee ba ea 6c bd 26 4e 64 2f bf 9f 7f f3 aa ff e6 bf 57 eb 14 fe 4f e8 6a ef 62 b7 dd cf 66 6b b2 7a 5a f7 9c 4c 96 9d 14 00 6e c8 00 64"
        palette_G = "00 00 ff ff 00 00 ff ff 24 89 67 b4 99 6c 80 90 91 ff eb 7c b4 76 6c 94 b4 d8 c8 90 ac 66 d8 73 7f b2 d8 eb 00 b4 ac c3 48 00 d8 6c a7 b4 8d 9a 60 7f 90 76 fc ff fc fc ff 90 eb 90 ff ff ca e9 d5 af 6c 6c 54 60 ff 66 bc a0 c5 ae cf ff b4 d5 86 70 c0 a5 99 66 c1 ad 7a d6 30 28 6c 48 8f 00 99 66 00 3f a3 64 d8 eb 7f b2 6c 90 d8 95 bf 6c cf cf 90 b2 d8 e5 6a d8 dd d8 b4 73 00 00 9d 96 fd 65 df 5a 9d ac f3 df f7 6e ff db ff fb fb ab 31 c7 fa af 6a af 00 9d fe ea 0c 9f de a7 f5 7d 23 c7 ff 72 77 7f 7f 87 fc ce bf 2f 6f be ba fd f2 5f 2d df c8 7f 5b b5 77 6f 8f db 92 7e f0 5f ff 9d 40 ba f7 ec 6d fb 64 64 96 e3 c7 f7 d3 ff af 7f f5 f6 73 f7 b2 5a 5f 88 89 b7 bc fd 7f e9 7f 7e 2f fa 7c f7 03 a5 c7 e5 fb 8d ff ff 79 5b 00 e7 8d 67 b9 ec 59 f7 00 bd 96 af 00 00 7d 64"
        palette_B = "00 00 00 00 ff ff ff ff 90 99 bd d8 99 b4 ff c0 db de 24 91 6c b2 48 63 fc fc c8 fc eb 00 48 b2 01 73 48 ac a0 6c eb e1 90 7f fc d8 e1 d8 f5 46 ff ff 90 75 b4 90 48 90 c0 cf c7 90 ff ff e9 e9 00 ed b4 d8 b4 b4 ff ff bc a0 b2 b7 c0 cf fc f9 9c 99 cf b4 ff ff ff ff 03 ff 9c 91 d8 b4 a5 8f d2 bb 00 24 b9 0c 6c ac 00 73 6c 48 d8 95 bf 6c 90 90 cf b2 b4 e7 69 90 ad fc 6c 73 00 7f 49 00 fe fd a5 6f 7f ff 7b be ab 11 67 ff b9 55 9d 7f fb de 7f 7f 7f fb f3 93 fe f5 eb bf ef 5d f7 fc 87 e8 ff 99 3a bd df bb f8 3d b2 cf 9e fe 5f fd f3 d9 ff 93 c8 bd aa 37 fd 81 7f be ff 7f f0 91 4b 4c 40 4b 67 ce ff a9 7d ff 64 d3 6f f7 b4 f7 ad cf fc e9 cd 7f 81 af 64 f7 51 f5 a4 7d df 3f cf f7 fd f9 7f df f0 4d 5f f0 ff fb 4f df a9 f0 8a 45 ba 96 fc bd 09 b7 00 f2 14 00 00 00 00 64"

        # remove spaces
        # palette_str = palette_str.replace(" ", "")
        palette_R = palette_R.replace(" ", "")
        palette_G = palette_G.replace(" ", "")
        palette_B = palette_B.replace(" ", "")

        palette_str = f"{palette_R}{palette_G}{palette_B}"

        # Sanity check
        assert len(palette_str) / 2 == 3 * \
            256, "Expected palette string to hold 3*256*2 characters"

        # generate palette from template above
        palette = bytearray([0] * (3 * 256))  # R256G256B256
        for i in range(len(palette)):
            idx = i
            if img_order:
                if i % 2 == 0:
                    idx = i + 1
                else:
                    idx = i - 1
            palette[idx] = int(palette_str[i * 2:i * 2 + 2],
                               16)  # parse as hex

        return palette
