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
    },
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
      updateSortControlsUI();
      loadAssets();
    });

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

      if (asset.ext === '.CPS') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.SHP') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.WSA') {
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.XMI') {
        thumbHtml = `<span class="asset-placeholder-icon">🎵</span>`;
      } else if (asset.ext === '.VOC') {
        thumbHtml = `<span class="asset-placeholder-icon">🔊</span>`;
      } else {
        thumbHtml = `<span class="asset-placeholder-icon">📄</span>`;
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
    if (asset.ext === '.CPS') {
      renderBackgroundViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.SHP') {
      renderModelViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.WSA') {
      renderAnimationViewer(asset, state.selectedDetails);
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

  // 6. Raw File Fallback
  function renderRawViewer(asset, details) {
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    el.viewerActions.innerHTML = `
      <a href="${exportUrl}" download="${asset.name}" class="btn btn-primary">
        <span>Download Raw File</span>
      </a>
    `;
    el.viewerStage.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>${asset.name}</h3>
        <p>Raw Westwood file stored in ${asset.pak_name}. Size: ${formatBytes(asset.size)}.</p>
      </div>
    `;
    el.metaChips.innerHTML = `
      <div class="meta-chip">Size: <strong>${formatBytes(asset.size)}</strong></div>
      <div class="meta-chip">Offset: <strong>0x${asset.offset.toString(16).toUpperCase()}</strong></div>
    `;
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
