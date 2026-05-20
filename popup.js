// ── Zoom tab detection ──────────────────────────────────────────

const ZOOM_URL_PATTERNS = [
  '*://*.zoom.us/*',  '*://zoom.us/*',
  '*://*.zoom.com/*', '*://zoom.com/*',
  '*://*.zoomgov.com/*', '*://zoomgov.com/*'
];

const ZOOM_REGEX = [
  /^https?:\/\/([^/]*\.)?zoom\.us(\/|$)/i,
  /^https?:\/\/([^/]*\.)?zoom\.com(\/|$)/i,
  /^https?:\/\/([^/]*\.)?zoomgov\.com(\/|$)/i
];

function isZoomUrl(url) {
  return url && ZOOM_REGEX.some(r => r.test(url));
}

async function findZoomTabs() {
  const patternResults = await Promise.all(
    ZOOM_URL_PATTERNS.map(p => chrome.tabs.query({ url: p }))
  );
  const allTabs = await chrome.tabs.query({});
  const byRegex = allTabs.filter(t => isZoomUrl(t.url));
  const seen = new Set();
  const merged = [];
  for (const tab of [...patternResults.flat(), ...byRegex]) {
    if (!seen.has(tab.id)) { seen.add(tab.id); merged.push(tab); }
  }
  return merged;
}

// ── Empty tab detection ─────────────────────────────────────────

const EMPTY_URLS = new Set([
  'chrome://newtab/',
  'chrome://new-tab-page/',
  'about:blank',
  'about:newtab',
  'edge://newtab/',
]);

function isEmptyTab(tab) {
  if (!tab.url) return false;
  if (EMPTY_URLS.has(tab.url)) return true;
  // Chrome's new tab page can also appear as chrome-search://
  if (tab.url.startsWith('chrome-search://')) return true;
  return false;
}

async function findEmptyTabs() {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  // Never close the last tab — Chrome needs at least one
  const empties = allTabs.filter(isEmptyTab);
  if (empties.length === allTabs.length) {
    empties.pop(); // keep one
  }
  return empties;
}

// ── Duplicate tab detection ─────────────────────────────────────

async function findDuplicateTabs() {
  const allTabs = await chrome.tabs.query({});
  const byUrl = new Map();
  for (const tab of allTabs) {
    if (!tab.url || EMPTY_URLS.has(tab.url) || tab.url === 'about:blank') continue;
    if (!byUrl.has(tab.url)) byUrl.set(tab.url, []);
    byUrl.get(tab.url).push(tab);
  }
  const dupes = [];
  for (const [, tabs] of byUrl) {
    if (tabs.length < 2) continue;
    tabs.sort((a, b) => a.index - b.index);
    // Keep newest (last), close the rest
    for (let i = 0; i < tabs.length - 1; i++) {
      dupes.push({ tab: tabs[i], count: tabs.length });
    }
  }
  return dupes;
}

// ── Scan everything ─────────────────────────────────────────────

async function scanAll() {
  const [zoom, dupes, empties] = await Promise.all([
    findZoomTabs(), findDuplicateTabs(), findEmptyTabs()
  ]);
  // Deduplicate across categories — a tab may be both Zoom AND a duplicate
  // Priority: zoom > dupe > empty
  const claimed = new Set();
  const zoomFinal = [];
  for (const t of zoom) { claimed.add(t.id); zoomFinal.push(t); }
  const dupeFinal = [];
  for (const d of dupes) {
    if (!claimed.has(d.tab.id)) { claimed.add(d.tab.id); dupeFinal.push(d); }
  }
  const emptyFinal = [];
  for (const t of empties) {
    if (!claimed.has(t.id)) { claimed.add(t.id); emptyFinal.push(t); }
  }
  return { zoom: zoomFinal, dupes: dupeFinal, empties: emptyFinal };
}

// ── Render ──────────────────────────────────────────────────────

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function setVal(id, count) {
  const el = document.getElementById(id);
  el.textContent = count;
  el.className = 'summary-value ' + (count > 0 ? 'active' : 'zero');
}

function render(data) {
  const { zoom, dupes, empties } = data;
  const total = zoom.length + dupes.length + empties.length;

  setVal('zoom-val', zoom.length);
  setVal('dupe-val', dupes.length);
  setVal('empty-val', empties.length);
  document.getElementById('total-val').textContent = total;

  // Build combined tab list
  const list = document.getElementById('tab-list');
  const items = [];
  for (const t of zoom)   items.push({ tag: 'zoom',  label: 'zoom',  title: t.title || t.url });
  for (const d of dupes)   items.push({ tag: 'dupe',  label: 'dupe',  title: d.tab.title || d.tab.url });
  for (const t of empties) items.push({ tag: 'empty', label: 'empty', title: t.title || 'New Tab' });

  if (items.length > 0) {
    list.style.display = 'flex';
    list.innerHTML = items.map(i => `
      <div class="tab-item">
        <span class="icon-tag ${i.tag}">${i.label}</span>
        <span class="title">${escapeHtml(i.title)}</span>
      </div>
    `).join('');
  } else {
    list.style.display = 'none';
  }

  // Button state — always active since we also reorder
  const btn = document.getElementById('clean-btn');
  if (total > 0) {
    btn.className = 'action-btn go';
    btn.disabled = false;
    btn.textContent = `Clean ${total} tab${total !== 1 ? 's' : ''} & reorder`;
  } else {
    // Still allow reorder even with nothing to close
    btn.className = 'action-btn go';
    btn.disabled = false;
    btn.textContent = 'Reorder tabs by domain';
  }
}

// ── Clean action ────────────────────────────────────────────────

async function cleanAll() {
  const btn = document.getElementById('clean-btn');
  const msg = document.getElementById('success-msg');
  btn.disabled = true;
  btn.textContent = 'Cleaning…';

  // 1. Close tabs
  const data = await scanAll();
  const idsToClose = new Set();
  for (const t of data.zoom) idsToClose.add(t.id);
  for (const d of data.dupes) idsToClose.add(d.tab.id);
  for (const t of data.empties) idsToClose.add(t.id);

  if (idsToClose.size > 0) {
    await chrome.tabs.remove([...idsToClose]);
  }

  // 2. Reorder remaining tabs by domain (current window, unpinned only)
  const remaining = await chrome.tabs.query({ currentWindow: true });
  const pinned = remaining.filter(t => t.pinned);
  const unpinned = remaining.filter(t => !t.pinned);

  function getDomain(tab) {
    try {
      // Extract hostname, strip leading "www."
      return new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return 'zzz'; // non-parseable URLs sort last
    }
  }

  unpinned.sort((a, b) => {
    const da = getDomain(a);
    const db = getDomain(b);
    if (da !== db) return da.localeCompare(db);
    // Same domain — sort by title as tiebreaker
    return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
  });

  const startIdx = pinned.length;
  for (let i = 0; i < unpinned.length; i++) {
    await chrome.tabs.move(unpinned[i].id, { index: startIdx + i });
  }

  // 3. Show result
  const freshData = await scanAll();
  render(freshData);
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 2500);
}

// ── Init ────────────────────────────────────────────────────────

document.getElementById('clean-btn').addEventListener('click', cleanAll);

setTimeout(async () => {
  const data = await scanAll();
  document.getElementById('scanning').classList.remove('active');
  document.getElementById('main-content').style.display = 'block';
  render(data);
}, 400);
