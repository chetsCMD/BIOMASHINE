# BIOMASHINE: Руководство для ИИ по созданию модуля-страницы

Аудитория: языковая модель. Пользователь не является программистом. Он даёт вам этот файл и описывает страницу, которую хочет. Вы предоставляете готовые файлы модуля и инструкции по установке. Вам не нужен исходный код приложения: всё необходимое описано здесь. Если для выполнения задачи чего-то не хватает, скажите пользователю, чего именно не хватает, и не выдумывайте API.

## 1. Что вы предоставляете

1. Папку модуля `<id>/`. Каждый файл целиком, каждый в своём блоке кода с указанием пути в заголовке.
2. Инструкции по установке из раздела 14 с подставленным реальным `<id>`.

Больше ничего. Не предлагайте изменить исходный код приложения.

## 2. Жёсткие правила

Делайте:
- Один модуль, одна папка. Имя папки совпадает с `id` в `manifest.json`.
- Чистый JavaScript (ES-модули), HTML и CSS. Без этапа сборки, без npm.
- Сохраняйте данные только через `bm.storage` (раздел 7).
- Берите цвета из CSS-переменных (раздел 10), чтобы работали обе темы.
- Запрашивайте подтверждения через `bm.confirm`.
- Помещайте весь видимый пользователю текст в словари и читайте его через `bm.t` (раздел 8). Добавьте `"i18n": true` в `manifest.json`, если переводите на два языка.
- Берите текущее время только из `bm.clock` (раздел 9).
- Пишите классы, по одному на файл; логику, не требующую DOM, выносите в отдельные классы.

Не делайте:
- Не используйте `fetch`, `XMLHttpRequest`, `WebSocket`, внешние ссылки, CDN, внешние шрифты или изображения. Сети нет.
- Не используйте `localStorage`, `sessionStorage`, IndexedDB или cookies: эти данные не попадут в экспорт.
- Не используйте `alert`, `confirm`, `prompt` или `window.open`: они заблокированы.
- Не используйте `eval` или `document.write`.
- Не вызывайте `bm.invoke` и не читайте данные других модулей: в этой версии модуль работает только со своим хранилищем.
- Не меняйте `id` после первой установки: данные привязаны к нему.
- Не добавляйте сторонние библиотеки. Исключение — Chart.js, который уже предоставляется приложением (раздел 11).

## 3. Структура папок

    <id>/
      manifest.json
      index.html
      locales/
        ru.json
        en.json
      js/
        main.js
        <YourClass>.js

Другие файлы (CSS, изображения, шрифты) разрешены; ссылайтесь на них по относительным путям. `README.md` для пользовательских модулей необязателен.

## 4. manifest.json

| Поле | Тип | Обязательно | Правило |
|---|---|---|---|
| `id` | string | да | `^[a-z][a-z0-9-]*$`, совпадает с именем папки, не `app`, `shell` или `shared`, уникально |
| `kind` | string | да | всегда `"page"` |
| `title` | string | да | метка в меню, короткая (запасной вариант при отсутствии ключа словаря) |
| `version` | string | нет | `"1.0.0"` |
| `description` | string | нет | одна строка для списка настроек |
| `order` | number | нет | позиция в меню; для пользовательских модулей по умолчанию 1000 (в конце) |
| `entry` | string | нет | по умолчанию `index.html` |
| `i18n` | boolean | нет | установите `true`: тогда заголовок и описание берутся из ключей словаря `module.title` и `module.description` |
| `channels` | array | нет | для этого руководства всегда `[]` |

## 5. Скелет index.html

Подключайте в точности так; не меняйте пути. Строка с Chart.js нужна только при наличии графиков.

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

Всегда дожидайтесь `bm.ready` перед обращением к `bm`.

## 6. SDK: объект `bm`

| Вызов | Возвращает | Описание |
|---|---|---|
| `bm.ready` | `Promise` | Разрешается, когда соединение, тема, язык и часовой пояс готовы |
| `bm.storage.*` | см. раздел 7 | Хранилище данных модуля |
| `bm.t(key, params)` | string | Переводит ключ (раздел 8) |
| `bm.locale`, `bm.language` | string | Локаль для `toLocaleString` (например, `en-US`) и код языка |
| `bm.clock` | object | Время в выбранном пользователем часовом поясе (раздел 9) |
| `bm.confirm(text, options)` | `Promise<boolean>` | Диалог. `options`: `confirmText`, `cancelText`, `danger` (красная кнопка) |
| `bm.setPills(items)` | ничего | Маленькие метки справа в заголовке. `items` — массив строк; пустой массив очищает их |
| `bm.theme` | object | `{ name: 'dark' \| 'light', colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | функция отписки | `fn` выполняется при смене темы; перестраивайте графики в ней |
| `bm.config(name)` | `Promise<object>` | Читает конфигурацию приложения. Обычно не требуется |

Каждый вызов, возвращающий промис, отклоняется с `Error`, у которой есть `message` и числовой `status`.

## 7. Хранилище: `bm.storage`

Хранит JSON-документы в именованных коллекциях. Хранилище изолировано: модуль видит только свои данные. Данные включаются в экспорт JSON и CSV.

| Вызов | Возвращает |
|---|---|
| `list(collection)` | `Promise<Document[]>` в порядке создания (по возрастанию `id`) |
| `get(collection, id)` | `Promise<Document>`; отклоняется с `status` 404, если отсутствует |
| `insert(collection, data)` | `Promise<number>`: новый `id` |
| `update(collection, id, data)` | `Promise<void>`: заменяет `data` целиком, не объединяет |
| `remove(collection, id)` | `Promise<void>`, отклоняется с 404, если отсутствует |
| `clear(collection)` | `Promise<number>`: сколько документов было удалено |

Документ — это `{ id: number, data: object, createdAt: string, updatedAt: string }`. Приложение устанавливает время создания и обновления.

Правила:
- Имя коллекции: `^[a-z][a-z0-9_-]{0,39}$`.
- `data`: простой сериализуемый в JSON объект размером не более 262144 байт. Не массив, не строка. Без `undefined`, функций или объектов `Date`. Храните моменты времени как строку из `bm.clock.timestamp()`.
- Фильтруйте, сортируйте и агрегируйте в JavaScript после `list`.
- Храните одиночные настройки как один документ в коллекции `settings`: вызовите `list`, затем `update` для первого документа или `insert`, если коллекция пуста (см. пример).
- Не меняйте схему данных несовместимым образом: при добавлении поля помните, что в старых документах его нет.

## 8. Текст и языки

Приложение многоязычное: пользователь выбирает язык, поэтому никакой видимый пользователю текст не может быть жёстко закодирован в JavaScript или HTML. Перед написанием уточни у пользователя, нужен ли ему перевод на два языка.

- `locales/ru.json` и `locales/en.json`: плоские объекты `"key": "text"`. Ключи в обоих файлах должны совпадать. `module.title` и `module.description` обязательны.
- JavaScript: `bm.t('key')`; с параметрами `bm.t('key', { n: 5 })` (в тексте есть `{n}`); с формами множественного числа `bm.t('key', { count: 5 })` (значение в словаре — объект: `one`, `few`, `many`, `other` для русского; `one`, `other` для английского).
- HTML: `data-i18n="key"` заменяет текст элемента, `data-i18n-placeholder="key"` и `data-i18n-title="key"` заменяют атрибуты. Оставляйте текст по умолчанию внутри элемента.
- Даты и числа: `toLocaleString(bm.locale)`, никогда не жёстко закодированная локаль вроде `'en-US'`.
- Общие слова доступны без объявления: `common.delete`, `common.cancel`, `common.save`, `unit.ms`, `unit.g`, `unit.kcal`.
- Никогда не собирайте предложение из переведённых фрагментов: один ключ на предложение.
- Свойство с именем `key` зарезервировано для ключей словаря; используйте другое имя для всего остального.

## 9. Время: `bm.clock`

Пользователь выбирает часовой пояс в Настройках, поэтому никогда не используйте `new Date()`, `Date.now()` или `toISOString()` для текущего момента.

| Вызов | Результат |
|---|---|
| `bm.clock.now()` | Объект `Date`, методы которого `getHours()`, `getDate()` и подобные показывают время выбранного пояса |
| `bm.clock.today()` | Строка `YYYY-MM-DD` |
| `bm.clock.timestamp()` | Строка `YYYY-MM-DD HH:MM:SS`. Храните это |

Разбор дат, прочитанных из хранилища (`new Date('2026-11-02 14:00:00')`), и их форматирование допустимы.

## 10. Стилизация

Оформляйте страницу так же, как остальное приложение. Используйте только переменные ниже для цветов; шрифты уже загружены (`JetBrains Mono` для текста, `Playfair Display` для больших чисел).

| Переменная | Значение | Тёмная | Светлая |
|---|---|---|---|
| `--bg` | фон страницы | `#121212` | `#f4f4f2` |
| `--s1` | фон карточки | `#1c1c1c` | `#ffffff` |
| `--s2` | фон полей ввода и вложенных блоков | `#242424` | `#ececea` |
| `--s3` | фон при наведении и активном состоянии | `#2c2c2c` | `#e2e2df` |
| `--br` | основные границы | `#2e2e2e` | `#d2d2ce` |
| `--br2` | тонкие разделители | `#262626` | `#dededa` |
| `--t` | основной текст | `#e8e8e8` | `#1c1c1c` |
| `--td` | вторичный текст | `#a0a0a0` | `#5a5a5a` |
| `--tdd` | подписи и подсказки | `#6e6e6e` | `#8a8a8a` |
| `--tddd` | самые бледные элементы | `#3a3a3a` | `#c4c4c0` |
| `--wh` | акцент: заголовки, большие числа, основная кнопка | `#f0f0f0` | `#0d0d0d` |
| `--overlay` | затемняющий слой под диалогами | `rgba(0, 0, 0, 0.6)` | `rgba(0, 0, 0, 0.35)` |
| `--header-bg` | фон заголовка | `rgba(18, 18, 18, 0.92)` | `rgba(244, 244, 242, 0.92)` |

Использование: `color: var(--td); background: var(--s1); border: 1px solid var(--br);`. Не пишите собственные цвета, кроме цветов данных на графиках. Имя текущей темы — это атрибут `data-theme` на `<html>`.

UI-кит из `components.css`. Предпочитайте его пользовательскому CSS:

| Класс | Назначение |
|---|---|
| `bm-page` | Контейнер страницы на `<main>`, центрирует и ограничивает ширину |
| `bm-title` | Заголовок раздела с линией |
| `bm-card` | Карточка |
| `bm-row` | Строка с выравниванием и отступами |
| `bm-spacer` | Растягивающийся разделитель внутри `bm-row` |
| `bm-muted` | Приглушённый мелкий текст |
| `bm-label` | Метка над полем |
| `bm-input` | Input, `select`, `textarea` |
| `bm-btn` | Основная кнопка. Модификаторы: `secondary`, `danger` |
| `bm-list` | Вертикальный список |
| `bm-list-item` | Строка списка: контент слева, действие справа |
| `bm-empty` | Заглушка для пустого списка |
| `bm-stats` | Сетка плиток статистики |
| `bm-stat` | Плитка |
| `bm-stat-label` | Подпись плитки |
| `bm-stat-value` | Большое число плитки |
| `bm-chart` | Контейнер графика фиксированной высоты с `<canvas>` внутри |

Пользовательский CSS допустим для всего, чего не хватает в ките. Поместите его в `module.css` в папке модуля и подключите после `components.css`.

## 11. Графики

Chart.js 3.8.0 доступен как `window.Chart`, когда `index.html` содержит `<script src="bm://app/vendor/chart.min.js"></script>`. Передайте `window.Chart` в конструктор вашего класса, как в примере. Берите цвета осей из `bm.theme.chart`, а цвет данных — из `getComputedStyle(document.documentElement).getPropertyValue('--wh')`. Поместите canvas внутрь `.bm-chart`. При смене темы (`bm.onTheme`) вызывайте `chart.destroy()` и создавайте график заново.

## 12. Типичные ошибки

- Забыли `await bm.ready`: тема, язык и соединение ещё не готовы.
- Использование `window.Chart` без тега `<script>`: графика нет.
- Помещение объекта `Date` в `data`: после сохранения он станет строкой; сами сохраняйте строку из `bm.clock.timestamp()`.
- Ожидание, что `update` объединит поля: он заменяет документ.
- Использование `confirm()`: он заблокирован; используйте `bm.confirm`.
- Несовпадение имени папки и `id`: модуль отклоняется.
- Использование заглавных букв в `id`.
- Оставление текста в коде или в HTML без ключа словаря.

## 13. Полный пример: счётчик сигарет

Файлы ниже готовы к установке. Используйте их как образец структуры и стиля. (Тексты примера по умолчанию — на русском; показаны оба словаря.)

`cigarettes/manifest.json`

```json
{
  "id": "cigarettes",
  "kind": "page",
  "title": "Сигареты",
  "version": "1.0.0",
  "description": "Счётчик выкуренных сигарет с дневной нормой и графиком за 7 дней",
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
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Сигареты</title>
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
            <button class="bm-btn" id="add-btn" data-i18n="btn.add">+1 сигарета</button>
            <div class="bm-spacer"></div>
            <div>
                <label class="bm-label" for="goal-input" data-i18n="goal.label">Норма в день</label>
                <input class="bm-input" id="goal-input" type="number" min="0" step="1">
            </div>
        </div>
    </div>

    <div class="bm-title" data-i18n="section.stats">Статистика</div>
    <div class="bm-stats" id="stats"></div>

    <div class="bm-title" data-i18n="section.week">Последние 7 дней</div>
    <div class="bm-card">
        <div class="bm-chart"><canvas id="week-chart"></canvas></div>
    </div>

    <div class="bm-title" data-i18n="section.journal">Журнал</div>
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


## 14. Инструкции по установке (дайте их пользователю)

1. Откройте приложение, перейдите в **Настройки**, найдите блок **Модули** и нажмите **Открыть папку модулей**.
2. Скопируйте всю папку `<id>` в открывшуюся папку. В итоге у вас должно получиться `.../modules/<id>/manifest.json`.
3. Вернитесь в приложение и нажмите **Пересканировать** (Rescan) в Настройках. Новый пункт меню появится.
4. Если он не появился, причина отображается красным под списком модулей. Пришлите её мне, и я исправлю.
5. Если страница открывается, но сообщает, что модуль упал, пришлите мне текст ошибки, отображаемый на экране.
6. Чтобы удалить модуль, удалите его папку и нажмите **Пересканировать**. Данные, которые он сохранил, останутся в базе данных.

## 15. Чек-лист перед отправкой

- `id` совпадает с именем папки и соответствует шаблону.
- В `manifest.json`: `kind` равно `"page"`, `channels` равно `[]`, `i18n` равно `true`.
- `index.html` подключает fonts.css, base.css, components.css и `main.js` как `type="module"`.
- `main.js` ожидает `bm.ready`.
- `locales/ru.json` и `locales/en.json` имеют идентичные ключи, включая `module.title` и `module.description`.
- Нет жёстко закодированного видимого пользователю текста, нет жёстко закодированной локали.
- Нет `fetch`, `localStorage`, `alert`, `confirm`, внешних ссылок, `new Date()` или `Date.now()` для текущего момента.
- Каждый `getElementById` имеет соответствующий `id` в HTML.
- Данные идут только через `bm.storage`; имена коллекций соответствуют шаблону.
- Цвета только через переменные.
- Каждый файл предоставлен целиком.
- Инструкции по установке включены с реальным `<id>`.
