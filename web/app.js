/**
 * Kyrandia 2: Hand of Fate - Asset Studio Client Application
 */

(function () {
  'use strict';

  // State Management
  const state = {
    gameDir: '',
    currentCategory: 'all',
    currentPak: '',
    searchQuery: '',
    viewMode: 'grid', // 'grid' | 'list'
    assets: [],
    selectedAsset: null,
    selectedDetails: null,

    // Viewer states
    zoomLevel: 'fit', // 'fit', 1, 2, 3, 4
    scanlinesActive: false,
    modelBackdrop: 'bg-checker',
    modelCurrentFrame: 0,
    modelPlaying: false,
    modelTimer: null,
    modelFps: 8,

    animCurrentFrame: 0,
    animPlaying: false,
    animTimer: null,
    animFps: 10,

    audioVisualizerTimer: null,
    batchPollTimer: null,

    // Per-asset-type sort preferences (by: 'name'|'size', order: 'asc'|'desc')
    sortPreferences: {
      all: { by: 'name', order: 'asc' },
      backgrounds: { by: 'name', order: 'asc' },
      models: { by: 'name', order: 'asc' },
      soundtracks: { by: 'name', order: 'asc' },
      animations: { by: 'name', order: 'asc' },
      sfx: { by: 'name', order: 'asc' },
      palettes: { by: 'name', order: 'asc' },
    },
    paletteSwatchSize: 'size-md',
  };

  // Restore saved sort preferences from localStorage
  try {
    const savedSort = localStorage.getItem('kyrandia_sort_prefs');
    if (savedSort) {
      Object.assign(state.sortPreferences, JSON.parse(savedSort));
    }
  } catch (_) {}

  // DOM Elements
  const el = {
    headerGameDir: document.getElementById('headerGameDir'),
    dirSelectorBtn: document.getElementById('dirSelectorBtn'),
    categoryTabs: document.getElementById('categoryTabs'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    pakSelect: document.getElementById('pakSelect'),
    assetList: document.getElementById('assetList'),
    assetListHeading: document.getElementById('assetListHeading'),
    filteredCountLabel: document.getElementById('filteredCountLabel'),
    viewGridBtn: document.getElementById('viewGridBtn'),
    viewListBtn: document.getElementById('viewListBtn'),

    // Sorting Controls
    sortByNameBtn: document.getElementById('sortByNameBtn'),
    sortBySizeBtn: document.getElementById('sortBySizeBtn'),
    sortNameArrow: document.getElementById('sortNameArrow'),
    sortSizeArrow: document.getElementById('sortSizeArrow'),
    assetSortSelect: document.getElementById('assetSortSelect'),

    // Viewer
    viewerStage: document.getElementById('viewerStage'),
    selectedAssetType: document.getElementById('selectedAssetType'),
    selectedAssetName: document.getElementById('selectedAssetName'),
    selectedAssetPak: document.getElementById('selectedAssetPak'),
    viewerActions: document.getElementById('viewerActions'),
    metaChips: document.getElementById('metaChips'),
    interactiveControls: document.getElementById('interactiveControls'),

    // Edge Pan Sliders
    panSlidersBar: document.getElementById('panSlidersBar'),
    panXSlider: document.getElementById('panXSlider'),
    panYSlider: document.getElementById('panYSlider'),
    panLeftBtn: document.getElementById('panLeftBtn'),
    panRightBtn: document.getElementById('panRightBtn'),
    panTopBtn: document.getElementById('panTopBtn'),
    panBottomBtn: document.getElementById('panBottomBtn'),
    panCenterBtn: document.getElementById('panCenterBtn'),

    // Counts
    countAll: document.getElementById('countAll'),
    countBg: document.getElementById('countBg'),
    countModels: document.getElementById('countModels'),
    countMidi: document.getElementById('countMidi'),
    countAnim: document.getElementById('countAnim'),
    countSfx: document.getElementById('countSfx'),
    countPalettes: document.getElementById('countPalettes'),
    countScripts: document.getElementById('countScripts'),
    langFilterWrapper: document.getElementById('langFilterWrapper'),
    langSelect: document.getElementById('langSelect'),

    // Batch Export Modal
    batchExportBtn: document.getElementById('batchExportBtn'),
    exportModal: document.getElementById('exportModal'),
    closeExportModalBtn: document.getElementById('closeExportModalBtn'),
    cancelExportModalBtn: document.getElementById('cancelExportModalBtn'),
    startBatchExportBtn: document.getElementById('startBatchExportBtn'),
    exportFolderInput: document.getElementById('exportFolderInput'),
    exportProgressWrap: document.getElementById('exportProgressWrap'),
    exportProgressBar: document.getElementById('exportProgressBar'),
    exportProgressText: document.getElementById('exportProgressText'),
    exportCurrentItem: document.getElementById('exportCurrentItem'),

    // Dir Modal
    dirModal: document.getElementById('dirModal'),
    closeDirModalBtn: document.getElementById('closeDirModalBtn'),
    cancelDirModalBtn: document.getElementById('cancelDirModalBtn'),
    saveDirBtn: document.getElementById('saveDirBtn'),
    dirInput: document.getElementById('dirInput'),
    dirStatusMsg: document.getElementById('dirStatusMsg'),
  };

  // Initialization
  async function init() {
    updateSortControlsUI();
    setupEventListeners();
    await loadStatus();
    await loadAssets();
  }

  function setupEventListeners() {
    // Category Tabs
    el.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentCategory = tab.dataset.category;

      if (state.currentCategory === 'scripts' || state.currentCategory.startsWith('scripts')) {
        if (el.langFilterWrapper) el.langFilterWrapper.style.display = 'block';
        if (el.langSelect) el.langSelect.value = state.currentCategory;
      } else {
        if (el.langFilterWrapper) el.langFilterWrapper.style.display = 'none';
      }

      updateSortControlsUI();
      loadAssets();
    });

    if (el.langSelect) {
      el.langSelect.addEventListener('change', (e) => {
        state.currentCategory = e.target.value || 'scripts';
        updateSortControlsUI();
        loadAssets();
      });
    }

    // Sorting Controls
    el.sortByNameBtn.addEventListener('click', () => {
      const curr = getCurrentSort();
      if (curr.by === 'name') {
        setSort('name', curr.order === 'asc' ? 'desc' : 'asc');
      } else {
        setSort('name', curr.order || 'asc');
      }
    });

    el.sortBySizeBtn.addEventListener('click', () => {
      const curr = getCurrentSort();
      if (curr.by === 'size') {
        setSort('size', curr.order === 'desc' ? 'asc' : 'desc');
      } else {
        setSort('size', 'desc'); // Default to Largest first when switching to Size
      }
    });

    el.assetSortSelect.addEventListener('change', (e) => {
      const parts = e.target.value.split('_');
      if (parts.length === 2) {
        setSort(parts[0], parts[1]);
      }
    });

    // Search Input
    let searchTimeout = null;
    el.searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      el.clearSearchBtn.style.display = val ? 'block' : 'none';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchQuery = val;
        loadAssets();
      }, 200);
    });

    el.clearSearchBtn.addEventListener('click', () => {
      el.searchInput.value = '';
      el.clearSearchBtn.style.display = 'none';
      state.searchQuery = '';
      loadAssets();
    });

    // Pak Selector
    el.pakSelect.addEventListener('change', (e) => {
      state.currentPak = e.target.value;
      loadAssets();
    });

    // View Toggles
    el.viewGridBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      el.viewGridBtn.classList.add('active');
      el.viewListBtn.classList.remove('active');
      el.assetList.classList.add('grid-mode');
    });

    el.viewListBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      el.viewListBtn.classList.add('active');
      el.viewGridBtn.classList.remove('active');
      el.assetList.classList.remove('grid-mode');
    });

    // Modals
    el.batchExportBtn.addEventListener('click', () => {
      el.exportModal.style.display = 'flex';
      checkBatchStatus();
    });
    el.closeExportModalBtn.addEventListener('click', () => el.exportModal.style.display = 'none');
    el.cancelExportModalBtn.addEventListener('click', () => el.exportModal.style.display = 'none');
    el.startBatchExportBtn.addEventListener('click', startBatchExport);

    el.dirSelectorBtn.addEventListener('click', () => {
      el.dirInput.value = state.gameDir;
      el.dirStatusMsg.style.display = 'none';
      el.dirModal.style.display = 'flex';
    });
    el.closeDirModalBtn.addEventListener('click', () => el.dirModal.style.display = 'none');
    el.cancelDirModalBtn.addEventListener('click', () => el.dirModal.style.display = 'none');
    el.saveDirBtn.addEventListener('click', saveDirectory);

    // Pan Sliders & Drag to Pan
    setupPanSliders();
    setupDragToPan();
  }

  // API Calls
  async function loadStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      state.gameDir = data.game_dir;
      el.headerGameDir.textContent = data.game_dir;
      el.headerGameDir.title = data.game_dir;

      // Update counts
      if (data.counts) {
        el.countAll.textContent = data.counts.total_assets.toLocaleString();
        el.countBg.textContent = data.counts.backgrounds.toLocaleString();
        el.countModels.textContent = data.counts.models.toLocaleString();
        el.countMidi.textContent = data.counts.soundtracks.toLocaleString();
        el.countAnim.textContent = data.counts.animations.toLocaleString();
        el.countSfx.textContent = data.counts.sfx.toLocaleString();
        if (el.countPalettes && data.counts.palettes !== undefined) {
          el.countPalettes.textContent = data.counts.palettes.toLocaleString();
        }
        if (el.countScripts && data.counts.scripts !== undefined) {
          el.countScripts.textContent = data.counts.scripts.toLocaleString();
        }
      }

      // Populate PAK dropdown
      if (data.paks) {
        el.pakSelect.innerHTML = '<option value="">All Archives (.PAK)</option>';
        data.paks.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          el.pakSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }

  // Sort State & Preference Helpers
  function getCurrentSort() {
    const cat = state.currentCategory || 'all';
    if (!state.sortPreferences[cat]) {
      state.sortPreferences[cat] = { by: 'name', order: 'asc' };
    }
    return state.sortPreferences[cat];
  }

  function setSort(by, order) {
    const cat = state.currentCategory || 'all';
    state.sortPreferences[cat] = { by, order };
    try {
      localStorage.setItem('kyrandia_sort_prefs', JSON.stringify(state.sortPreferences));
    } catch (_) {}
    updateSortControlsUI();
    sortAndRenderAssets();
  }

  function updateSortControlsUI() {
    const { by, order } = getCurrentSort();

    if (el.sortByNameBtn && el.sortBySizeBtn) {
      el.sortByNameBtn.classList.toggle('active', by === 'name');
      el.sortBySizeBtn.classList.toggle('active', by === 'size');

      if (el.sortNameArrow) {
        el.sortNameArrow.textContent = (by === 'name' && order === 'desc') ? '↓' : '↑';
      }
      if (el.sortSizeArrow) {
        el.sortSizeArrow.textContent = (by === 'size' && order === 'asc') ? '↑' : '↓';
      }

      el.sortByNameBtn.title = by === 'name'
        ? `Sort by Name (${order === 'asc' ? 'A → Z, click for Z → A' : 'Z → A, click for A → Z'})`
        : 'Sort by Name (A → Z)';

      el.sortBySizeBtn.title = by === 'size'
        ? `Sort by Size (${order === 'desc' ? 'Largest first, click for Smallest first' : 'Smallest first, click for Largest first'})`
        : 'Sort by File Size (Largest first)';
    }

    if (el.assetSortSelect) {
      el.assetSortSelect.value = `${by}_${order}`;
    }

    if (el.assetListHeading) {
      const titles = {
        all: 'All Assets',
        backgrounds: 'Backgrounds',
        models: 'Models & Sprites',
        soundtracks: 'MIDI Soundtracks',
        animations: 'Animations',
        sfx: 'Voices & SFX',
        palettes: 'Color Palettes (.COL)',
        scripts: 'Scripts & Dialogue (All Languages)',
        scripts_en: 'English Scripts & Dialogue (🇬🇧)',
        scripts_fr: 'French Scripts & Dialogue (🇫🇷)',
        scripts_de: 'German Scripts & Dialogue (🇩🇪)',
      };
      el.assetListHeading.textContent = titles[state.currentCategory] || 'Assets';
    }
  }

  function sortAndRenderAssets() {
    const { by, order } = getCurrentSort();
    state.assets.sort((a, b) => {
      if (by === 'size') {
        const diff = a.size - b.size;
        if (diff !== 0) return order === 'desc' ? -diff : diff;
        return a.name.localeCompare(b.name);
      } else {
        const cmp = a.name.localeCompare(b.name);
        if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
        return a.size - b.size;
      }
    });
    renderAssetList();
  }

  async function loadAssets() {
    el.assetList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Searching assets...</span>
      </div>
    `;

    try {
      const { by, order } = getCurrentSort();
      const params = new URLSearchParams({
        category: state.currentCategory,
        pak: state.currentPak,
        q: state.searchQuery,
        sort: by,
        order: order,
      });

      const res = await fetch(`/api/assets?${params}`);
      const data = await res.json();
      state.assets = data.assets || [];

      sortAndRenderAssets();

      // If nothing selected or selection not in results, select first item
      if (state.assets.length > 0) {
        const stillSelected = state.selectedAsset && state.assets.some(a => a.name === state.selectedAsset.name && a.pak_name === state.selectedAsset.pak_name);
        if (!stillSelected) {
          selectAsset(state.assets[0]);
        }
      } else {
        renderEmptyViewer();
      }
    } catch (err) {
      el.assetList.innerHTML = `<div class="status-box error">Failed to load assets: ${err.message}</div>`;
    }
  }

  function renderAssetList() {
    el.filteredCountLabel.textContent = `Showing ${state.assets.length.toLocaleString()} assets`;

    if (state.assets.length === 0) {
      el.assetList.innerHTML = `
        <div class="loading-state">
          <div class="empty-icon">🔍</div>
          <span>No assets found matching criteria</span>
        </div>
      `;
      return;
    }

    el.assetList.innerHTML = '';
    const frag = document.createDocumentFragment();
    const isSizeSort = getCurrentSort().by === 'size';

    state.assets.forEach(asset => {
      const card = document.createElement('div');
      card.className = `asset-card ${state.selectedAsset && state.selectedAsset.name === asset.name && state.selectedAsset.pak_name === asset.pak_name ? 'active' : ''}`;
      card.dataset.pak = asset.pak_name;
      card.dataset.name = asset.name;

      const extClass = `ext-${asset.ext.replace('.', '').toLowerCase()}`;
      let thumbHtml = '';

      if (asset.ext === '.CPS' || asset.ext === '.CMP') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.SHP' || asset.ext === '.CSH') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.WSA') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.COL' || asset.ext === '.PAL') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&cell=2" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.XMI') {
        thumbHtml = `<span class="asset-placeholder-icon">🎵</span>`;
      } else if (asset.ext === '.ADL') {
        thumbHtml = `<span class="asset-placeholder-icon">📻</span>`;
      } else if (asset.ext === '.C55') {
        thumbHtml = `<span class="asset-placeholder-icon">🎹</span>`;
      } else if (asset.ext === '.VOC') {
        thumbHtml = `<span class="asset-placeholder-icon">🔊</span>`;
      } else if (asset.ext === '.PCS') {
        thumbHtml = `<span class="asset-placeholder-icon">📢</span>`;
      } else if (asset.ext === '.TIM') {
        thumbHtml = `<span class="asset-placeholder-icon">⏱️</span>`;
      } else if (asset.ext === '.MSC') {
        thumbHtml = `<span class="asset-placeholder-icon">🎯</span>`;
      } else if (asset.ext === '.ADV') {
        thumbHtml = `<span class="asset-placeholder-icon">⚙️</span>`;
      } else if (asset.ext === '.DRV') {
        thumbHtml = `<span class="asset-placeholder-icon">🔌</span>`;
      } else if (asset.ext === '.FNT') {
        thumbHtml = `<span class="asset-placeholder-icon">🔤</span>`;
      } else if (asset.ext === '.DAT') {
        thumbHtml = `<span class="asset-placeholder-icon">📊</span>`;
      } else if (['.EMC', '.FMC', '.GMC', '.DLE', '.DLF', '.DLG', '.ENG', '.FRE', '.GER'].includes(asset.ext)) {
        const flag = asset.flag || (['.EMC', '.DLE', '.ENG'].includes(asset.ext) ? '🇬🇧' : (['.FMC', '.DLF', '.FRE'].includes(asset.ext) ? '🇫🇷' : '🇩🇪'));
        thumbHtml = `<span class="asset-placeholder-icon">📜</span><span class="asset-badge-lang">${flag}</span>`;
      } else {
        thumbHtml = `<span class="asset-placeholder-icon">${asset.type_icon || '📄'}</span>`;
      }

      card.innerHTML = `
        <div class="asset-thumbnail-wrap">${thumbHtml}</div>
        <div class="asset-card-info">
          <span class="asset-card-title" title="${asset.name}">${asset.name}</span>
          <div class="asset-card-meta">
            <span class="asset-ext-badge ${extClass}">${asset.ext.replace('.', '')}</span>
            <span class="asset-size-badge ${isSizeSort ? 'highlight-size' : ''}">${formatBytes(asset.size)}</span>
            <span>• ${asset.pak_name}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => selectAsset(asset));
      frag.appendChild(card);
    });

    el.assetList.appendChild(frag);
  }

  async function selectAsset(asset) {
    state.selectedAsset = asset;

    // Highlight card
    document.querySelectorAll('.asset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.name === asset.name && c.dataset.pak === asset.pak_name);
    });

    // Update header info
    el.selectedAssetType.textContent = asset.ext.replace('.', '');
    el.selectedAssetName.textContent = asset.name;
    el.selectedAssetPak.textContent = `Archive: ${asset.pak_name} (${formatBytes(asset.size)})`;

    // Reset controls
    stopAllPlayback();

    // Fetch full details
    try {
      const res = await fetch(`/api/asset/details?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`);
      state.selectedDetails = await res.json();
    } catch (e) {
      state.selectedDetails = asset;
    }

    // Render corresponding viewer
    const SCRIPT_EXTS = ['.EMC', '.FMC', '.GMC', '.DLE', '.DLF', '.DLG', '.ENG', '.FRE', '.GER'];
    if (SCRIPT_EXTS.includes(asset.ext)) {
      renderScriptViewer(asset, state.selectedDetails);
    } else if (['.CPS', '.CMP'].includes(asset.ext)) {
      renderBackgroundViewer(asset, state.selectedDetails);
    } else if (['.SHP', '.CSH'].includes(asset.ext)) {
      renderModelViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.WSA') {
      renderAnimationViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.COL' || asset.ext === '.PAL') {
      renderPaletteViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.XMI') {
      renderMidiViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.VOC') {
      renderVocViewer(asset, state.selectedDetails);
    } else {
      renderRawViewer(asset, state.selectedDetails);
    }
  }

  // 1. Background Viewer (.CPS)
  function renderBackgroundViewer(asset, details) {
    const previewUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;

    el.viewerActions.innerHTML = `
      <a href="${exportUrl}" download="${asset.name.replace('.CPS', '.png')}" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Export PNG Picture</span>
      </a>
    `;

    el.viewerStage.innerHTML = `
      <div class="cps-viewport-stage" id="cpsViewportStage">
        <div class="cps-canvas-wrapper ${state.scanlinesActive ? 'crt-overlay' : ''}" id="imgWrap">
          <img id="stageImg" src="${previewUrl}" class="display-canvas" alt="${asset.name}">
        </div>
      </div>
    `;

    // Metadata chips
    el.metaChips.innerHTML = `
      <div class="meta-chip">Dimensions: <strong>${details.dimensions || '320x200'}</strong></div>
      <div class="meta-chip">Color Depth: <strong>256 VGA Colors</strong></div>
      <div class="meta-chip">Compression: <strong>Format 80 (LCW)</strong></div>
      <div class="meta-chip">File Size: <strong>${formatBytes(asset.size)}</strong></div>
    `;

    // Interactive controls: Multiplier buttons & CRT scanlines
    el.interactiveControls.innerHTML = `
      <div class="ctrl-btn-group" title="Zoom Multiplier">
        <button class="ctrl-btn ${state.zoomLevel === 'fit' ? 'active' : ''}" data-zoom="fit" title="Fit to Preview Window">Fit</button>
        <button class="ctrl-btn ${state.zoomLevel === 1 ? 'active' : ''}" data-zoom="1" title="1x (320x200)">1x</button>
        <button class="ctrl-btn ${state.zoomLevel === 2 ? 'active' : ''}" data-zoom="2" title="2x (640x400)">2x</button>
        <button class="ctrl-btn ${state.zoomLevel === 3 ? 'active' : ''}" data-zoom="3" title="3x (960x600)">3x</button>
        <button class="ctrl-btn ${state.zoomLevel === 4 ? 'active' : ''}" data-zoom="4" title="4x (1280x800)">4x</button>
      </div>

      <button id="toggleCrtBtn" class="btn btn-secondary ${state.scanlinesActive ? 'active' : ''}" style="font-size: 0.78rem;">
        <span>📺 CRT Scanlines</span>
      </button>
    `;

    function applyCpsZoom(level, centerView = false) {
      state.zoomLevel = level;
      const img = document.getElementById('stageImg');
      const wrap = document.getElementById('imgWrap');
      if (!img || !wrap) return;

      el.interactiveControls.querySelectorAll('[data-zoom]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zoom === String(level));
      });

      if (level === 'fit') {
        wrap.style.width = '';
        wrap.style.height = '';
        img.style.width = '100%';
        img.style.maxWidth = 'min(100%, calc((100vh - 280px) * 1.6))';
        img.style.maxHeight = 'calc(100vh - 280px)';
        img.style.height = 'auto';
        img.style.aspectRatio = '320 / 200';
      } else {
        const mult = parseInt(level);
        const w = 320 * mult;
        const h = 200 * mult;
        wrap.style.width = `${w}px`;
        wrap.style.height = `${h}px`;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.aspectRatio = '320 / 200';
      }

      requestAnimationFrame(() => {
        if (centerView && level !== 'fit') {
          const stage = el.viewerStage;
          if (stage.scrollWidth > stage.clientWidth) {
            stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
          }
          if (stage.scrollHeight > stage.clientHeight) {
            stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
          }
        }
        updatePanSliders();
      });
    }

    // Zoom listeners
    el.interactiveControls.querySelectorAll('[data-zoom]').forEach(b => {
      b.addEventListener('click', (e) => {
        const targetZoom = e.target.dataset.zoom === 'fit' ? 'fit' : parseInt(e.target.dataset.zoom);
        applyCpsZoom(targetZoom, true);
      });
    });

    document.getElementById('toggleCrtBtn').addEventListener('click', (e) => {
      state.scanlinesActive = !state.scanlinesActive;
      e.target.classList.toggle('active', state.scanlinesActive);
      const wrap = document.getElementById('imgWrap');
      if (wrap) wrap.classList.toggle('crt-overlay', state.scanlinesActive);
    });

    // Add palette swatch strip if sample available
    if (details.palette_sample) {
      const palWrap = document.createElement('div');
      palWrap.className = 'palette-strip';
      details.palette_sample.forEach((rgb, idx) => {
        const swatch = document.createElement('div');
        swatch.className = 'pal-swatch';
        swatch.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        swatch.title = `Color ${idx}: #${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])} (R:${rgb[0]} G:${rgb[1]} B:${rgb[2]})`;
        palWrap.appendChild(swatch);
      });
      el.metaChips.appendChild(palWrap);
    }

    const stageImg = document.getElementById('stageImg');
    if (stageImg) {
      stageImg.onload = () => {
        updatePanSliders();
      };
    }

    // Apply active zoom sizing immediately
    applyCpsZoom(state.zoomLevel, false);
  }

  // 2. Model & Character Viewer (.SHP)
  function renderModelViewer(asset, details) {
    const numFrames = details.num_frames || 1;
    state.modelCurrentFrame = 0;
    state.modelPlaying = false;

    const baseName = asset.name.replace('.SHP', '');
    const exportFrameUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.modelCurrentFrame}`;
    const exportSheetUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&sheet=1`;

    el.viewerActions.innerHTML = `
      <a id="exportCurFrameBtn" href="${exportFrameUrl}" download="${baseName}_frame${state.modelCurrentFrame}.png" class="btn btn-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Export Current Frame</span>
      </a>
      <a href="${exportSheetUrl}" download="${baseName}_spritesheet.png" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        <span>Export Sprite Sheet (PNG)</span>
      </a>
    `;

    el.viewerStage.innerHTML = `
      <div class="image-viewport-wrap ${state.modelBackdrop}" id="modelWrap" style="padding: 30px; min-width: 240px; min-height: 240px;">
        <img id="modelImg" src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="display-canvas" style="transform: scale(2.5);" alt="${asset.name}">
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Frames: <strong id="frameIndicator">1 / ${numFrames}</strong></div>
      <div class="meta-chip">Max Frame Size: <strong>${details.max_width || 0}x${details.max_height || 0} px</strong></div>
      <div class="meta-chip">Format: <strong>Westwood Compact Shape</strong></div>
    `;

    el.interactiveControls.innerHTML = `
      <div class="player-controls-wrap">
        <button class="play-toggle-btn" id="modelPlayBtn" title="Play/Pause Animation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <button class="ctrl-btn" id="modelPrevBtn">⏮</button>
        <input type="range" class="scrubber-slider" id="modelScrubber" min="0" max="${numFrames - 1}" value="0">
        <button class="ctrl-btn" id="modelNextBtn">⏭</button>

        <select class="speed-select" id="modelSpeedSelect">
          <option value="4">4 FPS</option>
          <option value="8" selected>8 FPS</option>
          <option value="12">12 FPS</option>
          <option value="16">16 FPS</option>
          <option value="24">24 FPS</option>
        </select>

        <div class="ctrl-btn-group" title="Backdrop Style">
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-checker' ? 'active' : ''}" data-bg="bg-checker">Grid</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-dark' ? 'active' : ''}" data-bg="bg-dark">Dark</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-light' ? 'active' : ''}" data-bg="bg-light">Light</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-chroma' ? 'active' : ''}" data-bg="bg-chroma">Green</button>
        </div>
      </div>
    `;

    // Model controls setup
    const modelImg = document.getElementById('modelImg');
    const modelScrubber = document.getElementById('modelScrubber');
    const frameIndicator = document.getElementById('frameIndicator');
    const exportCurFrameBtn = document.getElementById('exportCurFrameBtn');

    // Preload model frames in memory
    const modelFrameCache = new Map();
    for (let i = 0; i < Math.min(numFrames, 64); i++) {
      const img = new Image();
      img.src = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${i}`;
      modelFrameCache.set(i, img);
    }

    function updateModelFrame(idx) {
      state.modelCurrentFrame = (idx + numFrames) % numFrames;
      const targetUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.modelCurrentFrame}`;
      if (modelFrameCache.has(state.modelCurrentFrame) && modelFrameCache.get(state.modelCurrentFrame).complete) {
        modelImg.src = modelFrameCache.get(state.modelCurrentFrame).src;
      } else {
        modelImg.src = targetUrl;
      }
      modelScrubber.value = state.modelCurrentFrame;
      frameIndicator.textContent = `${state.modelCurrentFrame + 1} / ${numFrames}`;
      exportCurFrameBtn.href = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.modelCurrentFrame}`;
      exportCurFrameBtn.download = `${baseName}_frame${state.modelCurrentFrame}.png`;
    }

    document.getElementById('modelPlayBtn').addEventListener('click', (e) => {
      state.modelPlaying = !state.modelPlaying;
      e.currentTarget.innerHTML = state.modelPlaying
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

      if (state.modelPlaying) {
        state.modelTimer = setInterval(() => {
          updateModelFrame(state.modelCurrentFrame + 1);
        }, 1000 / state.modelFps);
      } else {
        clearInterval(state.modelTimer);
      }
    });

    document.getElementById('modelPrevBtn').addEventListener('click', () => updateModelFrame(state.modelCurrentFrame - 1));
    document.getElementById('modelNextBtn').addEventListener('click', () => updateModelFrame(state.modelCurrentFrame + 1));
    modelScrubber.addEventListener('input', (e) => updateModelFrame(parseInt(e.target.value)));

    document.getElementById('modelSpeedSelect').addEventListener('change', (e) => {
      state.modelFps = parseInt(e.target.value);
      if (state.modelPlaying) {
        clearInterval(state.modelTimer);
        state.modelTimer = setInterval(() => {
          updateModelFrame(state.modelCurrentFrame + 1);
        }, 1000 / state.modelFps);
      }
    });

    // Backdrop selector
    el.interactiveControls.querySelectorAll('[data-bg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.modelBackdrop = e.target.dataset.bg;
        el.interactiveControls.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('modelWrap').className = `image-viewport-wrap ${state.modelBackdrop}`;
      });
    });
  }

  // 3. Animation Viewer (.WSA)
  function renderAnimationViewer(asset, details) {
    const numFrames = details.num_frames || 1;
    const width = details.width || 320;
    const height = details.height || 200;
    const sheetCols = details.sheet_cols || Math.min(numFrames, 8);
    state.animCurrentFrame = 0;
    state.animPlaying = false;

    const baseName = asset.name.replace('.WSA', '');
    const exportFrameUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.animCurrentFrame}`;
    const exportGifUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&gif=1`;
    const exportSheetUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&sheet=1`;

    el.viewerActions.innerHTML = `
      <a id="exportAnimFrameBtn" href="${exportFrameUrl}" download="${baseName}_frame0.png" class="btn btn-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Export Current Frame (PNG)</span>
      </a>
      <a href="${exportSheetUrl}" download="${baseName}_spritesheet.png" class="btn btn-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        <span>Export Sheet</span>
      </a>
      <a href="${exportGifUrl}" download="${baseName}.gif" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
        <span>Export Animated GIF</span>
      </a>
    `;

    el.viewerStage.innerHTML = `
      <div class="image-viewport-wrap bg-checker" id="animWrap" style="padding: 24px; margin: auto; min-width: 240px; min-height: 240px;">
        <canvas id="animCanvas" width="${width}" height="${height}" class="display-canvas" style="transform: scale(2); image-rendering: pixelated;" alt="${asset.name}"></canvas>
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Total Frames: <strong id="animFrameInd">1 / ${numFrames}</strong></div>
      <div class="meta-chip">Dimensions: <strong>${width}x${height} px</strong></div>
      <div class="meta-chip">Scene Offset: <strong>(${details.pos_x || 0}, ${details.pos_y || 0})</strong></div>
    `;

    el.interactiveControls.innerHTML = `
      <div class="player-controls-wrap">
        <button class="play-toggle-btn" id="animPlayBtn" title="Play Animation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <button class="ctrl-btn" id="animPrevBtn">⏮</button>
        <input type="range" class="scrubber-slider" id="animScrubber" min="0" max="${numFrames - 1}" value="0">
        <button class="ctrl-btn" id="animNextBtn">⏭</button>

        <select class="speed-select" id="animSpeedSelect">
          <option value="4">4 FPS</option>
          <option value="6">6 FPS</option>
          <option value="8">8 FPS</option>
          <option value="10" selected>10 FPS</option>
          <option value="12">12 FPS</option>
          <option value="16">16 FPS</option>
          <option value="24">24 FPS</option>
        </select>
      </div>
    `;

    const canvas = document.getElementById('animCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const animScrubber = document.getElementById('animScrubber');
    const animFrameInd = document.getElementById('animFrameInd');
    const exportAnimFrameBtn = document.getElementById('exportAnimFrameBtn');

    // Preload spritesheet for instant 60fps zero-network playback
    const sheetImg = new Image();
    let sheetReady = false;
    sheetImg.onload = () => {
      sheetReady = true;
      drawAnimFrame(state.animCurrentFrame);
    };
    sheetImg.src = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&sheet=1`;

    // Fallback single-frame cache
    const frameCache = new Map();
    function getFallbackFrame(idx, cb) {
      if (frameCache.has(idx)) {
        cb(frameCache.get(idx));
        return;
      }
      const img = new Image();
      img.onload = () => {
        frameCache.set(idx, img);
        cb(img);
      };
      img.src = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${idx}`;
    }

    // Initial render of frame 0
    getFallbackFrame(0, (img) => {
      if (!sheetReady && ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
    });

    function drawAnimFrame(idx) {
      state.animCurrentFrame = (idx + numFrames) % numFrames;
      animScrubber.value = state.animCurrentFrame;
      animFrameInd.textContent = `${state.animCurrentFrame + 1} / ${numFrames}`;
      exportAnimFrameBtn.href = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.animCurrentFrame}`;
      exportAnimFrameBtn.download = `${baseName}_frame${state.animCurrentFrame}.png`;

      if (!ctx) return;
      if (sheetReady) {
        const c = state.animCurrentFrame % sheetCols;
        const r = Math.floor(state.animCurrentFrame / sheetCols);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sheetImg, c * width, r * height, width, height, 0, 0, width, height);
      } else {
        getFallbackFrame(state.animCurrentFrame, (img) => {
          if (!sheetReady && ctx) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
        });
      }
    }

    function startAnimPlayback() {
      if (state.animTimer) clearInterval(state.animTimer);
      state.animTimer = setInterval(() => {
        drawAnimFrame(state.animCurrentFrame + 1);
      }, 1000 / state.animFps);
    }

    document.getElementById('animPlayBtn').addEventListener('click', (e) => {
      state.animPlaying = !state.animPlaying;
      e.currentTarget.innerHTML = state.animPlaying
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

      if (state.animPlaying) {
        startAnimPlayback();
      } else {
        clearInterval(state.animTimer);
      }
    });

    document.getElementById('animPrevBtn').addEventListener('click', () => drawAnimFrame(state.animCurrentFrame - 1));
    document.getElementById('animNextBtn').addEventListener('click', () => drawAnimFrame(state.animCurrentFrame + 1));
    animScrubber.addEventListener('input', (e) => drawAnimFrame(parseInt(e.target.value)));

    document.getElementById('animSpeedSelect').addEventListener('change', (e) => {
      state.animFps = parseInt(e.target.value);
      if (state.animPlaying) {
        startAnimPlayback();
      }
    });
  }

  // 4. MIDI Soundtrack Viewer (.XMI)
  async function renderMidiViewer(asset, details) {
    const baseName = asset.name.replace('.XMI', '');
    const midiUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;

    const meta = details.midi_meta || {};

    el.viewerActions.innerHTML = `
      <a href="${exportUrl}" download="${baseName}.mid" class="btn btn-primary glow-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <span>Export Standard MIDI (.mid)</span>
      </a>
    `;

    el.viewerStage.innerHTML = `
      <div class="audio-studio-wrap">
        <div class="audio-disc-visualizer" id="audioDisc">
          <div class="disc-grooves"></div>
          <div class="disc-center">🎵</div>
        </div>
        <canvas class="audio-bars-canvas" id="audioCanvas" width="500" height="90"></canvas>
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Total Notes: <strong>${meta.notes_count || 0}</strong></div>
      <div class="meta-chip">Channels Used: <strong>${(meta.channels_used || []).length} channels</strong></div>
      <div class="meta-chip">Est. Duration: <strong>${meta.estimated_seconds || 0}s</strong></div>
      <div class="meta-chip">PPQN: <strong>${meta.ppqn || 60}</strong></div>
    `;

    el.interactiveControls.innerHTML = `
      <div class="player-controls-wrap">
        <button class="play-toggle-btn" id="midiPlayBtn" title="Play/Stop MIDI">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <span id="midiTimeText" style="font-family: var(--font-mono); font-size: 0.8rem; min-width: 80px;">0:00 / 0:00</span>
        <input type="range" class="scrubber-slider" id="midiScrubber" min="0" max="100" value="0">
      </div>
    `;

    // Load MIDI arraybuffer into WebMidiPlayer
    try {
      const res = await fetch(midiUrl);
      const ab = await res.arrayBuffer();
      window.midiPlayer.loadMidi(ab);
    } catch (e) {
      console.error('Failed to load MIDI:', e);
    }

    const disc = document.getElementById('audioDisc');
    const playBtn = document.getElementById('midiPlayBtn');
    const timeText = document.getElementById('midiTimeText');
    const scrubber = document.getElementById('midiScrubber');
    const canvas = document.getElementById('audioCanvas');
    const ctx = canvas.getContext('2d');
    const freqData = new Uint8Array(32);

    window.midiPlayer.onProgress = (cur, dur) => {
      timeText.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
      scrubber.value = dur > 0 ? (cur / dur) * 100 : 0;
    };

    window.midiPlayer.onEnd = () => {
      disc.classList.remove('playing');
      playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    };

    playBtn.addEventListener('click', () => {
      if (window.midiPlayer.isPlaying) {
        window.midiPlayer.stop();
        disc.classList.remove('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      } else {
        window.midiPlayer.play();
        disc.classList.add('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        startVisualizer();
      }
    });

    scrubber.addEventListener('change', (e) => {
      const targetSec = (parseFloat(e.target.value) / 100) * window.midiPlayer.durationSec;
      window.midiPlayer.seek(targetSec);
    });

    function startVisualizer() {
      cancelAnimationFrame(state.audioVisualizerTimer);
      function draw() {
        if (!window.midiPlayer.isPlaying) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
        window.midiPlayer.getFrequencyData(freqData);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / freqData.length) - 2;
        for (let i = 0; i < freqData.length; i++) {
          const val = freqData[i] / 255.0;
          const barHeight = val * (canvas.height - 10);
          const hue = 160 + (i * 3);
          ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
          ctx.fillRect(i * (barWidth + 2), canvas.height - barHeight, barWidth, barHeight);
        }
        state.audioVisualizerTimer = requestAnimationFrame(draw);
      }
      draw();
    }
  }

  // 5. Voice & SFX Viewer (.VOC)
  function renderVocViewer(asset, details) {
    const baseName = asset.name.replace('.VOC', '');
    const wavUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;

    el.viewerActions.innerHTML = `
      <a href="${exportUrl}" download="${baseName}.wav" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Export WAV Audio</span>
      </a>
    `;

    el.viewerStage.innerHTML = `
      <div class="audio-studio-wrap">
        <div class="audio-disc-visualizer" style="border-color: var(--accent-rose);">
          <div class="disc-grooves"></div>
          <div class="disc-center" style="background: var(--accent-rose);">🔊</div>
        </div>
        <audio controls src="${wavUrl}" style="width: 100%; max-width: 400px; margin-top: 20px;"></audio>
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Format: <strong>Creative Voice (8-bit PCM)</strong></div>
      <div class="meta-chip">WAV Output Size: <strong>${formatBytes(details.wav_size || asset.size)}</strong></div>
    `;

    el.interactiveControls.innerHTML = '';
  }

  // 6. Palette Viewer (.COL / .PAL)
  function renderPaletteViewer(asset, details) {
    const baseName = asset.name.replace(/\.(COL|PAL)$/i, '');
    const exportPngUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=png`;
    const exportGplUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=gpl`;
    const exportPalUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=pal`;
    const exportRawUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=col`;

    // Action buttons in viewer header
    el.viewerActions.innerHTML = `
      <a href="${exportPngUrl}" download="${baseName}_palette.png" class="btn btn-primary glow-btn" title="Download 16x16 swatch PNG">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Export PNG Swatches</span>
      </a>
      <a href="${exportGplUrl}" download="${baseName}.gpl" class="btn btn-secondary" title="GIMP / Aseprite / Photoshop palette file">
        <span>Export GPL (Aseprite)</span>
      </a>
      <a href="${exportPalUrl}" download="${baseName}.pal" class="btn btn-secondary" title="JASC-PAL file">
        <span>Export JASC-PAL</span>
      </a>
      <a href="${exportRawUrl}" download="${asset.name}" class="btn btn-secondary" title="Download raw binary file">
        <span>Raw ${asset.ext}</span>
      </a>
    `;

    // Make sure colors array exists (256 items)
    let colors = details.colors || [];
    if (!colors || colors.length === 0) {
      colors = [];
      for (let i = 0; i < 256; i++) {
        colors.push({
          index: i,
          hex: `#${i.toString(16).padStart(2, '0').repeat(3)}`,
          r: i, g: i, b: i,
          dac_r: i >> 2, dac_g: i >> 2, dac_b: i >> 2,
        });
      }
    }

    // Build gradient string for the continuous spectrum bar
    const gradientStops = colors.filter((_, idx) => idx % 8 === 0 || idx === 255)
      .map(c => c.hex)
      .join(', ');

    // Selected color index
    let activeIdx = 0;

    // Render Stage HTML
    el.viewerStage.innerHTML = `
      <div class="palette-studio-wrap">
        <div class="palette-card-main">
          <div class="palette-grid-header">
            <div class="palette-grid-title">
              <span>🎨</span>
              <span>256 VGA Color Swatches (16×16)</span>
            </div>
            <span class="palette-grid-subtitle">Hover / click swatch to inspect & copy</span>
          </div>

          <div class="palette-grid ${state.paletteSwatchSize || 'size-md'}" id="paletteGrid">
            ${colors.map((c, i) => `
              <button class="palette-swatch ${i === activeIdx ? 'active' : ''}" 
                style="background-color: ${c.hex};" 
                data-index="${i}" 
                title="Index ${i} (${c.hex})"
                aria-label="Color ${i}: ${c.hex}"></button>
            `).join('')}
          </div>

          <div class="palette-spectrum-wrap">
            <span class="palette-spectrum-label">Color Ramp Spectrum</span>
            <div class="palette-spectrum-bar" style="background: linear-gradient(to right, ${gradientStops});"></div>
          </div>
        </div>

        <!-- Palette Inspector Panel -->
        <div class="palette-inspector">
          <div class="palette-inspector-title">Color Inspector</div>
          
          <div class="inspector-swatch-box" id="inspBox" style="background-color: ${colors[activeIdx].hex};">
            <span class="inspector-swatch-label" id="inspLabel">${colors[activeIdx].hex}</span>
          </div>

          <div class="inspector-data-list">
            <div class="inspector-data-row">
              <span class="inspector-key">Palette Index</span>
              <span class="inspector-val" id="inspIndex">#0 (0x00)</span>
            </div>
            <div class="inspector-data-row">
              <span class="inspector-key">Hex Color</span>
              <span class="inspector-val">
                <span id="inspHex">${colors[activeIdx].hex}</span>
                <button class="copy-mini-btn" id="copyHexBtn" title="Copy Hex Code">📋</button>
              </span>
            </div>
            <div class="inspector-data-row">
              <span class="inspector-key">RGB (8-bit)</span>
              <span class="inspector-val">
                <span id="inspRgb">rgb(${colors[activeIdx].r}, ${colors[activeIdx].g}, ${colors[activeIdx].b})</span>
                <button class="copy-mini-btn" id="copyRgbBtn" title="Copy RGB">📋</button>
              </span>
            </div>
            <div class="inspector-data-row">
              <span class="inspector-key">VGA DAC (6-bit)</span>
              <span class="inspector-val" id="inspDac">(${colors[activeIdx].dac_r}, ${colors[activeIdx].dac_g}, ${colors[activeIdx].dac_b})</span>
            </div>
          </div>

          <div class="contrast-test-box">
            <div class="contrast-pill" id="inspContrastDark" style="background-color: ${colors[activeIdx].hex}; color: #000;">Dark Text</div>
            <div class="contrast-pill" id="inspContrastLight" style="background-color: ${colors[activeIdx].hex}; color: #fff;">Light Text</div>
          </div>

          <button class="btn btn-secondary" id="copyCssVarsBtn" style="width: 100%; font-size: 0.78rem;">
            <span>📋 Copy 256 CSS Variables</span>
          </button>
        </div>
      </div>
    `;

    // Metadata chips
    el.metaChips.innerHTML = `
      <div class="meta-chip">Total Colors: <strong>256 VGA Colors</strong></div>
      <div class="meta-chip">DAC Bit Depth: <strong>6-bit DAC (0-63) → 8-bit RGB</strong></div>
      <div class="meta-chip">Compression: <strong>${details.compression || 'Format 80 (LCW)'}</strong></div>
      <div class="meta-chip">File Size: <strong>${formatBytes(asset.size)}</strong></div>
      <div class="meta-chip">Archive: <strong>${asset.pak_name}</strong></div>
    `;

    // Interactive controls: Swatch size buttons
    el.interactiveControls.innerHTML = `
      <div class="ctrl-btn-group" title="Swatch Size">
        <button class="ctrl-btn ${state.paletteSwatchSize === 'size-sm' ? 'active' : ''}" data-size="size-sm">Small</button>
        <button class="ctrl-btn ${(!state.paletteSwatchSize || state.paletteSwatchSize === 'size-md') ? 'active' : ''}" data-size="size-md">Medium</button>
        <button class="ctrl-btn ${state.paletteSwatchSize === 'size-lg' ? 'active' : ''}" data-size="size-lg">Large</button>
      </div>
    `;

    // Interactive sizing listeners
    el.interactiveControls.querySelectorAll('.ctrl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.interactiveControls.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.paletteSwatchSize = btn.dataset.size;
        const grid = document.getElementById('paletteGrid');
        if (grid) {
          grid.className = `palette-grid ${state.paletteSwatchSize}`;
        }
      });
    });

    // Inspector Updater Function
    function updateInspector(idx) {
      activeIdx = idx;
      const c = colors[idx];
      if (!c) return;

      const inspBox = document.getElementById('inspBox');
      const inspLabel = document.getElementById('inspLabel');
      const inspIndex = document.getElementById('inspIndex');
      const inspHex = document.getElementById('inspHex');
      const inspRgb = document.getElementById('inspRgb');
      const inspDac = document.getElementById('inspDac');
      const inspContrastDark = document.getElementById('inspContrastDark');
      const inspContrastLight = document.getElementById('inspContrastLight');

      if (inspBox) inspBox.style.backgroundColor = c.hex;
      if (inspLabel) inspLabel.textContent = c.hex;
      if (inspIndex) inspIndex.textContent = `#${c.index} (0x${c.index.toString(16).toUpperCase().padStart(2, '0')})`;
      if (inspHex) inspHex.textContent = c.hex;
      if (inspRgb) inspRgb.textContent = `rgb(${c.r}, ${c.g}, ${c.b})`;
      if (inspDac) inspDac.textContent = `(${c.dac_r}, ${c.dac_g}, ${c.dac_b})`;
      if (inspContrastDark) inspContrastDark.style.backgroundColor = c.hex;
      if (inspContrastLight) inspContrastLight.style.backgroundColor = c.hex;

      // Update active swatch highlight
      const grid = document.getElementById('paletteGrid');
      if (grid) {
        grid.querySelectorAll('.palette-swatch').forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.index, 10) === idx);
        });
      }
    }

    // Grid swatch event listeners
    const grid = document.getElementById('paletteGrid');
    if (grid) {
      grid.addEventListener('mouseover', (e) => {
        const swatch = e.target.closest('.palette-swatch');
        if (!swatch) return;
        const idx = parseInt(swatch.dataset.index, 10);
        updateInspector(idx);
      });

      grid.addEventListener('click', (e) => {
        const swatch = e.target.closest('.palette-swatch');
        if (!swatch) return;
        const idx = parseInt(swatch.dataset.index, 10);
        updateInspector(idx);
      });
    }

    // Copy Hex button
    const copyHexBtn = document.getElementById('copyHexBtn');
    if (copyHexBtn) {
      copyHexBtn.addEventListener('click', () => {
        const hex = colors[activeIdx].hex;
        navigator.clipboard.writeText(hex).then(() => {
          copyHexBtn.textContent = '✓';
          copyHexBtn.classList.add('copied');
          setTimeout(() => {
            copyHexBtn.textContent = '📋';
            copyHexBtn.classList.remove('copied');
          }, 1200);
        });
      });
    }

    // Copy RGB button
    const copyRgbBtn = document.getElementById('copyRgbBtn');
    if (copyRgbBtn) {
      copyRgbBtn.addEventListener('click', () => {
        const rgb = `rgb(${colors[activeIdx].r}, ${colors[activeIdx].g}, ${colors[activeIdx].b})`;
        navigator.clipboard.writeText(rgb).then(() => {
          copyRgbBtn.textContent = '✓';
          copyRgbBtn.classList.add('copied');
          setTimeout(() => {
            copyRgbBtn.textContent = '📋';
            copyRgbBtn.classList.remove('copied');
          }, 1200);
        });
      });
    }

    // Copy 256 CSS variables
    const copyCssVarsBtn = document.getElementById('copyCssVarsBtn');
    if (copyCssVarsBtn) {
      copyCssVarsBtn.addEventListener('click', () => {
        const cssLines = [':root {'];
        colors.forEach(c => {
          cssLines.push(`  --k2-pal-${c.index}: ${c.hex}; /* rgb(${c.r}, ${c.g}, ${c.b}) */`);
        });
        cssLines.push('}');
        const text = cssLines.join('\n');
        navigator.clipboard.writeText(text).then(() => {
          const original = copyCssVarsBtn.innerHTML;
          copyCssVarsBtn.innerHTML = '<span>✓ Copied 256 CSS Variables!</span>';
          setTimeout(() => {
            copyCssVarsBtn.innerHTML = original;
          }, 2000);
        });
      });
    }
  }

  // 6. Script & Dialogue Viewer (.EMC, .FMC, .GMC, .DLE, .DLF, .DLG, .ENG, .FRE, .GER)
  function renderScriptViewer(asset, details) {
    const script = details.script_data || {};
    const lang = script.language_name || details.language_name || 'English';
    const flag = script.flag || details.flag || '🇬🇧';
    const category = script.category || 'dialogue'; // 'dialogue', 'subtitles', 'strings'
    const format = script.format || 'SCRIPT'; // 'DLE', 'EMC', 'TABLE', 'DOCUMENT'
    const lines = script.lines || [];
    const scenes = script.scenes || [];
    const transcript = script.transcript || '';
    const baseName = asset.name.replace(/\.[^/.]+$/, "");
    const exportTxtUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=txt`;
    const exportRawUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&format=raw`;

    // Actions Header
    el.viewerActions.innerHTML = `
      <button id="copyScriptTranscriptBtn" class="btn btn-secondary glow-btn" title="Copy entire plain text transcript to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy Plain Text</span>
      </button>
      <a href="${exportTxtUrl}" download="${baseName}_${asset.ext.replace('.', '')}.txt" class="btn btn-primary glow-btn" title="Download formatted plain text transcript">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Export TXT</span>
      </a>
      <a href="${exportRawUrl}" download="${asset.name}" class="btn btn-secondary" title="Download original game binary">
        <span>Download Original</span>
      </a>
    `;

    // Setup Copy button listener
    const copyBtn = document.getElementById('copyScriptTranscriptBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(transcript).then(() => {
          const original = copyBtn.innerHTML;
          copyBtn.innerHTML = `<span>✓ Copied ${lines.length} Lines!</span>`;
          copyBtn.classList.add('btn-primary');
          copyBtn.classList.remove('btn-secondary');
          setTimeout(() => {
            copyBtn.innerHTML = original;
            copyBtn.classList.remove('btn-primary');
            copyBtn.classList.add('btn-secondary');
          }, 1800);
        });
      });
    }

    // Metadata Chips
    const badgeClass = `badge-${script.language || 'en'}`;
    el.metaChips.innerHTML = `
      <div class="meta-chip">
        <span class="lang-chip ${badgeClass}">${flag} ${lang}</span>
      </div>
      <div class="meta-chip">Type: <strong>${script.category_label || script.doc_type || format}</strong></div>
      <div class="meta-chip">Total Lines: <strong>${(script.total_lines || lines.length).toLocaleString()}</strong></div>
      ${scenes.length > 0 ? `<div class="meta-chip">Scenes: <strong>${scenes.length}</strong></div>` : ''}
      <div class="meta-chip">Archive: <strong>${asset.pak_name}</strong></div>
      <div class="meta-chip">File Size: <strong>${formatBytes(asset.size)}</strong></div>
    `;

    // Interactive Controls
    el.interactiveControls.innerHTML = '';

    // Stage Structure
    el.viewerStage.innerHTML = `
      <div class="script-viewer-stage">
        <div class="script-toolbar">
          <div class="script-toolbar-left">
            <div class="script-search-wrap">
              <svg class="script-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="scriptSearchFilter" class="script-search-input" placeholder="Search spoken lines, items, or actors..." autocomplete="off">
            </div>
            <span class="script-line-counter" id="scriptMatchCounter">Showing ${lines.length} lines</span>
          </div>

          <div class="script-toolbar-right" id="scriptScenePills"></div>
        </div>

        <div class="script-scroll-area" id="scriptContentArea">
          <!-- Injected dynamic script content -->
        </div>
      </div>
    `;

    const searchInput = document.getElementById('scriptSearchFilter');
    const matchCounter = document.getElementById('scriptMatchCounter');
    const contentArea = document.getElementById('scriptContentArea');
    const scenePills = document.getElementById('scriptScenePills');

    let currentSceneFilter = 'all';

    // Renders the body based on format and search query
    function renderScriptContent(query = '') {
      const q = query.trim().toLowerCase();

      // 1. Dialogue Script (.DLE, .DLF, .DLG)
      if (format === 'DLE' || category === 'dialogue') {
        let matchedLineCount = 0;
        let html = '';

        scenes.forEach((sc, idx) => {
          if (currentSceneFilter !== 'all' && currentSceneFilter !== String(sc.scene_index)) {
            return;
          }

          const filteredLines = sc.lines.filter(l => {
            if (!q) return true;
            return l.text.toLowerCase().includes(q) || l.actor_name.toLowerCase().includes(q);
          });

          if (filteredLines.length === 0) return;
          matchedLineCount += filteredLines.length;

          html += `
            <div class="dialogue-scene-card" id="sceneCard_${sc.scene_index}">
              <div class="scene-header-strip">
                <div class="scene-tag">
                  <span>🎬 Scene ${sc.scene_index}</span>
                </div>
                <span class="scene-stats">${filteredLines.length} spoken dialogue lines</span>
              </div>
              <div class="dialogue-bubbles-list">
          `;

          filteredLines.forEach(line => {
            let avatarClass = 'actor-avatar-default';
            let avatarEmoji = '💬';
            let bubbleCustom = '';

            if (line.actor_id === 12) {
              avatarClass = 'actor-avatar-zanthia';
              avatarEmoji = '🧙‍♀️';
              bubbleCustom = 'zanthia-bubble';
            } else if (line.actor_id === 13) {
              avatarClass = 'actor-avatar-faun';
              avatarEmoji = '🐐';
              bubbleCustom = 'faun-bubble';
            } else if (line.actor_id === 10 || line.actor_id === 11) {
              avatarClass = 'actor-avatar-marko';
              avatarEmoji = '👦';
              bubbleCustom = 'marko-bubble';
            } else if (line.actor_id === 14) {
              avatarEmoji = '⚓';
            } else if (line.actor_id === 16) {
              avatarEmoji = '🎣';
            } else if (line.actor_id === 20) {
              avatarEmoji = '🐀';
            } else if (line.actor_id === 50) {
              avatarEmoji = '✋';
            }

            // Highlight matches
            let displayText = line.text;
            if (q && displayText.toLowerCase().includes(q)) {
              const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              displayText = displayText.replace(regex, '<mark>$1</mark>');
            }

            html += `
              <div class="dialogue-bubble-row">
                <div class="actor-avatar-badge ${avatarClass}" title="${line.actor_name} (ID: ${line.actor_id})">
                  ${avatarEmoji}
                </div>
                <div class="bubble-content-wrap ${bubbleCustom}">
                  <div class="bubble-meta-header">
                    <span class="bubble-speaker-name">${line.actor_name}</span>
                    <span class="bubble-seq-id">#${line.seq_id}</span>
                  </div>
                  <div class="bubble-line-text">${displayText}</div>
                </div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });

        if (matchedLineCount === 0) {
          contentArea.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No dialogue matches "${query}"</h3>
              <p>Try searching for a different character name or spoken keyword.</p>
            </div>
          `;
        } else {
          contentArea.innerHTML = html;
        }

        if (matchCounter) {
          matchCounter.textContent = q ? `Matched ${matchedLineCount} lines` : `Showing ${lines.length} lines across ${scenes.length} scenes`;
        }
      }

      // 2. Subtitles (.EMC, .FMC, .GMC)
      else if (format === 'EMC' || category === 'subtitles') {
        const filtered = lines.filter(l => !q || l.text.toLowerCase().includes(q));
        if (filtered.length === 0) {
          contentArea.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No subtitles match "${query}"</h3>
            </div>
          `;
        } else {
          let html = `<div class="subtitles-table">`;
          filtered.forEach(l => {
            let txt = l.text;
            if (q && txt.toLowerCase().includes(q)) {
              const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              txt = txt.replace(regex, '<mark>$1</mark>');
            }
            html += `
              <div class="subtitle-item-row">
                <span class="subtitle-id-chip">[${String(l.index).padStart(3, '0')}]</span>
                <span class="subtitle-text-content">${txt || '<em style="color:var(--text-muted);">(empty)</em>'}</span>
              </div>
            `;
          });
          html += `</div>`;
          contentArea.innerHTML = html;
        }

        if (matchCounter) {
          matchCounter.textContent = q ? `Matched ${filtered.length} subtitles` : `Showing ${lines.length} subtitles`;
        }
      }

      // 3. Document (PAGE*, LETTER*)
      else if (format === 'DOCUMENT') {
        let docText = transcript;
        if (q && docText.toLowerCase().includes(q)) {
          const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          docText = docText.replace(regex, '<mark>$1</mark>');
        }
        contentArea.innerHTML = `
          <div class="parchment-container">
            <div class="parchment-card">
              <div class="parchment-doc-title">${script.doc_type || 'In-Game Document'} • ${asset.name}</div>
              <div class="parchment-content-text">${docText}</div>
            </div>
          </div>
        `;
        if (matchCounter) {
          matchCounter.textContent = `${lines.length} lines • ${lang}`;
        }
      }

      // 4. String Tables (CH*, OPTIONS, C_CODE, LIB_MSG)
      else {
        const filtered = lines.filter(l => !q || l.text.toLowerCase().includes(q));
        if (filtered.length === 0) {
          contentArea.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No items match "${query}"</h3>
            </div>
          `;
        } else {
          let html = `<div class="strings-grid">`;
          filtered.forEach(l => {
            let txt = l.text;
            if (q && txt.toLowerCase().includes(q)) {
              const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              txt = txt.replace(regex, '<mark>$1</mark>');
            }
            html += `
              <div class="string-card-item" title="Click to copy text" data-copy="${l.text}">
                <span class="string-card-idx">[${String(l.index).padStart(3, '0')}]</span>
                <span class="string-card-val">${txt || '<em style="color:var(--text-muted);">(empty)</em>'}</span>
              </div>
            `;
          });
          html += `</div>`;
          contentArea.innerHTML = html;

          // Add click-to-copy on string cards
          contentArea.querySelectorAll('.string-card-item').forEach(card => {
            card.addEventListener('click', () => {
              const textToCopy = card.dataset.copy;
              if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                  card.style.borderColor = 'var(--accent-emerald)';
                  setTimeout(() => card.style.borderColor = '', 800);
                });
              }
            });
          });
        }

        if (matchCounter) {
          matchCounter.textContent = q ? `Matched ${filtered.length} entries` : `Showing ${lines.length} entries (${script.doc_type || 'String Table'})`;
        }
      }
    }

    // Render Scene Pills if dialogue
    if (scenes.length > 1) {
      scenePills.innerHTML = `
        <button class="script-view-tab-btn ${currentSceneFilter === 'all' ? 'active' : ''}" data-scene="all">All Scenes (${scenes.length})</button>
      `;
      // Show first 6 scenes as direct buttons
      scenes.slice(0, 6).forEach(sc => {
        scenePills.innerHTML += `
          <button class="script-view-tab-btn" data-scene="${sc.scene_index}">S${sc.scene_index}</button>
        `;
      });
      if (scenes.length > 6) {
        scenePills.innerHTML += `
          <select id="moreScenesSelect" class="sort-select" style="font-size:0.75rem; padding: 4px 8px;">
            <option value="">More scenes...</option>
            ${scenes.slice(6).map(sc => `<option value="${sc.scene_index}">Scene ${sc.scene_index} (${sc.line_count} lines)</option>`).join('')}
          </select>
        `;
      }

      scenePills.addEventListener('click', (e) => {
        const btn = e.target.closest('.script-view-tab-btn');
        if (!btn) return;
        scenePills.querySelectorAll('.script-view-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSceneFilter = btn.dataset.scene;
        renderScriptContent(searchInput ? searchInput.value : '');
      });

      const moreSelect = document.getElementById('moreScenesSelect');
      if (moreSelect) {
        moreSelect.addEventListener('change', (e) => {
          if (!e.target.value) return;
          scenePills.querySelectorAll('.script-view-tab-btn').forEach(b => b.classList.remove('active'));
          currentSceneFilter = e.target.value;
          renderScriptContent(searchInput ? searchInput.value : '');
        });
      }
    }

    // Search filter input listener
    if (searchInput) {
      let filterTimeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
          renderScriptContent(e.target.value);
        }, 120);
      });
    }

    // Initial render
    renderScriptContent();
  }

  // 7. Westwood Engine Asset Inspector
  function renderRawViewer(asset, details) {
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    const typeInfo = details.file_type_info || {};
    const rawMeta = details.raw_inspection || {};

    el.viewerActions.innerHTML = `
      <a href="${exportUrl}" download="${asset.name}" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download File (${formatBytes(asset.size)})</span>
      </a>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Type: <strong>${typeInfo.name || asset.ext}</strong></div>
      <div class="meta-chip">Archive: <strong>${asset.pak_name}</strong></div>
      <div class="meta-chip">Size: <strong>${formatBytes(asset.size)}</strong></div>
      <div class="meta-chip">Offset: <strong>0x${asset.offset.toString(16).toUpperCase()}</strong></div>
    `;

    // Build spec cards
    let specCardsHtml = `
      <div class="inspector-card">
        <span class="inspector-card-label">Archive Origin</span>
        <span class="inspector-card-val">${asset.pak_name}</span>
        <span class="inspector-card-sub">Offset: 0x${asset.offset.toString(16).toUpperCase()}</span>
      </div>
      <div class="inspector-card">
        <span class="inspector-card-label">Byte Size</span>
        <span class="inspector-card-val">${formatBytes(asset.size)}</span>
        <span class="inspector-card-sub">${asset.size.toLocaleString()} bytes exact</span>
      </div>
    `;

    if (rawMeta.container) {
      specCardsHtml += `
        <div class="inspector-card">
          <span class="inspector-card-label">Container Format</span>
          <span class="inspector-card-val">${rawMeta.container}</span>
          <span class="inspector-card-sub">${rawMeta.form_type ? `Form ID: ${rawMeta.form_type}` : 'IFF Resource'}</span>
        </div>
      `;
    }

    if (rawMeta.compression_type) {
      specCardsHtml += `
        <div class="inspector-card">
          <span class="inspector-card-label">Compression</span>
          <span class="inspector-card-val">${rawMeta.compression_type}</span>
          <span class="inspector-card-sub">Uncompressed: ${formatBytes(rawMeta.decompressed_size || 0)} (${rawMeta.compression_ratio || ''})</span>
        </div>
      `;
    }

    if (rawMeta.mask_resolution) {
      specCardsHtml += `
        <div class="inspector-card">
          <span class="inspector-card-label">Mask Resolution</span>
          <span class="inspector-card-val">${rawMeta.mask_resolution}</span>
          <span class="inspector-card-sub">Action/Hotspot Collision Grid</span>
        </div>
      `;
    }

    if (rawMeta.timeline_opcodes_count !== undefined) {
      specCardsHtml += `
        <div class="inspector-card">
          <span class="inspector-card-label">Timeline Sequence</span>
          <span class="inspector-card-val">${rawMeta.timeline_opcodes_count} Opcodes</span>
          <span class="inspector-card-sub">Audio/Visual Animation Keyframes</span>
        </div>
      `;
    }

    if (rawMeta.copyright) {
      specCardsHtml += `
        <div class="inspector-card">
          <span class="inspector-card-label">Driver Signature</span>
          <span class="inspector-card-val" style="font-size:0.88rem;">${rawMeta.copyright}</span>
          <span class="inspector-card-sub">Miles Sound System Driver</span>
        </div>
      `;
    }

    // Format chunks list if IFF
    let chunksHtml = '';
    if (rawMeta.chunks && rawMeta.chunks.length > 0) {
      const pills = rawMeta.chunks.map(c => `
        <span class="chunk-badge-pill">
          <span>${c.id}</span>
          <span class="chunk-badge-size">${formatBytes(c.size)}</span>
        </span>
      `).join('');
      chunksHtml = `
        <div class="inspector-card" style="grid-column: 1 / -1;">
          <span class="inspector-card-label">IFF Resource Chunks (${rawMeta.chunks.length})</span>
          <div class="chunk-badges-wrap">${pills}</div>
        </div>
      `;
    }

    // Format Hex / ASCII dump
    let hexDumpRows = '';
    if (rawMeta.hex_preview && rawMeta.ascii_preview) {
      const hex = rawMeta.hex_preview;
      const asc = rawMeta.ascii_preview;
      const bytesPerLine = 16;
      for (let i = 0; i < asc.length; i += bytesPerLine) {
        const offsetHex = i.toString(16).padStart(4, '0').toUpperCase();
        const hexSub = hex.slice(i * 2, (i + bytesPerLine) * 2);
        const bytePairs = [];
        for (let j = 0; j < hexSub.length; j += 2) {
          bytePairs.push(hexSub.substr(j, 2).toUpperCase());
        }
        const hexFormatted = bytePairs.join(' ').padEnd(48, ' ');
        const asciiSub = asc.slice(i, i + bytesPerLine);
        hexDumpRows += `<span class="addr">${offsetHex}:</span>  <span class="bytes">${hexFormatted}</span>  <span class="ascii">${escapeHtml(asciiSub)}</span>\n`;
      }
    }

    el.viewerStage.innerHTML = `
      <div class="inspector-stage">
        <div class="inspector-hero">
          <div class="inspector-hero-icon">${details.type_icon || '📁'}</div>
          <div class="inspector-hero-info">
            <span class="inspector-hero-subtitle">${details.type_name || asset.ext + ' Asset'}</span>
            <h2 class="inspector-hero-title">${asset.name}</h2>
            <p class="inspector-hero-desc">${details.description || 'Westwood Studios proprietary game file.'}</p>
          </div>
        </div>

        <div class="inspector-grid">
          ${specCardsHtml}
          ${chunksHtml}
        </div>

        ${hexDumpRows ? `
          <div class="hex-terminal">
            <div class="hex-terminal-header">
              <span class="hex-terminal-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                Binary Header Inspection (First ${rawMeta.ascii_preview ? rawMeta.ascii_preview.length : 256} Bytes)
              </span>
              <button class="btn btn-sm btn-secondary" id="copyHexBtn" title="Copy raw hex stream">Copy Hex</button>
            </div>
            <pre class="hex-dump-code">${hexDumpRows}</pre>
          </div>
        ` : ''}
      </div>
    `;

    const copyBtn = document.getElementById('copyHexBtn');
    if (copyBtn && rawMeta.hex_preview) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(rawMeta.hex_preview).then(() => {
          showNotification('Hex stream copied to clipboard!');
        });
      });
    }

    el.interactiveControls.innerHTML = '';
  }

  function renderEmptyViewer() {
    el.selectedAssetType.textContent = 'None';
    el.selectedAssetName.textContent = 'No asset selected';
    el.selectedAssetPak.textContent = '';
    el.viewerActions.innerHTML = '';
    el.viewerStage.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <h3>No Assets Available</h3>
        <p>Ensure the game directory is correctly pointed to Kyrandia 2 files.</p>
      </div>
    `;
    el.metaChips.innerHTML = '';
    el.interactiveControls.innerHTML = '';
  }

  function stopAllPlayback() {
    if (window.midiPlayer && window.midiPlayer.isPlaying) {
      window.midiPlayer.stop();
    }
    clearInterval(state.modelTimer);
    state.modelPlaying = false;
    clearInterval(state.animTimer);
    state.animPlaying = false;
    cancelAnimationFrame(state.audioVisualizerTimer);

    if (el.panSlidersBar) {
      el.panSlidersBar.style.display = 'none';
    }
    if (el.viewerStage) {
      el.viewerStage.classList.remove('can-pan');
    }
  }

  // Pan Sliders & Viewport Navigation
  function setupPanSliders() {
    const stage = el.viewerStage;
    if (!stage || !el.panSlidersBar) return;

    // Horizontal range input
    el.panXSlider.addEventListener('input', (e) => {
      const maxX = stage.scrollWidth - stage.clientWidth;
      if (maxX > 0) {
        stage.scrollLeft = (parseFloat(e.target.value) / 100) * maxX;
      }
    });

    // Vertical range input
    el.panYSlider.addEventListener('input', (e) => {
      const maxY = stage.scrollHeight - stage.clientHeight;
      if (maxY > 0) {
        stage.scrollTop = (parseFloat(e.target.value) / 100) * maxY;
      }
    });

    // Edge navigation buttons
    el.panLeftBtn.addEventListener('click', () => {
      stage.scrollTo({ left: 0, behavior: 'smooth' });
    });
    el.panRightBtn.addEventListener('click', () => {
      stage.scrollTo({ left: stage.scrollWidth - stage.clientWidth, behavior: 'smooth' });
    });
    el.panTopBtn.addEventListener('click', () => {
      stage.scrollTo({ top: 0, behavior: 'smooth' });
    });
    el.panBottomBtn.addEventListener('click', () => {
      stage.scrollTo({ top: stage.scrollHeight - stage.clientHeight, behavior: 'smooth' });
    });
    el.panCenterBtn.addEventListener('click', () => {
      stage.scrollTo({
        left: Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2),
        top: Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2),
        behavior: 'smooth'
      });
    });

    // Sync sliders on stage scroll
    stage.addEventListener('scroll', () => {
      if (el.panSlidersBar.style.display === 'none') return;
      const maxX = stage.scrollWidth - stage.clientWidth;
      const maxY = stage.scrollHeight - stage.clientHeight;
      if (maxX > 0 && document.activeElement !== el.panXSlider) {
        el.panXSlider.value = Math.round((stage.scrollLeft / maxX) * 100);
      }
      if (maxY > 0 && document.activeElement !== el.panYSlider) {
        el.panYSlider.value = Math.round((stage.scrollTop / maxY) * 100);
      }
    });

    window.addEventListener('resize', () => {
      if (state.selectedAsset && state.selectedAsset.ext === '.CPS') {
        updatePanSliders();
      }
    });
  }

  function updatePanSliders() {
    const stage = el.viewerStage;
    if (!stage || !el.panSlidersBar) return;
    if (!state.selectedAsset || state.selectedAsset.ext !== '.CPS') {
      el.panSlidersBar.style.display = 'none';
      stage.classList.remove('can-pan');
      return;
    }

    requestAnimationFrame(() => {
      const maxX = stage.scrollWidth - stage.clientWidth;
      const maxY = stage.scrollHeight - stage.clientHeight;
      const hasOverflowX = maxX > 6;
      const hasOverflowY = maxY > 6;
      const hasOverflow = hasOverflowX || hasOverflowY;

      if (hasOverflow) {
        el.panSlidersBar.style.display = 'block';
        const panXGroup = document.getElementById('panXGroup');
        const panYGroup = document.getElementById('panYGroup');
        if (panXGroup) panXGroup.style.display = hasOverflowX ? 'flex' : 'none';
        if (panYGroup) panYGroup.style.display = hasOverflowY ? 'flex' : 'none';

        if (hasOverflowX) {
          el.panXSlider.value = maxX > 0 ? Math.round((stage.scrollLeft / maxX) * 100) : 0;
        }
        if (hasOverflowY) {
          el.panYSlider.value = maxY > 0 ? Math.round((stage.scrollTop / maxY) * 100) : 0;
        }
        stage.classList.add('can-pan');
      } else {
        el.panSlidersBar.style.display = 'none';
        stage.classList.remove('can-pan');
      }
    });
  }

  function setupDragToPan() {
    const stage = el.viewerStage;
    if (!stage) return;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    stage.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, select, a')) return;
      const maxX = stage.scrollWidth - stage.clientWidth;
      const maxY = stage.scrollHeight - stage.clientHeight;
      if (maxX <= 6 && maxY <= 6) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = stage.scrollLeft;
      startScrollTop = stage.scrollTop;
      stage.classList.add('is-panning');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      stage.scrollLeft = startScrollLeft - dx;
      stage.scrollTop = startScrollTop - dy;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        stage.classList.remove('is-panning');
      }
    });
  }

  // Batch Export Operations
  async function startBatchExport() {
    const checkedOpt = document.querySelector('input[name="batchType"]:checked');
    const exportType = checkedOpt ? checkedOpt.value : 'all';
    const destDir = el.exportFolderInput.value.trim() || 'exported_assets';

    el.startBatchExportBtn.disabled = true;
    el.exportProgressWrap.style.display = 'flex';
    el.exportProgressBar.style.width = '0%';
    el.exportProgressText.textContent = 'Starting export...';
    el.exportCurrentItem.textContent = '';

    try {
      const res = await fetch('/api/batch_export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: exportType, dest_dir: destDir }),
      });
      const data = await res.json();
      pollBatchProgress();
    } catch (err) {
      alert(`Export request failed: ${err.message}`);
      el.startBatchExportBtn.disabled = false;
    }
  }

  function pollBatchProgress() {
    clearInterval(state.batchPollTimer);
    state.batchPollTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/batch_status');
        const data = await res.json();

        if (data.status === 'running') {
          el.exportProgressBar.style.width = `${data.progress}%`;
          el.exportProgressText.textContent = `${data.processed_items} / ${data.total_items} (${data.progress}%)`;
          el.exportCurrentItem.textContent = data.current_item || 'Exporting...';
        } else if (data.status === 'completed') {
          clearInterval(state.batchPollTimer);
          el.exportProgressBar.style.width = '100%';
          el.exportProgressText.textContent = `Completed! ${data.extracted_count} files exported.`;
          el.exportCurrentItem.textContent = `Saved to: ${data.dest_dir}`;
          el.startBatchExportBtn.disabled = false;
        } else if (data.status === 'error') {
          clearInterval(state.batchPollTimer);
          el.exportProgressText.textContent = `Error: ${data.error_message}`;
          el.startBatchExportBtn.disabled = false;
        }
      } catch (e) {
        clearInterval(state.batchPollTimer);
        el.startBatchExportBtn.disabled = false;
      }
    }, 400);
  }

  async function checkBatchStatus() {
    try {
      const res = await fetch('/api/batch_status');
      const data = await res.json();
      if (data && data.status === 'running') {
        el.exportProgressWrap.style.display = 'flex';
        pollBatchProgress();
      }
    } catch (e) {}
  }

  // Directory Save
  async function saveDirectory() {
    const dir = el.dirInput.value.trim();
    if (!dir) return;

    el.saveDirBtn.disabled = true;
    el.dirStatusMsg.className = 'status-box';
    el.dirStatusMsg.style.display = 'block';
    el.dirStatusMsg.textContent = 'Scanning directory...';

    try {
      const res = await fetch('/api/set_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: dir }),
      });
      const data = await res.json();
      if (data.success) {
        el.dirStatusMsg.className = 'status-box success';
        el.dirStatusMsg.textContent = `Success! Found ${data.total_paks} PAKs and ${data.total_assets} assets.`;
        setTimeout(() => {
          el.dirModal.style.display = 'none';
          el.saveDirBtn.disabled = false;
          loadStatus();
          loadAssets();
        }, 1000);
      } else {
        el.dirStatusMsg.className = 'status-box error';
        el.dirStatusMsg.textContent = data.error || 'Failed to load directory.';
        el.saveDirBtn.disabled = false;
      }
    } catch (err) {
      el.dirStatusMsg.className = 'status-box error';
      el.dirStatusMsg.textContent = `Error: ${err.message}`;
      el.saveDirBtn.disabled = false;
    }
  }

  // Helpers
  function getZoomStyle() {
    if (state.zoomLevel === 'fit') return 'scale(1.0)';
    return `scale(${state.zoomLevel})`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function toHex(n) {
    const h = n.toString(16);
    return h.length === 1 ? '0' + h : h;
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
