# BIOMASHINE: Карта проекта

Этот документ описывает, как устроена BIOMASHINE: модель процессов, структура репозитория, контракт IPC, слой данных, конфигурация, локализация, часовые пояса и процесс сборки. Авторам модулей следует читать его вместе с [Modules.md](Modules.md).

## 1. Обзор

BIOMASHINE — это операционная среда для персонального учёта. Это полностью офлайн-приложение для настольных компьютеров: без сервера, без учетных записей, без сетевых запросов, без CDN. Всё хранится в локальной базе данных SQLite.

| Слой | Технология |
|---|---|
| Оболочка | Electron (главный процесс, preload-скрипт, рендерер) с `contextIsolation: true` и `sandbox: true` |
| Хранилище | SQLite через `better-sqlite3`, один файл на установку |
| UI к данным | Один IPC-канал (`api`) с диспетчером, который маршрутизирует имена `domain:action` к контроллерам |
| UI | Оболочка рендерера плюс страницы («модули»), работающие в изолированных iframe, ES-модули, Chart.js и шрифты, поставляемые из npm |
| Стиль кода | Объектно-ориентированный, один класс на файл, константы в JSON-конфигурациях |

## 2. Модель процессов

```
┌────────────────────────── main process ───────────────────────────┐
│ Application ─ Container (composition root)                        │
│   IpcRouter ─ Controllers ─ Services ─ Repositories ─ SQLite      │
│   ProtocolHandler (bm://)   WindowManager   ShortcutService       │
└────────────▲──────────────────────────────────────────────────────┘
             │ ipcRenderer.invoke('api', channel, payload)
┌────────────┴─── renderer: shell (bm://app/shell/index.html) ───────┐
│ window.api (preload)   ShellApp   ModuleBridge   SettingsView ...  │
│   ┌──────── iframe bm://<module-id>/index.html ────────┐           │
│   │ SDK (bm)  ──postMessage──►  ModuleBridge           │           │
│   └─────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────┘
```

- Главный процесс владеет базой данных, конфигурацией, аутентификацией и каждой возможностью, которая взаимодействует с операционной системой (диалоги, автозапуск, внешние ссылки, состояние окна).
- Preload-скрипт предоставляет оболочке ровно один объект `window.api`: `invoke(channel, payload)`, `onShortcut(handler)` и `onWindowState(handler)`. Модули его не получают.
- Каждый модуль-страница работает в собственном `<iframe>` со своим origin (`bm://<module-id>`). Модуль общается с оболочкой через мост `postMessage`; оболочка проверяет разрешения каналов, объявленные модулем, и перенаправляет разрешенные вызовы в главный процесс. См. [Modules.md](Modules.md).
- Файлы отдаются по кастомному привилегированному протоколу `bm://`. `bm://app/...` сопоставляется с `src/renderer`, `bm://<module-id>/...` сопоставляется с папкой этого модуля. Резолвер отклоняет любой путь, выходящий за пределы базовой директории.

## 3. Структура репозитория

```
build/                    иконки приложения (ico, png, icns) и заставка портативного лаунчера
config/                   все настройки и константы в формате JSON
migrations/               SQL-миграции, применяются по порядку, версия хранится в PRAGMA user_version
scripts/prepare.js        копирует Chart.js и шрифты из node_modules в src/renderer/vendor
src/main/
  main.js                 точка входа
  Application.js          жизненный цикл Electron: единственный экземпляр, привилегированная схема, создание окна
  Container.js            создает каждый сервис, репозиторий и контроллер
  ElectronSystem.js       адаптер ОС: диалоги, автозапуск, перезапуск, внешние ссылки, состояние окна
  WindowManager.js        окно, защита навигации, события полноэкранного режима
  ProtocolHandler.js      обслуживает файлы bm://
  ShortcutService.js      глобальные горячие клавиши (F11, Ctrl/Cmd+P)
  PortablePaths.js        папка данных рядом с программой в портативных сборках
  core/                   Database, Migrator, ConfigService, IpcRouter, AssetResolver, BaseRepository,
                          BaseController, AppError, Attribution, Dates, Values, MimeTypes
  repositories/           единственное место, где находится SQL
  services/               AuthService, SettingsService, ClockService, LocaleService, ModuleRegistry,
                          ModuleService, ThemeCatalog, ExportService, SeedService
  controllers/            IPC-обработчики: валидация и бизнес-правила
src/preload/preload.js    window.api
src/renderer/
  shell/                  меню, вход, настройки, палитра команд, мост, диалоги, темы
  sdk/                    SDK модуля (bm), переводчик, часы, протокол сообщений
  shared/                 base.css, components.css, общие словари (locales/)
  modules/<id>/           модули (manifest.json, index.html, module.css, js/, locales/, README.md)
  vendor/                 генерируется scripts/prepare.js, не хранится в git
docs/                     документация
```

Пользовательские данные находятся в директории `userData` Electron (`%APPDATA%\BIOMASHINE` в Windows, `~/.config/BIOMASHINE` в Linux, `~/Library/Application Support/BIOMASHINE` в macOS):

```
biomashine.sqlite         база данных
config/                   пользовательские переопределения конфигурации (см. раздел 7)
modules/                  модули и плагины, установленные пользователем
locales/                  пользовательские файлы языков (см. раздел 10)
```

В портативных сборках (Windows `portable`, Linux AppImage) такая же структура создается в папке `BIOMASHINE-data` рядом с исполняемым файлом, чтобы программу и ее данные можно было перемещать вместе.

## 4. Жизненный цикл приложения и композиция

`Application.run()`:

1. Устанавливает папку данных (портативный режим) и захватывает блокировку единственного экземпляра.
2. Создает `Container` до готовности приложения. Это открывает базу данных, запускает миграции, загружает конфигурацию и регистрирует каждый контроллер.
3. Регистрирует привилегированную схему `bm://` и устанавливает переключатель `lang` в Chromium из выбранного языка интерфейса (это управляет форматом нативных полей `<input type="date">`).
4. После события `ready`: подключает обработчик протокола, маршрутизатор IPC и окно.

`Container` является единственным корнем композиции. Зависимости передаются через конструкторы; ничто не является глобальным. Каждый класс принимает то, что ему нужно, что сохраняет главный процесс свободным от кода, специфичного для Electron, за исключением тонких классов `ElectronSystem`, `WindowManager`, `ProtocolHandler` и `Application`.

## 5. Контракт IPC

```js
const data = await window.api.invoke('domain:action', payload);
```

Маршрутизатор отвечает `{ ok: true, data }` или `{ ok: false, status, error }`; preload-скрипт превращает ошибку в выброшенный `Error`, несущий `message` и `status`. Общие статусы: `400` неверный ввод, `401` заблокировано, `403` запрещено, `404` не найдено.

**Шлюз аутентификации.** Если установлен пароль, каждый канал, кроме тех, чье имя начинается с префикса, указанного в `app.json` → `ipc.openPrefixes` (`auth:`, `settings:get`, `config:get`, `i18n:bundle`, `i18n:languages`, `window:`), возвращает `401`, пока пользователь не войдет в систему.

**Соглашения о данных.**

| Вид | Формат |
|---|---|
| Дата | `YYYY-MM-DD` |
| Метка времени | `YYYY-MM-DD HH:MM:SS` (настенное время в выбранном часовом поясе, без суффикса зоны) |
| Время суток | `HH:MM:SS` (`HH:MM` для тренировок) |
| Числа | JSON-числа |
| Булевы значения | `true` / `false` |
| JSON-столбцы | возвращаются как объекты и массивы |
| Идентификаторы | числа |

### Каналы данных о здоровье

Параметры, помеченные `?`, являются необязательными. Успешные каналы записи возвращают `null`, если не указано иное.

| Канал | Payload | Результат |
|---|---|---|
| `profile:get` | | `{height, age, trainings_count}` |
| `profile:overview` | | `{user, measurements, goals}` |
| `profile:updateParams` | `{height, age, trainings_count}` | обновленный профиль (рост и возраст — положительные целые числа, тренировки — целое число ≥ 0) |
| `measurements:list` | | `[{date, weight, fat, water}]`, упорядоченные по дате |
| `measurements:save` | `{date, weight, fat?, water?}` | upsert по дате |
| `measurements:remove` | `{date}` | `404`, если отсутствует |
| `measurements:getGoals` | | `{weight_goal, fat_goal, deadline}` (null, если не установлено) |
| `measurements:saveGoals` | `{weight_goal, fat_goal, deadline}` | |
| `sleep:listLogs` | | `[{id, start_time, end_time}]`, сначала новые |
| `sleep:addLog` | `{start_time, end_time}` (разделитель `T` или пробел) | `{id}`; `400`, если конец не позже начала |
| `sleep:removeLog` | `{id}` | |
| `sleep:getSchedule` | | `{ideal_bedtime, ideal_waketime}` (null, если не установлено) |
| `sleep:saveSchedule` | `{ideal_bedtime, ideal_waketime}` | |
| `sleep:resetSchedule` | | очищает идеальное расписание |
| `sleep:listNoSleep` | | `["YYYY-MM-DD", ...]` |
| `sleep:addNoSleep` | `{date}` | `400`, если в этот день уже есть записи сна |
| `sleep:removeNoSleep` | `{date}` | |
| `nutrition:list` | | `[{id, date, name, weight, calories, protein, fat, carbs}]`, сначала новые |
| `nutrition:add` | `{date, name, weight, calories?, protein?, fat?, carbs?}` | `{id}`; отсутствующие макросы становятся 0 |
| `nutrition:remove` | `{id}` | |
| `running:list` | | `[{id, date, time_seconds, distance, calories, start_speed, max_speed, incline}]` |
| `running:add` | `{date, time_seconds, distance, calories?, start_speed?, max_speed?, incline?}` | `{id}` |
| `running:remove` | `{id}` | |
| `running:getGoals` | | `{distance_target, distance_deadline, time_target, time_deadline, calories_target, calories_deadline}` |
| `running:saveGoal` | `{goal_type: "distance"\|"time"\|"calories", target, deadline\|null}` | обновляет одну цель |
| `workouts:list` | | `[{id, date, start_time, end_time, type: "home"\|"gym", note, exercises: [{id, exercise_name, sets, reps, weight, note}]}]` |
| `workouts:create` | `{date, start_time?, end_time?, type, note?, exercises: [...≥1]}` | `{id}` |
| `workouts:update` | `{id, ...same as create}` | упражнения заменяются целиком |
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
| `auth:status`, `auth:setup`, `auth:login`, `auth:lock`, `auth:change`, `auth:remove` | Необязательный вход и защита паролем |
| `settings:get`, `settings:set`, `settings:relaunch` | Настройки (`theme`, `autostart`, `language`, `timezone`) и перезапуск приложения |
| `config:get`, `config:errors`, `config:openFolder` | Чтение конфигурации (любой, кроме приватных), список проблем в пользовательских переопределениях, открытие папки переопределений |
| `modules:list`, `modules:errors`, `modules:rescan`, `modules:openFolder`, `modules:setHidden` | Реестр модулей |
| `storage:list`, `get`, `insert`, `update`, `remove`, `clear` | Хранилище документов для каждого модуля (оболочка внедряет id модуля) |
| `i18n:languages`, `bundle`, `master`, `export`, `openFolder`, `errors` | Языки и словари |
| `clock:zones`, `clock:now` | Список часовых поясов и текущее время в выбранном поясе |
| `window:state`, `window:toggleFullscreen`, `window:close` | Управление окном |
| `about:info`, `about:open` | Информация об авторе и внешние ссылки из белого списка |
| `export:json`, `export:csv` | Экспорт всех данных через диалог сохранения |

## 6. Слой данных

**Миграции.** Файлы `migrations/NNN_name.sql` применяются по порядку внутри транзакции; примененная версия сохраняется в `PRAGMA user_version`. Новое изменение схемы — это новый файл; примененные файлы никогда не редактируются.

**Репозитории** наследуют `BaseRepository` и являются единственным кодом, содержащим SQL. Контроллеры проверяют ввод, преобразуют результаты репозитория в формат IPC и реализуют бизнес-правила.

**Обзор схемы.**

| Таблица | Назначение |
|---|---|
| `settings` | Хранилище ключ/значение (значения JSON): `theme`, `autostart`, `language`, `timezone`, `modules.hidden`, `window.bounds`, `auth.*` |
| `profile`, `weight_goals`, `running_goals`, `training_goals`, `sleep_schedule` | Однорядные таблицы (`id = 1`) |
| `measurements`, `sleep_logs`, `no_sleep_days`, `nutrition_logs`, `running_logs`, `workouts`, `workout_exercises`, `workout_templates`, `template_exercises`, `exercise_goals`, `reaction_tests`, `mood_entries` | Данные о здоровье |
| `module_documents` | JSON-документы пользовательских модулей, привязанные к `module_id` и `collection` |

**Метки времени.** Таблицы с меткой времени создания штампуются триггерами `AFTER INSERT` (миграция `003`), которые вызывают функцию SQLite `bm_now()`. Приложение регистрирует эту функцию на каждом соединении и реализует ее с помощью `ClockService`, поэтому каждый `created_at` (и дата теста реакции) записываются в выбранном часовом поясе. Функция не должна запрашивать базу данных, так как SQLite запрещает повторные запросы изнутри пользовательской функции; поэтому выбранная зона кэшируется в памяти.

**Экспорт.** `export:json` выгружает каждую таблицу (исключая настройки `auth.*`); `export:csv` записывает один CSV-файл на каждую непустую таблицу.

## 7. Конфигурация

Все константы живут в `config/*.json`.

| Файл | Содержимое |
|---|---|
| `app.json` | Окно, протокол, стартовая страница, имя файла базы данных, значения по умолчанию для настроек, правила модулей, приватные конфиги, лимиты хранилища, аутентификация, IPC, горячие клавиши, портативный режим, список языков, псевдонимы часовых поясов |
| `themes.json` | Темы: CSS-переменные, цвета графиков, отображаемый заголовок или ключ заголовка |
| `charts.json` | Цвета серий графиков для каждого модуля |
| `health.json` | Значения профиля по умолчанию (используются только при первом запуске) |
| `achievements.json` | Достижения в беге (`nameKey`, `descriptionKey`, `required`) |
| `kbju.json`, `nutrition.json`, `reaction.json`, `running.json`, `sleep.json`, `training.json`, `weight.json` | Константы соответствующего модуля |

**Переопределения.** Файлы с тем же именем в `userData/config` объединяются поверх базового файла: объекты объединяются рекурсивно, массивы и скаляры заменяются. Новое имя файла становится новой конфигурацией. Файл с ошибкой JSON пропускается, а причина показывается в Настройках. Изменения применяются после перезапуска.

**Доступ.** `config:get` обслуживает любую конфигурацию, кроме перечисленных в `app.json` → `privateConfigs` (в настоящее время `app`). Модули читают конфигурации через `bm.config(name)`.

**Темы** проверяются `ThemeCatalog` (13 обязательных CSS-переменных, `colorScheme`, заголовок, цвета графиков); недопустимая тема пропускается и сообщается о ней.

## 8. Аутентификация

Защита необязательна. При включении логин и пароль хранятся в `settings` (`auth.login`, `auth.salt`, `auth.hash`); хэш вычисляется с помощью scrypt и сравнивается за постоянное время. Разблокированное состояние живет только в памяти и сбрасывается при блокировке или перезапуске. Эти ключи никогда не экспортируются.

## 9. Оболочка и окружение

- **Навигация.** Оболочка перечисляет видимые модули-страницы и Настройки в заголовке. Скрытие модуля удаляет его только из меню; его данные остаются.
- **Палитра команд.** `Ctrl+P` (`Cmd+P` в macOS) открывает быстрый переключатель с нечетким поиском по модулям и Настройкам. Команды поступают от провайдеров, поэтому новые виды команд можно добавлять, не меняя палитру.
- **Горячие клавиши** перехватываются в главном процессе через `before-input-event`, поэтому они работают, даже когда фокус находится внутри iframe модуля. Они привязаны к физическим клавишам (`KeyP`, `F11`), что делает их независимыми от раскладки клавиатуры. Определения находятся в `app.json` → `shortcuts`.
- **Полноэкранный режим.** `F11` переключает полноэкранный режим; в полноэкранном режиме оболочка показывает кнопки для выхода из него или закрытия приложения.
- **Запуск.** Окно открывается с темным фоном и экраном загрузки; портативная сборка Windows показывает `build/splash.bmp` во время распаковки.
- **Атрибуция.** Имя автора и три ссылки, показанные в блоке «О программе» в Настройках, являются константами в `src/main/core/Attribution.js`. Они намеренно не настраиваются, и внешние ссылки открываются только из этого белого списка. Они требуются лицензией проекта и должны быть сохранены.

## 10. Локализация

Строки живут в словарях с именами `locales/<code>.json`: плоские объекты, сопоставляющие ключ со строкой или объектом форм множественного числа.

| Область | Расположение |
|---|---|
| `shell` | `src/renderer/shell/locales` |
| `shared` | `src/renderer/shared/locales` (единицы измерения, общие кнопки, заголовки тем и достижений) |
| модуль `<id>` | `<папка модуля>/locales` (модули с `"i18n": true` в манифесте) |

`LocaleService` строит набор строк для области и языка, проходя по цепочке запасных вариантов (выбранный язык, затем объявленный запасной язык, затем английский, затем русский) и накладывая `shared` под область. Результат доставляется модулю в его сообщении `init` и читается через `bm.t(key, params)`.

- **Языки.** Русский и английский поставляются с приложением. Язык интерфейса хранится в `settings`; при первом запуске он выбирается из операционной системы, с откатом на английский.
- **Пользовательские языки.** Настройки могут экспортировать шаблон, содержащий каждую область с ее ключами. Переведенная копия сохраняется как `userData/locales/<code>.json`:

```json
{
  "meta": { "code": "de", "name": "Deutsch", "locale": "de-DE", "fallback": "en" },
  "scopes": { "shell": { "nav.settings": "Einstellungen" }, "shared": {}, "kbju": {} }
}
```

  Файл, код которого `ru` или `en`, исправляет встроенные строки вместо добавления языка. Отсутствующие ключи откатываются по цепочке. Проблемы (неверный JSON, отсутствующий `meta`, искаженные объекты множественного числа) перечислены в Настройках.
- **Формы множественного числа.** Значение может быть объектом с формами `zero`, `one`, `two`, `few`, `many`, `other` (`other` обязательна). Форма выбирается с помощью `Intl.PluralRules` по параметру `count`. Заполнители используют `{name}`.

## 11. Часовые пояса

Настройка `timezone` — это `system` или имя зоны IANA. `ClockService` форматирует текущий момент в этой зоне и используется функцией базы данных `bm_now()` (см. раздел 6) и каналами `clock:*`. В модулях `bm.clock` предлагает `now()`, `today()` и `timestamp()` для той же зоны. Имена зон используют современное написание (например, `Asia/Kolkata`, `Europe/Kyiv`) через псевдонимы в `app.json` → `timezones.aliases`.

## 12. Сборка и упаковка

```
npm install        устанавливает зависимости и пересобирает нативные модули для Electron
npm start          подготавливает ресурсы и запускает приложение
npm run dist       подготавливает ресурсы и собирает для текущей операционной системы
```

`scripts/prepare.js` копирует `chart.min.js` и необходимые файлы шрифтов из `node_modules` в `src/renderer/vendor` и генерирует `fonts.css`; он идемпотентен и запускается перед `start` и `dist`.

Цели electron-builder (`package.json` → `build`):

| ОС | Цели | Примечания |
|---|---|---|
| Windows | `portable`, `zip` | Портативный одиночный исполняемый файл с заставкой, плюс распакованный архив, который запускается без извлечения |
| Linux | `AppImage` | Требует `libfuse2` для запуска |
| macOS | `zip` | Не подписан и не нотариально заверен |

`better-sqlite3` является нативным модулем, поэтому каждая платформа должна собираться на этой платформе (или на соответствующем CI-раннере). `.github/workflows/release.yml` собирает Windows, Linux и macOS (Apple Silicon и Intel) и создает черновик релиза GitHub при отправке тега, соответствующего `v*`.

## 13. Соглашения

- Один класс на файл; имя файла равно имени класса.
- Имена и структура несут смысл.
- Константы, пороги и цвета принадлежат JSON-конфигурации, тексты принадлежат словарям.
- SQL только в репозиториях; валидация и бизнес-правила в контроллерах.
- Рендерер никогда не обращается к базе данных или файловой системе напрямую; все идет через каналы.
- Каждая папка модуля имеет `README.md`, описывающий назначение, каналы, конфигурации, файлы и поведение.
