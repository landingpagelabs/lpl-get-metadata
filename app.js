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
const previewTitle = document.getElementById('preview-title');
const previewDesc = document.getElementById('preview-desc');

// Meta cards
const valueTitle = document.getElementById('value-title');
const badgeTitle = document.getElementById('badge-title');
const charLabelTitle = document.getElementById('char-label-title');
const charFillTitle = document.getElementById('char-fill-title');
const copyTitleBtn = document.getElementById('copy-title');

const valueDesc = document.getElementById('value-desc');
const badgeDesc = document.getElementById('badge-desc');
const charLabelDesc = document.getElementById('char-label-desc');
const charFillDesc = document.getElementById('char-fill-desc');
const copyDescBtn = document.getElementById('copy-desc');

const valueOgImage = document.getElementById('value-og-image');
const badgeOgImage = document.getElementById('badge-og-image');
const ogImageDims = document.getElementById('og-image-dims');
const copyOgImageBtn = document.getElementById('copy-og-image');
const openOgImageBtn = document.getElementById('open-og-image');

// ─── Suggestions ───────────────────────────────────────────────────────────

const RECENT_KEY = 'gm_recent_urls';
const MAX_RECENT = 12;

const POPULAR = [
  'stripe.com', 'shopify.com', 'notion.so', 'linear.app', 'vercel.com',
  'github.com', 'figma.com', 'webflow.com', 'framer.com', 'squarespace.com',
  'hubspot.com', 'mailchimp.com', 'intercom.com', 'salesforce.com',
  'zapier.com', 'airtable.com', 'monday.com', 'clickup.com', 'asana.com',
  'slack.com', 'zoom.us', 'canva.com', 'wix.com', 'wordpress.com',
  'netflix.com', 'airbnb.com', 'amazon.com', 'apple.com', 'linkedin.com',
];

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
    const list = getRecent().filter(u => u !== url);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

function matchesTerm(candidate, term) {
  const t = term.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const c = candidate.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  return c.startsWith(t) || c.includes(t);
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
  const items = suggestionsEl.querySelectorAll('.suggestion-item');
  items.forEach((el, i) => el.classList.toggle('active', i === index));
  activeIndex = index;
}

function buildSuggestions(term) {
  const raw = term.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');

  const recent = getRecent();
  const matchedRecent = raw
    ? recent.filter(u => matchesTerm(u, raw))
    : recent.slice(0, 5);

  const matchedPopular = POPULAR.filter(p => {
    if (!raw) return true;
    if (!matchesTerm(p, raw)) return false;
    // don't duplicate if already in recent
    return !matchedRecent.some(r => r.replace(/^https?:\/\//, '').replace(/^www\./, '').startsWith(p));
  }).slice(0, raw ? 6 : 4);

  if (!matchedRecent.length && !matchedPopular.length) return closeSuggestions();

  const frag = document.createDocumentFragment();
  currentItems = [];

  function addSection(label, items, isRecent) {
    if (!items.length) return;
    const heading = document.createElement('div');
    heading.className = 'suggestion-section-label';
    heading.textContent = label;
    frag.appendChild(heading);

    items.forEach(url => {
      const display = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      const row = document.createElement('div');
      row.className = 'suggestion-item';
      row.setAttribute('role', 'option');
      row.dataset.url = url;

      const icon = document.createElement('span');
      icon.className = 'suggestion-icon';
      icon.innerHTML = isRecent
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

      const lbl = document.createElement('span');
      lbl.className = 'suggestion-label';
      lbl.textContent = display;

      row.appendChild(icon);
      row.appendChild(lbl);

      if (isRecent) {
        const rm = document.createElement('button');
        rm.className = 'suggestion-remove';
        rm.type = 'button';
        rm.setAttribute('aria-label', `Remove ${display} from history`);
        rm.textContent = '×';
        rm.addEventListener('click', e => {
          e.stopPropagation();
          removeRecent(url);
          openSuggestions(urlInput.value);
        });
        row.appendChild(rm);
      }

      row.addEventListener('mousedown', e => {
        e.preventDefault();
        selectSuggestion(url);
      });

      frag.appendChild(row);
      currentItems.push(row);
    });
  }

  addSection('Recent', matchedRecent, true);
  addSection('Popular', matchedPopular, false);

  suggestionsEl.innerHTML = '';
  suggestionsEl.appendChild(frag);
  suggestionsEl.classList.add('open');
  urlInput.setAttribute('aria-expanded', 'true');
  activeIndex = -1;
}

function openSuggestions(value) {
  buildSuggestions(value || '');
}

function selectSuggestion(url) {
  const display = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
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
  btnText.textContent = on ? 'Checking' : 'Check';
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

function getCharBadge(len, min, max) {
  if (len === 0) return { cls: 'badge-missing', label: 'Missing' };
  if (len < min) return { cls: 'badge-warn', label: `${len} chars` };
  if (len > max) return { cls: 'badge-warn', label: `${len} chars` };
  return { cls: 'badge-good', label: `${len} chars` };
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

// ─── Results rendering ─────────────────────────────────────────────────────

function renderResults(data) {
  const domain = data.domain || '';
  const title = data.title || '';
  const desc = data.description || '';
  const ogImage = data.ogImage || '';

  // Preview card
  previewDomain.textContent = domain;
  previewTitle.textContent = title || 'No title found';
  previewDesc.textContent = desc || 'No description found';

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

  // Title card
  const titleLen = title.length;
  const titleBadge = getCharBadge(titleLen, 50, 60);
  valueTitle.textContent = title || 'No meta title found';
  valueTitle.classList.toggle('missing', !title);
  badgeTitle.textContent = titleBadge.label;
  badgeTitle.className = 'meta-badge ' + titleBadge.cls;
  setCharBar(charFillTitle, charLabelTitle, titleLen, 50, 60);
  copyTitleBtn.style.display = title ? '' : 'none';
  copyTitleBtn.onclick = () => copyText(title, copyTitleBtn);

  // Description card
  const descLen = desc.length;
  const descBadge = getCharBadge(descLen, 150, 160);
  valueDesc.textContent = desc || 'No meta description found';
  valueDesc.classList.toggle('missing', !desc);
  badgeDesc.textContent = descBadge.label;
  badgeDesc.className = 'meta-badge ' + descBadge.cls;
  setCharBar(charFillDesc, charLabelDesc, descLen, 150, 160);
  copyDescBtn.style.display = desc ? '' : 'none';
  copyDescBtn.onclick = () => copyText(desc, copyDescBtn);

  // OG Image card
  if (ogImage) {
    valueOgImage.textContent = ogImage;
    badgeOgImage.textContent = 'Found';
    badgeOgImage.className = 'meta-badge badge-good';
    copyOgImageBtn.style.display = '';
    copyOgImageBtn.onclick = () => copyText(ogImage, copyOgImageBtn);
    openOgImageBtn.style.display = '';
    openOgImageBtn.href = ogImage;
    detectOgImageDims(ogImage).then(dims => {
      ogImageDims.textContent = dims ? `${dims.w}×${dims.h} px` : '';
    });
  } else {
    valueOgImage.textContent = 'No OG image found';
    badgeOgImage.textContent = 'Missing';
    badgeOgImage.className = 'meta-badge badge-missing';
    copyOgImageBtn.style.display = 'none';
    openOgImageBtn.style.display = 'none';
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
