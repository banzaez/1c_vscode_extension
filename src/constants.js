// Единая таблица метаданных типов объектов 1С.
// Содержит: ru-название, badge для декораций, имя иконки (png → standart/, svg → explorer/).
const ITEM_META = {
  // ── Справочники ────────────────────────────────────────────────────────────
  'catalogs':                    { ru: 'Справочники',                  badge: 'СП', icon: 'Catalog.png' },
  'справочники':                 { icon: 'Catalog.png' },
  'catalog':                     { ru: 'Справочник',                   badge: 'СП', icon: 'CatalogObject.png' },
  'справочник':                  { icon: 'CatalogObject.png' },
  // ── Документы ──────────────────────────────────────────────────────────────
  'documents':                   { ru: 'Документы',                    badge: 'ДК', icon: 'Document.png' },
  'документы':                   { icon: 'Document.png' },
  'document':                    { ru: 'Документ',                     badge: 'ДК', icon: 'DocumentObject.png' },
  'документ':                    { icon: 'DocumentObject.png' },
  // ── Обработки ──────────────────────────────────────────────────────────────
  'dataprocessors':              { ru: 'Обработки',                    badge: 'ОБ', icon: 'DataProcessor.png' },
  'обработки':                   { icon: 'DataProcessor.png' },
  'dataprocessor':               { ru: 'Обработка',                    badge: 'ОБ', icon: 'DataProcessor.png' },
  'обработка':                   { icon: 'DataProcessor.png' },
  // ── Отчеты ─────────────────────────────────────────────────────────────────
  'reports':                     { ru: 'Отчеты',                       badge: 'ОТ', icon: 'Report.png' },
  'отчеты':                      { icon: 'Report.png' },
  'report':                      { ru: 'Отчет',                        badge: 'ОТ', icon: 'Report.png' },
  'отчет':                       { icon: 'Report.png' },
  'мдотчеты':                    { icon: 'Report.png' },
  // ── Перечисления ───────────────────────────────────────────────────────────
  'enums':                       { ru: 'Перечисления',                 badge: 'ПР', icon: 'Enum.png' },
  'перечисления':                { icon: 'Enum.png' },
  'enum':                        { ru: 'Перечисление',                 badge: 'ПР', icon: 'Enum.png' },
  'перечисление':                { icon: 'Enum.png' },
  // ── Регистры сведений ──────────────────────────────────────────────────────
  'informationregisters':        { ru: 'Регистры сведений',            badge: 'РС', icon: 'InformationRegister.png' },
  'регистрысведений':            { icon: 'InformationRegister.png' },
  'informationregister':         { ru: 'Регистр сведений',             badge: 'РС', icon: 'InformationRegister.png' },
  // ── Регистры накопления ────────────────────────────────────────────────────
  'accumulationregisters':       { ru: 'Регистры накопления',          badge: 'РН', icon: 'AccumulationRegister.png' },
  'регистрынакопления':          { icon: 'AccumulationRegister.png' },
  'accumulationregister':        { ru: 'Регистр накопления',           badge: 'РН', icon: 'AccumulationRegister.png' },
  // ── Регистры расчета ───────────────────────────────────────────────────────
  'calculationregisters':        { ru: 'Регистры расчета',             badge: 'РР', icon: 'CalculationRegister.png' },
  'регистрырасчета':             { icon: 'CalculationRegister.png' },
  'calculationregister':         { ru: 'Регистр расчета',              badge: 'РР', icon: 'CalculationRegister.png' },
  // ── Регистры бухгалтерии ───────────────────────────────────────────────────
  'accountingregisters':         { ru: 'Регистры бухгалтерии',         badge: 'РБ', icon: 'AccountingRegister.png' },
  'регистрыбухгалтерии':         { icon: 'AccountingRegister.png' },
  'accountingregister':          { ru: 'Регистр бухгалтерии',          badge: 'РБ', icon: 'AccountingRegister.png' },
  // ── Планы счетов ───────────────────────────────────────────────────────────
  'chartsofaccounts':            { ru: 'Планы счетов',                 badge: 'ПС', icon: 'ChartOfAccounts.png' },
  'планысчетов':                 { icon: 'ChartOfAccounts.png' },
  'chartofaccounts':             { ru: 'План счетов',                  badge: 'ПС', icon: 'ChartOfAccountsObject.png' },
  // ── Планы видов характеристик ──────────────────────────────────────────────
  'chartsofcharacteristictypes': { ru: 'Планы видов характеристик',    badge: 'ПХ', icon: 'ChartOfCharacteristicTypes.png' },
  'планывидовхарактеристик':     { icon: 'ChartOfCharacteristicTypes.png' },
  'chartofcharacteristictypes':  { ru: 'План видов характеристик',     badge: 'ПХ', icon: 'ChartOfCharacteristicTypesObject.png' },
  // ── Планы видов расчета ────────────────────────────────────────────────────
  'chartsofcalculationtypes':    { ru: 'Планы видов расчета',          badge: 'ВР', icon: 'ChartOfCalculationTypes.png' },
  'планывидоврасчета':           { icon: 'ChartOfCalculationTypes.png' },
  'chartofcalculationtypes':     { ru: 'План видов расчета',           badge: 'ВР', icon: 'ChartOfCalculationTypesObject.png' },
  // ── Бизнес-процессы ────────────────────────────────────────────────────────
  'businessprocesses':           { ru: 'Бизнес-процессы',              badge: 'БП', icon: 'BusinessProcess.png' },
  'бизнес-процессы':             { icon: 'BusinessProcess.png' },
  'бизнеспроцессы':              { icon: 'BusinessProcess.png' },
  'businessprocess':             { ru: 'Бизнес-процесс',               badge: 'БП', icon: 'BusinessProcessObject.png' },
  // ── Задачи ─────────────────────────────────────────────────────────────────
  'tasks':                       { ru: 'Задачи',                       badge: 'ЗД', icon: 'Task.png' },
  'задачи':                      { icon: 'Task.png' },
  'task':                        { ru: 'Задача',                       badge: 'ЗД', icon: 'TaskObject.png' },
  // ── Константы ──────────────────────────────────────────────────────────────
  'constants':                   { ru: 'Константы',                    badge: 'КН', icon: 'Constant.png' },
  'константы':                   { icon: 'Constant.png' },
  'constant':                    { ru: 'Константа',                    badge: 'КН', icon: 'Constant.png' },
  // ── Планы обмена ───────────────────────────────────────────────────────────
  'exchangeplans':               { ru: 'Планы обмена',                 badge: 'ПО', icon: 'ExchangePlan.png' },
  'планыобмена':                 { icon: 'ExchangePlan.png' },
  'exchangeplan':                { ru: 'План обмена',                  badge: 'ПО', icon: 'ExchangePlanObject.png' },
  // ── Критерии отбора ────────────────────────────────────────────────────────
  'filtercriteria':              { ru: 'Критерии отбора',              badge: 'КО', icon: 'FilterCriterion.png' },
  'критерииотбора':              { icon: 'FilterCriterion.png' },
  'filtercriterion':             { ru: 'Критерий отбора',              badge: 'КО', icon: 'FilterCriterion.png' },
  // ── Журналы документов ─────────────────────────────────────────────────────
  'documentjournals':            { ru: 'Журналы документов',           badge: 'ЖД', icon: 'DocumentJournal.png' },
  'журналыдокументов':           { icon: 'DocumentJournal.png' },
  'documentjournal':             { ru: 'Журнал документов',            badge: 'ЖД', icon: 'DocumentJournal.png' },
  // ── Внешние источники данных ───────────────────────────────────────────────
  'externaldatasources':         { ru: 'Внешние источники данных',     badge: 'ВД', icon: 'ExternalDataSource.png' },
  'внешниеисточникиданных':      { icon: 'ExternalDataSource.png' },
  'externaldatasource':          { ru: 'Внешний источник данных',      badge: 'ВД', icon: 'ExternalDataSource.png' },
  // ── Регламентные задания ───────────────────────────────────────────────────
  'scheduledjobs':               { ru: 'Регламентные задания',         badge: 'РЗ', icon: 'ScheduledJobs.png' },
  'регламентныезадания':         { icon: 'ScheduledJobs.png' },
  'scheduledjob':                { ru: 'Регламентное задание',         badge: 'РЗ', icon: 'ScheduledJobs.png' },
  // ── Подсистемы ─────────────────────────────────────────────────────────────
  'subsystems':                  { ru: 'Подсистемы',                   badge: 'ПД', icon: 'folder-subsystems.svg' },
  'подсистемы':                  { icon: 'folder-subsystems.svg' },
  'subsystem':                   { ru: 'Подсистема',                   badge: 'ПД' },
  // ── Формы ──────────────────────────────────────────────────────────────────
  'forms':                       { ru: 'Формы',                        badge: 'ФМ', icon: 'Form.png' },
  'формы':                       { icon: 'Form.png' },
  'form':                        { ru: 'Форма',                        badge: 'ФМ', icon: 'Form.png' },
  'форма':                       { icon: 'Form.png' },
  // ── Макеты ─────────────────────────────────────────────────────────────────
  'templates':                   { ru: 'Макеты',                       badge: 'МК', icon: 'SpreadsheetShowGrid.png' },
  'макеты':                      { icon: 'SpreadsheetShowGrid.png' },
  'template':                    { ru: 'Макет',                        badge: 'МК', icon: 'SpreadsheetShowGrid.png' },
  // ── Команды ────────────────────────────────────────────────────────────────
  'commands':                    { ru: 'Команды',                      badge: 'КМ', icon: 'FunctionMenuCommand.svg' },
  'команды':                     { icon: 'FunctionMenuCommand.svg' },
  'command':                     { ru: 'Команда',                      badge: 'КМ', icon: 'FunctionMenuCommand.svg' },
  // ── Реквизиты ──────────────────────────────────────────────────────────────
  'attributes':                  { ru: 'Реквизиты',                    badge: 'РК', icon: 'Attribute.png' },
  'реквизиты':                   { icon: 'Attribute.png' },
  'attribute':                   { ru: 'Реквизит',                     badge: 'РК', icon: 'Attribute.png' },
  // ── Измерения ──────────────────────────────────────────────────────────────
  'dimensions':                  { ru: 'Измерения',                    badge: 'ИЗ', icon: 'Dimension.png' },
  'измерения':                   { icon: 'Dimension.png' },
  'dimension':                   { ru: 'Измерение',                    badge: 'ИЗ', icon: 'Dimension.png' },
  // ── Ресурсы ────────────────────────────────────────────────────────────────
  'resources':                   { ru: 'Ресурсы',                      badge: 'РЦ', icon: 'Resource.png' },
  'ресурсы':                     { icon: 'Resource.png' },
  'resource':                    { ru: 'Ресурс',                       badge: 'РЦ', icon: 'Resource.png' },
  // ── Внешние файлы ──────────────────────────────────────────────────────────
  'ext':                         { ru: 'Внешние файлы',                badge: 'EX', icon: 'OpenFile.png' },
  // ── HTTP-сервисы ───────────────────────────────────────────────────────────
  'httpservices':                { ru: 'HTTP-сервисы',                 badge: 'HT', icon: 'folder-httpservices.svg' },
  'httpservice':                 { ru: 'HTTP-сервис',                  badge: 'HT', icon: 'folder-httpservices.svg' },
  'мдhtml':                      { icon: 'folder-httpservices.svg' },
  // ── Web-сервисы ────────────────────────────────────────────────────────────
  'webservices':                 { ru: 'Web-сервисы',                  badge: 'WS', icon: 'folder-webservices.svg' },
  'webservice':                  { ru: 'Web-сервис',                   badge: 'WS', icon: 'folder-webservices.svg' },
  // ── Параметры сеанса ───────────────────────────────────────────────────────
  'sessionparameters':           { ru: 'Параметры сеанса',             badge: 'ПМ', icon: 'folder-sessionparameters.svg' },
  'sessionparameter':            { ru: 'Параметр сеанса',              badge: 'ПМ', icon: 'folder-sessionparameters.svg' },
  // ── Группы команд ──────────────────────────────────────────────────────────
  'commandgroups':               { ru: 'Группы команд',                badge: 'ГК', icon: 'CustomizeForm.png' },
  'commandgroup':                { ru: 'Группа команд',                badge: 'ГК', icon: 'CustomizeForm.png' },
  // ── Общие картинки ─────────────────────────────────────────────────────────
  'commonpictures':              { ru: 'Общие картинки',               badge: 'ОК', icon: 'Picture.png' },
  'commonpicture':               { ru: 'Общая картинка',               badge: 'ОК', icon: 'Picture.png' },
  // ── Нумераторы документов ──────────────────────────────────────────────────
  'documentnumerators':          { ru: 'Нумераторы документов',        badge: 'НМ', icon: 'FindByNumber.png' },
  'documentnumerator':           { ru: 'Нумератор документов',         badge: 'НМ', icon: 'FindByNumber.png' },
  // ── Подписки на события ────────────────────────────────────────────────────
  'eventsubscriptions':          { ru: 'Подписки на события',          badge: 'ПБ', icon: 'EventLog.png' },
  'eventsubscription':           { ru: 'Подписка на событие',          badge: 'ПБ', icon: 'EventLog.png' },
  // ── Функциональные опции ───────────────────────────────────────────────────
  'functionaloptions':           { ru: 'Функциональные опции',         badge: 'ФО', icon: 'DataCompositionOutputParameters.png' },
  'functionaloption':            { ru: 'Функциональная опция',         badge: 'ФО', icon: 'DataCompositionOutputParameters.png' },
  // ── Интерфейсы ─────────────────────────────────────────────────────────────
  'interfaces':                  { ru: 'Интерфейсы',                   badge: 'ИТ', icon: 'CustomizeForm.png' },
  'interface':                   { ru: 'Интерфейс',                    badge: 'ИТ', icon: 'CustomizeForm.png' },
  // ── Последовательности ─────────────────────────────────────────────────────
  'sequences':                   { ru: 'Последовательности',           badge: 'ПО', icon: 'AppearanceRightArrowYellow.png' },
  'sequence':                    { ru: 'Последовательность',           badge: 'ПО', icon: 'AppearanceRightArrowYellow.png' },
  // ── Элементы стиля ─────────────────────────────────────────────────────────
  'styleitems':                  { ru: 'Элементы стиля',               badge: 'СТ', icon: 'DataCompositionConditionalAppearance.png' },
  'styleitem':                   { ru: 'Элемент стиля',                badge: 'СТ', icon: 'DataCompositionConditionalAppearance.png' },
  'styles':                      { ru: 'Стили',                        badge: 'СТ', icon: 'DataCompositionConditionalAppearance.png' },
  'style':                       { ru: 'Стиль',                        badge: 'СТ', icon: 'DataCompositionConditionalAppearance.png' },
  'мдбланки':                    { icon: 'DataCompositionConditionalAppearance.png' },
  // ── XDTO-пакеты ────────────────────────────────────────────────────────────
  'xdtopackages':                { ru: 'XDTO-пакеты',                  badge: 'XD', icon: 'Dendrogram.png' },
  'xdtopackage':                 { ru: 'XDTO-пакет',                   badge: 'XD', icon: 'Dendrogram.png' },
  // ── Общие реквизиты ────────────────────────────────────────────────────────
  'commonattributes':            { ru: 'Общие реквизиты',              badge: 'ОР', icon: 'Attribute.png' },
  'commonattribute':             { ru: 'Общий реквизит',               badge: 'ОР', icon: 'Attribute.png' },
  // ── Общие команды ──────────────────────────────────────────────────────────
  'commoncommands':              { ru: 'Общие команды',                badge: 'ОК', icon: 'FunctionMenuCommand.svg' },
  'commoncommand':               { ru: 'Общая команда',                badge: 'ОК', icon: 'FunctionMenuCommand.svg' },
  // ── Общие формы ────────────────────────────────────────────────────────────
  'commonforms':                 { ru: 'Общие формы',                  badge: 'ОФ', icon: 'Form.png' },
  'commonform':                  { ru: 'Общая форма',                  badge: 'ОФ', icon: 'Form.png' },
  // ── Общие модули ───────────────────────────────────────────────────────────
  'commonmodules':               { ru: 'Общие модули',                 badge: 'ОМ', icon: 'DataProcessor.png' },
  'commonmodule':                { ru: 'Общий модуль',                 badge: 'ОМ', icon: 'DataProcessor.png' },
  // ── Общие макеты ───────────────────────────────────────────────────────────
  'commontemplates':             { ru: 'Общие макеты',                 badge: 'ОТ', icon: 'SpreadsheetShowGrid.png' },
  'commontemplate':              { ru: 'Общий макет',                  badge: 'ОТ', icon: 'SpreadsheetShowGrid.png' },
  // ── Языки ──────────────────────────────────────────────────────────────────
  'languages':                   { ru: 'Языки',                        badge: 'ЯЗ', icon: 'FormattedString.png' },
  'language':                    { ru: 'Язык',                         badge: 'ЯЗ', icon: 'FormattedString.png' },
  // ── Роли ───────────────────────────────────────────────────────────────────
  'roles':                       { ru: 'Роли',                         badge: 'РЛ', icon: 'UserWithAuthentication.png' },
  'role':                        { ru: 'Роль',                         badge: 'РЛ', icon: 'UserWithAuthentication.png' },
};

// Маппинг для декораций и меток дерева — производится из ITEM_META автоматически
const TRANSLATION_MAP = Object.fromEntries(
  Object.entries(ITEM_META)
    .filter(([, v]) => v.ru && v.badge)
    .map(([k, v]) => [k, { ru: v.ru, badge: v.badge }])
);

// Для иконок узлов уровня 2 (папка конкретного объекта): plural → singular ключ в ITEM_META
const LEVEL2_SINGULAR = {
  'catalogs': 'catalog',
  'documents': 'document',
  'dataprocessors': 'dataprocessor',
  'reports': 'report',
  'enums': 'enum',
  'informationregisters': 'informationregister',
  'accumulationregisters': 'accumulationregister',
  'calculationregisters': 'calculationregister',
  'accountingregisters': 'accountingregister',
  'chartsofaccounts': 'chartofaccounts',
  'chartsofcharacteristictypes': 'chartofcharacteristictypes',
  'chartsofcalculationtypes': 'chartofcalculationtypes',
  'businessprocesses': 'businessprocess',
  'tasks': 'task',
  'exchangeplans': 'exchangeplan',
};

const FORM_KIND_META = {
  managed: { icon: 'layout', contextValue: 'managedForm', description: 'управляемая' },
  ordinary: { icon: 'window', contextValue: 'ordinaryForm', description: 'обычная' },
  mxl: { icon: 'table', contextValue: 'mxlTemplate', description: 'макет' },
};

module.exports = {
  ITEM_META,
  TRANSLATION_MAP,
  LEVEL2_SINGULAR,
  FORM_KIND_META
};
