# BIOMASHINE: карта проекта

Этот документ описывает, как устроен BIOMASHINE: модель процессов, структуру репозитория, контракт IPC, слой данных, конфигурацию, локализацию, часовые пояса и сборку. Авторам модулей читать вместе с [Modules.md](Modules.md).

## 1. Обзор

BIOMASHINE — среда для персонального трекинга. Полностью офлайновое десктопное приложение: без сервера, без аккаунтов, без сетевых запросов, без CDN. Всё хранится в локальной базе SQLite.

| Слой | Технология |
|---|---|
| Оболочка | Electron (главный процесс, preload-скрипт, рендерер) с `contextIsolation: true` и `sandbox: true` |
| Хранилище | SQLite через `better-sqlite3`, один файл на установку |
| Интерфейс к данным | Один IPC-канал (`api`) с диспетчером, маршрутизирующим имена `domain:action` в контроллеры |
| Интерфейс | Оболочка-рендерер и страницы («модули») в изолированных iframe, ES-модули, Chart.js и шрифты из npm |
| Стиль кода | Объектно-ориентированный, один класс на файл, константы в JSON-конфигах |

## 2. Модель процессов

```
┌────────────────────────── главный процесс ────────────────────────┐
│ Application ─ Container (композиционный корень)                   │
│   IpcRouter ─ Контроллеры ─ Сервисы ─ Репозитории ─ SQLite        │
│   ProtocolHandler (bm://)   WindowManager   ShortcutService       │
└────────────▲──────────────────────────────────────────────────────┘
             │ ipcRenderer.invoke('api', channel, payload)
┌────────────┴─── рендерер: оболочка (bm://app/shell/index.html) ────┐
│ window.api (preload)   ShellApp   ModuleBridge   SettingsView ...  │
│   ┌──────── iframe bm://<module-id>/index.html ────────┐           │
│   │ SDK (bm)  ──postMessage──►  ModuleBridge           │           │
│   └─────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────┘
```

- Главный процесс владеет базой данных, конфигурацией, аутентификацией и любой возможностью, которая трогает операционную систему (диалоги, автозапуск, внешние ссылки, состояние окна).
- Preload-скрипт выставляет оболочке ровно один объект, `window.api`: `invoke(channel, payload)`, `onShortcut(handler)` и `onWindowState(handler)`. Модули его не получают.
- Каждый модуль-страница работает в собственном `<iframe>` со своим origin (`bm://<module-id>`). Модуль общается с оболочкой через мост `postMessage`; оболочка проверяет объявленные каналы модуля и передаёт разрешённые вызовы главному процессу. См. [Modules.md](Modules.md).
- Файлы отдаются собственным привилегированным протоколом, `bm://`. `bm://app/...` отображается в `src/renderer`, `bm://<module-id>/...` — в папку модуля. Резолвер отказывается отдавать любой путь, выходящий за пределы базового каталога.

## 3. Структура репозитория

```
build/                    иконки (ico, png, icns) и заставка портативного лаунчера
config/                   все настройки и константы в виде JSON
migrations/               SQL-миграции, применяются по порядку, версия хранится в PRAGMA user_version
scripts/prepare.js        копирует Chart.js и шрифты из node_modules в src/renderer/vendor
scripts/i18n.js           npm run i18n: status, files, add, check
src/main/
  main.js                 точка входа
  Application.js          жизненный цикл Electron: один экземпляр, привилегированная схема, окно
  Container.js            собирает все сервисы, репозитории и контроллеры
  ElectronSystem.js       адаптер ОС: диалоги, автозапуск, перезапуск, внешние ссылки, состояние окна
  WindowManager.js        окно, защита навигации, события фуллскрина
  ProtocolHandler.js      отдаёт файлы bm://
  ShortcutService.js      глобальные горячие клавиши (F11, Ctrl/Cmd+P)
  PortablePaths.js        папка данных рядом с программой в портативных сборках
  core/                   Database, Migrator, ConfigService, IpcRouter, AssetResolver, BaseRepository,
                          BaseController, AppError, Attribution, Dates, Values, MimeTypes, MessageTranslator
  repositories/           единственное место, где живёт SQL
  services/               AuthService, SettingsService, ClockService, LocaleService, ModuleRegistry,
                          ModuleService, ThemeCatalog, ExportService, SeedService, MessageService
  controllers/            обработчики IPC: валидация и бизнес-правила
  locales/                бэкенд-словари (ru.json, en.json, ...): сообщения об ошибках, проблемы
src/preload/preload.js    window.api
src/renderer/
  shell/                  меню, вход, настройки, палитра команд, мост, диалоги, темы
  sdk/                    SDK модуля (bm), переводчик, часы, протокол сообщений
  shared/                 base.css, components.css, общие словари (locales/)
  modules/<id>/           модули (manifest.json, index.html, module.css, js/, locales/, README.md)
  vendor/                 генерируется scripts/prepare.js, не хранится в git
docs/                     документация
```

Пользовательские данные лежат в каталоге `userData` Electron (`%APPDATA%\BIOMASHINE` на Windows, `~/.config/BIOMASHINE` на Linux, `~/Library/Application Support/BIOMASHINE` на macOS):

```
biomashine.sqlite         база данных
config/                   пользовательские переопределения конфигов (раздел 7)
modules/                  пользовательские модули и плагины
locales/                  пользовательские языковые файлы (раздел 10)
```

В портативных сборках (Windows `portable`, Linux AppImage) та же структура создаётся в папке `BIOMASHINE-data` рядом с исполняемым файлом, чтобы программу и её данные можно было переносить вместе.

## 4. Жизненный цикл и композиция

`Application.run()`:

1. Задаёт папку данных (портативный режим) и берёт блокировку одного экземпляра.
2. Собирает `Container` до того, как приложение готово. Это открывает базу, запускает миграции, загружает конфигурацию и регистрирует все контроллеры.
3. Регистрирует привилегированную схему `bm://` и ставит `lang` Chromium из выбранного языка интерфейса (это управляет форматом нативных `<input type="date">`).
4. После `ready`: подключает обработчик протокола, IPC-роутер и окно.

`Container` — единственный композиционный корень. Зависимости передаются через конструкторы; ничего не глобально. Каждый класс берёт то, что ему нужно, что держит главный процесс свободным от Electron-кода, кроме тонких `ElectronSystem`, `WindowManager`, `ProtocolHandler` и `Application`.

## 5. Контракт IPC

```js
const data = await window.api.invoke('domain:action', payload);
```

Роутер отвечает `{ ok: true, data }` или `{ ok: false, status, error, code? }`; preload превращает сбой в брошенный `Error` с `message`, `status` и, если есть, `code`. Частые статусы: `400` некорректный ввод, `401` заблокировано, `403` запрещено, `404` не найдено. Необязательный `code` — ключ словаря, из которого переведено сообщение (раздел 10); неожиданная ошибка скрывает детали за `error.internal` и не несёт `code`.

**Шлюз аутентификации.** Когда установлен пароль, каждый канал, кроме тех, чьё имя начинается с префикса из `app.json` → `ipc.openPrefixes` (`auth:`, `settings:get`, `config:get`, `i18n:bundle`, `i18n:languages`, `window:`, `shortcuts:`), возвращает `401` до входа.

**Соглашения о данных.**

| Вид | Формат |
|---|---|
| Дата | `YYYY-MM-DD` |
| Метка времени | `YYYY-MM-DD HH:MM:SS` (настенное время в выбранном часовом поясе, без суффикса зоны) |
| Время суток | `HH:MM:SS` (`HH:MM` для тренировок) |
| Числа | JSON-числа |
| Булевы | `true` / `false` |
| JSON-колонки | возвращаются как объекты и массивы |
| Идентификаторы | числа |

### Каналы данных здоровья

Параметры с пометкой `?` необязательны. Успешные каналы записи возвращают `null`, если не сказано иначе.

| Канал | Payload | Результат |
|---|---|---|
| `profile:get` | | `{height, age, trainings_count}` |
| `profile:overview` | | `{user, measurements, goals}` |
| `profile:updateParams` | `{height, age, trainings_count}` | обновлённый профиль (рост и возраст — положительные целые, тренировки — целое ≥ 0) |
| `measurements:list` | | `[{date, weight, fat, water}]` по дате |
| `measurements:save` | `{date, weight, fat?, water?}` | upsert по дате |
| `measurements:remove` | `{date}` | `404`, если нет |
| `measurements:getGoals` | | `{weight_goal, fat_goal, deadline}` (null, если не задано) |
| `measurements:saveGoals` | `{weight_goal, fat_goal, deadline}` | |
| `sleep:listLogs` | | `[{id, start_time, end_time}]`, сначала новые |
| `sleep:addLog` | `{start_time, end_time}` (разделитель `T` или пробел) | `{id}`; `400`, если конец не позже начала |
| `sleep:removeLog` | `{id}` | |
| `sleep:getSchedule` | | `{ideal_bedtime, ideal_waketime}` (null, если не задано) |
| `sleep:saveSchedule` | `{ideal_bedtime, ideal_waketime}` | |
| `sleep:resetSchedule` | | очищает идеальный график |
| `sleep:listNoSleep` | | `["YYYY-MM-DD", ...]` |
| `sleep:addNoSleep` | `{date}` | `400`, если в этот день уже есть записи сна |
| `sleep:removeNoSleep` | `{date}` | |
| `nutrition:list` | | `[{id, date, name, weight, calories, protein, fat, carbs}]`, сначала новые |
| `nutrition:add` | `{date, name, weight, calories?, protein?, fat?, carbs?}` | `{id}`; недостающие макросы становятся 0 |
| `nutrition:remove` | `{id}` | |
| `running:list` | | `[{id, date, time_seconds, distance, calories, start_speed, max_speed, incline}]` |
| `running:add` | `{date, time_seconds, distance, calories?, start_speed?, max_speed?, incline?}` | `{id}` |
| `running:remove` | `{id}` | |
| `running:getGoals` | | `{distance_target, distance_deadline, time_target, time_deadline, calories_target, calories_deadline}` |
| `running:saveGoal` | `{goal_type: "distance"\|"time"\|"calories", target, deadline\|null}` | обновляет одну цель |
| `workouts:list` | | `[{id, date, start_time, end_time, type: "home"\|"gym", note, exercises: [{id, exercise_name, sets, reps, weight, note}]}]` |
| `workouts:create` | `{date, start_time?, end_time?, type, note?, exercises: [...≥1]}` | `{id}` |
| `workouts:update` | `{id, ...как в create}` | упражнения заменяются целиком |
| `workouts:remove` | `{id}` | |
| `workouts:listTemplates` | | `[{id, name, exercises: [{id, exercise_name, sets, reps}]}]` |
| `workouts:createTemplate` | `{name, exercises: [{exercise_name, sets, reps}]}` | `{id}` |
| `workouts:removeTemplate` | `{id}` | |
| `workouts:getGoals` | | `{weekly_target, exercise_goals: [{exercise_name, target_reps, target_weight}]}` |
| `workouts:saveGoals` | `{weekly_target, exercise_goals}` | список целей заменяется целиком |
| `reaction:list` | | `[{id, date, values: [numbers], average}]` |
| `reaction:add` | `{values: [numbers], average}` | `{id}` |
| `reaction:remove` | `{id}` | |
| `mood:list` | | `[{id, date, time, mood, anxiety, fear, sadness, anger, energy, tension, motivation, stress, comment}]` |
| `mood:save` | `{date, time, mood, anxiety?, ..., comment?}` | одна запись на дату; повторное сохранение перезаписывает |
| `mood:remove` | `{id}` | |

### Системные каналы

| Канал | Назначение |
|---|---|
| `auth:status`, `auth:setup`, `auth:login`, `auth:lock`, `auth:change`, `auth:remove` | Необязательный логин и защита паролем |
| `settings:get`, `settings:set`, `settings:relaunch` | Настройки (`theme`, `autostart`, `language`, `timezone`) и перезапуск приложения |
| `config:get`, `config:errors`, `config:openFolder` | Чтение конфига (любого, кроме приватных), список проблем в пользовательских переопределениях, открытие папки переопределений |
| `modules:list`, `modules:errors`, `modules:rescan`, `modules:openFolder`, `modules:setHidden`, `modules:setPinned`, `modules:reorderPinned`, `modules:setCategory`, `modules:categories`, `modules:createCategory`, `modules:removeCategory` | Реестр модулей и навигация |
| `storage:list`, `get`, `insert`, `update`, `remove`, `clear` | Хранилище документов модуля (оболочка подставляет id модуля) |
| `i18n:languages`, `bundle`, `master`, `export`, `openFolder`, `errors` | Языки и словари |
| `clock:zones`, `clock:now` | Список часовых поясов и текущее время в выбранном поясе |
| `window:state`, `window:toggleFullscreen`, `window:close` | Управление окном |
| `shortcuts:list`, `set`, `reset` | Реестр горячих клавиш и переопределения |
| `notifications:schedule`, `cancel`, `list`, `setEnabled`, `modules` | Уведомления модулей |
| `trash:list`, `undo` | Журнал операций и отмена |
| `about:info`, `about:open` | Информация об авторе и внешние ссылки из белого списка |
| `export:json`, `export:csv` | Экспорт всех данных через диалог сохранения |

## 6. Слой данных

**Миграции.** Файлы `migrations/NNN_name.sql` применяются по порядку в транзакции; применённая версия хранится в `PRAGMA user_version`. Новое изменение схемы — новый файл; применённые файлы никогда не редактируются.

**Репозитории** наследуют `BaseRepository` и являются единственным кодом, содержащим SQL. Контроллеры валидируют ввод, переводят результаты репозитория в формат IPC и реализуют бизнес-правила.

**Обзор схемы.**

| Таблица | Назначение |
|---|---|
| `settings` | Хранилище «ключ/значение» (JSON): `theme`, `autostart`, `language`, `timezone`, `modules.hidden`, `window.bounds`, `auth.*` |
| `profile`, `weight_goals`, `running_goals`, `training_goals`, `sleep_schedule` | Однорядные таблицы (`id = 1`) |
| `measurements`, `sleep_logs`, `no_sleep_days`, `nutrition_logs`, `running_logs`, `workouts`, `workout_exercises`, `workout_templates`, `template_exercises`, `exercise_goals`, `reaction_tests`, `mood_entries` | Данные здоровья |
| `module_documents` | JSON-документы пользовательских модулей с привязкой к `module_id` и `collection` |
| `notifications` | Запланированные уведомления модулей |
| `operations`, `operation_entries` | Журнал операций: одна строка на запрос, писавший в базу, одна строка на затронутую запись |

**Метки времени.** Таблицы с меткой создания проставляются триггерами `AFTER INSERT` (миграция `003`), вызывающими SQLite-функцию `bm_now()`. Приложение регистрирует эту функцию на каждом соединении и реализует её через `ClockService`, поэтому каждая `created_at` (и дата теста реакции) пишется в выбранном часовом поясе. Функция не должна ходить в базу, потому что SQLite запрещает реентерабельные запросы из пользовательской функции; поэтому выбранная зона кэшируется в памяти.

**Экспорт.** `export:json` выгружает каждую таблицу (кроме настроек `auth.*`); `export:csv` пишет по одному CSV-файлу на непустую таблицу.

## 7. Конфигурация

Все константы живут в `config/*.json`.

| Файл | Содержимое |
|---|---|
| `app.json` | Окно, протокол, стартовая страница, имя файла базы, умолчания настроек, правила модулей, приватные конфиги, лимиты хранилища, аутентификация, IPC, горячие клавиши, портативный режим, список языков, алиасы часовых поясов, подмножества шрифтов |
| `themes.json` | Темы: CSS-переменные, цвета графиков, отображаемое имя или ключ имени |
| `charts.json` | Цвета серий графиков по модулям |
| `health.json` | Значения профиля по умолчанию (только при первом запуске) |
| `achievements.json` | Достижения в беге (`nameKey`, `descriptionKey`, `required`) |
| `operations.json` | Человекочитаемые метки журнала операций (`domain:action` → ключ словаря) |
| `split.json` | Границы доли split-view |
| `kbju.json`, `nutrition.json`, `reaction.json`, `running.json`, `sleep.json`, `training.json`, `weight.json` | Константы соответствующего модуля |

**Переопределения.** Файлы с тем же именем в `userData/config` накладываются на базовый файл: объекты сливаются рекурсивно, массивы и скаляры заменяются. Новое имя файла становится новым конфигом. Файл с ошибкой JSON пропускается, а причина показывается в настройках. Изменения применяются после перезапуска.

**Доступ.** `config:get` отдаёт любой конфиг, кроме перечисленных в `app.json` → `privateConfigs` (сейчас это `app`). Модули читают конфиги через `bm.config(name)`.

**Темы** валидируются `ThemeCatalog` (13 обязательных CSS-переменных, `colorScheme`, имя, цвета графиков); некорректная тема пропускается и сообщается через `config:errors` как `theme.invalid` с вложенным `reasonKey`, который раскрывает контроллер.

## 8. Аутентификация

Защита необязательна. Когда включена, логин и пароль хранятся в `settings` (`auth.login`, `auth.salt`, `auth.hash`); хэш получается через scrypt и сравнивается за константное время. Состояние «разблокировано» живёт только в памяти и сбрасывается при блокировке или перезапуске. Эти ключи никогда не экспортируются.

## 9. Оболочка и окружение

- **Навигация.** Оболочка показывает в шапке видимые модули-страницы и «Настройки». Скрытие модуля убирает его только из меню; данные остаются. Закреплённые страницы идут первыми в порядке `pinOrder`; незакреплённые — по категориям. `Ctrl+Click` (`Cmd+Click` на macOS) открывает второй модуль рядом с текущим (см. раздел 11).
- **Палитра команд.** `Ctrl+P` (`Cmd+P` на macOS) открывает быстрый переключатель с нечётким поиском по модулям и настройкам. Команды приходят из провайдеров, поэтому новые виды команд можно добавлять, не меняя палитру.
- **Горячие клавиши** перехватываются в главном процессе через `before-input-event`, поэтому работают, даже когда фокус внутри iframe модуля. Они привязаны к физическим клавишам (`KeyP`, `F11`), что делает их независимыми от раскладки. Определения и переопределения живут в `app.json` → `shortcuts` и `settings.shortcuts`.
- **Полноэкранный режим.** `F11` включает/выключает полноэкранный режим; в полноэкранном оболочка показывает кнопки «выйти» и «закрыть приложение».
- **Запуск.** Окно открывается с тёмным фоном и экраном загрузки; портативная Windows-сборка показывает `build/splash.bmp`, пока распаковывается.
- **Атрибуция.** Имя автора и три ссылки в блоке «О программе» в настройках — константы в `src/main/core/Attribution.js`. Они намеренно не настраиваются, а внешние ссылки открываются только из этого белого списка. Они требуются лицензией проекта и должны сохраняться.

## 10. Локализация

Строки лежат в словарях `locales/<code>.json`: плоские объекты, отображающие ключ в строку или в объект форм множественного числа. Полное руководство — в [Localization.md](Localization.md).

| Область | Расположение |
|---|---|
| `shell` | `src/renderer/shell/locales` |
| `shared` | `src/renderer/shared/locales` (единицы, общие кнопки, названия тем и достижений) |
| `backend` | `src/main/locales` (сообщения главного процесса: ошибки, проблемы в конфигах, модулях и словарях) |
| модуль `<id>` | `<папка модуля>/locales` (модули с `"i18n": true` в манифесте) |

`LocaleService` собирает набор строк для области и языка, обходя цепочку запасных языков (выбранный язык, затем объявленный fallback языка, затем `default`, затем все языки из `builtin`) и укладывая `shared` под область. Результат передаётся модулю в его сообщении `init` и читается через `bm.t(key, params)`. Область `backend` передаётся главному процессу через `MessageService`; `AppError` несёт ключ и параметры, а `IpcRouter` переводит сообщение перед возвратом.

- **Языки.** Русский и английский идут с приложением. Язык интерфейса хранится в `settings`; при первом запуске он берётся из ОС, с фолбэком на английский.
- **Реестр.** `app.json` → `i18n.builtin` перечисляет поставляемые языки. `i18n.required` (по умолчанию `["ru", "en"]`) перечисляет языки, словарь для которых обязателен в каждой области. `i18n.reference` (по умолчанию `"ru"`) — словарь, с которым сравниваются остальные. `i18n.source` (по умолчанию `"en"`) — язык, из которого берутся значения для новых переводов. Другие встроенные языки необязательны; если присутствуют, должны быть полными.
- **Пользовательские языки.** Настройки экспортируют шаблон со всеми областями и ключами. Переведённая копия сохраняется в `userData/locales/<code>.json`:

```json
{
  "meta": { "code": "de", "name": "Deutsch", "locale": "de-DE", "fallback": "en" },
  "scopes": { "shell": { "nav.settings": "Einstellungen" }, "shared": {}, "backend": {}, "kbju": {} }
}
```

  Файл с кодом `ru` или `en` патчит встроенные строки, а не добавляет язык. Отсутствующие ключи берутся из цепочки. Проблемы (некорректный JSON, отсутствие `meta`, некорректные объекты множественного числа) показываются в настройках.
- **Инструмент.** `npm run i18n` (`status`, `files <code>`, `add`, `check`) ведёт весь процесс: добавление языка, показ недостающего, проверка полноты словарей и соответствия форм множественного числа `Intl.PluralRules`. Точный вывод каждой команды — в [Localization.md](Localization.md).
- **Формы множественного числа.** Значение может быть объектом с формами CLDR `zero`, `one`, `two`, `few`, `many`, `other` (`other` обязателен; значение может использовать только формы, которые реально определяет его локаль). Форма выбирается через `Intl.PluralRules` по параметру `count`. Подстановки используют `{name}`.
- **Шрифты.** `config/app.json` → `fonts.subsets` (по умолчанию `["latin", "latin-ext", "cyrillic"]`) задаёт, какие подмножества `@fontsource` упаковывает `scripts/prepare.js`. Письменности, которые поставляемые шрифты не покрывают (китайская, японская, корейская, арабская, иврит, тайская, деванагири и другие), отрисовываются системным шрифтом через цепочку запасных в `base.css`.

## 11. Часовые пояса

Настройка `timezone` — это `system` или имя зоны IANA. `ClockService` форматирует текущий момент в этой зоне и используется функцией базы `bm_now()` (раздел 6) и каналами `clock:*`. В модулях `bm.clock` даёт `now()`, `today()` и `timestamp()` для той же зоны. Имена зон используют современные написания (например, `Asia/Kolkata`, `Europe/Kyiv`) через алиасы в `app.json` → `timezones.aliases`.

## 12. Сборка и упаковка

```
npm install        устанавливает зависимости и пересобирает нативные модули под Electron
npm start          готовит ассеты и запускает приложение
npm run dist       готовит ассеты и собирает под текущую ОС
npm run i18n       инструмент локализации (status, files, add, check)
```

`scripts/prepare.js` копирует `chart.min.js` и нужные файлы шрифтов из `node_modules` в `src/renderer/vendor` и генерирует `fonts.css`; скрипт идемпотентен и запускается перед `start` и `dist`. Он читает `config/app.json` → `fonts.subsets` и откатывается к `["latin", "latin-ext", "cyrillic"]`, если список пуст или файл не читается.

Цели electron-builder (`package.json` → `build`):

| ОС | Цели | Примечания |
|---|---|---|
| Windows | `portable`, `zip`, `nsis` | Портативный одиночный исполняемый файл с заставкой, распакованный архив без извлечения, установщик NSIS для текущего пользователя |
| Linux | `AppImage` | Для запуска нужен `libfuse2` |
| macOS | `zip` | Без подписи и нотаризации |

`better-sqlite3` — нативный модуль, поэтому каждую платформу надо собирать на этой же платформе (или на подходящем CI-раннере). `.github/workflows/release.yml` собирает Windows, Linux и macOS (Apple Silicon и Intel) и создаёт черновик GitHub-релиза по тегу `v*`.

## 13. Соглашения

- Один класс на файл; имя файла равно имени класса.
- Имена и структура несут смысл.
- Константы, пороги и цвета живут в JSON-конфигурации, тексты — в словарях.
- SQL — только в репозиториях; валидация и бизнес-правила — в контроллерах.
- Каждая видимая пользователю строка, включая ошибки и сообщения о проблемах, берётся из словаря. `AppError` несёт ключ и параметры, никогда готовое сообщение.
- Рендерер никогда не трогает базу или файловую систему напрямую; всё идёт через каналы.
- В папке каждого модуля есть `README.md`, описывающий назначение, каналы, конфиги, файлы и поведение.