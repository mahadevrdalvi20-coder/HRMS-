// Minimal renderer so the design mockups in this folder open in any browser.
// It expands the {{holes}}, <sc-for>, <sc-if> and <dc-import> used by the
// *.dc.html files. Serve the folder over HTTP (e.g. `npx serve docs/design`)
// because <dc-import> fetches sibling files.
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(s) { Object.assign(this.state, s); }
    forceUpdate() {}
  }
  window.DCLogic = DCLogic;

  const HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const HAS_HOLE = /\{\{\s*[\w.$]+\s*\}\}/;
  const get = (scope, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  const value = (p, scope) => {
    if (p === 'true') return true;
    if (p === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
    return get(scope, p);
  };
  const interp = (s, scope) => s.replace(HOLE, (_, p) => { const v = value(p, scope); return v == null ? '' : String(v); });
  const whole = (s) => { const m = String(s || '').match(/^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/); return m && m[1]; };

  function component(doc) {
    const sc = doc.querySelector('script[data-dc-script]');
    const defaults = {};
    try {
      const dp = JSON.parse(sc.getAttribute('data-props') || '{}');
      for (const k of Object.keys(dp)) if (k[0] !== '$' && dp[k] && 'default' in dp[k]) defaults[k] = dp[k].default;
    } catch (e) { /* ignore */ }
    const Comp = new Function('DCLogic', sc.textContent + '\nreturn Component;')(DCLogic);
    return { Comp, defaults };
  }

  function hoistHelmet(root) {
    const helmet = root.querySelector('helmet');
    if (!helmet) return;
    for (const el of [...helmet.children]) document.head.appendChild(el);
    helmet.remove();
  }

  async function renderChildren(node, scope) {
    for (const child of [...node.childNodes]) await renderNode(child, scope);
  }

  async function renderNode(n, scope) {
    if (n.nodeType === 3) { if (HAS_HOLE.test(n.nodeValue)) n.nodeValue = interp(n.nodeValue, scope); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();

    if (tag === 'sc-for') {
      const list = value(whole(n.getAttribute('list')) || '', scope) || [];
      const as = n.getAttribute('as') || 'item';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < list.length; i++) {
        const wrap = document.createElement('div');
        wrap.innerHTML = n.innerHTML;
        await renderChildren(wrap, { ...scope, [as]: list[i], $index: i });
        while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      }
      n.replaceWith(frag);
      return;
    }

    if (tag === 'sc-if') {
      const v = value(whole(n.getAttribute('value')) || '', scope);
      if (!v) { n.remove(); return; }
      await renderChildren(n, scope);
      n.replaceWith(...n.childNodes);
      return;
    }

    if (tag === 'dc-import') {
      const name = n.getAttribute('name');
      const props = {};
      for (const a of [...n.attributes]) {
        if (a.name === 'name' || a.name.startsWith('hint-')) continue;
        const key = a.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const w = whole(a.value);
        props[key] = w ? value(w, scope) : interp(a.value, scope);
      }
      const html = await (await fetch(name + '.dc.html')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const { Comp, defaults } = component(doc);
      const vals = new Comp({ ...defaults, ...props }).renderVals();
      const box = document.createElement('div');
      box.innerHTML = doc.querySelector('x-dc').innerHTML;
      hoistHelmet(box);
      await renderChildren(box, vals);
      n.replaceWith(...box.childNodes);
      return;
    }

    for (const a of [...n.attributes]) {
      if (!HAS_HOLE.test(a.value)) continue;
      if (/^on/i.test(a.name)) n.removeAttribute(a.name);
      else n.setAttribute(a.name, interp(a.value, scope));
    }
    await renderChildren(n, scope);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('x-dc');
    if (!root) return;
    root.style.display = 'contents';
    const { Comp, defaults } = component(document);
    const vals = new Comp(defaults).renderVals();
    hoistHelmet(root);
    await renderChildren(root, vals);
    document.body.setAttribute('data-ready', '1');
  });
})();
