#!/usr/bin/env python3
"""Validate transparent PNG dimensions with Python's standard library."""

from __future__ import annotations

import struct
import sys


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

for path in sys.argv[1:]:
    with open(path, "rb") as image_file:
        header = image_file.read(33)
    if header[:8] != PNG_SIGNATURE or header[12:16] != b"IHDR":
        raise ValueError(f"{path}: not a PNG with an IHDR header")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", header[16:26])
    if (width, height) != (64, 64):
        raise ValueError(f"{path}: expected 64x64, got {width}x{height}")
    if bit_depth != 8 or color_type not in (4, 6):
        raise ValueError(f"{path}: expected an 8-bit PNG with alpha")
