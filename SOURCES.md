# Technical Sources & Reference Documentation

This document provides a detailed breakdown of where all algorithms, file format specifications, reverse-engineering findings, and engine behaviors implemented in the **Kyrandia 2: Hand of Fate — Asset Studio & Extractor** were sourced from.

---

## 1. Engine Reverse Engineering & Open-Source Implementations

### The ScummVM Project (`engines/kyra/`)
The primary reference for the runtime behavior, memory layout, and decompression routines of Westwood Studios' Kyra engine is the open-source ScummVM project.
- **Repository**: [https://github.com/scummvm/scummvm/tree/master/engines/kyra](https://github.com/scummvm/scummvm/tree/master/engines/kyra)
- **License**: GNU General Public License v2.0 or later (GPLv2+)

Specific subsystem sources consulted:
| File / Subsystem | Description & Sourced Information | Project Module |
|---|---|---|
| `graphics/screen_hof.cpp` | **Format 80 (LCW) stream decompressor**: Sliding window ring buffer, command byte flags ($0x00..0xFF$), run-length copy opcodes, and palette 6-bit DAC shifting ($0..63 \to 0..255$). | [`core/format80.py`](file:///home/user1/ws/classic-game-browser/core/format80.py) |
| `graphics/wsamovie_v2.cpp`<br>`graphics/wsamovie.cpp` | **WSAMovie_v2 container & Format 40 XOR-delta**: Movie header structure (frames, width, height, delta offsets), XOR-delta opcodes ($0x00$ skip, $0x01$ copy, $0x02$ XOR, $0x03$ fill), and frame delay timing. | [`core/wsa.py`](file:///home/user1/ws/classic-game-browser/core/wsa.py)<br>[`core/format40.py`](file:///home/user1/ws/classic-game-browser/core/format40.py) |
| `engine/kyra_hof.h`<br>`graphics/scene_hof.cpp` | **Character Shading & Palette Table Architecture (`_scenePal`)**: 9-level lighting matrix ($9 \times 16 \times 3 = 432$ bytes) in scene `.COL` files. Copying active lighting levels to character palette slots $112..127$, specifically Level 6 ($208..223$ in `INSHOP.COL`) for Zanthia's Yeti disguise in `INSHPZY.WSA`. | [`core/palette.py`](file:///home/user1/ws/classic-game-browser/core/palette.py) |
| `resource/resource.cpp` | **Westwood PAK Container Format**: Archive header structure, entry index tables, offset calculations, and XOR-based size decoding. | [`core/pak.py`](file:///home/user1/ws/classic-game-browser/core/pak.py) |
| `text/text.cpp`<br>`gui/gui_hof.cpp` | **Dual Tile Encoding (DTE) Text Compression**: 2-byte token replacement dictionaries used in game dialogue, item descriptions, and book pages; DOS Code Page 850 mapping for French accents and German umlauts. | [`core/script_text.py`](file:///home/user1/ws/classic-game-browser/core/script_text.py) |
| `sound/sound_intern.cpp`<br>`sound/sound_pc98.cpp` | **Miles Sound System (MSS) Integration**: Driver initialization, sequence timing, patch bank routing (`.ADL`, `.C55`), and sound effect event cues. | [`core/xmi2mid.py`](file:///home/user1/ws/classic-game-browser/core/xmi2mid.py) |
| `engine/screen.cpp` | **Color Translation Maps (`.CMP`)**: Decompression of 256×256 cross-fade LUTs used in cinematic transitions (`nestedFrameFadeTransition`). | [`core/file_types.py`](file:///home/user1/ws/classic-game-browser/core/file_types.py) |

---

## 2. Public File Format Specifications

### MultimediaWiki (`wiki.multimedia.cx`)
Community-maintained specifications documenting Westwood Studios multimedia containers and compression standards:
- **Format 80 (LCW)**: [https://wiki.multimedia.cx/index.php/Westwood_Format_80](https://wiki.multimedia.cx/index.php/Westwood_Format_80)
  - Documents bitwise command opcodes: Short Copy ($0x00..0x7F$), Relative Copy ($0x80..0xBF$), Medium Copy ($0xC0..0xFE$), and Long Copy/End marker ($0xFF$).
- **Format 40 (XOR-Delta)**: [https://wiki.multimedia.cx/index.php/Westwood_Format_40](https://wiki.multimedia.cx/index.php/Westwood_Format_40)
  - Documents XOR-delta byte encoding used for inter-frame animation deltas in `.WSA` movie files.
- **Westwood Shape File (`.SHP`)**: [https://wiki.multimedia.cx/index.php/Westwood_SHP_Format](https://wiki.multimedia.cx/index.php/Westwood_SHP_Format)
  - Documents multi-frame sprite headers, bounding dimensions ($X, Y, W, H$), and zero-transparency run-length encoding.
- **Westwood Animation (`.WSA`)**: [https://wiki.multimedia.cx/index.php/Westwood_WSA_Format](https://wiki.multimedia.cx/index.php/Westwood_WSA_Format)
  - Documents container headers, frame count, delta chunk offset tables, and looping parameters.
- **Westwood CPS Graphic File**: [https://wiki.multimedia.cx/index.php/Westwood_CPS_Format](https://wiki.multimedia.cx/index.php/Westwood_CPS_Format)
  - Documents 320×200 VGA background container headers, embedded 768-byte palette chunk, and Format 80 payload.
- **Westwood COL Palette File**: [https://wiki.multimedia.cx/index.php/Westwood_COL_Format](https://wiki.multimedia.cx/index.php/Westwood_COL_Format)
  - Documents 768-byte raw VGA color definitions with 6-bit DAC values ($0..63$).

### Miles Extended MIDI (XMIDI) Specification
- **Author**: John Miles (RAD Game Tools / Miles Design, 1991–1995).
- **Specification**: *Miles Sound System XMIDI Format Architecture*.
- **Sourced Information**:
  - IFF container chunks: `FORM XMID`, `TIMB` (timbre banks), `CAT ` (track sequence directory), and `EVNT` (MIDI event stream).
  - Variable-length delta-time compression algorithm and translation to Standard MIDI File (SMF) 1.0 delta-ticks.
  - XMIDI proprietary controller commands ($110..119$) including sequence loop points and branch markers.

### Sound Blaster Creative Voice (.VOC) Specification
- **Publisher**: Creative Technology Ltd. (Creative Labs Developer Series).
- **Specification**: *Sound Blaster Voice File (.VOC) File Format Specification*.
- **Sourced Information**:
  - File signature: `Creative Voice File\x1A` with header size and version fields.
  - Block type $0x01$: 8-bit unsigned linear PCM audio with sample rate divisor equation ($\text{sample\_rate} = \frac{1,000,000}{256 - \text{divisor}}$).
  - Block type $0x02$: Continuation audio blocks; Block type $0x00$: Terminator marker.

### Westwood Font Format v3 (.FNT)
- **Source**: Westwood Studios Modding Community & ScummVM Kyra GUI code (`gui/gui_hof.cpp`).
- **Sourced Information**:
  - Header magic ($0x0003$), font height, maximum glyph width.
  - Character metrics: 256-entry character width table and 256-entry glyph pixel offset table.
  - 4-bit per pixel (nibble-packed) planar glyph bitmaps rendered across 16-level grayscale/color ramps.

---

## 3. Original Game Media & Assets

All asset containers, bytecode files, audio banks, and scripts analyzed by this project originate from the official retail release:
- **Title**: *The Legend of Kyrandia: Book Two — The Hand of Fate*
- **Release Year**: 1993
- **Platform**: MS-DOS (CD-ROM Edition)
- **Publisher**: Virgin Interactive Entertainment / Westwood Studios
- **Path**: `./The Legend of Kyrandia 2 The Hand of Fate (CD DOS).svm/`
- **Total Archives Analyzed**: 115 PAK archives containing 1,903 individual game assets.

---

## 4. Technical Problem Reports & Diagnostic Findings

Original reverse-engineering investigations conducted specifically for this codebase are documented in the [`problem_reports/`](file:///home/user1/ws/classic-game-browser/problem_reports/) directory:

| Report | Topic & Sourced Findings |
|---|---|
| [`inshpzy_yeti_palette_fix_report.md`](file:///home/user1/ws/classic-game-browser/problem_reports/inshpzy_yeti_palette_fix_report.md) | Reverse-engineering of `_scenePal` Level 6 ($208..223$) in `INSHOP.COL` to fix purple Yeti fur discoloration in `INSHPZY.WSA`. |
| [`cmp_decompression_and_format_analysis.md`](file:///home/user1/ws/classic-game-browser/problem_reports/cmp_decompression_and_format_analysis.md) | Analysis of 64-pixel stride artifacts, identification of `.CMP` as 256×256 cross-fade LUTs, and extraction of 64 KB uncompressed `.BIN` colormaps. |
| [`fnt_bitmap_font_engine_and_sandbox.md`](file:///home/user1/ws/classic-game-browser/problem_reports/fnt_bitmap_font_engine_and_sandbox.md) | Decoding Westwood Font Format v3 4bpp variable-width raster glyph tables, multi-line typography engine, and font sheet exports. |
| [`csh_and_cmp_uncompressed_asset_extraction.md`](file:///home/user1/ws/classic-game-browser/problem_reports/csh_and_cmp_uncompressed_asset_extraction.md) | Format 80 LCW decompression for container formats (`_ITEMS.CSH`, `SCENE2.CMP`) and single-column UI layout. |
| [`hidden_file_types_dat_c55_adl.md`](file:///home/user1/ws/classic-game-browser/problem_reports/hidden_file_types_dat_c55_adl.md) | Classification of hardware driver patch banks (`.ADL`, `.C55`, `.DAT`) under hidden non-useful files with filter tooltips. |
| [`cps_wsa_interactive_layer_reordering_and_positioning.md`](file:///home/user1/ws/classic-game-browser/problem_reports/cps_wsa_interactive_layer_reordering_and_positioning.md) | Interactive multi-layer animation compositing, z-depth reordering, coordinate shifting, and reset engine. |
| [`gears_and_incave_background_resolution.md`](file:///home/user1/ws/classic-game-browser/problem_reports/gears_and_incave_background_resolution.md) | Base-archive stem stripping for multi-PAK continuation archives (`GEARS2.PAK`, `TREE2.PAK`, etc.). |
| [`wsa_palette_fix_report.md`](file:///home/user1/ws/classic-game-browser/problem_reports/wsa_palette_fix_report.md) | Master palette compositing resolving magenta silhouettes and incorrect palette mappings on animations. |
| [`android_sdk_target_api_36_migration.md`](file:///home/user1/ws/classic-game-browser/problem_reports/android_sdk_target_api_36_migration.md) | Android SDK API Level 36 standardization and build configuration migration. |

---

## 5. Third-Party Software Libraries

| Library | Version / Source | Sourced Usage |
|---|---|---|
| **Pillow** | `Pillow>=9.0.0`<br>[https://python-pillow.org/](https://python-pillow.org/) | Python library for raw indexed-color byte array manipulation, palette assignment, PNG saving, and multi-frame GIF generation. |
| **W3C Web Audio API** | W3C Standard<br>[https://www.w3.org/TR/webaudio/](https://www.w3.org/TR/webaudio/) | Browser-native polyphonic synthesizer engine ([`web/midi_synth.js`](file:///home/user1/ws/classic-game-browser/web/midi_synth.js)) for zero-dependency playback of converted MIDI sequences. |
