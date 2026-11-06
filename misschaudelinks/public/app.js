// MissChaudeLinks — page publique
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AGE_KEY = 'mcl_age_ok';
  const ageOk = () => { try { return localStorage.getItem(AGE_KEY) === '1'; } catch { return false; } };
  const setAgeOk = () => { try { localStorage.setItem(AGE_KEY, '1'); } catch { /* navigation privée */ } };
  let data = null;

  const track = (type, ref_id, extra = {}) =>
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ref_id, ...extra }), keepalive: true }).catch(() => {});

  const toast = (msg) => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
  };

  // ----------------------------------------------------------- icônes réseaux
  const SOCIAL = {
    instagram: { label: 'Instagram', url: (h) => `https://instagram.com/${h}`, svg: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17.5 5.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>' },
    tiktok: { label: 'TikTok', url: (h) => `https://tiktok.com/@${h}`, svg: '<path d="M14 2h3a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.7V15a7 7 0 1 1-7-7v3.2A3.8 3.8 0 1 0 14 15V2z"/>' },
    x: { label: 'X', url: (h) => `https://x.com/${h}`, svg: '<path d="M3 3h5l4.5 6.2L18 3h3l-7.1 8.1L21.5 21h-5l-4.9-6.7L5.7 21H2.6l7.7-8.8L3 3zm3.4 1.6 11.3 14.8h1.5L7.9 4.6H6.4z"/>' },
    snapchat: { label: 'Snapchat', url: (h) => `https://snapchat.com/add/${h}`, svg: '<path d="M12 2c3.3 0 6 2.6 6 6v2.2l1.6-.5c.7-.2 1.3.6.8 1.2-.5.6-1.5 1-2.4 1.3.5 1.9 2 3.5 3.8 4.1.6.2.6 1 0 1.2-1 .4-2 .5-2.7.7-.3.8-.5 1.4-1.4 1.2-1.4-.3-2.4.2-3.7 1.2a3.3 3.3 0 0 1-4 0c-1.3-1-2.3-1.5-3.7-1.2-.9.2-1.1-.4-1.4-1.2-.7-.2-1.7-.3-2.7-.7-.6-.2-.6-1 0-1.2 1.8-.6 3.3-2.2 3.8-4.1-.9-.3-1.9-.7-2.4-1.3-.5-.6.1-1.4.8-1.2l1.6.5V8c0-3.4 2.7-6 6-6z"/>' },
    youtube: { label: 'YouTube', url: (h) => (h.startsWith('@') ? `https://youtube.com/${h}` : `https://youtube.com/@${h}`), svg: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/>' },
  };
  const socialHref = (key, v) => (/^https?:\/\//i.test(v) ? v : SOCIAL[key].url(v.replace(/^@/, key === 'youtube' ? '@' : '')));

  // ----------------------------------------------------------- rendu
  function render() {
    const { profile, socials, links, media, pay_mode } = data;
    document.title = `${profile.name} · liens`;
    if (profile.accent) document.documentElement.style.setProperty('--pink', profile.accent);
    const av = $('#avatar');
    if (profile.avatar) av.style.backgroundImage = `url("${profile.avatar}")`; else av.textContent = (profile.name || 'm').trim().charAt(0).toLowerCase();
    $('#name').textContent = profile.name;
    $('#bio').textContent = profile.bio;

    $('#socials').innerHTML = Object.entries(socials || {}).filter(([k, v]) => v && SOCIAL[k]).map(([k, v], i) =>
      `<a href="${esc(socialHref(k, v))}" target="_blank" rel="noopener" aria-label="${SOCIAL[k].label}" data-social="${k}" style="animation-delay:${0.3 + i * 0.07}s">
        <svg viewBox="0 0 24 24" aria-hidden="true">${SOCIAL[k].svg}</svg></a>`).join('');

    $('#links').innerHTML = links.map((l, i) => `
      <a class="link${l.highlight ? ' highlight' : ''}" href="/go/${l.id}" data-id="${l.id}" data-adult="${l.adult ? 1 : 0}"
         target="_blank" rel="noopener" style="animation-delay:${0.35 + i * 0.08}s">
        <span class="ico">${mclIcon(l.icon)}</span>
        <span class="txt"><span class="ttl">${esc(l.title)}</span><span class="sub">${esc(l.subtitle || l.host)}</span></span>
        ${l.adult ? '<span class="tag18">18+</span>' : ''}
        <span class="arrow">${mclIcon('arrow')}</span>
      </a>`).join('') || '<p class="bio">Aucun lien pour le moment.</p>';

    $('#shop').hidden = !media.length;
    $('#shopTitle').textContent = profile.shop_title || 'Contenus exclusifs';
    $('#grid').innerHTML = media.map((m, i) => tile(m, i)).join('');
    $('#demoNote').hidden = pay_mode !== 'demo';
    refreshMine();

    if (profile.page_age_gate && !ageOk()) {
      document.body.classList.add('gated');
      askAge().then((ok) => { if (ok) document.body.classList.remove('gated'); else location.href = 'https://www.google.com'; });
    }
  }

  function tile(m, i) {
    const locked = !m.owned;
    const bg = m.owned ? (m.kind === 'photo' ? `/media/${m.id}/file` : m.preview) : m.preview;
    return `<button class="tile${locked ? ' locked' : ''}" data-media="${m.id}" style="animation-delay:${0.5 + i * 0.06}s">
      <span class="img" style="${bg ? `background-image:url('${esc(bg)}')` : ''}"></span>
      <span class="shade"></span>
      <span class="kind">${m.kind === 'video' ? 'Vidéo' : 'Photo'}</span>
      ${m.adult ? '<span class="tag18">18+</span>' : ''}
      ${locked ? `<span class="lock">${mclIcon('lock')}</span>` : ''}
      <span class="meta"><span class="t">${esc(m.title)}</span>
        <span class="row"><span class="price${m.owned ? ' owned' : ''}">${m.owned ? (m.price_cents ? `${mclIcon('check')} Débloqué` : 'Offert') : esc(m.price)}</span></span></span>
    </button>`;
  }

  // ----------------------------------------------------------- modales
  function openModal(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(el) {
    el.hidden = true;
    if (![...document.querySelectorAll('.modal')].some((m) => !m.hidden)) document.body.style.overflow = '';
    if (el.id === 'viewer') $('#viewerBody').innerHTML = '';
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (c) closeModal(c.closest('.modal'));
    else if (e.target.classList.contains('modal') && e.target.id !== 'ageModal') closeModal(e.target);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal:not([hidden])').forEach((m) => m.id !== 'ageModal' && closeModal(m));
  });

  function askAge() {
    if (ageOk()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const m = $('#ageModal');
      openModal(m);
      $('#ageYes').focus();
      const done = (ok) => {
        $('#ageYes').onclick = $('#ageNo').onclick = null;
        closeModal(m);
        track(ok ? 'age_ok' : 'age_no');
        if (ok) setAgeOk(); else toast('Ce contenu est réservé aux adultes');
        resolve(ok);
      };
      $('#ageYes').onclick = () => done(true);
      $('#ageNo').onclick = () => done(false);
    });
  }

  // ----------------------------------------------------------- liens
  $('#links').addEventListener('click', async (e) => {
    const a = e.target.closest('.link');
    if (!a) return;
    rippleAt(a, e);
    if (a.dataset.adult === '1' && !ageOk()) {
      e.preventDefault();
      // Le clic sur « J'ai 18 ans » compte comme geste utilisateur : l'ouverture d'onglet n'est pas bloquée
      const ok = await askAge();
      if (ok) window.open(a.href, '_blank', 'noopener');
    }
  });
  $('#socials').addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) track('social'); });

  function rippleAt(el, e) {
    const r = el.getBoundingClientRect();
    const s = document.createElement('span');
    const size = Math.max(r.width, r.height);
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX || r.left + r.width / 2) - r.left - size / 2}px;top:${(e.clientY || r.top + r.height / 2) - r.top - size / 2}px`;
    el.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }

  // ----------------------------------------------------------- contenus
  let current = null;
  $('#grid').addEventListener('click', async (e) => {
    const t = e.target.closest('.tile');
    if (!t) return;
    const m = data.media.find((x) => x.id === Number(t.dataset.media));
    if (!m) return;
    if (m.adult && !(await askAge())) return;
    track('media_view', m.id);
    if (m.owned) return view(m);
    current = m;
    $('#buyPreview').style.backgroundImage = m.preview ? `url('${m.preview}')` : '';
    $('#buyTitle').textContent = m.title;
    $('#buyDesc').textContent = m.description || (m.kind === 'video' ? 'Vidéo exclusive' : 'Photo exclusive');
    $('#buyBtn').textContent = `Débloquer pour ${m.price}`;
    openModal($('#buyModal'));
  });

  $('#buyBtn').addEventListener('click', async () => {
    if (!current) return;
    const btn = $('#buyBtn');
    btn.disabled = true; btn.textContent = 'Un instant…';
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: current.id, email: $('#buyEmail').value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      if (j.redirect) { location.href = j.redirect; return; }
      closeModal($('#buyModal'));
      await unlocked(current.id);
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false; btn.textContent = `Débloquer pour ${current.price}`;
    }
  });

  async function unlocked(id) {
    await load(false);
    const t = document.querySelector(`.tile[data-media="${id}"]`);
    if (t) { t.classList.add('unlocking'); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    toast('Contenu débloqué — merci');
  }

  function view(m) {
    const src = `/media/${m.id}/file`;
    $('#viewerBody').innerHTML = (m.kind === 'video'
      ? `<video src="${src}" controls autoplay playsinline controlslist="nodownload" oncontextmenu="return false"></video>`
      : `<img src="${src}" alt="${esc(m.title)}" oncontextmenu="return false" draggable="false" />`) +
      `<p class="cap">${esc(m.title)}</p>`;
    openModal($('#viewer'));
  }

  async function refreshMine() {
    try {
      const list = await (await fetch('/api/my-purchases')).json();
      $('#myPurchasesBtn').hidden = !list.length;
      $('#mineList').innerHTML = list.map((p) => `<li><strong>${esc(p.title)}</strong><br>
        <button data-copy="${esc(p.recover_url)}">Copier mon lien de récupération</button></li>`).join('');
      $('#myPurchasesBtn').innerHTML = `${mclIcon('key')} Mes achats`;
    } catch { /* ignore */ }
  }
  $('#myPurchasesBtn').addEventListener('click', () => openModal($('#mineModal')));
  $('#mineList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Lien copié'); } catch { prompt('Ton lien :', b.dataset.copy); }
  });

  // ----------------------------------------------------------- effets
  // Poussière lumineuse très discrète
  function sparkles() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#dust'), ctx = c.getContext('2d');
    let w, h, dpr;
    const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr; };
    resize(); addEventListener('resize', resize);
    const N = Math.min(28, Math.round(innerWidth / 30));
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.3, s: Math.random() * 0.00015 + 0.00005, p: Math.random() * 6.28 }));
    (function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.s; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const a = 0.15 + 0.35 * Math.abs(Math.sin(t / 2400 + p.p));
        ctx.beginPath();
        ctx.fillStyle = `rgba(244, 230, 234, ${a})`;
        ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, 6.28);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    })(0);
  }

  // ----------------------------------------------------------- démarrage
  async function load(first = true) {
    data = await (await fetch('/api/public', { cache: 'no-store' })).json();
    render();
    if (first) track('view', null, { referrer: document.referrer });
  }

  $('#year').textContent = new Date().getFullYear();
  sparkles();
  load().then(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('unlocked')) { history.replaceState(null, '', '/'); unlocked(Number(q.get('unlocked'))); }
    if (q.get('cancel')) { history.replaceState(null, '', '/'); toast('Paiement annulé'); }
  }).catch(() => toast('Impossible de charger la page'));
})();
