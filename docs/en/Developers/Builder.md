# BIOMASHINE: Module Constructor

Assemble a page for yourself in a minute from ready-made blocks, like Lego, without programming. Saving turns the result into an ordinary module that appears in the menu like any other and can be opened for editing again.

## 1. Using it

Open the **Constructor** module. Add blocks from the palette, arrange them on the canvas (drag, resize with the handles, arrows nudge, `Delete` removes), and select a block to edit its properties. Define **data sets** (named collections of typed fields: text, number, date, choice, checkbox); input blocks write into them, lists, statistics, progress bars and charts read from them. The preview works on in-memory data, so nothing is written while you design. **Save** creates a module; **New**, the module list, **Delete**, **Export** and **Import** manage them. **Blocks folder** opens the folder for your own blocks and **Rescan blocks** picks them up.

## 2. Specification

A constructor module is a folder in the user modules folder with `manifest.json` (with `"builder": { "version": 1 }` and `"channels": ["blocks:list"]`), `spec.json` and a generated `index.html` that embeds the specification and starts the runtime.

```json
{ "version": 1,
  "collections": { "weight": { "title": "Weight", "fields": [ { "id": "date", "type": "date" }, { "id": "kg", "type": "number" } ] } },
  "blocks": [ { "id": "b1", "type": "input-number", "props": { "label": "Kg", "collection": "weight", "field": "kg", "form": "main" }, "layout": { "x": 0, "y": 72, "w": 0.5, "h": 72 } } ] }
```

`layout.x` and `layout.w` are fractions of the page width, `layout.y` and `layout.h` are pixels. Data lives in `bm.storage` collections named `c-<collection>`, so it takes part in the data export. Limits are in `config/builder.json`.

## 3. Blocks

Thirteen system blocks live in `src/renderer/blocks/<type>/`: `heading`, `text`, `divider`, `input-text`, `input-number`, `input-date`, `select`, `checkbox`, `submit`, `list`, `stat`, `progress`, `chart`. A block is `block.json` (description and editable properties), `render.js` (a class extending `BaseBlock`) and an optional `style.css`. User blocks live in `userData/blocks/<type>/` and are served at `bm://blocks/<type>/...`. The contract for authors, including a worked example, is in [BLOCK_GUIDE.md](../ai/BLOCK_GUIDE.md).

The runtime (`src/renderer/blocks/runtime`) loads the specification, gives each block a context (`store`, `bus`, `bm`, `props`), places blocks absolutely on a canvas and, in the constructor, adds the editing layer.

## 4. Sharing

**Export** writes a single `.bmmodule` file (JSON): the module's title, description, category, specification and the code of every user block it uses. **Import** shows the blocks and their code size, asks for confirmation (block code runs inside the module), installs blocks that are not installed yet, and creates the module.

## 5. Channels

| Channel | Purpose |
|---|---|
| `blocks:list`, `rescan`, `errors`, `openFolder` | Block registry |
| `builder:list`, `load {id}`, `save {id?, title, description, category, spec}`, `remove {id}` | Constructor modules |
| `builder:export {id}`, `inspect {data}`, `import {data}` | `.bmmodule` bundles |
