const vscode = require('vscode');

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

const bslHighlightProvider = {
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
      const range = new vscode.Range(start, start.translate(0, word.length));
      const lineText = document.lineAt(start.line).text;
      const isWrite = isBslWritePosition(lineText, start.character, word.length);
      highlights.push(new vscode.DocumentHighlight(
        range,
        isWrite ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read
      ));
    }
    return highlights;
  }
};

const bslReferenceProvider = {
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
      locations.push(new vscode.Location(document.uri, new vscode.Range(start, start.translate(0, word.length))));
    }
    return locations;
  }
};

const bslRenameProvider = {
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
      edit.replace(document.uri, new vscode.Range(start, start.translate(0, word.length)), newName);
    }
    return edit;
  }
};

const bslSemanticLegend = new vscode.SemanticTokensLegend(
  ['variable', 'parameter'],  // индексы: variable=0, parameter=1
  ['declaration']             // модификаторы: declaration=0
);

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
    if (!m[1]) continue;

    const name = m[1];
    const pos = document.positionAt(m.index);

    if (paramNames.has(name)) {
      builder.push(pos.line, pos.character, name.length, 1, 0);
    } else if (varNames.has(name)) {
      builder.push(pos.line, pos.character, name.length, 0, 0);
    }
  }

  return builder.build();
}

const bslSemanticTokensProvider = {
  provideDocumentSemanticTokens(document) {
    try {
      return buildBslSemanticTokens(document);
    } catch (e) {
      return null;
    }
  }
};

module.exports = {
  bslSymbolProvider,
  bslHighlightProvider,
  bslReferenceProvider,
  bslRenameProvider,
  bslSemanticLegend,
  bslSemanticTokensProvider
};
