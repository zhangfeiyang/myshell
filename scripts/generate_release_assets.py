from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "buildResources"


def pack_bgra(color):
    r, g, b, a = color
    return bytes((b, g, r, a))


def lerp(a, b, t):
    return int(a + (b - a) * t)


def blend(c1, c2, t):
    return tuple(lerp(c1[i], c2[i], t) for i in range(4))


def make_icon_rgba(size):
    top = (14, 165, 233, 255)
    bottom = (56, 189, 248, 255)
    edge = (3, 17, 29, 255)
    bg = []
    for y in range(size):
        row = []
        for x in range(size):
            base = blend(top, bottom, y / max(1, size - 1))
            if x < 4 or y < 4 or x >= size - 4 or y >= size - 4:
              row.append(edge)
              continue

            if size * 0.18 < x < size * 0.32 or size * 0.68 < x < size * 0.82:
                row.append((231, 248, 255, 255))
            elif size * 0.32 <= x <= size * 0.68 and size * 0.40 < y < size * 0.54:
                row.append((231, 248, 255, 255))
            else:
                row.append(base)
        bg.append(row)
    return bg


def write_ico(path, size=64):
    pixels = make_icon_rgba(size)
    xor_stride = size * 4
    and_stride = ((size + 31) // 32) * 4
    bitmap_size = 40 + xor_stride * size + and_stride * size
    image_offset = 6 + 16

    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        size,
        size,
        0,
        0,
        1,
        32,
        bitmap_size,
        image_offset,
    )

    dib = struct.pack(
        "<IIIHHIIIIII",
        40,
        size,
        size * 2,
        1,
        32,
        0,
        xor_stride * size + and_stride * size,
        0,
        0,
        0,
        0,
    )

    xor = bytearray()
    for y in range(size - 1, -1, -1):
        for x in range(size):
            xor.extend(pack_bgra(pixels[y][x]))

    and_mask = bytes(and_stride * size)
    path.write_bytes(header + entry + dib + xor + and_mask)


def write_bmp(path, width, height, top_color, bottom_color):
    row_stride = (width * 3 + 3) & ~3
    pixel_bytes = bytearray()
    for y in range(height - 1, -1, -1):
        t = y / max(1, height - 1)
        color = blend(top_color, bottom_color, t)
        row = bytearray()
        for _ in range(width):
            row.extend((color[2], color[1], color[0]))
        row.extend(b"\x00" * (row_stride - width * 3))
        pixel_bytes.extend(row)

    file_size = 14 + 40 + len(pixel_bytes)
    file_header = struct.pack("<2sIHHI", b"BM", file_size, 0, 0, 54)
    dib_header = struct.pack(
        "<IIIHHIIIIII",
        40,
        width,
        height,
        1,
        24,
        0,
        len(pixel_bytes),
        2835,
        2835,
        0,
        0,
    )
    path.write_bytes(file_header + dib_header + pixel_bytes)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write_ico(OUT / "icon.ico")
    write_bmp(
        OUT / "installerSidebar.bmp",
        164,
        314,
        (8, 17, 31, 255),
        (14, 165, 233, 255),
    )
    write_bmp(
        OUT / "uninstallerSidebar.bmp",
        164,
        314,
        (3, 17, 29, 255),
        (56, 189, 248, 255),
    )


if __name__ == "__main__":
    main()
