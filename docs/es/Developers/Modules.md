# BIOMASHINE: Sistema de módulos

Todo lo que aparece en pantalla excepto el shell es un módulo. Este documento es el contrato para escribir uno: formato del manifiesto, modelo de aislamiento, el SDK que ve un módulo, almacenamiento, localización, tiempo, temas y plugins. Para la arquitectura general, consulte [Project Map.md](Project%20Map.md).

## 1. Tipos de módulos

| Tipo | Qué es | Ubicación |
|---|---|---|
| Página (`page`) | Una pantalla con su propia entrada de menú, interfaz y datos | `src/renderer/modules/<id>/` (sistema), `userData/modules/<id>/` (usuario) |
| Plugin (`plugin`) | Solo CSS, aplicado al shell y a cada página | mismas ubicaciones |
| Config | Constantes, colores, coeficientes | `config/<name>.json`, sobrescrito por `userData/config/<name>.json` |

No hay página principal. El shell (`src/renderer/shell`) no es un módulo: proporciona el menú, el inicio de sesión, los ajustes, los diálogos y la paleta de comandos.

Los **módulos del sistema** se incluyen dentro de la aplicación. Los **módulos de usuario** son carpetas copiadas por el usuario en `userData/modules/` (Ajustes tiene botones para abrir esa carpeta y volver a escanear). El registro lee primero los módulos del sistema; un módulo de usuario que reutilice el `id` de un módulo del sistema se rechaza con una explicación. El campo `source` (`system` o `user`) es visible en Ajustes.

## 2. Manifiesto

`manifest.json` es obligatorio en cada carpeta de módulo.

Página:

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

| Campo | Se aplica a | Reglas |
|---|---|---|
| `id` | ambos | `^[a-z][a-z0-9-]*$`, igual al nombre de la carpeta, único, no `app`, `shell` ni `shared` |
| `kind` | ambos | `page` o `plugin` |
| `title` | ambos | Etiqueta del menú o de ajustes (respaldo cuando no se usa un diccionario) |
| `version`, `description` | ambos | Cadenas opcionales |
| `order` | ambos | Posición en el menú; por defecto `1000`, de modo que los módulos de usuario van al final |
| `hideable` | ambos | Por defecto `true`; el usuario puede ocultar la página o desactivar el plugin |
| `category` | ambos | Id de categoría integrada opcional (`body`, `mind`, `finance`, `knowledge`, `environment`, `other` o una categoría de usuario); por defecto `other` |
| `entry` | página | Archivo HTML de entrada, por defecto `index.html` |
| `channels` | página | Canales IPC que el módulo puede llamar: `domain:*` o `domain:action` |
| `permissions` | página | Opcional `["notifications"]` para permitir los canales de notificaciones |
| `i18n` | página | `true` cuando el módulo tiene diccionarios en `locales/`; su título y descripción se toman entonces de las claves `module.title` y `module.description` |
| `css` | plugin | Uno o más archivos CSS dentro de la carpeta |

Un manifiesto roto nunca bloquea la aplicación: el módulo se omite y el motivo se muestra en Ajustes. `modules:errors` devuelve los motivos como objetos estructurados (`{ dir, source, key, params }`) que el controlador traduce al idioma actual.

## 3. Aislamiento y carga

Cada página se ejecuta en su propio `<iframe sandbox="allow-scripts allow-same-origin">` con su propio origen, `bm://<id>`.

- Un módulo no tiene acceso a `window.api` ni al DOM del shell. Su único enlace con la aplicación es el puente `postMessage` expuesto como el objeto SDK `bm`.
- El puente permite solo los canales declarados en `channels` (más `storage:*`, siempre limitado al espacio de nombres propio del módulo). Cualquier otra cosa falla con estado `403`.
- Los errores y rechazos de promesas no gestionados se informan al shell, que muestra una pantalla de fallo con un botón de reinicio; el resto de la aplicación sigue funcionando.
- Los `alert`, `confirm` y `prompt` nativos están bloqueados por el sandbox. Use `bm.confirm`.
- Todos los iframes comparten el proceso de renderizado, así que un bucle infinito en un módulo congela la ventana.

Los archivos se sirven mediante el protocolo `bm://`. `bm://app/...` es la raíz del renderer (shell, SDK, CSS compartido, archivos vendor); `bm://<id>/...` es la carpeta del módulo. Las respuestas llevan `Access-Control-Allow-Origin: *`, lo que permite importaciones de módulos ES entre orígenes.

## 4. El SDK

```js
import { bm } from 'bm://app/sdk/bm.js';

await bm.ready;
```

| Miembro | Descripción |
|---|---|
| `bm.ready` | Promesa que se resuelve cuando se han inicializado la conexión, el tema, el idioma y la zona horaria. No use `bm` antes de que se resuelva |
| `bm.invoke(channel, payload)` | Llama a un canal IPC. Se resuelve con el resultado; se rechaza con un `Error` que tiene `message`, `status` y, cuando existe, `code` |
| `bm.config(name)` | Lee un objeto de configuración (cualquier configuración excepto la privada `app`) |
| `bm.confirm(text, options)` | Diálogo de confirmación con estilo; `options`: `confirmText`, `cancelText`, `danger`. Se resuelve con un booleano |
| `bm.setPills(items)` | Establece las pequeñas etiquetas en el lado derecho de la cabecera (array de cadenas; un array vacío las borra) |
| `bm.storage` | Almacenamiento de documentos (sección 5) |
| `bm.notify` | Notificaciones del módulo (`schedule`, `cancel`, `list`), requiere `"permissions": ["notifications"]` |
| `bm.t(key, params)` | Traduce una clave (sección 6) |
| `bm.locale`, `bm.language` | El locale BCP 47 (para `toLocaleString`) y el código de idioma |
| `bm.clock` | Hora en la zona horaria del usuario (sección 7) |
| `bm.theme` | `{ name, colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | Se suscribe a los cambios de tema; devuelve una función para cancelar la suscripción |

Los mensajes entre el módulo y el shell llevan el marcador `biomashine-bridge` y uno de los tipos `hello`, `init`, `theme`, `invoke`, `config`, `confirm`, `pills`, `crash`, `response`. El shell responde a `hello` con `init`, que contiene el tema, las URL de las hojas de estilo de plugins, el conjunto de cadenas del módulo y la zona horaria.

## 5. Almacenamiento de documentos

`bm.storage` almacena documentos JSON en colecciones con nombre. Existe para que un módulo pueda persistir datos sin ningún código del proceso principal. Los documentos están aislados por módulo y se incluyen en la exportación de datos.

| Llamada | Resultado |
|---|---|
| `list(collection)` | `Promise<Document[]>` en orden de creación |
| `get(collection, id)` | `Promise<Document>`; se rechaza con `404` si no existe |
| `insert(collection, data)` | `Promise<number>` (el nuevo id) |
| `update(collection, id, data)` | Reemplaza `data` por completo |
| `remove(collection, id)` | Elimina un documento |
| `clear(collection)` | `Promise<number>` (documentos eliminados) |

Un documento es `{ id, data, createdAt, updatedAt }`. Los nombres de colección coinciden con `^[a-z][a-z0-9_-]{0,39}$`. `data` debe ser un objeto JSON plano de como máximo 262144 bytes. Guarde los momentos en el tiempo como cadenas de `bm.clock.timestamp()` en lugar de objetos `Date`.

Los módulos del sistema con sus propias tablas usan canales dedicados en su lugar (un repositorio y un controlador en `src/main`, una migración en `migrations/`).

## 6. Localización en módulos

Un módulo que establece `"i18n": true` incluye `locales/ru.json` y `locales/en.json` y no contiene texto visible para el usuario codificado de forma fija. La guía completa para todo el sistema está en [Localization.md](Localization.md).

- **Idiomas obligatorios.** Cada módulo debe incluir `locales/ru.json` y `locales/en.json` — esos son los idiomas en `app.json` → `i18n.required`. Otros idiomas integrados son opcionales; cuando está presente un archivo para otro idioma, debe cubrir las mismas claves que el idioma de referencia (`i18n.reference`, actualmente `ru`). Un archivo parcial es un error: `npm test` y `npm run i18n -- check` fallan. Las claves faltantes recurren en tiempo de ejecución a la cadena descrita en [Localization.md](Localization.md) §3.
- **JavaScript:** `bm.t('status.saved')`, `bm.t('total', { n: 5 })` para `"Total: {n}"`, `bm.t('items', { count: 5 })` para formas plurales.
- **HTML:** `data-i18n="key"` reemplaza el texto del elemento; `data-i18n-placeholder`, `data-i18n-title` y `data-i18n-aria-label` reemplazan los atributos correspondientes. Mantenga el texto predeterminado dentro del elemento como respaldo.
- **Formas plurales:** un valor puede ser un objeto con las formas CLDR `zero`, `one`, `two`, `few`, `many`, `other` (`other` es obligatoria; un valor puede usar solo las formas que su locale define realmente). La forma se elige con `Intl.PluralRules` a partir del parámetro `count`. El ruso necesita `one`, `few`, `many`, `other`; el inglés necesita `one`, `other`; el polaco necesita `one`, `few`, `many`, `other`; el árabe necesita `zero`, `one`, `two`, `few`, `many`, `other`.
- **Fechas y números:** use `toLocaleString(bm.locale)`; nunca codifique un locale de forma fija.
- **Textos de configuración:** una configuración que contiene nombres visibles para el usuario guarda claves de diccionario en campos que terminan en `Key` (por ejemplo `titleKey`) y el código llama a `bm.t(item.titleKey)`.
- **Claves obligatorias:** `module.title` y `module.description`.
- **Diccionario compartido:** las claves en `src/renderer/shared/locales` (`common.*`, `unit.*`, títulos de temas y logros) están disponibles para cada módulo sin declararlas.
- **Una clave por frase:** nunca ensamble una frase a partir de fragmentos traducidos.
- **Errores del backend:** si el módulo llama a un canal IPC, la respuesta en caso de fallo lleva `code` (la clave del diccionario) junto a `message`. Prefiera `error.code` cuando necesite un enganche estable; `error.message` ya está traducido al idioma del usuario.

Los usuarios pueden añadir idiomas colocando un archivo de idioma en `userData/locales`; los diccionarios de un módulo se incluyen en la plantilla exportada desde Ajustes.

## 7. Tiempo

El usuario elige una zona horaria en Ajustes. Un módulo debe leer la hora actual solo desde `bm.clock`:

| Llamada | Resultado |
|---|---|
| `bm.clock.now()` | Un `Date` cuyos getters locales (`getHours()`, `getDate()`, etc.) muestran la hora de pared de la zona seleccionada |
| `bm.clock.today()` | `YYYY-MM-DD` |
| `bm.clock.timestamp()` | `YYYY-MM-DD HH:MM:SS`; guarde esto, no una cadena ISO |

El patrón recomendado es una única clase de reloj por módulo que envuelva `bm.clock`, de modo que nada más en el módulo llame a `new Date()` o `Date.now()` para el momento actual.

## 8. Temas y el kit de UI

Los colores provienen de variables CSS definidas por el tema activo: `--bg`, `--s1`, `--s2`, `--s3`, `--br`, `--br2`, `--t`, `--td`, `--tdd`, `--tddd`, `--wh`, `--overlay`, `--header-bg`. Usarlas mantiene un módulo legible en cada tema, así que son la opción predeterminada; no son una restricción. La aplicación no obliga a los usuarios a un único estilo: un módulo (o la petición de un usuario a un asistente) puede usar cualquier color, fuente y tamaño literales. El atributo `data-theme` en `<html>` contiene el nombre del tema.

`bm://app/shared/components.css` proporciona un pequeño kit de UI:

| Clase | Propósito |
|---|---|
| `bm-page` | Contenedor de página |
| `bm-title` | Título de sección con una regla |
| `bm-card` | Tarjeta |
| `bm-row`, `bm-spacer` | Fila flex y espaciador que se estira |
| `bm-muted`, `bm-label` | Texto pequeño atenuado; etiqueta de campo |
| `bm-input` | Input, select, textarea |
| `bm-btn` (`secondary`, `danger`) | Botones |
| `bm-list`, `bm-list-item`, `bm-empty` | Listas y el estado vacío |
| `bm-stats`, `bm-stat`, `bm-stat-label`, `bm-stat-value` | Tarjetas de estadísticas |
| `bm-chart` | Contenedor de gráfico de altura fija |

Chart.js 3.8.0 está disponible como `window.Chart` después de cargar `bm://app/vendor/chart.min.js` con una etiqueta `<script>` clásica. Tome los colores de los ejes de `bm.theme.chart`, reconstruya los gráficos en `bm.onTheme` y mantenga los colores de las series en una configuración.

## 9. Plugins

Un plugin aporta solo CSS. Sus hojas de estilo se cargan después de los estilos del tema, en el shell y en cada página, así que una regla de igual especificidad en un plugin gana. Los plugins pueden sobrescribir las variables del tema (`:root { --br: #444; }`, o por tema con `:root[data-theme="light"]`), reestilizar las clases del kit de UI y los selectores estables del shell (`.shell-header`, `.nav-link`, `.dialog`, `.dialog-btn`, `.settings-card`, `.settings-row`, `.palette`, ...), y cargar fuentes locales con `@font-face`. Las URL externas y `@import` no están disponibles porque la aplicación funciona sin conexión. El usuario activa y desactiva plugins en Ajustes → Apariencia.

## 10. Escribir un módulo de página

1. Cree `src/renderer/modules/<id>/` (o `userData/modules/<id>/` para un módulo de usuario) con `manifest.json`, `index.html`, `module.css`, `js/`, `locales/` y `README.md`.
2. En `index.html` enlace `bm://app/vendor/fonts/fonts.css`, `bm://app/shared/base.css`, `bm://app/shared/components.css` si usa el kit, su propio CSS, opcionalmente `bm://app/vendor/chart.min.js`, y `<script type="module" src="./js/main.js">`.
3. `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { MyModule } from './MyModule.js';

bm.ready.then(() => new MyModule(bm, document).start());
```

4. Ponga la lógica en clases: cálculos puros sin acceso al DOM, una clase de vista para el trabajo con el DOM, una clase de repositorio para las llamadas a canales y un orquestador que las conecte.
5. Persista los datos mediante `bm.storage` (módulos de usuario) o mediante canales dedicados (módulos del sistema).
6. Construya el DOM con `createElement` y `textContent`; no asigne datos a `innerHTML`.
7. Describa el módulo en su `README.md`: propósito, canales, configuraciones, archivos, comportamiento.

Las guías paso a paso escritas para asistentes de IA están en [docs/en/ai](../ai): `MODULE_GUIDE.md` para páginas y `PLUGIN_GUIDE.md` para plugins.
