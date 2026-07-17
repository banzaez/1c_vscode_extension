// Рендер обычной формы 1С в HTML.
// Элементы позиционируются абсолютно; вложенные элементы контейнеров
// (страницы/закладки, группы) смещаются по координатам родителя.
// Принадлежность элемента к закладке берётся из geom.pageIndex.

import {
  DEFAULT_TAB_STRIP_H,
  labelColumnPattern,
  labelHorzAlignName,
  labelInputButton,
  labelVertAlignName
} from './ordinary-parser.js';
import {
  labelButtonKind,
  labelButtonDisplay,
  labelButtonSizeType,
  labelButtonPresentation
} from './ordinary-toolbar.js';
import { propsLinesWithSections } from './ordinary-tooltip.js';
var GROUP_PAD = 2;

function groupCaptionHtml(el) {
  if (!el.caption) return '';
  var s = el.groupCaptionStyle || {};
  // Позиция и оформление — из метаданных; размер шрифта — как у надписей (в form.data «8» ≠ 8px).
  var parts = [
    'left:' + (s.left != null ? s.left : 8) + 'px',
    'top:' + (s.top != null ? s.top : 1) + 'px',
    'text-decoration:' + (s.underline ? 'underline' : 'none')
  ];
  if (s.bold) parts.push('font-weight:bold');
  return '<span class="of-group-cap" style="' + parts.join(';') + '">' + esc(el.caption) + '</span>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function boxStyle(rect) {
  return 'left:' + rect.left + 'px;top:' + rect.top + 'px;width:' +
    Math.max(rect.w, 1) + 'px;height:' + Math.max(rect.h, 1) + 'px;';
}

function stripAmp(s) {
  return String(s == null ? '' : s).replace(/&/g, '');
}

// Заглушка вместо стандартных картинок 1С — одинаковый кружок.
function icoDotHtml(extraCls) {
  return '<span class="of-ico-dot' + (extraCls ? ' ' + extraCls : '') + '"></span>';
}

function toolbarIconClass() {
  return 'of-ico-dot';
}

function buttonPropsLines(btn) {
  var cap = stripAmp(btn.caption).trim();
  var main = ['Кнопка командной панели'];
  if (btn.name) main.push('Имя: ' + btn.name);
  if (cap) main.push('Подпись: ' + cap);
  if (btn.hasPicture) main.push('Стандартная картинка 1С: да');

  var display = [];
  if (btn.presentation) {
    display.push('Вид в превью: ' + labelButtonPresentation(btn.presentation));
  }
  if (btn.kind != null) display.push('Тип: ' + labelButtonKind(btn.kind));
  if (btn.display != null) display.push('Режим отображения: ' + labelButtonDisplay(btn.display));
  if (btn.sizeType) {
    display.push('Размер / стиль: ' + labelButtonSizeType(btn.sizeType, btn.widthHint));
  }

  var command = [];
  if (btn.cmdId != null) command.push('ID команды: ' + btn.cmdId);
  if (btn.commandLinked) command.push('Привязана к команде формы: да');
  if (btn.children && btn.children.length) {
    command.push('Пунктов меню: ' + btn.children.length);
  }

  var state = [];
  if (btn.contextual) state.push('Видимость: условная (в 1С)');
  if (btn.active) state.push('Нажата / активна: да');
  if (btn.enabled === false) state.push('Доступна: нет');

  return propsLinesWithSections([
    { title: '', lines: main },
    { title: 'Отображение', lines: display },
    { title: 'Команда', lines: command },
    { title: 'Состояние', lines: state }
  ]);
}

function tipAttrs(btn) {
  return propsAttrFromLines(buttonPropsLines(btn));
}

function toolbarBtnClasses(btn, base, context) {
  var cls = base;
  if (btn.sizeType && btn.sizeType <= 7) cls += ' of-tbl-btn-sz-' + btn.sizeType;
  if (btn.enabled === false) cls += ' of-tbl-btn-off';
  if (btn.contextual) cls += ' of-tbl-btn-ctx' + (context === 'main' ? ' of-cmd-btn-ctx' : '');
  if (btn.active) cls += ' of-tbl-btn-active';
  // Кружок только на чистой иконке; у iconText точка внутри .of-tbl-btn-ico-mini.
  if (btn.presentation === 'icon') {
    cls += ' ' + toolbarIconClass(btn);
  }
  if (context === 'main' && (btn.presentation === 'text' || btn.presentation === 'iconText')) {
    cls = 'of-cmd-btn' + (btn.presentation === 'iconText' ? ' of-cmd-btn-mix' : '') +
      (btn.enabled === false ? ' of-tbl-btn-off' : '') +
      (btn.contextual ? ' of-tbl-btn-ctx of-cmd-btn-ctx' : '') +
      (btn.active ? ' of-tbl-btn-active' : '');
  }
  return cls;
}

function renderMenuItem(btn) {
  if (btn.separator || btn.presentation === 'separator') {
    return '<div class="of-menu-sep" role="separator"></div>';
  }
  var cap = stripAmp(btn.caption).trim() || btn.name || '';
  var cls = 'of-menu-item' + (btn.enabled === false ? ' of-menu-item-off' : '');
  var itemTips = propsAttrFromLines(buttonPropsLines(btn));
  if (btn.submenu && btn.children && btn.children.length) {
    return '<div class="' + cls + ' of-menu-item-sub"' + itemTips + '>' +
      esc(cap) + '<span class="of-menu-sub-arr">▸</span></div>';
  }
  return '<div class="' + cls + '"' + itemTips + '>' + esc(cap) + '</div>';
}

function renderSubmenuButton(btn, context, tips) {
  var menuCls = toolbarBtnClasses(btn, 'of-tbl-btn of-tbl-btn-menu', context);
  if (context === 'main') {
    menuCls = 'of-cmd-btn of-cmd-btn-menu' +
      (btn.enabled === false ? ' of-tbl-btn-off' : '') +
      (btn.contextual ? ' of-tbl-btn-ctx of-cmd-btn-ctx' : '');
  }
  var trigger = '<span class="' + menuCls + '"' + tips + ' role="button" tabindex="0">' +
    '<span class="of-tbl-btn-label">' + esc(stripAmp(btn.caption)) + '</span>' +
    '<span class="of-tbl-menu-arr">▾</span></span>';
  if (!btn.children || !btn.children.length) return trigger;
  var items = btn.children.map(renderMenuItem).join('');
  return '<span class="of-submenu-wrap">' + trigger +
    '<div class="of-submenu-popup" role="menu">' + items + '</div></span>';
}

// Горизонтальный скролл поверх тулбара (полоса не сжимает кнопки).
function wrapToolbarHScroll(inner) {
  return '<div class="of-toolbar-wrap"><div class="of-toolbar-hscroll">' + inner + '</div></div>';
}

function renderToolbarButton(btn, context) {
  context = context || 'table';
  var tips = tipAttrs(btn);
  var pres = btn.presentation || (btn.separator ? 'separator' : btn.submenu ? 'submenu' : 'text');

  if (pres === 'separator') {
    var sepCls = (context === 'main' ? 'of-cmd-sep' : 'of-tbl-sep') +
      (btn.contextual ? ' of-sep-ctx' : '');
    return '<span class="' + sepCls + '"' + tips + '></span>';
  }

  if (pres === 'submenu') {
    return renderSubmenuButton(btn, context, tips);
  }

  if (pres === 'icon') {
    var icoCls = toolbarBtnClasses(btn, 'of-tbl-btn of-tbl-btn-ico', context);
    return '<span class="' + icoCls + '"' + tips + '></span>';
  }

  if (pres === 'iconText') {
    var miniIco = 'of-tbl-btn-ico-mini of-ico-dot';
    var cap = esc(stripAmp(btn.caption).trim());
    if (context === 'main') {
      return '<span class="' + toolbarBtnClasses(btn, 'of-cmd-btn of-cmd-btn-mix', context) + '"' + tips + '>' +
        '<span class="' + miniIco + '"></span>' +
        '<span class="of-cmd-btn-label">' + cap + '</span></span>';
    }
    var mixCls = toolbarBtnClasses(btn, 'of-tbl-btn of-tbl-btn-text', context);
    return '<span class="' + mixCls + '"' + tips + '>' +
      '<span class="' + miniIco + '"></span>' +
      '<span class="of-tbl-btn-label">' + cap + '</span></span>';
  }

  if (context === 'main') {
    return '<span class="' + toolbarBtnClasses(btn, 'of-cmd-btn', context) + '"' + tips + '>' +
      esc(stripAmp(btn.caption)) + '</span>';
  }

  var txtCls = toolbarBtnClasses(btn, 'of-tbl-btn of-tbl-btn-text of-tbl-btn-text-only', context);
  return '<span class="' + txtCls + '"' + tips + '>' +
    '<span class="of-tbl-btn-label">' + esc(stripAmp(btn.caption)) + '</span></span>';
}

function colTitle(c) {
  return typeof c === 'string' ? c : (c && c.title ? c.title : '');
}

function colWidthPx(c) {
  if (typeof c === 'object' && c && c.width > 0) return c.width;
  return null;
}

function colCellStyle(w) {
  if (!w) return '';
  return ' style="width:' + w + 'px;flex:0 0 ' + w + 'px"';
}

function labelHorzFlex(h) {
  return ['flex-start', 'center', 'flex-end', 'stretch'][h] || 'flex-start';
}

function labelTextAlign(h) {
  return ['left', 'center', 'right', 'justify'][h] || 'left';
}

function labelVertFlex(v) {
  return ['flex-start', 'center', 'flex-end'][v] || 'center';
}

// В 1С «11» в метаданных — размер в условных единицах макета; в превью = px, как у кнопок/закладок.
var DEFAULT_LABEL_FONT_PX = 11;

function isBuiltinLabelFont(face) {
  return /^(ms sans serif|tahoma|arial|segoe ui)$/i.test(String(face || '').trim());
}

function labelInlineStyle(el) {
  var s = el.labelStyle;
  if (!s) return '';
  var parts = [];
  var px = s.fontSize || DEFAULT_LABEL_FONT_PX;
  if (px !== DEFAULT_LABEL_FONT_PX) parts.push('font-size:' + px + 'px');
  if (s.font && s.font.fontFace && !isBuiltinLabelFont(s.font.fontFace)) {
    parts.push("font-family:'" + s.font.fontFace.replace(/'/g, '') + "',var(--1c-font)");
  }
  if (s.font && s.font.bold) parts.push('font-weight:bold');
  if (s.font && s.font.italic) parts.push('font-style:italic');
  var deco = [];
  if (s.underline) deco.push('underline');
  if (s.strike) deco.push('line-through');
  if (deco.length) parts.push('text-decoration:' + deco.join(' '));
  if (s.backColor) parts.push('background-color:' + s.backColor);
  if (s.textColor) parts.push('color:' + s.textColor);
  parts.push('justify-content:' + labelHorzFlex(s.horzAlign));
  parts.push('align-items:' + labelVertFlex(s.vertAlign));
  parts.push('text-align:' + labelTextAlign(s.horzAlign));
  return parts.join(';');
}

function labelClasses(el) {
  var cls = 'of-label';
  if (el.isStatusLabel) cls += ' of-status-label';
  if (el.labelStyle) {
    if (el.labelStyle.dynamicCaption) cls += ' of-label-dynamic';
    if (el.labelStyle.hyperLink) cls += ' of-label-link';
    if (el.labelStyle.font && el.labelStyle.font.bold) cls += ' of-label-bold';
  }
  return cls;
}

function labelInnerHtml(el) {
  if (el.caption) return esc(el.caption);
  if (el.name) {
    var isDynamic = el.labelStyle && el.labelStyle.dynamicCaption;
    var phCls = 'of-label-ph' + (isDynamic ? ' of-label-ph-dynamic' : '');
    var tip = isDynamic
      ? ' title="Заголовок задаётся в модуле формы (ПриОткрытии и др.)"'
      : '';
    return '<span class="' + phCls + '"' + tip + '>&lt;&lt;' + esc(el.name) + '&gt;&gt;</span>';
  }
  return '';
}

function buttonLabelInlineStyle(el) {
  var s = el.buttonStyle;
  if (!s || s.dropdown) return '';
  var parts = [];
  var px = s.fontSize != null ? s.fontSize : DEFAULT_LABEL_FONT_PX;
  parts.push('font-size:' + px + 'px');
  if (s.textColor) parts.push('color:' + s.textColor);
  if (s.font && s.font.bold) parts.push('font-weight:bold');
  if (s.font && s.font.italic) parts.push('font-style:italic');
  if (s.font && s.font.fontFace && !isBuiltinLabelFont(s.font.fontFace)) {
    parts.push("font-family:'" + s.font.fontFace.replace(/'/g, '') + "',var(--1c-font)");
  }
  return parts.join(';');
}

function buttonInlineStyle(el) {
  var s = el.buttonStyle;
  if (!s) return '';
  var parts = [];
  if (s.backColor) parts.push('background-color:' + s.backColor);
  if (s.dropdown) {
    parts.push('justify-content:stretch');
    parts.push('align-items:stretch');
    var px = s.fontSize != null ? s.fontSize : DEFAULT_LABEL_FONT_PX;
    parts.push('font-size:' + px + 'px');
    if (s.textColor) parts.push('color:' + s.textColor);
    if (s.font && s.font.bold) parts.push('font-weight:bold');
  } else if (s.horzAlign != null) {
    parts.push('justify-content:' + labelHorzFlex(s.horzAlign));
    parts.push('text-align:' + labelTextAlign(s.horzAlign));
  }
  return parts.join(';');
}

function appendButtonPropsLines(lines, el) {
  var s = el.buttonStyle;
  if (!s) return;
  if (s.backColor) lines.push('Цвет фона: ' + s.backColor);
  if (s.textColor) lines.push('Цвет текста: ' + s.textColor);
  if (s.font && s.font.bold) lines.push('Жирный: да');
  if (s.dropdown) {
    lines.push('Выпадающее меню: да');
    lines.push('Подпись: задаётся в коде');
    lines.push('В превью: <<' + (el.name || '') + '>>');
  } else if (s.fontSize) {
    lines.push('Размер шрифта: ' + s.fontSize);
  }
}

function dropdownButtonInnerHtml(el) {
  var tip = ' title="Текст задаётся в модуле формы"';
  return '<span class="of-button-drop-text"><span class="of-label-ph"' + tip + '>&lt;&lt;' +
    esc(el.name || '') + '&gt;&gt;</span></span>' +
    '<span class="of-button-drop-arr">▾</span>';
}

function appendLabelPropsLines(lines, el) {
  var s = el.labelStyle;
  if (!s) return;
  if (s.fontSize) lines.push('Размер шрифта: ' + s.fontSize + ' px');
  if (s.font && s.font.fontFace) lines.push('Шрифт: ' + s.font.fontFace);
  if (s.font && s.font.bold) lines.push('Жирный: да');
  if (s.font && s.font.italic) lines.push('Курсив: да');
  if (s.backColor) lines.push('Цвет фона: ' + s.backColor);
  if (s.textColor) lines.push('Цвет текста: ' + s.textColor);
  lines.push('Горизонталь: ' + labelHorzAlignName(s.horzAlign));
  lines.push('Вертикаль: ' + labelVertAlignName(s.vertAlign));
  if (s.underline) lines.push('Подчёркивание: да');
  if (s.strike) lines.push('Зачёркивание: да');
  if (s.hyperLink) lines.push('Гиперссылка: да');
  if (s.dynamicCaption) {
    lines.push('Подпись: задаётся в коде');
    lines.push('В превью: <<' + (el.name || '') + '>>');
  }
}

function columnColClasses(col) {
  var cls = 'of-tbl-col';
  if (col && typeof col === 'object') {
    if (col.visible === false) cls += ' of-tbl-col-hidden';
    if (col.hasPicture) cls += ' of-tbl-col-pic';
  }
  return cls;
}

function inputButtonHtml(kind) {
  var cls = 'of-input-btn of-input-btn-' + kind;
  var title = ' title="' + esc(labelInputButton(kind)) + '"';
  if (kind === 'calendar') {
    return '<span class="' + cls + '"' + title + '><span class="of-input-cal-ico"></span></span>';
  }
  if (kind === 'calculator') {
    return '<span class="' + cls + '"' + title + '><span class="of-input-calc-ico"></span></span>';
  }
  if (kind === 'search') {
    return '<span class="' + cls + '"' + title + '>⌕</span>';
  }
  if (kind === 'clear') {
    return '<span class="' + cls + '"' + title + '>×</span>';
  }
  if (kind === 'list') {
    return '<span class="' + cls + '"' + title + '>▾</span>';
  }
  if (kind === 'type') {
    return '<span class="' + cls + '"' + title + '>Т</span>';
  }
  if (kind === 'select') {
    return '<span class="' + cls + '"' + title + '><span class="of-input-dots">...</span></span>';
  }
  return '<span class="' + cls + '"' + title + '><span class="of-input-dots">...</span></span>';
}

function inputPlaceholderHtml(fieldName) {
  if (!fieldName) return '';
  return '<span class="of-input-ph">[' + esc(fieldName) + ']</span>';
}

function inputInnerHtml(buttons, fieldName) {
  var btns = buttons || [];
  var parts = ['<span class="of-input-text">' + inputPlaceholderHtml(fieldName) + '</span>'];
  for (var i = 0; i < btns.length; i++) parts.push(inputButtonHtml(btns[i]));
  return parts.join('');
}

function appendInputPropsLines(lines, el) {
  var s = el.inputStyle;
  if (!s && !el.inputButtons) return;
  var pat = s && s.pattern ? labelColumnPattern(s.pattern) : '';
  if (pat) lines.push('Тип данных: ' + pat);
  if (s && s.dateFormat) lines.push('Формат даты: ' + s.dateFormat);
  var btns = (s && s.buttons) || el.inputButtons || [];
  if (btns.length) {
    lines.push('Кнопки: ' + btns.map(function (b) { return labelInputButton(b); }).join(', '));
  }
}

function columnPropsLines(col, idx, tableName) {
  var title = colTitle(col);
  var main = ['Колонка таблицы'];
  if (tableName) main.push('Таблица: ' + tableName);
  if (title) main.push('Заголовок: ' + title);
  if (col && typeof col === 'object' && col.name && col.name !== title) {
    main.push('Имя поля: ' + col.name);
  } else if (idx != null && (!col || typeof col !== 'object')) {
    main.push('Индекс: ' + idx);
  }

  var data = [];
  var layout = [];
  var state = [];
  if (col && typeof col === 'object') {
    if (col.pattern) {
      var pat = labelColumnPattern(col.pattern);
      if (pat) data.push('Тип данных: ' + pat);
    }
    if (col.inputButtons && col.inputButtons.length) {
      data.push('Кнопки: ' + col.inputButtons.map(function (b) {
        return labelInputButton(b);
      }).join(', '));
    }
    if (col.footerText) data.push('Подвал: ' + col.footerText);
    if (col.hasPicture) data.push('Стандартная картинка 1С: да');
    if (col.width > 0) layout.push('Ширина: ' + col.width + ' px (в форме)');
    if (col.charWidth > 0) layout.push('Ширина: ' + col.charWidth + ' символов');
    if (col.colIndex != null) layout.push('Индекс: ' + col.colIndex);
    if (col.visible === false) state.push('Видимость: скрыта в 1С');
    else if (col.visible === true) state.push('Видимость: видима');
    if (col.headerTitleVisible === false) state.push('Текст заголовка: скрыт');
    else if (col.headerTitleVisible === true) state.push('Текст заголовка: виден');
  }

  return propsLinesWithSections([
    { title: '', lines: main },
    { title: 'Данные', lines: data },
    { title: 'Размер', lines: layout },
    { title: 'Видимость', lines: state }
  ]);
}

function tableHasFooter(cols) {
  for (var i = 0; i < cols.length; i++) {
    if (cols[i] && cols[i].footerText) return true;
  }
  return false;
}

function renderTableFooterCell(col) {
  var style = colCellStyle(colWidthPx(col));
  var text = col && col.footerText ? col.footerText : '';
  if (!text) return '<span class="of-tbl-foot-cell"' + style + '></span>';
  return '<span class="of-tbl-foot-cell of-tbl-foot-text"' + style + '>' + esc(text) + '</span>';
}

function renderTableColumnHeader(col, idx, tableName) {
  var inner = '';
  if (col && col.hasPicture) inner += icoDotHtml('of-tbl-col-ico');
  if (!col || col.headerTitleVisible !== false) {
    inner += '<span class="of-tbl-col-label">' + esc(colTitle(col)) + '</span>';
  }
  if (col && col.visible === false) {
    inner += '<span class="of-vis-mark of-vis-mark-hidden" title="Скрыта в 1С">◌</span>';
  }
  return '<span class="' + columnColClasses(col) + '"' + colCellStyle(colWidthPx(col)) +
    propsAttrFromLines(columnPropsLines(col, idx, tableName)) + '>' + inner + '</span>';
}

function renderTableInner(el) {
  var parts = [];
  if (el.tableButtons && el.tableButtons.length) {
    parts.push(wrapToolbarHScroll('<div class="of-tbl-toolbar">' +
      el.tableButtons.map(function (b) { return renderToolbarButton(b, 'table'); }).join('') + '</div>'));
  }
  var cols = el.columns || [];

  var totalW = 0;
  var hasWidths = false;
  for (var ci = 0; ci < cols.length; ci++) {
    var cw = colWidthPx(cols[ci]);
    if (cw) { totalW += cw; hasWidths = true; }
    else totalW += 80;
  }
  var hasFoot = cols.length && tableHasFooter(cols);
  var innerCls = 'of-tbl-inner' + (hasFoot ? ' of-tbl-inner--foot' : '');
  var innerStyle = hasWidths ? ' style="width:' + totalW + 'px;min-width:100%"' : '';

  if (cols.length) {
    parts.push('<div class="of-tbl-scroll">' +
      '<div class="' + innerCls + '"' + innerStyle + '>' +
      '<div class="of-tbl-cols">' +
      cols.map(function (c, idx) {
        return renderTableColumnHeader(c, idx, el.name);
      }).join('') +
      '</div>');
  } else {
    parts.push('<div class="of-tbl-head"><span>' + esc(el.name) + '</span></div>' +
      '<div class="of-tbl-scroll">');
  }

  var rows = '';
  if (cols.length) {
    rows = '<div class="of-tbl-row">' +
      cols.map(function (c) { return renderTableCell(c); }).join('') +
      '</div>';
  } else {
    rows = '<div class="of-tbl-row"></div>';
  }
  parts.push('<div class="of-tbl-body">' + rows + '</div>');
  if (hasFoot) {
    parts.push('<div class="of-tbl-foot">' +
      cols.map(function (c) { return renderTableFooterCell(c); }).join('') +
      '</div>');
  }
  if (cols.length) parts.push('</div>');
  parts.push('</div>');
  return parts.join('');
}

function renderTableCell(col) {
  var style = colCellStyle(colWidthPx(col));
  var btns = col && col.inputButtons;
  var fieldName = col && (col.name || colTitle(col));
  if (!btns || !btns.length) {
    if (!fieldName) return '<span class="of-tbl-cell"' + style + '></span>';
    return '<span class="of-tbl-cell of-tbl-cell-ph"' + style + '>' +
      inputPlaceholderHtml(fieldName) + '</span>';
  }
  return '<span class="of-tbl-cell of-tbl-cell-input"' + style + '>' +
    inputInnerHtml(btns, fieldName) + '</span>';
}

// --- Внутреннее содержимое элементов (без внешней обёртки) ------------------
function innerFor(el) {
  switch (el.kind) {
    case 'input': {
      var inBtns = el.inputButtons || (el.inputStyle && el.inputStyle.buttons) || [];
      return {
        cls: 'of-input' + (inBtns.length ? '' : ' of-input-plain'),
        inner: inputInnerHtml(inBtns, el.name || '')
      };
    }
    case 'checkbox':
      return { cls: 'of-checkbox', inner: '<span class="of-check-mark"></span><span class="of-check-cap">' + esc(el.caption || el.name) + '</span>' };
    case 'radio':
      if (el.enumChoices && el.enumChoices.length) {
        var enumText = el.previewValue || el.enumChoices[0] || '';
        return {
          cls: 'of-input',
          inner: '<span class="of-input-text">' + esc(enumText) + '</span>' +
            '<span class="of-input-btn of-input-btn-list" title="Выпадающий список">▾</span>'
        };
      }
      return { cls: 'of-radio', inner: '<span class="of-radio-mark"></span><span class="of-radio-cap">' + esc(el.caption || el.name) + '</span>' };
    case 'label':
      return {
        cls: labelClasses(el),
        inner: labelInnerHtml(el),
        labelStyle: labelInlineStyle(el)
      };
    case 'button': {
      var btnCap = stripAmp(el.caption || el.name).trim();
      var drop = el.buttonStyle && el.buttonStyle.dropdown;
      var btnCls = 'of-button' + (el.hasPicture ? ' of-button-pic' : '') + (drop ? ' of-button-drop' : '');
      var btnInner = '';
      if (drop) {
        btnInner = dropdownButtonInnerHtml(el);
      } else {
        var btnLabelStyle = buttonLabelInlineStyle(el);
        if (el.hasPicture) btnInner += icoDotHtml('of-btn-ico');
        if (btnCap) {
          btnInner += '<span class="of-btn-label"' +
            (btnLabelStyle ? ' style="' + btnLabelStyle + '"' : '') + '>' + esc(btnCap) + '</span>';
        } else if (!el.hasPicture) {
          btnInner += '<span class="of-btn-label"' +
            (btnLabelStyle ? ' style="' + btnLabelStyle + '"' : '') + '>' + esc(el.name || '') + '</span>';
        }
      }
      return {
        cls: btnCls,
        inner: btnInner,
        buttonStyle: buttonInlineStyle(el)
      };
    }
    case 'commandPanel':
      if (el.isTableToolbar) {
        return {
          cls: 'of-tbl-toolbar-panel',
          inner: wrapToolbarHScroll('<div class="of-tbl-toolbar">' +
            (el.buttons || []).map(function (b) { return renderToolbarButton(b, 'table'); }).join('') + '</div>')
        };
      }
      return {
        cls: 'of-cmdpanel' + (el.isStatusCommandPanel ? ' of-cmdpanel-status' : ''),
        inner: wrapToolbarHScroll((el.buttons || []).map(function (b) {
          return renderToolbarButton(b, 'main');
        }).join(''))
      };
    case 'table':
      return { cls: 'of-table', inner: renderTableInner(el) };
    case 'separator':
      return { cls: 'of-sep ' + (el.geom.height >= el.geom.width ? 'of-sep-v' : 'of-sep-h'), inner: '' };
    case 'picture':
      return { cls: 'of-picture', inner: '<span class="of-picture-ico">🖼️</span>' };
    case 'indicator':
      return { cls: 'of-indicator', inner: '<span class="of-indicator-fill"></span>' };
    case 'group':
      if (el.isTabControl && !el.hideTabStrip) {
        var th = el.tabStripH || DEFAULT_TAB_STRIP_H;
        var tabs = (el.pages || []).map(function (title, idx) {
          var isHiddenTab = !!(el.pageHidden && el.pageHidden[idx]);
          var cls = 'of-tab' + (idx === 0 ? ' of-tab-active' : '') +
            (isHiddenTab ? ' of-tab-hidden' : ' of-tab-shown');
          if (el.pagePictures && el.pagePictures[idx]) cls += ' of-tab-pic';
          var tabLines = propsLinesWithSections([
            { title: '', lines: ['Закладка', 'Название: ' + title, 'Индекс: ' + idx] },
            {
              title: 'Состояние',
              lines: [
                isHiddenTab ? 'Видимость: скрыта в 1С' : 'Видимость: видима'
              ].concat(el.pagePictures && el.pagePictures[idx] ? ['Стандартная картинка 1С: да'] : [])
            }
          ]);
          var tabInner = '';
          if (el.pagePictures && el.pagePictures[idx]) tabInner += icoDotHtml('of-tab-ico');
          tabInner += '<span class="of-tab-label">' + esc(title) + '</span>';
          if (isHiddenTab) {
            tabInner += '<span class="of-vis-mark of-vis-mark-hidden" title="Скрыта в 1С">◌</span>';
          }
          return '<span class="' + cls + '" data-of-panel="' + el._panelId +
            '" data-of-tab="' + idx + '"' + propsAttrFromLines(tabLines) + '>' + tabInner + '</span>';
        }).join('');
        return {
          cls: 'of-tabctl',
          inner: '<div class="of-tab-strip" style="height:' + th + 'px">' + tabs + '</div>'
        };
      }
      if (el.isTabControl && el.hideTabStrip) {
        return { cls: 'of-tabctl of-tabctl-plain', inner: '' };
      }
      return { cls: 'of-group', inner: groupCaptionHtml(el) };
    default:
      return {
        cls: 'of-unknown',
        inner: '<span class="of-unknown-cap">' + esc(el.caption || el.name) + '</span>'
      };
  }
}

// Индекс закладки в геометрии совпадает с порядком страниц в {1,N,…} (включая скрытые).
function mapPhysicalPage(tabEl, physical) {
  if (physical === null || physical < 0) return 0;
  var count = tabEl.pages ? tabEl.pages.length : 1;
  if (physical >= count) return 0;
  return physical;
}

// Цепочка привязок к закладкам (внешняя панель → вложенная, напр. панельЗакладки → пСклад2).
function bindingsAttr(bindings) {
  if (!bindings || !bindings.length) return '';
  var parts = [];
  for (var i = 0; i < bindings.length; i++) {
    parts.push(bindings[i].panelId + ':' + bindings[i].page);
  }
  return ' data-of-bindings="' + parts.join(',') + '"';
}

function hiddenByBindings(bindings) {
  if (!bindings || !bindings.length) return false;
  for (var i = 0; i < bindings.length; i++) {
    if (bindings[i].page !== 0) return true;
  }
  return false;
}

function propsAttrFromLines(lines) {
  if (!lines || !lines.length) return '';
  // Переносы — как &#10;, иначе атрибут разрывается в HTML.
  var text = esc(lines.join('\n')).replace(/\r?\n/g, '&#10;');
  return ' data-of-props="' + text + '"';
}

function elementPropsLines(el, bindings, opts) {
  opts = opts || {};
  var main = [el.typeName || el.kind || 'Элемент'];
  if (el.name) main.push('Имя: ' + el.name);
  var cap = el.caption ? stripAmp(el.caption).trim() : '';
  if (cap && cap !== el.name) main.push('Подпись: ' + cap);
  if (el.hasPicture) main.push('Стандартная картинка 1С: да');

  var data = [];
  if (el.kind === 'input') appendInputPropsLines(data, el);
  if (el.kind === 'radio' && el.enumChoices && el.enumChoices.length) {
    data.push('Список значений: ' + el.enumChoices.join(', '));
  }
  if (el.kind === 'table' && el.columns && el.columns.length) {
    data.push('Колонок: ' + el.columns.length);
    var hiddenCols = el.columns.filter(function (c) {
      return c && typeof c === 'object' && c.visible === false;
    });
    if (hiddenCols.length) data.push('Скрытых колонок: ' + hiddenCols.length);
    var titles = el.columns.slice(0, 8).map(function (c) {
      return typeof c === 'string' ? c : (c.title || '');
    }).filter(Boolean);
    if (titles.length) {
      data.push('Колонки: ' + titles.join(', ') + (el.columns.length > 8 ? '…' : ''));
    }
  }
  if (el.kind === 'commandPanel') {
    var btns = el.buttons || [];
    if (btns.length) data.push('Кнопок: ' + btns.length);
    if (el.isTableToolbar) data.push('Тулбар таблицы: да');
    if (el.isStatusCommandPanel) data.push('Статусная панель: да');
  }
  if (el.isTabControl && el.pages && el.pages.length) {
    data.push('Страниц: ' + el.pages.length);
    data.push('Закладки: ' + el.pages.join(', '));
  }
  if (el.kind === 'unknown' && el.typeUuid) data.push('UUID типа: ' + el.typeUuid);

  var style = [];
  if (el.kind === 'label') appendLabelPropsLines(style, el);
  if (el.kind === 'button') appendButtonPropsLines(style, el);

  var visibility = [];
  if (opts.tabHidden) visibility.push('Видимость: на неактивной закладке');
  if (el.conditionalVisible) visibility.push('Видимость: условная (в 1С)');
  if (el.overlayHidden) {
    visibility.push('Скрыта в превью: совпадает с кнопкой «' + (el.overlayHiddenBy || '') + '»');
  }

  var geometry = [];
  if (el.geom) {
    geometry.push('Позиция: ' + el.geom.left + ', ' + el.geom.top);
    geometry.push('Размер: ' + el.geom.width + ' × ' + el.geom.height);
    if (el.geom.pageIndex != null && el.geom.pageIndex > 0) {
      var lastB = bindings && bindings.length ? bindings[bindings.length - 1] : null;
      if (lastB && lastB.pageTitle) {
        geometry.push('Закладка: «' + lastB.pageTitle + '» (инд. ' + el.geom.pageIndex + ')');
      } else {
        geometry.push('Индекс закладки в геометрии: ' + el.geom.pageIndex);
      }
    }
  }

  var layout = [];
  if (bindings && bindings.length) {
    for (var i = 0; i < bindings.length; i++) {
      var b = bindings[i];
      var bl = 'Панель';
      if (b.panelName) bl += ' «' + b.panelName + '»';
      else if (b.panelId) bl += ' ' + b.panelId;
      if (b.pageTitle) bl += ', закладка «' + b.pageTitle + '»';
      else if (b.page != null) bl += ', страница ' + b.page;
      layout.push(bl);
    }
  }

  return propsLinesWithSections([
    { title: '', lines: main },
    { title: 'Данные', lines: data },
    { title: 'Оформление', lines: style },
    { title: 'Видимость', lines: visibility },
    { title: 'Геометрия', lines: geometry },
    { title: 'Размещение', lines: layout }
  ]);
}

function elementPropsAttr(el, bindings, opts) {
  return propsAttrFromLines(elementPropsLines(el, bindings, opts));
}

// Нижняя строка формы: надписи «Вес»/«Объем» слева, кнопки панели — справа.
function applyStatusBarLayout(elements, formHeight) {
  var rowTop = formHeight - 40;
  var labels = [];
  var panels = [];

  function walk(els) {
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.geom || el.geom.top < rowTop) {
        if (el.children) walk(el.children);
        continue;
      }
      if (el.kind === 'label' && /^надпись(Вес|Объем)$/i.test(el.name)) {
        el.isStatusLabel = true;
        labels.push(el);
      }
      if (el.kind === 'commandPanel' && !el.isTableToolbar) panels.push(el);
      if (el.children) walk(el.children);
    }
  }
  walk(elements);

  for (var p = 0; p < panels.length; p++) {
    var panel = panels[p];
    var pad = 0;
    for (var l = 0; l < labels.length; l++) {
      var lbl = labels[l];
      if (lbl.geom.pageIndex !== panel.geom.pageIndex) continue;
      if (lbl.geom.right <= panel.geom.left || lbl.geom.left >= panel.geom.right) continue;
      var need = lbl.geom.right - panel.geom.left + 4;
      if (need > pad) pad = need;
    }
    if (pad > 0) {
      panel.statusPadLeft = pad;
      panel.isStatusCommandPanel = true;
    }
  }
}

// bindings: [{panelId, page}, …] — все уровни панелей закладок для элемента.
function renderElement(el, ox, oy, bindings, panelCounter) {
  var rect = {
    left: ox + el.geom.left,
    top: oy + el.geom.top,
    w: el.geom.width,
    h: el.geom.height
  };

  var isTab = el.kind === 'group' && el.isTabControl;
  var showTabStrip = isTab && !el.hideTabStrip;
  if (isTab) el._panelId = 'p' + (panelCounter.n++);

  var part = innerFor(el);

  var attrs = bindingsAttr(bindings);
  var hidden = hiddenByBindings(bindings) || el.overlayHidden;
  var propsAttr = elementPropsAttr(el, bindings, { tabHidden: hidden && !el.overlayHidden });
  var style = boxStyle(rect) + (hidden ? 'display:none;' : '');
  if (el.statusPadLeft) style += 'padding-left:' + el.statusPadLeft + 'px;box-sizing:border-box;';
  if (el.isStatusLabel) style += 'z-index:6;';
  if (el.isStatusCommandPanel) style += 'z-index:4;';
  if (part.labelStyle) style += part.labelStyle + ';';
  if (part.buttonStyle) style += part.buttonStyle + ';';

  var elCls = part.cls + (el.conditionalVisible ? ' of-el-ctx' : '');
  var html = '<div class="of-el ' + elCls + '" style="' + style + '"' + attrs + propsAttr + '>' +
    part.inner + '</div>';

  if (el.children && el.children.length) {
    var cx = rect.left + (isTab ? 0 : GROUP_PAD);
    var cy = rect.top + (showTabStrip ? (el.tabStripH || DEFAULT_TAB_STRIP_H) : (isTab ? 0 : GROUP_PAD));
    for (var i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      var childBindings;
      if (isTab) {
        var physPage = mapPhysicalPage(el, child.geom.pageIndex);
        childBindings = (bindings || []).concat([{
          panelId: el._panelId,
          page: physPage,
          panelName: el.name || '',
          pageTitle: el.pages && el.pages[physPage] ? el.pages[physPage] : ''
        }]);
      } else {
        childBindings = bindings;
      }
      html += renderElement(child, cx, cy, childBindings, panelCounter);
    }
  }

  return html;
}

function formHasVisibilityHints(form) {
  function walk(els) {
    for (var i = 0; i < (els || []).length; i++) {
      var e = els[i];
      if (e.pageHidden && e.pageHidden.some(function (h) { return h; })) return true;
      if (e.columns && e.columns.some(function (c) { return c && c.visible === false; })) return true;
      if (e.buttons && e.buttons.some(function (b) { return b.contextual; })) return true;
      if (e.tableButtons && e.tableButtons.some(function (b) { return b.contextual; })) return true;
      if (e.children && walk(e.children)) return true;
    }
    return false;
  }
  return walk(form.elements);
}

export function renderOrdinaryForm(form, fileName) {
  var title = form.title || (fileName ? fileName.replace(/\.[^.]+$/, '') : 'Обычная форма');
  var panelCounter = { n: 0 };

  applyStatusBarLayout(form.elements, form.height || 0);

  // Контейнеры (группы/закладки) рисуем первыми — как фон.
  var bg = form.elements.filter(function (e) { return e.kind === 'group'; });
  var fg = form.elements.filter(function (e) { return e.kind !== 'group'; });
  // Надписи статусной строки — поверх панелей.
  fg.sort(function (a, b) {
    if (a.isStatusLabel && !b.isStatusLabel) return 1;
    if (!a.isStatusLabel && b.isStatusLabel) return -1;
    return 0;
  });

  var body = bg.map(function (e) { return renderElement(e, 0, 0, null, panelCounter); }).join('') +
    fg.map(function (e) { return renderElement(e, 0, 0, null, panelCounter); }).join('');

  var pad = 12;
  var canvasW = form.width + pad * 2;
  var canvasH = form.height + pad * 2;

  var warn = '';
  var unknownKeys = Object.keys(form.unknownTypes || {});
  if (unknownKeys.length) {
    var n = 0;
    unknownKeys.forEach(function (k) { n += form.unknownTypes[k]; });
    warn = '<div class="of-warn">Распознаны не все элементы: ' + n +
      ' элемент(ов) неизвестного типа отображены пунктиром.</div>';
  }

  var visLegend = '';
  if (formHasVisibilityHints(form)) {
    visLegend = '<div class="of-vis-legend">' +
      '<span class="of-vis-leg-item"><span class="of-vis-mark of-vis-mark-hidden">◌</span> скрыто</span>' +
      '<span class="of-vis-leg-sep">·</span>' +
      '<span class="of-vis-leg-item"><span class="of-vis-leg-ctx">◇</span> условная видимость</span>' +
      '</div>';
  }

  var stats = (form.count || (form.flat && form.flat.length) || 0) + ' элемент(ов)';

  return '' +
    '<div class="of-window">' +
      '<div class="of-titlebar">' +
        '<span class="of-tb-ico">🖥️</span>' +
        '<span class="of-tb-title">' + esc(title) + '</span>' +
        '<span class="of-tb-spacer"></span>' +
        '<span class="of-tb-stats">' + esc(stats) + '</span>' +
      '</div>' +
      warn +
      visLegend +
      '<div class="of-body">' +
        '<div class="of-canvas" style="width:' + canvasW + 'px;height:' + canvasH + 'px;">' +
          '<div class="of-canvas-inner" style="left:' + pad + 'px;top:' + pad + 'px;">' +
            body +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}
