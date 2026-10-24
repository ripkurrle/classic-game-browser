"""
Westwood 256-color Palette Manager for Kyrandia 2: Hand of Fate.
"""

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

        # 2. Look for exact matching <BASE_NAME>.COL in the same PAK
        base_name = asset_name.rsplit('.', 1)[0].upper()
        pak_dict = self.repo.paks.get(pak_name.upper(), {})

        col_name = f"{base_name}.COL"
        if col_name in pak_dict:
            raw = pak_dict[col_name].read()
            pal = self._decode_palette_bytes(raw)
            self._palette_cache[cache_key] = pal
            return pal

        # 3. Look for any .COL in the same PAK
        for name, entry in pak_dict.items():
            if name.endswith('.COL'):
                raw = entry.read()
                pal = self._decode_palette_bytes(raw)
                self._palette_cache[cache_key] = pal
                return pal

        # 4. Check known special mappings for UI elements in MISC_CPS.PAK
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
                    pal = self._decode_palette_bytes(pal_entry.read())
                    self._palette_cache[cache_key] = pal
                    return pal

        # 5. Global fallback palette
        fallback = self.get_fallback_palette()
        self._palette_cache[cache_key] = fallback
        return fallback
