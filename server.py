"""
Desktop Backend HTTP Server and REST API for Kyrandia 2 Classic Game Browser.
"""

import os
import io
import json
import urllib.parse
import struct
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from typing import Optional, Any, Dict, Tuple
from PIL import Image

from core.pak import GameRepository
from core.palette import PaletteManager
from core.format80 import format80_decode
from core.cps import decode_cps_data, render_cps_to_png
from core.shp import decode_shp, ShpModel
from core.wsa import decode_wsa, WsaAnimation
from core.xmi2mid import xmi_to_midi, get_midi_metadata
from core.voc2wav import voc_to_wav
from core.extractor import BatchExtractor
from core.script_text import parse_script_file, SCRIPT_EXTENSIONS, LANGUAGE_META
from core.file_types import get_file_type_info, inspect_raw_asset_data, FILE_TYPE_CATALOG

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

    def set_directory(self, new_dir: str):
        self.game_dir = os.path.abspath(new_dir)
        self.repo = GameRepository(self.game_dir)
        self.pal_manager = PaletteManager(self.repo)
        self.extractor = BatchExtractor(self.repo, self.pal_manager)
        self._wsa_cache.clear()
        self._shp_cache.clear()
        self._frame_png_cache.clear()
        self._sheet_cache.clear()

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
            counts = {
                'backgrounds': len(app_state.repo.get_entries_by_ext('.CPS')) + len(app_state.repo.get_entries_by_ext('.CMP')),
                'models': len(app_state.repo.get_entries_by_ext('.SHP')) + len(app_state.repo.get_entries_by_ext('.CSH')),
                'animations': len(app_state.repo.get_entries_by_ext('.WSA')),
                'soundtracks': len(app_state.repo.get_entries_by_ext('.XMI')),
                'sfx': len(app_state.repo.get_entries_by_ext('.VOC')),
                'palettes': len(app_state.repo.get_entries_by_ext('.COL')) + len(app_state.repo.get_entries_by_ext('.PAL')),
                'scripts': len([e for e in app_state.repo.all_entries if e.ext in SCRIPT_EXTENSIONS]),
                'scripts_en': len([e for e in app_state.repo.all_entries if e.ext in ('.EMC', '.DLE', '.ENG')]),
                'scripts_fr': len([e for e in app_state.repo.all_entries if e.ext in ('.FMC', '.DLF', '.FRE')]),
                'scripts_de': len([e for e in app_state.repo.all_entries if e.ext in ('.GMC', '.DLG', '.GER')]),
                'total_assets': len(app_state.repo.all_entries),
                'total_paks': len(app_state.repo.paks),
            }
            ext_counts = {}
            for e in app_state.repo.all_entries:
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

            entries = app_state.repo.all_entries

            if category == 'backgrounds':
                entries = [e for e in entries if e.ext in ('.CPS', '.CMP')]
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
                entries = sorted(entries, key=lambda e: (e.size, e.name.upper()), reverse=(sort_order == 'desc'))
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
                if e.ext in LANGUAGE_META:
                    d.update(LANGUAGE_META[e.ext])
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

            if entry.ext in ('.CPS', '.CMP'):
                try:
                    raw = entry.read()
                    img = decode_cps_data(raw, app_state.pal_manager, entry.pak_name, entry.name)
                    details['dimensions'] = f"{img.width}x{img.height}"
                    details['width'] = img.width
                    details['height'] = img.height
                    # Get palette colors
                    pal = app_state.pal_manager.get_palette_for_asset(entry.pak_name, entry.name)
                    details['palette_sample'] = [
                        [pal[i*3], pal[i*3+1], pal[i*3+2]] for i in range(min(32, len(pal)//3))
                    ]
                except Exception as ex:
                    details['error'] = str(ex)

            elif entry.ext in ('.SHP', '.CSH'):
                try:
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

            try:
                if entry.ext in ('.CPS', '.CMP'):
                    png_bytes = render_cps_to_png(entry, app_state.pal_manager)
                    self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext in ('.SHP', '.CSH'):
                    if as_sheet:
                        png_bytes = app_state.get_shp_spritesheet(entry.pak_name, entry.name)
                    else:
                        png_bytes = app_state.get_shp_frame_png(entry.pak_name, entry.name, frame_idx)
                    self.send_bytes_response(png_bytes, 'image/png')

                elif entry.ext == '.WSA':
                    if as_sheet:
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
            frame_idx = int(query.get('frame', ['0'])[0])
            base_name = os.path.splitext(entry.name)[0]

            try:
                if entry.ext in ('.CPS', '.CMP'):
                    png_bytes = render_cps_to_png(entry, app_state.pal_manager)
                    self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}.png", download=True)

                elif entry.ext in ('.SHP', '.CSH'):
                    if as_sheet:
                        png_bytes = app_state.get_shp_spritesheet(entry.pak_name, entry.name)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_spritesheet.png", download=True)
                    else:
                        png_bytes = app_state.get_shp_frame_png(entry.pak_name, entry.name, frame_idx)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_frame{frame_idx}.png", download=True)

                elif entry.ext == '.WSA':
                    if as_sheet:
                        png_bytes, cols, rows = app_state.get_wsa_spritesheet(entry.pak_name, entry.name)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_spritesheet.png", download=True)
                    elif as_gif:
                        anim = app_state.get_wsa(entry.pak_name, entry.name)
                        gif_bytes = anim.render_gif() if anim else b""
                        self.send_bytes_response(gif_bytes, 'image/gif', filename=f"{base_name}.gif", download=True)
                    else:
                        png_bytes = app_state.get_wsa_frame_png(entry.pak_name, entry.name, frame_idx)
                        self.send_bytes_response(png_bytes, 'image/png', filename=f"{base_name}_frame{frame_idx}.png", download=True)

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
