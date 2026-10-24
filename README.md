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

- 🔊 **Voice & Sound Effects (.VOC to .WAV)**:
  - Creative Voice file decoder and converter to standard 8-bit PCM **`.wav`**.

- 📦 **Batch Export Center**:
  - One-click batch export via GUI or command-line:
    - **Export All Backgrounds (PNG)**
    - **Export All Models & Sprites (PNG)**
    - **Export All Soundtracks (MIDI)**
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
# Export all 112 background pictures as PNG:
./run.sh --export-bg ./exported_assets/backgrounds

# Export all 126 model/character sprite sheets & frames as PNG:
./run.sh --export-models ./exported_assets/models

# Export all 21 music tracks as standard MIDI (.mid):
./run.sh --export-midi ./exported_assets/soundtracks

# Export everything (backgrounds, models, soundtracks, and SFX):
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
│   ├── cps.py           # .CPS background picture renderer (PNG)
│   ├── shp.py           # .SHP model / character sprite renderer (PNG)
│   ├── wsa.py           # .WSA animation player & GIF/PNG exporter
│   ├── xmi2mid.py       # Miles Sound System XMIDI to Standard MIDI converter
│   ├── voc2wav.py       # Creative Voice (.VOC) to WAV converter
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
- **1,903 Total Game Assets**
- **112 Background Pictures (`.CPS`)**
- **126 Character & Object Models (`.SHP`)**
- **421 Cutscene Animations (`.WSA`)**
- **21 Soundtrack Tracks (`.XMI`)**
- **245 Voice & Sound Effects (`.VOC`)**
