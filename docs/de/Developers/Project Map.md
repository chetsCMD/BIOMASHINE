# BIOMASHINE: Projektkarte

Dieses Dokument beschreibt den Aufbau von BIOMASHINE: Prozessmodell, Repository-Layout, IPC-Vertrag, Datenschicht, Konfiguration, Lokalisierung, Zeitzonen, Designsystem, Profile und Build-Pipeline. Modulautoren lesen es zusammen mit [Modules.md](Modules.md).

## 1. Überblick

BIOMASHINE ist ein persönliches Dashboard für Gesundheit und Lebensstil für einen einzelnen Benutzer. Es ist eine vollständig offline arbeitende Desktop-Anwendung: kein Server, keine Konten, keine Netzwerkanfragen, kein CDN. Alles liegt in einer lokalen SQLite-Datenbank.

| Schicht | Technik |
|---|---|
| Shell | Electron (Hauptprozess, Preload-Skript, Renderer) mit `contextIsolation: true` und `sandbox: true` |
| Speicher | SQLite über `better-sqlite3`, eine Datei je Profil |
| Oberfläche zu Daten | Ein IPC-Kanal (`api`) mit einem Dispatcher, der `domain:action` an Controller verteilt |
| Oberfläche | Eine Renderer-Shell plus Seiten („Module“) in isolierten iframes, ES-Module, Chart.js und Schriften aus npm |
| Code-Stil | Objektorientiert, eine Klasse je Datei, keine Kommentare im Code, Konstanten in JSON-Konfigurationen |

## 2. Prozessmodell

```
┌────────────────────────── Hauptprozess ───────────────────────────┐
│ Application ─ Container (Composition Root)                        │
│   IpcRouter ─ Controller ─ Dienste ─ Repositories ─ SQLite        │
│   ProtocolHandler (bm://)   WindowManager   ShortcutService       │
└────────────▲──────────────────────────────────────────────────────┘
             │ ipcRenderer.invoke('api', channel, payload)
┌────────────┴─── Renderer: Shell (bm://app/shell/index.html) ──────┐
│ window.api (Preload)   ShellApp   ModuleBridge   SettingsView ... │
│   ┌──────── iframe bm://<modul-id>/index.html ────────┐           │
│   │ SDK (bm)  ──postMessage──►  ModuleBridge          │           │
│   └────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────┘
```

- Der Hauptprozess besitzt Datenbank, Konfiguration, Authentifizierung und jede Fähigkeit mit Betriebssystemzugriff (Dialoge, Autostart, externe Links, Fensterzustand, Benachrichtigungen).
- Das Preload-Skript legt der Shell genau ein Objekt offen, `window.api`: `invoke(channel, payload)`, `onShortcut(handler)`, `onWindowState(handler)` und `onBeforeClose(handler)`. Module erhalten es nicht.
- Jede Seitenmodul läuft in einem eigenen `<iframe>` mit eigenem Ursprung (`bm://<modul-id>`). Das Modul spricht über eine `postMessage`-Bridge mit der Shell; sie prüft die deklarierten Kanalberechtigungen und leitet erlaubte Aufrufe an den Hauptprozess weiter. Siehe [Modules.md](Modules.md).
- Dateien liefert ein privilegiertes Protokoll, `bm://`. `bm://app/...` verweist auf `src/renderer`, `bm://<modul-id>/...` auf den Ordner des Moduls. Der Resolver verweigert jeden Pfad, der das Basisverzeichnis verlässt. Zusätzlich erzeugt das Protokoll das virtuelle Stylesheet `bm://app/shared/design.css` und ersetzt in ausgelieferten CSS-Dateien `$breakpoint-…`-Platzhalter.

## 3. Repository-Layout

```
build/                    Anwendungssymbole (ico, png, icns) und Splash des portablen Starters
config/                   alle Einstellungen und Konstanten als JSON
migrations/               SQL-Migrationen, der Reihe nach angewendet, Version in PRAGMA user_version
scripts/                  prepare.js (Chart.js und Schriften nach src/renderer/vendor), design.js, i18n.js
src/main/
  main.js                 Einstiegspunkt
  Application.js          Electron-Lebenszyklus, Einzelinstanz, privilegiertes Schema, Fenster, Profilwahl
  Container.js            baut jeden Dienst, jedes Repository und jeden Controller
  ElectronSystem.js       Adapter zum Betriebssystem: Dialoge, Autostart, Neustart, externe Links, Fensterzustand
  WindowManager.js        Fenster, Navigationswächter, Vollbild- und Schließereignisse
  ProtocolHandler.js      liefert bm://-Dateien und das virtuelle design.css
  ShortcutService.js      globale Tastenkürzel mit Registry und Überschreibungen
  PortablePaths.js        Datenordner neben dem Programm in portablen Builds
  core/                   Database, Migrator, ConfigService, IpcRouter, OperationLog, AssetResolver,
                          BaseRepository, BaseController, AppError, Attribution, Dates, Values, MimeTypes
  repositories/           der einzige Ort, an dem SQL steht
  services/               AuthService, SettingsService, ClockService, LocaleService, MessageService,
                          ModuleRegistry, ModuleService, ThemeCatalog, DesignService, SessionService,
                          NotificationService, WorkspaceRegistry, ExportService, SeedService
  controllers/            IPC-Handler: Validierung und Geschäftsregeln
  locales/                Wörterbücher der Nachrichten des Hauptprozesses
src/preload/preload.js    window.api
src/renderer/
  shell/                  Menü, Anmeldung, Einstellungen, Modul-Hub, Befehlspalette, Bridge, Dialoge, Themes
  sdk/                    das Modul-SDK (bm), Übersetzer, Uhr, Zustand, Nachrichtenprotokoll
  shared/                 base.css, components.css, gemeinsame Wörterbücher (locales/)
  modules/<id>/           Module (manifest.json, index.html, module.css, js/, locales/, README.md)
  vendor/                 von scripts/prepare.js erzeugt, nicht in Git
docs/                     Dokumentation
```

Benutzerdaten liegen im Electron-Verzeichnis `userData` (`%APPDATA%\BIOMASHINE` unter Windows, `~/.config/BIOMASHINE` unter Linux, `~/Library/Application Support/BIOMASHINE` unter macOS):

```
biomashine.sqlite         die Datenbank des Hauptprofils
profile-<id>.sqlite       Datenbanken weiterer Profile
profiles.json             Register der Profile
config/                   eigene Konfigurationen (siehe Abschnitt 7)
modules/                  vom Benutzer installierte Module und Plugins
locales/                  eigene Sprachdateien (siehe Abschnitt 10)
```

In portablen Builds (Windows `portable`, Linux AppImage) entsteht dieselbe Struktur in einem Ordner `BIOMASHINE-data` neben der ausführbaren Datei, Programm und Daten lassen sich also gemeinsam verschieben.

## 4. Lebenszyklus und Komposition

`Application.run()`:

1. Setzt den Datenordner (portabler Modus), fordert die Einzelinstanz-Sperre an und liest das Profilregister (`WorkspaceRegistry`); der Startparameter `--profile=<id>` wählt für diesen Lauf ein Profil.
2. Baut den `Container` vor der Bereitschaft der App: Er öffnet die Datenbank des Profils, führt Migrationen aus, lädt die Konfiguration und registriert jeden Controller.
3. Registriert das privilegierte Schema `bm://` und setzt Chromiums Schalter `lang` aus der gewählten Oberflächensprache (er steuert das Format nativer `<input type="date">`-Felder).
4. Nach `ready`: hängt Protokoll-Handler, IPC-Router und Fenster an und setzt den Fenstertitel mit Profilnamen.

Beim Schließen des Fensters sendet der Hauptprozess zuerst `before-close` an die Shell. Diese fragt (je nach Einstellung), ob der Zustand gespeichert werden soll, und gibt das Schließen über `window:closeNow` frei; ein zweiter Schließversuch erzwingt das Beenden.

`Container` ist die einzige Composition Root. Abhängigkeiten werden über Konstruktoren übergeben, nichts ist global.

## 5. IPC-Vertrag

```js
const data = await window.api.invoke('domain:action', payload);
```

Der Router antwortet mit `{ ok: true, data }` oder `{ ok: false, status, error, code }`; das Preload-Skript macht aus dem Fehler einen geworfenen `Error` mit `message` und `status`. Übliche Status: `400` ungültige Eingabe, `401` gesperrt, `403` verboten, `404` nicht gefunden, `409` Konflikt. Fehlermeldungen sind bereits in die aktuelle Sprache übersetzt.

**Anmeldeschranke.** Ist ein Passwort gesetzt, liefert jeder Kanal `401`, bis sich der Benutzer anmeldet, außer die Namen beginnen mit einem Präfix aus `app.json` → `ipc.openPrefixes` (`auth:`, `settings:get`, `config:get`, `i18n:bundle`, `i18n:languages`, `window:`).

**Datenkonventionen.**

| Art | Format |
|---|---|
| Datum | `YYYY-MM-DD` |
| Zeitstempel | `YYYY-MM-DD HH:MM:SS` (Uhrzeit in der gewählten Zeitzone, ohne Zonensuffix) |
| Uhrzeit | `HH:MM:SS` (`HH:MM` bei Trainings) |
| Zahlen | JSON-Zahlen |
| Wahrheitswerte | `true` / `false` |
| JSON-Spalten | als Objekte und Arrays geliefert |
| Kennungen | Zahlen |

### Kanäle der Gesundheitsdaten

Mit `?` markierte Parameter sind optional. Schreibende Kanäle liefern `null`, sofern nicht anders angegeben.

| Kanal | Payload | Ergebnis |
|---|---|---|
| `profile:get` | | `{height, age, trainings_count}` |
| `profile:overview` | | `{user, measurements, goals}` |
| `profile:updateParams` | `{height, age, trainings_count}` | aktualisiertes Profil (Größe und Alter positive ganze Zahlen, Trainings ganze Zahl ≥ 0) |
| `measurements:list` | | `[{date, weight, fat, water}]` nach Datum |
| `measurements:save` | `{date, weight, fat?, water?}` | Upsert nach Datum |
| `measurements:remove` | `{date}` | `404`, falls es fehlt |
| `measurements:getGoals` / `saveGoals` | `{weight_goal, fat_goal, deadline}` | Ziele (Nullwerte, wenn nicht gesetzt) |
| `sleep:listLogs` / `addLog` / `removeLog` | `{start_time, end_time}` / `{id}` | Schlafeinträge, neueste zuerst; `addLog` verlangt Ende nach Beginn |
| `sleep:getSchedule` / `saveSchedule` / `resetSchedule` | `{ideal_bedtime, ideal_waketime}` | idealer Schlafplan |
| `sleep:listNoSleep` / `addNoSleep` / `removeNoSleep` | `{date}` | Tage ohne Schlaf; `addNoSleep` scheitert mit `400`, wenn der Tag Einträge hat |
| `nutrition:list` / `add` / `remove` | `{date, name, weight, calories?, protein?, fat?, carbs?}` / `{id}` | Ernährungstagebuch; fehlende Makros werden 0 |
| `running:list` / `add` / `remove` | `{date, time_seconds, distance, calories?, start_speed?, max_speed?, incline?}` / `{id}` | Läufe |
| `running:getGoals` / `saveGoal` | `{goal_type: "distance"\|"time"\|"calories", target, deadline\|null}` | Laufziele |
| `workouts:list` / `create` / `update` / `remove` | `{date, start_time?, end_time?, type: "home"\|"gym", note?, exercises: [...≥1]}` | Trainings; `update` ersetzt die Übungen als Ganzes |
| `workouts:listTemplates` / `createTemplate` / `removeTemplate` | `{name, exercises: [{exercise_name, sets, reps}]}` | Vorlagen |
| `workouts:getGoals` / `saveGoals` | `{weekly_target, exercise_goals}` | Trainingsziele (Zielliste wird als Ganzes ersetzt) |
| `reaction:list` / `add` / `remove` | `{values: [Zahlen], average}` | Reaktionstests |
| `mood:list` / `save` / `remove` | `{date, time, mood, anxiety?, ..., comment?}` | Stimmungseinträge, einer je Datum |

### Systemkanäle

| Kanal | Zweck |
|---|---|
| `auth:status`, `setup`, `login`, `lock`, `change`, `remove` | Optionaler Passwortschutz |
| `settings:get`, `set`, `relaunch` | Einstellungen (`theme`, `autostart`, `language`, `timezone`, `menuLayout`, `menuCollapsed`) und Neustart |
| `config:get`, `errors`, `openFolder` | Konfiguration lesen (außer privaten), Probleme eigener Überschreibungen, Ordner öffnen |
| `configs:list`, `read`, `write`, `reset` | Konfigurationseditor: nur Abweichungen von den Standardwerten werden gespeichert, Änderungen wirken sofort |
| `modules:list`, `errors`, `rescan`, `openFolder`, `setHidden` | Modul-Registry |
| `modules:setPinned`, `reorderPinned`, `setCategory`, `categories`, `createCategory`, `removeCategory` | Anheften, Reihenfolge und Kategorien (Menü und Modul-Hub) |
| `modules:reorderPlugins` | Reihenfolge, in der Plugins angewendet werden |
| `storage:list`, `get`, `insert`, `update`, `remove`, `clear` | Dokumentenspeicher je Modul (die Shell ergänzt die Modul-id) |
| `shortcuts:list`, `set`, `reset` | Tastenkürzel: Registry der Aktionen, eigene Belegungen, Konflikterkennung |
| `notifications:schedule`, `cancel`, `list`, `setEnabled`, `modules` | Systembenachrichtigungen (Berechtigung `notifications`) |
| `trash:list`, `undo` | Papierkorb: die letzten Vorgänge und ihr Rückgängigmachen |
| `design:get`, `set`, `reset`, `groups`, `export`, `import`, `getCss`, `setCss`, `resetCss` | Designsystem (siehe [Design.md](Design.md)) |
| `session:get`, `setMode`, `save`, `load`, `clear` | Sitzungswiederherstellung: Modus `ask`, `always` oder `never` und gespeicherter Zustand |
| `workspace:list`, `create`, `rename`, `remove`, `switch` | Profile |
| `i18n:languages`, `bundle`, `master`, `export`, `openFolder`, `errors` | Sprachen und Wörterbücher |
| `clock:zones`, `now` | Zeitzonenliste und aktuelle Zeit in der gewählten Zone |
| `window:state`, `toggleFullscreen`, `close`, `closeNow` | Fenstersteuerung |
| `about:info`, `open` | Angaben zum Autor und Links aus einer Whitelist |
| `export:json`, `export:csv` | Alle Daten über einen Speichern-Dialog exportieren |

## 6. Datenschicht

**Migrationen.** Dateien `migrations/NNN_name.sql` werden der Reihe nach in einer Transaktion angewendet; die angewendete Version steht in `PRAGMA user_version`. Eine Schemaänderung ist eine neue Datei; angewendete Dateien werden nie bearbeitet.

**Repositories** erweitern `BaseRepository` und sind der einzige Code mit SQL. Controller validieren Eingaben, übersetzen Ergebnisse in das IPC-Format und setzen Geschäftsregeln um.

**Schema im Überblick.**

| Tabelle | Zweck |
|---|---|
| `settings` | Schlüssel-Wert-Speicher (JSON): `theme`, `autostart`, `language`, `timezone`, `modules.*`, `design.*`, `session.*`, `window.bounds`, `auth.*` |
| `profile`, `weight_goals`, `running_goals`, `training_goals`, `sleep_schedule` | Tabellen mit einer Zeile (`id = 1`) |
| `measurements`, `sleep_logs`, `no_sleep_days`, `nutrition_logs`, `running_logs`, `workouts`, `workout_exercises`, `workout_templates`, `template_exercises`, `exercise_goals`, `reaction_tests`, `mood_entries` | Gesundheitsdaten |
| `module_documents` | JSON-Dokumente der Benutzermodule nach `module_id` und `collection` |
| `notifications` | Geplante Systembenachrichtigungen |
| `operations`, `operation_entries` | Protokoll der letzten Vorgänge für den Papierkorb |

**Zeitstempel.** Tabellen mit Erstellungszeitpunkt werden von `AFTER INSERT`-Triggern (Migration `003`) gestempelt, die die SQLite-Funktion `bm_now()` aufrufen. Die Anwendung registriert sie bei jeder Verbindung und implementiert sie mit `ClockService`; jedes `created_at` entsteht also in der gewählten Zeitzone. Die Funktion darf die Datenbank nicht abfragen, weil SQLite verschachtelte Abfragen aus benutzerdefinierten Funktionen verbietet; die gewählte Zone steht deshalb im Speicher.

**Papierkorb.** `OperationLog` legt beim Start (idempotent) Trigger auf allen Datentabellen an, die Zeilenabbilder vor und nach einer Änderung festhalten. `IpcRouter` öffnet je Kanalaufruf einen Vorgang und behält ihn nur, wenn er Zeilen berührt hat; gespeichert werden die letzten zehn. Rückgängig machen geht nur, wenn die Zeilen seither unverändert sind (sonst `409`) und läuft in einer Transaktion mit aufgeschobenen Fremdschlüsselprüfungen. Bezeichnungen der Vorgänge stehen in `config/operations.json`.

**Export.** `export:json` schreibt jede Tabelle (ohne `auth.*`-Einstellungen), `export:csv` je eine CSV-Datei pro nichtleerer Tabelle.

## 7. Konfiguration

Alle Konstanten liegen in `config/*.json`.

| Datei | Inhalt |
|---|---|
| `app.json` | Fenster, Protokoll, Startseite, Datenbankdatei, Einstellungsstandards, Modulregeln und Kategorien, private Konfigurationen, Speichergrenzen, Authentifizierung, IPC, Tastenkürzel, portabler Modus, Sprachregister, Zeitzonen-Aliase, Profile, Konfigurationseditor, Schriften |
| `themes.json` | Themes: CSS-Variablen, Diagrammfarben, Anzeigetitel oder Titelschlüssel |
| `design.json` | Design-Tokens: jeder visuelle Wert der Oberfläche (siehe [Design.md](Design.md)) |
| `session.json` | Sitzungswiederherstellung: Standardmodus, Zeitlimits, Größenlimits |
| `operations.json` | Bezeichnungen der Vorgänge im Papierkorb |
| `charts.json` | Reihenfarben der Diagramme je Modul |
| `health.json` | Standardwerte des Profils (nur beim ersten Start) |
| `achievements.json` | Lauferfolge (`nameKey`, `descriptionKey`, `required`) |
| `kbju.json`, `nutrition.json`, `reaction.json`, `running.json`, `sleep.json`, `training.json`, `weight.json` | Konstanten des jeweiligen Moduls |

**Überschreibungen.** Dateien gleichen Namens in `userData/config` werden über die Basisdatei gelegt: Objekte rekursiv zusammengeführt, Arrays und Skalare ersetzt. Ein neuer Dateiname wird zu einer neuen Konfiguration. Eine Datei mit JSON-Fehler wird übersprungen, der Grund steht in den Einstellungen. Der Konfigurationseditor schreibt diese Dateien selbst (nur Abweichungen) und lädt die Konfiguration neu; Änderungen wirken sofort, mit Ausnahme der Konfigurationen, die nur beim Start gelesen werden (`app`).

**Zugriff.** `config:get` liefert jede Konfiguration außer denen in `app.json` → `privateConfigs` (derzeit `app`). Module lesen Konfigurationen über `bm.config(name)`.

**Themes** prüft `ThemeCatalog` (13 Pflicht-CSS-Variablen, `colorScheme`, Titel, Diagrammfarben); ein ungültiges Theme wird übersprungen und gemeldet.

## 8. Authentifizierung

Der Schutz ist optional. Ist er aktiv, liegen Login und Passwort in `settings` (`auth.login`, `auth.salt`, `auth.hash`); der Hash entsteht mit scrypt und wird zeitkonstant verglichen. Der entsperrte Zustand lebt nur im Speicher und verfällt beim Sperren oder Neustart. Diese Schlüssel werden nie exportiert.

## 9. Shell und Umgebung

- **Navigation.** Die Kopfzeile zeigt die angehefteten Module (wie viele hineinpassen, errechnet sich aus Fensterbreite und Titellängen; der Rest verschwindet hinter „Mehr“) und die Einstellungen. Alle Module liegen im **Modul-Hub** (`#hub`): Karten mit Suche, Kategorien, Anheften, Ausblenden und eigenen Kategorien. Alternativ gibt es ein Seitenleisten-Layout mit einklappbaren Kategorien (`menuLayout`). Ausblenden entfernt ein Modul nur aus dem Menü; seine Daten bleiben.
- **Befehlspalette.** `Strg+P` (`Cmd+P` unter macOS) öffnet einen Schnellwechsler mit unscharfer Suche über Module und Einstellungen. Befehle kommen von Providern.
- **Tastenkürzel** werden im Hauptprozess über `before-input-event` abgefangen und funktionieren daher auch bei Fokus in einem Modul-iframe. Sie sind an physische Tasten gebunden (`KeyP`, `F11`), also unabhängig vom Tastaturlayout. Aktionen (`fullscreen`, `quickSwitch`, `moduleHub`) stehen in einer Registry, Standardbelegungen in `app.json` → `shortcuts`, eigene Belegungen in den Einstellungen.
- **Vollbild.** `F11` schaltet es um; im Vollbild zeigt die Shell Knöpfe zum Verlassen und zum Schließen.
- **Start.** Das Fenster öffnet sich mit dunklem Hintergrund und Ladebildschirm; der portable Windows-Build zeigt beim Entpacken `build/splash.bmp`.
- **Sitzung.** Beim Beenden kann der Zustand gespeichert werden (geöffnetes Modul, Feldwerte, Scrollpositionen) und beim nächsten Start wiederhergestellt werden.
- **Benachrichtigungen.** `NotificationService` hält Zeitpläne in der Datenbank, plant einen Timer auf den nächsten Zeitpunkt, zeigt sie über Electron `Notification` und gruppiert verpasste beim Start.
- **Autorenangaben.** Autorenname und die drei Links im Bereich „Über“ der Einstellungen sind Konstanten in `src/main/core/Attribution.js`. Sie sind absichtlich nicht konfigurierbar; externe Links öffnen sich nur aus dieser Whitelist. Die Projektlizenz verlangt sie, sie müssen erhalten bleiben.

## 10. Lokalisierung

Texte liegen in Wörterbüchern `locales/<code>.json` in den Bereichen `shell`, `shared`, `backend` und je Modul. `LocaleService` baut aus ihnen über eine Fallback-Kette den Satz einer Sprache; Module lesen ihn per `bm.t(key, params)`, der Hauptprozess über `MessageService`. Integriert sind Russisch, Englisch, Spanisch und Deutsch; eigene Sprachen entstehen aus einer exportierten Vorlage als Datei in `userData/locales`. Das Register steht in `config/app.json` → `i18n`, das Werkzeug `npm run i18n` zeigt den Stand und legt neue Sprachen an. Einzelheiten: [Localization.md](Localization.md).

## 11. Zeitzonen

Die Einstellung `timezone` ist `system` oder ein IANA-Name. `ClockService` formatiert den aktuellen Zeitpunkt in dieser Zone; ihn nutzen die Datenbankfunktion `bm_now()` und die Kanäle `clock:*`. In Modulen liefert `bm.clock` mit `now()`, `today()` und `timestamp()` dieselbe Zone. Zonennamen nutzen moderne Schreibweisen (etwa `Asia/Kolkata`, `Europe/Kyiv`) über die Aliase in `app.json` → `timezones.aliases`.

## 12. Designsystem

Nichts Visuelles ist fest verdrahtet: Jeder Stilwert ist ein Token in `config/design.json`, das `DesignService` in `bm://app/shared/design.css` erzeugt. Der Benutzer kann Tokens überschreiben und eigenes CSS ergänzen, für die ganze Anwendung oder je Modul. Siehe [Design.md](Design.md).

## 13. Profile

Ein Profil ist ein unabhängiger Datenraum: eine eigene SQLite-Datei samt Einstellungen und Passwortschutz. Module, Konfigurationen und Sprachen sind gemeinsam. `WorkspaceRegistry` verwaltet `profiles.json`: Das Hauptprofil (`default`) zeigt auf die bisherige Datenbank, weitere heißen `profile-<id>.sqlite`. Profile lassen sich erstellen, duplizieren (die laufende Datenbank wird per SQLite-Backup kopiert), umbenennen und löschen (nicht das laufende und nicht das für den nächsten Start gewählte); das Wechseln speichert die Wahl und startet die Anwendung neu. Namen sind beliebig.

## 14. Build und Paketierung

```
npm install        installiert Abhängigkeiten und baut native Module für Electron neu
npm start          bereitet Assets vor und startet die App
npm run dist       bereitet Assets vor und baut für das aktuelle Betriebssystem
```

`scripts/prepare.js` kopiert `chart.min.js` und die benötigten Schriftdateien (Zeichensätze aus `app.json` → `fonts.subsets`) aus `node_modules` nach `src/renderer/vendor` und erzeugt `fonts.css`; das Skript ist idempotent und läuft vor `start` und `dist`.

Ziele von electron-builder (`package.json` → `build`):

| System | Ziele | Hinweise |
|---|---|---|
| Windows | `portable`, `zip` | Portable Einzeldatei mit Splash-Bild und ein entpacktes Archiv, das ohne Entpacken startet |
| Linux | `AppImage` | Zum Ausführen ist `libfuse2` nötig |
| macOS | `zip` | Nicht signiert und nicht notarisiert |

`better-sqlite3` ist ein natives Modul, jede Plattform muss also auf dieser Plattform (oder einem passenden CI-Runner) gebaut werden. `.github/workflows/release.yml` baut Windows, Linux und macOS (Apple Silicon und Intel) und erstellt einen Release-Entwurf, wenn ein Tag `v*` gepusht wird.

## 15. Konventionen

- Eine Klasse je Datei; der Dateiname entspricht dem Klassennamen.
- Keine Kommentare im Code; Namen und Struktur tragen die Bedeutung.
- Es gibt keinen Hardcode: Konstanten, Schwellen und Farben gehören in JSON-Konfigurationen und Design-Tokens, Texte in Wörterbücher.
- SQL nur in Repositories; Validierung und Geschäftsregeln in Controllern.
- Der Renderer greift nie direkt auf Datenbank oder Dateisystem zu; alles läuft über Kanäle.
- Jeder Modulordner hat eine `README.md` mit Zweck, Kanälen, Konfigurationen, Dateien und Verhalten.
