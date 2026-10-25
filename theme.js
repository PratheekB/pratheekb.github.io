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
    btn.addEventListener('click', function () {
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
