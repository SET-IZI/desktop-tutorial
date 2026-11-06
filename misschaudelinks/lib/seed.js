// Données de démonstration : `npm run seed`
// Ajoute des liens, des contenus d'exemple et 30 jours de statistiques fictives.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, DATA_DIR } = require('./db');

if (db.prepare('SELECT COUNT(*) AS n FROM links').get().n && !process.argv.includes('--force')) {
  console.log('Des liens existent déjà — ajoute --force pour injecter quand même les données de démo.');
  process.exit(0);
}

const links = [
  ['heart', 'Mon OnlyFans', 'https://onlyfans.com/misschaudex', 'Contenu exclusif tous les jours', 1, 1],
  ['camera', 'Instagram', 'https://instagram.com/misschaudex', 'Mes photos du quotidien', 0, 0],
  ['video', 'TikTok', 'https://tiktok.com/@misschaudex', 'Mes vidéos', 0, 0],
  ['lock', 'MYM', 'https://mym.fans/misschaudex', 'Mes médias privés', 1, 0],
  ['mail', 'Me contacter', 'mailto:contact@example.com', 'Collabs & partenariats', 0, 0],
];
const insLink = db.prepare('INSERT INTO links(icon, title, url, subtitle, adult, highlight, position) VALUES(?, ?, ?, ?, ?, ?, ?)');
const linkIds = links.map((l, i) => Number(insLink.run(...l, i).lastInsertRowid));

const svg = (a, b, label, blur) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <radialGradient id="r" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  ${blur ? '<filter id="f"><feGaussianBlur stdDeviation="40"/></filter>' : ''}</defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <g ${blur ? 'filter="url(#f)"' : ''}><ellipse cx="300" cy="330" rx="230" ry="300" fill="url(#r)"/>
  ${label ? `<text x="300" y="420" font-family="Georgia" font-style="italic" font-size="44" fill="#fff" fill-opacity=".7" text-anchor="middle">${label}</text>` : ''}</g></svg>`;

const samples = [
  ['Shooting rose', 'Une série de photos exclusives', '#6b3a4a', '#121012', 499, 0],
  ['Backstage', 'Les coulisses de mon dernier shooting', '#3b2a30', '#0c0b0c', 799, 1],
  ['Soirée privée', 'Pack réservé aux plus de 18 ans', '#8a5a68', '#1a1316', 1299, 1],
  ['Petit cadeau', 'Offert pour toi', '#c9a3ad', '#4a3a3f', 0, 0],
];
const insMedia = db.prepare(`INSERT INTO media(title, description, kind, file, mime, preview, price_cents, adult, position)
  VALUES(?, ?, 'photo', ?, 'image/svg+xml', ?, ?, ?, ?)`);
const mediaIds = samples.map(([t, d, a, b, price, adult], i) => {
  const id = crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(path.join(DATA_DIR, 'uploads', 'private', `demo-${id}.svg`), svg(a, b, 'misschaudex', false));
  fs.writeFileSync(path.join(DATA_DIR, 'uploads', 'public', `demo-${id}-p.svg`), svg(a, b, '', true));
  return Number(insMedia.run(t, d, `demo-${id}.svg`, `demo-${id}-p.svg`, price, adult, i).lastInsertRowid);
});

// 30 jours d'activité fictive
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weighted = (pairs) => { const t = pairs.reduce((a, p) => a + p[1], 0); let r = Math.random() * t; for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };
const ins = db.prepare('INSERT INTO events(type, ref_id, visitor, device, browser, os, referrer, country, ts) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insP = db.prepare(`INSERT INTO purchases(media_id, token, amount_cents, currency, status, provider, visitor, created_at, paid_at)
  VALUES(?, ?, ?, 'eur', 'paid', 'demo', ?, ?, ?)`);
db.exec('BEGIN');
const now = Date.now();
for (let d = 29; d >= 0; d--) {
  const visitors = Math.round(40 + (29 - d) * 3 + Math.random() * 30);
  for (let v = 0; v < visitors; v++) {
    const vid = crypto.randomBytes(6).toString('hex');
    const hour = weighted([[20, 6], [21, 8], [22, 9], [23, 7], [0, 4], [12, 3], [13, 3], [18, 4], [19, 5], [9, 1], [15, 2]]);
    const ts = new Date(now - d * 864e5); ts.setHours(hour, Math.floor(Math.random() * 60));
    const t = Math.min(ts.getTime(), now - 60000);
    const src = weighted([['Instagram', 45], ['TikTok', 30], ['Snapchat', 8], ['X / Twitter', 7], ['Direct', 10]]);
    const device = weighted([['Mobile', 85], ['Ordinateur', 12], ['Tablette', 3]]);
    const os = device === 'Mobile' ? weighted([['iOS', 60], ['Android', 40]]) : pick(['Windows', 'macOS']);
    const browser = src === 'Instagram' || src === 'TikTok' || src === 'Snapchat' ? src : pick(['Safari', 'Chrome']);
    const country = weighted([['FR', 70], ['BE', 10], ['CH', 7], ['CA', 6], ['MA', 4], ['US', 3]]);
    const row = (type, ref, dt = 0) => ins.run(type, ref, vid, device, browser, os, src, country, t + dt);
    row('view', null);
    if (Math.random() < 0.55) row('click', weighted(linkIds.map((id, i) => [id, [40, 20, 15, 18, 3][i]])), 4000);
    if (Math.random() < 0.15) row(Math.random() < 0.9 ? 'age_ok' : 'age_no', null, 3000);
    if (Math.random() < 0.25) {
      const m = pick(mediaIds);
      row('media_view', m, 8000);
      if (Math.random() < 0.3) {
        row('checkout', m, 12000);
        const price = samples[mediaIds.indexOf(m)][4];
        if (price && Math.random() < 0.6) {
          row('purchase', m, 30000);
          const iso = new Date(t + 30000).toISOString().replace('T', ' ').slice(0, 19);
          insP.run(m, crypto.randomBytes(18).toString('base64url'), price, vid, iso, iso);
        }
      }
    }
  }
}
db.exec('COMMIT');
console.log('Données de démo ajoutées : liens, contenus et 30 jours de statistiques.');
