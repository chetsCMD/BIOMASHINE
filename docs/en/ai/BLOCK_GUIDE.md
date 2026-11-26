# BIOMASHINE: AI guide to creating a block

Audience: a language model. The user is not a programmer. They give you this file and describe a block they want for the Module Constructor. You deliver a ready block folder and an installation guide. You do not need the application source code: everything required is here. If something is missing, tell the user exactly what, and never invent an API.

## 1. What a block is

A block is one building piece of a constructor module: a heading, an input, a list, a chart, or anything the user wants. The user places blocks on a canvas and connects them to data sets. A block is a folder with three files, installed into the user's blocks folder.

## 2. The user's wishes come first

The users of this application are never forced into one style. Everything about looks in this guide (variables, tokens, the UI kit) is a default that keeps blocks consistent, not a restriction. If the user asks for a particular color, font, size or look, implement exactly that in `style.css`, even if it differs from the application. Do not refuse, do not lecture about consistency. Only technical limits (no network, the sandbox) cannot be bypassed.

## 3. Folder

    <type>/
      block.json
      render.js
      style.css        (optional)

`<type>` matches `^[a-z][a-z0-9-]{1,40}$`, must equal `type` inside `block.json`, and must not equal a system block (`heading`, `text`, `divider`, `input-text`, `input-number`, `input-date`, `select`, `checkbox`, `submit`, `list`, `stat`, `progress`, `chart`).

## 4. block.json

| Field | Rule |
|---|---|
| `type` | the folder name |
| `title` | a string, or an object with at least `en` (also `ru`, `es`, `de` if you can) |
| `group` | `static`, `input` or `data` (where it appears in the palette) |
| `size` | the default size on the canvas: `w` is a fraction of the page width (0 to 1), `h` is pixels |
| `props` | an array of properties the user can edit |

A property is `{ "name": "...", "type": "...", "default": ..., "options": [...] }`. Types: `string`, `text` (multi-line), `number`, `boolean`, `select` (needs `options`), `color`, `collection` (picks a data set), `field` (picks a field of the chosen `collection`), `form` (a form name), `list` (an array of strings, one per line), `columns` and `filters` (JSON). The inspector builds its form from this list automatically.

## 5. render.js

Export a class by default. Extend `BaseBlock` and implement `build()`:

```js
import { BaseBlock } from 'bm://app/blocks/runtime/BaseBlock.js';

export default class MyBlock extends BaseBlock {
    build() {
        this.element.append(this.el('div', '', this.props.label));
    }
}
```

`BaseBlock` gives you:

| Member | Purpose |
|---|---|
| `this.element` | the container to fill |
| `this.props` | the property values chosen by the user |
| `this.el(tag, className, text)` | creates an element (build the DOM with this, never with `innerHTML`) |
| `this.field(label, control)` | a labelled control |
| `this.register(control, get, reset, kind)` | makes an input take part in a form (see below) |
| `this.cleanups` | push functions that undo your subscriptions; they run on update and removal |
| `this.context` | the block context |

The context (`this.context`):

| Member | Purpose |
|---|---|
| `bm` | the module SDK: `bm.t(key)`, `bm.confirm(text, options)`, `bm.clock` (the only source of the current time), `bm.theme`, `bm.locale` |
| `t(key, params)` | shorthand for `bm.t` |
| `store` | data: `list(collection)`, `insert(collection, record)`, `remove(collection, id)`, `onChange(collection, handler)` (returns an unsubscribe function) |
| `bus` | messages between blocks: `publish(blockId, value)`, `value(blockId)`, `subscribe(handler)`, `fields(form)` |
| `blockId`, `spec` | this block's id; the whole specification |
| `collection(name)` | the definition of a data set (`fields`) |

Records returned by `store.list` look like `{ id, createdAt, ...fields }`; `createdAt` is `YYYY-MM-DD HH:MM:SS`.

Rules:
- Pure JavaScript ES module. No `fetch`, `localStorage`, `alert`, `confirm`, `eval`, external links or libraries (Chart.js exists as `window.Chart` only when the page loads it).
- Use `this.context.bm.clock`, never `new Date()` or `Date.now()` for the current time.
- Texts that belong to the block come from the user (properties). For common words use `bm.t('common.save')`, `bm.t('common.delete')`, `bm.t('block.empty')`.
- Do not touch anything outside `this.element`.

## 6. Forms

An input block calls `this.register(control, get, reset)`. A `submit` block then reads every registered field with the same `form` value and inserts one record into its `collection`. Call `bus.publish` yourself only for values other blocks should react to (the `register` helper does it on `input` or `change` events).

## 7. style.css

Optional, loaded together with the block. Prefer theme variables (`--bg`, `--s1`, `--s2`, `--s3`, `--br`, `--br2`, `--t`, `--td`, `--wh`) so the block follows light and dark themes, unless the user asked for specific colors.

## 8. Installation (give this to the user)

1. Open the app, go to the **Constructor** module and click **Blocks folder**.
2. Copy the whole `<type>` folder into the folder that opens.
3. Click **Rescan blocks**. The block appears in its palette group.
4. Custom blocks run their code inside the Constructor page, so the first use asks for confirmation.
5. A module that uses the block carries a copy of it, and exporting that module to a `.bmmodule` file includes the block, so you can share both together.

## 9. Example

`counter/block.json`

```json
{
  "type": "counter",
  "title": { "en": "Tap counter", "ru": "Счётчик нажатий", "es": "Contador de pulsaciones", "de": "Tippzähler" },
  "group": "data",
  "size": { "w": 0.25, "h": 96 },
  "props": [
    { "name": "label", "type": "string", "default": "Taps" },
    { "name": "collection", "type": "collection" }
  ]
}
```

`counter/render.js`

```js
import { BaseBlock } from 'bm://app/blocks/runtime/BaseBlock.js';

export default class CounterBlock extends BaseBlock {
    build() {
        this.value = this.el('div', 'counter-value');
        const button = this.el('button', 'bm-btn', this.props.label || '+1');
        button.addEventListener('click', () => this.context.store.insert(this.props.collection, { tap: 1 }));
        const card = this.el('div', 'counter-card');
        card.append(this.value, button);
        this.element.append(card);
        this.cleanups.push(this.context.store.onChange(this.props.collection, () => this.refresh()));
        this.refresh();
    }

    async refresh() {
        const records = await this.context.store.list(this.props.collection);
        this.value.textContent = String(records.length);
    }
}
```

`counter/style.css`

```css
.counter-card { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; padding: 8px 12px; background: var(--s1); border: 1px solid var(--br); }
.counter-value { color: var(--wh); font-size: 32px; }
```


## 10. Checklist

- The folder name equals `type`, matches the pattern, and is not a system block.
- `block.json` has `title` (with `en`), a valid `group`, `size` and `props` with valid types.
- `render.js` exports a class by default and builds the DOM with `this.el`.
- No network, storage APIs, dialogs, `innerHTML`, or `new Date()` for the current time.
- Every subscription is undone through `this.cleanups`.
- Every file is delivered in full and the installation guide is included.
