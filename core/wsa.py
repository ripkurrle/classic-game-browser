"""
Westwood .WSA Animation Player and Frame Decoder for Kyrandia 2: Hand of Fate.
"""

import io
import struct
from typing import List, Optional, Tuple
from PIL import Image
from .format80 import format80_decode
from .format40 import decode_frame_delta
from .palette import PaletteManager
from .pak import PakEntry

class WsaAnimation:
    def __init__(self, pak_name: str, name: str, num_frames: int, width: int, height: int, x_add: int, y_add: int):
        self.pak_name = pak_name
        self.name = name
        self.num_frames = num_frames
        self.width = width
        self.height = height
        self.x_add = x_add
        self.y_add = y_add
        self.frames_rgba: List[bytes] = []

    def get_frame_image(self, index: int) -> Image.Image:
        if 0 <= index < len(self.frames_rgba):
            return Image.frombytes('RGBA', (self.width, self.height), self.frames_rgba[index])
        return Image.new('RGBA', (max(self.width, 1), max(self.height, 1)), (0, 0, 0, 0))

    def render_frame_png(self, index: int) -> bytes:
        img = self.get_frame_image(index)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def render_gif(self, duration_ms: int = 100) -> bytes:
        """Exports the animation as an animated GIF."""
        if not self.frames_rgba:
            return b""

        images = [self.get_frame_image(i) for i in range(len(self.frames_rgba))]
        buf = io.BytesIO()
        images[0].save(
            buf,
            format='GIF',
            save_all=True,
            append_images=images[1:],
            duration=duration_ms,
            loop=0,
            disposal=2
        )
        return buf.getvalue()


def decode_wsa(wsa_data: bytes, pal_manager: PaletteManager, pak_name: str = "", asset_name: str = "") -> WsaAnimation:
    if len(wsa_data) < 14:
        return WsaAnimation(pak_name, asset_name, 0, 0, 0, 0, 0)

    num_frames, x_add, y_add, width, height, delta_size, flags = struct.unpack('<HhhHHHH', wsa_data[:14])
    if width <= 0 or height <= 0 or width > 640 or height > 400 or num_frames == 0 or num_frames > 2000:
        return WsaAnimation(pak_name, asset_name, 0, 0, 0, 0, 0)

    table_start = 14
    table_size = (num_frames + 2) * 4
    table_end = table_start + table_size
    if table_end > len(wsa_data):
        return WsaAnimation(pak_name, asset_name, 0, 0, 0, 0, 0)

    offs_pal = 768 if (flags & 1) else 0
    embedded_pal = None
    if offs_pal and table_end + offs_pal <= len(wsa_data):
        raw_pal = wsa_data[table_end : table_end + offs_pal]
        max_v = max(raw_pal)
        if max_v <= 63 and max_v > 0:
            embedded_pal = bytes([(v << 2) | (v >> 4) for v in raw_pal])
        else:
            embedded_pal = raw_pal

    frame_data_start = table_end + offs_pal
    frame_data = wsa_data[frame_data_start:]

    pos = table_start
    frame_data_offs = struct.unpack('<I', wsa_data[pos : pos + 4])[0]
    pos += 4

    frame_offsets = [0]
    for i in range(1, num_frames + 2):
        if pos + 4 > len(wsa_data):
            break
        foff = struct.unpack('<I', wsa_data[pos : pos + 4])[0]
        pos += 4
        if foff != 0:
            foff = max(0, foff - frame_data_offs)
        frame_offsets.append(foff)

    if embedded_pal is not None and len(embedded_pal) >= 768:
        palette = embedded_pal
    else:
        palette = pal_manager.get_palette_for_asset(pak_name, asset_name)

    wsa_anim = WsaAnimation(pak_name, asset_name, num_frames, width, height, x_add, y_add)
    frame_buf = bytearray(width * height)

    for frame_idx in range(num_frames):
        if frame_idx < len(frame_offsets):
            off = frame_offsets[frame_idx]
            if off < len(frame_data):
                delta = format80_decode(frame_data[off:], delta_size)
                decode_frame_delta(frame_buf, delta, no_xor=(frame_idx == 0))

        # Convert current frame buffer to RGBA
        rgba = bytearray(width * height * 4)
        for i in range(width * height):
            p = frame_buf[i]
            if p != 0:
                rgba[i * 4] = palette[p * 3]
                rgba[i * 4 + 1] = palette[p * 3 + 1]
                rgba[i * 4 + 2] = palette[p * 3 + 2]
                rgba[i * 4 + 3] = 255
            else:
                rgba[i * 4 + 3] = 0

        wsa_anim.frames_rgba.append(bytes(rgba))

    return wsa_anim
