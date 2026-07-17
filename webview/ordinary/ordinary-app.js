import { parseOrdinaryForm } from './ordinary-parser.js';
import { renderOrdinaryForm } from './ordinary-render.js';
import { renderTooltipHtml } from './ordinary-tooltip.js';

var vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
var stage = document.getElementById('stage');
var errbox = document.getElementById('errbox');
var loading = document.getElementById('loading');

function setLoading(on) {
  if (loading) loading.style.display = on ? 'flex' : 'none';
}

function showError(msg) {
  errbox.style.display = 'block';
  errbox.textContent = msg;
  stage.innerHTML = '';
  document.body.classList.add('has-error');
}

function clearError() {
  errbox.style.display = 'none';
  errbox.textContent = '';
  document.body.classList.remove('has-error');
}

function mount(text, fileName) {
  clearError();
  setLoading(true);
  requestAnimationFrame(function () {
    try {
      var form = parseOrdinaryForm(text);
      hideFloatTip();
      closeAllSubmenus();
      stage.innerHTML = renderOrdinaryForm(form, fileName);
      syncTabVisibility();
    } catch (e) {
      showError('Ошибка визуализации формы: ' + (e && e.message || e));
    } finally {
      setLoading(false);
    }
  });
}

function syncTabVisibility() {
  var active = {};
  var tabs = stage.querySelectorAll('.of-tab-active[data-of-panel][data-of-tab]');
  for (var i = 0; i < tabs.length; i++) {
    active[tabs[i].getAttribute('data-of-panel')] = tabs[i].getAttribute('data-of-tab');
  }
  var items = stage.querySelectorAll('[data-of-bindings]');
  for (var j = 0; j < items.length; j++) {
    var pairs = items[j].getAttribute('data-of-bindings').split(',');
    var show = true;
    for (var k = 0; k < pairs.length; k++) {
      var parts = pairs[k].split(':');
      if (active[parts[0]] !== parts[1]) {
        show = false;
        break;
      }
    }
    items[j].style.display = show ? '' : 'none';
  }
}

function switchTab(panelId, page) {
  var tabs = stage.querySelectorAll('.of-tab[data-of-panel="' + panelId + '"]');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('of-tab-active', tabs[i].getAttribute('data-of-tab') === page);
  }
  syncTabVisibility();
}

var menuLayer = null;

function ensureMenuLayer() {
  if (!menuLayer) {
    menuLayer = document.createElement('div');
    menuLayer.id = 'of-menu-layer';
    document.body.appendChild(menuLayer);
  }
  return menuLayer;
}

function isSubmenuOpen() {
  return !!document.querySelector('.of-submenu-popup.of-submenu-floating');
}

function attachSubmenuPopup(wrap) {
  var popup = wrap.querySelector('.of-submenu-popup');
  if (!popup || wrap._ofFloatingPopup) return popup;
  ensureMenuLayer().appendChild(popup);
  popup.classList.add('of-submenu-floating');
  wrap._ofFloatingPopup = popup;
  return popup;
}

function detachSubmenuPopup(wrap) {
  var popup = wrap._ofFloatingPopup;
  if (!popup) return;
  popup.classList.remove('of-submenu-floating');
  popup.style.position = '';
  popup.style.left = '';
  popup.style.top = '';
  popup.style.right = '';
  popup.style.zIndex = '';
  popup.style.minWidth = '';
  popup.style.display = '';
  wrap.appendChild(popup);
  wrap._ofFloatingPopup = null;
}

function positionSubmenuPopup(wrap) {
  var popup = attachSubmenuPopup(wrap);
  var trigger = wrap.querySelector('.of-tbl-btn-menu, .of-cmd-btn-menu');
  if (!popup || !trigger) return;
  hideFloatTip();
  var r = trigger.getBoundingClientRect();
  popup.style.left = r.left + 'px';
  popup.style.top = (r.bottom + 2) + 'px';
  popup.style.minWidth = Math.max(r.width, 160) + 'px';
}

function closeAllSubmenus() {
  var open = stage.querySelectorAll('.of-submenu-open');
  for (var i = 0; i < open.length; i++) {
    var wrap = open[i];
    wrap.classList.remove('of-submenu-open');
    detachSubmenuPopup(wrap);
    var panel = wrap.closest('.of-el');
    if (panel) panel.classList.remove('of-submenu-active');
  }
}

function openSubmenu(wrap) {
  hideFloatTip();
  wrap.classList.add('of-submenu-open');
  var panel = wrap.closest('.of-el');
  if (panel) panel.classList.add('of-submenu-active');
  positionSubmenuPopup(wrap);
}

stage.addEventListener('click', function (e) {
  var tab = e.target.closest ? e.target.closest('.of-tab[data-of-panel][data-of-tab]') : null;
  if (tab) {
    switchTab(tab.getAttribute('data-of-panel'), tab.getAttribute('data-of-tab'));
    return;
  }

  if (e.target.closest && e.target.closest('.of-submenu-popup')) {
    return;
  }

  var menuBtn = e.target.closest ? e.target.closest('.of-tbl-btn-menu, .of-cmd-btn-menu') : null;
  if (menuBtn) {
    var wrap = menuBtn.closest ? menuBtn.closest('.of-submenu-wrap') : null;
    if (wrap) {
      e.preventDefault();
      e.stopPropagation();
      var wasOpen = wrap.classList.contains('of-submenu-open');
      closeAllSubmenus();
      if (!wasOpen) openSubmenu(wrap);
      return;
    }
  }

  closeAllSubmenus();
});

document.addEventListener('click', function (e) {
  if (!isSubmenuOpen()) return;
  if (e.target.closest && e.target.closest('.of-submenu-popup')) return;
  if (e.target.closest && e.target.closest('.of-tbl-btn-menu, .of-cmd-btn-menu')) return;
  closeAllSubmenus();
});

window.addEventListener('resize', closeAllSubmenus);
window.addEventListener('scroll', closeAllSubmenus, true);

// Горизонтальная прокрутка тулбара колесом; у таблицы — один скролл (сначала вертикаль, иначе горизонталь).
stage.addEventListener('wheel', function (e) {
  if (!e.target.closest) return;
  var toolbar = e.target.closest('.of-toolbar-hscroll');
  var tableScroll = e.target.closest('.of-tbl-scroll');
  var bar = toolbar || tableScroll;
  if (!bar) return;

  var deltaX = e.deltaX;
  var deltaY = e.deltaY;
  var canScrollX = bar.scrollWidth > bar.clientWidth;
  var canScrollY = bar.scrollHeight > bar.clientHeight;

  if (tableScroll) {
    if (canScrollY && Math.abs(deltaY) >= Math.abs(deltaX)) return;
    if (!canScrollX) return;
  } else if (!canScrollX) {
    return;
  }

  var delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (!delta) return;

  bar.scrollLeft += delta;
  e.preventDefault();
}, { passive: false });

// Всплывающие свойства элементов (нативный title в webview VS Code ненадёжен).
var floatTip = null;
var floatTipTarget = null;

function ensureFloatTip() {
  if (!floatTip) {
    floatTip = document.createElement('div');
    floatTip.id = 'of-float-tip';
    floatTip.className = 'of-float-tip';
    floatTip.style.display = 'none';
    document.body.appendChild(floatTip);
  }
  return floatTip;
}

function hideFloatTip() {
  floatTipTarget = null;
  if (floatTip) {
    floatTip.style.display = 'none';
    floatTip.classList.remove('of-float-tip-props');
  }
}

function hasProps(el) {
  return el && el.hasAttribute && (el.hasAttribute('data-of-props') || el.hasAttribute('data-tip'));
}

// Верхний элемент под курсором с data-of-props (не группа-фон под полями).
function findPropsAnchor(node, e) {
  if (isSubmenuOpen()) return null;
  if (e && document.elementsFromPoint) {
    var stack = document.elementsFromPoint(e.clientX, e.clientY);
    for (var i = 0; i < stack.length; i++) {
      var hit = stack[i];
      if (hit === floatTip) continue;
      if (menuLayer && menuLayer.contains(hit)) return null;
      if (!stage.contains(hit)) continue;
      if (hasProps(hit)) return hit;
    }
  }
  if (!node || !node.closest) return null;
  if (node.closest('.of-submenu-popup')) return null;
  return node.closest('[data-of-props]') || node.closest('[data-tip]');
}

function placeFloatTip(anchor) {
  var tip = ensureFloatTip();
  var text = anchor.getAttribute('data-of-props') || anchor.getAttribute('data-tip');
  if (!text) {
    hideFloatTip();
    return;
  }
  tip.innerHTML = renderTooltipHtml(text);
  tip.classList.add('of-float-tip-props');
  tip.style.display = 'block';
  tip.style.visibility = 'hidden';
  var r = anchor.getBoundingClientRect();
  var x = r.left + Math.min(r.width / 2, 120) - Math.min(tip.offsetWidth / 2, 160);
  var y = r.bottom + 8;
  if (y + tip.offsetHeight > window.innerHeight - 8) {
    y = r.top - tip.offsetHeight - 8;
  }
  x = Math.max(8, Math.min(x, window.innerWidth - tip.offsetWidth - 8));
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  tip.style.visibility = '';
}

stage.addEventListener('mouseover', function (e) {
  if (isSubmenuOpen()) {
    hideFloatTip();
    return;
  }
  var el = findPropsAnchor(e.target, e);
  if (el === floatTipTarget) return;
  floatTipTarget = el;
  if (!el) {
    hideFloatTip();
    return;
  }
  placeFloatTip(el);
});

stage.addEventListener('mouseout', function (e) {
  var el = findPropsAnchor(e.target, e);
  if (!el || el !== floatTipTarget) return;
  var to = e.relatedTarget;
  if (to && el.contains(to)) return;
  hideFloatTip();
});

window.addEventListener('scroll', hideFloatTip, true);

window.addEventListener('message', function (event) {
  var message = event.data;
  if (message.command === 'update') {
    mount(message.text, message.fileName);
  }
});

if (vscodeApi) {
  vscodeApi.postMessage({ command: 'ready' });
}
