#!/usr/bin/env bash

# Скрипт для поднятия версии (patch) и сборки VS Code расширения

# Выходим при ошибке любого шага
set -e

echo "=== Шаг 1: Поднятие версии (patch) ==="
# npm version patch автоматически обновит версию в package.json и сделает git commit + tag, если репозиторий инициализирован.
# Используем --no-git-tag-version, чтобы избежать автоматических коммитов, если это не требуется, или если вы хотите делать их вручную.
# Если вы хотите коммиты и теги в git, удалите --no-git-tag-version.
npm version patch --no-git-tag-version

# Получаем новую версию из package.json
NEW_VERSION=$(node -p "require('./package.json').version")
echo "Новая версия: $NEW_VERSION"

echo "=== Шаг 2: Сборка расширения (.vsix) ==="
if ! command -v vsce &> /dev/null && ! command -v npx &> /dev/null; then
    echo "Ошибка: Ни vsce, ни npx не установлены."
    exit 1
fi

# Собираем расширение
# Если установлен vsce глобально, используем его, иначе запускаем через npx @vscode/vsce
if command -v vsce &> /dev/null; then
    vsce package
else
    npx -y @vscode/vsce package
fi

echo "=== Сборка завершена успешно! ==="
echo "Создан файл расширения для версии $NEW_VERSION"
