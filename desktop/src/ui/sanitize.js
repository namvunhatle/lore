// Allow-list HTML sanitizer for reader content. Anything not listed is dropped; unknown tags keep their text.
(function (root) {
  const KEEP = new Set('h1 h2 h3 h4 h5 h6 p ul ol li a img blockquote pre code em strong b i u br hr figure figcaption table thead tbody tr th td sup sub span div section article details summary small dl dt dd q cite abbr time mark'.split(' '));
  const DROP = new Set('script style iframe object embed form input button textarea select svg math noscript template link meta base video audio source track canvas'.split(' '));

  const webUrl = (v, base, allowMail) => {
    try {
      const u = new URL(v, base);
      if (u.protocol === 'http:' || u.protocol === 'https:' || (allowMail && u.protocol === 'mailto:')) return u.href;
    } catch { /* not a URL */ }
    return null;
  };

  function clean(node, out, base) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { out.append(document.createTextNode(child.nodeValue)); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (DROP.has(tag)) continue;
      if (!KEEP.has(tag)) { clean(child, out, base); continue; }
      const el = document.createElement(tag);
      if (tag === 'a') {
        const href = webUrl(child.getAttribute('href') || '', base, true);
        if (href) { el.setAttribute('href', href); el.setAttribute('rel', 'noopener noreferrer'); }
      } else if (tag === 'img') {
        const src = webUrl(child.getAttribute('src') || '', base, false);
        if (!src) continue;
        el.setAttribute('src', src);
        el.setAttribute('alt', child.getAttribute('alt') || '');
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      } else if (tag === 'td' || tag === 'th') {
        for (const a of ['colspan', 'rowspan']) if (/^\d{1,2}$/.test(child.getAttribute(a) || '')) el.setAttribute(a, child.getAttribute(a));
      }
      clean(child, el, base);
      out.append(el);
    }
    return out;
  }

  root.LORE_SANITIZE = (html, base) => {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const frag = document.createDocumentFragment();
    return clean(doc.body, frag, base || 'about:blank');
  };
})(this);
