export const MXL_DEFAULT_ROW_HEIGHT = 20;
export const MXL_DEFAULT_COL_WIDTH = 60;
export const MXL_EMPTY_ROW_HEIGHT = 4;
export const MXL_COL_HEADER_HEIGHT = 20;

export function rowColumnId(mxlData, r) {
  var row = mxlData.rows[r];
  return (row && row.columnsID) ? row.columnsID : 'default';
}

/** Границы именованных областей строк — строго beginRow/endRow из XML. */
export function resolveNamedAreaVisualRanges(rowNamedItems, rowCount) {
  if (!rowNamedItems.length) return [];
  var sorted = rowNamedItems.slice().sort(function (a, b) {
    return a.beginRow - b.beginRow;
  });
  return sorted.map(function (ni) {
    return {
      name: ni.name,
      anchorRow: ni.beginRow,
      beginRow: ni.beginRow,
      endRow: ni.endRow
    };
  });
}

export function isRowInNamedAreaRanges(rowIndex, ranges) {
  if (!ranges || !ranges.length) return false;
  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    if (rowIndex >= r.beginRow && rowIndex <= r.endRow) return true;
  }
  return false;
}

export function buildNamedAreaModel(mxlData) {
  var rowNamedItems = (mxlData.namedItems || []).filter(function (item) {
    return item.type === 'Rows' || item.beginColumn === -1;
  });
  rowNamedItems.sort(function (a, b) { return a.beginRow - b.beginRow; });

  var rowCount = mxlData.rowCount || mxlData.rows.length || 0;
  var visualRanges = resolveNamedAreaVisualRanges(rowNamedItems, rowCount);
  mxlData.namedAreaVisualRanges = visualRanges;

  var namedAreaMap = {};
  var namedAreaCells = {};
  visualRanges.forEach(function (area) {
    for (var r = area.beginRow; r <= area.endRow; r++) {
      namedAreaMap[r] = area.anchorRow;
    }
    namedAreaCells[area.anchorRow] = {
      name: area.name,
      beginRow: area.beginRow,
      endRow: area.endRow,
      rowspan: area.endRow - area.beginRow + 1
    };
  });

  return {
    hasRowGroups: rowNamedItems.length > 0,
    namedAreaMap: namedAreaMap,
    namedAreaCells: namedAreaCells,
    visualRanges: visualRanges
  };
}

export function countSectionHeadersInRange(mxlData, beginRow, endRow, rowCount) {
  var count = 0;
  var prevColID = null;
  for (var r = 0; r < rowCount; r++) {
    var colID = rowColumnId(mxlData, r);
    if (r > 0 && colID !== prevColID && r >= beginRow && r <= endRow) {
      count++;
    }
    prevColID = colID;
  }
  return count;
}

/** Позиции строк листа для overlay групп (только видимый верхний заголовок колонок). */
export function computeSheetRowLayout(mxlData, rowCount) {
  var rowTops = [];
  var rowHeights = [];
  var y = 0;
  var prevColID = null;
  var sectionIndex = 0;
  for (var r = 0; r < rowCount; r++) {
    var colID = rowColumnId(mxlData, r);
    if (colID !== prevColID) {
      if (sectionIndex === 0) {
        y += MXL_COL_HEADER_HEIGHT;
      }
      sectionIndex++;
    }
    rowTops[r] = y;
    var h = computeRowHeight(mxlData.rows[r], mxlData, r).px;
    rowHeights[r] = h;
    y += h;
    prevColID = colID;
  }
  return { rowTops: rowTops, rowHeights: rowHeights, totalHeight: y };
}

export function computeNamedAreaBlocks(namedAreaCells, rowTops, rowHeights) {
  var blocks = [];
  Object.keys(namedAreaCells).forEach(function (key) {
    var area = namedAreaCells[key];
    var beginRow = area.beginRow;
    var endRow = area.endRow;
    var top = rowTops[beginRow];
    if (top === undefined) return;
    var bottom = rowTops[endRow] + (rowHeights[endRow] || 0);
    blocks.push({
      name: area.name,
      top: top,
      height: bottom - top,
      beginRow: beginRow,
      endRow: endRow
    });
  });
  blocks.sort(function (a, b) { return a.top - b.top; });
  return blocks;
}

export function renderNamedAreaOverlay(blocks, totalHeight) {
  if (!blocks.length) return '';
  var html = '<div class="mxl-named-overlay" style="height:' + totalHeight + 'px">';
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    html += '<div class="mxl-named-area-block" style="top:' + b.top + 'px;height:' + b.height +
      'px" title="' + b.name + '" data-begin-row="' + b.beginRow + '">' + b.name + '</div>';
  }
  html += '</div>';
  return html;
}

export function renderNamedAreaGutter() {
  return '<div class="mxl-named-area-gutter"></div>';
}

function sumRowHeights(rowHeights, from, to) {
  var sum = 0;
  for (var r = from; r <= to; r++) sum += rowHeights[r] || 0;
  return sum;
}

export function findAreaAtRow(rowIndex, visualRanges) {
  if (!visualRanges) return null;
  for (var i = 0; i < visualRanges.length; i++) {
    var area = visualRanges[i];
    if (rowIndex >= area.beginRow && rowIndex <= area.endRow) return area;
  }
  return null;
}

/** Индекс строки CSS Grid (строка 1 — заголовок колонок). */
export function gridRowLine(dataRowIndex) {
  return dataRowIndex + 2;
}

/** grid-template-rows: заголовок + высоты строк из rowLayout. */
export function buildGridTemplateRows(rowCount, rowLayout) {
  var parts = [MXL_COL_HEADER_HEIGHT + 'px'];
  for (var r = 0; r < rowCount; r++) {
    parts.push((rowLayout.rowHeights[r] || MXL_DEFAULT_ROW_HEIGHT) + 'px');
  }
  return parts.join(' ');
}

/** Блоки областей и spacer'ы в колонке 1 сетки (grid-row совпадает со строками данных). */
export function renderAreaGridItems(visualRanges, rowCount, escFn) {
  var html = '';
  var covered = {};
  for (var i = 0; i < visualRanges.length; i++) {
    var area = visualRanges[i];
    var rowStart = gridRowLine(area.beginRow);
    var rowEnd = gridRowLine(area.endRow) + 1;
    for (var r = area.beginRow; r <= area.endRow; r++) covered[r] = true;
    html += '<div class="mxl-named-area-block" style="grid-column:1;grid-row:' + rowStart + '/' + rowEnd +
      '" title="' + escFn(area.name) + '" data-begin-row="' + area.beginRow + '" data-end-row="' +
      area.endRow + '">' + escFn(area.name) + '</div>';
  }
  for (var rr = 0; rr < rowCount; rr++) {
    if (!covered[rr]) {
      html += '<div class="mxl-area-spacer" style="grid-column:1;grid-row:' + gridRowLine(rr) + '"></div>';
    }
  }
  return html;
}

export function rowHeightInfoFromLayout(rowLayout, rowIndex) {
  return {
    px: rowLayout.rowHeights[rowIndex] || MXL_DEFAULT_ROW_HEIGHT,
    fixed: true
  };
}

export function getColWidths(mxlData, colID) {
  return mxlData.columnsSets[colID] || mxlData.columnsSets['default'] || [];
}

/** Число колонок в наборе columnsID (не глобальный maxCols листа). */
export function getColCountForSet(mxlData, colID) {
  var set = getColWidths(mxlData, colID);
  var max = 0;
  if (set && typeof set === 'object') {
    for (var i = 0; i < set.length; i++) {
      if (set[i] !== undefined && set[i] !== null && i + 1 > max) max = i + 1;
    }
    if (!max) {
      Object.keys(set).forEach(function (k) {
        var idx = parseInt(k, 10);
        if (!isNaN(idx) && idx + 1 > max) max = idx + 1;
      });
    }
  }
  return max > 0 ? max : (mxlData.maxCols || 1);
}

export function colWidthAt(colWidths, c, fallbackWidth) {
  if (colWidths[c]) return colWidths[c];
  return fallbackWidth > 0 ? fallbackWidth : MXL_DEFAULT_COL_WIDTH;
}

export function sumColWidths(colWidths, from, count) {
  var sum = 0;
  for (var i = from; i < from + count; i++) sum += colWidthAt(colWidths, i);
  return sum;
}

export function buildMaxColWidths(columnsSets, colCount) {
  var max = [];
  Object.keys(columnsSets).forEach(function (cid) {
    var cols = columnsSets[cid];
    for (var i = 0; i < colCount; i++) {
      var w = colWidthAt(cols, i);
      if (!max[i] || w > max[i]) max[i] = w;
    }
  });
  return max;
}

export function computeRowHeight(row, mxlData, rowIndex) {
  if (!row || row.absent) {
    return { px: MXL_DEFAULT_ROW_HEIGHT, fixed: true };
  }

  if (row.empty && !row.height) {
    return { px: MXL_EMPTY_ROW_HEIGHT, fixed: true };
  }

  if (row && row.height > 0) {
    return { px: row.height, fixed: true };
  }

  var maxFmtH = 0;
  var maxFontPt = 0;

  if (row && row.cells) {
    for (var i = 0; i < row.cells.length; i++) {
      var cell = row.cells[i];
      if (!cell) continue;
      var fmtIdx = cell.f ? cell.f : (mxlData.defaultFormatIndex || 0);
      var fmt = mxlData.resolvedFormats[String(fmtIdx)] || {};
      if (fmt.height > 0 && fmt.height > maxFmtH) maxFmtH = fmt.height;
      if (fmt.font !== undefined && mxlData.fonts[fmt.font]) {
        var pt = mxlData.fonts[fmt.font].size;
        if (pt > maxFontPt) maxFontPt = pt;
      }
    }
  }

  if (maxFmtH > 0) return { px: maxFmtH, fixed: true };

  if (maxFontPt > 0) {
    var lineH = Math.ceil(maxFontPt * 1.35) + 4;
    return {
      px: Math.max(MXL_DEFAULT_ROW_HEIGHT, lineH),
      fixed: false
    };
  }

  return { px: MXL_DEFAULT_ROW_HEIGHT, fixed: true };
}

export function rowHeightStyle(info) {
  if (info.fixed) {
    return 'height:' + info.px + 'px;min-height:' + info.px + 'px';
  }
  return 'min-height:' + info.px + 'px';
}

export function estimateRowHeight(mxlData, r) {
  return computeRowHeight(mxlData.rows[r], mxlData, r).px;
}

export function renderColHeaderRow(hasRowGroups, colWidths, colCount, sectionId, maxTableWidth, rowMinStyle) {
  var isSection = sectionId > 0;
  var rowWidth = sumColWidths(colWidths, 0, colCount);
  var cls = 'mxl-head-row' +
    (isSection ? ' mxl-colhdr-section mxl-section-hdr' : ' mxl-head-row-top');
  var attr = isSection ? ' data-section-hdr="' + sectionId + '"' : '';
  var style = rowMinStyle ? ' style="' + rowMinStyle + '"' : '';
  var html = '<div class="' + cls + '"' + attr + style + '>';
  if (hasRowGroups) {
    html += isSection
      ? '<div class="mxl-named-area-gutter mxl-named-area-gutter-hdr"></div>'
      : '<div class="mxl-named-area-hdr">Область</div>';
  }
  html += '<div class="mxl-corner-hdr"></div>';
  html += '<div class="mxl-colhdr-cells" style="width:' + maxTableWidth + 'px;min-width:' + maxTableWidth + 'px">';
  html += '<div class="mxl-colhdr-inner" style="width:' + rowWidth + 'px">';
  for (var c = 0; c < colCount; c++) {
    html += '<div class="mxl-col-hdr" style="width:' + colWidthAt(colWidths, c) + 'px">' + (c + 1) + '</div>';
  }
  html += '</div></div></div>';
  return html;
}

export function computeDrawingRect(mxlData, drawing, rowLayout, colWidths) {
  var r0 = drawing.beginRow;
  var r1 = drawing.endRow;
  var c0 = drawing.beginColumn;
  var c1 = drawing.endColumn;
  var beginRowOffset = drawing.beginRowOffset || 0;
  var endRowOffset = drawing.endRowOffset || 0;
  var beginColumnOffset = drawing.beginColumnOffset || 0;
  var endColumnOffset = drawing.endColumnOffset || 0;

  var top = MXL_COL_HEADER_HEIGHT;
  for (var r = 0; r < r0; r++) {
    top += rowLayout.rowHeights[r] || MXL_DEFAULT_ROW_HEIGHT;
  }
  top += beginRowOffset;

  var height;
  if (r0 === r1) {
    height = endRowOffset - beginRowOffset;
  } else {
    height = (rowLayout.rowHeights[r0] || MXL_DEFAULT_ROW_HEIGHT) - beginRowOffset;
    for (var rh = r0 + 1; rh < r1; rh++) {
      height += rowLayout.rowHeights[rh] || MXL_DEFAULT_ROW_HEIGHT;
    }
    height += endRowOffset;
  }

  var left = 0;
  for (var c = 0; c < c0; c++) {
    left += colWidthAt(colWidths, c);
  }
  left += beginColumnOffset;

  var width;
  if (c0 === c1) {
    width = endColumnOffset - beginColumnOffset;
  } else {
    width = colWidthAt(colWidths, c0) - beginColumnOffset;
    for (var cw = c0 + 1; cw < c1; cw++) {
      width += colWidthAt(colWidths, cw);
    }
    width += endColumnOffset;
  }

  return {
    top: top,
    left: left,
    width: Math.max(0, width),
    height: Math.max(0, height)
  };
}

export function pictureMimeFromData(data) {
  if (!data) return 'image/png';
  if (data.indexOf('iVBORw') === 0) return 'image/png';
  if (data.indexOf('/9j/') === 0) return 'image/jpeg';
  if (data.indexOf('R0lGOD') === 0) return 'image/gif';
  return 'image/png';
}

export function pictureObjectFit(pictureSize) {
  switch (pictureSize) {
    case 'Proportional': return 'contain';
    case 'Crop': return 'cover';
    case 'Tile': return 'fill';
    case 'AutoSize': return 'none';
    case 'Stretch':
    default: return 'fill';
  }
}

export function resolveMxlPicture(pictures, pictureIndex) {
  if (!pictures) return null;
  var zeroBased = pictureIndex - 1;
  if (pictures[zeroBased]) return pictures[zeroBased];
  if (pictures[pictureIndex]) return pictures[pictureIndex];
  if (pictures[String(zeroBased)]) return pictures[String(zeroBased)];
  if (pictures[String(pictureIndex)]) return pictures[String(pictureIndex)];
  return null;
}

export function computeSheetLayout(mxlData, colCount, hasRowGroups, rowCount) {
  var gutter = (hasRowGroups ? 90 : 0) + 40;
  var maxTable = 0;
  var sets = mxlData.columnsSets || {};
  var keys = Object.keys(sets);
  if (!keys.length) keys.push('default');
  for (var k = 0; k < keys.length; k++) {
    var w = sumColWidths(getColWidths(mxlData, keys[k]), 0, colCount);
    if (w > maxTable) maxTable = w;
  }
  if (!maxTable) maxTable = colCount * 60;

  var rowLayout = computeSheetRowLayout(mxlData, rowCount);
  var sheetHeight = rowLayout.totalHeight;

  return {
    gutter: gutter,
    maxTableWidth: maxTable,
    sheetWidth: gutter + maxTable,
    sheetHeight: sheetHeight,
    rowLayout: rowLayout
  };
}
