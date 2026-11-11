# BIOMASHINE: Guía de IA para crear un módulo de página

Audiencia: un modelo de lenguaje. El usuario no es programador. Te entrega este archivo y describe la página que quiere. Tú entregas los archivos del módulo terminados e instrucciones de instalación. No necesitas el código fuente de la aplicación: todo lo necesario está descrito aquí. Si falta algo necesario para la tarea, dile al usuario exactamente qué falta y no inventes una API.

## 1. Qué entregas

1. La carpeta del módulo `<id>/`. Cada archivo completo, cada uno en su propio bloque de código con la ruta en el encabezado.
2. Las instrucciones de instalación de la sección 14 con el `<id>` real rellenado.

Nada más. No sugieras cambiar el código fuente de la aplicación.

## 2. Reglas estrictas

**La petición explícita del usuario siempre gana.** Los usuarios de esta aplicación nunca son forzados a un estilo fijo. Todo lo relativo a la apariencia en esta guía (variables, el kit de UI, el aspecto predeterminado) es un valor por defecto que mantiene un módulo coherente con el resto de la aplicación, no una restricción. Si el usuario pide un color, fuente, tamaño, diseño o aspecto específico (por ejemplo, "haz este bloque morado"), haz exactamente eso con CSS personalizado, aunque difiera del estilo de la aplicación. No te niegues, discutas ni des lecciones sobre coherencia; si ayuda, menciona en una frase que el resultado se desvía del tema predeterminado. Solo los límites técnicos (sin red, el sandbox, las reglas de almacenamiento) no se pueden eludir.

Haz:
- Un módulo, una carpeta. El nombre de la carpeta es igual a `id` en `manifest.json`.
- JavaScript plano (módulos ES), HTML y CSS. Sin paso de compilación, sin npm.
- Almacena datos solo mediante `bm.storage` (sección 7).
- A menos que el usuario pida colores específicos, toma los colores de las variables CSS (sección 10) para que ambos temas funcionen.
- Pide confirmaciones con `bm.confirm`.
- Pon cada texto visible para el usuario en diccionarios y léelo con `bm.t` (sección 8). Un módulo debe incluir `locales/ru.json` y `locales/en.json`; otros idiomas son opcionales y el usuario puede añadirlos después.
- Toma la hora actual solo de `bm.clock` (sección 9).
- Escribe clases, una por archivo; mantén la lógica que no necesita DOM en clases separadas.

No:
- Uses `fetch`, `XMLHttpRequest`, `WebSocket`, enlaces externos, CDNs, fuentes o imágenes externas. No hay red.
- Uses `localStorage`, `sessionStorage`, IndexedDB o cookies: esos datos no aparecerían en la exportación.
- Uses `alert`, `confirm`, `prompt` o `window.open`: están bloqueados.
- Uses `eval` o `document.write`.
- Llames a `bm.invoke` ni leas datos de otros módulos: en esta versión un módulo trabaja solo con su propio almacenamiento.
- Cambies `id` después de la primera instalación: los datos están vinculados a él.
- Añadas bibliotecas de terceros. La excepción es Chart.js, que la aplicación ya proporciona (sección 11).

## 3. Estructura de carpetas

    <id>/
      manifest.json
      index.html
      locales/
        ru.json
        en.json
      js/
        main.js
        <YourClass>.js

Otros archivos (CSS, imágenes, fuentes) están permitidos; referéncialos con rutas relativas. `README.md` es opcional para módulos de usuario.

## 4. manifest.json

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `id` | string | sí | `^[a-z][a-z0-9-]*$`, igual al nombre de la carpeta, no `app`, `shell` ni `shared`, único |
| `kind` | string | sí | siempre `"page"` |
| `title` | string | sí | etiqueta del menú, corta (respaldo cuando falta la clave del diccionario) |
| `version` | string | no | `"1.0.0"` |
| `description` | string | no | una línea para la lista de ajustes |
| `order` | number | no | posición en el menú; los módulos de usuario por defecto son 1000 (último) |
| `entry` | string | no | por defecto `index.html` |
| `i18n` | boolean | no | establece `true`: el título y la descripción se toman entonces de las claves del diccionario `module.title` y `module.description` |
| `channels` | array | no | para esta guía siempre `[]` |

## 5. Esqueleto de index.html

Enlaza exactamente así; no cambies las rutas. La línea de Chart.js solo es necesaria cuando hay gráficos.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Title</title>
    <link rel="stylesheet" href="bm://app/vendor/fonts/fonts.css">
    <link rel="stylesheet" href="bm://app/shared/base.css">
    <link rel="stylesheet" href="bm://app/shared/components.css">
    <script src="bm://app/vendor/chart.min.js"></script>
    <script type="module" src="./js/main.js"></script>
</head>
<body>
<main class="bm-page">
    ...
</main>
</body>
</html>
```

Punto de entrada `js/main.js`:

```js
import { bm } from 'bm://app/sdk/bm.js';
import { App } from './App.js';

bm.ready.then(() => new App(bm, document, window.Chart).start());
```

Espera siempre a `bm.ready` antes de tocar `bm`.

## 6. El SDK: el objeto `bm`

| Llamada | Devuelve | Descripción |
|---|---|---|
| `bm.ready` | `Promise` | Se resuelve cuando la conexión, el tema, el idioma y la zona horaria están listos |
| `bm.storage.*` | ver sección 7 | El almacenamiento de datos del módulo |
| `bm.t(key, params)` | string | Traduce una clave (sección 8) |
| `bm.locale`, `bm.language` | string | La configuración regional para `toLocaleString` (por ejemplo `en-US`) y el código de idioma |
| `bm.clock` | object | Hora en la zona horaria seleccionada por el usuario (sección 9) |
| `bm.confirm(text, options)` | `Promise<boolean>` | Diálogo. `options`: `confirmText`, `cancelText`, `danger` (botón rojo) |
| `bm.setPills(items)` | nada | Pequeñas etiquetas en el lado derecho de la cabecera. `items` es un array de cadenas; un array vacío las borra |
| `bm.theme` | object | `{ name: 'dark' \| 'light', colorScheme, variables, chart: { text, grid } }` |
| `bm.onTheme(fn)` | función para cancelar suscripción | `fn` se ejecuta cuando el tema cambia; reconstruye los gráficos en ella |
| `bm.config(name)` | `Promise<object>` | Lee una configuración de la aplicación. Normalmente no es necesario |

Cada llamada que devuelve una promesa se rechaza con un `Error` que tiene un `message` y un `status` numérico; cuando el fallo provino de una clave de diccionario traducida, el error también tiene `code`.

## 7. Almacenamiento: `bm.storage`

Almacena documentos JSON en colecciones con nombre. El almacenamiento está aislado: un módulo solo ve sus propios datos. Los datos se incluyen en la exportación JSON y CSV.

| Llamada | Devuelve |
|---|---|
| `list(collection)` | `Promise<Document[]>` en orden de creación (`id` ascendente) |
| `get(collection, id)` | `Promise<Document>`; se rechaza con `status` 404 si no existe |
| `insert(collection, data)` | `Promise<number>`: el nuevo `id` |
| `update(collection, id, data)` | `Promise<void>`: reemplaza `data` por completo, no fusiona |
| `remove(collection, id)` | `Promise<void>`, se rechaza con 404 si no existe |
| `clear(collection)` | `Promise<number>`: cuántos documentos se eliminaron |

Un documento es `{ id: number, data: object, createdAt: string, updatedAt: string }`. La aplicación establece las horas de creación y actualización.

Reglas:
- Nombre de colección: `^[a-z][a-z0-9_-]{0,39}$`.
- `data`: un objeto plano serializable a JSON de como máximo 262144 bytes. No un array, no una cadena. Sin `undefined`, funciones ni objetos `Date`. Almacena los momentos en el tiempo como la cadena de `bm.clock.timestamp()`.
- Filtra, ordena y agrega en JavaScript después de `list`.
- Mantén los ajustes singleton como un documento en una colección `settings`: `list`, luego `update` el primer documento o `insert` si está vacío (véase el ejemplo).
- No cambies el esquema de datos de forma incompatible: cuando añadas un campo, recuerda que los documentos antiguos no lo tienen.

## 8. Texto e idiomas

La aplicación es multilingüe: el usuario elige el idioma, así que ningún texto visible para el usuario puede estar codificado de forma fija en JavaScript o HTML. Antes de escribir, aclara con el usuario si necesita traducción a dos idiomas.

- `locales/ru.json` y `locales/en.json`: objetos planos `"clave": "texto"`. Las claves en ambos archivos deben ser idénticas. `module.title` y `module.description` son obligatorias.
- **`ru` y `en` son obligatorios.** Ambos archivos deben existir y estar completos. La aplicación también admite otros idiomas (el registro integrado es `config/app.json` → `i18n.builtin`): esos archivos son opcionales en un módulo, pero si está presente un archivo para un idioma integrado, debe cubrir las mismas claves que `ru` y pasar la misma comprobación de completitud. El usuario también puede colocar una traducción en `userData/locales/<code>.json` en tiempo de ejecución; el módulo la recoge automáticamente a través de la cadena de respaldo.
- JavaScript: `bm.t('key')`; con parámetros `bm.t('key', { n: 5 })` (el texto contiene `{n}`); con formas plurales `bm.t('key', { count: 5 })` (el valor del diccionario es un objeto: `one`, `few`, `many`, `other` para ruso; `one`, `other` para inglés; otros idiomas usan las formas que define su configuración regional; nunca mezcles formas de un idioma en otro).
- HTML: `data-i18n="key"` reemplaza el texto del elemento, `data-i18n-placeholder="key"` y `data-i18n-title="key"` reemplazan los atributos. Mantén un texto predeterminado dentro del elemento.
- Fechas y números: `toLocaleString(bm.locale)`, nunca una configuración regional codificada de forma fija como `'en-US'`.
- Palabras comunes están disponibles sin declararlas: `common.delete`, `common.cancel`, `common.save`, `unit.ms`, `unit.g`, `unit.kcal`.
- Nunca construyas una frase a partir de piezas traducidas: una clave por frase.
- Una propiedad llamada `key` está reservada para claves de diccionario; usa otro nombre para cualquier otra cosa.

La guía completa de localización para toda la aplicación (ámbitos, registro, herramienta `npm run i18n`, formas plurales, sistemas de escritura y fuentes) es `docs/en/Developers/Localization.md`. Ese documento es para colaboradores; un autor de módulos solo necesita las reglas anteriores.

## 9. Tiempo: `bm.clock`

El usuario elige una zona horaria en Ajustes, así que nunca uses `new Date()`, `Date.now()` ni `toISOString()` para el momento actual.

| Llamada | Resultado |
|---|---|
| `bm.clock.now()` | Un objeto `Date` cuyos métodos `getHours()`, `getDate()` y similares muestran la hora de la zona seleccionada |
| `bm.clock.today()` | Una cadena `YYYY-MM-DD` |
| `bm.clock.timestamp()` | Una cadena `YYYY-MM-DD HH:MM:SS`. Almacena esto |

Analizar fechas leídas del almacenamiento (`new Date('2026-11-02 14:00:00')`) y formatearlas está bien.

## 10. Estilos

Por defecto, estiliza la página como el resto de la aplicación y toma los colores de las variables de abajo; las fuentes ya están cargadas (`JetBrains Mono` para texto, `Playfair Display` para números grandes). Cuando el usuario pida algo diferente, sigue al usuario (véase la regla al principio de la sección 2): escribe el CSS que pida en `module.css`, con los colores, fuentes o tamaños que quiera.

| Variable | Significado | Oscuro | Claro |
|---|---|---|---|
| `--bg` | fondo de página | `#121212` | `#f4f4f2` |
| `--s1` | fondo de tarjeta | `#1c1c1c` | `#ffffff` |
| `--s2` | fondo de entrada y bloques anidados | `#242424` | `#ececea` |
| `--s3` | fondo de hover y activo | `#2c2c2c` | `#e2e2df` |
| `--br` | bordes principales | `#2e2e2e` | `#d2d2ce` |
| `--br2` | divisores finos | `#262626` | `#dededa` |
| `--t` | texto principal | `#e8e8e8` | `#1c1c1c` |
| `--td` | texto secundario | `#a0a0a0` | `#5a5a5a` |
| `--tdd` | leyendas y pistas | `#6e6e6e` | `#8a8a8a` |
| `--tddd` | elementos más tenues | `#3a3a3a` | `#c4c4c0` |
| `--wh` | acento: encabezados, números grandes, botón primario | `#f0f0f0` | `#0d0d0d` |
| `--overlay` | capa oscura bajo diálogos | `rgba(0, 0, 0, 0.6)` | `rgba(0, 0, 0, 0.35)` |
| `--header-bg` | fondo de cabecera | `rgba(18, 18, 18, 0.92)` | `rgba(244, 244, 242, 0.92)` |

Uso: `color: var(--td); background: var(--s1); border: 1px solid var(--br);`. Las variables mantienen la página legible en todos los temas, así que prefíerelas cuando el usuario no tenga preferencia de color; los colores literales están bien cuando el usuario los quiera y para colores de datos en gráficos. El nombre del tema actual es el atributo `data-theme` en `<html>`.

El kit de UI de `components.css`. Prefíerelo sobre CSS personalizado:

| Clase | Propósito |
|---|---|
| `bm-page` | Contenedor de página en `<main>`, centra y limita el ancho |
| `bm-title` | Título de sección con una regla |
| `bm-card` | Tarjeta |
| `bm-row` | Fila con alineación y espacios |
| `bm-spacer` | Espaciador que se estira dentro de `bm-row` |
| `bm-muted` | Texto pequeño atenuado |
| `bm-label` | Etiqueta encima de un campo |
| `bm-input` | Input, `select`, `textarea` |
| `bm-btn` | Botón primario. Modificadores: `secondary`, `danger` |
| `bm-list` | Lista vertical |
| `bm-list-item` | Fila de lista: contenido a la izquierda, acción a la derecha |
| `bm-empty` | Marcador de posición para una lista vacía |
| `bm-stats` | Rejilla de tarjetas de estadísticas |
| `bm-stat` | Tarjeta |
| `bm-stat-label` | Leyenda de la tarjeta |
| `bm-stat-value` | Número grande de una tarjeta |
| `bm-chart` | Contenedor de gráfico de altura fija con un `<canvas>` dentro |

El CSS personalizado está bien para cualquier cosa que el kit no tenga. Ponlo en `module.css` en la carpeta del módulo y enlázalo después de `components.css`.

## 11. Gráficos

Chart.js 3.8.0 está disponible como `window.Chart` cuando `index.html` contiene `<script src="bm://app/vendor/chart.min.js"></script>`. Pasa `window.Chart` al constructor de tu clase, como en el ejemplo. Toma los colores de los ejes de `bm.theme.chart` y el color de los datos de `getComputedStyle(document.documentElement).getPropertyValue('--wh')`. Pon el canvas dentro de `.bm-chart`. Cuando el tema cambie (`bm.onTheme`), llama a `chart.destroy()` y construye el gráfico de nuevo.

## 12. Errores comunes

- Olvidar `await bm.ready`: el tema, el idioma y la conexión aún no están listos.
- Usar `window.Chart` sin la etiqueta `<script>`: no hay gráfico.
- Poner un objeto `Date` en `data`: se convierte en cadena después de guardar; almacena tú mismo la cadena de `bm.clock.timestamp()`.
- Esperar que `update` fusione campos: reemplaza el documento.
- Usar `confirm()`: está bloqueado; usa `bm.confirm`.
- Nombrar la carpeta de una forma y `id` de otra: el módulo se rechaza.
- Usar letras mayúsculas en `id`.
- Dejar texto en el código o en HTML sin una clave de diccionario.
- Incluir solo un archivo de diccionario: `locales/ru.json` y `locales/en.json` son ambos obligatorios.

## 13. Ejemplo completo: un contador de cigarrillos

Los archivos de abajo están listos para instalar. Úsalos como modelo para estructura y estilo. (Los textos predeterminados del ejemplo están en inglés; se muestran ambos diccionarios.)

`cigarettes/manifest.json`

```json
{
  "id": "cigarettes",
  "kind": "page",
  "title": "Cigarettes",
  "version": "1.0.0",
  "description": "Cigarette counter with a daily limit and a 7-day chart",
  "order": 500,
  "entry": "index.html",
  "channels": [],
  "i18n": true
}
```

`cigarettes/locales/ru.json`

```json
{
  "module.title": "Сигареты",
  "module.description": "Счётчик выкуренных сигарет с дневной нормой и графиком за 7 дней",
  "page.title": "Сигареты",
  "btn.add": "+1 сигарета",
  "goal.label": "Норма в день",
  "section.stats": "Статистика",
  "section.week": "Последние 7 дней",
  "section.journal": "Журнал",
  "stat.today": "Сегодня",
  "stat.week": "За 7 дней",
  "stat.average": "В среднем в день",
  "journal.empty": "Записей нет",
  "journal.confirmDelete": "Удалить запись?",
  "chart.label": "Сигарет в день",
  "pill.entries": {
    "one": "{count} запись",
    "few": "{count} записи",
    "many": "{count} записей",
    "other": "{count} записи"
  }
}
```

`cigarettes/locales/en.json`

```json
{
  "module.title": "Cigarettes",
  "module.description": "Cigarette counter with a daily limit and a 7-day chart",
  "page.title": "Cigarettes",
  "btn.add": "+1 cigarette",
  "goal.label": "Daily limit",
  "section.stats": "Statistics",
  "section.week": "Last 7 days",
  "section.journal": "Journal",
  "stat.today": "Today",
  "stat.week": "Last 7 days",
  "stat.average": "Daily average",
  "journal.empty": "No entries",
  "journal.confirmDelete": "Delete this entry?",
  "chart.label": "Cigarettes per day",
  "pill.entries": {
    "one": "{count} entry",
    "other": "{count} entries"
  }
}
```

`cigarettes/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title data-i18n="page.title">Cigarettes</title>
    <link rel="stylesheet" href="bm://app/vendor/fonts/fonts.css">
    <link rel="stylesheet" href="bm://app/shared/base.css">
    <link rel="stylesheet" href="bm://app/shared/components.css">
    <script src="bm://app/vendor/chart.min.js"></script>
    <script type="module" src="./js/main.js"></script>
</head>
<body>
<main class="bm-page">
    <div class="bm-card">
        <div class="bm-row">
            <button class="bm-btn" id="add-btn" data-i18n="btn.add">+1 cigarette</button>
            <div class="bm-spacer"></div>
            <div>
                <label class="bm-label" for="goal-input" data-i18n="goal.label">Daily limit</label>
                <input class="bm-input" id="goal-input" type="number" min="0" step="1">
            </div>
        </div>
    </div>

    <div class="bm-title" data-i18n="section.stats">Statistics</div>
    <div class="bm-stats" id="stats"></div>

    <div class="bm-title" data-i18n="section.week">Last 7 days</div>
    <div class="bm-card">
        <div class="bm-chart"><canvas id="week-chart"></canvas></div>
    </div>

    <div class="bm-title" data-i18n="section.journal">Journal</div>
    <div class="bm-card">
        <div class="bm-list" id="journal"></div>
    </div>
</main>
</body>
</html>
```

`cigarettes/js/main.js`

```js
import { bm } from 'bm://app/sdk/bm.js';
import { CigaretteApp } from './CigaretteApp.js';

bm.ready.then(() => new CigaretteApp(bm, document, window.Chart).start());
```

`cigarettes/js/CigaretteApp.js`

```js
import { CigaretteStore } from './CigaretteStore.js';
import { DayCounter } from './DayCounter.js';

export class CigaretteApp {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.store = new CigaretteStore(bm.storage);
        this.chart = null;
        this.entries = [];
        this.goal = 10;
    }

    async start() {
        this.doc.getElementById('add-btn').addEventListener('click', () => this.add());
        this.doc.getElementById('goal-input').addEventListener('change', (event) => this.changeGoal(event.target.value));
        this.bm.onTheme(() => this.renderChart());
        await this.reload();
    }

    async reload() {
        this.goal = await this.store.getGoal();
        this.entries = await this.store.listEntries();
        this.doc.getElementById('goal-input').value = this.goal;
        this.render();
    }

    async add() {
        await this.store.addEntry(this.bm.clock.timestamp());
        await this.reload();
    }

    async changeGoal(value) {
        const goal = Math.max(0, Math.round(Number(value)) || 0);
        await this.store.saveGoal(goal);
        await this.reload();
    }

    async remove(id) {
        if (await this.bm.confirm(this.bm.t('journal.confirmDelete'), { confirmText: this.bm.t('common.delete'), danger: true })) {
            await this.store.removeEntry(id);
            await this.reload();
        }
    }

    render() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const today = week[week.length - 1].count;
        const total = week.reduce((sum, day) => sum + day.count, 0);
        this.renderStats([
            [this.bm.t('stat.today'), `${today} / ${this.goal}`],
            [this.bm.t('stat.week'), total],
            [this.bm.t('stat.average'), (total / 7).toFixed(1)]
        ]);
        this.renderJournal();
        this.renderChart();
        this.bm.setPills([this.bm.t('pill.entries', { count: this.entries.length })]);
    }

    renderStats(items) {
        this.doc.getElementById('stats').replaceChildren(
            ...items.map(([label, value]) => {
                const card = this.doc.createElement('div');
                card.className = 'bm-stat';
                const title = this.doc.createElement('div');
                title.className = 'bm-stat-label';
                title.textContent = label;
                const number = this.doc.createElement('div');
                number.className = 'bm-stat-value';
                number.textContent = value;
                card.append(title, number);
                return card;
            })
        );
    }

    renderJournal() {
        const journal = this.doc.getElementById('journal');
        if (this.entries.length === 0) {
            const empty = this.doc.createElement('div');
            empty.className = 'bm-empty';
            empty.textContent = this.bm.t('journal.empty');
            journal.replaceChildren(empty);
            return;
        }
        journal.replaceChildren(
            ...[...this.entries].reverse().slice(0, 10).map((entry) => {
                const item = this.doc.createElement('div');
                item.className = 'bm-list-item';
                const time = this.doc.createElement('span');
                time.textContent = new Date(entry.data.at).toLocaleString(this.bm.locale);
                const button = this.doc.createElement('button');
                button.className = 'bm-btn secondary';
                button.textContent = this.bm.t('common.delete');
                button.addEventListener('click', () => this.remove(entry.id));
                item.append(time, button);
                return item;
            })
        );
    }

    renderChart() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const colors = this.bm.theme.chart;
        const accent = getComputedStyle(this.doc.documentElement).getPropertyValue('--wh').trim();
        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new this.ChartClass(this.doc.getElementById('week-chart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: week.map((day) => day.key.slice(5)),
                datasets: [{ label: this.bm.t('chart.label'), data: week.map((day) => day.count), backgroundColor: accent }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } }
                }
            }
        });
    }
}
```

`cigarettes/js/CigaretteStore.js`

```js
export class CigaretteStore {
    static ENTRIES = 'entries';
    static SETTINGS = 'settings';

    constructor(storage) {
        this.storage = storage;
    }

    listEntries() {
        return this.storage.list(CigaretteStore.ENTRIES);
    }

    addEntry(timestamp) {
        return this.storage.insert(CigaretteStore.ENTRIES, { at: timestamp });
    }

    removeEntry(id) {
        return this.storage.remove(CigaretteStore.ENTRIES, id);
    }

    async getGoal() {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        return document ? document.data.goal : 10;
    }

    async saveGoal(goal) {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        if (document) {
            await this.storage.update(CigaretteStore.SETTINGS, document.id, { goal });
        } else {
            await this.storage.insert(CigaretteStore.SETTINGS, { goal });
        }
    }
}
```

`cigarettes/js/DayCounter.js`

```js
export class DayCounter {
    static dayKey(date) {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    static lastDays(entries, days, today) {
        const counts = new Map();
        for (const entry of entries) {
            const key = DayCounter.dayKey(new Date(entry.data.at));
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        const result = [];
        for (let offset = days - 1; offset >= 0; offset -= 1) {
            const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
            const key = DayCounter.dayKey(day);
            result.push({ key, count: counts.get(key) || 0 });
        }
        return result;
    }
}
```

## 14. Instrucciones de instalación (dáselas al usuario)

1. Abre la aplicación, ve a **Ajustes**, encuentra el bloque **Módulos** y haz clic en **Abrir carpeta de módulos**.
2. Copia la carpeta completa `<id>` en la carpeta que se abrió. Deberías terminar con `.../modules/<id>/manifest.json`.
3. Vuelve a la aplicación y haz clic en **Volver a escanear** en Ajustes. Aparece el nuevo elemento de menú.
4. Si no aparece, el motivo se muestra en rojo debajo de la lista de módulos. Envíamelo y lo arreglaré.
5. Si la página se abre pero dice que el módulo se ha bloqueado, envíame el texto del error que se muestra en pantalla.
6. Para eliminar el módulo, borra su carpeta y haz clic en **Volver a escanear**. Los datos que guardó permanecen en la base de datos.
7. Para añadir otro idioma más tarde, coloca un archivo `<code>.json` en `userData/locales` (Ajustes → Idiomas → Abrir carpeta de idiomas); el módulo lo recoge automáticamente.

## 15. Lista de verificación previa a la entrega

- `id` es igual al nombre de la carpeta y coincide con el patrón.
- En `manifest.json`: `kind` es `"page"`, `channels` es `[]`, `i18n` es `true`.
- `index.html` enlaza fonts.css, base.css, components.css y `main.js` como `type="module"`.
- `main.js` espera a `bm.ready`.
- `locales/ru.json` y `locales/en.json` existen y tienen claves idénticas, incluidos `module.title` y `module.description`. Esos dos son los idiomas obligatorios; un tercer archivo es opcional pero, si está presente, debe estar completo.
- Sin texto visible para el usuario codificado de forma fija, sin configuración regional codificada de forma fija.
- Sin `fetch`, `localStorage`, `alert`, `confirm`, enlaces externos, `new Date()` ni `Date.now()` para el momento actual.
- Cada `getElementById` tiene un `id` correspondiente en el HTML.
- Los datos van solo a través de `bm.storage`; los nombres de colección coinciden con el patrón.
- Colores a través de variables, a menos que el usuario haya pedido colores específicos (entonces su petición se implementa exactamente).
- Cada archivo se entrega completo.
- Las instrucciones de instalación se incluyen con el `<id>` real.
