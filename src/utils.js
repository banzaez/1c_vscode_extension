const vscode = require('vscode');
const path = require('path');
const fsPromises = require('fs').promises;

// Переиспользуемый декодер — создаём один раз, используем везде
const _utf8Decoder = new TextDecoder('utf-8');
const XML_HEAD_LINES = 20;

async function readHead(uri, bytes = 2048) {
  if (uri.scheme === 'file') {
    let fileHandle;
    try {
      fileHandle = await fsPromises.open(uri.fsPath, 'r');
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await fileHandle.read(buffer, 0, bytes, 0);
      return buffer.slice(0, bytesRead);
    } catch (e) {
      // Игнорируем ошибку и делаем fallback на vscode.workspace.fs
    } finally {
      if (fileHandle) await fileHandle.close();
    }
  }
  const fullBuf = await vscode.workspace.fs.readFile(uri);
  return fullBuf.slice(0, bytes);
}

function readXmlSnippet(documentOrText) {
  if (typeof documentOrText === 'string') return documentOrText;
  return documentOrText.getText(new vscode.Range(0, 0, XML_HEAD_LINES, 0));
}

function contentIsManagedForm(text) {
  // Обычные формы в MetaDataObject тоже содержат «logform» в xmlns:lf — проверяем корневой namespace.
  return /<Form\b[^>]*\sxmlns="http:\/\/v8\.1c\.ru\/8\.3\/xcf\/logform"/.test(text);
}

function contentIsMxlTemplate(text) {
  return text.includes('<document') && (text.includes('spreadsheet') || text.includes('http://v8.1c.ru/8.2/data/spreadsheet'));
}

/** MetaDataObject-описатель обычной формы (Forms/ИмяФормы.xml). */
function contentIsOrdinaryFormDescriptor(text) {
  return /<FormType>\s*Ordinary\s*<\/FormType>/.test(text);
}

/** MetaDataObject-описатель макета MXL (Templates/ИмяМакета.xml). */
function contentIsMxlTemplateDescriptor(text) {
  return /<TemplateType>\s*SpreadsheetDocument\s*<\/TemplateType>/.test(text);
}

function isSupportedFile(document) {
  if (!document) return false;
  const fileName = path.basename(document.fileName);
  if (fileName === 'form.data') return true;
  if (fileName.toLowerCase().endsWith('.mxl')) return true;
  if (fileName.endsWith('.xml')) {
    const text = readXmlSnippet(document);
    if (contentIsManagedForm(text) || contentIsMxlTemplate(text) ||
        contentIsOrdinaryFormDescriptor(text) || contentIsMxlTemplateDescriptor(text)) {
      return true;
    }
  }
  return false;
}

/** Удаляет сегменты 'ext' с конца массива частей пути (мутирует массив, возвращает его). */
function stripTrailingExt(parts) {
  while (parts.length > 0 && parts[parts.length - 1].toLowerCase() === 'ext') {
    parts.pop();
  }
  return parts;
}

function getFileType(document) {
  if (!document) return 'unknown';
  const fileName = path.basename(document.fileName);
  if (fileName === 'form.data') return 'ordinary';
  if (fileName.toLowerCase().endsWith('.mxl')) return 'mxl';
  if (fileName.endsWith('.xml')) {
    const text = readXmlSnippet(document);
    if (contentIsOrdinaryFormDescriptor(text) || contentIsMxlTemplateDescriptor(text)) {
      return 'metadata-descriptor';
    }
    if (contentIsManagedForm(text)) return 'managed';
    if (contentIsMxlTemplate(text)) return 'mxl';
  }
  return 'unknown';
}

function canonicalOrdinaryKey(fsPath) {
  const base = path.basename(fsPath);
  if (base === 'form.data') {
    const extDir = path.dirname(fsPath);
    if (path.basename(extDir).toLowerCase() === 'ext') {
      return path.dirname(extDir);
    }
  }
  if (base.toLowerCase().endsWith('.xml')) {
    return path.join(path.dirname(fsPath), path.basename(fsPath, '.xml'));
  }
  return fsPath;
}

function canonicalMxlKey(fsPath) {
  const base = path.basename(fsPath);
  if (base.toLowerCase() === 'template.xml') {
    const extDir = path.dirname(fsPath);
    if (path.basename(extDir).toLowerCase() === 'ext') {
      return path.dirname(extDir);
    }
  }
  if (base.toLowerCase().endsWith('.xml')) {
    return path.join(path.dirname(fsPath), path.basename(fsPath, '.xml'));
  }
  return fsPath;
}

module.exports = {
  readHead,
  _utf8Decoder,
  contentIsManagedForm,
  contentIsMxlTemplate,
  contentIsOrdinaryFormDescriptor,
  contentIsMxlTemplateDescriptor,
  isSupportedFile,
  stripTrailingExt,
  getFileType,
  canonicalOrdinaryKey,
  canonicalMxlKey
};
