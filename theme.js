// Theme follows the visitor's local time of day (dawn, day, golden hour,
// evening, night). A toggle choice overrides it until the next phase begins.
// Loaded (not deferred) in <head> so it runs before the page paints.
(function () {
  var bounds = [5.5, 8, 17, 19.5, 22];
  var phases = ['night', 'dawn', 'day', 'golden', 'evening', 'night'];
  var hours = function (d) { return d.getHours() + d.getMinutes() / 60; };
  var phase = function (d) {
    var h = hours(d), i = 0;
    while (i < bounds.length && h >= bounds[i]) i++;
    return phases[i];
  };
  var nextChange = function (d) {
    var h = hours(d);
    for (var i = 0; i < bounds.length; i++) {
      if (h < bounds[i]) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, bounds[i] * 60).getTime();
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, bounds[0] * 60).getTime();
  };
  var dark = function (p) { return p === 'evening' || p === 'night'; };
  // What the page should look like now: a remembered toggle choice, or the clock
  var current = function (now) {
    var t = null;
    try {
      t = localStorage.getItem('theme');
      if (!(+localStorage.getItem('themeUntil') > now.getTime())) t = null;
    } catch (e) {}
    if (t === 'light' || t === 'dark') return { theme: t, phase: '' };
    var p = phase(now);
    return { theme: dark(p) ? 'dark' : 'light', phase: p };
  };
  var set = function (st) {
    var root = document.documentElement;
    root.setAttribute('data-theme', st.theme);
    if (st.phase) root.setAttribute('data-phase', st.phase);
    else root.removeAttribute('data-phase');
  };
  window.siteTheme = { phase: phase, dark: dark, nextChange: nextChange, current: current, set: set };
  set(current(new Date()));
})();
