'use strict';

const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;
const rateMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
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

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_BYTES = 20 * 1024 * 1024;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = /^https:\/\/(?:[a-z0-9-]+\.)?getmetadata\.com$|^https:\/\/[a-z0-9-]+-[a-z0-9]+\.vercel\.app$/i;
  if (allowed.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) return res.status(429).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) return res.status(400).json({ error: 'Invalid URL' });

  try { new URL(targetUrl); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (isPrivateUrl(targetUrl)) return res.status(400).json({ error: 'Forbidden URL' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GetMetadata Bot/1.0 (+https://getmetadata.com)' },
    });

    const contentType = upstream.headers.get('content-type') || '';
    const mimeBase = contentType.split(';')[0].trim().toLowerCase();

    if (!ALLOWED_TYPES.has(mimeBase)) {
      return res.status(415).json({ error: 'Not an image' });
    }

    const cl = upstream.headers.get('content-length');
    if (cl && parseInt(cl) > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });

    res.setHeader('Content-Type', mimeBase);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buf);
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Fetch timed out' : 'Could not fetch image';
    return res.status(500).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
};
