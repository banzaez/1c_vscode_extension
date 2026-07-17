import { L, elemChildren, childByName, textOf, attr, childText } from './xml-utils.js';
import {
  buildResolvedFormats,
  readCellText,
  parseFormatNode,
  mxlHeightToDisplay
} from './format.js';
import { resolveColor } from './colors.js';

export function parseMxl(xmlText) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(xmlText, 'application/xml');
  var perr = doc.getElementsByTagName('parsererror');
  if (perr && perr.length) {
    throw new Error('Ошибка разбора XML:\n' + perr[0].textContent);
  }

  var root = doc.documentElement;
  if (!root || L(root) !== 'document') {
    throw new Error('Это не похоже на табличный макет 1С MXL (ожидался корневой элемент <document>).');
  }

  var rootChildren = elemChildren(root);

  var langSettings = childByName(root, 'languageSettings');
  var currentLang = langSettings ? childText(langSettings, 'currentLanguage') : '';
  if (!currentLang) currentLang = 'ru';
  var vgRows = parseInt(childText(root, 'height'), 10);
  if (isNaN(vgRows)) vgRows = parseInt(childText(root, 'vgRows'), 10);
  if (isNaN(vgRows)) vgRows = 0;
  var defaultFormatIndex = parseInt(childText(root, 'defaultFormatIndex'), 10);
  if (isNaN(defaultFormatIndex)) defaultFormatIndex = 0;

  // Единый проход: шрифты, линии, форматы (не зависят друг от друга)
  var fonts = [];
  var lines = [];
  var formats = { '0': {} };
  var formatCounter = 0;
  for (var ci = 0; ci < rootChildren.length; ci++) {
    var rch = rootChildren[ci];
    var rchTag = L(rch);
    if (rchTag === 'font') {
      if (!attr(rch, 'faceName')) continue;
      fonts.push({
        face: attr(rch, 'faceName') || 'Arial',
        size: parseFloat(attr(rch, 'height')) || 10,
        bold: attr(rch, 'bold') === 'true',
        italic: attr(rch, 'italic') === 'true',
        underline: attr(rch, 'underline') === 'true',
        strikeout: attr(rch, 'strikeout') === 'true'
      });
    } else if (rchTag === 'line') {
      var styleNode = childByName(rch, 'style');
      var colorNode = childByName(rch, 'color');
      lines.push({
        width: parseInt(attr(rch, 'width'), 10) || 1,
        style: textOf(styleNode) || 'Solid',
        color: colorNode ? (resolveColor(textOf(colorNode)) || '#000') : '#000'
      });
    } else if (rchTag === 'format') {
      formatCounter++;
      formats[String(formatCounter)] = parseFormatNode(rch);
    }
  }

  var resolvedFormats = buildResolvedFormats(formats, formatCounter);

  var defaultColWidth = 60;
  var defaultFmt = resolvedFormats[String(defaultFormatIndex)] || {};
  if (defaultFmt.width > 0) defaultColWidth = defaultFmt.width;

  // Второй проход: колонки (требуют resolvedFormats)
  var columnsSets = {};
  var maxCols = 1;
  for (var cg = 0; cg < rootChildren.length; cg++) {
    var cgn = rootChildren[cg];
    if (L(cgn) !== 'columns') continue;
    var cid = childText(cgn, 'id') || attr(cgn, 'id') || 'default';
    var cols = [];
    var colSize = parseInt(childText(cgn, 'size'), 10);
    if (!isNaN(colSize) && colSize > maxCols) maxCols = colSize;
    var colItems = elemChildren(cgn);
    for (var cci = 0; cci < colItems.length; cci++) {
      var it = colItems[cci];
      if (L(it) === 'columnsItem') {
        var idx = parseInt(childText(it, 'index'), 10) || 0;
        var colNode = childByName(it, 'column');
        var fmtIdx = parseInt(childText(colNode, 'formatIndex'), 10) || 0;
        var colFmt = resolvedFormats[String(fmtIdx)] || {};
        var colW = colFmt.width || defaultColWidth;
        cols[idx] = colW || defaultColWidth;
        if (idx + 1 > maxCols) maxCols = idx + 1;
      }
    }
    if (!isNaN(colSize) && colSize > 0) {
      for (var fill = 0; fill < colSize; fill++) {
        if (!cols[fill]) cols[fill] = defaultColWidth;
      }
    }
    columnsSets[cid] = cols;
  }

  var merges = [];
  var mergeNodes = root.getElementsByTagName('merge');
  for (var mi = 0; mi < mergeNodes.length; mi++) {
    var mn = mergeNodes[mi];
    var mr = parseInt(childText(mn, 'r'));
    if (isNaN(mr)) mr = 0;
    var mc = parseInt(childText(mn, 'c')) || 0;
    var mw = parseInt(childText(mn, 'w')) || 0;
    var mh = parseInt(childText(mn, 'h')) || 0;
    merges.push({ r: mr, c: mc, w: mw, h: mh });
  }

  var unmerges = [];
  var unmergeNodes = root.getElementsByTagName('verticalUnmerge');
  for (var ui = 0; ui < unmergeNodes.length; ui++) {
    var un = unmergeNodes[ui];
    var ur = parseInt(childText(un, 'r'));
    if (isNaN(ur)) ur = 0;
    var uc = parseInt(childText(un, 'c')) || 0;
    var uw = parseInt(childText(un, 'w')) || 0;
    var uh = parseInt(childText(un, 'h')) || 0;
    unmerges.push({ r: ur, c: uc, w: uw, h: uh });
  }

  var namedItems = [];
  var namedItemNodes = root.getElementsByTagName('namedItem');
  for (var nii = 0; nii < namedItemNodes.length; nii++) {
    var niNode = namedItemNodes[nii];
    var niName = childText(niNode, 'name');
    var area = childByName(niNode, 'area');
    if (area) {
      var beginRow = parseInt(childText(area, 'beginRow'), 10);
      var endRow = parseInt(childText(area, 'endRow'), 10);
      if (isNaN(beginRow)) beginRow = -1;
      if (isNaN(endRow)) endRow = -1;
      if (beginRow >= 0 && endRow >= 0 && beginRow > endRow) {
        var tmpRow = beginRow;
        beginRow = endRow;
        endRow = tmpRow;
      }

      namedItems.push({
        name: niName,
        type: childText(area, 'type') || 'Cells',
        beginRow: beginRow,
        endRow: endRow,
        beginColumn: parseInt(childText(area, 'beginColumn')) || -1,
        endColumn: parseInt(childText(area, 'endColumn')) || -1
      });
    }
  }

  var rows = [];
  var rowNodes = root.getElementsByTagName('rowsItem');
  for (var rni = 0; rni < rowNodes.length; rni++) {
    var rn = rowNodes[rni];
    var rIndex = parseInt(childText(rn, 'index'), 10) || 0;
    var rIndexTo = parseInt(childText(rn, 'indexTo'), 10);
    if (isNaN(rIndexTo) || rIndexTo < rIndex) rIndexTo = rIndex;
    var rowNode = childByName(rn, 'row');
    if (!rowNode) continue;

    var cid = childText(rowNode, 'columnsID') || 'default';
    var rowFmtIdx = parseInt(childText(rowNode, 'formatIndex'), 10) || 0;
    var rowFmt = resolvedFormats[String(rowFmtIdx)] || {};
    var rowH = rowFmt.height || 0;

    var cells = [];
    var cellIndex = 0;
    var rowChildren = elemChildren(rowNode);
    for (var rci = 0; rci < rowChildren.length; rci++) {
      var slot = rowChildren[rci];
      if (L(slot) !== 'c') continue;

      var iText = childText(slot, 'i');
      if (iText !== '') {
        cellIndex = parseInt(iText, 10);
        if (isNaN(cellIndex)) cellIndex = 0;
      }

      var cn = childByName(slot, 'c') || slot;
      var fIdx = parseInt(childText(cn, 'f'), 10);
      if (isNaN(fIdx)) fIdx = 0;
      var parameter = childText(cn, 'parameter');
      var detailParameter = childText(cn, 'detailParameter');
      var text = readCellText(childByName(cn, 'tl'), currentLang);

      cells[cellIndex] = {
        f: fIdx,
        text: text,
        parameter: parameter,
        detailParameter: detailParameter
      };

      if (cellIndex + 1 > maxCols) maxCols = cellIndex + 1;
      cellIndex++;
    }

    var rowData = {
      columnsID: cid,
      formatIndex: rowFmtIdx,
      height: rowH,
      empty: childText(rowNode, 'empty') === 'true',
      cells: cells
    };
    for (var rr = rIndex; rr <= rIndexTo; rr++) {
      rows[rr] = (rr === rIndex) ? rowData : {
        columnsID: cid,
        formatIndex: rowFmtIdx,
        height: rowH,
        empty: rowData.empty,
        cells: []
      };
    }
  }

  var rowCount = vgRows;
  if (!rowCount) {
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri] && ri + 1 > rowCount) rowCount = ri + 1;
    }
  }
  if (!rowCount) rowCount = rows.length || 1;

  for (var fillRi = 0; fillRi < rowCount; fillRi++) {
    if (!rows[fillRi]) {
      rows[fillRi] = { absent: true };
    }
  }

  var pictures = {};
  var drawings = [];

  function parsePictureBlock(pc) {
    if (!pc || L(pc) !== 'picture') return;
    var picIdx = parseInt(childText(pc, 'index'), 10);
    if (isNaN(picIdx)) picIdx = Object.keys(pictures).length;
    var picDataNode = childByName(pc, 'picture');
    if (!picDataNode) return;
    var picData = textOf(picDataNode).replace(/\s+/g, '');
    if (!picData) return;
    pictures[picIdx] = {
      data: picData,
      transparent: attr(picDataNode, 't') === 'true'
    };
  }

  function parseDrawingBlock(pc) {
    if (!pc || L(pc) !== 'drawing') return;
    if (childText(pc, 'drawingType') !== 'Picture') return;
    drawings.push({
      pictureIndex: parseInt(childText(pc, 'pictureIndex'), 10) || 1,
      pictureSize: childText(pc, 'pictureSize') || 'Stretch',
      beginRow: parseInt(childText(pc, 'beginRow'), 10) || 0,
      beginRowOffset: mxlHeightToDisplay(childText(pc, 'beginRowOffset')),
      endRow: parseInt(childText(pc, 'endRow'), 10) || 0,
      endRowOffset: mxlHeightToDisplay(childText(pc, 'endRowOffset')),
      beginColumn: parseInt(childText(pc, 'beginColumn'), 10) || 0,
      beginColumnOffset: parseInt(childText(pc, 'beginColumnOffset'), 10) || 0,
      endColumn: parseInt(childText(pc, 'endColumn'), 10) || 0,
      endColumnOffset: parseInt(childText(pc, 'endColumnOffset'), 10) || 0,
      zOrder: parseInt(childText(pc, 'zOrder'), 10) || 0
    });
  }

  for (var pi = 0; pi < rootChildren.length; pi++) {
    parsePictureBlock(rootChildren[pi]);
    parseDrawingBlock(rootChildren[pi]);
  }

  drawings.sort(function (a, b) { return a.zOrder - b.zOrder; });

  return {
    fonts: fonts,
    lines: lines,
    formats: formats,
    columnsSets: columnsSets,
    merges: merges,
    unmerges: unmerges,
    rows: rows,
    maxCols: maxCols,
    rowCount: rowCount,
    defaultFormatIndex: defaultFormatIndex,
    resolvedFormats: resolvedFormats,
    namedItems: namedItems,
    currentLang: currentLang,
    pictures: pictures,
    drawings: drawings,
    defaultColWidth: defaultColWidth
  };
}
