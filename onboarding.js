/* ==========================================================
   LocaLedger — Onboarding, Install Prompt & Demo Tour
   Loaded once after the main app script (defer).
   Shown only when no records exist (brand-new install or
   cleared data). Fully self-contained — no external deps.
========================================================== */
(function () {
  'use strict';

  /* ── Palette & font (mirrors the main app) ─────────────── */
  const F = "'Space Mono','Courier New',monospace";
  const C = {
    bg:      '#0f172a',
    card:    '#111827',
    border:  '#1e293b',
    indigo:  '#6366F1',
    green:   '#22C55E',
    amber:   '#EAB308',
    white:   '#f8fafc',
    gray:    '#94a3b8',
    muted:   '#64748b',
    warn_bg: '#422006',
    warn_bd: '#92400e',
    warn_fg: '#fbbf24',
  };

  /* ── Environment detection ─────────────────────────────── */
  const isPWA     = () => window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  const isIOS     = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = () => /android/i.test(navigator.userAgent);

  function hasRecords() {
    try {
      if (typeof loadData === 'function') {
        const d = loadData();
        return (d.records || []).filter(function (r) { return !r.deleted; }).length > 0;
      }
    } catch (_) {}
    return false;
  }

  /* ── Capture Chrome/Android install prompt early ──────── */
  let _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredPrompt = e;
  });

  /* ── Inject shared CSS (once) ─────────────────────────── */
  function injectStyles() {
    if (document.getElementById('ob-css')) return;
    const s = document.createElement('style');
    s.id = 'ob-css';
    s.textContent = [
      '@keyframes ob-pop  {from{opacity:0;transform:scale(.72)}to{opacity:1;transform:scale(1)}}',
      '@keyframes ob-up   {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes ob-in   {from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes ob-blink{0%,100%{opacity:1}50%{opacity:0}}',
      '.ob-pop{animation:ob-pop .55s cubic-bezier(.34,1.56,.64,1) both}',
      '.ob-up {animation:ob-up  .42s ease both}',
      '.ob-in {animation:ob-in  .32s ease both}',
      '#ob-cursor{display:inline-block;width:2px;height:1em;background:' + C.indigo + ';',
      '  margin-left:2px;vertical-align:text-bottom;animation:ob-blink 1s step-start infinite}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Utility: fade-out then remove ─────────────────────── */
  function fadeOut(el, cb) {
    if (!el) { if (cb) cb(); return; }
    el.style.transition = 'opacity .28s ease';
    el.style.opacity    = '0';
    setTimeout(function () { el.remove(); if (cb) cb(); }, 300);
  }

  /* ── Button / link builders ─────────────────────────────── */
  function solidBtn(id, label, bg) {
    return '<button id="' + id + '" style="' +
      'display:block;width:100%;padding:.7rem 1rem;margin-top:.5rem;border-radius:.75rem;' +
      'background:' + bg + ';color:' + C.white + ';border:none;' +
      'font-family:' + F + ';font-size:.78rem;font-weight:700;cursor:pointer;">' +
      label + '</button>';
  }

  function ghostBtn(id, label, color) {
    return '<button id="' + id + '" style="' +
      'display:block;width:100%;padding:.7rem 1rem;margin-top:.5rem;border-radius:.75rem;' +
      'background:transparent;color:' + color + ';border:1.5px solid ' + color + ';' +
      'font-family:' + F + ';font-size:.78rem;font-weight:700;cursor:pointer;">' +
      label + '</button>';
  }

  function skipLink(id, label) {
    label = label || 'Skip \u2014 continue in the browser';
    return '<button id="' + id + '" style="' +
      'background:none;border:none;width:100%;padding:.65rem 0 0;' +
      'font-family:' + F + ';font-size:.68rem;color:' + C.muted + ';cursor:pointer;' +
      'text-align:center;text-decoration:underline;text-underline-offset:3px;">' +
      label + '</button>';
  }

  /* ── Warning box HTML ───────────────────────────────────── */
  var WARN_HTML = '<div style="' +
    'background:' + C.warn_bg + ';border:1px solid ' + C.warn_bd + ';border-radius:.6rem;' +
    'padding:.8rem;margin-top:.9rem;font-size:.68rem;color:' + C.warn_fg + ';line-height:1.65;">' +
    '\u26a0\ufe0f <strong>Data safety:</strong> Without installing as a PWA, your data sits in ' +
    'browser cache. iOS &amp; Android may silently delete it during low-storage cleanup. ' +
    'As an installed PWA your data is treated as persistent app storage \u2014 ' +
    'far safer from automatic deletion.' +
    '</div>';

  /* ==========================================================
     LANDING SCREEN
  ========================================================== */
  function showLanding() {
    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = 'ob-overlay';
    overlay.setAttribute('style', [
      'position:fixed;inset:0;z-index:9998;',
      'background:' + C.bg + ';',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'font-family:' + F + ';',
      'padding:2rem 1.5rem 6rem;',
      'overflow-y:auto;',
    ].join(''));

    overlay.innerHTML = [
      /* Icon */
      '<div class="ob-pop" style="animation-delay:.1s">',
        '<svg width="88" height="88" viewBox="0 0 512 512" fill="none">',
          '<rect width="512" height="512" rx="80" fill="#0F172A"/>',
          '<rect x="120" y="60" width="272" height="392" rx="32" stroke="' + C.indigo + '" stroke-width="12"/>',
          '<rect x="145" y="100" width="222" height="40" rx="8" fill="#1E293B"/>',
          '<circle cx="175" cy="180" r="18" fill="' + C.green  + '"/>',
          '<rect x="210" y="170" width="130" height="20" rx="6" fill="#475569"/>',
          '<circle cx="175" cy="245" r="18" fill="' + C.amber  + '"/>',
          '<rect x="210" y="235" width="110" height="20" rx="6" fill="#475569"/>',
          '<circle cx="175" cy="310" r="18" fill="' + C.indigo + '"/>',
          '<rect x="210" y="300" width="140" height="20" rx="6" fill="#475569"/>',
          '<rect x="145" y="375" width="222" height="45" rx="22.5" fill="#334155" stroke="' + C.indigo + '" stroke-width="2"/>',
        '</svg>',
      '</div>',

      /* Wordmark */
      '<div class="ob-up" style="margin-top:1.1rem;font-size:1.9rem;font-weight:700;',
        'letter-spacing:-.02em;animation-delay:.5s;">',
        '<span style="color:' + C.white  + '">Loca</span>',
        '<span style="color:' + C.indigo + '">Ledger</span>',
      '</div>',

      /* Tagline (typewritten) */
      '<div class="ob-up" style="margin-top:.6rem;max-width:300px;text-align:center;',
        'color:' + C.gray + ';font-size:.75rem;line-height:1.7;animation-delay:.8s;min-height:2.3rem;">',
        '<span id="ob-tagtext"></span><span id="ob-cursor"></span>',
      '</div>',

      /* Action panel — hidden until animation settles */
      '<div id="ob-panel" style="display:none;width:100%;max-width:360px;margin-top:1.5rem;',
        'animation:ob-in .38s ease both;"></div>',
    ].join('');

    document.body.appendChild(overlay);

    /* Typewriter */
    var tagline = 'Your income. Your device. No one else\u2019s business.';
    var idx = 0;
    var tw = setInterval(function () {
      var span = document.getElementById('ob-tagtext');
      if (!span || idx >= tagline.length) {
        clearInterval(tw);
        var cur = document.getElementById('ob-cursor');
        if (cur) setTimeout(function () { if (cur) cur.style.display = 'none'; }, 900);
        return;
      }
      span.textContent += tagline[idx++];
    }, 38);

    /* Reveal action panel after animation settles */
    setTimeout(showPanel, 2700);
  }

  /* ── Action panel: platform-appropriate install or PWA start */
  function showPanel() {
    var panel = document.getElementById('ob-panel');
    if (!panel) return;

    if (isPWA()) {
      panel.innerHTML = pwaPanelHTML();
    } else if (isIOS()) {
      panel.innerHTML = installPanelHTML('ios');
    } else if (isAndroid()) {
      panel.innerHTML = installPanelHTML('android');
    } else {
      panel.innerHTML = installPanelHTML('desktop');
    }
    panel.style.display = 'block';
    wirePanel();
  }

  function wirePanel() {
    var overlay = document.getElementById('ob-overlay');

    var startBtn = document.getElementById('ob-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      fadeOut(overlay, startDemo);
    });

    var restoreBtn = document.getElementById('ob-restore');
    if (restoreBtn) restoreBtn.addEventListener('click', function () {
      fadeOut(overlay, function () {
        if (typeof switchTab === 'function') switchTab('settings');
        setTimeout(function () {
          var ia = document.getElementById('importArea');
          if (ia) ia.focus();
        }, 350);
      });
    });

    var skipBtn = document.getElementById('ob-skip');
    if (skipBtn) skipBtn.addEventListener('click', function () {
      fadeOut(overlay, startDemo);
    });

    var chromeBtn = document.getElementById('ob-chrome-install');
    if (chromeBtn) chromeBtn.addEventListener('click', function () {
      if (_deferredPrompt) {
        _deferredPrompt.prompt();
        _deferredPrompt.userChoice.then(function (result) {
          _deferredPrompt = null;
          if (result.outcome === 'accepted') {
            fadeOut(overlay, startDemo);
          }
        });
      } else {
        chromeBtn.textContent = 'Use browser menu \u2192 \u201cInstall LocaLedger\u201d';
        chromeBtn.disabled = true;
      }
    });
  }

  /* ── PWA start panel ─────────────────────────────────────── */
  function pwaPanelHTML() {
    return '<div style="background:' + C.card + ';border:1px solid ' + C.border + ';' +
      'border-radius:1rem;padding:1.4rem;text-align:center;">' +
        '<div style="font-size:.95rem;font-weight:700;color:' + C.white + ';margin-bottom:.35rem;">' +
          'You\u2019re all set' +
        '</div>' +
        '<div style="font-size:.72rem;color:' + C.gray + ';line-height:1.65;margin-bottom:1.1rem;">' +
          'Start fresh or restore data from a previous backup.' +
        '</div>' +
        solidBtn('ob-start',   'Start from scratch', C.indigo) +
        ghostBtn('ob-restore', 'Restore from backup', C.indigo) +
      '</div>';
  }

  /* ── Install instruction panels ──────────────────────────── */
  function installPanelHTML(platform) {
    var steps = {
      ios: [
        '1. Open this page in <strong>Safari</strong> (not Chrome or Firefox)',
        '2. Tap the <strong>Share</strong> button \u238e at the bottom of your screen',
        '3. Scroll down and tap <strong>\u201cAdd to Home Screen\u201d</strong>',
        '4. Tap <strong>\u201cAdd\u201d</strong> \u2014 the icon appears on your home screen',
      ],
      android: [
        '1. Tap the <strong>\u22ee three-dot menu</strong> in Chrome (top right)',
        '2. Tap <strong>\u201cAdd to Home screen\u201d</strong> or <strong>\u201cInstall app\u201d</strong>',
        '3. Tap <strong>\u201cInstall\u201d</strong> to confirm',
        '4. Open LocaLedger from your home screen or app drawer',
      ],
    };

    var headers = {
      ios:     { emoji: '\ud83c\udf4e', label: 'iOS \u00b7 Safari required' },
      android: { emoji: '\ud83e\udd16', label: 'Android \u00b7 Chrome' },
      desktop: { emoji: '\ud83d\udcbb', label: 'Chrome or Edge' },
    };

    var h = headers[platform];

    var stepsHtml = (steps[platform] || []).map(function (s) {
      return '<div style="padding:.45rem 0;border-bottom:1px solid ' + C.border + ';' +
        'font-size:.72rem;color:' + C.gray + ';line-height:1.55;">' + s + '</div>';
    }).join('');

    var bodyHtml = platform === 'desktop'
      ? '<div style="font-size:.72rem;color:' + C.gray + ';text-align:center;line-height:1.65;margin-bottom:.85rem;">' +
          'Install as an app for the best experience and safer data storage.' +
        '</div>' +
        solidBtn('ob-chrome-install', '\u2b07 Install App', C.indigo)
      : '<div style="margin-bottom:.85rem;">' + stepsHtml + '</div>' +
        '<div style="font-size:.68rem;color:' + C.muted + ';text-align:center;">' +
          (platform === 'ios'
            ? 'Re-open from the home screen icon once installed.'
            : 'Open from your app drawer after installing.') +
        '</div>';

    return '<div style="background:' + C.card + ';border:1px solid ' + C.border + ';' +
        'border-radius:1rem;padding:1.35rem;">' +
      '<div style="text-align:center;margin-bottom:.9rem;">' +
        '<div style="font-size:1rem;font-weight:700;color:' + C.white + ';">' +
          h.emoji + ' Add to Home Screen' +
        '</div>' +
        '<div style="font-size:.68rem;color:' + C.muted + ';margin-top:.2rem;">' + h.label + '</div>' +
      '</div>' +
      bodyHtml +
      WARN_HTML +
      skipLink('ob-skip') +
    '</div>';
  }

  /* ==========================================================
     DEMO TOUR
  ========================================================== */
  var TOUR = [
    {
      tab:   null,
      icon:  '\ud83d\udd12',
      title: 'Welcome to LocaLedger',
      body:  'No accounts. No cloud. No tracking. Everything you log stays only on this device. Here\u2019s a quick tour \u2014 tap Next to step through each part of the app.',
    },
    {
      tab:   'dashboard',
      icon:  '\ud83d\udcca',
      title: 'Dashboard',
      body:  'Your earnings overview. See totals for the current period. The banner at the bottom of the screen lets you filter by week, month, year, or all time \u2014 tap it to switch.',
    },
    {
      tab:   'dashboard',
      icon:  '\ud83d\udcc8',
      title: 'Charts',
      body:  'Tap the chart icon in the bottom nav to see a visual breakdown of your income by location \u2014 pie and bar views. Instantly see which job pays the most.',
    },
    {
      tab:   'add',
      icon:  '\u2795',
      title: 'Log a Shift',
      body:  'Record any income here. Pick a location, enter hours + rate or a flat total, and tap Save. Under 10 seconds per entry. Custom fields (tips, mileage, anything) can be set up in Settings.',
    },
    {
      tab:   'history',
      icon:  '\ud83d\udccb',
      title: 'History',
      body:  'Every entry you\u2019ve logged lives here. Tap any record to edit or delete it. Deleted records can be restored. The search bar at the top finds anything instantly.',
    },
    {
      tab:   'settings',
      icon:  '\u2699\ufe0f',
      title: 'Settings',
      body:  'Manage locations, create custom fields for entries, merge duplicate locations, and export your full data as JSON to back it up or move to another device.',
    },
    {
      tab:   null,
      icon:  '\u2705',
      title: 'All set',
      body:  'Start by logging your first shift in the Add tab. Tip: use Export in Settings regularly as a manual backup \u2014 your data only lives on this device.',
    },
  ];

  var _step   = 0;
  var _demoEl = null;

  function startDemo() {
    injectStyles();
    _demoEl = document.createElement('div');
    _demoEl.id = 'ob-demo';
    _demoEl.setAttribute('style', [
      'position:fixed;',
      'bottom:calc(4.5rem + env(safe-area-inset-bottom, 0px));',
      'left:0;right:0;',
      'z-index:9997;',
      'display:flex;justify-content:center;',
      'pointer-events:none;',
      'font-family:' + F + ';',
      'padding:0 1rem;',
    ].join(''));
    document.body.appendChild(_demoEl);
    _step = 0;
    renderStep();
  }

  function renderStep() {
    if (!_demoEl) return;
    var s     = TOUR[_step];
    var total = TOUR.length;
    var last  = (_step === total - 1);

    if (s.tab && typeof switchTab === 'function') switchTab(s.tab);

    var dots = TOUR.map(function (_, i) {
      return '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;' +
        'background:' + (i === _step ? C.indigo : C.border) + ';' +
        'margin:0 3px;transition:background .2s;"></span>';
    }).join('');

    _demoEl.innerHTML =
      '<div class="ob-in" style="' +
        'pointer-events:all;' +
        'background:' + C.card + ';border:1px solid ' + C.border + ';' +
        'border-radius:1.25rem;padding:1.15rem 1.15rem .9rem;' +
        'width:100%;max-width:420px;' +
        'box-shadow:0 -4px 40px rgba(0,0,0,.6);">' +

        /* ── Header row ── */
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">' +
          '<div style="display:flex;align-items:center;gap:.45rem;">' +
            '<span style="font-size:1.05rem;">' + s.icon + '</span>' +
            '<span style="font-size:.85rem;font-weight:700;color:' + C.white + ';">' + s.title + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:.75rem;">' +
            '<span style="font-size:.65rem;font-weight:700;color:' + C.muted + ';">' +
              (_step + 1) + ' / ' + total +
            '</span>' +
            '<button id="ob-skip-tour" style="background:none;border:none;padding:0;' +
              'font-family:' + F + ';font-size:.65rem;color:' + C.muted + ';cursor:pointer;' +
              'text-decoration:underline;text-underline-offset:2px;">Skip demo</button>' +
          '</div>' +
        '</div>' +

        /* ── Dot indicators ── */
        '<div style="text-align:center;margin-bottom:.7rem;">' + dots + '</div>' +

        /* ── Body text ── */
        '<p style="font-size:.73rem;color:' + C.gray + ';line-height:1.7;margin:0 0 .9rem;">' +
          s.body +
        '</p>' +

        /* ── CTA button ── */
        '<button id="ob-next-step" style="' +
          'display:block;width:100%;padding:.6rem;border-radius:.75rem;' +
          'background:' + (last ? C.green : C.indigo) + ';color:' + C.white + ';border:none;' +
          'font-family:' + F + ';font-size:.78rem;font-weight:700;cursor:pointer;">' +
          (last ? '\u2713 Got it \u2014 let\u2019s go!' : 'Next \u2192') +
        '</button>' +

      '</div>';

    document.getElementById('ob-next-step').addEventListener('click', advanceDemo);
    document.getElementById('ob-skip-tour').addEventListener('click', endDemo);
  }

  function advanceDemo() {
    _step++;
    if (_step >= TOUR.length) endDemo();
    else renderStep();
  }

  function endDemo() {
    var el = _demoEl;
    _demoEl = null;
    fadeOut(el);
  }

  /* ==========================================================
     INIT — entry point
  ========================================================== */
  function init() {
    if (hasRecords()) return;
    setTimeout(showLanding, 380);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
