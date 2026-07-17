import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { window } = new JSDOM('');
globalThis.DOMParser = window.DOMParser;

const { parseMxl, renderMxl } = await import('../webview/mxl/index.js');
const {
  buildNamedAreaModel,
  computeSheetRowLayout,
  computeNamedAreaBlocks
} = await import('../webview/mxl/layout.js');

const templates = [
  '1CForms/Templates.MXL/ПечатьПроверки/Ext/Template.xml',
  '1CForms/Templates.MXL/ПечатьСкладскогоЗаказа/Ext/Template.xml',
  '1CForms/Templates.MXL/ПечатьСкладскогоЗаказаСвод/Ext/Template.xml',
  '1CForms/НетПрав/Ext/Template.xml',
  '1CForms/FormsStandart/ПечатьЗаказаПокупателя.epf/Templates/ПроверкаСвод/Ext/Template.xml'
];

let failed = 0;

for (const rel of templates) {
  const filePath = path.join(root, rel);
  const xml = fs.readFileSync(filePath, 'utf8');
  try {
    const data = parseMxl(xml);
    const html = renderMxl(data, path.basename(rel));
    const ok = html.includes('mxl-window') && html.includes('mxl-row-table');
    const pictureOk = !data.drawings?.length ||
      (html.includes('mxl-drawing-picture') && html.includes('data-drawing-index'));
    const status = ok && pictureOk ? 'OK' : 'FAIL';
    const extra = data.drawings?.length
      ? '  drawings=' + data.drawings.length + ' pictures=' + Object.keys(data.pictures || {}).length
      : '';
    console.log(status + '  ' + rel + '  rows=' + data.rowCount + ' cols=' + data.maxCols + extra);
    if (!ok || !pictureOk) failed++;

    if (rel.includes('ПроверкаСвод')) {
      const checks = [
        data.rowCount === 24,
        data.maxCols === 11,
        data.namedItems.length === 5,
        Object.keys(data.columnsSets).length === 2,
        data.rows[2]?.cells[1]?.parameter === 'ШтрихКодЗаказ',
        data.rows[3]?.cells[0]?.detailParameter === 'Контрагент',
        data.rows[4]?.cells[0]?.text === '№ [Номер]',
        data.rows[1]?.height === 33,
        data.rows[18]?.empty === true
      ];
      if (!checks.every(Boolean)) {
        console.log('FAIL  ПроверкаСвод structure checks');
        failed++;
      }
    }

    if (rel.includes('ПечатьПроверки')) {
      const absentCount = data.rows.filter((r) => r?.absent).length;
      const areaModel = buildNamedAreaModel(data);
      const layout = computeSheetRowLayout(data, data.rowCount);
      const blocks = computeNamedAreaBlocks(
        areaModel.namedAreaCells,
        layout.rowTops,
        layout.rowHeights
      );
      const topByName = Object.fromEntries(blocks.map((b) => [b.name, b.top]));
      const rangeByName = Object.fromEntries(
        areaModel.visualRanges.map((r) => [r.name, [r.beginRow, r.endRow]])
      );
      const checks = [
        data.rowCount === 33,
        data.namedItems.length === 6,
        absentCount === 23,
        rangeByName['Заголовок']?.[0] === 1 && rangeByName['Заголовок']?.[1] === 1,
        rangeByName['Шапка']?.[0] === 3 && rangeByName['Шапка']?.[1] === 5,
        rangeByName['Товары']?.[0] === 9 && rangeByName['Товары']?.[1] === 9,
        rangeByName['Подвал']?.[0] === 11 && rangeByName['Подвал']?.[1] === 12,
        rangeByName['Место']?.[0] === 14 && rangeByName['Место']?.[1] === 15,
        topByName['Заголовок'] === 40,
        topByName['Шапка'] === 86,
        topByName['ТоварыШапка'] === 175,
        topByName['Товары'] === 215,
        topByName['Подвал'] === 255,
        html.includes('mxl-sheet-grid'),
        html.includes('mxl-named-area-block'),
        html.includes('grid-row:'),
        html.includes('data-area="Шапка"'),
        (html.match(/class="mxl-data-row"/g) || []).length === 33,
        (() => {
          const row = html.match(/data-row="4"[^]*?<\/tr>/);
          const cells = [...(row?.[0] || '').matchAll(/data-row="4" data-col="(\d+)"([^>]*)><span[^>]*>([^<]*)/g)];
          const byCol = Object.fromEntries(cells.map((m) => [m[1], { colspan: m[2].match(/colspan="(\d+)"/)?.[1], text: m[3] }]));
          return byCol['2']?.colspan === undefined && byCol['2']?.text === 'от' &&
            byCol['3']?.colspan === undefined && byCol['3']?.text?.includes('Дата');
        })()
      ];
      if (!checks.every(Boolean)) {
        console.log('FAIL  ПечатьПроверки named area layout', { absentCount, topByName, rangeByName });
        failed++;
      }
    }

    if (rel.includes('ПечатьСкладскогоЗаказа') && !rel.includes('Свод')) {
      const checks = [
        data.rowCount === 15,
        data.maxCols === 11,
        data.namedItems.length === 2,
        data.namedItems.some((n) => n.name === 'Шапка' && n.beginRow === 1 && n.endRow === 7),
        data.namedItems.some((n) => n.name === 'Товары' && n.beginRow === 8),
        data.rows[2]?.cells[0]?.parameter === 'Контрагент',
        data.rows[3]?.cells[0]?.text === '№ [Номер]',
        data.rows[7]?.cells[1]?.text === 'Номенклатура',
        data.rows[8]?.cells[2]?.parameter === 'КомментарийДляСкладскогоЗаказа',
        (() => {
          const m = html.match(/data-row="8" data-col="2"[^>]*><span class="mxl-cell-text" style="([^"]+)"/);
          return m && m[1].includes('white-space:nowrap') && m[1].includes('text-overflow:clip') &&
            m[1].includes('text-align:center');
        })(),
        data.merges.length === 4,
        html.includes('mxl-head-row-top'),
        !html.includes('mxl-colhdr-section'),
        html.includes('mxl-sheet-grid'),
        !html.includes('mxl-area-column')
      ];
      if (!checks.every(Boolean)) {
        console.log('FAIL  ПечатьСкладскогоЗаказа structure checks');
        failed++;
      }
    }
  } catch (e) {
    console.log('ERR ' + rel + '  ' + e.message);
    failed++;
  }
}

const shell = fs.readFileSync(path.join(root, 'webview_mxl.html'), 'utf8');
if (shell.includes('__MXL_APP_SCRIPT__') && !shell.includes('function parseMxl')) {
  console.log('OK  webview_mxl.html shell');
} else {
  console.log('FAIL  webview_mxl.html shell');
  failed++;
}

const modules = [
  'webview/mxl/xml-utils.js',
  'webview/mxl/colors.js',
  'webview/mxl/format.js',
  'webview/mxl/layout.js',
  'webview/mxl/merges.js',
  'webview/mxl/mxl-parser.js',
  'webview/mxl/mxl-render.js',
  'webview/mxl/cell-info.js',
  'webview/mxl/mxl-app.js',
  'webview/mxl/drawings.js'
];
for (const rel of modules) {
  if (fs.existsSync(path.join(root, rel))) {
    console.log('OK  ' + rel);
  } else {
    console.log('FAIL  missing ' + rel);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);
