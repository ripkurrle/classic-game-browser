"""
Westwood .FNT Bitmap Font Decoder and Renderer for Kyrandia 2: Hand of Fate.
Supports Westwood Font Format v3 (4-bit per pixel variable-width bitmap fonts).
"""

import io
import struct
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image

COLOR_SCHEMES: Dict[str, Dict[int, Tuple[int, int, int, int]]] = {
    'gold': {
        0: (0, 0, 0, 0),
        1: (245, 208, 97, 255),   # Bright gold fill
        2: (229, 168, 35, 255),   # Mid gold shading
        3: (122, 78, 8, 255),     # Dark gold outline
        4: (70, 42, 5, 255),
        5: (255, 240, 160, 255),
        6: (200, 150, 50, 255),
        7: (160, 110, 30, 255),
        8: (120, 80, 20, 255),
        9: (90, 60, 15, 255),
        10: (60, 40, 10, 255),
        11: (255, 250, 210, 255),
        12: (180, 130, 40, 255),
        13: (140, 95, 25, 255),
        14: (100, 65, 15, 255),
        15: (255, 255, 255, 255),
    },
    'white': {
        0: (0, 0, 0, 0),
        1: (255, 255, 255, 255), # Pure white fill
        2: (190, 195, 205, 255), # Light silver shading
        3: (35, 40, 50, 255),    # Dark outline
        4: (75, 80, 95, 255),
        5: (230, 235, 245, 255),
        6: (160, 165, 175, 255),
        7: (130, 135, 145, 255),
        8: (100, 105, 115, 255),
        9: (80, 85, 95, 255),
        10: (50, 55, 65, 255),
        11: (250, 250, 255, 255),
        12: (180, 185, 195, 255),
        13: (140, 145, 155, 255),
        14: (110, 115, 125, 255),
        15: (255, 255, 255, 255),
    },
    'amber': {
        0: (0, 0, 0, 0),
        1: (251, 191, 36, 255),  # Amber fill
        2: (217, 119, 6, 255),   # Deep amber
        3: (69, 26, 3, 255),     # Dark shadow
        4: (120, 53, 15, 255),
        5: (254, 243, 199, 255),
        6: (245, 158, 11, 255),
        7: (180, 83, 9, 255),
        8: (146, 64, 14, 255),
        9: (110, 48, 10, 255),
        10: (80, 35, 8, 255),
        11: (253, 230, 138, 255),
        12: (200, 100, 10, 255),
        13: (160, 75, 10, 255),
        14: (125, 55, 10, 255),
        15: (255, 255, 255, 255),
    },
    'cyan': {
        0: (0, 0, 0, 0),
        1: (56, 189, 248, 255),  # Sky blue fill
        2: (14, 165, 233, 255),  # Deep cyan
        3: (8, 47, 73, 255),     # Navy shadow
        4: (12, 74, 96, 255),
        5: (224, 242, 254, 255),
        6: (2, 132, 199, 255),
        7: (3, 105, 161, 255),
        8: (7, 89, 133, 255),
        9: (14, 116, 144, 255),
        10: (21, 94, 117, 255),
        11: (186, 230, 253, 255),
        12: (125, 211, 252, 255),
        13: (14, 165, 233, 255),
        14: (3, 105, 161, 255),
        15: (255, 255, 255, 255),
    },
    'emerald': {
        0: (0, 0, 0, 0),
        1: (52, 211, 153, 255),  # Emerald fill
        2: (16, 185, 129, 255),  # Rich green
        3: (6, 78, 59, 255),     # Deep forest shadow
        4: (4, 120, 87, 255),
        5: (209, 250, 229, 255),
        6: (5, 150, 105, 255),
        7: (4, 120, 87, 255),
        8: (6, 95, 70, 255),
        9: (6, 78, 59, 255),
        10: (2, 44, 34, 255),
        11: (167, 243, 208, 255),
        12: (110, 231, 183, 255),
        13: (16, 185, 129, 255),
        14: (5, 150, 105, 255),
        15: (255, 255, 255, 255),
    }
}


class FntGlyph:
    def __init__(self, index: int, width: int, h1: int, h2: int, h0: int, offset: int, raw_bytes: bytes):
        self.index = index
        self.width = width
        self.h1 = h1
        self.h2 = h2
        self.h0 = h0
        self.height = h1 + h2 + h0
        self.offset = offset
        self.has_data = bool(offset > 0 and width > 0 and h2 > 0)
        
        # Unpack 4-bit nibbles row by row
        # rows: h1 lines of 0, h2 lines of nibbles, h0 lines of 0
        self.rows: List[List[int]] = []
        for _ in range(h1):
            self.rows.append([0] * width)

        if self.has_data and offset + ((width + 1) // 2) * h2 <= len(raw_bytes) + 2:
            src_idx = offset
            for _ in range(h2):
                row = []
                b = 0
                for x in range(width):
                    if x % 2 == 1:
                        val = (b >> 4) & 0xF
                    else:
                        if src_idx < len(raw_bytes):
                            b = raw_bytes[src_idx]
                            src_idx += 1
                        else:
                            b = 0
                        val = b & 0xF
                    row.append(val)
                self.rows.append(row)
        else:
            for _ in range(h2):
                self.rows.append([0] * width)

        for _ in range(h0):
            self.rows.append([0] * width)

    def to_char(self) -> str:
        if 32 <= self.index <= 126:
            return chr(self.index)
        elif self.index == 0:
            return '␀'
        elif self.index == 32:
            return '␣'
        return f'\\x{self.index:02X}'

    def render_image(self, color_map: Optional[Dict[int, Tuple[int, int, int, int]]] = None) -> Image.Image:
        cmap = color_map or COLOR_SCHEMES['gold']
        w = max(self.width, 1)
        h = max(self.height, 1)
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for y, row in enumerate(self.rows):
            if y >= h:
                break
            for x, val in enumerate(row):
                if x >= w:
                    break
                if val != 0:
                    img.putpixel((x, y), cmap.get(val, (255, 255, 255, 255)))
        return img


class FntFont:
    def __init__(self, pak_name: str, name: str, raw_bytes: bytes):
        self.pak_name = pak_name
        self.name = name
        self.raw_size = len(raw_bytes)
        self.is_valid = False
        self.glyphs: List[FntGlyph] = []
        self.max_width = 0
        self.max_height = 0
        self.num_glyphs = 0

        if len(raw_bytes) < 14:
            return

        file_size, comp_method, num_blks, info_blk, offset_blk, width_blk, data_blk, height_blk = struct.unpack('<HBBHHHHH', raw_bytes[:14])
        
        # Validate Westwood Font v3 signatures
        if comp_method != 0 or num_blks != 5:
            return

        if info_blk + 6 > len(raw_bytes):
            return

        # FontInfo block
        # info_blk + 4: height, info_blk + 5: width, info_blk + 3: max_glyph_index
        self.max_height = raw_bytes[info_blk + 4]
        self.max_width = raw_bytes[info_blk + 5]
        self.num_glyphs = raw_bytes[info_blk + 3] + 1

        if self.num_glyphs <= 0 or self.num_glyphs > 256:
            return

        # Read tables
        if offset_blk + self.num_glyphs * 2 > len(raw_bytes):
            return
        if width_blk + self.num_glyphs > len(raw_bytes):
            return
        if height_blk + self.num_glyphs * 2 > len(raw_bytes):
            return

        offsets = [struct.unpack('<H', raw_bytes[offset_blk + i * 2 : offset_blk + i * 2 + 2])[0] for i in range(self.num_glyphs)]
        widths = [raw_bytes[width_blk + i] for i in range(self.num_glyphs)]
        height_pairs = [(raw_bytes[height_blk + i * 2], raw_bytes[height_blk + i * 2 + 1]) for i in range(self.num_glyphs)]

        for i in range(self.num_glyphs):
            w = widths[i]
            h1, h2 = height_pairs[i]
            h0 = max(0, self.max_height - (h1 + h2))
            off = offsets[i]
            glyph = FntGlyph(i, w, h1, h2, h0, off, raw_bytes)
            self.glyphs.append(glyph)

        self.is_valid = True

    def get_glyph(self, index: int) -> Optional[FntGlyph]:
        if 0 <= index < len(self.glyphs):
            return self.glyphs[index]
        return None

    def render_string(self, text: str, scheme: str = 'gold', tracking: int = 1, line_spacing: int = 2) -> Image.Image:
        """Renders arbitrary multi-line text using the Westwood font."""
        if not self.is_valid or not self.glyphs:
            return Image.new('RGBA', (32, 16), (0, 0, 0, 0))

        cmap = COLOR_SCHEMES.get(scheme, COLOR_SCHEMES['gold'])
        lines = text.split('\n')
        line_height = self.max_height + line_spacing

        # Calculate dimensions
        max_line_w = 0
        for line in lines:
            line_w = 0
            for ch in line:
                idx = ord(ch)
                g = self.get_glyph(idx)
                if g and g.width > 0:
                    line_w += g.width + tracking
                elif ch == ' ':
                    line_w += max(self.max_width // 2, 4) + tracking
                else:
                    line_w += max(self.max_width, 4) + tracking
            if line_w > max_line_w:
                max_line_w = line_w

        img_w = max(max_line_w, 1)
        img_h = max(len(lines) * line_height, 1)
        img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))

        cur_y = 0
        for line in lines:
            cur_x = 0
            for ch in line:
                idx = ord(ch)
                g = self.get_glyph(idx)
                if g and g.has_data:
                    for gy, row in enumerate(g.rows):
                        for gx, val in enumerate(row):
                            if val != 0:
                                px = cur_x + gx
                                py = cur_y + gy
                                if 0 <= px < img_w and 0 <= py < img_h:
                                    img.putpixel((px, py), cmap.get(val, (255, 255, 255, 255)))
                    cur_x += g.width + tracking
                elif ch == ' ':
                    cur_x += max(self.max_width // 2, 4) + tracking
                else:
                    cur_x += max(self.max_width, 4) + tracking
            cur_y += line_height

        return img

    def render_sheet(self, scheme: str = 'gold', cols: int = 16) -> Image.Image:
        """Renders all font glyphs arranged in a 16-column grid sheet."""
        if not self.is_valid or not self.glyphs:
            return Image.new('RGBA', (32, 32), (0, 0, 0, 0))

        cmap = COLOR_SCHEMES.get(scheme, COLOR_SCHEMES['gold'])
        cols = max(1, min(cols, 32))
        rows = (self.num_glyphs + cols - 1) // cols
        
        cell_w = self.max_width + 4
        cell_h = self.max_height + 4

        sheet = Image.new('RGBA', (cols * cell_w, rows * cell_h), (0, 0, 0, 0))

        for idx, g in enumerate(self.glyphs):
            col = idx % cols
            row = idx // cols
            base_x = col * cell_w + 2
            base_y = row * cell_h + 2

            if g.has_data:
                for gy, r in enumerate(g.rows):
                    for gx, val in enumerate(r):
                        if val != 0:
                            px = base_x + gx
                            py = base_y + gy
                            if 0 <= px < sheet.width and 0 <= py < sheet.height:
                                sheet.putpixel((px, py), cmap.get(val, (255, 255, 255, 255)))

        return sheet

    def render_sheet_png(self, scheme: str = 'gold', cols: int = 16) -> bytes:
        img = self.render_sheet(scheme=scheme, cols=cols)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def render_preview_png(self, scheme: str = 'gold') -> bytes:
        """Renders an elegant two-line preview sample for asset cards and viewer banner."""
        sample_text = f"{self.name.replace('.FNT', '')}\nABCDEFGHIJKLM 12345"
        img = self.render_string(sample_text, scheme=scheme, tracking=1, line_spacing=2)
        
        # Scale 2x for sharp retro display
        scaled = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
        
        # Wrap in a padded card
        card_w = scaled.width + 16
        card_h = scaled.height + 12
        card = Image.new('RGBA', (card_w, card_h), (20, 24, 34, 255))
        card.paste(scaled, (8, 6), scaled)
        
        buf = io.BytesIO()
        card.save(buf, format='PNG')
        return buf.getvalue()

    def get_metadata(self) -> Dict[str, Any]:
        """Returns structured JSON metadata for the font viewer UI."""
        return {
            'name': self.name,
            'pak_name': self.pak_name,
            'raw_size': self.raw_size,
            'max_width': self.max_width,
            'max_height': self.max_height,
            'num_glyphs': self.num_glyphs,
            'color_schemes': list(COLOR_SCHEMES.keys()),
            'glyphs': [
                {
                    'index': g.index,
                    'char': g.to_char(),
                    'ascii': g.index,
                    'hex': f'0x{g.index:02X}',
                    'width': g.width,
                    'h1': g.h1,
                    'h2': g.h2,
                    'h0': g.h0,
                    'has_data': g.has_data,
                    'rows': g.rows if g.has_data else []
                }
                for g in self.glyphs
            ]
        }
