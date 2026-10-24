"""
Script and Text Resource Parsers for The Legend of Kyrandia 2: Hand of Fate.
Decodes:
- Subtitle & In-Game Script files:
    English: .EMC
    French:  .FMC
    German:  .GMC
- Dialogue Scripts with Scenes & Characters:
    English: .DLE
    French:  .DLF
    German:  .DLG
- Room, Item, and Menu Names, plus In-Game Letters & Spellbook Pages:
    English: .ENG
    French:  .FRE
    German:  .GER
"""

import struct
from typing import Dict, Any, List, Optional

# Supported script and text extensions
SCRIPT_EXTENSIONS = ('.EMC', '.FMC', '.GMC', '.DLE', '.DLF', '.DLG', '.ENG', '.FRE', '.GER')

LANGUAGE_META = {
    '.EMC': {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'subtitles', 'label': 'English Subtitles'},
    '.FMC': {'lang': 'fr', 'lang_name': 'French',  'flag': '🇫🇷', 'type': 'subtitles', 'label': 'French Subtitles'},
    '.GMC': {'lang': 'de', 'lang_name': 'German',  'flag': '🇩🇪', 'type': 'subtitles', 'label': 'German Subtitles'},
    '.DLE': {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'dialogue',  'label': 'English Dialogue Script'},
    '.DLF': {'lang': 'fr', 'lang_name': 'French',  'flag': '🇫🇷', 'type': 'dialogue',  'label': 'French Dialogue Script'},
    '.DLG': {'lang': 'de', 'lang_name': 'German',  'flag': '🇩🇪', 'type': 'dialogue',  'label': 'German Dialogue Script'},
    '.ENG': {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'strings',   'label': 'English Room, Item & Menu Names'},
    '.FRE': {'lang': 'fr', 'lang_name': 'French',  'flag': '🇫🇷', 'type': 'strings',   'label': 'French Room, Item & Menu Names'},
    '.GER': {'lang': 'de', 'lang_name': 'German',  'flag': '🇩🇪', 'type': 'strings',   'label': 'German Room, Item & Menu Names'},
}

# Character names for Dialogue Actor IDs
ACTOR_NAMES = {
    12: 'Zanthia',
    13: 'Faun',
    10: 'Marko',
    11: 'Marko',
    14: 'Brueth',
    15: 'Farmer',
    16: 'Fisherman',
    17: 'Ferryman',
    18: 'Bouncer',
    20: 'Giant Rat',
    21: 'Shopkeeper',
    22: 'Alchemist',
    23: 'Tree Spirit',
    24: 'Dinosaur',
    25: 'Crocodile',
    26: 'Flytrap Plant',
    28: 'Pirate Captain',
    29: 'Ship Captain',
    30: 'Sailor',
    31: 'Squatter',
    32: 'Blacksmith',
    33: 'Tavern Patron',
    34: 'Bartender',
    35: 'Sheriff',
    36: 'Deputy',
    40: 'Foot Patrol Guard',
    41: 'Jailer',
    42: 'Prisoner',
    43: 'Judge',
    44: 'Executioner',
    45: 'Town Crier',
    46: 'Miner',
    47: 'Sulfur Sprite',
    48: 'Fire Sprite',
    50: 'Hand of Fate',
    53: 'Mystic Council',
    54: 'Darm',
    56: 'Brandy',
    57: 'Rowdy',
    58: 'Herb',
    59: 'Jessica',
    60: 'Malcolm',
}

# DTE Substitution Tables (Westwood Studios HoF compression)
DECODE_TABLE1 = bytes([
    0x20, 0x65, 0x74, 0x61, 0x69, 0x6E, 0x6F, 0x73, 0x72, 0x6C, 0x68,
    0x63, 0x64, 0x75, 0x70, 0x6D
])

DECODE_TABLE2 = bytes([
    0x74, 0x61, 0x73, 0x69, 0x6F, 0x20, 0x77, 0x62, 0x20, 0x72, 0x6E,
    0x73, 0x64, 0x61, 0x6C, 0x6D, 0x68, 0x20, 0x69, 0x65, 0x6F, 0x72,
    0x61, 0x73, 0x6E, 0x72, 0x74, 0x6C, 0x63, 0x20, 0x73, 0x79, 0x6E,
    0x73, 0x74, 0x63, 0x6C, 0x6F, 0x65, 0x72, 0x20, 0x64, 0x74, 0x67,
    0x65, 0x73, 0x69, 0x6F, 0x6E, 0x72, 0x20, 0x75, 0x66, 0x6D, 0x73,
    0x77, 0x20, 0x74, 0x65, 0x70, 0x2E, 0x69, 0x63, 0x61, 0x65, 0x20,
    0x6F, 0x69, 0x61, 0x64, 0x75, 0x72, 0x20, 0x6C, 0x61, 0x65, 0x69,
    0x79, 0x6F, 0x64, 0x65, 0x69, 0x61, 0x20, 0x6F, 0x74, 0x72, 0x75,
    0x65, 0x74, 0x6F, 0x61, 0x6B, 0x68, 0x6C, 0x72, 0x20, 0x65, 0x69,
    0x75, 0x2C, 0x2E, 0x6F, 0x61, 0x6E, 0x73, 0x72, 0x63, 0x74, 0x6C,
    0x61, 0x69, 0x6C, 0x65, 0x6F, 0x69, 0x72, 0x61, 0x74, 0x70, 0x65,
    0x61, 0x6F, 0x69, 0x70, 0x20, 0x62, 0x6D
])

def decode_hof_string(raw: bytes) -> str:
    """
    Decodes a HoF string using Dual Tile Encoding (DTE) and escaped characters.
    Uses DOS codepage 850 for correct French/German umlauts and accents.
    """
    # Pass 1: Digram substitution for bytes with bit 7 set
    dst1 = bytearray()
    for b in raw:
        if b & 0x80:
            c = b & 0x7F
            idx = (c & 0x78) >> 3
            if idx < len(DECODE_TABLE1):
                dst1.append(DECODE_TABLE1[idx])
            if c < len(DECODE_TABLE2):
                dst1.append(DECODE_TABLE2[c])
        else:
            dst1.append(b)

    # Pass 2: Escaped character sequence (0x1B followed by offset)
    dst2 = bytearray()
    i = 0
    while i < len(dst1):
        if dst1[i] == 0x1B and i + 1 < len(dst1):
            i += 1
            dst2.append((dst1[i] + 0x7F) & 0xFF)
        else:
            dst2.append(dst1[i])
        i += 1

    return dst2.decode('cp850', errors='replace')


def parse_emc(data: bytes, ext: str, name: str) -> Dict[str, Any]:
    """
    Parses IFF FORM EMC2 subtitle files (.EMC, .FMC, .GMC).
    Extracts strings from the TEXT chunk.
    """
    meta = LANGUAGE_META.get(ext.upper(), {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'subtitles', 'label': 'Subtitles'})
    lines = []

    if data.startswith(b'FORM') and len(data) >= 12:
        idx = 12
        while idx + 8 <= len(data):
            chunk_id = data[idx:idx+4]
            chunk_sz = struct.unpack('>I', data[idx+4:idx+8])[0]
            if chunk_id == b'TEXT':
                tdata = data[idx+8 : idx+8+chunk_sz]
                if len(tdata) >= 2:
                    first_off = struct.unpack('>H', tdata[0:2])[0]
                    num_strings = first_off // 2
                    for i in range(num_strings):
                        off = struct.unpack('>H', tdata[i*2 : i*2+2])[0]
                        if off < len(tdata):
                            null_pos = tdata.find(b'\x00', off)
                            raw = tdata[off:null_pos] if null_pos != -1 else tdata[off:]
                            text = raw.decode('cp850', errors='replace').strip()
                            lines.append({
                                'index': i,
                                'text': text,
                            })
                break
            idx += 8 + chunk_sz
            if chunk_sz % 2 != 0:
                idx += 1

    transcript_lines = [f"[{item['index']:03d}] {item['text']}" for item in lines if item['text']]
    text_content = "\n".join(transcript_lines)

    return {
        'format': 'EMC',
        'ext': ext.upper(),
        'filename': name,
        'language': meta['lang'],
        'language_name': meta['lang_name'],
        'flag': meta['flag'],
        'category': 'subtitles',
        'category_label': meta['label'],
        'total_lines': len(lines),
        'non_empty_lines': len([l for l in lines if l['text']]),
        'lines': lines,
        'transcript': text_content,
    }


def parse_dle(data: bytes, ext: str, name: str) -> Dict[str, Any]:
    """
    Parses dialogue script files (.DLE, .DLF, .DLG).
    Extracts scenes, actors, sequence counters, and dialogue strings.
    """
    meta = LANGUAGE_META.get(ext.upper(), {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'dialogue', 'label': 'Dialogue Script'})
    scenes = []
    all_lines = []

    if len(data) >= 10:
        first_scene_off = struct.unpack('<H', data[8:10])[0]
        num_offs = (first_scene_off - 8) // 2
        offsets = [struct.unpack('<H', data[8 + i*2 : 10 + i*2])[0] for i in range(num_offs)]
        valid_offsets = sorted(list(set([off for off in offsets if first_scene_off <= off <= len(data)])))

        for s_idx, off in enumerate(valid_offsets):
            end_off = valid_offsets[s_idx + 1] if s_idx + 1 < len(valid_offsets) else len(data)
            scene_bytes = data[off:end_off]
            cur = 0
            scene_lines = []
            while cur + 6 <= len(scene_bytes):
                actor_id, text_len, seq_id = struct.unpack('<HHH', scene_bytes[cur:cur+6])
                if text_len > 0 and cur + 6 + text_len <= len(scene_bytes):
                    raw = scene_bytes[cur+6 : cur+6+text_len].rstrip(b'\x00')
                    text = raw.decode('cp850', errors='replace').strip()
                    actor_name = ACTOR_NAMES.get(actor_id, f"Actor {actor_id}")
                    line_obj = {
                        'scene_index': s_idx,
                        'seq_id': seq_id,
                        'actor_id': actor_id,
                        'actor_name': actor_name,
                        'text': text,
                    }
                    scene_lines.append(line_obj)
                    all_lines.append(line_obj)
                    cur += 6 + text_len
                else:
                    break

            if scene_lines:
                scenes.append({
                    'scene_index': s_idx,
                    'offset': off,
                    'line_count': len(scene_lines),
                    'lines': scene_lines,
                })

    transcript_parts = []
    for sc in scenes:
        transcript_parts.append(f"--- Scene {sc['scene_index']} ---")
        for line in sc['lines']:
            transcript_parts.append(f"{line['actor_name']} (Seq {line['seq_id']}): {line['text']}")
        transcript_parts.append("")

    transcript = "\n".join(transcript_parts).strip()

    return {
        'format': 'DLE',
        'ext': ext.upper(),
        'filename': name,
        'language': meta['lang'],
        'language_name': meta['lang_name'],
        'flag': meta['flag'],
        'category': 'dialogue',
        'category_label': meta['label'],
        'scene_count': len(scenes),
        'total_lines': len(all_lines),
        'scenes': scenes,
        'lines': all_lines,
        'transcript': transcript,
    }


def parse_eng(data: bytes, ext: str, name: str) -> Dict[str, Any]:
    """
    Parses room, item, and menu names, or in-game documents (.ENG, .FRE, .GER).
    Handles both DTE-compressed string tables and plain-text spellbook pages/letters.
    """
    meta = LANGUAGE_META.get(ext.upper(), {'lang': 'en', 'lang_name': 'English', 'flag': '🇬🇧', 'type': 'strings', 'label': 'Room & Item Names'})

    if len(data) < 2:
        return {
            'format': 'TEXT',
            'ext': ext.upper(),
            'filename': name,
            'language': meta['lang'],
            'language_name': meta['lang_name'],
            'flag': meta['flag'],
            'category': 'strings',
            'category_label': meta['label'],
            'doc_type': 'empty',
            'total_lines': 0,
            'lines': [],
            'transcript': '',
        }

    first_off = struct.unpack('<H', data[0:2])[0]
    is_table = (first_off <= len(data) and first_off >= 2 and first_off % 2 == 0)

    if is_table:
        num_strings = first_off // 2
        offsets = [struct.unpack('<H', data[i*2:i*2+2])[0] for i in range(num_strings)]
        lines = []
        for i, off in enumerate(offsets):
            if off < len(data):
                null_pos = data.find(b'\x00', off)
                raw = data[off:null_pos] if null_pos != -1 else data[off:]
                decoded = decode_hof_string(raw).strip()
                lines.append({
                    'index': i,
                    'text': decoded,
                })

        # Determine semantic role
        name_upper = name.upper()
        if 'CH' in name_upper:
            doc_type = 'Room & Location Names'
        elif 'C_CODE' in name_upper:
            doc_type = 'Items & Command Actions'
        elif 'OPTIONS' in name_upper:
            doc_type = 'Game Menu & Options'
        elif 'LIB_MSG' in name_upper:
            doc_type = 'System & Library Messages'
        else:
            doc_type = 'String Table'

        transcript_lines = [f"[{l['index']:03d}] {l['text']}" for l in lines if l['text']]
        transcript = "\n".join(transcript_lines)

        return {
            'format': 'TABLE',
            'ext': ext.upper(),
            'filename': name,
            'language': meta['lang'],
            'language_name': meta['lang_name'],
            'flag': meta['flag'],
            'category': 'strings',
            'category_label': meta['label'],
            'doc_type': doc_type,
            'total_lines': len(lines),
            'non_empty_lines': len([l for l in lines if l['text']]),
            'lines': lines,
            'transcript': transcript,
        }

    else:
        # In-game document (Spellbook Page or Official Letter)
        doc_text = data.decode('cp850', errors='replace').strip()
        name_upper = name.upper()
        if 'PAGE' in name_upper:
            doc_type = 'Spellbook Primer Page'
        elif 'LETTER' in name_upper:
            doc_type = 'Official In-Game Letter'
        else:
            doc_type = 'In-Game Document'

        raw_lines = doc_text.splitlines()
        lines = [{'index': idx, 'text': line} for idx, line in enumerate(raw_lines)]

        return {
            'format': 'DOCUMENT',
            'ext': ext.upper(),
            'filename': name,
            'language': meta['lang'],
            'language_name': meta['lang_name'],
            'flag': meta['flag'],
            'category': 'strings',
            'category_label': meta['label'],
            'doc_type': doc_type,
            'total_lines': len(lines),
            'lines': lines,
            'transcript': doc_text,
        }


def parse_script_file(data: bytes, ext: str, name: str) -> Dict[str, Any]:
    """Unified entry point for parsing any of the 9 script/text extensions."""
    ext = ext.upper()
    if ext in ('.EMC', '.FMC', '.GMC'):
        return parse_emc(data, ext, name)
    elif ext in ('.DLE', '.DLF', '.DLG'):
        return parse_dle(data, ext, name)
    elif ext in ('.ENG', '.FRE', '.GER'):
        return parse_eng(data, ext, name)
    else:
        text = data.decode('cp850', errors='replace')
        return {
            'format': 'RAW',
            'ext': ext,
            'filename': name,
            'language': 'en',
            'language_name': 'English',
            'flag': '🇬🇧',
            'category': 'text',
            'category_label': 'Text Asset',
            'total_lines': len(text.splitlines()),
            'lines': [{'index': i, 'text': l} for i, l in enumerate(text.splitlines())],
            'transcript': text,
        }
