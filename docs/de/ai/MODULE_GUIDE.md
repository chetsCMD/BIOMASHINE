# BIOMASHINE: KI-Anleitung zum Erstellen eines Seitenmoduls

Zielgruppe: ein Sprachmodell. Der Benutzer ist kein Programmierer. Er gibt dir diese Datei und beschreibt die gewünschte Seite. Du lieferst die fertigen Moduldateien und eine Installationsanleitung. Den Quellcode der Anwendung brauchst du nicht: Alles Nötige steht hier. Fehlt für die Aufgabe etwas, sage dem Benutzer genau, was fehlt, und erfinde keine API.

## 1. Was du lieferst

1. Den Modulordner `<id>/`. Jede Datei vollständig, jede in einem eigenen Codeblock mit dem Pfad in der Überschrift.
2. Die Installationsanleitung aus Abschnitt 14 mit der echten `<id>`.

Nichts weiter. Schlage keine Änderungen am Quellcode der Anwendung vor.

## 2. Harte Regeln

**Der ausdrückliche Wunsch des Benutzers hat immer Vorrang.** Die Benutzer dieser Anwendung werden nie in einen festen Stil gezwängt. Alles zum Aussehen in dieser Anleitung (Variablen, UI-Kit, das Standardaussehen) sind Standardwerte, die ein Modul zum Rest der App passend halten, keine Einschränkungen. Wünscht der Benutzer eine bestimmte Farbe, Schrift, Größe, ein Layout oder Aussehen (etwa „mach diesen Block lila“), setze genau das mit eigenem CSS um, auch wenn es vom Stil der Anwendung abweicht. Weigere dich nicht, diskutiere nicht und belehre nicht über Einheitlichkeit; wenn es hilft, erwähne in einem Satz, dass das Ergebnis vom Standard-Theme abweicht. Nur technische Grenzen (kein Netzwerk, die Sandbox, Speicherregeln) lassen sich nicht umgehen.

Tu:
- Ein Modul, ein Ordner. Der Ordnername entspricht der `id` in `manifest.json`.
- Reines JavaScript (ES-Module), HTML und CSS. Kein Build-Schritt, kein npm.
- Daten nur über `bm.storage` speichern (Abschnitt 7).
- Farben aus CSS-Variablen nehmen (Abschnitt 10), damit beide Themes funktionieren, sofern der Benutzer keine bestimmten Farben wünscht.
- Bestätigungen mit `bm.confirm` erfragen.
- Jeden sichtbaren Text in Wörterbücher legen und mit `bm.t` lesen (Abschnitt 8). `"i18n": true` in `manifest.json` eintragen.
- Die aktuelle Zeit nur aus `bm.clock` nehmen (Abschnitt 9).
- Klassen schreiben, eine pro Datei; Logik ohne DOM in eigene Klassen auslagern.

Lass:
- `fetch`, `XMLHttpRequest`, `WebSocket`, externe Links, CDNs, externe Schriften oder Bilder. Es gibt kein Netzwerk.
- `localStorage`, `sessionStorage`, IndexedDB oder Cookies: Diese Daten kämen nicht in den Export.
- `alert`, `confirm`, `prompt` oder `window.open`: Sie sind blockiert.
- `eval` oder `document.write`.
- `bm.invoke` aufrufen oder Daten anderer Module lesen: In dieser Version arbeitet ein Modul nur mit seinem eigenen Speicher.
- Die `id` nach der ersten Installation ändern: Die Daten hängen an ihr.
- Bibliotheken von Drittanbietern hinzufügen. Ausnahme ist Chart.js, das die Anwendung bereits mitbringt (Abschnitt 11).

## 3. Ordnerstruktur

    <id>/
      manifest.json
      index.html
      locales/
        ru.json
        en.json
      js/
        main.js
        <DeineKlasse>.js

Weitere Dateien (CSS, Bilder, Schriften) sind erlaubt; verweise mit relativen Pfaden. Eine `README.md` ist bei Benutzermodulen optional.

## 4. manifest.json

| Feld | Typ | Pflicht | Regel |
|---|---|---|---|
| `id` | string | ja | `^[a-z][a-z0-9-]*$`, gleich dem Ordnernamen, nicht `app`, `shell` oder `shared`, eindeutig |
| `kind` | string | ja | immer `"page"` |
| `title` | string | ja | Menübezeichnung, kurz (Fallback, falls der Wörterbuchschlüssel fehlt) |
| `version` | string | nein | `"1.0.0"` |
| `description` | string | nein | eine Zeile für die Einstellungsliste |
| `order` | number | nein | Position im Menü; Benutzermodule haben standardmäßig 1000 (zuletzt) |
| `entry` | string | nein | Standard `index.html` |
| `category` | string | nein | Kategorie für Menü und Modul-Hub (`body`, `mind`, `finance`, `knowledge`, `environment`, `other`) |
| `i18n` | boolean | nein | auf `true` setzen: Titel und Beschreibung stammen dann aus den Wörterbuchschlüsseln `module.title` und `module.description` |
| `permissions` | array | nein | `["notifications"]`, wenn das Modul Systembenachrichtigungen planen soll (`bm.notify`) |
| `channels` | array | nein | für diese Anleitung immer `[]` |

## 5. index.html-Gerüst

Binde genau so ein; ändere die Pfade nicht. Die Zeile für Chart.js wird nur bei Diagrammen gebraucht.

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Titel</title>
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

Einstiegspunkt `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { App } from './App.js';

bm.ready.then(() => new App(bm, document, window.Chart).start());
```

Warte immer auf `bm.ready`, bevor du `bm` anfasst.

## 6. Das SDK: das Objekt `bm`

| Aufruf | Liefert | Beschreibung |
|---|---|---|
| `bm.ready` | `Promise` | Wird erfüllt, wenn Verbindung, Theme, Sprache und Zeitzone bereit sind |
| `bm.storage.*` | siehe Abschnitt 7 | Der Datenspeicher des Moduls |
| `bm.t(key, params)` | string | Übersetzt einen Schlüssel (Abschnitt 8) |
| `bm.locale`, `bm.language` | string | Die Locale für `toLocaleString` (etwa `de-DE`) und der Sprachcode |
| `bm.clock` | Objekt | Zeit in der vom Benutzer gewählten Zeitzone (Abschnitt 9) |
| `bm.confirm(text, options)` | `Promise<boolean>` | Dialog. `options`: `confirmText`, `cancelText`, `danger` (rote Schaltfläche) |
| `bm.setPills(items)` | nichts | Kleine Etiketten rechts in der Kopfzeile. `items` ist ein Array aus Zeichenketten; ein leeres Array löscht sie |
| `bm.notify` | Objekt | `schedule(options)`, `cancel(id)`, `list()`; braucht `"permissions": ["notifications"]` |
| `bm.state` | Objekt | `register(name, { capture, restore })` für Zustand, der bei der Sitzungswiederherstellung erhalten bleiben soll |
| `bm.theme` | Objekt | `{ name: 'dark' \| 'light', colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | Abmeldefunktion | `fn` läuft bei Theme-Wechsel; baue Diagramme darin neu auf |
| `bm.config(name)` | `Promise<object>` | Liest eine Anwendungskonfiguration. Meist unnötig |

Jedes Promise-liefernde Aufruf scheitert mit einem `Error` mit `message` und numerischem `status`.

## 7. Speicher: `bm.storage`

Speichert JSON-Dokumente in benannten Sammlungen. Der Speicher ist isoliert: Ein Modul sieht nur seine eigenen Daten. Die Daten gehören zum JSON- und CSV-Export.

| Aufruf | Liefert |
|---|---|
| `list(collection)` | `Promise<Document[]>` in Erstellungsreihenfolge (aufsteigende `id`) |
| `get(collection, id)` | `Promise<Document>`; scheitert mit `status` 404, wenn es fehlt |
| `insert(collection, data)` | `Promise<number>`: die neue `id` |
| `update(collection, id, data)` | `Promise<void>`: ersetzt `data` als Ganzes, führt nicht zusammen |
| `remove(collection, id)` | `Promise<void>`, scheitert mit 404, wenn es fehlt |
| `clear(collection)` | `Promise<number>`: wie viele Dokumente entfernt wurden |

Ein Dokument ist `{ id: number, data: object, createdAt: string, updatedAt: string }`. Erstellungs- und Änderungszeit setzt die Anwendung.

Regeln:
- Sammlungsname: `^[a-z][a-z0-9_-]{0,39}$`.
- `data`: ein einfaches JSON-serialisierbares Objekt von höchstens 262144 Bytes. Kein Array, keine Zeichenkette. Kein `undefined`, keine Funktionen, keine `Date`-Objekte. Zeitpunkte speicherst du als Zeichenkette aus `bm.clock.timestamp()`.
- Filtere, sortiere und aggregiere in JavaScript nach `list`.
- Einzelne Einstellungen hältst du als ein Dokument in einer Sammlung `settings`: `list`, dann das erste Dokument per `update` ändern oder bei leerer Liste `insert` (siehe Beispiel).
- Ändere das Datenschema nicht inkompatibel: Wenn du ein Feld hinzufügst, denke daran, dass alten Dokumenten es fehlt.

## 8. Text und Sprachen

Die Anwendung ist mehrsprachig: Der Benutzer wählt die Sprache, daher darf kein sichtbarer Text fest in JavaScript oder HTML stehen.

- `locales/ru.json` und `locales/en.json`: flache Objekte `"key": "text"`. Die Schlüssel beider Dateien müssen identisch sein. `module.title` und `module.description` sind Pflicht. Weitere Sprachen (etwa `de.json`) sind optional; fehlende Schlüssel kommen aus dem Englischen.
- JavaScript: `bm.t('key')`; mit Parametern `bm.t('key', { n: 5 })` (der Text enthält `{n}`); mit Pluralformen `bm.t('key', { count: 5 })` (der Wörterbuchwert ist ein Objekt: `one`, `few`, `many`, `other` für Russisch; `one`, `other` für Englisch und Deutsch).
- HTML: `data-i18n="key"` ersetzt den Text des Elements, `data-i18n-placeholder="key"` und `data-i18n-title="key"` ersetzen die Attribute. Lass im Element einen Standardtext stehen.
- Datum und Zahlen: `toLocaleString(bm.locale)`, nie eine fest verdrahtete Locale wie `'en-US'`.
- Gemeinsame Wörter stehen ohne Deklaration zur Verfügung: `common.delete`, `common.cancel`, `common.save`, `unit.ms`, `unit.g`, `unit.kcal`.
- Setze nie einen Satz aus übersetzten Teilen zusammen: ein Schlüssel pro Satz.
- Eine Eigenschaft namens `key` ist für Wörterbuchschlüssel reserviert; nutze für anderes einen anderen Namen.

## 9. Zeit: `bm.clock`

Der Benutzer wählt in den Einstellungen eine Zeitzone, verwende also nie `new Date()`, `Date.now()` oder `toISOString()` für den aktuellen Zeitpunkt.

| Aufruf | Ergebnis |
|---|---|
| `bm.clock.now()` | Ein `Date`-Objekt, dessen Methoden `getHours()`, `getDate()` usw. die Zeit der gewählten Zone zeigen |
| `bm.clock.today()` | Eine Zeichenkette `YYYY-MM-DD` |
| `bm.clock.timestamp()` | Eine Zeichenkette `YYYY-MM-DD HH:MM:SS`. Speichere diese |

Das Lesen und Formatieren aus dem Speicher gelesener Daten (`new Date('2026-11-02 14:00:00')`) ist in Ordnung.

## 10. Gestaltung

Standardmäßig gestaltest du die Seite wie den Rest der App und nimmst Farben aus den Variablen unten; die Schriften sind bereits geladen (`JetBrains Mono` für Text, `Playfair Display` für große Zahlen). Wünscht der Benutzer etwas anderes, folge dem Benutzer (siehe die Regel am Anfang von Abschnitt 2): Schreibe das gewünschte CSS in `module.css`, mit beliebigen Farben, Schriften oder Größen.

| Variable | Bedeutung | Dunkel | Hell |
|---|---|---|---|
| `--bg` | Seitenhintergrund | `#121212` | `#f4f4f2` |
| `--s1` | Kartenhintergrund | `#1c1c1c` | `#ffffff` |
| `--s2` | Hintergrund von Eingaben und verschachtelten Blöcken | `#242424` | `#ececea` |
| `--s3` | Hintergrund bei Hover und Aktivierung | `#2c2c2c` | `#e2e2df` |
| `--br` | Hauptrahmen | `#2e2e2e` | `#d2d2ce` |
| `--br2` | dünne Trennlinien | `#262626` | `#dededa` |
| `--t` | Haupttext | `#e8e8e8` | `#1c1c1c` |
| `--td` | Sekundärtext | `#a0a0a0` | `#5a5a5a` |
| `--tdd` | Beschriftungen und Hinweise | `#6e6e6e` | `#8a8a8a` |
| `--tddd` | blasseste Elemente | `#3a3a3a` | `#c4c4c0` |
| `--wh` | Akzent: Überschriften, große Zahlen, primäre Schaltfläche | `#f0f0f0` | `#0d0d0d` |
| `--overlay` | Abdunklung unter Dialogen | `rgba(0, 0, 0, 0.6)` | `rgba(0, 0, 0, 0.35)` |
| `--header-bg` | Hintergrund der Kopfzeile | `rgba(18, 18, 18, 0.92)` | `rgba(244, 244, 242, 0.92)` |

Verwendung: `color: var(--td); background: var(--s1); border: 1px solid var(--br);`. Variablen halten die Seite in jedem Theme lesbar, nimm sie also, wenn der Benutzer keine Farbwünsche hat; feste Farben sind in Ordnung, sobald der Benutzer sie will, und für Datenfarben in Diagrammen. Der aktuelle Theme-Name steht im Attribut `data-theme` an `<html>`.

Das UI-Kit aus `components.css`. Bevorzuge es vor eigenem CSS:

| Klasse | Zweck |
|---|---|
| `bm-page` | Seitencontainer am `<main>`, zentriert und begrenzt die Breite |
| `bm-title` | Abschnittstitel mit Linie |
| `bm-card` | Karte |
| `bm-row` | Zeile mit Ausrichtung und Abständen |
| `bm-spacer` | Dehnender Platzhalter in `bm-row` |
| `bm-muted` | Gedämpfter kleiner Text |
| `bm-label` | Beschriftung über einem Feld |
| `bm-input` | Eingabe, `select`, `textarea` |
| `bm-btn` | Primäre Schaltfläche. Varianten: `secondary`, `danger` |
| `bm-list` | Vertikale Liste |
| `bm-list-item` | Listenzeile: Inhalt links, Aktion rechts |
| `bm-empty` | Platzhalter für eine leere Liste |
| `bm-stats` | Raster aus Statistikkacheln |
| `bm-stat` | Kachel |
| `bm-stat-label` | Beschriftung einer Kachel |
| `bm-stat-value` | Große Zahl einer Kachel |
| `bm-chart` | Diagrammcontainer fester Höhe mit einem `<canvas>` |

Eigenes CSS ist für alles in Ordnung, was dem Kit fehlt. Lege es in `module.css` im Modulordner ab und binde es nach `components.css` ein.

Zwei Fälle sind zu unterscheiden. Code des Projekts selbst verwendet nie feste visuelle Werte, sondern Design-Tokens. Ein Modul, das du für einen Benutzer schreibst, ist dessen eigener Inhalt: Nimm standardmäßig die Variablen oben, und beliebige Werte oder eigenes CSS, sobald der Benutzer sie wünscht. Außerdem kann der Benutzer in den Einstellungen unter „Design“ jedes Token überschreiben und eigenes CSS ergänzen, ohne das Modul anzufassen.

## 11. Diagramme

Chart.js 3.8.0 steht als `window.Chart` bereit, wenn `index.html` `<script src="bm://app/vendor/chart.min.js"></script>` enthält. Reiche `window.Chart` wie im Beispiel an den Konstruktor deiner Klasse weiter. Achsenfarben nimmst du aus `bm.theme.chart`, die Datenfarbe aus `getComputedStyle(document.documentElement).getPropertyValue('--wh')`. Lege das Canvas in `.bm-chart`. Bei Theme-Wechsel (`bm.onTheme`) rufe `chart.destroy()` auf und baue das Diagramm neu.

## 12. Häufige Fehler

- `await bm.ready` vergessen: Theme, Sprache und Verbindung sind noch nicht bereit.
- `window.Chart` ohne das `<script>`-Tag verwenden: Es gibt kein Diagramm.
- Ein `Date`-Objekt in `data` legen: Es wird beim Speichern zur Zeichenkette; speichere die Zeichenkette aus `bm.clock.timestamp()` selbst.
- Erwarten, dass `update` Felder zusammenführt: Es ersetzt das Dokument.
- `confirm()` verwenden: Es ist blockiert; nimm `bm.confirm`.
- Den Ordner anders nennen als die `id`: Das Modul wird abgelehnt.
- Großbuchstaben in der `id` verwenden.
- Text im Code oder in HTML ohne Wörterbuchschlüssel lassen.

## 13. Vollständiges Beispiel: ein Zigarettenzähler

Die folgenden Dateien sind installationsfertig. Nutze sie als Vorbild für Struktur und Stil. (Die Standardtexte des Beispiels sind russisch; beide Wörterbücher sind gezeigt.)

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


## 14. Installationsanleitung (dem Benutzer geben)

1. Öffne die App, gehe zu **Einstellungen**, suche den Bereich **Module** und klicke auf **Modulordner öffnen**.
2. Kopiere den ganzen Ordner `<id>` in den geöffneten Ordner. Am Ende muss `.../modules/<id>/manifest.json` existieren.
3. Gehe zurück in die App und klicke in den Einstellungen auf **Neu einlesen**. Der neue Menüpunkt erscheint.
4. Erscheint er nicht, steht der Grund in Rot unter der Modulliste. Schicke ihn mir, dann behebe ich es.
5. Öffnet sich die Seite, meldet aber, dass das Modul abgestürzt ist, schicke mir den auf dem Bildschirm gezeigten Fehlertext.
6. Zum Entfernen löschst du den Ordner und klickst auf **Neu einlesen**. Die vom Modul gespeicherten Daten bleiben in der Datenbank.

## 15. Checkliste vor der Abgabe

- `id` entspricht dem Ordnernamen und dem Muster.
- In `manifest.json`: `kind` ist `"page"`, `channels` ist `[]`, `i18n` ist `true`.
- `index.html` bindet fonts.css, base.css, components.css und `main.js` als `type="module"` ein.
- `main.js` wartet auf `bm.ready`.
- `locales/ru.json` und `locales/en.json` haben identische Schlüssel, einschließlich `module.title` und `module.description`.
- Kein fest verdrahteter sichtbarer Text, keine fest verdrahtete Locale.
- Kein `fetch`, `localStorage`, `alert`, `confirm`, keine externen Links, kein `new Date()` oder `Date.now()` für den aktuellen Zeitpunkt.
- Jedes `getElementById` hat eine passende `id` im HTML.
- Daten gehen nur über `bm.storage`; Sammlungsnamen entsprechen dem Muster.
- Farben über Variablen, außer der Benutzer wollte bestimmte Farben (dann ist sein Wunsch genau umgesetzt).
- Jede Datei ist vollständig geliefert.
- Die Installationsanleitung mit der echten `<id>` liegt bei.
