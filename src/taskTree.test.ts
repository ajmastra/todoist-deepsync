import { describe, it, expect } from "vitest";
import { buildTaskTree } from "./taskTree";
import type { TodoistTask } from "./types";

function task(
	id: string,
	order: number,
	parentId: string | null = null,
	projectId = "1",
	sectionId: string | null = null
): TodoistTask {
	return {
		id,
		content: `Task ${id}`,
		description: "",
		is_completed: false,
		order,
		priority: 1,
		project_id: projectId,
		labels: [],
		due: null,
		deadline: null,
		section_id: sectionId,
		parent_id: parentId,
		creator_id: "",
		created_at: "",
		assignee_id: null,
		assigner_id: null,
		url: "",
	};
}

describe("buildTaskTree", () => {
	it("returns empty array for no tasks", () => {
		expect(buildTaskTree([])).toEqual([]);
	});

	it("returns single task as root", () => {
		const tasks = [task("1", 0)];
		const roots = buildTaskTree(tasks);
		expect(roots).toHaveLength(1);
		expect(roots[0].task.id).toBe("1");
		expect(roots[0].children).toEqual([]);
	});

	it("builds parent-child from parent_id", () => {
		const tasks = [task("1", 0), task("2", 0, "1"), task("3", 1, "1")];
		const roots = buildTaskTree(tasks);
		expect(roots).toHaveLength(1);
		expect(roots[0].task.id).toBe("1");
		expect(roots[0].children).toHaveLength(2);
		expect(roots[0].children[0].task.id).toBe("2");
		expect(roots[0].children[1].task.id).toBe("3");
	});

	it("sorts roots and children by order", () => {
		const tasks = [task("2", 2), task("1", 1), task("3", 3)];
		const roots = buildTaskTree(tasks);
		expect(roots.map((r) => r.task.id)).toEqual(["1", "2", "3"]);
	});

	it("sorts nested children by order", () => {
		const tasks = [task("1", 0), task("2", 2, "1"), task("3", 1, "1")];
		const roots = buildTaskTree(tasks);
		expect(roots[0].children.map((c) => c.task.id)).toEqual(["3", "2"]);
	});

	it("handles multiple roots and nested subtasks", () => {
		const tasks = [task("a", 1), task("b", 0), task("b1", 0, "b"), task("b2", 1, "b")];
		const roots = buildTaskTree(tasks);
		expect(roots).toHaveLength(2);
		expect(roots[0].task.id).toBe("b");
		expect(roots[1].task.id).toBe("a");
		expect(roots[0].children).toHaveLength(2);
		expect(roots[0].children[0].task.id).toBe("b1");
		expect(roots[0].children[1].task.id).toBe("b2");
	});
});
