// Preview-only switch for the "prettify" mock-ups. Does nothing unless the
// URL has ?mock=..., e.g. ?mock=typo,pubs or ?mock=all.
// Ideas: typo, pubs, motion, heads, texture, timeline.
(function () {
  var all = ['typo', 'pubs', 'motion', 'heads', 'texture', 'timeline'];
  var m = /[?&]mock=([^&#]*)/.exec(location.search);
  if (!m) return;
  var ideas = decodeURIComponent(m[1]).split(',').filter(Boolean);
  if (ideas.indexOf('all') !== -1) ideas = all;
  var root = document.documentElement;
  root.setAttribute('data-mock', ideas.join(' '));
  var on = function (k) { return ideas.indexOf(k) !== -1; };

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'mockups.css?v=1';
  document.head.appendChild(link);

  // The serif body text needs the regular and italic weights, which the live page doesn't load
  if (on('typo')) {
    var f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';
    document.head.appendChild(f);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (on('pubs')) {
      document.querySelectorAll('.pub').forEach(function (li) {
        var venue = li.querySelector('.venue');
        var key = venue.textContent.toLowerCase().replace(/[^a-z]/g, '');
        venue.setAttribute('data-v', key);
        var pdf = li.querySelector('.paper-link').getAttribute('href');
        var name = pdf.replace(/^.*\//, '').replace(/_.*$/, '');
        var col = document.createElement('div');
        col.className = 'mk-thumb';
        var img = document.createElement('img');
        img.src = 'papers/thumbs/' + name + '.jpg';
        img.alt = '';
        img.loading = 'lazy';
        var a = document.createElement('a');
        a.href = pdf;
        a.target = '_blank';
        a.rel = 'noopener';
        a.tabIndex = -1;
        a.appendChild(img);
        li.insertBefore(col, venue);
        col.appendChild(a);
        col.appendChild(venue);
      });
    }

    if (on('timeline')) {
      var list = document.querySelector('#talks .list');
      var byYear = {};
      list.querySelectorAll('li').forEach(function (li) {
        var muted = li.querySelector('.muted');
        var video = li.querySelector('.video-link');
        var title = li.firstChild.textContent.trim();
        muted.textContent.replace(/^\(|\)$/g, '').split(';').forEach(function (part) {
          var y = (/\b(19|20)\d\d\b/.exec(part) || [''])[0];
          var where = part.replace(y, '').replace(/\s*,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ');
          (byYear[y] = byYear[y] || []).push({ title: title, where: where, video: video });
        });
      });
      var tl = document.createElement('div');
      tl.className = 'mk-timeline';
      Object.keys(byYear).sort().reverse().forEach(function (y) {
        var h = document.createElement('div');
        h.className = 'mk-year';
        h.textContent = y;
        tl.appendChild(h);
        byYear[y].forEach(function (t) {
          var d = document.createElement('div');
          d.className = 'mk-talk';
          d.appendChild(document.createTextNode(t.title + ' '));
          if (t.video) d.appendChild(t.video.cloneNode(true));
          var w = document.createElement('span');
          w.className = 'mk-where';
          w.textContent = t.where;
          d.appendChild(w);
          tl.appendChild(d);
        });
      });
      list.replaceWith(tl);
    }

    if (on('motion') && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('mk-in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('.section, .pub').forEach(function (s) {
        s.classList.add('mk-reveal');
        io.observe(s);
      });
    }
  });
})();
