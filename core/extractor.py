"""
Batch Asset Extractor for Kyrandia 2: Hand of Fate.
Handles exporting rendered pictures of models and backgrounds, MIDI soundtracks, and audio.
"""

import os
import io
import zipfile
import threading
from typing import Dict, Any, Callable, Optional, List
from .pak import GameRepository, PakEntry
from .palette import PaletteManager
from .cps import decode_cps_data
from .shp import decode_shp
from .xmi2mid import xmi_to_midi
from .voc2wav import voc_to_wav
from .wsa import decode_wsa

class ExtractionJob:
    def __init__(self, job_type: str, dest_dir: str):
        self.job_type = job_type
        self.dest_dir = dest_dir
        self.status = "pending"  # pending, running, completed, error
        self.progress = 0.0
        self.total_items = 0
        self.processed_items = 0
        self.current_item = ""
        self.message = ""
        self.error_message = ""
        self.extracted_files: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            'job_type': self.job_type,
            'dest_dir': self.dest_dir,
            'status': self.status,
            'progress': round(self.progress, 1),
            'total_items': self.total_items,
            'processed_items': self.processed_items,
            'current_item': self.current_item,
            'message': self.message,
            'error_message': self.error_message,
            'extracted_count': len(self.extracted_files),
        }


class BatchExtractor:
    def __init__(self, repo: GameRepository, pal_manager: PaletteManager):
        self.repo = repo
        self.pal_manager = pal_manager
        self.current_job: Optional[ExtractionJob] = None
        self._lock = threading.Lock()

    def start_batch_export(self, export_type: str, dest_dir: str = "exported_assets") -> ExtractionJob:
        with self._lock:
            if self.current_job and self.current_job.status == "running":
                return self.current_job

            # Make absolute path inside workspace if relative
            if not os.path.isabs(dest_dir):
                dest_dir = os.path.join(self.repo.game_dir, "..", dest_dir)
            dest_dir = os.path.abspath(dest_dir)

            job = ExtractionJob(export_type, dest_dir)
            self.current_job = job

            thread = threading.Thread(target=self._run_job, args=(job,), daemon=True)
            thread.start()
            return job

    def _run_job(self, job: ExtractionJob):
        try:
            job.status = "running"
            job.message = "Preparing asset export..."
            os.makedirs(job.dest_dir, exist_ok=True)

            if job.job_type == "backgrounds":
                self._export_backgrounds(job)
            elif job.job_type == "models":
                self._export_models(job)
            elif job.job_type == "midi":
                self._export_midi(job)
            elif job.job_type == "all":
                self._export_all(job)
            else:
                job.status = "error"
                job.error_message = f"Unknown export type: {job.job_type}"
                return

            job.status = "completed"
            job.progress = 100.0
            job.message = f"Successfully exported {len(job.extracted_files)} files to {job.dest_dir}"

        except Exception as e:
            job.status = "error"
            job.error_message = str(e)
            job.message = f"Export failed: {e}"

    def _export_backgrounds(self, job: ExtractionJob):
        cps_entries = self.repo.get_entries_by_ext('.CPS')
        job.total_items = len(cps_entries)
        out_folder = os.path.join(job.dest_dir, "backgrounds")
        os.makedirs(out_folder, exist_ok=True)

        for idx, entry in enumerate(cps_entries):
            job.processed_items = idx + 1
            job.progress = (job.processed_items / job.total_items) * 100.0
            job.current_item = f"{entry.pak_name} -> {entry.name}"

            try:
                raw = entry.read()
                img = decode_cps_data(raw, self.pal_manager, entry.pak_name, entry.name)
                base = os.path.splitext(entry.name)[0]
                out_name = f"{base}_{entry.pak_name.replace('.PAK','')}.png"
                out_path = os.path.join(out_folder, out_name)
                img.save(out_path, format='PNG')
                job.extracted_files.append(out_path)
            except Exception as ex:
                pass

    def _export_models(self, job: ExtractionJob):
        shp_entries = self.repo.get_entries_by_ext('.SHP')
        job.total_items = len(shp_entries)
        out_folder = os.path.join(job.dest_dir, "models")
        os.makedirs(out_folder, exist_ok=True)

        for idx, entry in enumerate(shp_entries):
            job.processed_items = idx + 1
            job.progress = (job.processed_items / job.total_items) * 100.0
            job.current_item = f"{entry.pak_name} -> {entry.name}"

            try:
                raw = entry.read()
                model = decode_shp(raw, self.pal_manager, entry.pak_name, entry.name)
                base = os.path.splitext(entry.name)[0]

                # 1. Save full sprite sheet
                sheet_data = model.render_spritesheet_png()
                sheet_name = f"{base}_{entry.pak_name.replace('.PAK','')}_sheet.png"
                sheet_path = os.path.join(out_folder, sheet_name)
                with open(sheet_path, 'wb') as sf:
                    sf.write(sheet_data)
                job.extracted_files.append(sheet_path)

                # 2. Save individual frames in subfolder
                if model.num_frames > 1:
                    frames_folder = os.path.join(out_folder, f"{base}_{entry.pak_name.replace('.PAK','')}_frames")
                    os.makedirs(frames_folder, exist_ok=True)
                    for fidx in range(model.num_frames):
                        frame_png = model.render_frame_png(fidx)
                        f_path = os.path.join(frames_folder, f"{base}_frame{fidx:03d}.png")
                        with open(f_path, 'wb') as ff:
                            ff.write(frame_png)
                        job.extracted_files.append(f_path)

            except Exception as ex:
                pass

    def _export_midi(self, job: ExtractionJob):
        xmi_entries = self.repo.get_entries_by_ext('.XMI')
        job.total_items = len(xmi_entries)
        out_folder = os.path.join(job.dest_dir, "soundtracks")
        os.makedirs(out_folder, exist_ok=True)

        for idx, entry in enumerate(xmi_entries):
            job.processed_items = idx + 1
            job.progress = (job.processed_items / job.total_items) * 100.0
            job.current_item = f"{entry.pak_name} -> {entry.name}"

            try:
                raw = entry.read()
                midi_bytes = xmi_to_midi(raw)
                base = os.path.splitext(entry.name)[0]
                out_name = f"{base}.mid"
                out_path = os.path.join(out_folder, out_name)
                with open(out_path, 'wb') as mf:
                    mf.write(midi_bytes)
                job.extracted_files.append(out_path)
            except Exception as ex:
                pass

    def _export_all(self, job: ExtractionJob):
        cps_entries = self.repo.get_entries_by_ext('.CPS')
        shp_entries = self.repo.get_entries_by_ext('.SHP')
        xmi_entries = self.repo.get_entries_by_ext('.XMI')
        voc_entries = self.repo.get_entries_by_ext('.VOC')

        total = len(cps_entries) + len(shp_entries) + len(xmi_entries) + len(voc_entries)
        job.total_items = total
        step = 0

        # Export backgrounds
        bg_folder = os.path.join(job.dest_dir, "backgrounds")
        os.makedirs(bg_folder, exist_ok=True)
        for entry in cps_entries:
            step += 1
            job.processed_items = step
            job.progress = (step / total) * 100.0
            job.current_item = f"Background: {entry.name}"
            try:
                raw = entry.read()
                img = decode_cps_data(raw, self.pal_manager, entry.pak_name, entry.name)
                base = os.path.splitext(entry.name)[0]
                out_path = os.path.join(bg_folder, f"{base}_{entry.pak_name.replace('.PAK','')}.png")
                img.save(out_path, format='PNG')
                job.extracted_files.append(out_path)
            except Exception:
                pass

        # Export models
        model_folder = os.path.join(job.dest_dir, "models")
        os.makedirs(model_folder, exist_ok=True)
        for entry in shp_entries:
            step += 1
            job.processed_items = step
            job.progress = (step / total) * 100.0
            job.current_item = f"Model: {entry.name}"
            try:
                raw = entry.read()
                model = decode_shp(raw, self.pal_manager, entry.pak_name, entry.name)
                base = os.path.splitext(entry.name)[0]
                sheet_data = model.render_spritesheet_png()
                out_path = os.path.join(model_folder, f"{base}_sheet.png")
                with open(out_path, 'wb') as f:
                    f.write(sheet_data)
                job.extracted_files.append(out_path)
            except Exception:
                pass

        # Export MIDI
        music_folder = os.path.join(job.dest_dir, "soundtracks")
        os.makedirs(music_folder, exist_ok=True)
        for entry in xmi_entries:
            step += 1
            job.processed_items = step
            job.progress = (step / total) * 100.0
            job.current_item = f"Soundtrack: {entry.name}"
            try:
                raw = entry.read()
                mid = xmi_to_midi(raw)
                base = os.path.splitext(entry.name)[0]
                out_path = os.path.join(music_folder, f"{base}.mid")
                with open(out_path, 'wb') as f:
                    f.write(mid)
                job.extracted_files.append(out_path)
            except Exception:
                pass

        # Export Audio VOC
        sfx_folder = os.path.join(job.dest_dir, "audio_sfx")
        os.makedirs(sfx_folder, exist_ok=True)
        for entry in voc_entries:
            step += 1
            job.processed_items = step
            job.progress = (step / total) * 100.0
            job.current_item = f"Audio: {entry.name}"
            try:
                raw = entry.read()
                wav = voc_to_wav(raw)
                if wav:
                    base = os.path.splitext(entry.name)[0]
                    out_path = os.path.join(sfx_folder, f"{base}.wav")
                    with open(out_path, 'wb') as f:
                        f.write(wav)
                    job.extracted_files.append(out_path)
            except Exception:
                pass
