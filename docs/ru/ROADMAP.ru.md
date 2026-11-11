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

D9

1. **`migrations/006_operation_log.sql`** — созданы таблицы `operations` и `operation_entries` (с `ON DELETE CASCADE` и индексом по `operation_id`).
2. **`src/main/core/OperationLog.js`** — реализован журнал операций:
   - `install()` идемпотентно создаёт служебную таблицу `_operation_context`, сканирует все пользовательские таблицы по `sqlite_master`, для каждой таблицы с единственным первичным ключом (кроме `settings`, `operations`, `operation_entries`, `_operation_context` и таблицы версий) создаёт триггеры `AFTER INSERT/UPDATE/DELETE`. Триггеры пишут в журнал только при открытом контексте (через `INSERT ... SELECT FROM _operation_context WHERE operation_id IS NOT NULL`). При установке контекст сбрасывается — это защищает от «зависшей» операции после падения.
   - `begin/commit/abort` управляют контекстом; при `commit` без записей операция удаляется; после успешного коммита лишние операции (сверх `max`) удаляются с каскадной чисткой записей.
   - `list()` возвращает операции от новых к старым с готовым `label` и счётчиком `entries`.
   - `buildLabel()` использует карту `config/operations.json`, а для `storage:*` добавляет имя модуля через `:` (фолбэк — `trash.<channel с точками>`).
   - `undo()` выполняется в одной транзакции с `PRAGMA defer_foreign_keys = ON`, применяет записи в обратном порядке, проверяет соответствие текущего состояния `after` (для insert/update) и отсутствие строки (для delete), при конфликте бросает `409`. Сама отмена не журналируется (канал `trash:` не открывает операцию).
3. **`src/main/core/IpcRouter.js`** — на каждый канал (кроме префиксов из `app.ipc.logSkipPrefixes`) открывает операцию, при успехе коммитит (оставляя только непустые), при ошибке — прерывает.
4. **`src/main/core/Database.js`** — добавлен метод `transactionDeferred()` для транзакций с отложенными проверками внешних ключей.
5. **`src/main/controllers/TrashController.js`** — реализованы каналы `trash:list` и `trash:undo` с валидацией `id` (400) и обработкой отсутствия операции (404).
6. **`src/main/Container.js`** — создан `OperationLog` (после миграций и сидов, до контроллеров), прокинут в `IpcRouter`, зарегистрирован `TrashController`; карта операций читается из конфига с фолбэком на `{}`.
7. **`config/operations.json`** — маппинг `domain:action → ключ локализации` для типовых каналов.
8. **`config/app.json`** — добавлены `app.ipc.logSkipPrefixes` (`trash:`, `auth:`) и `app.trash.max` (10).
9. **`tests/helpers.js`** — в возвращаемый объект добавлены `trash` (журнал) и `db` (соединение) для тестов.
10. **`tests/trash.test.js`** — покрыты сценарии: вставка / изменение / удаление (с отменой), каскадное удаление родителя с детьми и восстановление (проверка `defer_foreign_keys`), конфликт отмены (409 при изменённой строке), лимит 10 операций с каскадной чисткой записей, валидация `id` (400/404) и формирование `label` для `storage:*`.

## Примечания по дизайну

- Триггеры реализованы через `INSERT ... SELECT` с фильтром по `_operation_context`, а не через `WHEN` с подзапросом — так исключены любые ограничения SQLite на подзапросы в `WHEN` и обеспечена переносимость.
- Отмена выполняется в **обратном порядке** записей — это корректно и для вставок/обновлений, и для каскадных удалений.
- Сравнение текущего состояния строки с `after`/`before` устойчиво к разнице типов (число/строка/null).
- `_operation_context` — обычная таблица (не TEMP), чтобы триггеры гарантированно её видели и контекст не терялся между соединениями; сброс контекста при `install()` защищает от «унаследованной» операции после падения.

D10

### 1. `src/renderer/shell/TrashView.js` (новый)
- Создан отдельный компонент `TrashView` с внедряемыми `api`, `i18n`, `dialogs`.
- `resolveLabel(item)` — перевод метки операции:
  - если `label` содержит `:`, ключ берётся до `:`, суффикс (имя модуля для `storage:*`) выводится в скобках: «Хранилище: добавление (running)»;
  - иначе, если ключ есть в словаре, — `t(label)`;
  - иначе fallback на `channel` (требование ТЗ).
- `hasKey(key)` — использует `i18n.has`, если он есть, иначе сравнивает `t(key) !== key`.
- `render(container)` — загружает `trash:list`, рисует список или пустое состояние (`trash.empty`), статусную строку. Подпись-подсказка `trash.info` выводится над списком.
- Каждая строка: `label`, `at` (время операции из бэкенда, SQLite-формат), `entries` (число строк через ключ `trash.entries` с `{count}`), кнопка `trash.undo`.
- Кнопка «Отменить» → `dialogs.confirm` с `trash.confirm` (переводится через `t` с подстановкой `{label}`), `danger: true`.
- После подтверждения — `trash:undo {id}`. При ошибке:
  - `error.status === 409` → локализованное сообщение `trash.conflict` («Не удалось отменить: данные уже изменились»);
  - прочие — `error.message`.
- При успехе список полностью перерисовывается (`redraw()`), что удовлетворяет требованию «обновление списка после отмены».

### 2. `src/renderer/shell/SettingsView.js`
- Импортирован `TrashView`, добавлен в конструктор как `this.trashView`.
- В `render()` между секциями «Данные» и «Защита паролем» вставлена новая секция `settings.section.trash`.
- Метод `trash()` возвращает карточку с контейнером, куда `TrashView.render()` асинхронно подгружает список (не блокирует общий рендер страницы; аналогично существующим секциям со своим состоянием).

### 3. `src/renderer/shell/shell.css`
- Добавлены стили `.trash-container`, `.trash-list`, `.trash-row`, `.trash-info`, `.trash-label`, `.trash-meta` — карточки операций в стиле существующих `settings-card` (border, фон `s2`, моноширинный шрифт для метаданных). Остальные правила не тронуты.

### 4. `src/renderer/shell/locales/ru.json` и `en.json`
Добавлены одинаковые по структуре ключи:
- UI: `settings.section.trash`, `trash.info`, `trash.empty`, `trash.undo`, `trash.confirm`, `trash.confirmYes`, `trash.confirmNo`, `trash.conflict`, `trash.entries` (плоская строка с `{count}`, без plural-объекта — чтобы `compareDictionaries` не падал на разных наборах форм в ru/en).
- Метки операций (24 ключа) — все значения из `config/operations.json`: `trash.<domain>.<action>` для nutrition, sleep, running, workouts, measurements, mood, reaction, profile, storage.
- Для `storage:*` в UI выводится как «Хранилище: добавление (moduleId)» за счёт склейки с суффиксом после `:`, пришедшим с бэкенда.

### 5. `tests/translator.test.js`
- В `allowed`-набор теста «оболочка» добавлены все 24 ключа меток операций (`trash.nutrition.add`, … `trash.storage.remove`) — они приходят из конфига бэкенда, в коде не встречаются как литералы, поэтому их нельзя обнаружить статическим сканером.
- Добавлен отдельный тест `словарь оболочки: ключи корзины в обеих локалях`, проверяющий наличие и непустоту и UI-ключей, и всех меток в `ru.json` и `en.json`. Остальные тесты не менялись.


- **`hasKey(translationKey)`** — параметр переименован с `key` на `translationKey` (оканчивается на `Key`). Внутренний вызов `this.t(translationKey)` теперь проходит статический сканер.
- **`resolveLabel(item)`** — вместо динамических `label`/`key` используются `labelKey` и `rawLabel`/`suffix`:
  - `labelKey` вычисляется как часть метки до `:` (или вся метка, если разделителя нет);
  - `suffix` — часть после `:`, используется только для склейки (не идёт в `t()`);
  - единственный вызов `this.t(labelKey)` проходит проверку, так как `labelKey` оканчивается на `Key`;
  - fallback по-прежнему возвращает `item.channel`, если `labelKey` пуст или перевода нет.


## Примечания по дизайну

- `resolveLabel` устойчив к трём случаям: обычная метка (`trash.nutrition.add`), метка с суффиксом модуля (`trash.storage.add:running`), отсутствие ключа (fallback на `channel`). Это покрывает весь контракт из D9 без привязки к конкретному списку доменов.
- Проверка `i18n.has` используется, когда доступна; иначе — эвристика `t(key) !== key`. Это делает компонент совместимым и с `Translator`, и с любым обёрточным i18n-сервисом.
- Отмена не пишется в журнал (бэкенд D9 уже это обеспечивает через `logSkipPrefixes: ['trash:', …]`), поэтому после успешного undo список сам уменьшается — дополнительных действий не требуется.
- 409-ошибка из бэкенда («Строка … была изменена») заменяется локализованным сообщением — как и требовалось «понятным текстом».
- Стили не конфликтуют с существующими: новые классы с префиксом `.trash-` уникальны, `.settings-hint` и `.empty` переиспользуются.

- [ ] Перенос тестов из приватной ветки
  - [ ] Локализация сообщений бэкенда в тестах
- [ ] Корзина в настройках: последние 10 операций глобально с возможностью отмены (журнал операций на основе триггеров SQLite, отмена только если данные не изменились после операции, метки из operations.json, экран в настройках, тесты)

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
