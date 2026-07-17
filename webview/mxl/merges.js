export function cellHasDisplayContent(cell) {
  if (!cell) return false;
  return !!(cell.text || cell.parameter || cell.detailParameter);
}

/** Строка явно задаёт две отдельные ячейки в диапазоне merge r=-1. */
export function rowSplitsGlobalMerge(row, merge) {
  if (!row || !row.cells) return false;
  var count = 0;
  for (var c = merge.c; c <= merge.c + merge.w; c++) {
    if (row.cells[c] !== undefined && cellHasDisplayContent(row.cells[c])) {
      count++;
    }
  }
  return count >= 2;
}

function buildUnmergeMap(unmerges) {
  var unmergeMap = {};
  (unmerges || []).forEach(function (u) {
    for (var r = u.r; r <= u.r + u.h; r++) {
      for (var c = u.c; c <= u.c + u.w; c++) {
        unmergeMap[r + ',' + c] = true;
      }
    }
  });
  return unmergeMap;
}

export function buildMergeMaps(mxlData) {
  if (mxlData._mergeMaps) return mxlData._mergeMaps;

  var rowCount = mxlData.rowCount || mxlData.rows.length || 1;
  var mergeMap = {};
  var cellMergeMeta = {};
  var unmergeMap = buildUnmergeMap(mxlData.unmerges);
  var rows = mxlData.rows || [];

  (mxlData.merges || []).forEach(function (m) {
    if (m.r === -1) {
      for (var r = 0; r < rowCount; r++) {
        if (unmergeMap[r + ',' + m.c]) continue;
        if (rowSplitsGlobalMerge(rows[r], m)) continue;
        for (var c = m.c; c <= m.c + m.w; c++) {
          mergeMap[r + ',' + c] = true;
        }
        cellMergeMeta[r + ',' + m.c] = {
          isMaster: true,
          colspan: m.w + 1,
          rowspan: m.h + 1
        };
      }
    } else {
      var hasUnmerge = false;
      for (var r = m.r; r <= m.r + m.h; r++) {
        if (unmergeMap[r + ',' + m.c]) {
          hasUnmerge = true;
          break;
        }
      }
      if (!hasUnmerge) {
        for (var r = m.r; r <= m.r + m.h; r++) {
          for (var c = m.c; c <= m.c + m.w; c++) {
            mergeMap[r + ',' + c] = true;
          }
        }
        cellMergeMeta[m.r + ',' + m.c] = {
          isMaster: true,
          colspan: m.w + 1,
          rowspan: m.h + 1
        };
      }
    }
  });

  var result = { mergeMap: mergeMap, cellMergeMeta: cellMergeMeta };
  mxlData._mergeMaps = result;
  return result;
}

export function findMergeAt(mxlData, row, col) {
  var maps = buildMergeMaps(mxlData);
  if (!maps.mergeMap[row + ',' + col]) return null;

  for (var key in maps.cellMergeMeta) {
    var parts = key.split(',');
    var masterRow = parseInt(parts[0], 10);
    var masterCol = parseInt(parts[1], 10);
    var meta = maps.cellMergeMeta[key];
    if (row >= masterRow && row <= masterRow + meta.rowspan - 1 &&
        col >= masterCol && col <= masterCol + meta.colspan - 1) {
      return {
        master: row === masterRow && col === masterCol,
        colspan: meta.colspan,
        rowspan: meta.rowspan,
        masterRow: masterRow,
        masterCol: masterCol
      };
    }
  }
  return null;
}
