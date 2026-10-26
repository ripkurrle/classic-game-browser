"""
Desktop Backend HTTP Server and REST API for Kyrandia 2 Classic Game Browser.
"""

import os
import io
import json
import urllib.parse
import struct
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from typing import Optional, Any, Dict, Tuple, Set
from PIL import Image

from core.pak import GameRepository
from core.palette import PaletteManager
from core.format80 import format80_decode
from core.cps import decode_cps_data, render_cps_to_png, render_cps_to_gif, render_cps_composite_png, render_cps_composite_gif
from core.shp import decode_shp, ShpModel
from core.wsa import decode_wsa, WsaAnimation, get_wsa_scene_offset
from core.xmi2mid import xmi_to_midi, get_midi_metadata
from core.voc2wav import voc_to_wav
from core.extractor import BatchExtractor
from core.script_text import parse_script_file, SCRIPT_EXTENSIONS, LANGUAGE_META
from core.file_types import get_file_type_info, inspect_raw_asset_data, FILE_TYPE_CATALOG
from core.fnt import FntFont, COLOR_SCHEMES

DEFAULT_GAME_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    "The Legend of Kyrandia 2 The Hand of Fate (CD DOS).svm"
))
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "web"))

class KyrandiaState:
    def __init__(self, game_dir: str):
        self.game_dir = game_dir
        self.repo = GameRepository(game_dir)
        self.pal_manager = PaletteManager(self.repo)
        self.extractor = BatchExtractor(self.repo, self.pal_manager)
        self._wsa_cache: Dict[str, WsaAnimation] = {}
        self._shp_cache: Dict[str, ShpModel] = {}
        self._frame_png_cache: Dict[str, bytes] = {}
        self._sheet_cache: Dict[str, Tuple[bytes, int, int]] = {}
        self._stub_emc_keys: Set[Tuple[str, str]] = set()
        self._cps_to_wsas: Dict[Tuple[str, str], list] = {}
        self._fnt_cache: Dict[str, FntFont] = {}
        self._scan_stub_emcs()
        self._scan_cps_wsas()

    def _scan_cps_wsas(self):
        self._cps_to_wsas.clear()
        for entry in self.repo.all_entries:
            if entry.ext.upper() == '.WSA':
                try:
                    raw = entry.read()
                    if len(raw) < 14:
                        continue
                    num_frames, x_add, y_add, width, height, _, _ = struct.unpack('<HhhHHHH', raw[:14])
                    if width <= 0 or height <= 0 or num_frames == 0:
                        continue
                    if x_add == 0 and y_add == 0:
                        x_add, y_add = get_wsa_scene_offset(entry.pak_name, entry.name, x_add, y_add)
                    pak_stem = entry.pak_name.replace('.PAK', '').upper()
                    asset_stem = entry.name.rsplit('.', 1)[0].upper()
                    candidates = [
                        (entry.pak_name, f"{asset_stem}.CPS"),
                        (entry.pak_name, f"{pak_stem}.CPS"),
                    ]
                    if pak_stem.endswith('2') or pak_stem.endswith('3'):
                        base_pak = pak_stem.rstrip('123') + '.PAK'
                        base_stem = pak_stem.rstrip('123')
                        candidates.append((base_pak, f"{base_stem}.CPS"))
                        candidates.append((base_pak, f"{asset_stem}.CPS"))
                    for i in range(1, 4):
                        if len(asset_stem) > i:
                            candidates.append((entry.pak_name, f"{asset_stem[:-i]}.CPS"))
                    for p, c in candidates:
                        cps_e = self.repo.get_entry(p, c) or self.repo.find_entry(c)
                        if cps_e:
                            key = (cps_e.pak_name.upper(), cps_e.name.upper())
                            self._cps_to_wsas.setdefault(key, []).append({
                                'pak_name': entry.pak_name,
                                'name': entry.name,
                                'pos_x': x_add,
                                'pos_y': y_add,
                                'width': width,
                                'height': height,
                                'num_frames': num_frames
                            })
                            break
                except Exception:
                    pass

    def get_linked_wsas_for_cps(self, pak_name: str, name: str) -> list:
        key = (pak_name.upper(), name.upper())
        return self._cps_to_wsas.get(key, [])

    def _scan_stub_emcs(self):
        self._stub_emc_keys = set()
        for e in self.repo.all_entries:
            if e.ext.upper() in ('.EMC', '.FMC', '.GMC'):
                try:
                    raw = e.read()
                    upper_raw = raw.upper()
                    if (b'.SHP' in upper_raw or b'.WSA' in upper_raw) and len(raw) < 3000:
                        info = parse_script_file(raw, e.ext, e.name)
                        lines = [l['text'] for l in info.get('lines', []) if l['text'].strip()]
                        if len(lines) > 0 and all(l.upper().endswith('.WSA') or l.upper().endswith('.SHP') for l in lines):
                            self._stub_emc_keys.add((e.pak_name.upper(), e.name.upper()))
                except Exception:
                    pass

    def is_non_useful(self, entry) -> bool:
        ext = entry.ext.upper()
        if ext in ('.TIM', '.SHP', '.MSC', '.ADV', '.DRV', '.CMP', '.DAT', '.C55', '.ADL'):
            return True
        if entry.name.upper() in ('HOFSYSEX.XMI', 'HOF_SYX.XMI'):
            return True
        if (entry.pak_name.upper(), entry.name.upper()) in self._stub_emc_keys:
            return True
        return False

    def set_directory(self, new_dir: str):
        self.game_dir = os.path.abspath(new_dir)
        self.repo = GameRepository(self.game_dir)
        self.pal_manager = PaletteManager(self.repo)
        self.extractor = BatchExtractor(self.repo, self.pal_manager)
        self._wsa_cache.clear()
        self._shp_cache.clear()
        self._frame_png_cache.clear()
        self._sheet_cache.clear()
        self._stub_emc_keys.clear()
        self._scan_stub_emcs()
        self._scan_cps_wsas()

    def get_wsa(self, pak_name: str, name: str) -> Optional[WsaAnimation]:
        key = f"{pak_name}:{name}".upper()
        if key in self._wsa_cache:
            return self._wsa_cache[key]
        entry = self.repo.get_entry(pak_name, name)
        if not entry:
            return None
        anim = decode_wsa(entry.read(), self.pal_manager, pak_name, name)
        if len(self._wsa_cache) > 80:
            self._wsa_cache.pop(next(iter(self._wsa_cache)))
        self._wsa_cache[key] = anim
        return anim

    def get_shp(self, pak_name: str, name: str) -> Optional[ShpModel]:
        key = f"{pak_name}:{name}".upper()
        if key in self._shp_cache:
            return self._shp_cache[key]
        entry = self.repo.get_entry(pak_name, name)
        if not entry:
            return None
        raw = entry.read()
        if entry.ext.upper() == '.CSH':
            if len(raw) >= 10:
                file_sz, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
                raw = format80_decode(raw[10:], decomp_sz)
        model = decode_shp(raw, self.pal_manager, pak_name, name)
        if len(self._shp_cache) > 80:
            self._shp_cache.pop(next(iter(self._shp_cache)))
        self._shp_cache[key] = model
        return model

    def get_fnt(self, pak_name: str, name: str) -> Optional[FntFont]:
        key = f"{pak_name}:{name}".upper()
        if key in self._fnt_cache:
            return self._fnt_cache[key]
        entry = self.repo.get_entry(pak_name, name)
        if not entry:
            return None
        font = FntFont(pak_name, name, entry.read())
        if len(self._fnt_cache) > 20:
            self._fnt_cache.pop(next(iter(self._fnt_cache)))
        self._fnt_cache[key] = font
        return font

    def get_wsa_frame_png(self, pak_name: str, name: str, frame_idx: int) -> bytes:
        key = f"WSA_FRAME:{pak_name}:{name}:{frame_idx}".upper()
        if key in self._frame_png_cache:
            return self._frame_png_cache[key]
        anim = self.get_wsa(pak_name, name)
        if not anim:
            return b""
        png = anim.render_frame_png(frame_idx)
        if len(self._frame_png_cache) > 1000:
            self._frame_png_cache.pop(next(iter(self._frame_png_cache)))
        self._frame_png_cache[key] = png
        return png

    def get_wsa_bg_png(self, pak_name: str, name: str, crop_panel: bool = False) -> bytes:
        key = f"WSA_BG:{pak_name}:{name}:{1 if crop_panel else 0}".upper()
        if key in self._frame_png_cache:
            return self._frame_png_cache[key]
        anim = self.get_wsa(pak_name, name)
        if not anim or not anim.has_bg:
            return b""
        png = anim.render_bg_png(crop_panel=crop_panel)
        if len(self._frame_png_cache) > 1000:
            self._frame_png_cache.pop(next(iter(self._frame_png_cache)))
        self._frame_png_cache[key] = png
        return png

    def get_shp_frame_png(self, pak_name: str, name: str, frame_idx: int) -> bytes:
        key = f"SHP_FRAME:{pak_name}:{name}:{frame_idx}".upper()
        if key in self._frame_png_cache:
            return self._frame_png_cache[key]
        model = self.get_shp(pak_name, name)
        if not model:
            return b""
        png = model.render_frame_png(frame_idx)
        if len(self._frame_png_cache) > 1000:
            self._frame_png_cache.pop(next(iter(self._frame_png_cache)))
        self._frame_png_cache[key] = png
        return png

    def get_wsa_spritesheet(self, pak_name: str, name: str) -> Tuple[bytes, int, int]:
        key = f"WSA_SHEET:{pak_name}:{name}".upper()
        if key in self._sheet_cache:
            return self._sheet_cache[key]
        anim = self.get_wsa(pak_name, name)
        if not anim:
            return b"", 0, 0
        sheet_bytes, cols, rows = anim.render_spritesheet_png()
        if len(self._sheet_cache) > 80:
            self._sheet_cache.pop(next(iter(self._sheet_cache)))
        self._sheet_cache[key] = (sheet_bytes, cols, rows)
        return sheet_bytes, cols, rows

    def get_shp_spritesheet(self, pak_name: str, name: str) -> bytes:
        key = f"SHP_SHEET:{pak_name}:{name}".upper()
        if key in self._frame_png_cache:
            return self._frame_png_cache[key]
        model = self.get_shp(pak_name, name)
        if not model:
            return b""
        sheet_bytes = model.render_spritesheet_png()
        if len(self._frame_png_cache) > 1000:
            self._frame_png_cache.pop(next(iter(self._frame_png_cache)))
        self._frame_png_cache[key] = sheet_bytes
        return sheet_bytes

def render_palette_to_png(pal_bytes: bytes, cell_size: int = 16) -> bytes:
    """Renders a 256-color palette (768 bytes RGB) as a 16x16 grid PNG image."""
    base = Image.frombytes('RGB', (16, 16), pal_bytes[:768])
    if cell_size > 1:
        base = base.resize((16 * cell_size, 16 * cell_size), Image.Resampling.NEAREST)
    out = io.BytesIO()
    base.save(out, format='PNG')
    return out.getvalue()

app_state = KyrandiaState(DEFAULT_GAME_DIR)


class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path
        query = urllib.parse.parse_qs(url_parts.query)

        if path.startswith("/api/"):
            self.handle_api_get(path, query)
        else:
            # Fallback to index.html for single-page app routing if file doesn't exist
            file_path = os.path.join(WEB_DIR, path.lstrip('/'))
            if not os.path.isfile(file_path):
                self.path = "/index.html"
            super().do_GET()

    def do_POST(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        if path == "/api/set_dir":
            new_dir = body.get('directory', '').strip()
            if not new_dir or not os.path.isdir(new_dir):
                self.send_json_response({'error': 'Invalid directory path'}, status=400)
                return
            app_state.set_directory(new_dir)
            self.send_json_response({
                'success': True,
                'directory': app_state.game_dir,
                'total_paks': len(app_state.repo.paks),
                'total_assets': len(app_state.repo.all_entries),
            })

        elif path == "/api/batch_export":
            export_type = body.get('type', 'all')
            dest_dir = body.get('dest_dir', 'exported_assets')
            job = app_state.extractor.start_batch_export(export_type, dest_dir)
            self.send_json_response(job.to_dict())

        else:
            self.send_json_response({'error': 'Endpoint not found'}, status=404)

    def handle_api_get(self, path: str, query: dict):
        if path == "/api/status":
            hide_non_useful_str = query.get('hide_non_useful', ['1'])[0].lower()
            hide_non_useful = hide_non_useful_str in ('1', 'true', 'yes')

            if hide_non_useful:
                valid_entries = [e for e in app_state.repo.all_entries if not app_state.is_non_useful(e)]
            else:
                valid_entries = app_state.repo.all_entries

            counts = {
                'backgrounds': len([e for e in valid_entries if e.ext == '.CPS']),
                'models': len([e for e in valid_entries if e.ext in ('.SHP', '.CSH')]),
                'animations': len([e for e in valid_entries if e.ext == '.WSA']),
                'soundtracks': len([e for e in valid_entries if e.ext == '.XMI']),
                'sfx': len([e for e in valid_entries if e.ext == '.VOC']),
                'palettes': len([e for e in valid_entries if e.ext in ('.COL', '.PAL')]),
                'scripts': len([e for e in valid_entries if e.ext in SCRIPT_EXTENSIONS]),
                'scripts_en': len([e for e in valid_entries if e.ext in ('.EMC', '.DLE', '.ENG')]),
                'scripts_fr': len([e for e in valid_entries if e.ext in ('.FMC', '.DLF', '.FRE')]),
                'scripts_de': len([e for e in valid_entries if e.ext in ('.GMC', '.DLG', '.GER')]),
                'total_assets': len(valid_entries),
                'total_paks': len(app_state.repo.paks),
            }
            ext_counts = {}
            for e in valid_entries:
                ext_counts[e.ext] = ext_counts.get(e.ext, 0) + 1

            self.send_json_response({
                'game_dir': app_state.game_dir,
                'game_title': 'The Legend of Kyrandia 2: Hand of Fate',
                'counts': counts,
                'ext_counts': ext_counts,
                'file_types_catalog': FILE_TYPE_CATALOG,
                'paks': sorted(list(app_state.repo.paks.keys())),
            })

        elif path == "/api/assets":
            category = query.get('category', ['all'])[0].lower()
            pak_filter = query.get('pak', [''])[0].upper()
            search = query.get('q', [''])[0].lower()
            sort_by = query.get('sort', ['name'])[0].lower()
            sort_order = query.get('order', ['asc'])[0].lower()
            hide_non_useful_str = query.get('hide_non_useful', ['1'])[0].lower()
            hide_non_useful = hide_non_useful_str in ('1', 'true', 'yes')

            entries = app_state.repo.all_entries
            if hide_non_useful:
                entries = [e for e in entries if not app_state.is_non_useful(e)]

            if category == 'backgrounds':
                entries = [e for e in entries if e.ext == '.CPS']
            elif category == 'models':
                entries = [e for e in entries if e.ext in ('.SHP', '.CSH')]
            elif category == 'animations':
                entries = [e for e in entries if e.ext == '.WSA']
            elif category == 'soundtracks':
                entries = [e for e in entries if e.ext == '.XMI']
            elif category == 'sfx':
                entries = [e for e in entries if e.ext == '.VOC']
            elif category == 'palettes':
                entries = [e for e in entries if e.ext in ('.COL', '.PAL')]
            elif category == 'scripts':
                entries = [e for e in entries if e.ext in SCRIPT_EXTENSIONS]
            elif category == 'scripts_en':
                entries = [e for e in entries if e.ext in ('.EMC', '.DLE', '.ENG')]
            elif category == 'scripts_fr':
                entries = [e for e in entries if e.ext in ('.FMC', '.DLF', '.FRE')]
            elif category == 'scripts_de':
                entries = [e for e in entries if e.ext in ('.GMC', '.DLG', '.GER')]

            if pak_filter:
                entries = [e for e in entries if e.pak_name.upper() == pak_filter]

            if search:
                entries = [e for e in entries if search in e.name.lower() or search in e.pak_name.lower()]

            if sort_by == 'size':
                def get_sort_size(e):
                    if e.ext == '.CMP':
                        try:
                            raw = e.read()
                            if len(raw) >= 10:
                                return struct.unpack('<HHIH', raw[:10])[2]
                        except Exception:
                            return 65532
                    return e.size
                entries = sorted(entries, key=lambda e: (get_sort_size(e), e.name.upper()), reverse=(sort_order == 'desc'))
            else:
                entries = sorted(entries, key=lambda e: (e.name.upper(), e.size), reverse=(sort_order == 'desc'))

            results = []
            for e in entries:
                d = e.to_dict()
                type_info = get_file_type_info(e.ext)
                d['type_name'] = type_info.get('name')
                d['type_icon'] = type_info.get('icon')
                d['viewer_mode'] = type_info.get('viewer_mode')
                d['tech_specs'] = type_info.get('tech_specs')
                d['is_non_useful'] = app_state.is_non_useful(e)
                if e.ext in LANGUAGE_META:
                    d.update(LANGUAGE_META[e.ext])
                if e.ext == '.CMP':
                    try:
                        raw = e.read()
                        if len(raw) >= 10:
                            _, _, decomp_sz, _ = struct.unpack('<HHIH', raw[:10])
                            d['uncompressed_size'] = decomp_sz
                            d['is_compressed'] = True
                            d['uncompressed_label'] = 'Uncompressed value shown'
                    except Exception:
                        d['uncompressed_size'] = 65532
                        d['is_compressed'] = True
                        d['uncompressed_label'] = 'Uncompressed value shown'
                elif e.ext == '.CSH':
                    try:
                        raw = e.read()
                        if len(raw) >= 10:
                            _, _, decomp_sz, _ = struct.unpack('<HHIH', raw[:10])
                            d['uncompressed_size'] = decomp_sz
                            d['is_compressed'] = True
                    except Exception:
                        pass
                results.append(d)
            self.send_json_response({'count': len(results), 'assets': results})

        elif path == "/api/asset/details":
            pak_name = query.get('pak', [''])[0]
            name = query.get('name', [''])[0]
            entry = app_state.repo.get_entry(pak_name, name)
            if not entry:
                self.send_json_response({'error': 'Asset not found'}, status=404)
                return

            details = entry.to_dict()
            type_info = get_file_type_info(entry.ext)
            details['file_type_info'] = type_info
            details['type_name'] = type_info.get('name')
            details['type_icon'] = type_info.get('icon')
            details['tech_specs'] = type_info.get('tech_specs')
            details['description'] = type_info.get('description')
            details['is_non_useful'] = app_state.is_non_useful(entry)

            if entry.ext in ('.CPS', '.CMP'):
                try:
                    raw = entry.read()
                    img = decode_cps_data(raw, app_state.pal_manager, entry.pak_name, entry.name)
                    details['dimensions'] = f"{img.width}x{img.height}"
                    details['width'] = img.width
                    details['height'] = img.height
                    if entry.ext == '.CMP' and len(raw) >= 10:
                        file_sz, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
                        details['is_compressed'] = True
                        details['compression_type'] = f"Westwood Format 80 (type {comp_type})"
                        details['uncompressed_size'] = decomp_sz
                        details['raw_size'] = len(raw)
                        details['uncompressed_label'] = 'Uncompressed value shown'
                        details['is_transition_table'] = True
                        details['transition_engine_call'] = 'nestedFrameFadeTransition'
                        if decomp_sz > 0:
                            details['compression_ratio'] = f"{(1.0 - len(raw)/decomp_sz)*100:.1f}% saved"
                    # Get palette colors
                    pal = app_state.pal_manager.get_palette_for_asset(entry.pak_name, entry.name)
                    details['palette_sample'] = [
                        [pal[i*3], pal[i*3+1], pal[i*3+2]] for i in range(min(32, len(pal)//3))
                    ]
                    if entry.ext == '.CMP':
                        details['full_palette'] = [
                            [pal[i*3], pal[i*3+1], pal[i*3+2]] for i in range(min(256, len(pal)//3))
                        ]
                    details['linked_wsas'] = app_state.get_linked_wsas_for_cps(entry.pak_name, entry.name)
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext in ('.SHP', '.CSH'):
                try:
                    if entry.ext == '.CSH':
                        raw = entry.read()
                        if len(raw) >= 10:
                            file_sz, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
                            details['is_compressed'] = True
                            details['compression_type'] = f"Westwood Format 80 (type {comp_type})"
                            details['uncompressed_size'] = decomp_sz
                            details['raw_size'] = len(raw)
                            if decomp_sz > 0:
                                details['compression_ratio'] = f"{(1.0 - len(raw)/decomp_sz)*100:.1f}% saved"
                    model = app_state.get_shp(entry.pak_name, entry.name)
                    if model:
                        details['num_frames'] = model.num_frames
                        details['max_width'] = model.max_width
                        details['max_height'] = model.max_height
                        details['frame_sizes'] = [[f.width, f.height] for f in model.frames]
                        details['sheet_cols'] = min(model.num_frames, 8)
                        details['sheet_rows'] = (model.num_frames + details['sheet_cols'] - 1) // details['sheet_cols'] if details['sheet_cols'] > 0 else 0
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext == '.FNT':
                try:
                    font = app_state.get_fnt(entry.pak_name, entry.name)
                    if font and font.is_valid:
                        details.update(font.get_metadata())
                        details['dimensions'] = f"{font.max_width}x{font.max_height} px (max)"
                        details['num_glyphs'] = font.num_glyphs
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext == '.WSA':
                try:
                    anim = app_state.get_wsa(entry.pak_name, entry.name)
                    if anim:
                        details['num_frames'] = anim.num_frames
                        details['width'] = anim.width
                        details['height'] = anim.height
                        details['pos_x'] = anim.x_add
                        details['pos_y'] = anim.y_add
                        details['sheet_cols'] = min(anim.num_frames, 8)
                        details['sheet_rows'] = (anim.num_frames + details['sheet_cols'] - 1) // details['sheet_cols'] if details['sheet_cols'] > 0 else 0
                        details['has_bg'] = anim.has_bg
                        details['bg_name'] = anim.bg_name
                        details['bg_pak'] = anim.bg_pak
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext == '.XMI':
                try:
                    raw = entry.read()
                    mid = xmi_to_midi(raw)
                    meta = get_midi_metadata(mid)
                    details['midi_meta'] = meta
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext == '.VOC':
                try:
                    raw = entry.read()
                    wav = voc_to_wav(raw)
                    details['wav_size'] = len(wav)
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext in ('.COL', '.PAL'):
                try:
                    raw = entry.read()
                    pal_bytes = app_state.pal_manager._decode_palette_bytes(raw)
                    colors = []
                    for i in range(256):
                        r = pal_bytes[i*3]
                        g = pal_bytes[i*3 + 1]
                        b = pal_bytes[i*3 + 2]
                        colors.append({
                            'index': i,
                            'hex': f"#{r:02X}{g:02X}{b:02X}",
                            'r': r,
                            'g': g,
                            'b': b,
                            'dac_r': r >> 2,
                            'dac_g': g >> 2,
                            'dac_b': b >> 2,
                        })
                    details['colors'] = colors
                    details['num_colors'] = 256
                    details['is_compressed'] = len(raw) != 768
                    details['compression'] = 'Format 80 (LCW)' if len(raw) != 768 else 'Uncompressed (768 bytes)'
                    details['raw_size'] = len(raw)
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext in SCRIPT_EXTENSIONS:
                try:
                    raw = entry.read()
                    script_info = parse_script_file(raw, entry.ext, entry.name)
                    details['script_data'] = script_info
                    details['language'] = script_info.get('language')
                    details['language_name'] = script_info.get('language_name')
                    details['flag'] = script_info.get('flag')
                    details['script_type'] = script_info.get('category_label')
                    details['line_count'] = script_info.get('total_lines')
                    details['transcript_preview'] = script_info.get('transcript', '')[:500]
                except Exception as ex:
                    details['error'] = str(ex)

            else:
                try:
                    raw = entry.read()
                    raw_meta = inspect_raw_asset_data(raw, entry.ext, entry.name)
                    details['raw_inspection'] = raw_meta
                except Exception as ex:
                    details['raw_inspection'] = {'error': str(ex)}

            self.send_json_response(details)

        elif path == "/api/asset/preview":
            pak_name = query.get('pak', [''])[0]
            name = query.get('name', [''])[0]
            entry = app_state.repo.get_entry(pak_name, name)
            if not entry:
                self.send_error(404, "Asset not found")
                return

            frame_idx = int(query.get('frame', ['0'])[0])
            as_sheet = query.get('sheet', ['0'])[0] in ('1', 'true')
            as_gif = query.get('gif', ['0'])[0] in ('1', 'true')
            is_bg = query.get('bg', ['0'])[0] in ('1', 'true')
            crop_panel = query.get('crop_panel', ['0'])[0] in ('1', 'true')

            try:
                if entry.ext in ('.CPS', '.CMP'):
                    with_anims = query.get('with_anims', ['0'])[0] in ('1', 'true')
                    if with_anims:
                        all_linked_meta = app_state.get_linked_wsas_for_cps(entry.pak_name, entry.name)
                        anims_raw = query.get('anims', [None])[0]
                        if anims_raw is not None:
                            order_list = [a.strip().upper() for a in anims_raw.split(',') if a.strip()]
                            meta_by_name = {w['name'].upper(): w for w in all_linked_meta}
                            linked_meta = [meta_by_name[n] for n in order_list if n in meta_by_name]
                        else:
                            linked_meta = all_linked_meta
                        linked_anims = [app_state.get_wsa(w['pak_name'], w['name']) for w in linked_meta]
                        linked_anims = [a for a in linked_anims if a is not None]
                        positions_raw = query.get('positions', [None])[0]
                        anim_positions = {}
                        if positions_raw:
                            for item in positions_raw.split(';'):
                                if ':' in item:
                                    pname, coords = item.split(':', 1)
                                    if ',' in coords:
                                        cx, cy = coords.split(',', 1)
                                        try:
                                            anim_positions[pname.strip().upper()] = (int(cx.strip()), int(cy.strip()))
                                        except ValueError:
                                            pass

                        if as_gif:
                            gif_bytes = render_cps_composite_gif(entry, app_state.pal_manager, linked_anims, crop_panel=crop_panel, anim_positions=anim_positions)
                            self.send_bytes_response(gif_bytes, 'image/gif')
                        else:
                            png_bytes = render_cps_composite_png(entry, app_state.pal_manager, linked_anims, crop_panel=crop_panel, anim_positions=anim_positions)
                            self.send_bytes_response(png_bytes, 'image/png')
                    else:
                        if as_gif:
                            gif_bytes = render_cps_to_gif(entry, app_state.pal_manager, crop_panel=crop_panel)
                            self.send_bytes_response(gif_bytes, 'image/gif')
                        else:
                            png_bytes = render_cps_to_png(entry, app_state.pal_manager, crop_panel=crop_panel)
                            self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext in ('.SHP', '.CSH'):
                    if as_sheet:
                        png_bytes = app_state.get_shp_spritesheet(entry.pak_name, entry.name)
                    else:
                        png_bytes = app_state.get_shp_frame_png(entry.pak_name, entry.name, frame_idx)
                    self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext == '.WSA':
                    if is_bg:
                        png_bytes = app_state.get_wsa_bg_png(entry.pak_name, entry.name, crop_panel=crop_panel)
                        self.send_bytes_response(png_bytes, 'image/png')
                    elif as_sheet:
                        png_bytes, cols, rows = app_state.get_wsa_spritesheet(entry.pak_name, entry.name)
                        self.send_bytes_response(png_bytes, 'image/png')
                    elif as_gif:
                        anim = app_state.get_wsa(entry.pak_name, entry.name)
                        gif_bytes = anim.render_gif() if anim else b""
                        self.send_bytes_response(gif_bytes, 'image/gif')
                    else:
                        png_bytes = app_state.get_wsa_frame_png(entry.pak_name, entry.name, frame_idx)
                        self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext in ('.COL', '.PAL'):
                    raw = entry.read()
                    pal_bytes = app_state.pal_manager._decode_palette_bytes(raw)
                    cell_size = int(query.get('cell', ['16'])[0])
                    cell_size = max(1, min(64, cell_size))
                    png_bytes = render_palette_to_png(pal_bytes, cell_size)
                    self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext == '.XMI':
                    raw = entry.read()
                    mid = xmi_to_midi(raw)
                    self.send_bytes_response(mid, 'audio/midi', filename=f"{os.path.splitext(entry.name)[0]}.mid")

                elif entry.ext == '.VOC':
                    raw = entry.read()
                    wav = voc_to_wav(raw)
                    self.send_bytes_response(wav, 'audio/wav', filename=f"{os.path.splitext(entry.name)[0]}.wav")

                elif entry.ext == '.FNT':
                    font = app_state.get_fnt(entry.pak_name, entry.name)
                    if not font or not font.is_valid:
                        self.send_bytes_response(entry.read(), 'application/octet-stream')
                    else:
                        scheme = query.get('scheme', ['gold'])[0]
                        text_val = query.get('text', [None])[0]
                        glyph_idx = query.get('glyph', [None])[0]
                        if glyph_idx is not None:
                            try:
                                g = font.get_glyph(int(glyph_idx))
                                img = g.render_image(COLOR_SCHEMES.get(scheme, COLOR_SCHEMES['gold'])) if g else Image.new('RGBA', (1, 1), (0, 0, 0, 0))
                                buf = io.BytesIO()
                                img.save(buf, format='PNG')
                                self.send_bytes_response(buf.getvalue(), 'image/png')
                            except ValueError:
                                self.send_bytes_response(font.render_preview_png(scheme), 'image/png')
                        elif text_val is not None:
                            img = font.render_string(text_val, scheme=scheme)
                            buf = io.BytesIO()
                            img.save(buf, format='PNG')
                            self.send_bytes_response(buf.getvalue(), 'image/png')
                        elif as_sheet:
                            png_bytes = font.render_sheet_png(scheme=scheme)
                            self.send_bytes_response(png_bytes, 'image/png')
                        else:
                            png_bytes = font.render_preview_png(scheme=scheme)
                            self.send_bytes_response(png_bytes, 'image/png')

                else:
                    raw = entry.read()
                    self.send_bytes_response(raw, 'application/octet-stream')
            except Exception as ex:
                self.send_json_response({'error': f'Failed to generate preview: {str(ex)}'}, status=500)

        elif path == "/api/asset/export":
            # Direct download endpoint
            pak_name = query.get('pak', [''])[0]
            name = query.get('name', [''])[0]
            entry = app_state.repo.get_entry(pak_name, name)
            if not entry:
                self.send_error(404, "Asset not found")
                return

            as_sheet = query.get('sheet', ['0'])[0] in ('1', 'true')
            as_gif = query.get('gif', ['0'])[0] in ('1', 'true')
            crop_panel = query.get('crop_panel', ['0'])[0] in ('1', 'true')
            frame_idx = int(query.get('frame', ['0'])[0])
            base_name = os.path.splitext(entry.name)[0]

            uncompressed = query.get('uncompressed', ['0'])[0] in ('1', 'true')
            if uncompressed:
                raw = entry.read()
                if entry.ext == '.CMP' and len(raw) >= 10:
                    file_sz, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
                    decomp_bytes = format80_decode(raw[10+pal_sz:], decomp_sz) if pal_sz > 0 else format80_decode(raw[10:], decomp_sz)
                    self.send_bytes_response(decomp_bytes, 'application/octet-stream', filename=f"{base_name}.BIN", download=True)
                    return
                elif entry.ext == '.CSH' and len(raw) >= 10:
                    file_sz, comp_type, decomp_sz, pal_sz = struct.unpack('<HHIH', raw[:10])
                    decomp_bytes = format80_decode(raw[10:], decomp_sz)
                    self.send_bytes_response(decomp_bytes, 'application/octet-stream', filename=f"{base_name}.SHP", download=True)
                    return

            try:
                if entry.ext in ('.CPS', '.CMP'):
                    with_anims = query.get('with_anims', ['0'])[0] in ('1', 'true')
                    suffix = '_scene' if crop_panel else ''
                    if with_anims:
                        all_linked_meta = app_state.get_linked_wsas_for_cps(entry.pak_name, entry.name)
                        anims_raw = query.get('anims', [None])[0]
                        if anims_raw is not None:
                            order_list = [a.strip().upper() for a in anims_raw.split(',') if a.strip()]
                            meta_by_name = {w['name'].upper(): w for w in all_linked_meta}
                            linked_meta = [meta_by_name[n] for n in order_list if n in meta_by_name]
                        else:
                            linked_meta = all_linked_meta
                        linked_anims = [app_state.get_wsa(w['pak_name'], w['name']) for w in linked_meta]
                        linked_anims = [a for a in linked_anims if a is not None]

                        positions_raw = query.get('positions', [None])[0]
                        anim_positions = {}
                        if positions_raw:
                            for item in positions_raw.split(';'):
                                if ':' in item:
                                    pname, coords = item.split(':', 1)
                                    if ',' in coords:
                                        cx, cy = coords.split(',', 1)
                                        try:
                                            anim_positions[pname.strip().upper()] = (int(cx.strip()), int(cy.strip()))
                                        except ValueError:
                                            pass

                        anim_suffix = f"_{len(linked_anims)}anims" if anims_raw is not None and len(linked_anims) < len(all_linked_meta) else "_animated"
                        if as_gif or query.get('format', [''])[0].lower() == 'gif':
                            gif_bytes = render_cps_composite_gif(entry, app_state.pal_manager, linked_anims, crop_panel=crop_panel, anim_positions=anim_positions)
                            self.send_bytes_response(gif_bytes, 'image/gif', filename=f"{base_name}{anim_suffix}{suffix}.gif", download=True)
                        else:
                            png_bytes = render_cps_composite_png(entry, app_state.pal_manager, linked_anims, crop_panel=crop_panel, anim_positions=anim_positions)
                            self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}{anim_suffix}{suffix}.png", download=True)
                    else:
                        if as_gif or query.get('format', [''])[0].lower() == 'gif':
                            gif_bytes = render_cps_to_gif(entry, app_state.pal_manager, crop_panel=crop_panel)
                            self.send_bytes_response(gif_bytes, 'image/gif', filename=f"{base_name}{suffix}.gif", download=True)
                        else:
                            png_bytes = render_cps_to_png(entry, app_state.pal_manager, crop_panel=crop_panel)
                            self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}{suffix}.png", download=True)

                elif entry.ext in ('.SHP', '.CSH'):
                    if as_sheet:
                        png_bytes = app_state.get_shp_spritesheet(entry.pak_name, entry.name)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_spritesheet.png", download=True)
                    else:
                        png_bytes = app_state.get_shp_frame_png(entry.pak_name, entry.name, frame_idx)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_frame{frame_idx}.png", download=True)

                elif entry.ext == '.WSA':
                    with_bg = query.get('with_bg', ['0'])[0] in ('1', 'true')
                    full_scene = query.get('full_scene', ['0'])[0] in ('1', 'true')
                    custom_ox = int(query['pos_x'][0]) if 'pos_x' in query and query['pos_x'][0] != '' else None
                    custom_oy = int(query['pos_y'][0]) if 'pos_y' in query and query['pos_y'][0] != '' else None
                    suffix = '_scene' if (full_scene and crop_panel) else ''
                    if as_sheet:
                        png_bytes, cols, rows = app_state.get_wsa_spritesheet(entry.pak_name, entry.name)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_spritesheet.png", download=True)
                    elif as_gif:
                        anim = app_state.get_wsa(entry.pak_name, entry.name)
                        gif_bytes = anim.render_gif(include_bg=with_bg, full_scene=full_scene, crop_panel=crop_panel, offset_x=custom_ox, offset_y=custom_oy) if anim else b""
                        self.send_bytes_response(gif_bytes, 'image/gif', filename=f"{base_name}{suffix}.gif", download=True)
                    else:
                        anim = app_state.get_wsa(entry.pak_name, entry.name)
                        if with_bg or full_scene:
                            png_bytes = anim.render_frame_png(frame_idx, include_bg=with_bg, full_scene=full_scene, crop_panel=crop_panel, offset_x=custom_ox, offset_y=custom_oy) if anim else b""
                        else:
                            png_bytes = app_state.get_wsa_frame_png(entry.pak_name, entry.name, frame_idx)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_frame{frame_idx}{suffix}.png", download=True)

                elif entry.ext in ('.COL', '.PAL'):
                    raw = entry.read()
                    pal_bytes = app_state.pal_manager._decode_palette_bytes(raw)
                    export_fmt = query.get('format', ['col'])[0].lower()
                    if export_fmt == 'png':
                        png_bytes = render_palette_to_png(pal_bytes, cell_size=16)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_palette.png", download=True)
                    elif export_fmt == 'gpl':
                        lines = ["GIMP Palette", f"Name: {entry.name}", "Columns: 16", "#"]
                        for i in range(256):
                            r = pal_bytes[i*3]
                            g = pal_bytes[i*3 + 1]
                            b = pal_bytes[i*3 + 2]
                            lines.append(f"{r:3d} {g:3d} {b:3d}  Index {i}")
                        gpl_bytes = "\n".join(lines).encode('utf-8')
                        self.send_bytes_response(gpl_bytes, 'text/plain', filename=f"{base_name}.gpl", download=True)
                    elif export_fmt == 'pal':
                        lines = ["JASC-PAL", "0100", "256"]
                        for i in range(256):
                            r = pal_bytes[i*3]
                            g = pal_bytes[i*3 + 1]
                            b = pal_bytes[i*3 + 2]
                            lines.append(f"{r} {g} {b}")
                        pal_file_bytes = "\n".join(lines).encode('utf-8')
                        self.send_bytes_response(pal_file_bytes, 'text/plain', filename=f"{base_name}.pal", download=True)
                    else:
                        self.send_bytes_response(raw, 'application/octet-stream', filename=entry.name, download=True)

                elif entry.ext == '.XMI':
                    raw = entry.read()
                    mid = xmi_to_midi(raw)
                    self.send_bytes_response(mid, 'audio/midi', filename=f"{base_name}.mid", download=True)

                elif entry.ext == '.VOC':
                    raw = entry.read()
                    wav = voc_to_wav(raw)
                    self.send_bytes_response(wav, 'audio/wav', filename=f"{base_name}.wav", download=True)

                elif entry.ext in SCRIPT_EXTENSIONS:
                    raw = entry.read()
                    export_fmt = query.get('format', ['txt'])[0].lower()
                    if export_fmt == 'txt':
                        script_info = parse_script_file(raw, entry.ext, entry.name)
                        txt_bytes = script_info.get('transcript', '').encode('utf-8')
                        self.send_bytes_response(txt_bytes, 'text/plain; charset=utf-8', filename=f"{base_name}_{entry.ext.replace('.', '')}.txt", download=True)
                    else:
                        self.send_bytes_response(raw, 'application/octet-stream', filename=entry.name, download=True)

                elif entry.ext == '.FNT':
                    font = app_state.get_fnt(entry.pak_name, entry.name)
                    scheme = query.get('scheme', ['gold'])[0]
                    text_val = query.get('text', [None])[0]
                    if text_val is not None and font and font.is_valid:
                        img = font.render_string(text_val, scheme=scheme)
                        buf = io.BytesIO()
                        img.save(buf, format='PNG')
                        self.send_bytes_response(buf.getvalue(), 'image/png', filename=f"{base_name}_text.png", download=True)
                    elif font and font.is_valid:
                        png_bytes = font.render_sheet_png(scheme=scheme)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_fontsheet.png", download=True)
                    else:
                        self.send_bytes_response(entry.read(), 'application/octet-stream', filename=entry.name, download=True)

                else:
                    raw = entry.read()
                    self.send_bytes_response(raw, 'application/octet-stream', filename=entry.name, download=True)
            except Exception as ex:
                self.send_json_response({'error': f'Failed to export asset: {str(ex)}'}, status=500)

        elif path == "/api/batch_status":
            job = app_state.extractor.current_job
            if job:
                self.send_json_response(job.to_dict())
            else:
                self.send_json_response({'status': 'idle'})

        else:
            self.send_json_response({'error': 'Endpoint not found'}, status=404)

    def send_json_response(self, data: Any, status: int = 200):
        try:
            body = json.dumps(data).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_bytes_response(self, data: bytes, content_type: str, filename: str = "", download: bool = False):
        try:
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            if filename:
                disposition = 'attachment' if download else 'inline'
                self.send_header('Content-Disposition', f'{disposition}; filename="{filename}"')
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        # Quiet logging for smooth performance
        pass


def run_server(host: str = "127.0.0.1", port: int = 8080):
    server = ThreadingHTTPServer((host, port), AppRequestHandler)
    print(f"Kyrandia 2 Asset Explorer running at http://{host}:{port}/")
    return server

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = run_server("127.0.0.1", port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()
