import type { TodoistTask } from "./types";
import type { TaskNode } from "./types";

/**
 * Build a tree from flat tasks using parent_id. Preserves order (by task.order).
 */
export function buildTaskTree(tasks: TodoistTask[]): TaskNode[] {
	const byId = new Map<string, TodoistTask>();
	for (const t of tasks) byId.set(t.id, t);

	const nodes = new Map<string, TaskNode>();
	for (const t of tasks) {
		nodes.set(t.id, { task: t, children: [] });
	}

	const roots: TaskNode[] = [];
	for (const t of tasks) {
		const node = nodes.get(t.id)!;
		const parentId = t.parent_id;
		if (!parentId || !nodes.has(parentId)) {
			roots.push(node);
		} else {
			const parent = nodes.get(parentId)!;
			parent.children.push(node);
		}
	}

	// Sort roots and each node's children by order
	const sortByOrder = (a: TaskNode, b: TaskNode) => a.task.order - b.task.order;
	roots.sort(sortByOrder);
	function sortChildren(n: TaskNode) {
		n.children.sort(sortByOrder);
		n.children.forEach(sortChildren);
	}
	roots.forEach(sortChildren);

	return roots;
}
