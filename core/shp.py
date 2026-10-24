"""
Westwood .SHP Model / Character / Sprite Decoder and Renderer for Kyrandia 2: Hand of Fate.
"""

import io
import math
import struct
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image
from .format80 import format80_decode
from .palette import PaletteManager
from .pak import PakEntry

class ShpFrame:
    def __init__(self, index: int, width: int, height: int, rgba_bytes: bytes, flags: int):
        self.index = index
        self.width = width
        self.height = height
        self.rgba_bytes = rgba_bytes
        self.flags = flags

    def to_image(self) -> Image.Image:
        if self.width <= 0 or self.height <= 0:
            return Image.new('RGBA', (1, 1), (0, 0, 0, 0))
        return Image.frombytes('RGBA', (self.width, self.height), self.rgba_bytes)


class ShpModel:
    def __init__(self, pak_name: str, name: str, frames: List[ShpFrame]):
        self.pak_name = pak_name
        self.name = name
        self.frames = frames
        self.num_frames = len(frames)
        self.max_width = max([f.width for f in frames], default=0)
        self.max_height = max([f.height for f in frames], default=0)

    def get_frame(self, index: int) -> Optional[ShpFrame]:
        if 0 <= index < len(self.frames):
            return self.frames[index]
        return None

    def render_frame_png(self, index: int) -> bytes:
        frame = self.get_frame(index)
        if not frame:
            img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        else:
            img = frame.to_image()
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def render_spritesheet_png(self, max_cols: int = 8) -> bytes:
        """Generates a tiled sprite sheet image containing all frames."""
        if not self.frames:
            img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            return buf.getvalue()

        cell_w = max(self.max_width, 1) + 4
        cell_h = max(self.max_height, 1) + 4
        cols = min(self.num_frames, max_cols)
        rows = math.ceil(self.num_frames / cols)

        sheet_w = cols * cell_w
        sheet_h = rows * cell_h
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

        for idx, frame in enumerate(self.frames):
            col = idx % cols
            row = idx // cols
            img = frame.to_image()
            # Center frame within cell
            ox = col * cell_w + (cell_w - frame.width) // 2
            oy = row * cell_h + (cell_h - frame.height) // 2
            sheet.paste(img, (ox, oy), img)

        buf = io.BytesIO()
        sheet.save(buf, format='PNG')
        return buf.getvalue()


def decode_shp_frame(src_bytes: bytes, palette_8bit: bytes) -> Optional[ShpFrame]:
    """Decodes a single frame starting at src_bytes."""
    if len(src_bytes) < 14:
        return None

    sp = 0
    # Kyrandia 2 SHP frames have a 2-byte prefix [0, 0]
    sp += 2

    shape_flags = struct.unpack('<H', src_bytes[sp : sp + 2])[0]
    sp += 2
    shape_h = src_bytes[sp]
    sp += 1
    shape_w = struct.unpack('<H', src_bytes[sp : sp + 2])[0]
    sp += 2
    # 3 bytes extra header/padding
    sp += 3
    frame_size = struct.unpack('<H', src_bytes[sp : sp + 2])[0]
    sp += 2

    if shape_w <= 0 or shape_h <= 0 or shape_w > 640 or shape_h > 400:
        return None

    color_table = None
    if shape_flags & 1:
        color_table_colors = src_bytes[sp] if (shape_flags & 4) else 16
        if shape_flags & 4:
            sp += 1
        if sp + color_table_colors <= len(src_bytes):
            color_table = src_bytes[sp : sp + color_table_colors]
            sp += color_table_colors
        else:
            color_table = bytes(range(16))

    if not (shape_flags & 2):
        pixel_src = format80_decode(src_bytes[sp:], frame_size)
    else:
        pixel_src = src_bytes[sp : sp + frame_size]

    # Decode scanlines with run-length transparency
    pixels = bytearray(shape_w * shape_h)
    psp = 0
    src_len = len(pixel_src)

    for y in range(shape_h):
        cnt = shape_w
        row_offset = y * shape_w
        cur_x = 0
        while cnt > 0 and psp < src_len:
            c = pixel_src[psp]
            psp += 1
            if c != 0:
                if color_table is not None and c < len(color_table):
                    c = color_table[c]
                pixels[row_offset + cur_x] = c
                cur_x += 1
                cnt -= 1
            else:
                if psp >= src_len:
                    break
                run = pixel_src[psp]
                psp += 1
                cur_x += run
                cnt -= run

    # Build RGBA buffer (0 index is transparent)
    rgba = bytearray(shape_w * shape_h * 4)
    for i in range(shape_w * shape_h):
        p = pixels[i]
        if p != 0:
            rgba[i * 4] = palette_8bit[p * 3]
            rgba[i * 4 + 1] = palette_8bit[p * 3 + 1]
            rgba[i * 4 + 2] = palette_8bit[p * 3 + 2]
            rgba[i * 4 + 3] = 255
        else:
            rgba[i * 4 + 3] = 0

    return ShpFrame(0, shape_w, shape_h, bytes(rgba), shape_flags)


def decode_shp(raw_shp: bytes, pal_manager: PaletteManager, pak_name: str = "", asset_name: str = "") -> ShpModel:
    """Decodes a complete .SHP file with all its animation/sprite frames."""
    if len(raw_shp) < 2:
        return ShpModel(pak_name, asset_name, [])

    num_frames = struct.unpack('<H', raw_shp[:2])[0]
    if num_frames == 0 or num_frames > 2000:
        return ShpModel(pak_name, asset_name, [])

    offsets = []
    for i in range(num_frames):
        if 2 + (i + 1) * 4 <= len(raw_shp):
            off = struct.unpack('<I', raw_shp[2 + i * 4 : 6 + i * 4])[0]
            offsets.append(off)

    palette = pal_manager.get_palette_for_asset(pak_name, asset_name)

    frames: List[ShpFrame] = []
    for idx, off in enumerate(offsets):
        if off < len(raw_shp):
            frame = decode_shp_frame(raw_shp[off:], palette)
            if frame:
                frame.index = idx
                frames.append(frame)

    return ShpModel(pak_name, asset_name, frames)
