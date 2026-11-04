/* 全ページ共通の動き: 表示の切り替え・読み上げ・クイズ・めくるカード・今日の単語・検索・上へ戻る・印刷。外から何も読み込まない */
(function () {
  'use strict';
  var L = window.LABELS || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* 表示: 明るい ⇄ 暗い(既定は明るい。OS の設定には従わない) */
  var tb = $('[data-theme-btn]');
  if (tb) {
    var names = { light: L.theme_light, dark: L.theme_dark };
    var lab = $('[data-theme-label]', tb);
    var cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    var show = function () { lab.textContent = names[cur]; tb.setAttribute('aria-label', L.theme + ': ' + names[cur]); };
    show();
    tb.addEventListener('click', function () {
      cur = cur === 'light' ? 'dark' : 'light';
      if (cur === 'dark') { document.documentElement.dataset.theme = 'dark'; store('theme', 'dark'); } else { delete document.documentElement.dataset.theme; store('theme', null); }
      show();
    });
  }

  /* 読み上げ: Kokoro で前もって作った音声ファイル(2026-11-04)。ゆっくりは同じファイルを data-rate の速さで鳴らす(音の高さは変えない)。
     1 つ鳴らすと、鳴っている前のものは止める */
  var playing = null;
  function stopPlaying() {
    if (!playing) return;
    playing.audio.pause();
    playing.btn.classList.remove('is-playing');
    playing = null;
  }
  $$('[data-audio]').forEach(function (b) {
    b.addEventListener('click', function () {
      var same = playing && playing.btn === b;
      stopPlaying();
      if (same) return;
      var a = new Audio(b.dataset.audio);
      var rate = parseFloat(b.dataset.rate || '1');
      a.preservesPitch = true; a.webkitPreservesPitch = true;
      a.defaultPlaybackRate = rate; a.playbackRate = rate;
      a.addEventListener('play', function () { a.playbackRate = rate; });
      var me = { audio: a, btn: b };
      var done = function () { b.classList.remove('is-playing'); if (playing === me) playing = null; };
      a.addEventListener('ended', done);
      a.addEventListener('error', done);
      playing = me;
      b.classList.add('is-playing');
      var pr = a.play();
      if (pr && pr.catch) pr.catch(done);
    });
  });

  /* 確認クイズ */
  $$('[data-quiz] .qz').forEach(function (fs) {
    var res = $('.qz-res', fs);
    $$('.qz-opt', fs).forEach(function (b) {
      b.addEventListener('click', function () {
        var ok = b.dataset.opt === fs.dataset.answer;
        $$('.qz-opt', fs).forEach(function (x) { x.classList.remove('is-ok', 'is-ng'); x.removeAttribute('aria-pressed'); });
        b.classList.add(ok ? 'is-ok' : 'is-ng'); b.setAttribute('aria-pressed', 'true');
        res.hidden = false; res.className = 'qz-res ' + (ok ? 'ok' : 'ng');
        res.textContent = ok ? L.correct : L.wrong;
        if (ok) { var d = $('.qz-why', fs); if (d) d.open = true; }
      });
    });
  });

  /* めくるカード: 隠れている面はキーボードでも触れないようにする */
  function setFlip(f, on) {
    f.classList.toggle('is-flipped', on);
    var b = $('.flip-btn', f); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('.flip-front', f).inert = on; $('.flip-back', f).inert = !on;
  }
  $$('[data-flip]').forEach(function (f) {
    setFlip(f, false);
    $('.flip-btn', f).addEventListener('click', function () { setFlip(f, !f.classList.contains('is-flipped')); });
  });

  /* コラムの一覧: 1 枚ずつめくる */
  var deck = $('[data-deck]');
  if (deck) {
    deck.hidden = false;
    var cards = $$('.deckview-card', deck), i = 0, n = $('[data-deck-n]', deck);
    var go = function (d) {
      cards[i].hidden = true; setFlip($('[data-flip]', cards[i]), false);
      i = (i + d + cards.length) % cards.length; cards[i].hidden = false; n.textContent = i + 1;
    };
    $('[data-deck-prev]', deck).addEventListener('click', function () { go(-1); });
    $('[data-deck-next]', deck).addEventListener('click', function () { go(1); });
  }

  /* 今日の単語・今日のことわざ: 日付で 1 つ選ぶ(JS が無いときは最初の 1 つ) */
  $$('[data-today]').forEach(function (box) {
    var items = $$('.today-item', box);
    var day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    var k = day % items.length;
    items.forEach(function (it, j) { it.hidden = j !== k; });
  });

  /* サイト内検索(ブラウザの中で索引を引く) */
  var form = $('[data-search-form]');
  if (form && window.SEARCH_INDEX) {
    var input = $('[data-search-input]'), out = $('[data-search-results]'), cnt = $('[data-search-count]');
    var norm = function (s) { return (s || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim(); };
    /* 編集距離(打ち間違いの候補用)。上限を超えたら途中で打ち切る */
    var dist = function (a, b, max) {
      if (Math.abs(a.length - b.length) > max) return max + 1;
      var prev = [], cur = [], i, j;
      for (j = 0; j <= b.length; j++) prev[j] = j;
      for (i = 1; i <= a.length; i++) {
        cur = [i]; var lo = cur[0];
        for (j = 1; j <= b.length; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (cur[j] < lo) lo = cur[j];
        }
        if (lo > max) return max + 1;
        prev = cur;
      }
      return prev[b.length];
    };
    var words = function (s) { return norm(s).split(/[^a-z0-9']+/).filter(Boolean); };
    var row = function (e, note) {
      var li = document.createElement('li'); li.className = 'ruled-row';
      var a = document.createElement('a'); a.href = e.u;
      var w = document.createElement('span'); w.className = 'r-word'; w.textContent = e.t;
      var lv = document.createElement('span'); lv.className = 'r-lv'; lv.textContent = e.k || '';
      var m = document.createElement('span'); m.className = 'r-mean'; m.textContent = (note ? note + ' ' : '') + e.d;
      a.appendChild(w); a.appendChild(lv); a.appendChild(m); li.appendChild(a); out.appendChild(li);
    };
    var run = function (q) {
      out.innerHTML = '';
      q = norm(q);
      if (!q) { cnt.textContent = ''; return; }
      /* 1) 題名・意味・説明に含まれる  2) 活用形・つづり違い(e.a)に一致する  3) 見つからなければ、近い綴りの候補(もしかして) */
      var hits = [], via = [];
      window.SEARCH_INDEX.forEach(function (e) {
        if (norm([e.t, e.kw, e.d].join(' ')).indexOf(q) >= 0) { hits.push(e); via.push(''); return; }
        var al = words(e.a || '').filter(function (x) { return x === q || (q.length >= 3 && x.indexOf(q) === 0); });
        if (al.length) { hits.push(e); via.push(L.search_form.replace('{x}', al[0])); }
      });
      if (hits.length) {
        cnt.textContent = hits.length + ' ' + L.hits;
        hits.forEach(function (e, i) { row(e, via[i]); });
        return;
      }
      var max = q.length <= 4 ? 1 : 2, near = [];
      window.SEARCH_INDEX.forEach(function (e) {
        var best = 9;
        words([e.t, e.a || ''].join(' ')).forEach(function (x) { var d = dist(q, x, max); if (d < best) best = d; });
        if (best <= max) near.push([best, e]);
      });
      near.sort(function (a, b) { return a[0] - b[0]; });
      cnt.textContent = near.length ? L.search_dym : L.search_none;
      near.slice(0, 5).forEach(function (n) { row(n[1], ''); });
    };
    var q0 = new URLSearchParams(location.search).get('q') || '';
    input.value = q0; run(q0);
    input.addEventListener('input', function () { run(input.value); });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); history.replaceState(null, '', '?q=' + encodeURIComponent(input.value)); run(input.value); });
  }

  /* 上へ戻る: 少しスクロールしたら出す */
  var top = $('[data-totop]');
  if (top) {
    var onScroll = function () { top.classList.toggle('show', window.scrollY > 600); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    top.addEventListener('click', function (ev) { ev.preventDefault(); window.scrollTo({ top: 0 }); var m = $('#main'); if (m) m.focus({ preventScroll: true }); });
  }

  /* 印刷 */
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
})();
