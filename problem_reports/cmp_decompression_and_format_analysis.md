# Westwood `.CMP` Format Analysis, Decompression & Cutscene Transition Engine

## 1. Executive Summary
During asset exploration of Westwood Studios' *The Legend of Kyrandia: Book Two - The Hand of Fate* (`INTROGEN.PAK`), two compressed files named `SCENE2.CMP` and `SCENE3.CMP` (each 38,168 bytes compressed, 65,532 bytes uncompressed) presented rendering and interpretation anomalies:
- Initially, when viewed as background pictures, they displayed diagonal static banding, leading to concerns that the decompression was corrupted or incomplete.
- Fixing stride dimensions from 320 to 256 revealed a smooth mathematical gradient ramp rather than scene artwork.
- Deep disassembly and ScummVM engine reverse-engineering revealed that **`.CMP` files in Kyrandia 2 are not scene background pictures**, but **precomputed 256×256 ($65,536$-entry) cross-fade and dissolve color transition tables** used by the cutscene engine (`nestedFrameFadeTransition`).
- Following user request, visual image previews were removed, replaced with a comprehensive technical description, and `.CMP` was classified under hidden non-useful file types.

---

## 2. Technical Investigation & Root Cause

### 2.1 Format 80 Decompression
Both `SCENE2.CMP` and `SCENE3.CMP` begin with a standard Westwood container header:
- `file_size_minus_2`: `UINT16LE` (38,166)
- `compression_type`: `UINT16LE` (4 = Westwood Format 80 LCW)
- `uncompressed_size`: `UINT32LE` (65,532 bytes)
- `palette_size`: `UINT16LE` (0 = no embedded palette)

Using `core/format80.py`, the payload decompressed cleanly to exactly 65,532 bytes without decompression errors or trailing buffer overruns.

### 2.2 Stride & Visual Artifacts
- Standard Kyrandia room backgrounds (`.CPS`) use $320 \times 200 = 64,000$ bytes.
- When the decoder initially treated `.CMP` as a 320-pixel wide image ($65,532 // 320 = 204$ rows), the true 256-byte scanlines were offset by $320 - 256 = 64$ pixels per row.
- This 64-pixel stride mismatch sheared the data into 5 distinct diagonal static bands across the canvas, mimicking corrupted decompression.
- In addition, `INTROGEN.PAK`'s only `.COL` file was `GOLDFONT.COL`, which populated color indices 60–255 with pure white `(255, 255, 255)`.

### 2.3 Discovery of Engine Cutscene Mechanics
Reverse-engineering ScummVM's Kyra engine (`engines/kyra/sequence/sequences_hof.cpp` and `engines/kyra/graphics/screen_hof.cpp`) uncovered the exact usage of `scene2.cmp` and `scene3.cmp`:

```cpp
void SeqPlayer_HOF::nestedFrameFadeTransition(const char *cmpFile) {
    _screen->copyPage(10, 2);
    _screen->copyPage(4, 10);
    _screen->clearPage(6);
    _screen->loadBitmap(cmpFile, 6, 6, nullptr);
    _screen->copyPage(12, 4);

    for (int i = 0; i < 3; i++) {
        uint32 endtime = _system->getMillis() + 4 * _tickLength / 1000;
        _screenHoF->cmpFadeFrameStep(4, 320, 200, 0, 0, 2, 320, 200, 0, 0, 320, 200, 6);
        _screen->copyRegion(0, 0, 0, 0, 320, 200, 2, 0);
        _screen->updateScreen();
        delayUntil(endtime);
    }
}
```

In `screen_hof.cpp`:
```cpp
const uint8 *src = getPagePtr(srcPage) + srcW * (Y1 + r5);
uint8 *dst = getPagePtr(dstPage) + dstW * (Y2 + r2);
const uint8 *cmp = getPagePtr(cmpPage);

while (H2--) {
    const uint8 *s = src + r4 + X1;
    uint8 *d = dst + r1 + X2;

    for (int i = 0; i < W2; i++) {
        int ix = (*s++ << 8) + *d;
        *d++ = cmp[ix];   // Single instruction color blend lookup
    }
}
```

### 2.4 Mathematical Properties of `.CMP`
- The table stores: $\text{Result} = \text{table}[\text{source\_pixel} \times 256 + \text{dest\_pixel}]$.
- For any identical pair ($S = D$), the table returns $S$.
- For differing colors, the table returns an intermediate shade.
- Repeated 3 times: $S \to \text{Step 1} \to \text{Step 2} \to D$.
- In 1993, this allowed real-time 60 fps cross-dissolves on 386/486 hardware without CPU floating-point or alpha blending.

---

## 3. Implemented Solutions

1. **Reclassification & Hidden Status (`server.py`, `core/file_types.py`)**:
   - Added `.CMP` to `is_non_useful()` in `server.py` so that `SCENE2.CMP` and `SCENE3.CMP` are hidden by default under the "Hide non-useful files" filter.
   - Decoupled `.CMP` from the Backgrounds category count and batch exporter so backgrounds only export authentic `.CPS` room scenes.
   - Updated `FILE_TYPE_CATALOG` with category `system` and title `Cutscene Transition Color Table (SCENE2/3.CMP)`.

2. **Replacement of Preview with Technical Description (`web/app.js`, `web/styles.css`)**:
   - Removed canvas image preview for `.CMP`.
   - Replaced thumbnail with placeholder icon `🔀`.
   - Rendered a comprehensive description card detailing:
     - Purpose of the transition lookup table.
     - Assembly code and math explanation ($ix = (\text{src} \ll 8) + \text{dst}$).
     - Technical specifications and archive metadata.
     - Direct downloads for uncompressed table (`.BIN` - 64 KB) and original compressed (`.CMP`).
   - Integrated an interactive 3-step color morph simulator allowing users to test source and destination color blending.

---

## 4. Verification
- Programmatically verified API endpoints:
  - `/api/assets?hide_non_useful=1`: 0 CMP files returned (cleanly hidden by default).
  - `/api/assets?hide_non_useful=0`: `SCENE2.CMP` and `SCENE3.CMP` returned with `is_non_useful: true`.
  - `/api/status`: Backgrounds count = 112 (only `.CPS` files).
  - `/api/asset/details?pak=INTROGEN.PAK&name=SCENE2.CMP`: Returns transition metadata and 256-color palette.
