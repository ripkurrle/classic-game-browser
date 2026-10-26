# Classification of `.DAT`, `.C55`, and `.ADL` Under Hidden Non-Useful File Types

## 1. Executive Summary
During asset exploration of Westwood Studios' *The Legend of Kyrandia: Book Two - The Hand of Fate*, the user requested:
> *"also add *.dat, *.C55, and *.ADL file types to hidden"*

To fulfill this requirement:
- Classified `.DAT`, `.C55`, and `.ADL` extensions as non-useful files in `server.py` (`is_non_useful`).
- Automatically filtered out 39 low-level hardware sound bank and table files by default from the primary asset browser under the `"Hide non-useful files"` filter.
- Updated the UI checkbox tooltip in `web/index.html` and added a visual status badge (`Status: Hidden by default (Non-useful)`) in `web/app.js` when these files are inspected with the filter unchecked.
- Documented their technical specifications and classification in `README.md`.

---

## 2. Technical Profile of Target File Types

### 2.1 Inventory Table: `*.DAT` (1 file)
- **File**: `OTHER.PAK -> _ITEMHT.DAT` (176 bytes).
- **Purpose**: A flat 176-byte calibration array storing vertical pixel heights and bounding offsets for the 180 potion and item icons in `_ITEMS.CSH`.
- **Reason for Hiding**: It is raw calibration data rather than visual art, audio, or readable dialogue script.

### 2.2 Sound Canvas & MT-32 Timbre Banks: `*.C55` (19 files)
- **Location**: `AUDIO.PAK` (`K2SFX.C55`, `K2TEST1.C55` through `K2TEST4.C55`, etc.).
- **Purpose**: IFF container (FORM: XDIR) holding Roland SCC-55 Sound Canvas and Roland MT-32 / CM-32L System Exclusive (SysEx) instrument timbre dumps.
- **Reason for Hiding**: SysEx hardware bank dumps cannot be auditioned as standalone melodic tracks without specialized Roland synthesizer hardware or specific emulator routing. Standard users viewing soundtrack lists found them redundant alongside playable `.XMI` files.

### 2.3 AdLib FM Instrument Patch Banks: `*.ADL` (19 files)
- **Location**: `AUDIO.PAK` (`K2SFX.ADL`, `K2TEST1.ADL` through `K2TEST4.ADL`, etc.).
- **Purpose**: Yamaha YM3812 (OPL2/OPL3) 2-operator FM synthesis instrument patch definitions and register configuration tables used by the Miles Sound System.
- **Reason for Hiding**: Patch definitions without musical sequence data cannot be played directly as music, cluttering the audio categories.

---

## 3. Implementation Details

### 3.1 Backend Filtering ([`server.py`](file:///home/user1/ws/classic-game-browser/server.py#L112-L121))
Updated `is_non_useful()` in `server.py`:
```python
def is_non_useful(self, entry) -> bool:
    ext = entry.ext.upper()
    if ext in ('.TIM', '.SHP', '.MSC', '.ADV', '.DRV', '.CMP', '.DAT', '.C55', '.ADL'):
        return True
    if entry.name.upper() in ('HOFSYSEX.XMI', 'HOF_SYX.XMI'):
        return True
    if (entry.pak_name.upper(), entry.name.upper()) in self._stub_emc_keys:
        return True
    return False
```

- When `hide_non_useful=1` (the default), `/api/status` excludes these 39 assets from category counts.
- In `/api/assets`, these files are omitted unless `hide_non_useful=0`.
- When `hide_non_useful=0`, each matching asset includes `is_non_useful: true`.

### 3.2 Frontend UI & Detail Inspector ([`web/app.js`](file:///home/user1/ws/classic-game-browser/web/app.js#L4054-L4062), [`web/index.html`](file:///home/user1/ws/classic-game-browser/web/index.html#L130-L133))
- **Filter Tooltip**: Updated the tooltip for the `"Hide non-useful files"` toggle in `web/index.html`:
  ```html
  <label class="filter-checkbox-label" title="Hide non-useful files (TIM, SHP, MSC, ADV, DRV, CMP, DAT, C55, ADL, EMC stubs referencing SHP/WSA, and Sysex files)">
    <input type="checkbox" id="hideNonUsefulCheck" checked>
    <span class="checkbox-text">Hide non-useful files</span>
  </label>
  ```
- **Detail Chip**: In `renderRawViewer()`, added a red status chip whenever an asset with `is_non_useful: true` is viewed:
  ```javascript
  ${(details.is_non_useful || asset.is_non_useful) ? `
  <div class="meta-chip" style="background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
    Status: <strong>Hidden by default (Non-useful)</strong>
  </div>` : ''}
  ```

---

## 4. Verification & Validation
1. **Default View Verification (`hide_non_useful=1`)**:
   - Querying `/api/assets?hide_non_useful=1` returned **0** `.DAT`, **0** `.C55`, and **0** `.ADL` files.
2. **Unfiltered View Verification (`hide_non_useful=0`)**:
   - Querying `/api/assets?hide_non_useful=0` returned all 1 `.DAT`, 19 `.C55`, and 19 `.ADL` files, each with `is_non_useful: true`.
3. **Inspector Badge Verification**:
   - Navigating to `OTHER.PAK -> _ITEMHT.DAT` or `AUDIO.PAK -> K2SFX.C55` displayed the `Status: Hidden by default (Non-useful)` chip and download button.
