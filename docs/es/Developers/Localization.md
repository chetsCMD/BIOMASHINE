# BIOMASHINE: Localización

Cómo funcionan conjuntamente los ámbitos de diccionario, el registro de idiomas, la herramienta `npm run i18n` y las reglas de formas plurales, y cómo añadir un nuevo idioma sin tocar el código del proceso principal.

## 1. Visión general

Cada cadena visible para el usuario en BIOMASHINE vive en un diccionario JSON. Cada diccionario es un objeto plano que asigna una clave a una cadena o a un conjunto de formas plurales:

```json
{
  "hello": "Hello, {name}!",
  "count": { "one": "{count} item", "other": "{count} items" }
}
```

Hay cuatro ámbitos de diccionarios:

| Ámbito | Ubicación | Usado por |
|---|---|---|
| `shell` | `src/renderer/shell/locales` | El shell (`bm://app/shell`) |
| `shared` | `src/renderer/shared/locales` | Todos los ámbitos: unidades, botones comunes, títulos de temas y logros |
| `backend` | `src/main/locales` | El proceso principal: mensajes de `AppError`, problemas en configuraciones, módulos y diccionarios |
| módulo `<id>` | `<module folder>/locales` | Ese módulo (solo cuando su `manifest.json` establece `"i18n": true`) |

`LocaleService` construye el conjunto de cadenas para un ámbito y un idioma y lo entrega al shell (`i18n:bundle`), a un módulo (en su mensaje `init`) y al proceso principal (`MessageService`). La forma en que recorre los ámbitos se describe en la sección 3.

## 2. Registro de idiomas (`i18n.builtin`)

`config/app.json` → `i18n.builtin` es la fuente de verdad de lo que el programa admite de fábrica:

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

| Campo | Significado |
|---|---|
| `default` | El idioma usado cuando no hay nada mejor disponible. |
| `reference` | El diccionario contra el que se comparan todos los demás. Añadir una clave a `reference` hace que todos los demás idiomas estén "incompletos" hasta que la clave se añada también allí. |
| `source` | El idioma usado para sembrar nuevas traducciones (`npm run i18n -- add <code> … --from en`). |
| `required` | Idiomas para los que cada ámbito debe incluir un diccionario. `tests/moduleContract.test.js` y `npm run i18n -- check` lo exigen. |
| `builtin` | El registro de los idiomas incluidos: código, nombre para mostrar, locale BCP 47. |
| `codePattern` | La expresión regular para un código de idioma. |
| `pluralForms` | El conjunto de nombres de formas plurales que puede usar un diccionario. |

La lista `builtin` es leída por:

- `LocaleService.languages()` — la lista mostrada en Ajustes.
- `LocaleService.detect(systemLocale)` — el idioma inicial en el primer arranque.
- `scripts/i18n.js` — cada comando de la herramienta.
- `tests/support/I18nScan.js` — cada prueba de diccionario.

Añadir un idioma a `i18n.builtin` basta para que el shell, los módulos y las pruebas lo conozcan.

## 3. Cadena de respaldo

Para un ámbito, un idioma y una clave, `LocaleService` construye las cadenas en este orden:

1. El ámbito `shared` de cada idioma de la cadena (solo cuando el ámbito no es `shared` ni `backend`).
2. El diccionario propio del ámbito.

La cadena en sí es: idioma seleccionado → el `meta.fallback` del idioma (para idiomas de usuario) → `default` → cada idioma de `builtin`. Los duplicados se eliminan.

Si la clave sigue faltando, `bm.t` y `MessageService.t` devuelven la propia clave. Por eso una cadena rusa antigua en un controlador sigue funcionando durante la migración: no hay entrada en el diccionario, pero la clave es el texto.

## 4. Idiomas obligatorios y opcionales

`i18n.required` decide qué idiomas debe tener cada ámbito. El valor predeterminado es `["ru", "en"]`:

- **Obligatorios**: cada ámbito (incluido cada módulo con `"i18n": true`) debe tener un archivo completo. Las claves faltantes hacen fallar `npm test` y `npm run i18n -- check`.
- **Opcionales**: otros idiomas integrados pueden faltar en un ámbito. Si un archivo para uno de esos idiomas está presente, debe pasar la misma comprobación de completitud que el idioma de referencia: un archivo parcial es un error, no un respaldo.

La cadena de respaldo rellena las claves faltantes en tiempo de ejecución, pero `tests` y `npm run i18n -- check` dicen que no: cada diccionario debe estar completo respecto a `i18n.reference`.

## 5. La herramienta `npm run i18n`

`node scripts/i18n.js <command>` (o `npm run i18n -- <command>`) impulsa todo el flujo. Cada comando es una envoltura CLI fina alrededor de la clase `I18nTool`; las pruebas ejercitan la clase directamente sobre directorios temporales.

### `status [--source en] [--json]`

Imprime una tabla "ámbito × idioma".

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

- `missing` — claves de `reference` que faltan en este archivo.
- `extra` — claves de este archivo que faltan en `reference`.
- `untranslated` — valores que siguen siendo idénticos a `source`. No se cuentan para `reference` ni para `source` mismos.
- `--source xx` compara contra una fuente diferente.
- `--json` imprime la estructura completa (usada por las pruebas).

### `files <code> [--missing]`

Enumera cada ámbito con su archivo de diccionario para ese idioma:

```
[exists] src/main/locales/en.json (120 keys, 0 missing)
[exists] src/renderer/shell/locales/en.json (140 keys, 0 missing)
[exists] src/renderer/shared/locales/en.json (45 keys, 0 missing)
[create] src/renderer/modules/reaction/locales/en.json (0 keys, 32 missing)
```

- `[exists]` — el archivo ya existe.
- `[create]` — el archivo falta y debe crearse.
- `--missing` — solo entradas que necesitan trabajo.

### `add <code> "<Name>" <locale> [--fallback en] [--from en]`

Registra un nuevo idioma integrado y crea los archivos iniciales.

1. Valida `code` y `locale` contra `i18n.codePattern`.
2. Se niega si el idioma ya existe en `i18n.builtin` o en `userData/locales`.
3. Escribe `config/app.json` con la nueva entrada en `i18n.builtin` (incluido `fallback`).
4. Para cada ámbito, copia las cadenas del idioma `--from` (por defecto `source`), y expande las formas plurales a las categorías exactas que define `Intl.PluralRules(locale)`. Un valor plural como `{ "one": "…", "other": "…" }` en inglés se convierte en el conjunto correcto para alemán (`one`, `other`), polaco (`one`, `few`, `many`, `other`), árabe (`zero`, `one`, `two`, `few`, `many`, `other`) y así sucesivamente.

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

Valida cada diccionario contra la referencia. Comprueba:

- **Los marcadores** `{…}` coinciden exactamente con la referencia (mismos nombres, misma cantidad).
- **Las formas plurales** son exactamente el conjunto que define `Intl.PluralRules(locale).resolvedOptions().pluralCategories`: ni más, ni menos, ni valores vacíos.
- **Sin cadenas vacías**: un valor vacío es un error.
- **Sin claves extra**: cada clave debe existir en la referencia.
- **Sin claves faltantes**: cada clave de referencia debe existir (salvo `--allow-missing`).

El código de salida es `1` cuando se encuentran problemas:

```
$ npm run i18n -- check de
src/renderer/shell/locales/de.json [items]: no form: other
src/renderer/shell/locales/de.json [items]: placeholders do not match ru: expected [count], got [n]
src/main/locales/de.json: missing key: error.locked
```

Sin `<code>`, la herramienta comprueba todos los idiomas.

## 6. Cómo añadir un idioma

Seis pasos. No se toca nada fuera de los archivos de diccionario y `config/app.json`.

### 6.1. Añadir el idioma

```
npm run i18n -- add de "Deutsch" de-DE --fallback en --from en
```

Esto registra `de` en `i18n.builtin` y siembra cada ámbito con las cadenas en inglés. No pasa nada por empezar desde otro idioma (`--from ru`) si el traductor se siente más cómodo con él.

### 6.2. Ver qué falta por hacer

```
npm run i18n -- files de --missing
```

Esto enumera exactamente los archivos que necesitan traducción. Cada entrada con `[create]` o con `missing > 0` es un archivo que editar.

### 6.3. Traducir los archivos

Abre cada archivo de la lista y reemplaza los valores. Mantén las claves tal como están. Si un valor tiene `{placeholders}`, consérvalos; si un valor es un objeto plural, conserva los nombres de las formas.

Ejemplo — `src/renderer/shell/locales/de.json`:

```json
{
  "nav.settings": "Einstellungen",
  "items": { "one": "{count} Eintrag", "other": "{count} Einträge" }
}
```

Un idioma de usuario también puede colocarse en `userData/locales` (sección 7); no hace falta recompilar.

### 6.4. Comprobar

```
npm run i18n -- check de
```

Corrige cada problema reportado. Cuando el comando imprima `Проблем не найдено` (o el equivalente en inglés — el mensaje sigue a `--source`), el idioma está listo. `--allow-missing` es útil a mitad de la traducción para ver solo las demás categorías de problemas.

### 6.5. Fuentes y sistemas de escritura

Los paquetes `@fontsource/jetbrains-mono` y `@fontsource/playfair-display` incluyen los siguientes subconjuntos por defecto:

| Categoría | Sistemas de escritura | Cobertura |
|---|---|---|
| Incluidos | Latín, latín extendido, cirílico | `config/app.json` → `fonts.subsets = ["latin", "latin-ext", "cyrillic"]` |
| Opcionales | Griego, vietnamita | añade `"greek"` o `"vietnamese"` a `fonts.subsets` y ejecuta `npm run prepare-assets -- --force` |
| Respaldo | Chino, japonés, coreano, árabe, hebreo, tailandés, devanagari y cualquier otro sistema de escritura | Chromium elige una fuente del sistema del SO. No hay nada que configurar: la cadena de fuentes en `base.css` termina en `monospace`/`serif`, así que el navegador recurre a una fuente que cubre el sistema de escritura |

El final de `--font-mono` y `--font-serif` en `src/renderer/shared/base.css` es la parte importante:

```css
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas,
             'Liberation Mono', 'DejaVu Sans Mono', monospace;
--font-serif: 'Playfair Display', ui-serif, Georgia, Cambria, 'Times New Roman', serif;
```

`tests/assets.test.js` lo exige: un `font-family` que no termine en una familia genérica hace fallar la prueba.

Si el idioma necesita un sistema de escritura que las fuentes incluidas no contienen y el valor predeterminado del SO no es suficiente, añade un subconjunto a `fonts.subsets` y vuelve a ejecutar `npm run prepare-assets -- --force`. Para sistemas de escritura que `@fontsource` no distribuye (CJK, árabe, tailandés, devanagari), añade una fuente local mediante el flujo de plugins (`PLUGIN_GUIDE.md` → sección sobre `@font-face`); las URL externas no están disponibles porque la aplicación funciona sin conexión.

### 6.6. Probar

```
npm test
```

Toda la suite conoce los idiomas:

- `tests/support/I18nScan.js` recorre `i18n.builtin`.
- `tests/moduleContract.test.js` exige que cada módulo tenga un archivo completo para cada idioma de `i18n.required` y, si está presente un archivo para otro idioma integrado, también un archivo completo para ese idioma.
- `tests/translator.test.js` tiene una prueba con un `de` imaginario que demuestra que las comprobaciones se basan en el registro, no están codificadas de forma fija.

Si falta una clave en el nuevo idioma, el mensaje de fallo señala el archivo y la clave exactos.

## 7. Idiomas de usuario (`userData/locales`)

Un usuario puede colocar un idioma en `userData/locales/<code>.json` sin tocar `config/app.json`. El archivo parchea (para `ru` y `en`) o añade (para cualquier otro código) los diccionarios.

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

- `meta.code` debe coincidir con `codePattern`. `meta.name` es el nombre mostrado en Ajustes. `meta.locale` es el locale BCP 47 usado por `Intl`. `meta.fallback` es el idioma que probar si falta una clave.
- `scopes` puede contener cualquier subconjunto de ámbitos. Que falte un ámbito no es un error.
- Un idioma de usuario cuyo `meta.code` sea `ru` o `en` **parchea** las cadenas integradas en lugar de añadir un idioma. Así un usuario sobrescribe una sola cadena sin bifurcar la aplicación.
- Ajustes exporta una plantilla (`i18n:export`) con todos los ámbitos y todas las claves. El traductor coloca el resultado en `userData/locales`, traduce los valores, conserva `meta` y listo.
- Los problemas (JSON no válido, `meta` ausente, objetos plurales mal formados) se muestran en Ajustes → Idiomas. `npm run i18n -- check` no cubre los idiomas de usuario (están fuera del repositorio), pero `LocaleService.errors()` sí.

## 8. Formas plurales (CLDR)

Un valor plural es un objeto JSON cuyas claves son categorías CLDR:

```json
{ "one": "{count} item", "other": "{count} items" }
```

La categoría se selecciona mediante `Intl.PluralRules(locale).select(count)`. Las categorías que usa cada idioma:

| Idioma | Categorías | Ejemplo para `count = 1, 2, 5, 21` |
|---|---|---|
| `en`, `de`, `nl`, `sv` | `one`, `other` | `item`, `items`, `items`, `items` |
| `ru`, `uk`, `pl`, `cs` | `one`, `few`, `many`, `other` | `запись`, `записи`, `записей`, `запись` |
| `ar` | `zero`, `one`, `two`, `few`, `many`, `other` | seis formas distintas |
| `fr`, `pt-BR` | `one`, `many`, `other` | `article`, `articles`, `articles` |
| `ja`, `zh`, `ko` | `other` | `項目` |
| `tr`, `hu` | `one`, `other` | `öğe`, `öğe` |

La herramienta las deriva de `Intl.PluralRules`: las categorías de un idioma nunca están codificadas de forma fija. `npm run i18n -- add` rellena el conjunto correcto, `npm run i18n -- check` rechaza un conjunto demasiado pequeño o demasiado grande, y `MessageTranslator`/`Translator` eligen la forma correcta en tiempo de ejecución.

## 9. Lista de verificación de publicación con un nuevo idioma

Antes de publicar un nuevo idioma integrado:

- [ ] `npm run i18n -- add <code> "<Name>" <locale>` — la entrada está en `i18n.builtin`, existen los archivos iniciales.
- [ ] `npm run i18n -- files <code> --missing` — todos los archivos están traducidos.
- [ ] `npm run i18n -- check <code>` — no se reportan problemas.
- [ ] `npm run i18n -- status` — el nuevo idioma está al `100%` en el bloque "Totals".
- [ ] `npm test` — pasa; si se añadió un módulo después del idioma, la prueba de contrato del módulo crea el archivo faltante.
- [ ] `config/app.json` → `i18n.builtin` enumera el nuevo idioma con el `locale` correcto.
- [ ] Si el idioma necesita un sistema de escritura fuera de `latin`/`latin-ext`/`cyrillic`, se actualizó `fonts.subsets` y se ejecutó `npm run prepare-assets -- --force`.
- [ ] `CHANGELOG.md` (si existe) menciona el idioma.
- [ ] Las notas de la versión de GitHub enumeran el idioma.

## 10. Dónde lee las cadenas cada capa

- **Proceso principal** — `MessageService.t(key, params)`. El idioma procede de `SettingsService`, así que un cambio se aplica sin reiniciar. `AppError` lleva una clave y parámetros; `IpcRouter` traduce antes de devolver.
- **Shell** — `ShellApp` recibe el paquete de `i18n:bundle` y lo pasa a `Translator`; los atributos `data-i18n` los rellena `DomTranslator`.
- **Módulos** — el paquete llega en el mensaje `init` y se expone como `bm.t(key, params)`. `bm.locale` proporciona el locale BCP 47 para `toLocaleString`.
- **Pruebas** — `tests/support/I18nScan.js` comprueba los diccionarios directamente; no depende del tiempo de ejecución.
