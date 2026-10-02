#!/usr/bin/env python3
"""Erzeugt einen Ordner "Testdaten" mit kleinen Bildsequenzen zum Testen des Plugins.

Aufruf: python3 test/make_testdata.py [Zielordner]
Ohne Zusatzpakete; jedes Bild zeigt einen wandernden weißen Balken auf farbigem Grund.
"""
import os
import struct
import sys
import zlib

W, H = 320, 180


def png(path, bg, frame, total):
    bar_x = int((W - 20) * frame / max(1, total - 1))
    rows = []
    for y in range(H):
        row = bytearray([0])  # Filter "None"
        for x in range(W):
            row += bytes((255, 255, 255)) if bar_x <= x < bar_x + 20 and 40 <= y < 140 else bytes(bg)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", raw))
        f.write(chunk(b"IEND", b""))


def series(folder, prefix, numbers, bg):
    os.makedirs(folder, exist_ok=True)
    total = max(numbers)
    for n in numbers:
        png(os.path.join(folder, f"{prefix}{n:04d}.png"), bg, n - 1, total)


def main():
    root = os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".", "Testdaten")
    series(root, "intro_", range(1, 49), (180, 40, 40))
    with open(os.path.join(root, "notiz.txt"), "w") as f:
        f.write("Diese Datei soll ignoriert werden.\n")
    series(os.path.join(root, "Szene1"), "cam_", range(1, 73), (40, 120, 180))
    series(os.path.join(root, "Szene1", "Detail"), "", range(1, 25), (40, 150, 70))
    series(os.path.join(root, "Luecke"), "shot_", list(range(1, 11)) + list(range(14, 31)), (150, 90, 30))
    series(os.path.join(root, "ZweiSerien"), "a_", range(1, 25), (120, 50, 150))
    series(os.path.join(root, "ZweiSerien"), "b_", range(1, 25), (60, 60, 60))
    print("Testdaten erzeugt in", root)


if __name__ == "__main__":
    main()
