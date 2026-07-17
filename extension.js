const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { TRANSLATION_MAP } = require('./src/constants');
const { getFileType, isSupportedFile, contentIsOrdinaryFormDescriptor, contentIsMxlTemplateDescriptor, readHead } = require('./src/utils');
const { openPanels, openPanelForDocument, updateWebviewContent, scheduleWebviewUpdate, resolveMetadataDescriptor, findSupportedFileInDirectory, FormPreviewEditorProvider } = require('./src/webview');
const { ProjectFormsProvider, findProjectFiles } = require('./src/sidebar');
const { bslSymbolProvider, bslHighlightProvider, bslReferenceProvider, bslRenameProvider, bslSemanticTokensProvider, bslSemanticLegend } = require('./src/bsl');

function activate(context) {
  let activeEditor = null;

  let disposable = vscode.commands.registerCommand('1c-form-viewer.openPreview', async (uri) => {
    let targetUri = uri;

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
          const buf = await readHead(targetUri);
          const head = require('./src/utils')._utf8Decoder.decode(buf);
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

      if (stat.type === vscode.FileType.Directory) {
        const foundUri = await findSupportedFileInDirectory(targetUri);
        if (foundUri) {
          targetUri = foundUri;
        } else {
          vscode.window.showInformationMessage('В выбранной папке не найдено поддерживаемых форм 1С или макетов');
          return;
        }
      }

      const doc = await vscode.workspace.openTextDocument(targetUri);
      if (!isSupportedFile(doc)) {
        vscode.window.showInformationMessage('Этот файл не поддерживается (ожидается Управляемая форма, Обычная форма или Макет MXL)');
        return;
      }

      activeEditor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
      });
      openPanelForDocument(doc, context);
    } catch (err) {
      vscode.window.showErrorMessage(`Не удалось открыть: ${err.message}`);
    }
  });

  let disposableForm = vscode.commands.registerCommand('1c-form-viewer.openFormPreview', (uri) => {
    return vscode.commands.executeCommand('1c-form-viewer.openPreview', uri);
  });

  context.subscriptions.push(disposable, disposableForm);

  vscode.workspace.onDidChangeTextDocument(e => {
    const info = openPanels.get(e.document.uri.toString());
    if (info) scheduleWebviewUpdate(info, e.document, context.extensionPath);
  }, null, context.subscriptions);

  vscode.workspace.onDidSaveTextDocument(document => {
    const info = openPanels.get(document.uri.toString());
    if (info) updateWebviewContent(info, document, context.extensionPath);
  }, null, context.subscriptions);

  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (!editor) return;
    const fileType = getFileType(editor.document);
    if (fileType === 'unknown' || fileType === 'metadata-descriptor') return;
    activeEditor = editor;
    const info = openPanels.get(editor.document.uri.toString());
    if (info) {
      info.panel.title = `Форма: ${path.basename(editor.document.fileName)}`;
      updateWebviewContent(info, editor.document, context.extensionPath, fileType);
    }
  }, null, context.subscriptions);

  let openFromSidebarDisposable = vscode.commands.registerCommand('1c-form-viewer.openFormFromSidebar', async (uri) => {
    await vscode.commands.executeCommand('1c-form-viewer.openPreview', uri);
  });
  context.subscriptions.push(openFromSidebarDisposable);

  // ─── Боковая панель ─────────────────────────────────────────────────────────
  const projectFormsProvider = new ProjectFormsProvider(context);
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

  // ─── Языковые провайдеры BSL ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider({ language: 'bsl' }, bslSymbolProvider),
    vscode.languages.registerDocumentHighlightProvider({ language: 'bsl' }, bslHighlightProvider),
    vscode.languages.registerReferenceProvider({ language: 'bsl' }, bslReferenceProvider),
    vscode.languages.registerRenameProvider({ language: 'bsl' }, bslRenameProvider),
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'bsl' },
      bslSemanticTokensProvider,
      bslSemanticLegend
    )
  );

  // ─── Команда переключения Код / Форма ────────────────────────────────────────
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

  // ─── Регистрация CustomTextEditorProvider ────────────────────────────────────
  context.subscriptions.push(FormPreviewEditorProvider.register(context));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
