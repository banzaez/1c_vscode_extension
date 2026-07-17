export function L(node) {
  if (!node) return '';
  if (node.localName) return node.localName;
  var t = node.tagName || node.nodeName || '';
  return t.replace(/^.*:/, '');
}

export function elemChildren(node) {
  var out = [];
  if (!node || !node.childNodes) return out;
  var c = node.childNodes;
  for (var i = 0; i < c.length; i++) {
    if (c[i].nodeType === 1) out.push(c[i]);
  }
  return out;
}

export function childByName(node, name) {
  if (!node || !node.childNodes) return null;
  var c = node.childNodes;
  for (var i = 0; i < c.length; i++) {
    if (c[i].nodeType === 1 && L(c[i]) === name) return c[i];
  }
  return null;
}

export function deepFind(node, name) {
  var ch = elemChildren(node);
  for (var i = 0; i < ch.length; i++) {
    if (L(ch[i]) === name) return ch[i];
    var d = deepFind(ch[i], name);
    if (d) return d;
  }
  return null;
}

export function textOf(node) {
  return node ? String(node.textContent || '').trim() : '';
}

export function attr(node, n) {
  return (node && node.getAttribute) ? (node.getAttribute(n) || '') : '';
}

export function childText(node, name) {
  return textOf(childByName(node, name));
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
