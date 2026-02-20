# Todoist DeepSync

[![Build](https://img.shields.io/github/actions/workflow/status/ajmastra/todoist-deepsync/ci.yml?branch=main&label=build)](https://github.com/ajmastra/todoist-deepsync/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ajmastra/todoist-deepsync/graph/badge.svg)](https://codecov.io/gh/ajmastra/todoist-deepsync)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)
[![Linter: ESLint](https://img.shields.io/badge/linter-eslint-4B32C3.svg)](https://eslint.org/)

Obsidian plugin that syncs tasks from Todoist into your notes with **full subtask hierarchy**, inline code blocks, and checkable completion. Inspired by the [Sync with Todoist](https://github.com/jamiebrynes7/obsidian-todoist-plugin) plugin, with modifications and features tailored to my own workflow (including full subtask rendering, hierarchical project/section picker, and compact task creation).

## Features

- **Authenticate** with the Todoist Sync API using your API token (stored in plugin settings).
- **Fetch tasks** from projects, sections, or filters.
- **Render tasks inline** via a ` ```todoist ``` ` code block with an optional query.
- **Full subtask support**: parent/child relationships from Todoist's `parent_id`, indented hierarchy, and collapsible subtask groups.
- **Task display**: content, due date (formatted as `MM/DD/YY @ h:mm AM/PM`), and priority (e.g. `!` … `!!!`).
- **Complete/uncomplete** tasks from the note; changes are sent to the Todoist API.
- **Create tasks** via a compact modal with icon-based options (project, section, priority, due date, subtask).
- **Auto-refresh** on a configurable interval.
- **Manual refresh** button in each task block.

## Setup

1. **Install the plugin**  
   Copy `main.js`, `manifest.json`, and `styles.css` (if present) into your vault's `.obsidian/plugins/todoist-deepsync/` folder.

2. **Enable the plugin**  
   Open Obsidian Settings → Community plugins → enable **Todoist DeepSync**.

3. **Add your Todoist API token**  
   In Settings → Todoist DeepSync, paste your [Todoist API token](https://todoist.com/app/settings/integrations) and save.

4. **Use in a note**  
   Add a code block with the `todoist` language and an optional query:

   ````md
   ```todoist
   filter:today
   ```
   ````

   Or `project:123`, `section:456`, or a plain filter string like `today` / `#Work`.

## Development

This project uses:

- **TypeScript** for type safety
- **ESLint 9** (flat config) for code linting
- **Prettier** for code formatting
- **GitHub Actions** for CI/CD

Before committing, run `npm run check` to ensure code quality. The CI pipeline will automatically:

- Type check the code
- Run linting
- Check formatting
- Build the project
- Run tests and upload coverage to Codecov

**Codecov:** To enable coverage uploads in CI, add a `CODECOV_TOKEN` secret in the repo settings (**Settings → Secrets and variables → Actions**). The token can be obtained from the [Codecov dashboard](https://codecov.io) for this repository.

**Note:** This project uses ESLint 9 with the flat config format (`eslint.config.mjs`). The `minimatch` vulnerability is mitigated via npm `overrides` in `package.json`. The `ajv` vulnerability in ESLint's dependencies is a dev-only dependency and requires specific conditions (`$data` option) that ESLint doesn't use, so it poses minimal risk.

**Lock file:** `package-lock.json` is committed to ensure reproducible builds and enable CI/CD caching.

## Tech stack

- TypeScript, Obsidian Plugin API, Todoist Sync API (v1).
- Bundling: esbuild (single `main.js`).
- Note: Uses Todoist Sync API (`/api/v1/sync`) instead of REST API v2, as REST v2 endpoints return 410 Gone.

## Credits

This plugin was inspired by [Sync with Todoist](https://github.com/jamiebrynes7/obsidian-todoist-plugin) by [jamiebrynes7](https://github.com/jamiebrynes7). I wanted the same kind of Todoist-in-Obsidian experience but with my own modifications (subtask hierarchy, filters, and UI preferences), so I built Todoist DeepSync. Thank you to the original author and contributors for the inspiration.

## License

MIT
