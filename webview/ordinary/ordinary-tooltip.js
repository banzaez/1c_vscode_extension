// Разбор data-of-props и HTML-подсказка при наведении.

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function propsLinesWithSections(sections) {
  var lines = [];
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    if (!sec || !sec.lines || !sec.lines.length) continue;
    if (lines.length && sec.title) lines.push('## ' + sec.title);
    for (var j = 0; j < sec.lines.length; j++) lines.push(sec.lines[j]);
  }
  return lines;
}

function parseKeyValue(line) {
  var idx = line.indexOf(': ');
  if (idx <= 0) return null;
  return { key: line.slice(0, idx), value: line.slice(idx + 2) };
}

function sectionForKey(key) {
  if (/^Видимость|^Скрыт|^Нажата|^Доступна/.test(key)) return 'visibility';
  if (/^Позиция$|^Размер$|^Закладка$|^Индекс/.test(key)) return 'geometry';
  if (/^Панель/.test(key)) return 'layout';
  if (/^Шрифт|^Размер шрифта|^Цвет|^Горизонталь|^Вертикаль|^Жирный|^Курсив|^Подчёркивание|^Зачёркивание|^Гиперссылка/.test(key)) {
    return 'style';
  }
  if (/^Таблица$|^Заголовок$|^Имя поля$|^Подвал$|^Колонок$|^Колонки$|^Скрытых колонок$/.test(key)) {
    return 'table';
  }
  if (/^Тип данных$|^Формат даты$|^Кнопки$|^Список значений$|^Пунктов меню$/.test(key)) {
    return 'data';
  }
  if (/^ID команды$|^Привязана|^Вид в превью$|^Тип$|^Режим отображения$|^Размер \/ стиль$|^Тулбар|^Статусная|^Страниц$|^Закладки$/.test(key)) {
    return 'meta';
  }
  return 'main';
}

var SECTION_TITLES = {
  main: 'Основное',
  data: 'Данные',
  style: 'Оформление',
  visibility: 'Видимость',
  geometry: 'Геометрия',
  layout: 'Размещение',
  table: 'Таблица',
  meta: 'Свойства'
};

var SECTION_ORDER = ['main', 'data', 'table', 'style', 'visibility', 'geometry', 'layout', 'meta'];

function formatValueHtml(key, value) {
  var v = String(value);
  if (v === 'да') return '<span class="of-tip-val of-tip-val-yes">да</span>';
  if (v === 'нет') return '<span class="of-tip-val of-tip-val-no">нет</span>';
  if (/условная|скрыта|неактивной/i.test(v)) {
    return '<span class="of-tip-val of-tip-val-warn">' + escapeHtml(v) + '</span>';
  }
  if ((key === 'Цвет текста' || key === 'Цвет фона') && /^rgb/i.test(v)) {
    return '<span class="of-tip-color"><span class="of-tip-swatch" style="background:' +
      escapeHtml(v) + '"></span>' + escapeHtml(v) + '</span>';
  }
  if (key === 'Размер' && /×/.test(v)) {
    return '<span class="of-tip-mono">' + escapeHtml(v) + '</span>';
  }
  if (key === 'Позиция') {
    return '<span class="of-tip-mono">' + escapeHtml(v) + '</span>';
  }
  return escapeHtml(v);
}

export function parsePropsText(text) {
  if (!text) return null;
  var rawLines = String(text).split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (!rawLines.length) return null;

  var title = rawLines[0];
  var subtitle = '';
  var caption = '';
  var explicitSections = [];
  var current = { title: '', rows: [] };

  function flush() {
    if (current.rows.length) explicitSections.push(current);
    current = { title: '', rows: [] };
  }

  for (var i = 1; i < rawLines.length; i++) {
    var line = rawLines[i];
    if (line.indexOf('## ') === 0) {
      flush();
      current = { title: line.slice(3), rows: [] };
      continue;
    }
    var kv = parseKeyValue(line);
    if (!kv) continue;
    if ((kv.key === 'Имя' || kv.key === 'Название') && !subtitle) subtitle = kv.value;
    else if (kv.key === 'Подпись' && kv.value !== subtitle) caption = kv.value;
    else if (kv.key === 'Заголовок' && !caption) caption = kv.value;
    current.rows.push(kv);
  }
  flush();

  var sections;
  if (explicitSections.length > 1 || (explicitSections.length === 1 && explicitSections[0].title)) {
    sections = explicitSections.map(function (sec) {
      return { title: sec.title || '', rows: sec.rows };
    });
  } else {
    var allRows = explicitSections.length ? explicitSections[0].rows : [];
    var buckets = {};
    for (var r = 0; r < allRows.length; r++) {
      var row = allRows[r];
      if (row.key === 'Имя' || row.key === 'Подпись' || row.key === 'Название') continue;
      var sid = sectionForKey(row.key);
      if (!buckets[sid]) buckets[sid] = [];
      buckets[sid].push(row);
    }
    sections = [];
    for (var s = 0; s < SECTION_ORDER.length; s++) {
      var id = SECTION_ORDER[s];
      if (!buckets[id] || !buckets[id].length) continue;
      sections.push({ title: SECTION_TITLES[id], rows: buckets[id] });
    }
  }

  if (!subtitle && caption) subtitle = caption;

  return { title: title, subtitle: subtitle, caption: caption, sections: sections };
}

function renderRows(rows) {
  if (!rows || !rows.length) return '';
  var html = '<dl class="of-tip-list">';
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    html += '<dt>' + escapeHtml(row.key) + '</dt>';
    html += '<dd>' + formatValueHtml(row.key, row.value) + '</dd>';
  }
  html += '</dl>';
  return html;
}

export function renderTooltipHtml(text) {
  var model = parsePropsText(text);
  if (!model) return '';

  var html = '<div class="of-tip">';
  html += '<div class="of-tip-head">';
  html += '<div class="of-tip-type">' + escapeHtml(model.title) + '</div>';
  if (model.subtitle) {
    html += '<div class="of-tip-name">' + escapeHtml(model.subtitle) + '</div>';
  }
  if (model.caption && model.caption !== model.subtitle) {
    html += '<div class="of-tip-caption">' + escapeHtml(model.caption) + '</div>';
  }
  html += '</div>';

  if (model.sections.length) {
    html += '<div class="of-tip-body">';
    for (var s = 0; s < model.sections.length; s++) {
      var sec = model.sections[s];
      if (!sec.rows.length) continue;
      html += '<div class="of-tip-section">';
      if (sec.title) html += '<div class="of-tip-section-title">' + escapeHtml(sec.title) + '</div>';
      html += renderRows(sec.rows);
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}
