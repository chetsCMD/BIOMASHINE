# BIOMASHINE: Designsystem

In BIOMASHINE ist nichts Visuelles fest im Code verankert. Jede Farbe, Größe, jeder Abstand, Radius, jede Rahmenbreite, jeder Schatten, jede Dauer, Ebene und jeder Breakpoint ist ein **Design-Token**, das an genau einer Stelle definiert ist; Stylesheets verweisen nur auf Tokens. Das gesamte Aussehen des Programms zu ändern bedeutet, eine Datei zu bearbeiten oder den Bereich „Design“ in den Einstellungen zu nutzen.

## 1. Tokens

Alle Tokens liegen in `config/design.json`:

```json
{ "tokens": { "space-12px": "12px", "font-mono": "'JetBrains Mono', monospace", "color-8bc34a": "#8bc34a" } }
```

Die Namen folgen dem Wert, den sie enthalten (`space-12px`, `duration-200ms`, `radius-8px`), ein Token ist also eine Stufe einer Skala: Wer `space-12px` ändert, ändert jede Stelle, die diese Stufe nutzt. Die Gruppe ist der Namensteil vor der ersten Zahl (`space`, `size`, `font-size`, `radius`, `border`, `duration`, `color`, `shadow`, `easing`, `z`, `breakpoint`, ...). Paletten der Module tragen die Modul-id als Präfix (`sleep-good`, `nutrition-macro-protein`). Theme-Farben (`--bg`, `--s1`, `--t`, ...) bleiben in `themes.json`, weil sie sich je Theme unterscheiden.

## 2. Die Regel

Ein Stylesheet des Projekts darf nur `var(--token)` und strukturelle Werte enthalten (`0`, `auto`, `100%`, `50%`, `fr`-Einheiten, Schlüsselwörter). Ein Farb-, Längen-, Dauer-, Schatten-, Schrift- oder Ebenenliteral ist ein Verstoß. Stylesheets dürfen auch keine Custom Properties deklarieren, mit einer Ausnahme: einem Alias, der nur aus `var()`-Verweisen besteht.

In Media-Queries können Breakpoints keine Variablen sein. Dort steht ein Platzhalter, `@media (max-width: $breakpoint-900px)`, der beim Ausliefern der Datei durch den Tokenwert ersetzt wird.

In JavaScript darf `element.style.<eigenschaft>` kein Literal mit visuellem Wert zugewiesen werden. Nutze eine CSS-Klasse, einen Token-Verweis (`'var(--space-8px)'`) oder `style.setProperty('--name', wert)` für zur Laufzeit berechnete Werte.

## 3. Auslieferung

`DesignService` führt die Tokens in dieser Reihenfolge zusammen: `config/design.json`, die Benutzerkonfiguration `userData/config/design.json`, globale Überschreibungen (Einstellungen), Überschreibungen je Modul. Daraus entsteht ein Stylesheet unter `bm://app/shared/design.css`, das `base.css` importiert, sodass jede Seite ihre Variablen beim Laden ohne Aufblitzen hat. Zur Laufzeit erhalten Shell und jedes Modul ihre Überschreibungen und ihr eigenes CSS außerdem über die Bridge.

Die endgültige Kaskade, von niedriger zu hoher Priorität: Tokens, Theme-Variablen, Plugins (in der vom Benutzer festgelegten Reihenfolge), Token-Überschreibungen des Benutzers, eigenes CSS des Benutzers.

## 4. Das Werkzeug

```
npm run design -- audit            jeden fest verdrahteten visuellen Wert auflisten (Exitcode 1 bei Funden)
npm run design -- migrate [dateien]  Trockenlauf: zeigen, was zu Tokens würde
npm run design -- migrate --write  Stylesheets umschreiben und config/design.json aktualisieren
npm run design -- verify [ref]     Tokens zurückexpandieren und mit einer Git-Revision vergleichen: beweist, dass sich visuell nichts geändert hat
npm run design -- tokens [präfix]  Tokens ausgeben
```

Die Testsuite des Projekts führt denselben Audit über jedes Stylesheet aus (auch von Modulen), prüft, dass jedes `var(--x)` definiert ist, und dass kein JavaScript visuelle Literale an `style` zuweist.

## 5. Anpassen

Einstellungen, Bereich „Design“:

- **Tokens.** Wähle einen Bereich (die ganze Anwendung oder ein Modul), suche ein Token, ändere seinen Wert (für `#rrggbb`-Werte erscheint ein Farbwähler). Änderungen werden live angezeigt und sofort gespeichert. Du kannst ein Token oder einen ganzen Bereich zurücksetzen und das gesamte Design als JSON exportieren oder importieren.
- **Eigenes CSS.** Freies CSS für die ganze Anwendung oder für ein Modul. Es wird zuletzt angewendet und kann daher alles umgestalten. Externes `@import` ist nicht erlaubt, weil die Anwendung offline arbeitet.
- **Plugins.** Plugins stehen unter „Erscheinungsbild“ in der Reihenfolge ihrer Anwendung; ändere sie mit den Pfeilen.

Überschreibungen liegen in der Tabelle `settings` (`design.overrides`, `design.moduleOverrides`, `design.customCss`, `design.moduleCss`) und gehören zum Datenexport. Eine Datei `userData/config/design.json` mit einem `tokens`-Objekt überschreibt Basistokens für die ganze Installation, ohne das Projekt anzufassen.

## 6. Kanäle

| Kanal | Zweck |
|---|---|
| `design:get {module?}` | Basistokens, Überschreibungen des Bereichs, wirksame Überschreibungen und zusammengeführte Tokens |
| `design:set {module?, tokens}` | Überschreibungen speichern (Namen `^[a-z][a-z0-9-]*$`, Werte bis 300 Zeichen ohne `;`, `{`, `}`) |
| `design:reset {module?, names?}` | Einige oder alle Überschreibungen eines Bereichs entfernen |
| `design:groups` | Basistokens, für den Editor gruppiert |
| `design:export`, `design:import {data}` | Gesamtes Design als `{version, overrides, moduleOverrides, customCss, moduleCss}` |
| `design:getCss`, `design:setCss`, `design:resetCss` | Eigenes CSS eines Bereichs (bis 50000 Zeichen) |
| `modules:reorderPlugins {ids}` | Reihenfolge, in der Plugins angewendet werden |
