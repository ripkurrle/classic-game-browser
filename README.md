# Kyrandia 2: Hand of Fate — Asset Studio & Extractor

A modern desktop application and web studio designed to explore, inspect, and extract assets from Westwood Studios' classic 1993 adventure game **The Legend of Kyrandia: Book Two — The Hand of Fate**.

---

## ⚡ Quick Start (60 Seconds)

No complex build tools or setup needed. Only **Python 3.8+** is required. The launcher automatically installs the sole lightweight dependency (`Pillow`).

### 🐧 Linux & 🍏 macOS
Open a terminal in the folder and run:
```bash
./run.sh
```
*(To open directly in your web browser instead of the native window, use `./run.sh --browser`)*

### 🪟 Windows
Double-click **`run.bat`** in File Explorer, or open PowerShell and run:
```powershell
.\run.ps1
```

### 🐍 Standard Python (Any Platform)
```bash
pip install -r requirements.txt
python app.py
```
*The app automatically starts on `http://127.0.0.1:8080` with zero configuration!*

---

## 🧭 In-App Help & Quick Jump

- 🌟 **Featured Scenes Gallery**: Click **"🌟 Featured Scenes"** in the top navigation bar to jump directly into iconic locations (Zanthia's Home, Cauldron Room, Swamp Bridge, Yeti sequence, Gold Font, Title Theme).
- ❓ **Interactive User Guide**: Click **"❓ Help & Guide"** (or press <kbd>?</kbd>) anytime for built-in guides on scene compositing, font rendering, audio playback, and Westwood file format specifications.
- ⌨️ **Keyboard Navigation**:
  | Shortcut | Action |
  | :--- | :--- |
  | <kbd>↓</kbd> / <kbd>↑</kbd> | Move to next / previous asset in the current category |
  | <kbd>Space</kbd> | Toggle Play / Pause on animations (.WSA) and models (.SHP) |
  | <kbd>/</kbd> | Instantly focus the search bar |
  | <kbd>?</kbd> | Open the Help & User Guide |
  | <kbd>Esc</kbd> | Close any open modal (Help, Featured Scenes, Export Center) |

---

## ✨ Features

- 🖼️ **Rendered Backgrounds (.CPS)**:
  - Decompresses Westwood Format 80 (LCW) graphics to authentic 320×200 256-color VGA pictures.
  - Automatically pairs and applies exact companion color palettes (`.COL`, embedded palettes, and fallback `PALETTE.COL`).
  - Export rendered backgrounds as high-definition **PNG** images.
  - Interactive viewer with 1x, 2x, 3x, Fit zoom, CRT scanlines shader simulation, and 256-color palette swatch inspector.

- 🧙 **Models & Character Sprites (.SHP)**:
  - Decodes compact character shape models (Zanthia in all costumes, Marko, Faun, inventory items, creatures, UI elements).
  - Decompresses line run-length encoding with transparency and custom color tables.
  - Frame-by-frame animation player with Play/Pause, scrubber, and adjustable FPS.
  - Multiple backdrop modes: Transparent Grid, Dark, Light, Chroma Green.
  - Export individual frames as **PNG** or full **Sprite Sheets** as PNG.

- 🎬 **Cutscenes & Scene Animations (.WSA)**:
  - Parses Westwood `WSAMovie_v2` animation sequences.
  - Decodes base frames and Format 40 XOR-delta frames.
  - Interactive timeline playback and frame stepping.
  - Export as individual PNG frames or animated **GIF**.

- 🎵 **Soundtracks & Music (.XMI to .MID)**:
  - Parses Miles Sound System XMIDI IFF containers (`FORM XMID`, `EVNT` chunks).
  - Translates variable-length delta times and note durations into standard SMF (Standard MIDI File) events.
  - Built-in zero-dependency **Web Audio API MIDI Synthesizer** with animated audio visualizer.
  - Export soundtracks as standard **`.mid`** files compatible with modern digital audio workstations (DAWs) and media players.

- 🎨 **Palette Studio (.COL & .PAL)**:
  - 256-color interactive color palette matrix (16×16 grid) with DAC color ramps, hex values, and color picker.
  - Export as high-resolution PNG palette swatch or standard GIMP Palette (`.gpl`) format.

- 📜 **Scripts, Dialogue & Localized Text (English, French, German — 505 Files)**:
  - **Dialogue Scripts (`.DLE`, `.DLF`, `.DLG`)**: Complete conversation scripts parsed into interactive dramatic scenes with character avatar badges (Zanthia 🧙‍♀️, Faun 🐐, Marko 🧙‍♂️, etc.).
  - **Subtitles & Spoken Audio Cues (`.EMC`, `.FMC`, `.GMC`)**: Subtitle transcripts indexed with corresponding sound effect and speech cue IDs.
  - **In-Game Names & Books (`.ENG`, `.FRE`, `.GER`)**: Room names, item labels, option menus, Norton's Potion Primer spellbook parchment pages, and letters decoded with Westwood Dual Tile Encoding (DTE) and DOS Code Page 850 for correct French accents and German umlauts.
  - Interactive search, scene filter pills, click-to-copy lines, and plain text (`.txt`) export.

- 🔬 **Westwood Engine Asset Inspector (27 File Types Supported)**:
  - Full taxonomy and deep inspection for all 27 Westwood proprietary file formats:
    - **`.CMP`**: Cutscene cross-fade transition color tables (`SCENE2.CMP`, `SCENE3.CMP`) classified under hidden non-useful files. Replaces visual preview with complete engine technical specifications, 3-step fade mechanics, and 64.0 KB uncompressed table download (`.BIN`).
    - **`.CSH`**: Compressed shape archives (`_ITEMS.CSH` 180 item icons, `_BUTTONS.CSH` 15 buttons, `_MOUSE.CSH` 9 cursors).
    - **`.TIM`**: Animation voice timeline & speech sync sequence opcodes (`AVFS` / `AVTL` chunks).
    - **`.MSC`**: 320×144 scene hotspot, pathfinding, and depth collision masks.
    - **`.ADL` & `.C55` & `.PCS`**: AdLib OPL2/OPL3 FM sound banks, Roland Sound Canvas (SCC-55) / MT-32 sysex banks, and PC Speaker sound banks (`.ADL` and `.C55` classified under hidden non-useful files).
    - **`.ADV` & `.DRV`**: Miles Sound System audio device drivers and real-mode hardware drivers.
    - **`.FNT` & `.DAT`**: Westwood DOS bitmap fonts (`GOLDFONT.FNT`, `6.FNT`, `8FAT.FNT`, `BOOKFONT.FNT`) and item height calibration tables (`_ITEMHT.DAT` classified under hidden non-useful files).
  - Interactive binary hex terminal with side-by-side ASCII dump and quick-copy hex tool.

- 🔤 **Westwood Font Viewer (.FNT)**:
  - Deep decoding for Westwood Font Format v3 (4bpp variable-width bitmap fonts).
  - Live interactive text typing sandbox with real-time bitmap font rendering, zoom scale (1x–4x), tracking, and line spacing.
  - 5 retro color themes (Kyrandia Gold, Dialogue White, Amber, Cyan, Emerald) and one-click 16-column Font Sheet (PNG) export.
  - Direct Format 80 uncompressed downloads for `.CMP` (to `.BIN`) and `.CSH` (to `.SHP`).

- 📦 **Batch Export Center**:
  - One-click batch export via GUI or command-line:
    - **Export All Backgrounds (PNG)** (.CPS scenes)
    - **Export All Models & Sprites (PNG)** (including `.CSH`)
    - **Export All Soundtracks (MIDI)**
    - **Export All Scripts & Dialogue (TXT)** (English, French, German)
    - **Complete Asset Dump (All Assets)**
  - Real-time animated progress tracking.

---

## 🚀 Getting Started

### 1. Launching the Desktop Application

To start the desktop application, run:

```bash
./run.sh
```

or:

```bash
python3 app.py
```

- When run in a desktop environment with display support, it launches a native GTK / WebKit desktop window.
- To open directly in your system browser instead, pass the `--browser` flag:

```bash
./run.sh --browser
```

### 2. Command-Line Batch Export

You can also perform instant batch exports directly from the terminal without opening the graphical interface:

```bash
# Export all 114 background pictures as PNG:
./run.sh --export-bg ./exported_assets/backgrounds

# Export all 129 model/character sprite sheets & frames as PNG:
./run.sh --export-models ./exported_assets/models

# Export all 21 music tracks as standard MIDI (.mid):
./run.sh --export-midi ./exported_assets/soundtracks

# Export all 505 script and dialogue files as formatted text (.txt):
./run.sh --export-scripts ./exported_assets/scripts

# Export everything (backgrounds, models, soundtracks, scripts, and SFX):
./run.sh --export-all ./exported_assets
```

---

## 🛠️ Project Structure

```text
classic-game-browser/
├── app.py               # Desktop application launcher (WebKitGTK + browser fallback)
├── run.sh               # Convenient executable shell script
├── server.py            # Multithreaded Python HTTP server & REST API
├── core/
│   ├── pak.py           # Westwood PAK archive reader & indexer
│   ├── format80.py      # Format 80 (LCW) decompressor
│   ├── format40.py      # Format 40 (XOR-delta) decompressor
│   ├── palette.py       # 256-color VGA palette manager & matcher
│   ├── cps.py           # .CPS & .CMP background picture renderer (PNG)
│   ├── shp.py           # .SHP & .CSH model / character sprite renderer (PNG)
│   ├── wsa.py           # .WSA animation player & GIF/PNG exporter
│   ├── fnt.py           # .FNT Westwood bitmap font decoder, glyph map & renderer
│   ├── xmi2mid.py       # Miles Sound System XMIDI to Standard MIDI converter
│   ├── voc2wav.py       # Creative Voice (.VOC) to WAV converter
│   ├── script_text.py   # Multilingual dialogue, subtitle & DTE string decompressor
│   ├── file_types.py    # Westwood 27 file types taxonomy & raw binary inspector
│   └── extractor.py     # Batch export engine & background job runner
└── web/
    ├── index.html       # Semantic HTML5 desktop user interface
    ├── styles.css       # Glassmorphic dark design system & CRT shaders
    ├── app.js           # Client-side state manager & interactive viewers
    └── midi_synth.js    # Built-in Web Audio API synthesizer for MIDI playback
```

---

## 🎮 Verified Game Files

Auto-detected at:
`./The Legend of Kyrandia 2 The Hand of Fate (CD DOS).svm/`

- **115 PAK Archives**
- **1,903 Total Game Assets (Exact 27 File Extensions Supported)**:
  - **421 WSA**: Cutscene & character animations
  - **245 VOC**: Voice dialogues & Foley sound effects
  - **203 TIM**: Animation voice timeline & speech sync sequence scripts
  - **137 EMC**: English subtitle & voice cue files
  - **126 SHP**: Character poses, models & object sprite archives
  - **112 CPS**: 320×200 full-screen background pictures
  - **99 COL**: Master room VGA 256-color palettes
  - **88 FMC**: French subtitle files
  - **88 GMC**: German subtitle files
  - **87 MSC**: 320×144 scene hotspot, pathfinding & collision masks
  - **40 DLE**: English dialogue scripts (scenes & actors)
  - **40 DLF**: French dialogue scripts (scenes & actors)
  - **40 DLG**: German dialogue scripts (scenes & actors)
  - **28 ADV**: Miles Sound System audio device drivers
  - **24 ENG**: English room names, item names, spell primer & letters
  - **24 FRE**: French room names, item names, spell primer & letters
  - **24 GER**: German room names, item names, spell primer & letters
  - **21 XMI**: Miles Extended MIDI soundtracks by Frank Klepacki & Paul Mudra
  - **19 ADL**: AdLib OPL2/OPL3 FM synthesis timbre sound banks
  - **19 C55**: Roland Sound Canvas (SCC-55) / MT-32 timbre sound banks
  - **6 DRV**: Low-level hardware device drivers
  - **4 FNT**: Westwood DOS proportional & fixed-width bitmap fonts
  - **3 CSH**: Compressed shape archives (180 inventory items, 15 buttons, 9 cursors)
  - **2 CMP**: Compressed cinematic cutscene backgrounds (`SCENE2.CMP`, `SCENE3.CMP`)
  - **1 PCS**: PC Speaker 1-bit sound effect bank (`K2SFX.PCS`)
  - **1 DAT**: Dimension lookup calibration table (`_ITEMHT.DAT`)
  - **1 PAL**: Specialized title screen color palette (`K2TITLE.PAL`)

---

## 📜 Attribution & Sources

- **Attribution & Credits**: See [`ATTRIBUTION.md`](file:///home/user1/ws/classic-game-browser/ATTRIBUTION.md) for original game credits, legal notices, and third-party open-source licenses.
- **Technical Sources & References**: See [`SOURCES.md`](file:///home/user1/ws/classic-game-browser/SOURCES.md) for the complete breakdown of reverse-engineering repositories, format specifications, algorithm references, and problem report investigations.

