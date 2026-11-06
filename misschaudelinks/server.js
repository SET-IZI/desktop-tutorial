// MissChaudeLinks — serveur
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* pas de .env : valeurs par défaut */ }

const express = require('express');
const multer = require('multer');
const { db, settings, setSetting, DATA_DIR } = require('./lib/db');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const CURRENCY = (process.env.CURRENCY || 'eur').toLowerCase();
const COOKIE_SECRET = process.env.COOKIE_SECRET || (() => {
  // Secret persistant généré au premier lancement si non fourni
  const f = path.join(DATA_DIR, '.cookie_secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8');
})();
const PAY_MODE = STRIPE_KEY ? 'stripe' : 'demo';

const PUBLIC_UPLOADS = path.join(DATA_DIR, 'uploads', 'public');
const PRIVATE_UPLOADS = path.join(DATA_DIR, 'uploads', 'private');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------- utilitaires
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
const sign = (v) => `${v}.${crypto.createHmac('sha256', COOKIE_SECRET).update(v).digest('base64url')}`;
function unsign(s) {
  if (!s) return null;
  const i = s.lastIndexOf('.');
  if (i < 0) return null;
  const v = s.slice(0, i);
  const expected = sign(v);
  const a = Buffer.from(expected), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null;
}
function setCookie(res, name, value, { maxAge = 31536000, httpOnly = true } = {}) {
  const secure = PUBLIC_URL.startsWith('https') ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure}`);
}
const randomToken = (n = 24) => crypto.randomBytes(n).toString('base64url');

function visitorId(req, res) {
  const c = parseCookies(req);
  let v = unsign(c.mcl_v);
  if (!v) { v = randomToken(12); setCookie(res, 'mcl_v', sign(v), { maxAge: 63072000 }); }
  return v;
}

function parseUA(ua = '') {
  const device = /ipad|tablet/i.test(ua) ? 'Tablette' : /mobi|iphone|android/i.test(ua) ? 'Mobile' : 'Ordinateur';
  const browser = /instagram/i.test(ua) ? 'Instagram' : /tiktok|musical_ly|bytedance/i.test(ua) ? 'TikTok'
    : /snapchat/i.test(ua) ? 'Snapchat' : /fban|fbav/i.test(ua) ? 'Facebook'
    : /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome|crios/i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Autre';
  const os = /iphone|ipad|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows'
    : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Autre';
  return { device, browser, os };
}
function sourceOf(ref, ua) {
  const s = (ref || '').toLowerCase();
  const u = (ua || '').toLowerCase();
  if (u.includes('instagram') || s.includes('instagram')) return 'Instagram';
  if (u.includes('tiktok') || u.includes('musical_ly') || s.includes('tiktok')) return 'TikTok';
  if (u.includes('snapchat') || s.includes('snapchat')) return 'Snapchat';
  if (s.includes('t.co') || s.includes('twitter') || s.includes('x.com')) return 'X / Twitter';
  if (s.includes('facebook') || u.includes('fban')) return 'Facebook';
  if (s.includes('youtube')) return 'YouTube';
  if (s.includes('reddit')) return 'Reddit';
  if (s.includes('google')) return 'Google';
  if (!s) return 'Direct';
  try { return new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'Autre'; }
}
function countryOf(req) {
  const h = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country'];
  if (h && h !== 'XX') return String(h).toUpperCase();
  const lang = (req.headers['accept-language'] || '').split(',')[0];
  const m = lang.match(/-([A-Za-z]{2})/);
  return m ? m[1].toUpperCase() : (lang ? lang.slice(0, 2).toUpperCase() : '??');
}

const insertEvent = db.prepare(`INSERT INTO events(type, ref_id, visitor, device, browser, os, referrer, country, ts)
  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
function track(req, res, type, refId = null, referrer) {
  const ua = req.headers['user-agent'] || '';
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp/i.test(ua)) return;
  const { device, browser, os } = parseUA(ua);
  insertEvent.run(type, refId, visitorId(req, res), device, browser, os,
    sourceOf(referrer ?? req.headers.referer, ua), countryOf(req), Date.now());
}

function linkIsLive(l) {
  const now = new Date().toISOString();
  return l.active && (!l.starts_at || l.starts_at <= now) && (!l.ends_at || l.ends_at >= now);
}

// Achats possédés par ce navigateur (cookie signé contenant les jetons d'accès)
function ownedTokens(req) {
  const raw = unsign(parseCookies(req).mcl_access);
  return raw ? raw.split(',').filter(Boolean) : [];
}
function ownedMediaIds(req) {
  const tokens = ownedTokens(req);
  if (!tokens.length) return new Set();
  const rows = db.prepare(`SELECT media_id FROM purchases WHERE status = 'paid' AND token IN (${tokens.map(() => '?').join(',')})`).all(...tokens);
  return new Set(rows.map((r) => r.media_id));
}
function grantToken(req, res, token) {
  const tokens = new Set(ownedTokens(req));
  tokens.add(token);
  setCookie(res, 'mcl_access', sign([...tokens].slice(-200).join(',')), { maxAge: 63072000 });
}

const money = (c) => (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: CURRENCY.toUpperCase() });

// ---------------------------------------------------------------- uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'file' ? PRIVATE_UPLOADS : PUBLIC_UPLOADS),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
    cb(null, `${Date.now()}-${randomToken(9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 Go max (vidéos)
  fileFilter: (req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
});
const removeUpload = (dir, name) => { if (name) fs.rm(path.join(dir, path.basename(name)), { force: true }, () => {}); };

// ---------------------------------------------------------------- API publique
app.get('/api/public', (req, res) => {
  visitorId(req, res);
  const s = settings();
  const owned = ownedMediaIds(req);
  const links = db.prepare('SELECT * FROM links ORDER BY position, id').all().filter(linkIsLive)
    .map((l) => ({ id: l.id, title: l.title, subtitle: l.subtitle, icon: l.icon, adult: !!l.adult, highlight: !!l.highlight, host: safeHost(l.url) }));
  const media = s.shop_enabled === '1'
    ? db.prepare('SELECT * FROM media WHERE active = 1 ORDER BY position, id').all().map((m) => ({
      id: m.id, title: m.title, description: m.description, kind: m.kind, adult: !!m.adult,
      price_cents: m.price_cents, price: m.price_cents ? money(m.price_cents) : 'Gratuit',
      preview: m.preview ? `/uploads/${m.preview}` : null,
      owned: owned.has(m.id) || m.price_cents === 0,
    }))
    : [];
  res.json({
    profile: { name: s.name, bio: s.bio, avatar: s.avatar ? `/uploads/${s.avatar}` : null, accent: s.accent, page_age_gate: s.page_age_gate === '1', shop_title: s.shop_title },
    socials: JSON.parse(s.socials || '{}'),
    links, media, pay_mode: PAY_MODE,
  });
});
function safeHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

const TRACKABLE = new Set(['view', 'media_view', 'age_ok', 'age_no', 'social']);
app.post('/api/track', (req, res) => {
  const { type, ref_id, referrer } = req.body || {};
  if (TRACKABLE.has(type)) track(req, res, type, Number.isInteger(ref_id) ? ref_id : null, type === 'view' ? (referrer || '') : undefined);
  res.status(204).end();
});

// Redirection traquée vers un lien
app.get('/go/:id', (req, res) => {
  const l = db.prepare('SELECT * FROM links WHERE id = ?').get(Number(req.params.id));
  if (!l || !linkIsLive(l)) return res.redirect('/');
  track(req, res, 'click', l.id);
  res.redirect(302, l.url);
});

// --- Achat
async function stripe(method, endpoint, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const r = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || 'Erreur Stripe');
  return json;
}

app.post('/api/checkout', async (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ? AND active = 1').get(Number(req.body?.media_id));
  if (!m) return res.status(404).json({ error: 'Contenu introuvable' });
  const email = String(req.body?.email || '').trim().slice(0, 200) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'E-mail invalide' });
  const visitor = visitorId(req, res);
  const token = randomToken();
  track(req, res, 'checkout', m.id);

  if (m.price_cents === 0) return res.json({ owned: true });

  if (PAY_MODE === 'demo') {
    db.prepare(`INSERT INTO purchases(media_id, token, email, amount_cents, currency, status, provider, visitor, paid_at)
      VALUES(?, ?, ?, ?, ?, 'paid', 'demo', ?, datetime('now'))`).run(m.id, token, email, m.price_cents, CURRENCY, visitor);
    track(req, res, 'purchase', m.id);
    grantToken(req, res, token);
    return res.json({ owned: true, token, recover_url: `${PUBLIC_URL}/unlock/${token}`, demo: true });
  }

  try {
    const params = {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': CURRENCY,
      'line_items[0][price_data][unit_amount]': String(m.price_cents),
      'line_items[0][price_data][product_data][name]': m.title,
      success_url: `${PUBLIC_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/?cancel=1`,
      'metadata[token]': token,
      'metadata[media_id]': String(m.id),
    };
    if (email) params.customer_email = email;
    const session = await stripe('POST', 'checkout/sessions', params);
    db.prepare(`INSERT INTO purchases(media_id, token, email, amount_cents, currency, status, provider, provider_ref, visitor)
      VALUES(?, ?, ?, ?, ?, 'pending', 'stripe', ?, ?)`).run(m.id, token, email, m.price_cents, CURRENCY, session.id, visitor);
    res.json({ redirect: session.url });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/checkout/success', async (req, res) => {
  const sid = String(req.query.session_id || '');
  const p = db.prepare(`SELECT * FROM purchases WHERE provider_ref = ? AND provider = 'stripe'`).get(sid);
  if (!p) return res.redirect('/');
  if (p.status !== 'paid') {
    try {
      const session = await stripe('GET', `checkout/sessions/${encodeURIComponent(sid)}`);
      if (session.payment_status !== 'paid') return res.redirect('/?cancel=1');
      db.prepare(`UPDATE purchases SET status = 'paid', paid_at = datetime('now'), email = COALESCE(email, ?) WHERE id = ?`)
        .run(session.customer_details?.email || null, p.id);
      track(req, res, 'purchase', p.media_id);
    } catch { return res.redirect('/?cancel=1'); }
  }
  grantToken(req, res, p.token);
  res.redirect(`/?unlocked=${p.media_id}&token=${p.token}`);
});

// Lien de récupération (pour retrouver ses achats sur un autre appareil)
app.get('/unlock/:token', (req, res) => {
  const p = db.prepare(`SELECT * FROM purchases WHERE token = ? AND status = 'paid'`).get(req.params.token);
  if (p) grantToken(req, res, p.token);
  res.redirect(p ? `/?unlocked=${p.media_id}` : '/');
});

app.get('/api/my-purchases', (req, res) => {
  const tokens = ownedTokens(req);
  if (!tokens.length) return res.json([]);
  const rows = db.prepare(`SELECT p.token, p.media_id, m.title FROM purchases p JOIN media m ON m.id = p.media_id
    WHERE p.status = 'paid' AND p.token IN (${tokens.map(() => '?').join(',')})`).all(...tokens);
  res.json(rows.map((r) => ({ ...r, recover_url: `${PUBLIC_URL}/unlock/${r.token}` })));
});

// Fichier original — uniquement si acheté (ou admin)
app.get('/media/:id/file', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).end();
  const allowed = isAdmin(req) || (m.active && (m.price_cents === 0 || ownedMediaIds(req).has(m.id)));
  if (!allowed) return res.status(403).json({ error: 'Contenu verrouillé' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(path.join(PRIVATE_UPLOADS, path.basename(m.file)));
});

app.use('/uploads', express.static(PUBLIC_UPLOADS, { maxAge: '7d' }));

// ---------------------------------------------------------------- Admin : auth
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function isAdmin(req) {
  const t = unsign(parseCookies(req).mcl_admin);
  if (!t) return false;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(t);
  return !!s && s.expires > Date.now();
}
const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'Non connecté' }));

const attempts = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 8;
}
function openSession(res) {
  const t = randomToken(32);
  db.prepare('INSERT INTO sessions(token, expires) VALUES(?, ?)').run(t, Date.now() + 30 * 864e5);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  setCookie(res, 'mcl_admin', sign(t), { maxAge: 30 * 86400 });
}

app.get('/api/admin/status', (req, res) => res.json({ setup_needed: !settings().admin_hash, logged_in: isAdmin(req), pay_mode: PAY_MODE, currency: CURRENCY, public_url: PUBLIC_URL }));

app.post('/api/admin/setup', (req, res) => {
  if (settings().admin_hash) return res.status(400).json({ error: 'Déjà configuré' });
  const pw = String(req.body?.password || '');
  if (pw.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum' });
  setSetting('admin_hash', hashPassword(pw));
  openSession(res);
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Trop de tentatives, réessaie dans 15 minutes' });
  if (!checkPassword(String(req.body?.password || ''), settings().admin_hash)) {
    attempts.get(req.ip).push(Date.now());
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  attempts.delete(req.ip);
  openSession(res);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const t = unsign(parseCookies(req).mcl_admin);
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  setCookie(res, 'mcl_admin', '', { maxAge: 0 });
  res.json({ ok: true });
});

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { current, next } = req.body || {};
  if (!checkPassword(String(current || ''), settings().admin_hash)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  if (String(next || '').length < 8) return res.status(400).json({ error: 'Nouveau mot de passe : 8 caractères minimum' });
  setSetting('admin_hash', hashPassword(String(next)));
  db.prepare('DELETE FROM sessions').run();
  openSession(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Admin : profil
const EDITABLE_SETTINGS = ['name', 'bio', 'accent', 'page_age_gate', 'shop_title', 'shop_enabled'];
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const s = settings();
  delete s.admin_hash;
  s.socials = JSON.parse(s.socials || '{}');
  s.avatar_url = s.avatar ? `/uploads/${s.avatar}` : null;
  res.json(s);
});
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  for (const k of EDITABLE_SETTINGS) if (k in b) setSetting(k, String(b[k]).slice(0, 1000));
  if (b.socials && typeof b.socials === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(b.socials)) clean[k.slice(0, 20)] = String(v || '').slice(0, 300);
    setSetting('socials', JSON.stringify(clean));
  }
  res.json({ ok: true });
});
app.post('/api/admin/avatar', requireAdmin, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image requise' });
  removeUpload(PUBLIC_UPLOADS, settings().avatar);
  setSetting('avatar', req.file.filename);
  res.json({ avatar_url: `/uploads/${req.file.filename}` });
});

// ---------------------------------------------------------------- Admin : liens
function cleanLink(b) {
  let url = String(b.url || '').trim();
  if (url && !/^(https?:|mailto:|tel:)/i.test(url)) url = `https://${url}`;
  return {
    title: String(b.title || '').trim().slice(0, 120),
    url: url.slice(0, 2000),
    icon: String(b.icon || '').slice(0, 16),
    subtitle: String(b.subtitle || '').slice(0, 160),
    adult: b.adult ? 1 : 0,
    highlight: b.highlight ? 1 : 0,
    active: b.active === undefined ? 1 : (b.active ? 1 : 0),
    starts_at: b.starts_at ? new Date(b.starts_at).toISOString() : null,
    ends_at: b.ends_at ? new Date(b.ends_at).toISOString() : null,
  };
}
app.get('/api/admin/links', requireAdmin, (req, res) => {
  const since = Date.now() - 30 * 864e5;
  const rows = db.prepare(`SELECT l.*,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'click' AND e.ref_id = l.id) AS clicks_total,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'click' AND e.ref_id = l.id AND e.ts >= ?) AS clicks_30d
    FROM links l ORDER BY position, id`).all(since);
  res.json(rows.map((l) => ({ ...l, live: linkIsLive(l) })));
});
app.post('/api/admin/links', requireAdmin, (req, res) => {
  const l = cleanLink(req.body || {});
  if (!l.title || !l.url) return res.status(400).json({ error: 'Titre et URL requis' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM links').get().p;
  const r = db.prepare(`INSERT INTO links(title, url, icon, subtitle, adult, highlight, active, starts_at, ends_at, position)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(l.title, l.url, l.icon, l.subtitle, l.adult, l.highlight, l.active, l.starts_at, l.ends_at, pos);
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/admin/links/:id', requireAdmin, (req, res) => {
  const l = cleanLink(req.body || {});
  if (!l.title || !l.url) return res.status(400).json({ error: 'Titre et URL requis' });
  db.prepare(`UPDATE links SET title=?, url=?, icon=?, subtitle=?, adult=?, highlight=?, active=?, starts_at=?, ends_at=? WHERE id=?`)
    .run(l.title, l.url, l.icon, l.subtitle, l.adult, l.highlight, l.active, l.starts_at, l.ends_at, Number(req.params.id));
  res.json({ ok: true });
});
app.patch('/api/admin/links/:id', requireAdmin, (req, res) => {
  for (const k of ['active', 'adult', 'highlight']) {
    if (k in (req.body || {})) db.prepare(`UPDATE links SET ${k} = ? WHERE id = ?`).run(req.body[k] ? 1 : 0, Number(req.params.id));
  }
  res.json({ ok: true });
});
app.delete('/api/admin/links/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});
function reorder(table) {
  return (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    const stmt = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
    ids.forEach((id, i) => stmt.run(i, id));
    res.json({ ok: true });
  };
}
app.post('/api/admin/links/reorder', requireAdmin, reorder('links'));

// ---------------------------------------------------------------- Admin : contenus payants
const parsePrice = (v) => Math.max(0, Math.round(parseFloat(String(v ?? '0').replace(',', '.')) * 100) || 0);

app.get('/api/admin/media', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT m.*,
      (SELECT COUNT(*) FROM purchases p WHERE p.media_id = m.id AND p.status = 'paid') AS sales,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases p WHERE p.media_id = m.id AND p.status = 'paid') AS revenue_cents,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'media_view' AND e.ref_id = m.id) AS views
    FROM media m ORDER BY position, id`).all();
  res.json(rows.map((m) => ({ ...m, preview_url: m.preview ? `/uploads/${m.preview}` : null, file_url: `/media/${m.id}/file` })));
});
app.post('/api/admin/media', requireAdmin, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'preview', maxCount: 1 }]), (req, res) => {
  const file = req.files?.file?.[0];
  const preview = req.files?.preview?.[0];
  const b = req.body || {};
  if (!file) { removeUpload(PUBLIC_UPLOADS, preview?.filename); return res.status(400).json({ error: 'Fichier photo ou vidéo requis' }); }
  const price = parsePrice(b.price);
  if (price > 0 && price < 50) return res.status(400).json({ error: 'Prix minimum : 0,50' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM media').get().p;
  const r = db.prepare(`INSERT INTO media(title, description, kind, file, mime, preview, price_cents, adult, active, position)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    String(b.title || 'Sans titre').slice(0, 120), String(b.description || '').slice(0, 500),
    file.mimetype.startsWith('video/') ? 'video' : 'photo', file.filename, file.mimetype,
    preview?.filename || null, price, b.adult === '1' ? 1 : 0, b.active === '0' ? 0 : 1, pos);
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/admin/media/:id', requireAdmin, upload.single('preview'), (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Introuvable' });
  const b = req.body || {};
  const price = 'price' in b ? parsePrice(b.price) : m.price_cents;
  if (price > 0 && price < 50) return res.status(400).json({ error: 'Prix minimum : 0,50' });
  if (req.file) removeUpload(PUBLIC_UPLOADS, m.preview);
  db.prepare(`UPDATE media SET title=?, description=?, price_cents=?, adult=?, active=?, preview=? WHERE id=?`).run(
    'title' in b ? String(b.title).slice(0, 120) : m.title,
    'description' in b ? String(b.description).slice(0, 500) : m.description,
    price,
    'adult' in b ? (b.adult === '1' || b.adult === true ? 1 : 0) : m.adult,
    'active' in b ? (b.active === '1' || b.active === true ? 1 : 0) : m.active,
    req.file ? req.file.filename : m.preview, m.id);
  res.json({ ok: true });
});
app.delete('/api/admin/media/:id', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (m) {
    removeUpload(PRIVATE_UPLOADS, m.file);
    removeUpload(PUBLIC_UPLOADS, m.preview);
    db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  }
  res.json({ ok: true });
});
app.post('/api/admin/media/reorder', requireAdmin, reorder('media'));

// ---------------------------------------------------------------- Admin : ventes
app.get('/api/admin/purchases', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT p.*, m.title AS media_title FROM purchases p LEFT JOIN media m ON m.id = p.media_id
    ORDER BY p.id DESC LIMIT 1000`).all();
  res.json(rows.map((p) => ({ ...p, recover_url: `${PUBLIC_URL}/unlock/${p.token}` })));
});
app.post('/api/admin/purchases/:id/refund', requireAdmin, async (req, res) => {
  const p = db.prepare('SELECT * FROM purchases WHERE id = ?').get(Number(req.params.id));
  if (!p || p.status !== 'paid') return res.status(400).json({ error: 'Achat non remboursable' });
  if (p.provider === 'stripe') {
    try {
      const session = await stripe('GET', `checkout/sessions/${encodeURIComponent(p.provider_ref)}`);
      await stripe('POST', 'refunds', { payment_intent: session.payment_intent });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }
  db.prepare(`UPDATE purchases SET status = 'refunded' WHERE id = ?`).run(p.id);
  res.json({ ok: true });
});
// Offrir un accès gratuit (ex : à un abonné) — génère un lien de déblocage
app.post('/api/admin/purchases/gift', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.body?.media_id));
  if (!m) return res.status(404).json({ error: 'Contenu introuvable' });
  const token = randomToken();
  db.prepare(`INSERT INTO purchases(media_id, token, email, amount_cents, currency, status, provider, paid_at)
    VALUES(?, ?, ?, 0, ?, 'paid', 'cadeau', datetime('now'))`).run(m.id, token, String(req.body?.email || '') || null, CURRENCY);
  res.json({ recover_url: `${PUBLIC_URL}/unlock/${token}` });
});

function csv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => (v == null ? '' : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
app.get('/api/admin/export/:what.csv', requireAdmin, (req, res) => {
  let rows;
  if (req.params.what === 'ventes') {
    rows = db.prepare(`SELECT p.id, p.created_at, p.paid_at, m.title AS contenu, p.email, p.amount_cents / 100.0 AS montant, p.currency AS devise, p.status AS statut, p.provider AS paiement
      FROM purchases p LEFT JOIN media m ON m.id = p.media_id ORDER BY p.id DESC`).all();
  } else if (req.params.what === 'evenements') {
    rows = db.prepare(`SELECT id, datetime(ts / 1000, 'unixepoch', 'localtime') AS date, type, ref_id, device AS appareil, browser AS navigateur, os, referrer AS source, country AS pays
      FROM events ORDER BY id DESC LIMIT 100000`).all();
  } else return res.status(404).end();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="misschaudelinks-${req.params.what}.csv"`);
  res.send('﻿' + csv(rows));
});

// ---------------------------------------------------------------- Admin : statistiques
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const now = Date.now();
  // Début de période aligné sur minuit local
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const from = start.getTime();
  const prevFrom = from - days * 864e5;

  const count = (type, a, b) => db.prepare('SELECT COUNT(*) AS n FROM events WHERE type = ? AND ts >= ? AND ts < ?').get(type, a, b).n;
  const uniques = (a, b) => db.prepare(`SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE type = 'view' AND ts >= ? AND ts < ?`).get(a, b).n;
  const sales = (a, b) => db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM purchases
      WHERE status = 'paid' AND amount_cents > 0 AND strftime('%s', paid_at) * 1000 >= ? AND strftime('%s', paid_at) * 1000 < ?`).get(a, b);

  const period = (a, b) => {
    const views = count('view', a, b), clicks = count('click', a, b), s = sales(a, b);
    const u = uniques(a, b);
    return {
      views, uniques: u, clicks,
      ctr: views ? clicks / views : 0,
      sales: s.n, revenue_cents: s.cents,
      conversion: u ? s.n / u : 0,
      age_ok: count('age_ok', a, b), age_no: count('age_no', a, b),
      checkouts: count('checkout', a, b), media_views: count('media_view', a, b),
    };
  };
  const cur = period(from, now + 1);
  const prev = period(prevFrom, from);

  // Séries journalières
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const series = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i);
    series[dayKey(d)] = { date: dayKey(d), views: 0, uniques: 0, clicks: 0, sales: 0, revenue_cents: 0 };
  }
  const local = `date(ts / 1000, 'unixepoch', 'localtime')`;
  for (const r of db.prepare(`SELECT ${local} AS d, type, COUNT(*) AS n, COUNT(DISTINCT visitor) AS u FROM events
      WHERE ts >= ? AND type IN ('view', 'click') GROUP BY d, type`).all(from)) {
    if (!series[r.d]) continue;
    if (r.type === 'view') { series[r.d].views = r.n; series[r.d].uniques = r.u; } else series[r.d].clicks = r.n;
  }
  for (const r of db.prepare(`SELECT date(paid_at, 'localtime') AS d, COUNT(*) AS n, SUM(amount_cents) AS c FROM purchases
      WHERE status = 'paid' AND amount_cents > 0 AND strftime('%s', paid_at) * 1000 >= ? GROUP BY d`).all(from)) {
    if (series[r.d]) { series[r.d].sales = r.n; series[r.d].revenue_cents = r.c; }
  }

  const top = (col) => db.prepare(`SELECT ${col} AS label, COUNT(*) AS n FROM events WHERE type = 'view' AND ts >= ?
      GROUP BY ${col} ORDER BY n DESC LIMIT 8`).all(from);

  const links = db.prepare(`SELECT l.id, l.title, l.icon, l.adult,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'click' AND e.ref_id = l.id AND e.ts >= ?) AS clicks,
      (SELECT COUNT(DISTINCT visitor) FROM events e WHERE e.type = 'click' AND e.ref_id = l.id AND e.ts >= ?) AS unique_clicks
    FROM links l ORDER BY clicks DESC`).all(from, from)
    .map((l) => ({ ...l, ctr: cur.views ? l.clicks / cur.views : 0 }));

  const media = db.prepare(`SELECT m.id, m.title, m.kind, m.price_cents,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'media_view' AND e.ref_id = m.id AND e.ts >= ?) AS views,
      (SELECT COUNT(*) FROM events e WHERE e.type = 'checkout' AND e.ref_id = m.id AND e.ts >= ?) AS checkouts,
      (SELECT COUNT(*) FROM purchases p WHERE p.media_id = m.id AND p.status = 'paid' AND p.amount_cents > 0 AND strftime('%s', p.paid_at) * 1000 >= ?) AS sales,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases p WHERE p.media_id = m.id AND p.status = 'paid' AND strftime('%s', p.paid_at) * 1000 >= ?) AS revenue_cents
    FROM media m ORDER BY revenue_cents DESC, views DESC`).all(from, from, from, from);

  // Heatmap jour de semaine × heure (visites)
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of db.prepare(`SELECT CAST(strftime('%w', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS w,
      CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, COUNT(*) AS n
      FROM events WHERE type = 'view' AND ts >= ? GROUP BY w, h`).all(from)) heat[(r.w + 6) % 7][r.h] = r.n;

  const live = db.prepare(`SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE ts >= ?`).get(now - 5 * 60 * 1000).n;

  res.json({
    days, current: cur, previous: prev, series: Object.values(series),
    sources: top('referrer'), devices: top('device'), browsers: top('browser'), os: top('os'), countries: top('country'),
    links, media, heatmap: heat, live, currency: CURRENCY,
  });
});

// ---------------------------------------------------------------- pages
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`\nmisschaudelinks en ligne sur ${PUBLIC_URL}`);
  console.log(`   Admin : ${PUBLIC_URL}/admin`);
  console.log(`   Paiements : ${PAY_MODE === 'stripe' ? 'Stripe' : 'MODE DÉMO (ajoute STRIPE_SECRET_KEY pour encaisser)'}\n`);
});
