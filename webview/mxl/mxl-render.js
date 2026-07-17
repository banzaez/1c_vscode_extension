import { esc } from './xml-utils.js';
import {
  appendCellTextCss,
  appendVerticalAlignCss,
  appendFontCss,
  appendIndentCss,
  appendBorderCss,
  formatMxlCellText,
  resolveCellFormat
} from './format.js';
import {
  getColWidths,
  getColCountForSet,
  colWidthAt,
  sumColWidths,
  buildMaxColWidths,
  rowHeightStyle,
  renderColHeaderRow,
  computeSheetLayout,
  buildNamedAreaModel,
  findAreaAtRow,
  buildGridTemplateRows,
  renderAreaGridItems,
  rowHeightInfoFromLayout,
  gridRowLine,
  computeDrawingRect,
  pictureObjectFit,
  resolveMxlPicture
} from './layout.js';
import { buildMergeMaps } from './merges.js';

export function renderMxl(mxlData, docName) {
  var html = '<div class="mxl-window">';
  html += '<div class="titlebar">';
  html += '<span class="tb-nav">⟵</span><span class="tb-nav">⟶</span>';
  html += '<span class="tb-star">☆</span>';
  html += '<span class="tb-title">' + esc(docName) + ' (Макет MXL)</span>';
  html += '<span class="tb-spacer"></span>';
  html += '<span class="tb-ico">⤢</span><span class="tb-ico">⋮</span>';
  html += '</div>';

  var rowCount = mxlData.rowCount || mxlData.rows.length || 1;
  var colCount = mxlData.maxCols;

  var mergeMaps = buildMergeMaps(mxlData);
  var mergeMap = mergeMaps.mergeMap;
  var cellMergeMeta = mergeMaps.cellMergeMeta;

  var areaModel = buildNamedAreaModel(mxlData);
  var hasRowGroups = areaModel.hasRowGroups;
  var visualRanges = areaModel.visualRanges || [];

  var sheetClass = hasRowGroups ? 'mxl-sheet has-groups' : 'mxl-sheet no-groups';
  var prevColID = null;
  var sectionCounter = -1;
  var sheetLayout = computeSheetLayout(mxlData, colCount, hasRowGroups, rowCount);
  var rowLayout = sheetLayout.rowLayout;
  var sheetStyle = 'width:' + sheetLayout.sheetWidth + 'px;min-width:100%';
  var rowMinStyle = 'min-width:' + sheetLayout.sheetWidth + 'px';
  var gridCols = hasRowGroups ? '90px minmax(0,1fr)' : 'minmax(0,1fr)';
  var gridRows = buildGridTemplateRows(rowCount, rowLayout);
  var dataCol = hasRowGroups ? 2 : 1;

  html += '<div class="mxl-body" style="--sheet-w:' + sheetLayout.sheetWidth + 'px;--sheet-h:' +
    sheetLayout.sheetHeight + 'px">';
  html += '<div class="mxl-scroll-bg" aria-hidden="true"></div>';

  html += '<div class="' + sheetClass + '" style="' + sheetStyle + '">';
  html += '<div class="mxl-sheet-grid" style="grid-template-columns:' + gridCols +
    ';grid-template-rows:' + gridRows + '">';

  if (hasRowGroups) {
    html += '<div class="mxl-named-area-hdr" style="grid-column:1;grid-row:1">Область</div>';
    html += renderAreaGridItems(visualRanges, rowCount, esc);
  }

  var headerColID = 'default';
  for (var hi = 0; hi < rowCount; hi++) {
    if (mxlData.rows[hi]) {
      headerColID = mxlData.rows[hi].columnsID || 'default';
      break;
    }
  }
  html += '<div class="mxl-grid-head" style="grid-column:' + dataCol + ';grid-row:1">';
  html += renderColHeaderRow(
    false,
    getColWidths(mxlData, headerColID),
    getColCountForSet(mxlData, headerColID),
    0,
    sheetLayout.maxTableWidth,
    rowMinStyle
  );
  html += '</div>';

  for (var r = 0; r < rowCount; r++) {
    var row = mxlData.rows[r];
    var colID = (row && row.columnsID) ? row.columnsID : 'default';
    if (colID !== prevColID) {
      sectionCounter++;
      prevColID = colID;
    }

    var rowHInfo = rowHeightInfoFromLayout(rowLayout, r);
    var area = findAreaAtRow(r, visualRanges);
    var areaAttr = area
      ? ' data-area="' + esc(area.name) + '" data-area-begin="' + area.beginRow +
        '" data-area-end="' + area.endRow + '"'
      : '';
    var rowGridStyle = 'grid-column:' + dataCol + ';grid-row:' + gridRowLine(r) + ';' +
      rowMinStyle + ';' + rowHeightStyle(rowHInfo);

    html += '<div class="mxl-data-row"' + areaAttr + ' data-section="' + sectionCounter +
      '" style="' + rowGridStyle + '">';
    html += '<div class="mxl-row-hdr" style="' + rowHeightStyle(rowHInfo) + '">' + (r + 1) + '</div>';

    var colWidths = getColWidths(mxlData, colID);
    var rowColCount = getColCountForSet(mxlData, colID);
    var rowTableWidth = sumColWidths(colWidths, 0, rowColCount);
    var tableStyle = 'width:' + rowTableWidth + 'px;' + rowHeightStyle(rowHInfo);

    html += '<div class="mxl-row-cells" style="width:' + sheetLayout.maxTableWidth + 'px;min-width:' +
      sheetLayout.maxTableWidth + 'px;' + rowHeightStyle(rowHInfo) + '">';
    html += '<table class="mxl-row-table" style="' + tableStyle + '"><colgroup>';
    for (var cc = 0; cc < rowColCount; cc++) {
      html += '<col style="width:' + colWidthAt(colWidths, cc) + 'px">';
    }
    html += '</colgroup><tr style="' + rowHeightStyle(rowHInfo) + '">';

    for (var c = 0; c < rowColCount; c++) {
      var cellKey = r + ',' + c;
      var isMerged = mergeMap[cellKey];
      var mergeInfo = cellMergeMeta[cellKey];

      if (isMerged && (!mergeInfo || !mergeInfo.isMaster)) {
        continue;
      }

      var cell = (row && row.cells) ? row.cells[c] : null;
      var format = resolveCellFormat(mxlData, cell);

      var styleStr = '';
      var tdAttributes = '';

      if (mergeInfo && mergeInfo.colspan > 1) {
        tdAttributes += ' colspan="' + mergeInfo.colspan + '"';
      }

      styleStr = appendVerticalAlignCss(styleStr, format);

      if (format.backColor) {
        styleStr += 'background-color:' + format.backColor + ';';
      }
      if (format.textColor) {
        styleStr += 'color:' + format.textColor + ';';
      }

      styleStr = appendFontCss(styleStr, format, mxlData.fonts);
      styleStr = appendIndentCss(styleStr, format);
      styleStr = appendBorderCss(styleStr, format, mxlData.lines);
      styleStr += rowHeightStyle(rowHInfo);

      var textStyle = appendCellTextCss('', format, cell);
      var styleAttr = styleStr ? ' style="' + styleStr + '"' : '';
      var cellText = formatMxlCellText(cell, format);

      html += '<td data-row="' + r + '" data-col="' + c + '"' + tdAttributes + styleAttr + '>' +
        '<span class="mxl-cell-text" style="' + textStyle + '">' + esc(cellText) + '</span></td>';
    }

    html += '</tr></table></div></div>';
  }

  html += '</div></div>';

  var drawingOverlayHtml = renderDrawingOverlay(
    mxlData,
    sheetLayout,
    hasRowGroups,
    colCount
  );
  if (drawingOverlayHtml) {
    html += drawingOverlayHtml;
  }

  html += '</div></div>';
  return html;
}

function renderDrawingOverlay(mxlData, sheetLayout, hasRowGroups, colCount) {
  var drawings = mxlData.drawings || [];
  if (!drawings.length) return '';

  var pictures = mxlData.pictures || {};
  var rowLayout = sheetLayout.rowLayout;
  var gutter = sheetLayout.gutter;
  var colWidths = buildMaxColWidths(mxlData.columnsSets || {}, colCount);
  var html = '<div class="mxl-drawing-overlay" style="height:' + rowLayout.totalHeight + 'px">';

  for (var i = 0; i < drawings.length; i++) {
    var drawing = drawings[i];
    var picture = resolveMxlPicture(pictures, drawing.pictureIndex);
    if (!picture || !picture.data) continue;

    var rect = computeDrawingRect(mxlData, drawing, rowLayout, colWidths);
    var fit = pictureObjectFit(drawing.pictureSize);
    var style = 'left:' + (gutter + rect.left) + 'px;' +
      'top:' + rect.top + 'px;' +
      'width:' + rect.width + 'px;' +
      'height:' + rect.height + 'px;' +
      'object-fit:' + fit + ';' +
      'z-index:' + (10 + (drawing.zOrder || 0)) + ';';

    html += '<img class="mxl-drawing-picture" alt="" draggable="false" data-drawing-index="' + i +
      '" style="' + style + '">';
  }

  html += '</div>';
  return html;
}
