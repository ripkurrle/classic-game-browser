"""
Westwood .WSA Animation Player and Frame Decoder for Kyrandia 2: Hand of Fate.
"""

import io
import struct
from typing import Dict, List, Optional, Tuple
from PIL import Image
from .format80 import format80_decode
from .format40 import decode_frame_delta
from .palette import PaletteManager
from .pak import PakEntry

# Known scene placement offsets for WSAs where the 14-byte file header defaults to (0, 0)
# because coordinates were supplied dynamically by game script bytecode (e.g. o2_displayWsaFrame / opcode 0x70)
WSA_SCENE_OFFSETS: Dict[Tuple[str, str], Tuple[int, int]] = {
    ('INHOME.PAK', 'COALS.WSA'): (176, 80),
    ('INHOME.PAK', 'FAUN.WSA'): (288, 64),
    ('INHOME.PAK', 'FAUNGLSS.WSA'): (149, 59),
    ('INHOME.PAK', 'FAUNPEEK.WSA'): (130, 52),
    ('INHOME.PAK', 'FAUNSWNG.WSA'): (86, 0),
    ('CROC.PAK', 'CROCKEAT.WSA'): (101, 33),
    ('CROC.PAK', 'CROC.WSA'): (43, 51),
    ('CELLAR.PAK', 'UPLADR.WSA'): (105, 31),
    ('CELLAR.PAK', 'ZANCHEEZ.WSA'): (52, 55),
    ('INHERB.PAK', 'HERBMAN.WSA'): (16, 64),
    ('INHERB.PAK', 'FROG_1.WSA'): (192, 104),
    ('INHERB.PAK', 'FROG_2.WSA'): (248, 40),
    ('INHERB.PAK', 'CANDLE.WSA'): (56, 40),
    ('INHERB.PAK', 'HRBJAR.WSA'): (272, 112),
    ('INHERB.PAK', 'INDOOR.WSA'): (176, 32),
    ('GNARL.PAK', 'BRANCH.WSA'): (203, 67),
    ('GNARL.PAK', 'GNARL.WSA'): (40, 0),
    ('GNARL.PAK', 'FROG.WSA'): (16, 96),
    ('GNARL.PAK', 'GNARLA.WSA'): (0, 56),
    ('GNARL.PAK', 'GNARLB.WSA'): (136, 24),
    ('GNARL.PAK', 'GNARLC.WSA'): (127, 1),
    ('QUICK.PAK', 'QUICKD.WSA'): (88, 48),
}

def get_wsa_scene_offset(pak_name: str, asset_name: str, default_x: int = 0, default_y: int = 0) -> Tuple[int, int]:
    """Returns the effective scene placement offset for a WSA animation."""
    key = (pak_name.upper(), asset_name.upper())
    if key in WSA_SCENE_OFFSETS:
        return WSA_SCENE_OFFSETS[key]
    for (p, a), (ox, oy) in WSA_SCENE_OFFSETS.items():
        if a == asset_name.upper():
            return (ox, oy)
    return (default_x, default_y)

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
        self.bg_pak: Optional[str] = None
        self.bg_name: Optional[str] = None
        self.bg_rgba: Optional[bytes] = None

    @property
    def has_bg(self) -> bool:
        return self.bg_rgba is not None and len(self.bg_rgba) == 320 * 200 * 4

    def get_bg_image(self, crop_panel: bool = False) -> Optional[Image.Image]:
        if self.has_bg:
            img = Image.frombytes('RGBA', (320, 200), self.bg_rgba)
            if crop_panel:
                img = img.crop((0, 0, 320, 144))
            return img
        return None

    def render_bg_png(self, crop_panel: bool = False) -> bytes:
        img = self.get_bg_image(crop_panel=crop_panel)
        if not img:
            return b""
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def get_frame_image(self, index: int, include_bg: bool = False, full_scene: bool = False, crop_panel: bool = False, offset_x: Optional[int] = None, offset_y: Optional[int] = None) -> Image.Image:
        if 0 <= index < len(self.frames_rgba):
            frame = Image.frombytes('RGBA', (self.width, self.height), self.frames_rgba[index])
        else:
            frame = Image.new('RGBA', (max(self.width, 1), max(self.height, 1)), (0, 0, 0, 0))

        ox = self.x_add if offset_x is None else offset_x
        oy = self.y_add if offset_y is None else offset_y

        if not include_bg or not self.has_bg:
            if full_scene:
                h = 144 if crop_panel else 200
                canvas = Image.new('RGBA', (320, h), (0, 0, 0, 0))
                canvas.paste(frame, (ox, oy), frame)
                return canvas
            return frame

        bg_img = self.get_bg_image(crop_panel=crop_panel)
        if full_scene:
            canvas = bg_img.copy()
            canvas.paste(frame, (ox, oy), frame)
            return canvas
        else:
            canvas = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
            src_x0 = max(0, min(320, ox))
            src_y0 = max(0, min(200, oy))
            src_x1 = max(0, min(320, ox + self.width))
            src_y1 = max(0, min(200, oy + self.height))
            full_bg = self.get_bg_image(crop_panel=False)
            if src_x1 > src_x0 and src_y1 > src_y0:
                region = full_bg.crop((src_x0, src_y0, src_x1, src_y1))
                canvas.paste(region, (src_x0 - ox, src_y0 - oy))
            canvas.paste(frame, (0, 0), frame)
            return canvas

    def render_frame_png(self, index: int, include_bg: bool = False, full_scene: bool = False, crop_panel: bool = False, offset_x: Optional[int] = None, offset_y: Optional[int] = None) -> bytes:
        img = self.get_frame_image(index, include_bg=include_bg, full_scene=full_scene, crop_panel=crop_panel, offset_x=offset_x, offset_y=offset_y)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def render_spritesheet_png(self, max_cols: int = 8) -> Tuple[bytes, int, int]:
        """Generates a tiled sprite sheet image containing all frames. Returns (png_bytes, cols, rows)."""
        if not self.frames_rgba or self.width <= 0 or self.height <= 0:
            return b"", 0, 0
        num = len(self.frames_rgba)
        cols = min(num, max_cols)
        rows = (num + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * self.width, rows * self.height), (0, 0, 0, 0))
        for i in range(num):
            c = i % cols
            r = i // cols
            frame_img = self.get_frame_image(i)
            sheet.paste(frame_img, (c * self.width, r * self.height))
        buf = io.BytesIO()
        sheet.save(buf, format='PNG')
        return buf.getvalue(), cols, rows

    def render_gif(self, duration_ms: int = 100, include_bg: bool = False, full_scene: bool = False, crop_panel: bool = False, offset_x: Optional[int] = None, offset_y: Optional[int] = None) -> bytes:
        """Exports the animation as an animated GIF."""
        if not self.frames_rgba:
            return b""

        images = [self.get_frame_image(i, include_bg=include_bg, full_scene=full_scene, crop_panel=crop_panel, offset_x=offset_x, offset_y=offset_y) for i in range(len(self.frames_rgba))]
        converted_images = []
        for img in images:
            if include_bg and self.has_bg:
                converted_images.append(img.convert('RGB'))
            else:
                converted_images.append(img)

        buf = io.BytesIO()
        disposal = 0 if (include_bg and self.has_bg) else 2
        converted_images[0].save(
            buf,
            format='GIF',
            save_all=True,
            append_images=converted_images[1:],
            duration=duration_ms,
            loop=0,
            disposal=disposal
        )
        return buf.getvalue()


def decode_wsa(wsa_data: bytes, pal_manager: PaletteManager, pak_name: str = "", asset_name: str = "") -> WsaAnimation:
    if len(wsa_data) < 14:
        return WsaAnimation(pak_name, asset_name, 0, 0, 0, 0, 0)

    num_frames, x_add, y_add, width, height, delta_size, flags = struct.unpack('<HhhHHHH', wsa_data[:14])
    if width <= 0 or height <= 0 or width > 640 or height > 400 or num_frames == 0 or num_frames > 2000:
        return WsaAnimation(pak_name, asset_name, 0, 0, 0, 0, 0)

    if x_add == 0 and y_add == 0:
        x_add, y_add = get_wsa_scene_offset(pak_name, asset_name, x_add, y_add)

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
    t0 = struct.unpack('<I', wsa_data[pos : pos + 4])[0]
    pos += 4
    first_frame = (t0 != 0)
    if not first_frame:
        # ScummVM WF_NO_FIRST_FRAME: table[0] is 0
        # table[1] is the base offset of the delta stream
        frame_data_offs = struct.unpack('<I', wsa_data[pos : pos + 4])[0]
    else:
        frame_data_offs = t0

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

    # Base background and scene background
    bg_full_rgba = None
    bg_pak = None
    bg_name = None

    if pal_manager and getattr(pal_manager, 'repo', None):
        pak_stem = pak_name.replace('.PAK', '').upper()
        asset_stem = asset_name.rsplit('.', 1)[0].upper()
        
        candidates = [
            (pak_name, f"{asset_stem}.CPS"),
            (pak_name, f"{asset_stem}.CMP"),
            (pak_name, f"{pak_stem}.CPS"),
            (pak_name, f"{pak_stem}.CMP"),
        ]
        if pak_stem.endswith('2') or pak_stem.endswith('3'):
            base_pak = pak_stem.rstrip('123') + '.PAK'
            base_stem = pak_stem.rstrip('123')
            candidates.append((base_pak, f"{base_stem}.CPS"))
            candidates.append((base_pak, f"{base_stem}.CMP"))
            candidates.append((base_pak, f"{asset_stem}.CPS"))

        for i in range(1, 4):
            if len(asset_stem) > i:
                candidates.append((pak_name, f"{asset_stem[:-i]}.CPS"))
                candidates.append((pak_name, f"{asset_stem[:-i]}.CMP"))

        cps_entry = None
        for p, c in candidates:
            cps_entry = pal_manager.repo.get_entry(p, c) or pal_manager.repo.find_entry(c)
            if cps_entry:
                bg_pak = cps_entry.pak_name
                bg_name = cps_entry.name
                break

        if cps_entry:
            try:
                from .cps import decode_cps_data
                cps_img = decode_cps_data(cps_entry.read(), pal_manager, cps_entry.pak_name, cps_entry.name)
                bg_full_rgba = cps_img.convert('RGBA')
            except Exception:
                pass

        if embedded_pal is None and cps_entry and pal_manager:
            cps_pal = pal_manager.get_palette_for_asset(cps_entry.pak_name, cps_entry.name)
            if palette == pal_manager.get_fallback_palette():
                palette = cps_pal

    bg_crop = None
    if not first_frame and bg_full_rgba:
        bg_crop = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        src_x0 = max(0, min(320, x_add))
        src_y0 = max(0, min(200, y_add))
        src_x1 = max(0, min(320, x_add + width))
        src_y1 = max(0, min(200, y_add + height))
        if src_x1 > src_x0 and src_y1 > src_y0:
            region = bg_full_rgba.crop((src_x0, src_y0, src_x1, src_y1))
            bg_crop.paste(region, (src_x0 - x_add, src_y0 - y_add))

    wsa_anim = WsaAnimation(pak_name, asset_name, num_frames, width, height, x_add, y_add)
    if bg_full_rgba:
        wsa_anim.bg_pak = bg_pak
        wsa_anim.bg_name = bg_name
        wsa_anim.bg_rgba = bg_full_rgba.tobytes()
    frame_buf = bytearray(width * height)

    for frame_idx in range(num_frames):
        off_idx = (frame_idx + 1) if not first_frame else frame_idx
        if off_idx < len(frame_offsets):
            off = frame_offsets[off_idx]
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

        if bg_crop:
            delta_img = Image.frombytes('RGBA', (width, height), bytes(rgba))
            comp = bg_crop.copy()
            comp.paste(delta_img, (0, 0), delta_img)
            wsa_anim.frames_rgba.append(comp.tobytes())
        else:
            wsa_anim.frames_rgba.append(bytes(rgba))

    return wsa_anim

