# Multi-PAK Continuation Background Resolution & Scene Association Engine

## 1. Executive Summary
During validation of scene animations across Westwood Studios' *Kyrandia 2*, several animations rendered over pure black backgrounds or missing scenery:
- Animations in `GEARS2.PAK` (`DODGE1.WSA`, `DODGE2.WSA`, `HIT.WSA`, `DEATH1..3.WSA`) and `GEARS3.PAK` (`DEATH4..7.WSA`, `HANDDEAD.WSA`, `MARCGEAR.WSA`) rendered without any room background, despite being part of the Wheel of Fate gear room sequence.
- Similarly, continuation archives such as `TREE2.PAK`, `INJAIL2.PAK`, and `OUTCAVE2.PAK` lacked backgrounds when viewing their respective animations.
- In `INCAVE.PAK`, animations with divergent naming conventions (`INBALL.WSA`, `INCANDLE.WSA`, `INLOVE.WSA`, `INSPHERE.WSA`) required reliable scene linkage to `INCAVE.CPS`.

Investigation revealed that Westwood's engine split large cutscene assets across numbered continuation PAK archives to manage floppy disk and CD sector constraints, storing background art (`.CPS`) and color palettes (`.COL`) exclusively in the root base archive (`<BASE>.PAK`).

---

## 2. Technical Investigation & Root Cause

### 2.1 Continuation PAK File Layout
Examining the archive contents:
- **`GEARS.PAK` (Base Archive)**:
  - `GEARS.CPS`: 320×200 background artwork of the machine gear room.
  - `GEARS.COL`: 128-color room palette.
  - `GEARS.WSA`, `ARROW.WSA`, `FIXED.WSA`, `GEAR_ON.WSA`, `PUSH.WSA`, `WARNING.WSA`.
- **`GEARS2.PAK` (Continuation Archive 1)**:
  - Contains only `.WSA` files: `DEATH1.WSA`, `DEATH2.WSA`, `DEATH3.WSA`, `DODGE1.WSA`, `DODGE2.WSA`, `HIT.WSA`.
  - **No `.CPS` file exists in `GEARS2.PAK`**.
- **`GEARS3.PAK` (Continuation Archive 2)**:
  - Contains only `.WSA` files: `DEATH4.WSA`, `DEATH5.WSA`, `DEATH6.WSA`, `DEATH7.WSA`, `HANDDEAD.WSA`, `MARCGEAR.WSA`.
  - **No `.CPS` file exists in `GEARS3.PAK`**.

### 2.2 Flaw in Previous Lookup Logic
The browser's background and palette association logic previously searched only within the immediate archive:
```python
# Previous logic: Only checked current pak_name
candidates = [
    (pak_name, f"{asset_stem}.CPS"),
    (pak_name, f"{pak_stem}.CPS")
]
```
For `GEARS2.PAK -> DODGE1.WSA`:
- Looked for `DODGE1.CPS` in `GEARS2.PAK` $\to$ Not found.
- Looked for `GEARS2.CPS` in `GEARS2.PAK` $\to$ Not found.
- Looked for `GEARS2.COL` in `GEARS2.PAK` $\to$ Not found.
Consequently, `DODGE1.WSA` defaulted to an empty black canvas and fallback grayscale palette.

---

## 3. Solution Implemented

### 3.1 Base-PAK Continuation Normalization
Implemented stem-stripping algorithms in `core/palette.py`, `core/wsa.py`, and `server.py`:

```python
pak_stem = pak_name.replace('.PAK', '').upper()

# Check if numbered continuation PAK (e.g. GEARS2, GEARS3, TREE2, INJAIL2, OUTCAVE2)
if any(pak_stem.endswith(str(d)) for d in range(10)):
    base_pak_name = pak_stem.rstrip('0123456789') + '.PAK'
    base_stem = pak_stem.rstrip('0123456789')
    candidates.append((base_pak_name, f"{base_stem}.CPS"))
    candidates.append((base_pak_name, f"{base_stem}.CMP"))
    candidates.append((base_pak_name, f"{asset_stem}.CPS"))
```

### 3.2 Palette Inheritance from Base PAK
In `core/palette.py`:
- If an asset in `GEARS2.PAK` has no local `.COL`, the resolver inspects `base_pak_dict` (`GEARS.PAK`) for `GEARS.COL`.
- The inherited palette is composited over the master `PALETTE.COL` using `_composite_palette()`, properly coloring both Zanthia and the machinery.

### 3.3 Prefixed Asset Scene Matching (`INCAVE.PAK`)
In `INCAVE.PAK`, room animations start with the `IN` prefix (`INBALL`, `INCANDLE`, `INLOVE`, `INSPHERE`):
- Added `pak_stem.CPS` (`INCAVE.CPS`) to the priority candidate list.
- In `_scan_cps_wsas`, when scanning `INCAVE.CPS`, all four animations in `INCAVE.PAK` are automatically associated and listed in the multi-layer composition tray.

---

## 4. Verification & Validation
- **`GEARS2.PAK -> DODGE1.WSA`**: Renders Marko dodging gears against the authentic `GEARS.PAK -> GEARS.CPS` background with correct lighting and machine tones.
- **`GEARS3.PAK -> HANDDEAD.WSA`**: Renders against `GEARS.CPS` background without any missing textures.
- **`INCAVE.PAK -> INCAVE.CPS`**: Automatically presents `INBALL.WSA`, `INCANDLE.WSA`, `INLOVE.WSA`, and `INSPHERE.WSA` in the interactive multi-layer control tray, enabling full scene playback and composite export.
