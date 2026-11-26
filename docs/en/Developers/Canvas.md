# BIOMASHINE: Canvas mode

The whole application has two modes. **View mode** is for using the program. In **Canvas mode** literally anything you can see can be moved, resized, hidden or brought to the front: text, buttons, fields, charts, cards, even parts of the application's own interface, in any module, including modules you did not create.

## 1. Using it

- Toggle the mode with the button in the corner of the window or with `Ctrl+E` (`Cmd+E` on macOS); the shortcut can be rebound in Settings.
- Hover to highlight, click to select the deepest element. Click inside the selection to drag it. `Alt`+click selects the element underneath. `Ctrl+↑` selects the parent, `Ctrl+↓` the first child, and the toolbar shows the chain of ancestors.
- Drag, or pull one of eight handles to resize. Elements snap to a grid; hold `Shift` to move freely. Arrows nudge by one grid step (with `Shift` by several). `Delete` hides the element, `]` and `[` bring it to the front or send it back, `Esc` clears the selection, `Ctrl+Z` and `Ctrl+Shift+Z` undo and redo.
- Changes are saved when a gesture ends. **Reset page** restores the original arrangement of the open module or screen, **Reset interface** restores the application chrome. Both ask for confirmation. The mode button, the toolbar and the editing layer cannot be moved.

## 2. How it works

No module declares anything. The engine finds the element under the pointer and gives it a stable key: the path from the nearest anchor (`#id`, the optional `data-bm-block="name"` attribute, or the root) down through `tag:index` segments, for example `#list>li:2`. The arrangement is stored per scope: `module:<id>` for a module page, `shell` for the permanent interface, `view:<name>` for shell screens.

```json
{ "version": 2, "items": { "#list>li:2": { "dx": 30, "dy": -20, "w": 340, "h": 48, "z": 2, "hidden": false } } }
```

`dx` and `dy` are offsets from the element's natural place, so the flow of the page does not change and neighbours do not shift. They are applied with the CSS `translate` property, which does not overwrite an element's own `transform`. Size overrides use `width` and `height` (with `box-sizing: border-box`), layers use `z-index`, hidden elements use `display: none`. Original inline styles are remembered and restored on reset, and a `MutationObserver` applies saved entries to elements that appear later. If the page structure changes so that a key no longer matches anything, the entry simply waits.

Limits and tuning live in `config/canvas.json` (grid step, minimum sizes, history length, ignored tags, protected selectors).

## 3. Channels

| Channel | Purpose |
|---|---|
| `layout:get {scope}` | The saved arrangement of a scope or `null` |
| `layout:save {scope, layout}` | Validate, normalize (entries without changes are dropped) and store |
| `layout:reset {scope}` | Forget the arrangement |

The module SDK receives the saved arrangement and the canvas configuration in `init` and reports changes to the shell with `layoutChange`; the shell may save only the module's own scope.
