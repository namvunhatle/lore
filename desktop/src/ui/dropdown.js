// Replaces every <select> with a styled dropdown, so the list matches Lore's look instead of the system menu.
// The real <select> stays in the page (hidden) and remains the source of truth: code that reads or sets .value,
// replaces options or listens for "change" keeps working unchanged.
(function () {
  const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const disabledProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled');
  let openOne = null;
  let uid = 0;

  function enhance(sel) {
    if (sel.dataset.dd) return;
    sel.dataset.dd = '1';
    const id = 'dd' + ++uid;
    const wrap = document.createElement('span');
    wrap.className = 'dd';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-btn';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);
    const label = document.createElement('span');
    label.className = 'dd-label';
    btn.append(label);
    const list = document.createElement('ul');
    list.className = 'dd-list';
    list.id = id;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    sel.before(wrap);
    wrap.append(btn, list, sel);
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));

    let cursor = -1;
    const options = () => [...sel.options];

    function sync() {
      const o = sel.options[sel.selectedIndex];
      label.textContent = o ? o.textContent : '';
      btn.disabled = disabledProp.get.call(sel);
      list.replaceChildren();
      options().forEach((opt, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = id + '-' + i;
        li.textContent = opt.textContent;
        li.setAttribute('aria-selected', String(i === sel.selectedIndex));
        if (opt.disabled) li.setAttribute('aria-disabled', 'true');
        li.addEventListener('mousedown', (e) => e.preventDefault());
        // preventDefault stops a wrapping <label> from re-clicking the button and reopening the list.
        li.addEventListener('click', (e) => { e.preventDefault(); if (!opt.disabled) choose(i); });
        li.addEventListener('mousemove', () => mark(i));
        list.append(li);
      });
    }

    function mark(i) {
      cursor = i;
      [...list.children].forEach((li, k) => li.classList.toggle('on', k === i));
      const li = list.children[i];
      if (li) { li.scrollIntoView({ block: 'nearest' }); btn.setAttribute('aria-activedescendant', li.id); }
    }

    function choose(i) {
      const changed = i !== sel.selectedIndex;
      sel.selectedIndex = i;
      sync();
      close();
      btn.focus();
      if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function place() {
      list.style.minWidth = btn.offsetWidth + 'px';
      list.style.maxHeight = '';
      const r = btn.getBoundingClientRect();
      const room = innerHeight - r.bottom - 12;
      const h = Math.min(list.scrollHeight, 280);
      const up = room < Math.min(h, 160) && r.top > room;
      wrap.classList.toggle('up', up);
      list.style.maxHeight = Math.max(120, Math.min(280, (up ? r.top : room) - 8)) + 'px';
    }

    function open() {
      if (btn.disabled) return;
      if (openOne && openOne !== close) openOne();
      openOne = close;
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      place();
      mark(Math.max(0, sel.selectedIndex));
    }
    function close() {
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      if (openOne === close) openOne = null;
    }

    btn.addEventListener('click', () => (list.hidden ? open() : close()));
    btn.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== btn) close(); }, 0));
    btn.addEventListener('keydown', (e) => {
      const n = options().length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (list.hidden) return open();
        mark((cursor + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      } else if (e.key === 'Home' || e.key === 'End') {
        if (!list.hidden) { e.preventDefault(); mark(e.key === 'Home' ? 0 : n - 1); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (list.hidden) open(); else choose(cursor);
      } else if (e.key === 'Escape') {
        if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        const k = e.key.toLowerCase();
        const i = options().findIndex((o, j) => j > cursor && o.textContent.trim().toLowerCase().startsWith(k));
        const at = i >= 0 ? i : options().findIndex((o) => o.textContent.trim().toLowerCase().startsWith(k));
        if (at >= 0) { if (list.hidden) { sel.selectedIndex = at; sync(); sel.dispatchEvent(new Event('change', { bubbles: true })); } else mark(at); }
      }
    });

    // Code that sets the value or the options directly, or disables the select, shows up in the dropdown.
    Object.defineProperty(sel, 'value', { get() { return valueProp.get.call(sel); }, set(v) { valueProp.set.call(sel, v); sync(); } });
    Object.defineProperty(sel, 'disabled', { get() { return disabledProp.get.call(sel); }, set(v) { disabledProp.set.call(sel, v); sync(); } });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true });
    sel.addEventListener('change', sync);
    sync();
  }

  document.addEventListener('mousedown', (e) => { if (openOne && !e.target.closest('.dd')) openOne(); });
  window.addEventListener('blur', () => { if (openOne) openOne(); });
  const all = (root) => (root.querySelectorAll ? root.querySelectorAll('select') : []);
  const run = () => {
    all(document).forEach(enhance);
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhance(n); else all(n).forEach(enhance); }
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
