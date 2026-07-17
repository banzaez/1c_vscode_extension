const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  _utf8Decoder,
  getFileType,
  contentIsOrdinaryFormDescriptor,
  contentIsMxlTemplateDescriptor,
  readHead
} = require('./utils');

// Map: uriStr → PanelInfo (каждая панель со своим состоянием)
const openPanels = new Map();

function loadWebviewHtml(htmlFileName, webview, extensionPath) {
  const htmlPath = path.join(extensionPath, htmlFileName);
  let html = fs.readFileSync(htmlPath, 'utf8');

  if (htmlFileName === 'webview_mxl.html') {
    const mxlDir = path.join(extensionPath, 'webview', 'mxl');
    const appUri = webview.asWebviewUri(vscode.Uri.file(path.join(mxlDir, 'mxl-app.js')));
    const parserUri = webview.asWebviewUri(vscode.Uri.file(path.join(mxlDir, 'mxl-parser.js')));
    const renderUri = webview.asWebviewUri(vscode.Uri.file(path.join(mxlDir, 'mxl-render.js')));
    const cellInfoUri = webview.asWebviewUri(vscode.Uri.file(path.join(mxlDir, 'cell-info.js')));
    const drawingsUri = webview.asWebviewUri(vscode.Uri.file(path.join(mxlDir, 'drawings.js')));
    const preload = [
      '<link rel="modulepreload" href="' + parserUri + '">',
      '<link rel="modulepreload" href="' + renderUri + '">',
      '<link rel="modulepreload" href="' + cellInfoUri + '">',
      '<link rel="modulepreload" href="' + drawingsUri + '">'
    ].join('\n');
    const csp = [
      "default-src 'none'",
      "style-src " + webview.cspSource + " 'unsafe-inline'",
      "script-src " + webview.cspSource,
      "img-src data: blob: " + webview.cspSource
    ].join('; ');
    html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n' + preload);
    html = html.replace('__MXL_APP_SCRIPT__', appUri.toString());
  } else if (htmlFileName === 'webview_ordinary.html') {
    const ordDir = path.join(extensionPath, 'webview', 'ordinary');
    const appUri = webview.asWebviewUri(vscode.Uri.file(path.join(ordDir, 'ordinary-app.js')));
    const parserUri = webview.asWebviewUri(vscode.Uri.file(path.join(ordDir, 'ordinary-parser.js')));
    const toolbarUri = webview.asWebviewUri(vscode.Uri.file(path.join(ordDir, 'ordinary-toolbar.js')));
    const renderUri = webview.asWebviewUri(vscode.Uri.file(path.join(ordDir, 'ordinary-render.js')));
    const preload = [
      '<link rel="modulepreload" href="' + parserUri + '">',
      '<link rel="modulepreload" href="' + toolbarUri + '">',
      '<link rel="modulepreload" href="' + renderUri + '">'
    ].join('\n');
    const csp = [
      "default-src 'none'",
      "style-src " + webview.cspSource + " 'unsafe-inline'",
      "script-src " + webview.cspSource
    ].join('; ');
    html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n' + preload);
    html = html.replace('__ORDINARY_APP_SCRIPT__', appUri.toString());
  }

  return html;
}

// Отправка обновления в конкретную панель
function postUpdate(info, document) {
  if (!info.panel || !document) return;
  const uriStr = document.uri.toString();
  if (info.lastPostedUri === uriStr && info.lastPostedVersion === document.version) return;
  info.lastPostedUri = uriStr;
  info.lastPostedVersion = document.version;
  info.panel.webview.postMessage({
    command: 'update',
    text: document.getText(),
    fileName: path.basename(document.fileName)
  });
}

function queueWebviewUpdate(info, document) {
  if (!info.panel || !document) return;
  info.pendingDocument = document;
  if (info.webviewReady) {
    postUpdate(info, document);
  }
}

function updateWebviewContent(info, document, extensionPath, precomputedFileType) {
  if (!info.panel || !document) return;
  const fileType = precomputedFileType || getFileType(document);
  if (info.currentFileType !== fileType) {
    info.currentFileType = fileType;
    info.webviewReady = false;
    info.lastPostedUri = null;
    info.lastPostedVersion = null;
    let htmlFileName = 'webview.html';
    if (fileType === 'ordinary') htmlFileName = 'webview_ordinary.html';
    else if (fileType === 'mxl') htmlFileName = 'webview_mxl.html';
    info.panel.webview.html = loadWebviewHtml(htmlFileName, info.panel.webview, extensionPath);
  }
  queueWebviewUpdate(info, document);
}

function scheduleWebviewUpdate(info, document, extensionPath) {
  if (info.updateDebounceTimer) clearTimeout(info.updateDebounceTimer);
  info.updateDebounceTimer = setTimeout(() => {
    info.updateDebounceTimer = null;
    updateWebviewContent(info, document, extensionPath);
  }, 250);
}

/**
 * Открывает панель превью для документа
 */
function openPanelForDocument(document, context) {
  const uriStr = document.uri.toString();
  const fileName = path.basename(document.fileName);

  if (openPanels.has(uriStr)) {
    const info = openPanels.get(uriStr);
    if (!info.panel.visible) {
      info.panel.reveal(vscode.ViewColumn.Two, true);
    }
    info.panel.title = `Форма: ${fileName}`;
    updateWebviewContent(info, document, context.extensionPath);
    return info;
  }

  const panel = vscode.window.createWebviewPanel(
    '1cFormViewer',
    `Форма: ${fileName}`,
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)]
    }
  );

  const info = {
    panel,
    uriStr,
    currentFileType: null,
    webviewReady: false,
    pendingDocument: document,
    updateDebounceTimer: null,
    lastPostedUri: null,
    lastPostedVersion: null,
  };

  openPanels.set(uriStr, info);

  panel.webview.onDidReceiveMessage(message => {
    if (message && message.command === 'ready') {
      info.webviewReady = true;
      if (info.pendingDocument) postUpdate(info, info.pendingDocument);
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(() => {
    openPanels.delete(uriStr);
    if (info.updateDebounceTimer) clearTimeout(info.updateDebounceTimer);
  }, null, context.subscriptions);

  updateWebviewContent(info, document, context.extensionPath);
  return info;
}

async function resolveOrdinaryFormDescriptor(xmlUri) {
  const xmlPath = xmlUri.fsPath;
  const dir = path.dirname(xmlPath);
  const baseName = path.basename(xmlPath, '.xml');
  const formData = vscode.Uri.file(path.join(dir, baseName, 'Ext', 'form.data'));
  try {
    const fStat = await vscode.workspace.fs.stat(formData);
    if (fStat.type === vscode.FileType.File) {
      return formData;
    }
  } catch (e) {}
  return null;
}

async function resolveMxlTemplateDescriptor(xmlUri) {
  const xmlPath = xmlUri.fsPath;
  const dir = path.dirname(xmlPath);
  const baseName = path.basename(xmlPath, '.xml');
  const templateXml = vscode.Uri.file(path.join(dir, baseName, 'Ext', 'Template.xml'));
  try {
    const stat = await vscode.workspace.fs.stat(templateXml);
    if (stat.type === vscode.FileType.File) {
      return templateXml;
    }
  } catch (e) {}
  return null;
}

async function resolveMetadataDescriptor(uri) {
  try {
    const buf = await readHead(uri);
    const head = _utf8Decoder.decode(buf);
    if (contentIsOrdinaryFormDescriptor(head)) {
      return resolveOrdinaryFormDescriptor(uri);
    }
    if (contentIsMxlTemplateDescriptor(head)) {
      return resolveMxlTemplateDescriptor(uri);
    }
  } catch (e) {}
  return null;
}

async function findSupportedFileInDirectory(dirUri) {
  const entries = await vscode.workspace.fs.readDirectory(dirUri);

  for (const [name, type] of entries) {
    if (type === vscode.FileType.File) {
      const lowerName = name.toLowerCase();
      if (lowerName === 'form.data') return vscode.Uri.joinPath(dirUri, name);
      if (lowerName === 'template.xml' || lowerName === 'form.xml') return vscode.Uri.joinPath(dirUri, name);
    }
  }

  for (const [name, type] of entries) {
    if (type === vscode.FileType.Directory && name !== 'node_modules' && name !== '.git') {
      const subdir = vscode.Uri.joinPath(dirUri, name);
      const found = await findSupportedFileInDirectory(subdir);
      if (found) return found;
    } else if (type === vscode.FileType.File && name.toLowerCase().endsWith('.xml')) {
      const fileUri = vscode.Uri.joinPath(dirUri, name);
      try {
        const buf = await readHead(fileUri);
        const content = _utf8Decoder.decode(buf);
        if (content.includes('<Form') || content.includes('<document') ||
            contentIsOrdinaryFormDescriptor(content) || contentIsMxlTemplateDescriptor(content)) {
          return fileUri;
        }
      } catch (e) {}
    }
  }
  return null;
}

class FormPreviewEditorProvider {
  static register(context) {
    const provider = new FormPreviewEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(FormPreviewEditorProvider.viewType, provider);
  }

  static viewType = '1c-form-viewer.previewEditor';

  constructor(context) {
    this.context = context;
  }

  async resolveCustomTextEditor(document, webviewPanel, token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'webview')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'icons', 'standart'))
      ]
    };

    const fileType = getFileType(document);
    const info = {
      panel: webviewPanel,
      lastUri: document.uri,
      lastContent: null
    };

    openPanels.set(document.uri.toString(), info);

    webviewPanel.onDidDispose(() => {
      openPanels.delete(document.uri.toString());
    });

    updateWebviewContent(info, document, this.context.extensionPath, fileType);
  }
}

module.exports = {
  openPanels,
  openPanelForDocument,
  updateWebviewContent,
  scheduleWebviewUpdate,
  resolveMetadataDescriptor,
  findSupportedFileInDirectory,
  FormPreviewEditorProvider
};
