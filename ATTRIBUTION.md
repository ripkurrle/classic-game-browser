# Attribution & Credits

This document acknowledges the original creators, reverse engineering communities, research specifications, and open-source software that made the **Kyrandia 2: Hand of Fate — Asset Studio & Extractor** possible.

---

## 1. Original Game & Intellectual Property

*The Legend of Kyrandia: Book Two — The Hand of Fate* was developed by **Westwood Studios** and published in 1993 by **Virgin Interactive Entertainment**.

- **Game Design & Direction**: Rick Gush
- **Lead Programming & Engine Architecture**: Michael Legg, Philip W. Morrow
- **Art Direction & Background Paintings**: Louis Castle, Rick Parks, Aaron Powell, Cindy Shannon, Eric W. Araujo, Judy Culler, Frank Gomez, Joseph Bostic
- **Musical Score & Sound Design**: Frank Klepacki, Paul S. Mudra
- **Audio System**: Miles Sound System by John Miles (RAD Game Tools / Miles Design)

*All trademarks, game assets, storylines, character likenesses, and proprietary artwork are the intellectual property of Electronic Arts / Westwood Studios / Virgin Interactive.*

---

## 2. Reverse Engineering & Format Documentation

The custom parsers, decoders, and decompressors in this project were developed through study of public reverse engineering documentation, open-source engine reimplementations, and digital preservation archives:

### The ScummVM Project (`engines/kyra/`)
- **Website**: [https://www.scummvm.org](https://www.scummvm.org)
- **Repository**: [ScummVM GitHub (`engines/kyra`)](https://github.com/scummvm/scummvm/tree/master/engines/kyra)
- **License**: GNU General Public License v2.0 or later (GPLv2+)
- **Key References & Insights**:
  - `kyra_hof.h` & `scene_hof.cpp`: Westwood 9-level character lighting table architecture (`_scenePal`), active character palette slot blitting ($112..127$), and Level 6 Yeti disguise color matrix.
  - `wsamovie_v2.cpp` & `wsamovie.cpp`: `WSAMovie_v2` container structure, base frame headers, Format 40 XOR-delta opcode decompression, and animation loop timing.
  - `screen_hof.cpp`: Format 80 (LCW) stream decompressor mechanics and palette shift buffers.
  - `sound_intern.cpp` & `sound_pc98.cpp`: Miles Sound System driver commands, XMIDI event streaming, and sound bank structures.
  - `resource.cpp`: Westwood PAK container table of contents, entry offsets, and filename hashing.
  - `text.cpp` & `gui_hof.cpp`: Dual Tile Encoding (DTE) string compression dictionary structure and Code Page 850 multilingual character mapping.

### MultimediaWiki (`wiki.multimedia.cx`)
- **Website**: [https://wiki.multimedia.cx](https://wiki.multimedia.cx)
- **Contributors**: Mike Melanson, Kostya Shishkov, and the multimedia reverse-engineering community.
- **Specifications Consulted**:
  - [Westwood Format 80 (LCW Compression)](https://wiki.multimedia.cx/index.php/Westwood_Format_80)
  - [Westwood Format 40 (XOR-Delta Compression)](https://wiki.multimedia.cx/index.php/Westwood_Format_40)
  - [Westwood Shape File (.SHP)](https://wiki.multimedia.cx/index.php/Westwood_SHP_Format)
  - [Westwood Animation File (.WSA)](https://wiki.multimedia.cx/index.php/Westwood_WSA_Format)
  - [Westwood CPS Graphic File](https://wiki.multimedia.cx/index.php/Westwood_CPS_Format)
  - [Westwood COL Palette File](https://wiki.multimedia.cx/index.php/Westwood_COL_Format)

### Miles Extended MIDI (XMIDI) & MIDI Standard
- **Miles Sound System (MSS)**: Created by John Miles (RAD Game Tools / Miles Design).
- **XMIDI File Format Specification**: Published by John Miles (1991–1995), documenting `FORM XMID` IFF structures, `CAT ` / `EVNT` sequence data, delta-time compression, and branch points.
- **Standard MIDI Files (SMF) 1.0 Specification**: Published by the MIDI Manufacturers Association (MMA) / The Association of Musical Electronics Industry (AMEI).

### Creative Voice File (.VOC) Specification
- **Creative Technology Ltd. / Creative Labs Developer Series**:
  - Sound Blaster CT-VOICE format specification, detailing block types $0x01$ (sound data with sampling frequency divisor), block type $0x02$ (sound continuation), and 8-bit mono linear PCM audio encoding.

### Westwood Font Format v3 (.FNT) Documentation
- Community research from the Westwood Modding community (Dune II / Command & Conquer / Kyrandia modding tools), detailing 4bpp variable-width raster glyph tables, character bounding boxes, and header offsets.

---

## 3. Third-Party Open Source Libraries & Components

| Software / Resource | Author / Maintainer | License | Role in Project |
|---|---|---|---|
| **Pillow (PIL Fork)** | Alex Clark & Pillow Contributors (originally Fredrik Lundh) | [HPND License](https://github.com/python-pillow/Pillow/blob/main/LICENSE) | Raw raster buffer quantization, PNG file generation, sprite sheet layout, and animated GIF exports. |
| **Inter Font Family** | Rasmus Andersson | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) | Modern, clean UI typography across the desktop and browser interfaces. |
| **JetBrains Mono** | JetBrains | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) | Monospaced font used in the binary hex viewer and technical inspection panels. |
| **Web Audio API** | W3C Audio Working Group | W3C Standard | Client-side polyphonic synthesizer engine (`midi_synth.js`) for zero-dependency browser playback of converted MIDI tracks. |

---

## 4. Educational & Preservation Notice

This software is developed strictly for **educational, historical research, and digital preservation** purposes. It is intended to assist enthusiasts, game historians, and software engineers in studying early 1990s MS-DOS graphics compression, procedural color lookup tables, and interactive game engine architecture.

No proprietary game assets are distributed as part of this code repository. Users provide their own legally acquired copy of the original game data archives.

---

## 5. Technical Sources Cross-Reference

For the comprehensive, file-by-file mapping of reverse-engineered source repositories, file format specifications, byte offset analyses, and problem report investigations, see [`SOURCES.md`](file:///home/user1/ws/classic-game-browser/SOURCES.md).

