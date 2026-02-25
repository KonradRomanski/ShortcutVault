(function () {
  const DATA = window.ShortcutVaultData || { CATEGORIES: [], BASE_SHORTCUTS: [], META: { count: 0 } };

  const STORAGE_KEYS = {
    custom: 'shortcutvault.custom.v2',
    favorites: 'shortcutvault.favorites.v2',
    recent: 'shortcutvault.recent.v2',
    theme: 'shortcutvault.theme.v2',
  };

  const state = {
    selectedCategory: 'All Shortcuts',
    selectedProgram: 'All Tools',
    viewMode: 'commands',
    query: '',
    usageFilter: 'all',
    levelFilter: 'all',
    groupMode: 'tool',
    customEntries: [],
    favorites: new Set(),
    recent: [],
    suggestionIndex: -1,
    suggestionSuppressed: false,
    deferredInstallPrompt: null,
  };

  const el = {
    sidebar: document.getElementById('sidebar'),
    mobileOverlay: document.getElementById('mobile-overlay'),
    menuBtn: document.getElementById('menu-btn'),

    categoryNav: document.getElementById('category-nav'),
    programNav: document.getElementById('program-nav'),
    clearProgramFilter: document.getElementById('clear-program-filter'),

    search: document.getElementById('search'),
    suggestions: document.getElementById('suggestions'),
    entryModeSwitch: document.getElementById('entry-mode-switch'),

    groupMode: document.getElementById('group-mode'),
    usageFilter: document.getElementById('usage-filter'),
    levelFilter: document.getElementById('level-filter'),

    addBtn: document.getElementById('add-btn'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    importBtn: document.getElementById('import-btn'),
    importInput: document.getElementById('import-input'),
    printBtn: document.getElementById('print-btn'),
    installBtn: document.getElementById('install-btn'),
    themeBtn: document.getElementById('theme-btn'),

    stats: document.getElementById('stats'),
    activeFilter: document.getElementById('active-filter'),
    content: document.getElementById('content'),

    toast: document.getElementById('toast'),

    entryModal: document.getElementById('entry-modal'),
    entryModalTitle: document.getElementById('entry-modal-title'),
    entryModalClose: document.getElementById('entry-modal-close'),
    entryCancel: document.getElementById('entry-cancel'),
    entryForm: document.getElementById('entry-form'),

    entryId: document.getElementById('entry-id'),
    fieldCategory: document.getElementById('field-category'),
    fieldType: document.getElementById('field-type'),
    fieldProgramSelect: document.getElementById('field-program-select'),
    fieldProgramCustom: document.getElementById('field-program-custom'),
    fieldShortcut: document.getElementById('field-shortcut'),
    fieldDescription: document.getElementById('field-description'),
    fieldDocs: document.getElementById('field-docs'),
    fieldUsageSelect: document.getElementById('field-usage-select'),
    fieldUsageCustom: document.getElementById('field-usage-custom'),
    fieldLevelSelect: document.getElementById('field-level-select'),
    fieldLevelCustom: document.getElementById('field-level-custom'),
    fieldTags: document.getElementById('field-tags'),

    detailModal: document.getElementById('detail-modal'),
    detailClose: document.getElementById('detail-close'),
    detailBody: document.getElementById('detail-body'),
  };

  function parseJson(raw, fallback) {
    try {
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify(state.customEntries));
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
    localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recent));
  }

  function loadState() {
    state.customEntries = parseJson(localStorage.getItem(STORAGE_KEYS.custom), []).map((entry, idx) => ({
      ...entry,
      id: entry.id || `custom-${Date.now()}-${idx}`,
      source: 'custom',
      categories: Array.isArray(entry.categories) ? entry.categories : ['My Custom / Notes'],
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      flags: Array.isArray(entry.flags) ? entry.flags : [],
      examples: Array.isArray(entry.examples) ? entry.examples : [],
      usage: normalizeValue(entry.usage || 'regular'),
      level: normalizeValue(entry.level || 'basic'),
      type: normalizeValue(entry.type || inferEntryType(entry)),
      baseShortcut: entry.baseShortcut || entry.shortcut || '',
      flagSuffix: entry.flagSuffix || '',
      detail: entry.detail || {
        overview: entry.description || '',
        syntax: entry.shortcut || '',
        whenToUse: '',
        output: '',
        notes: [],
      },
    }));

    state.favorites = new Set(parseJson(localStorage.getItem(STORAGE_KEYS.favorites), []));
    state.recent = parseJson(localStorage.getItem(STORAGE_KEYS.recent), []).slice(0, 20);
  }

  function inferEntryType(entry) {
    const shortcut = String(entry?.shortcut || '').trim();
    const group = String(entry?.group || '').toLowerCase();
    if (group === 'tmux') return shortcut.startsWith('tmux ') ? 'command' : 'shortcut';
    if (['vim', 'vs code', 'neovim', 'windows', 'macos'].includes(group)) return 'shortcut';
    if (/^(ctrl|cmd|alt|win|shift|f\d+|esc|tab)/i.test(shortcut)) return 'shortcut';
    if (/\+/.test(shortcut) && !shortcut.includes(' ')) return 'shortcut';
    return 'command';
  }

  function matchesViewMode(entry, mode = state.viewMode) {
    const t = normalizeValue(entry.type || inferEntryType(entry));
    return mode === 'shortcuts' ? t === 'shortcut' : t === 'command';
  }

  function entriesInViewMode(mode = state.viewMode) {
    return allEntries().filter((entry) => matchesViewMode(entry, mode));
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    el.themeBtn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9+.#\-_/ ]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function highlight(text, query) {
    if (!query.trim()) return escapeHtml(text);
    let out = escapeHtml(text);
    const terms = tokenize(query).slice(0, 6).sort((a, b) => b.length - a.length);
    terms.forEach((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
    });
    return out;
  }

  function abbreviateWords(input) {
    return tokenize(input)
      .map((w) => w[0])
      .join('');
  }

  function fuzzyScore(entry, query) {
    if (!query.trim()) return 1;

    const q = query.toLowerCase().trim();
    const terms = tokenize(q);
    const data = [
      entry.shortcut,
      entry.description,
      entry.program,
      entry.group,
      ...(entry.tags || []),
      ...(entry.synonyms || []),
      ...(entry.flags || []).map((f) => `${f.name} ${f.description}`),
    ].join(' ').toLowerCase();

    const compressed = data.replace(/\s+/g, '');
    let score = 0;

    if (data.includes(q)) score += 80;
    if (entry.shortcut.toLowerCase().includes(q)) score += 45;
    if (entry.group.toLowerCase().includes(q)) score += 20;
    if (entry.program.toLowerCase().includes(q)) score += 14;

    terms.forEach((term) => {
      if (data.includes(term)) {
        score += 14;
      } else {
        const acronym = abbreviateWords(data);
        if (acronym.includes(term)) score += 8;

        let j = 0;
        for (let i = 0; i < compressed.length && j < term.length; i += 1) {
          if (compressed[i] === term[j]) j += 1;
        }
        if (j === term.length) score += 6;
      }
    });

    if (entry.featured) score += 1;
    if (state.favorites.has(entry.id)) score += 2;
    return score;
  }

  function allEntries() {
    return [...DATA.BASE_SHORTCUTS, ...state.customEntries];
  }

  function inCategory(entry, category) {
    if (category === 'All Shortcuts') return true;
    if (category === 'My Custom / Notes') return entry.source === 'custom';
    return (entry.categories || []).includes(category);
  }

  function filteredRankedEntries() {
    return allEntries()
      .filter((entry) => matchesViewMode(entry))
      .filter((entry) => inCategory(entry, state.selectedCategory))
      .filter((entry) => (state.selectedProgram === 'All Tools' ? true : entry.group === state.selectedProgram))
      .filter((entry) => (state.usageFilter === 'all' ? true : normalizeValue(entry.usage) === normalizeValue(state.usageFilter)))
      .filter((entry) => (state.levelFilter === 'all' ? true : normalizeValue(entry.level) === normalizeValue(state.levelFilter)))
      .map((entry) => ({ entry, score: fuzzyScore(entry, state.query) }))
      .filter((row) => (state.query ? row.score > 0 : true))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const favDelta = Number(state.favorites.has(b.entry.id)) - Number(state.favorites.has(a.entry.id));
        if (favDelta !== 0) return favDelta;
        return a.entry.shortcut.localeCompare(b.entry.shortcut);
      });
  }

  function groupKey(entry) {
    if (state.groupMode === 'usage') return entry.usage || 'regular';
    if (state.groupMode === 'level') return entry.level || 'intermediate';
    return entry.group || 'Other';
  }

  function labelCase(value) {
    return String(value || '')
      .replace(/(^|\s|\/|-)(\w)/g, (m, p1, p2) => `${p1}${p2.toUpperCase()}`);
  }

  function domKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function syncFilterControls() {
    el.groupMode.value = state.groupMode;
    el.usageFilter.value = state.usageFilter;
    el.levelFilter.value = state.levelFilter;
  }

  function canonicalOrder(values, preferred) {
    const ordered = [];
    preferred.forEach((value) => {
      if (values.has(value)) {
        ordered.push(value);
        values.delete(value);
      }
    });
    return [...ordered, ...[...values].sort((a, b) => a.localeCompare(b))];
  }

  function optionValuesFromEntries(key) {
    const raw = new Set();
    entriesInViewMode().forEach((entry) => {
      const value = String(entry[key] || '').trim().toLowerCase();
      if (value) raw.add(value);
    });
    if (key === 'usage') return canonicalOrder(raw, ['common', 'regular', 'rare']);
    if (key === 'level') return canonicalOrder(raw, ['basic', 'intermediate', 'advanced']);
    return [...raw].sort((a, b) => a.localeCompare(b));
  }

  function normalizeValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function renderTopFiltersOptions() {
    const usageValues = optionValuesFromEntries('usage');
    const levelValues = optionValuesFromEntries('level');

    const usageCurrent = normalizeValue(state.usageFilter);
    const levelCurrent = normalizeValue(state.levelFilter);

    const usageSet = new Set(['all', ...usageValues]);
    const levelSet = new Set(['all', ...levelValues]);

    if (!usageSet.has(usageCurrent)) state.usageFilter = 'all';
    if (!levelSet.has(levelCurrent)) state.levelFilter = 'all';

    el.usageFilter.innerHTML = [
      '<option value="all">Usage: All</option>',
      ...usageValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(`Usage: ${labelCase(value)}`)}</option>`),
    ].join('');

    el.levelFilter.innerHTML = [
      '<option value="all">Level: All</option>',
      ...levelValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelCase(value))}</option>`),
    ].join('');

    el.usageFilter.value = state.usageFilter;
    el.levelFilter.value = state.levelFilter;
  }

  function toggleCustomInput(selectNode, inputNode) {
    const custom = selectNode.value === '__custom__';
    inputNode.classList.toggle('hidden', !custom);
    if (custom) inputNode.focus();
  }

  function resolvedSelectValue(selectNode, inputNode, preserveCase) {
    const raw = selectNode.value !== '__custom__' ? selectNode.value : inputNode.value;
    return preserveCase ? String(raw || '').trim() : normalizeValue(raw);
  }

  function fillFormSelectOptions(entry) {
    const selectedType = normalizeValue(entry?.type || (state.viewMode === 'shortcuts' ? 'shortcut' : 'command'));
    el.fieldType.value = selectedType;
    const programs = [...new Set(allEntries().filter((x) => normalizeValue(x.type || inferEntryType(x)) === selectedType).map((x) => x.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const usageValues = optionValuesFromEntries('usage');
    const levelValues = optionValuesFromEntries('level');

    el.fieldProgramSelect.innerHTML = [
      ...programs.map((program) => `<option value="${escapeHtml(program)}">${escapeHtml(program)}</option>`),
      '<option value="__custom__">Other (custom)...</option>',
    ].join('');

    el.fieldUsageSelect.innerHTML = [
      ...usageValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelCase(value))}</option>`),
      '<option value="__custom__">Custom...</option>',
    ].join('');

    el.fieldLevelSelect.innerHTML = [
      ...levelValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelCase(value))}</option>`),
      '<option value="__custom__">Custom...</option>',
    ].join('');

    const programValue = entry?.group || '';
    if (programValue && programs.includes(programValue)) {
      el.fieldProgramSelect.value = programValue;
      el.fieldProgramCustom.value = '';
    } else {
      el.fieldProgramSelect.value = '__custom__';
      el.fieldProgramCustom.value = programValue;
    }
    toggleCustomInput(el.fieldProgramSelect, el.fieldProgramCustom);

    const usageValue = normalizeValue(entry?.usage || 'common');
    if (usageValues.includes(usageValue)) {
      el.fieldUsageSelect.value = usageValue;
      el.fieldUsageCustom.value = '';
    } else {
      el.fieldUsageSelect.value = '__custom__';
      el.fieldUsageCustom.value = usageValue;
    }
    toggleCustomInput(el.fieldUsageSelect, el.fieldUsageCustom);

    const levelValue = normalizeValue(entry?.level || 'basic');
    if (levelValues.includes(levelValue)) {
      el.fieldLevelSelect.value = levelValue;
      el.fieldLevelCustom.value = '';
    } else {
      el.fieldLevelSelect.value = '__custom__';
      el.fieldLevelCustom.value = levelValue;
    }
    toggleCustomInput(el.fieldLevelSelect, el.fieldLevelCustom);
  }

  function renderModeSwitch() {
    const buttons = el.entryModeSwitch ? [...el.entryModeSwitch.querySelectorAll('[data-entry-mode]')] : [];
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.entryMode === state.viewMode);
    });
  }

  function grouped(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const key = groupKey(row.entry);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row.entry);
    });

    if (state.groupMode === 'usage') {
      const order = ['common', 'regular', 'rare'];
      return [...map.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    }

    if (state.groupMode === 'level') {
      const order = ['basic', 'intermediate', 'advanced'];
      return [...map.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    }

    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function programCounts() {
    const counts = new Map();
    allEntries()
      .filter((entry) => matchesViewMode(entry))
      .filter((entry) => inCategory(entry, state.selectedCategory))
      .forEach((entry) => {
        counts.set(entry.group, (counts.get(entry.group) || 0) + 1);
      });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function quickChip(kind, value, label, classes) {
    return `<button data-quick-kind="${escapeHtml(kind)}" data-quick-value="${escapeHtml(value)}" class="tag tag-btn ${classes || ''}">${escapeHtml(label)}</button>`;
  }

  function usageTag(entry, clickable) {
    const usage = normalizeValue(entry.usage || 'regular');
    const level = normalizeValue(entry.level || 'intermediate');

    if (clickable) {
      return `
        ${quickChip('usage', usage, labelCase(usage), `tag-usage-${usage}`)}
        ${quickChip('level', level, labelCase(level), `tag-level-${level}`)}
      `;
    }

    return `
      <span class="tag tag-usage-${usage}">${labelCase(usage)}</span>
      <span class="tag tag-level-${level}">${labelCase(level)}</span>
    `;
  }

  function commandMarkup(entry) {
    const full = String(entry.shortcut || '');
    const baseRaw = String(entry.baseShortcut || '');
    const base = baseRaw && full.toLowerCase().startsWith(baseRaw.toLowerCase()) ? baseRaw : full;
    const suffix = full.slice(base.length).trim();

    if (!suffix) return `<span class="command-main">${highlight(full, state.query)}</span>`;

    return `
      <span class="command-main">${highlight(base, state.query)}</span>
      <span class="command-suffix">${highlight(suffix, state.query)}</span>
    `;
  }

  function flashFirstResult(preferredKey) {
    const targetByKey = preferredKey
      ? document.querySelector(`[data-section-key="${CSS.escape(domKey(preferredKey))}"]`)
      : null;
    const target = targetByKey || document.querySelector('#content details, #content [data-card-id]');
    if (!target) return;
    target.classList.remove('jump-flash');
    // Trigger animation restart.
    void target.offsetWidth;
    target.classList.add('jump-flash');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyQuickFilter(kind, value) {
    if (!kind || !value) return;

    if (kind === 'group') {
      state.selectedCategory = 'All Shortcuts';
      state.selectedProgram = value;
      state.groupMode = 'tool';
    }

    if (kind === 'category') {
      state.selectedCategory = value;
      state.selectedProgram = 'All Tools';
    }

    if (kind === 'usage') {
      state.usageFilter = value;
      state.groupMode = 'usage';
    }

    if (kind === 'level') {
      state.levelFilter = value;
      state.groupMode = 'level';
    }

    renderCategoryNav();
    renderContent();
    closeDetail();

    const preferredKey = kind === 'group' || kind === 'usage' || kind === 'level' ? value : null;
    requestAnimationFrame(() => flashFirstResult(preferredKey));
  }

  function card(entry) {
    const fav = state.favorites.has(entry.id);
    const cats = (entry.categories || [])
      .slice(0, 2)
      .map((cat) => quickChip('category', cat, cat))
      .join('');

    return `
      <article tabindex="0" data-card-id="${entry.id}" class="card rounded-2xl p-4">
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="flex flex-wrap gap-1">
            ${cats}
            ${quickChip('group', entry.group, entry.group)}
            ${usageTag(entry, true)}
          </div>
          <button data-action="favorite" data-id="${entry.id}" class="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/10">${fav ? '★' : '☆'}</button>
        </div>

        <div class="mb-1 text-sm font-semibold text-zinc-200">${highlight(entry.program, state.query)}</div>
        <kbd class="command mb-2">${commandMarkup(entry)}</kbd>
        <p class="text-sm text-zinc-300">${highlight(entry.description, state.query)}</p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button data-action="copy" data-id="${entry.id}" class="copy-btn-primary rounded-md border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">📋 Copy</button>
          <button data-action="detail" data-id="${entry.id}" class="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20">Details</button>
          ${entry.docs ? `<a class="inline-flex items-center justify-center rounded-md border border-indigo-400/40 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20" target="_blank" rel="noreferrer" href="${escapeHtml(entry.docs)}">Official docs</a>` : ''}
          ${entry.source === 'custom' ? `<button data-action="edit" data-id="${entry.id}" class="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10">✏️ Edit</button>` : ''}
          ${entry.source === 'custom' ? `<button data-action="delete" data-id="${entry.id}" class="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20">🗑 Delete</button>` : ''}
        </div>
      </article>
    `;
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => el.toast.classList.add('hidden'), 2000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showToast('Copied!');
  }

  function markRecent(id) {
    state.recent = [id, ...state.recent.filter((r) => r !== id)].slice(0, 20);
    saveState();
  }

  function renderStats(rows) {
    const all = entriesInViewMode();
    const total = all.length;
    const visible = rows.length;
    const custom = state.customEntries.length;
    const advanced = all.filter((x) => normalizeValue(x.level) === 'advanced').length;
    const programs = new Set(all.map((x) => x.group)).size;

    el.stats.innerHTML = [
      { label: 'Visible', value: visible },
      { label: 'Total', value: total },
      { label: 'Advanced', value: advanced },
      { label: 'Programs', value: programs },
      { label: 'Custom', value: custom },
    ]
      .map(
        (s) => `<div class="glass rounded-xl p-3"><div class="text-xs uppercase tracking-wider text-zinc-400">${s.label}</div><div class="text-2xl font-extrabold">${s.value}</div></div>`,
      )
      .join('');
  }

  function renderCategoryNav() {
    const modeEntries = entriesInViewMode();
    const counts = new Map();
    counts.set('All Shortcuts', modeEntries.length);
    modeEntries.forEach((entry) => {
      (entry.categories || []).forEach((category) => {
        counts.set(category, (counts.get(category) || 0) + 1);
      });
    });

    const visibleCategories = DATA.CATEGORIES.filter((category) => category.name === 'All Shortcuts' || (counts.get(category.name) || 0) > 0);

    if (!visibleCategories.some((c) => c.name === state.selectedCategory)) {
      state.selectedCategory = 'All Shortcuts';
    }

    el.categoryNav.innerHTML = visibleCategories.map((cat) => {
      const active = state.selectedCategory === cat.name;
      const count = counts.get(cat.name) || 0;
      return `<button data-category="${escapeHtml(cat.name)}" class="w-full rounded-xl border px-3 py-2 text-left text-sm ${
        active
          ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100'
          : 'border-transparent text-zinc-300 hover:bg-white/10'
      }"><span class="mr-2">${cat.icon}</span>${escapeHtml(cat.name)}<span class="float-right text-zinc-400">${count}</span></button>`;
    }).join('');

    el.fieldCategory.innerHTML = visibleCategories.filter((c) => c.name !== 'All Shortcuts')
      .map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`)
      .join('');
  }

  function renderProgramNav() {
    const list = programCounts();
    const allCount = list.reduce((sum, [, count]) => sum + count, 0);
    const header = `<button data-program="All Tools" class="program-btn ${state.selectedProgram === 'All Tools' ? 'active' : ''}">All Tools <span class="float-right text-zinc-400">${allCount}</span></button>`;

    const rows = list
      .map(([name, count]) => {
        const active = state.selectedProgram === name;
        return `<button data-program="${escapeHtml(name)}" class="program-btn ${active ? 'active' : ''}">${escapeHtml(name)} <span class="float-right text-zinc-400">${count}</span></button>`;
      })
      .join('');

    el.programNav.innerHTML = `${header}${rows}`;

    if (state.selectedProgram !== 'All Tools' && !list.some(([name]) => name === state.selectedProgram)) {
      state.selectedProgram = 'All Tools';
    }
  }

  function renderSuggestions(rows) {
    if (!state.query.trim() || state.suggestionSuppressed) {
      el.suggestions.classList.add('hidden');
      return;
    }

    const list = rows.slice(0, 8);
    if (!list.length) {
      el.suggestions.classList.remove('hidden');
      el.suggestions.innerHTML = '<div class="px-3 py-2 text-sm text-zinc-400">No results</div>';
      return;
    }

    el.suggestions.innerHTML = list
      .map((row, idx) => {
        const active = state.suggestionIndex === idx;
        return `
          <button data-suggestion-id="${row.entry.id}" class="block w-full rounded-lg px-3 py-2 text-left ${active ? 'bg-indigo-500/25' : 'hover:bg-indigo-500/20'}">
            <div class="text-xs text-zinc-400">${escapeHtml(row.entry.group)} · ${escapeHtml(row.entry.program)}</div>
            <div class="font-mono text-sm text-emerald-300">${highlight(row.entry.shortcut, state.query)}</div>
            <div class="text-xs text-zinc-300">${highlight(row.entry.description, state.query)}</div>
          </button>
        `;
      })
      .join('');
    el.suggestions.classList.remove('hidden');
  }

  function recentEntries() {
    return state.recent
      .map((id) => allEntries().find((entry) => entry.id === id))
      .filter(Boolean)
      .slice(0, 12);
  }

  function featuredEntries() {
    return allEntries().filter((x) => x.featured || state.favorites.has(x.id)).slice(0, 16);
  }

  function renderContent() {
    renderTopFiltersOptions();
    const rows = filteredRankedEntries();
    syncFilterControls();
    renderModeSwitch();
    renderStats(rows);
    renderProgramNav();
    renderSuggestions(rows);

    const filterBits = [
      `Mode: <span class="font-semibold text-zinc-200">${escapeHtml(labelCase(state.viewMode))}</span>`,
      `Category: <span class="font-semibold text-zinc-200">${escapeHtml(state.selectedCategory)}</span>`,
      `Program: <span class="font-semibold text-zinc-200">${escapeHtml(state.selectedProgram)}</span>`,
      `Usage: <span class="font-semibold text-zinc-200">${escapeHtml(labelCase(state.usageFilter === 'all' ? 'all' : state.usageFilter))}</span>`,
      `Level: <span class="font-semibold text-zinc-200">${escapeHtml(labelCase(state.levelFilter === 'all' ? 'all' : state.levelFilter))}</span>`,
      `${rows.length} results`,
    ];

    if (state.query) filterBits.push(`query: "${escapeHtml(state.query)}"`);

    el.activeFilter.innerHTML = filterBits.join(' · ');

    const showHome =
      state.selectedCategory === 'All Shortcuts' &&
      state.selectedProgram === 'All Tools' &&
      !state.query.trim() &&
      state.usageFilter === 'all' &&
      state.levelFilter === 'all' &&
      state.viewMode === 'commands';

    if (showHome) {
      const featured = featuredEntries();
      const recent = recentEntries();
      const groups = grouped(rows);

      el.content.innerHTML = `
        <section class="space-y-3">
          <h3 class="text-lg font-semibold">Featured</h3>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${featured.map(card).join('')}</div>
        </section>
        <section class="space-y-3">
          <h3 class="text-lg font-semibold">Recently used</h3>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${recent.length ? recent.map(card).join('') : '<div class="rounded-xl border border-dashed border-white/20 p-6 text-sm text-zinc-400">Use copy action to build recent list.</div>'}</div>
        </section>
        <section class="space-y-3">
          <h3 class="text-lg font-semibold">All groups</h3>
          ${groups
            .map(
              ([name, entries], idx) => `
                <details ${idx < 3 ? 'open' : ''} data-section-key="${escapeHtml(domKey(name))}" class="glass rounded-xl p-3">
                  <summary class="cursor-pointer list-none text-base font-semibold">${escapeHtml(labelCase(name))} <span class="ml-2 text-sm text-zinc-400">${entries.length}</span></summary>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${entries.map(card).join('')}</div>
                </details>
              `,
            )
            .join('')}
        </section>
      `;
      return;
    }

    const groups = grouped(rows);
    el.content.innerHTML = groups.length
      ? groups
          .map(
            ([name, entries], idx) => `
              <details ${idx < 4 ? 'open' : ''} data-section-key="${escapeHtml(domKey(name))}" class="glass rounded-xl p-3">
                <summary class="cursor-pointer list-none text-base font-semibold">${escapeHtml(labelCase(name))} <span class="ml-2 text-sm text-zinc-400">${entries.length}</span></summary>
                <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${entries.map(card).join('')}</div>
              </details>
            `,
          )
          .join('')
      : '<div class="rounded-2xl border border-dashed border-white/20 p-10 text-center text-zinc-400">No entries for this filter. Try broadening filters.</div>';
  }

  function openEntryModal(mode, entry) {
    el.entryModal.classList.remove('hidden');
    el.entryModal.classList.add('flex');

    if (mode === 'edit' && entry) {
      el.entryModalTitle.textContent = 'Edit custom entry';
      el.entryId.value = entry.id;
      const category = (entry.categories || []).find((c) => c !== 'My Custom / Notes') || 'My Custom / Notes';
      el.fieldCategory.value = category;
      fillFormSelectOptions(entry);
      el.fieldShortcut.value = entry.shortcut || '';
      el.fieldDescription.value = entry.description || '';
      el.fieldDocs.value = entry.docs || '';
      el.fieldTags.value = (entry.tags || []).join(', ');
    } else {
      el.entryModalTitle.textContent = 'Add shortcut';
      el.entryId.value = '';
      el.fieldCategory.value = state.selectedCategory === 'All Shortcuts' ? 'My Custom / Notes' : state.selectedCategory;
      fillFormSelectOptions({
        type: state.viewMode === 'shortcuts' ? 'shortcut' : 'command',
        group: state.selectedProgram !== 'All Tools' ? state.selectedProgram : '',
        usage: state.usageFilter !== 'all' ? state.usageFilter : 'common',
        level: state.levelFilter !== 'all' ? state.levelFilter : 'basic',
      });
      el.fieldShortcut.value = '';
      el.fieldDescription.value = '';
      el.fieldDocs.value = '';
      el.fieldTags.value = '';
    }

    setTimeout(() => {
      if (el.fieldProgramSelect.value === '__custom__') el.fieldProgramCustom.focus();
      else el.fieldProgramSelect.focus();
    }, 10);
  }

  function closeEntryModal() {
    el.entryModal.classList.add('hidden');
    el.entryModal.classList.remove('flex');
  }

  function openDetail(entry) {
    const flags = Array.isArray(entry.flags) ? entry.flags : [];
    const notes = entry.detail?.notes || [];
    const examples = entry.examples && entry.examples.length
      ? entry.examples
      : flags.slice(0, 3).map((f) => ({ label: f.name, code: `${entry.shortcut} ${f.example || f.name}` }));

    el.detailBody.innerHTML = `
      <div class="mb-3 flex flex-wrap gap-2">
        ${quickChip('group', entry.group, entry.group)}
        ${usageTag(entry, true)}
        ${(entry.categories || []).map((c) => quickChip('category', c, c)).join('')}
      </div>

      <div class="mb-2 text-sm text-zinc-300">${escapeHtml(entry.program)}</div>
      <div class="mb-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3"><kbd class="command">${commandMarkup(entry)}</kbd></div>

      <div class="mb-3 flex flex-wrap gap-2">
        <button data-detail-copy="command" class="copy-btn-primary rounded-md border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">Copy command</button>
        ${entry.docs ? `<a target="_blank" rel="noreferrer" href="${escapeHtml(entry.docs)}" class="inline-flex items-center justify-center rounded-md border border-indigo-400/40 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/20">Official docs</a>` : ''}
      </div>

      <section class="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 class="mb-2 text-sm font-semibold">Description</h3>
        <p class="text-sm text-zinc-300">${escapeHtml(entry.description)}</p>
        ${entry.detail?.whenToUse ? `<p class="mt-2 text-sm text-zinc-400"><span class="font-semibold text-zinc-200">When to use:</span> ${escapeHtml(entry.detail.whenToUse)}</p>` : ''}
        ${entry.detail?.output ? `<p class="mt-2 text-sm text-zinc-400"><span class="font-semibold text-zinc-200">Output:</span> ${escapeHtml(entry.detail.output)}</p>` : ''}
      </section>

      <section class="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 class="mb-2 text-sm font-semibold">Syntax</h3>
        <pre class="overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-emerald-300">${escapeHtml(entry.detail?.syntax || entry.shortcut)}</pre>
      </section>

      <section class="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 class="mb-2 text-sm font-semibold">Flag quick reference</h3>
        ${flags.length
          ? `<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-zinc-400"><th class="py-2 pr-2">Flag</th><th class="py-2 pr-2">What it does</th><th class="py-2 pr-2">Example</th><th></th></tr></thead><tbody>${flags
              .map(
                (f, idx) => `<tr class="border-t border-white/10"><td class="py-2 pr-2 font-mono text-indigo-200">${escapeHtml(f.name)}</td><td class="py-2 pr-2 text-zinc-300">${escapeHtml(f.description || '')}</td><td class="py-2 pr-2 font-mono text-emerald-300">${escapeHtml(f.example || '')}</td><td><button data-detail-copy="flag-${idx}" class="rounded border border-white/20 px-2 py-1 text-[11px] hover:bg-white/10">Copy</button></td></tr>`,
              )
              .join('')}</tbody></table></div>`
          : '<div class="text-sm text-zinc-400">No flags for this shortcut.</div>'}
      </section>

      <section class="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 class="mb-2 text-sm font-semibold">Example usage</h3>
        ${examples.length
          ? examples
              .map(
                (ex, idx) => `<div class="mb-2 rounded-lg border border-white/10 bg-black/30 p-2"><div class="mb-1 text-xs text-zinc-400">${escapeHtml(ex.label || `Example ${idx + 1}`)}</div><div class="flex items-start justify-between gap-2"><code class="break-all font-mono text-xs text-emerald-300">${escapeHtml(ex.code || '')}</code><button data-detail-copy="example-${idx}" class="shrink-0 rounded border border-white/20 px-2 py-1 text-[11px] hover:bg-white/10">Copy</button></div></div>`,
              )
              .join('')
          : '<div class="text-sm text-zinc-400">No examples for this entry.</div>'}
      </section>

      ${notes.length ? `<section class="rounded-xl border border-white/10 bg-black/20 p-3"><h3 class="mb-2 text-sm font-semibold">Notes</h3><ul class="list-disc space-y-1 pl-5 text-sm text-zinc-300">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></section>` : ''}
    `;

    el.detailModal.dataset.entryId = entry.id;
    el.detailModal.classList.remove('hidden');
    el.detailModal.classList.add('flex');
  }

  function closeDetail() {
    el.detailModal.classList.add('hidden');
    el.detailModal.classList.remove('flex');
    el.detailBody.innerHTML = '';
    delete el.detailModal.dataset.entryId;
  }

  function upsertCustom(event) {
    event.preventDefault();

    const id = el.entryId.value.trim() || `custom-${Date.now()}-${Math.round(Math.random() * 9999)}`;
    const category = el.fieldCategory.value || 'My Custom / Notes';
    const categories = ['My Custom / Notes'];
    if (category !== 'My Custom / Notes') categories.unshift(category);

    const programValue = resolvedSelectValue(el.fieldProgramSelect, el.fieldProgramCustom, true);
    const usageValue = resolvedSelectValue(el.fieldUsageSelect, el.fieldUsageCustom) || 'regular';
    const levelValue = resolvedSelectValue(el.fieldLevelSelect, el.fieldLevelCustom) || 'basic';

    if (el.fieldProgramSelect.value === '__custom__' && !programValue) {
      showToast('Provide custom program name');
      return;
    }
    if (el.fieldUsageSelect.value === '__custom__' && !usageValue) {
      showToast('Provide custom usage value');
      return;
    }
    if (el.fieldLevelSelect.value === '__custom__' && !levelValue) {
      showToast('Provide custom level value');
      return;
    }

    const payloadType = normalizeValue(el.fieldType.value || inferEntryType({ shortcut: el.fieldShortcut.value.trim(), group: programValue })) || 'command';

    const payload = {
      id,
      group: programValue || 'custom',
      program: programValue || 'custom',
      type: payloadType,
      categories,
      docs: el.fieldDocs.value.trim(),
      shortcut: el.fieldShortcut.value.trim(),
      description: el.fieldDescription.value.trim(),
      tags: tokenize(el.fieldTags.value.replaceAll(',', ' ')),
      usage: usageValue,
      level: levelValue,
      baseShortcut: el.fieldShortcut.value.trim(),
      flagSuffix: '',
      flags: [],
      examples: [],
      synonyms: [],
      source: 'custom',
      featured: false,
      detail: {
        overview: el.fieldDescription.value.trim(),
        syntax: el.fieldShortcut.value.trim(),
        whenToUse: '',
        output: '',
        notes: [],
      },
    };

    if (!payload.shortcut || !payload.program) {
      showToast('Program and command are required');
      return;
    }

    const idx = state.customEntries.findIndex((x) => x.id === id);
    if (idx >= 0) state.customEntries[idx] = payload;
    else state.customEntries.unshift(payload);

    saveState();
    closeEntryModal();
    renderContent();
    showToast(idx >= 0 ? 'Updated' : 'Added');
  }

  function deleteCustom(id) {
    state.customEntries = state.customEntries.filter((entry) => entry.id !== id);
    state.favorites.delete(id);
    state.recent = state.recent.filter((x) => x !== id);
    saveState();
    renderContent();
    showToast('Deleted');
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveState();
    renderContent();
  }

  function exportJSON() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      customEntries: state.customEntries,
      favorites: [...state.favorites],
      recent: state.recent,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `shortcutvault-backup-${Date.now()}.json`);
  }

  function exportMarkdown() {
    const map = new Map();
    allEntries().forEach((entry) => {
      if (!map.has(entry.group)) map.set(entry.group, []);
      map.get(entry.group).push(entry);
    });

    let md = `# ShortcutVault export\n\n`;
    md += `Total entries: ${allEntries().length}\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;

    [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([group, entries]) => {
      md += `## ${group}\n\n`;
      entries.forEach((entry) => {
        md += `- \`${entry.shortcut}\` (${entry.usage}/${entry.level}) - ${entry.description}\n`;
      });
      md += '\n';
    });

    downloadBlob(new Blob([md], { type: 'text/markdown' }), `shortcutvault-export-${Date.now()}.md`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const importedCustom = Array.isArray(parsed.customEntries)
          ? parsed.customEntries
          : Array.isArray(parsed)
            ? parsed
            : [];

        state.customEntries = importedCustom.map((entry, idx) => ({
          ...entry,
          id: entry.id || `custom-import-${Date.now()}-${idx}`,
          source: 'custom',
          categories: Array.isArray(entry.categories) ? entry.categories : ['My Custom / Notes'],
          tags: Array.isArray(entry.tags) ? entry.tags : tokenize(String(entry.tags || '')),
          usage: normalizeValue(entry.usage || 'regular'),
          level: normalizeValue(entry.level || 'basic'),
          type: normalizeValue(entry.type || inferEntryType(entry)),
          baseShortcut: entry.baseShortcut || entry.shortcut || '',
          flagSuffix: entry.flagSuffix || '',
          flags: Array.isArray(entry.flags) ? entry.flags : [],
          examples: Array.isArray(entry.examples) ? entry.examples : [],
          detail: entry.detail || {
            overview: entry.description || '',
            syntax: entry.shortcut || '',
            notes: [],
          },
        }));

        if (Array.isArray(parsed.favorites)) state.favorites = new Set(parsed.favorites);
        if (Array.isArray(parsed.recent)) state.recent = parsed.recent.slice(0, 20);

        saveState();
        renderContent();
        showToast('Import complete');
      } catch {
        showToast('Invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  function onCardAction(action, id) {
    const entry = allEntries().find((x) => x.id === id);
    if (!entry) return;

    if (action === 'copy') {
      copyText(entry.shortcut);
      markRecent(id);
      renderContent();
      return;
    }

    if (action === 'detail') {
      openDetail(entry);
      return;
    }

    if (action === 'favorite') {
      toggleFavorite(id);
      return;
    }

    if (action === 'edit' && entry.source === 'custom') {
      openEntryModal('edit', entry);
      return;
    }

    if (action === 'delete' && entry.source === 'custom') {
      if (confirm('Delete this custom entry?')) deleteCustom(id);
    }
  }

  function focusCard(delta) {
    const cards = [...document.querySelectorAll('[data-card-id]')];
    if (!cards.length) return;
    const current = document.activeElement?.closest?.('[data-card-id]');
    const index = current ? cards.indexOf(current) : -1;
    const next = Math.max(0, Math.min(cards.length - 1, index + delta));
    cards[next].focus();
  }

  function closeMenus() {
    el.exportMenu.classList.add('hidden');
    el.suggestions.classList.add('hidden');
    state.suggestionIndex = -1;
    state.suggestionSuppressed = true;
  }

  function activateSuggestion(idx) {
    const list = filteredRankedEntries().slice(0, 8);
    const row = list[idx];
    if (!row) return;

    state.query = row.entry.shortcut;
    el.search.value = state.query;
    state.suggestionIndex = -1;
    state.suggestionSuppressed = true;
    renderContent();

    setTimeout(() => {
      const node = document.querySelector(`[data-card-id="${CSS.escape(row.entry.id)}"]`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.focus();
      }
    }, 40);
  }

  function bindEvents() {
    el.menuBtn.addEventListener('click', () => {
      el.sidebar.classList.toggle('-translate-x-full');
      el.mobileOverlay.classList.toggle('hidden');
    });

    el.mobileOverlay.addEventListener('click', () => {
      el.sidebar.classList.add('-translate-x-full');
      el.mobileOverlay.classList.add('hidden');
    });

    el.categoryNav.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      state.selectedCategory = btn.dataset.category;
      state.selectedProgram = 'All Tools';
      renderCategoryNav();
      renderContent();
      el.sidebar.classList.add('-translate-x-full');
      el.mobileOverlay.classList.add('hidden');
    });

    el.programNav.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-program]');
      if (!btn) return;
      state.selectedProgram = btn.dataset.program;
      renderContent();
    });

    el.clearProgramFilter.addEventListener('click', () => {
      state.selectedProgram = 'All Tools';
      renderContent();
    });

    el.search.addEventListener('input', () => {
      state.query = el.search.value;
      state.suggestionIndex = -1;
      state.suggestionSuppressed = false;
      renderContent();
    });

    el.search.addEventListener('keydown', (event) => {
      const list = filteredRankedEntries().slice(0, 8);
      if (event.key === 'Enter' && state.suggestionIndex < 0) {
        event.preventDefault();
        state.suggestionSuppressed = true;
        el.suggestions.classList.add('hidden');
        return;
      }

      if (!list.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.suggestionSuppressed = false;
        state.suggestionIndex = Math.min(list.length - 1, state.suggestionIndex + 1);
        renderSuggestions(list);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.suggestionSuppressed = false;
        state.suggestionIndex = Math.max(0, state.suggestionIndex - 1);
        renderSuggestions(list);
      }

      if (event.key === 'Enter' && state.suggestionIndex >= 0) {
        event.preventDefault();
        activateSuggestion(state.suggestionIndex);
      }
    });

    el.suggestions.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-suggestion-id]');
      if (!btn) return;
      const list = filteredRankedEntries().slice(0, 8);
      const idx = list.findIndex((row) => row.entry.id === btn.dataset.suggestionId);
      if (idx >= 0) activateSuggestion(idx);
    });

    el.groupMode.addEventListener('change', () => {
      state.groupMode = el.groupMode.value;
      renderContent();
    });

    el.usageFilter.addEventListener('change', () => {
      state.usageFilter = el.usageFilter.value;
      renderContent();
    });

    el.levelFilter.addEventListener('change', () => {
      state.levelFilter = el.levelFilter.value;
      renderContent();
    });

    if (el.entryModeSwitch) {
      el.entryModeSwitch.addEventListener('click', (event) => {
        const button = event.target.closest('[data-entry-mode]');
        if (!button) return;
        state.viewMode = button.dataset.entryMode;
        state.selectedCategory = 'All Shortcuts';
        state.selectedProgram = 'All Tools';
        state.suggestionSuppressed = false;
        renderCategoryNav();
        renderContent();
      });
    }

    el.fieldType.addEventListener('change', () => {
      fillFormSelectOptions({
        type: normalizeValue(el.fieldType.value),
        group: '',
        usage: resolvedSelectValue(el.fieldUsageSelect, el.fieldUsageCustom) || 'common',
        level: resolvedSelectValue(el.fieldLevelSelect, el.fieldLevelCustom) || 'basic',
      });
    });

    el.fieldProgramSelect.addEventListener('change', () => {
      toggleCustomInput(el.fieldProgramSelect, el.fieldProgramCustom);
    });

    el.fieldUsageSelect.addEventListener('change', () => {
      toggleCustomInput(el.fieldUsageSelect, el.fieldUsageCustom);
    });

    el.fieldLevelSelect.addEventListener('change', () => {
      toggleCustomInput(el.fieldLevelSelect, el.fieldLevelCustom);
    });

    el.addBtn.addEventListener('click', () => openEntryModal('add'));
    el.entryModalClose.addEventListener('click', closeEntryModal);
    el.entryCancel.addEventListener('click', closeEntryModal);
    el.entryForm.addEventListener('submit', upsertCustom);
    el.entryModal.addEventListener('click', (event) => {
      if (event.target === el.entryModal) closeEntryModal();
    });

    el.content.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-quick-kind]');
      if (quick) {
        event.preventDefault();
        event.stopPropagation();
        applyQuickFilter(quick.dataset.quickKind, quick.dataset.quickValue);
        return;
      }

      const actionBtn = event.target.closest('[data-action]');
      if (actionBtn) {
        onCardAction(actionBtn.dataset.action, actionBtn.dataset.id);
        return;
      }

      const link = event.target.closest('a[href]');
      if (link) return;

      const card = event.target.closest('[data-card-id]');
      if (!card) return;
      onCardAction('detail', card.dataset.cardId);
    });

    el.content.addEventListener('keydown', (event) => {
      const card = event.target.closest('[data-card-id]');
      if (!card) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        onCardAction('copy', card.dataset.cardId);
      }
      if (event.key === ' ') {
        event.preventDefault();
        onCardAction('detail', card.dataset.cardId);
      }
    });

    el.detailClose.addEventListener('click', closeDetail);
    el.detailModal.addEventListener('click', (event) => {
      if (event.target === el.detailModal) closeDetail();
    });

    el.detailBody.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-quick-kind]');
      if (quick) {
        event.preventDefault();
        applyQuickFilter(quick.dataset.quickKind, quick.dataset.quickValue);
        return;
      }

      const btn = event.target.closest('[data-detail-copy]');
      if (!btn) return;
      const id = el.detailModal.dataset.entryId;
      const entry = allEntries().find((x) => x.id === id);
      if (!entry) return;

      const key = btn.dataset.detailCopy;
      if (key === 'command') {
        copyText(entry.shortcut);
        markRecent(entry.id);
        return;
      }

      if (key.startsWith('flag-')) {
        const idx = Number(key.replace('flag-', ''));
        const f = entry.flags?.[idx];
        if (!f) return;
        copyText(`${entry.shortcut} ${f.example || f.name}`);
        markRecent(entry.id);
        return;
      }

      if (key.startsWith('example-')) {
        const idx = Number(key.replace('example-', ''));
        const ex = entry.examples?.[idx];
        if (!ex) return;
        copyText(ex.code || '');
        markRecent(entry.id);
      }
    });

    el.exportBtn.addEventListener('click', () => {
      el.exportMenu.classList.toggle('hidden');
    });

    el.exportMenu.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-export]');
      if (!btn) return;
      if (btn.dataset.export === 'json') exportJSON();
      if (btn.dataset.export === 'md') exportMarkdown();
      el.exportMenu.classList.add('hidden');
    });

    el.importBtn.addEventListener('click', () => {
      el.importInput.click();
      el.exportMenu.classList.add('hidden');
    });

    el.importInput.addEventListener('change', (event) => {
      importJSON(event.target.files?.[0]);
      event.target.value = '';
    });

    el.printBtn.addEventListener('click', () => {
      document.querySelectorAll('details').forEach((d) => {
        d.open = true;
      });
      window.print();
    });

    el.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('#export-btn') && !event.target.closest('#export-menu')) {
        el.exportMenu.classList.add('hidden');
      }
      if (!event.target.closest('#search') && !event.target.closest('#suggestions')) {
        el.suggestions.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (event) => {
      const tag = String(event.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || event.target.isContentEditable;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        el.search.focus();
        el.search.select();
      }

      if (event.key === 'Escape') {
        closeEntryModal();
        closeDetail();
        closeMenus();
        el.sidebar.classList.add('-translate-x-full');
        el.mobileOverlay.classList.add('hidden');
      }

      if (!typing && (event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
        event.preventDefault();
        focusCard(1);
      }

      if (!typing && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
        event.preventDefault();
        focusCard(-1);
      }
    });
  }

  function setupPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // keep app usable if registration fails
      });
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      el.installBtn.classList.remove('hidden');
    });

    el.installBtn.addEventListener('click', async () => {
      if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
        await state.deferredInstallPrompt.userChoice;
        state.deferredInstallPrompt = null;
        el.installBtn.classList.add('hidden');
      } else {
        showToast('Use browser menu: Add to Home Screen');
      }
    });
  }

  function init() {
    initTheme();
    loadState();
    renderCategoryNav();
    renderModeSwitch();
    bindEvents();
    setupPWA();
    renderContent();

    console.info(`[ShortcutVault] Loaded ${DATA.META.count} generated entries.`);
  }

  init();
})();
