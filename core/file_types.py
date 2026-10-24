"""
Westwood Studios File Type Taxonomy & Metadata Catalog for The Legend of Kyrandia 2: Hand of Fate.
Contains comprehensive technical definitions, specifications, and inspection logic for all 27 file types.
"""

import os
import struct
from typing import Dict, Any, Optional

FILE_TYPE_CATALOG: Dict[str, Dict[str, Any]] = {
    '.CPS': {
        'name': 'Colour Picture Static (Background Art)',
        'category': 'graphics',
        'icon': '🖼️',
        'tech_specs': 'Format 80 (LCW) compressed, 320x200 8-bit VGA (64,000 pixels), optional embedded palette',
        'description': 'Full-screen 320x200 256-color background landscapes and scene environments painted by Westwood artists.',
        'viewer_mode': 'image',
    },
    '.CMP': {
        'name': 'Compressed Cutscene Scene Background (SCENE2/3.CMP)',
        'category': 'graphics',
        'icon': '🎬',
        'tech_specs': 'Format 80 (LCW) compressed, 320x200/204 8-bit VGA (65,532 bytes buffer), uses INTROGEN.COL',
        'description': 'Full-screen cinematic intro story and prologue background graphics (SCENE2.CMP and SCENE3.CMP in INTROGEN.PAK) compressed using Westwood Format 80 identical to .CPS.',
        'viewer_mode': 'image',
    },
    '.SHP': {
        'name': 'Shape Archive / Character & Item Sprites',
        'category': 'graphics',
        'icon': '🧙',
        'tech_specs': 'Multi-frame transparent 8-bit VGA sprites, index-0 transparent color, frame dimension headers',
        'description': 'Multi-frame sprite models containing character poses, animated props, inventory item icons, and UI widgets.',
        'viewer_mode': 'sprite',
    },
    '.CSH': {
        'name': 'Compressed Shape Archive (_ITEMS, _BUTTONS, _MOUSE)',
        'category': 'graphics',
        'icon': '📦',
        'tech_specs': 'Format 80 compressed multi-frame .SHP archives (contains up to 180 inventory items & UI elements)',
        'description': 'High-density compressed sprite libraries stored in OTHER.PAK: _ITEMS.CSH contains all 180 potion and item icons, _BUTTONS.CSH contains 15 UI buttons, and _MOUSE.CSH contains 9 mouse cursor states.',
        'viewer_mode': 'sprite',
    },
    '.WSA': {
        'name': 'Westwood Studios Animation',
        'category': 'graphics',
        'icon': '🎞️',
        'tech_specs': 'Multi-frame animation, Format 80 baseline keyframe with Format 40 / XOR delta differential frames',
        'description': 'Dynamic cinematic and character animations featuring delta-frame encoding for smooth lip sync, character walks, spell casting, and ambient background animations.',
        'viewer_mode': 'animation',
    },
    '.TIM': {
        'name': 'Animation Voice Timeline & Lip-Sync Script',
        'category': 'scripts',
        'icon': '⏱️',
        'tech_specs': 'Electronic Arts / Westwood IFF container (FORM: AVFS) with AVTL (Audio-Visual Timeline) chunks',
        'description': 'Timeline and sequence control scripts linked to character WSA animations (e.g. OCTO_STA, OCTO_TLK, OCTO_END). Coordinates frame indices, hold durations, sound triggers, and speech lip-sync animation cycles.',
        'viewer_mode': 'inspector',
    },
    '.MSC': {
        'name': 'Mouse Screen / Scene Hotspot & Collision Mask',
        'category': 'graphics',
        'icon': '🎯',
        'tech_specs': 'Format 80 compressed 320x144 pixel map (46,080 bytes = active playable viewport above 56px UI bar)',
        'description': 'Interactive scene mask defining clickable room hotspots, character walkability navigation zones, and depth sorting layers for every scene in Kyrandia.',
        'viewer_mode': 'inspector',
    },
    '.COL': {
        'name': 'Colour Palette (VGA 256 Colors)',
        'category': 'graphics',
        'icon': '🎨',
        'tech_specs': '768 bytes RGB (256 color triples, 6-bit DAC shifted or 8-bit), optional Format 80 compression',
        'description': 'Master VGA color palettes providing room mood, lighting conditions, and character color ramps for scenes and sprites.',
        'viewer_mode': 'palette',
    },
    '.PAL': {
        'name': 'Palette File (Title & Cutscenes)',
        'category': 'graphics',
        'icon': '🖌️',
        'tech_specs': '768 bytes RGB (256 color triples), uncompressed or Format 80 compressed (e.g. K2TITLE.PAL)',
        'description': 'Specialized cutscene and title screen color palette used for the opening logos, menu, and cinematic transitions.',
        'viewer_mode': 'palette',
    },
    '.XMI': {
        'name': 'Miles Extended MIDI Soundtrack',
        'category': 'audio',
        'icon': '🎵',
        'tech_specs': 'Miles Sound System (AIL) XMIDI format (FORM: XDIR / EVNT / INFO), multi-track event sequences',
        'description': 'Legendary musical score composed by Frank Klepacki and Paul Mudra. Features branching sequence loops, dynamic branch cues, and multi-timbral instrumentation.',
        'viewer_mode': 'midi',
    },
    '.VOC': {
        'name': 'Creative Voice Sound File',
        'category': 'audio',
        'icon': '🔊',
        'tech_specs': 'Creative Voice File format (Creative Labs), 8-bit unsigned PCM mono audio, variable sample rate (11-22 kHz)',
        'description': 'Digitized voice acting dialogues and Foley sound effects (spell effects, doors, footsteps, animal cries, fire crackles).',
        'viewer_mode': 'audio',
    },
    '.ADL': {
        'name': 'AdLib / Sound Blaster FM Sound Bank',
        'category': 'audio',
        'icon': '📻',
        'tech_specs': 'Yamaha YM3812 (OPL2/OPL3) 2-operator FM synthesis instrument patch definitions and sound event sequences',
        'description': 'Instrument timbre definitions and sound effects programmed for AdLib and Sound Blaster FM synthesis chips.',
        'viewer_mode': 'inspector',
    },
    '.C55': {
        'name': 'Roland Sound Canvas / MT-32 Sound Bank',
        'category': 'audio',
        'icon': '🎹',
        'tech_specs': 'IFF container (FORM: XDIR) containing Roland SCC-55 Sound Canvas & MT-32/CM-32L sysex timbre banks',
        'description': 'High-end MIDI timbre banks, system exclusive dumps, and custom patch mappings tailored for Roland Sound Canvas (SCC-55) and Roland MT-32 synth modules.',
        'viewer_mode': 'inspector',
    },
    '.PCS': {
        'name': 'PC Speaker Sound Effect Bank',
        'category': 'audio',
        'icon': '📢',
        'tech_specs': 'IFF container (FORM: XDIR / INFO / CAT ) containing 1-bit timer frequency sound effect routines (K2SFX.PCS)',
        'description': 'Fallback sound effects library specifically compiled for IBM PC standard internal beeper/speaker hardware.',
        'viewer_mode': 'inspector',
    },
    '.EMC': {
        'name': 'English Subtitle & Voice Cue File',
        'category': 'scripts',
        'icon': '💬',
        'tech_specs': 'EMC2 IFF format, big-endian uint16 string offset table, DOS CP850 encoding',
        'description': 'Full spoken subtitle transcripts and cue timings matching CD voice tracks in English.',
        'viewer_mode': 'script',
    },
    '.FMC': {
        'name': 'French Subtitle & Voice Cue File',
        'category': 'scripts',
        'icon': '💬',
        'tech_specs': 'EMC2 IFF format, big-endian uint16 string offset table, DOS CP850 accented characters',
        'description': 'Full spoken subtitle transcripts in French with accented character encoding (é, à, è, ç).',
        'viewer_mode': 'script',
    },
    '.GMC': {
        'name': 'German Subtitle & Voice Cue File',
        'category': 'scripts',
        'icon': '💬',
        'tech_specs': 'EMC2 IFF format, big-endian uint16 string offset table, DOS CP850 German umlauts',
        'description': 'Full spoken subtitle transcripts in German with umlaut character encoding (ä, ö, ü, ß).',
        'viewer_mode': 'script',
    },
    '.DLE': {
        'name': 'English Dialogue Script (Scenes & Actors)',
        'category': 'scripts',
        'icon': '📜',
        'tech_specs': 'Binary scene script format, actor IDs (Zanthia, Faun, Marko, etc.), sequence order',
        'description': 'Interactive dialogue scripts organized into dramatic scenes with actor assignments and spoken conversation lines.',
        'viewer_mode': 'script',
    },
    '.DLF': {
        'name': 'French Dialogue Script (Scenes & Actors)',
        'category': 'scripts',
        'icon': '📜',
        'tech_specs': 'Binary scene script format with French character localization and actor mappings',
        'description': 'Complete French localized dialogue scripts across all 5 game chapters.',
        'viewer_mode': 'script',
    },
    '.DLG': {
        'name': 'German Dialogue Script (Scenes & Actors)',
        'category': 'scripts',
        'icon': '📜',
        'tech_specs': 'Binary scene script format with German character localization and actor mappings',
        'description': 'Complete German localized dialogue scripts across all 5 game chapters.',
        'viewer_mode': 'script',
    },
    '.ENG': {
        'name': 'English Room, Item & Menu Names / Documents',
        'category': 'scripts',
        'icon': '📖',
        'tech_specs': 'Westwood Dual Tile Encoding (DTE) digram compression + plaintext spellbook parchment pages',
        'description': 'In-game text tables containing room names, item labels, GUI strings, Norton\'s Potion Primer spellbook pages, and letters.',
        'viewer_mode': 'script',
    },
    '.FRE': {
        'name': 'French Room, Item & Menu Names / Documents',
        'category': 'scripts',
        'icon': '📖',
        'tech_specs': 'Westwood DTE digram compression + 0x1B escape code decoding for French accents',
        'description': 'French localized room names, potion ingredients, menu buttons, and Parchment letters.',
        'viewer_mode': 'script',
    },
    '.GER': {
        'name': 'German Room, Item & Menu Names / Documents',
        'category': 'scripts',
        'icon': '📖',
        'tech_specs': 'Westwood DTE digram compression + 0x1B escape code decoding for German umlauts',
        'description': 'German localized room names, inventory item titles, menu options, and official letters.',
        'viewer_mode': 'script',
    },
    '.ADV': {
        'name': 'Miles Sound System Audio Device Driver',
        'category': 'drivers',
        'icon': '⚙️',
        'tech_specs': 'Miles Design Audio Driver (AIL) module containing hardware DSP initialization routines and interrupt handlers',
        'description': 'Sound card hardware driver modules created by Miles Design, Inc. (e.g. ADLIB.ADV, ADLIBG.ADV, ALGDIG.ADV, MPU401.ADV, PAS.ADV, PASPLUS.ADV, SB15.ADV, SB20.ADV, SBPRO.ADV, ULTRA.ADV).',
        'viewer_mode': 'inspector',
    },
    '.DRV': {
        'name': 'Low-Level Hardware Device Driver',
        'category': 'drivers',
        'icon': '🔌',
        'tech_specs': 'x86 Real-Mode 16-bit DOS device driver binaries (e.g. ALFX.DRV, PCSOUND.DRV, AUXDRV.DRV)',
        'description': 'Low-level hardware interface drivers executing interrupt vectors, DMA transfers, and hardware sound chip communication.',
        'viewer_mode': 'inspector',
    },
    '.FNT': {
        'name': 'Westwood DOS Bitmap Font',
        'category': 'graphics',
        'icon': '🔤',
        'tech_specs': 'Proprietary Westwood bitmap font format (glyph table, variable width, fixed height)',
        'description': 'Proportional and fixed-width bitmap fonts used for rendering game dialogues, subtitle overlays, and UI titles (e.g. GOLDFONT.FNT, 6.FNT, 8FAT.FNT, CYRIL.FNT).',
        'viewer_mode': 'inspector',
    },
    '.DAT': {
        'name': 'Game Configuration / Dimension Lookup Table',
        'category': 'data',
        'icon': '📊',
        'tech_specs': 'Binary lookup array: _ITEMHT.DAT contains 176 byte-values for vertical inventory sprite placement',
        'description': 'Game calibration data table: _ITEMHT.DAT in OTHER.PAK stores precise vertical pixel heights and bounding offsets for the 180 item icons in _ITEMS.CSH.',
        'viewer_mode': 'inspector',
    },
}

def get_file_type_info(ext: str) -> Dict[str, Any]:
    """Returns metadata and technical specifications for any known Kyrandia file extension."""
    norm_ext = ext.upper() if ext.startswith('.') else f".{ext.upper()}"
    if norm_ext in FILE_TYPE_CATALOG:
        return dict(FILE_TYPE_CATALOG[norm_ext], extension=norm_ext)
    return {
        'extension': norm_ext,
        'name': f"{norm_ext.lstrip('.')} Binary Asset",
        'category': 'data',
        'icon': '📁',
        'tech_specs': 'Raw binary asset stored in Westwood PAK archive',
        'description': 'Westwood Studios proprietary game asset file.',
        'viewer_mode': 'inspector',
    }

def inspect_raw_asset_data(raw: bytes, ext: str, name: str) -> Dict[str, Any]:
    """Inspects headers, chunks, and metadata for raw binary files."""
    meta: Dict[str, Any] = {
        'size': len(raw),
        'hex_preview': raw[:256].hex(),
        'ascii_preview': ''.join(chr(b) if 32 <= b <= 126 else '.' for b in raw[:256]),
    }

    # 1. IFF / FORM container (.TIM, .PCS, .C55, etc.)
    if len(raw) >= 12 and raw[:4] == b'FORM':
        form_size = struct.unpack('>I', raw[4:8])[0]
        form_type = raw[8:12].decode('latin1', errors='replace')
        meta['container'] = 'Electronic Arts / Westwood IFF (FORM)'
        meta['form_type'] = form_type
        meta['form_size'] = form_size

        chunks = []
        pos = 12
        while pos + 8 <= len(raw):
            cid = raw[pos:pos+4].decode('latin1', errors='replace')
            csz = struct.unpack('>I', raw[pos+4:pos+8])[0]
            chunks.append({'id': cid, 'size': csz, 'offset': pos})
            pos += 8 + csz + (csz % 2)
        meta['chunks'] = chunks

        if form_type == 'AVFS' and ext.upper() == '.TIM':
            # Parse timeline sequence count
            for ch in chunks:
                if ch['id'] == 'AVTL':
                    offset = ch['offset'] + 8
                    tl_data = raw[offset:offset+ch['size']]
                    num_shorts = len(tl_data) // 2
                    meta['timeline_opcodes_count'] = num_shorts
                    shorts = [struct.unpack('<H', tl_data[i:i+2])[0] for i in range(0, min(len(tl_data), 32), 2)]
                    meta['timeline_sample'] = shorts

    # 2. Westwood Compression Container (.CMP, .CSH, .MSC, etc.)
    elif len(raw) >= 10:
        file_sz_m2, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
        if comp_type in (1, 2, 3, 4):
            comp_names = {
                1: 'Format 40 (XOR Delta Frame)',
                2: 'LCW (Format 80 Variant)',
                3: 'RLE Compression',
                4: 'Format 80 (Standard LCW)',
            }
            meta['container'] = 'Westwood Compression Container'
            meta['compression_type'] = comp_names.get(comp_type, f'Type {comp_type}')
            meta['decompressed_size'] = decomp_sz
            meta['palette_size'] = pal_sz
            meta['compression_ratio'] = f"{(decomp_sz / max(len(raw), 1)):.2f}x" if decomp_sz > 0 else 'N/A'

            if ext.upper() == '.MSC':
                meta['mask_resolution'] = '320x144 (Playable Room Viewport)'
                meta['expected_pixels'] = 46080

            elif ext.upper() == '.CSH':
                meta['csh_target'] = 'Multi-frame .SHP Sprite Archive'

    # 3. Miles Sound System Driver (.ADV)
    if b'Miles Design' in raw[:128] or b'Copyright' in raw[:128]:
        meta['driver_system'] = 'Miles Sound System (AIL)'
        idx = raw.find(b'Copyright')
        if idx != -1:
            end = raw.find(b'\x00', idx)
            if end != -1:
                meta['copyright'] = raw[idx:end].decode('latin1', errors='replace').strip()

    # 4. Font Header (.FNT)
    elif ext.upper() == '.FNT' and len(raw) >= 6:
        fsize, dblocks, fheight, fwidth = struct.unpack('<HHBB', raw[:6])
        meta['font_info'] = {
            'declared_size': fsize,
            'data_blocks': dblocks,
            'glyph_height': fheight,
            'max_glyph_width': fwidth,
        }

    # 5. Lookup Data (.DAT)
    elif ext.upper() == '.DAT':
        meta['table_length'] = len(raw)
        meta['values_sample'] = list(raw[:32])

    return meta
