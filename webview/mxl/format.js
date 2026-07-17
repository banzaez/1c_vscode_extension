import { L, elemChildren, childByName, textOf, childText } from './xml-utils.js';
import { resolveColor, rgbToHex } from './colors.js';

// Высота строки в MXL — в 1/4 пункта (в свойствах 1С: 801 → 200,25). Ширина колонки — как в XML.
export const MXL_HEIGHT_DIVISOR = 4;

export function mxlHeightToDisplay(raw) {
  var n = parseFloat(raw);
  // 0 и -1 в 1С означают «авто»; отрицательные значения не задают фиксированную высоту.
  if (isNaN(n) || n <= 0) return 0;
  return n / MXL_HEIGHT_DIVISOR;
}

// Выбор текста для нужного языка. lang === '' это языконезависимый текст.
export function readCellText(tl, currentLang) {
  if (!tl) return '';
  var items = [];
  var ch = elemChildren(tl);
  for (var i = 0; i < ch.length; i++) {
    if (L(ch[i]) === 'item') items.push(ch[i]);
  }
  if (!items.length) return textOf(tl);

  var langText = '';
  var ruText = '';
  var neutralText = '';
  var fallback = '';
  for (var j = 0; j < items.length; j++) {
    var lang = childText(items[j], 'lang');
    var content = childText(items[j], 'content');
    if (!content) continue;
    if (!fallback) fallback = content;
    if (lang === currentLang) langText = content;
    if (lang === 'ru') ruText = content;
    if (lang === '' || lang === '#') neutralText = content;
  }
  return langText || ruText || neutralText || fallback;
}

// Чтение цвета: либо текстовое значение (именованный/rgb-строка), либо дочерние r/g/b.
function readColorNode(node) {
  if (!node) return '';
  var txt = textOf(node);
  if (txt) return resolveColor(txt);
  var r = childByName(node, 'r');
  var g = childByName(node, 'g');
  var b = childByName(node, 'b');
  if (r || g || b) {
    return rgbToHex(textOf(r) || 0, textOf(g) || 0, textOf(b) || 0);
  }
  return '';
}

export function lineToBorderCss(line) {
  if (!line) return '';
  if (line.style === 'None') return 'none';
  var style = line.style === 'Double' ? 'double' :
    line.style === 'Dotted' ? 'dotted' :
    line.style === 'Dashed' ? 'dashed' : 'solid';
  var color = line.color || '#000';
  var width = line.width || 1;
  return width + 'px ' + style + ' ' + color;
}

function copyFormatProps(src) {
  return src ? Object.assign({}, src) : {};
}

function applyFormatProps(target, source) {
  if (!source) return target;
  Object.keys(source).forEach(function (k) {
    if (source[k] !== undefined) target[k] = source[k];
  });
  return target;
}

// Форматы в MXL независимы: индекс N ссылается на N-й <format> как есть.
export function buildResolvedFormats(formats, count) {
  var resolved = { '0': {} };
  for (var i = 1; i <= count; i++) {
    resolved[String(i)] = copyFormatProps(formats[String(i)]);
  }
  return resolved;
}

export function appendFontCss(styleStr, format, fonts) {
  if (!format || format.font === undefined || !fonts[format.font]) return styleStr;
  var font = fonts[format.font];
  var face = String(font.face || 'Arial').replace(/'/g, "\\'");
  styleStr += "font-family:'" + face + "',var(--1c-font);";
  styleStr += 'font-size:' + font.size + 'pt;';
  styleStr += 'font-weight:' + (font.bold ? 'bold' : 'normal') + ';';
  styleStr += 'font-style:' + (font.italic ? 'italic' : 'normal') + ';';
  var deco = [];
  if (font.underline) deco.push('underline');
  if (font.strikeout) deco.push('line-through');
  styleStr += 'text-decoration:' + (deco.length ? deco.join(' ') : 'none') + ';';
  return styleStr;
}

export function formatHasBorder(format) {
  if (!format) return false;
  return format.border !== undefined ||
    format.leftBorder !== undefined ||
    format.topBorder !== undefined ||
    format.rightBorder !== undefined ||
    format.bottomBorder !== undefined;
}

// Отображение текста ячейки в режиме макета (как в конфигураторе 1С):
//   Параметр  -> <ИмяПараметра> (пусто -> <>)
//   Шаблон    -> <текст с [параметрами]>
//   Текст     -> текст как есть
export function formatMxlCellText(cell, format) {
  var fillType = format && format.fillType ? format.fillType : '';
  if (cell && cell.parameter) {
    return '<' + cell.parameter + '>';
  }
  if (fillType === 'Parameter') {
    return '<' + (cell && cell.parameter ? cell.parameter : '') + '>';
  }
  var text = cell && cell.text ? cell.text : '';
  if (fillType === 'Template') {
    return '<' + text + '>';
  }
  return text;
}

/** Плейсхолдер макета (<Параметр> / <шаблон>) — в превью обрезается, не переносится. */
export function isLayoutPlaceholderCell(cell, format) {
  if (!cell && !format) return false;
  var fillType = format && format.fillType ? format.fillType : '';
  if (cell && cell.parameter) return true;
  if (fillType === 'Parameter' || fillType === 'Template') return true;
  return false;
}

// Эффективный формат ячейки: формат по умолчанию, перекрытый форматом ячейки.
export function resolveCellFormat(mxlData, cell) {
  var base = copyFormatProps(mxlData.resolvedFormats[String(mxlData.defaultFormatIndex || 0)] || {});
  if (cell && cell.f) {
    applyFormatProps(base, mxlData.resolvedFormats[String(cell.f)] || {});
  }
  return base;
}

export function appendIndentCss(styleStr, format) {
  if (!format || format.indent === undefined || format.indent <= 0) return styleStr;
  styleStr += 'padding-left:' + (format.indent * 6) + 'px;';
  return styleStr;
}

export function effectiveHAlign(format) {
  var h = (format && format.hAlign) ? String(format.hAlign) : '';
  if (!h || h.toLowerCase() === 'auto') return 'Left';
  return h;
}

export function hAlignToCss(hAlign) {
  var h = (hAlign || '').toLowerCase();
  if (h === 'right') return 'right';
  if (h === 'center') return 'center';
  if (h === 'justify') return 'justify';
  return 'left';
}

export function appendHorizontalAlignCss(styleStr, format) {
  styleStr += 'text-align:' + hAlignToCss(effectiveHAlign(format)) + ';';
  return styleStr;
}

export function appendVerticalAlignCss(styleStr, format) {
  var vAlign = (format && format.vAlign) ? format.vAlign.toLowerCase() : '';
  if (vAlign === 'top') styleStr += 'vertical-align:top;';
  else if (vAlign === 'center') styleStr += 'vertical-align:middle;';
  else styleStr += 'vertical-align:bottom;';
  return styleStr;
}

/** @deprecated Используйте appendVerticalAlignCss + appendCellTextCss */
export function appendAlignCss(styleStr, format) {
  styleStr = appendHorizontalAlignCss(styleStr, format);
  return appendVerticalAlignCss(styleStr, format);
}

export function appendCellTextCss(styleStr, format, cell) {
  styleStr += 'display:block;width:100%;box-sizing:border-box;';
  styleStr = appendHorizontalAlignCss(styleStr, format);
  return appendTextPlacementCss(styleStr, format, cell);
}

export function appendTextPlacementCss(styleStr, format, cell) {
  if (isLayoutPlaceholderCell(cell, format)) {
    styleStr += 'white-space:nowrap;overflow:hidden;text-overflow:clip;';
    return styleStr;
  }
  var tp = (format && format.textPlacement) ? format.textPlacement : '';
  if (tp === 'Wrap') {
    styleStr += 'white-space:normal;overflow:hidden;word-break:break-word;';
  } else if (tp === 'Cut') {
    styleStr += 'white-space:nowrap;overflow:hidden;text-overflow:clip;';
  } else {
    // Auto / Fill / по умолчанию — обрезаем по границе ячейки, чтобы не ломать скролл.
    styleStr += 'white-space:nowrap;overflow:hidden;';
  }
  return styleStr;
}

export function appendBorderCss(styleStr, format, lines) {
  if (!formatHasBorder(format)) return styleStr;

  var sides = { left: undefined, top: undefined, right: undefined, bottom: undefined };

  if (format.border !== undefined && lines[format.border]) {
    var all = lineToBorderCss(lines[format.border]);
    sides.left = all;
    sides.top = all;
    sides.right = all;
    sides.bottom = all;
  }

  var borderDirs = [
    { key: 'leftBorder', name: 'left' },
    { key: 'topBorder', name: 'top' },
    { key: 'rightBorder', name: 'right' },
    { key: 'bottomBorder', name: 'bottom' }
  ];
  borderDirs.forEach(function (dir) {
    if (format[dir.key] !== undefined && lines[format[dir.key]]) {
      sides[dir.name] = lineToBorderCss(lines[format[dir.key]]);
    }
  });

  // Эмитим только заданные стороны: незаданные сохраняют светлую сетку из CSS.
  borderDirs.forEach(function (dir) {
    if (sides[dir.name] !== undefined) {
      styleStr += 'border-' + dir.name + ':' + sides[dir.name] + ';';
    }
  });
  return styleStr;
}

export function parseFormatNode(fmt) {
  var formatData = {};

  var w = childByName(fmt, 'width');
  if (w) formatData.width = parseInt(textOf(w), 10) || 0;

  var h = childByName(fmt, 'height');
  if (h) formatData.height = mxlHeightToDisplay(textOf(h));

  var fontIdx = childByName(fmt, 'font');
  if (fontIdx) {
    var fontVal = parseInt(textOf(fontIdx), 10);
    if (!isNaN(fontVal)) formatData.font = fontVal;
  }

  var hAlign = childByName(fmt, 'horizontalAlignment');
  if (hAlign) formatData.hAlign = textOf(hAlign);

  var vAlign = childByName(fmt, 'verticalAlignment');
  if (vAlign) formatData.vAlign = textOf(vAlign);

  var backColor = childByName(fmt, 'backColor');
  if (backColor) {
    var bc = readColorNode(backColor);
    if (bc) formatData.backColor = bc;
  }

  var textColor = childByName(fmt, 'textColor');
  if (textColor) {
    var tc = readColorNode(textColor);
    if (tc) formatData.textColor = tc;
  }

  var borderColor = childByName(fmt, 'borderColor');
  if (borderColor) {
    var brc = readColorNode(borderColor);
    if (brc) formatData.borderColor = brc;
  }

  var textPlacement = childByName(fmt, 'textPlacement');
  if (textPlacement) formatData.textPlacement = textOf(textPlacement);

  var fillType = childByName(fmt, 'fillType');
  if (fillType) formatData.fillType = textOf(fillType);

  var markNeg = childByName(fmt, 'markNegatives');
  if (markNeg) formatData.markNegatives = textOf(markNeg) === 'true';

  var pattern = childByName(fmt, 'pattern');
  if (pattern) formatData.pattern = textOf(pattern);

  var editFormat = childByName(fmt, 'editFormat');
  if (editFormat) formatData.editFormat = textOf(editFormat);

  var hyperLink = childByName(fmt, 'hyperLink');
  if (hyperLink) formatData.hyperLink = textOf(hyperLink) === 'true';

  var angle = childByName(fmt, 'angle');
  if (angle) {
    var av = parseInt(textOf(angle), 10);
    if (!isNaN(av) && av !== 0) formatData.angle = av;
  }

  var indent = childByName(fmt, 'indent');
  if (indent) {
    var indentVal = parseInt(textOf(indent), 10);
    if (!isNaN(indentVal)) formatData.indent = indentVal;
  }

  var border = childByName(fmt, 'border');
  if (border) {
    var borderVal = parseInt(textOf(border), 10);
    if (!isNaN(borderVal)) formatData.border = borderVal;
  }
  var lBorder = childByName(fmt, 'leftBorder');
  if (lBorder) {
    var lv = parseInt(textOf(lBorder), 10);
    if (!isNaN(lv)) formatData.leftBorder = lv;
  }
  var tBorder = childByName(fmt, 'topBorder');
  if (tBorder) {
    var tv = parseInt(textOf(tBorder), 10);
    if (!isNaN(tv)) formatData.topBorder = tv;
  }
  var rBorder = childByName(fmt, 'rightBorder');
  if (rBorder) {
    var rv = parseInt(textOf(rBorder), 10);
    if (!isNaN(rv)) formatData.rightBorder = rv;
  }
  var bBorder = childByName(fmt, 'bottomBorder');
  if (bBorder) {
    var bv = parseInt(textOf(bBorder), 10);
    if (!isNaN(bv)) formatData.bottomBorder = bv;
  }

  return formatData;
}
