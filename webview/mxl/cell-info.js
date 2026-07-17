import { effectiveHAlign, formatMxlCellText, resolveCellFormat } from './format.js';
import { findMergeAt } from './merges.js';
import { colWidthAt, getColWidths } from './layout.js';

function lineDesc(lines, idx) {
  if (idx === undefined || idx === null || !lines[idx]) return '';
  var ln = lines[idx];
  return ln.style + ', ' + ln.width + 'px' + (ln.color ? ', ' + ln.color : '');
}

function fontDesc(fonts, idx) {
  if (idx === undefined || idx === null || !fonts[idx]) return '';
  var f = fonts[idx];
  var parts = [f.face, f.size + 'pt'];
  if (f.bold) parts.push('жирный');
  if (f.italic) parts.push('курсив');
  if (f.underline) parts.push('подчёркнутый');
  if (f.strikeout) parts.push('зачёркнутый');
  return parts.join(', ');
}

function findNamedAreas(mxlData, row, col) {
  var areas = [];
  var visualRanges = mxlData.namedAreaVisualRanges;
  if (visualRanges && visualRanges.length) {
    visualRanges.forEach(function (area) {
      if (row >= area.beginRow && row <= area.endRow) {
        areas.push(area.name + ' (Rows)');
      }
    });
    return areas;
  }
  (mxlData.namedItems || []).forEach(function (ni) {
    var inRow = ni.beginRow >= 0 && ni.endRow >= 0 &&
      row >= ni.beginRow && row <= ni.endRow;
    var inCol = ni.beginColumn < 0 || ni.endColumn < 0 ||
      (col >= ni.beginColumn && col <= ni.endColumn);
    if (inRow && inCol) areas.push(ni.name + ' (' + ni.type + ')');
  });
  return areas;
}

function findMerge(mxlData, row, col) {
  return findMergeAt(mxlData, row, col);
}

function pushProp(list, label, value) {
  if (value === undefined || value === null || value === '') return;
  list.push({ label: label, value: String(value) });
}

function formatProps(list, format, mxlData) {
  if (format.font !== undefined) {
    pushProp(list, 'Шрифт (индекс)', format.font);
    pushProp(list, 'Шрифт', fontDesc(mxlData.fonts, format.font));
  }
  pushProp(list, 'Ширина', format.width);
  pushProp(list, 'Высота', format.height);
  pushProp(list, 'Гор. выравнивание', effectiveHAlign(format));
  pushProp(list, 'Верт. выравнивание', format.vAlign);
  pushProp(list, 'Цвет фона', format.backColor);
  pushProp(list, 'Цвет текста', format.textColor);
  pushProp(list, 'Цвет границы', format.borderColor);
  pushProp(list, 'Размещение текста', format.textPlacement);
  pushProp(list, 'Тип заполнения', format.fillType);
  pushProp(list, 'Отступ', format.indent);
  pushProp(list, 'Угол поворота', format.angle);
  pushProp(list, 'Шаблон', format.pattern);
  pushProp(list, 'Формат редактирования', format.editFormat);
  if (format.markNegatives) pushProp(list, 'Выделять отрицательные', 'Да');
  if (format.hyperLink) pushProp(list, 'Гиперссылка', 'Да');
  if (format.border !== undefined) {
    pushProp(list, 'Граница (индекс)', format.border);
    pushProp(list, 'Граница', lineDesc(mxlData.lines, format.border));
  }
  if (format.leftBorder !== undefined) {
    pushProp(list, 'Левая граница (индекс)', format.leftBorder);
    pushProp(list, 'Левая граница', lineDesc(mxlData.lines, format.leftBorder));
  }
  if (format.topBorder !== undefined) {
    pushProp(list, 'Верхняя граница (индекс)', format.topBorder);
    pushProp(list, 'Верхняя граница', lineDesc(mxlData.lines, format.topBorder));
  }
  if (format.rightBorder !== undefined) {
    pushProp(list, 'Правая граница (индекс)', format.rightBorder);
    pushProp(list, 'Правая граница', lineDesc(mxlData.lines, format.rightBorder));
  }
  if (format.bottomBorder !== undefined) {
    pushProp(list, 'Нижняя граница (индекс)', format.bottomBorder);
    pushProp(list, 'Нижняя граница', lineDesc(mxlData.lines, format.bottomBorder));
  }
}

export function describeCell(mxlData, row, col) {
  var rowData = mxlData.rows[row];
  var cell = rowData ? rowData.cells[col] : null;
  var format = resolveCellFormat(mxlData, cell);
  var merge = findMerge(mxlData, row, col);
  var colID = (rowData && rowData.columnsID) ? rowData.columnsID : 'default';
  var colWidths = getColWidths(mxlData, colID);

  var sections = [];

  var pos = [{ label: 'Строка', value: String(row + 1) }, { label: 'Колонка', value: String(col + 1) }];
  if (merge) {
    if (merge.master) {
      pos.push({ label: 'Объединение', value: merge.colspan + ' × ' + merge.rowspan });
    } else {
      pos.push({ label: 'Объединение', value: 'часть R' + (merge.masterRow + 1) + 'C' + (merge.masterCol + 1) });
    }
  }
  var areas = findNamedAreas(mxlData, row, col);
  if (areas.length) pos.push({ label: 'Область', value: areas.join('; ') });
  sections.push({ title: 'Позиция', props: pos });

  var cellProps = [];
  var displayText = formatMxlCellText(cell, format);
  pushProp(cellProps, 'Отображение', displayText || '(пусто)');
  pushProp(cellProps, 'Текст', cell && cell.text);
  pushProp(cellProps, 'Параметр', cell && cell.parameter);
  pushProp(cellProps, 'Детальный параметр', cell && cell.detailParameter);
  pushProp(cellProps, 'Индекс формата ячейки', cell && cell.f ? cell.f : mxlData.defaultFormatIndex || 0);
  sections.push({ title: 'Ячейка', props: cellProps });

  var fmtProps = [];
  formatProps(fmtProps, format, mxlData);
  if (cell && cell.f) {
    var rawFmt = mxlData.resolvedFormats[String(cell.f)] || {};
    var rawProps = [];
    formatProps(rawProps, rawFmt, mxlData);
    if (rawProps.length) {
      sections.push({ title: 'Формат ячейки (индекс ' + cell.f + ')', props: rawProps });
    }
  }
  sections.push({ title: 'Эффективный формат', props: fmtProps });

  var rowProps = [];
  pushProp(rowProps, 'columnsID', colID);
  pushProp(rowProps, 'Индекс формата строки', rowData && rowData.formatIndex);
  pushProp(rowProps, 'Высота строки', rowData && rowData.height);
  if (rowData && rowData.empty) pushProp(rowProps, 'Пустая', 'Да');
  pushProp(rowProps, 'Ширина колонки', colWidthAt(colWidths, col) + ' px');
  sections.push({ title: 'Строка / колонка', props: rowProps });

  return sections;
}

export function renderCellPropsPanel(sections) {
  var html = '<div class="mxl-props-head">Свойства ячейки<button type="button" class="mxl-props-close" title="Закрыть">×</button></div>';
  html += '<div class="mxl-props-body">';
  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    if (!sec.props.length) continue;
    html += '<div class="mxl-props-section">';
    html += '<div class="mxl-props-title">' + sec.title + '</div>';
    html += '<dl class="mxl-props-list">';
    for (var p = 0; p < sec.props.length; p++) {
      var prop = sec.props[p];
      html += '<dt>' + prop.label + '</dt><dd>' + escapeHtml(prop.value) + '</dd>';
    }
    html += '</dl></div>';
  }
  html += '</div>';
  return html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
