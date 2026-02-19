import type { TodoistQuery } from "./types";

/**
 * Parse the inner content of a ```todoist code block into a query.
 * Supports:
 *   - project:123 or project 123
 *   - section:456 or section 456
 *   - filter:today | filter "today & !subtask"
 *   - Empty: use default from settings
 */
export function parseTodoistQuery(source: string): TodoistQuery {
	const q: TodoistQuery = {};
	const line = source.trim();
	if (!line) return q;

	// filter:"..." or filter:today
	const filterMatch =
		line.match(/^\s*filter\s*:\s*["']?([^"'\n]+)["']?$/i) || line.match(/^\s*filter\s+([^\n]+)$/i);
	if (filterMatch) {
		q.filter = filterMatch[1].trim();
		return q;
	}

	// project:123 or project 123
	const projectMatch =
		line.match(/^\s*project\s*:\s*(\S+)$/i) || line.match(/^\s*project\s+(\S+)$/i);
	if (projectMatch) {
		q.projectId = projectMatch[1].trim();
		return q;
	}

	// section:456 or section 456
	const sectionMatch =
		line.match(/^\s*section\s*:\s*(\S+)$/i) || line.match(/^\s*section\s+(\S+)$/i);
	if (sectionMatch) {
		q.sectionId = sectionMatch[1].trim();
		return q;
	}

	// If the whole line looks like an id (numeric string), treat as project
	if (/^\d+$/.test(line)) {
		q.projectId = line;
		return q;
	}

	// Otherwise treat as a filter string (e.g. "today", "#Work", "today & overdue")
	q.filter = line;
	return q;
}
