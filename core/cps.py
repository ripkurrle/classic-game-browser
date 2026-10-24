"""
Westwood .CPS Background Picture Decoder and Renderer for Kyrandia 2: Hand of Fate.
"""

import io
import struct
from typing import Optional, Tuple
from PIL import Image
from .format80 import format80_decode
from .palette import PaletteManager
from .pak import PakEntry

def decode_cps_data(cps_bytes: bytes, pal_manager: Optional[PaletteManager] = None, pak_name: str = "", asset_name: str = "") -> Image.Image:
    """
    Decodes a .CPS file and returns a PIL Image in 'RGB' mode (320x200).
    """
    if len(cps_bytes) < 10:
        raise ValueError("CPS data too short")

    file_size_minus_2, comp_type, decomp_size, pal_size = struct.unpack('<HHIH', cps_bytes[:10])

    embedded_pal = None
    if pal_size > 0:
        embedded_pal = cps_bytes[10 : 10 + pal_size]
        payload = cps_bytes[10 + pal_size :]
    else:
        payload = cps_bytes[10:]

    # Decompress pixel data (standard 320x200 = 64000 bytes)
    pixels = format80_decode(payload, decomp_size)
    if len(pixels) < decomp_size:
        # Pad with 0 if truncated
        pixels = pixels + bytes(decomp_size - len(pixels))

    # Retrieve palette
    if pal_manager is not None:
        palette = pal_manager.get_palette_for_asset(pak_name, asset_name, embedded_pal)
    elif embedded_pal is not None and len(embedded_pal) >= 768:
        max_v = max(embedded_pal[:768])
        if max_v <= 63:
            palette = bytes([(v << 2) | (v >> 4) for v in embedded_pal[:768]])
        else:
            palette = embedded_pal[:768]
    else:
        # Grayscale fallback
        palette = bytes([(i // 3) for i in range(768)])

    # Construct image (Kyrandia screens are 320x200)
    w = 320
    h = decomp_size // w if decomp_size >= w else 200
    if h == 0:
        h = 200

    img = Image.frombytes('P', (w, h), pixels[: w * h])
    img.putpalette(palette)
    return img.convert('RGB')


def render_cps_to_png(entry: PakEntry, pal_manager: PaletteManager) -> bytes:
    """Renders a CPS entry to PNG bytes."""
    raw = entry.read()
    img = decode_cps_data(raw, pal_manager, entry.pak_name, entry.name)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
