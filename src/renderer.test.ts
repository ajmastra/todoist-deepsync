import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderTaskTree } from "./renderer";
import type { TaskNode } from "./types";
import type { TodoistTask } from "./types";

/** Obsidian extends HTMLElement with addClass, empty, createDiv. Patch prototype for tests. */
interface ObsidianElementProto {
	addClass(cls: string): unknown;
	empty(): unknown;
	createDiv(opts?: { cls?: string }): HTMLDivElement;
}
beforeAll(() => {
	const proto = HTMLElement.prototype as unknown as HTMLElement & ObsidianElementProto;
	proto.addClass = function (cls: string) {
		this.classList.add(cls);
		return this;
	};
	proto.empty = function () {
		this.innerHTML = "";
		return this;
	};
	proto.createDiv = function (opts?: { cls?: string }) {
		const div = document.createElement("div");
		if (opts?.cls) div.className = opts.cls;
		this.appendChild(div);
		return div;
	};
});

function makeContainer(): HTMLElement {
	return document.createElement("div");
}

function task(
	id: string,
	content: string,
	opts: { is_completed?: boolean; due?: TodoistTask["due"]; priority?: number } = {}
): TodoistTask {
	return {
		id,
		content,
		description: "",
		is_completed: opts.is_completed ?? false,
		order: 0,
		priority: opts.priority ?? 1,
		project_id: "1",
		labels: [],
		due: opts.due ?? null,
		deadline: null,
		section_id: null,
		parent_id: null,
		creator_id: "",
		created_at: "",
		assignee_id: null,
		assigner_id: null,
		url: "",
	};
}

function node(t: TodoistTask, children: TaskNode[] = []): TaskNode {
	return { task: t, children };
}

describe("renderTaskTree", () => {
	it("adds todoist-deepsync and todoist-task-list classes to container", () => {
		const container = makeContainer();
		renderTaskTree(container, [], {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		expect(container.classList.contains("todoist-deepsync")).toBe(true);
		expect(container.classList.contains("todoist-task-list")).toBe(true);
	});

	it("renders nothing for empty roots", () => {
		const container = makeContainer();
		renderTaskTree(container, [], {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		expect(container.querySelector(".todoist-parent-item")).toBeNull();
	});

	it("renders a single task row with checkbox and content", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Hello world"))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const row = container.querySelector(".todoist-task-row");
		expect(row).not.toBeNull();
		expect(container.querySelector(".todoist-task-content")?.innerHTML).toBe("Hello world");
		const checkbox = container.querySelector(
			'.task-list-item-checkbox[data-task-id="1"]'
		) as HTMLInputElement;
		expect(checkbox).not.toBeNull();
		expect(checkbox.checked).toBe(false);
	});

	it("renders completed task with completed class and checked checkbox", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Done", { is_completed: true }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		expect(container.querySelector(".todoist-task-completed")).not.toBeNull();
		const checkbox = container.querySelector(
			'.task-list-item-checkbox[data-task-id="1"]'
		) as HTMLInputElement;
		expect(checkbox.checked).toBe(true);
	});

	it("hides completed tasks when showCompleted is false", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Done", { is_completed: true }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: false,
		});
		expect(container.querySelector(".todoist-task-row")).toBeNull();
	});

	it("renders subtask with todoist-subtask class and indent", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Parent"), [node(task("2", "Child"))])];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const rows = container.querySelectorAll(".todoist-task-row");
		expect(rows.length).toBe(2);
		expect(rows[1].classList.contains("todoist-subtask")).toBe(true);
		expect((rows[1] as HTMLElement).style.paddingLeft).toBe("20px");
	});

	it("renders parent with details/summary for collapsible subtasks", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Parent"), [node(task("2", "Child"))])];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const details = container.querySelector(".todoist-subtask-details");
		expect(details).not.toBeNull();
		expect(details?.querySelector(".todoist-subtask-summary")).not.toBeNull();
		expect(details?.querySelector(".todoist-subtask-children")).not.toBeNull();
	});

	it("calls onToggle when checkbox is changed", () => {
		const container = makeContainer();
		const onToggle = vi.fn();
		const roots: TaskNode[] = [node(task("1", "Task"))];
		renderTaskTree(container, roots, {
			onToggle,
			showCompleted: true,
		});
		const checkbox = container.querySelector(
			'.task-list-item-checkbox[data-task-id="1"]'
		) as HTMLInputElement;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		expect(onToggle).toHaveBeenCalledWith("1", true);
	});

	it("renders due date when present (date only)", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Task", { due: { date: "2025-02-18" } }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const dueEl = container.querySelector(".todoist-due");
		expect(dueEl).not.toBeNull();
		expect(dueEl?.textContent).toMatch(/\d{2}\/\d{2}\/\d{2}/);
	});

	it("renders due date with time (datetime)", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [
			node(task("1", "Task", { due: { date: "", datetime: "2025-02-18T16:30:00" } })),
		];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const dueEl = container.querySelector(".todoist-due");
		expect(dueEl).not.toBeNull();
		expect(dueEl?.textContent).toMatch(/@ \d{1,2}:\d{2} (AM|PM)/);
	});

	it("renders due string when only due.string is set", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Task", { due: { date: "", string: "tomorrow" } }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const dueEl = container.querySelector(".todoist-due");
		expect(dueEl).not.toBeNull();
		expect(dueEl?.textContent).toBe("tomorrow");
	});

	it("renders due date as-is when date does not match YYYY-MM-DD", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Task", { due: { date: "invalid" } }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const dueEl = container.querySelector(".todoist-due");
		expect(dueEl).not.toBeNull();
		expect(dueEl?.textContent).toBe("invalid");
	});

	it("renders priority indicator for priority > 1", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "Urgent", { priority: 3 }))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const pEl = container.querySelector(".todoist-priority.todoist-p3");
		expect(pEl).not.toBeNull();
		expect(pEl?.textContent).toBe("!!");
	});

	it("escapes HTML in task content", () => {
		const container = makeContainer();
		const roots: TaskNode[] = [node(task("1", "<script>alert(1)</script>"))];
		renderTaskTree(container, roots, {
			onToggle: vi.fn(),
			showCompleted: true,
		});
		const content = container.querySelector(".todoist-task-content");
		expect(content).not.toBeNull();
		const html = content!.innerHTML;
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;");
	});
});
