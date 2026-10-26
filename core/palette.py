"""
Westwood 256-color Palette Manager for Kyrandia 2: Hand of Fate.
"""

import struct
from typing import Optional, Dict
from .format80 import format80_decode
from .pak import GameRepository, PakEntry

class PaletteManager:
    def __init__(self, repo: GameRepository):
        self.repo = repo
        self._palette_cache: Dict[str, bytes] = {}
        self._fallback_palette: Optional[bytes] = None

    def get_fallback_palette(self) -> bytes:
        if self._fallback_palette is not None:
            return self._fallback_palette

        # Try to find PALETTE.COL in OTHER.PAK
        pal_entry = self.repo.get_entry('OTHER.PAK', 'PALETTE.COL') or self.repo.find_entry('PALETTE.COL')
        if pal_entry:
            raw = pal_entry.read()
            self._fallback_palette = self._decode_palette_bytes(raw)
        else:
            # Generate grayscale ramp fallback if missing
            gray = bytearray(768)
            for i in range(256):
                gray[i*3] = i
                gray[i*3+1] = i
                gray[i*3+2] = i
            self._fallback_palette = bytes(gray)

        return self._fallback_palette

    def _decode_palette_bytes(self, raw: bytes) -> bytes:
        """Takes raw palette data (either 768 bytes uncompressed or Format 80 compressed) and returns 768-byte 8-bit RGB."""
        if len(raw) == 768:
            pal = raw
        elif len(raw) >= 10:
            # Check for CPS/COL header: uint16 fsize, uint16 ctype, uint32 dsize, uint16 psize
            # Uncompressed size is typically 768 (0x0300)
            pal = format80_decode(raw[10:], 768)
        else:
            pal = raw

        if len(pal) < 768:
            pal = pal + bytes(768 - len(pal))

        # Check if 6-bit DAC values (0..63)
        max_v = max(pal)
        if max_v <= 63 and max_v > 0:
            pal = bytes([(v << 2) | (v >> 4) for v in pal])

        return pal

    def _is_placeholder_color(self, r: int, g: int, b: int) -> bool:
        """Determines if an RGB color is a Westwood bright neon magenta placeholder or empty slot."""
        # Bright neon magenta (255, 0, 255) / (252, 0, 252)
        if r >= 230 and g <= 20 and b >= 230:
            return True
        return False

    @staticmethod
    def _is_purple_hue(r: int, g: int, b: int) -> bool:
        return r > 0 and b > 0 and g * 3 <= min(r, b)

    def _is_placeholder_at(self, pal: bytes, i: int, count: int) -> bool:
        """
        Placeholder check that respects genuine purple/magenta shading ramps.
        An entry matching a placeholder colour is kept as a real colour when an
        adjacent entry is a different, non-placeholder purple (i.e. it is part of
        a gradient such as the dragonfly ramp at SCORCH.COL 96..101).
        """
        r, g, b = pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]
        if not self._is_placeholder_color(r, g, b):
            return False
        for j in (i - 1, i + 1):
            if 0 <= j < count:
                nr, ng, nb = pal[j * 3], pal[j * 3 + 1], pal[j * 3 + 2]
                if (nr, ng, nb) != (r, g, b) and self._is_purple_hue(nr, ng, nb) \
                        and not self._is_placeholder_color(nr, ng, nb):
                    return False
        return True

    def _composite_palette(self, scene_pal: bytes) -> bytes:
        """
        In Westwood Kyrandia 2, scenes composite their palette over the master PALETTE.COL:
        - Master PALETTE.COL (from OTHER.PAK) provides global UI, item, font, and character/sprite colors.
        - The room/scene .COL file provides background colors for indices 0..127.
        - Indices 128..255 in the active screen palette are preserved from PALETTE.COL (character, snowman & item slots).
        - Any placeholder magenta colors in 0..127 are filled from PALETTE.COL (if PALETTE.COL has a valid non-white color).
        - Index 0 is transparent/black.
        """
        master = bytearray(self.get_fallback_palette())
        scene = bytearray(scene_pal)
        if len(scene) < 768:
            scene += bytes(768 - len(scene))

        # Overlay colors 0..127 from scene .COL
        for i in range(128):
            sr = scene[i * 3]
            sg = scene[i * 3 + 1]
            sb = scene[i * 3 + 2]
            is_ph = self._is_placeholder_at(scene, i, 128)
            # PALETTE.COL has blank unused slots filled with pure white (255, 255, 255) for indices 60..127.
            # Never replace scene colors with blank white fallback.
            master_is_blank_white = (master[i * 3] == 255 and master[i * 3 + 1] == 255 and master[i * 3 + 2] == 255)
            if not is_ph or master_is_blank_white:
                master[i * 3] = sr
                master[i * 3 + 1] = sg
                master[i * 3 + 2] = sb

        # Color 0 is always clean black (transparent index for sprites/anims)
        master[0] = 0
        master[1] = 0
        master[2] = 0

        return bytes(master)

    def get_palette_for_asset(self, pak_name: str, asset_name: str, embedded_pal: Optional[bytes] = None) -> bytes:
        """Finds the most authentic 768-byte RGB palette for a given asset."""
        cache_key = f"{pak_name}:{asset_name}".upper()
        if cache_key in self._palette_cache:
            return self._palette_cache[cache_key]

        # 1. If embedded palette provided
        if embedded_pal and len(embedded_pal) >= 768:
            pal = self._decode_palette_bytes(embedded_pal[:768])
            self._palette_cache[cache_key] = pal
            return pal

        base_name = asset_name.rsplit('.', 1)[0].upper()

        # 2. Check known special mappings for UI elements in MISC_CPS.PAK
        special_names = {
            '_EBOOK': '_BOOK.COL',
            '_FBOOK': '_BOOK.COL',
            '_GBOOK': '_BOOK.COL',
            '_MNWHIL': '_MEANWIL.COL',
            '_NOTE': '_NTEPAL1.COL',
            '_PLAYALL': 'PALETTE.COL',
            '_PLAYFLD': 'PALETTE.COL',
        }
        for prefix, col_target in special_names.items():
            if base_name.startswith(prefix):
                pal_entry = self.repo.find_entry(col_target)
                if pal_entry:
                    raw_col = self._decode_palette_bytes(pal_entry.read())
                    if col_target == '_BOOK.COL':
                        master = bytearray(self.get_fallback_palette())
                        for i in range(256):
                            r, g, b = raw_col[i * 3], raw_col[i * 3 + 1], raw_col[i * 3 + 2]
                            if not self._is_placeholder_at(raw_col, i, 256):
                                master[i * 3] = r
                                master[i * 3 + 1] = g
                                master[i * 3 + 2] = b
                        pal = bytes(master)
                    else:
                        pal = raw_col
                    self._palette_cache[cache_key] = pal
                    return pal

        # 2b. Special mapping for cinematic lighting & shading colormaps (.CMP)
        # SCENE2.CMP and SCENE3.CMP in INTROGEN.PAK pair with LIBRARY.CPS's embedded 256-color palette
        if asset_name.upper().endswith('.CMP') or base_name in ('SCENE2', 'SCENE3'):
            lib_entry = self.repo.get_entry('INTROGEN.PAK', 'LIBRARY.CPS') or self.repo.find_entry('LIBRARY.CPS')
            if lib_entry:
                raw_lib = lib_entry.read()
                if len(raw_lib) >= 10:
                    _, _, _, p_sz = struct.unpack('<HHIH', raw_lib[:10])
                    if p_sz >= 768:
                        pal = self._decode_palette_bytes(raw_lib[10 : 10 + p_sz])
                        self._palette_cache[cache_key] = pal
                        return pal

        # 3. Look for exact matching <BASE_NAME>.COL in the same PAK
        pak_dict = self.repo.paks.get(pak_name.upper(), {})
        target_entry = pak_dict.get(f"{base_name}.COL")

        # 4. Otherwise look for any .COL in the same PAK
        if not target_entry:
            for name, entry in pak_dict.items():
                if name.endswith('.COL'):
                    target_entry = entry
                    break

        # 4b. If numbered continuation PAK (e.g. GEARS2.PAK, GEARS3.PAK, TREE2.PAK, INJAIL2.PAK, OUTCAVE2.PAK), check base PAK
        pak_stem = pak_name.replace('.PAK', '').upper()
        if not target_entry and any(pak_stem.endswith(str(d)) for d in range(10)):
            base_pak_name = pak_stem.rstrip('0123456789') + '.PAK'
            base_pak_dict = self.repo.paks.get(base_pak_name, {})
            target_entry = base_pak_dict.get(f"{base_name}.COL")
            if not target_entry:
                base_stem = pak_stem.rstrip('0123456789')
                target_entry = base_pak_dict.get(f"{base_stem}.COL")
            if not target_entry:
                for name, entry in base_pak_dict.items():
                    if name.endswith('.COL'):
                        target_entry = entry
                        break

        if target_entry:
            raw_col = self._decode_palette_bytes(target_entry.read())
            # Standalone full 256-color palettes are returned directly without compositing
            if target_entry.name.upper() in ('PALETTE.COL', 'WESTWOOD.COL', '_MEANWIL.COL', '_NTEPAL1.COL', '_NTEPAL2.COL', '_NTEPAL3.COL', '_NTEPAL4.COL'):
                pal = raw_col
            else:
                pal = self._composite_palette(raw_col)
                # Special case: In INSHOP.PAK -> INSHPZY.WSA, Zanthia has drunk the Snowman Potion and is disguised as a lady yeti.
                # In INSHOP.COL, indices 112..127 contain Level 0 of _scenePal (normal Zanthia human purple dress).
                # Level 6 (starting at byte offset 336 + 6*48 = 624, index 208..223 of INSHOP.COL) contains the
                # authentic Yeti disguise fur and snout palette that the game engine swaps into character slot 112..127.
                if pak_name.upper() == 'INSHOP.PAK' and asset_name.upper() == 'INSHPZY.WSA':
                    pal_buf = bytearray(pal)
                    for i in range(16):
                        pal_buf[(112 + i) * 3] = raw_col[(208 + i) * 3]
                        pal_buf[(112 + i) * 3 + 1] = raw_col[(208 + i) * 3 + 1]
                        pal_buf[(112 + i) * 3 + 2] = raw_col[(208 + i) * 3 + 2]
                    pal = bytes(pal_buf)
            self._palette_cache[cache_key] = pal
            return pal

        # 5. Global fallback palette
        fallback = self.get_fallback_palette()
        self._palette_cache[cache_key] = fallback
        return fallback
