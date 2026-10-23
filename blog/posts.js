// The blog's posts, newest first. To add a post, copy any post under
// a new name, write it, and add a line at the top of this list.
var POSTS = [
  { file: 'lorem-ipsum-dolor-sit-amet.html', title: 'Lorem ipsum dolor sit amet', date: '2026-10-23' },
  { file: 'consectetur-adipiscing-elit.html', title: 'Consectetur adipiscing elit', date: '2026-10-09' },
  { file: 'sed-do-eiusmod-tempor.html', title: 'Sed do eiusmod tempor', date: '2026-09-25' },
  { file: 'ut-labore-et-dolore-magna-aliqua.html', title: 'Ut labore et dolore magna aliqua', date: '2026-09-11' },
  { file: 'quis-nostrud-exercitation.html', title: 'Quis nostrud exercitation', date: '2026-08-28' },
  { file: 'duis-aute-irure-dolor-in-reprehenderit.html', title: 'Duis aute irure dolor in reprehenderit', date: '2026-08-14' },
  { file: 'excepteur-sint-occaecat.html', title: 'Excepteur sint occaecat', date: '2026-07-31' },
  { file: 'sunt-in-culpa-qui-officia.html', title: 'Sunt in culpa qui officia', date: '2026-07-17' },
  { file: 'nemo-enim-ipsam-voluptatem.html', title: 'Nemo enim ipsam voluptatem', date: '2026-07-03' },
  { file: 'neque-porro-quisquam-est.html', title: 'Neque porro quisquam est', date: '2026-06-19' }
];

// Fills the sidebar's post list and, on the blog's front page, shows the newest post.
(function () {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var short = function (iso) {
    var p = iso.split('-');
    return +p[2] + ' ' + months[+p[1] - 1] + ' ' + p[0];
  };
  var here = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  var current = here === 'index' ? POSTS[0] : POSTS.filter(function (p) {
    return p.file.replace(/\.html$/, '') === here;
  })[0];

  var list = document.getElementById('post-list');
  POSTS.forEach(function (p) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = p.file;
    if (p === current) {
      a.className = 'active';
      a.setAttribute('aria-current', 'page');
    }
    var title = document.createElement('span');
    title.textContent = p.title;
    var time = document.createElement('time');
    time.dateTime = p.date;
    time.textContent = short(p.date);
    a.appendChild(title);
    a.appendChild(time);
    li.appendChild(a);
    list.appendChild(li);
  });
  document.getElementById('post-count').textContent = '(' + POSTS.length + ')';

  // The list is always open beside the post on wide screens, and folds away above it on phones
  var nav = document.querySelector('.post-nav');
  var wide = window.matchMedia('(min-width: 761px)');
  var fold = function () { nav.open = wide.matches; };
  fold();
  wide.addEventListener('change', fold);

  // Front page: borrow the newest post's article
  var latest = document.getElementById('latest');
  if (latest && POSTS.length) {
    fetch(POSTS[0].file).then(function (r) { return r.text(); }).then(function (html) {
      var article = new DOMParser().parseFromString(html, 'text/html').querySelector('article');
      if (article) latest.replaceWith(article);
    });
  }
})();
