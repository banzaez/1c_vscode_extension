const vscode = require('vscode');
const path = require('path');
const {
  ITEM_META,
  TRANSLATION_MAP,
  LEVEL2_SINGULAR,
  FORM_KIND_META
} = require('./constants');
const {
  stripTrailingExt,
  _utf8Decoder,
  contentIsManagedForm,
  contentIsMxlTemplate,
  contentIsOrdinaryFormDescriptor,
  contentIsMxlTemplateDescriptor,
  canonicalOrdinaryKey,
  canonicalMxlKey,
  readHead
} = require('./utils');

async function findProjectFiles() {
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

  const BATCH = 20;
  for (let start = 0; start < xmlUris.length; start += BATCH) {
    const batch = xmlUris.slice(start, start + BATCH);
    const results = await Promise.all(batch.map(async (uri) => {
      try {
        const buf = await readHead(uri);
        if (!buf.length) return null;
        const content = _utf8Decoder.decode(buf);
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

function getWorkspacePath(context) {
  const wsf = vscode.workspace.workspaceFolders;
  return wsf && wsf.length > 0 ? wsf[0].uri.fsPath : context.extensionPath;
}

function getFormPathSegments(fsPath, workspacePath, kind) {
  const rel = path.relative(workspacePath, fsPath);
  const parts = rel.split(path.sep);
  const fileName = parts[parts.length - 1];

  if (kind === 'ordinary' || fileName === 'form.data') {
    if (fileName.toLowerCase().endsWith('.xml') && fileName !== 'form.data') {
      const baseName = fileName.replace(/\.xml$/i, '');
      return parts.slice(0, -1).concat([baseName]);
    }
    return stripTrailingExt(parts.slice(0, -1));
  }

  if (kind === 'managed') {
    const baseName = fileName.replace(/\.xml$/i, '');
    return stripTrailingExt(parts.slice(0, -1)).concat([baseName]);
  }

  if (kind === 'mxl') {
    if (fileName.toLowerCase() !== 'template.xml' && fileName.toLowerCase().endsWith('.xml')) {
      const baseName = fileName.replace(/\.xml$/i, '');
      return parts.slice(0, -1).concat([baseName]);
    }
    const dirParts = stripTrailingExt(parts.slice(0, -1));
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

const _iconCache = new Map();

function getSidebarIcon(label, isLeaf, kind, context, category = null, level = 0) {
  const iconDir = path.join(context.extensionPath, 'resources', 'icons', 'standart');

  if (isLeaf) {
    return vscode.Uri.file(path.join(iconDir, kind === 'mxl' ? 'SpreadsheetShowGrid.png' : 'Form.png'));
  }

  const cacheKey = `${label}:${level}:${category}`;
  if (_iconCache.has(cacheKey)) return _iconCache.get(cacheKey);

  const explorerDir = path.join(context.extensionPath, 'resources', 'explorer');
  let result;

  if (level === 2 && category) {
    const singKey = LEVEL2_SINGULAR[category];
    const singMeta = singKey && ITEM_META[singKey];
    if (singMeta?.icon) {
      result = vscode.Uri.file(path.join(iconDir, singMeta.icon));
      _iconCache.set(cacheKey, result);
      return result;
    }
  }

  const lower = label.toLowerCase();
  const meta = ITEM_META[lower];
  if (meta?.icon) {
    const dir = meta.icon.endsWith('.svg') ? explorerDir : iconDir;
    result = vscode.Uri.file(path.join(dir, meta.icon));
    _iconCache.set(cacheKey, result);
    return result;
  }

  result = new vscode.ThemeIcon('folder');
  _iconCache.set(cacheKey, result);
  return result;
}

class EmptyItem extends vscode.TreeItem {
  constructor(message) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'empty';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

class FolderItem extends vscode.TreeItem {
  constructor(label, categoryType, context, treeNode = null) {
    const isLeaf = !!(treeNode && treeNode.associatedUri);
    const translation = TRANSLATION_MAP[label.toLowerCase()];
    const displayLabel = (!isLeaf && translation) ? `${label} (${translation.ru})` : label;
    super(displayLabel, isLeaf ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
    this.type = categoryType;
    this._treeNode = isLeaf ? null : treeNode;
    this.contextValue = 'formFolder';
    this.iconPath = getSidebarIcon(label, isLeaf, isLeaf ? treeNode.kind : null, context, treeNode ? treeNode.category : null, treeNode ? treeNode.level : 0);

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

function treeNodeToFolderItems(treeNode, categoryType, context) {
  return sortTreeNodes(
    Array.from(treeNode.children.values()).map(child => new FolderItem(child.label, categoryType, context, child))
  );
}

class ProjectFormsProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.cachedFiles = null;
    this.filterText = '';
  }

  refresh() {
    this.cachedFiles = null;
    this._tree = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  _ensureTree() {
    if (this._tree) return;
    const workspacePath = getWorkspacePath(this.context);
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
      return treeNodeToFolderItems(this._tree, 'all', this.context);
    }

    if (element instanceof FolderItem && element._treeNode) {
      return treeNodeToFolderItems(element._treeNode, element.type, this.context);
    }

    return [];
  }
}

module.exports = {
  ProjectFormsProvider,
  findProjectFiles
};
