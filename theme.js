// The site's colours drift with the visitor's local time of day, like a
// dynamic desktop wallpaper: rosy at dawn, plain paper by day, warm amber
// towards sunset, then a warm dark that deepens to midnight and cools
// slightly before dawn. Loaded (not deferred) in <head> so it runs before
// the page paints, then re-tints every minute.
(function () {
  // Light from sunrise to sunset; text and accent colours come from the
  // light or dark theme in styles.css, only the paper tones blend here.
  var sunrise = 6, sunset = 19.5;
  var light = [
    [6,    { bg: '#f9f1f0', surface: '#fffaf9', rule: '#ecdcda', 'accent-soft': '#ebedf6', 'gold-soft': '#fbe8e0', warm: 0.04 }],
    [8.5,  { bg: '#faf9f6', surface: '#ffffff', rule: '#e6e3dc', 'accent-soft': '#e8f0f6', 'gold-soft': '#fbf1dc', warm: 0 }],
    [15.5, { bg: '#faf9f6', surface: '#ffffff', rule: '#e6e3dc', 'accent-soft': '#e8f0f6', 'gold-soft': '#fbf1dc', warm: 0 }],
    [18,   { bg: '#fbf4e7', surface: '#fffaf1', rule: '#ecdec4', 'accent-soft': '#ebeee9', 'gold-soft': '#f9e7c4', warm: 0.14 }],
    [19.5, { bg: '#f9ece0', surface: '#fef6ee', rule: '#e9d6c5', 'accent-soft': '#eceaec', 'gold-soft': '#f7dfc8', warm: 0.18 }]
  ];
  // Dark stops run past midnight (hours above 24 mean the next morning)
  var dark = [
    [19.5, { bg: '#27211b', surface: '#2f2922', rule: '#42392f', 'accent-soft': '#2b3340', 'gold-soft': '#3b2f1b', warm: 0 }],
    [23,   { bg: '#1d1b17', surface: '#25221d', rule: '#38332b', 'accent-soft': '#263240', 'gold-soft': '#352b18', warm: 0 }],
    [27,   { bg: '#1a1815', surface: '#22201b', rule: '#34302a', 'accent-soft': '#232e3b', 'gold-soft': '#312816', warm: 0 }],
    [30,   { bg: '#1e1c1d', surface: '#262425', rule: '#3a3637', 'accent-soft': '#272f3d', 'gold-soft': '#33291c', warm: 0 }]
  ];

  var hex = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.substr(i, 2), 16); }); };
  var mix = function (a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    var x = hex(a), y = hex(b);
    return '#' + x.map(function (v, i) {
      return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2);
    }).join('');
  };
  var blend = function (stops, h) {
    for (var i = 1; i < stops.length; i++) {
      if (h <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = (h - a[0]) / (b[0] - a[0]), out = {};
        for (var k in a[1]) out[k] = mix(a[1][k], b[1][k], t);
        return out;
      }
    }
    return stops[stops.length - 1][1];
  };

  var paint = function (now) {
    var root = document.documentElement;
    var h = now.getHours() + now.getMinutes() / 60;
    var isLight = h >= sunrise && h < sunset;
    var tones = isLight ? blend(light, h) : blend(dark, h < sunrise ? h + 24 : h);
    var theme = isLight ? 'light' : 'dark';
    var change = function () {
      root.setAttribute('data-theme', theme);
      for (var k in tones) {
        root.style.setProperty('--' + (k === 'warm' ? 'photo-warm' : k), tones[k]);
      }
    };
    // Crossfade the switch between light and dark; the minute-by-minute drift is too small to see
    var flips = root.getAttribute('data-theme') && root.getAttribute('data-theme') !== theme;
    if (flips && document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(change);
    } else {
      change();
    }
  };

  paint(new Date());
  setInterval(function () { paint(new Date()); }, 60000);
})();
