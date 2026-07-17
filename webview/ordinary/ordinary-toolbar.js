// Парсер кнопок командных панелей обычных форм 1С.
//
// Элемент кнопки: {8, "Имя", picFlag, sizeType, captionBlock, linked, commandGuid, cmdId,
//   "1e2", kind, display, flag11, flag12, flag13, …}
//   picFlag      — 1, если задана стандартная картинка
//   sizeType     — размер/стиль (1–7); значения >7 встречаются как ширина в px
//   linked       — 1, если кнопка привязана к команде формы
//   kind         — 0 кнопка, 1 подменю, 2 разделитель (после "1e2" или в хвосте без маркера)
//   display      — 0 авто/текст, 1 текст, 3 картинка
//   flag11       — доступность (0 = disabled)
//   flag13       — условная видимость (контекстная кнопка)

var INT_RE = /^-?\d+$/;
var GUID_REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Вложенная панель пунктов «Действия» (журналы и др.): cmdId панели ≠ cmdId кнопки-подменю.
var ACTIONS_COLLECTION_GUID = '875faa24-ba4b-4731-9f11-7a7cea99ef16';

function isList(node) { return Array.isArray(node); }
function isStr(node) { return node && typeof node === 'object' && typeof node.s === 'string'; }
function isAtom(node) { return typeof node === 'string'; }

// Кнопка панели: {8,"Имя",…} или {7,"Имя",…}; {7,guid,…} и {7,{4,…}} — служебные узлы.
function isToolbarButtonNode(item) {
  return isList(item) && isStr(item[1]) && (item[0] === '8' || item[0] === '7');
}

function collectRu(node, out) {
  out = out || [];
  if (!isList(node)) return out;
  if (isStr(node[0]) && isStr(node[1])) {
    if (node[0].s === 'ru') out.push(node[1].s);
    // {"#","Текст"} — прямая подпись; {"#",guid} — ссылка на команду, пропускаем.
    if (node[0].s === '#' && !GUID_REF_RE.test(node[1].s)) out.push(node[1].s);
  }
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) collectRu(node[k], out);
  }
  return out;
}

function normalizeSubmenuCaption(name, caption) {
  if (/^Подменю\d*$/i.test(name || '') &&
      (!caption || caption === name || /^Подменю\d*$/i.test(caption))) {
    return 'Действия';
  }
  return caption;
}

function pickCaption(ruList) {
  if (!ruList || !ruList.length) return '';
  var short = ruList.filter(function (s) { return s.length <= 60; });
  return short.length ? short[0] : ruList[0];
}

function find1e2Index(item) {
  for (var i = 0; i < item.length; i++) {
    if (item[i] === '1e2') return i;
  }
  return -1;
}

function parseIntAtom(node, fallback) {
  if (isAtom(node) && INT_RE.test(node)) return parseInt(node, 10);
  return fallback;
}

// Хвостовые флаги: после "1e2" или (без маркера) после cmdId.
function readTailFlags(item, start) {
  var kind = 0;
  var display = 0;
  var enabled = true;
  var active = false;
  var contextual = false;
  if (start < 0 || start >= item.length) {
    return { kind: kind, display: display, enabled: enabled, active: active, contextual: contextual };
  }
  // Без "1e2": между cmdId и kind бывает служебное число (напр. 99).
  if (item[start] !== '1e2' && isAtom(item[start]) && INT_RE.test(item[start])) {
    var n = parseInt(item[start], 10);
    if (n > 7 && isAtom(item[start + 1]) && ['0', '1', '2', '3'].indexOf(item[start + 1]) >= 0) {
      start++;
    }
  }
  kind = parseIntAtom(item[start], 0);
  display = parseIntAtom(item[start + 1], 0);
  if (isAtom(item[start + 2])) enabled = item[start + 2] !== '0';
  if (isAtom(item[start + 3])) active = item[start + 3] === '1';
  if (isAtom(item[start + 4])) contextual = item[start + 4] === '1';
  return { kind: kind, display: display, enabled: enabled, active: active, contextual: contextual };
}

// Определение способа отображения кнопки в превью.
function resolvePresentation(meta) {
  if (meta.separator) return 'separator';
  if (meta.submenu) return 'submenu';
  // display=3 — режим «картинка»; с подписью на главной панели — иконка+текст.
  // Компактные кнопки таблицы (hasPicture, sizeType 1–5) остаются только иконкой.
  if (meta.display === 3) {
    if (!meta.caption) return 'icon';
    if (meta.hasPicture && meta.sizeType >= 1 && meta.sizeType <= 5) return 'icon';
    return 'iconText';
  }
  if (meta.hasPicture && meta.sizeType >= 1 && meta.sizeType <= 5) return 'icon';
  if (meta.sizeType >= 6) return 'text';
  if (meta.caption) return 'text';
  if (meta.hasPicture) return 'icon';
  return 'text';
}

// Высота кнопки в пикселях по sizeType.
function buttonHeight(sizeType) {
  if (sizeType >= 6) return 22;
  if (sizeType >= 3) return 22;
  return 22;
}

/**
 * @param {Array} item — узел {8,"Имя",…} или {7,"Имя",…} из form.data
 * @returns {object|null}
 */
export function parseToolbarButton(item) {
  if (!isToolbarButtonNode(item)) return null;

  var name = item[1].s;
  var hasPicture = isAtom(item[2]) && item[2] === '1';
  var sizeRaw = parseIntAtom(item[3], 1);
  var styleSize = sizeRaw >= 1 && sizeRaw <= 7 ? sizeRaw : 1;
  var widthHint = sizeRaw > 7 ? sizeRaw : null;
  var capBlock = isList(item[4]) ? item[4] : null;
  var emptyCaption = capBlock && capBlock[0] === '1' && capBlock[1] === '0';
  var caption = emptyCaption ? '' : pickCaption(collectRu(item));

  var commandLinked = isAtom(item[5]) && item[5] === '1';
  var commandGuid = isAtom(item[6]) ? item[6] : '';
  var cmdId = isAtom(item[7]) && INT_RE.test(item[7]) ? parseInt(item[7], 10) : null;

  var i1 = find1e2Index(item);
  var tail = readTailFlags(item, i1 >= 0 ? i1 + 1 : 8);
  var kind = tail.kind;
  var display = tail.display;
  var enabled = tail.enabled;
  var active = tail.active;
  var contextual = tail.contextual;

  var separator = kind === 2 || /^Разделитель/i.test(name) || emptyCaption;
  var submenu = !separator && (
    kind === 1 || /^Подменю/i.test(name) || /^кнОбработка$/i.test(name)
  );
  if (submenu) caption = normalizeSubmenuCaption(name, caption);

  var presentation = resolvePresentation({
    separator: separator,
    submenu: submenu,
    hasPicture: hasPicture,
    sizeType: styleSize,
    display: display,
    caption: caption,
    name: name
  });

  return {
    name: name,
    caption: caption,
    separator: separator,
    submenu: submenu,
    hasPicture: hasPicture,
    sizeType: styleSize,
    widthHint: widthHint,
    display: display,
    kind: kind,
    enabled: enabled,
    active: active,
    contextual: contextual,
    commandLinked: commandLinked,
    commandGuid: commandGuid,
    cmdId: cmdId,
    presentation: presentation,
    height: buttonHeight(styleSize),
    iconOnly: presentation === 'icon'
  };
}

function isBarFooter(node) {
  return isList(node) && (node[0] === '0' || node[0] === '-1') && isList(node[2]);
}

// Хвост панели: {N, guid, cmdId, flag, …} — список подменю на панели.
function parseSubmenuMapping(mapping) {
  if (!isList(mapping) || !mapping.length) return [];
  var n = parseIntAtom(mapping[0], 0);
  if (!n) return [];
  var out = [];
  for (var i = 0; i < n; i++) {
    var base = 1 + i * 3;
    if (base + 2 >= mapping.length) break;
    out.push({
      commandGuid: isAtom(mapping[base]) ? mapping[base] : '',
      cmdId: parseIntAtom(mapping[base + 1], null),
      flag: parseIntAtom(mapping[base + 2], 0)
    });
  }
  return out;
}

// Отдельная панель подменю: {5, guidПанели, cmdIdПодменю, …, {8,…}, …}.
function isSubmenuBar(bar) {
  return isList(bar) && bar[0] === '5' && isAtom(bar[1]) && isAtom(bar[2]) &&
    bar[2] !== '4' && bar[2] !== '55' && INT_RE.test(bar[2]);
}

function btnKey(btn) {
  return (btn.name || '') + ':' + (btn.cmdId != null ? btn.cmdId : '');
}

function isSubmenuHeader(btn, submenuCmdIds) {
  return btn && (btn.submenu || btn.kind === 1 || (btn.cmdId != null && submenuCmdIds[btn.cmdId]));
}

function parseBarFooterHints(footer) {
  var externalCmdIds = {};
  var submenuCmdIds = {};
  if (!footer) return { externalCmdIds: externalCmdIds, submenuCmdIds: submenuCmdIds };
  // {0,1,guid,cmdId,…} — пункты подменю на отдельной панели (журнал «Действия» и т.п.).
  if (footer[1] === '1' && isAtom(footer[2]) && isAtom(footer[3])) {
    var extId = parseIntAtom(footer[3], null);
    if (extId != null) externalCmdIds[extId] = true;
  }
  // {0,0,{N,guid,cmdId,…}} — список подменю; пункты могут идти следом на той же панели.
  if (isList(footer[2])) {
    var mapping = parseSubmenuMapping(footer[2]);
    for (var m = 0; m < mapping.length; m++) {
      if (mapping[m].cmdId != null) submenuCmdIds[mapping[m].cmdId] = true;
    }
  }
  return { externalCmdIds: externalCmdIds, submenuCmdIds: submenuCmdIds };
}

function assignInlineSubmenuChildren(raw, submenuCmdIds, externalCmdIds) {
  var submenuIdx = [];
  for (var i = 0; i < raw.length; i++) {
    if (isSubmenuHeader(raw[i], submenuCmdIds)) submenuIdx.push(i);
  }
  for (var s = 0; s < submenuIdx.length; s++) {
    var idx = submenuIdx[s];
    if (raw[idx].cmdId != null && externalCmdIds[raw[idx].cmdId]) continue;
    var end = s + 1 < submenuIdx.length ? submenuIdx[s + 1] : raw.length;
    var children = [];
    for (var c = idx + 1; c < end; c++) children.push(raw[c]);
    if (children.length) raw[idx].children = children;
  }
}

function findActionsCollectionBar(parentBar) {
  if (!isList(parentBar)) return null;
  var found = null;
  function visit(list) {
    if (!isList(list) || found) return;
    if (list[0] === '5' && isAtom(list[1]) &&
        list[1].toLowerCase() === ACTIONS_COLLECTION_GUID) {
      for (var i = 0; i < list.length; i++) {
        if (isToolbarButtonNode(list[i])) {
          found = list;
          return;
        }
      }
    }
    for (var j = 0; j < list.length; j++) visit(list[j]);
  }
  visit(parentBar);
  return found;
}

function attachExternalSubmenuBars(raw, extraBars) {
  if (!extraBars || !extraBars.length) return;
  for (var i = 0; i < raw.length; i++) {
    var btn = raw[i];
    if (!btn.submenu || btn.cmdId == null) continue;
    var guid = (btn.commandGuid || '').toLowerCase();
    for (var b = 0; b < extraBars.length; b++) {
      var bar = extraBars[b];
      if (!isSubmenuBar(bar)) continue;
      if (bar[1].toLowerCase() !== guid) continue;
      var nested = null;
      var barCmd = parseInt(bar[2], 10);
      if (barCmd === btn.cmdId) {
        nested = parseToolbarBar(bar, extraBars);
      } else {
        var actionsBar = findActionsCollectionBar(bar);
        if (actionsBar) nested = parseToolbarBar(actionsBar, extraBars);
      }
      if (nested && nested.length) btn.children = nested;
    }
  }
}

// Контекстная панель {5, MAIN_BAR, 55, …} — содержимое «Действия», если на видимой панели одно подменю.
function attachContextBarChildren(raw, extraBars) {
  if (!extraBars || raw.length !== 1 || !raw[0].submenu) return;
  var main = null;
  for (var b = 0; b < extraBars.length; b++) {
    var bar = extraBars[b];
    if (isList(bar) && bar[0] === '5' && isAtom(bar[1]) &&
        bar[1].toLowerCase() === 'b78f2e80-ec68-11d4-9dcf-0050bae2bc79' && bar[2] === '55') {
      main = bar;
      break;
    }
  }
  if (!main || raw[0].children && raw[0].children.length) return;
  var items = parseToolbarBar(main, extraBars);
  if (items.length) raw[0].children = items;
}

function collectChildOnlyKeys(raw) {
  var childOnly = {};
  for (var i = 0; i < raw.length; i++) {
    var ch = raw[i].children;
    if (!ch) continue;
    for (var k = 0; k < ch.length; k++) childOnly[btnKey(ch[k])] = true;
  }
  return childOnly;
}

/** Кнопки из видимой панели {5, MAIN_BAR, 4, …, {8,…}, …}. */
export function parseToolbarBar(bar, extraBars) {
  if (!bar) return [];
  var raw = [];
  var footer = null;
  for (var k = 0; k < bar.length; k++) {
    var item = bar[k];
    if (isBarFooter(item)) {
      footer = item;
      continue;
    }
    var btn = parseToolbarButton(item);
    if (btn) raw.push(btn);
  }

  var footerHints = parseBarFooterHints(footer);
  var submenuCmdIds = footerHints.submenuCmdIds;
  var externalCmdIds = footerHints.externalCmdIds;

  assignInlineSubmenuChildren(raw, submenuCmdIds, externalCmdIds);
  attachExternalSubmenuBars(raw, extraBars);
  attachContextBarChildren(raw, extraBars);

  var childOnly = collectChildOnlyKeys(raw);
  var out = [];
  for (var t = 0; t < raw.length; t++) {
    if (!childOnly[btnKey(raw[t])]) out.push(raw[t]);
  }
  return out;
}

/** Все панели {5,…} внутри узла командной панели (для поиска подменю). */
export function collectPanelBars(node, out) {
  out = out || [];
  if (!isList(node)) return out;
  if (node[0] === '5') out.push(node);
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) collectPanelBars(node[k], out);
  }
  return out;
}

/** Запасной обход: любые {8,…}/{7,…} кнопки в поддереве. */
export function collectToolbarButtonsDeep(node, out) {
  out = out || [];
  if (!isList(node)) return out;
  if (isToolbarButtonNode(node)) {
    var parsed = parseToolbarButton(node);
    if (parsed) out.push(parsed);
    return out;
  }
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) collectToolbarButtonsDeep(node[k], out);
  }
  return out;
}

// Человекочитаемые подписи полей кнопки для подсказок.
export function labelButtonKind(kind) {
  var m = { 0: 'кнопка', 1: 'подменю', 2: 'разделитель' };
  return m[kind] != null ? m[kind] : 'неизвестно (' + kind + ')';
}

export function labelButtonDisplay(display) {
  var m = { 0: 'авто / текст', 1: 'текст', 3: 'картинка' };
  return m[display] != null ? m[display] : 'неизвестно (' + display + ')';
}

export function labelButtonSizeType(sizeType, widthHint) {
  if (!sizeType) return '';
  if (sizeType > 7) {
    var w = widthHint || sizeType;
    return 'ширина ' + w + ' px (sizeType=' + sizeType + ')';
  }
  var m = {
    1: 'компактная иконка (1)',
    2: 'компактная иконка (2)',
    3: 'иконка средняя (3)',
    4: 'иконка средняя (4)',
    5: 'иконка крупная (5)',
    6: 'текстовая кнопка (6)',
    7: 'текстовая кнопка (7)'
  };
  return m[sizeType] || 'стиль ' + sizeType;
}

export function labelButtonPresentation(pres) {
  var m = {
    icon: 'только иконка',
    iconText: 'иконка и текст',
    text: 'текст',
    submenu: 'подменю',
    separator: 'разделитель'
  };
  return m[pres] || pres;
}
