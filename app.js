'use strict';

const form = document.getElementById('check-form');
const urlInput = document.getElementById('url-input');
const checkBtn = document.getElementById('check-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const errorMsg = document.getElementById('error-msg');
const results = document.getElementById('results');
const suggestionsEl = document.getElementById('suggestions');

// Preview card
const previewImg = document.getElementById('preview-img');
const previewImgMissing = document.getElementById('preview-img-missing');
const previewDomain = document.getElementById('preview-domain');

// Meta cards
const valueTitle = document.getElementById('value-title');
const charLabelTitle = document.getElementById('char-label-title');
const charFillTitle = document.getElementById('char-fill-title');
const copyTitleBtn = document.getElementById('copy-title');

const valueDesc = document.getElementById('value-desc');
const charLabelDesc = document.getElementById('char-label-desc');
const charFillDesc = document.getElementById('char-fill-desc');
const copyDescBtn = document.getElementById('copy-desc');

const ogImageDims = document.getElementById('og-image-dims');
const previewImgActions = document.getElementById('preview-img-actions');
const downloadImgBtn = document.getElementById('download-img');
const copyImgUrlBtn = document.getElementById('copy-img-url');

// ─── Suggestions ───────────────────────────────────────────────────────────

const RECENT_KEY = 'gm_recent_urls';
const MAX_RECENT = 10;
const TLDS = ['.com', '.co', '.io', '.net', '.org'];

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecent(url) {
  try {
    const list = getRecent().filter(u => u !== url);
    list.unshift(url);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

function removeRecent(url) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(u => u !== url)));
  } catch {}
}

let activeIndex = -1;
let currentItems = [];

function closeSuggestions() {
  suggestionsEl.classList.remove('open');
  urlInput.setAttribute('aria-expanded', 'false');
  activeIndex = -1;
  currentItems = [];
}

function setActive(index) {
  suggestionsEl.querySelectorAll('.suggestion-item').forEach((el, i) =>
    el.classList.toggle('active', i === index)
  );
  activeIndex = index;
}

function makeSuggestionRow(display, value, icon, onRemove) {
  const row = document.createElement('div');
  row.className = 'suggestion-item';
  row.setAttribute('role', 'option');
  row.dataset.url = value;

  const ic = document.createElement('span');
  ic.className = 'suggestion-icon';
  ic.innerHTML = icon;

  const lbl = document.createElement('span');
  lbl.className = 'suggestion-label';
  lbl.textContent = display;

  row.appendChild(ic);
  row.appendChild(lbl);

  if (onRemove) {
    const rm = document.createElement('button');
    rm.className = 'suggestion-remove';
    rm.type = 'button';
    rm.setAttribute('aria-label', `Remove ${display} from history`);
    rm.textContent = '×';
    rm.addEventListener('click', e => { e.stopPropagation(); onRemove(); });
    row.appendChild(rm);
  }

  row.addEventListener('mousedown', e => { e.preventDefault(); selectSuggestion(value); });
  return row;
}

const ICON_CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICON_GLOBE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"/></svg>';

function buildSuggestions(value) {
  const raw = value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const frag = document.createDocumentFragment();
  currentItems = [];

  if (!raw) {
    // Empty input — show recent URLs if any
    const recent = getRecent().slice(0, 6);
    if (!recent.length) return closeSuggestions();
    const heading = document.createElement('div');
    heading.className = 'suggestion-section-label';
    heading.textContent = 'Recent';
    frag.appendChild(heading);
    recent.forEach(url => {
      const display = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
      const row = makeSuggestionRow(display, url, ICON_CLOCK, () => {
        removeRecent(url);
        buildSuggestions(urlInput.value);
      });
      frag.appendChild(row);
      currentItems.push(row);
    });
  } else if (!raw.includes('.')) {
    // No dot yet — suggest TLD completions
    TLDS.forEach(tld => {
      const display = raw + tld;
      const row = makeSuggestionRow(display, display, ICON_GLOBE, null);
      frag.appendChild(row);
      currentItems.push(row);
    });
  } else {
    // Has a dot — match against recent
    const matched = getRecent().filter(u => {
      const c = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
      return c.startsWith(raw.toLowerCase()) || c.includes(raw.toLowerCase());
    }).slice(0, 6);
    if (!matched.length) return closeSuggestions();
    matched.forEach(url => {
      const display = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
      const row = makeSuggestionRow(display, url, ICON_CLOCK, () => {
        removeRecent(url);
        buildSuggestions(urlInput.value);
      });
      frag.appendChild(row);
      currentItems.push(row);
    });
  }

  suggestionsEl.innerHTML = '';
  suggestionsEl.appendChild(frag);
  suggestionsEl.classList.add('open');
  urlInput.setAttribute('aria-expanded', 'true');
  activeIndex = -1;
}

function selectSuggestion(value) {
  const display = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  urlInput.value = display;
  closeSuggestions();
  urlInput.focus();
}

urlInput.addEventListener('input', () => openSuggestions(urlInput.value));

urlInput.addEventListener('focus', () => openSuggestions(urlInput.value));

urlInput.addEventListener('keydown', e => {
  if (!suggestionsEl.classList.contains('open')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActive(Math.min(activeIndex + 1, currentItems.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive(Math.max(activeIndex - 1, -1));
    if (activeIndex === -1) urlInput.focus();
  } else if (e.key === 'Enter' && activeIndex >= 0) {
    e.preventDefault();
    selectSuggestion(currentItems[activeIndex].dataset.url);
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

document.addEventListener('click', e => {
  if (!form.contains(e.target)) closeSuggestions();
});

// ─── Utilities ─────────────────────────────────────────────────────────────

function setLoading(on) {
  checkBtn.disabled = on;
  btnText.textContent = on ? 'Pulling' : 'Pull';
  btnLoader.classList.toggle('visible', on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
  results.classList.remove('visible');
}

function hideError() {
  errorMsg.classList.remove('visible');
}

function normalizeUrl(raw) {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s;
}

function setCharBar(fillEl, labelEl, len, min, max) {
  if (len === 0) {
    fillEl.style.width = '0%';
    fillEl.className = 'char-fill';
    labelEl.textContent = '';
    return;
  }
  const pct = Math.min((len / max) * 100, 100);
  fillEl.style.width = pct + '%';
  labelEl.textContent = `${len} chars (${min}–${max} recommended)`;
  if (len < min) fillEl.className = 'char-fill fill-warn';
  else if (len > max) fillEl.className = 'char-fill fill-over';
  else fillEl.className = 'char-fill fill-good';
}

function copyText(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function detectOgImageDims(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function downloadImage(url) {
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('proxy failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const filename = (new URL(url).hostname) + '-preview.' + ext;
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
}

// ─── Results rendering ─────────────────────────────────────────────────────

function renderResults(data) {
  const domain = data.domain || '';
  const title = data.title || '';
  const desc = data.description || '';
  const ogImage = data.ogImage || '';

  // Preview card
  previewDomain.textContent = domain;

  if (ogImage) {
    previewImg.src = ogImage;
    previewImg.style.display = 'block';
    previewImgMissing.style.display = 'none';
    previewImg.onerror = () => {
      previewImg.style.display = 'none';
      previewImgMissing.style.display = 'flex';
    };
  } else {
    previewImg.style.display = 'none';
    previewImgMissing.style.display = 'flex';
  }

  // Title
  valueTitle.textContent = title || 'No page title found';
  valueTitle.classList.toggle('missing', !title);
  setCharBar(charFillTitle, charLabelTitle, title.length, 50, 60);
  copyTitleBtn.style.display = title ? '' : 'none';
  copyTitleBtn.onclick = () => copyText(title, copyTitleBtn);

  // Description
  valueDesc.textContent = desc || 'No meta description found';
  valueDesc.classList.toggle('missing', !desc);
  setCharBar(charFillDesc, charLabelDesc, desc.length, 150, 160);
  copyDescBtn.style.display = desc ? '' : 'none';
  copyDescBtn.onclick = () => copyText(desc, copyDescBtn);

  // Link preview image
  if (ogImage) {
    previewImgActions.style.display = '';
    downloadImgBtn.onclick = () => downloadImage(ogImage);
    copyImgUrlBtn.onclick = () => copyText(ogImage, copyImgUrlBtn);
    detectOgImageDims(ogImage).then(dims => {
      ogImageDims.textContent = dims ? `${dims.w}×${dims.h} px` : '';
    });
  } else {
    previewImgActions.style.display = 'none';
    ogImageDims.textContent = '';
  }

  results.classList.add('visible');
  results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Form submit ────────────────────────────────────────────────────────────

form.addEventListener('submit', async e => {
  e.preventDefault();
  closeSuggestions();
  hideError();

  const raw = urlInput.value.trim();
  if (!raw) return;
  const url = normalizeUrl(raw);

  setLoading(true);

  try {
    const res = await fetch('/api/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    saveRecent(url);
    renderResults(data);
  } catch {
    showError('Could not connect to the server. Please try again.');
  } finally {
    setLoading(false);
  }
});

urlInput.addEventListener('blur', () => {
  const raw = urlInput.value.trim();
  if (raw && !/^https?:\/\//i.test(raw)) urlInput.value = 'https://' + raw;
});
