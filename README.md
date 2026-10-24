# Kyrandia 2: Hand of Fate — Asset Studio & Extractor

A desktop application designed to explore and extract assets from Westwood Studios' classic 1993 adventure game **The Legend of Kyrandia: Book Two — The Hand of Fate**.

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
    - **`.CMP`**: Full-screen cinematic cutscene backgrounds (`SCENE2.CMP`, `SCENE3.CMP`) rendered via Format 80.
    - **`.CSH`**: Compressed shape archives (`_ITEMS.CSH` 180 item icons, `_BUTTONS.CSH` 15 buttons, `_MOUSE.CSH` 9 cursors).
    - **`.TIM`**: Animation voice timeline & speech sync sequence opcodes (`AVFS` / `AVTL` chunks).
    - **`.MSC`**: 320×144 scene hotspot, pathfinding, and depth collision masks.
    - **`.ADL` & `.C55` & `.PCS`**: AdLib OPL2/OPL3 FM sound banks, Roland Sound Canvas (SCC-55) / MT-32 sysex banks, and PC Speaker sound banks.
    - **`.ADV` & `.DRV`**: Miles Sound System audio device drivers and real-mode hardware drivers.
    - **`.FNT` & `.DAT`**: Westwood DOS bitmap fonts and item height calibration tables.
  - Interactive binary hex terminal with side-by-side ASCII dump and quick-copy hex tool.

- 📦 **Batch Export Center**:
  - One-click batch export via GUI or command-line:
    - **Export All Backgrounds (PNG)** (including `.CMP`)
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
