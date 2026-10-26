"""
Westwood .CPS Background Picture Decoder and Renderer for Kyrandia 2: Hand of Fate.
"""

import io
import struct
from typing import Optional, Tuple
from PIL import Image
from .format80 import format80_decode
from .rle import westwood_rle_decode
from .palette import PaletteManager
from .pak import PakEntry

def decode_cps_data(cps_bytes: bytes, pal_manager: Optional[PaletteManager] = None, pak_name: str = "", asset_name: str = "") -> Image.Image:
    """
    Decodes a .CPS or .CMP file and returns a PIL Image in 'RGB' mode (320x200 for CPS, 256x256 for CMP).
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

    # Decompress pixel data (standard 320x200 = 64000 bytes, or 256x256 = 65536 bytes for .CMP colormaps)
    if comp_type == 3:
        pixels = westwood_rle_decode(payload, decomp_size)
    elif comp_type == 0:
        pixels = payload[:decomp_size]
    else:
        pixels = format80_decode(payload, decomp_size)

    # Check if this is a 256x256 colormap/matrix file (.CMP)
    is_cmp = asset_name.upper().endswith('.CMP') or (decomp_size >= 65000 and decomp_size <= 65536)

    if is_cmp:
        w, h = 256, 256
        needed = w * h
        if len(pixels) < needed:
            pixels = pixels + bytes(needed - len(pixels))
    else:
        if len(pixels) < decomp_size:
            # Pad with 0 if truncated
            pixels = pixels + bytes(decomp_size - len(pixels))
        w = 320
        h = decomp_size // w if decomp_size >= w else 200
        if h == 0:
            h = 200

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

    img = Image.frombytes('P', (w, h), pixels[: w * h])
    img.putpalette(palette)
    return img.convert('RGB')


def render_cps_to_png(entry: PakEntry, pal_manager: PaletteManager, crop_panel: bool = False) -> bytes:
    """Renders a CPS entry to PNG bytes."""
    raw = entry.read()
    img = decode_cps_data(raw, pal_manager, entry.pak_name, entry.name)
    if crop_panel and img.width == 320 and img.height >= 144:
        img = img.crop((0, 0, 320, 144))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def render_cps_to_gif(entry: PakEntry, pal_manager: PaletteManager, crop_panel: bool = False) -> bytes:
    """Renders a CPS entry to GIF bytes."""
    raw = entry.read()
    img = decode_cps_data(raw, pal_manager, entry.pak_name, entry.name)
    if crop_panel and img.width == 320 and img.height >= 144:
        img = img.crop((0, 0, 320, 144))
    buf = io.BytesIO()
    img.save(buf, format='GIF')
    return buf.getvalue()


def render_cps_composite_png(entry: PakEntry, pal_manager: PaletteManager, linked_wsas: list, crop_panel: bool = False, anim_positions: Optional[dict] = None) -> bytes:
    """Renders a CPS entry with linked WSA animations composited (frame 0) to PNG bytes."""
    raw = entry.read()
    bg_img = decode_cps_data(raw, pal_manager, entry.pak_name, entry.name).convert('RGBA')
    for anim in linked_wsas:
        f_img = anim.get_frame_image(0, include_bg=False, full_scene=False)
        ox, oy = (anim_positions.get(anim.name.upper(), (anim.x_add, anim.y_add)) if anim_positions else (anim.x_add, anim.y_add))
        bg_img.paste(f_img, (ox, oy), f_img)
    if crop_panel and bg_img.width == 320 and bg_img.height >= 144:
        bg_img = bg_img.crop((0, 0, 320, 144))
    buf = io.BytesIO()
    bg_img.convert('RGB').save(buf, format='PNG')
    return buf.getvalue()


def render_cps_composite_gif(entry: PakEntry, pal_manager: PaletteManager, linked_wsas: list, crop_panel: bool = False, duration_ms: int = 100, anim_positions: Optional[dict] = None) -> bytes:
    """Renders a CPS entry with all linked WSA animations composited to an animated GIF."""
    if not linked_wsas:
        return render_cps_to_gif(entry, pal_manager, crop_panel=crop_panel)
    raw = entry.read()
    bg_img = decode_cps_data(raw, pal_manager, entry.pak_name, entry.name).convert('RGBA')

    max_frames = max(a.num_frames for a in linked_wsas)
    max_frames = min(max_frames, 120)

    frames = []
    for f_idx in range(max_frames):
        canvas = bg_img.copy()
        for anim in linked_wsas:
            frame_idx = f_idx % anim.num_frames
            f_img = anim.get_frame_image(frame_idx, include_bg=False, full_scene=False)
            ox, oy = (anim_positions.get(anim.name.upper(), (anim.x_add, anim.y_add)) if anim_positions else (anim.x_add, anim.y_add))
            canvas.paste(f_img, (ox, oy), f_img)
        if crop_panel and canvas.width == 320 and canvas.height >= 144:
            canvas = canvas.crop((0, 0, 320, 144))
        frames.append(canvas.convert('RGB'))

    buf = io.BytesIO()
    frames[0].save(buf, format='GIF', save_all=True, append_images=frames[1:], duration=duration_ms, loop=0)
    return buf.getvalue()


