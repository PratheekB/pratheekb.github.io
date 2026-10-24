// Light or dark theme: follows the system setting until the visitor picks one
// with the toggle, then remembers that choice on every page. Loaded (not
// deferred) in <head> so a saved choice applies before the page paints.
(function () {
  var root = document.documentElement;
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var isDark = function () {
      var t = root.getAttribute('data-theme');
      return t ? t === 'dark' : media.matches;
    };
    var sync = function () {
      root.classList.toggle('dark', isDark());
      btn.setAttribute('aria-pressed', String(isDark()));
    };
    var apply = function (next) {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      sync();
    };
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
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
    if (media.addEventListener) media.addEventListener('change', sync);
    sync();
  });
})();
