# Release 1.0.0 — done.

## Architecture and Core
- [x] Electron shell, data in a local SQLite (`better-sqlite3`), communication via a single IPC channel with a dispatcher, repositories and controllers as classes.
- [x] Project principle: the user controls the program. Everything that can be delegated to the user is moved to settings or config; hardcoding is minimized.
- [x] Login and password (optional application protection).

## Modular System and Extensibility
- [x] Modular system: pages in isolated iframes with the `bm` bridge, plugins (CSS), configs. Contract: `docs/Developers/Modules.md`.
- [x] System and user modules (`userData/modules`), user configs, protection against broken files.
- [x] `bm.storage` and the `bm://` protocol.

## Time and Localization
- [x] Time zone for saved date and time (selection in settings, "Time" block).
  - [x] `timezone` setting (`system` or IANA name), list of zones from `Intl` with modern names (`Asia/Kolkata`, `Europe/Kyiv`), time preview.
  - [x] Search in the time zone selection in settings.
  - [x] `ClockService` in main and SQLite triggers (migration 003): all `created_at` and reaction test dates are written in the selected zone via the `bm_now()` function.
  - [x] `bm.clock` in the SDK (`now`, `today`, `timestamp`); the `reaction` module is migrated.
  - [x] Clock classes of the `weight`, `sleep`, `nutrition`, `running`, `training` modules are migrated to `bm.clock`.
  - [x] Tests for zones with different offsets, midnight transitions, and DST.
- [x] Multilingual support:
  - [x] Russian and English out of the box, language selection (including system language).
  - [x] Ability to add custom languages: `LocaleService`, custom languages in `userData/locales`, translation template.
  - [x] Code usage: `bm.t`, `bm.locale`, `data-i18n`; the shell and all modules are translated (ru, en).

## Interface and Data
- [x] Shell: settings (theme, plugins, language, autostart, modules with search, export, password, time), quick switch `Ctrl+P`, `F11`, splash screen, logo.
- [x] Data export to JSON and CSV.

## Build (CI/CD)
- [x] Cross-platform builds via GitHub Actions (`.github/workflows/release.yml`).
  - [x] Matrix for Windows, Linux, macOS (arm64 and Intel), steps `npm install`, `node scripts/prepare.js`, `electron-builder --publish never`, artifact upload.
  - [x] Draft GitHub Release on `v*` tag.

## Documentation
- [x] Root `README.md`.
- [x] Documentation for third-party developers:
  - [x] `docs/Developers/Project Map.md`
  - [x] `docs/Developers/Modules.md`
- [x] AI guides with verifiable examples in `docs/ai/`:
  - [x] `docs/ai/MODULE_GUIDE.md`
  - [x] `docs/ai/PLUGIN_GUIDE.md`

# Release 1.1.0
- [ ] Transfer tests from the private branch
  - [ ] Localization of backend messages in tests
- [ ] Customizable hotkeys
- [ ] Build not only the portable version but also the standard one (installer)
- [ ] Recycle bin in settings: last 10 operations globally with undo (operation log based on SQLite triggers, undo only if data has not changed after the operation, labels from `operations.json`, screen in settings, tests)
- [ ] OS system notifications

# Release 1.2.0
- [ ] Customization like in Obsidian: design tokens (radii, spacing, fonts, sizes, shadows, border thickness, accent), the entire theme via tokens, multiple CSS files per plugin and their application order, unified "theme + plugins" list


# A Canvas of Ideas

# I. Base Modules

## 1. Dashboard Module

Assembled from widgets across all pages. The view is similar to the canvas in Obsidian — meaning they can be arranged in any order.

Example data on this page:

- Current weight
- Sleep duration for today
- Calories for today

## 2. Analytics Module — unified data visualization system

Example data on this page:

- Charts for an arbitrary period
- Comparison of periods
- Averages, minimums, and maximums
- Correlations between indicators
- Percentage changes
- Pattern discovery

## 3. Journal Module — chronological history of observations

Example data on this page:

- Entries for specific dates
- Events
- Comments on measurements
- Free notes
- Ability to reconstruct any day

## 4. "Constructor — Modules" Feature

Not all users know how to program and/or want to hand off the task to AI. Sometimes it's easier to assemble a page for yourself in a minute from pre-made blocks: a block for a text field, a block for a date input. That is, it is literally a constructor, like Lego. Accordingly, we will need to add those pre-made blocks. And, logically, adhering to the philosophy of the program, allow the creation of user blocks. When arranging, the page (module) has the appearance of a canvas from Obsidian, and after saving, it fixes its place.

# II. Subject Modules

## 1. Physical State

| Module | What it tracks |
|---|---|
| Body | Weight, height, body measurements, body fat percentage, muscle mass |
| Nutrition | Calories, proteins, fats, carbohydrates, fiber, water |
| Sleep | Sleep onset, wake-up time, sleep duration |
| Training | Exercises, sets, reps, working weights |
| Cardio | Running, walking, cycling, distance, speed |
| Health | Blood pressure, heart rate, temperature, symptoms |
| Medication | Medications, dosages, intake time |
| Recovery | Well-being, fatigue, recovery |
| Measurements | Body circumferences, measurements, progress photos |

## 2. Psychological State

| Module | What it tracks |
|---|---|
| Mood | Mood, emotional state |
| Psychology | Anxiety, irritability, concentration, stress |
| Meditation | Duration, frequency, type of practice |
| Cognitive | Memory, attention, reaction speed |
| Mental Energy | Subjective level of mental energy |
| Habits | Recurring actions and habits |
| Social | Communication, social activity, interactions |

## 3. Finance

| Module | What it tracks |
|---|---|
| Expenses | Everyday expenses |
| Income | Sources of income |
| Assets | Property, savings, assets |
| Liabilities | Debts, liabilities |
| Investments | Investments and returns |
| Net Worth | Net worth |
| Budget | Budgets and limits |

## 4. Intellectual Activity

| Module | What it tracks |
|---|---|
| Education | Studying, lessons, duration |
| Reading | Books read, pages, reading speed |
| Knowledge | Topics studied, skills acquired |
| Cognitive Tests | Results of memory, attention, and reaction tests |
| Projects | Projects, progress, time spent |
| Time Tracking | Time allocation between activities |

## 5. External Environment and Behavior

| Module | What it tracks |
|---|---|
| Environment | Temperature, humidity, lighting |
| Weather | Weather conditions |
| Screen Time | Time on computer and phone |
| Digital Activity | Use of programs, websites, games |
| Substances | Caffeine, nicotine, and other substances |
| Behavior | Behavioral reactions and recurring scenarios |
| Location | Movements and places visited |

# III. Instrumental Modules

## 1. Correlations

Cross-referencing of different indicators.

For example:

- Sleep and mood.
- Calories and weight.
- Workouts and strength indicators.
- Expenses and income.

## 2. Events

Recording of significant changes.

For example:

- Started taking medication.
- Changed diet.
- Moved.
- Started working out.
- Stopped consuming caffeine.

## 3. Anomalies

Search for unusual changes.

For example:

- Weight changed more than usual.
- Expenses sharply increased.
- Sleep became significantly shorter.
- Heart rate deviated from the usual range.

## 4. Custom Metrics

For example, a user wants to track the number of hours spent reading scientific literature. They create an indicator — and use it.

For example:

- Name.
- Data type.
- Unit of measurement.
- Valid range.
- Measurement frequency.
- Calculation formula.

## 5. Reports

Generation of summaries for a selected period.

For example:

- Week.
- Month.
- Year.
- Arbitrary range.

# IV.

## 1. Timeline — life timeline

A general timeline displaying events from all installed modules.

For example:

- November 3 — 6 hours of sleep.
- November 3 — 45-minute workout.
- November 3 — expenses 850 ₽.
- November 3 — mood 7/10.
- November 3 — 2200 kcal.

## 2. Experiments

The user can independently conduct experiments on their own lifestyle.

For example:

Experiment: caffeine withdrawal.

- Start date.
- End date.
- Indicators being studied.
- Baseline values.
- Results.
- Conclusions.

Indicators can be compared before, during, and after the experiment.

## 3. Goals

A general page, a collection of all goals.

## 4. Data Quality

It shows:

- How many measurements were missed.
- Which indicators have not been updated for a long time.
- Whether there are contradictory records.
- Whether there are suspicious values.
- How complete the data is for the selected period.
