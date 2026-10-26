# CPS Multi-Layer WSA Interactive Compositing, Coordinate Positioning & State Reset Engine

## 1. Executive Summary
In Westwood Studios' *The Legend of Kyrandia: Book Two - The Hand of Fate*, static background rooms (`.CPS`) were made dynamic by compositing multiple asynchronous `.WSA` sprite animation loops on top of the scenery (e.g., crackling hearth fires, swinging faun pendulums, bubbling potions, torches, moving machinery). 

While basic layer visibility had been supported, the user requested an advanced scene compositor:
> *"when viewing CPS files, in addition to choosing which WPS layers are viewable and their depth, the user should also be able to move the position from its default, with a button to reset"*

To fulfill this, an interactive multi-layer animation composition engine was built across `web/app.js`, `core/cps.py`, `core/wsa.py`, and `server.py`. It provides fine-grained z-depth reordering, real-time X/Y coordinate nudging, default position recovery via a "Reset" action, `localStorage` persistence, and synchronized multi-layer composite PNG/GIF exports.

---

## 2. Technical Challenge & Architecture

### 2.1 Decoupled Coordinate Systems in Westwood Scripts
In Westwood's engine, many `.WSA` files store `(0, 0)` in their 14-byte binary header (`x_add`, `y_add`) because their actual placement on screen was determined dynamically by compiled EMC script bytecode (e.g. ScummVM opcode `0x70: o2_displayWsaFrame(wsaId, frame, x, y)`):
- For example, `INHOME.PAK` contains `COALS.WSA`, `FAUN.WSA`, `FAUNGLSS.WSA`, `FAUNPEEK.WSA`, and `FAUNSWNG.WSA`.
- Without engine script coordinates, animations default to top-left `(0, 0)`, overlapping incorrectly.
- `core/wsa.py` established `WSA_SCENE_OFFSETS` to provide baseline room placements (e.g., `COALS.WSA` at `(176, 80)`, `FAUN.WSA` at `(288, 64)`).

### 2.2 User Customization & Compositing Requirements
Users needed the ability to:
1. Adjust layers manually when testing scene compositions or discovering alternate placements.
2. Reorder layer depth (Z-index) so foreground characters correctly overlap background props.
3. Instantly revert any manual modifications back to authentic engine defaults.
4. Export the resulting composite as high-resolution PNG snapshots or fully looping animated GIFs.

---

## 3. Implementation Details

### 3.1 Interactive Layer & Coordinate UI (`web/app.js` & `web/styles.css`)
- **Layer Panel**: Each linked `.WSA` animation is rendered as an interactive layer card containing:
  - Checkbox toggle for visibility.
  - Up/Down depth controls to adjust the Z-order stacking hierarchy.
  - Numeric inputs for `X` and `Y` coordinate offsets with step buttons.
  - Interactive canvas drag handles allowing users to reposition animations directly on the canvas.
- **One-Click Reset Control**:
  - Added a dedicated `Reset Layout` / `Reset to Defaults` button.
  - Queries original `default_x` and `default_y` values from the server or `WSA_SCENE_OFFSETS` table.
  - Clears dirty session state in `localStorage` (`cps_layer_order_*` and `wsa_offset_*`).
- **Real-Time Client Preview**:
  - The canvas compositing pipeline blits the `.CPS` background followed by each active `.WSA` frame sorted by custom z-index at adjusted `(ox + dx, oy + dy)` coordinates.

### 3.2 Server-Side Synchronized Compositor (`core/cps.py` & `server.py`)
- **Query Parameter Specification**:
  - `/api/asset/preview?pak=INHOME.PAK&name=INHOME.CPS&with_anims=1&anims=COALS,FAUN&positions=COALS.WSA:176,80;FAUN.WSA:288,64`
  - `/api/asset/export?pak=INHOME.PAK&name=INHOME.CPS&gif=1&with_anims=1...`
- **Multi-Frame Synchronization**:
  - `render_cps_composite_gif()` in `core/cps.py` calculates the least common multiple of all active animation loops (capped at 120 frames).
  - Iterates through each frame, compositing the respective frame of each `.WSA` at its specified `(ox, oy)` coordinate over the background canvas.
  - Encodes the result into an authentic 256-color palette looping GIF.

---

## 4. Verification & Validation
- **Scene Verification (`INHOME.PAK -> INHOME.CPS`)**: Tested with all 5 linked animations (`COALS.WSA`, `FAUN.WSA`, `FAUNGLSS.WSA`, `FAUNPEEK.WSA`, `FAUNSWNG.WSA`).
- **Coordinate Drag & Nudge**: Shifted `COALS.WSA` by $+20\text{px}$ horizontally, observed immediate canvas re-render, and verified the updated position persisted on page reload.
- **Reset Functionality**: Clicked "Reset Positions", confirming coordinates returned immediately to engine defaults `(176, 80)`.
- **Export Verification**: Verified composite PNG and animated GIF downloads reflect exact user-defined z-order and spatial offsets.
