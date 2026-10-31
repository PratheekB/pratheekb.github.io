// Theme: light unless the visitor picks another mode with the toggle, which
// cycles light → dark → auto (auto follows the device setting). The choice
// is remembered on every page. Loaded (not deferred) in <head> so it applies
// before the page paints.
(function () {
  var root = document.documentElement;
  var modes = ['light', 'dark', 'auto'];
  var mode = 'light';
  try {
    var saved = localStorage.getItem('theme');
    if (modes.indexOf(saved) !== -1) mode = saved;
  } catch (e) {}

  // Light and dark pin the palette; auto leaves it to the prefers-color-scheme rules in styles.css
  var set = function (m) {
    mode = m;
    if (m === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', m);
    root.setAttribute('data-mode', m);
  };
  set(mode);

  // Accent colour, picked in a hidden menu: long-press (or right-click) the theme button
  var accents = [
    ['blue', 'Blue', '#1f5f8b', '#9fcbef'],
    ['teal', 'Teal', '#1b6b62', '#8fd3c7'],
    ['green', 'Green', '#3b6b28', '#a9d18e'],
    ['purple', 'Purple', '#6b3f8f', '#cfb0ec'],
    ['rose', 'Rose', '#a3335d', '#f1a7c1'],
    ['rust', 'Rust', '#a03c22', '#f0a898'],
    ['ink', 'Ink', '#3b4048', '#d8d2c6']
  ];
  var accent = 'blue';
  try {
    var savedAccent = localStorage.getItem('accent');
    for (var i = 0; i < accents.length; i++) if (accents[i][0] === savedAccent) accent = savedAccent;
  } catch (e) {}
  var setAccent = function (a) {
    accent = a;
    if (a === 'blue') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', a);
  };
  setAccent(accent);

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var label = function () {
      var next = modes[(modes.indexOf(mode) + 1) % modes.length];
      var text = 'Theme: ' + mode + ' (switch to ' + next + ')';
      btn.setAttribute('aria-label', text);
      btn.setAttribute('title', text);
    };
    var apply = function (next) {
      set(next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    };
    // Hidden accent menu
    var menu = document.createElement('div');
    menu.className = 'accent-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Accent colour');
    menu.hidden = true;
    accents.forEach(function (a) {
      var sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'accent-swatch';
      sw.setAttribute('aria-label', a[1]);
      sw.setAttribute('title', a[1]);
      sw.style.setProperty('--sw-l', a[2]);
      sw.style.setProperty('--sw-d', a[3]);
      sw.setAttribute('aria-pressed', a[0] === accent ? 'true' : 'false');
      sw.addEventListener('click', function () {
        setAccent(a[0]);
        try { localStorage.setItem('accent', a[0]); } catch (e) {}
        menu.querySelectorAll('.accent-swatch').forEach(function (b) {
          b.setAttribute('aria-pressed', b === sw ? 'true' : 'false');
        });
      });
      menu.appendChild(sw);
    });
    btn.parentNode.insertBefore(menu, btn.nextSibling);
    var openMenu = function () {
      menu.hidden = false;
      var cur = menu.querySelector('[aria-pressed="true"]');
      if (cur) cur.focus({ preventScroll: true });
    };
    var closeMenu = function () { menu.hidden = true; };
    document.addEventListener('pointerdown', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { closeMenu(); btn.focus(); }
    });

    // A press held for 600 ms opens the menu instead of switching the theme
    var holdTimer, held = false;
    var cancelHold = function () { clearTimeout(holdTimer); };
    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      held = false;
      cancelHold();
      holdTimer = setTimeout(function () { held = true; openMenu(); }, 600);
    });
    btn.addEventListener('pointerup', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('pointercancel', cancelHold);
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      cancelHold();
      held = true;
      openMenu();
    });

    btn.addEventListener('click', function () {
      if (held) { held = false; return; }
      if (!menu.hidden) closeMenu();
      var next = modes[(modes.indexOf(mode) + 1) % modes.length];
      // Crossfade the whole page, photo included, instead of snapping
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        apply(next);
      } else if (document.startViewTransition) {
        document.startViewTransition(function () { apply(next); });
      } else {
        root.classList.add('theme-fade');
        apply(next);
        setTimeout(function () { root.classList.remove('theme-fade'); }, 400);
      }
    });
    label();
  });
})();
