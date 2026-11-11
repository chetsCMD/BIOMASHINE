# BIOMASHINE: Localization

How dictionary scopes, the language registry, the `npm run i18n` tool and the plural-form rules work together, and how to add a new language without touching the main-process code.

## 1. Overview

Every user-visible string in BIOMASHINE lives in a JSON dictionary. Each dictionary is a flat object that maps a key to a string or to a set of plural forms:

```json
{
  "hello": "Hello, {name}!",
  "count": { "one": "{count} item", "other": "{count} items" }
}
```

There are four scopes of dictionaries:

| Scope | Location | Used by |
|---|---|---|
| `shell` | `src/renderer/shell/locales` | The shell (`bm://app/shell`) |
| `shared` | `src/renderer/shared/locales` | Every scope: units, common buttons, theme and achievement titles |
| `backend` | `src/main/locales` | The main process: `AppError` messages, problems in configs, modules and dictionaries |
| module `<id>` | `<module folder>/locales` | That module (only when its `manifest.json` sets `"i18n": true`) |

`LocaleService` builds the string set for a scope and a language and hands it to the shell (`i18n:bundle`), to a module (in its `init` message) and to the main process (`MessageService`). The way it walks the scopes is described in section 3.

## 2. Language registry (`i18n.builtin`)

`config/app.json` → `i18n.builtin` is the source of truth for what the program supports out of the box:

```json
"i18n": {
  "directory": "locales",
  "default": "en",
  "reference": "ru",
  "source": "en",
  "required": ["ru", "en"],
  "builtin": [
    { "code": "ru", "name": "Русский", "locale": "ru-RU" },
    { "code": "en", "name": "English", "locale": "en-US" }
  ],
  "codePattern": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$",
  "pluralForms": ["zero", "one", "two", "few", "many", "other"]
}
```

| Field | Meaning |
|---|---|
| `default` | The language used when nothing better is available. |
| `reference` | The dictionary all others are compared against. Adding a key to `reference` makes every other language "incomplete" until the key is added there too. |
| `source` | The language used to seed new translations (`npm run i18n -- add <code> … --from en`). |
| `required` | Languages every scope must ship a dictionary for. `tests/moduleContract.test.js` and `npm run i18n -- check` enforce it. |
| `builtin` | The registry of the shipped languages: code, display name, BCP 47 locale. |
| `codePattern` | The regex for a language code. |
| `pluralForms` | The set of plural form names a dictionary may use. |

The `builtin` list is read by:

- `LocaleService.languages()` — the list shown in Settings.
- `LocaleService.detect(systemLocale)` — the initial language on the first start.
- `scripts/i18n.js` — every tool command.
- `tests/support/I18nScan.js` — every dictionary test.

Adding a language to `i18n.builtin` is enough to make the shell, the modules and the tests aware of it.

## 3. Fallback chain

For a scope, a language and a key, `LocaleService` builds the strings in this order:

1. The `shared` scope of every language in the chain (only when the scope is not `shared` or `backend`).
2. The scope's own dictionary.

The chain itself is: selected language → the language's `meta.fallback` (for user languages) → `default` → every language in `builtin`. Duplicates are removed.

If the key is still missing, `bm.t` and `MessageService.t` return the key itself. That is why an old Russian string in a controller keeps working during the migration: there is no dictionary entry, but the key is the text.

## 4. Mandatory and optional languages

`i18n.required` decides which languages every scope must have. The default is `["ru", "en"]`:

- **Required**: every scope (including every module with `"i18n": true`) must have a complete file. Missing keys fail `npm test` and `npm run i18n -- check`.
- **Optional**: other built-in languages may be absent from a scope. If a file for such a language is present, it must pass the same completeness check as the reference language — a partial file is an error, not a fallback.

The fallback chain fills missing keys at runtime, but `tests` and `npm run i18n -- check` say no: every dictionary must be complete against `i18n.reference`.

## 5. The `npm run i18n` tool

`node scripts/i18n.js <command>` (or `npm run i18n -- <command>`) drives the whole flow. Every command is a thin CLI wrapper around the `I18nTool` class; the tests exercise the class directly on temporary directories.

### `status [--source en] [--json]`

Prints a "scope × language" table.

```
Source: en, reference: ru
Scope: backend
  ru  src/main/locales/ru.json  keys=120 missing=0 extra=0 untranslated=0
  en  src/main/locales/en.json  keys=120 missing=0 extra=0 untranslated=0
Scope: shell
  ru  src/renderer/shell/locales/ru.json  keys=140 missing=0 extra=0 untranslated=0
  en  src/renderer/shell/locales/en.json  keys=140 missing=0 extra=0 untranslated=2
Totals:
  ru  100%   keys=260 missing=0 extra=0 untranslated=0
  en  99.2%  keys=260 missing=0 extra=0 untranslated=2
```

- `missing` — keys in `reference` missing in this file.
- `extra` — keys in this file missing in `reference`.
- `untranslated` — values that are still identical to `source`. Not counted for `reference` and `source` themselves.
- `--source xx` compares against a different source.
- `--json` prints the full structure (used by tests).

### `files <code> [--missing]`

Lists every scope with its dictionary file for that language:

```
[exists] src/main/locales/en.json (120 keys, 0 missing)
[exists] src/renderer/shell/locales/en.json (140 keys, 0 missing)
[exists] src/renderer/shared/locales/en.json (45 keys, 0 missing)
[create] src/renderer/modules/reaction/locales/en.json (0 keys, 32 missing)
```

- `[exists]` — the file already exists.
- `[create]` — the file is missing and must be created.
- `--missing` — only entries that need work.

### `add <code> "<Name>" <locale> [--fallback en] [--from en]`

Registers a new built-in language and creates the seed files.

1. Validates `code` and `locale` against `i18n.codePattern`.
2. Refuses if the language already exists in `i18n.builtin` or in `userData/locales`.
3. Writes `config/app.json` with the new entry in `i18n.builtin` (including the `fallback`).
4. For every scope, copies the strings from the `--from` language (default `source`), and expands plural forms to the exact categories `Intl.PluralRules(locale)` defines. A plural value like `{ "one": "…", "other": "…" }` in English becomes the right set for German (`one`, `other`), Polish (`one`, `few`, `many`, `other`), Arabic (`zero`, `one`, `two`, `few`, `many`, `other`) and so on.

```
$ npm run i18n -- add de "Deutsch" de-DE
Added language de (Deutsch, de-DE), files: 11, keys: 412
  config/app.json (updated i18n.builtin)
  src/main/locales/de.json (120)
  src/renderer/shell/locales/de.json (140)
  src/renderer/shared/locales/de.json (45)
  src/renderer/modules/reaction/locales/de.json (32)
  …
```

### `check [code] [--allow-missing]`

Validates every dictionary against the reference. Checks:

- **Placeholders** `{…}` match the reference exactly (same names, same count).
- **Plural forms** are exactly the set `Intl.PluralRules(locale).resolvedOptions().pluralCategories` defines — no more, no less, no empty values.
- **No empty strings** — an empty value is an error.
- **No extra keys** — every key must exist in the reference.
- **No missing keys** — every reference key must exist (unless `--allow-missing`).

Exit code is `1` when problems are found:

```
$ npm run i18n -- check de
src/renderer/shell/locales/de.json [items]: no form: other
src/renderer/shell/locales/de.json [items]: placeholders do not match ru: expected [count], got [n]
src/main/locales/de.json: missing key: error.locked
```

Without `<code>` the tool checks every language.

## 6. How to add a language

Six steps. Nothing outside the dictionary files and `config/app.json` is touched.

### 6.1. Add the language

```
npm run i18n -- add de "Deutsch" de-DE --fallback en --from en
```

This registers `de` in `i18n.builtin` and seeds every scope with the English strings. It is fine to start from another language (`--from ru`) if the translator is more comfortable with that.

### 6.2. See what needs work

```
npm run i18n -- files de --missing
```

This lists exactly the files that need translating. Every entry with `[create]` or with `missing > 0` is a file to edit.

### 6.3. Translate the files

Open each file from the list and replace the values. Keep the keys as they are. If a value has `{placeholders}`, keep them; if a value is a plural object, keep the form names.

Example — `src/renderer/shell/locales/de.json`:

```json
{
  "nav.settings": "Einstellungen",
  "items": { "one": "{count} Eintrag", "other": "{count} Einträge" }
}
```

A user language can also be dropped into `userData/locales` (section 7) — no rebuild needed.

### 6.4. Check

```
npm run i18n -- check de
```

Fix every reported problem. When the command prints `Проблем не найдено` (or the English equivalent — the message follows `--source`), the language is ready. `--allow-missing` is useful mid-translation to see only the other categories of problems.

### 6.5. Fonts and scripts

The `@fontsource/jetbrains-mono` and `@fontsource/playfair-display` packages bundle the following subsets by default:

| Category | Scripts | Coverage |
|---|---|---|
| Bundled | Latin, Latin Extended, Cyrillic | `config/app.json` → `fonts.subsets = ["latin", "latin-ext", "cyrillic"]` |
| Opt-in | Greek, Vietnamese | add `"greek"` or `"vietnamese"` to `fonts.subsets` and run `npm run prepare-assets -- --force` |
| Fallback | Chinese, Japanese, Korean, Arabic, Hebrew, Thai, Devanagari and every other script | Chromium picks a system font from the OS. Nothing to configure: the font chain in `base.css` ends in `monospace`/`serif`, so the browser falls back to a font that covers the script |

The end of `--font-mono` and `--font-serif` in `src/renderer/shared/base.css` is the important part:

```css
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas,
             'Liberation Mono', 'DejaVu Sans Mono', monospace;
--font-serif: 'Playfair Display', ui-serif, Georgia, Cambria, 'Times New Roman', serif;
```

`tests/assets.test.js` enforces this — a `font-family` that does not end in a generic family fails the test.

If the language needs a script that the bundled fonts do not carry and the OS default is not good enough, add a subset to `fonts.subsets` and re-run `npm run prepare-assets -- --force`. For scripts that `@fontsource` does not ship (CJK, Arabic, Thai, Devanagari), add a local font through the plugin pipeline (`PLUGIN_GUIDE.md` → section on `@font-face`); external URLs are not available because the app is offline.

### 6.6. Test

```
npm test
```

The whole suite is language-aware:

- `tests/support/I18nScan.js` walks `i18n.builtin`.
- `tests/moduleContract.test.js` requires every module to have a complete file for every `i18n.required` language, and — if a file for another built-in language is present — a complete file for that language too.
- `tests/translator.test.js` has a test with an imaginary `de` that proves the checks are registry-driven, not hard-coded.

If a key is missing in the new language, the failure message points at the exact file and key.

## 7. User languages (`userData/locales`)

A user can drop a language into `userData/locales/<code>.json` without touching `config/app.json`. The file patches (for `ru` and `en`) or adds (for every other code) the dictionaries.

```json
{
  "meta": { "code": "de", "name": "Deutsch", "locale": "de-DE", "fallback": "en" },
  "scopes": {
    "shell": { "nav.settings": "Einstellungen" },
    "shared": {},
    "backend": { "error.locked": "Anmeldung erforderlich" },
    "reaction": {}
  }
}
```

- `meta.code` must match `codePattern`. `meta.name` is the name shown in Settings. `meta.locale` is the BCP 47 locale used by `Intl`. `meta.fallback` is the language to try if a key is missing.
- `scopes` may contain any subset of scopes. A missing scope is not an error.
- A user language whose `meta.code` is `ru` or `en` **patches** the built-in strings instead of adding a language. This is how a user overrides a single string without forking the app.
- Settings exports a template (`i18n:export`) with every scope and every key. The translator drops the result into `userData/locales`, translates the values, keeps `meta`, and that is it.
- Problems (invalid JSON, missing `meta`, malformed plural objects) are shown in Settings → Languages. `npm run i18n -- check` does not cover user languages (they are outside the repository), but `LocaleService.errors()` does.

## 8. Plural forms (CLDR)

A plural value is a JSON object whose keys are CLDR categories:

```json
{ "one": "{count} item", "other": "{count} items" }
```

The category is selected by `Intl.PluralRules(locale).select(count)`. The categories each language uses:

| Language | Categories | Example for `count = 1, 2, 5, 21` |
|---|---|---|
| `en`, `de`, `nl`, `sv` | `one`, `other` | `item`, `items`, `items`, `items` |
| `ru`, `uk`, `pl`, `cs` | `one`, `few`, `many`, `other` | `запись`, `записи`, `записей`, `запись` |
| `ar` | `zero`, `one`, `two`, `few`, `many`, `other` | six distinct forms |
| `fr`, `pt-BR` | `one`, `many`, `other` | `article`, `articles`, `articles` |
| `ja`, `zh`, `ko` | `other` | `項目` |
| `tr`, `hu` | `one`, `other` | `öğe`, `öğe` |

The tool derives these from `Intl.PluralRules` — a language's categories are never hard-coded. `npm run i18n -- add` fills the correct set, `npm run i18n -- check` rejects a set that is too small or too large, and `MessageTranslator`/`Translator` pick the right form at runtime.

## 9. Release checklist with a new language

Before shipping a new built-in language:

- [ ] `npm run i18n -- add <code> "<Name>" <locale>` — the entry is in `i18n.builtin`, the seed files exist.
- [ ] `npm run i18n -- files <code> --missing` — every file is translated.
- [ ] `npm run i18n -- check <code>` — no problems reported.
- [ ] `npm run i18n -- status` — the new language is at `100%` in the "Totals" block.
- [ ] `npm test` — passes; if a module was added after the language, the module's contract test creates the missing file.
- [ ] `config/app.json` → `i18n.builtin` lists the new language with the correct `locale`.
- [ ] If the language needs a script outside `latin`/`latin-ext`/`cyrillic`, `fonts.subsets` is updated and `npm run prepare-assets -- --force` was run.
- [ ] `CHANGELOG.md` (if present) mentions the language.
- [ ] The GitHub release notes list the language.

## 10. Where each layer reads the strings

- **Main process** — `MessageService.t(key, params)`. Language comes from `SettingsService`, so a change applies without a restart. `AppError` carries a key and parameters; `IpcRouter` translates before returning.
- **Shell** — `ShellApp` receives the bundle from `i18n:bundle` and passes it to `Translator`; `data-i18n` attributes are filled by `DomTranslator`.
- **Modules** — the bundle arrives in the `init` message and is exposed as `bm.t(key, params)`. `bm.locale` gives the BCP 47 locale for `toLocaleString`.
- **Tests** — `tests/support/I18nScan.js` checks the dictionaries directly; it does not depend on the runtime.