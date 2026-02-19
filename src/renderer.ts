import type { TaskNode } from "./types";

const INDENT_PX = 20;
const PRIORITY_LABELS: Record<number, string> = { 1: "", 2: "!", 3: "!!", 4: "!!!" };
const PRIORITY_CLASS: Record<number, string> = { 1: "", 2: "todoist-p2", 3: "todoist-p3", 4: "todoist-p4" };

/** Format due as "02/18/26" or "02/18/26 @ 4:00 PM" when time is present. */
function formatDue(due: TodoistTask["due"]): string {
	if (!due) return "";
	const str = (due as { string?: string }).string;
	// Prefer datetime; also treat due.date as datetime when it contains "T" (ISO with time)
	const dateTimeRaw = due.datetime || (due.date && due.date.includes("T") ? due.date : null);
	if (dateTimeRaw) {
		const dt = new Date(dateTimeRaw);
		if (!isNaN(dt.getTime())) {
			const mm = String(dt.getMonth() + 1).padStart(2, "0");
			const dd = String(dt.getDate()).padStart(2, "0");
			const yy = String(dt.getFullYear()).slice(-2);
			const hours = dt.getHours();
			const minutes = dt.getMinutes();
			const ampm = hours >= 12 ? "PM" : "AM";
			const h12 = hours % 12 || 12;
			const time = `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
			return `${mm}/${dd}/${yy} @ ${time}`;
		}
	}
	// Date only (no time): expect YYYY-MM-DD
	if (due.date && !due.date.includes("T")) {
		const [y, m, d] = due.date.split("-");
		if (y && m && d) {
			const yy = y.length >= 4 ? y.slice(-2) : y;
			return `${m}/${d}/${yy}`;
		}
		return due.date;
	}
	return str ?? "";
}

type TodoistTask = import("./types").TodoistTask;

function escapeHtml(s: string): string {
	const div = document.createElement("div");
	div.textContent = s;
	return div.innerHTML;
}

function createTaskLine(task: TodoistTask, depth: number, onToggle: (taskId: string, completed: boolean) => void): HTMLElement {
	const row = document.createElement("div");
	row.className = "todoist-task-row" + (depth > 0 ? " todoist-subtask" : "");
	row.style.paddingLeft = `${depth * INDENT_PX}px`;

	const line = row.createDiv({ cls: "todoist-task-line" });

	const label = document.createElement("label");
	label.className = "todoist-checkbox-wrap";
	const input = document.createElement("input");
	input.type = "checkbox";
	input.checked = task.is_completed;
	input.className = "task-list-item-checkbox";
	input.dataset.taskId = task.id;
	input.addEventListener("change", () => onToggle(task.id, input.checked));
	label.appendChild(input);
	line.appendChild(label);

	const contentSpan = document.createElement("span");
	contentSpan.className = "todoist-task-content" + (task.is_completed ? " todoist-task-completed" : "");
	contentSpan.innerHTML = escapeHtml(task.content);
	line.appendChild(contentSpan);

	const meta = document.createElement("span");
	meta.className = "todoist-task-meta";
	const dueStr = formatDue(task.due);
	if (dueStr) {
		const dueEl = document.createElement("span");
		dueEl.className = "todoist-due";
		dueEl.textContent = dueStr;
		dueEl.title = (task.due as { string?: string })?.string || dueStr;
		meta.appendChild(dueEl);
	}
	if (task.priority > 1) {
		const pEl = document.createElement("span");
		pEl.className = "todoist-priority " + (PRIORITY_CLASS[task.priority] ?? "");
		pEl.textContent = PRIORITY_LABELS[task.priority] ?? "";
		meta.appendChild(pEl);
	}
	line.appendChild(meta);

	return row;
}

export function renderTaskTree(
	container: HTMLElement,
	roots: TaskNode[],
	options: {
		onToggle: (taskId: string, completed: boolean) => void;
		showCompleted: boolean;
	}
) {
	container.addClass("todoist-deepsync");
	container.addClass("todoist-task-list");
	container.empty();

	function renderNode(node: TaskNode, depth: number): HTMLElement | null {
		const { task } = node;
		if (!options.showCompleted && task.is_completed) return null;

		const hasChildren = node.children.length > 0;
		if (!hasChildren) {
			return createTaskLine(task, depth, options.onToggle);
		}

		// Parent with children: wrap in <details> for collapsible subtasks
		const details = document.createElement("details");
		details.className = "todoist-subtask-details";
		details.open = true;
		const summary = document.createElement("summary");
		summary.className = "todoist-subtask-summary";
		summary.appendChild(createTaskLine(task, depth, options.onToggle));
		details.appendChild(summary);
		const childrenEl = document.createElement("div");
		childrenEl.className = "todoist-subtask-children";
		for (const child of node.children) {
			const childEl = renderNode(child, depth + 1);
			if (childEl) childrenEl.appendChild(childEl);
		}
		details.appendChild(childrenEl);
		return details;
	}

	for (const root of roots) {
		const el = renderNode(root, 0);
		if (el) {
			const wrap = document.createElement("div");
			wrap.className = "todoist-parent-item";
			wrap.appendChild(el);
			container.appendChild(wrap);
		}
	}
}
