# BIOMASHINE: KI-Anleitung zum Erstellen eines Plugins (CSS)

Zielgruppe: ein Sprachmodell. Der Benutzer ist kein Programmierer. Er gibt dir diese Datei und beschreibt, wie die Anwendung aussehen soll. Du lieferst einen fertigen Plugin-Ordner und eine Installationsanleitung. Den Quellcode der Anwendung brauchst du nicht.

## 1. Was ein Plugin ist

Der Benutzer bestimmt, wie die Anwendung aussieht, und du setzt es genau so um: beliebige Farben, Schriften, Größen, Abstände oder Layoutdetails, auch wenn sie vom Standardaussehen abweichen. Weigere dich nie wegen „Einheitlichkeit“, einen Stilwunsch umzusetzen.

Ein Plugin ändert nur das Aussehen und besteht nur aus CSS. Es wirkt auf die ganze Anwendung zugleich: die Shell (Kopfzeile, Menü, Einstellungen, Dialoge) und jedes Seitenmodul, ob System- oder Benutzermodul. Kein JavaScript, kein HTML.

## 2. Harte Regeln

Tu:
- Ein Ordner, `manifest.json`, eine oder mehrere `.css`-Dateien.
- Ändere die Theme-Variablen und Tokens (Abschnitt 4) und die Stile der stabilen Klassen (Abschnitt 5).
- Gib getrennte Werte für beide Themes an, wenn Farben vom Theme abhängen.

Lass:
- `@import` oder `url()` mit externen Adressen verwenden. Es gibt kein Netzwerk.
- JavaScript, `<script>` oder `expression()` verwenden.
- Die internen Klassen von Systemmodulen gestalten: Sie können sich ändern. Erlaubt sind nur die Klassen aus Abschnitt 5.
- `!important` ohne Not schreiben.

## 3. Struktur und manifest.json

    <id>/
      manifest.json
      style.css

```json
{
  "id": "my-look",
  "kind": "plugin",
  "title": "My look",
  "version": "1.0.0",
  "description": "Was das Plugin macht",
  "css": ["style.css"]
}
```

| Feld | Regel |
|---|---|
| `id` | `^[a-z][a-z0-9-]*$`, gleich dem Ordnernamen, nicht `app`, `shell` oder `shared`, eindeutig |
| `kind` | immer `"plugin"` |
| `title` | Name in der Einstellungsliste |
| `css` | Array von CSS-Pfaden im Ordner, mindestens einer, kein `..` |

## 4. Theme-Variablen und Tokens

Überschreibe sie in `:root`. Das Plugin wird nach den Theme-Styles geladen, seine Werte gewinnen also bei gleicher Spezifität.

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

Werte je Theme: `:root[data-theme="dark"] { ... }` und `:root[data-theme="light"] { ... }`. Unterstütze beide Themes oder setze Werte für beide.

Neben den Theme-Variablen ist jeder Gestaltungswert der Anwendung ein Token wie `--space-12px`, `--radius-8px` oder `--duration-200ms` (die vollständige Liste steht in `config/design.json`). Ein Plugin kann jedes davon in `:root` überschreiben. Plugins werden in der Reihenfolge angewendet, die der Benutzer unter „Einstellungen“, „Erscheinungsbild“ festlegt; die eigenen Token-Überschreibungen und das eigene CSS des Benutzers gelten nach allen Plugins.

## 5. Stabile Selektoren

| Selektor | Was es ist |
|---|---|
| `.bm-page`, `.bm-title`, `.bm-card`, `.bm-row`, `.bm-spacer`, `.bm-muted`, `.bm-label`, `.bm-input`, `.bm-btn`, `.bm-list`, `.bm-list-item`, `.bm-empty`, `.bm-stats`, `.bm-stat`, `.bm-stat-label`, `.bm-stat-value`, `.bm-chart` | Das UI-Kit der Module |
| `.shell-header`, `.logo`, `.nav`, `.nav-link`, `.nav-link.active`, `.header-pill`, `.logout-btn` | Kopfzeile und Menü |
| `.dialog`, `.dialog-btn`, `.dialog-btn.secondary`, `.dialog-btn.danger` | Dialoge und Schaltflächen der Shell |
| `.settings-card`, `.settings-row`, `.settings-label`, `.settings-name`, `.settings-hint`, `.settings-status` | Der Einstellungsbildschirm. Eingaben und Auswahllisten dort haben die Klasse `.bm-input` |
| `.palette`, `.palette-input`, `.palette-item`, `.palette-hint` | Der Schnellwechsler `Strg+P` |

Schriften: `JetBrains Mono` (Text), `Playfair Display` (große Zahlen). Für eine eigene Schrift legst du eine `.woff2`-Datei in den Plugin-Ordner und lädst sie mit `@font-face { font-family: 'X'; src: url(./X.woff2) format('woff2'); }`.

## 6. Spezifität prüfen

Greift eine Plugin-Regel nicht, hat eine Systemregel höhere Spezifität. Verstärke den Selektor (`:root .bm-card`) und füge nur als letzten Ausweg `!important` hinzu.

## 7. Beispiel

`rounded/manifest.json`

```json
{
  "id": "rounded",
  "kind": "plugin",
  "title": "Rounded corners",
  "version": "1.0.0",
  "description": "Rounds cards, buttons, and input fields",
  "css": ["style.css"]
}
```

`rounded/style.css`

```css
.bm-card,
.bm-stat,
.bm-btn,
.bm-input,
.panel-card,
.dialog,
.dialog-btn,
.nav-link {
  border-radius: 10px;
}
:root {
  --br: #3a3a3a;
}
:root[data-theme="light"] {
  --br: #bdbdb8;
}
```


## 8. Installationsanleitung (dem Benutzer geben)

1. Öffne die App, gehe zu **Einstellungen**, suche den Bereich **Module** und klicke auf **Modulordner öffnen**.
2. Kopiere den ganzen Plugin-Ordner in den geöffneten Ordner. Am Ende muss `.../modules/<id>/manifest.json` existieren.
3. Klicke in den Einstellungen auf **Neu einlesen**. Das Plugin erscheint im Bereich **Erscheinungsbild**, neben der Theme-Auswahl. Die Shell ändert sich sofort; bereits geöffnete Seiten übernehmen die Stile beim nächsten Öffnen.
4. Zum Abschalten entfernst du das Häkchen im Bereich **Erscheinungsbild**. Zum Entfernen löschst du den Ordner und klickst auf **Neu einlesen**.
5. Erscheint das Plugin nicht, steht der Grund in Rot unter der Modulliste. Schicke ihn mir.

## 9. Checkliste vor der Abgabe

- `kind` ist `"plugin"`, `css` ist nicht leer, die Pfade enthalten kein `..`.
- Keine externen Adressen, kein `@import`, kein JavaScript.
- Farben sind für beide Themes gesetzt.
- Es werden nur Selektoren aus Abschnitt 5 verwendet.
- Jede Datei ist vollständig geliefert, und die Installationsanleitung enthält die echte `<id>`.
