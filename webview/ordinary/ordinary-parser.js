// Парсер обычных форм 1С (файл form.data).

import { parseToolbarBar, collectToolbarButtonsDeep, collectPanelBars } from './ordinary-toolbar.js';
//
// Формат form.data — это внутренняя текстовая сериализация 1С: дерево
// вложенных блоков `{...}`. Видимый элемент формы описывается массивом вида:
//   {ТИП-UUID, id, {контент}, {8,left,top,right,bottom,1,...}, {14,"Имя",...}, {0}}
// где блок {8,...} задаёт геометрию (координаты в пикселях), а блок {14,"Имя"}
// — имя элемента в конфигураторе. Тип элемента определяется по UUID.

// Известные UUID типов элементов обычной формы.
var ELEMENT_TYPES = {
  '0fc7e20d-f241-460c-bdf4-5ad88e5474a5': 'label',        // Надпись
  '381ed624-9217-4e63-85db-c4c3cb87daae': 'input',        // Поле ввода
  'e69bf21d-97b2-4f37-86db-675aea9ec2cb': 'commandPanel', // Командная панель
  '35af3d93-d7c7-4a2e-a8eb-bac87a1a3f26': 'checkbox',     // Флажок
  'ea83fe3a-ac3c-4cce-8045-3dddf35b28b1': 'table',        // Табличное поле
  '09ccdc77-ea1a-4a6d-ab1c-3435eada2433': 'group',        // Группа / страницы
  '90db814a-c75f-4b54-bc96-df62e554d67d': 'group',        // Рамка группы
  '36e52348-5d60-4770-8e89-a16ed50a2006': 'separator',    // Разделитель
  '151ef23e-6bb2-4681-83d0-35bc2217230c': 'picture',      // Поле картинки
  '6ff79819-710e-4145-97cd-1618da79e3e2': 'button',       // Кнопка
  '782e569a-79a7-4a4f-a936-b48d013936ec': 'radio',        // Переключатель
  '64483e7f-3833-48e2-8c75-2c31aac49f6e': 'radio',        // Переключатель
  'b1db1f86-abbb-4cf0-8852-fe6ae21650c2': 'indicator'     // Индикатор (шкала)
};

var TYPE_LABELS = {
  label: 'Надпись',
  input: 'Поле ввода',
  commandPanel: 'Командная панель',
  checkbox: 'Флажок',
  table: 'Табличное поле',
  group: 'Группа',
  separator: 'Разделитель',
  picture: 'Поле картинки',
  button: 'Кнопка',
  radio: 'Переключатель',
  indicator: 'Индикатор',
  unknown: 'Неизвестный элемент'
};

var UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
var INT_RE = /^-?\d+$/;

// --- Токенизатор -----------------------------------------------------------
// Возвращает дерево, где:
//   - список `{...}`  -> JS-массив,
//   - строка "..."    -> объект {s: '...'},
//   - атом (число/uuid/идентификатор) -> JS-строка.
function tokenize(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // удалить BOM
  var i = 0;
  var n = text.length;

  function skipWs() {
    while (i < n) {
      var ch = text[i];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') i++;
      else break;
    }
  }

  function parseString() {
    // i указывает на открывающую кавычку
    i++; // пропустить "
    var out = '';
    while (i < n) {
      var ch = text[i];
      if (ch === '"') {
        if (text[i + 1] === '"') { out += '"'; i += 2; continue; } // экранированная кавычка
        i++; // закрывающая кавычка
        break;
      }
      out += ch;
      i++;
    }
    return { s: out };
  }

  function parseAtom() {
    var start = i;
    while (i < n) {
      var ch = text[i];
      if (ch === ',' || ch === '{' || ch === '}' || ch === '"') break;
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') break;
      i++;
    }
    return text.slice(start, i);
  }

  function parseList() {
    i++; // пропустить {
    var items = [];
    while (i < n) {
      skipWs();
      var ch = text[i];
      if (ch === '}') { i++; break; }
      if (ch === ',') { i++; continue; }
      if (ch === '{') { items.push(parseList()); continue; }
      if (ch === '"') { items.push(parseString()); continue; }
      var atom = parseAtom();
      if (atom !== '') items.push(atom);
      else i++; // защита от зацикливания
    }
    return items;
  }

  skipWs();
  if (text[i] !== '{') {
    throw new Error('Файл не похож на form.data (ожидался блок «{» в начале).');
  }
  return parseList();
}

// --- Помощники обхода дерева -----------------------------------------------
function isList(node) { return Array.isArray(node); }
function isStr(node) { return node && typeof node === 'object' && typeof node.s === 'string'; }
function isAtom(node) { return typeof node === 'string'; }

// Геометрия: {8, l, t, r, b, 1, ...}
function asGeometry(node) {
  if (!isList(node) || node[0] !== '8') return null;
  if (node.length < 6) return null;
  for (var k = 1; k <= 4; k++) {
    if (!isAtom(node[k]) || !INT_RE.test(node[k])) return null;
  }
  // 6-й флаг: 1 — всегда на форме, 0 — условная видимость (Реализация, Собран и др.).
  if (node[5] !== '1' && node[5] !== '0') return null;
  var l = parseInt(node[1], 10);
  var t = parseInt(node[2], 10);
  var r = parseInt(node[3], 10);
  var b = parseInt(node[4], 10);
  // Индекс закладки контейнера хранится 5-м значением с конца блока геометрии.
  var pageIndex = null;
  var pi = node[node.length - 5];
  if (isAtom(pi) && INT_RE.test(pi)) pageIndex = parseInt(pi, 10);
  return {
    left: l,
    top: t,
    right: r,
    bottom: b,
    width: r - l,
    height: b - t,
    pageIndex: pageIndex,
    conditionalVisible: node[5] === '0'
  };
}

// Имя: {14, "Имя", ...}
function asName(node) {
  if (!isList(node) || node[0] !== '14') return null;
  if (!isStr(node[1])) return null;
  return node[1].s;
}

// Собрать все строки {"ru","..."} в поддереве (в порядке обхода).
function collectRu(node, out) {
  out = out || [];
  if (!isList(node)) return out;
  if (isStr(node[0]) && node[0].s === 'ru' && isStr(node[1])) {
    out.push(node[1].s);
  }
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) collectRu(node[k], out);
  }
  return out;
}

// Выбрать подпись из списка ru-строк: предпочитаем короткие (не подсказки).
function pickCaption(ruList) {
  if (!ruList || !ruList.length) return '';
  var short = ruList.filter(function (s) { return s.length <= 60; });
  return short.length ? short[0] : ruList[0];
}

// Флажок: две подписи в метаданных (0/1) — в форме показывается вторая.
function readCheckboxCaption(node) {
  var ru = collectRu(node);
  var short = ru.filter(function (s) { return s.length <= 60; });
  if (short.length >= 2) return short[short.length - 1];
  return pickCaption(ru);
}

var RADIO_NUMERIC_UUID = '782e569a-79a7-4a4f-a936-b48d013936ec';
var RADIO_ENUM_UUID = '64483e7f-3833-48e2-8c75-2c31aac49f6e';

function isRuTag(node) {
  return node === 'ru' || (isStr(node) && node.s === 'ru');
}

function ruFromBlock(block) {
  if (!isList(block)) return '';
  if (isStr(block[0]) && block[0].s === 'ru' && isStr(block[1])) return block[1].s;
  if (block[0] === '1' && isRuTag(block[1])) {
    if (isStr(block[2])) return block[2].s;
    if (isAtom(block[2])) return block[2];
  }
  return '';
}

// Подпись из блока стиля {1,1,{"ru","…"}} (inner[2] надписи/поля).
function readStyleBlockCaption(block) {
  if (!isList(block) || block[0] !== '1' || block[1] !== '1') return '';
  return ruFromBlock(block[2]) || ruFromBlock(block[3]);
}

function readLabelCaption(node) {
  var wrap3 = findType3Wrapper(node);
  if (!wrap3) return '';
  var inner = wrap3[1];
  if (!isList(inner) || inner.length < 3) return '';
  return readStyleBlockCaption(inner[2]);
}

// Обёртка стиля рамки: {0, {{16,1,…, {7,…}, underline}, fontSize, {1,1,{ru,…}}, {3,0,…}}}.
function findGroupStyleWrapper(node) {
  if (!isList(node)) return null;
  for (var k = 0; k < node.length; k++) {
    var ch = node[k];
    if (!isList(ch) || ch[0] !== '0' || !isList(ch[1])) continue;
    var inner = ch[1];
    if (isList(inner[0]) && inner[0][0] === '16' && inner[0][1] === '1') return inner;
  }
  return null;
}

// В {16,1,…}: {7,…,700,…},0|1 — жирный и подчёркивание заголовка рамки.
function readGroupHeaderFontFlags(header16) {
  var bold = false;
  var underline = false;
  if (!isList(header16)) return { bold: bold, underline: underline };
  for (var i = 0; i < header16.length; i++) {
    var block = header16[i];
    if (!isList(block) || block[0] !== '7') continue;
    bold = block.indexOf('700') >= 0;
    if (i + 1 < header16.length && isAtom(header16[i + 1])) {
      underline = header16[i + 1] === '1';
    }
    break;
  }
  return { bold: bold, underline: underline };
}

// Рамка группы: …, размер шрифта, {1,1,{ru,заголовок}}, {3,0,{0},left,top,0,стиль},0.
function readGroupCaptionStyle(node) {
  var style = { fontSize: 8, left: 8, top: 1, bold: false, underline: false };
  var wrapper = findGroupStyleWrapper(node);
  if (wrapper) {
    var flags = readGroupHeaderFontFlags(wrapper[0]);
    style.bold = flags.bold;
    style.underline = flags.underline;
    for (var i = 0; i < wrapper.length; i++) {
      var item = wrapper[i];
      if (!isList(item) || item[0] !== '1' || item[1] !== '1' || !readStyleBlockCaption(item)) continue;
      if (i > 0 && isAtom(wrapper[i - 1]) && INT_RE.test(wrapper[i - 1])) {
        style.fontSize = parseInt(wrapper[i - 1], 10);
      }
      if (i + 1 < wrapper.length) {
        var pos = wrapper[i + 1];
        if (isList(pos) && pos[0] === '3' && pos[1] === '0' && isList(pos[2]) &&
            pos[2][0] === '0' && isAtom(pos[3]) && isAtom(pos[4])) {
          style.left = parseInt(pos[3], 10) * 2;
          style.top = parseInt(pos[4], 10);
        }
      }
      return style;
    }
    return style;
  }
  function scan(list) {
    if (!isList(list)) return;
    for (var j = 0; j < list.length; j++) {
      var it = list[j];
      if (isList(it) && it[0] === '1' && it[1] === '1' && readStyleBlockCaption(it)) {
        if (j > 0 && isAtom(list[j - 1]) && INT_RE.test(list[j - 1])) {
          style.fontSize = parseInt(list[j - 1], 10);
        }
        if (j + 1 < list.length) {
          var p = list[j + 1];
          if (isList(p) && p[0] === '3' && p[1] === '0' && isList(p[2]) &&
              p[2][0] === '0' && isAtom(p[3]) && isAtom(p[4])) {
            style.left = parseInt(p[3], 10) * 2;
            style.top = parseInt(p[4], 10);
          }
        }
        return;
      }
      if (isList(it)) scan(it);
    }
  }
  scan(node);
  return style;
}

// Варианты переключателя со списком значений (64483e7f…): {1,N,{2,…,{ru,текст},…},…}.
function readEnumChoices(node) {
  var wrap2 = findType2Wrapper(node);
  if (!wrap2) return null;
  var found = null;
  function ruDeep(list) {
    if (!isList(list)) return '';
    var direct = ruFromBlock(list);
    if (direct) return direct;
    for (var i = 0; i < list.length; i++) {
      var t = ruDeep(list[i]);
      if (t) return t;
    }
    return '';
  }
  function tryChoices(list) {
    if (!isList(list) || list[0] !== '1' || !isAtom(list[1]) || !INT_RE.test(list[1])) return;
    var n = parseInt(list[1], 10);
    if (n < 1 || n > 64) return;
    if (!isList(list[2]) || list[2][0] !== '2') return;
    var items = [];
    for (var i = 0; i < n; i++) {
      var entry = list[2 + i];
      if (!isList(entry) || entry[0] !== '2' || entry[2] !== '2') return;
      var text = ruDeep(entry[4]) || ruDeep(entry);
      if (!text) return;
      items.push(text);
    }
    if (items.length === n) found = items;
  }
  function visit(list) {
    if (!isList(list)) return;
    tryChoices(list);
    for (var k = 0; k < list.length; k++) {
      if (isList(list[k])) visit(list[k]);
    }
  }
  visit(wrap2[1]);
  return found;
}

function isEventHandlerBlock(list) {
  return isList(list) && list[0] === '3' && !!columnAtomName(list[1]);
}

// ru-строки метаданных элемента до геометрии и обработчиков событий.
function collectRuBeforeEvents(node, out) {
  out = out || [];
  function visit(list) {
    if (!isList(list)) return;
    if (list[0] === '8' || list[0] === '14') return;
    if (isEventHandlerBlock(list)) return;
    if (isStr(list[0]) && list[0].s === 'ru' && isStr(list[1])) {
      out.push(list[1].s);
    }
    for (var i = 0; i < list.length; i++) {
      if (isList(list[i])) visit(list[i]);
    }
  }
  visit(node);
  return out;
}

// Числовая группа переключателей: {ru,«Вид доставки»} + {ru,«По адресу…»} — берём вариант.
function readRadioCaption(node, typeUuid) {
  var ru = collectRuBeforeEvents(node);
  ru = ru.filter(function (s) {
    return s !== 'Интерфейс' && !/^ДФ=/i.test(s) &&
      s !== 'Значение' && s !== 'Представление';
  });
  if (typeUuid === RADIO_NUMERIC_UUID && ru.length >= 2) {
    return ru[ru.length - 1];
  }
  return ru.length ? pickCaption(ru) : '';
}

function firstRu(node) {
  var r = collectRu(node);
  return r.length ? r[0] : '';
}

// Стандартный GUID командной панели (главного тулбара) 1С.
var MAIN_BAR_GUID = 'b78f2e80-ec68-11d4-9dcf-0050bae2bc79';

// Найти главный тулбар: {5, MAIN_BAR_GUID, 4, ...}. Группа с «55» — это
// контекстное меню, подменю — отдельные {5,...} с другими GUID.
function findMainBar(node) {
  if (!isList(node)) return null;
  if (node[0] === '5' && isAtom(node[1]) &&
      node[1].toLowerCase() === MAIN_BAR_GUID && node[2] === '4') {
    return node;
  }
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) {
      var r = findMainBar(node[k]);
      if (r) return r;
    }
  }
  return null;
}

// Кнопки видимого тулбара командной панели.
function readToolbarButtons(panelNode) {
  var bar = findMainBar(panelNode);
  if (!bar) return collectToolbarButtonsDeep(panelNode);
  var extraBars = collectPanelBars(panelNode);
  return parseToolbarBar(bar, extraBars);
}

// GUID панели команд табличного поля (кнопки над таблицей).
var TABLE_BAR_GUID = '9d0a2e40-b978-11d4-84b6-008048da06df';

// Подпись панели команд табличного поля: b78f2e80, 4, 9d0a2e40, …
function listHasTableBarFooter(list) {
  if (!isList(list) || list.length < 5) return false;
  for (var i = 0; i + 4 < list.length; i++) {
    if (isAtom(list[i]) && list[i].toLowerCase() === MAIN_BAR_GUID &&
        isAtom(list[i + 1]) && list[i + 1] === '4' &&
        isAtom(list[i + 2]) && list[i + 2].toLowerCase() === TABLE_BAR_GUID) {
      return true;
    }
  }
  return false;
}

function findBarInList(list) {
  var found = null;
  function scan(l) {
    if (!isList(l)) return;
    for (var k = 0; k < l.length; k++) {
      var item = l[k];
      if (isList(item) && item[0] === '5' && isAtom(item[1]) &&
          item[1].toLowerCase() === MAIN_BAR_GUID && item[2] === '4' && item[3] === '0') {
        found = item;
      }
      if (isList(item)) scan(item);
    }
  }
  scan(list);
  return found;
}

// Видимая панель {5, MAIN_BAR, 4, 0, …} внутри блока табличного поля.
function findTableVisibleBar(node) {
  var found = null;
  function visit(list) {
    if (!isList(list)) return;
    if (listHasTableBarFooter(list)) {
      var bar = findBarInList(list);
      if (bar) found = bar;
    }
    for (var j = 0; j < list.length; j++) {
      if (isList(list[j])) visit(list[j]);
    }
  }
  visit(node);
  return found;
}

function readTableToolbarFromBar(bar, panelNode) {
  var extraBars = panelNode ? collectPanelBars(panelNode) : [];
  return parseToolbarBar(bar, extraBars);
}

// Числа в form.data: десятичные, с плавающей точкой и экспонентой (3.5e2, 7e1).
function parseFormNumber(s) {
  if (!isAtom(s)) return null;
  if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(s) || /^-?\d*\.\d+([eE][+-]?\d+)?$/.test(s)) {
    var f = Number(s);
    return isFinite(f) ? Math.round(f) : null;
  }
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return null;
}

function columnAtomName(node) {
  if (isStr(node)) return node.s;
  if (isAtom(node) && !UUID_RE.test(node)) return node;
  return null;
}

// Дескриптор поля: …,1,0,<видимость>,4,0,"ИмяПоля",…
function parseColumnFieldInfo(list) {
  for (var j = 0; j < list.length - 5; j++) {
    if (list[j] === '1' && list[j + 1] === '0' &&
        (list[j + 2] === '0' || list[j + 2] === '1') &&
        list[j + 3] === '4' && (list[j + 4] === '0' || list[j + 4] === '2')) {
      var fname = columnAtomName(list[j + 5]);
      if (fname) {
        var visAtom = list[j + 2];
        // В журнале {16,…}: …,1,0,0,4,0 — ноль не означает «скрыта».
        var visible = visAtom === '1' ? true :
          (visAtom === '0' && list[0] !== '16' ? false : null);
        return { visible: visible, name: fname };
      }
    }
  }
  return null;
}

function patternAtom(v) {
  if (isStr(v)) return v.s;
  if (isAtom(v)) return v;
  return '';
}

function isPatternHeader(node) {
  return (isAtom(node) && node === 'Pattern') || (isStr(node) && node.s === 'Pattern');
}

function parseFieldPattern(list) {
  for (var i = 0; i < list.length; i++) {
    if (isList(list[i]) && isPatternHeader(list[i][0]) && isList(list[i][1]) && list[i][1].length) {
      var p = list[i][1];
      return {
        kind: patternAtom(p[0]),
        args: p.slice(1).map(patternAtom).filter(function (a) { return a !== ''; })
      };
    }
    if (isList(list[i])) {
      var nested = parseFieldPattern(list[i]);
      if (nested) return nested;
    }
  }
  return null;
}

var parseColumnPattern = parseFieldPattern;

// Расширения поля ввода в form.data (кнопки справа от текста).
// 9a7643d2… — календарь (дата) или калькулятор (число), по типу Pattern.
var INPUT_EXT_AUX = '9a7643d2-19e9-45e2-8893-280bc9195a97';
var INPUT_EXT_CALENDAR = INPUT_EXT_AUX;
var INPUT_EXT_CHOICE = '8585207b-9ca7-425b-9385-e8fd67c4e148';
var INPUT_EXT_OPEN = '11fe1b25-97c5-4d25-ab3f-8c9a5655122e';
var INPUT_EXT_LIST = '30ee7b7c-8dac-4e20-b58e-e7f7742ae8d8';

function findInputExtensionBlock(node, uuid) {
  var found = null;
  function visit(list) {
    if (!isList(list)) return;
    if (isAtom(list[0]) && list[0] === uuid) {
      found = list[1];
      return;
    }
    for (var i = 0; i < list.length; i++) {
      visit(list[i]);
      if (found) return;
    }
  }
  visit(node);
  return found;
}

function isDatePattern(pattern) {
  if (!pattern || !pattern.kind) return false;
  return pattern.kind === 'D' || pattern.kind.indexOf('D') === 0;
}

// Pattern {D,T} — только время (времяС / времяПо), без кнопки календаря.
function isTimePattern(pattern) {
  if (!pattern || pattern.kind !== 'D' || !pattern.args) return false;
  for (var i = 0; i < pattern.args.length; i++) {
    if (pattern.args[i] === 'T') return true;
  }
  return false;
}

function isCalendarPattern(pattern) {
  return isDatePattern(pattern) && !isTimePattern(pattern);
}

function isPricePattern(pattern) {
  if (!pattern || pattern.kind !== 'N' || !pattern.args || pattern.args.length < 2) return false;
  return pattern.args[0] === '15' && pattern.args[1] === '2';
}

function isNumericPattern(pattern) {
  if (!pattern || !pattern.kind) return false;
  return pattern.kind === 'N' || pattern.kind === 'F';
}

// Кнопка календаря/калькулятора: …,{1,0},0,1,…,16777215,… — вкл.; {1,0},0,0,… — выкл.
function readAuxButtonEnabled(node) {
  var enabled = null;
  function visit(list) {
    if (!isList(list)) return;
    for (var i = 0; i + 8 < list.length; i++) {
      // …,{0,0,0},{1,0},0,1,0,0,0,0,0,16777215,1 — калькулятор вкл.
      // …,{1,0},0,0,0,0,0,0,0,16777215,1 — выкл. (Скидка).
      if (isList(list[i]) && list[i][0] === '1' && list[i][1] === '0' &&
          list[i + 1] === '0' && (list[i + 2] === '0' || list[i + 2] === '1') &&
          list[i + 8] === '16777215') {
        enabled = list[i + 2] === '1';
      }
    }
    for (var j = 0; j < list.length; j++) {
      if (isList(list[j])) visit(list[j]);
    }
  }
  visit(node);
  return enabled;
}

// Календарь / калькулятор: блок 9a7643d2… + тип поля (D или N/F) + флаг включения.
function readAuxInputButtonKind(pattern, node) {
  var hasAux = !!findInputExtensionBlock(node, INPUT_EXT_AUX);
  var enabled = readAuxButtonEnabled(node);
  if (enabled === false) return null;
  if (isCalendarPattern(pattern) && (hasAux || enabled !== false)) {
    return 'calendar';
  }
  if (hasAux && isNumericPattern(pattern) && enabled === true) {
    return 'calculator';
  }
  if (!hasAux && isCalendarPattern(pattern)) return 'calendar';
  return null;
}

function applyAuxInputButton(buttons, pattern, node) {
  var aux = readAuxInputButtonKind(pattern, node);
  if (!aux) return buttons;
  var out = [];
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i] !== 'calendar' && buttons[i] !== 'calculator') out.push(buttons[i]);
  }
  if (out.indexOf(aux) < 0) out.unshift(aux);
  return out;
}

function readChoiceFlags(block) {
  if (!isList(block) || block[0] !== '5') return null;
  return {
    select: block[1] === '1',
    search: block[2] === '2'
  };
}

// Отдельная кнопка списка ▾: хвост блока {5,…,{1,1,…}} (Договор и аналоги).
function readChoiceListLink(block) {
  if (!isList(block) || block.length < 5) return false;
  var tail = block[4];
  return isList(tail) && tail[0] === '1' && tail[1] === '1';
}

function pushInputButton(buttons, kind) {
  if (buttons.indexOf(kind) < 0) buttons.push(kind);
}

// Составной тип: в Pattern несколько {"#",…} — кнопка «Т», не «…».
function countFieldRefTypes(node) {
  var count = 0;
  function visit(list) {
    if (!isList(list)) return;
    if (list.length >= 2 && isPatternHeader(list[0])) {
      for (var i = 1; i < list.length; i++) {
        var p = list[i];
        if (isList(p) && patternAtom(p[0]) === '#') count++;
      }
      return;
    }
    for (var j = 0; j < list.length; j++) visit(list[j]);
  }
  visit(node);
  return count;
}

function isChoiceStyleMode00(block) {
  return isList(block) && block[0] === '5' && block[1] === '0' && block[2] === '0';
}

// {5,0,0,…} при нескольких ссылочных типах — выбор типа (Т); иначе обычный выбор (…).
function choicePickerButtonKind(choiceBlock, node) {
  if (isChoiceStyleMode00(choiceBlock) && countFieldRefTypes(node) > 1) return 'type';
  return 'select';
}

// Флаги кнопок в блоке …,30,0,0,… или …,21,0,0,… после {16,1,…}/{10,1,…} в стиле поля.
// [3] — выбор, [4] — очистка; [6],[7]=1,1 — Т/выбор+поиск при {5,0,0}; [8],[9]=1,1 — поиск.
function readInputChoiceStyleFlags(node) {
  var flags = null;
  function isHandlerBranch(list) {
    if (!isList(list) || !list.length) return false;
    if (list[0] === '3' && isAtom(list[1]) && /^(фрм|При)/i.test(list[1])) return true;
    if (isAtom(list[0]) && list[0] === 'e1692cc2-605b-4535-84dd-28440238746c') return true;
    return false;
  }
  function isStyleFlagPrefix(list, i) {
    if (i + 2 >= list.length) return false;
    var a = list[i];
    var b = list[i + 1];
    var c = list[i + 2];
    return b === '0' && c === '0' && (a === '30' || a === '21');
  }
  function visit(list, skip) {
    if (!isList(list) || skip || flags) return;
    if (isHandlerBranch(list)) skip = true;
    for (var i = 0; i + 2 < list.length; i++) {
      if (isStyleFlagPrefix(list, i)) {
        var collected = [];
        for (var j = i + 3; j < list.length && collected.length < 16; j++) {
          var a = list[j];
          if (isAtom(a) && /^-?\d+$/.test(a)) collected.push(a);
          else break;
        }
        flags = collected;
        return;
      }
    }
    for (var k = 0; k < list.length; k++) {
      if (isList(list[k])) visit(list[k], skip);
      if (flags) return;
    }
  }
  visit(node, false);
  return flags;
}

// Обработчики НачалоВыбора / НачалоВыбораИзСписка / Открытие.
function readInputChoiceEvents(node) {
  var startChoice = false;
  var startChoiceFromList = false;
  var openForm = false;
  function visit(list) {
    if (!isList(list)) return;
    if (list[0] === '3') {
      var ev = columnAtomName(list[1]);
      if (ev) {
        if (/НачалоВыбораИзСписка/i.test(ev)) {
          startChoiceFromList = true;
        } else if (/НачалоВыбора/i.test(ev)) {
          startChoice = true;
        } else if (/фрмОткрытие/i.test(ev)) {
          openForm = true;
        }
      }
    }
    for (var i = 0; i < list.length; i++) visit(list[i]);
  }
  visit(node);
  return { startChoice: startChoice, startChoiceFromList: startChoiceFromList, openForm: openForm };
}

// Выпадающий список значений: {1,1,00000000-…}.
function readListDropdown(block) {
  return isList(block) && block[0] === '1' && block[1] === '1';
}

function parseColumnEditorRef(list) {
  var found = null;
  function visit(node) {
    if (!isList(node)) return;
    if (node[0] === '0' && isAtom(node[1]) && UUID_RE.test(node[1]) &&
        node[1] !== '00000000-0000-0000-0000-000000000000') {
      found = node[1];
    }
    for (var i = 0; i < node.length; i++) visit(node[i]);
  }
  visit(list);
  return found;
}

function findInputDateFormat(node) {
  var ru = collectRu(node);
  for (var i = 0; i < ru.length; i++) {
    var m = /^ДФ=(.+)$/i.exec(ru[i]);
    if (m) return m[1];
  }
  return null;
}

// Кнопка очистки (×): флаг [4] в 30/21,0,0, шаблон 1,0,1,0,1 или обработчик *Очистка.
function readInputClearEvent(node) {
  var found = false;
  function visit(list) {
    if (!isList(list) || found) return;
    if (list[0] === '3') {
      var ev = columnAtomName(list[1]);
      if (ev && /Очистка$/i.test(ev)) found = true;
    }
    for (var i = 0; i < list.length; i++) visit(list[i]);
  }
  visit(node);
  return found;
}

function readInputClearButton(node) {
  if (readInputClearEvent(node)) return true;
  var styleFlags = readInputChoiceStyleFlags(node);
  if (styleFlags && styleFlags[4] === '1') return true;
  function visit(list) {
    if (!isList(list)) return false;
    for (var i = 0; i + 7 < list.length; i++) {
      var a = list[i];
      if ((a === '30' || a === '21') && list[i + 1] === '0' && list[i + 2] === '0' &&
          list[i + 3] === '1' && list[i + 4] === '0' &&
          list[i + 5] === '1' && list[i + 6] === '0' && list[i + 7] === '1') {
        return true;
      }
    }
    for (var j = 0; j < list.length; j++) {
      if (visit(list[j])) return true;
    }
    return false;
  }
  return visit(node);
}

function appendInputClearButton(buttons, node) {
  if (!readInputClearButton(node)) return buttons;
  if (buttons.indexOf('clear') >= 0) return buttons;
  return buttons.concat(['clear']);
}

function isChoiceStyleMode02(block) {
  return isList(block) && block[0] === '5' && block[1] === '0' && block[2] === '2';
}

function hasInputOpenExtension(node) {
  var block = findInputExtensionBlock(node, INPUT_EXT_OPEN);
  if (!block) return false;
  if (isList(block) && block[0] === '3' && isAtom(block[1]) &&
      block[1] === '00000000-0000-0000-0000-000000000000') {
    return false;
  }
  return true;
}

function resolveInputButtons(pattern, choiceFlags, choiceBlock, hasChoiceExt, hasListExt, hasOpen, editorRef, choiceEvents, node) {
  var buttons = [];
  var styleFlags = readInputChoiceStyleFlags(node);

  // Блок 8585207b…: {5,кнопкаВыбора,кнопкаПоиска,…} + флаги 30,0,0 + обработчики.
  if (hasChoiceExt) {
    // {5,0,2}: кнопки из флагов 30,0,0 — [3] выбор, [4] очистка; block[2]=2 не «поиск».
    if (isChoiceStyleMode02(choiceBlock)) {
      if (styleFlags && styleFlags[3] === '1') pushInputButton(buttons, 'select');
      return applyAuxInputButton(buttons, pattern, node);
    }

    var hasListHandler = choiceEvents && choiceEvents.startChoiceFromList;
    var hasListLink = readChoiceListLink(choiceBlock);

    // {5,1,0} + НачалоВыбораИзСписка + {1,0} — выпадающий список (▾), не кнопка …
    if (choiceFlags && choiceFlags.select && !(hasListHandler && !hasListLink)) {
      pushInputButton(buttons, 'select');
    }
    if (choiceFlags && choiceFlags.search) pushInputButton(buttons, 'search');

    var styleListSearch = styleFlags && styleFlags[6] === '1' && styleFlags[7] === '1';
    if (choiceFlags && !choiceFlags.select && !choiceFlags.search && styleListSearch) {
      if (hasListHandler) {
        pushInputButton(buttons, 'list');
        pushInputButton(buttons, 'search');
      } else {
        pushInputButton(buttons, choicePickerButtonKind(choiceBlock, node));
        pushInputButton(buttons, 'search');
      }
    } else if (hasListHandler) {
      pushInputButton(buttons, 'list');
    }

    if (!buttons.length && choiceEvents && choiceEvents.startChoice) {
      pushInputButton(buttons, 'select');
    }
    return applyAuxInputButton(buttons, pattern, node);
  }

  // Расширение 30ee7b7c… — выпадающий список значений.
  if (hasListExt) {
    if (choiceEvents && choiceEvents.startChoiceFromList) {
      pushInputButton(buttons, 'select');
    } else {
      pushInputButton(buttons, 'list');
    }
    if (hasOpen) pushInputButton(buttons, 'select');
    return applyAuxInputButton(buttons, pattern, node);
  }

  if (hasOpen) {
    pushInputButton(buttons, 'select');
  }

  // НачалоВыбора без блока 8585207b… (перегрузАдрес, карта и аналоги).
  if (!hasChoiceExt && choiceEvents && choiceEvents.startChoice) {
    pushInputButton(buttons, 'select');
  }

  if (isCalendarPattern(pattern)) {
    return applyAuxInputButton(buttons, pattern, node);
  }

  if (buttons.length) return applyAuxInputButton(buttons, pattern, node);

  // Поиск без 8585207b…: флаги [8],[9] или обработчик фрмОткрытие (сумЭкспертиза).
  if ((styleFlags && styleFlags[8] === '1' && styleFlags[9] === '1') ||
      (choiceEvents && choiceEvents.openForm)) {
    pushInputButton(buttons, 'search');
    return applyAuxInputButton(buttons, pattern, node);
  }

  if (pattern && pattern.kind === '#') {
    if (findInputExtensionBlock(node, INPUT_EXT_OPEN)) {
      pushInputButton(buttons, 'search');
    } else {
      buttons.push('select', 'search');
    }
    return applyAuxInputButton(buttons, pattern, node);
  }

  if (isPricePattern(pattern)) {
    buttons.push('select');
    return applyAuxInputButton(buttons, pattern, node);
  }

  if (editorRef && isPricePattern(pattern)) {
    buttons.push('select');
  }

  return applyAuxInputButton(buttons, pattern, node);
}

function readInputStyle(node) {
  var pattern = parseFieldPattern(node);
  var choiceBlock = findInputExtensionBlock(node, INPUT_EXT_CHOICE);
  var choiceFlags = choiceBlock ? readChoiceFlags(choiceBlock) : null;
  var choiceEvents = readInputChoiceEvents(node);
  var listBlock = findInputExtensionBlock(node, INPUT_EXT_LIST);
  var hasListExt = readListDropdown(listBlock);
  var hasOpen = hasInputOpenExtension(node);
  var auxButton = readAuxInputButtonKind(pattern, node);
  var buttons = resolveInputButtons(pattern, choiceFlags, choiceBlock, !!choiceBlock, hasListExt, hasOpen, null, choiceEvents, node);
  return {
    pattern: pattern,
    buttons: appendInputClearButton(buttons, node),
    dateFormat: findInputDateFormat(node),
    auxButton: auxButton
  };
}

export function labelInputButton(kind) {
  var names = {
    calendar: 'Календарь',
    calculator: 'Калькулятор',
    select: 'Выбор',
    type: 'Выбор типа',
    search: 'Поиск',
    clear: 'Очистка',
    list: 'Выпадающий список'
  };
  return names[kind] || kind;
}

// Проверка согласованности кнопок с метаданными (для тестов).
export function collectInputButtonAuditIssues(form) {
  var issues = [];
  var flat = flattenTree(form.elements);
  for (var i = 0; i < flat.length; i++) {
    var el = flat[i];
    if (el.kind !== 'input') continue;
    var aux = el.inputStyle && el.inputStyle.auxButton;
    var btns = el.inputButtons || [];
    if (aux && btns.indexOf(aux) < 0) {
      issues.push(el.name + ': нет ' + aux);
    }
    if (el.inputStyle && el.inputStyle.pattern && isTimePattern(el.inputStyle.pattern) &&
        btns.indexOf('calendar') >= 0) {
      issues.push(el.name + ': календарь у поля времени');
    }
  }
  return issues;
}

function columnMetadataHasPicture(list) {
  if (!isList(list)) return false;
  if (list[0] === '4' && list[1] === '1' && isList(list[2]) && list[2][0] === '0') return true;
  for (var i = 0; i < list.length; i++) {
    if (isList(list[i]) && columnMetadataHasPicture(list[i])) return true;
  }
  return false;
}

export function labelColumnPattern(pattern) {
  if (!pattern || !pattern.kind) return '';
  var names = {
    S: 'Строка',
    N: 'Число',
    D: 'Дата',
    B: 'Булево',
    U: 'Уникальный идентификатор',
    F: 'Число'
  };
  var label = names[pattern.kind] || pattern.kind;
  if (pattern.kind === 'D' && isTimePattern(pattern)) {
    label = 'Время';
  }
  if (pattern.kind === 'S' && pattern.args && pattern.args[0] && INT_RE.test(pattern.args[0])) {
    label += ' (' + pattern.args[0] + ' симв.)';
  }
  if (pattern.kind === 'N' && pattern.args && pattern.args[0] && INT_RE.test(pattern.args[0])) {
    label += ' (разр. ' + pattern.args[0] + ')';
  }
  return label;
}

function isStyleHeaderBlock(block) {
  return isList(block) && block[0] === '1' && block[1] === '1';
}

function isStyleEmptyBlock(block) {
  return isList(block) && block[0] === '1' && block[1] === '0';
}

// Колонка таблицы: {19,…} (форма документа) или {16,…} (журнал/список).
function isColumnDefBlock(list) {
  if (!isList(list)) return false;
  if (list[0] === '19') return true;
  if (list[0] !== '16') return false;
  if (isStyleHeaderBlock(list[1])) return true;
  // Колонка-картинка: {16,{1,0},{1,0},{1,0},ширина,…}
  return isStyleEmptyBlock(list[1]) && isStyleEmptyBlock(list[2]) &&
    isStyleEmptyBlock(list[3]) && parseFormNumber(list[4]) != null;
}

// Текст заголовка колонки: {1,1,{ru,…}} — виден; {1,0} — только иконка/поле без подписи.
function readColumnHeaderTitleVisible(list) {
  if (!isColumnDefBlock(list)) return true;
  if (isStyleHeaderBlock(list[1]) && readStyleBlockCaption(list[1])) return true;
  if (isStyleEmptyBlock(list[1])) return false;
  return true;
}

function isPictureIconColumn(list) {
  if (!isList(list) || list[0] !== '16') return false;
  if (!isStyleEmptyBlock(list[1]) || !isStyleEmptyBlock(list[2]) || !isStyleEmptyBlock(list[3])) {
    return false;
  }
  var field = parseColumnFieldInfo(list);
  return !!(field && /^Картинка$/i.test(field.name));
}

// Заголовок list[1]; подвал — list[2] или list[3] (если list[2] пустой).
function readColumnTitleAndFooter(list) {
  var title = '';
  var footerText = '';
  if (!isColumnDefBlock(list)) return { title: title, footerText: footerText };

  if (isStyleHeaderBlock(list[1])) {
    title = readStyleBlockCaption(list[1]);
    if (isStyleHeaderBlock(list[2])) footerText = readStyleBlockCaption(list[2]);
    else if (isStyleEmptyBlock(list[2]) && isStyleHeaderBlock(list[3])) {
      footerText = readStyleBlockCaption(list[3]);
    }
  } else {
    title = firstRu(list);
  }
  return { title: title, footerText: footerText };
}

function readColumnWidthIndex(list) {
  var width = null;
  var colIndex = null;
  if (isStyleHeaderBlock(list[1])) {
    var w = parseFormNumber(list[4]);
    if (w != null) {
      width = w;
      if (isAtom(list[5]) && INT_RE.test(list[5])) colIndex = parseInt(list[5], 10);
    }
    if (width != null) return { width: width, colIndex: colIndex };
  }
  for (var i = 0; i + 3 < list.length; i++) {
    if (isStyleEmptyBlock(list[i]) && isStyleEmptyBlock(list[i + 1])) {
      var w2 = parseFormNumber(list[i + 2]);
      if (w2 != null) {
        width = w2;
        if (isAtom(list[i + 3]) && INT_RE.test(list[i + 3])) colIndex = parseInt(list[i + 3], 10);
      }
    }
  }
  return { width: width, colIndex: colIndex };
}

// Колонка таблицы: блок {19,…} или {16,…} — заголовок, подвал?, ширина, индекс, ….
function parseColumnBlock(list) {
  if (!isColumnDefBlock(list)) return null;
  var field = parseColumnFieldInfo(list);
  var tf = readColumnTitleAndFooter(list);
  var title = tf.title;
  if (!title && field && field.name) title = field.name;
  if (!title || title.length >= 80) return null;

  var wi = readColumnWidthIndex(list);
  var width = wi.width;
  var colIndex = wi.colIndex;

  var charWidth = null;
  for (var j = 0; j + 2 < list.length; j++) {
    if (isList(list[j]) && list[j].length === 0 && isAtom(list[j + 1]) && list[j + 2] === '0') {
      var cw = parseInt(list[j + 1], 10);
      if (!isNaN(cw)) charWidth = cw;
    }
  }

  if (width == null) return null;

  for (var k = 5; k < list.length; k++) {
    if (list[k - 5] === '0' && list[k - 4] === '0' && list[k - 3] === '0' &&
        list[k - 2] === '0' && list[k - 1] === '0') {
      var w2 = parseFormNumber(list[k]);
      if (w2 != null && w2 > 0) width = w2;
    }
  }

  var pattern = parseColumnPattern(list);
  var editorRef = parseColumnEditorRef(list);
  var choiceBlock = findInputExtensionBlock(list, INPUT_EXT_CHOICE);
  var choiceFlags = choiceBlock ? readChoiceFlags(choiceBlock) : null;
  var choiceEvents = readInputChoiceEvents(list);
  var listBlock = findInputExtensionBlock(list, INPUT_EXT_LIST);
  var hasListExt = readListDropdown(listBlock);
  var hasOpen = hasInputOpenExtension(list);
  var inputButtons = appendInputClearButton(
    resolveInputButtons(pattern, choiceFlags, choiceBlock, !!choiceBlock, hasListExt, hasOpen, editorRef, choiceEvents, list),
    list
  );

  return {
    title: title,
    footerText: tf.footerText || '',
    width: width,
    charWidth: charWidth,
    colIndex: colIndex,
    name: field ? field.name : null,
    visible: field ? field.visible : null,
    headerTitleVisible: readColumnHeaderTitleVisible(list),
    pattern: pattern,
    hasPicture: columnMetadataHasPicture(list) || isPictureIconColumn(list),
    editorRef: editorRef,
    inputButtons: inputButtons
  };
}

function findColumnIndex(cols, col) {
  if (!col) return null;
  for (var i = 0; i < cols.length; i++) {
    if (col.title && cols[i].title === col.title) return i;
  }
  if (col.name) {
    for (var j = 0; j < cols.length; j++) {
      if (cols[j].name === col.name) return j;
    }
  }
  if (col.colIndex != null) {
    for (var k = 0; k < cols.length; k++) {
      if (cols[k].colIndex === col.colIndex) return k;
    }
  }
  return null;
}

function mergeColumnInfo(existing, col) {
  if (col.name && !existing.name) existing.name = col.name;
  if (col.visible === false) existing.visible = false;
  else if (col.visible === true && existing.visible == null) existing.visible = true;
  if (col.pattern && !existing.pattern) existing.pattern = col.pattern;
  else if (col.pattern && existing.pattern && !existing.pattern.kind) existing.pattern = col.pattern;
  if (col.inputButtons && col.inputButtons.length && (!existing.inputButtons || !existing.inputButtons.length)) {
    existing.inputButtons = col.inputButtons;
  }
  if (col.editorRef && !existing.editorRef) existing.editorRef = col.editorRef;
  if (col.hasPicture) existing.hasPicture = true;
  if (col.headerTitleVisible === false) existing.headerTitleVisible = false;
  else if (col.headerTitleVisible === true && existing.headerTitleVisible == null) {
    existing.headerTitleVisible = true;
  }
  if (col.charWidth && !existing.charWidth) existing.charWidth = col.charWidth;
  if (col.colIndex != null && existing.colIndex == null) existing.colIndex = col.colIndex;
  if (col.footerText && !existing.footerText) existing.footerText = col.footerText;
  else if (col.footerText && existing.footerText && existing.footerText !== col.footerText) {
    existing.footerText = col.footerText;
  }
}

// Колонки таблицы из блоков {19,…} / {16,…} — порядок как в form.data (обход дерева).
function readTableColumns(node) {
  var cols = [];
  function visit(list) {
    if (!isList(list)) return;
    if (isColumnDefBlock(list)) {
      var col = parseColumnBlock(list);
      if (col) {
        var idx = findColumnIndex(cols, col);
        if (idx != null) {
          mergeColumnInfo(cols[idx], col);
        } else if (col.width != null) {
          cols.push(col);
        } else if (col.footerText) {
          // подвал без ширины — только слияние
        }
      }
    }
    for (var k = 0; k < list.length; k++) {
      if (isList(list[k])) visit(list[k]);
    }
  }
  visit(node);
  return cols;
}

// Стандартная картинка 1С в метаданных: {4,1,{0,uuid},…}.
function isStdPictureBlock(node) {
  return isList(node) && node[0] === '4' && node[1] === '1' && isList(node[2]) &&
    node[2][0] === '0' && isAtom(node[2][1]) && UUID_RE.test(node[2][1]);
}

function metadataHasStdPicture(meta, depth) {
  depth = depth || 0;
  if (!isList(meta) || depth > 16) return false;
  if (isStdPictureBlock(meta)) return true;
  for (var i = 0; i < meta.length; i++) {
    if (isList(meta[i]) && metadataHasStdPicture(meta[i], depth + 1)) return true;
  }
  return false;
}

function readElementStdPicture(node) {
  if (!isList(node) || node.length < 3) return false;
  return metadataHasStdPicture(node[2]);
}

// COLORREF из метаданных поля: 0x00BBGGRR (младший байт — R).
function color1cToCss(n) {
  n = parseInt(n, 10);
  if (!n) return null;
  var r = n & 0xFF;
  var g = (n >> 8) & 0xFF;
  var b = (n >> 16) & 0xFF;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Число 0xRRGGBB из таблицы стилей (-16 → 16711680).
function colorRgbWordToCss(n) {
  n = parseInt(n, 10);
  if (!n) return null;
  var r = (n >> 16) & 0xFF;
  var g = (n >> 8) & 0xFF;
  var b = n & 0xFF;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function findAllFont7Blocks(node, out) {
  out = out || [];
  if (!isList(node)) return out;
  if (node[0] === '7') out.push(node);
  for (var i = 0; i < node.length; i++) {
    if (isList(node[i])) findAllFont7Blocks(node[i], out);
  }
  return out;
}

function parseFontBlock7(list) {
  if (!isList(list) || list[0] !== '7') return null;
  var boldEarly = list.indexOf('700') >= 0;
  if (list.length <= 8 && isAtom(list[1]) && INT_RE.test(list[1]) && list[1] !== '0') {
    return {
      styleRef: parseInt(list[1], 10),
      default: true,
      bold: boldEarly,
      italic: false,
      color: null,
      fontFace: null
    };
  }
  var fontFace = null;
  for (var i = 0; i < list.length; i++) {
    if (isStr(list[i]) && list[i].s.indexOf(' ') >= 0) fontFace = list[i].s;
  }
  var bold = list.indexOf('700') >= 0;
  var idx700 = list.indexOf('700');
  var italic = idx700 >= 0 && list[idx700 + 4] === '2';
  // После 700: Color, …, CharSet (204 = CP1251, не цвет текста).
  var color = null;
  if (idx700 >= 0 && idx700 + 1 < list.length) {
    var colorAtom = list[idx700 + 1];
    if (isAtom(colorAtom) && INT_RE.test(colorAtom)) {
      var cv = parseInt(colorAtom, 10);
      if (cv > 255 && cv < 16777216) color = color1cToCss(cv);
    }
  }
  return { fontFace: fontFace, bold: bold, italic: italic, color: color, default: false };
}

function pickBestFontBlock(blocks) {
  var best = null;
  var bestLen = 0;
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].length > bestLen) {
      bestLen = blocks[i].length;
      best = parseFontBlock7(blocks[i]);
    }
  }
  return best;
}

function findGeomBlockDeep(node) {
  if (!isList(node)) return null;
  if (node[0] === '8' && asGeometry(node)) return node;
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k])) {
      var g = findGeomBlockDeep(node[k]);
      if (g) return g;
    }
  }
  return null;
}

// Цвет текста из хвоста блока {8,…}: …, R, G, B, 0, 0.
function parseGeomLabelColor(geom) {
  if (!isList(geom)) return null;
  var nums = [];
  for (var i = geom.length - 1; i >= 0; i--) {
    if (isAtom(geom[i]) && INT_RE.test(geom[i])) nums.unshift(parseInt(geom[i], 10));
    else if (nums.length >= 4) break;
  }
  if (nums.length < 4) return null;
  var n = nums.length;
  var r = nums[n - 4];
  var g = nums[n - 3];
  var b = nums[n - 2];
  if (r > 255 || g > 255 || b > 255) return null;
  if (r <= 8 && g <= 8 && b === 0) return null;
  if (b === 0 && r > 0 && g > 0 && r === g) return 'rgb(' + r + ',' + r + ',' + r + ')';
  if (r || g || b) return 'rgb(' + r + ',' + g + ',' + b + ')';
  return null;
}

function findType3Wrapper(node) {
  if (!isList(node)) return null;
  for (var k = 0; k < node.length; k++) {
    if (isList(node[k]) && node[k][0] === '3' && isList(node[k][1])) return node[k];
  }
  return null;
}

function findType2Wrapper(node) {
  if (!isList(node)) return null;
  for (var k = 0; k < node.length; k++) {
    if (!isList(node[k]) || node[k][0] !== '2' || !isList(node[k][1])) continue;
    var head = node[k][1][0];
    if (isList(head) && (head[0] === '16' || head[0] === '10')) return node[k];
  }
  return null;
}

// Служебные ссылки стиля в {16,1,…}, не цвет текста.
var LABEL_LAYOUT_STYLE_REFS = { '-2': 1, '-3': 1, '-7': 1, '-21': 1, '-22': 1 };

// Цвет текста из {3,3,{-N}} в заголовке надписи (BGR-число).
var LABEL_STYLE_COLOR_BGR = {
  '-16': 16711680,
  '-14': 204
};

function findExplicitBgrColor(node) {
  var color = null;
  function visit(list) {
    if (!isList(list)) return;
    if (list[0] === '3' && list[1] === '0' && isList(list[2]) && list[2].length >= 1) {
      var n = list[2][0];
      if (isAtom(n) && INT_RE.test(n)) {
        var v = parseInt(n, 10);
        if (v > 255) color = color1cToCss(v);
      }
    }
    for (var i = 0; i < list.length; i++) {
      if (isList(list[i])) visit(list[i]);
    }
  }
  visit(node);
  return color;
}

function findLabelHeader16(node) {
  var wrap3 = findType3Wrapper(node);
  if (!wrap3) return null;
  function visit(list) {
    if (!isList(list)) return null;
    if (list[0] === '16' && list[1] === '1') return list;
    for (var i = 0; i < list.length; i++) {
      var found = visit(list[i]);
      if (found) return found;
    }
    return null;
  }
  return visit(wrap3[1]);
}

// В {16,1,…}: первый {3,0,{BGR}} — фон; следующие {3,0,{BGR}} — цвет текста (нАкции).
function readLabelHeaderBgrColors(header16) {
  var backColor = null;
  var textColor = null;
  if (!isList(header16)) return { backColor: backColor, textColor: textColor };
  for (var i = 2; i < header16.length; i++) {
    var block = header16[i];
    if (!isList(block) || block[0] !== '3' || block[1] !== '0' || !isList(block[2])) continue;
    var n = block[2][0];
    if (!isAtom(n) || !INT_RE.test(n)) continue;
    var v = parseInt(n, 10);
    if (v <= 255) continue;
    var css = color1cToCss(v);
    if (i === 2 && backColor == null) {
      backColor = css;
    } else if (textColor == null) {
      textColor = css;
    }
  }
  return { backColor: backColor, textColor: textColor };
}

function findLabelStyleColorRef(node) {
  var ref = null;
  function visit(list) {
    if (!isList(list) || ref != null) return;
    if (list[0] === '3' && list[1] === '3' && isList(list[2]) && list[2].length >= 1) {
      var n = list[2][0];
      if (isAtom(n) && /^-\d+$/.test(n) && !LABEL_LAYOUT_STYLE_REFS[n]) ref = parseInt(n, 10);
    }
    for (var i = 0; i < list.length; i++) {
      if (isList(list[i])) visit(list[i]);
    }
  }
  visit(node);
  return ref;
}

function labelStyleColorFromRef(ref) {
  if (ref == null) return null;
  var rgb = LABEL_STYLE_COLOR_BGR[String(ref)];
  if (rgb == null) return null;
  return colorRgbWordToCss(rgb);
}

function findPositionGeomBlock(node) {
  if (!isList(node)) return null;
  for (var k = 0; k < node.length; k++) {
    var child = node[k];
    if (!isList(child) || child[0] !== '8') continue;
    var g = asGeometry(child);
    if (g && g.width > 0 && g.height > 0) return child;
  }
  return null;
}

// Явный RGB текста в inner[8]: {0,0,0} — чёрный по умолчанию (не цвет из геометрии).
function readLabelInnerTextColor(inner) {
  if (!isList(inner) || inner.length < 9) return { found: false, color: null };
  var block = inner[8];
  if (!isList(block) || block.length < 3) return { found: false, color: null };
  var r = block[0];
  var g = block[1];
  var b = block[2];
  if (!isAtom(r) || !isAtom(g) || !isAtom(b)) return { found: false, color: null };
  if (!INT_RE.test(r) || !INT_RE.test(g) || !INT_RE.test(b)) return { found: false, color: null };
  var rv = parseInt(r, 10);
  var gv = parseInt(g, 10);
  var bv = parseInt(b, 10);
  if (rv > 255 || gv > 255 || bv > 255) return { found: false, color: null };
  return { found: true, color: (rv || gv || bv) ? ('rgb(' + rv + ',' + gv + ',' + bv + ')') : null };
}

// Стили надписи: блок {3,{ {16,1,…}, размер, {1,ru|0}, гориз., верт., …}, {8,…}, {14,…} }.
function readLabelStyle(node) {
  var wrap3 = findType3Wrapper(node);
  if (!wrap3) return null;
  var inner = wrap3[1];
  if (!isList(inner) || inner.length < 5) return null;

  var fontSize = isAtom(inner[1]) && INT_RE.test(inner[1]) ? parseInt(inner[1], 10) : null;
  var horz = isAtom(inner[3]) && INT_RE.test(inner[3]) ? parseInt(inner[3], 10) : 0;
  var vert = isAtom(inner[4]) && INT_RE.test(inner[4]) ? parseInt(inner[4], 10) : 0;
  var underline = inner[5] === '1';
  var strike = inner[6] === '1';
  var hyperLink = inner[7] === '1';
  var dynamicCaption = isList(inner[2]) && inner[2][0] === '1' && inner[2][1] === '0';

  var fonts = findAllFont7Blocks(node, []);
  var font = pickBestFontBlock(fonts);
  var headerBgr = readLabelHeaderBgrColors(findLabelHeader16(node));
  var styleRef = findLabelStyleColorRef(node);
  var styleRefColor = labelStyleColorFromRef(styleRef);
  var innerRgb = readLabelInnerTextColor(inner);
  // Цвет текста: BGR в заголовке → ссылка стиля (-14/-16) → inner RGB → шрифт → геометрия.
  // {0,0,0} в inner блокирует геометрию, если выше нет явного цвета (нСостояние — исключение: есть фон).
  var blockGeom = innerRgb.found && !headerBgr.backColor && styleRefColor == null;
  var posGeom = findPositionGeomBlock(node);
  var geomColor = !blockGeom && posGeom ? parseGeomLabelColor(posGeom) : null;

  return {
    fontSize: fontSize,
    horzAlign: horz,
    vertAlign: vert,
    underline: underline,
    strike: strike,
    hyperLink: hyperLink,
    font: font,
    backColor: headerBgr.backColor,
    textColor: headerBgr.textColor || styleRefColor || innerRgb.color ||
      (font && font.color) || geomColor || null,
    dynamicCaption: dynamicCaption
  };
}

export function labelHorzAlignName(code) {
  return ['Слева', 'По центру', 'Справа', 'По ширине'][code] || ('код ' + code);
}

export function labelVertAlignName(code) {
  return ['Сверху', 'По центру', 'Снизу'][code] || ('код ' + code);
}

function findType1Wrapper(node) {
  if (!isList(node)) return null;
  for (var k = 0; k < node.length; k++) {
    if (!isList(node[k]) || node[k][0] !== '1' || !isList(node[k][1])) continue;
    var inner = node[k][1];
    if (inner.length < 5) continue;
    // Блок стиля кнопки начинается с {16,1,…} или {10,1,…}, не с обработчика {0,guid,…}.
    var head = inner[0];
    if (isList(head) && (head[0] === '16' || head[0] === '10')) return node[k];
  }
  return null;
}

function parseButtonBackColor(node) {
  return findExplicitBgrColor(node);
}

function hasButtonDropdownMenu(node) {
  var found = false;
  function visit(list, depth) {
    if (!isList(list) || depth > 24) return;
    if (list[0] === '5' && isAtom(list[1]) && UUID_RE.test(list[1])) found = true;
    for (var i = 0; i < list.length; i++) {
      if (isList(list[i])) visit(list[i], depth + 1);
    }
  }
  visit(node, 0);
  return found;
}

// Стили кнопки: блок {1,{ {16,1,…}, размер, {1,ru}, …, {5,…меню}}, {8,…}, {14,…} }.
function readButtonStyle(node) {
  var wrap1 = findType1Wrapper(node);
  if (!wrap1) return null;
  var inner = wrap1[1];
  if (!isList(inner) || inner.length < 5) return null;

  var fontSize = isAtom(inner[1]) && INT_RE.test(inner[1]) ? parseInt(inner[1], 10) : null;
  var horz = isAtom(inner[3]) && INT_RE.test(inner[3]) ? parseInt(inner[3], 10) : 0;
  var vert = isAtom(inner[4]) && INT_RE.test(inner[4]) ? parseInt(inner[4], 10) : 0;

  var fonts = findAllFont7Blocks(node, []);
  var font = pickBestFontBlock(fonts);
  var geom = findGeomBlockDeep(node);
  var geomColor = geom ? parseGeomLabelColor(geom) : null;

  return {
    fontSize: fontSize,
    horzAlign: horz,
    vertAlign: vert,
    font: font,
    textColor: geomColor || (font && font.color) || null,
    backColor: parseButtonBackColor(node),
    dropdown: hasButtonDropdownMenu(node)
  };
}

// Одна страница панели: {3|5, {ru,...}, …, -1, V, 1, "имя", 1}.
// V=1 — видимая закладка, V=0 — скрытая (элементы ссылаются на неё по физическому индексу).
function parsePageEntry(pageNode) {
  if (!isList(pageNode) || (pageNode[0] !== '3' && pageNode[0] !== '5')) return null;
  var title = firstRu(pageNode[1]);
  if (!title) return null;
  var visible = false;
  for (var i = 2; i + 4 < pageNode.length; i++) {
    if (pageNode[i] === '-1' && pageNode[i + 2] === '1' && isStr(pageNode[i + 3]) && pageNode[i + 4] === '1') {
      visible = pageNode[i + 1] === '1';
      break;
    }
  }
  var hasPicture = pageNode[0] === '5' && isList(pageNode[2]) &&
    pageNode[2][0] === '8' && metadataHasStdPicture(pageNode[2]);
  return { title: title, visible: visible, hasPicture: hasPicture };
}

// Блок {1, N, page0, page1, …} — полный список страниц панели (включая скрытые).
function tryParsePageListBlock(list) {
  if (!isList(list) || list[0] !== '1' || !isAtom(list[1]) || !INT_RE.test(list[1])) return null;
  var n = parseInt(list[1], 10);
  if (n < 1 || n > 100) return null;
  var entries = [];
  for (var i = 2; i < list.length && entries.length < n; i++) {
    if (isList(list[i]) && (list[i][0] === '3' || list[i][0] === '5')) {
      var pe = parsePageEntry(list[i]);
      if (pe) entries.push(pe);
    }
  }
  if (entries.length !== n) return null;
  var titles = [];
  var pageHidden = [];
  var pagePictures = [];
  for (var p = 0; p < entries.length; p++) {
    titles.push(entries[p].title);
    pageHidden.push(!entries[p].visible);
    pagePictures.push(!!entries[p].hasPicture);
  }
  return { pages: titles, pageHidden: pageHidden, pagePictures: pagePictures, physicalCount: n };
}

// Ищем список страниц только в метаданных элемента (до блоков {8,…} и {14,…}),
// чтобы не подхватить вложенные панели (напр. «Страница1» внутри пСклад2).
function findTabPanelInMetadata(node) {
  function visit(list) {
    if (!isList(list)) return null;
    var direct = tryParsePageListBlock(list);
    if (direct) return direct;
    for (var k = 0; k < list.length; k++) {
      if (isList(list[k])) {
        var found = visit(list[k]);
        if (found) return found;
      }
    }
    return null;
  }
  for (var k = 0; k < node.length; k++) {
    var child = node[k];
    if (isList(child) && (child[0] === '8' || child[0] === '14')) break;
    var found = visit(child);
    if (found) return found;
  }
  return null;
}

// Высота полосы закладок панели страниц.
// В form.data перед блоком {1,N,…страницы…} часто идёт пара N, H (число страниц, высота заголовка).
// Пример ФормаЭлемента: …,21,20,…,{1,21,{страницы}}
export var DEFAULT_TAB_STRIP_H = 19;

// Единственная закладка «Страница1» — дефолт 1С; полосу вкладок не показывают.
function isDefaultSinglePage(pages) {
  return pages && pages.length === 1 && pages[0] === 'Страница1';
}

function extractTabStripHeight(node, pageCount) {
  var height = null;

  function visit(list, parent, idx) {
    if (!isList(list)) return;
    if (isAtom(list[0]) && list[0] === '1' && isAtom(list[1]) &&
        INT_RE.test(list[1]) && parseInt(list[1], 10) === pageCount) {
      var parsed = tryParsePageListBlock(list);
      if (parsed && parsed.physicalCount === pageCount && parent && idx > 0) {
        for (var j = idx - 1; j >= 1; j--) {
          if (isAtom(parent[j]) && isAtom(parent[j - 1]) &&
              INT_RE.test(parent[j - 1]) && INT_RE.test(parent[j]) &&
              parseInt(parent[j - 1], 10) === pageCount) {
            var h = parseInt(parent[j], 10);
            if (h >= 15 && h <= 40) { height = h; return; }
          }
        }
      }
    }
    for (var k = 0; k < list.length; k++) {
      if (isList(list[k])) visit(list[k], list, k);
      if (height !== null) return;
    }
  }

  visit(node, null, -1);
  return height !== null ? height : DEFAULT_TAB_STRIP_H;
}

// --- Извлечение элементов (дерево вложенности) ------------------------------
// Элемент — массив, у которого среди прямых потомков есть и блок имени {14,..},
// и блок геометрии {8,l,t,r,b,1,..}. Первый потомок-атом — UUID типа.
// Координаты вложенных элементов задаются ОТНОСИТЕЛЬНО контейнера, поэтому
// важно сохранить иерархию, а не плоский список.
function elementInfo(node) {
  if (!isList(node)) return null;
  var geom = null;
  var name = null;
  for (var k = 0; k < node.length; k++) {
    if (geom === null) { var g = asGeometry(node[k]); if (g) geom = g; }
    if (name === null) { var nm = asName(node[k]); if (nm !== null) name = nm; }
  }
  if (!geom || name === null) return null;
  var typeUuid = (isAtom(node[0]) && UUID_RE.test(node[0])) ? node[0] : null;
  var kind = (typeUuid && ELEMENT_TYPES[typeUuid]) || 'unknown';
  return { kind: kind, typeUuid: typeUuid, name: name, geom: geom };
}

function buildTree(node) {
  var results = [];
  if (!isList(node)) return results;
  for (var k = 0; k < node.length; k++) {
    var child = node[k];
    if (!isList(child)) continue;
    var info = elementInfo(child);
    if (info) {
      var el = {
        kind: info.kind,
        typeName: TYPE_LABELS[info.kind] || TYPE_LABELS.unknown,
        typeUuid: info.typeUuid,
        name: info.name,
        geom: info.geom,
        caption: '',
        buttons: null,
        pages: null,
        pageHidden: null,
        pagePictures: null,
        isTabControl: false,
        tabStripH: null,
        children: buildTree(child)
      };
      if (info.geom.conditionalVisible) el.conditionalVisible = true;
      finalizeElement(el, child);
      results.push(el);
    } else {
      var sub = buildTree(child);
      if (sub.length) results.push.apply(results, sub);
    }
  }
  return results;
}

function finalizeElement(el, node) {
  var hasKids = el.children && el.children.length > 0;

  if (el.kind === 'commandPanel') {
    var tblBar = findTableVisibleBar(node);
    if (tblBar) {
      el.isTableToolbar = true;
      el.buttons = readTableToolbarFromBar(tblBar, node);
    } else {
      el.buttons = readToolbarButtons(node);
    }
    return;
  }

  if (el.kind === 'group') {
    if (hasKids) {
      var tabInfo = findTabPanelInMetadata(node);
      if (tabInfo) {
        el.isTabControl = true;
        el.pages = tabInfo.pages;
        el.pageHidden = tabInfo.pageHidden;
        el.pagePictures = tabInfo.pagePictures;
        el.hideTabStrip = isDefaultSinglePage(tabInfo.pages);
        el.tabStripH = el.hideTabStrip ? 0 : extractTabStripHeight(node, tabInfo.physicalCount);
      }
      el.caption = ''; // контейнер; подпись на рамке не нужна
    } else {
      el.caption = pickCaption(collectRu(node));
      el.groupCaptionStyle = readGroupCaptionStyle(node);
    }
    return;
  }

  if (el.kind === 'table') {
    var embeddedBar = findTableVisibleBar(node);
    el.tableButtons = embeddedBar ? readTableToolbarFromBar(embeddedBar, node) : [];
    el.columns = readTableColumns(node);
    return;
  }

  if (el.kind === 'button') {
    el.hasPicture = readElementStdPicture(node);
    el.buttonStyle = readButtonStyle(node);
  }

  if (el.kind === 'label') {
    el.caption = readLabelCaption(node) || pickCaption(collectRu(node));
    el.labelStyle = readLabelStyle(node);
    if (!el.caption) {
      if (/^надписьВес$/i.test(el.name)) el.caption = 'Вес: 0';
      else if (/^надписьОбъем$/i.test(el.name)) el.caption = 'Объем: 0';
    }
    return;
  }

  if (el.kind === 'input') {
    var inputStyle = readInputStyle(node);
    el.inputStyle = inputStyle;
    el.inputButtons = inputStyle.buttons;
    return;
  }

  if (el.kind === 'radio') {
    if (el.typeUuid === RADIO_ENUM_UUID) {
      el.enumChoices = readEnumChoices(node);
      el.previewValue = el.enumChoices && el.enumChoices.length ? el.enumChoices[0] : '';
      el.caption = el.previewValue;
    } else {
      el.caption = readRadioCaption(node, el.typeUuid);
    }
    return;
  }

  if (el.kind === 'checkbox') {
    el.caption = readCheckboxCaption(node);
    return;
  }

  if (el.kind === 'button' || el.kind === 'unknown') {
    el.caption = pickCaption(collectRu(node));
  }
  // Для picture/separator подпись из данных не показываем.
}

function flattenTree(elements, out) {
  out = out || [];
  for (var i = 0; i < elements.length; i++) {
    out.push(elements[i]);
    if (elements[i].children && elements[i].children.length) {
      flattenTree(elements[i].children, out);
    }
  }
  return out;
}

// нСостояние + кнСостояние на одних координатах: в 1С надпись под кнопкой, в превью — только кнопка.
function applyOverlayLabelButtons(elements) {
  var flat = flattenTree(elements);
  var byName = {};
  for (var i = 0; i < flat.length; i++) byName[flat[i].name] = flat[i];
  for (var j = 0; j < flat.length; j++) {
    var el = flat[j];
    if (el.kind !== 'label' || !el.geom) continue;
    var m = /^н(.+)$/i.exec(el.name || '');
    if (!m) continue;
    var btn = byName['кн' + m[1]];
    if (!btn || btn.kind !== 'button' || !btn.geom) continue;
    if (Math.abs(el.geom.left - btn.geom.left) > 4) continue;
    if (Math.abs(el.geom.top - btn.geom.top) > 4) continue;
    if (Math.abs(el.geom.height - btn.geom.height) > 6) continue;
    el.overlayHidden = true;
    el.overlayHiddenBy = btn.name;
  }
}

// --- Главная функция -------------------------------------------------------
export function parseOrdinaryForm(text) {
  var root = tokenize(text);

  var allRu = collectRu(root);
  var title = allRu.length ? allRu[0] : '';

  var elements = buildTree(root);
  applyOverlayLabelButtons(elements);
  var flat = flattenTree(elements);

  // Размер холста — по максимальным координатам элементов ВЕРХНЕГО уровня
  // (вложенные имеют относительные координаты).
  var maxRight = 0;
  var maxBottom = 0;
  for (var i = 0; i < elements.length; i++) {
    var g = elements[i].geom;
    if (g.right > maxRight) maxRight = g.right;
    if (g.bottom > maxBottom) maxBottom = g.bottom;
  }
  if (maxRight <= 0) maxRight = 400;
  if (maxBottom <= 0) maxBottom = 200;

  // Список нераспознанных типов (для предупреждения).
  var unknownTypes = {};
  for (var u = 0; u < flat.length; u++) {
    if (flat[u].kind === 'unknown') {
      var key = flat[u].typeUuid || 'без UUID';
      unknownTypes[key] = (unknownTypes[key] || 0) + 1;
    }
  }

  return {
    title: title,
    elements: elements,
    flat: flat,
    count: flat.length,
    width: maxRight,
    height: maxBottom,
    unknownTypes: unknownTypes
  };
}

export { ELEMENT_TYPES, TYPE_LABELS };
