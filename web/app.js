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
    hideNonUseful: true,
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
    modelZoomLevel: 'fit',

    animCurrentFrame: 0,
    animPlaying: false,
    animTimer: null,
    animFps: 10,
    animZoomLevel: 'fit',
    animBackdrop: 'bg-checker',
    animSceneMode: 'crop',
    animWithBg: false,
    cropBottomPanel: false,
    cpsWithAnims: false,
    cpsAnimTimer: null,
    cpsSelectedAnims: new Set(),

    reapplyZoom: null,

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

  // Restore saved sort preferences and view mode from localStorage
  try {
    const savedSort = localStorage.getItem('kyrandia_sort_prefs');
    if (savedSort) {
      Object.assign(state.sortPreferences, JSON.parse(savedSort));
    }
    const savedViewMode = localStorage.getItem('kyrandia_view_mode');
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      state.viewMode = savedViewMode;
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

    // Viewer
    viewerStage: document.getElementById('viewerStage'),
    selectedAssetType: document.getElementById('selectedAssetType'),
    selectedAssetName: document.getElementById('selectedAssetName'),
    selectedAssetPak: document.getElementById('selectedAssetPak'),
    viewerActions: document.getElementById('viewerActions'),
    metaChips: document.getElementById('metaChips'),
    interactiveControls: document.getElementById('interactiveControls'),


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
    hideNonUsefulCheck: document.getElementById('hideNonUsefulCheck'),

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

    // Help & Guide Modal
    helpModalBtn: document.getElementById('helpModalBtn'),
    helpModal: document.getElementById('helpModal'),
    closeHelpModalBtn: document.getElementById('closeHelpModalBtn'),
    closeHelpModalFooterBtn: document.getElementById('closeHelpModalFooterBtn'),

    // Featured Scenes Modal
    quickJumpsBtn: document.getElementById('quickJumpsBtn'),
    featuredModal: document.getElementById('featuredModal'),
    closeFeaturedModalBtn: document.getElementById('closeFeaturedModalBtn'),
    closeFeaturedModalFooterBtn: document.getElementById('closeFeaturedModalFooterBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer'),
  };

  // Initialization
  async function init() {
    updateViewModeUI();
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

    // Hide Non-Useful Files Checkbox
    if (el.hideNonUsefulCheck) {
      el.hideNonUsefulCheck.checked = state.hideNonUseful;
      el.hideNonUsefulCheck.addEventListener('change', (e) => {
        state.hideNonUseful = e.target.checked;
        loadStatus();
        loadAssets();
      });
    }

    // View Toggles
    el.viewGridBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      updateViewModeUI();
      try { localStorage.setItem('kyrandia_view_mode', 'grid'); } catch (_) {}
    });

    el.viewListBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      updateViewModeUI();
      try { localStorage.setItem('kyrandia_view_mode', 'list'); } catch (_) {}
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

    // Help & Guide Modal
    if (el.helpModalBtn && el.helpModal) {
      el.helpModalBtn.addEventListener('click', () => {
        el.helpModal.style.display = 'flex';
      });
      if (el.closeHelpModalBtn) {
        el.closeHelpModalBtn.addEventListener('click', () => el.helpModal.style.display = 'none');
      }
      if (el.closeHelpModalFooterBtn) {
        el.closeHelpModalFooterBtn.addEventListener('click', () => el.helpModal.style.display = 'none');
      }

      // Help Tabs Navigation
      document.querySelectorAll('.help-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.help-tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.help-tab-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const pane = document.getElementById(`pane-${btn.dataset.tab}`);
          if (pane) pane.classList.add('active');
        });
      });
    }

    // Featured Scenes Modal
    if (el.quickJumpsBtn && el.featuredModal) {
      el.quickJumpsBtn.addEventListener('click', () => {
        el.featuredModal.style.display = 'flex';
      });
      if (el.closeFeaturedModalBtn) {
        el.closeFeaturedModalBtn.addEventListener('click', () => el.featuredModal.style.display = 'none');
      }
      if (el.closeFeaturedModalFooterBtn) {
        el.closeFeaturedModalFooterBtn.addEventListener('click', () => el.featuredModal.style.display = 'none');
      }

      // Featured Scene Card Clicks
      document.querySelectorAll('.featured-scene-card').forEach(card => {
        card.addEventListener('click', async () => {
          const pak = card.dataset.pak;
          const name = card.dataset.name;
          el.featuredModal.style.display = 'none';

          if (el.pakSelect) el.pakSelect.value = pak;
          state.currentPak = pak;
          state.currentCategory = 'all';
          document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.category === 'all'));

          await loadAssets();
          const target = state.assets.find(a => a.name.toUpperCase() === name.toUpperCase() && a.pak_name.toUpperCase() === pak.toUpperCase());
          if (target) {
            selectAsset(target);
            scrollActiveCardIntoView();
            showToast(`Loaded ${name} from ${pak}`, 'success');
          }
        });
      });
    }

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Viewport Navigation & Drag to Pan
    setupViewportNavigation();
    setupDragToPan();
  }

  // API Calls
  async function loadStatus() {
    try {
      const params = new URLSearchParams({
        hide_non_useful: state.hideNonUseful ? '1' : '0',
      });
      const res = await fetch(`/api/status?${params}`);
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

  function updateViewModeUI() {
    if (state.viewMode === 'list') {
      if (el.viewListBtn) el.viewListBtn.classList.add('active');
      if (el.viewGridBtn) el.viewGridBtn.classList.remove('active');
      if (el.assetList) el.assetList.classList.remove('grid-mode');
    } else {
      state.viewMode = 'grid';
      if (el.viewGridBtn) el.viewGridBtn.classList.add('active');
      if (el.viewListBtn) el.viewListBtn.classList.remove('active');
      if (el.assetList) el.assetList.classList.add('grid-mode');
    }
  }

  function sortAndRenderAssets() {
    const { by, order } = getCurrentSort();
    state.assets.sort((a, b) => {
      const sizeA = (a.ext === '.CMP' && a.uncompressed_size) ? a.uncompressed_size : a.size;
      const sizeB = (b.ext === '.CMP' && b.uncompressed_size) ? b.uncompressed_size : b.size;
      if (by === 'size') {
        const diff = sizeA - sizeB;
        if (diff !== 0) return order === 'desc' ? -diff : diff;
        return a.name.localeCompare(b.name);
      } else {
        const cmp = a.name.localeCompare(b.name);
        if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
        return sizeA - sizeB;
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
        hide_non_useful: state.hideNonUseful ? '1' : '0',
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
      } else if (asset.ext === '.CMP') {
        thumbHtml = `<span class="asset-placeholder-icon">🔀</span>`;
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
        thumbHtml = `<img src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}" class="asset-thumbnail" loading="lazy" alt="${asset.name}">`;
      } else if (asset.ext === '.DAT') {
        thumbHtml = `<span class="asset-placeholder-icon">📊</span>`;
      } else if (['.EMC', '.FMC', '.GMC', '.DLE', '.DLF', '.DLG', '.ENG', '.FRE', '.GER'].includes(asset.ext)) {
        const flag = asset.flag || (['.EMC', '.DLE', '.ENG'].includes(asset.ext) ? '🇬🇧' : (['.FMC', '.DLF', '.FRE'].includes(asset.ext) ? '🇫🇷' : '🇩🇪'));
        thumbHtml = `<span class="asset-placeholder-icon">📜</span><span class="asset-badge-lang">${flag}</span>`;
      } else {
        thumbHtml = `<span class="asset-placeholder-icon">${asset.type_icon || '📄'}</span>`;
      }

      let sizeBadgeContent = formatBytes(asset.size);
      let sizeBadgeTitle = `Size: ${formatBytes(asset.size)}`;
      if (asset.ext === '.CMP') {
        const uncomp = asset.uncompressed_size || 65532;
        sizeBadgeContent = `${formatBytes(uncomp)} <span class="uncompressed-tag">Uncompressed</span>`;
        sizeBadgeTitle = `Uncompressed value shown: ${formatBytes(uncomp)} (Compressed in PAK: ${formatBytes(asset.size)})`;
      }

      card.innerHTML = `
        <div class="asset-thumbnail-wrap">${thumbHtml}</div>
        <div class="asset-card-info">
          <span class="asset-card-title" title="${asset.name}">${asset.name}</span>
          <div class="asset-card-meta">
            <span class="asset-ext-badge ${extClass}">${asset.ext.replace('.', '')}</span>
            <span class="asset-size-badge ${isSizeSort ? 'highlight-size' : ''}" title="${sizeBadgeTitle}">${sizeBadgeContent}</span>
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
    if (asset.ext === '.CMP') {
      const uncomp = asset.uncompressed_size || (state.selectedDetails && state.selectedDetails.uncompressed_size) || 65532;
      el.selectedAssetPak.textContent = `Archive: ${asset.pak_name} (${formatBytes(uncomp)} - Uncompressed value shown)`;
    } else {
      el.selectedAssetPak.textContent = `Archive: ${asset.pak_name} (${formatBytes(asset.size)})`;
    }

    // Reset controls
    stopAllPlayback();
    state.reapplyZoom = null;
    el.interactiveControls.innerHTML = '';

    // Fetch full details
    try {
      const res = await fetch(`/api/asset/details?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`);
      state.selectedDetails = await res.json();
      if (asset.ext === '.CMP' && state.selectedDetails && state.selectedDetails.uncompressed_size) {
        el.selectedAssetPak.textContent = `Archive: ${asset.pak_name} (${formatBytes(state.selectedDetails.uncompressed_size)} - Uncompressed value shown)`;
      }
    } catch (e) {
      state.selectedDetails = asset;
    }

    // Render corresponding viewer
    const SCRIPT_EXTS = ['.EMC', '.FMC', '.GMC', '.DLE', '.DLF', '.DLG', '.ENG', '.FRE', '.GER'];
    if (SCRIPT_EXTS.includes(asset.ext)) {
      renderScriptViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.CMP') {
      renderCmpTransitionViewer(asset, state.selectedDetails);
    } else if (asset.ext === '.CPS') {
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
    } else if (asset.ext === '.FNT') {
      renderFontViewer(asset, state.selectedDetails);
    } else {
      renderRawViewer(asset, state.selectedDetails);
    }
  }

  // 1. Background Viewer (.CPS)
  function renderBackgroundViewer(asset, details) {
    if (state.cpsAnimTimer) {
      clearInterval(state.cpsAnimTimer);
      state.cpsAnimTimer = null;
    }

    const isCmp = asset.ext === '.CMP';
    const linkedWsas = details.linked_wsas || [];
    const hasLinkedWsas = linkedWsas.length > 0;

    // Load custom layer order if previously saved
    const layerStorageKey = `cps_layer_order_${asset.pak_name}_${asset.name}`;
    let orderedWsas = [...linkedWsas];
    try {
      const raw = localStorage.getItem(layerStorageKey);
      if (raw) {
        const savedOrder = JSON.parse(raw);
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
          const mapByName = new Map(linkedWsas.map(w => [w.name.toUpperCase(), w]));
          const reordered = [];
          savedOrder.forEach(name => {
            const up = String(name).toUpperCase();
            if (mapByName.has(up)) {
              reordered.push(mapByName.get(up));
              mapByName.delete(up);
            }
          });
          mapByName.forEach(w => reordered.push(w));
          orderedWsas = reordered;
        }
      }
    } catch (e) {}

    // Initialize selected animations set for this asset (all selected by default)
    state.cpsSelectedAnims = new Set(linkedWsas.map(w => w.name.toUpperCase()));

    function getSelectedAnims() {
      return orderedWsas.filter(w => state.cpsSelectedAnims.has(w.name.toUpperCase()));
    }

    function getAnimPos(anim) {
      try {
        const raw = localStorage.getItem(`wsa_offset_${anim.pak_name}_${anim.name}`);
        if (raw) {
          const p = JSON.parse(raw);
          if (typeof p.x === 'number' && typeof p.y === 'number') {
            return { x: p.x, y: p.y };
          }
        }
      } catch (e) {}
      return { x: anim.pos_x, y: anim.pos_y };
    }

    function updateCpsUrls() {
      const cropParam = state.cropBottomPanel ? '&crop_panel=1' : '';
      const selected = getSelectedAnims();
      const hasSelected = selected.length > 0;
      const animsParam = (selected.length > 0)
        ? `&anims=${encodeURIComponent(selected.map(w => w.name).join(','))}`
        : '';
      const customPositions = selected
        .map(w => {
          const p = getAnimPos(w);
          if (p.x !== w.pos_x || p.y !== w.pos_y) {
            return `${w.name}:${p.x},${p.y}`;
          }
          return null;
        })
        .filter(Boolean);
      const posParam = customPositions.length > 0 ? `&positions=${encodeURIComponent(customPositions.join(';'))}` : '';
      const animParam = (state.cpsWithAnims && hasSelected) ? `&with_anims=1${animsParam}${posParam}` : '';

      const previewUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}${cropParam}`;
      const exportPngUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}${animParam}${cropParam}`;
      const exportGifUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&gif=1${animParam}${cropParam}`;

      const baseName = asset.name.replace(/\.(CPS|CMP)$/i, '');
      const animSuffix = (state.cpsWithAnims && hasSelected)
        ? (selected.length < linkedWsas.length ? `_${selected.length}anims` : '_animated')
        : '';
      const suffix = state.cropBottomPanel ? '_scene' : '';

      const stageImg = document.getElementById('stageImg');
      if (stageImg && !state.cpsWithAnims) {
        stageImg.src = previewUrl;
      }

      const exportPngBtn = document.getElementById('exportCpsPngBtn');
      if (exportPngBtn) {
        exportPngBtn.href = exportPngUrl;
        exportPngBtn.download = `${baseName}${animSuffix}${suffix}.png`;
        const labelSpan = exportPngBtn.querySelector('span');
        if (labelSpan) {
          labelSpan.textContent = (state.cpsWithAnims && hasSelected)
            ? `Export Scene Picture (${selected.length} anim${selected.length > 1 ? 's' : ''})`
            : 'Export PNG Picture';
        }
      }

      const exportGifBtn = document.getElementById('exportCpsGifBtn');
      if (exportGifBtn) {
        exportGifBtn.href = exportGifUrl;
        exportGifBtn.download = `${baseName}${animSuffix}${suffix}.gif`;
        const labelSpan = exportGifBtn.querySelector('span');
        if (labelSpan) {
          labelSpan.textContent = (state.cpsWithAnims && hasSelected)
            ? `Export Scene Animation (${selected.length} anim${selected.length > 1 ? 's' : ''})`
            : 'Export GIF';
        }
      }

      const dimChip = document.getElementById('cpsDimensionsChip');
      if (dimChip) {
        if (isCmp) {
          dimChip.textContent = '256x256 px (Color Lighting Matrix)';
        } else {
          dimChip.textContent = state.cropBottomPanel ? '320x144 px (Scene Viewport)' : (details.dimensions || '320x200 px (Full Frame)');
        }
      }

      const metaChipAnims = document.getElementById('cpsLinkedAnimsChip');
      if (metaChipAnims) {
        metaChipAnims.innerHTML = `Linked Animations: <strong style="color: var(--accent-emerald-light);">${selected.length} of ${linkedWsas.length} active</strong>`;
      }

      const toggleSceneAnimsBtn = document.getElementById('toggleSceneAnimsBtn');
      if (toggleSceneAnimsBtn) {
        const span = toggleSceneAnimsBtn.querySelector('span');
        if (span) {
          span.textContent = `🎬 Include Animations (${selected.length}/${linkedWsas.length})`;
        }
      }

      const toggleAnimListBtn = document.getElementById('toggleAnimListBtn');
      if (toggleAnimListBtn) {
        const span = toggleAnimListBtn.querySelector('span');
        if (span) {
          span.textContent = `⚙️ Layers & Animations (${selected.length}/${linkedWsas.length}) ▾`;
        }
      }

      const countBadge = document.getElementById('cpsAnimsCountBadge');
      if (countBadge) {
        countBadge.textContent = `${selected.length} of ${linkedWsas.length} active`;
      }
    }

    const baseName = asset.name.replace(/\.(CPS|CMP)$/i, '');
    const initialCropParam = (!isCmp && state.cropBottomPanel) ? '&crop_panel=1' : '';
    const initialAnimsParam = hasLinkedWsas ? `&anims=${encodeURIComponent(orderedWsas.map(w => w.name).join(','))}` : '';
    const initialCustomPositions = hasLinkedWsas ? orderedWsas.map(w => {
      const p = getAnimPos(w);
      return (p.x !== w.pos_x || p.y !== w.pos_y) ? `${w.name}:${p.x},${p.y}` : null;
    }).filter(Boolean) : [];
    const initialPosParam = initialCustomPositions.length > 0 ? `&positions=${encodeURIComponent(initialCustomPositions.join(';'))}` : '';
    const initialAnimParam = (state.cpsWithAnims && hasLinkedWsas) ? `&with_anims=1${initialAnimsParam}${initialPosParam}` : '';
    const initialPreviewUrl = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}${initialCropParam}`;
    const initialExportPngUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}${initialAnimParam}${initialCropParam}`;
    const initialExportGifUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&gif=1${initialAnimParam}${initialCropParam}`;

    el.viewerActions.innerHTML = `
      <a id="exportCpsPngBtn" href="${initialExportPngUrl}" download="${baseName}${(state.cpsWithAnims && hasLinkedWsas) ? '_animated' : ''}${state.cropBottomPanel ? '_scene' : ''}.png" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>${(state.cpsWithAnims && hasLinkedWsas) ? `Export Scene Picture (${linkedWsas.length} anims)` : 'Export PNG Picture'}</span>
      </a>
      <a id="exportCpsGifBtn" href="${initialExportGifUrl}" download="${baseName}${(state.cpsWithAnims && hasLinkedWsas) ? '_animated' : ''}${state.cropBottomPanel ? '_scene' : ''}.gif" class="btn btn-secondary">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        <span>${(state.cpsWithAnims && hasLinkedWsas) ? `Export Scene Animation (${linkedWsas.length} anims)` : 'Export GIF'}</span>
      </a>
      ${asset.ext === '.CMP' ? `
      <a href="/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&uncompressed=1" download="${baseName}.CPS" class="btn btn-secondary" title="Download Format 80 Uncompressed .CPS Background (${formatBytes(details.uncompressed_size || asset.uncompressed_size || 65532)})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download Uncompressed (.CPS - ${formatBytes(details.uncompressed_size || asset.uncompressed_size || 65532)})</span>
      </a>
      <a href="/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}" download="${asset.name}" class="btn btn-secondary" title="Download Original Compressed Format 80 .CMP File (${formatBytes(asset.size)})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download Original (.CMP - ${formatBytes(asset.size)})</span>
      </a>` : ''}
    `;

    el.viewerStage.innerHTML = `
      <div class="cps-viewport-stage" id="cpsViewportStage">
        <div class="cps-canvas-wrapper ${state.scanlinesActive ? 'crt-overlay' : ''}" id="imgWrap">
          <img id="stageImg" src="${initialPreviewUrl}" class="display-canvas" alt="${asset.name}" style="${(state.cpsWithAnims && hasLinkedWsas) ? 'display: none;' : ''}">
          <canvas id="cpsCanvas" width="${isCmp ? 256 : 320}" height="${(!isCmp && state.cropBottomPanel) ? 144 : (isCmp ? 256 : 200)}" class="display-canvas" style="${(!state.cpsWithAnims || !hasLinkedWsas) ? 'display: none;' : ''}"></canvas>
        </div>
      </div>
    `;

    // Metadata chips
    const uncompSize = (details && details.uncompressed_size) || (asset && asset.uncompressed_size) || 65532;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Dimensions: <strong id="cpsDimensionsChip">${isCmp ? '256x256 px (Color Lighting Matrix)' : (state.cropBottomPanel ? '320x144 px (Scene Viewport)' : (details.dimensions || '320x200 px (Full Frame)'))}</strong></div>
      <div class="meta-chip">Color Depth: <strong>256 VGA Colors</strong></div>
      ${isCmp ? `
        <div class="meta-chip highlight-chip" style="border-color: rgba(52, 211, 153, 0.4); background: rgba(16, 185, 129, 0.14);">
          File Size: <strong style="color: #34d399;">${formatBytes(uncompSize)} (Uncompressed)</strong>
        </div>
        <div class="meta-chip" style="background: rgba(59, 130, 246, 0.15); border-color: rgba(96, 165, 250, 0.35); color: #93c5fd;">
          ⚡ <strong>Uncompressed value shown</strong>
        </div>
        <div class="meta-chip">Compressed Size: <strong>${formatBytes(asset.size)}</strong></div>
        <div class="meta-chip">Compression: <strong>Format 80 (LCW)${details.compression_ratio ? ` (${details.compression_ratio})` : ''}</strong></div>
      ` : `
        <div class="meta-chip">Compression: <strong>Format 80 (LCW)${details.compression_ratio ? ` (${details.compression_ratio})` : ''}</strong></div>
        ${details.uncompressed_size ? `<div class="meta-chip">Uncompressed: <strong>${formatBytes(details.uncompressed_size)}</strong></div>` : ''}
        <div class="meta-chip">File Size: <strong>${formatBytes(asset.size)}</strong></div>
      `}
      ${hasLinkedWsas ? `<div class="meta-chip" id="cpsLinkedAnimsChip" title="${linkedWsas.map(w => w.name).join(', ')}">Linked Animations: <strong style="color: var(--accent-emerald-light);">${state.cpsSelectedAnims.size} of ${linkedWsas.length} active</strong></div>` : ''}
    `;

    // Interactive controls: Multiplier buttons, Remove Bottom Panel checkbox, Include Animations button, Select Animations picker & CRT scanlines
    const animToggleBtnHtml = hasLinkedWsas ? `
      <button id="toggleSceneAnimsBtn" class="btn ${state.cpsWithAnims ? 'btn-primary glow-btn active' : 'btn-secondary'}" style="font-size: 0.78rem;" title="Play selected linked WSA animation overlays over this background scene">
        <span>🎬 Include Animations (${state.cpsSelectedAnims.size}/${linkedWsas.length})</span>
      </button>
      <button id="toggleAnimListBtn" class="btn btn-secondary" style="font-size: 0.78rem;" title="Manage animation layers, visibility order, and solo isolates">
        <span>⚙️ Layers & Animations (${state.cpsSelectedAnims.size}/${linkedWsas.length}) ▾</span>
      </button>
    ` : '';

    const animPickerHtml = hasLinkedWsas ? `
      <div class="cps-anims-picker-panel" id="cpsAnimsPickerPanel" style="display: none;">
        <div class="cps-anims-picker-header">
          <div class="cps-anims-picker-title">
            <span>🎬 Animation Layers & Visibility</span>
            <span class="cps-anims-count-badge" id="cpsAnimsCountBadge">${state.cpsSelectedAnims.size} of ${linkedWsas.length} active</span>
          </div>
          <div class="cps-anims-picker-actions">
            <button class="cps-anims-action-btn" id="animSelectAllBtn" title="Include all animations in preview and export">Select All</button>
            <button class="cps-anims-action-btn" id="animDeselectAllBtn" title="Exclude all animations">Deselect All</button>
            <button class="cps-anims-action-btn" id="animResetOrderBtn" title="Reset animation layers to default order">↺ Reset Layers</button>
            <button class="cps-anims-action-btn" id="animResetPositionsBtn" title="Reset all animation positions to default">↺ Reset Positions</button>
            <button class="cps-anims-action-btn" id="animClosePickerBtn" title="Close layer panel">✕ Close</button>
          </div>
        </div>
        <div class="cps-anims-grid" id="cpsAnimsGrid">
        </div>
      </div>
    ` : '';

    el.interactiveControls.innerHTML = `
      <div class="cps-controls-row">
        <div class="ctrl-btn-group" title="Zoom Multiplier">
          <button class="ctrl-btn ${state.zoomLevel === 'fit' ? 'active' : ''}" data-zoom="fit" title="Fit to Preview Window">Fit</button>
          <button class="ctrl-btn ${state.zoomLevel === 1 ? 'active' : ''}" data-zoom="1" title="1x">1x</button>
          <button class="ctrl-btn ${state.zoomLevel === 2 ? 'active' : ''}" data-zoom="2" title="2x">2x</button>
          <button class="ctrl-btn ${state.zoomLevel === 3 ? 'active' : ''}" data-zoom="3" title="3x">3x</button>
          <button class="ctrl-btn ${state.zoomLevel === 4 ? 'active' : ''}" data-zoom="4" title="4x">4x</button>
        </div>

        ${!isCmp ? `
        <label class="ctrl-checkbox-label" title="Remove the bottom 56px interface panel (crops from 320x200 down to 320x144 scene viewport)">
          <input type="checkbox" id="cropBottomPanelCheck" ${state.cropBottomPanel ? 'checked' : ''}>
          <span class="checkbox-text">Remove Bottom Panel (320x144)</span>
        </label>
        ` : ''}

        ${animToggleBtnHtml}

        <button id="toggleCrtBtn" class="btn btn-secondary ${state.scanlinesActive ? 'active' : ''}" style="font-size: 0.78rem;">
          <span>📺 CRT Scanlines</span>
        </button>
      </div>
      ${animPickerHtml}
    `;

    function applyCpsZoom(level, centerView = false) {
      state.zoomLevel = level;
      const stageImg = document.getElementById('stageImg');
      const cpsCanvas = document.getElementById('cpsCanvas');
      const wrap = document.getElementById('imgWrap');
      if (!wrap) return;

      el.interactiveControls.querySelectorAll('[data-zoom]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zoom === String(level));
      });

      const nativeW = isCmp ? 256 : 320;
      const nativeH = (!isCmp && state.cropBottomPanel) ? 144 : (details.height || (stageImg && stageImg.naturalHeight > 0 ? stageImg.naturalHeight : (isCmp ? 256 : 200)));
      const aspect = nativeW / nativeH;

      const elementsToResize = [stageImg, cpsCanvas].filter(Boolean);

      if (level === 'fit') {
        const stage = el.viewerStage;
        const padX = 52;
        const padY = 52;
        const availW = Math.max((stage ? stage.clientWidth : window.innerWidth) - padX, 100);
        const availH = Math.max((stage ? stage.clientHeight : window.innerHeight) - padY, 100);

        let fitW, fitH;
        if (availW / availH > aspect) {
          // Viewport is wider than image aspect ratio -> fit to height of viewport
          fitH = availH;
          fitW = fitH * aspect;
        } else {
          // Viewport is taller/narrower than image aspect ratio -> fit to length (width) of viewport
          fitW = availW;
          fitH = fitW / aspect;
        }

        const roundedW = Math.round(fitW);
        const roundedH = Math.round(fitH);
        wrap.style.width = `${roundedW}px`;
        wrap.style.height = `${roundedH}px`;
        elementsToResize.forEach(elNode => {
          elNode.style.width = `${roundedW}px`;
          elNode.style.height = `${roundedH}px`;
          elNode.style.maxWidth = 'none';
          elNode.style.maxHeight = 'none';
          elNode.style.aspectRatio = `${nativeW} / ${nativeH}`;
        });
      } else {
        const mult = parseInt(level);
        const w = nativeW * mult;
        const h = nativeH * mult;
        wrap.style.width = `${w}px`;
        wrap.style.height = `${h}px`;
        elementsToResize.forEach(elNode => {
          elNode.style.width = `${w}px`;
          elNode.style.height = `${h}px`;
          elNode.style.maxWidth = 'none';
          elNode.style.maxHeight = 'none';
          elNode.style.aspectRatio = `${nativeW} / ${nativeH}`;
        });
      }

      requestAnimationFrame(() => {
        const stage = el.viewerStage;
        if (stage) {
          if (level === 'fit') {
            stage.scrollLeft = 0;
            stage.scrollTop = 0;
          } else if (centerView) {
            if (stage.scrollWidth > stage.clientWidth) {
              stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
            }
            if (stage.scrollHeight > stage.clientHeight) {
              stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
            }
          }
        }
        updateViewportScrollState();
      });
    }

    // Register re-fit callback for responsive window / container resizing
    state.reapplyZoom = () => {
      applyCpsZoom(state.zoomLevel, false);
    };

    // Preload spritesheets for each linked WSA
    linkedWsas.forEach(anim => {
      anim._sheetImg = new Image();
      anim._sheetReady = false;
      anim._sheetImg.onload = () => {
        anim._sheetReady = true;
        if (state.cpsWithAnims && hasLinkedWsas) {
          renderSceneFrame();
        }
      };
      anim._sheetImg.src = `/api/asset/preview?pak=${encodeURIComponent(anim.pak_name)}&name=${encodeURIComponent(anim.name)}&sheet=1`;
    });

    let animTickCount = 0;
    function renderSceneFrame() {
      const canvas = document.getElementById('cpsCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const stageImg = document.getElementById('stageImg');
      const targetH = state.cropBottomPanel ? 144 : 200;
      if (canvas.width !== 320 || canvas.height !== targetH) {
        canvas.width = 320;
        canvas.height = targetH;
      }
      ctx.clearRect(0, 0, 320, targetH);
      if (stageImg && stageImg.complete && stageImg.naturalWidth > 0) {
        ctx.drawImage(stageImg, 0, 0, 320, targetH, 0, 0, 320, targetH);
      }
      orderedWsas.forEach(anim => {
        if (state.cpsSelectedAnims.has(anim.name.toUpperCase()) && anim._sheetReady) {
          const frameIdx = animTickCount % anim.num_frames;
          const cols = Math.min(anim.num_frames, 8);
          const col = frameIdx % cols;
          const row = Math.floor(frameIdx / cols);
          const sx = col * anim.width;
          const sy = row * anim.height;
          const pos = getAnimPos(anim);
          ctx.drawImage(anim._sheetImg, sx, sy, anim.width, anim.height, pos.x, pos.y, anim.width, anim.height);
        }
      });

      if (draggedCpsAnim || hoveredCpsAnim) {
        const activeA = draggedCpsAnim || hoveredCpsAnim;
        const p = getAnimPos(activeA);
        ctx.save();
        ctx.strokeStyle = draggedCpsAnim ? '#38bdf8' : 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash(draggedCpsAnim ? [4, 2] : [3, 2]);
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, activeA.width - 1, activeA.height - 1);
        ctx.restore();
      }
    }

    function startCpsAnimation() {
      if (state.cpsAnimTimer) clearInterval(state.cpsAnimTimer);
      renderSceneFrame();
      state.cpsAnimTimer = setInterval(() => {
        animTickCount++;
        renderSceneFrame();
      }, 100);
    }

    function stopCpsAnimation() {
      if (state.cpsAnimTimer) {
        clearInterval(state.cpsAnimTimer);
        state.cpsAnimTimer = null;
      }
    }

    // Toggle button listener
    const toggleSceneAnimsBtn = document.getElementById('toggleSceneAnimsBtn');
    if (toggleSceneAnimsBtn) {
      toggleSceneAnimsBtn.addEventListener('click', () => {
        if (!state.cpsWithAnims && state.cpsSelectedAnims.size === 0) {
          orderedWsas.forEach(w => state.cpsSelectedAnims.add(w.name.toUpperCase()));
          renderAnimCards();
        }
        state.cpsWithAnims = !state.cpsWithAnims;
        toggleSceneAnimsBtn.classList.toggle('active', state.cpsWithAnims);
        toggleSceneAnimsBtn.classList.toggle('btn-primary', state.cpsWithAnims);
        toggleSceneAnimsBtn.classList.toggle('glow-btn', state.cpsWithAnims);
        toggleSceneAnimsBtn.classList.toggle('btn-secondary', !state.cpsWithAnims);

        const stageImg = document.getElementById('stageImg');
        const canvas = document.getElementById('cpsCanvas');
        if (stageImg && canvas) {
          if (state.cpsWithAnims) {
            stageImg.style.display = 'none';
            canvas.style.display = 'block';
            startCpsAnimation();
          } else {
            stopCpsAnimation();
            canvas.style.display = 'none';
            stageImg.style.display = 'block';
          }
        }
        updateCpsUrls();
        applyCpsZoom(state.zoomLevel, false);
      });
    }

    // Picker panel listeners
    const toggleAnimListBtn = document.getElementById('toggleAnimListBtn');
    const animPickerPanel = document.getElementById('cpsAnimsPickerPanel');
    if (toggleAnimListBtn && animPickerPanel) {
      toggleAnimListBtn.addEventListener('click', () => {
        const isHidden = animPickerPanel.style.display === 'none';
        animPickerPanel.style.display = isHidden ? 'flex' : 'none';
        toggleAnimListBtn.classList.toggle('active', isHidden);
      });
    }

    let hoveredCpsAnim = null;
    let draggedCpsAnim = null;
    let dragGrabX = 0;
    let dragGrabY = 0;

    function getCpsCanvasCoords(clientX, clientY) {
      const canvas = document.getElementById('cpsCanvas');
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function findAnimAtCoords(cx, cy) {
      for (let i = orderedWsas.length - 1; i >= 0; i--) {
        const anim = orderedWsas[i];
        if (state.cpsSelectedAnims.has(anim.name.toUpperCase())) {
          const pos = getAnimPos(anim);
          if (cx >= pos.x && cx <= pos.x + anim.width && cy >= pos.y && cy <= pos.y + anim.height) {
            return anim;
          }
        }
      }
      return null;
    }

    function bindAnimCardEvents() {
      const animPickerPanel = document.getElementById('cpsAnimsPickerPanel');
      if (!animPickerPanel) return;

      animPickerPanel.querySelectorAll('.cps-anim-card').forEach(card => {
        const animName = card.dataset.anim;
        const cb = card.querySelector('.cps-anim-checkbox');
        const soloBtn = card.querySelector('.cps-anim-solo-btn');
        const select = card.querySelector('.cps-layer-select');
        const upBtn = card.querySelector('.cps-layer-up');
        const downBtn = card.querySelector('.cps-layer-down');
        const posXInput = card.querySelector('.cps-pos-x');
        const posYInput = card.querySelector('.cps-pos-y');
        const resetPosBtn = card.querySelector('.cps-pos-reset-btn');
        const animObj = orderedWsas.find(w => w.name.toUpperCase() === animName.toUpperCase());

        function updateCardPos(newX, newY, save = true) {
          if (!animObj) return;
          const pos = { x: Math.round(newX), y: Math.round(newY) };
          if (posXInput && document.activeElement !== posXInput) posXInput.value = pos.x;
          if (posYInput && document.activeElement !== posYInput) posYInput.value = pos.y;

          const isDefault = (pos.x === animObj.pos_x && pos.y === animObj.pos_y);
          if (resetPosBtn) resetPosBtn.disabled = isDefault;

          const coordsEl = card.querySelector('.cps-pos-coords');
          if (coordsEl) coordsEl.textContent = `(${pos.x}, ${pos.y})`;

          let origEl = card.querySelector('.cps-pos-orig');
          if (!isDefault) {
            if (!origEl) {
              const specs = card.querySelector('.cps-anim-specs');
              if (specs) {
                origEl = document.createElement('span');
                origEl.className = 'cps-pos-orig';
                origEl.style.cssText = 'opacity:0.7; font-size:0.62rem;';
                specs.appendChild(document.createTextNode(' '));
                specs.appendChild(origEl);
              }
            }
            if (origEl) origEl.textContent = `(Orig: ${animObj.pos_x}, ${animObj.pos_y})`;
          } else if (origEl) {
            origEl.remove();
          }

          if (save) {
            try {
              if (isDefault) {
                localStorage.removeItem(`wsa_offset_${animObj.pak_name}_${animObj.name}`);
              } else {
                localStorage.setItem(`wsa_offset_${animObj.pak_name}_${animObj.name}`, JSON.stringify(pos));
              }
            } catch (err) {}
          }

          updateCpsUrls();
          if (state.cpsWithAnims) renderSceneFrame();
        }

        if (posXInput) {
          posXInput.addEventListener('change', () => {
            const x = parseInt(posXInput.value) || 0;
            const curY = parseInt(posYInput ? posYInput.value : (animObj ? animObj.pos_y : 0)) || 0;
            updateCardPos(x, curY, true);
          });
        }

        if (posYInput) {
          posYInput.addEventListener('change', () => {
            const curX = parseInt(posXInput ? posXInput.value : (animObj ? animObj.pos_x : 0)) || 0;
            const y = parseInt(posYInput.value) || 0;
            updateCardPos(curX, y, true);
          });
        }

        if (resetPosBtn && animObj) {
          resetPosBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
              localStorage.removeItem(`wsa_offset_${animObj.pak_name}_${animObj.name}`);
            } catch (err) {}
            updateCardPos(animObj.pos_x, animObj.pos_y, false);
          });
        }

        if (cb) {
          cb.addEventListener('change', () => {
            const upName = animName.toUpperCase();
            if (cb.checked) {
              state.cpsSelectedAnims.add(upName);
            } else {
              state.cpsSelectedAnims.delete(upName);
            }
            card.classList.toggle('selected', cb.checked);
            updateCpsUrls();
            if (state.cpsWithAnims) renderSceneFrame();
          });
        }

        if (select) {
          select.addEventListener('change', (e) => {
            const targetIdx = parseInt(e.target.value);
            const curIdx = orderedWsas.findIndex(w => w.name.toUpperCase() === animName.toUpperCase());
            if (curIdx !== -1 && targetIdx >= 0 && targetIdx < orderedWsas.length && curIdx !== targetIdx) {
              const [moved] = orderedWsas.splice(curIdx, 1);
              orderedWsas.splice(targetIdx, 0, moved);
              try {
                localStorage.setItem(layerStorageKey, JSON.stringify(orderedWsas.map(w => w.name)));
              } catch (err) {}
              renderAnimCards();
              updateCpsUrls();
              if (state.cpsWithAnims) renderSceneFrame();
            }
          });
        }

        if (upBtn) {
          upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const curIdx = orderedWsas.findIndex(w => w.name.toUpperCase() === animName.toUpperCase());
            if (curIdx !== -1 && curIdx < orderedWsas.length - 1) {
              const [moved] = orderedWsas.splice(curIdx, 1);
              orderedWsas.splice(curIdx + 1, 0, moved);
              try {
                localStorage.setItem(layerStorageKey, JSON.stringify(orderedWsas.map(w => w.name)));
              } catch (err) {}
              renderAnimCards();
              updateCpsUrls();
              if (state.cpsWithAnims) renderSceneFrame();
            }
          });
        }

        if (downBtn) {
          downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const curIdx = orderedWsas.findIndex(w => w.name.toUpperCase() === animName.toUpperCase());
            if (curIdx > 0) {
              const [moved] = orderedWsas.splice(curIdx, 1);
              orderedWsas.splice(curIdx - 1, 0, moved);
              try {
                localStorage.setItem(layerStorageKey, JSON.stringify(orderedWsas.map(w => w.name)));
              } catch (err) {}
              renderAnimCards();
              updateCpsUrls();
              if (state.cpsWithAnims) renderSceneFrame();
            }
          });
        }

        if (soloBtn) {
          soloBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.cpsSelectedAnims.clear();
            state.cpsSelectedAnims.add(animName.toUpperCase());
            if (!state.cpsWithAnims) {
              state.cpsWithAnims = true;
              if (toggleSceneAnimsBtn) {
                toggleSceneAnimsBtn.classList.add('active', 'btn-primary', 'glow-btn');
                toggleSceneAnimsBtn.classList.remove('btn-secondary');
              }
              const stageImg = document.getElementById('stageImg');
              const canvas = document.getElementById('cpsCanvas');
              if (stageImg && canvas) {
                stageImg.style.display = 'none';
                canvas.style.display = 'block';
                startCpsAnimation();
              }
            }
            renderAnimCards();
            updateCpsUrls();
            if (state.cpsWithAnims) renderSceneFrame();
            applyCpsZoom(state.zoomLevel, false);
          });
        }
      });
    }

    function renderAnimCards() {
      const grid = document.getElementById('cpsAnimsGrid');
      if (!grid) return;
      const total = orderedWsas.length;

      grid.innerHTML = orderedWsas.map((w, idx) => {
        const isSel = state.cpsSelectedAnims.has(w.name.toUpperCase());
        const layerNum = idx + 1;
        const pos = getAnimPos(w);
        const isDefault = (pos.x === w.pos_x && pos.y === w.pos_y);

        return `
          <div class="cps-anim-card ${isSel ? 'selected' : ''}" data-anim="${w.name}">
            <label class="cps-anim-card-left" title="Toggle visibility of ${w.name}">
              <input type="checkbox" value="${w.name}" ${isSel ? 'checked' : ''} class="cps-anim-checkbox">
              <div class="cps-anim-info">
                <span class="cps-anim-title" title="${w.name}">${w.name}</span>
                <span class="cps-anim-specs">${w.num_frames} frames · ${w.width}x${w.height} @ <strong class="cps-pos-coords">(${pos.x}, ${pos.y})</strong>${!isDefault ? ` <span class="cps-pos-orig" style="opacity:0.7; font-size:0.62rem;">(Orig: ${w.pos_x}, ${w.pos_y})</span>` : ''}</span>
              </div>
            </label>
            <div class="cps-anim-card-right">
              <div class="cps-anim-pos-control" title="Move ${w.name} on scene">
                <label class="cps-anim-pos-label" title="Horizontal position in pixels">
                  <span>X</span>
                  <input type="number" class="cps-pos-input cps-pos-x" data-anim="${w.name}" value="${pos.x}" step="1">
                </label>
                <label class="cps-anim-pos-label" title="Vertical position in pixels">
                  <span>Y</span>
                  <input type="number" class="cps-pos-input cps-pos-y" data-anim="${w.name}" value="${pos.y}" step="1">
                </label>
                <button class="cps-pos-reset-btn" data-anim="${w.name}" title="Reset ${w.name} to default position (${w.pos_x}, ${w.pos_y})" ${isDefault ? 'disabled' : ''}>↺</button>
              </div>
              <div class="cps-layer-control" title="Layer ${layerNum} of ${total}: 1 is bottom/back, ${total} is top/front">
                <span class="cps-layer-badge" title="Current layer: ${layerNum}">L${layerNum}</span>
                <select class="cps-layer-select" data-anim="${w.name}" title="Change layer for ${w.name}">
                  ${orderedWsas.map((_, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${i + 1}${i === 0 ? ' (Back)' : (i === total - 1 ? ' (Front)' : '')}</option>`).join('')}
                </select>
                <button class="cps-layer-btn cps-layer-down" data-anim="${w.name}" title="Send Backward (Lower Layer)" ${idx === 0 ? 'disabled' : ''}>▼</button>
                <button class="cps-layer-btn cps-layer-up" data-anim="${w.name}" title="Bring Forward (Higher Layer)" ${idx === total - 1 ? 'disabled' : ''}>▲</button>
              </div>
              <button class="cps-anim-solo-btn" data-anim="${w.name}" title="Solo: isolate only ${w.name}">Solo</button>
            </div>
          </div>
        `;
      }).join('');

      bindAnimCardEvents();
    }

    if (hasLinkedWsas) {
      renderAnimCards();

      document.getElementById('animSelectAllBtn')?.addEventListener('click', () => {
        orderedWsas.forEach(w => state.cpsSelectedAnims.add(w.name.toUpperCase()));
        renderAnimCards();
        updateCpsUrls();
        if (state.cpsWithAnims) renderSceneFrame();
      });

      document.getElementById('animDeselectAllBtn')?.addEventListener('click', () => {
        state.cpsSelectedAnims.clear();
        renderAnimCards();
        updateCpsUrls();
        if (state.cpsWithAnims) renderSceneFrame();
      });

      document.getElementById('animResetOrderBtn')?.addEventListener('click', () => {
        try {
          localStorage.removeItem(layerStorageKey);
        } catch (err) {}
        orderedWsas = [...linkedWsas];
        renderAnimCards();
        updateCpsUrls();
        if (state.cpsWithAnims) renderSceneFrame();
      });

      document.getElementById('animResetPositionsBtn')?.addEventListener('click', () => {
        orderedWsas.forEach(w => {
          try {
            localStorage.removeItem(`wsa_offset_${w.pak_name}_${w.name}`);
          } catch (err) {}
        });
        renderAnimCards();
        updateCpsUrls();
        if (state.cpsWithAnims) renderSceneFrame();
        showToast('Animation coordinates reset to engine defaults', 'info');
      });

      document.getElementById('animClosePickerBtn')?.addEventListener('click', () => {
        if (animPickerPanel) animPickerPanel.style.display = 'none';
        if (toggleAnimListBtn) toggleAnimListBtn.classList.remove('active');
      });

      const cpsCanvasEl = document.getElementById('cpsCanvas');
      if (cpsCanvasEl) {
        function onCpsWindowMouseMove(e) {
          if (!draggedCpsAnim) return;
          const { x, y } = getCpsCanvasCoords(e.clientX, e.clientY);
          const newX = Math.round(x - dragGrabX);
          const newY = Math.round(y - dragGrabY);
          try {
            if (newX === draggedCpsAnim.pos_x && newY === draggedCpsAnim.pos_y) {
              localStorage.removeItem(`wsa_offset_${draggedCpsAnim.pak_name}_${draggedCpsAnim.name}`);
            } else {
              localStorage.setItem(`wsa_offset_${draggedCpsAnim.pak_name}_${draggedCpsAnim.name}`, JSON.stringify({ x: newX, y: newY }));
            }
          } catch (err) {}

          const card = animPickerPanel?.querySelector(`.cps-anim-card[data-anim="${draggedCpsAnim.name}"]`);
          if (card) {
            const inX = card.querySelector('.cps-pos-x');
            const inY = card.querySelector('.cps-pos-y');
            const resetBtn = card.querySelector('.cps-pos-reset-btn');
            const coordsEl = card.querySelector('.cps-pos-coords');
            if (inX && document.activeElement !== inX) inX.value = newX;
            if (inY && document.activeElement !== inY) inY.value = newY;
            if (resetBtn) resetBtn.disabled = (newX === draggedCpsAnim.pos_x && newY === draggedCpsAnim.pos_y);
            if (coordsEl) coordsEl.textContent = `(${newX}, ${newY})`;
          }
          renderSceneFrame();
        }

        function onCpsWindowMouseUp(e) {
          if (!draggedCpsAnim) return;
          draggedCpsAnim = null;
          window.removeEventListener('mousemove', onCpsWindowMouseMove);
          window.removeEventListener('mouseup', onCpsWindowMouseUp);
          updateCpsUrls();
          renderAnimCards();
          renderSceneFrame();
          const { x, y } = getCpsCanvasCoords(e.clientX, e.clientY);
          hoveredCpsAnim = findAnimAtCoords(x, y);
          cpsCanvasEl.style.cursor = hoveredCpsAnim ? 'grab' : 'default';
        }

        cpsCanvasEl.addEventListener('mousemove', (e) => {
          if (draggedCpsAnim || !state.cpsWithAnims) return;
          const { x, y } = getCpsCanvasCoords(e.clientX, e.clientY);
          const over = findAnimAtCoords(x, y);
          if (over !== hoveredCpsAnim) {
            hoveredCpsAnim = over;
            renderSceneFrame();
          }
          cpsCanvasEl.style.cursor = over ? 'grab' : 'default';
        });

        cpsCanvasEl.addEventListener('mouseleave', () => {
          if (hoveredCpsAnim && !draggedCpsAnim) {
            hoveredCpsAnim = null;
            renderSceneFrame();
          }
        });

        cpsCanvasEl.addEventListener('mousedown', (e) => {
          if (e.button !== 0 || !state.cpsWithAnims) return;
          const { x, y } = getCpsCanvasCoords(e.clientX, e.clientY);
          const targetAnim = findAnimAtCoords(x, y);
          if (targetAnim) {
            draggedCpsAnim = targetAnim;
            const pos = getAnimPos(targetAnim);
            dragGrabX = x - pos.x;
            dragGrabY = y - pos.y;
            cpsCanvasEl.style.cursor = 'grabbing';
            window.addEventListener('mousemove', onCpsWindowMouseMove);
            window.addEventListener('mouseup', onCpsWindowMouseUp);
            renderSceneFrame();
          }
        });
      }
    }

    if (state.cpsWithAnims && hasLinkedWsas) {
      startCpsAnimation();
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

    const cropBottomPanelCheck = document.getElementById('cropBottomPanelCheck');
    if (cropBottomPanelCheck) {
      cropBottomPanelCheck.addEventListener('change', (e) => {
        state.cropBottomPanel = e.target.checked;
        const canvas = document.getElementById('cpsCanvas');
        if (canvas) {
          canvas.height = state.cropBottomPanel ? 144 : 200;
        }
        updateCpsUrls();
        if (state.cpsWithAnims && hasLinkedWsas) {
          renderSceneFrame();
        }
        applyCpsZoom(state.zoomLevel, false);
      });
    }

    const stageImg = document.getElementById('stageImg');
    if (stageImg) {
      stageImg.onload = () => {
        if (state.cpsWithAnims && hasLinkedWsas) {
          renderSceneFrame();
        }
        applyCpsZoom(state.zoomLevel, false);
        updateViewportScrollState();
      };
    }

    // Apply active zoom sizing immediately
    applyCpsZoom(state.zoomLevel, false);
  }

  // 1b. Cutscene Transition Table Viewer (.CMP) - Description View (No Preview Image)
  async function renderCmpTransitionViewer(asset, details) {
    stopAllPlayback();

    const baseName = asset.name.replace(/\.CMP$/i, '');
    const exportBinUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&uncompressed=1`;
    const exportCmpUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;

    el.viewerActions.innerHTML = `
      <a href="${exportBinUrl}" download="${baseName}.BIN" class="btn btn-primary glow-btn" title="Download Uncompressed 64KB Lookup Table">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download Uncompressed Table (.BIN - 64 KB)</span>
      </a>
      <a href="${exportCmpUrl}" download="${asset.name}" class="btn btn-secondary" title="Download Compressed Format 80 .CMP File">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download Original (.CMP - ${formatBytes(asset.size)})</span>
      </a>
    `;

    const uncompSize = (details && details.uncompressed_size) || (asset && asset.uncompressed_size) || 65532;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Type: <strong>Transition Color Table (.CMP)</strong></div>
      <div class="meta-chip highlight-chip" style="border-color: rgba(52, 211, 153, 0.4); background: rgba(16, 185, 129, 0.14);">
        Uncompressed: <strong style="color: #34d399;">${formatBytes(uncompSize)} (Uncompressed value shown)</strong>
      </div>
      <div class="meta-chip">Compressed: <strong>${formatBytes(asset.size)}</strong></div>
      <div class="meta-chip">Compression: <strong>Format 80 (LCW)${details.compression_ratio ? ` (${details.compression_ratio})` : ''}</strong></div>
      <div class="meta-chip" style="background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
        Status: <strong>Hidden by default (Non-useful)</strong>
      </div>
      <div class="meta-chip">Routine: <code>nestedFrameFadeTransition()</code></div>
    `;

    el.interactiveControls.innerHTML = '';

    el.viewerStage.innerHTML = `
      <div class="cmp-stage-container">
        <div class="cmp-description-card">
          <div class="cmp-desc-header">
            <span class="cmp-desc-icon">🔀</span>
            <div class="cmp-desc-titles">
              <h2 class="cmp-desc-title">${escapeHtml(asset.name)}</h2>
              <span class="cmp-desc-subtitle">Westwood Cutscene Cross-Fade Transition Table • Archive: ${escapeHtml(asset.pak_name)}</span>
            </div>
            <span class="cmp-hidden-pill" title="Hidden by default under 'Hide non-useful files' filter">Hidden File Type</span>
          </div>

          <div class="cmp-desc-body">
            <div class="cmp-desc-section">
              <h4 class="cmp-section-title">📌 File Description</h4>
              <p class="cmp-desc-paragraph">
                <strong>${escapeHtml(asset.name)}</strong> is <em>not an image or background scene</em>. It is a precomputed 256×256 ($65,536$-entry) mathematical color-blending lookup table used exclusively by Westwood's cutscene engine (<code>nestedFrameFadeTransition</code> in <code>sequences_hof.cpp</code>) during the game's cinematic intro sequence.
              </p>
            </div>

            <div class="cmp-desc-section">
              <h4 class="cmp-section-title">⚙️ Engine Function & Mechanics</h4>
              <p class="cmp-desc-paragraph">
                In 1993, 386 and 486 DOS PCs lacked hardware 3D acceleration or sufficient CPU power to calculate real-time software alpha-blending across 64,000 pixels at 60 fps. To create smooth cross-fades between intro scenes, Westwood precalculated a 64 KB lookup table that allowed single-cycle table indexing in assembly:
              </p>
              <pre class="cmp-code-block"><code>// From Westwood Studios / ScummVM Kyra Engine (screen_hof.cpp):
for (int i = 0; i &lt; W2; i++) {
    int ix = (*src++ &lt;&lt; 8) + *dst;
    *dst++ = cmp[ix];   // Single instruction color blend lookup
}</code></pre>
              <p class="cmp-desc-paragraph">
                The lookup indexes <code>(source_pixel &lt;&lt; 8) + dest_pixel</code> to obtain the optimal intermediate palette color. Applying this step 3 times in succession creates a smooth 3-stage cross-dissolve between animation frames.
              </p>
            </div>

            <div class="cmp-desc-section">
              <h4 class="cmp-section-title">📊 Technical Specifications</h4>
              <div class="cmp-specs-grid">
                <div class="cmp-spec-item">
                  <span class="spec-label">Archive File:</span>
                  <span class="spec-val">${escapeHtml(asset.pak_name)}</span>
                </div>
                <div class="cmp-spec-item">
                  <span class="spec-label">Format:</span>
                  <span class="spec-val">Westwood Format 80 (LCW)</span>
                </div>
                <div class="cmp-spec-item">
                  <span class="spec-label">Uncompressed Size:</span>
                  <span class="spec-val">65,532 bytes (64.0 KB uncompressed value shown)</span>
                </div>
                <div class="cmp-spec-item">
                  <span class="spec-label">Compressed Size:</span>
                  <span class="spec-val">${formatBytes(asset.size)} (${details.compression_ratio || ''})</span>
                </div>
                <div class="cmp-spec-item">
                  <span class="spec-label">Table Dimensions:</span>
                  <span class="spec-val">256 × 256 matrix (65,536 blend pairs)</span>
                </div>
                <div class="cmp-spec-item">
                  <span class="spec-label">Classification:</span>
                  <span class="spec-val">Non-image asset (Hidden file type)</span>
                </div>
              </div>
            </div>

            <!-- Interactive Color Morph & Fade Simulator -->
            <div class="cmp-simulator-card" style="margin-top: 8px;">
              <div class="cmp-card-header">
                <span>⚡ Interactive Color Morph & Fade Simulator</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">Simulates the engine's 3-step cross-dissolve formula</span>
              </div>

              <div class="cmp-blend-inspect">
                <div class="cmp-color-node">
                  <span class="cmp-node-label">Source (S)</span>
                  <div class="cmp-swatch" id="cmpSrcSwatch" style="background: #000;"></div>
                  <div class="cmp-node-val" id="cmpSrcVal">Index: 10</div>
                  <input type="range" id="cmpSrcSlider" min="0" max="255" value="10" class="cmp-slider">
                </div>

                <div class="cmp-blend-arrow">+</div>

                <div class="cmp-color-node">
                  <span class="cmp-node-label">Dest (D)</span>
                  <div class="cmp-swatch" id="cmpDstSwatch" style="background: #000;"></div>
                  <div class="cmp-node-val" id="cmpDstVal">Index: 50</div>
                  <input type="range" id="cmpDstSlider" min="0" max="255" value="50" class="cmp-slider">
                </div>

                <div class="cmp-blend-arrow">➔</div>

                <div class="cmp-color-node highlight">
                  <span class="cmp-node-label">Blend Step 1</span>
                  <div class="cmp-swatch" id="cmpResSwatch" style="background: #000;"></div>
                  <div class="cmp-node-val" id="cmpResVal">Index: 69</div>
                  <span class="cmp-step-tag">CMP Result</span>
                </div>
              </div>

              <div class="cmp-fade-preview-box">
                <div class="cmp-fade-title">Engine 3-Step Dissolve (Start S ➔ Step 1 ➔ Step 2 ➔ Dest D)</div>
                <div class="cmp-fade-steps">
                  <div class="cmp-fade-box" id="fadeStep0"><span class="box-label">S</span></div>
                  <span class="fade-arrow">➔</span>
                  <div class="cmp-fade-box" id="fadeStep1"><span class="box-label">1</span></div>
                  <span class="fade-arrow">➔</span>
                  <div class="cmp-fade-box" id="fadeStep2"><span class="box-label">2</span></div>
                  <span class="fade-arrow">➔</span>
                  <div class="cmp-fade-box" id="fadeStep3"><span class="box-label">D</span></div>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-top:6px;">
                  <button id="cmpPlayFadeBtn" class="btn btn-secondary btn-sm" style="font-size:0.76rem; padding: 4px 10px;">
                    <span>▶ Play Dissolve Animation</span>
                  </button>
                  <div id="fadeLiveBox" style="width:24px; height:24px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); background:#000;" title="Live fade preview"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Fetch uncompressed binary table
    let tableBytes = null;
    try {
      const resp = await fetch(exportBinUrl);
      const buf = await resp.arrayBuffer();
      tableBytes = new Uint8Array(buf);
    } catch (e) {
      console.warn('Could not fetch uncompressed CMP buffer:', e);
    }

    // Palette lookup
    const palette = (details.full_palette && details.full_palette.length >= 256)
      ? details.full_palette
      : Array.from({ length: 256 }, (_, i) => [i, i, i]);

    function getColorRgb(idx) {
      const c = palette[idx % 256] || [0, 0, 0];
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }

    // Blend Simulator elements
    const srcSlider = document.getElementById('cmpSrcSlider');
    const dstSlider = document.getElementById('cmpDstSlider');
    const srcVal = document.getElementById('cmpSrcVal');
    const dstVal = document.getElementById('cmpDstVal');
    const resVal = document.getElementById('cmpResVal');
    const srcSwatch = document.getElementById('cmpSrcSwatch');
    const dstSwatch = document.getElementById('cmpDstSwatch');
    const resSwatch = document.getElementById('cmpResSwatch');

    const fadeStep0 = document.getElementById('fadeStep0');
    const fadeStep1 = document.getElementById('fadeStep1');
    const fadeStep2 = document.getElementById('fadeStep2');
    const fadeStep3 = document.getElementById('fadeStep3');
    const fadeLiveBox = document.getElementById('fadeLiveBox');
    const playFadeBtn = document.getElementById('cmpPlayFadeBtn');

    function updateSimulation(s, d) {
      s = Math.max(0, Math.min(255, Math.round(s)));
      d = Math.max(0, Math.min(255, Math.round(d)));

      if (srcSlider && document.activeElement !== srcSlider) srcSlider.value = s;
      if (dstSlider && document.activeElement !== dstSlider) dstSlider.value = d;

      if (srcVal) srcVal.textContent = `Index: ${s}`;
      if (dstVal) dstVal.textContent = `Index: ${d}`;

      const sColor = getColorRgb(s);
      const dColor = getColorRgb(d);

      if (srcSwatch) srcSwatch.style.background = sColor;
      if (dstSwatch) dstSwatch.style.background = dColor;

      let step1 = d, step2 = d, step3 = d;
      if (tableBytes && tableBytes.length >= 65532) {
        step1 = tableBytes[(s << 8) + d] || 0;
        step2 = tableBytes[(step1 << 8) + d] || 0;
        step3 = tableBytes[(step2 << 8) + d] || 0;
      }

      const resColor = getColorRgb(step1);
      if (resSwatch) resSwatch.style.background = resColor;
      if (resVal) resVal.textContent = `Index: ${step1}`;

      const step2Color = getColorRgb(step2);

      if (fadeStep0) fadeStep0.style.background = sColor;
      if (fadeStep1) fadeStep1.style.background = resColor;
      if (fadeStep2) fadeStep2.style.background = step2Color;
      if (fadeStep3) fadeStep3.style.background = dColor;
      if (fadeLiveBox) fadeLiveBox.style.background = sColor;
    }

    if (srcSlider) {
      srcSlider.addEventListener('input', () => {
        updateSimulation(parseInt(srcSlider.value) || 0, parseInt(dstSlider.value) || 0);
      });
    }

    if (dstSlider) {
      dstSlider.addEventListener('input', () => {
        updateSimulation(parseInt(srcSlider.value) || 0, parseInt(dstSlider.value) || 0);
      });
    }

    // Play dissolve animation
    let fadeAnimTimer = null;
    if (playFadeBtn) {
      playFadeBtn.addEventListener('click', () => {
        if (fadeAnimTimer) clearInterval(fadeAnimTimer);
        const s = parseInt(srcSlider ? srcSlider.value : 10) || 10;
        const d = parseInt(dstSlider ? dstSlider.value : 50) || 50;
        let step1 = d, step2 = d;
        if (tableBytes && tableBytes.length >= 65532) {
          step1 = tableBytes[(s << 8) + d] || 0;
          step2 = tableBytes[(step1 << 8) + d] || 0;
        }
        const colors = [getColorRgb(s), getColorRgb(step1), getColorRgb(step2), getColorRgb(d)];
        let fIdx = 0;
        if (fadeLiveBox) fadeLiveBox.style.background = colors[0];
        fadeAnimTimer = setInterval(() => {
          fIdx++;
          if (fIdx < colors.length) {
            if (fadeLiveBox) fadeLiveBox.style.background = colors[fIdx];
          } else {
            clearInterval(fadeAnimTimer);
            fadeAnimTimer = null;
          }
        }, 180);
      });
    }

    // Initial update with default values 10 and 50
    updateSimulation(10, 50);
  }

  // 2. Model & Character Viewer (.SHP)
  function renderModelViewer(asset, details) {
    const numFrames = details.num_frames || 1;
    state.modelCurrentFrame = 0;
    state.modelPlaying = false;

    const baseName = asset.name.replace(/\.(SHP|CSH)$/i, '');
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
      ${asset.ext === '.CSH' ? `
      <a href="/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&uncompressed=1" download="${baseName}.SHP" class="btn btn-secondary" title="Download Format 80 Uncompressed .SHP Sprite Archive">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download Uncompressed (.SHP)</span>
      </a>` : ''}
    `;

    el.viewerStage.innerHTML = `
      <div class="cps-viewport-stage" id="modelViewportStage">
        <div class="cps-canvas-wrapper ${state.modelBackdrop || 'bg-checker'} ${state.scanlinesActive ? 'crt-overlay' : ''}" id="modelWrap" style="min-width: 120px; min-height: 120px;">
          <img id="modelImg" src="/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=0" class="display-canvas" alt="${asset.name}">
        </div>
      </div>
    `;

    const maxModelFrameStr = `${numFrames} / ${numFrames}`;
    el.metaChips.innerHTML = `
      <div class="meta-chip meta-chip-counter">Frames: <strong id="frameIndicator" style="min-width: ${maxModelFrameStr.length}ch;">1 / ${numFrames}</strong></div>
      <div class="meta-chip">Max Frame Size: <strong>${details.max_width || 0}x${details.max_height || 0} px</strong></div>
      <div class="meta-chip">Format: <strong>${asset.ext === '.CSH' ? 'Format 80 Compressed Shape' : 'Westwood Compact Shape'}</strong></div>
      ${details.is_compressed ? `<div class="meta-chip">Compression: <strong>${escapeHtml(details.compression_type)} (${details.compression_ratio})</strong></div><div class="meta-chip">Uncompressed: <strong>${formatBytes(details.uncompressed_size)}</strong></div>` : ''}
      <div class="meta-chip">File Size: <strong>${formatBytes(asset.size)}</strong></div>
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

        <div class="ctrl-btn-group" title="Zoom Multiplier">
          <button class="ctrl-btn ${state.modelZoomLevel === 'fit' ? 'active' : ''}" data-mzoom="fit" title="Fit to Preview Window">Fit</button>
          <button class="ctrl-btn ${state.modelZoomLevel === 1 ? 'active' : ''}" data-mzoom="1" title="1x Native Size">1x</button>
          <button class="ctrl-btn ${state.modelZoomLevel === 2 ? 'active' : ''}" data-mzoom="2" title="2x Scale">2x</button>
          <button class="ctrl-btn ${state.modelZoomLevel === 3 ? 'active' : ''}" data-mzoom="3" title="3x Scale">3x</button>
          <button class="ctrl-btn ${state.modelZoomLevel === 4 ? 'active' : ''}" data-mzoom="4" title="4x Scale">4x</button>
        </div>

        <button id="modelToggleCrtBtn" class="btn btn-secondary ${state.scanlinesActive ? 'active' : ''}" style="font-size: 0.78rem;">
          <span>📺 CRT Scanlines</span>
        </button>

        <div class="ctrl-btn-group" title="Backdrop Style">
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-checker' ? 'active' : ''}" data-bg="bg-checker">Grid</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-dark' ? 'active' : ''}" data-bg="bg-dark">Dark</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-light' ? 'active' : ''}" data-bg="bg-light">Light</button>
          <button class="ctrl-btn ${state.modelBackdrop === 'bg-chroma' ? 'active' : ''}" data-bg="bg-chroma">Green</button>
        </div>
      </div>
    `;

    const modelImg = document.getElementById('modelImg');
    const modelScrubber = document.getElementById('modelScrubber');
    const frameIndicator = document.getElementById('frameIndicator');
    const exportCurFrameBtn = document.getElementById('exportCurFrameBtn');

    function applyModelZoom(level, centerView = false) {
      state.modelZoomLevel = level;
      const img = document.getElementById('modelImg');
      const wrap = document.getElementById('modelWrap');
      if (!img || !wrap) return;

      el.interactiveControls.querySelectorAll('[data-mzoom]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mzoom === String(level));
      });

      const baseW = img.naturalWidth || details.max_width || 120;
      const baseH = img.naturalHeight || details.max_height || 120;
      const aspect = baseW / baseH;

      if (level === 'fit') {
        const stage = el.viewerStage;
        const padX = 52;
        const padY = 52;
        const availW = Math.max((stage ? stage.clientWidth : window.innerWidth) - padX, 100);
        const availH = Math.max((stage ? stage.clientHeight : window.innerHeight) - padY, 100);

        let fitW, fitH;
        if (availW / availH > aspect) {
          fitH = availH;
          fitW = fitH * aspect;
        } else {
          fitW = availW;
          fitH = fitW / aspect;
        }

        const roundedW = Math.round(fitW);
        const roundedH = Math.round(fitH);
        wrap.style.width = `${roundedW}px`;
        wrap.style.height = `${roundedH}px`;
        img.style.width = `${roundedW}px`;
        img.style.height = `${roundedH}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
      } else {
        const mult = parseInt(level);
        const w = baseW * mult;
        const h = baseH * mult;
        wrap.style.width = `${w}px`;
        wrap.style.height = `${h}px`;
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
      }

      requestAnimationFrame(() => {
        const stage = el.viewerStage;
        if (stage) {
          if (level === 'fit') {
            stage.scrollLeft = 0;
            stage.scrollTop = 0;
          } else if (centerView) {
            if (stage.scrollWidth > stage.clientWidth) {
              stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
            }
            if (stage.scrollHeight > stage.clientHeight) {
              stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
            }
          }
        }
        updateViewportScrollState();
      });
    }

    state.reapplyZoom = () => {
      applyModelZoom(state.modelZoomLevel, false);
    };

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

    modelImg.onload = () => {
      applyModelZoom(state.modelZoomLevel, false);
      updateViewportScrollState();
    };

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

    // Zoom listeners
    el.interactiveControls.querySelectorAll('[data-mzoom]').forEach(b => {
      b.addEventListener('click', (e) => {
        const targetZoom = e.target.dataset.mzoom === 'fit' ? 'fit' : parseInt(e.target.dataset.mzoom);
        applyModelZoom(targetZoom, true);
      });
    });

    document.getElementById('modelToggleCrtBtn').addEventListener('click', (e) => {
      state.scanlinesActive = !state.scanlinesActive;
      e.currentTarget.classList.toggle('active', state.scanlinesActive);
      const wrap = document.getElementById('modelWrap');
      if (wrap) wrap.classList.toggle('crt-overlay', state.scanlinesActive);
    });

    // Backdrop selector
    el.interactiveControls.querySelectorAll('[data-bg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.modelBackdrop = e.target.dataset.bg;
        el.interactiveControls.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const wrap = document.getElementById('modelWrap');
        if (wrap) wrap.className = `cps-canvas-wrapper ${state.modelBackdrop} ${state.scanlinesActive ? 'crt-overlay' : ''}`;
      });
    });

    applyModelZoom(state.modelZoomLevel, false);
  }

  // 3. Animation Viewer (.WSA)
  function renderAnimationViewer(asset, details) {
    const numFrames = details.num_frames || 1;
    const width = details.width || 320;
    const height = details.height || 200;
    const sheetCols = details.sheet_cols || Math.min(numFrames, 8);
    const isFullScreen = (width === 320 && height === 200);
    const posX = details.pos_x || 0;
    const posY = details.pos_y || 0;
    const hasBg = !!details.has_bg;
    const bgName = details.bg_name || '';

    // Check localStorage for saved custom offset
    const storageKey = `wsa_offset_${asset.pak_name}_${asset.name}`;
    let savedPos = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedPos = JSON.parse(raw);
    } catch (e) {}

    let currentPosX = (savedPos && typeof savedPos.x === 'number') ? savedPos.x : posX;
    let currentPosY = (savedPos && typeof savedPos.y === 'number') ? savedPos.y : posY;

    // Reset runtime states
    state.animCurrentFrame = 0;
    state.animPlaying = false;
    if (state.animTimer) clearInterval(state.animTimer);

    // Initial backdrop & background state
    if (hasBg && (state.animBackdrop === 'bg-scene' || state.animWithBg)) {
      state.animWithBg = true;
      state.animBackdrop = 'bg-scene';
    } else {
      state.animWithBg = false;
      if (state.animBackdrop === 'bg-scene') {
        state.animBackdrop = 'bg-checker';
      }
    }

    // Initial canvas sizing depends on scene mode for sub-rect overlays
    if (isFullScreen) {
      state.animSceneMode = 'crop';
    } else if (state.animWithBg && hasBg) {
      state.animSceneMode = 'scene';
    }
    const sceneH = state.cropBottomPanel ? 144 : 200;
    const initW = (state.animSceneMode === 'scene' && !isFullScreen) ? 320 : width;
    const initH = (state.animSceneMode === 'scene' && !isFullScreen) ? sceneH : height;

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
      <a id="exportGifBtn" href="${exportGifUrl}" download="${baseName}.gif" class="btn btn-primary glow-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
        <span>Export Animated GIF</span>
      </a>
    `;

    const wrapBgClass = (state.animBackdrop === 'bg-scene') ? 'bg-checker' : (state.animBackdrop || 'bg-checker');
    el.viewerStage.innerHTML = `
      <div class="cps-viewport-stage" id="animViewportStage">
        <div class="cps-canvas-wrapper ${wrapBgClass} ${state.scanlinesActive ? 'crt-overlay' : ''}" id="animWrap">
          <canvas id="animCanvas" width="${initW}" height="${initH}" class="display-canvas" alt="${asset.name}"></canvas>
        </div>
      </div>
    `;

    const maxAnimFrameStr = `${numFrames} / ${numFrames}`;
    const isCustomOffset = !isFullScreen && (currentPosX !== posX || currentPosY !== posY);
    el.metaChips.innerHTML = `
      <div class="meta-chip meta-chip-counter">Total Frames: <strong id="animFrameInd" style="min-width: ${maxAnimFrameStr.length}ch;">1 / ${numFrames}</strong></div>
      <div class="meta-chip">Native Dimensions: <strong>${width}x${height} px</strong></div>
      <div class="meta-chip" id="wsaOffsetChip">Scene Offset: <strong id="wsaOffsetDisplay">(${currentPosX}, ${currentPosY})</strong>${isCustomOffset ? ` <span style="opacity:0.7; font-size:0.75rem;">(Orig: ${posX}, ${posY})</span>` : ''}</div>
      <div class="meta-chip">Type: <strong>${isFullScreen ? 'Full Scene Cinema (320x200)' : 'Scene Animation Overlay'}</strong></div>
      ${hasBg ? `<div class="meta-chip" title="Matching Room Background from ${details.bg_pak || ''}">Room Background: <strong style="color: var(--accent-emerald-light);">${bgName}</strong></div>` : ''}
      <div class="meta-chip">Format: <strong>Format 80 + 40 Delta</strong></div>
    `;

    const sceneModeToggleHtml = !isFullScreen ? `
      <div class="ctrl-btn-group" title="Frame Mode">
        <button class="ctrl-btn ${state.animSceneMode === 'crop' ? 'active' : ''}" id="animCropBtn" title="Crop tightly to animation bounds (${width}x${height})">Crop (${width}x${height})</button>
        <button class="ctrl-btn ${state.animSceneMode === 'scene' ? 'active' : ''}" id="animSceneBtn" title="Display in full ${state.cropBottomPanel ? '320x144' : '320x200'} room scene">${state.cropBottomPanel ? '320x144' : '320x200'} Scene</button>
      </div>
    ` : '';

    const posControlHtml = !isFullScreen ? `
      <div class="wsa-pos-control" id="wsaPosControl" title="Move WSA overlay on room scene (drag on canvas or adjust X/Y coordinates)">
        <span class="wsa-pos-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="19 9 22 12 19 15"></polyline><polyline points="9 19 12 22 15 19"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
          Overlay Pos
        </span>
        <label class="wsa-pos-coord" title="Horizontal position in pixels">
          <span>X</span>
          <input type="number" id="wsaPosXInput" class="wsa-coord-input" value="${currentPosX}" step="1">
        </label>
        <label class="wsa-pos-coord" title="Vertical position in pixels">
          <span>Y</span>
          <input type="number" id="wsaPosYInput" class="wsa-coord-input" value="${currentPosY}" step="1">
        </label>
        <button id="wsaResetPosBtn" class="wsa-pos-reset-btn" title="Reset to original file offset (${posX}, ${posY})">Reset</button>
        <span class="wsa-pos-hint" title="You can also click and drag the animation overlay directly on the canvas">💡 Drag on canvas</span>
      </div>
    ` : '';

    const cropPanelCheckboxHtml = `
      <label class="ctrl-checkbox-label" title="Remove the bottom 56px interface panel in scene mode (crops from 320x200 down to 320x144 scene viewport)">
        <input type="checkbox" id="animCropPanelCheck" ${state.cropBottomPanel ? 'checked' : ''}>
        <span class="checkbox-text">Remove Bottom Panel</span>
      </label>
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

        <div class="ctrl-btn-group" title="Zoom Multiplier">
          <button class="ctrl-btn ${state.animZoomLevel === 'fit' ? 'active' : ''}" data-azoom="fit" title="Fit to Preview Window (Zero Clipping)">Fit</button>
          <button class="ctrl-btn ${state.animZoomLevel === 1 ? 'active' : ''}" data-azoom="1" title="1x Native Size">1x</button>
          <button class="ctrl-btn ${state.animZoomLevel === 2 ? 'active' : ''}" data-azoom="2" title="2x Scale">2x</button>
          <button class="ctrl-btn ${state.animZoomLevel === 3 ? 'active' : ''}" data-azoom="3" title="3x Scale">3x</button>
          <button class="ctrl-btn ${state.animZoomLevel === 4 ? 'active' : ''}" data-azoom="4" title="4x Scale">4x</button>
        </div>

        <button id="animToggleCrtBtn" class="btn btn-secondary ${state.scanlinesActive ? 'active' : ''}" style="font-size: 0.78rem;">
          <span>📺 CRT Scanlines</span>
        </button>

        <div class="ctrl-btn-group" title="Backdrop Style">
          <button class="ctrl-btn ${state.animWithBg ? 'active' : ''} ${!hasBg ? 'disabled' : ''}" data-abg="bg-scene" ${!hasBg ? 'disabled' : ''} title="${hasBg ? `Composite animation over room background (${bgName})` : 'No matching room background found'}">Scene Background</button>
          <button class="ctrl-btn ${(!state.animWithBg && state.animBackdrop === 'bg-checker') ? 'active' : ''}" data-abg="bg-checker" title="Checkerboard grid transparency backdrop">Grid</button>
          <button class="ctrl-btn ${(!state.animWithBg && state.animBackdrop === 'bg-dark') ? 'active' : ''}" data-abg="bg-dark" title="Dark charcoal backdrop">Dark</button>
          <button class="ctrl-btn ${(!state.animWithBg && state.animBackdrop === 'bg-light') ? 'active' : ''}" data-abg="bg-light" title="Light grey backdrop">Light</button>
          <button class="ctrl-btn ${(!state.animWithBg && state.animBackdrop === 'bg-chroma') ? 'active' : ''}" data-abg="bg-chroma" title="Chroma green backdrop">Green</button>
        </div>

        ${cropPanelCheckboxHtml}

        ${sceneModeToggleHtml}

        ${posControlHtml}
      </div>
    `;

    const canvas = document.getElementById('animCanvas');
    const animScrubber = document.getElementById('animScrubber');
    const animFrameInd = document.getElementById('animFrameInd');
    const exportAnimFrameBtn = document.getElementById('exportAnimFrameBtn');

    function applyAnimZoom(level, centerView = false) {
      state.animZoomLevel = level;
      const targetCanvas = document.getElementById('animCanvas');
      const wrap = document.getElementById('animWrap');
      if (!targetCanvas || !wrap) return;

      el.interactiveControls.querySelectorAll('[data-azoom]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.azoom === String(level));
      });

      const targetW = targetCanvas.width;
      const targetH = targetCanvas.height;
      const aspect = targetW / targetH;

      if (level === 'fit') {
        const stage = el.viewerStage;
        const padX = 52;
        const padY = 52;
        const availW = Math.max((stage ? stage.clientWidth : window.innerWidth) - padX, 100);
        const availH = Math.max((stage ? stage.clientHeight : window.innerHeight) - padY, 100);

        let fitW, fitH;
        if (availW / availH > aspect) {
          fitH = availH;
          fitW = fitH * aspect;
        } else {
          fitW = availW;
          fitH = fitW / aspect;
        }

        const roundedW = Math.round(fitW);
        const roundedH = Math.round(fitH);
        wrap.style.width = `${roundedW}px`;
        wrap.style.height = `${roundedH}px`;
        targetCanvas.style.width = `${roundedW}px`;
        targetCanvas.style.height = `${roundedH}px`;
        targetCanvas.style.maxWidth = 'none';
        targetCanvas.style.maxHeight = 'none';
        targetCanvas.style.aspectRatio = `${targetW} / ${targetH}`;
      } else {
        const mult = parseInt(level);
        const w = targetW * mult;
        const h = targetH * mult;
        wrap.style.width = `${w}px`;
        wrap.style.height = `${h}px`;
        targetCanvas.style.width = `${w}px`;
        targetCanvas.style.height = `${h}px`;
        targetCanvas.style.maxWidth = 'none';
        targetCanvas.style.maxHeight = 'none';
        targetCanvas.style.aspectRatio = `${targetW} / ${targetH}`;
      }

      requestAnimationFrame(() => {
        const stage = el.viewerStage;
        if (stage) {
          if (level === 'fit') {
            stage.scrollLeft = 0;
            stage.scrollTop = 0;
          } else if (centerView) {
            if (stage.scrollWidth > stage.clientWidth) {
              stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
            }
            if (stage.scrollHeight > stage.clientHeight) {
              stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
            }
          }
        }
        updateViewportScrollState();
      });
    }

    state.reapplyZoom = () => {
      applyAnimZoom(state.animZoomLevel, false);
    };

    // Preload background if available
    const bgImg = new Image();
    let bgReady = false;
    if (hasBg) {
      bgImg.onload = () => {
        bgReady = true;
        if (state.animWithBg) {
          drawAnimFrame(state.animCurrentFrame);
        }
      };
      bgImg.src = `/api/asset/preview?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&bg=1`;
    }

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

    function updateExportUrls() {
      const withBgActive = (state.animWithBg && hasBg);
      const isScene = (state.animSceneMode === 'scene' && !isFullScreen);
      const withBgParam = withBgActive ? '&with_bg=1' : '';
      const fullSceneParam = isScene ? '&full_scene=1' : '';
      const cropPanelParam = (isScene && state.cropBottomPanel) ? '&crop_panel=1' : '';
      const posParam = !isFullScreen ? `&pos_x=${currentPosX}&pos_y=${currentPosY}` : '';

      exportAnimFrameBtn.href = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&frame=${state.animCurrentFrame}${withBgParam}${fullSceneParam}${cropPanelParam}${posParam}`;
      exportAnimFrameBtn.download = `${baseName}_frame${state.animCurrentFrame}${withBgActive ? '_bg' : ''}${cropPanelParam ? '_scene' : ''}.png`;

      const exportGifBtn = document.getElementById('exportGifBtn');
      if (exportGifBtn) {
        exportGifBtn.href = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&gif=1${withBgParam}${fullSceneParam}${cropPanelParam}${posParam}`;
        exportGifBtn.download = `${baseName}${withBgActive ? '_bg' : ''}${cropPanelParam ? '_scene' : ''}.gif`;
      }
    }

    function drawAnimFrame(idx) {
      state.animCurrentFrame = (idx + numFrames) % numFrames;
      animScrubber.value = state.animCurrentFrame;
      animFrameInd.textContent = `${state.animCurrentFrame + 1} / ${numFrames}`;
      updateExportUrls();

      const targetCanvas = document.getElementById('animCanvas');
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      const inSceneMode = state.animSceneMode === 'scene' && !isFullScreen;
      const dstX = inSceneMode ? currentPosX : 0;
      const dstY = inSceneMode ? currentPosY : 0;

      function renderToCanvas(srcImage, srcX, srcY, srcW, srcH) {
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Draw background if active and loaded
        if (state.animWithBg && hasBg && bgReady) {
          if (inSceneMode) {
            const sceneH = state.cropBottomPanel ? 144 : 200;
            ctx.drawImage(bgImg, 0, 0, 320, sceneH, 0, 0, 320, sceneH);
          } else {
            // Cropped mode: draw slice of background matching animation bounds
            const srcBgX = Math.max(0, Math.min(320, currentPosX));
            const srcBgY = Math.max(0, Math.min(200, currentPosY));
            const srcBgW = Math.max(0, Math.min(320 - srcBgX, width));
            const srcBgH = Math.max(0, Math.min(200 - srcBgY, height));
            const dstBgX = srcBgX - currentPosX;
            const dstBgY = srcBgY - currentPosY;
            if (srcBgW > 0 && srcBgH > 0) {
              ctx.drawImage(bgImg, srcBgX, srcBgY, srcBgW, srcBgH, dstBgX, dstBgY, srcBgW, srcBgH);
            }
          }
        }

        ctx.drawImage(srcImage, srcX, srcY, srcW, srcH, dstX, dstY, width, height);

        if (inSceneMode) {
          const showOutline = (!state.animWithBg || !hasBg) || isHoveringOverlay || isDragging;
          if (showOutline) {
            ctx.save();
            ctx.strokeStyle = isDragging ? '#38bdf8' : (isHoveringOverlay ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.6)');
            ctx.lineWidth = 1;
            ctx.setLineDash(isDragging ? [4, 2] : [3, 2]);
            ctx.strokeRect(dstX + 0.5, dstY + 0.5, width - 1, height - 1);
            ctx.restore();
          }
        }
      }

      if (sheetReady) {
        const c = state.animCurrentFrame % sheetCols;
        const r = Math.floor(state.animCurrentFrame / sheetCols);
        renderToCanvas(sheetImg, c * width, r * height, width, height);
      } else {
        getFallbackFrame(state.animCurrentFrame, (img) => {
          if (!sheetReady) {
            renderToCanvas(img, 0, 0, width, height);
          }
        });
      }
    }

    // Initial frame 0 render
    getFallbackFrame(0, (img) => {
      if (!sheetReady) {
        drawAnimFrame(0);
      }
    });

    function setAnimSceneMode(mode) {
      state.animSceneMode = mode;
      const targetCanvas = document.getElementById('animCanvas');
      if (!targetCanvas) return;

      const isScene = (mode === 'scene' && !isFullScreen);
      const sceneH = state.cropBottomPanel ? 144 : 200;

      if (isScene) {
        targetCanvas.width = 320;
        targetCanvas.height = sceneH;
      } else {
        targetCanvas.width = width;
        targetCanvas.height = height;
      }

      const cropBtn = document.getElementById('animCropBtn');
      const sceneBtn = document.getElementById('animSceneBtn');
      if (cropBtn) cropBtn.classList.toggle('active', mode === 'crop');
      if (sceneBtn) {
        sceneBtn.classList.toggle('active', mode === 'scene');
        sceneBtn.textContent = `${state.cropBottomPanel ? '320x144' : '320x200'} Scene`;
      }

      applyAnimZoom(state.animZoomLevel || 'fit', false);
      updateExportUrls();
      drawAnimFrame(state.animCurrentFrame);
    }

    if (!isFullScreen) {
      const cropBtn = document.getElementById('animCropBtn');
      const sceneBtn = document.getElementById('animSceneBtn');
      if (cropBtn) cropBtn.addEventListener('click', () => setAnimSceneMode('crop'));
      if (sceneBtn) sceneBtn.addEventListener('click', () => setAnimSceneMode('scene'));
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

    // Zoom listeners
    el.interactiveControls.querySelectorAll('[data-azoom]').forEach(b => {
      b.addEventListener('click', (e) => {
        const targetZoom = e.target.dataset.azoom === 'fit' ? 'fit' : parseInt(e.target.dataset.azoom);
        applyAnimZoom(targetZoom, true);
      });
    });

    document.getElementById('animToggleCrtBtn').addEventListener('click', (e) => {
      state.scanlinesActive = !state.scanlinesActive;
      e.currentTarget.classList.toggle('active', state.scanlinesActive);
      const wrap = document.getElementById('animWrap');
      if (wrap) wrap.classList.toggle('crt-overlay', state.scanlinesActive);
    });

    // Backdrop selector (Scene Background, Grid, Dark, Light, Green)
    el.interactiveControls.querySelectorAll('[data-abg]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bgVal = e.currentTarget.dataset.abg;
        if (bgVal === 'bg-scene') {
          if (!hasBg) return;
          state.animWithBg = true;
          state.animBackdrop = 'bg-scene';
          const wrap = document.getElementById('animWrap');
          if (wrap) wrap.className = `cps-canvas-wrapper bg-checker ${state.scanlinesActive ? 'crt-overlay' : ''}`;
          if (!isFullScreen && state.animSceneMode !== 'scene') {
            setAnimSceneMode('scene');
          }
        } else {
          state.animWithBg = false;
          state.animBackdrop = bgVal;
          const wrap = document.getElementById('animWrap');
          if (wrap) wrap.className = `cps-canvas-wrapper ${state.animBackdrop} ${state.scanlinesActive ? 'crt-overlay' : ''}`;
        }

        el.interactiveControls.querySelectorAll('[data-abg]').forEach(b => {
          if (b.dataset.abg === 'bg-scene') {
            b.classList.toggle('active', state.animWithBg);
          } else {
            b.classList.toggle('active', !state.animWithBg && state.animBackdrop === b.dataset.abg);
          }
        });

        updateExportUrls();
        drawAnimFrame(state.animCurrentFrame);
      });
    });

    // Crop Bottom Panel checkbox listener
    const animCropPanelCheck = document.getElementById('animCropPanelCheck');
    if (animCropPanelCheck) {
      animCropPanelCheck.addEventListener('change', (e) => {
        state.cropBottomPanel = e.target.checked;
        setAnimSceneMode(state.animSceneMode);
      });
    }

    // WSA Overlay Position Dragging & Controls
    let isDragging = false;
    let dragGrabOffsetX = 0;
    let dragGrabOffsetY = 0;
    let isHoveringOverlay = false;

    function getCanvasCoords(clientX, clientY) {
      const targetCanvas = document.getElementById('animCanvas');
      if (!targetCanvas) return { x: 0, y: 0 };
      const rect = targetCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      const scaleX = targetCanvas.width / rect.width;
      const scaleY = targetCanvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function isPointInOverlay(cx, cy) {
      const inSceneMode = state.animSceneMode === 'scene' && !isFullScreen;
      if (inSceneMode) {
        return cx >= currentPosX && cx <= currentPosX + width &&
               cy >= currentPosY && cy <= currentPosY + height;
      }
      return cx >= 0 && cx <= width && cy >= 0 && cy <= height;
    }

    function updatePos(newX, newY, save = true) {
      currentPosX = Math.round(newX);
      currentPosY = Math.round(newY);

      const posXInput = document.getElementById('wsaPosXInput');
      const posYInput = document.getElementById('wsaPosYInput');
      const offsetDisplay = document.getElementById('wsaOffsetDisplay');
      const offsetChip = document.getElementById('wsaOffsetChip');

      if (posXInput && document.activeElement !== posXInput) posXInput.value = currentPosX;
      if (posYInput && document.activeElement !== posYInput) posYInput.value = currentPosY;
      if (offsetDisplay) offsetDisplay.textContent = `(${currentPosX}, ${currentPosY})`;
      if (offsetChip) {
        const isCustom = (currentPosX !== posX || currentPosY !== posY);
        offsetChip.innerHTML = `Scene Offset: <strong id="wsaOffsetDisplay">(${currentPosX}, ${currentPosY})</strong>${isCustom ? ` <span style="opacity:0.7; font-size:0.75rem;">(Orig: ${posX}, ${posY})</span>` : ''}`;
      }

      if (save) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ x: currentPosX, y: currentPosY }));
        } catch (e) {}
      }

      updateExportUrls();
      drawAnimFrame(state.animCurrentFrame);
    }

    if (!isFullScreen && canvas) {
      canvas.addEventListener('mousemove', (e) => {
        if (isDragging) return;
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        const over = isPointInOverlay(x, y);
        if (over !== isHoveringOverlay) {
          isHoveringOverlay = over;
          drawAnimFrame(state.animCurrentFrame);
        }
        const inSceneMode = state.animSceneMode === 'scene';
        if (inSceneMode) {
          canvas.style.cursor = over ? 'grab' : 'crosshair';
        } else {
          canvas.style.cursor = 'default';
        }
      });

      canvas.addEventListener('mouseleave', () => {
        if (isHoveringOverlay && !isDragging) {
          isHoveringOverlay = false;
          drawAnimFrame(state.animCurrentFrame);
        }
      });

      function onWindowMouseMove(e) {
        if (!isDragging) return;
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        updatePos(x - dragGrabOffsetX, y - dragGrabOffsetY, false);
      }

      function onWindowMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        updatePos(x - dragGrabOffsetX, y - dragGrabOffsetY, true);
        const inSceneMode = state.animSceneMode === 'scene';
        if (inSceneMode) {
          canvas.style.cursor = isPointInOverlay(x, y) ? 'grab' : 'crosshair';
        } else {
          canvas.style.cursor = 'default';
        }
      }

      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const inSceneMode = state.animSceneMode === 'scene';
        if (!inSceneMode) return;

        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        isDragging = true;
        canvas.style.cursor = 'grabbing';

        if (isPointInOverlay(x, y)) {
          dragGrabOffsetX = x - currentPosX;
          dragGrabOffsetY = y - currentPosY;
        } else {
          // Snap center to click location
          dragGrabOffsetX = width / 2;
          dragGrabOffsetY = height / 2;
          updatePos(x - dragGrabOffsetX, y - dragGrabOffsetY, false);
        }

        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('mouseup', onWindowMouseUp);
        e.preventDefault();
      });

      // Touch interaction
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const inSceneMode = state.animSceneMode === 'scene';
        if (!inSceneMode) return;
        const touch = e.touches[0];
        const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
        isDragging = true;
        if (isPointInOverlay(x, y)) {
          dragGrabOffsetX = x - currentPosX;
          dragGrabOffsetY = y - currentPosY;
        } else {
          dragGrabOffsetX = width / 2;
          dragGrabOffsetY = height / 2;
          updatePos(x - dragGrabOffsetX, y - dragGrabOffsetY, false);
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
        updatePos(x - dragGrabOffsetX, y - dragGrabOffsetY, false);
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        try {
          localStorage.setItem(storageKey, JSON.stringify({ x: currentPosX, y: currentPosY }));
        } catch (err) {}
      });

      // Pos Inputs and Reset button listeners
      const posXInput = document.getElementById('wsaPosXInput');
      const posYInput = document.getElementById('wsaPosYInput');
      const resetBtn = document.getElementById('wsaResetPosBtn');

      if (posXInput) {
        posXInput.addEventListener('input', () => {
          const val = parseInt(posXInput.value);
          if (!isNaN(val)) updatePos(val, currentPosY, true);
        });
      }

      if (posYInput) {
        posYInput.addEventListener('input', () => {
          const val = parseInt(posYInput.value);
          if (!isNaN(val)) updatePos(currentPosX, val, true);
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          try {
            localStorage.removeItem(storageKey);
          } catch (err) {}
          updatePos(posX, posY, false);
        });
      }
    }

    // Initial zoom application
    applyAnimZoom(state.animZoomLevel || 'fit', false);
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

    const initialBpm = meta.tempo_bpm || 120;
    el.metaChips.innerHTML = `
      <div class="meta-chip">Total Notes: <strong>${meta.notes_count || 0}</strong></div>
      <div class="meta-chip">Channels Used: <strong>${(meta.channels_used || []).length} channels</strong></div>
      <div class="meta-chip">Est. Duration: <strong>${meta.estimated_seconds || 0}s</strong></div>
      <div class="meta-chip" id="midiBpmChip">Tempo: <strong>${initialBpm} BPM</strong></div>
      <div class="meta-chip">PPQN: <strong>${meta.ppqn || 60}</strong></div>
    `;

    el.interactiveControls.innerHTML = `
      <div class="player-controls-wrap">
        <button class="play-toggle-btn" id="midiPlayBtn" title="Play/Stop MIDI">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <span id="midiTimeText" style="font-family: var(--font-mono); font-size: 0.8rem; min-width: 80px;">0:00 / 0:00</span>
        <input type="range" class="scrubber-slider" id="midiScrubber" min="0" max="100" value="0">

        <div class="bpm-control-wrap" title="Adjust playback speed using BPM">
          <span class="bpm-label">BPM</span>
          <button class="bpm-stepper-btn" id="bpmMinus5Btn" title="Decrease tempo by 5 BPM">-5</button>
          <button class="bpm-stepper-btn" id="bpmMinusBtn" title="Decrease tempo by 1 BPM">-</button>
          <input type="number" id="bpmInput" class="bpm-input" min="20" max="360" step="1" value="${initialBpm}" title="Playback speed (BPM)">
          <button class="bpm-stepper-btn" id="bpmPlusBtn" title="Increase tempo by 1 BPM">+</button>
          <button class="bpm-stepper-btn" id="bpmPlus5Btn" title="Increase tempo by 5 BPM">+5</button>
          <span class="bpm-rate-badge" id="bpmRateBadge" title="Playback speed multiplier">1.00x</span>
          <button class="bpm-reset-btn" id="bpmResetBtn" title="Reset tempo to original track BPM">Reset</button>
        </div>
      </div>
    `;

    const disc = document.getElementById('audioDisc');
    const playBtn = document.getElementById('midiPlayBtn');
    const timeText = document.getElementById('midiTimeText');
    const scrubber = document.getElementById('midiScrubber');
    const bpmInput = document.getElementById('bpmInput');
    const bpmMinus5Btn = document.getElementById('bpmMinus5Btn');
    const bpmMinusBtn = document.getElementById('bpmMinusBtn');
    const bpmPlusBtn = document.getElementById('bpmPlusBtn');
    const bpmPlus5Btn = document.getElementById('bpmPlus5Btn');
    const bpmRateBadge = document.getElementById('bpmRateBadge');
    const bpmResetBtn = document.getElementById('bpmResetBtn');
    const bpmChip = document.getElementById('midiBpmChip');
    const canvas = document.getElementById('audioCanvas');
    const ctx = canvas.getContext('2d');
    let isScrubbing = false;

    function updateBpmUI(curBpm, baseBpm, rate) {
      if (bpmInput && document.activeElement !== bpmInput) {
        bpmInput.value = curBpm;
      }
      if (bpmRateBadge) {
        bpmRateBadge.textContent = `${rate.toFixed(2)}x`;
      }
      if (bpmResetBtn) {
        bpmResetBtn.textContent = curBpm !== baseBpm ? `Reset (${baseBpm})` : 'Reset';
        bpmResetBtn.style.opacity = curBpm === baseBpm ? '0.5' : '1.0';
      }
      if (bpmChip) {
        bpmChip.innerHTML = curBpm === baseBpm
          ? `Tempo: <strong>${baseBpm} BPM</strong>`
          : `Tempo: <strong>${curBpm} BPM</strong> <span style="opacity:0.75; font-size:0.75rem;">(${rate.toFixed(2)}x, base ${baseBpm})</span>`;
      }
    }

    window.midiPlayer.onBpmChange = (curBpm, baseBpm, rate) => {
      updateBpmUI(curBpm, baseBpm, rate);
    };

    // Load MIDI arraybuffer into WebMidiPlayer
    try {
      const res = await fetch(midiUrl);
      const ab = await res.arrayBuffer();
      window.midiPlayer.loadMidi(ab);
      updateBpmUI(window.midiPlayer.currentBpm, window.midiPlayer.baseBpm, window.midiPlayer.playbackRate);
    } catch (e) {
      console.error('Failed to load MIDI:', e);
    }

    bpmInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        window.midiPlayer.setBpm(val);
      }
    });

    bpmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
          window.midiPlayer.setBpm(val);
        }
        bpmInput.blur();
      }
    });

    bpmMinus5Btn.addEventListener('click', () => {
      window.midiPlayer.setBpm(window.midiPlayer.currentBpm - 5);
    });

    bpmMinusBtn.addEventListener('click', () => {
      window.midiPlayer.setBpm(window.midiPlayer.currentBpm - 1);
    });

    bpmPlusBtn.addEventListener('click', () => {
      window.midiPlayer.setBpm(window.midiPlayer.currentBpm + 1);
    });

    bpmPlus5Btn.addEventListener('click', () => {
      window.midiPlayer.setBpm(window.midiPlayer.currentBpm + 5);
    });

    bpmResetBtn.addEventListener('click', () => {
      window.midiPlayer.resetBpm();
    });
    window.midiPlayer.onProgress = (cur, dur) => {
      if (!isScrubbing) {
        timeText.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        scrubber.value = dur > 0 ? (cur / dur) * 100 : 0;
      }
    };

    window.midiPlayer.onEnd = () => {
      disc.classList.remove('playing');
      playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    };

    playBtn.addEventListener('click', () => {
      if (window.midiPlayer.isPlaying) {
        window.midiPlayer.pause();
        disc.classList.remove('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      } else {
        window.midiPlayer.play();
        disc.classList.add('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        startVisualizer();
      }
    });

    scrubber.addEventListener('input', (e) => {
      isScrubbing = true;
      const targetSec = (parseFloat(e.target.value) / 100) * window.midiPlayer.durationSec;
      timeText.textContent = `${formatTime(targetSec)} / ${formatTime(window.midiPlayer.durationSec)}`;
    });

    scrubber.addEventListener('change', (e) => {
      const targetSec = (parseFloat(e.target.value) / 100) * window.midiPlayer.durationSec;
      window.midiPlayer.seek(targetSec);
      isScrubbing = false;
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
      <div class="audio-studio-wrap voc-studio-wrap">
        <div class="audio-disc-visualizer" id="vocDisc" style="border-color: var(--accent-rose);">
          <div class="disc-grooves"></div>
          <div class="disc-center" style="background: var(--accent-rose);">🔊</div>
        </div>

        <div class="voc-custom-player">
          <audio id="vocAudio" src="${wavUrl}" preload="auto"></audio>

          <div class="voc-player-row">
            <button class="voc-play-btn" id="vocPlayBtn" title="Play / Pause">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <div class="voc-time" id="vocTimeText">0:00.0 / 0:00.0</div>
            <div class="voc-spacer"></div>
            <button class="voc-tool-btn" id="vocLoopBtn" title="Loop audio">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            </button>
            <button class="voc-tool-btn" id="vocMuteBtn" title="Mute / Unmute">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
            <input type="range" class="voc-volume-slider" id="vocVolSlider" min="0" max="1" step="0.05" value="1" title="Volume">
          </div>

          <div class="voc-scrubber-container">
            <input type="range" class="voc-scrubber" id="vocScrubber" min="0" max="100" value="0" step="0.1" title="Seek position">
          </div>
        </div>
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Format: <strong>Creative Voice (8-bit PCM)</strong></div>
      <div class="meta-chip">WAV Output Size: <strong>${formatBytes(details.wav_size || asset.size)}</strong></div>
    `;

    el.interactiveControls.innerHTML = '';

    const audio = document.getElementById('vocAudio');
    const disc = document.getElementById('vocDisc');
    const playBtn = document.getElementById('vocPlayBtn');
    const timeText = document.getElementById('vocTimeText');
    const scrubber = document.getElementById('vocScrubber');
    const loopBtn = document.getElementById('vocLoopBtn');
    const muteBtn = document.getElementById('vocMuteBtn');
    const volSlider = document.getElementById('vocVolSlider');

    function formatVocTime(sec) {
      if (!isFinite(sec) || isNaN(sec)) sec = 0;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 10);
      return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    }

    function updatePlayState(playing) {
      if (playing) {
        disc.classList.add('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      } else {
        disc.classList.remove('playing');
        playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }
    }

    audio.addEventListener('loadedmetadata', () => {
      timeText.textContent = `${formatVocTime(audio.currentTime)} / ${formatVocTime(audio.duration)}`;
    });

    audio.addEventListener('timeupdate', () => {
      timeText.textContent = `${formatVocTime(audio.currentTime)} / ${formatVocTime(audio.duration)}`;
      if (audio.duration > 0) {
        scrubber.value = (audio.currentTime / audio.duration) * 100;
      }
    });

    audio.addEventListener('play', () => updatePlayState(true));
    audio.addEventListener('pause', () => updatePlayState(false));
    audio.addEventListener('ended', () => {
      if (!audio.loop) {
        updatePlayState(false);
        scrubber.value = 0;
      }
    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(e => console.log('Audio playback prevented:', e));
      } else {
        audio.pause();
      }
    });

    scrubber.addEventListener('input', (e) => {
      if (audio.duration > 0) {
        audio.currentTime = (parseFloat(e.target.value) / 100) * audio.duration;
      }
    });

    loopBtn.addEventListener('click', () => {
      audio.loop = !audio.loop;
      loopBtn.classList.toggle('active', audio.loop);
    });

    volSlider.addEventListener('input', (e) => {
      audio.volume = parseFloat(e.target.value);
      audio.muted = (audio.volume === 0);
      muteBtn.classList.toggle('active', audio.muted);
    });

    muteBtn.addEventListener('click', () => {
      audio.muted = !audio.muted;
      muteBtn.classList.toggle('active', audio.muted);
      if (!audio.muted && audio.volume === 0) {
        audio.volume = 0.5;
        volSlider.value = 0.5;
      }
    });
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

  // 8. Westwood .FNT Font Viewer
  function renderFontViewer(asset, details) {
    let currentScheme = 'gold';
    let zoomLevel = 3;
    let letterSpacing = 1;
    let lineSpacing = 2;
    let typedText = 'The Legend of Kyrandia\nBook Two: Hand of Fate';

    const baseName = asset.name.replace(/\.FNT$/i, '');
    const numGlyphs = details.num_glyphs || 255;
    const glyphs = details.glyphs || [];
    const glyphMap = new Map(glyphs.map(g => [g.index, g]));

    const COLOR_PALETTES = {
      gold: {
        0: 'transparent',
        1: '#f5d061',
        2: '#e5a823',
        3: '#7a4e08',
        4: '#462a05',
        5: '#fff0a0',
        6: '#c89632',
        7: '#a06e1e',
        8: '#785014',
        9: '#5a3c0f',
        10: '#3c280a',
        11: '#fffad2',
        12: '#b48228',
        13: '#8c5f19',
        14: '#64410f',
        15: '#ffffff'
      },
      white: {
        0: 'transparent',
        1: '#ffffff',
        2: '#bec3cd',
        3: '#232832',
        4: '#4b505f',
        5: '#e6ebf5',
        6: '#a0a5af',
        7: '#828791',
        8: '#646973',
        9: '#50555f',
        10: '#323741',
        11: '#fafaff',
        12: '#b4b9c3',
        13: '#8c919b',
        14: '#6e737d',
        15: '#ffffff'
      },
      amber: {
        0: 'transparent',
        1: '#fbbf24',
        2: '#d97706',
        3: '#451a03',
        4: '#78350f',
        5: '#fef3c7',
        6: '#f59e0b',
        7: '#b45309',
        8: '#92400e',
        9: '#6e300a',
        10: '#502308',
        11: '#fde68a',
        12: '#c8640a',
        13: '#a04b0a',
        14: '#7d370a',
        15: '#ffffff'
      },
      cyan: {
        0: 'transparent',
        1: '#38bdf8',
        2: '#0ea5e9',
        3: '#082f49',
        4: '#0c4a60',
        5: '#e0f2fe',
        6: '#0284c7',
        7: '#0369a1',
        8: '#075985',
        9: '#0e7490',
        10: '#155e75',
        11: '#bae6fd',
        12: '#7dd3fc',
        13: '#0ea5e9',
        14: '#0369a1',
        15: '#ffffff'
      },
      emerald: {
        0: 'transparent',
        1: '#34d399',
        2: '#10b981',
        3: '#064e3b',
        4: '#047857',
        5: '#d1fae5',
        6: '#059669',
        7: '#047857',
        8: '#065f46',
        9: '#064e3b',
        10: '#022c22',
        11: '#a7f3d0',
        12: '#6ee7b7',
        13: '#10b981',
        14: '#059669',
        15: '#ffffff'
      }
    };

    function updateActionUrls() {
      const exportSheetUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}&scheme=${currentScheme}`;
      const exportRawUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;

      el.viewerActions.innerHTML = `
        <a id="exportFntSheetBtn" href="${exportSheetUrl}" download="${baseName}_fontsheet_${currentScheme}.png" class="btn btn-primary glow-btn" title="Export complete 16-column character sheet as PNG">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          <span>Export Font Sheet (PNG)</span>
        </a>
        <a id="downloadRawFntBtn" href="${exportRawUrl}" download="${asset.name}" class="btn btn-secondary" title="Download original Westwood .FNT file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>Download .FNT File</span>
        </a>
      `;
    }

    updateActionUrls();

    el.metaChips.innerHTML = `
      <div class="meta-chip">Type: <strong>Westwood Font v3 (4bpp Bitmap)</strong></div>
      <div class="meta-chip">Glyphs: <strong>${numGlyphs} characters</strong></div>
      <div class="meta-chip">Max Size: <strong>${details.max_width || 0}×${details.max_height || 0} px</strong></div>
      <div class="meta-chip">Archive: <strong>${escapeHtml(asset.pak_name)}</strong></div>
      <div class="meta-chip">Size: <strong>${formatBytes(asset.size)}</strong></div>
    `;

    el.viewerStage.innerHTML = `
      <div class="fnt-viewer-container">
        <!-- Header Banner & Color Scheme Selector -->
        <div class="fnt-header-card">
          <div class="fnt-header-left">
            <div class="fnt-header-icon">🔤</div>
            <div class="fnt-header-titles">
              <span class="fnt-header-title">${escapeHtml(asset.name)}</span>
              <span class="fnt-header-sub">
                <span>${numGlyphs} Bitmap Glyphs</span> •
                <span>Max Bounding Box: ${details.max_width || 0}×${details.max_height || 0} px</span> •
                <span>Variable Width</span>
              </span>
            </div>
          </div>
          <div class="fnt-scheme-selector">
            <span class="fnt-scheme-label">Color:</span>
            <button class="fnt-scheme-pill active" data-scheme="gold">🌟 Gold</button>
            <button class="fnt-scheme-pill" data-scheme="white">⚪ White</button>
            <button class="fnt-scheme-pill" data-scheme="amber">🟠 Amber</button>
            <button class="fnt-scheme-pill" data-scheme="cyan">🔷 Cyan</button>
            <button class="fnt-scheme-pill" data-scheme="emerald">🟢 Emerald</button>
          </div>
        </div>

        <!-- Live Typing Sandbox -->
        <div class="fnt-sandbox-panel">
          <div class="fnt-sandbox-header">
            <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">✍️ Live Text Rendering Sandbox</span>
            <div class="fnt-sandbox-presets">
              <button class="fnt-preset-btn" data-preset="The Legend of Kyrandia\nBook Two: Hand of Fate">Game Title</button>
              <button class="fnt-preset-btn" data-preset="Zanthia: The whole world is\ndisappearing piece by piece!\nMarko: Don't panic!">Dialogue</button>
              <button class="fnt-preset-btn" data-preset="Frank Klepacki\n& Paul Mudra">Soundtrack</button>
              <button class="fnt-preset-btn" data-preset="ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !?@#$%&*()">All Glyphs</button>
              <button class="fnt-preset-btn" data-preset="Westwood Studios Presents\nA Masterpiece of Fantasy">Westwood</button>
            </div>
          </div>
          <div class="fnt-sandbox-input-row">
            <textarea class="fnt-sandbox-textarea" id="fntSandboxInput" rows="3" placeholder="Type text here (multiple lines supported, press Enter for new line)...">${escapeHtml(typedText)}</textarea>
            <button id="fntExportTextBtn" class="btn btn-secondary" style="flex-shrink: 0;" title="Download rendered text as transparent PNG">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Export Text (PNG)</span>
            </button>
          </div>
          <div class="fnt-sandbox-stage" id="fntSandboxStage">
            <canvas id="fntSandboxCanvas" class="fnt-sandbox-canvas"></canvas>
          </div>
        </div>
      </div>
    `;

    // Interactive bottom controls
    el.interactiveControls.innerHTML = `
      <div class="player-controls-wrap">
        <div class="ctrl-btn-group" title="Zoom Scale">
          <button class="ctrl-btn ${zoomLevel === 1 ? 'active' : ''}" data-fzoom="1">1x</button>
          <button class="ctrl-btn ${zoomLevel === 2 ? 'active' : ''}" data-fzoom="2">2x</button>
          <button class="ctrl-btn ${zoomLevel === 3 ? 'active' : ''}" data-fzoom="3">3x</button>
          <button class="ctrl-btn ${zoomLevel === 4 ? 'active' : ''}" data-fzoom="4">4x</button>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #94a3b8;">
          <span>Letter Spacing:</span>
          <input type="range" id="fntTrackingSlider" min="-1" max="5" value="${letterSpacing}" style="width: 80px; accent-color: #f5d061; cursor: pointer;">
          <span id="fntTrackingVal" style="font-family: var(--font-mono); color: #fff; min-width: 20px;">+${letterSpacing}px</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #94a3b8;">
          <span>Line Spacing:</span>
          <input type="range" id="fntLineSpacingSlider" min="0" max="10" value="${lineSpacing}" style="width: 80px; accent-color: #f5d061; cursor: pointer;">
          <span id="fntLineSpacingVal" style="font-family: var(--font-mono); color: #fff; min-width: 20px;">+${lineSpacing}px</span>
        </div>
      </div>
    `;

    function renderSandbox() {
      const canvas = document.getElementById('fntSandboxCanvas');
      if (!canvas) return;

      const text = typedText || '';
      const palette = COLOR_PALETTES[currentScheme] || COLOR_PALETTES.gold;
      const lines = text.split('\n');
      const maxH = details.max_height || 10;
      const maxW = details.max_width || 8;
      const scale = zoomLevel;
      const track = letterSpacing;
      const lineH = maxH + lineSpacing;

      let maxLineW = 0;
      lines.forEach(line => {
        let lw = 0;
        for (let i = 0; i < line.length; i++) {
          const c = line.charCodeAt(i);
          const g = glyphMap.get(c);
          if (g && g.width > 0) lw += g.width + track;
          else if (line[i] === ' ') lw += Math.max(Math.floor(maxW / 2), 4) + track;
          else lw += maxW + track;
        }
        if (lw > maxLineW) maxLineW = lw;
      });

      const totalW = Math.max(maxLineW, 10);
      const totalH = Math.max(lines.length * lineH, 10);

      canvas.width = totalW * scale;
      canvas.height = totalH * scale;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let curY = 0;
      lines.forEach(line => {
        let curX = 0;
        for (let i = 0; i < line.length; i++) {
          const c = line.charCodeAt(i);
          const g = glyphMap.get(c);
          if (g && g.has_data) {
            for (let y = 0; y < g.rows.length; y++) {
              const row = g.rows[y];
              for (let x = 0; x < row.length; x++) {
                const val = row[x];
                if (val !== 0) {
                  ctx.fillStyle = palette[val] || '#ffffff';
                  ctx.fillRect((curX + x) * scale, (curY + y) * scale, scale, scale);
                }
              }
            }
            curX += g.width + track;
          } else if (line[i] === ' ') {
            curX += Math.max(Math.floor(maxW / 2), 4) + track;
          } else {
            curX += maxW + track;
          }
        }
        curY += lineH;
      });
    }

    // Event listeners
    // Scheme switcher
    document.querySelectorAll('.fnt-scheme-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentScheme = e.currentTarget.dataset.scheme;
        document.querySelectorAll('.fnt-scheme-pill').forEach(b => b.classList.toggle('active', b.dataset.scheme === currentScheme));
        updateActionUrls();
        renderSandbox();
      });
    });

    // Sandbox input
    const inputEl = document.getElementById('fntSandboxInput');
    if (inputEl) {
      inputEl.addEventListener('input', (e) => {
        typedText = e.target.value;
        renderSandbox();
      });
    }

    // Presets
    document.querySelectorAll('.fnt-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        typedText = (e.currentTarget.dataset.preset || '').replace(/\\n/g, '\n');
        if (inputEl) inputEl.value = typedText;
        renderSandbox();
      });
    });

    // Export rendered text
    const exportTextBtn = document.getElementById('fntExportTextBtn');
    if (exportTextBtn) {
      exportTextBtn.addEventListener('click', () => {
        const canvas = document.getElementById('fntSandboxCanvas');
        if (canvas) {
          const a = document.createElement('a');
          a.download = `${baseName}_text_render.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
        }
      });
    }

    // Controls listeners: Zoom, Tracking, Line Spacing
    el.interactiveControls.querySelectorAll('[data-fzoom]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        zoomLevel = parseInt(e.currentTarget.dataset.fzoom);
        el.interactiveControls.querySelectorAll('[data-fzoom]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.fzoom) === zoomLevel));
        renderSandbox();
      });
    });

    const trackingSlider = document.getElementById('fntTrackingSlider');
    if (trackingSlider) {
      trackingSlider.addEventListener('input', (e) => {
        letterSpacing = parseInt(e.target.value);
        const valEl = document.getElementById('fntTrackingVal');
        if (valEl) valEl.textContent = `${letterSpacing >= 0 ? '+' : ''}${letterSpacing}px`;
        renderSandbox();
      });
    }

    const lineSpacingSlider = document.getElementById('fntLineSpacingSlider');
    if (lineSpacingSlider) {
      lineSpacingSlider.addEventListener('input', (e) => {
        lineSpacing = parseInt(e.target.value);
        const valEl = document.getElementById('fntLineSpacingVal');
        if (valEl) valEl.textContent = `+${lineSpacing}px`;
        renderSandbox();
      });
    }

    // Initial render
    renderSandbox();
  }

  // 7. Raw File Fallback / Empty State for unsupported preview types (.TIM, .MSC, .ADV, etc.)
  function renderRawViewer(asset, details) {
    const exportUrl = `/api/asset/export?pak=${encodeURIComponent(asset.pak_name)}&name=${encodeURIComponent(asset.name)}`;
    const typeInfo = details.file_type_info || {};
    const typeName = details.type_name || typeInfo.name || asset.ext;
    const typeDesc = details.description || typeInfo.description || `Raw Westwood file stored in ${asset.pak_name}. Size: ${formatBytes(asset.size)}.`;
    const icon = details.type_icon || typeInfo.icon || (asset.ext === '.TIM' ? '⏱️' : '📁');

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

    el.viewerStage.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${escapeHtml(asset.name)}</h3>
        <p>${escapeHtml(typeDesc)}</p>
      </div>
    `;

    el.metaChips.innerHTML = `
      <div class="meta-chip">Type: <strong>${escapeHtml(typeName)}</strong></div>
      ${(details.is_non_useful || asset.is_non_useful) ? `
      <div class="meta-chip" style="background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">
        Status: <strong>Hidden by default (Non-useful)</strong>
      </div>` : ''}
      <div class="meta-chip">Archive: <strong>${escapeHtml(asset.pak_name)}</strong></div>
      <div class="meta-chip">Size: <strong>${formatBytes(asset.size)}</strong></div>
      <div class="meta-chip">Offset: <strong>0x${(asset.offset || 0).toString(16).toUpperCase()}</strong></div>
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
    clearInterval(state.cpsAnimTimer);
    state.cpsAnimTimer = null;
    cancelAnimationFrame(state.audioVisualizerTimer);

    document.querySelectorAll('audio').forEach(a => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    });

    if (el.viewerStage) {
      el.viewerStage.classList.remove('can-pan');
    }
  }

  // Viewport Scroll & Navigation Setup
  function setupViewportNavigation() {
    window.addEventListener('resize', () => {
      if (typeof state.reapplyZoom === 'function') {
        state.reapplyZoom();
      }
      updateViewportScrollState();
    });

    if (window.ResizeObserver && el.viewerStage) {
      const ro = new ResizeObserver(() => {
        if (typeof state.reapplyZoom === 'function') {
          state.reapplyZoom();
        }
        updateViewportScrollState();
      });
      ro.observe(el.viewerStage);
    }
  }

  function updateViewportScrollState() {
    const stage = el.viewerStage;
    if (!stage) return;
    requestAnimationFrame(() => {
      const hasOverflow = (stage.scrollWidth - stage.clientWidth > 6) || (stage.scrollHeight - stage.clientHeight > 6);
      stage.classList.toggle('can-pan', hasOverflow);
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info', duration = 2800) {
    const container = el.toastContainer || document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️');
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function scrollActiveCardIntoView() {
    const activeCard = el.assetList.querySelector('.asset-card.active');
    if (activeCard) {
      activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function handleGlobalKeydown(e) {
    // If user is typing in a textarea or input, do not trigger navigation shortcuts
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditing = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

    // Escape closes modals or blurs search
    if (e.key === 'Escape') {
      if (el.helpModal && el.helpModal.style.display !== 'none') {
        el.helpModal.style.display = 'none';
        return;
      }
      if (el.featuredModal && el.featuredModal.style.display !== 'none') {
        el.featuredModal.style.display = 'none';
        return;
      }
      if (el.exportModal && el.exportModal.style.display !== 'none') {
        el.exportModal.style.display = 'none';
        return;
      }
      if (el.dirModal && el.dirModal.style.display !== 'none') {
        el.dirModal.style.display = 'none';
        return;
      }
      if (isEditing) {
        document.activeElement.blur();
        return;
      }
    }

    // Help shortcut (?)
    if (e.key === '?' && !isEditing) {
      if (el.helpModal) {
        el.helpModal.style.display = el.helpModal.style.display === 'none' ? 'flex' : 'none';
        e.preventDefault();
      }
      return;
    }

    // Search focus shortcut (/)
    if (e.key === '/' && !isEditing) {
      if (el.searchInput) {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
      return;
    }

    if (isEditing) return;

    // Arrow Up / Down asset navigation
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!state.assets || state.assets.length === 0) return;
      e.preventDefault();
      const currIdx = state.selectedAsset
        ? state.assets.findIndex(a => a.name === state.selectedAsset.name && a.pak_name === state.selectedAsset.pak_name)
        : -1;

      let nextIdx = 0;
      if (e.key === 'ArrowDown') {
        nextIdx = currIdx < state.assets.length - 1 ? currIdx + 1 : currIdx;
      } else {
        nextIdx = currIdx > 0 ? currIdx - 1 : 0;
      }

      if (nextIdx !== currIdx && state.assets[nextIdx]) {
        selectAsset(state.assets[nextIdx]);
        scrollActiveCardIntoView();
      }
      return;
    }

    // Spacebar to play/pause active player
    if (e.key === ' ' || e.code === 'Space') {
      const playBtn = document.getElementById('playPauseBtn')
        || document.getElementById('modelPlayBtn')
        || document.getElementById('midiPlayBtn')
        || document.getElementById('vocPlayBtn');
      if (playBtn) {
        e.preventDefault();
        playBtn.click();
      }
      return;
    }

    // Zoom shortcuts (1, 2, 3, 4)
    if (['1', '2', '3', '4'].includes(e.key)) {
      const targetZoom = e.key;
      const zoomBtn = document.querySelector(`.zoom-btn[data-zoom="${targetZoom}"]`)
        || document.querySelector(`.ctrl-btn[data-fzoom="${targetZoom}"]`);
      if (zoomBtn) {
        e.preventDefault();
        zoomBtn.click();
        showToast(`Zoom scale set to ${targetZoom}x`, 'info', 1500);
      }
    }
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
