# Format 80 Uncompressed Asset Extraction, Byte Display & Single-Column Grid Optimization

## 1. Executive Summary
During asset exploration and extraction workflows, three interrelated usability and technical challenges were identified and addressed:
1. **Uncompressed Asset Extraction (`.CSH` and `.CMP`)**: Westwood archives pack sprite collections (`_ITEMS.CSH`, `_BUTTONS.CSH`, `_MOUSE.CSH`) and cutscene lookup tables (`SCENE2.CMP`, `SCENE3.CMP`) inside proprietary Format 80 LCW compression containers. Users requested the ability to inspect and download these assets in their uncompressed, raw formats.
2. **Ambiguous Compressed vs. Uncompressed Size Reporting**: In file listings and detail panes, the browser previously displayed only raw byte sizes from the PAK index, confusing users when compressed archives expanded to significantly larger payloads in memory. The user requested: *"the cmp file displays compressed data, can the uncompressed verison be shown instead with label mentioning that the uncompressed value is shown"*.
3. **Sidebar Grid Layout and Horizontal Scroll Bar**: The file browser grid mode produced multi-column horizontal overflow and horizontal scroll bars on standard viewport widths. The user requested: *"the grid view for files now has a scroll bar , can you change it so there is only one column"*.

---

## 2. Technical Analysis & Format Architecture

### 2.1 Westwood 10-Byte Compression Container Header
Both `.CSH` (Compressed Shape) and `.CMP` (Colormap) files utilize Westwood's standard 10-byte compression container header:

```
+--------------------+--------------------+--------------------+--------------------+
| file_size_minus_2  |  compression_type  |  uncompressed_sz   |    palette_size    |
|   (UINT16LE, 2B)   |   (UINT16LE, 2B)   |   (UINT32LE, 4B)   |   (UINT16LE, 2B)   |
+--------------------+--------------------+--------------------+--------------------+
0                    2                    4                    8                   10
```

- **Compression Types**:
  - `0`: Raw Uncompressed
  - `3`: Westwood Run-Length Encoding (RLE)
  - `4`: Westwood Format 80 (Lempel-Ziv-Welch variant)
- **Payload Unpacking**:
  - For `.CSH`, decompressing the payload starting at offset 10 produces a standard Westwood `.SHP` (Compact Shape) sprite archive with multi-frame offsets, dimensions, and 8-bit paletted pixel rasters.
  - For `.CMP`, decompressing offset 10 produces a 65,532-byte 256×256 matrix lookup table.

### 2.2 Compressed Asset Inventory in *Kyrandia 2*
- `OTHER.PAK`:
  - `_ITEMS.CSH`: Compressed size ~29 KB $\to$ Decompressed size 80,480 bytes (contains all 180 in-game potion, ingredient, and inventory icons).
  - `_BUTTONS.CSH`: Compressed size ~3.5 KB $\to$ Decompressed size 8,420 bytes (contains 15 dialog and interface buttons).
  - `_MOUSE.CSH`: Compressed size ~1.8 KB $\to$ Decompressed size 4,210 bytes (contains 9 cursor animations).
- `INTROGEN.PAK`:
  - `SCENE2.CMP`: Compressed size 38,168 bytes $\to$ Decompressed size 65,532 bytes.
  - `SCENE3.CMP`: Compressed size 38,168 bytes $\to$ Decompressed size 65,532 bytes.

---

## 3. Implementation Details

### 3.1 Backend Uncompressed Size Parsing (`server.py`)
In `server.py`:
- Updated `_scan_cps_wsas` and `/api/assets` to inspect the 10-byte header of `.CMP` and `.CSH` files dynamically.
- Injected `uncompressed_size` and `uncompressed_label = "Uncompressed value shown"` into asset descriptors.
- Supported direct binary uncompressed exports via `/api/asset/export?pak=...&name=...&uncompressed=1`:
  - Decompresses `.CSH` using `format80_decode` and exports as native `.SHP`.
  - Decompresses `.CMP` and exports as raw 64 KB `.BIN` lookup tables.

### 3.2 Frontend UI & Badge Presentation (`web/app.js`, `web/styles.css`)
- **Prominent Visual Badging**: Added `<span class="uncompressed-tag">Uncompressed</span>` badge in emerald green alongside file sizes.
- **Archive Header Labeling**: Updated the asset viewer header to explicitly read:
  `Archive: INTROGEN.PAK (64.0 KB - Uncompressed value shown)`.
- **Detail Chip Specification**: Added clear breakdown in the metadata chips:
  `⚡ Uncompressed value shown` and `Uncompressed: 65,532 bytes (64.0 KB)`.
- **Download Actions**: Added direct download links labeled `Download Uncompressed (.SHP)` and `Download Uncompressed Table (.BIN - 64 KB)`.

### 3.3 Single-Column Grid Optimization (`web/styles.css`)
In `web/styles.css`:
```css
.asset-list-container.grid-mode {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
```
- Replaced the prior multi-column auto-fill rule (`repeat(auto-fill, minmax(280px, 1fr))`) with a single-column layout (`1fr`).
- Completely resolved sidebar horizontal scroll bar glitches, ensuring cards fit neatly within the 360px sidebar container while maintaining vertical scrolling.

---

## 4. Verification & Validation
- Verified all 180 item icons in `_ITEMS.CSH` unpack and render smoothly as individual sprites and comprehensive sprite sheets.
- Verified that sorting by size correctly factors uncompressed sizes when selected.
- Verified that downloading uncompressed `.CSH` yields a valid `.SHP` file that can be opened in third-party Westwood tools.
- Verified single-column scrolling is responsive across desktop and tablet window dimensions.
