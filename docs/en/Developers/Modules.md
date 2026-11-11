# BIOMASHINE: Module System

Everything on screen except the shell is a module. This document is the contract for writing one: manifest format, isolation model, the SDK a module sees, storage, localization, time, theming and plugins. For the surrounding architecture see [Project Map.md](Project%20Map.md).

## 1. Kinds of modules

| Kind | What it is | Location |
|---|---|---|
| Page (`page`) | A screen with its own menu entry, UI and data | `src/renderer/modules/<id>/` (system), `userData/modules/<id>/` (user) |
| Plugin (`plugin`) | CSS only, applied to the shell and to every page | same locations |
| Config | Constants, colors, coefficients | `config/<name>.json`, overridden by `userData/config/<name>.json` |

There is no main page. The shell (`src/renderer/shell`) is not a module: it provides the menu, login, settings, dialogs and the command palette.

**System modules** ship inside the application. **User modules** are folders copied by the user into `userData/modules/` (Settings has buttons to open that folder and to rescan). The registry reads system modules first; a user module that reuses a system module's `id` is rejected with an explanation. The `source` field (`system` or `user`) is visible in Settings.

## 2. Manifest

`manifest.json` is required in every module folder.

Page:

```json
{
  "id": "reaction",
  "kind": "page",
  "title": "Reaction",
  "version": "1.0.0",
  "description": "Reaction speed test",
  "order": 80,
  "entry": "index.html",
  "hideable": true,
  "i18n": true,
  "channels": ["reaction:*"]
}
```

Plugin:

```json
{
  "id": "rounded",
  "kind": "plugin",
  "title": "Rounded corners",
  "css": ["style.css"]
}
```

| Field | Applies to | Rules |
|---|---|---|
| `id` | both | `^[a-z][a-z0-9-]*$`, equal to the folder name, unique, not `app`, `shell` or `shared` |
| `kind` | both | `page` or `plugin` |
| `title` | both | Menu or settings label (fallback when no dictionary is used) |
| `version`, `description` | both | Optional strings |
| `order` | both | Position in the menu; default `1000`, so user modules come last |
| `hideable` | both | Default `true`; the user may hide the page or switch the plugin off |
| `category` | both | Optional built-in category id (`body`, `mind`, `finance`, `knowledge`, `environment`, `other` or a user category); defaults to `other` |
| `entry` | page | Entry HTML file, default `index.html` |
| `channels` | page | IPC channels the module may call: `domain:*` or `domain:action` |
| `permissions` | page | Optional `["notifications"]` to allow the notification channels |
| `i18n` | page | `true` when the module has `locales/` dictionaries; its title and description are then taken from the keys `module.title` and `module.description` |
| `css` | plugin | One or more CSS files inside the folder |

A broken manifest never crashes the app: the module is skipped and the reason is shown in Settings. `modules:errors` returns the reasons as structured objects (`{ dir, source, key, params }`) that the controller translates to the current language.

## 3. Isolation and loading

Every page runs in its own `<iframe sandbox="allow-scripts allow-same-origin">` with its own origin, `bm://<id>`.

- A module has no access to `window.api` or to the shell's DOM. Its only link to the application is the `postMessage` bridge exposed as the SDK object `bm`.
- The bridge allows only the channels declared in `channels` (plus `storage:*`, always limited to the module's own namespace). Anything else fails with status `403`.
- Errors and unhandled promise rejections are reported to the shell, which shows a crash screen with a restart button; the rest of the application keeps working.
- Native `alert`, `confirm` and `prompt` are blocked by the sandbox. Use `bm.confirm`.
- All iframes share the renderer process, so an infinite loop in a module freezes the window.

Files are served by the `bm://` protocol. `bm://app/...` is the renderer root (shell, SDK, shared CSS, vendor files); `bm://<id>/...` is the module's folder. Responses carry `Access-Control-Allow-Origin: *`, which allows ES module imports across origins.

## 4. The SDK

```js
import { bm } from 'bm://app/sdk/bm.js';

await bm.ready;
```

| Member | Description |
|---|---|
| `bm.ready` | Promise that resolves when the connection, theme, language and time zone are initialized. Do not use `bm` before it resolves |
| `bm.invoke(channel, payload)` | Calls an IPC channel. Resolves with the result; rejects with an `Error` that has `message`, `status` and, when present, `code` |
| `bm.config(name)` | Reads a configuration object (any config except the private `app`) |
| `bm.confirm(text, options)` | Styled confirmation dialog; `options`: `confirmText`, `cancelText`, `danger`. Resolves with a boolean |
| `bm.setPills(items)` | Sets the small labels on the right side of the header (array of strings, empty array clears) |
| `bm.storage` | Document storage (section 5) |
| `bm.notify` | Module notifications (`schedule`, `cancel`, `list`), requires `"permissions": ["notifications"]` |
| `bm.t(key, params)` | Translates a key (section 6) |
| `bm.locale`, `bm.language` | The BCP 47 locale (for `toLocaleString`) and the language code |
| `bm.clock` | Time in the user's time zone (section 7) |
| `bm.theme` | `{ name, colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | Subscribes to theme changes; returns an unsubscribe function |

Messages between module and shell carry the marker `biomashine-bridge` and one of the types `hello`, `init`, `theme`, `invoke`, `config`, `confirm`, `pills`, `crash`, `response`. The shell answers `hello` with `init`, which contains the theme, plugin stylesheet URLs, the module's string set and the time zone.

## 5. Document storage

`bm.storage` stores JSON documents in named collections. It exists so that a module can persist data without any main-process code. Documents are isolated per module and included in the data export.

| Call | Result |
|---|---|
| `list(collection)` | `Promise<Document[]>` in creation order |
| `get(collection, id)` | `Promise<Document>`; rejects with `404` if absent |
| `insert(collection, data)` | `Promise<number>` (the new id) |
| `update(collection, id, data)` | Replaces `data` as a whole |
| `remove(collection, id)` | Deletes one document |
| `clear(collection)` | `Promise<number>` (documents removed) |

A document is `{ id, data, createdAt, updatedAt }`. Collection names match `^[a-z][a-z0-9_-]{0,39}$`. `data` must be a plain JSON object of at most 262144 bytes. Store moments in time as `bm.clock.timestamp()` strings rather than `Date` objects.

System modules with their own tables use dedicated channels instead (a repository and a controller in `src/main`, a migration in `migrations/`).

## 6. Localization in modules

A module that sets `"i18n": true` ships `locales/ru.json` and `locales/en.json` and contains no hard-coded user-visible text. The full guide for the whole system is in [Localization.md](Localization.md).

- **Required languages.** Every module must ship `locales/ru.json` and `locales/en.json` — those are the languages in `app.json` → `i18n.required`. Other built-in languages are optional; when a file for another language is present it must cover the same keys as the reference language (`i18n.reference`, currently `ru`). A partial file is an error: `npm test` and `npm run i18n -- check` fail. Missing keys fall back at runtime along the chain described in [Localization.md](Localization.md) §3.
- **JavaScript:** `bm.t('status.saved')`, `bm.t('total', { n: 5 })` for `"Total: {n}"`, `bm.t('items', { count: 5 })` for plural forms.
- **HTML:** `data-i18n="key"` replaces the element's text; `data-i18n-placeholder`, `data-i18n-title` and `data-i18n-aria-label` replace the matching attributes. Keep the default text inside the element as a fallback.
- **Plural forms:** a value may be an object with the CLDR forms `zero`, `one`, `two`, `few`, `many`, `other` (`other` is required; a value may use only the forms its locale actually defines). The form is chosen with `Intl.PluralRules` from the `count` parameter. Russian needs `one`, `few`, `many`, `other`; English needs `one`, `other`; Polish needs `one`, `few`, `many`, `other`; Arabic needs `zero`, `one`, `two`, `few`, `many`, `other`.
- **Dates and numbers:** use `toLocaleString(bm.locale)`; never hard-code a locale.
- **Config texts:** a config that contains user-visible names stores dictionary keys in fields ending with `Key` (for example `titleKey`) and the code calls `bm.t(item.titleKey)`.
- **Required keys:** `module.title` and `module.description`.
- **Shared dictionary:** the keys in `src/renderer/shared/locales` (`common.*`, `unit.*`, theme and achievement titles) are available to every module without being declared.
- **One key per sentence:** never assemble a sentence from translated fragments.
- **Backend errors:** if the module calls an IPC channel, the reply on failure carries `code` (the dictionary key) next to `message`. Prefer `error.code` when you need a stable hook; `error.message` is already translated to the user's language.

Users can add languages by dropping a language file into `userData/locales`; a module's dictionaries are included in the template exported from Settings.

## 7. Time

The user chooses a time zone in Settings. A module must read the current time only from `bm.clock`:

| Call | Result |
|---|---|
| `bm.clock.now()` | A `Date` whose local getters (`getHours()`, `getDate()` and so on) show the selected zone's wall-clock time |
| `bm.clock.today()` | `YYYY-MM-DD` |
| `bm.clock.timestamp()` | `YYYY-MM-DD HH:MM:SS`; store this, not an ISO string |

The recommended pattern is a single clock class per module that wraps `bm.clock`, so that nothing else in the module calls `new Date()` or `Date.now()` for the current moment.

## 8. Theming and the UI kit

Colors come from CSS variables defined by the active theme: `--bg`, `--s1`, `--s2`, `--s3`, `--br`, `--br2`, `--t`, `--td`, `--tdd`, `--tddd`, `--wh`, `--overlay`, `--header-bg`. Using them keeps a module readable in every theme, so they are the default choice; they are not a restriction. The application does not force users into one style: a module (or a user's request to an assistant) may use any literal colors, fonts and sizes. The attribute `data-theme` on `<html>` holds the theme name.

`bm://app/shared/components.css` provides a small UI kit:

| Class | Purpose |
|---|---|
| `bm-page` | Page container |
| `bm-title` | Section title with a rule |
| `bm-card` | Card |
| `bm-row`, `bm-spacer` | Flex row and a stretching spacer |
| `bm-muted`, `bm-label` | Muted small text; field label |
| `bm-input` | Input, select, textarea |
| `bm-btn` (`secondary`, `danger`) | Buttons |
| `bm-list`, `bm-list-item`, `bm-empty` | Lists and the empty state |
| `bm-stats`, `bm-stat`, `bm-stat-label`, `bm-stat-value` | Statistic tiles |
| `bm-chart` | Fixed-height chart container |

Chart.js 3.8.0 is available as `window.Chart` after loading `bm://app/vendor/chart.min.js` with a classic `<script>` tag. Take axis colors from `bm.theme.chart`, rebuild charts in `bm.onTheme`, and keep series colors in a config.

## 9. Plugins

A plugin contributes CSS only. Its stylesheets are loaded after the theme styles, in the shell and in every page, so a rule of equal specificity in a plugin wins. Plugins can override the theme variables (`:root { --br: #444; }`, or per theme with `:root[data-theme="light"]`), restyle the UI kit classes and the shell's stable selectors (`.shell-header`, `.nav-link`, `.dialog`, `.dialog-btn`, `.settings-card`, `.settings-row`, `.palette`, ...), and load local fonts with `@font-face`. External URLs and `@import` are not available because the app is offline. The user switches plugins on and off in Settings → Appearance.

## 10. Writing a page module

1. Create `src/renderer/modules/<id>/` (or `userData/modules/<id>/` for a user module) containing `manifest.json`, `index.html`, `module.css`, `js/`, `locales/` and `README.md`.
2. In `index.html` link `bm://app/vendor/fonts/fonts.css`, `bm://app/shared/base.css`, `bm://app/shared/components.css` if you use the kit, your own CSS, optionally `bm://app/vendor/chart.min.js`, and `<script type="module" src="./js/main.js">`.
3. `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { MyModule } from './MyModule.js';

bm.ready.then(() => new MyModule(bm, document).start());
```

4. Put logic in classes: pure calculations without DOM access, a view class for DOM work, a repository class for channel calls and an orchestrator that wires them.
5. Persist data through `bm.storage` (user modules) or through dedicated channels (system modules).
6. Build DOM with `createElement` and `textContent`; do not assign data to `innerHTML`.
7. Describe the module in its `README.md`: purpose, channels, configs, files, behavior.

Step-by-step guides written for AI assistants live in [docs/en/ai](../ai): `MODULE_GUIDE.md` for pages and `PLUGIN_GUIDE.md` for plugins.