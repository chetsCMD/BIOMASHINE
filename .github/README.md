<p align="center">
  <a href="https://github.com/chetsCMD/BIOMASHINE/releases">
    <img src="https://github.com/chetsCMD/BIOMASHINE/blob/main/build/biomashine.png?raw=true" width="150" height="150" alt="BIOMASHINE Logo">
  </a>
</p>

<h1 align="center">BIOMASHINE</h1>

<p align="center">Operating environment for personal tracking</p>

<p align="center">
  <a href="README.md">English</a> / <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-8b7e6a" alt="Version 1.0.0">
  <img src="https://img.shields.io/badge/Electron-45-47848f?logo=electron&logoColor=white" alt="Electron 45">
  <img src="https://img.shields.io/badge/data-local%20%26%20offline-6b8e76" alt="Local data & offline">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-555" alt="Windows, Linux, and macOS">
</p>

<p align="center">
  <a href="https://github.com/chetsCMD/BIOMASHINE/releases">Download</a> ·
  <a href="https://github.com/chetsCMD/BIOMASHINE/issues">Report an issue</a> ·
    <a href="https://boosty.to/chetscmd">Support the project</a>
</p>

<p align="center">
  <a href="https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/ROADMAP.md">ROADMAP</a>
</p>

---

## What is BIOMASHINE

BIOMASHINE is an operating environment for personal tracking.

Life is not limited to health. It encompasses physical and psychological state, finances, intellectual activities, environmental observation—and much more. BIOMASHINE does not dictate what exactly should be tracked or how one should live. The user decides what records they need and what meaning those records have.

Imagine a paper daily organizer: it has a cover, a ring mechanism, paper, and dividers. You add new sections yourself, remove unnecessary ones, rearrange pages, create your own, and write whatever you want in them. The manufacturer of the organizer does not decide for you what should be in your diary.

BIOMASHINE strives to provide the same freedom in a digital form. The application provides:

- a data storage mechanism;
- a mechanism for displaying and processing it;
- an extension mechanism via user modules;
- a user interface;
- a module management system.

And the user determines **what exactly to track**.

## The User Controls the Application

The main idea of BIOMASHINE is that **a person controls the program, not the program controls the person**. This is not just a ready-made set of pages to be used "as intended." The user can shape the environment to suit themselves:

- create their own modules for the types of tracking they need;
- enable and hide modules, controlling the composition of the application;
- create plugins and change the appearance of the interface—including developing their own themes based on the styling and plugin mechanism;
- translate the interface into any language: the application provides language files and the ability to add custom translations.

The built-in sections are merely a starting point. They show how the environment is structured but do not limit its purpose. 

## What Basic Pages Are Available

The current version includes several ready-made example pages:

- **Weight** — measurements and goals.
- **Sleep** — sleep log and schedule.
- **Nutrition** — meal records.
- **Macros (KBJU)** — calculation of calorie and macronutrient targets based on profile data.
- **Running** — runs, goals, and statistics.
- **Workouts** — sessions and workout templates.
- **Reaction** — reaction speed test and results history.

[![Example of a page for recording sleep:](media/sleep.png)](media/sleep.png)

This is not a complete list of what BIOMASHINE should be, nor a recommendation to track exactly these things. The composition of the application can and **should** be changed and expanded to suit your tasks.
> You can follow the project's development and the creation of new pages in the [roadmap](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/ROADMAP.md)

# Main Feature of the Program
**Modular architecture**. You determine what you want to see in BIOMASHINE.

If you are a developer, [documentation](https://github.com/chetsCMD/BIOMASHINE/main/.github/README.md#documentation-for-developers-and-extension-creators) is available for you.

But if you don't know how to code, that's no problem. There is [documentation available for your AI Agent](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/ai). Give it the file and describe what you want to see, and it will independently guide you from an idea to a finished module.

> [In the future](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/ROADMAP.md), it is planned to add the ability to build modules from ready-made blocks.

## Principles

- **The user sets the rules.** The application helps collect and make sense of information but does not judge the person or dictate goals to them.
- **Data remains local.** BIOMASHINE works with an on-device SQLite database; a cloud account and internet connection are not required for tracking.
- **A personal system, not a corporate service.** This is a "people-to-people" tool created for the everyday tasks of a specific person—the user.
- **Freedom instead of a single scenario.** Ready-made pages are a foundation that the user can supplement with their own modules, themes, and translations.
- **Tracking for oneself.** Records are not meant to prove anything to anyone. Their value is determined by the person themselves.

## Download

Ready-made builds are published on the [Releases](https://github.com/chetsCMD/BIOMASHINE/releases) page. Build formats depend on the release and platform. The desktop version is built for Windows (portable `.exe` and `.zip`), Linux (AppImage), and macOS (`.zip`).

The application does not require a cloud account. Since the database is local, you need to transfer it separately when moving to another device or use the data export feature in the settings.

## Running from Source

Requires Node.js version 22 or higher and npm.

```bash
npm install
npm start
```

Prepare a distribution for the current operating system:

```bash
npm run dist
```

You should build on the operating system for which the distribution is intended: `better-sqlite3` contains a native module. Application asset preparation runs automatically with the `npm start` and `npm run dist` commands.

## Data and Security

- In the settings, you can set a login and password to open the program. There is no password reset option if lost.
- Application data is stored locally in an SQLite database in the application's data directory. In portable builds, the location depends on the launch mode.
- Export to JSON and CSV is available in the settings.
- Application pages work as modules. User modules and configs are provided for by the project's architecture.
- Local storage by itself is not a backup. It is recommended to periodically save an export and keep it in a safe place.

## Hotkeys

- `Ctrl+P` (`Cmd+P` on macOS) — quick navigation to a section or settings.
- `F11` — fullscreen mode.

## Documentation for Developers and Extension Creators

- [`docs/Project Map.md`](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/Developers/Project%20Map.md) — project structure and map.
- [`docs/Modules.md`](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/Developers/Modules.md) — module architecture and internal SDK.
- [`docs/ai/`](https://github.com/chetsCMD/BIOMASHINE/tree/main/docs/en/ai) — guides and examples for modules, plugins, and configurations.

## Contributing and Feedback

Found a bug or want to suggest an improvement? Create an [issue](https://github.com/chetsCMD/BIOMASHINE/issues). Before submitting, check if there is already a similar discussion.
The project has a "People to People" philosophy, so feel free to create updates and improvements. As well as your own modules, themes, and translations into other languages.
Version `1.0.0` is a demonstrative example of what this project is, rather than a final version. Follow the project's development and look for ideas to help develop the project in the [ROADMAP](https://github.com/chetsCMD/BIOMASHINE/blob/main/docs/en/ROADMAP.ru.md)
