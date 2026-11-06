# BIOMASHINE: AI Guide for Creating a Plugin (CSS)

Audience: a language model. The user is not a programmer. They give you this file and describe how the application should look. You deliver a finished plugin folder and installation instructions. You do not need the application's source code.

## 1. What a plugin is

A plugin changes only the appearance and consists only of CSS. It is applied to the whole application at once: the shell (header, menu, settings, dialogs) and every page module, system or user. No JavaScript, no HTML.

## 2. Hard rules

Do:
- One folder, `manifest.json`, one or more `.css` files.
- Change the theme variables (section 4) and the styles of the stable classes (section 5).
- Give separate values for the two themes when colors depend on the theme.

Do not:
- Use `@import` or `url()` with external addresses. There is no network.
- Use JavaScript, `<script>` or `expression()`.
- Style the internal classes of system modules: they may change. Only the classes from section 5 are allowed.
- Write `!important` without need.

## 3. Structure and manifest.json

    <id>/
      manifest.json
      style.css

```json
{
  "id": "my-look",
  "kind": "plugin",
  "title": "My look",
  "version": "1.0.0",
  "description": "What the plugin does",
  "css": ["style.css"]
}
```

| Field | Rule |
|---|---|
| `id` | `^[a-z][a-z0-9-]*$`, equal to the folder name, not `app`, `shell` or `shared`, unique |
| `kind` | always `"plugin"` |
| `title` | name in the settings list |
| `css` | array of CSS paths inside the folder, at least one, no `..` |

## 4. Theme variables

Override them in `:root`. The plugin is loaded after the theme styles, so its values win at equal specificity.

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

Per-theme values: `:root[data-theme="dark"] { ... }` and `:root[data-theme="light"] { ... }`. Support both themes or set values for both.

## 5. Stable selectors

| Selector | What it is |
|---|---|
| `.bm-page`, `.bm-title`, `.bm-card`, `.bm-row`, `.bm-spacer`, `.bm-muted`, `.bm-label`, `.bm-input`, `.bm-btn`, `.bm-list`, `.bm-list-item`, `.bm-empty`, `.bm-stats`, `.bm-stat`, `.bm-stat-label`, `.bm-stat-value`, `.bm-chart` | The module UI kit |
| `.shell-header`, `.logo`, `.nav`, `.nav-link`, `.nav-link.active`, `.header-pill`, `.logout-btn` | Header and menu |
| `.dialog`, `.dialog-btn`, `.dialog-btn.secondary`, `.dialog-btn.danger` | Dialogs and shell buttons |
| `.settings-card`, `.settings-row`, `.settings-label`, `.settings-name`, `.settings-hint`, `.settings-status` | The settings screen. Inputs and selects there have the class `.bm-input` |
| `.palette`, `.palette-input`, `.palette-item`, `.palette-hint` | The `Ctrl+P` quick switcher |

Fonts: `JetBrains Mono` (text), `Playfair Display` (big numbers). For your own font, put a `.woff2` file in the plugin folder and load it with `@font-face { font-family: 'X'; src: url(./X.woff2) format('woff2'); }`.

## 6. Checking specificity

If a plugin rule does not apply, a system rule has higher specificity. Strengthen the selector (`:root .bm-card`) and only as a last resort add `!important`.

## 7. Example

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


## 8. Installation instructions (give these to the user)

1. Open the app, go to **Settings**, find the **Modules** block and click **Open modules folder**.
2. Copy the whole plugin folder into the folder that opened. You should end up with `.../modules/<id>/manifest.json`.
3. Click **Rescan** in Settings. The plugin appears in the **Appearance** block, next to the theme selector. The shell changes immediately; pages that are already open pick up the styles the next time they are opened.
4. To switch the plugin off, clear its checkbox in the **Appearance** block. To remove it, delete the folder and click **Rescan**.
5. If the plugin does not appear, the reason is shown in red under the module list. Send it to me.

## 9. Pre-delivery checklist

- `kind` is `"plugin"`, `css` is not empty, paths contain no `..`.
- No external addresses, `@import` or JavaScript.
- Colors are set for both themes.
- Only selectors from section 5 are used.
- Every file is delivered in full and the installation instructions include the real `<id>`.
