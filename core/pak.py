"""
Westwood PAK Archive Reader and Indexer for Kyrandia 2: Hand of Fate.
"""

import os
import struct
from typing import Dict, List, Tuple, Optional

class PakEntry:
    def __init__(self, pak_path: str, name: str, offset: int, size: int):
        self.pak_path = pak_path
        self.pak_name = os.path.basename(pak_path)
        self.name = name
        self.offset = offset
        self.size = size
        self.ext = os.path.splitext(name)[1].upper()

    def read(self) -> bytes:
        with open(self.pak_path, 'rb') as f:
            f.seek(self.offset)
            return f.read(self.size)

    def to_dict(self):
        return {
            'name': self.name,
            'pak_name': self.pak_name,
            'offset': self.offset,
            'size': self.size,
            'ext': self.ext,
        }

def read_pak(pak_path: str) -> Dict[str, PakEntry]:
    """Reads directory index of a PAK file without extracting content to disk."""
    entries = {}
    if not os.path.isfile(pak_path):
        return entries

    with open(pak_path, 'rb') as f:
        file_entries = []
        while True:
            offset_bytes = f.read(4)
            if len(offset_bytes) < 4:
                break
            offset = struct.unpack('<I', offset_bytes)[0]
            if offset == 0:
                break
            name_bytes = bytearray()
            while True:
                b = f.read(1)
                if not b or b == b'\x00':
                    break
                name_bytes.extend(b)
            name = name_bytes.decode('ascii', errors='replace').strip()
            if name:
                file_entries.append((name, offset))

        file_size = f.seek(0, 2)
        for i in range(len(file_entries)):
            name, off = file_entries[i]
            next_off = file_entries[i+1][1] if i + 1 < len(file_entries) else file_size
            size = max(0, next_off - off)
            entries[name.upper()] = PakEntry(pak_path, name, off, size)

    return entries


class GameRepository:
    """Manages all PAK files and provides quick asset lookups."""
    def __init__(self, game_dir: str):
        self.game_dir = game_dir
        self.paks: Dict[str, Dict[str, PakEntry]] = {}
        self.all_entries: List[PakEntry] = []
        self._index_built = False
        self.scan()

    def scan(self):
        self.paks.clear()
        self.all_entries.clear()

        if not os.path.isdir(self.game_dir):
            return

        for fname in sorted(os.listdir(self.game_dir)):
            if fname.upper().endswith('.PAK'):
                pak_path = os.path.join(self.game_dir, fname)
                entries = read_pak(pak_path)
                self.paks[fname.upper()] = entries
                self.all_entries.extend(entries.values())

        self._index_built = True

    def get_entry(self, pak_name: str, file_name: str) -> Optional[PakEntry]:
        pak_dict = self.paks.get(pak_name.upper())
        if pak_dict:
            return pak_dict.get(file_name.upper())
        return None

    def find_entry(self, file_name: str) -> Optional[PakEntry]:
        target = file_name.upper()
        for pak_name, entries in self.paks.items():
            if target in entries:
                return entries[target]
        return None

    def get_entries_by_ext(self, ext: str) -> List[PakEntry]:
        ext = ext.upper()
        if not ext.startswith('.'):
            ext = '.' + ext
        return [e for e in self.all_entries if e.ext == ext]
