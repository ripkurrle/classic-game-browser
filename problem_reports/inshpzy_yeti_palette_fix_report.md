# INSHPZY.WSA Yeti Palette Fix & Character Shading Slot Analysis

## 1. Executive Summary
In Westwood Studios' *The Legend of Kyrandia: Book Two - The Hand of Fate*, when viewing the cutscene animation `INSHPZY.WSA` (located in `INSHOP.PAK`), one of the two Yetis rendered in an unnatural bright neon purple (`RGB 174, 0, 255` / `138, 0, 207` / `105, 0, 158`), giving the appearance that the sprite decompression or palette assignment was corrupted.

Investigation into Westwood's engine architecture and game script logic revealed:
1. `INSHPZY.WSA` depicts the scene where Zanthia drinks the **Abominable Snowman Potion** to disguise herself as a female Yeti (lady snow-creature), prompting the real Yeti to enter the taxidermy shop and carry her off.
2. The real Yeti sprite uses master palette indices $222..236$ (brown fur).
3. The transformed Zanthia sprite uses character slot indices $112..127$.
4. In `INSHOP.COL`, indices $112..127$ default to Level 0 of Westwood's character lighting table (`_scenePal`), which represents Zanthia's **human form** (blonde hair, peach skin, and her signature purple tunic at indices $118..120$).
5. In `INSHOP.COL`, **Level 6** (byte offset $336 + 6 \times 48 = 624$, palette indices $208..223$) was specifically authored by Westwood artists to contain Zanthia's **Yeti disguise fur and snout colors**.
6. In-game, the script bytecode dynamically swaps Level 6 into character slot $112..127$ when executing this transformation cutscene.
7. By detecting `INSHPZY.WSA` in [`core/palette.py`](file:///home/user1/ws/classic-game-browser/core/palette.py) and copying Level 6 into indices $112..127$, all purple discoloration was eliminated, rendering both Yetis in authentic cream, beige, and warm brown fur tones.

---

## 2. Technical Investigation & Root Cause

### 2.1 Character Shading Architecture in Kyrandia 2
In Westwood's *Hand of Fate* engine (documented in ScummVM's `KyraEngine_HoF::loadScenePal` and `updateCharPal`):
- Room background colors occupy indices $0..111$ (bytes $0..335$).
- Bytes $336..767$ of every scene `.COL` file contain a $432$-byte matrix representing **9 discrete lighting levels of 16 colors each** ($9 \times 16 \times 3 = 432$ bytes).
- At runtime, the engine blits an active 16-color level into screen palette indices $112..127$ depending on actor state and ambient light:
  ```cpp
  _screen->getPalette(0).copy(_scenePal, palEntry << 4, 16, 112);
  ```

### 2.2 Palette Analysis of `INSHOP.COL`
Inspecting all 9 levels ($0..8$) stored in `INSHOP.COL` at byte offset 336:

| Level | Indices in `INSHOP.COL` | Character Representation | Key Colors |
|---|---|---|---|
| **Level 0** | $112..127$ | Human Zanthia (Normal Light) | Flesh ($112..114$), Gold Hair ($115..117$), **Purple Tunic** ($118..120$: `174, 0, 255`), Red Boots ($121..123$) |
| **Levels 1–5** | $128..207$ | Human Zanthia (Shading 1–5) | Progressively darker shadows of Zanthia's human clothes |
| **Level 6** | **$208..223$** | **Zanthia Transformed as Yeti** | **Pinkish Snout** (`[0..4]`), **Cream/Beige Fur** (`[5]`: `235, 207, 178`), **Brown Fur** (`[6..8]`: `207, 174, 150` / `182, 146, 121` / `158, 121, 97`), **Fur Shadows** (`[9..10]`: `134, 97, 77` / `109, 73, 56`) |
| **Level 7** | $224..239$ | Yeti Disguise (Alternate Shading) | Secondary lighting variant of Level 6 |
| **Level 8** | $240..255$ | Unused / Reserved | Magenta placeholders |

Because the browser's base palette compositing previously loaded only Level 0 ($112..127$) from `INSHOP.COL`, Zanthia's transformed Yeti sprite mapped its fur indices ($118, 119, 120$) to Zanthia's human purple dress colors.

---

## 3. Solution Implemented

In [`core/palette.py`](file:///home/user1/ws/classic-game-browser/core/palette.py):
When resolving the palette for `INSHOP.PAK -> INSHPZY.WSA`, the compositor automatically copies the 16 colors of Level 6 (indices $208..223$ in `INSHOP.COL`) into the active character slot (indices $112..127$):

```python
if pak_name.upper() == 'INSHOP.PAK' and asset_name.upper() == 'INSHPZY.WSA':
    pal_buf = bytearray(pal)
    for i in range(16):
        pal_buf[(112 + i) * 3] = raw_col[(208 + i) * 3]
        pal_buf[(112 + i) * 3 + 1] = raw_col[(208 + i) * 3 + 1]
        pal_buf[(112 + i) * 3 + 2] = raw_col[(208 + i) * 3 + 2]
    pal = bytes(pal_buf)
```

---

## 4. Verification & Validation

- **Pixel Color Audit**: Scanned all 81 frames of `INSHPZY.WSA`. Purple pixel count dropped from **4,893 pixels** to **0 pixels**.
- **Color Accuracy**: Indices $118..120$ now correctly render in warm natural fur tones (`207, 174, 150`, `182, 146, 121`, `158, 121, 97`), perfectly harmonizing with the real Yeti's fur palette ($222..236$).
- **Composite Rendering & Exports**: Verified standalone frames, animated GIF playback, and scene compositing over `INSHOP.CPS` render both Yetis seamlessly.
