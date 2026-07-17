var NAMED_COLORS = {
  // Системные цвета стиля 1С / Windows
  'gradientinactivecaption': '#d7e4f2',
  'inactivecaption': '#d7e4f2',
  'inactivecaptiontext': '#000000',
  'activecaption': '#0054e3',
  'middlegradientinactivecaption': '#bcccdd',
  'activetitlebar': '#0054e3',
  'activetitlebartext': '#ffffff',
  'inactivetitlebar': '#7a96df',
  'inactivetitlebartext': '#d8e4f8',
  'window': '#ffffff',
  'windowtext': '#000000',
  'windowframe': '#646464',
  'buttonface': '#f0f0f0',
  'buttonbackcolor': '#f0f0f0',
  'btnface': '#f0f0f0',
  'buttontext': '#000000',
  'buttonshadow': '#a0a0a0',
  'buttonhighlight': '#ffffff',
  'highlight': '#3399ff',
  'highlighttext': '#ffffff',
  'menu': '#f0f0f0',
  'menutext': '#000000',
  'graytext': '#6d6d6d',
  'scrollbar': '#c8c8c8',
  '3dface': '#f0f0f0',
  '3dshadow': '#a0a0a0',
  '3dhighlight': '#ffffff',
  // Цвета отчётов 1С
  'reportheaderbackcolor': '#e8eff7',
  'reportheadertextcolor': '#1a3c60',
  'reportgroup1backcolor': '#f0f4f8',
  'reportgroup2backcolor': '#fafbfd',
  'reportfooterbackcolor': '#eaeef3',
  'specialtextcolor': '#336699',
  'fieldbackcolor': '#ffffff',
  'fieldtextcolor': '#000000',
  'formbackcolor': '#ffffff',
  'formtextcolor': '#000000',
  'textcolor': '#000000',
  'borewcolor': '#000000',
  // Web-цвета, встречающиеся в макетах
  'lavender': '#e6e6fa',
  'white': '#ffffff',
  'black': '#000000',
  'red': '#ff0000',
  'green': '#008000',
  'blue': '#0000ff',
  'yellow': '#ffff00',
  'silver': '#c0c0c0',
  'gray': '#808080',
  'grey': '#808080',
  'whitesmoke': '#f5f5f5',
  'gainsboro': '#dcdcdc',
  'lightgray': '#d3d3d3',
  'lightgrey': '#d3d3d3'
};

function clamp255(n) {
  n = parseInt(n, 10);
  if (isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

function toHex2(n) {
  var h = clamp255(n).toString(16);
  return h.length === 1 ? '0' + h : h;
}

// Разбор RGB-цвета, заданного как "12,34,56" или "12 34 56"
export function rgbToHex(r, g, b) {
  return '#' + toHex2(r) + toHex2(g) + toHex2(b);
}

export function resolveColor(c) {
  if (!c) return '';
  c = String(c).trim();
  if (c.indexOf('#') === 0) return c;

  // Формат "r,g,b" или "r g b"
  var m = c.match(/^(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})$/);
  if (m) return rgbToHex(m[1], m[2], m[3]);

  // Убираем префикс пространства имён (style:, d3p1:, web:, windows: и т.п.)
  var key = c.replace(/^.*:/, '').toLowerCase();
  if (NAMED_COLORS.hasOwnProperty(key)) return NAMED_COLORS[key];

  // Неизвестный цвет — не подкрашиваем, чтобы не вносить артефакты
  return '';
}
