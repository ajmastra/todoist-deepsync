# Todoist DeepSync

Obsidian plugin that syncs tasks from Todoist into your notes with **full subtask hierarchy**, inline code blocks, and checkable completion—similar to the community "Todoist Sync" plugin but with proper subtask rendering.

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
   Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `plugins/todoist-deepsync/` folder (the folder name should match the plugin ID from `manifest.json`).

2. **Get your Todoist API token**  
   In Todoist: **Settings → Integrations → API token**. Copy the token.

3. **Configure the plugin**  
   In Obsidian: **Settings → Community plugins → Todoist DeepSync**  
   - Paste your **API token**.  
   - Optionally set a **default project or filter** (used when the block has no query).  
   - Set **refresh interval** (minutes).  
   - Toggle **Show completed tasks** if desired.

## Query block syntax

Use a **todoist** fenced code block. The first line (or the whole block content) is the query. If the block is empty, the plugin uses the **default project or filter** from settings.

### By project

Fetch all tasks from a specific project by its numeric ID.

**Syntax:**
- `project:PROJECT_ID` or `project PROJECT_ID`
- Or just the numeric ID: `PROJECT_ID`

**Examples:**
````markdown
```todoist
project:2203306141
```

```todoist
project 2203306141
```

```todoist
2203306141
```
````

**Finding project IDs:** Project IDs are numeric strings. You can find them by inspecting the URL when viewing a project in Todoist web app, or by checking the API response.

### By section

Fetch all tasks from a specific section within a project.

**Syntax:**
- `section:SECTION_ID` or `section SECTION_ID`

**Examples:**
````markdown
```todoist
section:12345
```

```todoist
section 12345
```
````

**Finding section IDs:** Section IDs are numeric strings. You can find them by inspecting the URL when viewing a section in Todoist web app.

### By filter

Filter tasks by date criteria. Filters are applied client-side and **exclude tasks without due dates** unless explicitly included.

**Syntax:**
- `filter:FILTER` or `filter FILTER` or just the filter string directly
- Filter strings are case-insensitive

**Supported filter keywords:**

| Filter | Description |
|--------|-------------|
| `today` | Tasks due today only (excludes overdue and tasks without dates) |
| `overdue` | Tasks that are overdue (past due date) |
| `tomorrow` | Tasks due tomorrow |

**Combining filters:**

- **OR operator (`\|`):** Match any of the conditions
  - `today \| overdue` - Tasks due today OR overdue
  - `today \| tomorrow` - Tasks due today OR tomorrow
  - `overdue \| tomorrow` - Tasks overdue OR due tomorrow

- **AND operator (`&`):** Match all conditions
  - `today & overdue` - Tasks due today AND overdue (typically empty set)
  - Note: AND combinations are less common for date filters

**Examples:**
````markdown
<!-- Today's tasks only -->
```todoist
today
```

```todoist
filter:today
```

<!-- Overdue tasks -->
```todoist
overdue
```

<!-- Today OR overdue -->
```todoist
today | overdue
```

<!-- Today OR tomorrow -->
```todoist
today | tomorrow
```

<!-- Using filter: prefix -->
```todoist
filter:today | overdue
```
````

**Important notes about filters:**
- Filters **exclude tasks without due dates** by default
- Date comparisons ignore time (only compare dates)
- Filters are case-insensitive
- Project name filters (e.g., `#ProjectName`) are not yet fully supported—use project IDs instead

### Default when block is empty

If the code block is empty, the plugin uses the **Default project or filter** setting:

- If the default value is a **numeric ID**, it's treated as a `project_id`
- Otherwise, it's treated as a **filter** string (e.g., `today`, `overdue`)

**Example:**
````markdown
<!-- Uses default from plugin settings -->
```todoist
```
````

### Complete examples

````markdown
<!-- Use default project/filter from settings -->
```todoist
```

<!-- All tasks from a specific project -->
```todoist
project:2203306141
```

<!-- Tasks from a specific section -->
```todoist
section:12345
```

<!-- Today's tasks only -->
```todoist
today
```

<!-- Overdue tasks -->
```todoist
overdue
```

<!-- Today OR overdue tasks -->
```todoist
today | overdue
```

<!-- Tomorrow's tasks -->
```todoist
tomorrow
```

<!-- Today OR tomorrow -->
```todoist
today | tomorrow
```
````

## Subtasks

- Subtasks are loaded with their parents (Todoist Sync API returns `parent_id`).
- They are shown **indented** under the parent.
- Parents that have subtasks are wrapped in a **collapsible** block (using `<details>`/`<summary>`); you can expand/collapse the list of subtasks.
- Multiple levels of nesting are supported.

## Building from source

- **Requirements:** Node.js, npm.
- **Commands:**
  - `npm install`
  - `npm run dev` — watch build (outputs `main.js`).
  - `npm run build` — production build.

## Tech stack

- TypeScript, Obsidian Plugin API, Todoist Sync API (v1).
- Bundling: esbuild (single `main.js`).
- Note: Uses Todoist Sync API (`/api/v1/sync`) instead of REST API v2, as REST v2 endpoints return 410 Gone.

## License

Use and modify as you like. No warranty.
