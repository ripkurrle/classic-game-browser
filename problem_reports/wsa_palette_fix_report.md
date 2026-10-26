# WSA Palette Resolution Analysis & Fix

## 1. Problem Summary
When viewing animations in the classic game browser:
- `SC_ENTER.WSA` in `OUTFARM.PAK` rendered Zanthia as a neon magenta (`#FF00FF`) silhouette.
- `KNIGHTSNW.WSA` (DOS 8.3 filename: `KNGHTSNW.WSA`) in `BRIDGE.PAK` rendered the snowman in dark blue and muddy brown shades rather than authentic white snow.
- Other character animations across scene PAKs (e.g. `INSHPFAT.WSA`, `PICKUPMU.WSA`) suffered similar palette corruption.

---

## 2. Root Cause Analysis
In Westwood Studios' *Kyrandia 2: Hand of Fate* engine architecture (as documented in ScummVM's `KyraEngine_HoF::loadScenePal`):

1. **Master Game Palette (`OTHER.PAK -> PALETTE.COL`)**:
   - `PALETTE.COL` is loaded at game initialization into base palette slot 0.
   - Indices **128–255** of `PALETTE.COL` contain the global UI elements, inventory items, fonts, Zanthia's character sprite colors (indices 168–219), and snowman whites/highlights (indices 187–207).

2. **Room Scene Palettes (`<SCENE>.COL`)**:
   - Each scene archive (e.g., `BRIDGE.PAK -> BRIDGE.COL`, `OUTFARM.PAK -> OUTFARM.COL`) contains only **128 background scenery colors** (indices 0–127).
   - In `<SCENE>.COL`, indices **128–255** are NOT active screen colors. Instead, they contain:
     - Placeholder neon magenta (`#FF00FF`) or purple markers (`77, 0, 85`) reserved for character overlays.
     - Multi-level character shading tables (`_scenePal`, 9 levels of 16 colors starting at byte offset 336 / index 112) used dynamically in-game for ambient lighting.
   - When entering a room, the game engine executes:
     ```cpp
     _screen->copyPalette(1, 0);                                    // Palette 0 (PALETTE.COL) is the base
     _screen->getPalette(1).copy(_screen->getCPagePtr(3), 0, 128); // Only copy 128 colors (0..127) from <SCENE>.COL
     _screen->getPalette(1).fill(0, 1, 0);                         // Index 0 is transparent/black
     ```
   - Indices **128–255** on screen always remain populated from `PALETTE.COL`.

3. **Previous Flaw in Classic Game Browser**:
   - `PaletteManager.get_palette_for_asset` previously loaded the raw `<SCENE>.COL` from the same archive for all 256 colors.
   - For `SC_ENTER.WSA`, Zanthia's sprite indices (168–219) hit the raw magenta placeholders in `OUTFARM.COL`.
   - For `KNGHTSNW.WSA`, the snowman indices (187–207) hit the dark blue/brown bridge shadow table in `BRIDGE.COL`.

---

## 3. Solution Implemented

1. **Palette Compositing Engine (`core/palette.py`)**:
   - Implemented `_is_placeholder_color()` to detect VGA magenta/purple placeholder slots.
   - Implemented `_composite_palette()` adhering to Westwood's engine design:
     - Uses `PALETTE.COL` as the 256-color foundation.
     - Overlays scene background colors (indices 0–127) from `<SCENE>.COL`, skipping any placeholder slots.
     - Preserves indices 128–255 from `PALETTE.COL` to accurately color Zanthia, the snowman, items, and NPCs.
     - Sets color index 0 to pure transparent black `(0, 0, 0)`.
   - Standalone 256-color palettes (such as `_MEANWIL.COL` and `PALETTE.COL`) remain unaffected.

2. **DOS 8.3 Alias Support (`core/pak.py`)**:
   - Added support for human-readable aliases such as `KNIGHTSNW.WSA` $\to$ `KNGHTSNW.WSA` and `KNIGHTZAN.WSA` $\to$ `KNGHTZAN.WSA`.

---

## 4. Visual Verification

````carousel
![SC_ENTER.WSA (Frame 20) with Correct Palette](/home/user1/.gemini/antigravity-ide/brain/94208c7c-d50c-4a5b-a5f2-6983e4e7f42c/sc_enter_after.png)
<!-- slide -->
![KNGHTSNW.WSA (Frame 20) with Snowman White Palette](/home/user1/.gemini/antigravity-ide/brain/94208c7c-d50c-4a5b-a5f2-6983e4e7f42c/knghtsnw_after.png)
<!-- slide -->
![KNGHTZAN.WSA (Frame 10) with Zanthia and Knight](/home/user1/.gemini/antigravity-ide/brain/94208c7c-d50c-4a5b-a5f2-6983e4e7f42c/knghtzan_after.png)
````

- **`SC_ENTER.WSA`**: 0 magenta pixels; Zanthia renders with her purple hat, green clothing, blonde hair, and skin tones.
- **`KNGHTSNW.WSA`**: 645 white snow pixels; the snowman is crisp white with an orange carrot nose and wooden arms beside the knight in armor.
- **Total Verification**: All 421 WSA files decode cleanly with 0 errors.
