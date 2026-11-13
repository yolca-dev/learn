/* 元の表現解説の文の区切り(port_expr.py が写す) */

(function () {
  var d = document;
  if (d.documentElement.lang !== 'ja' || !window.Intl || !Intl.Segmenter || (window.CSS && CSS.supports && CSS.supports('word-break', 'auto-phrase'))) return;
  var seg = new Intl.Segmenter('ja', { granularity: 'word' });
  var HEAD = /^[一-鿿ァ-ヴA-Za-z0-9]/, NOBREAK_AFTER = /[「『(（\[【〈《“‘\s]$|[A-Za-z0-9]$/, JA = /[぀-ヿ一-鿿]/;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, svg: 1, TITLE: 1 };
  function wrap(t) {
    var s = t.nodeValue, cuts = [], it, iter;
    if (s.length < 4 || !JA.test(s)) return;
    iter = seg.segment(s)[Symbol.iterator]();
    while (!(it = iter.next()).done) {
      var i = it.value.index;
      if (i > 0 && HEAD.test(it.value.segment) && !NOBREAK_AFTER.test(s.slice(0, i))) cuts.push(i);
    }
    if (!cuts.length) return;
    var f = d.createDocumentFragment(), p = 0;
    cuts.forEach(function (c) { f.appendChild(d.createTextNode(s.slice(p, c))); f.appendChild(d.createElement('wbr')); p = c; });
    f.appendChild(d.createTextNode(s.slice(p)));
    t.parentNode.replaceChild(f, t);
  }
  function walk(n) {
    for (var c = n.firstChild; c;) {
      var nx = c.nextSibling;
      if (c.nodeType === 3) wrap(c);
      else if (c.nodeType === 1 && !SKIP[c.tagName] && !c.classList.contains('vh')) walk(c);
      c = nx;
    }
  }
  d.documentElement.classList.add('wbr-fallback');   // CSS(design/style.css): かなの間では折り返さず、<wbr> の所と、行に入らない語だけ途中で折り返す
  walk(d.querySelector('main') || d.body);
})();
