// MissChaudeLinks — interface d'administration
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let status = {};
  let CUR = 'EUR';
  const nf = new Intl.NumberFormat('fr-FR');
  const money = (c) => (c / 100).toLocaleString('fr-FR', { style: 'currency', currency: CUR });
  const pct = (x) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  const compact = (n) => (n >= 1000 ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : nf.format(n));

  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('error', error); t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  async function api(url, opts = {}) {
    const init = { ...opts, headers: { ...(opts.headers || {}) } };
    if (opts.body && !(opts.body instanceof FormData)) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(url, init);
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (r.status === 401 && !url.includes('/login')) { showAuth(); throw new Error('Session expirée'); }
    if (!r.ok) throw new Error(j.error || `Erreur ${r.status}`);
    return j;
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  // ================================================================ AUTH
  async function boot() {
    status = await api('/api/admin/status');
    CUR = (status.currency || 'eur').toUpperCase();
    if (!status.logged_in) return showAuth();
    $('#auth').hidden = true;
    $('#app').hidden = false;
    $('#demoBanner').hidden = status.pay_mode !== 'demo';
    $('#payInfo').innerHTML = status.pay_mode === 'stripe'
      ? '✅ Stripe est connecté. Les paiements sont encaissés sur ton compte Stripe.'
      : '⚠️ Mode démo actif : les achats sont simulés. Crée un compte sur stripe.com, puis ajoute ta clé secrète dans <code>STRIPE_SECRET_KEY</code> (fichier <code>.env</code>) et redémarre le serveur.';
    go(location.hash.slice(1) || 'dashboard');
  }
  function showAuth() {
    $('#app').hidden = true;
    $('#auth').hidden = false;
    const setup = status.setup_needed;
    $('#authHint').textContent = setup ? 'Bienvenue ✨ Choisis ton mot de passe administrateur' : 'Connecte-toi à ton espace';
    $('#authBtn').textContent = setup ? 'Créer mon espace' : 'Se connecter';
    $('#authPw2').hidden = !setup;
    $('#authPw2').required = setup;
    $('#authPw').focus();
  }
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#authErr').textContent = '';
    const password = $('#authPw').value;
    try {
      if (status.setup_needed) {
        if (password !== $('#authPw2').value) throw new Error('Les mots de passe ne correspondent pas');
        await api('/api/admin/setup', { method: 'POST', body: { password } });
      } else {
        await api('/api/admin/login', { method: 'POST', body: { password } });
      }
      $('#authPw').value = $('#authPw2').value = '';
      boot();
    } catch (err) { $('#authErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', guard(async () => { await api('/api/admin/logout', { method: 'POST' }); status.logged_in = false; showAuth(); }));

  // ================================================================ NAVIGATION
  const loaders = { dashboard: loadStats, links: loadLinks, media: loadMedia, sales: loadSales, profile: loadProfile, settings: () => {} };
  function go(tab) {
    if (!loaders[tab]) tab = 'dashboard';
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab').forEach((t) => { t.hidden = t.id !== `tab-${tab}`; });
    history.replaceState(null, '', `#${tab}`);
    guard(loaders[tab])();
  }
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });

  // ================================================================ STATISTIQUES
  let days = 30;
  try { days = Number(localStorage.getItem('mcl_days')) || 30; } catch { /* ignore */ }
  $$('#range button').forEach((b) => b.classList.toggle('active', Number(b.dataset.days) === days));
  $('#range').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    days = Number(b.dataset.days);
    try { localStorage.setItem('mcl_days', days); } catch { /* ignore */ }
    $$('#range button').forEach((x) => x.classList.toggle('active', x === b));
    guard(loadStats)();
  });

  async function loadStats() {
    const s = await api(`/api/admin/stats?days=${days}`);
    const c = s.current, p = s.previous;
    $('#liveCount').textContent = s.live;

    const delta = (a, b) => {
      if (!b && !a) return '<div class="delta flat">—</div>';
      if (!b) return '<div class="delta up">▲ nouveau</div>';
      const d = (a - b) / b;
      const cls = Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down';
      return `<div class="delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${pct(Math.abs(d))} <span class="muted">vs période préc.</span></div>`;
    };
    const kpis = [
      ['Visites', compact(c.views), delta(c.views, p.views)],
      ['Visiteurs uniques', compact(c.uniques), delta(c.uniques, p.uniques)],
      ['Clics sur liens', compact(c.clicks), delta(c.clicks, p.clicks)],
      ['Taux de clic (CTR)', pct(c.ctr), delta(c.ctr, p.ctr)],
      ['Ventes', nf.format(c.sales), delta(c.sales, p.sales)],
      ['Chiffre d\'affaires', money(c.revenue_cents), delta(c.revenue_cents, p.revenue_cents)],
      ['Conversion visiteur → achat', pct(c.conversion), delta(c.conversion, p.conversion)],
      ['Panier moyen', c.sales ? money(c.revenue_cents / c.sales) : '—', delta(c.sales ? c.revenue_cents / c.sales : 0, p.sales ? p.revenue_cents / p.sales : 0)],
    ];
    $('#kpis').innerHTML = kpis.map(([l, v, d], i) => `<div class="kpi" style="animation-delay:${i * 0.04}s"><div class="lbl">${l}</div><div class="val">${v}</div>${d}</div>`).join('');

    const labels = s.series.map((d) => d.date);
    lineChart($('#chartAudience'), labels, [
      { label: 'Visites', color: 'var(--s1)', values: s.series.map((d) => d.views), area: true },
      { label: 'Clics', color: 'var(--s2)', values: s.series.map((d) => d.clicks) },
    ], nf.format);
    $('#revTotal').textContent = `${money(c.revenue_cents)} sur la période`;
    barChart($('#chartRevenue'), labels, s.series.map((d) => d.revenue_cents), money, s.series.map((d) => d.sales));

    hbars($('#topLinks'), s.links.filter((l) => l.clicks).slice(0, 8).map((l) => ({
      name: `${l.icon || '🔗'} ${l.title}${l.adult ? ' 🔞' : ''}`, n: l.clicks, right: `<b>${nf.format(l.clicks)}</b> · ${pct(l.ctr)}`,
    })), 'Aucun clic sur la période');
    hbars($('#topMedia'), s.media.filter((m) => m.views || m.sales).slice(0, 8).map((m) => ({
      name: `${m.kind === 'video' ? '▶' : '📸'} ${m.title}`, n: m.revenue_cents || m.views,
      right: `<b>${money(m.revenue_cents)}</b> · ${m.sales} vente(s) · ${m.views} vues`,
    })), 'Pas encore de vues');
    const share = (rows) => { const t = rows.reduce((a, r) => a + r.n, 0) || 1; return rows.map((r) => ({ name: r.label || 'Inconnu', n: r.n, right: `<b>${nf.format(r.n)}</b> · ${pct(r.n / t)}` })); };
    hbars($('#sources'), share(s.sources), 'Pas de données');
    hbars($('#devices'), share(s.devices), 'Pas de données');
    hbars($('#browsers'), share(s.browsers), 'Pas de données');
    hbars($('#countries'), share(s.countries).map((r) => ({ ...r, name: `${flag(r.name)} ${r.name}` })), 'Pas de données');
    heatmap($('#heatmap'), s.heatmap);

    const steps = [
      ['Visiteurs uniques', c.uniques], ['Contenus ouverts', c.media_views], ['Paiements lancés', c.checkouts], ['Ventes', c.sales],
    ];
    const max = Math.max(1, steps[0][1], ...steps.map((x) => x[1]));
    $('#funnel').innerHTML = `<div class="funnel">${steps.map(([l, n], i) => `<div class="fstep"><span>${l}</span>
      <div class="fbar" style="width:${(n / max) * 100}%;animation-delay:${i * 0.1}s" data-tip="${esc(l)} : ${nf.format(n)}"></div>
      <span class="pct">${nf.format(n)}${i ? ` · ${steps[i - 1][1] ? pct(n / steps[i - 1][1]) : '—'}` : ''}</span></div>`).join('')}</div>`;

    const ageTotal = c.age_ok + c.age_no;
    hbars($('#ageStats'), ageTotal ? [
      { name: '✅ Ont confirmé avoir 18 ans ou plus', n: c.age_ok, right: `<b>${nf.format(c.age_ok)}</b> · ${pct(c.age_ok / ageTotal)}` },
      { name: '⛔ Ont refusé / mineurs', n: c.age_no, right: `<b>${nf.format(c.age_no)}</b> · ${pct(c.age_no / ageTotal)}` },
    ] : [], 'Aucune vérification d\'âge sur la période');
  }

  const flag = (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0))) : '🌐');
  const fmtDay = (d, long) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
  const niceMax = (v) => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

  // --- Tooltip partagé
  const tip = $('#tip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.classList.add('show');
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - r.width - 8, Math.max(8, x + 14))}px`;
    tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
  }
  const hideTip = () => tip.classList.remove('show');
  document.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-tip]'); if (t) showTip(t.dataset.tip, e.clientX, e.clientY); });
  document.addEventListener('mousemove', (e) => { const t = e.target.closest('[data-tip]'); if (t) showTip(t.dataset.tip, e.clientX, e.clientY); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('[data-tip]')) hideTip(); });

  function frame(el) {
    const W = el.clientWidth || 600, H = el.clientHeight || 240;
    return { W, H, m: { t: 10, r: 10, b: 26, l: 44 } };
  }
  // Grille + axes ; x(i) donne la position horizontale de la i-ème étiquette
  function axes(W, H, m, labels, max, fmt, x) {
    const ih = H - m.t - m.b;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
    const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor((W - m.l) / 70))));
    const yOf = (t) => m.t + ih - (t / max) * ih;
    return `<g class="grid">${ticks.map((t) => `<line x1="${m.l}" x2="${W - m.r}" y1="${yOf(t)}" y2="${yOf(t)}"/>`).join('')}</g>
      <g class="axis">${ticks.map((t) => `<text x="${m.l - 8}" y="${yOf(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
      ${labels.map((d, i) => (i % step === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDay(d)}</text>` : '')).join('')}</g>`;
  }

  function lineChart(el, labels, series, fmt) {
    const { W, H, m } = frame(el);
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = (i) => m.l + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
    const y = (v) => m.t + ih - (v / max) * ih;
    const tickFmt = (v) => compact(Math.round(v));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des visites et des clics">
      <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e83e8c" stop-opacity=".35"/><stop offset="1" stop-color="#e83e8c" stop-opacity="0"/></linearGradient></defs>
      ${axes(W, H, m, labels, max, tickFmt, x)}`;
    for (const s of series) {
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const d = smooth(pts);
      const len = Math.ceil(pathLength(pts) * 1.15) + 10;
      if (s.area) svg += `<path class="area" d="${d} L${x(labels.length - 1)},${m.t + ih} L${x(0)},${m.t + ih} Z" fill="url(#ga)"/>`;
      svg += `<path class="line" d="${d}" stroke="${s.color}" style="--len:${len}"/>`;
    }
    svg += `<g class="hover" style="display:none"><line class="cross" y1="${m.t}" y2="${m.t + ih}"/>${series.map((s) => `<circle class="dot" r="5" fill="${s.color}"/>`).join('')}</g>
      <rect x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent" class="hit"/></svg>`;
    el.innerHTML = svg;
    const g = $('.hover', el), hit = $('.hit', el), svgEl = $('svg', el);
    const move = (e) => {
      const r = svgEl.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((px - m.l) / iw) * (labels.length - 1))));
      g.style.display = '';
      $('line', g).setAttribute('x1', x(i)); $('line', g).setAttribute('x2', x(i));
      $$('circle', g).forEach((c, k) => { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(series[k].values[i])); });
      showTip(`<div class="tt-date">${fmtDay(labels[i], true)}</div>${series.map((s) => `<div class="tt-row"><span><i style="background:${s.color}"></i>${s.label}</span><b>${fmt(s.values[i])}</b></div>`).join('')}`, e.clientX, e.clientY);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { g.style.display = 'none'; hideTip(); });
  }
  function smooth(pts) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
  }
  const pathLength = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

  function barChart(el, labels, values, fmt, counts) {
    const { W, H, m } = frame(el);
    m.l = 56;
    const max = niceMax(Math.max(100, ...values));
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const slot = iw / labels.length;
    const bw = Math.max(2, Math.min(28, slot - 2)); // 2px d'écart minimum entre barres
    const tickFmt = (v) => (v / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
    let bars = '';
    values.forEach((v, i) => {
      const h = (v / max) * ih;
      const bx = m.l + i * slot + (slot - bw) / 2;
      const r = Math.min(4, bw / 2, h);
      const tipTxt = esc(`<div class="tt-date">${fmtDay(labels[i], true)}</div><div class="tt-row"><span>Revenus</span><b>${fmt(v)}</b></div><div class="tt-row"><span>Ventes</span><b>${counts[i]}</b></div>`);
      bars += `<rect x="${m.l + i * slot}" y="${m.t}" width="${slot}" height="${ih}" fill="transparent" data-tip="${tipTxt}"/>`;
      if (v > 0) bars += `<path class="bar" style="animation-delay:${Math.min(i * 0.015, 0.6)}s;pointer-events:none" fill="#e83e8c"
        d="M${bx},${m.t + ih} V${m.t + ih - h + r} Q${bx},${m.t + ih - h} ${bx + r},${m.t + ih - h} H${bx + bw - r} Q${bx + bw},${m.t + ih - h} ${bx + bw},${m.t + ih - h + r} V${m.t + ih} Z"/>`;
    });
    const ax = axes(W, H, m, labels, max, tickFmt, (i) => m.l + i * slot + slot / 2);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenus par jour">${ax}${bars}</svg>`;
    if (!values.some((v) => v > 0)) el.insertAdjacentHTML('beforeend', '<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">Aucune vente sur la période</div>');
  }

  function hbars(el, rows, empty) {
    if (!rows.length) { el.innerHTML = `<div class="empty">${empty}</div>`; return; }
    const max = Math.max(...rows.map((r) => r.n), 1);
    el.innerHTML = `<div class="hbars">${rows.map((r, i) => `<div class="hbar"><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="num">${r.right}</span>
      <div class="track"><div class="fill" style="width:${(r.n / max) * 100}%;animation-delay:${i * 0.06}s"></div></div></div>`).join('')}</div>`;
  }

  function heatmap(el, data) {
    const max = Math.max(1, ...data.flat());
    const daysFr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    // Rampe séquentielle à une seule teinte (rose), du plus sombre au plus vif
    const color = (n) => (n ? `rgba(255, 46, 138, ${0.15 + 0.85 * (n / max)})` : '');
    let html = '<div class="heat"><span></span>';
    for (let h = 0; h < 24; h++) html += `<span class="h">${h % 3 === 0 ? `${h}h` : ''}</span>`;
    data.forEach((row, d) => {
      html += `<span>${daysFr[d]}</span>`;
      row.forEach((n, h) => { html += `<span class="c" style="${n ? `background:${color(n)}` : ''}" data-tip="${esc(`<b>${daysFr[d]} ${h}h–${h + 1}h</b><br>${nf.format(n)} visite(s)`)}"></span>`; });
    });
    html += `</div><div class="heat-scale">moins ${[0.15, 0.4, 0.65, 1].map((a) => `<i style="background:rgba(255,46,138,${a})"></i>`).join('')} plus</div>`;
    el.innerHTML = html;
  }

  // ================================================================ LIENS
  let links = [];
  async function loadLinks() {
    links = await api('/api/admin/links');
    $('#linkList').innerHTML = links.map((l, i) => `
      <li class="item${l.live ? '' : ' off'}" data-id="${l.id}" style="animation-delay:${i * 0.03}s">
        <span class="handle" title="Déplacer">⋮⋮</span>
        <span class="ico">${esc(l.icon || '🔗')}</span>
        <div class="info"><b>${esc(l.title)}</b><small>${esc(l.url)}</small>
          <div class="chips">${l.adult ? '<span class="chip pink">🔞 18+</span>' : ''}${l.highlight ? '<span class="chip pink">✨ En avant</span>' : ''}
          ${l.starts_at || l.ends_at ? `<span class="chip">⏰ ${l.starts_at ? new Date(l.starts_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '…'} → ${l.ends_at ? new Date(l.ends_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '…'}</span>` : ''}
          ${l.active && !l.live ? '<span class="chip">Programmé / expiré</span>' : ''}</div></div>
        <div class="stat-mini"><b>${nf.format(l.clicks_30d)}</b>clics 30 j<br><span>${nf.format(l.clicks_total)} au total</span></div>
        <label class="switch" title="Visible"><input type="checkbox" data-toggle ${l.active ? 'checked' : ''}/><span></span></label>
        <div class="actions"><button class="icon-btn" data-edit title="Modifier">✏️</button><button class="icon-btn" data-del title="Supprimer">🗑️</button></div>
      </li>`).join('') || '<div class="card empty">Aucun lien. Clique sur « Ajouter un lien » pour commencer ✨</div>';
  }
  $('#linkList').addEventListener('click', guard(async (e) => {
    const li = e.target.closest('.item'); if (!li) return;
    const l = links.find((x) => x.id === Number(li.dataset.id));
    if (e.target.closest('[data-edit]')) editLink(l);
    if (e.target.closest('[data-del]') && confirm(`Supprimer « ${l.title} » ?`)) {
      await api(`/api/admin/links/${l.id}`, { method: 'DELETE' });
      li.style.transform = 'translateX(60px)'; li.style.opacity = '0';
      setTimeout(loadLinks, 250); toast('Lien supprimé');
    }
  }));
  $('#linkList').addEventListener('change', guard(async (e) => {
    if (!e.target.matches('[data-toggle]')) return;
    const id = Number(e.target.closest('.item').dataset.id);
    await api(`/api/admin/links/${id}`, { method: 'PATCH', body: { active: e.target.checked } });
    toast(e.target.checked ? 'Lien visible' : 'Lien masqué');
    loadLinks();
  }));

  const EMOJIS = ['💋', '🔥', '💖', '🔞', '📸', '🎥', '💎', '👑', '🍑', '🍒', '😈', '💌', '🛍️', '🎁', '⭐', '✨', '📱', '💬', '🎀', '🌸', '💸', '🔗'];
  $('#emojiPick').innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join('');
  $('#emojiPick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) $('#linkForm').icon.value = b.textContent; });

  const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  let editingLink = null;
  function editLink(l) {
    editingLink = l || null;
    const f = $('#linkForm');
    f.reset();
    $('#linkDlgTitle').textContent = l ? 'Modifier le lien' : 'Nouveau lien';
    f.icon.value = l?.icon || ''; f.title.value = l?.title || ''; f.url.value = l?.url || ''; f.subtitle.value = l?.subtitle || '';
    f.adult.checked = !!l?.adult; f.highlight.checked = !!l?.highlight; f.active.checked = l ? !!l.active : true;
    f.starts_at.value = toLocalInput(l?.starts_at); f.ends_at.value = toLocalInput(l?.ends_at);
    $('details', f).open = !!(l?.starts_at || l?.ends_at);
    $('#linkDlg').showModal();
  }
  $('#addLink').addEventListener('click', () => editLink(null));
  $('#linkDlg').addEventListener('close', guard(async () => {
    if ($('#linkDlg').returnValue !== 'ok') return;
    const f = $('#linkForm');
    const body = { icon: f.icon.value, title: f.title.value, url: f.url.value, subtitle: f.subtitle.value, adult: f.adult.checked, highlight: f.highlight.checked,
      active: f.active.checked, starts_at: f.starts_at.value || null, ends_at: f.ends_at.value || null };
    if (editingLink) await api(`/api/admin/links/${editingLink.id}`, { method: 'PUT', body });
    else await api('/api/admin/links', { method: 'POST', body });
    toast(editingLink ? 'Lien mis à jour ✨' : 'Lien ajouté ✨');
    loadLinks();
  }));

  // Glisser-déposer universel (souris + tactile) avec poignée
  function sortable(container, itemSel, handleSel, onDone) {
    let drag = null;
    container.addEventListener('pointerdown', (e) => {
      const h = e.target.closest(handleSel); if (!h) return;
      drag = h.closest(itemSel); if (!drag) return;
      e.preventDefault();
      drag.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
    });
    container.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(itemSel);
      if (!over || over === drag || over.parentNode !== container) return;
      const r = over.getBoundingClientRect();
      const grid = getComputedStyle(container).display === 'grid' && container.classList.contains('media-grid');
      const after = grid ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      container.insertBefore(drag, after ? over.nextSibling : over);
    });
    const end = () => {
      if (!drag) return;
      drag.classList.remove('dragging'); drag = null;
      onDone($$(itemSel, container).map((el) => Number(el.dataset.id)));
    };
    container.addEventListener('pointerup', end);
    container.addEventListener('pointercancel', end);
  }
  sortable($('#linkList'), '.item', '.handle', guard(async (ids) => { await api('/api/admin/links/reorder', { method: 'POST', body: { ids } }); toast('Ordre enregistré'); }));

  // ================================================================ CONTENUS
  let media = [];
  async function loadMedia() {
    media = await api('/api/admin/media');
    $('#mediaList').innerHTML = media.map((m, i) => `
      <div class="mcard" data-id="${m.id}" style="animation-delay:${i * 0.04}s${m.active ? '' : ';opacity:.55'}">
        <div class="mthumb" style="background-image:url('${esc(m.preview_url || '')}')" title="Glisse pour réordonner">
          <span class="kind">${m.kind === 'video' ? '▶ Vidéo' : '📸 Photo'}${m.adult ? ' · 🔞' : ''}</span>
          <span class="price">${m.price_cents ? money(m.price_cents) : 'Gratuit'}</span>
        </div>
        <div class="mbody"><b>${esc(m.title)}</b>
          <div class="mstats"><div><b>${nf.format(m.views)}</b>vues</div><div><b>${nf.format(m.sales)}</b>ventes</div><div><b>${money(m.revenue_cents)}</b>CA</div></div>
          <div class="mactions">
            <label class="switch" title="En vente"><input type="checkbox" data-toggle ${m.active ? 'checked' : ''}/><span></span></label>
            <div class="actions">
              <button class="icon-btn" data-view title="Voir l'original">👁️</button>
              <button class="icon-btn" data-gift title="Offrir un accès">🎁</button>
              <button class="icon-btn" data-edit title="Modifier">✏️</button>
              <button class="icon-btn" data-del title="Supprimer">🗑️</button>
            </div>
          </div>
        </div>
      </div>`).join('') || '<div class="card empty" style="grid-column:1/-1">Aucun contenu. Ajoute ta première photo ou vidéo à vendre 💎</div>';
  }
  sortable($('#mediaList'), '.mcard', '.mthumb', guard(async (ids) => { await api('/api/admin/media/reorder', { method: 'POST', body: { ids } }); toast('Ordre enregistré'); }));

  $('#mediaList').addEventListener('click', guard(async (e) => {
    const card = e.target.closest('.mcard'); if (!card) return;
    const m = media.find((x) => x.id === Number(card.dataset.id));
    if (e.target.closest('[data-view]')) window.open(m.file_url, '_blank');
    if (e.target.closest('[data-edit]')) editMedia(m);
    if (e.target.closest('[data-gift]')) {
      const email = prompt('Offrir ce contenu gratuitement.\nE-mail du destinataire (optionnel) :', '');
      if (email === null) return;
      const r = await api('/api/admin/purchases/gift', { method: 'POST', body: { media_id: m.id, email } });
      try { await navigator.clipboard.writeText(r.recover_url); toast('Lien cadeau copié 🎁'); } catch { prompt('Lien cadeau à envoyer :', r.recover_url); }
    }
    if (e.target.closest('[data-del]') && confirm(`Supprimer « ${m.title} » ? Les acheteurs perdront l'accès.`)) {
      await api(`/api/admin/media/${m.id}`, { method: 'DELETE' });
      toast('Contenu supprimé'); loadMedia();
    }
  }));
  $('#mediaList').addEventListener('change', guard(async (e) => {
    if (!e.target.matches('[data-toggle]')) return;
    const id = Number(e.target.closest('.mcard').dataset.id);
    const fd = new FormData(); fd.append('active', e.target.checked ? '1' : '0');
    await api(`/api/admin/media/${id}`, { method: 'PUT', body: fd });
    toast(e.target.checked ? 'Contenu en vente' : 'Contenu retiré'); loadMedia();
  }));

  let editingMedia = null, chosenFile = null, previewSource = null;
  const form = $('#mediaForm');
  function editMedia(m) {
    editingMedia = m || null; chosenFile = null; previewSource = null;
    form.reset();
    $('#mediaDlgTitle').textContent = m ? 'Modifier le contenu' : 'Nouveau contenu';
    $('#drop').hidden = !!m;
    form.title.value = m?.title || ''; form.description.value = m?.description || '';
    form.price.value = m ? (m.price_cents / 100).toFixed(2) : '4.99';
    form.adult.checked = !!m?.adult; form.active.checked = m ? !!m.active : true;
    $('#dropInner').innerHTML = '<b>📤 Glisse une photo ou une vidéo</b><span>ou clique pour choisir</span>';
    $('#uploadProgress').hidden = true;
    $('#mediaDlg').showModal();
  }
  $('#addMedia').addEventListener('click', () => editMedia(null));

  function pickFile(file) {
    if (!file || !/^(image|video)\//.test(file.type)) return toast('Choisis une photo ou une vidéo', true);
    chosenFile = file;
    const url = URL.createObjectURL(file);
    $('#dropInner').innerHTML = file.type.startsWith('video/') ? `<video src="${url}" muted playsinline controls></video>` : `<img src="${url}" alt="">`;
    $('#dropInner').insertAdjacentHTML('beforeend', `<span>${esc(file.name)} · ${(file.size / 1048576).toFixed(1)} Mo</span>`);
    if (!form.title.value) form.title.value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
  }
  form.file.addEventListener('change', () => pickFile(form.file.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hover'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hover'); }));
  drop.addEventListener('drop', (e) => pickFile(e.dataTransfer.files[0]));

  // Génère l'aperçu public flouté côté navigateur (l'original n'est jamais exposé)
  function loadVisual(src, isVideo) {
    return new Promise((resolve, reject) => {
      if (isVideo) {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
        v.onloadedmetadata = () => { v.currentTime = Math.min(1.5, (v.duration || 3) / 3); };
        v.onseeked = () => resolve(v);
        v.onerror = () => reject(new Error('Vidéo illisible pour l\'aperçu'));
      } else {
        const i = new Image();
        i.onload = () => resolve(i); i.onerror = () => reject(new Error('Image illisible'));
        i.src = src;
      }
    });
  }
  async function makePreview(src, isVideo, blur) {
    const el = await loadVisual(src, isVideo);
    const w0 = el.videoWidth || el.naturalWidth, h0 = el.videoHeight || el.naturalHeight;
    const W = 480, H = Math.round((h0 / w0) * W) || 640;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (blur > 0) {
      // Réduction extrême + flou : l'aperçu est irrécupérable
      const s = document.createElement('canvas'); s.width = Math.max(8, Math.round(W / (blur + 2))); s.height = Math.max(8, Math.round(H / (blur + 2)));
      s.getContext('2d').drawImage(el, 0, 0, s.width, s.height);
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(s, -blur * 2, -blur * 2, W + blur * 4, H + blur * 4);
    } else ctx.drawImage(el, 0, 0, W, H);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  }

  form.blur.addEventListener('input', () => { previewSource = 'dirty'; });

  function upload(url, method, fd) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open(method, url);
      const bar = $('#uploadProgress'); bar.hidden = false;
      x.upload.onprogress = (e) => { if (e.lengthComputable) $('div', bar).style.width = `${(e.loaded / e.total) * 100}%`; };
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 ? resolve(j) : reject(new Error(j.error || `Erreur ${x.status}`)); };
      x.onerror = () => reject(new Error('Échec de l\'envoi'));
      x.send(fd);
    });
  }

  form.addEventListener('submit', async (e) => {
    const submitter = e.submitter;
    if (submitter?.value !== 'ok') return; // Annuler : laisse le dialogue se fermer
    e.preventDefault();
    if (!editingMedia && !chosenFile) return toast('Ajoute un fichier', true);
    const btn = $('#mediaSave'); btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const fd = new FormData();
      fd.append('title', form.title.value); fd.append('description', form.description.value);
      fd.append('price', form.price.value); fd.append('adult', form.adult.checked ? '1' : '0'); fd.append('active', form.active.checked ? '1' : '0');
      const blur = Number(form.blur.value);
      if (!editingMedia) {
        const preview = await makePreview(URL.createObjectURL(chosenFile), chosenFile.type.startsWith('video/'), blur).catch(() => null);
        if (preview) fd.append('preview', preview, 'preview.jpg');
        fd.append('file', chosenFile);
        await upload('/api/admin/media', 'POST', fd);
      } else {
        if (previewSource === 'dirty') {
          const preview = await makePreview(editingMedia.file_url, editingMedia.kind === 'video', blur).catch(() => null);
          if (preview) fd.append('preview', preview, 'preview.jpg');
        }
        await upload(`/api/admin/media/${editingMedia.id}`, 'PUT', fd);
      }
      $('#mediaDlg').close();
      toast(editingMedia ? 'Contenu mis à jour 💎' : 'Contenu en ligne 💎');
      loadMedia();
    } catch (err) { toast(err.message, true); } finally { btn.disabled = false; btn.textContent = 'Enregistrer'; }
  });

  // ================================================================ VENTES
  let sales = [];
  async function loadSales() {
    sales = await api('/api/admin/purchases');
    renderSales();
  }
  function renderSales() {
    const q = $('#salesSearch').value.trim().toLowerCase();
    const rows = sales.filter((s) => !q || `${s.email} ${s.media_title} ${s.status} ${s.provider}`.toLowerCase().includes(q));
    const paid = sales.filter((s) => s.status === 'paid' && s.amount_cents > 0);
    $('#salesSummary').textContent = `${paid.length} vente(s) · ${money(paid.reduce((a, s) => a + s.amount_cents, 0))} encaissés au total`;
    const st = { paid: 'Payé', pending: 'En attente', refunded: 'Remboursé' };
    $('#salesTable').innerHTML = `<thead><tr><th>Date</th><th>Contenu</th><th>Acheteur</th><th>Montant</th><th>Statut</th><th>Moyen</th><th></th></tr></thead>
      <tbody>${rows.map((s) => `<tr data-id="${s.id}">
        <td>${new Date(`${s.created_at.replace(' ', 'T')}Z`).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${esc(s.media_title || '(supprimé)')}</td><td>${esc(s.email || '—')}</td>
        <td><b>${s.amount_cents ? money(s.amount_cents) : 'Offert'}</b></td>
        <td><span class="status ${s.status}">${st[s.status] || s.status}</span></td>
        <td>${esc(s.provider)}</td>
        <td>${s.status === 'paid' ? `<button class="link-btn" data-copy="${esc(s.recover_url)}">Lien d'accès</button>` : ''}
            ${s.status === 'paid' && s.amount_cents ? ` · <button class="link-btn" data-refund>Rembourser</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune vente pour le moment</td></tr>'}</tbody>`;
  }
  $('#salesSearch').addEventListener('input', renderSales);
  $('#salesTable').addEventListener('click', guard(async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast('Lien copié'); } catch { prompt('Lien :', c.dataset.copy); } }
    if (e.target.closest('[data-refund]')) {
      const id = Number(e.target.closest('tr').dataset.id);
      if (!confirm('Rembourser cet achat ? L\'acheteur perdra l\'accès au contenu.')) return;
      await api(`/api/admin/purchases/${id}/refund`, { method: 'POST' });
      toast('Achat remboursé'); loadSales();
    }
  }));

  // ================================================================ PROFIL
  const SOCIALS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X / Twitter'], ['snapchat', 'Snapchat'], ['youtube', 'YouTube']];
  async function loadProfile() {
    const s = await api('/api/admin/settings');
    const f = $('#profileForm');
    f.name.value = s.name; f.bio.value = s.bio; f.accent.value = s.accent || '#ff2e8a'; f.shop_title.value = s.shop_title;
    f.shop_enabled.checked = s.shop_enabled === '1'; f.page_age_gate.checked = s.page_age_gate === '1';
    setAvatar(s.avatar_url);
    $('#socialsEdit').innerHTML = SOCIALS.map(([k, l]) => `<label>${l}<input class="input" data-social="${k}" value="${esc(s.socials[k] || '')}" placeholder="pseudo ou lien" /></label>`).join('');
  }
  function setAvatar(url) { const a = $('#avatarPrev'); a.style.backgroundImage = url ? `url('${url}')` : ''; a.textContent = url ? '' : '💋'; }
  const reloadPreview = () => { $('#preview').src = `/?t=${Date.now()}`; };
  $('#profileForm').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    const f = e.target;
    const socials = {}; $$('[data-social]', f).forEach((i) => { socials[i.dataset.social] = i.value.trim(); });
    await api('/api/admin/settings', { method: 'PUT', body: {
      name: f.name.value, bio: f.bio.value, accent: f.accent.value, shop_title: f.shop_title.value,
      shop_enabled: f.shop_enabled.checked ? '1' : '0', page_age_gate: f.page_age_gate.checked ? '1' : '0', socials,
    } });
    toast('Profil enregistré 💋'); reloadPreview();
  }));
  $('#avatarInput').addEventListener('change', guard(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    const r = await api('/api/admin/avatar', { method: 'POST', body: fd });
    setAvatar(r.avatar_url); toast('Photo mise à jour'); reloadPreview();
  }));

  // ================================================================ RÉGLAGES
  $('#pwForm').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    await api('/api/admin/password', { method: 'POST', body: { current: e.target.current.value, next: e.target.next.value } });
    e.target.reset(); toast('Mot de passe mis à jour 🔐');
  }));

  // Rafraîchissement auto du compteur « en direct » et des stats
  setInterval(() => { if (!$('#tab-dashboard').hidden && !$('#app').hidden && !document.hidden) guard(loadStats)(); }, 60000);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('#tab-dashboard').hidden && !$('#app').hidden) guard(loadStats)(); }, 300); });

  boot().catch((e) => toast(e.message, true));
})();
