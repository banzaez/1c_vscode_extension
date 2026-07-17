import { parseMxl } from './mxl-parser.js';
import { renderMxl } from './mxl-render.js';
import { describeCell, renderCellPropsPanel } from './cell-info.js';
import { hydrateDrawingImages } from './drawings.js';

var vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
var stage = document.getElementById('stage');
var errbox = document.getElementById('errbox');
var loading = document.getElementById('loading');

function setLoading(on) {
  if (loading) loading.style.display = on ? 'flex' : 'none';
}
var propsPanel = document.getElementById('cell-props');
var appRoot = document.getElementById('app-root');
var currentMxlData = null;

function showError(msg) {
  errbox.style.display = 'block';
  errbox.textContent = msg;
  stage.innerHTML = '';
  hidePropsPanel();
  document.body.classList.add('has-error');
}

function clearError() {
  errbox.style.display = 'none';
  errbox.textContent = '';
  document.body.classList.remove('has-error');
}

function hidePropsPanel() {
  if (!propsPanel) return;
  propsPanel.classList.add('hidden');
  propsPanel.innerHTML = '';
  if (appRoot) appRoot.classList.remove('props-visible');
}

function showPropsPanel(sections) {
  if (!propsPanel) return;
  propsPanel.innerHTML = renderCellPropsPanel(sections);
  propsPanel.classList.remove('hidden');
  if (appRoot) appRoot.classList.add('props-visible');
}

function mount(xmlText, name) {
  clearError();
  hidePropsPanel();
  setLoading(true);
  requestAnimationFrame(function () {
    try {
      currentMxlData = parseMxl(xmlText);
      var docName = name ? name.replace(/\.[^.]+$/, '') : 'Макет';
      stage.innerHTML = renderMxl(currentMxlData, docName);
      hydrateDrawingImages(currentMxlData, stage);
    } catch (e) {
      currentMxlData = null;
      showError('Ошибка визуализации макета: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  });
}

function hideSectionHeaders() {
  var shown = stage.querySelectorAll('.mxl-section-hdr.mxl-section-visible');
  for (var i = 0; i < shown.length; i++) {
    shown[i].classList.remove('mxl-section-visible');
  }
}

function clearActiveCell() {
  var active = stage.querySelectorAll('td.mxl-cell-active');
  for (var i = 0; i < active.length; i++) {
    active[i].classList.remove('mxl-cell-active');
  }
}

function selectCell(td, dataRow) {
  clearActiveCell();
  hideSectionHeaders();

  if (!td || !dataRow || !currentMxlData) {
    hidePropsPanel();
    return;
  }

  td.classList.add('mxl-cell-active');

  var section = dataRow.getAttribute('data-section');
  if (section && section !== '0') {
    var hdr = stage.querySelector('.mxl-section-hdr[data-section-hdr="' + section + '"]');
    if (hdr) hdr.classList.add('mxl-section-visible');
  }

  var row = parseInt(td.getAttribute('data-row'), 10);
  var col = parseInt(td.getAttribute('data-col'), 10);
  if (isNaN(row) || isNaN(col)) {
    hidePropsPanel();
    return;
  }

  showPropsPanel(describeCell(currentMxlData, row, col));
}

(appRoot || document).addEventListener('click', function (e) {
  var target = e.target;

  if (target && target.closest && target.closest('.mxl-props-close')) {
    clearActiveCell();
    hidePropsPanel();
    return;
  }

  var td = target && target.closest ? target.closest('td') : null;
  var dataRow = target && target.closest ? target.closest('.mxl-data-row') : null;

  if (td && dataRow) {
    selectCell(td, dataRow);
    return;
  }

  if (target.closest && target.closest('#cell-props')) return;

  clearActiveCell();
  hideSectionHeaders();
  hidePropsPanel();
});

window.addEventListener('message', function (event) {
  var message = event.data;
  if (message.command === 'update') {
    mount(message.text, message.fileName);
  }
});

if (vscodeApi) {
  vscodeApi.postMessage({ command: 'ready' });
}
