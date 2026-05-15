'use strict';

// Rate limiting: in-memory, resets per cold start
const rateMap = new Map();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;
const RATE_MAX_ENTRIES = 5000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    if (rateMap.size >= RATE_MAX_ENTRIES) {
      for (const [k, v] of rateMap) {
        if (now - v.start > RATE_WINDOW) rateMap.delete(k);
      }
      if (rateMap.size >= RATE_MAX_ENTRIES) {
        const oldest = rateMap.keys().next().value;
        if (oldest !== undefined) rateMap.delete(oldest);
      }
    }
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function isPrivateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const h = parsed.hostname;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|\[::1\])/.test(h)) return true;
    if (/^localhost$/i.test(h)) return true;
    if (/\.local$|\.internal$/.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

async function safeFetch(url, timeoutMs = 15000, maxBytes = 10 * 1024 * 1024) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GetMetadata Bot/1.0 (+https://getmetadata.com)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    });
    const cl = res.headers.get('content-length');
    if (cl && parseInt(cl) > maxBytes) throw new Error('Response too large');
    const text = await res.text();
    if (text.length > maxBytes) throw new Error('Response too large');
    return { text, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

// Regex-based meta tag extraction — avoids any npm dependency
function getMetaContent(html, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern, 'i');
    const m = html.match(re);
    if (m) {
      return m[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .trim();
    }
  }
  return '';
}

function extractTitle(html) {
  return getMetaContent(html, [
    '<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:title["\']',
    '<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:title["\']',
    '<title[^>]*>([^<]+)<\/title>',
  ]);
}

function extractDescription(html) {
  return getMetaContent(html, [
    '<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']',
    '<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:description["\']',
    '<meta[^>]+name=["\']twitter:description["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:description["\']',
  ]);
}

function extractOgImage(html, baseUrl) {
  const raw = getMetaContent(html, [
    '<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']og:image["\']',
    '<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:image["\']',
    '<meta[^>]+name=["\']twitter:image:src["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:image:src["\']',
  ]);
  if (!raw) return '';
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

function extractTwitterCard(html) {
  return getMetaContent(html, [
    '<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']twitter:card["\']',
  ]);
}

function extractCanonical(html, baseUrl) {
  const raw = getMetaContent(html, [
    '<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']*)["\']',
    '<link[^>]+href=["\']([^"\']*)["\'][^>]+rel=["\']canonical["\']',
  ]);
  if (!raw) return '';
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

function extractRobots(html) {
  return getMetaContent(html, [
    '<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']*)["\']',
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']robots["\']',
  ]);
}

module.exports = async function handler(req, res) {
  // CORS — restrict to known origins
  const origin = req.headers.origin || '';
  const allowed = /^https:\/\/(?:[a-z0-9-]+\.)?getmetadata\.com$|^https:\/\/[a-z0-9-]+-[a-z0-9]+\.vercel\.app$/i;
  if (allowed.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

  try {
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (isPrivateUrl(targetUrl)) {
    return res.status(400).json({ error: 'Cannot fetch private or internal URLs' });
  }

  const startTime = Date.now();

  try {
    const { text: html, finalUrl } = await safeFetch(targetUrl);

    const title = extractTitle(html);
    const description = extractDescription(html);
    const ogImage = extractOgImage(html, finalUrl);
    const twitterCard = extractTwitterCard(html);
    const canonical = extractCanonical(html, finalUrl);
    const robots = extractRobots(html);

    let domain = '';
    try { domain = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch {}

    return res.status(200).json({
      domain,
      title,
      description,
      ogImage,
      twitterCard,
      canonical,
      robots,
      fetchTime: Date.now() - startTime,
    });
  } catch (err) {
    const message = err.name === 'AbortError'
      ? 'Request timed out. The site may be slow or blocking external fetches.'
      : `Could not fetch the URL: ${err.message}`;
    return res.status(500).json({ error: message });
  }
};
