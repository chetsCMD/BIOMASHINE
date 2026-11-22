# BIOMASHINE: Design System

Nothing visual is hard-coded in BIOMASHINE. Every color, size, spacing, radius, border width, shadow, duration, layer and breakpoint is a **design token** defined in one place, and style sheets only refer to tokens. Changing the whole look of the program means editing one file or using the Design block in Settings.

## 1. Tokens

All tokens live in `config/design.json`:

```json
{ "tokens": { "space-12px": "12px", "font-mono": "'JetBrains Mono', monospace", "color-8bc34a": "#8bc34a" } }
```

Names follow the value they hold (`space-12px`, `duration-200ms`, `radius-8px`), so a token acts as a step of a scale: changing `space-12px` changes every place that uses that step. Groups are the part of the name before the first number (`space`, `size`, `font-size`, `radius`, `border`, `duration`, `color`, `shadow`, `easing`, `z`, `breakpoint`, ...). Module palettes are prefixed with the module id (`sleep-good`, `nutrition-macro-protein`). Theme colors (`--bg`, `--s1`, `--t`, ...) stay in `themes.json` because they differ per theme.

## 2. The rule

A style sheet of the project may contain only `var(--token)` and structural values (`0`, `auto`, `100%`, `50%`, `fr` units, keywords). A literal color, length, duration, shadow, font stack or layer is a violation. Style sheets must not declare custom properties either, with one exception: an alias made only of `var()` references.

Breakpoints cannot be variables in media queries, so a media query uses a placeholder, `@media (max-width: $breakpoint-900px)`, which is replaced with the token value when the file is served.

In JavaScript, `element.style.<property>` must not be assigned a literal visual value. Use a CSS class, a token reference (`'var(--space-8px)'`) or `style.setProperty('--name', value)` for values computed at run time.

## 3. Delivery

`DesignService` merges tokens in this order: `config/design.json`, user config `userData/config/design.json`, global overrides (Settings), module overrides. It serves a generated style sheet at `bm://app/shared/design.css`, which `base.css` imports, so every page has its variables on load with no flash. At run time the shell and each module also receive their overrides and custom CSS through the bridge.

Final cascade, from lowest to highest priority: tokens, theme variables, plugins (in the user's order), user token overrides, user custom CSS.

## 4. The tool

```
npm run design -- audit            list every hard-coded visual value (exit code 1 if any)
npm run design -- migrate [files]  dry run: show what would become tokens
npm run design -- migrate --write  rewrite style sheets and update config/design.json
npm run design -- verify [ref]     expand tokens back and compare with a git revision: proves nothing changed visually
npm run design -- tokens [prefix]  print tokens
```

The project test suite runs the same audit over every style sheet (including modules), checks that every `var(--x)` is defined and that no JavaScript assigns literal visual values to `style`.

## 5. Customizing

Settings, Design block:

- **Tokens.** Pick a scope (the whole application or one module), search a token, change its value (a color picker appears for `#rrggbb` values). Changes preview live and are saved immediately. Reset a token, a scope, export or import the whole design as JSON.
- **Custom CSS.** Free CSS for the whole application or for one module. It is applied last, so it can restyle anything. External `@import` is not allowed because the application is offline.
- **Plugins.** Plugins are listed in Appearance in the order they are applied; use the arrows to change it.

Overrides are stored in the settings table (`design.overrides`, `design.moduleOverrides`, `design.customCss`, `design.moduleCss`) and are part of the data export. A file `userData/config/design.json` with a `tokens` object overrides base tokens for all users of the installation without touching the project.

## 6. Channels

| Channel | Purpose |
|---|---|
| `design:get {module?}` | Base tokens, the scope's overrides, effective overrides and merged tokens |
| `design:set {module?, tokens}` | Save overrides (names `^[a-z][a-z0-9-]*$`, values up to 300 characters without `;`, `{`, `}`) |
| `design:reset {module?, names?}` | Remove some or all overrides of a scope |
| `design:groups` | Base tokens grouped for the editor |
| `design:export`, `design:import {data}` | Whole design as `{version, overrides, moduleOverrides, customCss, moduleCss}` |
| `design:getCss`, `design:setCss`, `design:resetCss` | Custom CSS of a scope (up to 50000 characters) |
| `modules:reorderPlugins {ids}` | Order in which plugins are applied |
