# BIOMASHINE: Lokalisierung

Dieses Dokument beschreibt, wie Sprachen in BIOMASHINE funktionieren und wie man eine neue hinzufügt. Eine Sprache hinzuzufügen heißt, Wörterbuchdateien zu übersetzen; im Code ändert sich nichts.

## 1. Das Sprachregister

Die einzige Quelle der Wahrheit ist `config/app.json` → `i18n`:

| Feld | Bedeutung |
|---|---|
| `builtin` | Liste der integrierten Sprachen: `code`, `name` (Eigenbezeichnung), `locale` (BCP 47, etwa `de-DE`), optional `fallback` |
| `default` | Sprache, die gewählt wird, wenn die Systemsprache nicht passt (`en`) |
| `reference` | Sprache, deren Schlüsselmenge maßgeblich ist (`ru`) |
| `source` | Sprache, aus der Vorlagen neuer Sprachen erzeugt werden (`en`) |
| `required` | Sprachen, deren Wörterbücher jedes Modul mitbringen muss (`ru`, `en`) |
| `codePattern`, `pluralForms` | Zulässiges Format des Sprachcodes und die erlaubten Pluralkategorien |

Integriert sind Russisch, Englisch, Spanisch und Deutsch. Eigene Sprachen legt der Benutzer ohne Eingriff in den Code an (Abschnitt 5).

## 2. Wörterbücher und Bereiche

Ein Wörterbuch ist eine flache JSON-Datei `locales/<code>.json`: Schlüssel auf Zeichenkette oder auf ein Objekt mit Pluralformen. Es gibt vier Arten von Bereichen:

| Bereich | Ort | Inhalt |
|---|---|---|
| `shell` | `src/renderer/shell/locales` | Oberfläche der Shell und der Einstellungen |
| `shared` | `src/renderer/shared/locales` | Einheiten, gemeinsame Schaltflächen, Titel von Themes und Erfolgen |
| `backend` | `src/main/locales` | Meldungen des Hauptprozesses (Fehler, Hinweise) |
| Modul `<id>` | `<Modulordner>/locales` | Texte eines Moduls (Manifest-Feld `"i18n": true`) |

Zur Laufzeit baut `LocaleService` den Satz einer Sprache aus einer Fallback-Kette: gewählte Sprache, dann das `fallback` der Sprache, dann Englisch, dann Russisch; der Bereich `shared` liegt unter jedem Bereich. Fehlt ein Schlüssel, wird er aus der nächsten Sprache der Kette ergänzt.

## 3. Nachrichten des Hauptprozesses

Der Hauptprozess enthält keine Texte im Code. Fehler werden als `AppError(schlüssel, parameter, status)` ausgelöst (`AppError.badRequest('auth.passwordTooShort', { min })`); `MessageService` übersetzt den Schlüssel mit dem Bereich `backend` in der aktuellen Sprache, auch wenn sie sich zur Laufzeit ändert. Dienste, die Probleme sammeln (Konfigurationen, Module, Themes, Sprachdateien), speichern strukturierte Objekte (`file` oder `dir`, `key`, `params`); die Controller übersetzen sie erst beim Antworten, weil beim Sammeln die Sprache noch nicht feststehen muss. Der Test „kein Russisch in `src/main`“ verhindert, dass Text in den Code zurückkehrt.

## 4. Pluralformen und Platzhalter

Ein Wert kann ein Objekt mit den Formen `zero`, `one`, `two`, `few`, `many`, `other` sein (`other` ist Pflicht). Die Form wird mit `Intl.PluralRules` aus dem Parameter `count` gewählt. Eine Sprache braucht genau die Kategorien, die `Intl.PluralRules(locale).resolvedOptions().pluralCategories` liefert: Deutsch und Englisch `one`, `other`; Russisch `one`, `few`, `many`, `other`; Spanisch je nach ICU-Version `one`, `many`, `other`. Platzhalter stehen in der Form `{name}` und müssen in jeder Sprache und jeder Pluralform dieselben sein.

## 5. Eigene Sprachen

Einstellungen → Sprache exportiert eine Vorlage mit allen Bereichen. Die übersetzte Datei kommt als `userData/locales/<code>.json` in den Sprachordner:

```json
{
  "meta": { "code": "nl", "name": "Nederlands", "locale": "nl-NL", "fallback": "en" },
  "scopes": { "shell": { "nav.settings": "Instellingen" }, "shared": {}, "kbju": {} }
}
```

Eine Datei mit dem Code einer integrierten Sprache ändert deren Texte, statt eine Sprache hinzuzufügen. Fehlende Schlüssel kommen aus der Fallback-Kette; Probleme (ungültiges JSON, fehlendes `meta`, fehlerhafte Pluralobjekte) werden in den Einstellungen aufgelistet.

## 6. Das Werkzeug `npm run i18n`

```
npm run i18n -- status [--source en] [--json]    Tabelle Bereich × Sprache: Pfad, Anzahl der Schlüssel, fehlende, überzählige, unübersetzte Werte, Prozent
npm run i18n -- files <code> [--missing]         alle Wörterbuchdateien einer Sprache (vorhandene und zu erstellende)
npm run i18n -- add <code> "<Name>" <locale>     Sprache registrieren und Skelettdateien in allen Bereichen anlegen (Werte der Quellsprache)
npm run i18n -- check [code] [--allow-missing]   Platzhalter, Pluralformen nach Intl.PluralRules, leere Zeichenketten, fehlende und überzählige Schlüssel prüfen
```

`files <code>` beantwortet die Frage, in welchen Dateien übersetzt werden muss. `check` gibt bei Problemen den Exitcode 1 zurück.

## 7. Eine integrierte Sprache hinzufügen

1. `npm run i18n -- add <code> "<Name>" <locale>` legt die Skelettdateien an und trägt die Sprache in `i18n.builtin` ein.
2. `npm run i18n -- files <code>` listet die Dateien auf. Übersetze die Werte; Schlüssel, `{platzhalter}` und die Pluralformen der Sprache bleiben unverändert. Der Ton des russischen Originals (locker, stellenweise bissig), Emojis und Großschreibung (KAPS-Schaltflächen) bleiben erhalten.
3. Übersetze die Dokumentation (`docs/<code>`) und die README.
4. `npm run i18n -- check <code>` muss ohne Fehler enden, `status` zeigt 100 %.
5. Schriften: `config/app.json` → `fonts.subsets` bestimmt die mitgelieferten Zeichensätze (`latin`, `latin-ext`, `cyrillic`; `greek` und `vietnamese` lassen sich ergänzen). Für Schriften ohne eingebettete Schrift (Chinesisch, Japanisch, Koreanisch, Arabisch, Hebräisch, Thai, Devanagari) greifen die Systemschriften der Fallback-Kette.
6. Die Sortierung (`Intl.Collator`) und das Datumsformat in Eingabefeldern folgen der Sprache; nach einem Sprachwechsel bietet die Anwendung einen Neustart an, damit Chromium das Datumsformat übernimmt.
7. Im Anwendungsfenster prüfen: Zeilenlängen im Menü, Schriften, Datumsformat.

## 8. Checkliste für ein Release mit neuer Sprache

- `npm run i18n -- check` ist für alle Sprachen grün, `status` zeigt für die neue Sprache 100 %.
- README und Dokumentation liegen in der neuen Sprache vor, die Sprachliste ist aktualisiert.
- Die Sprache ist in den Release-Notizen erwähnt.
