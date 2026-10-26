# Westwood `.FNT` Bitmap Font Engine, Multi-Line Typography Sandbox & UI Modernization

## 1. Executive Summary
During asset exploration of Westwood Studios' *The Legend of Kyrandia: Book Two - The Hand of Fate*, support was requested to extract and view Westwood `.FNT` font files (such as `GOLDFONT.FNT`, `6.FNT`, `8FAT.FNT`, `BOOKFONT.FNT`, `CYRIL.FNT`) stored in `INTROGEN.PAK`, `MISC_CPS.PAK`, and `OTHER.PAK`. Subsequent user requests specified:
1. "When viewing FNT files can you remove the glyph browser and the glyph inspect"
2. "For FMT also allow the user to enter multiple lines"

To address these requirements, a full Westwood Font Format v3 decoding pipeline was implemented in `core/fnt.py` and connected to a typography sandbox in `web/app.js` and `web/styles.css`. The static glyph-by-glyph inspection panels were removed, replacing them with a live, multi-line interactive typography sandbox featuring custom line spacing, tracking, zoom scaling (1x–4x), five authentic Kyrandia color schemes, and full font sheet PNG export.

---

## 2. Westwood Font Format v3 Architecture

### 2.1 Binary Header Structure
Westwood v3 bitmap fonts are packed 4-bit per pixel (16 color indices) variable-width bitmap fonts with an indexed header:

| Byte Offset | Type | Field Name | Description |
|---|---|---|---|
| `0x00` | `UINT16LE` | `file_size` | File length in bytes |
| `0x02` | `UINT8` | `comp_method` | Compression method (`0` = uncompressed raw font) |
| `0x03` | `UINT8` | `num_blks` | Block count (`5` for Westwood Font Format v3) |
| `0x04` | `UINT16LE` | `info_blk` | Offset to `FontInfo` structure |
| `0x06` | `UINT16LE` | `offset_blk` | Offset to array of glyph data offsets (`UINT16LE * num_glyphs`) |
| `0x08` | `UINT16LE` | `width_blk` | Offset to array of glyph widths (`UINT8 * num_glyphs`) |
| `0x0A` | `UINT16LE` | `data_blk` | Base offset to packed 4bpp nibble pixel buffer |
| `0x0C` | `UINT16LE` | `height_blk` | Offset to array of glyph height tuples (`(h1, h2)` pairs) |

### 2.2 Glyph Metrics and 4bpp Nibble Packing
In `FontInfo`:
- `info_blk + 3`: Maximum glyph character index (`num_glyphs = max_idx + 1`, typically 255/256).
- `info_blk + 4`: Font maximum bounding height (`max_height`, e.g., 9–14 pixels).
- `info_blk + 5`: Font maximum glyph width (`max_width`, e.g., 8–12 pixels).

For each character index $i$:
1. **Vertical Layout**:
   - `h1`: Top padding lines (transparent rows).
   - `h2`: Active pixel rows containing packed nibbles.
   - `h0 = max(0, max_height - (h1 + h2))`: Bottom baseline/descender padding lines.
2. **Horizontal Layout**:
   - `width`: Character advance width in pixels.
   - Bytes per active row: $\lceil \text{width} / 2 \rceil$.
3. **Nibble Ordering**:
   - Even $X$ coordinate ($x \pmod 2 = 0$): Low nibble `byte & 0x0F`.
   - Odd $X$ coordinate ($x \pmod 2 = 1$): High nibble `(byte >> 4) & 0x0F`.
   - Index `0` represents transparency, while indices `1..15` map to font shading/gradient levels.

---

## 3. Implementation Details

### 3.1 Python Backend Decoder (`core/fnt.py`)
Implemented `FntGlyph` and `FntFont` classes to decode all glyph metrics and unpack nibble matrices:
- Unpacks 4bpp raster lines according to variable glyph widths.
- Maps ASCII codes to glyph matrices (including DOS Code Page 850 support).
- Implemented `render_spritesheet()` in `core/fnt.py` generating a 16×16 character grid preview for asset exports.
- Registered `.FNT` in `core/file_types.py` under the Westwood File Taxonomy.

### 3.2 Live Typography Sandbox (`web/app.js` & `web/styles.css`)
Per user requirements:
- **Removed Glyph Browser and Glyph Inspector**: Eliminated the cluttered static glyph table and raw hex inspector cards, dedicating the entire viewing area to typography testing.
- **Multi-Line Text Input**: Replaced the single-line `<input>` with a styled multi-line `<textarea class="fnt-sandbox-textarea" rows="3">`.
- **Interactive Controls**:
  - Zoom Scaling: 1x, 2x, 3x, 4x nearest-neighbor scaling.
  - Tracking (Letter Spacing): Slider ranging from `-1px` to `+5px`.
  - Line Spacing: Slider ranging from `0px` to `+10px`.
  - Presets: Quick-fill buttons for *Game Title*, *Dialogue*, *Soundtrack*, *All Glyphs*, and *Westwood*.
  - Five Color Themes:
    1. **🌟 Kyrandia Gold**: Bright gold fill `#f5d061`, amber shade `#e5a823`, dark outline `#7a4e08`.
    2. **⚪ Dialogue White**: Pure white fill `#ffffff`, silver shadow `#bec3cd`, dark border `#232832`.
    3. **🟠 Amber**: Vibrant orange-yellow fill `#fbbf24`, deep amber `#d97706`.
    4. **🔷 Cyan**: Cool electric blue `#38bdf8`, navy shadow `#082f49`.
    5. **🟢 Emerald**: Mystical green `#34d399`, deep forest shadow `#064e3b`.

---

## 4. Verification & Results
- Verified `GOLDFONT.FNT` (Kyrandia main title font) renders authentic golden drop-shadow typography.
- Verified multi-line dialogue strings split across linebreaks with precise vertical line-spacing control.
- Exporting rendered text creates a transparent 32-bit PNG preserving the authentic Westwood raster look.
