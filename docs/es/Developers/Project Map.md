# BIOMASHINE: Mapa del proyecto

Este documento describe cómo está construido BIOMASHINE: el modelo de procesos, la estructura del repositorio, el contrato IPC, la capa de datos, la configuración, la localización, las zonas horarias y el pipeline de compilación. Los autores de módulos deberían leerlo junto con [Modules.md](Modules.md).

## 1. Visión general

BIOMASHINE es un entorno operativo para el registro personal. Es una aplicación de escritorio totalmente sin conexión: sin servidor, sin cuentas, sin peticiones de red, sin CDN. Todo se almacena en una base de datos SQLite local.

| Capa | Tecnología |
|---|---|
| Shell | Electron (proceso principal, script de precarga, renderer) con `contextIsolation: true` y `sandbox: true` |
| Almacenamiento | SQLite mediante `better-sqlite3`, un archivo por instalación |
| UI a datos | Un canal IPC (`api`) con un despachador que enruta nombres `domain:action` a controladores |
| UI | Un shell de renderer más páginas («módulos») que se ejecutan en iframes aislados, módulos ES, Chart.js y fuentes empaquetadas desde npm |
| Estilo de código | Orientado a objetos, una clase por archivo, constantes en configuraciones JSON |

## 2. Modelo de procesos

```
┌────────────────────────── proceso principal ──────────────────────┐
│ Application ─ Container (raíz de composición)                     │
│   IpcRouter ─ Controllers ─ Services ─ Repositories ─ SQLite      │
│   ProtocolHandler (bm://)   WindowManager   ShortcutService       │
└────────────▲──────────────────────────────────────────────────────┘
             │ ipcRenderer.invoke('api', channel, payload)
┌────────────┴─── renderer: shell (bm://app/shell/index.html) ───────┐
│ window.api (preload)   ShellApp   ModuleBridge   SettingsView ...  │
│   ┌──────── iframe bm://<module-id>/index.html ────────┐           │
│   │ SDK (bm)  ──postMessage──►  ModuleBridge           │           │
│   └─────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────┘
```

- El proceso principal posee la base de datos, la configuración, la autenticación y toda capacidad que toque el sistema operativo (diálogos, inicio automático, enlaces externos, estado de la ventana).
- El script de precarga expone exactamente un objeto, `window.api`, al shell: `invoke(channel, payload)`, `onShortcut(handler)` y `onWindowState(handler)`. Los módulos no lo reciben.
- Cada módulo de página se ejecuta en su propio `<iframe>` con su propio origen (`bm://<module-id>`). Un módulo habla con el shell mediante un puente `postMessage`; el shell comprueba los permisos de canal declarados por el módulo y reenvía las llamadas permitidas al proceso principal. Véase [Modules.md](Modules.md).
- Los archivos se sirven mediante un protocolo privilegiado personalizado, `bm://`. `bm://app/...` se asigna a `src/renderer`; `bm://<module-id>/...` se asigna a la carpeta de ese módulo. El resolutor rechaza cualquier ruta que escape del directorio base.

## 3. Estructura del repositorio

```
build/                    iconos de la aplicación (ico, png, icns) y splash del lanzador portátil
config/                   todos los ajustes y constantes como JSON
migrations/               migraciones SQL, aplicadas en orden, versión almacenada en PRAGMA user_version
scripts/prepare.js        copia Chart.js y fuentes desde node_modules a src/renderer/vendor
scripts/i18n.js           npm run i18n: status, files, add, check
src/main/
  main.js                 punto de entrada
  Application.js          ciclo de vida de Electron: instancia única, esquema privilegiado, creación de ventana
  Container.js            construye cada servicio, repositorio y controlador
  ElectronSystem.js       adaptador del sistema operativo: diálogos, inicio automático, reinicio, enlaces externos, estado de ventana
  WindowManager.js        ventana, guarda de navegación, eventos de pantalla completa
  ProtocolHandler.js      sirve archivos bm://
  ShortcutService.js      atajos globales (F11, Ctrl/Cmd+P)
  PortablePaths.js        carpeta de datos junto al programa en compilaciones portátiles
  core/                   Database, Migrator, ConfigService, IpcRouter, AssetResolver, BaseRepository,
                          BaseController, AppError, Attribution, Dates, Values, MimeTypes, MessageTranslator
  repositories/           el único lugar donde vive el SQL
  services/               AuthService, SettingsService, ClockService, LocaleService, ModuleRegistry,
                          ModuleService, ThemeCatalog, ExportService, SeedService, MessageService
  controllers/            manejadores IPC: validación y reglas de negocio
  locales/                diccionarios del backend (ru.json, en.json, ...): mensajes de error, problemas
src/preload/preload.js    window.api
src/renderer/
  shell/                  menú, inicio de sesión, ajustes, paleta de comandos, puente, diálogos, temas
  sdk/                    SDK de módulos (bm), traductor, reloj, protocolo de mensajes
  shared/                 base.css, components.css, diccionarios compartidos (locales/)
  modules/<id>/           módulos (manifest.json, index.html, module.css, js/, locales/, README.md)
  vendor/                 generado por scripts/prepare.js, no se almacena en git
docs/                     documentación
```

Los datos de usuario viven en el directorio `userData` de Electron (`%APPDATA%\BIOMASHINE` en Windows, `~/.config/BIOMASHINE` en Linux, `~/Library/Application Support/BIOMASHINE` en macOS):

```
biomashine.sqlite         la base de datos
config/                   sobrescrituras de configuración del usuario (véase la sección 7)
modules/                  módulos y plugins instalados por el usuario
locales/                  archivos de idioma del usuario (véase la sección 10)
```

En compilaciones portátiles (Windows `portable`, Linux AppImage) se crea la misma estructura en una carpeta `BIOMASHINE-data` junto al ejecutable, de modo que el programa y sus datos puedan moverse juntos.

## 4. Ciclo de vida y composición de la aplicación

`Application.run()`:

1. Establece la carpeta de datos (modo portátil) y adquiere un bloqueo de instancia única.
2. Construye el `Container` antes de que la aplicación esté lista. Esto abre la base de datos, ejecuta migraciones, carga la configuración y registra cada controlador.
3. Registra el esquema privilegiado `bm://` y establece el interruptor `lang` de Chromium a partir del idioma de interfaz seleccionado (esto controla el formato de los campos nativos `<input type="date">`).
4. Después de `ready`: conecta el manejador de protocolo, el router IPC y la ventana.

`Container` es la única raíz de composición. Las dependencias se pasan mediante constructores; nada es global. Cada clase toma lo que necesita, lo que mantiene el proceso principal libre de código específico de Electron excepto por las clases delgadas `ElectronSystem`, `WindowManager`, `ProtocolHandler` y `Application`.

## 5. Contrato IPC

```js
const data = await window.api.invoke('domain:action', payload);
```

El router responde con `{ ok: true, data }` o `{ ok: false, status, error, code? }`; el script de precarga convierte el fallo en un `Error` lanzado que lleva `message`, `status` y, cuando existe, `code`. Estados comunes: `400` entrada inválida, `401` bloqueado, `403` prohibido, `404` no encontrado. El `code` opcional es la clave del diccionario desde la que se tradujo el mensaje (véase la sección 10); un error inesperado oculta los detalles tras `error.internal` y nunca lleva `code`.

**Puerta de autenticación.** Cuando se establece una contraseña, cada canal excepto aquellos cuyo nombre empieza por un prefijo listado en `app.json` → `ipc.openPrefixes` (`auth:`, `settings:get`, `config:get`, `i18n:bundle`, `i18n:languages`, `window:`, `shortcuts:`) devuelve `401` hasta que el usuario inicia sesión.

**Convenciones de datos.**

| Tipo | Formato |
|---|---|
| Fecha | `YYYY-MM-DD` |
| Marca de tiempo | `YYYY-MM-DD HH:MM:SS` (hora de pared en la zona horaria seleccionada, sin sufijo de zona) |
| Hora del día | `HH:MM:SS` (`HH:MM` para entrenamientos) |
| Números | números JSON |
| Booleanos | `true` / `false` |
| Columnas JSON | devueltas como objetos y arrays |
| Identificadores | números |

### Canales de datos de salud

Los parámetros marcados con `?` son opcionales. Los canales de escritura exitosos devuelven `null` salvo que se indique lo contrario.

| Canal | Payload | Resultado |
|---|---|---|
| `profile:get` | | `{height, age, trainings_count}` |
| `profile:overview` | | `{user, measurements, goals}` |
| `profile:updateParams` | `{height, age, trainings_count}` | perfil actualizado (altura y edad enteros positivos, entrenamientos un entero ≥ 0) |
| `measurements:list` | | `[{date, weight, fat, water}]` ordenados por fecha |
| `measurements:save` | `{date, weight, fat?, water?}` | upsert por fecha |
| `measurements:remove` | `{date}` | `404` si no existe |
| `measurements:getGoals` | | `{weight_goal, fat_goal, deadline}` (null cuando no están establecidos) |
| `measurements:saveGoals` | `{weight_goal, fat_goal, deadline}` | |
| `sleep:listLogs` | | `[{id, start_time, end_time}]`, los más recientes primero |
| `sleep:addLog` | `{start_time, end_time}` (separador `T` o espacio) | `{id}`; `400` a menos que el fin sea posterior al inicio |
| `sleep:removeLog` | `{id}` | |
| `sleep:getSchedule` | | `{ideal_bedtime, ideal_waketime}` (null cuando no están establecidos) |
| `sleep:saveSchedule` | `{ideal_bedtime, ideal_waketime}` | |
| `sleep:resetSchedule` | | borra el horario ideal |
| `sleep:listNoSleep` | | `["YYYY-MM-DD", ...]` |
| `sleep:addNoSleep` | `{date}` | `400` cuando el día ya tiene registros de sueño |
| `sleep:removeNoSleep` | `{date}` | |
| `nutrition:list` | | `[{id, date, name, weight, calories, protein, fat, carbs}]`, los más recientes primero |
| `nutrition:add` | `{date, name, weight, calories?, protein?, fat?, carbs?}` | `{id}`; los macros faltantes se convierten en 0 |
| `nutrition:remove` | `{id}` | |
| `running:list` | | `[{id, date, time_seconds, distance, calories, start_speed, max_speed, incline}]` |
| `running:add` | `{date, time_seconds, distance, calories?, start_speed?, max_speed?, incline?}` | `{id}` |
| `running:remove` | `{id}` | |
| `running:getGoals` | | `{distance_target, distance_deadline, time_target, time_deadline, calories_target, calories_deadline}` |
| `running:saveGoal` | `{goal_type: "distance"\|"time"\|"calories", target, deadline\|null}` | actualiza un objetivo |
| `workouts:list` | | `[{id, date, start_time, end_time, type: "home"\|"gym", note, exercises: [{id, exercise_name, sets, reps, weight, note}]}]` |
| `workouts:create` | `{date, start_time?, end_time?, type, note?, exercises: [...≥1]}` | `{id}` |
| `workouts:update` | `{id, ...same as create}` | los ejercicios se reemplazan por completo |
| `workouts:remove` | `{id}` | |
| `workouts:listTemplates` | | `[{id, name, exercises: [{id, exercise_name, sets, reps}]}]` |
| `workouts:createTemplate` | `{name, exercises: [{exercise_name, sets, reps}]}` | `{id}` |
| `workouts:removeTemplate` | `{id}` | |
| `workouts:getGoals` | | `{weekly_target, exercise_goals: [{exercise_name, target_reps, target_weight}]}` |
| `workouts:saveGoals` | `{weekly_target, exercise_goals}` | la lista de objetivos se reemplaza por completo |
| `reaction:list` | | `[{id, date, values: [numbers], average}]` |
| `reaction:add` | `{values: [numbers], average}` | `{id}` |
| `reaction:remove` | `{id}` | |
| `mood:list` | | `[{id, date, time, mood, anxiety, fear, sadness, anger, energy, tension, motivation, stress, comment}]` |
| `mood:save` | `{date, time, mood, anxiety?, ..., comment?}` | una entrada por fecha; guardar de nuevo sobrescribe |
| `mood:remove` | `{id}` | |

### Canales del sistema

| Canal | Propósito |
|---|---|
| `auth:status`, `auth:setup`, `auth:login`, `auth:lock`, `auth:change`, `auth:remove` | Protección opcional con inicio de sesión y contraseña |
| `settings:get`, `settings:set`, `settings:relaunch` | Ajustes (`theme`, `autostart`, `language`, `timezone`) y reinicio de la aplicación |
| `config:get`, `config:errors`, `config:openFolder` | Leer una configuración (cualquiera excepto las privadas), listar problemas en las sobrescrituras del usuario, abrir la carpeta de sobrescrituras |
| `modules:list`, `modules:errors`, `modules:rescan`, `modules:openFolder`, `modules:setHidden`, `modules:setPinned`, `modules:reorderPinned`, `modules:setCategory`, `modules:categories`, `modules:createCategory`, `modules:removeCategory` | Registro de módulos y navegación |
| `storage:list`, `get`, `insert`, `update`, `remove`, `clear` | Almacenamiento de documentos por módulo (el shell inyecta el id del módulo) |
| `i18n:languages`, `bundle`, `master`, `export`, `openFolder`, `errors` | Idiomas y diccionarios |
| `clock:zones`, `clock:now` | Lista de zonas horarias y hora actual en la zona seleccionada |
| `window:state`, `window:toggleFullscreen`, `window:close` | Controles de ventana |
| `shortcuts:list`, `set`, `reset` | Registro y sobrescrituras de atajos globales |
| `notifications:schedule`, `cancel`, `list`, `setEnabled`, `modules` | Notificaciones de módulos |
| `trash:list`, `undo` | Registro de operaciones y deshacer |
| `about:info`, `about:open` | Información del autor y enlaces externos en lista blanca |
| `export:json`, `export:csv` | Exportar todos los datos mediante un diálogo de guardado |

## 6. Capa de datos

**Migraciones.** Los archivos `migrations/NNN_name.sql` se aplican en orden dentro de una transacción; la versión aplicada se almacena en `PRAGMA user_version`. Un nuevo cambio de esquema es un nuevo archivo; los archivos ya aplicados nunca se editan.

**Repositorios** extienden `BaseRepository` y son el único código que contiene SQL. Los controladores validan la entrada, traducen los resultados del repositorio al formato IPC e implementan reglas de negocio.

**Resumen del esquema.**

| Tabla | Propósito |
|---|---|
| `settings` | Almacén clave/valor (valores JSON): `theme`, `autostart`, `language`, `timezone`, `modules.hidden`, `window.bounds`, `auth.*` |
| `profile`, `weight_goals`, `running_goals`, `training_goals`, `sleep_schedule` | Tablas de una sola fila (`id = 1`) |
| `measurements`, `sleep_logs`, `no_sleep_days`, `nutrition_logs`, `running_logs`, `workouts`, `workout_exercises`, `workout_templates`, `template_exercises`, `exercise_goals`, `reaction_tests`, `mood_entries` | Datos de salud |
| `module_documents` | Documentos JSON de módulos de usuario, delimitados por `module_id` y `collection` |
| `notifications` | Notificaciones programadas desde módulos |
| `operations`, `operation_entries` | Registro de operaciones: una fila por petición que escribió en la base de datos, una fila por registro afectado |

**Marcas de tiempo.** Las tablas con marca de tiempo de creación reciben la marca mediante disparadores `AFTER INSERT` (migración `003`) que llaman a la función SQLite `bm_now()`. La aplicación registra esa función en cada conexión y la implementa con `ClockService`, de modo que cada `created_at` (y la fecha de una prueba de reacción) se escribe en la zona horaria seleccionada. La función no debe consultar la base de datos porque SQLite prohíbe consultas reentrantes desde dentro de una función de usuario; por eso la zona seleccionada se cachea en memoria.

**Exportación.** `export:json` vuelca cada tabla (excepto los ajustes `auth.*`); `export:csv` escribe un archivo CSV por cada tabla no vacía.

## 7. Configuración

Todas las constantes viven en `config/*.json`.

| Archivo | Contenido |
|---|---|
| `app.json` | Ventana, protocolo, página inicial, nombre del archivo de base de datos, valores predeterminados de ajustes, reglas de módulos, configuraciones privadas, límites de almacenamiento, autenticación, IPC, atajos, modo portátil, lista de idiomas, alias de zonas horarias, subconjuntos de fuentes |
| `themes.json` | Temas: variables CSS, colores de gráficos, título visible o clave de título |
| `charts.json` | Colores de series de gráficos por módulo |
| `health.json` | Valores de perfil predeterminados (usados solo en el primer arranque) |
| `achievements.json` | Logros de carrera (`nameKey`, `descriptionKey`, `required`) |
| `operations.json` | Etiquetas legibles para el registro de operaciones (`domain:action` → clave de diccionario) |
| `split.json` | Límites de la proporción de vista dividida |
| `kbju.json`, `nutrition.json`, `reaction.json`, `running.json`, `sleep.json`, `training.json`, `weight.json` | Constantes del módulo correspondiente |

**Sobrescrituras.** Los archivos con el mismo nombre en `userData/config` se fusionan sobre el archivo base: los objetos se fusionan recursivamente, los arrays y escalares se reemplazan. Un nuevo nombre de archivo se convierte en una nueva configuración. Un archivo con un error JSON se omite y el motivo se muestra en Ajustes. Los cambios se aplican tras reiniciar.

**Acceso.** `config:get` sirve cada configuración excepto las listadas en `app.json` → `privateConfigs` (actualmente `app`). Los módulos leen configuraciones mediante `bm.config(name)`.

**Temas** son validados por `ThemeCatalog` (13 variables CSS obligatorias, `colorScheme`, un título, colores de gráficos); un tema inválido se omite y se informa mediante `config:errors` como `theme.invalid` con un `reasonKey` anidado que el controlador expande.

## 8. Autenticación

La protección es opcional. Cuando está habilitada, el inicio de sesión y la contraseña se almacenan en `settings` (`auth.login`, `auth.salt`, `auth.hash`); el hash se deriva con scrypt y se compara en tiempo constante. El estado desbloqueado vive solo en memoria y se restablece al bloquear o reiniciar. Estas claves nunca se exportan.

## 9. Shell y entorno

- **Navegación.** El shell lista los módulos de página visibles y Ajustes en la cabecera. Ocultar un módulo solo lo quita del menú; sus datos permanecen. Las páginas fijadas aparecen primero, en `pinOrder`; las no fijadas se sitúan en categorías. `Ctrl+Click` (`Cmd+Click` en macOS) abre un segundo módulo junto al actual (véase la sección 11).
- **Paleta de comandos.** `Ctrl+P` (`Cmd+P` en macOS) abre un conmutador rápido con búsqueda difusa sobre módulos y Ajustes. Los comandos provienen de proveedores, de modo que se pueden añadir nuevos tipos de comandos sin cambiar la paleta.
- **Atajos** se interceptan en el proceso principal mediante `before-input-event`, por lo que funcionan incluso cuando el foco está dentro de un iframe de módulo. Están vinculados a teclas físicas (`KeyP`, `F11`), lo que los hace independientes de la distribución del teclado. Las definiciones y sobrescrituras viven en `app.json` → `shortcuts` y `settings.shortcuts`.
- **Pantalla completa.** `F11` alterna la pantalla completa; mientras está activa, el shell muestra botones para salir o cerrar la aplicación.
- **Arranque.** La ventana se abre con un fondo oscuro y una pantalla de carga; la compilación portátil de Windows muestra `build/splash.bmp` mientras se desempaqueta.
- **Atribución.** El nombre del autor y los tres enlaces mostrados en el bloque Acerca de de Ajustes son constantes en `src/main/core/Attribution.js`. Intencionadamente no son configurables, y los enlaces externos se abren solo desde esta lista blanca. Son exigidos por la licencia del proyecto y deben conservarse.

## 10. Localización

Las cadenas viven en diccionarios llamados `locales/<code>.json`: objetos planos que asignan una clave a una cadena, o a un objeto de formas plurales. La guía completa está en [Localization.md](Localization.md).

| Ámbito | Ubicación |
|---|---|
| `shell` | `src/renderer/shell/locales` |
| `shared` | `src/renderer/shared/locales` (unidades, botones comunes, títulos de temas y logros) |
| `backend` | `src/main/locales` (mensajes del proceso principal: errores, problemas en configuraciones, módulos y diccionarios) |
| módulo `<id>` | `<module folder>/locales` (módulos con `"i18n": true` en el manifiesto) |

`LocaleService` construye el conjunto de cadenas para un ámbito y un idioma recorriendo una cadena de respaldo (el idioma seleccionado, luego el respaldo declarado del idioma, luego `default`, luego cada idioma de `builtin`) y superponiendo `shared` debajo del ámbito. El resultado se entrega a un módulo en su mensaje `init` y se lee mediante `bm.t(key, params)`. El ámbito `backend` se entrega al proceso principal mediante `MessageService`; `AppError` lleva una clave y parámetros, y `IpcRouter` traduce el mensaje antes de devolverlo.

- **Idiomas.** El ruso y el inglés se incluyen con la aplicación. El idioma de la interfaz se almacena en `settings`; en el primer arranque se elige a partir del sistema operativo, con inglés como respaldo.
- **Registro.** `app.json` → `i18n.builtin` lista los idiomas incluidos. `i18n.required` (por defecto `["ru", "en"]`) lista los idiomas para los que cada ámbito debe tener un diccionario. `i18n.reference` (por defecto `"ru"`) es el diccionario contra el que se comparan los demás. `i18n.source` (por defecto `"en"`) es el idioma usado para sembrar nuevas traducciones. Otros idiomas integrados son opcionales; cuando están presentes deben estar completos.
- **Idiomas de usuario.** Ajustes puede exportar una plantilla que contiene cada ámbito con sus claves. Una copia traducida se guarda como `userData/locales/<code>.json`:

```json
{
  "meta": { "code": "de", "name": "Deutsch", "locale": "de-DE", "fallback": "en" },
  "scopes": { "shell": { "nav.settings": "Einstellungen" }, "shared": {}, "backend": {}, "kbju": {} }
}
```

  Un archivo cuyo código sea `ru` o `en` parchea las cadenas integradas en lugar de añadir un idioma. Las claves faltantes recurren a lo largo de la cadena. Los problemas (JSON inválido, `meta` ausente, objetos plurales mal formados) se listan en Ajustes.
- **Herramienta.** `npm run i18n` (`status`, `files <code>`, `add`, `check`) impulsa todo el flujo: añadir un idioma, ver qué falta, comprobar que los diccionarios están completos y que las formas plurales coinciden con `Intl.PluralRules`. Véase [Localization.md](Localization.md) para la salida exacta de cada comando.
- **Formas plurales.** Un valor puede ser un objeto con las formas CLDR `zero`, `one`, `two`, `few`, `many`, `other` (`other` es obligatoria; un valor puede usar solo las formas que su locale define realmente). La forma se elige con `Intl.PluralRules` a partir del parámetro `count`. Los marcadores usan `{name}`.
- **Fuentes.** `config/app.json` → `fonts.subsets` (por defecto `["latin", "latin-ext", "cyrillic"]`) selecciona qué subconjuntos de `@fontsource` empaqueta `scripts/prepare.js`. Los sistemas de escritura que las fuentes empaquetadas no cubren (chino, japonés, coreano, árabe, hebreo, tailandés, devanagari y otros) se renderizan con una fuente del sistema mediante la cadena de respaldo de `base.css`.

## 11. Zonas horarias

El ajuste `timezone` es `system` o un nombre de zona IANA. `ClockService` formatea el momento actual en esa zona y lo usan la función de base de datos `bm_now()` (véase la sección 6) y los canales `clock:*`. En los módulos, `bm.clock` ofrece `now()`, `today()` y `timestamp()` para la misma zona. Los nombres de zona usan grafías modernas (por ejemplo `Asia/Kolkata`, `Europe/Kyiv`) mediante los alias en `app.json` → `timezones.aliases`.

## 12. Compilación y empaquetado

```
npm install        instala dependencias y recompila módulos nativos para Electron
npm start          prepara recursos e inicia la aplicación
npm run dist       prepara recursos y compila para el sistema operativo actual
npm run i18n       herramienta de localización (status, files, add, check)
```

`scripts/prepare.js` copia `chart.min.js` y los archivos de fuentes necesarios desde `node_modules` a `src/renderer/vendor` y genera `fonts.css`; es idempotente y se ejecuta antes de `start` y `dist`. Lee `config/app.json` → `fonts.subsets` y recurre a `["latin", "latin-ext", "cyrillic"]` cuando la lista está vacía o el archivo no se puede leer.

Objetivos de electron-builder (`package.json` → `build`):

| SO | Objetivos | Notas |
|---|---|---|
| Windows | `portable`, `zip`, `nsis` | Ejecutable único portátil con imagen splash, un archivo desempaquetado que arranca sin extracción y un instalador NSIS para el usuario actual |
| Linux | `AppImage` | Necesita `libfuse2` para ejecutarse |
| macOS | `zip` | Sin firmar ni notarizar |

`better-sqlite3` es un módulo nativo, así que cada plataforma debe compilarse en esa plataforma (o en un runner de CI compatible). `.github/workflows/release.yml` compila Windows, Linux y macOS (Apple Silicon e Intel) y crea un borrador de release de GitHub cuando se empuja una etiqueta que coincide con `v*`.

## 13. Convenciones

- Una clase por archivo; el nombre del archivo es igual al nombre de la clase.
- Los nombres y la estructura llevan el significado.
- Las constantes, umbrales y colores pertenecen a la configuración JSON; los textos pertenecen a los diccionarios.
- SQL solo en repositorios; validación y reglas de negocio en controladores.
- Cada cadena visible para el usuario, incluidos errores y mensajes de problemas, proviene de un diccionario. `AppError` lleva una clave y parámetros, nunca un mensaje terminado.
- El renderer nunca toca la base de datos ni el sistema de archivos directamente; todo pasa por canales.
- Cada carpeta de módulo tiene un `README.md` que describe propósito, canales, configuraciones, archivos y comportamiento.
