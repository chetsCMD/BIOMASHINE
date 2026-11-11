# BIOMASHINE: руководство для ИИ по созданию модуля-страницы

Аудитория: языковая модель. Пользователь не программист. Он даёт вам этот файл и описывает страницу, которую хочет. Вы выдаёте готовые файлы модуля и инструкцию по установке. Исходный код приложения вам не нужен: здесь описано всё необходимое. Если чего-то для задачи не хватает, скажите пользователю, чего именно, и не выдумывайте API.

## 1. Что вы выдаёте

1. Папку модуля `<id>/`. Каждый файл целиком, каждый в своём блоке кода с путём в заголовке.
2. Инструкцию по установке из раздела 14 с подставленным настоящим `<id>`.

Больше ничего. Не предлагайте менять исходный код приложения.

## 2. Жёсткие правила

**Явная просьба пользователя всегда побеждает.** Пользователей этого приложения никогда не заставляют в фиксированный стиль. Всё про внешний вид в этом руководстве (переменные, UI-кит, внешний вид по умолчанию) — это умолчание, которое держит модуль согласованным с остальным приложением, а не ограничение. Если пользователь просит конкретный цвет, шрифт, размер, раскладку или вид (например, «сделай этот блок фиолетовым»), делайте именно это с помощью собственного CSS, даже если это отличается от стиля приложения. Не отказывайте, не спорьте и не читайте нотаций про согласованность; если поможет, одной фразой упомяните, что результат отклоняется от темы по умолчанию. Обойти нельзя только технические ограничения (нет сети, песочница, правила хранилища).

Делайте:
- Один модуль, одна папка. Имя папки равно `id` в `manifest.json`.
- Чистый JavaScript (ES-модули), HTML и CSS. Без шага сборки, без npm.
- Данные храните только через `bm.storage` (раздел 7).
- Если пользователь не просил конкретных цветов, берите цвета из CSS-переменных (раздел 10), чтобы работали обе темы.
- Просите подтверждения через `bm.confirm`.
- Каждый видимый пользователю текст кладите в словари и читайте через `bm.t` (раздел 8). Модуль обязан поставлять `locales/ru.json` и `locales/en.json`; остальные языки необязательны и могут быть добавлены пользователем позже.
- Текущее время берите только из `bm.clock` (раздел 9).
- Пишите классы, один на файл; логику без DOM держите в отдельных классах.

Не делайте:
- Не используйте `fetch`, `XMLHttpRequest`, `WebSocket`, внешние ссылки, CDN, внешние шрифты или картинки. Сети нет.
- Не используйте `localStorage`, `sessionStorage`, IndexedDB или cookies: эти данные не попадут в экспорт.
- Не используйте `alert`, `confirm`, `prompt` или `window.open`: они заблокированы.
- Не используйте `eval` или `document.write`.
- Не зовите `bm.invoke` и не читайте данные других модулей: в этой версии модуль работает только со своим хранилищем.
- Не меняйте `id` после первой установки: данные привязаны к нему.
- Не добавляйте сторонних библиотек. Исключение — Chart.js, который приложение уже предоставляет (раздел 11).

## 3. Структура папки

    <id>/
      manifest.json
      index.html
      locales/
        ru.json
        en.json
      js/
        main.js
        <YourClass>.js

Другие файлы (CSS, картинки, шрифты) разрешены; ссылайтесь на них относительными путями. `README.md` для пользовательских модулей необязателен.

## 4. manifest.json

| Поле | Тип | Обязательно | Правило |
|---|---|---|---|
| `id` | string | да | `^[a-z][a-z0-9-]*$`, равен имени папки, не `app`, `shell` или `shared`, уникален |
| `kind` | string | да | всегда `"page"` |
| `title` | string | да | метка меню, короткая (фолбэк, когда ключа словаря нет) |
| `version` | string | нет | `"1.0.0"` |
| `description` | string | нет | одна строка для списка настроек |
| `order` | number | нет | позиция в меню; по умолчанию для пользовательских модулей 1000 (последние) |
| `entry` | string | нет | по умолчанию `index.html` |
| `i18n` | boolean | нет | поставьте `true`: title и description берутся из ключей словаря `module.title` и `module.description` |
| `channels` | array | нет | для этого руководства всегда `[]` |

## 5. Каркас index.html

Ссылки ровно такие; пути не меняйте. Строка Chart.js нужна только когда есть графики.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Title</title>
    <link rel="stylesheet" href="bm://app/vendor/fonts/fonts.css">
    <link rel="stylesheet" href="bm://app/shared/base.css">
    <link rel="stylesheet" href="bm://app/shared/components.css">
    <script src="bm://app/vendor/chart.min.js"></script>
    <script type="module" src="./js/main.js"></script>
</head>
<body>
<main class="bm-page">
    ...
</main>
</body>
</html>
```

Точка входа `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { App } from './App.js';

bm.ready.then(() => new App(bm, document, window.Chart).start());
```

Всегда ждите `bm.ready` перед обращением к `bm`.

## 6. SDK: объект `bm`

| Вызов | Возвращает | Описание |
|---|---|---|
| `bm.ready` | `Promise` | Резолвится, когда соединение, тема, язык и часовой пояс готовы |
| `bm.storage.*` | см. раздел 7 | Хранилище данных модуля |
| `bm.t(key, params)` | string | Переводит ключ (раздел 8) |
| `bm.locale`, `bm.language` | string | Локаль для `toLocaleString` (например, `en-US`) и код языка |
| `bm.clock` | object | Время в выбранном пользователем часовом поясе (раздел 9) |
| `bm.confirm(text, options)` | `Promise<boolean>` | Диалог. `options`: `confirmText`, `cancelText`, `danger` (красная кнопка) |
| `bm.setPills(items)` | ничего | Маленькие метки справа в шапке. `items` — массив строк; пустой массив очищает |
| `bm.theme` | object | `{ name: 'dark' \| 'light', colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | функция отписки | `fn` вызывается при смене темы; перестройте графики в ней |
| `bm.config(name)` | `Promise<object>` | Читает конфиг приложения. Обычно не нужен |

Каждый промис-возвращающий вызов отклоняется `Error` с `message` и числовым `status`; если сбой пришёл из переведённого ключа словаря, у ошибки есть ещё `code`.

## 7. Хранилище: `bm.storage`

Хранит JSON-документы в именованных коллекциях. Хранилище изолировано: модуль видит только свои данные. Данные попадают в JSON- и CSV-экспорт.

| Вызов | Возвращает |
|---|---|
| `list(collection)` | `Promise<Document[]>` в порядке создания (по возрастанию `id`) |
| `get(collection, id)` | `Promise<Document>`; отклоняется со `status` 404, если нет |
| `insert(collection, data)` | `Promise<number>`: новый `id` |
| `update(collection, id, data)` | `Promise<void>`: заменяет `data` целиком, не сливает |
| `remove(collection, id)` | `Promise<void>`, отклоняется 404, если нет |
| `clear(collection)` | `Promise<number>`: сколько документов удалено |

Документ — `{ id: number, data: object, createdAt: string, updatedAt: string }`. Время создания и изменения ставит приложение.

Правила:
- Имя коллекции: `^[a-z][a-z0-9_-]{0,39}$`.
- `data`: обычный JSON-сериализуемый объект не больше 262144 байт. Не массив, не строка. Без `undefined`, функций и объектов `Date`. Моменты времени храните строкой из `bm.clock.timestamp()`.
- Фильтруйте, сортируйте и агрегируйте в JavaScript после `list`.
- Синглтон-настройки держите одним документом в коллекции `settings`: `list`, затем `update` первого документа или `insert`, если пусто (см. пример).
- Не меняйте схему данных ломающим образом: добавляя поле, помните, что старые документы его не содержат.

## 8. Текст и языки

Приложение многоязычное: язык выбирает пользователь, поэтому никакой видимый текст нельзя хардкодить в JavaScript или HTML. Перед тем как писать, уточните у пользователя, нужен ли ему перевод на два языка.

- `locales/ru.json` и `locales/en.json`: плоские объекты `"key": "text"`. Ключи в обоих файлах должны совпадать. `module.title` и `module.description` обязательны.
- **`ru` и `en` обязательны.** Оба файла должны существовать и быть полными. Приложение также поддерживает другие языки (встроенный реестр — `config/app.json` → `i18n.builtin`): такие файлы в модуле необязательны, но если файл для встроенного языка присутствует, он должен покрывать те же ключи, что `ru`, и проходить ту же проверку полноты. Пользователь может также положить перевод в `userData/locales/<code>.json` в рантайме — модуль подхватит его автоматически через цепочку запасных языков.
- JavaScript: `bm.t('key')`; с параметрами `bm.t('key', { n: 5 })` (текст содержит `{n}`); с формами множественного числа `bm.t('key', { count: 5 })` (значение словаря — объект: `one`, `few`, `many`, `other` для русского; `one`, `other` для английского; остальные языки используют формы, которые определяет их локаль — никогда не смешивайте формы одного языка в другом).
- HTML: `data-i18n="key"` заменяет текст элемента, `data-i18n-placeholder="key"` и `data-i18n-title="key"` заменяют атрибуты. Оставляйте текст по умолчанию внутри элемента.
- Даты и числа: `toLocaleString(bm.locale)`, никогда не хардкодьте локаль вроде `'en-US'`.
- Общие слова доступны без объявления: `common.delete`, `common.cancel`, `common.save`, `unit.ms`, `unit.g`, `unit.kcal`.
- Никогда не собирайте предложение из переведённых кусков: один ключ на предложение.
- Свойство с именем `key` зарезервировано под ключи словаря; для любого другого используйте другое имя.

Полное руководство по локализации всего приложения (области, реестр, инструмент `npm run i18n`, формы множественного числа, письменности и шрифты) — `docs/ru/Developers/Localization.md`. Этот документ — для контрибьюторов; автору модуля хватит правил выше.

## 9. Время: `bm.clock`

Пользователь выбирает часовой пояс в настройках, поэтому никогда не используйте `new Date()`, `Date.now()` или `toISOString()` для текущего момента.

| Вызов | Результат |
|---|---|
| `bm.clock.now()` | Объект `Date`, методы `getHours()`, `getDate()` и подобные которого показывают время выбранного пояса |
| `bm.clock.today()` | Строка `YYYY-MM-DD` |
| `bm.clock.timestamp()` | Строка `YYYY-MM-DD HH:MM:SS`. Храните именно это |

Разбор дат, прочитанных из хранилища (`new Date('2026-11-02 14:00:00')`), и их форматирование — это нормально.

## 10. Стилизация

По умолчанию стилизуйте страницу как остальное приложение и берите цвета из переменных ниже; шрифты уже загружены (`JetBrains Mono` для текста, `Playfair Display` для больших чисел). Когда пользователь просит другое, следуйте за пользователем (см. правило в начале раздела 2): пишите тот CSS, который он просит, в `module.css`, с любыми цветами, шрифтами или размерами.

| Переменная | Смысл | Тёмная | Светлая |
|---|---|---|---|
| `--bg` | фон страницы | `#121212` | `#f4f4f2` |
| `--s1` | фон карточки | `#1c1c1c` | `#ffffff` |
| `--s2` | фон поля ввода и вложенных блоков | `#242424` | `#ececea` |
| `--s3` | фон при наведении и активном состоянии | `#2c2c2c` | `#e2e2df` |
| `--br` | основные границы | `#2e2e2e` | `#d2d2ce` |
| `--br2` | тонкие разделители | `#262626` | `#dededa` |
| `--t` | основной текст | `#e8e8e8` | `#1c1c1c` |
| `--td` | вторичный текст | `#a0a0a0` | `#5a5a5a` |
| `--tdd` | подписи и подсказки | `#6e6e6e` | `#8a8a8a` |
| `--tddd` | самые бледные элементы | `#3a3a3a` | `#c4c4c0` |
| `--wh` | акцент: заголовки, большие числа, основная кнопка | `#f0f0f0` | `#0d0d0d` |
| `--overlay` | затемнение под диалогами | `rgba(0, 0, 0, 0.6)` | `rgba(0, 0, 0, 0.35)` |
| `--header-bg` | фон шапки | `rgba(18, 18, 18, 0.92)` | `rgba(244, 244, 242, 0.92)` |

Использование: `color: var(--td); background: var(--s1); border: 1px solid var(--br);`. Переменные держат страницу читаемой в любой теме, поэтому предпочитайте их, когда у пользователя нет предпочтений по цвету; литеральные цвета нормальны, когда пользователь их хочет, и для цветов данных на графиках. Имя текущей темы — атрибут `data-theme` на `<html>`.

UI-кит из `components.css`. Предпочитайте его своему CSS:

| Класс | Назначение |
|---|---|
| `bm-page` | Контейнер страницы на `<main>`, центрирует и ограничивает ширину |
| `bm-title` | Заголовок раздела с линией |
| `bm-card` | Карточка |
| `bm-row` | Строка с выравниванием и промежутками |
| `bm-spacer` | Растягивающийся спейсер внутри `bm-row` |
| `bm-muted` | Приглушённый мелкий текст |
| `bm-label` | Метка над полем |
| `bm-input` | Input, `select`, `textarea` |
| `bm-btn` | Основная кнопка. Модификаторы: `secondary`, `danger` |
| `bm-list` | Вертикальный список |
| `bm-list-item` | Строка списка: содержимое слева, действие справа |
| `bm-empty` | Заглушка для пустого списка |
| `bm-stats` | Сетка плиток статистики |
| `bm-stat` | Плитка |
| `bm-stat-label` | Подпись плитки |
| `bm-stat-value` | Большое число плитки |
| `bm-chart` | Контейнер графика фиксированной высоты с `<canvas>` внутри |

Свой CSS нормален для всего, чего нет в ките. Кладите его в `module.css` в папке модуля и подключайте после `components.css`.

## 11. Графики

Chart.js 3.8.0 доступен как `window.Chart`, когда в `index.html` есть `<script src="bm://app/vendor/chart.min.js"></script>`. Передайте `window.Chart` в конструктор своего класса, как в примере. Цвета осей берите из `bm.theme.chart`, цвет данных — из `getComputedStyle(document.documentElement).getPropertyValue('--wh')`. Canvas кладите внутрь `.bm-chart`. Когда меняется тема (`bm.onTheme`), зовите `chart.destroy()` и стройте график заново.

## 12. Частые ошибки

- Забыли `await bm.ready`: тема, язык и соединение ещё не готовы.
- Используете `window.Chart` без тега `<script>`: графика нет.
- Положили объект `Date` в `data`: после сохранения он станет строкой; храните строку `bm.clock.timestamp()` сами.
- Ждёте, что `update` сольёт поля: он заменяет документ.
- Используете `confirm()`: он заблокирован; используйте `bm.confirm`.
- Назвали папку одним, а `id` другим: модуль отклоняется.
- Используете заглавные буквы в `id`.
- Оставили текст в коде или HTML без ключа словаря.
- Поставили только один файл словаря: `locales/ru.json` и `locales/en.json` обязательны оба.

## 13. Полный пример: счётчик сигарет

Файлы ниже готовы к установке. Используйте их как образец структуры и стиля. (Тексты по умолчанию в примере — на английском; показаны оба словаря.)

`cigarettes/manifest.json`

```json
{
  "id": "cigarettes",
  "kind": "page",
  "title": "Cigarettes",
  "version": "1.0.0",
  "description": "Cigarette counter with a daily limit and a 7-day chart",
  "order": 500,
  "entry": "index.html",
  "channels": [],
  "i18n": true
}
```

`cigarettes/locales/ru.json`

```json
{
  "module.title": "Сигареты",
  "module.description": "Счётчик выкуренных сигарет с дневной нормой и графиком за 7 дней",
  "page.title": "Сигареты",
  "btn.add": "+1 сигарета",
  "goal.label": "Норма в день",
  "section.stats": "Статистика",
  "section.week": "Последние 7 дней",
  "section.journal": "Журнал",
  "stat.today": "Сегодня",
  "stat.week": "За 7 дней",
  "stat.average": "В среднем в день",
  "journal.empty": "Записей нет",
  "journal.confirmDelete": "Удалить запись?",
  "chart.label": "Сигарет в день",
  "pill.entries": {
    "one": "{count} запись",
    "few": "{count} записи",
    "many": "{count} записей",
    "other": "{count} записи"
  }
}
```

`cigarettes/locales/en.json`

```json
{
  "module.title": "Cigarettes",
  "module.description": "Cigarette counter with a daily limit and a 7-day chart",
  "page.title": "Cigarettes",
  "btn.add": "+1 cigarette",
  "goal.label": "Daily limit",
  "section.stats": "Statistics",
  "section.week": "Last 7 days",
  "section.journal": "Journal",
  "stat.today": "Today",
  "stat.week": "Last 7 days",
  "stat.average": "Daily average",
  "journal.empty": "No entries",
  "journal.confirmDelete": "Delete this entry?",
  "chart.label": "Cigarettes per day",
  "pill.entries": {
    "one": "{count} entry",
    "other": "{count} entries"
  }
}
```

`cigarettes/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Cigarettes</title>
    <link rel="stylesheet" href="bm://app/vendor/fonts/fonts.css">
    <link rel="stylesheet" href="bm://app/shared/base.css">
    <link rel="stylesheet" href="bm://app/shared/components.css">
    <script src="bm://app/vendor/chart.min.js"></script>
    <script type="module" src="./js/main.js"></script>
</head>
<body>
<main class="bm-page">
    <div class="bm-card">
        <div class="bm-row">
            <button class="bm-btn" id="add-btn" data-i18n="btn.add">+1 cigarette</button>
            <div class="bm-spacer"></div>
            <div>
                <label class="bm-label" for="goal-input" data-i18n="goal.label">Daily limit</label>
                <input class="bm-input" id="goal-input" type="number" min="0" step="1">
            </div>
        </div>
    </div>

    <div class="bm-title" data-i18n="section.stats">Statistics</div>
    <div class="bm-stats" id="stats"></div>

    <div class="bm-title" data-i18n="section.week">Last 7 days</div>
    <div class="bm-card">
        <div class="bm-chart"><canvas id="week-chart"></canvas></div>
    </div>

    <div class="bm-title" data-i18n="section.journal">Journal</div>
    <div class="bm-card">
        <div class="bm-list" id="journal"></div>
    </div>
</main>
</body>
</html>
```

`cigarettes/js/main.js`

```js
import { bm } from 'bm://app/sdk/bm.js';
import { CigaretteApp } from './CigaretteApp.js';

bm.ready.then(() => new CigaretteApp(bm, document, window.Chart).start());
```

`cigarettes/js/CigaretteApp.js`

```js
import { CigaretteStore } from './CigaretteStore.js';
import { DayCounter } from './DayCounter.js';

export class CigaretteApp {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.store = new CigaretteStore(bm.storage);
        this.chart = null;
        this.entries = [];
        this.goal = 10;
    }

    async start() {
        this.doc.getElementById('add-btn').addEventListener('click', () => this.add());
        this.doc.getElementById('goal-input').addEventListener('change', (event) => this.changeGoal(event.target.value));
        this.bm.onTheme(() => this.renderChart());
        await this.reload();
    }

    async reload() {
        this.goal = await this.store.getGoal();
        this.entries = await this.store.listEntries();
        this.doc.getElementById('goal-input').value = this.goal;
        this.render();
    }

    async add() {
        await this.store.addEntry(this.bm.clock.timestamp());
        await this.reload();
    }

    async changeGoal(value) {
        const goal = Math.max(0, Math.round(Number(value)) || 0);
        await this.store.saveGoal(goal);
        await this.reload();
    }

    async remove(id) {
        if (await this.bm.confirm(this.bm.t('journal.confirmDelete'), { confirmText: this.bm.t('common.delete'), danger: true })) {
            await this.store.removeEntry(id);
            await this.reload();
        }
    }

    render() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const today = week[week.length - 1].count;
        const total = week.reduce((sum, day) => sum + day.count, 0);
        this.renderStats([
            [this.bm.t('stat.today'), `${today} / ${this.goal}`],
            [this.bm.t('stat.week'), total],
            [this.bm.t('stat.average'), (total / 7).toFixed(1)]
        ]);
        this.renderJournal();
        this.renderChart();
        this.bm.setPills([this.bm.t('pill.entries', { count: this.entries.length })]);
    }

    renderStats(items) {
        this.doc.getElementById('stats').replaceChildren(
            ...items.map(([label, value]) => {
                const card = this.doc.createElement('div');
                card.className = 'bm-stat';
                const title = this.doc.createElement('div');
                title.className = 'bm-stat-label';
                title.textContent = label;
                const number = this.doc.createElement('div');
                number.className = 'bm-stat-value';
                number.textContent = value;
                card.append(title, number);
                return card;
            })
        );
    }

    renderJournal() {
        const journal = this.doc.getElementById('journal');
        if (this.entries.length === 0) {
            const empty = this.doc.createElement('div');
            empty.className = 'bm-empty';
            empty.textContent = this.bm.t('journal.empty');
            journal.replaceChildren(empty);
            return;
        }
        journal.replaceChildren(
            ...[...this.entries].reverse().slice(0, 10).map((entry) => {
                const item = this.doc.createElement('div');
                item.className = 'bm-list-item';
                const time = this.doc.createElement('span');
                time.textContent = new Date(entry.data.at).toLocaleString(this.bm.locale);
                const button = this.doc.createElement('button');
                button.className = 'bm-btn secondary';
                button.textContent = this.bm.t('common.delete');
                button.addEventListener('click', () => this.remove(entry.id));
                item.append(time, button);
                return item;
            })
        );
    }

    renderChart() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const colors = this.bm.theme.chart;
        const accent = getComputedStyle(this.doc.documentElement).getPropertyValue('--wh').trim();
        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new this.ChartClass(this.doc.getElementById('week-chart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: week.map((day) => day.key.slice(5)),
                datasets: [{ label: this.bm.t('chart.label'), data: week.map((day) => day.count), backgroundColor: accent }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } }
                }
            }
        });
    }
}
```

`cigarettes/js/CigaretteStore.js`

```js
export class CigaretteStore {
    static ENTRIES = 'entries';
    static SETTINGS = 'settings';

    constructor(storage) {
        this.storage = storage;
    }

    listEntries() {
        return this.storage.list(CigaretteStore.ENTRIES);
    }

    addEntry(timestamp) {
        return this.storage.insert(CigaretteStore.ENTRIES, { at: timestamp });
    }

    removeEntry(id) {
        return this.storage.remove(CigaretteStore.ENTRIES, id);
    }

    async getGoal() {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        return document ? document.data.goal : 10;
    }

    async saveGoal(goal) {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        if (document) {
            await this.storage.update(CigaretteStore.SETTINGS, document.id, { goal });
        } else {
            await this.storage.insert(CigaretteStore.SETTINGS, { goal });
        }
    }
}
```

`cigarettes/js/DayCounter.js`

```js
export class DayCounter {
    static dayKey(date) {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    static lastDays(entries, days, today) {
        const counts = new Map();
        for (const entry of entries) {
            const key = DayCounter.dayKey(new Date(entry.data.at));
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        const result = [];
        for (let offset = days - 1; offset >= 0; offset -= 1) {
            const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
            const key = DayCounter.dayKey(day);
            result.push({ key, count: counts.get(key) || 0 });
        }
        return result;
    }
}
```

## 14. Инструкция по установке (отдайте это пользователю)

1. Откройте приложение, зайдите в **Настройки**, найдите блок **Модули** и нажмите **Открыть папку модулей**.
2. Скопируйте всю папку `<id>` в открывшуюся папку. В итоге у вас должно получиться `.../modules/<id>/manifest.json`.
3. Вернитесь в приложение и нажмите **Перечитать** в настройках. Новый пункт меню появится.
4. Если он не появился, причина будет показана красным под списком модулей. Пришлите её мне, и я исправлю.
5. Если страница открылась, но говорит, что модуль упал, пришлите текст ошибки на экране.
6. Чтобы удалить модуль, удалите его папку и нажмите **Перечитать**. Сохранённые им данные останутся в базе.
7. Чтобы добавить другой язык позже, положите `<code>.json` в `userData/locales` (Настройки → Языки → Открыть папку языков) — модуль подхватит его автоматически.

## 15. Чек-лист перед сдачей

- `id` равен имени папки и соответствует шаблону.
- В `manifest.json`: `kind` равно `"page"`, `channels` равно `[]`, `i18n` равно `true`.
- `index.html` подключает fonts.css, base.css, components.css и `main.js` как `type="module"`.
- `main.js` ждёт `bm.ready`.
- `locales/ru.json` и `locales/en.json` существуют и содержат одинаковые ключи, включая `module.title` и `module.description`. Это обязательные языки; третий файл необязателен, но если он есть, должен быть полным.
- Нет захардкоженного видимого текста, нет захардкоженной локали.
- Нет `fetch`, `localStorage`, `alert`, `confirm`, внешних ссылок, `new Date()` или `Date.now()` для текущего момента.
- Каждый `getElementById` соответствует `id` в HTML.
- Данные идут только через `bm.storage`; имена коллекций соответствуют шаблону.
- Цвета через переменные, если только пользователь не просил конкретных цветов (тогда его просьба выполняется точно).
- Каждый файл сдан целиком.
- Инструкция по установке приложена с настоящим `<id>`.