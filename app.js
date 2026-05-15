'use strict';

const form = document.getElementById('check-form');
const urlInput = document.getElementById('url-input');
const checkBtn = document.getElementById('check-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const errorMsg = document.getElementById('error-msg');
const results = document.getElementById('results');

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
  if (len < min) return { cls: 'badge-warn', label: `Too short (${len})` };
  if (len > max) return { cls: 'badge-warn', label: `Too long (${len})` };
  return { cls: 'badge-good', label: `Good (${len})` };
}

function setCharBar(fillEl, labelEl, len, min, max) {
  if (len === 0) {
    fillEl.style.width = '0%';
    fillEl.className = 'char-fill fill-good';
    labelEl.textContent = '';
    return;
  }
  const pct = Math.min((len / max) * 100, 100);
  fillEl.style.width = pct + '%';
  labelEl.textContent = `${len} chars (${min}–${max} recommended)`;
  if (len < min) {
    fillEl.className = 'char-fill fill-warn';
  } else if (len > max) {
    fillEl.className = 'char-fill fill-over';
  } else {
    fillEl.className = 'char-fill fill-good';
  }
}

function copyText(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

function detectOgImageDims(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function renderResults(data) {
  const domain = data.domain || '';
  const title = data.title || '';
  const desc = data.description || '';
  const ogImage = data.ogImage || '';

  // --- Preview card ---
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

  // --- Title card ---
  const titleLen = title.length;
  const titleBadge = getCharBadge(titleLen, 50, 60);
  if (title) {
    valueTitle.textContent = title;
    valueTitle.classList.remove('missing');
  } else {
    valueTitle.textContent = 'No meta title found';
    valueTitle.classList.add('missing');
  }
  badgeTitle.textContent = titleBadge.label;
  badgeTitle.className = 'meta-badge ' + titleBadge.cls;
  setCharBar(charFillTitle, charLabelTitle, titleLen, 50, 60);
  copyTitleBtn.onclick = () => copyText(title, copyTitleBtn);
  copyTitleBtn.style.display = title ? '' : 'none';

  // --- Description card ---
  const descLen = desc.length;
  const descBadge = getCharBadge(descLen, 150, 160);
  if (desc) {
    valueDesc.textContent = desc;
    valueDesc.classList.remove('missing');
  } else {
    valueDesc.textContent = 'No meta description found';
    valueDesc.classList.add('missing');
  }
  badgeDesc.textContent = descBadge.label;
  badgeDesc.className = 'meta-badge ' + descBadge.cls;
  setCharBar(charFillDesc, charLabelDesc, descLen, 150, 160);
  copyDescBtn.onclick = () => copyText(desc, copyDescBtn);
  copyDescBtn.style.display = desc ? '' : 'none';

  // --- OG Image card ---
  if (ogImage) {
    valueOgImage.textContent = ogImage;
    badgeOgImage.textContent = 'Found';
    badgeOgImage.className = 'meta-badge badge-good';
    copyOgImageBtn.style.display = '';
    copyOgImageBtn.onclick = () => copyText(ogImage, copyOgImageBtn);
    openOgImageBtn.style.display = '';
    openOgImageBtn.href = ogImage;
    detectOgImageDims(ogImage).then(dims => {
      if (dims) {
        const isGoodSize = dims.w >= 1200 && dims.h >= 630;
        ogImageDims.textContent = `${dims.w}×${dims.h} px detected${isGoodSize ? '' : ' (recommended: 1200×630 or larger)'}`;
      } else {
        ogImageDims.textContent = '';
      }
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
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

    renderResults(data);
  } catch {
    showError('Could not connect to the server. Please try again.');
  } finally {
    setLoading(false);
  }
});

// Let user paste bare domains without protocol
urlInput.addEventListener('blur', () => {
  const raw = urlInput.value.trim();
  if (raw && !/^https?:\/\//i.test(raw)) {
    urlInput.value = 'https://' + raw;
  }
});
