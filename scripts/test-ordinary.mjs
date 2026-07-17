import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { parseOrdinaryForm, labelColumnPattern, collectInputButtonAuditIssues } = await import('../webview/ordinary/ordinary-parser.js');
const { renderOrdinaryForm } = await import('../webview/ordinary/ordinary-render.js');
const { parseToolbarButton, parseToolbarBar, collectPanelBars } = await import('../webview/ordinary/ordinary-toolbar.js');

const forms = [
  '1CForms/FormsStandart/ПечатьЗаказаПокупателя.epf/Forms/Форма/Ext/form.data',
  '1CForms/FormsStandart/Номенклатура/Forms/ФормаЭлемента/Ext/form.data',
  '1CForms/FormsStandart/Номенклатура/Forms/ФормаСписка/Ext/form.data',
  '1CForms/FormsStandart/Номенклатура/Forms/ФормаГруппы/Ext/form.data',
  '1CForms/FormsStandart/Заказ/Forms/фрмДокумент/Ext/form.data',
  '1CForms/FormsStandart/Заказ/Forms/фрмВыбор/Ext/form.data',
  '1CForms/журнал/form.data',
  '1CForms/регистр2/form.data'
];

let failed = 0;

for (const rel of forms) {
  const filePath = path.join(root, rel);
  const text = fs.readFileSync(filePath, 'utf8');
  try {
    const form = parseOrdinaryForm(text);
    const html = renderOrdinaryForm(form, path.basename(rel));
    const ok = html.includes('of-window') && form.elements.length > 0;
    const counts = {};
    for (const el of form.elements) counts[el.kind] = (counts[el.kind] || 0) + 1;
    console.log((ok ? 'OK ' : 'FAIL') + '  ' + rel);
    console.log('      title="' + form.title + '" size=' + form.width + 'x' + form.height +
      ' elements=' + form.elements.length + ' ' + JSON.stringify(counts));
    if (!ok) failed++;
  } catch (e) {
    console.log('ERR ' + rel + '  ' + e.message);
    failed++;
  }
}

// Проверка расширенной модели кнопок
function tokenize(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let i = 0;
  const n = text.length;
  const skipWs = () => { while (i < n && ' \t\r\n'.includes(text[i])) i++; };
  const parseString = () => {
    i++;
    let o = '';
    while (i < n) {
      const ch = text[i];
      if (ch === '"') {
        if (text[i + 1] === '"') { o += '"'; i += 2; continue; }
        i++;
        break;
      }
      o += ch;
      i++;
    }
    return { s: o };
  };
  const parseAtom = () => {
    const s = i;
    while (i < n && ',{} \t\r\n'.indexOf(text[i]) < 0) i++;
    return text.slice(s, i);
  };
  const parseList = () => {
    i++;
    const items = [];
    while (i < n) {
      skipWs();
      const ch = text[i];
      if (ch === '}') { i++; break; }
      if (ch === ',') { i++; continue; }
      if (ch === '{') { items.push(parseList()); continue; }
      if (ch === '"') { items.push(parseString()); continue; }
      const a = parseAtom();
      if (a !== '') items.push(a);
      else i++;
    }
    return items;
  };
  skipWs();
  return parseList();
}

function findButton(tree, name) {
  if (!Array.isArray(tree)) return null;
  if (tree[0] === '8' && tree[1]?.s === name) return tree;
  for (const ch of tree) {
    const hit = findButton(ch, name);
    if (hit) return hit;
  }
  return null;
}

const docPath = path.join(root, '1CForms/FormsStandart/Заказ/Forms/фрмДокумент/Ext/form.data');
const docTree = tokenize(fs.readFileSync(docPath, 'utf8'));
const copyBtn = parseToolbarButton(findButton(docTree, 'кнКопировать'));
const offBtn = parseToolbarButton(findButton(docTree, 'кнВставить77'));
const ctxBtn = parseToolbarButton(findButton(docTree, 'кнЗаполнитьИзОснований'));
const groupPath = path.join(root, '1CForms/FormsStandart/Номенклатура/Forms/ФормаГруппы/Ext/form.data');
const groupTree = tokenize(fs.readFileSync(groupPath, 'utf8'));
const menuBtn = parseToolbarButton(findButton(groupTree, 'Подменю'));

const docForm = parseOrdinaryForm(fs.readFileSync(docPath, 'utf8'));
const docHtml = renderOrdinaryForm(docForm, 'фрмДокумент');

const zakazPath = path.join(root, '1CForms/FormsStandart/Заказ/Forms/фрмЗаказПоставщику/Ext/form.data');
const zakazForm = parseOrdinaryForm(fs.readFileSync(zakazPath, 'utf8'));
const zakazHtml = renderOrdinaryForm(zakazForm, 'фрмЗаказПоставщику');

function elBindings(html, name) {
  const re = new RegExp(
    '<div[^>]*data-of-props="[^"]*Имя: ' + name + '[^"]*"[^>]*data-of-bindings="([^"]+)"'
  );
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(
    '<div[^>]*data-of-bindings="([^"]+)"[^>]*data-of-props="[^"]*Имя: ' + name
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function findElement(form, name, kind) {
  function walk(els) {
    for (const el of els || []) {
      if (el.name === name && (!kind || el.kind === kind)) return el;
      if (el.children) {
        const r = walk(el.children);
        if (r) return r;
      }
    }
    return null;
  }
  return walk(form.elements);
}

function findPanelButtons(form, panelName) {
  function walk(els) {
    for (const el of els || []) {
      if (el.name === panelName && el.kind === 'commandPanel') return el.buttons || [];
      if (el.children) {
        const r = walk(el.children);
        if (r) return r;
      }
    }
    return null;
  }
  return walk(form.elements) || [];
}

const rowBtns = findPanelButtons(docForm, 'панельСтроки');
const dopBtn = rowBtns.find((b) => b.name === 'кнОбработка');

const checks = [
  ['кнКопировать.cmdId', copyBtn?.cmdId === 2856],
  ['кнКопировать.commandLinked', copyBtn?.commandLinked === true],
  ['кнВставить77.enabled', offBtn?.enabled === false],
  ['кнЗаполнитьИзОснований.contextual', ctxBtn?.contextual === true],
  ['Подменю без 1e2.kind', menuBtn?.kind === 1 && menuBtn?.submenu === true],
  ['Подменю.cmdId', menuBtn?.cmdId === 335],
  ['фГотов → закладки p0+p1', elBindings(docHtml, 'фГотов') === 'p0:0,p1:0'],
  ['Собран2 → закладки p0+p1', elBindings(docHtml, 'Собран2') === 'p0:0,p1:0'],
  ['пСклад2 → закладка p0', elBindings(docHtml, 'пСклад2') === 'p0:0'],
  ['кнСправка iconText', parseToolbarButton(findButton(docTree, 'кнСправка'))?.presentation === 'iconText'],
  ['кнОк iconText', parseToolbarButton(findButton(docTree, 'кнОк'))?.presentation === 'iconText'],
  ['кнЗакрыть iconText', parseToolbarButton(findButton(docTree, 'кнЗакрыть'))?.presentation === 'iconText'],
  ['кнКопировать (таблица) icon', parseToolbarButton(findButton(docTree, 'кнКопировать'))?.presentation === 'icon'],
  ['кнСправка в HTML', docHtml.includes('of-cmd-btn-mix') && docHtml.includes('of-cmd-btn-label') && docHtml.includes('Справка')],
  ['кнСортировка icon', parseToolbarButton(findButton(docTree, 'кнСортировка'))?.presentation === 'icon'],
  ['кнОбработка submenu', dopBtn?.presentation === 'submenu'],
  ['кнОбработка меню', dopBtn?.children?.some((c) => /Артикул/i.test(c.caption || '')) === true],
  ['кнОбработка без дублей', !rowBtns.some((b) => b.name === 'Действие9')],
  ['Дополнительно popup', docHtml.includes('of-submenu-wrap') && docHtml.includes('Сортировать по Артикулу')],
  ['закладки с картинкой', (() => {
    const tabs = findElement(docForm, 'панельЗакладки', 'group');
    return tabs?.pagePictures?.[0] === true && tabs?.pagePictures?.[1] === true;
  })()],
  ['кнПересчет картинка', findElement(docForm, 'кнПересчет', 'button')?.hasPicture === true],
  ['точка на закладке', docHtml.includes('of-tab-ico') && docHtml.includes('of-ico-dot')],
  ['точка на кнопке', docHtml.includes('of-btn-ico') && docHtml.includes('Имя: кнПересчет')],
  ['кнЗадача шрифт подписи', (() => {
    const btn = findElement(docForm, 'кнЗадача', 'button');
    const m = docHtml.match(/Имя: кнЗадача[\s\S]*?of-btn-label" style="([^"]+)"/);
    return btn?.buttonStyle?.fontSize === 14 &&
      m?.[1]?.includes('font-size:14px') &&
      !docHtml.match(/Имя: кнЗадача[\s\S]*?class="of-el of-button" style="[^"]*font-size/);
  })()],
  ['iconText без точки на обёртке', !docHtml.includes('of-tbl-btn-text of-tbl-ico-dot')],
  ['свойства Номер', /data-of-props="[^"]*Имя: Номер/.test(docHtml)],
  ['свойства кнопки', /data-of-props="[^"]*Имя: кнСправка/.test(docHtml)],
  ['скрытая закладка', (() => {
    const tabs = findElement(docForm, 'панельЗакладки', 'group');
    const hasHidden = tabs?.pageHidden?.some((h) => h) === true;
    return hasHidden && docHtml.includes('of-tab-hidden') && docHtml.includes('of-vis-mark-hidden');
  })()],
  ['условная видимость в HTML', docHtml.includes('of-tbl-btn-ctx') && docHtml.includes('Видимость: условная')],
  ['cmd-панель условная', (() => {
    const btn = findPanelButtons(docForm, 'панельКнопки').find((b) => b.name === 'кнОтправитьЗаявки');
    return btn?.contextual === true && docHtml.includes('of-cmd-btn-ctx');
  })()],
  ['легенда видимости', docHtml.includes('of-vis-legend') && docHtml.includes('скрыто')],
  ['скрытая колонка Картинка', (() => {
    const drv = findElement(docForm, 'дрвДокументы', 'table');
    const col = drv?.columns?.find((c) => c.title === 'Картинка');
    return col?.visible === false && col?.name === 'Картинка' &&
      docHtml.includes('of-tbl-col-hidden') && docHtml.includes('Видимость: скрыта в 1С');
  })()],
  ['колонка условная EDI', (() => {
    const stroki = findElement(docForm, 'Строки', 'table');
    const col = stroki?.columns?.find((c) => c.title === 'К отгрузке (EDI)');
    return col?.visible === false && col?.name === 'колОтгрузка';
  })()],
  ['тип колонки Артикул', (() => {
    const stroki = findElement(docForm, 'Строки', 'table');
    const col = stroki?.columns?.find((c) => c.title === 'Артикул');
    return col?.pattern?.kind === 'S' && labelColumnPattern(col.pattern).includes('Строка');
  })()],
  ['динамические надписи без курсива', (() => {
    const names = ['надписьЗаголовок', 'нАкции'];
    return names.every((name) => {
      const lbl = findElement(docForm, name, 'label');
      const re = new RegExp(
        'class="of-el of-label[^"]*" style="([^"]*)"[^>]*data-of-props="[^"]*Имя: ' + name
      );
      const m = docHtml.match(re);
      return lbl?.labelStyle?.dynamicCaption === true &&
        lbl?.labelStyle?.font?.italic !== true &&
        m && !m[1].includes('font-style:italic') &&
        !docHtml.includes('of-label-ph-dynamic">' + name) &&
        docHtml.includes('&lt;&lt;' + name + '&gt;&gt;');
    });
  })()],
  ['надписи чёрный текст', (() => {
    const names = ['надписьЗаголовок', 'нВремя', 'нОт', 'надписьКлиентПримечание'];
    return names.every((name) => {
      const lbl = findElement(docForm, name, 'label');
      const re = new RegExp(
        'data-of-props="[^"]*Имя: ' + name + '[^"]*"'
      );
      const m = docHtml.match(re);
      const start = m ? docHtml.lastIndexOf('<div', docHtml.indexOf(m[0])) : -1;
      const chunk = start >= 0 ? docHtml.slice(start, start + 600) : '';
      return lbl && lbl.labelStyle?.textColor == null && lbl.labelStyle?.font?.color == null &&
        !chunk.includes('color:rgb(0,0,204)');
    });
  })()],
  ['надписьЗаголовок стиль', (() => {
    const lbl = findElement(docForm, 'надписьЗаголовок', 'label');
    const zakLbl = findElement(zakazForm, 'надписьЗаголовок', 'label');
    const blockRe = /class="of-el of-label of-label-dynamic of-label-bold" style="[^"]*font-weight:bold;justify-content:flex-end[^"]*"[^>]*data-of-props="[^"]*надписьЗаголовок/;
    return lbl?.labelStyle?.font?.bold === true &&
      lbl?.labelStyle?.fontSize === 11 &&
      lbl?.labelStyle?.dynamicCaption === true &&
      lbl?.labelStyle?.horzAlign === 2 &&
      lbl?.labelStyle?.vertAlign === 1 &&
      lbl?.labelStyle?.textColor == null &&
      lbl?.labelStyle?.font?.color == null &&
      lbl?.caption === '' &&
      zakLbl?.labelStyle?.dynamicCaption === true &&
      blockRe.test(docHtml) &&
      docHtml.includes('of-label-ph-dynamic') &&
      docHtml.includes('&lt;&lt;надписьЗаголовок&gt;&gt;') &&
      zakazHtml.includes('&lt;&lt;надписьЗаголовок&gt;&gt;') &&
      !docHtml.includes("font-family:'MS Sans Serif'");
  })()],
  ['надписи без pt', !docHtml.includes('font-size:11pt')],
  ['кнСостояние dropdown', (() => {
    const btn = findElement(zakazForm, 'кнСостояние', 'button');
    return btn?.buttonStyle?.dropdown === true &&
      btn?.buttonStyle?.backColor === 'rgb(190,234,234)' &&
      btn?.buttonStyle?.font?.bold === true &&
      zakazHtml.includes('of-button-drop') &&
      zakazHtml.includes('of-button-drop-arr') &&
      zakazHtml.includes('&lt;&lt;кнСостояние&gt;&gt;') &&
      !zakazHtml.includes('of-button-drop-text">Состояние<');
  })()],
  ['кнСостояние размер и фон', (() => {
    const btn = findElement(docForm, 'кнСостояние', 'button');
    const lbl = findElement(docForm, 'нСостояние', 'label');
    const m = docHtml.match(
      /class="of-el of-button of-button-drop" style="([^"]*)"[^>]*data-of-props="[^"]*Имя: кнСостояние/
    );
    const style = m ? m[1] : '';
    return btn?.geom?.width === 138 &&
      lbl?.geom?.width === 126 &&
      btn?.geom?.width - lbl?.geom?.width === 12 &&
      btn?.buttonStyle?.fontSize === 14 &&
      btn?.buttonStyle?.backColor === 'rgb(190,234,234)' &&
      style.includes('width:138px') &&
      style.includes('background-color:rgb(190,234,234)') &&
      style.includes('font-size:14px');
  })()],
  ['нСостояние не дублирует', (() => {
    const lbl = findElement(zakazForm, 'нСостояние', 'label');
    return lbl?.overlayHidden === true && lbl?.overlayHiddenBy === 'кнСостояние';
  })()],
  ['нСостояние тёмный текст', (() => {
    const lbl = findElement(docForm, 'нСостояние', 'label');
    return lbl?.labelStyle?.backColor === 'rgb(190,234,234)' &&
      lbl?.labelStyle?.textColor === 'rgb(49,49,1)' &&
      lbl?.labelStyle?.font?.bold === true;
  })()],
  ['Дата календарь', (() => {
    const inp = findElement(zakazForm, 'Дата', 'input');
    return inp?.inputButtons?.includes('calendar') &&
      zakazHtml.includes('of-input-btn-calendar') &&
      inp?.inputStyle?.dateFormat === 'dd.MM.yy';
  })()],
  ['времяС без кнопок', (() => {
    const inp = findElement(docForm, 'времяС', 'input');
    return inp?.inputButtons?.length === 0 &&
      inp?.inputStyle?.pattern?.kind === 'D' &&
      inp?.inputStyle?.pattern?.args?.includes('T');
  })()],
  ['времяПо без кнопок', (() => {
    const inp = findElement(docForm, 'времяПо', 'input');
    return inp?.inputButtons?.length === 0;
  })()],
  ['видДоставки подписи', (() => {
    const caps = ['видДоставки', 'видДоставки1', 'видДоставки2', 'видДоставки3']
      .map((n) => findElement(docForm, n, 'radio')?.caption);
    return caps[0] === 'По адресу клиента:' &&
      caps[1] === 'Через ТК:' &&
      caps[2] === 'Перегруз: адрес' &&
      caps[3] === 'Самовывоз' &&
      docHtml.includes('По адресу клиента:') &&
      docHtml.includes('Самовывоз');
  })()],
  ['Водитель выбор', (() => {
    const inp = findElement(docForm, 'Водитель', 'input');
    return inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('search') &&
      docHtml.includes('[Водитель]') &&
      docHtml.includes('of-input-btn-select');
  })()],
  ['Машина без кнопок', (() => {
    const inp = findElement(docForm, 'Машина', 'input');
    return inp?.inputButtons?.length === 0;
  })()],
  ['Скидка без кнопок', (() => {
    const inp = findElement(zakazForm, 'Скидка', 'input');
    return inp?.inputButtons?.length === 0 &&
      !inp?.inputStyle?.auxButton &&
      !zakazHtml.match(/Имя: Скидка[^"]*"[^>]*of-input-btn/);
  })()],
  ['курсДоллара калькулятор', (() => {
    const inp = findElement(docForm, 'курсДоллара', 'input');
    return inp?.inputButtons?.includes('calculator') &&
      inp?.inputStyle?.auxButton === 'calculator' &&
      docHtml.includes('of-input-btn-calculator');
  })()],
  ['курсЕвро калькулятор', (() => {
    const inp = findElement(zakazForm, 'курсЕвро', 'input');
    return inp?.inputButtons?.includes('calculator');
  })()],
  ['аудит кнопок полей ввода', (() => {
    const issues = [
      ...collectInputButtonAuditIssues(docForm),
      ...collectInputButtonAuditIssues(zakazForm),
      ...collectInputButtonAuditIssues(parseOrdinaryForm(
        fs.readFileSync(path.join(root, '1CForms/FormsStandart/Номенклатура/Forms/ФормаЭлемента/Ext/form.data'), 'utf8')
      ))
    ];
    if (issues.length) console.log('      аудит:', issues.slice(0, 5).join('; '));
    return issues.length === 0;
  })()],
  ['Валюта выбор и поиск', (() => {
    const inp = findElement(zakazForm, 'Валюта', 'input');
    return inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('search') &&
      zakazHtml.includes('of-input-btn-search');
  })()],
  ['Цена выбор в таблице', (() => {
    const tbl = findElement(docForm, 'Строки', 'table');
    const col = tbl?.columns?.find((c) => c.name === 'Цена');
    return col?.inputButtons?.includes('select') &&
      !col?.inputButtons?.includes('search') &&
      docHtml.includes('of-tbl-cell-input') &&
      docHtml.includes('of-input-btn-select');
  })()],
  ['Номер без кнопок', (() => {
    const inp = findElement(zakazForm, 'Номер', 'input');
    return inp?.inputButtons?.length === 0 &&
      !zakazHtml.match(/Имя: Номер[^"]*"[^>]*of-input-btn/);
  })()],
  ['Кладовщик1 список и очистка', (() => {
    const inp = findElement(docForm, 'Кладовщик1', 'input');
    return inp?.inputButtons?.length === 2 &&
      inp?.inputButtons?.includes('list') &&
      inp?.inputButtons?.includes('clear') &&
      !inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('search') &&
      docHtml.includes('of-input-btn-clear') &&
      docHtml.includes('of-input-btn-list');
  })()],
  ['Кладовщик2 список и очистка', (() => {
    const inp = findElement(docForm, 'Кладовщик2', 'input');
    return inp?.inputButtons?.length === 2 &&
      inp?.inputButtons?.includes('list') &&
      inp?.inputButtons?.includes('clear') &&
      !inp?.inputButtons?.includes('select');
  })()],
  ['Склад без очистки', (() => {
    const inp = findElement(docForm, 'Склад', 'input');
    return inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('clear');
  })()],
  ['Склад заказ без кнопок', (() => {
    const inp = findElement(zakazForm, 'Склад', 'input');
    return inp?.inputButtons?.length === 0;
  })()],
  ['выбор как три точки', docHtml.includes('of-input-dots') && findElement(docForm, 'Договор', 'input')?.inputButtons?.includes('select')],
  ['поле Номер с именем', zakazHtml.includes('[Номер]')],
  ['типУпаковки список', (() => {
    const inp = findElement(docForm, 'типУпаковки', 'input');
    return inp?.inputButtons?.includes('list') &&
      !inp?.inputButtons?.includes('select') &&
      docHtml.includes('of-input-btn-list');
  })()],
  ['ГруппаОтгрузки выбор', (() => {
    const inp = findElement(docForm, 'ГруппаОтгрузки', 'input');
    return inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('list') &&
      docHtml.includes('of-input-dots') &&
      docHtml.includes('[ГруппаОтгрузки]');
  })()],
  ['Клиент выбор и поиск', (() => {
    const inp = findElement(docForm, 'Клиент', 'input');
    return inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('list') &&
      docHtml.includes('[Клиент]') &&
      docHtml.includes('of-input-btn-search');
  })()],
  ['Подразделение список и поиск', (() => {
    const inp = findElement(docForm, 'Подразделение', 'input');
    return inp?.inputButtons?.includes('list') &&
      inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('select') &&
      docHtml.includes('of-input-btn-list') &&
      docHtml.includes('of-input-btn-search');
  })()],
  ['Договор список и выбор', (() => {
    const inp = findElement(docForm, 'Договор', 'input');
    return inp?.inputButtons?.includes('list') &&
      inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('search') &&
      docHtml.includes('[Договор]');
  })()],
  ['Менеджер только выбор', (() => {
    const inp = findElement(docForm, 'Менеджер', 'input');
    const i = docHtml.indexOf('Имя: Менеджер');
    const chunk = i >= 0 ? docHtml.slice(i, i + 500) : '';
    return inp?.inputButtons?.length === 1 &&
      inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('clear') &&
      chunk.includes('[Менеджер]') &&
      chunk.includes('of-input-dots') &&
      !chunk.includes('of-input-btn-search');
  })()],
  ['Менеджер заказ выбор и поиск', (() => {
    const inp = findElement(zakazForm, 'Менеджер', 'input');
    return inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('list') &&
      zakazHtml.includes('[Менеджер]') &&
      zakazHtml.includes('of-input-btn-search') &&
      zakazHtml.includes('of-input-dots');
  })()],
  ['ТранспортнаяКомпания выбор и очистка', (() => {
    const inp = findElement(docForm, 'ТранспортнаяКомпания', 'input');
    return inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('clear') &&
      !inp?.inputButtons?.includes('search') &&
      docHtml.includes('[ТранспортнаяКомпания]') &&
      docHtml.includes('of-input-dots') &&
      docHtml.includes('of-input-btn-clear');
  })()],
  ['сумЭкспертиза поиск', (() => {
    const inp = findElement(docForm, 'сумЭкспертиза', 'input');
    return inp?.inputButtons?.length === 1 &&
      inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('select') &&
      docHtml.includes('[сумЭкспертиза]') &&
      docHtml.includes('of-input-btn-search');
  })()],
  ['Письмо поиск', (() => {
    const inp = findElement(docForm, 'Письмо', 'input');
    return inp?.inputButtons?.length === 1 &&
      inp?.inputButtons?.includes('search') &&
      !inp?.inputButtons?.includes('select') &&
      docHtml.includes('[Письмо]') &&
      docHtml.includes('of-input-btn-search');
  })()],
  ['заголовок рамки Продавец', (() => {
    const grp = findElement(docForm, 'рамкаФирма', 'group');
    const m = docHtml.match(/of-group-cap" style="([^"]*)"[^>]*>Продавец:</);
    return grp?.caption === 'Продавец:' &&
      grp?.groupCaptionStyle?.fontSize === 8 &&
      grp?.groupCaptionStyle?.top === 1 &&
      grp?.groupCaptionStyle?.left === 4 &&
      grp?.groupCaptionStyle?.bold === true &&
      grp?.groupCaptionStyle?.underline === true &&
      m?.[1]?.includes('font-weight:bold') &&
      m?.[1]?.includes('text-decoration:underline') &&
      !docHtml.includes('of-group-cap" style="font-size:8px');
  })()],
  ['заголовки рамок жирные и подчёркивание', (() => {
    const withUl = [
      ['рамкаФирма', 'Продавец:'],
      ['рамкаКлиент', 'Покупатель:'],
      ['рамкаВалюта', 'Валюта и курсы:'],
      ['рамкаЦены', 'Цены и скидки:']
    ];
    const noUl = [
      ['рамкаСостояние', 'Состояние'],
      ['рамкаДоставка', 'Доставка:']
    ];
    const okUl = withUl.every(([name, cap]) => {
      const grp = findElement(docForm, name, 'group');
      const m = docHtml.match(new RegExp('of-group-cap" style="([^"]*)"[^>]*>' + cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return grp?.groupCaptionStyle?.bold === true &&
        grp?.groupCaptionStyle?.underline === true &&
        m?.[1]?.includes('font-weight:bold') &&
        m?.[1]?.includes('text-decoration:underline');
    });
    const okNo = noUl.every(([name, cap]) => {
      const grp = findElement(docForm, name, 'group');
      const m = docHtml.match(new RegExp('of-group-cap" style="([^"]*)"[^>]*>' + cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return grp?.groupCaptionStyle?.bold === true &&
        grp?.groupCaptionStyle?.underline === false &&
        m?.[1]?.includes('font-weight:bold') &&
        m?.[1]?.includes('text-decoration:none');
    });
    return okUl && okNo;
  })()],
  ['нЛинк красный', (() => {
    const lbl = findElement(docForm, 'нЛинк', 'label');
    return lbl?.caption === 'Нет LINK-а на договор' &&
      lbl?.labelStyle?.textColor === 'rgb(255,0,0)' &&
      lbl?.labelStyle?.font?.bold === true &&
      docHtml.includes('Нет LINK-а на договор');
  })()],
  ['нАкции розовый', (() => {
    const lbl = findElement(docForm, 'нАкции', 'label');
    return lbl?.labelStyle?.dynamicCaption === true &&
      lbl?.labelStyle?.textColor === 'rgb(184,65,177)' &&
      docHtml.includes('&lt;&lt;нАкции&gt;&gt;');
  })()],
  ['Diadoc синий', (() => {
    const lbl = findElement(docForm, 'НадписьстатусDiadoc', 'label');
    return lbl?.caption === 'Diadoc:' &&
      lbl?.labelStyle?.textColor === 'rgb(0,0,204)' &&
      lbl?.labelStyle?.font?.bold === true &&
      docHtml.includes('Diadoc:');
  })()],
  ['Реализация флажок', (() => {
    const el = findElement(docForm, 'Реализация', 'checkbox');
    return el?.caption === 'На реализацию' &&
      el?.conditionalVisible === true &&
      docHtml.includes('На реализацию') &&
      docHtml.includes('Имя: Реализация') &&
      docHtml.includes('Видимость: условная (в 1С)');
  })()],
  ['перегрузАдрес выбор', (() => {
    const inp = findElement(docForm, 'перегрузАдрес', 'input');
    return inp?.inputButtons?.length === 1 &&
      inp?.inputButtons?.includes('select') &&
      !inp?.inputButtons?.includes('search') &&
      docHtml.includes('[перегрузАдрес]') &&
      docHtml.includes('of-input-dots');
  })()],
  ['СтавкаНДС список', (() => {
    const nomPath = path.join(root, '1CForms/FormsStandart/Номенклатура/Forms/ФормаЭлемента/Ext/form.data');
    const nomForm = parseOrdinaryForm(fs.readFileSync(nomPath, 'utf8'));
    const inp = findElement(nomForm, 'СтавкаНДС', 'input');
    return inp?.inputButtons?.includes('list') && !inp?.inputButtons?.includes('search');
  })()],
  ['статусDiadoc список', (() => {
    const el = findElement(docForm, 'статусDiadoc', 'radio');
    const lbl = findElement(docForm, 'НадписьстатусDiadoc', 'label');
    return el?.enumChoices?.join(',') === 'Не участвует,К отправке' &&
      el?.previewValue === 'Не участвует' &&
      lbl?.caption === 'Diadoc:' &&
      docHtml.includes('Не участвует') &&
      docHtml.includes('of-input-btn-list') &&
      !docHtml.match(/Имя: статусDiadoc[\s\S]*?of-radio-cap/);
  })()],
  ['НадписьКладовщик голубой', (() => {
    const names = ['НадписьКладовщик1', 'НадписьКладовщик2'];
    return names.every((name) => {
      const lbl = findElement(docForm, name, 'label');
      const m = docHtml.match(
        new RegExp('style="([^"]*)"[^>]*data-of-props="[^"]*Имя: ' + name)
      );
      return lbl?.caption?.includes('Кладовщик') &&
        lbl?.labelStyle?.textColor === 'rgb(0,0,204)' &&
        m?.[1]?.includes('color:rgb(0,0,204)');
    });
  })()],
  ['подвал колонки Опт', (() => {
    const tbl = findElement(zakazForm, 'спрТоварыСписок', 'table');
    const col = tbl?.columns?.find((c) => c.title === 'Опт');
    return col?.footerText === 'Остаток по плану Опта' &&
      zakazHtml.includes('of-tbl-foot') &&
      zakazHtml.includes('Остаток по плану Опта');
  })()],
  ['подвал Итого табПродажи90', (() => {
    const tbl = findElement(docForm, 'табПродажи90', 'table');
    const col = tbl?.columns?.find((c) => c.title === 'Товар' || c.name === 'Товар');
    return col?.footerText === 'Итого:' &&
      docHtml.includes('Итого:') &&
      docHtml.includes('of-tbl-foot');
  })()],
  ['подвал Итого Строки', (() => {
    const tbl = findElement(docForm, 'Строки', 'table');
    const col = tbl?.columns?.find((c) => c.title === 'Товар' || c.name === 'Товар');
    return col?.footerText === 'Итого:';
  })()],
  ['подвал Арт. поставщ.', (() => {
    const tbl = findElement(zakazForm, 'Строки', 'table');
    return tbl?.columns?.some((c) => c.title === 'Арт. поставщ.' && c.footerText === 'Артикул поставщика');
  })()]
];

const journalPath = path.join(root, '1CForms/журнал/form.data');
const journalForm = parseOrdinaryForm(fs.readFileSync(journalPath, 'utf8'));
const journalHtml = renderOrdinaryForm(journalForm, 'журнал');

const vyborPath = path.join(root, '1CForms/FormsStandart/Заказ/Forms/фрмВыбор/Ext/form.data');
const vyborHtml = renderOrdinaryForm(parseOrdinaryForm(fs.readFileSync(vyborPath, 'utf8')), 'фрмВыбор');
const vyborForm = parseOrdinaryForm(fs.readFileSync(vyborPath, 'utf8'));
const journalActionsBtns = findPanelButtons(journalForm, 'ДействияФормы');
const journalSubmenu = journalActionsBtns.find((b) => b.name === 'Подменю4');

const reg2Path = path.join(root, '1CForms/регистр2/form.data');
const reg2Form = parseOrdinaryForm(fs.readFileSync(reg2Path, 'utf8'));
const reg2Html = renderOrdinaryForm(reg2Form, 'регистр2');
const reg2ActionsBtns = findPanelButtons(reg2Form, 'ДействияФормы');
const reg2NewDocBtn = reg2ActionsBtns.find((b) => b.name === 'ВвестиНовыйДокумент');
const reg2Table = findElement(reg2Form, 'РегистрСведенийСписок', 'table');

checks.push(
  ['журнал ЖурналДокументовСписок колонки', (() => {
    const tbl = findElement(journalForm, 'ЖурналДокументовСписок', 'table');
    const titles = ['Картинка', 'Дата', 'Номер', 'Вид документа', 'Касса', 'Сумма'];
    const pic = tbl?.columns?.find((c) => c.name === 'Картинка');
    const textTitles = ['Дата', 'Номер', 'Вид документа', 'Касса', 'Сумма'];
    return tbl?.columns?.length >= 16 &&
      titles.every((t) => tbl.columns.some((c) => c.title === t)) &&
      textTitles.every((t) => journalHtml.includes('>' + t + '<')) &&
      pic?.headerTitleVisible === false && pic?.hasPicture === true &&
      !journalHtml.includes('of-tbl-col-hidden');
  })()],
  ['журнал Действия подменю', journalSubmenu?.caption === 'Действия' && journalSubmenu?.submenu === true],
  ['журнал Действия пункты', (() => {
    const kids = journalSubmenu?.children || [];
    return kids.some((c) => /Движения документа/i.test(c.caption || '')) &&
      kids.some((c) => /Структура подчиненности/i.test(c.caption || ''));
  })()],
  ['журнал Печать по умолчанию', journalActionsBtns.some((b) => b.name === 'ДействиеПечать' &&
    /Печать по умолчанию/i.test(b.caption || ''))],
  ['журнал тулбар HTML', journalHtml.includes('Движения документа по регистрам') &&
    journalHtml.includes('Структура подчиненности документа') &&
    journalHtml.includes('Печать по умолчанию')],
  ['журнал Организация кнопки', (() => {
    const inp = findElement(journalForm, 'Организация', 'input');
    const re = /data-of-props="[^"]*Имя: Организация[^"]*"/;
    const m = journalHtml.match(re);
    const start = m ? journalHtml.lastIndexOf('<div', journalHtml.indexOf(m[0])) : -1;
    const chunk = start >= 0 ? journalHtml.slice(start, start + 800) : '';
    return inp?.inputButtons?.length === 3 &&
      inp?.inputButtons?.includes('type') &&
      !inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('search') &&
      inp?.inputButtons?.includes('clear') &&
      journalHtml.includes('[Организация]') &&
      chunk.includes('of-input-btn-type') &&
      chunk.includes('>Т<') &&
      !chunk.includes('of-input-dots');
  })()],
  ['журнал Касса кнопки', (() => {
    const inp = findElement(journalForm, 'Касса', 'input');
    const re = /data-of-props="[^"]*Имя: Касса[^"]*"/;
    const m = journalHtml.match(re);
    const start = m ? journalHtml.lastIndexOf('<div', journalHtml.indexOf(m[0])) : -1;
    const chunk = start >= 0 ? journalHtml.slice(start, start + 800) : '';
    return inp?.inputButtons?.length === 3 &&
      inp?.inputButtons?.includes('type') &&
      !inp?.inputButtons?.includes('select') &&
      inp?.inputButtons?.includes('search') &&
      inp?.inputButtons?.includes('clear') &&
      journalHtml.includes('[Касса]') &&
      chunk.includes('of-input-btn-type') &&
      chunk.includes('>Т<');
  })()],
  ['регистр2 ВвестиНовыйДокумент', reg2NewDocBtn?.caption === 'Действия формы ввести новый документ'],
  ['регистр2 тулбар HTML', reg2Html.includes('Действия формы ввести новый документ')],
  ['регистр2 порядок колонок', (() => {
    const titles = reg2Table?.columns?.map((c) => c.title) || [];
    return titles.join('|') === 'Картинка|Регистратор|Период|Контрагент|ABC-класс покупателя';
  })()],
  ['регистр2 ширины колонок', (() => {
    const byName = Object.fromEntries((reg2Table?.columns || []).map((c) => [c.name, c.width]));
    return byName.Картинка === 32 && byName.Период === 132 && byName.Контрагент === 160 &&
      byName.ABC_КлассПокупателя === 120 && byName.Регистратор === 120;
  })()],
  ['регистр2 Картинка без текста заголовка', (() => {
    const col = reg2Table?.columns?.find((c) => c.name === 'Картинка');
    const labels = [...reg2Html.matchAll(/of-tbl-col-label[^>]*>([^<]*)</g)].map((m) => m[1]);
    return col?.headerTitleVisible === false && col?.hasPicture === true &&
      !labels.includes('Картинка') && reg2Html.includes('of-tbl-col-pic');
  })()],
  ['регистр2 заголовки колонок', (() => {
    const labels = [...reg2Html.matchAll(/of-tbl-col-label[^>]*>([^<]*)</g)].map((m) => m[1]);
    return ['Период', 'Контрагент', 'ABC-класс покупателя', 'Регистратор'].every((t) => labels.includes(t));
  })()],
  ['регистр2 Период дата', (() => {
    const col = reg2Table?.columns?.find((c) => c.name === 'Период');
    return col?.pattern?.kind === 'D' && col?.inputButtons?.includes('calendar');
  })()],
  ['свойства колонки', /of-tbl-col[^>]*data-of-props="[^"]*Колонка таблицы/.test(vyborHtml)],
  ['vybor скрытая Картинка', (() => {
    const t = vyborForm.elements.find((e) => e.kind === 'table');
    const col = t?.columns?.find((c) => c.title === 'Картинка');
    return col?.visible === false && vyborHtml.includes('of-tbl-col-hidden');
  })()]
);

for (const [label, ok] of checks) {
  console.log((ok ? 'OK ' : 'FAIL') + '  ' + label);
  if (!ok) failed++;
}

process.exit(failed > 0 ? 1 : 0);
