// The blog's write page. Posts are written in Markdown and published straight
// to the site's GitHub repository (one commit per publish), using a token the
// author pastes once and keeps in this browser only. Each publish writes:
//   blog/<slug>.html     the post, built from blog/index.html's page shell
//   blog/src/<slug>.md   the Markdown, so the post can be edited again later
//   blog/posts.js        the post list
//   blog/index.html      only to bump posts.js?v= so the new list shows at once
//   blog/img/…           any photos added to the post
(function () {
  'use strict';

  var OWNER = 'PratheekB';
  var REPO = 'pratheekb.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  var TOKEN_KEY = 'blog-token';
  var DRAFT_KEY = 'blog-draft:';
  var RESERVED = ['index', 'write', 'posts', 'blog', 'marked.min', 'src', 'img'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    pick: $('pick'), tokenBtn: $('token-btn'), setup: $('setup'), token: $('token'),
    tokenSave: $('token-save'), tokenStatus: $('token-status'), tokenForget: $('token-forget'),
    title: $('title'), date: $('date'), slug: $('slug'), body: $('body'),
    file: $('image-file'), panes: document.querySelector('.w-panes'),
    tabEdit: $('tab-edit'), tabPreview: $('tab-preview'),
    pvDate: $('pv-date'), pvTitle: $('pv-title'), pvBody: $('pv-body'),
    status: $('status'), publish: $('publish'), del: $('delete'), discard: $('discard')
  };

  // ---------- Small helpers ----------

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var today = function () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  var longDate = function (iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return '';
    return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0];
  };

  var slugify = function (s) {
    return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 60).replace(/-+$/, '');
  };

  var esc = function (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var utf8ToB64 = function (s) {
    var bytes = new TextEncoder().encode(s), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  var b64ToUtf8 = function (b) {
    var bin = atob(b.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  var setStatus = function (html, isError) {
    el.status.innerHTML = html;
    el.status.classList.toggle('w-error', !!isError);
  };

  // ---------- GitHub ----------

  var token = store.get(TOKEN_KEY) || '';

  var gh = function (method, path, body) {
    var headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(path.indexOf('https://') === 0 ? path : API + path, {
      method: method, headers: headers, cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error(j.message || r.statusText || 'Request failed');
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  };

  // A text file at a commit, or null when it isn't there
  var readFile = function (path, ref) {
    return gh('GET', '/contents/' + path + '?ref=' + (ref || BRANCH)).then(function (j) {
      return b64ToUtf8(j.content);
    }, function (e) {
      if (e.status === 404) return null;
      throw e;
    });
  };

  var explain = function (e) {
    if (e.status === 401) return 'GitHub did not accept the token. It may have expired: make a new one under “GitHub token”.';
    if (e.status === 403 || e.status === 404) return 'The token can’t write to the repository. Check it has Contents: Read and write for pratheekb.github.io.';
    if (e.status === 409 || e.status === 422) return 'The site changed on GitHub while you were publishing. Press Publish again.';
    if (e instanceof TypeError) return 'Couldn’t reach GitHub. Check your connection and try again.';
    return 'GitHub said: ' + esc(e.message || String(e));
  };

  // ---------- The post list (blog/posts.js) ----------

  var LIST_RE = /var POSTS = \[[\s\S]*?\n\];/;

  var parsePosts = function (js) {
    var m = js.match(LIST_RE);
    if (!m) throw new Error('Couldn’t find the post list in blog/posts.js');
    // Our own file from our own repository: read the array literal as code
    return Function('"use strict"; return ' + m[0].replace(/^var POSTS = /, '').replace(/;$/, ''))();
  };

  var q = function (s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };

  var writePosts = function (js, posts) {
    var lines = posts.map(function (p) {
      return '  { file: ' + q(p.file) + ', title: ' + q(p.title) + ', date: ' + q(p.date) + ' }';
    });
    return js.replace(LIST_RE, function () { return 'var POSTS = [\n' + lines.join(',\n') + '\n];'; });
  };

  var sortPosts = function (posts) {
    // Newest first; a stable sort keeps the order of posts with the same date
    return posts.map(function (p, i) { return [p, i]; }).sort(function (a, b) {
      return a[0].date < b[0].date ? 1 : a[0].date > b[0].date ? -1 : a[1] - b[1];
    }).map(function (x) { return x[0]; });
  };

  // ---------- Building a post page ----------

  // The post page is blog/index.html with its empty <article> filled in, so a
  // change to the blog's shell (sidebar, footer, style versions) carries over.
  var buildPage = function (shell, p, bodyHtml) {
    var article =
      '<article>\n' +
      '        <header class="post-head">\n' +
      '          <time datetime="' + p.date + '">' + longDate(p.date) + '</time>\n' +
      '          <h1>' + esc(p.title) + '</h1>\n' +
      '        </header>\n\n' +
      '        <div class="post-body">\n' + bodyHtml.trim() + '\n        </div>\n' +
      '      </article>';
    var out = shell
      .replace(/<title>[\s\S]*?<\/title>/, function () { return '<title>' + esc(p.title) + ' – Pratheek B</title>'; })
      .replace(/<article id="latest"><\/article>/, function () { return article; });
    if (out.indexOf(article) === -1) throw new Error('blog/index.html no longer has the empty <article id="latest"> this page fills in');
    return out;
  };

  var bumpListVersion = function (html, v) {
    return html.replace(/posts\.js\?v=\d+/g, 'posts.js?v=' + v);
  };

  var listVersion = function (html) {
    var m = html.match(/posts\.js\?v=(\d+)/);
    return m ? +m[1] : 1;
  };

  // ---------- Markdown ----------

  marked.setOptions({ gfm: true, breaks: false });

  var render = function (md) { return marked.parse(md || ''); };

  // Older posts were written straight in HTML: turn their body back into Markdown
  var htmlToMd = function (root) {
    var inline = function (node) {
      var out = '';
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { out += n.textContent.replace(/\s+/g, ' '); return; }
        if (n.nodeType !== 1) return;
        var t = n.tagName.toLowerCase(), inner = inline(n);
        if (t === 'em' || t === 'i') out += '*' + inner + '*';
        else if (t === 'strong' || t === 'b') out += '**' + inner + '**';
        else if (t === 'code') out += '`' + n.textContent + '`';
        else if (t === 'a') out += '[' + inner + '](' + n.getAttribute('href') + ')';
        else if (t === 'img') out += '![' + (n.getAttribute('alt') || '') + '](' + n.getAttribute('src') + ')';
        else if (t === 'br') out += '  \n';
        else out += n.outerHTML;
      });
      return out;
    };
    var blocks = [];
    root.childNodes.forEach(function (n) {
      if (n.nodeType === 3) { if (n.textContent.trim()) blocks.push(n.textContent.trim()); return; }
      if (n.nodeType !== 1) return;
      var t = n.tagName.toLowerCase();
      if (t === 'p') blocks.push(inline(n).trim());
      else if (/^h[1-6]$/.test(t)) blocks.push('#'.repeat(Math.max(2, +t[1])) + ' ' + inline(n).trim());
      else if (t === 'ul' || t === 'ol') {
        var i = 0;
        blocks.push(Array.prototype.map.call(n.children, function (li) {
          i++;
          return (t === 'ol' ? i + '. ' : '- ') + inline(li).trim();
        }).join('\n'));
      } else if (t === 'blockquote') blocks.push(htmlToMd(n).split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n'));
      else if (t === 'pre') blocks.push('```\n' + n.textContent.replace(/\n$/, '') + '\n```');
      else blocks.push(n.outerHTML);
    });
    return blocks.join('\n\n');
  };

  // ---------- Photos ----------

  // Photos added since the last publish: repo path → { b64, url (blob: for the preview) }
  var pending = {};

  var MAX_SIDE = 1800;

  var loadImage = function (file) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { fail(new Error('Couldn’t read ' + file.name)); };
      img.src = URL.createObjectURL(file);
    });
  };

  var blobToB64 = function (blob) {
    return new Promise(function (ok) {
      var r = new FileReader();
      r.onload = function () { ok(r.result.split(',')[1]); };
      r.readAsDataURL(blob);
    });
  };

  // Phone photos are huge: scale big ones down and save them as JPEG
  var prepareImage = function (file) {
    var type = file.type;
    if (type === 'image/gif' || type === 'image/svg+xml') return Promise.resolve({ blob: file, ext: type === 'image/gif' ? 'gif' : 'svg' });
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight, scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      var keepPng = type === 'image/png' && file.size < 400 * 1024;
      if (scale === 1 && (keepPng || (type === 'image/jpeg' && file.size < 600 * 1024))) {
        return { blob: file, ext: keepPng ? 'png' : 'jpg' };
      }
      var c = document.createElement('canvas');
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      var ctx = c.getContext('2d');
      if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return new Promise(function (ok) {
        c.toBlob(function (b) { ok({ blob: b, ext: keepPng ? 'png' : 'jpg' }); }, keepPng ? 'image/png' : 'image/jpeg', 0.85);
      });
    });
  };

  var addImages = function (files) {
    files = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    setStatus('Adding ' + (files.length === 1 ? 'the photo' : files.length + ' photos') + '…');
    var base = currentSlug() || 'post';
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () { return prepareImage(file); }).then(function (r) {
        var stem = slugify(file.name.replace(/\.[^.]+$/, '')) || 'photo';
        var name = base + '-' + stem + '.' + r.ext, n = 2;
        while (pending['blog/img/' + name]) name = base + '-' + stem + '-' + (n++) + '.' + r.ext;
        return blobToB64(r.blob).then(function (b64) {
          pending['blog/img/' + name] = { b64: b64, url: URL.createObjectURL(r.blob) };
          var alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
          insertBlock('![' + alt + '](img/' + name + ')');
        });
      });
    });
    chain.then(function () {
      setStatus('Photo added. It will be uploaded when you publish.');
    }, function (e) { setStatus(esc(e.message), true); });
  };

  // ---------- Editing state ----------

  var posts = [];          // from blog/posts.js on GitHub
  var editing = null;      // the post being edited, or null for a new post
  var hasSource = false;   // whether blog/src/<slug>.md exists for it
  var slugTouched = false;

  var currentSlug = function () { return editing ? editing.file.replace(/\.html$/, '') : el.slug.value.trim(); };
  var draftKey = function () { return DRAFT_KEY + (editing ? editing.file : 'new'); };

  var preview = function () {
    el.pvTitle.textContent = el.title.value.trim();
    el.pvDate.textContent = longDate(el.date.value);
    el.pvBody.innerHTML = render(el.body.value);
    // Photos not published yet are shown from memory
    el.pvBody.querySelectorAll('img').forEach(function (img) {
      var src = img.getAttribute('src') || '';
      var p = pending['blog/' + src.replace(/^\.\//, '')];
      if (p) img.src = p.url;
    });
  };

  var saveDraft = function () {
    var d = { title: el.title.value, date: el.date.value, slug: el.slug.value, body: el.body.value, slugTouched: slugTouched, at: Date.now() };
    store.set(draftKey(), JSON.stringify(d));
  };

  var loadDraft = function () {
    try { return JSON.parse(store.get(draftKey()) || 'null'); } catch (e) { return null; }
  };

  var draftTimer, dirty = false;
  var flushDraft = function () {
    clearTimeout(draftTimer);
    if (dirty) saveDraft();
    dirty = false;
  };
  var changed = function () {
    preview();
    dirty = true;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      flushDraft();
      setStatus('Draft saved on this device.');
    }, 600);
  };
  var dropDraft = function () {
    clearTimeout(draftTimer);
    dirty = false;
    store.del(draftKey());
  };

  var fill = function (d) {
    el.title.value = d.title || '';
    el.date.value = d.date || today();
    el.slug.value = d.slug || '';
    el.body.value = d.body || '';
    slugTouched = !!d.slugTouched;
    preview();
  };

  var showMode = function () {
    el.slug.disabled = !!editing;
    el.del.hidden = !editing;
    el.publish.textContent = editing ? 'Update post' : 'Publish';
    el.pick.value = editing ? editing.file : '';
  };

  var startNew = function () {
    editing = null;
    hasSource = false;
    showMode();
    var d = loadDraft();
    fill(d || { date: today() });
    setStatus(d ? 'Picked up your unpublished draft.' : '');
  };

  var startEdit = function (file) {
    var p = posts.filter(function (x) { return x.file === file; })[0];
    if (!p) return startNew();
    editing = p;
    showMode();
    var slug = file.replace(/\.html$/, '');
    var d = loadDraft();
    setStatus('Opening “' + esc(p.title) + '”…');
    readFile('blog/src/' + slug + '.md').then(function (md) {
      hasSource = md !== null;
      if (md !== null) return md;
      return readFile('blog/' + file).then(function (html) {
        var body = html && new DOMParser().parseFromString(html, 'text/html').querySelector('.post-body');
        return body ? htmlToMd(body) : '';
      });
    }).then(function (md) {
      if (editing !== p) return;
      if (d) {
        fill(d);
        setStatus('Picked up your unsaved changes to this post. <button type="button" class="w-link" id="drop-draft">Show the published version</button>');
        $('drop-draft').onclick = function () { store.del(draftKey()); fill({ title: p.title, date: p.date, slug: slug, body: md }); setStatus(''); };
      } else {
        fill({ title: p.title, date: p.date, slug: slug, body: md });
        setStatus('');
      }
    }).catch(function (e) { setStatus(explain(e), true); });
  };

  var fillPicker = function () {
    var keep = el.pick.value;
    el.pick.innerHTML = '';
    var o = document.createElement('option');
    o.value = '';
    o.textContent = 'New post';
    el.pick.appendChild(o);
    var g = document.createElement('optgroup');
    g.label = 'Edit a post';
    posts.forEach(function (p) {
      var x = document.createElement('option');
      x.value = p.file;
      x.textContent = p.title + ' · ' + p.date;
      g.appendChild(x);
    });
    el.pick.appendChild(g);
    el.pick.value = keep;
    el.pick.disabled = false;
  };

  var loadPosts = function () {
    return readFile('blog/posts.js').then(function (js) {
      posts = parsePosts(js || '');
      fillPicker();
    });
  };

  // ---------- Publishing ----------

  // One commit that writes and deletes the given files on top of the branch
  var commitFiles = function (message, build) {
    var head;
    return gh('GET', '/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return Promise.all([
        gh('GET', '/git/commits/' + head),
        readFile('blog/posts.js', head),
        readFile('blog/index.html', head)
      ]);
    }).then(function (r) {
      var changes = build(r[1], r[2]);
      return Promise.all(changes.map(function (c) {
        if (c.remove) return { path: c.path, mode: '100644', type: 'blob', sha: null };
        if (c.b64) {
          return gh('POST', '/git/blobs', { content: c.b64, encoding: 'base64' }).then(function (b) {
            return { path: c.path, mode: '100644', type: 'blob', sha: b.sha };
          });
        }
        return { path: c.path, mode: '100644', type: 'blob', content: c.text };
      })).then(function (tree) {
        return gh('POST', '/git/trees', { base_tree: r[0].tree.sha, tree: tree });
      });
    }).then(function (tree) {
      return gh('POST', '/git/commits', { message: message, tree: tree.sha, parents: [head] });
    }).then(function (c) {
      return gh('PATCH', '/git/refs/heads/' + BRANCH, { sha: c.sha, force: false });
    });
  };

  // GitHub Pages takes a minute or so to rebuild; say when the post is up
  var waitForLive = function (file, title, mark) {
    var url = new URL(file, location.href).href;
    var tries = 0;
    var check = function () {
      tries++;
      fetch(url + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
        return r.ok ? r.text() : '';
      }).then(function (html) {
        if (html && html.indexOf(mark) !== -1) {
          setStatus('“' + esc(title) + '” is live. <a href="' + esc(url) + '">Open it</a>');
        } else if (tries < 24) {
          setTimeout(check, 8000);
        }
      }, function () { if (tries < 24) setTimeout(check, 8000); });
    };
    setTimeout(check, 8000);
  };

  var busy = function (on) {
    el.publish.disabled = el.del.disabled = el.pick.disabled = on;
  };

  var needToken = function () {
    if (token) return false;
    el.setup.hidden = false;
    el.token.focus();
    setStatus('Add a GitHub token first (once per device).', true);
    return true;
  };

  var publish = function () {
    if (needToken()) return;
    var title = el.title.value.trim();
    var date = el.date.value;
    var slug = currentSlug();
    var md = el.body.value;
    if (!title) { setStatus('Give the post a title.', true); el.title.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setStatus('Pick a date.', true); el.date.focus(); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || RESERVED.indexOf(slug) !== -1) {
      setStatus('The address can only use lower-case letters, numbers and dashes' + (RESERVED.indexOf(slug) !== -1 ? ', and “' + slug + '” is taken by the blog itself' : '') + '.', true);
      el.slug.focus();
      return;
    }
    if (!md.trim()) { setStatus('The post is empty.', true); el.body.focus(); return; }

    flushDraft();
    var file = slug + '.html';
    var isNew = !editing;
    var used = {};
    md.replace(/\]\((?:\.\/)?(img\/[^)\s]+)/g, function (_, p) { used['blog/' + p] = true; });
    var photos = Object.keys(pending).filter(function (p) { return used[p]; });
    var mark = 'datetime="' + date + '">' + longDate(date) + '</time>\n          <h1>' + esc(title) + '</h1>';

    busy(true);
    setStatus(isNew ? 'Publishing…' : 'Updating…');
    commitFiles((isNew ? 'Blog: add “' : 'Blog: update “') + title + '”', function (js, shell) {
      if (js === null || shell === null) throw new Error('blog/posts.js or blog/index.html is missing on GitHub');
      var list = parsePosts(js);
      var exists = list.some(function (p) { return p.file === file; });
      if (isNew && exists) {
        var e = new Error('There is already a post at blog/' + file + '. Change the address.');
        e.local = true;
        throw e;
      }
      var entry = { file: file, title: title, date: date };
      list = isNew ? [entry].concat(list) : list.map(function (p) { return p.file === file ? entry : p; });
      if (!isNew && !exists) list = [entry].concat(list);
      list = sortPosts(list);
      var v = listVersion(shell) + 1;
      var newShell = bumpListVersion(shell, v);
      var changes = [
        { path: 'blog/' + file, text: buildPage(newShell, entry, render(md)) },
        { path: 'blog/src/' + slug + '.md', text: md.replace(/\s*$/, '\n') },
        { path: 'blog/posts.js', text: writePosts(js, list) },
        { path: 'blog/index.html', text: newShell }
      ];
      photos.forEach(function (p) { changes.push({ path: p, b64: pending[p].b64 }); });
      return changes;
    }).then(function () {
      photos.forEach(function (p) { delete pending[p]; });
      dropDraft();
      if (isNew) store.del(DRAFT_KEY + file);
      setStatus((isNew ? 'Published' : 'Updated') + '. It will be live in about a minute at <a href="' + esc(file) + '">blog/' + esc(file) + '</a>.');
      waitForLive(file, title, mark);
      return loadPosts().then(function () {
        editing = posts.filter(function (p) { return p.file === file; })[0] || null;
        hasSource = true;
        showMode();
      });
    }).catch(function (e) {
      setStatus(e.local ? esc(e.message) : explain(e), true);
    }).then(function () { busy(false); });
  };

  var removePost = function () {
    if (!editing || needToken()) return;
    var p = editing, slug = p.file.replace(/\.html$/, '');
    flushDraft();
    if (!confirm('Delete “' + p.title + '” from the blog? It stays in the site’s history on GitHub, so it can be brought back.')) return;
    busy(true);
    setStatus('Deleting…');
    commitFiles('Blog: delete “' + p.title + '”', function (js, shell) {
      var list = parsePosts(js).filter(function (x) { return x.file !== p.file; });
      var newShell = bumpListVersion(shell, listVersion(shell) + 1);
      var changes = [
        { path: 'blog/' + p.file, remove: true },
        { path: 'blog/posts.js', text: writePosts(js, list) },
        { path: 'blog/index.html', text: newShell }
      ];
      if (hasSource) changes.push({ path: 'blog/src/' + slug + '.md', remove: true });
      return changes;
    }).then(function () {
      dropDraft();
      return loadPosts().then(function () {
        startNew();
        setStatus('Deleted “' + esc(p.title) + '”.');
      });
    }).catch(function (e) {
      setStatus(explain(e), true);
    }).then(function () { busy(false); });
  };

  // ---------- Token ----------

  var showTokenState = function () {
    el.tokenForget.hidden = !token;
    el.tokenBtn.textContent = token ? 'GitHub token ✓' : 'GitHub token';
  };

  var saveToken = function () {
    var t = el.token.value.trim();
    if (!t) return;
    var old = token;
    token = t;
    el.tokenStatus.textContent = 'Checking…';
    gh('GET', '').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        var e = new Error('no push');
        e.status = 403;
        throw e;
      }
      store.set(TOKEN_KEY, t);
      el.token.value = '';
      el.tokenStatus.textContent = 'Saved. This device can now publish.';
      showTokenState();
      setTimeout(function () { el.setup.hidden = true; el.tokenStatus.textContent = ''; }, 1400);
      setStatus('');
      return loadPosts();
    }).catch(function (e) {
      token = old;
      el.tokenStatus.innerHTML = explain(e);
    });
  };

  el.tokenBtn.addEventListener('click', function () {
    el.setup.hidden = !el.setup.hidden;
    if (!el.setup.hidden) el.token.focus();
  });
  el.tokenSave.addEventListener('click', saveToken);
  el.token.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveToken(); });
  el.tokenForget.addEventListener('click', function () {
    token = '';
    store.del(TOKEN_KEY);
    showTokenState();
    el.tokenStatus.textContent = 'Forgotten on this device. You can also revoke it on GitHub.';
  });

  // ---------- Toolbar ----------

  var area = el.body;

  var replaceSel = function (text, selFrom, selTo) {
    var s = area.selectionStart, e = area.selectionEnd;
    area.focus();
    area.setRangeText(text, s, e, 'end');
    if (selFrom !== undefined) area.setSelectionRange(s + selFrom, s + selTo);
    changed();
  };

  var wrap = function (before, after, placeholder) {
    var sel = area.value.slice(area.selectionStart, area.selectionEnd) || placeholder;
    replaceSel(before + sel + after, before.length, before.length + sel.length);
  };

  // Puts a prefix on every line the selection touches
  var prefixLines = function (prefix) {
    var v = area.value, s = v.lastIndexOf('\n', area.selectionStart - 1) + 1;
    var e = v.indexOf('\n', area.selectionEnd);
    if (e === -1) e = v.length;
    var lines = v.slice(s, e).split('\n').map(function (l) { return prefix + l.replace(/^(#+ |> |- )/, ''); }).join('\n');
    area.focus();
    area.setRangeText(lines, s, e, 'end');
    changed();
  };

  var insertBlock = function (text) {
    var v = area.value, s = area.selectionStart;
    var before = s === 0 || /\n\n$/.test(v.slice(0, s)) ? '' : /\n$/.test(v.slice(0, s)) ? '\n' : '\n\n';
    area.focus();
    area.setSelectionRange(s, area.selectionEnd);
    area.setRangeText(before + text + '\n\n', s, area.selectionEnd, 'end');
    changed();
  };

  var actions = {
    bold: function () { wrap('**', '**', 'bold text'); },
    italic: function () { wrap('*', '*', 'italic text'); },
    heading: function () { prefixLines('## '); },
    quote: function () { prefixLines('> '); },
    list: function () { prefixLines('- '); },
    code: function () {
      var sel = area.value.slice(area.selectionStart, area.selectionEnd);
      if (sel.indexOf('\n') !== -1) wrap('```\n', '\n```', '');
      else wrap('`', '`', 'code');
    },
    link: function () {
      var sel = area.value.slice(area.selectionStart, area.selectionEnd) || 'link text';
      var url = prompt('Link to (web address):', 'https://');
      if (!url || url === 'https://') return;
      replaceSel('[' + sel + '](' + url + ')', 1, 1 + sel.length);
    },
    image: function () { el.file.click(); }
  };

  document.querySelector('.w-tools').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-do]');
    if (b) actions[b.getAttribute('data-do')]();
  });

  area.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'k') {
      e.preventDefault();
      actions[{ b: 'bold', i: 'italic', k: 'link' }[k]]();
    } else if (k === 'enter') {
      e.preventDefault();
      publish();
    }
  });

  el.file.addEventListener('change', function () { addImages(el.file.files); el.file.value = ''; });
  area.addEventListener('paste', function (e) {
    var files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) { e.preventDefault(); addImages(files); }
  });
  area.addEventListener('dragover', function (e) { e.preventDefault(); area.classList.add('w-drop'); });
  area.addEventListener('dragleave', function () { area.classList.remove('w-drop'); });
  area.addEventListener('drop', function (e) {
    area.classList.remove('w-drop');
    if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addImages(e.dataTransfer.files); }
  });

  // ---------- Fields ----------

  el.title.addEventListener('input', function () {
    if (!editing && !slugTouched) el.slug.value = slugify(el.title.value);
    changed();
  });
  el.slug.addEventListener('input', function () {
    slugTouched = el.slug.value.trim() !== '';
    el.slug.value = el.slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    changed();
  });
  el.date.addEventListener('input', changed);
  area.addEventListener('input', changed);

  el.pick.addEventListener('change', function () {
    flushDraft();
    if (el.pick.value) startEdit(el.pick.value);
    else startNew();
  });

  el.publish.addEventListener('click', publish);
  el.del.addEventListener('click', removePost);
  el.discard.addEventListener('click', function () {
    if (!confirm(editing ? 'Throw away your changes to this post?' : 'Throw away this draft?')) return;
    dropDraft();
    pending = {};
    if (editing) startEdit(editing.file);
    else { fill({ date: today() }); slugTouched = false; setStatus('Draft discarded.'); }
  });

  var tab = function (which) {
    el.panes.setAttribute('data-show', which);
    el.tabEdit.setAttribute('aria-selected', which === 'edit' ? 'true' : 'false');
    el.tabPreview.setAttribute('aria-selected', which === 'preview' ? 'true' : 'false');
  };
  el.tabEdit.addEventListener('click', function () { tab('edit'); });
  el.tabPreview.addEventListener('click', function () { tab('preview'); });

  window.addEventListener('pagehide', flushDraft);

  // ---------- Start ----------

  showTokenState();
  startNew();
  if (!token) el.setup.hidden = false;
  // The post list is public, so it loads even before a token is added
  loadPosts().catch(function (e) {
    if (e.status === 403 && !token) setStatus('GitHub is limiting requests without a token. Add one to continue.', true);
    else setStatus(explain(e), true);
  });
})();
