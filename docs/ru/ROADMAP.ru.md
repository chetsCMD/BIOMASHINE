# Дорожная карта BIOMASHINE

## Как устроены версии

- **X.0.0** — смена парадигмы: глобальная возможность, которая меняет восприятие программы.
- **X.N.0** — новые функции и новые глобальные модули (например, дашборд).
- **X.N.P** — обычные модули и улучшения существующих или функции, недостойные иметь следующий вид.
## Термины

- **Виджет** — любое место на странице, которое выводит данные (число, список, статус, таблицу). Графики и другие чисто визуальные элементы виджетами не являются.
- **Модуль** — страница приложения с собственным пунктом меню. Модули бывают встроенными или добавленными пользователем.
- **Глобальный модуль** — модуль, который работает с данными других модулей (дашборд, аналитика, таймлайн).

# Релиз 1.0.0 — готово.

## Архитектура и ядро
- [x] Оболочка Electron, данные в локальной SQLite (better-sqlite3), связь через единый IPC-канал с диспетчером, репозитории и контроллеры в виде классов.
- [x] Принцип проекта: пользователь управляет программой. Всё, что можно передать пользователю, вынесено в настройки или конфиг; хардкод сведён к минимуму.
- [x] Логин и пароль (необязательная защита приложения).

## Модульная система и расширяемость
- [x] Модульная система: страницы в изолированных iframe с мостом bm, плагины (CSS), конфиги. Контракт: docs/Developers/Modules.md.
- [x] Системные и пользовательские модули (userData/modules), пользовательские конфиги, защита от повреждённых файлов.
- [x] bm.storage и протокол bm://.

## Время и локализация
- [x] Часовой пояс для сохраняемых даты и времени (выбор в настройках, блок «Время»).
  - [x] Настройка timezone (system или имя IANA), список зон из Intl с современными названиями (Asia/Kolkata, Europe/Kyiv), предпросмотр времени.
  - [x] Поиск при выборе часового пояса в настройках.
  - [x] ClockService в main и триггеры SQLite (миграция 003): все created_at и даты теста реакции записываются в выбранном поясе через функцию bm_now().
  - [x] bm.clock в SDK (now, today, timestamp); модуль reaction мигрирован.
  - [x] Классы часов модулей weight, sleep, nutrition, running, training мигрированы на bm.clock.
  - [x] Тесты для зон с разными смещениями, переходов через полночь и перехода на летнее время.
- [x] Многоязычная поддержка:
  - [x] Русский и английский из коробки, выбор языка (включая системный язык).
  - [x] Возможность добавлять свои языки: LocaleService, пользовательские языки в userData/locales, шаблон перевода.
  - [x] Использование в коде: bm.t, bm.locale, data-i18n; оболочка и все модули переведены (ru, en).

## Интерфейс и данные
- [x] Оболочка: настройки (тема, плагины, язык, автозапуск, модули с поиском, экспорт, пароль, время), быстрый переключатель Ctrl+P, F11, заставка, логотип.
- [x] Экспорт данных в JSON и CSV.

## Сборка (CI/CD)
- [x] Кроссплатформенные сборки через GitHub Actions (.github/workflows/release.yml).
  - [x] Матрица для Windows, Linux, macOS (arm64 и Intel), шаги npm install, node scripts/prepare.js, electron-builder --publish never, загрузка артефактов.
  - [x] Черновик GitHub Release по тегу v*.

## Документация
- [x] Корневой README.md.
- [x] Документация для сторонних разработчиков:
  - [x] docs/Developers/Project Map.md
  - [x] docs/Developers/Modules.md
- [x] Руководства для ИИ с проверяемыми примерами в docs/ai/:
  - [x] docs/ai/MODULE_GUIDE.md
  - [x] docs/ai/PLUGIN_GUIDE.md

# Релиз 1.1.0 — Навигация и повседневная надёжность

## D1. Навигация, часть 1: категории и закрепление (бэкенд)

### Реестр модулей
- [x] `src/main/services/ModuleRegistry.js` — необязательное поле `category` в манифесте; валидация тем же `ID_PATTERN`, что и `id`; отсутствие даёт `null`.

### Сервис модулей
- [x] `src/main/services/ModuleService.js` — ключи настроек `modules.pinned`, `modules.customCategories`, `modules.categoryOverrides`.
- [x] `list()` отдаёт `category` (override → манифест → `other`), `pinned`, `pinOrder`.
- [x] При пустых настройках все страницы закреплены в порядке `order`, плагины — нет.
- [x] Методы `setPinned`, `reorderPinned`, `setCategory`.
- [x] Методы `categories`, `createCategory` (транслит в слаг, имя 1–40 символов, id `custom-<slug>` с контр-суффиксом), `removeCategory` (только пользовательские, сбрасывает overrides).
- [x] Валидация ошибок: 400 на неверные типы/дубли, 404 на неизвестный модуль/категорию.

### Контроллер и DI
- [x] `src/main/controllers/ModulesController.js` — каналы `setPinned`, `reorderPinned`, `setCategory`, `categories`, `createCategory`, `removeCategory` с проверкой типов на границе.
- [x] `src/main/Container.js` — `ModuleService` получает `config` для доступа к `app.modules.categories`.

### Конфиг
- [x] `config/app.json` — `modules.categories`: шесть встроенных категорий (`body`, `mind`, `finance`, `knowledge`, `environment`, `other`) с `titleKey` вида `category.*`.

### Тесты
- [x] `tests/modules.test.js` — обновлён тест «реестр отклоняет неверные манифесты» (category в good, bad-категория, счётчик ошибок 10).
- [x] `tests/modules.test.js` — тесты на дефолты при пустых настройках, закрепление/порядок/сброс, CRUD пользовательских категорий, категорию из манифеста.
- [x] `tests/userModules.test.js` — тесты закрепления и категорий на user-модулях.

---

## D2. Навигация, часть 2: адаптивное верхнее меню (интерфейс)

### Чистая логика
- [x] `src/renderer/shell/MenuLayout.js` (новый) — статический `fit(items, availableWidth, options) → { visible, overflow, needsMore }`, без DOM. Обрабатывает пусто, нулевую ширину, нечисловые поля, точные границы.

### Навигация (top-режим)
- [x] `src/renderer/shell/Navigation.js` — рендерятся только `pinned`-страницы, отсортированные по `pinOrder`.
- [x] Кнопка «Ещё» появляется при переполнении; дропдаун содержит переполненные модули + пункт «Все модули» (`#hub`).
- [x] Активный модуль подсвечивается; при уходе в overflow — `has-active` у «Ещё» и активный пункт в дропдауне.
- [x] Drag-and-drop закреплённых (HTML5), `onReorder(allPinnedIds)` → `modules:reorderPinned`.
- [x] `ResizeObserver` на `<nav>` для перерасчёта раскладки.
- [x] Дропдаун позиционируется `fixed` относительно кнопки; закрывается по клику вне, Escape и при ре-рендере.

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — `navigation.onReorder → handleReorder`, `navigation.observe()`.
- [x] `ShellApp.js` — маршрут `#hub` (заглушка, D3 заменил на реальную страницу); `applyModules` учитывает `HUB_ID` в проверке активного маршрута.

### Разметка и стили
- [x] `src/renderer/shell/index.html` — `aria-label` у `<nav>` (структурных правок не потребовалось).
- [x] `src/renderer/shell/shell.css` — `.nav` (`nowrap`, `min-width: 0`, `position: relative`), `.nav-link` (`white-space: nowrap`, `flex-shrink: 0`), `.nav-more` и его состояния, `.nav-dropdown*`, `.nav-link.dragging` / `.drag-over`.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — ключи `nav.more`, `nav.allModules`, `category.body`, `category.mind`, `category.finance`, `category.knowledge`, `category.environment`, `category.other`.

### Тесты
- [x] `tests/translator.test.js` — два теста `MenuLayout` (все ветки `fit`, крайние случаи, порядок).
- [x] `tests/translator.test.js` — `category.*` и `palette.settingsKeywords` в белом списке неиспользуемых ключей (задействуются в D3).

---

## D3. Навигация, часть 3: страница «Все модули» (интерфейс)

### Компонент хаба
- [x] `src/renderer/shell/ModuleHub.js` (новый) — чистая логика в статических методах: `filterModules(modules, categories, { query, category })` (поиск через `TextSearch` по `title`/`description`/`id`), `group(modules, categories)` (порядок каталога, пустые категории пропускаются, неизвестные → `other`), `categoryTitle`, `categoryById`.
- [x] UI: поиск, чипы-фильтры по категориям, группы карточек.
- [x] Карточка: название, описание, бейдж категории, тег `user`/`system`, Pin/Unpin (только для страниц), селект категории (Reset + все категории; используется как `title`/`aria-label`), Hide/Show.
- [x] Блок «Свои категории»: форма создания (`modules:createCategory`), кнопка удаления у пользовательских (`modules:removeCategory`).
- [x] Каждое действие вызывает соответствующий канал (`modules:setPinned` / `setHidden` / `setCategory` / `createCategory` / `removeCategory`) и через `onChanged` передаёт свежий список в оболочку.

### Палитра
- [x] `src/renderer/shell/ModuleCommands.js` — команда «Все модули» (`#hub`); ключевые слова включают `palette.hubKeywords` («каталог», «hub» и т.п.).

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — `ui.hub = #hub-view`; создаётся `ModuleHub`; `showHub()` асинхронный; `showSettings` / `showModule` скрывают `#hub-view`; `changeLanguage` перерисовывает хаб при активном маршруте.

### Навигация
- [x] `src/renderer/shell/Navigation.js` — активная подсветка пункта «Все модули» в More-дропдауне при `activeId === HUB_ID`.

### Разметка и стили
- [x] `src/renderer/shell/index.html` — `<section id="hub-view" class="hub-view hidden">` внутри `#stage`.
- [x] `src/renderer/shell/shell.css` — стили хаба: `.hub-view`, `.hub`, `.hub-toolbar`, `.hub-search`, `.hub-chip`, `.hub-groups`, `.hub-group-title`, `.hub-cards`, `.hub-card*`, `.hub-action*`, `.hub-categories*`, `.hub-input`, `.hub-empty`. На CSS-переменных темы.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — `hub.search`, `hub.filter.all`, `hub.pin`, `hub.unpin`, `hub.hide`, `hub.unhide`, `hub.category`, `hub.categoryReset`, `hub.categoryManage`, `hub.categoryName`, `hub.categoryCreate`, `hub.categoryRemove`, `hub.categoryBuiltin`, `hub.empty`, `palette.hubKeywords`.

### Тесты
- [x] `tests/shell.test.js` — обновлён тест палитры (порядок с «Все модули», запуск `hub`, поиск «каталог»).
- [x] `tests/shell.test.js` — два теста на `ModuleHub`: фильтрация и группировка.
- [x] `tests/translator.test.js` — `palette.hubKeywords` в белом списке неиспользуемых ключей.
- [x] Правка по багу: ключ `hub.category` задействован в `buildCategorySelect` как `title`/`aria-label` селекта — больше не попадает в unused.

---

## D4. Навигация, часть 4: боковое меню (интерфейс и одна настройка)

### Настройки
- [x] `config/app.json` — в `settingsDefaults` добавлены `menuLayout: "top"` и `menuCollapsed: []`.
- [x] `src/main/services/SettingsService.js` — валидаторы `menuLayout` (`'top'`/`'sidebar'`) и `menuCollapsed` (массив строк).

### Навигация (sidebar-режим)
- [x] `src/renderer/shell/Navigation.js` — поля `mode`, `categories`, `collapsed`, коллбэк `onCollapseChanged`; метод `setLayout({ mode, collapsed, categories })`.
- [x] `draw()` разветвляется на `drawTop()` и `drawSidebar()`.
- [x] `drawSidebar()`: секция `.nav-side-pinned` со всеми закреплёнными (drag переиспользуется), непins группируются по категориям в порядке `this.categories`, «хвост» уходит в `category.other`, в конце — «Настройки».
- [x] `sidebarGroup(category, modules)` — сворачиваемая группа (`.nav-side-group-toggle` со стрелкой); клик обновляет `collapsed`, вызывает `onCollapseChanged([...next])`, перерисовывает.
- [x] Статический `categoryTitle(category, i18n)` — резолвинг заголовка (builtin → `titleKey`, custom → `name`).

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — `refreshLayout()` (фетчит `modules:categories`, переключает `#app.dataset.menuLayout`, вызывает `navigation.setLayout`).
- [x] `refreshLayout()` вызывается из `enter()` **после** `unlockIfNeeded()` — обходит 401 на `modules:categories`.
- [x] `changeLanguage()` также вызывает `refreshLayout()`.
- [x] `navigation.onCollapseChanged` → `handleCollapseChange` — сохраняет через `settings:set('menuCollapsed', ...)`.
- [x] `SettingsView` получает `onMenuLayoutChanged` → `handleMenuLayoutChange` (обновляет `this.settings`, вызывает `refreshLayout`).

### Настройки — UI
- [x] `src/renderer/shell/SettingsView.js` — в конструктор добавлен `onMenuLayoutChanged`.
- [x] `appearance()` — селект «Расположение меню» (`top`/`sidebar`) с `settings:set('menuLayout', ...)` → `onMenuLayoutChanged(updated)`; подсказка `settings.menuLayout.hint`.

### Разметка и стили
- [x] `src/renderer/shell/index.html` — `#app` получил `data-menu-layout="top"` (начальное значение, ShellApp переключает).
- [x] `src/renderer/shell/shell.css` — селекторы `#app[data-menu-layout="sidebar"]`: `.shell` → `row`; `.shell-header` → колонка фикс. 260px с `border-right`; `.nav` → колонка; `.header-right` → колонка с `margin-top: auto`; `.pills` → колонка; `.stage` → `flex: 1 1 auto`.
- [x] `shell.css` — стили sidebar-элементов: `.nav-side-item` (hover/active/drag), `.nav-side-pinned`, `.nav-side-group`, `.nav-side-group-toggle`, `.nav-side-group-title`, `.nav-side-group-arrow`, `.nav-side-group-items`.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — `settings.menuLayout`, `settings.menuLayout.top`, `settings.menuLayout.sidebar`, `settings.menuLayout.hint`.

---

## D5. Два входа в «Все модули» (меню и настройки)

### Навигация
- [x] `src/renderer/shell/Navigation.js` — **top-режим**: постоянная ссылка «Все модули» слева от «Настройки». Кнопка «Ещё» вставляется перед ней. В `MenuLayout.fit` передаётся составной `settingsWidth = allModulesWidth + gap + settingsWidth` — эквивалентно одному трейлинг-блоку. More скрывает только `pinned`, «Все модули» и «Настройки» видимы всегда.
- [x] `src/renderer/shell/Navigation.js` — **sidebar-режим**: в конце, после всех категорий, `.nav-side-footer` с двумя ссылками: «Все модули» (`.nav-hub`) и «Настройки» (`.nav-settings`); активны при `activeId === HUB_ID` / `SETTINGS_ID`.
- [x] «Все модули» подсвечивается активными в обоих режимах (`.nav-link.active` в топе, `.nav-side-item.active` в сайдбаре).

### Настройки — UI
- [x] `src/renderer/shell/SettingsView.js` — в конструктор добавлен `onOpenHub`.
- [x] `modules()` — первая кнопка блока `.settings-actions` «Все модули» (`nav.allModules`) с `onclick → this.onOpenHub()`; порядок: «Все модули» → «Открыть папку модулей» → «Перечитать».

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — при создании `SettingsView` пробрасывается `onOpenHub: () => this.navigate(Navigation.HUB_ID)`.

### Стили
- [x] `src/renderer/shell/shell.css` — `.nav-side-footer` (`border-top`, `margin-top`, `padding-top`, колонка с gap). Удалён прежний `.nav-side-item.nav-settings { border-top: … }` — разделитель теперь на `.nav-side-footer`.
- [x] `shell.css` — `.settings-actions` получил `flex-wrap: wrap` (три кнопки на узких экранах переносятся вместо сжатия).

## D6. Горячие клавиши: сервис, каналы и редактор (бэкенд и интерфейс)

### Реестр действий
- [x] `config/app.json` — три действия: `fullscreen`, `quickSwitch`, `moduleHub`; источник привязок по умолчанию — `shortcuts`.
- [x] `config/app.json` — для `moduleHub` установлена комбинация `Ctrl/Meta+H`.
- [x] `config/app.json` — `shortcuts:` внесён в `ipc.openPrefixes` (UI читает и меняет комбинации без авторизации).
- [x] Главный процесс отправляет в окно событие `shortcut` со строкой `moduleHub`.

### Сервис
- [x] `src/main/services/ShortcutService.js` — переработан на `{ defaults, settings, actions }`.
- [x] `ShortcutService` — методы `list`, `set`, `reset`, `match`, `attach`, `bind`.
- [x] `ShortcutService` — привязки читаются динамически через `settings.get('shortcuts')` на каждый вызов; переопределения применяются без перезапуска.
- [x] `ShortcutService` — валидация: разрешённые `code` (`Key*`, `Digit*`, `F1–F12`); без модификатора допускаются только функциональные; `Escape`/`Tab`/`Enter` запрещены; проверка дубликатов с указанием конфликтующего `id`.
- [x] `ShortcutService` — ошибки `AppError.badRequest` (HTTP 400).

### Окно и приложение
- [x] `src/main/WindowManager.js` — принимает `ShortcutService`, при создании окна вызывает `bind()`, подписывается `attach(contents)`; в `moduleHub` — `webContents.send('shortcut', 'moduleHub')`.
- [x] `src/main/Application.js` — передаёт `container.shortcuts` в `WindowManager`.

### Контроллер и DI
- [x] `src/main/Container.js` — инстанцирует `ShortcutService` после `SettingsRepository`, регистрирует `ShortcutController`.
- [x] `src/main/controllers/ShortcutController.js` — канал `shortcuts`, обработчики `list`, `set`, `reset`; для совместимости выставлены оба свойства `channel` и `prefix`.

### Настройки
- [x] `src/main/services/SettingsService.js` — валидатор `shortcuts` (объект), чтобы `settings:set` не записал мусор под ключом.

### Редактор (интерфейс)
- [x] `src/renderer/shell/ShortcutEditor.js` — новый самодостаточный компонент: `render(items, container)` принимает уже загруженный `shortcuts:list`, рисует строки и «Сбросить все».
- [x] `ShortcutEditor.js` — отображение привязки: `Ctrl+Shift+P` в Windows/Linux, `Cmd+Shift+P` в macOS; `code` форматируется (`KeyP → P`, `Digit1 → 1`, `F11 → F11`).
- [x] `ShortcutEditor.js` — запись по клику на значение: `keydown` на `document` в capture-фазе, `preventDefault`/`stopPropagation`; `Escape` — отмена, `Tab`/`Enter` игнорируются; сохраняется `{code, ctrlOrMeta, shift, alt}` через `shortcuts:set`.
- [x] `ShortcutEditor.js` — при ошибке 400 из текста извлекаются известные `id` и показываются как локализованные заголовки («Конфликт с: Быстрый переключатель»).
- [x] `ShortcutEditor.js` — сброс одного/всех через `shortcuts:reset {id}` / `shortcuts:reset {}`; кнопка «Сбросить» блокируется при `custom === false`.
- [x] `ShortcutEditor.js` — защита от «записи вслепую»: проверка `root.isConnected` и отсутствия `.hidden` у предков.

### Настройки — UI
- [x] `src/renderer/shell/SettingsView.js` — добавлен раздел `settings.section.shortcuts` после «Запуска»; `shortcuts:list` включён в общий `Promise.all`; `ShortcutEditor` создаётся в конструкторе.

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — `onShortcut(name)` обрабатывает `moduleHub`, вызывая `navigate(Navigation.HUB_ID)`; общий guard `ready && !app.hidden`.

### Разметка и стили
- [x] `src/renderer/shell/shell.css` — `.shortcut-row`, `.shortcut-controls`, `.shortcut-value` (`.recording` с пульсацией, `.custom`), `.shortcut-reset:disabled`, `.shortcut-list`.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — `shortcut.fullscreen`, `shortcut.quickSwitch`, `shortcut.moduleHub`, `settings.section.shortcuts`, `settings.shortcuts.press/reset/resetAll/custom/conflict`.

### Тесты
- [x] `tests/shell.test.js` — тест горячих клавиш переведён на новый API `ShortcutService`, добавлены проверки `Ctrl+H` для `moduleHub`.
- [x] `tests/helpers.js` — `createApp` возвращает `shortcuts: container.shortcuts`.
- [x] `tests/shortcuts.test.js` — новый файл: список и дефолты, `set` с живым применением, конфликты (400 + id конфликтующего), запрет `Escape/Tab/Enter`, допустимые коды, `reset` одного/всех, отклонение неизвестного `id`.
- [x] `tests/translator.test.js` — в `allowed` добавлены `shortcut.fullscreen/quickSwitch/moduleHub` (приходят динамически как `titleKey` из `shortcuts:list`).

---

## D7. Уведомления, часть 1: хранение и планировщик (бэкенд)

### Миграция
- [x] `migrations/005_notifications.sql` — таблица `notifications` (module, title, body, kind, at, repeat_type, repeat_time, repeat_weekdays, next_at, created_at), индексы `next_at` и `module`, триггер `created_at` через `bm_now()`.

### Репозиторий
- [x] `src/main/repositories/NotificationRepository.js` — единственное место SQL для уведомлений; наследует `BaseRepository`.
- [x] `NotificationRepository` — вставка, удаление, выборки по модулю, ближайшие к срабатыванию, обновление `next_at`, подсчёт и список модулей — через `this.queryAll` / `this.queryOne` / `this.exec`, без прямого `this.db`.

### Сервис
- [x] `src/main/services/NotificationService.js` — планировщик на одном `setTimeout` с пересчётом после изменений.
- [x] `NotificationService` — обработка пропущенных при старте (группировка по модулю, один показ).
- [x] `NotificationService` — расчёт следующих срабатываний для `daily` и `weekdays` через настенное время `ClockService`.
- [x] `NotificationService` — учёт отключённых модулей (`notifications.disabled`): не показываются, но повторы продвигаются.
- [x] `NotificationService` — методы `schedule`, `cancel`, `list`, `setEnabled`, `modules`, `tick`, `start`, `stop`.

### Контроллер и DI
- [x] `src/main/controllers/NotificationController.js` — наследует `BaseController`; `get prefix() { return 'notifications' }`; метод `routes()` вместо свойства `channels`.
- [x] `NotificationController` — `requirePermission(module)`: 400 при отсутствии `module`, 403 при отсутствии `permissions: ["notifications"]` (статус выставляется вручную, без зависимости от `AppError.forbidden`).
- [x] `NotificationController` — валидация `id` в `cancel` через `Number.isInteger`.
- [x] `NotificationController` — валидация `at` (`YYYY-MM-DD HH:MM:SS`), `repeat.type`, `repeat.time`, `repeat.weekdays` (0..6, без дублей).
- [x] `src/main/Container.js` — связывает `NotificationRepository`, `NotificationService`, `NotificationController`; запускает планировщик после сборки и останавливает в `close()`.

### Система
- [x] `src/main/ElectronSystem.js` — метод `showNotification({title, body})` на базе Electron `Notification`.

### Реестр и сервис модулей
- [x] `src/main/services/ModuleRegistry.js` — валидирует `permissions` (`["notifications"]`) и сохраняет в манифесте.
- [x] `src/main/services/ModuleService.js` — `describe` отдаёт `permissions` в `modules:list`.

### Конфиг
- [x] `config/app.json` — дефолт `notifications.disabled: []`.

### Тесты
- [x] `tests/helpers.js` — `StubSystem` получил массив `notifications` и метод `showNotification`.
- [x] `tests/notifications.test.js` — новый файл: расписание, повторы, пропущенные, отключение, 403, отмена, список модулей.

---

## D8. Уведомления, часть 2: SDK и настройки (интерфейс)

### SDK
- [x] `src/renderer/sdk/ModuleNotifications.js` — новый класс: `schedule(options)`, `cancel(id)`, `list()` поверх `client.invoke`, без бизнес-логики.
- [x] `src/renderer/sdk/ModuleClient.js` — импорт `ModuleNotifications` и поле `this.notify` рядом с `this.storage`; снаружи — `bm.notify.schedule(...)`.

### Мост
- [x] `src/renderer/shell/ModuleBridge.js` — в конструкторе `this.permissions = new Set()`.
- [x] `ModuleBridge` — `attach` сохраняет `descriptor.permissions`, `detach` сбрасывает.
- [x] `ModuleBridge` — `notifications:*` обрабатываются до `policy`: без `permissions: ['notifications']` — 403 через общий `deny(channel)`; с разрешением — `api.invoke` с подставленным `module: this.moduleId`.
- [x] `ModuleBridge` — вызов `notifications:setEnabled` с чужим `module` перезаписывается на собственный id модуля (исключает управление другими модулями).

### Настройки — UI
- [x] `src/renderer/shell/SettingsView.js` — `notifications:modules` добавлен в `Promise.all`; переменная `notificationModules`.
- [x] `SettingsView` — секция `settings.section.notifications` после «Модули», метод `notificationsBlock(entries, modules)`.
- [x] `SettingsView` — каждая запись: название модуля (из `modules:list`, fallback — id) и чекбокс → `notifications:setEnabled` с `{module, enabled}`.
- [x] `SettingsView` — при `count > 0` подсказка через `settings.notifications.count`; пустой список — `settings.notifications.empty`.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — `settings.section.notifications`, `settings.notifications.empty`, `settings.notifications.count`.

### Тесты
- [x] `tests/renderer.test.js` — новый тест «уведомления: SDK и мост — инъекция module, права, 403»: `client.notify.schedule/list/cancel` доходят до `api.invoke` с подставленным `module`, `notifications:setEnabled` с чужим id перезаписывается, модуль без `permissions: ['notifications']` получает 403 до вызова API.
- [x] `tests/translator.test.js` — новый тест «словарь оболочки: ключи уведомлений в обеих локалях», проверяет наличие и непустоту трёх новых ключей в `ru.json` и `en.json`.

## D9. Корзина, часть 1: журнал операций и отмена (бэкенд)

### Миграция
- [x] `migrations/006_operation_log.sql` — таблицы `operations (id, channel, module, created_at)` и `operation_entries (id, operation_id, table_name, row_id, kind, before, after)`; `ON DELETE CASCADE` на `operation_id`; индекс `idx_operation_entries_operation`.

### Журнал операций
- [x] `src/main/core/OperationLog.js` — новый класс журнала.
- [x] `OperationLog.install()` — идемпотентно создаёт служебную таблицу `_operation_context` (одна строка `id = 1`), сбрасывает `operation_id` в NULL, сканирует `sqlite_master`, для каждой таблицы с единственным PK (кроме `settings`, `operations`, `operation_entries`, `_operation_context`, `schema_migrations`, `migrations`) создаёт триггеры `AFTER INSERT/UPDATE/DELETE`.
- [x] `OperationLog` — триггеры через `INSERT ... SELECT ... FROM _operation_context WHERE operation_id IS NOT NULL` (без `WHEN` с подзапросом); JSON-образы строк собираются через `json_object()`.
- [x] `OperationLog.begin/commit/abort` — открывают/закрывают контекст; при `commit` без записей операция удаляется; после успешного коммита лишние операции сверх `max` удаляются вместе с записями (каскад FK).
- [x] `OperationLog.list()` — от новых к старым, возвращает `{id, channel, label, at, entries}`.
- [x] `OperationLog.buildLabel()` — из карты `config/operations.json`, для `storage:*` добавляет имя модуля через `:`; фолбэк `trash.<channel с точками>`.
- [x] `OperationLog.undo(id)` — одна транзакция с `PRAGMA defer_foreign_keys = ON`, применяет записи в обратном порядке: для `insert` удаляет строку, для `update` возвращает `before`, для `delete` вставляет `before`; проверяет соответствие текущего состояния `after` (insert/update) и отсутствие строки (delete), при несовпадении — 409; сама отмена не журналируется.
- [x] `OperationLog` — сравнение `sameRow()` устойчиво к числу/строке/null.

### IpcRouter
- [x] `src/main/core/IpcRouter.js` — конструктор принимает третий аргумент `operationLog`; читает `app.ipc.logSkipPrefixes` (`trash:`, `auth:`).
- [x] `IpcRouter.dispatch()` — при прохождении auth и наличии обработчика открывает операцию через `operationLog.begin()`, при ошибке хендлера — `abort`, при успехе — `commit`; открытие/закрытие операции не влияет на форму ответа.
- [x] `IpcRouter` — `shouldLog(channel)` отсекает префиксы из `logSkipPrefixes`; это гарантирует, что `trash:undo` не попадает в журнал.

### База данных
- [x] `src/main/core/Database.js` — добавлен метод `transactionDeferred(work)`: оборачивает `connection.transaction`, внутри включает `PRAGMA defer_foreign_keys = ON` — нужен для отмены каскадных удалений.

### Контроллер и DI
- [x] `src/main/controllers/TrashController.js` — новый контроллер; `get prefix() { return 'trash' }`; `routes()` с `list` и `undo`.
- [x] `TrashController` — `undo` валидирует `id` через `Number.isInteger` (400 при невалидном), 404 при отсутствии операции (из `OperationLog.undo`).
- [x] `src/main/Container.js` — после миграций и сидов создаётся `OperationLog` (с `max` из `app.trash.max` и картой из `operations.json`, чтение с фолбэком на `{}`), передаётся третьим аргументом в `IpcRouter`; `TrashController` регистрируется в общем списке.

### Конфиг
- [x] `config/operations.json` — новый файл, карта `domain:action → ключ локализации` для nutrition, sleep, running, workouts, measurements, mood, reaction, profile, storage.
- [x] `config/app.json` — добавлены `app.ipc.logSkipPrefixes: ["trash:", "auth:"]` и `app.trash.max: 10`.

### Тесты
- [x] `tests/helpers.js` — `createApp()` возвращает дополнительные `trash` (журнал) и `db` (соединение).
- [x] `tests/trash.test.js` — новый файл: вставка/изменение/удаление с отменой, каскадное удаление с восстановлением, конфликт 409 при изменённой строке, лимит 10 с каскадной чисткой `operation_entries`, валидация `id` (400/404), формирование `label` для `storage:*`.

---

## D10. Корзина, часть 2: экран в настройках (интерфейс)

### Компонент
- [x] `src/renderer/shell/TrashView.js` — новый класс с внедряемыми `api`, `i18n`, `dialogs`.
- [x] `TrashView.render(container)` — вызывает `trash:list`, рисует подсказку `trash.info`, список или пустое состояние `trash.empty`, статусную строку для ошибок.
- [x] `TrashView.row(item, redraw, status)` — строка с меткой, временем `at`, числом строк `trash.entries` (`{count}`) и кнопкой «Отменить».
- [x] `TrashView` — «Отменить» вызывает `dialogs.confirm` с `trash.confirm` (`{label}`), `danger: true`; после подтверждения — `trash:undo {id}`, при 409 показывается `trash.conflict`, при прочих — `error.message`; при успехе список перерисовывается.
- [x] `TrashView.resolveLabel(item)` — ключ вычисляется в `labelKey` (часть до `:`), суффикс модуля для `storage:*` выводится в скобках; проверка наличия через `hasKey(labelKey)`, fallback — `item.channel`.
- [x] `TrashView.hasKey(translationKey)` — использует `i18n.has`, если доступно; иначе — `t(translationKey) !== translationKey`; имя параметра оканчивается на `Key`, чтобы проходить статический сканер `I18nScan`.

### Настройки — UI
- [x] `src/renderer/shell/SettingsView.js` — импорт `TrashView` и поле `this.trashView`.
- [x] `SettingsView.render()` — новая секция `settings.section.trash` между «Данные» и «Защита паролем».
- [x] `SettingsView.trash()` — возвращает карточку с контейнером; `TrashView.render()` подгружает данные асинхронно, не блокируя общий рендер.

### Стили
- [x] `src/renderer/shell/shell.css` — классы `.trash-container`, `.trash-list`, `.trash-row`, `.trash-info`, `.trash-label`, `.trash-meta`; существующие `.settings-hint` и `.empty` переиспользуются.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — UI-ключи `settings.section.trash`, `trash.info`, `trash.empty`, `trash.undo`, `trash.confirm`, `trash.confirmYes`, `trash.confirmNo`, `trash.conflict`, `trash.entries` (плоская строка с `{count}` — обходит разницу plural-форм ru/en).
- [x] `ru.json` / `en.json` — 24 ключа меток операций `trash.<domain>.<action>` для nutrition, sleep, running, workouts, measurements, mood, reaction, profile, storage.

### Тесты
- [x] `tests/translator.test.js` — в `allowed`-набор теста «оболочка» добавлены 24 ключа меток (приходят из конфига бэкенда, статическим сканером не находятся).
- [x] `tests/translator.test.js` — новый тест «словарь оболочки: ключи корзины в обеих локалях», проверяет наличие и непустоту UI-ключей и всех меток в `ru.json` и `en.json`.

## D11. Multi-View (Split Screen Workspace): два модуля одновременно

Возможность открывать два модуля-страницы на одном экране: `Ctrl+Click` (или `Cmd+Click` на macOS) по модулю в навигации открывает его справа от текущего; между панелями — перетаскиваемая граница; в правом верхнем углу каждой панели — крестик для закрытия.

### Конфигурация
- [x] `config/split.json` — новый файл: `minRatio: 0.15`, `maxRatio: 0.85`, `defaultRatio: 0.5`. Пороги вынесены в JSON по правилу раздела 7 карты («Все константы живут в `config/*.json`»); чтение через `config:get` (канал уже в `ipc.openPrefixes`, доступен до логина).

### Чистая логика (без DOM)
- [x] `src/renderer/shell/SplitState.js` — новый класс: `primaryId`, `secondaryId`, геттер `isSplit`, методы `open(id)` (сброс в single), `openSplit(id)` (возвращает `false`, если primary не открыт или совпадает с id), `closeRight()`, `closeLeft()` (повышает secondary до primary, возвращает его id), `reset()`.
- [x] `src/renderer/shell/SplitRatio.js` — новый класс: принимает конфиг в конструкторе (`min`, `max`, `default` из `config/split.json`), методы `clamp(ratio)` (устойчив к `NaN`/`Infinity`), `fromDelta(startRatio, deltaX, width)` (клипает, отбрасывает невалидную ширину), `toPercent(ratio)`. Никаких `static MIN/MAX/DEFAULT` — все пороги из конфига.

### DOM-компоненты
- [x] `src/renderer/shell/Splitter.js` — новый класс: перетаскиваемая граница. `mousedown` на элементе, `mousemove`/`mouseup` на `document`, класс `body.mv-dragging` на время drag, `destroy()` отписывает и удаляет. Принимает инстанс `SplitRatio` и вызывает `ratio.fromDelta(...)`.
- [x] `src/renderer/shell/SplitPane.js` — новый класс: одна панель (iframe + `ModuleBridge` + крестик). Методы: `mount(container)`, `attachBridge()`, `addCloseButton()` (пропускается для роли `single`), `showCrash(message)`, `reload()`, `setRole(role)` (используется при сворачивании split в single, убирает крестик), `destroy()`. Пиллы в шапку отправляет только левая панель, чтобы не мерцали.
- [x] `src/renderer/shell/SplitView.js` — новый класс: контейнер двух панелей и сплиттера. Методы: `open(descriptor)` (single), `openSplit(primary, secondary)` (две панели + сплиттер), `applyRatio(ratio)`, `removePane(role)` (оставшаяся панель становится `single`), `close()` (уничтожает обе панели и сплиттер). Хранит инстанс `SplitRatio` и текущий `ratio`.

### Навигация
- [x] `src/renderer/shell/NavMultiClick.js` — новый класс: перехват `Ctrl+Click`/`Cmd+Click` на навигации. Слушает `document` в capture-фазе, чтобы отработать раньше `<a href="#module/...">`. Проверяет модификатор, `root.contains(target)`, `isPage(id)` (id берётся из `data-module-id`/`data-id` или из `href="#module/<id>"`), затем `preventDefault()` + `stopImmediatePropagation()` и `onOpen(id)`. Методы `attach()`/`detach()`.

### Хост модулей
- [x] `src/renderer/shell/ModuleHost.js` — переписан как тонкий делегатор над `SplitView`. Публичный контракт сохранён: `open(descriptor)`, `openSplit(primary, secondary)`, `removePane(role)`, `close()`, `setPluginCss(urls)`. ~35 строк вместо ~200 — вся логика ушла в отдельные классы.

### Оболочка
- [x] `src/renderer/shell/ShellApp.js` — переписан: вместо двух полей `activeId`/`secondaryId` — инстанс `SplitState` (`this.split`); вместо собственного `navClickHandler` — `NavMultiClick`; в `start()` грузит `config:get {name: 'split'}` и создаёт `SplitRatio`, передаёт его в `ModuleHost`. Методы `enterSplit(id)`, `showSplit()`, `handleClosePane(role)` (закрытие правой панели оставляет левую single; закрытие левой — правая становится активной, URL обновляется через `history.replaceState`). Сброс split в `showModule`/`showSettings`/`showHub`/`lock`.

### Стили
- [x] `src/renderer/shell/shell.css` — классы `.mv-pane`, `.mv-pane-left`, `.mv-pane-right`, `.mv-pane-single`, `.mv-frame`, `.mv-splitter` (+ `::after`-ручка), `.mv-close`, `body.mv-dragging` (курсор `col-resize`, `pointer-events: none` на iframe), `body.is-split-view` (подсветка шапки), `.stage.mv-split` (flex-контейнер). Старый `.module-frame` удалён. В fullscreen-режиме крестик панели сдвинут на `right: 82px`, чтобы не пересекаться с кнопками управления окном.

### Локали
- [x] `src/renderer/shell/locales/ru.json` / `en.json` — ключ `multiView.close` («Закрыть панель» / «Close pane»).

### Тесты
- [x] `tests/multi-view.test.js` — новый файл в стиле `tests/renderer.test.js` (`node:test` + `node:assert/strict` + CommonJS + ESM через `pathToFileURL`).
  - `SplitState`: все методы + граничные случаи (`openSplit` без primary, `openSplit` на тот же id, `closeLeft` без split).
  - `SplitRatio`: значения `min`/`max`/`default` берутся из реального `config/split.json`, а не из литералов; отдельный тест на переопределение конфига (`{minRatio: 0.2, maxRatio: 0.8, defaultRatio: 0.4}`), подтверждающий, что код читает конфиг, а не вшитые числа.
  - `NavMultiClick`: пропуск без модификатора, `Ctrl+Click`, `Cmd+Click`, неизвестный модуль, клик вне навигации, `attach`/`detach` с capture-флагом.

- [x] Создания установщика для Windows
  - [x] добавить в сборку Windows обычный установщик (цель NSIS, установка для текущего пользователя, выбор папки, ярлык на рабочем столе, удаление программы не стирает данные) рядом с `portable` и `zip`. Имя артефакта `BIOMASHINE-<версия>-setup.exe`.
  - [x] Workflow должен загружать и публиковать установщик вместе с остальными файлами.
  - [x] В README описать различие: установленная версия хранит данные в `%APPDATA%\BIOMASHINE`, портативная рядом с программой.  
- [ ] Перенос тестов из приватной ветки
  - [ ] Локализация сообщений бэкенда в тестах

# Релиз 1.2.0 — Кастомизация без границ

- [ ] Пользователя никогда не заставляют использовать фиксированный стиль. Любой цвет, шрифт, размер или деталь раскладки можно изменить по запросу, во всём приложении или в одном модуле, даже если это ломает стандартный вид.
  - [ ] Токены дизайна (радиусы, отступы, шрифты, размеры, тени, толщина границ, акцентные цвета) управляют всем интерфейсом, и целую тему можно определить через токены.
  - [ ] Встроенный редактор тем с живым предпросмотром: изменяйте любой цвет, шрифт или размер оболочки и каждого модуля отдельно; экспорт и импорт тем.
  - [ ] Переопределения для модулей и элементов, например, один блок другого цвета на одной странице.
  - [ ] Плагины с несколькими CSS-файлами и определённым порядком применения, а также один единый список «тема + плагины» с сортировкой перетаскиванием.
     
# Релиз 2.0.0 — Соберите своё приложение

Программа перестаёт быть фиксированным набором страниц и становится тем, что формирует каждый пользователь.

- [ ] **Режим просмотра и режим холста** — всё приложение имеет два режима. Режим просмотра предназначен для использования программы. В режиме холста вы можете перемещать и изменять размер любого блока в любом модуле, включая модули, которые вы не создавали, располагать их как вам нравится и сохранять раскладку для каждого модуля. Раскладку можно в любой момент сбросить к исходной.
- [ ] **Конструктор модулей** — соберите страницу для себя за минуту из готовых блоков, как из Lego, без программирования. Библиотека блоков (текстовое поле, ввод даты, число, выбор, список, график и другие), холст, где блоки свободно располагаются, и шаг сохранения, который фиксирует раскладку и превращает результат в обычный модуль. Пользователи могут создавать и делиться своими собственными блоками.

# Релиз 2.1.0 — Общий слой данных и Дашборд

Модули делятся данными контролируемым образом. Каждая последующая кросс-модульная функция строится на этом релизе.

- [ ] **Контракт метрик и событий** — модуль объявляет в своём манифесте, какие метрики, события, цели и виджеты он публикует (название, тип, единица измерения, как читать значения). Другие модули могут читать опубликованные данные только после того, как пользователь предоставит разрешение; разрешения видны в Настройках и могут быть отозваны в любой момент.
- [ ] **Дашборд** — страница, собранная из виджетов, опубликованных всеми модулями. Раскладка работает как холст: виджеты можно свободно размещать, изменять их размер и переставлять, а расположение сохраняется. Примеры виджетов: текущий вес, продолжительность сна за сегодня, калории за сегодня.
- [ ] **Пользовательские метрики** — создайте собственный показатель с названием, типом данных, единицей измерения, допустимым диапазоном, частотой измерений и опциональной формулой расчёта (например, часы, потраченные на чтение научной литературы). Пользовательские метрики публикуются через тот же контракт и появляются на дашборде и во всех инструментах анализа.

# Релиз 2.2.0 — Таймлайн и Эксперименты

- [ ] **Таймлайн** — единый жизненный таймлайн с событиями из всех установленных модулей, например, «6 часов сна», «45-минутная тренировка», «расходы 850», «настроение 7/10», «2200 ккал» в один и тот же день. Он включает в себя модуль Событий и вид дня, который реконструирует любой день из всех источников, включая заметки журнала и комментарии к измерениям.
- [ ] **Эксперименты** — проводите эксперименты над собственным образом жизни, например, отказ от кофеина: установите дату начала и окончания, выберите показатели для изучения, зафиксируйте базовые значения и сравните показатели до, во время и после эксперимента с результатами и выводами.

# Релиз 2.3.0 — Аналитика и Отчёты

- [ ] **Аналитика** — одно место для визуализации данных из всех модулей: графики за произвольный период, сравнение двух периодов, средние значения, минимумы и максимумы, процентные изменения.
- [ ] **Отчёты** — сгенерированные сводки за выбранный период (неделя, месяц, год или любой диапазон) с ключевыми показателями, изменениями по сравнению с предыдущим периодом и экспортом в файл.
- [ ] **Цели** — общая страница, которая собирает цели всех модулей (целевые значения, дедлайны, прогресс) в один список.

# Релиз 2.4.0 — Инсайты

- [ ] **Корреляции** — сопоставляйте любые два показателя и смотрите, как они движутся вместе, например, сон и настроение, калории и вес, тренировки и сила, расходы и доходы.
- [ ] **Аномалии** — автоматический поиск необычных изменений: вес изменился сильнее обычного, расходы резко выросли, сон стал намного короче, пульс вышел за пределы обычного диапазона.
- [ ] **Обнаружение паттернов** — находит повторяющиеся паттерны в данных (эффекты дня недели, сезонные изменения, повторяющиеся циклы) и представляет их простым языком.
- [ ] **Качество данных** — показывает, сколько измерений было пропущено, какие показатели давно не обновлялись, противоречат ли записи друг другу, выглядят ли значения подозрительно и насколько полны данные за выбранный период.

# Не распределённые идеи для ближайших обновлений (1.2.0 - 2.0.0).

1) Trigger Engine. Пользовательский конструктор правил «Если — То». Связывает все модули в единую живую систему. Например: «Если сон < 6 часов (данные из модуля Сон), то завтра в модуль Настроение пишется предупреждение». Или: «Если расходы за день превысили лимит, в модуле Тренировки ставится задача пойти побегать».
2) Predictor. Прогнозирование на основе исторических данных. Приложение строит математическую модель (линейную регрессию) и говорит: «При текущем темпе твоего сна, тренировок и питания, к 15 мая твой вес достигнет 78 кг, а дистанция в беге — 500 км. Но если ты будешь спать на час меньше, ты достигнешь цели на 2 недели позже». Аналитика будущего, а не прошлого.
3) Сохранение состояния при выходе. При выходе приложение спрашивает: «Сохранить состояние?». Если да — при следующем заходе пользователь видит тот же экран (те же открытые модули, фильтры, скроллы), что и при выходе.
4) Редактирование конфигов изнутри. Возможность менять JSON-конфиги (коэффициенты, цвета и т.д.) прямо в интерфейсе приложения без необходимости перекомпиляции и перезапуска.
5) Профили. Возможность создавать несколько независимых пространств (как Vault в Obsidian) для разделения контекстов. Например, один профиль «Я реальный», второй — «Эксперимент», третий — «Песочница» для тестирования модулей.

# Не распределённые идеи для обновлений когда-нибудь.
1) BIOMASHINE Headless — точно версия 3.0.0. Разделение приложения на «Ядро» (сервер без интерфейса) и «Клиент» (веб-интерфейс). Устанавливаешь на домашний сервер или старый ноутбук, база данных живет там. Заходишь через браузер с любого устройства по локальной сети или через VPN.
2) BIOMASHINE CLI. Отдельный бинарник или режим запуска для работы с данными из терминала. Например: `bm sleep add --start "23:00" --end "07:00"` или `bm export --format csv`. Это рай для автоматизации и скриптов. Ты сможешь писать bash-скрипты, которые собирают данные с датчиков и закидывают их в базу без открытия Electron. И это логичный шаг после Headless (3.0.0).
3) Перевод бэкенда на Rust. Переписывание тяжелых частей бэкенда (работа с БД, обработка потоков данных от датчиков) на Rust через N-API (binding для связи JS и Rust). JS/Electron остается для UI, а Rust берет на себя высоконагруженные вычисления и работу с миллионами записей (пульс, кислород), чтобы JS не захлебывался.

# X.N.P

## Модули ежедневного трекинга

- [ ] **Настроение** — переработанный дневник настроения: одна быстрая запись в день с оценкой настроения и опциональными шкалами (тревога, страх, грусть, злость, энергия, напряжение, мотивация, стресс), комментарий, обзор календаря и график тренда.
- [ ] **Лекарства** — лекарства с дозировкой и расписанием (ежедневно, по выбранным дням недели, через день, по необходимости), журнал приёма, обзор «принято сегодня» и опциональные напоминания о приёме через системные уведомления.
- [ ] **Здоровье** — показатели жизнедеятельности: давление, пульс, температура тела и симптомы в свободной форме, с графиками и подсветкой нормального диапазона.
- [ ] **Привычки** — повторяющиеся действия с ежедневной отметкой, сериями и календарём выполнения.
- [ ] **Улучшения питания** — отслеживание клетчатки и потребления воды рядом с калориями и макронутриентами.

## Заметки, практики и модули личного трекинга

- [ ] **Журнал** — хронологический блокнот: заметки в свободной форме, привязанные к датам, теги, поиск и вид календаря.
- [ ] **События** — запись значимых изменений в вашей жизни (начал принимать лекарство, изменил диету, переехал, бросил кофеин) с датой, категорией и кратким описанием. События хранятся в форме, которую будущие релизы смогут размещать на графиках и на таймлайне.
- [ ] **Медитация** — таймер сеанса с журналом продолжительности, частоты и типа практики, недельной статистикой и опциональными собственными звуковыми файлами.
- [ ] **Вещества** — счётчики кофеина, никотина и других веществ с ежедневным лимитом, журналом записей и графиком тренда.
- [ ] **Чтение** — прочитанные книги, страницы, скорость чтения и прогресс по каждой книге.
- [ ] **Учёт времени** — таймер старт/стоп и ручные записи, показывающие, как время распределяется между активностями.
- [ ] **Финансы** — расходы и доходы с категориями, счетами и бюджетами с лимитами; месячные сводки и графики.
- [ ] **Улучшения тела** — замеры тела: обхваты и мышечная масса рядом с весом, процентом жира и водой.
- [ ] **Улучшения кардио** — ходьба и езда на велосипеде рядом с бегом, со статистикой по конкретным активностям.

# Каталог модулей

Идеи, у которых пока нет релиза. Каждую из них можно реализовать как обычный модуль на существующей модульной системе, и она выпускается как patch-версия, когда подходит её очередь. Модули, которые зависят от общего слоя данных, используют его, как только он появится.

## Физическое состояние
- **Восстановление** — самочувствие, усталость и уровень восстановления, вводимые быстро каждый день.
- **Фотографии прогресса** — фотографии с датами для визуального отслеживания прогресса (требует вложений файлов в слое хранения).

## Психологическое состояние
- **Психология** — тревога, раздражительность, концентрация и стресс как отдельные шкалы с трендами.
- **Когнитивные способности** — тесты памяти и внимания рядом с существующим тестом реакции, с общей историей результатов.
- **Ментальная энергия** — быстрая субъективная оценка ментальной энергии в течение дня.
- **Социальное** — общение и социальная активность: с кем, когда, как это ощущалось.

## Финансы
- **Активы и обязательства** — имущество, сбережения, долги и обязательства.
- **Инвестиции** — активы и доходность, вводимые вручную (приложение никогда не выходит в сеть само по себе).
- **Чистый капитал** — активы минус обязательства с течением времени.

## Интеллектуальная деятельность
- **Образование** — учебные сессии, уроки и продолжительность.
- **Знания** — изученные темы и приобретённые навыки с уровнями.
- **Проекты** — проекты, прогресс и затраченное время.

## Внешняя среда и поведение
- **Окружение** — температура, влажность и освещение, вводимые вручную или импортируемые из файла.
- **Погода** — ежедневные погодные условия, вводимые вручную.
- **Экранное время** — время за компьютером и телефоном, вводимое вручную.
- **Цифровая активность** — использование программ, сайтов и игр (требует интеграции с операционной системой).
- **Поведение** — поведенческие реакции и повторяющиеся сценарии.
- **Локация** — посещённые места и перемещения (требует интеграции с операционной системой и модели приватности).
