<p align="center">
  <a href="https://github.com/chetsCMD/BIOMASHINE/releases">
    <img src="https://github.com/chetsCMD/BIOMASHINE/blob/main/build/biomashine.png?raw=true" width="150" height="150" alt="BIOMASHINE logo">
  </a>
</p>

<h1 align="center">BIOMASHINE</h1>

<p align="center">An operating environment for personal tracking</p>

<p align="center">
  <b>English</b> / <a href="README.ru.md">Русский</a> / <a href="README.es.md">Español</a> / <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-8b7e6a" alt="Version 2.0.0">
  <img src="https://img.shields.io/badge/Electron-45-47848f?logo=electron&logoColor=white" alt="Electron 45">
  <img src="https://img.shields.io/badge/data-local%20%26%20offline-6b8e76" alt="Local data, offline operation">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-555" alt="Windows, Linux and macOS">
  <a href="https://boosty.to/chetscmd"><img src="https://img.shields.io/badge/Boosty-Support%20the%20author-orange" alt="Support on Boosty"></a>
</p>

<p align="center">
  <a href="https://github.com/chetsCMD/BIOMASHINE/releases">Download</a> ·
  <a href="https://github.com/chetsCMD/BIOMASHINE/issues">Report an issue</a> ·
  <a href="https://boosty.to/chetscmd">Support the project</a>
</p>

---

## What is BIOMASHINE

BIOMASHINE is an operating environment for personal tracking.

Life is not limited to health. It includes physical and psychological state, finances, intellectual activity, observation of the environment—and much more. BIOMASHINE does not prescribe what exactly should be tracked or how one should live. Users choose which records they need and what meaning those records have.

Imagine a paper planner-organizer: it has a cover, a ring mechanism, paper, and dividers. You insert new sections yourself, remove unnecessary ones, rearrange pages, create your own, and write anything in them. The organizer manufacturer does not decide for you what should be in your diary.

BIOMASHINE aims to provide the same freedom digitally. The application provides:

- a data storage mechanism;
- a mechanism for displaying and processing that data;
- a mechanism for extending it with user modules;
- an interaction interface;
- a module management system.

And the user determines **what exactly to track**.

## Why BIOMASHINE

- **Yours.** Data never leaves the computer. No telemetry, no sync service, no registration.
- **Customizable down to the pixel.** Nothing is hardcoded: neither appearance, nor texts, nor coefficients. Language, colors, sizes, fonts, formulas, and constants are stored in settings and configuration files that can be edited inside the app or manually.
- **Modular.** Each page is a module. Hide what you don't need, add your own, or describe the page you need to an AI assistant and put the result into the modules folder.
- **Assembled without code.** The module builder assembles a page from ready-made blocks: palette, 16:9 preview, property inspector, and data editor. Custom blocks are added as a folder with a description, script, and styles.
- **Open.** Free software under the GPL license.

## The user controls the application

The main idea of BIOMASHINE is that **a person controls the program, not the program controls the person**. This is not just a ready-made set of pages to use "as intended." Users can shape the environment for themselves:

- create their own modules for the kinds of tracking they need;
- assemble pages in the builder without programming;
- enable and hide modules, controlling the application's composition;
- create plugins and change the interface appearance—including developing their own themes based on the style and plugin mechanism;
- translate the interface into any language: the app provides language files and the ability to add your own translations.

## What basic pages are available

The current version includes several ready-made example pages:

- **Weight** — measurements and goals.
- **Sleep** — sleep log and schedule.
- **Nutrition** — meal records.
- **Calories & macros** — calculation of calorie and macronutrient targets based on profile data.
- **Running** — runs, goals, and statistics.
- **Workouts** — sessions and workout templates.
- **Reaction** — reaction speed test and results history.
- **Builder** — assembling your own pages from ready-made blocks.

[![Example of a page for recording sleep:](media/sleep.png)](media/sleep.png)

## Navigation

- **Panel and module hub.** Pin the modules you need most to the top panel; the rest wait in the hub: a card page with search, categories, and pin buttons. Prefer a sidebar? Switch to a vertical layout with collapsible categories.
- **Quick jump.** `Ctrl+P` (`Cmd+P` on macOS) opens any module or settings section and works on any keyboard layout.
- **Your own hotkeys.** Any shortcut can be reassigned in settings, and actions fire even when focus is inside a module page. Macros — action chains — are in beta for now.
- **Full screen.** `F11` enables it, and window controls remain within reach.
- **Session restore.** On exit, the app can offer to remember the open module, field values, and scroll position and return you to that exact screen on next launch.

# Main feature of the program
**Modular architecture**. You determine what you want to see in BIOMASHINE.

If you are a developer, [documentation](../.github/README.en.md#documentation) is available for you.

But if you don't know how to work with code, that's not a problem. There is [documentation available for your AI agent](../docs/en/ai). Give it the file and describe what you want to see, and it will guide you completely independently from idea to a finished module.

## Make it your own

[![Constructor:](media/Constructor.png)](media/Constructor.png)

- **Canvas mode.** Enable ✥ and edit any visible element: move, resize, hide, change layer. Layouts are stored separately for each module, the shell, and its screens.
- **Module builder.** Assemble a page from 13 ready-made blocks — from text and fields to charts and metrics — without a single line of code. The block set will keep growing. Custom blocks are written in a folder with a description, script, and styles.
- **Global search.** `Ctrl+O` searches records across all tables, module names and descriptions, and the content of pages you've already opened.
- **Languages.** Russian, English, Spanish, and German are built in. Export a translation template in settings, translate it, put the file in the languages folder, and your language will appear in the list.
- **Design.** Light and dark themes, and behind them a design editor: every color, size, spacing, radius, font, and animation duration is a token that can be changed for the whole app or for a single module with live preview. Write custom CSS for the whole application or an individual module, import and export ready-made designs, and order plugins as needed.
- **Config editor.** Change any JSON configs (coefficients, colors, limits) directly in the app. Changes apply immediately, and only your differences from default values are stored.
- **Time zone.** Choose the time zone in which dates and times are recorded.
- **Profiles.** Keep several independent spaces, such as "real life," "experiment," and "sandbox." Each profile has its own database; create, duplicate, rename, delete, and switch between them in settings.

## Principles

- **The user sets the rules.** The app helps collect and make sense of information but does not evaluate the person or dictate goals.
- **Data stays local.** BIOMASHINE works with an SQLite database on the device; a cloud account and internet connection are not needed for keeping records.
- **A personal system, not a corporate service.** It is a tool "from people to people," created for the everyday tasks of a specific person—the user.
- **Freedom instead of a single scenario.** Ready-made pages are a foundation that the user can supplement with their own modules, themes, and translations.
- **Tracking for yourself.** Records are not meant to prove something to anyone. Their value is determined by the person themselves.

## Your data is safe

- **Local only.** One SQLite database per profile, no network access.
- **Password protection.** Optional login and password, stored as a scrypt hash with salt.
- **Recycle bin.** Undo the last ten operations directly from settings.
- **Export.** Save everything to JSON or CSV at any time.
- **Notifications.** Modules can schedule system notifications, and you can disable them for each module.
- **Isolation.** Each module runs in its own isolated frame and can only use declared channels.

## Download and install

Get the latest build from the [releases page](https://github.com/chetsCMD/BIOMASHINE/releases).

| System | File | Notes |
|---|---|---|
| Windows | `.exe` (portable) or `.zip` | Nothing needs to be installed. The portable version stores data in the `BIOMASHINE-data` folder next to the program, so it can be carried on a USB drive. |
| Linux | `.AppImage` | `chmod +x` and run. Requires `libfuse2`. |
| macOS | `.zip` | Unsigned: on first launch, right-click the app and choose "Open." |

## Building from source

Requires Node.js 22 or newer.

    npm install
    npm start          # launch the application
    npm run dist       # build for the current operating system

Native modules must be built on the operating system for which the build is intended. The repository has a working GitHub Actions workflow that builds packages for Windows, Linux, and macOS.

## Documentation

- [Project map: architecture, IPC channels, data layer](../docs/en/Developers/Project%20Map.md)
- [Modules: manifest, SDK, storage, styling](../docs/en/Developers/Modules.md)
- [Design system: tokens, tool, editor](../docs/en/Developers/Design.md)
- [Canvas mode](../docs/en/Canvas.md)
- [Module builder](../docs/en/Builder.md)
- [Guide for AI assistants: creating a module](../docs/en/ai/MODULE_GUIDE.md)
- [Guide for AI assistants: creating a builder block](../docs/en/ai/BLOCK_GUIDE.md)
- [Guide for AI assistants: creating a plugin](../docs/en/ai/PLUGIN_GUIDE.md)

## Support the project

BIOMASHINE is free and created by one person. If you find it useful, you can [support the author](https://boosty.to/chetscmd) or star the repository.

## License

BIOMASHINE is free software under the GNU General Public License v3.0 with an additional attribution requirement (section 7b). The full text is in the `LICENSE` file.
