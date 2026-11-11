# BIOMASHINE: AI Guide for Creating a Page Module

Audience: a language model. The user is not a programmer. They give you this file and describe the page they want. You deliver the finished module files and installation instructions. You do not need the application's source code: everything required is described here. If something needed for the task is missing, tell the user exactly what is missing and do not invent an API.

## 1. What you deliver

1. The module folder `<id>/`. Every file in full, each in its own code block with the path in the heading.
2. The installation instructions from section 14 with the real `<id>` filled in.

Nothing else. Do not suggest changing the application's source code.

## 2. Hard rules

**The user's explicit request always wins.** The users of this application are never forced into a fixed style. Everything about appearance in this guide (variables, the UI kit, the default look) is a default that keeps a module consistent with the rest of the app, not a restriction. If the user asks for a specific color, font, size, layout or look (for example, "make this block purple"), do exactly that with custom CSS, even if it differs from the application's style. Do not refuse, argue or lecture about consistency; if it helps, mention in one sentence that the result deviates from the default theme. Only technical limits (no network, the sandbox, storage rules) cannot be bypassed.

Do:
- One module, one folder. The folder name equals `id` in `manifest.json`.
- Plain JavaScript (ES modules), HTML and CSS. No build step, no npm.
- Store data only through `bm.storage` (section 7).
- Unless the user asks for specific colors, take colors from CSS variables (section 10) so both themes work.
- Ask for confirmations with `bm.confirm`.
- Put every user-visible text into dictionaries and read it with `bm.t` (section 8). A module must ship `locales/ru.json` and `locales/en.json`; other languages are optional and can be added by the user later.
- Take the current time only from `bm.clock` (section 9).
- Write classes, one per file; keep logic that needs no DOM in separate classes.

Do not:
- Use `fetch`, `XMLHttpRequest`, `WebSocket`, external links, CDNs, external fonts or images. There is no network.
- Use `localStorage`, `sessionStorage`, IndexedDB or cookies: that data would not appear in the export.
- Use `alert`, `confirm`, `prompt` or `window.open`: they are blocked.
- Use `eval` or `document.write`.
- Call `bm.invoke` or read other modules' data: in this version a module works only with its own storage.
- Change `id` after the first installation: the data is bound to it.
- Add third-party libraries. The exception is Chart.js, which the application already provides (section 11).

## 3. Folder structure

    <id>/
      manifest.json
      index.html
      locales/
        ru.json
        en.json
      js/
        main.js
        <YourClass>.js

Other files (CSS, images, fonts) are allowed; reference them with relative paths. `README.md` is optional for user modules.

## 4. manifest.json

| Field | Type | Required | Rule |
|---|---|---|---|
| `id` | string | yes | `^[a-z][a-z0-9-]*$`, equal to the folder name, not `app`, `shell` or `shared`, unique |
| `kind` | string | yes | always `"page"` |
| `title` | string | yes | menu label, short (fallback when the dictionary key is missing) |
| `version` | string | no | `"1.0.0"` |
| `description` | string | no | one line for the settings list |
| `order` | number | no | position in the menu; user modules default to 1000 (last) |
| `entry` | string | no | defaults to `index.html` |
| `i18n` | boolean | no | set `true`: the title and description are then taken from the dictionary keys `module.title` and `module.description` |
| `channels` | array | no | for this guide always `[]` |

## 5. index.html skeleton

Link exactly like this; do not change the paths. The Chart.js line is needed only when there are charts.

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

Entry point `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { App } from './App.js';

bm.ready.then(() => new App(bm, document, window.Chart).start());
```

Always wait for `bm.ready` before touching `bm`.

## 6. The SDK: the `bm` object

| Call | Returns | Description |
|---|---|---|
| `bm.ready` | `Promise` | Resolves when the connection, theme, language and time zone are ready |
| `bm.storage.*` | see section 7 | The module's data storage |
| `bm.t(key, params)` | string | Translates a key (section 8) |
| `bm.locale`, `bm.language` | string | The locale for `toLocaleString` (for example `en-US`) and the language code |
| `bm.clock` | object | Time in the user's selected time zone (section 9) |
| `bm.confirm(text, options)` | `Promise<boolean>` | Dialog. `options`: `confirmText`, `cancelText`, `danger` (red button) |
| `bm.setPills(items)` | nothing | Small labels on the right side of the header. `items` is an array of strings; an empty array clears them |
| `bm.theme` | object | `{ name: 'dark' \| 'light', colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | unsubscribe function | `fn` runs when the theme changes; rebuild charts in it |
| `bm.config(name)` | `Promise<object>` | Reads an application config. Usually not needed |

Every promise-returning call rejects with an `Error` that has a `message` and a numeric `status`; when the failure came from a translated dictionary key, the error also has `code`.

## 7. Storage: `bm.storage`

Stores JSON documents in named collections. Storage is isolated: a module sees only its own data. The data is included in the JSON and CSV export.

| Call | Returns |
|---|---|
| `list(collection)` | `Promise<Document[]>` in creation order (ascending `id`) |
| `get(collection, id)` | `Promise<Document>`; rejects with `status` 404 if absent |
| `insert(collection, data)` | `Promise<number>`: the new `id` |
| `update(collection, id, data)` | `Promise<void>`: replaces `data` as a whole, does not merge |
| `remove(collection, id)` | `Promise<void>`, rejects with 404 if absent |
| `clear(collection)` | `Promise<number>`: how many documents were removed |

A document is `{ id: number, data: object, createdAt: string, updatedAt: string }`. The application sets the creation and update times.

Rules:
- Collection name: `^[a-z][a-z0-9_-]{0,39}$`.
- `data`: a plain JSON-serializable object of at most 262144 bytes. Not an array, not a string. No `undefined`, functions or `Date` objects. Store moments in time as the string from `bm.clock.timestamp()`.
- Filter, sort and aggregate in JavaScript after `list`.
- Keep singleton settings as one document in a `settings` collection: `list`, then `update` the first document or `insert` if empty (see the example).
- Do not change the data schema in a breaking way: when you add a field, remember that old documents lack it.

## 8. Text and languages

The application is multilingual: the user chooses the language, so no user-visible text may be hard-coded in JavaScript or HTML. Before writing, clarify with the user if they need a translation into two languages.

- `locales/ru.json` and `locales/en.json`: flat objects `"key": "text"`. The keys in both files must be identical. `module.title` and `module.description` are required.
- **`ru` and `en` are required.** Both files must exist and be complete. The application also supports other languages (the built-in registry is `config/app.json` → `i18n.builtin`): those files are optional in a module, but if a file for a built-in language is present, it must cover the same keys as `ru` and pass the same completeness check. The user can also drop a translation into `userData/locales/<code>.json` at runtime — the module picks it up automatically through the fallback chain.
- JavaScript: `bm.t('key')`; with parameters `bm.t('key', { n: 5 })` (the text contains `{n}`); with plural forms `bm.t('key', { count: 5 })` (the dictionary value is an object: `one`, `few`, `many`, `other` for Russian; `one`, `other` for English; other languages use the forms their locale defines — never mix forms from one language into another).
- HTML: `data-i18n="key"` replaces the element's text, `data-i18n-placeholder="key"` and `data-i18n-title="key"` replace the attributes. Keep a default text inside the element.
- Dates and numbers: `toLocaleString(bm.locale)`, never a hard-coded locale such as `'en-US'`.
- Common words are available without declaring them: `common.delete`, `common.cancel`, `common.save`, `unit.ms`, `unit.g`, `unit.kcal`.
- Never build a sentence from translated pieces: one key per sentence.
- A property named `key` is reserved for dictionary keys; use another name for anything else.

The full localization guide for the whole application (scopes, registry, `npm run i18n` tool, plural forms, scripts and fonts) is `docs/en/Developers/Localization.md`. That document is for contributors; a module author only needs the rules above.

## 9. Time: `bm.clock`

The user picks a time zone in Settings, so never use `new Date()`, `Date.now()` or `toISOString()` for the current moment.

| Call | Result |
|---|---|
| `bm.clock.now()` | A `Date` object whose methods `getHours()`, `getDate()` and similar show the selected zone's time |
| `bm.clock.today()` | A `YYYY-MM-DD` string |
| `bm.clock.timestamp()` | A `YYYY-MM-DD HH:MM:SS` string. Store this |

Parsing dates read from storage (`new Date('2026-11-02 14:00:00')`) and formatting them is fine.

## 10. Styling

By default, style the page like the rest of the app and take colors from the variables below; the fonts are already loaded (`JetBrains Mono` for text, `Playfair Display` for big numbers). When the user asks for something different, follow the user (see the rule at the top of section 2): write the CSS they ask for in `module.css`, with any colors, fonts or sizes.

| Variable | Meaning | Dark | Light |
|---|---|---|---|
| `--bg` | page background | `#121212` | `#f4f4f2` |
| `--s1` | card background | `#1c1c1c` | `#ffffff` |
| `--s2` | input and nested block background | `#242424` | `#ececea` |
| `--s3` | hover and active background | `#2c2c2c` | `#e2e2df` |
| `--br` | main borders | `#2e2e2e` | `#d2d2ce` |
| `--br2` | thin dividers | `#262626` | `#dededa` |
| `--t` | main text | `#e8e8e8` | `#1c1c1c` |
| `--td` | secondary text | `#a0a0a0` | `#5a5a5a` |
| `--tdd` | captions and hints | `#6e6e6e` | `#8a8a8a` |
| `--tddd` | faintest elements | `#3a3a3a` | `#c4c4c0` |
| `--wh` | accent: headings, big numbers, primary button | `#f0f0f0` | `#0d0d0d` |
| `--overlay` | dim layer under dialogs | `rgba(0, 0, 0, 0.6)` | `rgba(0, 0, 0, 0.35)` |
| `--header-bg` | header background | `rgba(18, 18, 18, 0.92)` | `rgba(244, 244, 242, 0.92)` |

Usage: `color: var(--td); background: var(--s1); border: 1px solid var(--br);`. Variables keep the page readable in every theme, so prefer them when the user has no color preference; literal colors are fine whenever the user wants them and for data colors on charts. The current theme name is the `data-theme` attribute on `<html>`.

The UI kit from `components.css`. Prefer it over custom CSS:

| Class | Purpose |
|---|---|
| `bm-page` | Page container on `<main>`, centers and limits the width |
| `bm-title` | Section title with a rule |
| `bm-card` | Card |
| `bm-row` | Row with alignment and gaps |
| `bm-spacer` | Stretching spacer inside `bm-row` |
| `bm-muted` | Muted small text |
| `bm-label` | Label above a field |
| `bm-input` | Input, `select`, `textarea` |
| `bm-btn` | Primary button. Modifiers: `secondary`, `danger` |
| `bm-list` | Vertical list |
| `bm-list-item` | List row: content on the left, action on the right |
| `bm-empty` | Placeholder for an empty list |
| `bm-stats` | Grid of statistic tiles |
| `bm-stat` | Tile |
| `bm-stat-label` | Tile caption |
| `bm-stat-value` | Big number of a tile |
| `bm-chart` | Fixed-height chart container with a `<canvas>` inside |

Custom CSS is fine for anything the kit lacks. Put it in `module.css` in the module folder and link it after `components.css`.

## 11. Charts

Chart.js 3.8.0 is available as `window.Chart` when `index.html` contains `<script src="bm://app/vendor/chart.min.js"></script>`. Pass `window.Chart` into your class constructor, as in the example. Take axis colors from `bm.theme.chart` and the data color from `getComputedStyle(document.documentElement).getPropertyValue('--wh')`. Put the canvas inside `.bm-chart`. When the theme changes (`bm.onTheme`), call `chart.destroy()` and build the chart again.

## 12. Common mistakes

- Forgetting `await bm.ready`: the theme, language and connection are not ready yet.
- Using `window.Chart` without the `<script>` tag: there is no chart.
- Putting a `Date` object into `data`: it becomes a string after saving; store the `bm.clock.timestamp()` string yourself.
- Expecting `update` to merge fields: it replaces the document.
- Using `confirm()`: it is blocked; use `bm.confirm`.
- Naming the folder one thing and `id` another: the module is rejected.
- Using capital letters in `id`.
- Leaving text in the code or in HTML without a dictionary key.
- Shipping only one dictionary file: `locales/ru.json` and `locales/en.json` are both required.

## 13. Full example: a cigarette counter

The files below are ready to install. Use them as a model for structure and style. (The example's default texts are in English; both dictionaries are shown.)

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

## 14. Installation instructions (give these to the user)

1. Open the app, go to **Settings**, find the **Modules** block and click **Open modules folder**.
2. Copy the whole `<id>` folder into the folder that opened. You should end up with `.../modules/<id>/manifest.json`.
3. Go back to the app and click **Rescan** in Settings. The new menu item appears.
4. If it does not appear, the reason is shown in red under the module list. Send it to me and I will fix it.
5. If the page opens but says the module crashed, send me the error text shown on screen.
6. To remove the module, delete its folder and click **Rescan**. The data it saved stays in the database.
7. To add another language later, drop a `<code>.json` file into `userData/locales` (Settings → Languages → Open languages folder) — the module picks it up automatically.

## 15. Pre-delivery checklist

- `id` equals the folder name and matches the pattern.
- In `manifest.json`: `kind` is `"page"`, `channels` is `[]`, `i18n` is `true`.
- `index.html` links fonts.css, base.css, components.css and `main.js` as `type="module"`.
- `main.js` waits for `bm.ready`.
- `locales/ru.json` and `locales/en.json` exist and have identical keys, including `module.title` and `module.description`. Those two are the required languages; a third file is optional but, if present, must be complete.
- No hard-coded user-visible text, no hard-coded locale.
- No `fetch`, `localStorage`, `alert`, `confirm`, external links, `new Date()` or `Date.now()` for the current moment.
- Every `getElementById` has a matching `id` in the HTML.
- Data goes only through `bm.storage`; collection names match the pattern.
- Colors through variables, unless the user asked for specific colors (then their request is implemented exactly).
- Every file is delivered in full.
- The installation instructions are included with the real `<id>`.