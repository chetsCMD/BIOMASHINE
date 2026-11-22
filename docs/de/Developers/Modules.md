# BIOMASHINE: Modulsystem

Alles auf dem Bildschirm außer der Shell ist ein Modul. Dieses Dokument ist der Vertrag für das Schreiben eines Moduls: Manifest, Isolationsmodell, SDK, Speicher, Lokalisierung, Zeit, Theming, Sitzungswiederherstellung und Plugins. Zur umgebenden Architektur siehe [Project Map.md](Project%20Map.md).

## 1. Arten von Modulen

| Art | Was es ist | Ort |
|---|---|---|
| Seite (`page`) | Ein Bildschirm mit eigenem Menüeintrag, eigener Oberfläche und eigenen Daten | `src/renderer/modules/<id>/` (System), `userData/modules/<id>/` (Benutzer) |
| Plugin (`plugin`) | Nur CSS, angewendet auf die Shell und jede Seite | dieselben Orte |
| Konfiguration | Konstanten, Farben, Koeffizienten | `config/<name>.json`, überschrieben durch `userData/config/<name>.json` |

Es gibt keine Hauptseite. Die Shell (`src/renderer/shell`) ist kein Modul: Sie liefert Menü, Anmeldung, Einstellungen, Dialoge und die Befehlspalette.

**Systemmodule** sind Teil der Anwendung. **Benutzermodule** sind Ordner, die der Benutzer nach `userData/modules/` kopiert (die Einstellungen haben Knöpfe zum Öffnen des Ordners und zum erneuten Einlesen). Die Registry liest Systemmodule zuerst; ein Benutzermodul mit der `id` eines Systemmoduls wird mit Begründung abgelehnt.

## 2. Manifest

`manifest.json` ist in jedem Modulordner Pflicht.

```json
{
  "id": "reaction",
  "kind": "page",
  "title": "Reaction",
  "version": "1.0.0",
  "description": "Reaction speed test",
  "category": "mind",
  "order": 80,
  "entry": "index.html",
  "hideable": true,
  "i18n": true,
  "permissions": ["notifications"],
  "channels": ["reaction:*"]
}
```

Ein Plugin hat `"kind": "plugin"` und `"css": ["style.css"]`.

| Feld | Gilt für | Regeln |
|---|---|---|
| `id` | beide | `^[a-z][a-z0-9-]*$`, gleich dem Ordnernamen, eindeutig, nicht `app`, `shell` oder `shared` |
| `kind` | beide | `page` oder `plugin` |
| `title` | beide | Bezeichnung in Menü und Einstellungen (Fallback ohne Wörterbuch) |
| `version`, `description` | beide | Optionale Zeichenketten |
| `order` | beide | Position im Menü; Standard `1000`, Benutzermodule stehen also zuletzt |
| `hideable` | beide | Standard `true`; der Benutzer darf die Seite ausblenden bzw. das Plugin abschalten |
| `entry` | Seite | Einstiegs-HTML, Standard `index.html` |
| `category` | Seite | Kategorie-Kennung für Menü und Modul-Hub (`body`, `mind`, `finance`, `knowledge`, `environment`, `other` oder eine eigene); der Benutzer kann sie ändern |
| `channels` | Seite | IPC-Kanäle, die das Modul aufrufen darf: `domain:*` oder `domain:action` |
| `permissions` | Seite | Zusätzliche Berechtigungen; derzeit `notifications` |
| `i18n` | Seite | `true`, wenn das Modul `locales/` mitbringt; Titel und Beschreibung stammen dann aus den Schlüsseln `module.title` und `module.description` |
| `css` | Plugin | Eine oder mehrere CSS-Dateien im Ordner |

Ein defektes Manifest bringt die App nie zum Absturz: Das Modul wird übersprungen, und der Grund steht in den Einstellungen.

## 3. Isolation und Laden

Jede Seite läuft in einem eigenen `<iframe sandbox="allow-scripts allow-same-origin">` mit eigenem Ursprung `bm://<id>`.

- Ein Modul hat keinen Zugriff auf `window.api` oder das DOM der Shell. Seine einzige Verbindung zur Anwendung ist die `postMessage`-Bridge, sichtbar als SDK-Objekt `bm`.
- Die Bridge lässt nur die in `channels` deklarierten Kanäle zu (außerdem `storage:*`, stets auf den eigenen Namensraum begrenzt). Alles andere scheitert mit Status `403`.
- Fehler und nicht behandelte Promise-Rejections werden an die Shell gemeldet, die einen Absturzbildschirm mit Neustart-Knopf zeigt; der Rest der Anwendung läuft weiter.
- `alert`, `confirm` und `prompt` sind durch die Sandbox blockiert. Nutze `bm.confirm`.
- Alle Frames teilen sich den Renderer-Prozess, eine Endlosschleife in einem Modul friert also das Fenster ein.

Dateien liefert das Protokoll `bm://`: `bm://app/...` ist die Renderer-Wurzel (Shell, SDK, gemeinsames CSS, Vendor-Dateien), `bm://<id>/...` der Ordner des Moduls.

## 4. Das SDK

```js
import { bm } from 'bm://app/sdk/bm.js';

await bm.ready;
```

| Mitglied | Beschreibung |
|---|---|
| `bm.ready` | Promise, das erfüllt wird, sobald Verbindung, Theme, Sprache, Zeitzone, Design und Zustand initialisiert sind. `bm` nie davor verwenden |
| `bm.invoke(channel, payload)` | Ruft einen IPC-Kanal auf. Liefert das Ergebnis; schlägt mit einem `Error` mit `message` und `status` fehl |
| `bm.config(name)` | Liest ein Konfigurationsobjekt (jede Konfiguration außer der privaten `app`) |
| `bm.confirm(text, options)` | Gestalteter Bestätigungsdialog; `options`: `confirmText`, `cancelText`, `danger`. Liefert ein Boolean |
| `bm.setPills(items)` | Setzt die kleinen Etiketten rechts in der Kopfzeile (Array aus Zeichenketten, leeres Array löscht) |
| `bm.storage` | Dokumentenspeicher (Abschnitt 5) |
| `bm.t(key, params)` | Übersetzt einen Schlüssel (Abschnitt 6) |
| `bm.locale`, `bm.language` | Die BCP-47-Locale (für `toLocaleString`) und der Sprachcode |
| `bm.clock` | Zeit in der Zeitzone des Benutzers (Abschnitt 7) |
| `bm.notify` | Systembenachrichtigungen planen (Abschnitt 8, braucht die Berechtigung `notifications`) |
| `bm.state` | Zustand für die Sitzungswiederherstellung erweitern (Abschnitt 9) |
| `bm.theme` | `{ name, colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | Meldet sich für Theme-Änderungen an; liefert eine Abmeldefunktion |

Nachrichten zwischen Modul und Shell tragen die Markierung `biomashine-bridge`. Auf `hello` antwortet die Shell mit `init`; es enthält Theme, URLs der Plugin-Stylesheets, den Textsatz des Moduls, die Zeitzone, Design-Überschreibungen samt eigenem CSS und, falls gespeichert, den Zustand der letzten Sitzung.

## 5. Dokumentenspeicher

`bm.storage` speichert JSON-Dokumente in benannten Sammlungen, damit ein Modul Daten ohne Code im Hauptprozess ablegen kann. Dokumente sind je Modul getrennt und Teil des Datenexports.

| Aufruf | Ergebnis |
|---|---|
| `list(collection)` | `Promise<Document[]>` in Erstellungsreihenfolge |
| `get(collection, id)` | `Promise<Document>`; scheitert mit `404`, wenn es fehlt |
| `insert(collection, data)` | `Promise<number>` (die neue id) |
| `update(collection, id, data)` | Ersetzt `data` als Ganzes |
| `remove(collection, id)` | Löscht ein Dokument |
| `clear(collection)` | `Promise<number>` (entfernte Dokumente) |

Ein Dokument ist `{ id, data, createdAt, updatedAt }`. Sammlungsnamen entsprechen `^[a-z][a-z0-9_-]{0,39}$`. `data` muss ein einfaches JSON-Objekt von höchstens 262144 Bytes sein. Zeitpunkte speicherst du als Zeichenkette `bm.clock.timestamp()`, nicht als `Date`.

Systemmodule mit eigenen Tabellen nutzen stattdessen eigene Kanäle (Repository und Controller in `src/main`, Migration in `migrations/`).

## 6. Lokalisierung in Modulen

Ein Modul mit `"i18n": true` bringt `locales/ru.json` und `locales/en.json` mit und enthält keinen fest verdrahteten sichtbaren Text. Weitere Sprachen sind optional; fehlende Schlüssel kommen aus der Fallback-Kette (siehe [Localization.md](Localization.md)).

- **JavaScript:** `bm.t('status.saved')`, `bm.t('total', { n: 5 })` für `"Gesamt: {n}"`, `bm.t('items', { count: 5 })` für Pluralformen.
- **HTML:** `data-i18n="key"` ersetzt den Text des Elements; `data-i18n-placeholder`, `data-i18n-title` und `data-i18n-aria-label` ersetzen die jeweiligen Attribute. Lass den Standardtext als Fallback im Element stehen.
- **Pluralformen:** Ein Wert kann ein Objekt mit `zero`, `one`, `two`, `few`, `many`, `other` sein (`other` Pflicht); die Form wählt `Intl.PluralRules` anhand von `count`.
- **Datum und Zahlen:** `toLocaleString(bm.locale)`, nie eine fest verdrahtete Locale.
- **Texte in Konfigurationen:** Eine Konfiguration mit sichtbaren Namen speichert Wörterbuchschlüssel in Feldern, die auf `Key` enden (etwa `titleKey`); der Code ruft `bm.t(item.titleKey)` auf.
- **Pflichtschlüssel:** `module.title` und `module.description`.
- **Gemeinsames Wörterbuch:** Die Schlüssel in `src/renderer/shared/locales` (`common.*`, `unit.*`, Titel von Themes und Erfolgen) stehen jedem Modul ohne Deklaration zur Verfügung.
- **Ein Schlüssel pro Satz:** Setze nie einen Satz aus übersetzten Bruchstücken zusammen.

## 7. Zeit

Der Benutzer wählt in den Einstellungen eine Zeitzone. Ein Modul muss die aktuelle Zeit ausschließlich aus `bm.clock` lesen:

| Aufruf | Ergebnis |
|---|---|
| `bm.clock.now()` | Ein `Date`, dessen lokale Getter (`getHours()`, `getDate()` usw.) die Uhrzeit der gewählten Zone zeigen |
| `bm.clock.today()` | `YYYY-MM-DD` |
| `bm.clock.timestamp()` | `YYYY-MM-DD HH:MM:SS`; speichere dies, keine ISO-Zeichenkette |

Empfohlen ist eine einzige Uhrenklasse je Modul, die `bm.clock` kapselt, damit sonst nirgends `new Date()` oder `Date.now()` für den aktuellen Zeitpunkt vorkommt.

## 8. Benachrichtigungen

Ein Modul mit `"permissions": ["notifications"]` kann Systembenachrichtigungen planen:

```js
const id = await bm.notify.schedule({ title: 'Wasser trinken', body: 'Zeit für ein Glas', repeat: { type: 'daily', time: '10:00' } });
await bm.notify.cancel(id);
const geplant = await bm.notify.list();
```

Einmalig: `at: 'YYYY-MM-DD HH:MM:SS'` (in der gewählten Zeitzone). Wiederholt: `repeat: { type: 'daily', time: 'HH:MM' }` oder `{ type: 'weekdays', time: 'HH:MM', weekdays: [1, 3, 5] }` (0 ist Sonntag). Der Benutzer kann Benachrichtigungen jedes Moduls in den Einstellungen abschalten; Benachrichtigungen, die bei geschlossener Anwendung fällig wurden, erscheinen beim Start einmal gesammelt.

## 9. Sitzungswiederherstellung

Beim Beenden kann die Anwendung den Zustand speichern und beim nächsten Start wiederherstellen. Für Module geschieht das automatisch: Werte von Eingabefeldern mit einer `id` (außer Passwort-, Datei- und versteckten Feldern, und außer innerhalb eines Elements mit `data-persist="off"`), Checkboxen, Auswahllisten und Scrollpositionen werden gemerkt und nach dem Aufbau der Seite zurückgesetzt, wobei die passenden `input`- bzw. `change`-Ereignisse ausgelöst werden, damit Filter erneut greifen. Eigenen Zustand meldet ein Modul an:

```js
bm.state.register('tab', { capture: () => this.activeTab, restore: (value) => this.showTab(value) });
```

## 10. Theming und UI-Kit

Farben stammen aus CSS-Variablen des aktiven Themes: `--bg`, `--s1`, `--s2`, `--s3`, `--br`, `--br2`, `--t`, `--td`, `--tdd`, `--tddd`, `--wh`, `--overlay`, `--header-bg`. Außerdem ist jeder Gestaltungswert der Anwendung ein Token wie `--space-12px` oder `--radius-8px` (siehe [Design.md](Design.md)). Variablen zu verwenden hält ein Modul in jedem Theme lesbar und ist die Standardwahl, aber keine Einschränkung: Die Anwendung zwingt Benutzer nicht in einen Stil, ein Modul (oder die Bitte eines Benutzers an einen Assistenten) darf beliebige Farben, Schriften und Größen verwenden.

`bm://app/shared/components.css` liefert ein kleines UI-Kit:

| Klasse | Zweck |
|---|---|
| `bm-page` | Seitencontainer |
| `bm-title` | Abschnittstitel mit Linie |
| `bm-card` | Karte |
| `bm-row`, `bm-spacer` | Flex-Zeile und dehnender Platzhalter |
| `bm-muted`, `bm-label` | Gedämpfter kleiner Text; Feldbezeichnung |
| `bm-input` | Eingabe, Select, Textarea |
| `bm-btn` (`secondary`, `danger`) | Schaltflächen |
| `bm-list`, `bm-list-item`, `bm-empty` | Listen und Leerzustand |
| `bm-stats`, `bm-stat`, `bm-stat-label`, `bm-stat-value` | Statistikkacheln |
| `bm-chart` | Diagrammcontainer fester Höhe |

Chart.js 3.8.0 steht als `window.Chart` bereit, sobald `bm://app/vendor/chart.min.js` mit einem klassischen `<script>`-Tag geladen ist. Achsenfarben stammen aus `bm.theme.chart`; Diagramme werden in `bm.onTheme` neu aufgebaut, Reihenfarben stehen in einer Konfiguration.

## 11. Plugins

Ein Plugin liefert nur CSS. Seine Stylesheets werden nach den Theme-Styles geladen, in der Shell und in jeder Seite, und zwar in der Reihenfolge, die der Benutzer unter „Erscheinungsbild“ festlegt. Plugins können Theme-Variablen und Tokens überschreiben (`:root { --br: #444; }`, je Theme mit `:root[data-theme="light"]`), die Klassen des UI-Kits und die stabilen Selektoren der Shell umgestalten und lokale Schriften per `@font-face` laden. Externe URLs und `@import` sind nicht verfügbar, weil die Anwendung offline arbeitet. Nach den Plugins gelten Token-Überschreibungen und eigenes CSS des Benutzers.

## 12. Ein Seitenmodul schreiben

1. Lege `src/renderer/modules/<id>/` (bzw. `userData/modules/<id>/` für ein Benutzermodul) an mit `manifest.json`, `index.html`, `module.css`, `js/`, `locales/` und `README.md`.
2. Binde in `index.html` `bm://app/vendor/fonts/fonts.css`, `bm://app/shared/base.css`, bei Bedarf `bm://app/shared/components.css`, dein CSS, optional `bm://app/vendor/chart.min.js` und `<script type="module" src="./js/main.js">` ein.
3. `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { MyModule } from './MyModule.js';

bm.ready.then(() => new MyModule(bm, document).start());
```

4. Lege Logik in Klassen ab: Berechnungen ohne DOM-Zugriff, eine View-Klasse für das DOM, eine Repository-Klasse für Kanalaufrufe und einen Orchestrator, der alles verbindet.
5. Speichere Daten über `bm.storage` (Benutzermodule) oder eigene Kanäle (Systemmodule).
6. Baue das DOM mit `createElement` und `textContent`; weise `innerHTML` keine Daten zu.
7. Beschreibe das Modul in seiner `README.md`: Zweck, Kanäle, Konfigurationen, Dateien, Verhalten.

Schritt-für-Schritt-Anleitungen für KI-Assistenten liegen in [docs/de/ai](../ai): `MODULE_GUIDE.md` für Seiten und `PLUGIN_GUIDE.md` für Plugins.
