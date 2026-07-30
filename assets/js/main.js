/* HubeVert — interactions du site */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Header compact au défilement --- */
  var header = document.getElementById('header');
  var onScroll = function () {
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- Menu mobile --- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  var closeNav = function () {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  };

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeNav();
  });

  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !e.target.closest('#nav, #burger')) closeNav();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* --- Apparition des blocs au défilement --- */
  var items = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });

    // Le hero est visible d'emblée : on le déclenche sans attendre le défilement.
    document.querySelectorAll('.hero .reveal').forEach(function (el) {
      el.classList.add('is-visible');
      io.unobserve(el);
    });
  }

  /* --- Comparateur avant / après --- */
  var compare = document.getElementById('compare');
  if (compare) {
    var overlay = document.getElementById('compareOverlay');
    var handle = document.getElementById('compareHandle');
    var dragging = false;

    var setSplit = function (pct) {
      pct = Math.max(0, Math.min(100, pct));
      overlay.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', Math.round(pct));
    };

    var fromEvent = function (e) {
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      var box = compare.getBoundingClientRect();
      setSplit(((x - box.left) / box.width) * 100);
    };

    var start = function (e) {
      dragging = true;
      compare.classList.add('is-dragging');
      fromEvent(e);
    };
    var move = function (e) {
      if (!dragging) return;
      if (e.cancelable && e.touches) e.preventDefault();
      fromEvent(e);
    };
    var stop = function () {
      dragging = false;
      compare.classList.remove('is-dragging');
    };

    compare.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    compare.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);

    handle.addEventListener('keydown', function (e) {
      var now = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
      if (e.key === 'ArrowLeft') { setSplit(now - 4); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setSplit(now + 4); e.preventDefault(); }
    });

    // Petit va-et-vient à la première apparition, pour signaler que ça se manipule.
    if (!reduced && 'IntersectionObserver' in window) {
      var hinted = false;
      var hint = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || hinted) return;
          hinted = true;
          hint.disconnect();
          var t0 = null;
          var loop = function (t) {
            if (t0 === null) t0 = t;
            var p = (t - t0) / 1600;
            if (p >= 1 || dragging) { if (!dragging) setSplit(50); return; }
            setSplit(50 + Math.sin(p * Math.PI * 2) * 16);
            requestAnimationFrame(loop);
          };
          setTimeout(function () { requestAnimationFrame(loop); }, 450);
        });
      }, { threshold: 0.45 });
      hint.observe(compare);
    }
  }

  /* --- Formulaire : ouverture d'un e-mail pré-rempli --- */
  var form = document.getElementById('devisForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = function (id) { return (form.querySelector('#' + id).value || '').trim(); };
      var body = [
        'Nom : ' + val('nom'),
        'Téléphone : ' + (val('tel') || '—'),
        'E-mail : ' + (val('email') || '—'),
        'Prestation : ' + val('presta'),
        '',
        'Projet :',
        val('msg')
      ].join('\n');

      window.location.href = 'mailto:hubevert@gmail.com'
        + '?subject=' + encodeURIComponent('Demande de devis — ' + val('presta') + ' — ' + val('nom'))
        + '&body=' + encodeURIComponent(body);
    });
  }

  /* --- Année courante dans le pied de page --- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
