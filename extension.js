const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const TRANSLATION_MAP = {
  'catalogs': { ru: 'Справочники', badge: 'СП' },
  'catalog': { ru: 'Справочник', badge: 'СП' },
  'documents': { ru: 'Документы', badge: 'ДК' },
  'document': { ru: 'Документ', badge: 'ДК' },
  'dataprocessors': { ru: 'Обработки', badge: 'ОБ' },
  'dataprocessor': { ru: 'Обработка', badge: 'ОБ' },
  'reports': { ru: 'Отчеты', badge: 'ОТ' },
  'report': { ru: 'Отчет', badge: 'ОТ' },
  'enums': { ru: 'Перечисления', badge: 'ПР' },
  'enum': { ru: 'Перечисление', badge: 'ПР' },
  'informationregisters': { ru: 'Регистры сведений', badge: 'РС' },
  'informationregister': { ru: 'Регистр сведений', badge: 'РС' },
  'accumulationregisters': { ru: 'Регистры накопления', badge: 'РН' },
  'accumulationregister': { ru: 'Регистр накопления', badge: 'РН' },
  'calculationregisters': { ru: 'Регистры расчета', badge: 'РР' },
  'calculationregister': { ru: 'Регистр расчета', badge: 'РР' },
  'accountingregisters': { ru: 'Регистры бухгалтерии', badge: 'РБ' },
  'accountingregister': { ru: 'Регистр бухгалтерии', badge: 'РБ' },
  'chartsofaccounts': { ru: 'Планы счетов', badge: 'ПС' },
  'chartofaccounts': { ru: 'План счетов', badge: 'ПС' },
  'chartsofcharacteristictypes': { ru: 'Планы видов характеристик', badge: 'ПХ' },
  'chartofcharacteristictypes': { ru: 'План видов характеристик', badge: 'ПХ' },
  'chartsofcalculationtypes': { ru: 'Планы видов расчета', badge: 'ВР' },
  'chartofcalculationtypes': { ru: 'План видов расчета', badge: 'ВР' },
  'businessprocesses': { ru: 'Бизнес-процессы', badge: 'БП' },
  'businessprocess': { ru: 'Бизнес-процесс', badge: 'БП' },
  'tasks': { ru: 'Задачи', badge: 'ЗД' },
  'task': { ru: 'Задача', badge: 'ЗД' },
  'constants': { ru: 'Константы', badge: 'КН' },
  'constant': { ru: 'Константа', badge: 'КН' },
  'exchangeplans': { ru: 'Планы обмена', badge: 'ПО' },
  'exchangeplan': { ru: 'План обмена', badge: 'ПО' },
  'filtercriteria': { ru: 'Критерии отбора', badge: 'КО' },
  'filtercriterion': { ru: 'Критерий отбора', badge: 'КО' },
  'documentjournals': { ru: 'Журналы документов', badge: 'ЖД' },
  'documentjournal': { ru: 'Журнал документов', badge: 'ЖД' },
  'externaldatasources': { ru: 'Внешние источники данных', badge: 'ВД' },
  'externaldatasource': { ru: 'Внешний источник данных', badge: 'ВД' },
  'scheduledjobs': { ru: 'Регламентные задания', badge: 'РЗ' },
  'scheduledjob': { ru: 'Регламентное задание', badge: 'РЗ' },
  'subsystems': { ru: 'Подсистемы', badge: 'ПД' },
  'subsystem': { ru: 'Подсистема', badge: 'ПД' },
  'forms': { ru: 'Формы', badge: 'ФМ' },
  'form': { ru: 'Форма', badge: 'ФМ' },
  'templates': { ru: 'Макеты', badge: 'МК' },
  'template': { ru: 'Макет', badge: 'МК' },
  'commands': { ru: 'Команды', badge: 'КМ' },
  'command': { ru: 'Команда', badge: 'КМ' },
  'attributes': { ru: 'Реквизиты', badge: 'РК' },
  'attribute': { ru: 'Реквизит', badge: 'РК' },
  'dimensions': { ru: 'Измерения', badge: 'ИЗ' },
  'dimension': { ru: 'Измерение', badge: 'ИЗ' },
  'resources': { ru: 'Ресурсы', badge: 'РЦ' },
  'resource': { ru: 'Ресурс', badge: 'РЦ' },
  'ext': { ru: 'Внешние файлы', badge: 'EX' },
  
  // Добавленные новые типы
  'httpservices': { ru: 'HTTP-сервисы', badge: 'HT' },
  'httpservice': { ru: 'HTTP-сервис', badge: 'HT' },
  'webservices': { ru: 'Web-сервисы', badge: 'WS' },
  'webservice': { ru: 'Web-сервис', badge: 'WS' },
  'sessionparameters': { ru: 'Параметры сеанса', badge: 'ПМ' },
  'sessionparameter': { ru: 'Параметр сеанса', badge: 'ПМ' },
  'commandgroups': { ru: 'Группы команд', badge: 'ГК' },
  'commandgroup': { ru: 'Группа команд', badge: 'ГК' },
  'commonpictures': { ru: 'Общие картинки', badge: 'ОК' },
  'commonpicture': { ru: 'Общая картинка', badge: 'ОК' },
  'documentnumerators': { ru: 'Нумераторы документов', badge: 'НМ' },
  'documentnumerator': { ru: 'Нумератор документов', badge: 'НМ' },
  'eventsubscriptions': { ru: 'Подписки на события', badge: 'ПБ' },
  'eventsubscription': { ru: 'Подписка на событие', badge: 'ПБ' },
  'functionaloptions': { ru: 'Функциональные опции', badge: 'ФО' },
  'functionaloption': { ru: 'Функциональная опция', badge: 'ФО' },
  'interfaces': { ru: 'Интерфейсы', badge: 'ИТ' },
  'interface': { ru: 'Интерфейс', badge: 'ИТ' },
  'sequences': { ru: 'Последовательности', badge: 'ПО' },
  'sequence': { ru: 'Последовательность', badge: 'ПО' },
  'styleitems': { ru: 'Элементы стиля', badge: 'СТ' },
  'styleitem': { ru: 'Элемент стиля', badge: 'СТ' },
  'styles': { ru: 'Стили', badge: 'СТ' },
  'style': { ru: 'Стиль', badge: 'СТ' },
  'xdtopackages': { ru: 'XDTO-пакеты', badge: 'XD' },
  'xdtopackage': { ru: 'XDTO-пакет', badge: 'XD' },
  'commonattributes': { ru: 'Общие реквизиты', badge: 'ОР' },
  'commonattribute': { ru: 'Общий реквизит', badge: 'ОР' },
  'commoncommands': { ru: 'Общие команды', badge: 'ОК' },
  'commoncommand': { ru: 'Общая команда', badge: 'ОК' },
  'commonforms': { ru: 'Общие формы', badge: 'ОФ' },
  'commonform': { ru: 'Общая форма', badge: 'ОФ' },
  'commonmodules': { ru: 'Общие модули', badge: 'ОМ' },
  'commonmodule': { ru: 'Общий модуль', badge: 'ОМ' },
  'commontemplates': { ru: 'Общие макеты', badge: 'ОТ' },
  'commontemplate': { ru: 'Общий макет', badge: 'ОТ' },
  'languages': { ru: 'Языки', badge: 'ЯЗ' },
  'language': { ru: 'Язык', badge: 'ЯЗ' },
  'roles': { ru: 'Роли', badge: 'РЛ' },
  'role': { ru: 'Роль', badge: 'РЛ' }
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Map: uriStr → PanelInfo (каждая панель со своим состоянием)
  const openPanels = new Map();
  let activeEditor = null;

  const XML_HEAD_LINES = 20;

  function readXmlSnippet(documentOrText) {
    if (typeof documentOrText === 'string') return documentOrText;
    return documentOrText.getText(new vscode.Range(0, 0, XML_HEAD_LINES, 0));
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

  function contentIsManagedForm(text) {
    // Обычные формы в MetaDataObject тоже содержат «logform» в xmlns:lf — проверяем корневой namespace.
    return /<Form\b[^>]*\sxmlns="http:\/\/v8\.1c\.ru\/8\.3\/xcf\/logform"/.test(text)
      || text.includes('xmlns="http://v8.1c.ru/8.3/xcf/logform"');
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

  function loadWebviewHtml(htmlFileName, webview) {
    const htmlPath = path.join(context.extensionPath, htmlFileName);
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (htmlFileName === 'webview_mxl.html') {
      const mxlDir = path.join(context.extensionPath, 'webview', 'mxl');
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
      const ordDir = path.join(context.extensionPath, 'webview', 'ordinary');
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

  function updateWebviewContent(info, document, precomputedFileType) {
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
      info.panel.webview.html = loadWebviewHtml(htmlFileName, info.panel.webview);
    }
    queueWebviewUpdate(info, document);
  }

  function scheduleWebviewUpdate(info, document) {
    if (info.updateDebounceTimer) clearTimeout(info.updateDebounceTimer);
    info.updateDebounceTimer = setTimeout(() => {
      info.updateDebounceTimer = null;
      updateWebviewContent(info, document);
    }, 250);
  }

  /**
   * Открывает панель превью для документа:
   * - если панель для этого URI уже есть → reveal + обновить;
   * - если нет → создаёт новую панель.
   */
  function openPanelForDocument(document) {
    const uriStr = document.uri.toString();
    const fileName = path.basename(document.fileName);

    // Панель уже открыта — показать (если скрыта) и обновить контент
    if (openPanels.has(uriStr)) {
      const info = openPanels.get(uriStr);
      // reveal() вызываем только если панель скрыта — иначе может сработать toggle
      if (!info.panel.visible) {
        info.panel.reveal(vscode.ViewColumn.Two, true);
      }
      info.panel.title = `Форма: ${fileName}`;
      updateWebviewContent(info, document);
      return info;
    }

    // Создаём новую панель
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

    /** @type {PanelInfo} */
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

    updateWebviewContent(info, document);
    return info;
  }

  // MetaDataObject Forms/Имя.xml → Forms/Имя/Ext/form.data
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

  // MetaDataObject Templates/Имя.xml → Templates/Имя/Ext/Template.xml
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
      const buf = await vscode.workspace.fs.readFile(uri);
      const head = new TextDecoder('utf-8').decode(buf.slice(0, 2048));
      if (contentIsOrdinaryFormDescriptor(head)) {
        return resolveOrdinaryFormDescriptor(uri);
      }
      if (contentIsMxlTemplateDescriptor(head)) {
        return resolveMxlTemplateDescriptor(uri);
      }
    } catch (e) {}
    return null;
  }

  let disposable = vscode.commands.registerCommand('1c-form-viewer.openPreview', async (uri) => {
    let targetUri = uri;

    // Если команда вызвана без URI, берем активный редактор
    if (!targetUri) {
      const editor = vscode.window.activeTextEditor;
      if (editor) targetUri = editor.document.uri;
    }

    if (!targetUri) {
      vscode.window.showInformationMessage('Выделите файл или папку для просмотра');
      return;
    }

    try {
      if (targetUri.path.endsWith('.xml')) {
        const resolved = await resolveMetadataDescriptor(targetUri);
        if (resolved) {
          targetUri = resolved;
        } else {
          const buf = await vscode.workspace.fs.readFile(targetUri);
          const head = new TextDecoder('utf-8').decode(buf.slice(0, 2048));
          if (contentIsOrdinaryFormDescriptor(head)) {
            vscode.window.showErrorMessage('Не найден Ext/form.data для обычной формы');
            return;
          }
          if (contentIsMxlTemplateDescriptor(head)) {
            vscode.window.showErrorMessage('Не найден Ext/Template.xml для макета');
            return;
          }
        }
      }

      const stat = await vscode.workspace.fs.stat(targetUri);

      // Если кликнули по папке, ищем подходящий файл внутри нее
      if (stat.type === vscode.FileType.Directory) {
        const foundUri = await findSupportedFileInDirectory(targetUri);
        if (foundUri) {
          targetUri = foundUri;
        } else {
          vscode.window.showInformationMessage('В выбранной папке не найдено поддерживаемых форм 1С или макетов');
          return;
        }
      }

      // Открываем документ
      const doc = await vscode.workspace.openTextDocument(targetUri);
      if (!isSupportedFile(doc)) {
        vscode.window.showInformationMessage('Этот файл не поддерживается (ожидается Управляемая форма, Обычная форма или Макет MXL)');
        return;
      }

      // Показываем текстовый документ и превью
      activeEditor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
      });
      openPanelForDocument(doc);
    } catch (err) {
      vscode.window.showErrorMessage(`Не удалось открыть: ${err.message}`);
    }
  });

  let disposableForm = vscode.commands.registerCommand('1c-form-viewer.openFormPreview', (uri) => {
    return vscode.commands.executeCommand('1c-form-viewer.openPreview', uri);
  });

  context.subscriptions.push(disposable, disposableForm);

  // Вспомогательная функция для рекурсивного поиска поддерживаемого файла в папке
  async function findSupportedFileInDirectory(dirUri) {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);

    // Первый проход: form.data и Template.xml — высший приоритет
    for (const [name, type] of entries) {
      if (type === vscode.FileType.File) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'form.data') return vscode.Uri.joinPath(dirUri, name);
        if (lowerName === 'template.xml' || lowerName === 'form.xml') return vscode.Uri.joinPath(dirUri, name);
      }
    }

    // Второй проход: рекурсивно в подпапки
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory && name !== 'node_modules' && name !== '.git') {
        const subdir = vscode.Uri.joinPath(dirUri, name);
        const found = await findSupportedFileInDirectory(subdir);
        if (found) return found;
      } else if (type === vscode.FileType.File && name.toLowerCase().endsWith('.xml')) {
        const fileUri = vscode.Uri.joinPath(dirUri, name);
        try {
          const buf = await vscode.workspace.fs.readFile(fileUri);
          const content = new TextDecoder('utf-8').decode(buf.slice(0, 2048));
          if (content.includes('<Form') || content.includes('<document') ||
              contentIsOrdinaryFormDescriptor(content) || contentIsMxlTemplateDescriptor(content)) {
            return fileUri;
          }
        } catch (e) {}
      }
    }
    return null;
  }

  // Слушаем изменения документа — обновляем соответствующую панель
  vscode.workspace.onDidChangeTextDocument(e => {
    const info = openPanels.get(e.document.uri.toString());
    if (info) scheduleWebviewUpdate(info, e.document);
  }, null, context.subscriptions);

  // Слушаем сохранение документа
  vscode.workspace.onDidSaveTextDocument(document => {
    const info = openPanels.get(document.uri.toString());
    if (info) updateWebviewContent(info, document);
  }, null, context.subscriptions);

  // Слушаем смену активного редактора
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (!editor) return;
    const fileType = getFileType(editor.document);
    if (fileType === 'unknown' || fileType === 'metadata-descriptor') return;
    activeEditor = editor;
    // Если для этого документа уже открыта панель — обновить её
    const info = openPanels.get(editor.document.uri.toString());
    if (info) {
      info.panel.title = `Форма: ${path.basename(editor.document.fileName)}`;
      updateWebviewContent(info, editor.document, fileType);
    }
  }, null, context.subscriptions);

  // Команда для открытия формы из боковой панели
  let openFromSidebarDisposable = vscode.commands.registerCommand('1c-form-viewer.openFormFromSidebar', async (uri) => {
    await vscode.commands.executeCommand('1c-form-viewer.openPreview', uri);
  });
  context.subscriptions.push(openFromSidebarDisposable);
  async function findProjectFiles() {
    // Параллельный поиск XML- и form.data-файлов (Template.xml попадёт в xmlUris автоматически)
    const [xmlUris, dataUris] = await Promise.all([
      vscode.workspace.findFiles('**/*.xml', '**/node_modules/**'),
      vscode.workspace.findFiles('**/form.data', '**/node_modules/**')
    ]);

    const managedForms = [];
    const ordinaryMap = new Map();
    const mxlMap = new Map();

    for (const uri of dataUris) {
      ordinaryMap.set(canonicalOrdinaryKey(uri.fsPath), uri);
    }

    // Чтение XML-файлов батчами по 20 штук параллельно
    const BATCH = 20;
    for (let start = 0; start < xmlUris.length; start += BATCH) {
      const batch = xmlUris.slice(start, start + BATCH);
      const results = await Promise.all(batch.map(async (uri) => {
        try {
          const buf = await vscode.workspace.fs.readFile(uri);
          if (!buf.length) return null;
          const content = new TextDecoder('utf-8').decode(buf.slice(0, 2048));
          if (contentIsManagedForm(content)) {
            return { type: 'managed', uri };
          }
          if (contentIsMxlTemplate(content)) {
            return { type: 'mxl', uri, preferred: true };
          }
          if (contentIsMxlTemplateDescriptor(content)) {
            return { type: 'mxl', uri, preferred: false };
          }
          if (contentIsOrdinaryFormDescriptor(content)) {
            return { type: 'ordinary', uri, preferred: false };
          }
          return null;
        } catch (e) {
          console.error('Error detecting format for URI:', uri.fsPath, e);
          return null;
        }
      }));
      for (const result of results) {
        if (!result) continue;
        if (result.type === 'managed') {
          managedForms.push(result.uri);
        } else if (result.type === 'ordinary') {
          const key = canonicalOrdinaryKey(result.uri.fsPath);
          if (!ordinaryMap.has(key) || result.preferred) {
            ordinaryMap.set(key, result.uri);
          }
        } else if (result.type === 'mxl') {
          const key = canonicalMxlKey(result.uri.fsPath);
          if (!mxlMap.has(key) || result.preferred) {
            mxlMap.set(key, result.uri);
          }
        }
      }
    }

    return {
      managedForms,
      mxlTemplates: Array.from(mxlMap.values()),
      ordinaryForms: Array.from(ordinaryMap.values())
    };
  }

  // ─── Боковая панель: дерево форм и макетов ─────────────────────────────────

  const FORM_KIND_META = {
    managed: { icon: 'layout', contextValue: 'managedForm', description: 'управляемая' },
    ordinary: { icon: 'window', contextValue: 'ordinaryForm', description: 'обычная' },
    mxl: { icon: 'table', contextValue: 'mxlTemplate', description: 'макет' },
  };

  function getWorkspacePath() {
    const wsf = vscode.workspace.workspaceFolders;
    return wsf && wsf.length > 0 ? wsf[0].uri.fsPath : context.extensionPath;
  }

  /** Сегменты пути в дереве для формы или макета. */
  function getFormPathSegments(fsPath, workspacePath, kind) {
    const rel = path.relative(workspacePath, fsPath);
    const parts = rel.split(path.sep);
    const fileName = parts[parts.length - 1];

    if (kind === 'ordinary' || fileName === 'form.data') {
      if (fileName.toLowerCase().endsWith('.xml') && fileName !== 'form.data') {
        const baseName = fileName.replace(/\.xml$/i, '');
        return parts.slice(0, -1).concat([baseName]);
      }
      const dirParts = parts.slice(0, -1);
      while (dirParts.length > 0 && dirParts[dirParts.length - 1].toLowerCase() === 'ext') {
        dirParts.pop();
      }
      return dirParts;
    }

    if (kind === 'managed') {
      const baseName = fileName.replace(/\.xml$/i, '');
      const dirParts = parts.slice(0, -1);
      while (dirParts.length > 0 && dirParts[dirParts.length - 1].toLowerCase() === 'ext') {
        dirParts.pop();
      }
      return dirParts.concat([baseName]);
    }

    if (kind === 'mxl') {
      if (fileName.toLowerCase() !== 'template.xml' && fileName.toLowerCase().endsWith('.xml')) {
        const baseName = fileName.replace(/\.xml$/i, '');
        return parts.slice(0, -1).concat([baseName]);
      }
      const dirParts = parts.slice(0, -1);
      while (dirParts.length > 0 && dirParts[dirParts.length - 1].toLowerCase() === 'ext') {
        dirParts.pop();
      }
      return dirParts.length > 0 ? dirParts : [path.basename(path.dirname(fsPath)) || 'Макет'];
    }

    return parts;
  }

  function buildFormTree(entries, workspacePath) {
    const root = { children: new Map(), level: 0 };

    for (const entry of entries) {
      const segments = getFormPathSegments(entry.uri.fsPath, workspacePath, entry.kind);
      let node = root;

      for (let i = 0; i < segments.length; i++) {
        const part = segments[i];
        const isLeaf = i === segments.length - 1;

        if (!node.children.has(part)) {
          node.children.set(part, {
            label: part,
            children: new Map(),
            associatedUri: isLeaf ? entry.uri : null,
            kind: isLeaf ? entry.kind : null,
            category: node.category || part.toLowerCase(),
            level: node.level + 1
          });
        } else if (isLeaf) {
          const child = node.children.get(part);
          child.associatedUri = entry.uri;
          child.kind = entry.kind;
        }

        node = node.children.get(part);
      }
    }

    return root;
  }

  function sortTreeNodes(nodes) {
    return nodes.sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
  }



  function getSidebarIcon(label, isLeaf, kind, category = null, level = 0) {
    const iconDir = path.join(context.extensionPath, 'resources', 'icons', 'standart');
    const explorerDir = path.join(context.extensionPath, 'resources', 'explorer');
    
    if (isLeaf) {
      if (kind === 'mxl') {
        return vscode.Uri.file(path.join(iconDir, 'SpreadsheetShowGrid.png'));
      }
      return vscode.Uri.file(path.join(iconDir, 'Form.png'));
    }
    
    if (!isLeaf && level === 2 && category) {
      const level2Mappings = {
        'catalogs': 'CatalogObject.png',
        'documents': 'DocumentObject.png',
        'dataprocessors': 'DataProcessor.png',
        'reports': 'Report.png',
        'enums': 'Enum.png',
        'informationregisters': 'InformationRegister.png',
        'accumulationregisters': 'AccumulationRegister.png',
        'calculationregisters': 'CalculationRegister.png',
        'accountingregisters': 'AccountingRegister.png',
        'chartsofaccounts': 'ChartOfAccountsObject.png',
        'chartsofcharacteristictypes': 'ChartOfCharacteristicTypesObject.png',
        'chartsofcalculationtypes': 'ChartOfCalculationTypesObject.png',
        'businessprocesses': 'BusinessProcessObject.png',
        'tasks': 'TaskObject.png',
        'exchangeplans': 'ExchangePlanObject.png'
      };
      const fileName = level2Mappings[category];
      if (fileName) {
        return vscode.Uri.file(path.join(iconDir, fileName));
      }
    }
    
    const lower = label.toLowerCase();
    const mappings = {
      'catalogs': 'Catalog.png',
      'справочники': 'Catalog.png',
      'catalog': 'CatalogObject.png',
      'справочник': 'CatalogObject.png',
      
      'documents': 'Document.png',
      'документы': 'Document.png',
      'document': 'DocumentObject.png',
      'документ': 'DocumentObject.png',
      
      'dataprocessors': 'DataProcessor.png',
      'обработки': 'DataProcessor.png',
      'dataprocessor': 'DataProcessor.png',
      'обработка': 'DataProcessor.png',
      
      'reports': 'Report.png',
      'отчеты': 'Report.png',
      'report': 'Report.png',
      'отчет': 'Report.png',
      
      'enums': 'Enum.png',
      'перечисления': 'Enum.png',
      'enum': 'Enum.png',
      'перечисление': 'Enum.png',
      
      'informationregisters': 'InformationRegister.png',
      'регистрысведений': 'InformationRegister.png',
      'informationregister': 'InformationRegister.png',
      
      'accumulationregisters': 'AccumulationRegister.png',
      'регистрынакопления': 'AccumulationRegister.png',
      'accumulationregister': 'AccumulationRegister.png',
      
      'calculationregisters': 'CalculationRegister.png',
      'регистрырасчета': 'CalculationRegister.png',
      'calculationregister': 'CalculationRegister.png',
      
      'accountingregisters': 'AccountingRegister.png',
      'регистрыбухгалтерии': 'AccountingRegister.png',
      'accountingregister': 'AccountingRegister.png',
      
      'chartsofaccounts': 'ChartOfAccounts.png',
      'планысчетов': 'ChartOfAccounts.png',
      'chartofaccounts': 'ChartOfAccounts.png',
      
      'chartsofcharacteristictypes': 'ChartOfCharacteristicTypes.png',
      'планывидовхарактеристик': 'ChartOfCharacteristicTypes.png',
      'chartofcharacteristictypes': 'ChartOfCharacteristicTypes.png',
      
      'chartsofcalculationtypes': 'ChartOfCalculationTypes.png',
      'планывидоврасчета': 'ChartOfCalculationTypes.png',
      'chartofcalculationtypes': 'ChartOfCalculationTypes.png',
      
      'businessprocesses': 'BusinessProcess.png',
      'бизнес-процессы': 'BusinessProcess.png',
      'бизнеспроцессы': 'BusinessProcess.png',
      'businessprocess': 'BusinessProcess.png',
      
      'tasks': 'Task.png',
      'задачи': 'Task.png',
      'task': 'Task.png',
      
      'constants': 'Constant.png',
      'константы': 'Constant.png',
      'constant': 'Constant.png',
      
      'exchangeplans': 'ExchangePlan.png',
      'планыобмена': 'ExchangePlan.png',
      'exchangeplan': 'ExchangePlan.png',
      
      'filtercriteria': 'FilterCriterion.png',
      'критерииотбора': 'FilterCriterion.png',
      'filtercriterion': 'FilterCriterion.png',
      
      'documentjournals': 'DocumentJournal.png',
      'журналыдокументов': 'DocumentJournal.png',
      'documentjournal': 'DocumentJournal.png',
      
      'externaldatasources': 'ExternalDataSource.png',
      'внешниеисточникиданных': 'ExternalDataSource.png',
      'externaldatasource': 'ExternalDataSource.png',
      
      'scheduledjobs': 'ScheduledJobs.png',
      'регламентныезадания': 'ScheduledJobs.png',
      'scheduledjob': 'ScheduledJobs.png',
      
      'forms': 'Form.png',
      'формы': 'Form.png',
      'form': 'Form.png',
      'форма': 'Form.png',
      
      'templates': 'SpreadsheetShowGrid.png',
      'макеты': 'SpreadsheetShowGrid.png',
      'template': 'SpreadsheetShowGrid.png',
      
      'commands': 'FunctionMenuCommand.svg',
      'команды': 'FunctionMenuCommand.svg',
      'command': 'FunctionMenuCommand.svg',
      
      'attributes': 'Attribute.png',
      'реквизиты': 'Attribute.png',
      'attribute': 'Attribute.png',
      
      'dimensions': 'Dimension.png',
      'измерения': 'Dimension.png',
      'dimension': 'Dimension.png',
      
      'resources': 'Resource.png',
      'ресурсы': 'Resource.png',
      'resource': 'Resource.png',
      
      // Новые типы
      'httpservices': 'folder-httpservices.svg',
      'httpservice': 'folder-httpservices.svg',
      'webservices': 'folder-webservices.svg',
      'webservice': 'folder-webservices.svg',
      'sessionparameters': 'folder-sessionparameters.svg',
      'sessionparameter': 'folder-sessionparameters.svg',
      'commandgroups': 'CustomizeForm.png',
      'commandgroup': 'CustomizeForm.png',
      'commonpictures': 'Picture.png',
      'commonpicture': 'Picture.png',
      'documentnumerators': 'FindByNumber.png',
      'documentnumerator': 'FindByNumber.png',
      'eventsubscriptions': 'EventLog.png',
      'eventsubscription': 'EventLog.png',
      'functionaloptions': 'DataCompositionOutputParameters.png',
      'functionaloption': 'DataCompositionOutputParameters.png',
      'interfaces': 'CustomizeForm.png',
      'interface': 'CustomizeForm.png',
      'sequences': 'AppearanceRightArrowYellow.png',
      'sequence': 'AppearanceRightArrowYellow.png',
      'styleitems': 'DataCompositionConditionalAppearance.png',
      'styleitem': 'DataCompositionConditionalAppearance.png',
      'styles': 'DataCompositionConditionalAppearance.png',
      'style': 'DataCompositionConditionalAppearance.png',
      'xdtopackages': 'Dendrogram.png',
      'xdtopackage': 'Dendrogram.png',
      'commonattributes': 'Attribute.png',
      'commonattribute': 'Attribute.png',
      'commoncommands': 'FunctionMenuCommand.svg',
      'commoncommand': 'FunctionMenuCommand.svg',
      'commonforms': 'Form.png',
      'commonform': 'Form.png',
      'commonmodules': 'DataProcessor.png',
      'commonmodule': 'DataProcessor.png',
      'commontemplates': 'SpreadsheetShowGrid.png',
      'commontemplate': 'SpreadsheetShowGrid.png',
      'languages': 'FormattedString.png',
      'language': 'FormattedString.png',
      'roles': 'UserWithAuthentication.png',
      'role': 'UserWithAuthentication.png',
      'ext': 'OpenFile.png'
    };
    
    if (mappings[lower]) {
      const fileName = mappings[lower];
      const dir = fileName.endsWith('.svg') ? explorerDir : iconDir;
      return vscode.Uri.file(path.join(dir, fileName));
    }
    
    if (lower === 'subsystems' || lower === 'подсистемы') {
      return vscode.Uri.file(path.join(explorerDir, 'folder-subsystems.svg'));
    }
    
    return new vscode.ThemeIcon('folder');
  }

  /** Пустое состояние дерева */
  class EmptyItem extends vscode.TreeItem {
    constructor(message) {
      super(message, vscode.TreeItemCollapsibleState.None);
      this.contextValue = 'empty';
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }

  /** Узел папки или конечной формы/макета */
  class FolderItem extends vscode.TreeItem {
    constructor(label, categoryType, treeNode = null) {
      const isLeaf = !!(treeNode && treeNode.associatedUri);
      const translation = TRANSLATION_MAP[label.toLowerCase()];
      const displayLabel = (!isLeaf && translation) ? `${label} (${translation.ru})` : label;
      super(displayLabel, isLeaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
      this.type = categoryType;
      this._treeNode = isLeaf ? null : treeNode;
      this.contextValue = 'formFolder';
      this.iconPath = getSidebarIcon(label, isLeaf, isLeaf ? treeNode.kind : null, treeNode ? treeNode.category : null, treeNode ? treeNode.level : 0);

      if (isLeaf) {
        const meta = FORM_KIND_META[treeNode.kind] || FORM_KIND_META.managed;
        this.contextValue = meta.contextValue;
        this.description = meta.description;
        this.resourceUri = treeNode.associatedUri;
        this.tooltip = treeNode.associatedUri.fsPath;
        this.command = {
          command: '1c-form-viewer.openFormFromSidebar',
          title: 'Открыть',
          arguments: [treeNode.associatedUri],
        };
      }
    }
  }

  function treeNodeToFolderItems(treeNode, categoryType) {
    const items = sortTreeNodes(
      Array.from(treeNode.children.values()).map(child => new FolderItem(child.label, categoryType, child))
    );
    return items;
  }

  // ─── Провайдер дерева ────────────────────────────────────────────────────────

  class ProjectFormsProvider {
    constructor() {
      this._onDidChangeTreeData = new vscode.EventEmitter();
      this.onDidChangeTreeData = this._onDidChangeTreeData.event;
      this.cachedFiles = null;
      this._trees = {};
      this.filterText = '';
    }

    refresh() {
      this.cachedFiles = null;
      this._trees = {};
      this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
      return element;
    }

    _ensureTree() {
      if (this._tree) return;
      const workspacePath = getWorkspacePath();
      let entries = [
        ...this.cachedFiles.managedForms.map(uri => ({ uri, kind: 'managed' })),
        ...this.cachedFiles.ordinaryForms.map(uri => ({ uri, kind: 'ordinary' })),
        ...this.cachedFiles.mxlTemplates.map(uri => ({ uri, kind: 'mxl' })),
      ];

      if (this.filterText) {
        const query = this.filterText.toLowerCase();
        entries = entries.filter(entry => {
          const basename = path.basename(entry.uri.fsPath).toLowerCase();
          return basename.includes(query);
        });
      }

      this._tree = buildFormTree(entries, workspacePath);
    }

    async getChildren(element) {
      if (!this.cachedFiles) {
        this.cachedFiles = await findProjectFiles();
        this._tree = null;
      }

      const hasItems = this.cachedFiles.managedForms.length > 0 ||
                       this.cachedFiles.ordinaryForms.length > 0 ||
                       this.cachedFiles.mxlTemplates.length > 0;

      if (!hasItems) {
        return [new EmptyItem('Формы и макеты не найдены в проекте')];
      }

      this._ensureTree();

      if (!element) {
        return treeNodeToFolderItems(this._tree, 'all');
      }

      if (element instanceof FolderItem && element._treeNode) {
        return treeNodeToFolderItems(element._treeNode, element.type);
      }

      return [];
    }
  }

  const projectFormsProvider = new ProjectFormsProvider();
  const treeView = vscode.window.createTreeView('1c-form-viewer-project-forms', {
    treeDataProvider: projectFormsProvider
  });

  const refreshSidebarDisposable = vscode.commands.registerCommand(
    '1c-form-viewer.refreshProjectForms',
    () => projectFormsProvider.refresh()
  );

  const filterProjectFormsDisposable = vscode.commands.registerCommand(
    '1c-form-viewer.filterProjectForms',
    async () => {
      const val = await vscode.window.showInputBox({
        prompt: 'Введите имя формы или макета для фильтрации...',
        value: projectFormsProvider.filterText,
        placeHolder: 'Например: ВыборИнтервалаДат'
      });
      if (val !== undefined) {
        projectFormsProvider.filterText = val.trim();
        treeView.description = projectFormsProvider.filterText ? `Фильтр: "${projectFormsProvider.filterText}"` : '';
        projectFormsProvider._tree = null;
        projectFormsProvider._onDidChangeTreeData.fire();
      }
    }
  );

  const clearProjectFormsFilterDisposable = vscode.commands.registerCommand(
    '1c-form-viewer.clearProjectFormsFilter',
    () => {
      if (projectFormsProvider.filterText) {
        projectFormsProvider.filterText = '';
        treeView.description = '';
        projectFormsProvider._tree = null;
        projectFormsProvider._onDidChangeTreeData.fire();
      }
    }
  );

  context.subscriptions.push(
    refreshSidebarDisposable,
    filterProjectFormsDisposable,
    clearProjectFormsFilterDisposable
  );

  const decorationProvider = vscode.window.registerFileDecorationProvider({
    provideFileDecoration(uri) {
      const basename = path.basename(uri.fsPath).toLowerCase();
      const translation = TRANSLATION_MAP[basename];
      if (translation) {
        return {
          badge: translation.badge,
          tooltip: translation.ru
        };
      }
      return null;
    }
  });
  context.subscriptions.push(decorationProvider);

  // Наблюдение за изменениями файлов в рабочей области для обновления списка проекта
  let sidebarRefreshTimer = null;
  function scheduleSidebarRefresh() {
    if (sidebarRefreshTimer) clearTimeout(sidebarRefreshTimer);
    sidebarRefreshTimer = setTimeout(() => {
      sidebarRefreshTimer = null;
      projectFormsProvider.refresh();
    }, 500);
  }

  const workspaceWatcher = vscode.workspace.createFileSystemWatcher('**/{*.xml,form.data}');
  workspaceWatcher.onDidCreate(() => scheduleSidebarRefresh());
  workspaceWatcher.onDidChange(() => scheduleSidebarRefresh());
  workspaceWatcher.onDidDelete(() => scheduleSidebarRefresh());
  context.subscriptions.push(workspaceWatcher);

  // ─── 1. Поддержка Outline для BSL ───────────────────────────────────────────
  const bslSymbolProvider = {
    provideDocumentSymbols(document, token) {
      const symbols = [];
      const text = document.getText();
      const regex = /^\s*(?:&[^\r\n]+\s+)?(?:\b(процедура|функция|procedure|function)\b)\s+([a-zA-Zа-яА-Я0-9_]+)/gim;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const keyword = match[1].toLowerCase();
        const name = match[2];
        const kind = (keyword === 'процедура' || keyword === 'procedure') 
          ? vscode.SymbolKind.Method 
          : vscode.SymbolKind.Function;
        
        const lineNum = document.positionAt(match.index).line;
        const line = document.lineAt(lineNum);
        
        symbols.push(new vscode.DocumentSymbol(
          name,
          match[0].trim(),
          kind,
          line.range,
          line.range
        ));
      }
      return symbols;
    }
  };
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider({ language: 'bsl' }, bslSymbolProvider)
  );

  // ─── BSL: вспомогательные утилиты для работы с идентификаторами ─────────────
  const BSL_WORD_PATTERN = /[a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*/;

  /**
   * Строит RegExp для точного поиска слова с учётом кириллицы
   * (стандартный \b не работает с кириллицей)
   */
  function bslWordRegex(word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `(?<![a-zA-Zа-яА-ЯёЁ_0-9])${escaped}(?![a-zA-Zа-яА-ЯёЁ_0-9])`,
      'g'
    );
  }

  /**
   * Определяет, является ли данная позиция в строке местом записи переменной.
   * Запись: идентификатор сразу за ним идёт = (но не <, >, !, =)
   */
  function isBslWritePosition(lineText, charIndex, wordLen) {
    const after = lineText.slice(charIndex + wordLen).trimStart();
    return /^=(?![=])/.test(after) && !/(?:Если|If|Пока|While|Тогда|Then)\b/i.test(lineText);
  }

  // ─── BSL: DocumentHighlightProvider ─────────────────────────────────────────
  // Клик на идентификатор → все вхождения подсвечиваются.
  // Места записи (= ...) и чтения — разным цветом темы.
  context.subscriptions.push(
    vscode.languages.registerDocumentHighlightProvider(
      { language: 'bsl' },
      {
        provideDocumentHighlights(document, position) {
          const wordRange = document.getWordRangeAtPosition(position, BSL_WORD_PATTERN);
          if (!wordRange) return [];
          const word = document.getText(wordRange);
          if (word.length < 2) return [];

          const text = document.getText();
          const regex = bslWordRegex(word);
          const highlights = [];
          let match;
          while ((match = regex.exec(text)) !== null) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + word.length);
            const range = new vscode.Range(start, end);
            const lineText = document.lineAt(start.line).text;
            const isWrite = isBslWritePosition(lineText, start.character, word.length);
            highlights.push(new vscode.DocumentHighlight(
              range,
              isWrite ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read
            ));
          }
          return highlights;
        }
      }
    )
  );

  // ─── BSL: ReferenceProvider ──────────────────────────────────────────────────
  // Shift+F12 → панель "References" со всеми вхождениями идентификатора
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(
      { language: 'bsl' },
      {
        provideReferences(document, position) {
          const wordRange = document.getWordRangeAtPosition(position, BSL_WORD_PATTERN);
          if (!wordRange) return [];
          const word = document.getText(wordRange);
          if (word.length < 2) return [];

          const text = document.getText();
          const regex = bslWordRegex(word);
          const locations = [];
          let match;
          while ((match = regex.exec(text)) !== null) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + word.length);
            locations.push(new vscode.Location(document.uri, new vscode.Range(start, end)));
          }
          return locations;
        }
      }
    )
  );

  // ─── BSL: RenameProvider ─────────────────────────────────────────────────────
  // F2 → переименовать переменную/функцию во всём файле одновременно
  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      { language: 'bsl' },
      {
        prepareRename(document, position) {
          const wordRange = document.getWordRangeAtPosition(position, BSL_WORD_PATTERN);
          if (!wordRange) {
            throw new Error('Нельзя переименовать этот символ');
          }
          const word = document.getText(wordRange);
          if (word.length < 2) {
            throw new Error('Нельзя переименовать этот символ');
          }
          return { range: wordRange, placeholder: word };
        },
        provideRenameEdits(document, position, newName) {
          const wordRange = document.getWordRangeAtPosition(position, BSL_WORD_PATTERN);
          if (!wordRange) return null;
          const word = document.getText(wordRange);
          if (word.length < 2) return null;

          const text = document.getText();
          const regex = bslWordRegex(word);
          const edit = new vscode.WorkspaceEdit();
          let match;
          while ((match = regex.exec(text)) !== null) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + word.length);
            edit.replace(document.uri, new vscode.Range(start, end), newName);
          }
          return edit;
        }
      }
    )
  );

  // ─── BSL: Semantic Tokens Provider ──────────────────────────────────────────
  // Раскрашивает параметры функций и переменные (Перем) в отдельные цвета темы.
  // Поддерживается большинством современных тем (One Dark, Night Owl, и др.)
  // Настройка через editor.semanticTokenColorCustomizations в settings.json
  const bslSemanticLegend = new vscode.SemanticTokensLegend(
    ['variable', 'parameter'],  // индексы: variable=0, parameter=1
    ['declaration']             // модификаторы: declaration=0
  );

  /**
   * Парсит BSL-документ, собирает имена параметров функций и Перем-переменных,
   * возвращает SemanticTokens для всех их вхождений.
   */
  function buildBslSemanticTokens(document) {
    const text = document.getText();
    const builder = new vscode.SemanticTokensBuilder(bslSemanticLegend);

    // --- 1. Собираем параметры всех функций/процедур ---
    const paramNames = new Set();
    const funcParamRx = /(?:Процедура|Функция|Procedure|Function)\s+[a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*\s*\(([^)]*)\)/gi;
    let m;
    while ((m = funcParamRx.exec(text)) !== null) {
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^\s*(?:Знач|Val)\s+/i, '').trim();
        if (/^[a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*$/.test(name) && name.length > 1) {
          paramNames.add(name);
        }
      }
    }

    // --- 2. Собираем имена Перем-переменных ---
    const varNames = new Set();
    const peremRx = /(?:Перем|Var)\b([^;\n]+)/gi;
    while ((m = peremRx.exec(text)) !== null) {
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/\s+(?:Экспорт|Export)$/i, '').trim();
        if (/^[a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*$/.test(name) && name.length > 1) {
          varNames.add(name);
        }
      }
    }

    if (paramNames.size === 0 && varNames.size === 0) return builder.build();

    // --- 3. Проходим по всем идентификаторам в документе ---
    // Пропускаем содержимое строк и комментариев
    const identRx = /(?:\/\/[^\n]*)|(?:"[^"]*")|([a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*)/g;
    while ((m = identRx.exec(text)) !== null) {
      if (!m[1]) continue; // пропускаем совпадения комментариев/строк

      const name = m[1];
      const pos = document.positionAt(m.index);

      if (paramNames.has(name)) {
        // parameter = тип 1
        builder.push(pos.line, pos.character, name.length, 1, 0);
      } else if (varNames.has(name)) {
        // variable = тип 0
        builder.push(pos.line, pos.character, name.length, 0, 0);
      }
    }

    return builder.build();
  }

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'bsl' },
      {
        provideDocumentSemanticTokens(document) {
          try {
            return buildBslSemanticTokens(document);
          } catch (e) {
            return null;
          }
        }
      },
      bslSemanticLegend
    )
  );

  // ─── 2. Команда переключения Код / Форма ─────────────────────────────────────
  const toggleCodeFormDisposable = vscode.commands.registerCommand('1c-form-viewer.toggleCodeForm', async (uri) => {
    let targetUri = uri;
    if (!targetUri) {
      const editor = vscode.window.activeTextEditor;
      if (editor) targetUri = editor.document.uri;
    }
    if (!targetUri) return;

    const fsPath = targetUri.fsPath;
    const dirname = path.dirname(fsPath);
    const basename = path.basename(fsPath).toLowerCase();

    let siblingUri = null;
    if (basename === 'form.xml') {
      const possiblePaths = [
        path.join(dirname, 'Ext', 'Form', 'Module.bsl'),
        path.join(dirname, 'Ext', 'form', 'Module.bsl'),
        path.join(dirname, 'Form', 'Module.bsl'),
        path.join(dirname, 'form', 'Module.bsl'),
        path.join(dirname, 'Module.bsl')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          siblingUri = vscode.Uri.file(p);
          break;
        }
      }
    } else if (basename === 'module.bsl') {
      const possiblePaths = [
        path.join(dirname, '..', '..', 'Form.xml'),
        path.join(dirname, '..', '..', 'form.xml'),
        path.join(dirname, '..', 'Form.xml'),
        path.join(dirname, '..', 'form.xml'),
        path.join(dirname, 'Form.xml'),
        path.join(dirname, 'form.xml')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          siblingUri = vscode.Uri.file(p);
          break;
        }
      }
    }

    if (siblingUri) {
      const doc = await vscode.workspace.openTextDocument(siblingUri);
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showInformationMessage('Не найден парный файл кода или описания формы.');
    }
  });
  context.subscriptions.push(toggleCodeFormDisposable);

  // ─── 4. Регистрация CustomTextEditorProvider для превью по клику ──────────────
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

      updateWebviewContent(info, document, fileType);
    }
  }

  context.subscriptions.push(FormPreviewEditorProvider.register(context));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
