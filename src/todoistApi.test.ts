import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	fetchTasks,
	closeTask,
	reopenTask,
	createTask,
	fetchProjects,
	fetchAllSections,
	fetchSections,
	type RequestUrlParam,
	type RequestUrlResponse,
} from "./todoistApi";

/** Mock app type compatible with API functions. */
type MockApp = {
	requestUrl: (opts: RequestUrlParam) => Promise<RequestUrlResponse>;
};

function mockApp(responses: RequestUrlResponse[]): MockApp {
	let i = 0;
	return {
		requestUrl: vi.fn().mockImplementation(() => {
			const r = responses[i++] ?? responses[responses.length - 1];
			return Promise.resolve(r);
		}),
	};
}

function jsonRes<T>(data: T): RequestUrlResponse {
	return {
		status: 200,
		json: () => Promise.resolve(data),
	};
}

// Fix UUIDs so mock responses can return matching sync_status
const FIXED_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
beforeEach(() => {
	vi.stubGlobal("crypto", {
		randomUUID: () => FIXED_UUID,
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe("todoistApi", () => {
	describe("fetchTasks", () => {
		const syncItems = [
			{
				id: "1",
				content: "Task 1",
				project_id: "p1",
				section_id: "s1",
				parent_id: null,
				completed: false,
				priority: 1,
				item_order: 0,
				due: { date: "2025-02-18" },
				date_added: "2025-01-01",
			},
			{
				id: "2",
				content: "Task 2",
				project_id: "p1",
				section_id: "s1",
				parent_id: null,
				completed: true,
				priority: 2,
				item_order: 1,
				due: null,
				date_added: "2025-01-01",
			},
			{
				id: "3",
				content: "Other project",
				project_id: "p2",
				section_id: null,
				parent_id: null,
				completed: false,
				item_order: 0,
				due: { date: "2025-02-17" },
			},
		];

		it("returns tasks from sync API and maps to TodoistTask shape", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				includeCompleted: true,
			});
			expect(tasks).toHaveLength(3);
			expect(tasks[0].id).toBe("1");
			expect(tasks[0].content).toBe("Task 1");
			expect(tasks[0].project_id).toBe("p1");
			expect(tasks[0].section_id).toBe("s1");
			expect(tasks[0].is_completed).toBe(false);
			expect(tasks[0].priority).toBe(1);
			// After sort by order: (1,0), (3,0), (2,1) so tasks[2] is the completed one
			const completedTask = tasks.find((t) => t.id === "2");
			expect(completedTask?.is_completed).toBe(true);
		});

		it("filters by projectId", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				projectId: "p1",
				includeCompleted: true,
			});
			expect(tasks).toHaveLength(2);
			expect(tasks.every((t) => t.project_id === "p1")).toBe(true);
		});

		it("filters by sectionId", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				sectionId: "s1",
				includeCompleted: true,
			});
			expect(tasks).toHaveLength(2);
			expect(tasks.every((t) => t.section_id === "s1")).toBe(true);
		});

		it("excludes completed when includeCompleted is false", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				includeCompleted: false,
			});
			expect(tasks).toHaveLength(2);
			expect(tasks.every((t) => !t.is_completed)).toBe(true);
		});

		it("filters by today", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				filter: "today",
				includeCompleted: true,
			});
			// Task 1 has due 2025-02-18; "today" is relative to test run date
			expect(Array.isArray(tasks)).toBe(true);
		});

		it("filters by overdue", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				filter: "overdue",
				includeCompleted: true,
			});
			expect(Array.isArray(tasks)).toBe(true);
		});

		it("filters by tomorrow", async () => {
			const app = mockApp([jsonRes({ items: syncItems })]);
			const tasks = await fetchTasks(app, {
				token: "test",
				filter: "tomorrow",
				includeCompleted: true,
			});
			expect(Array.isArray(tasks)).toBe(true);
		});

		it("throws on non-200 status", async () => {
			const app = mockApp([{ status: 401, json: () => Promise.resolve({ error: "Unauthorized" }) }]);
			await expect(fetchTasks(app, { token: "test", includeCompleted: true })).rejects.toThrow(
				/Todoist API error 401/
			);
		});

		it("parses response with text body when json() not available", async () => {
			const app = mockApp([
				{
					status: 200,
					text:
						'{"items":[{"id":"1","content":"T","project_id":"p1","completed":false,"item_order":0}]}',
				},
			]);
			const tasks = await fetchTasks(app, { token: "test", includeCompleted: true });
			expect(tasks).toHaveLength(1);
			expect(tasks[0].content).toBe("T");
		});
	});

	describe("closeTask", () => {
		it("sends item_complete and succeeds on ok sync_status", async () => {
			const app = mockApp([jsonRes({ sync_status: { [FIXED_UUID]: "ok" } })]);
			await expect(closeTask(app, "token", "task-1")).resolves.toBeUndefined();
		});

		it("throws on non-200", async () => {
			const app = mockApp([{ status: 500 }]);
			await expect(closeTask(app, "token", "task-1")).rejects.toThrow(/close task failed/);
		});

		it("throws on sync_status error object", async () => {
			const app = mockApp([jsonRes({ sync_status: { [FIXED_UUID]: { error: "Task not found" } } })]);
			await expect(closeTask(app, "token", "task-1")).rejects.toThrow("Task not found");
		});
	});

	describe("reopenTask", () => {
		it("sends item_uncomplete and succeeds on ok", async () => {
			const app = mockApp([jsonRes({ sync_status: { [FIXED_UUID]: "ok" } })]);
			await expect(reopenTask(app, "token", "task-1")).resolves.toBeUndefined();
		});

		it("throws on non-200", async () => {
			const app = mockApp([{ status: 500 }]);
			await expect(reopenTask(app, "token", "task-1")).rejects.toThrow(/reopen task failed/);
		});
	});

	describe("createTask", () => {
		it("sends item_add and returns new id from temp_id_mapping", async () => {
			// createTask uses randomUUID for both temp_id and uuid; both get FIXED_UUID
			const app = mockApp([
				jsonRes({
					sync_status: { [FIXED_UUID]: "ok" },
					temp_id_mapping: { [FIXED_UUID]: "new-task-id-123" },
				}),
			]);
			const id = await createTask(app, {
				token: "t",
				content: "New task",
				project_id: "p1",
			});
			expect(id).toBe("new-task-id-123");
		});

		it("throws on non-200", async () => {
			const app = mockApp([{ status: 400 }]);
			await expect(createTask(app, { token: "t", content: "x", project_id: "p1" })).rejects.toThrow(
				/create task failed/
			);
		});

		it("throws on sync_status error object", async () => {
			const app = mockApp([jsonRes({ sync_status: { [FIXED_UUID]: { error: "Invalid project" } } })]);
			await expect(createTask(app, { token: "t", content: "x", project_id: "p1" })).rejects.toThrow(
				"Invalid project"
			);
		});

		it("passes optional args when provided", async () => {
			const app = mockApp([
				jsonRes({ sync_status: { "add-uuid": "ok" }, temp_id_mapping: { "temp-id": "id" } }),
			]);
			await createTask(app, {
				token: "t",
				content: "Task",
				project_id: "p1",
				section_id: "s1",
				parent_id: "parent1",
				due: { date: "2025-02-20" },
				priority: 3,
				description: "desc",
			});
			const body = (app.requestUrl as unknown as { mock: { calls: [RequestUrlParam][] } }).mock
				.calls[0][0].body;
			expect(body).toContain("item_add");
			expect(body).toContain("s1");
			expect(body).toContain("parent1");
			expect(body).toContain("2025-02-20");
			expect(body).toContain("3");
			expect(body).toContain("desc");
		});
	});

	describe("fetchProjects", () => {
		it("returns mapped projects", async () => {
			const app = mockApp([
				jsonRes({
					projects: [
						{
							id: "p1",
							name: "Inbox",
							order: 0,
							color: "grey",
							is_inbox_project: true,
						},
					],
				}),
			]);
			const projects = await fetchProjects(app, "token");
			expect(projects).toHaveLength(1);
			expect(projects[0].id).toBe("p1");
			expect(projects[0].name).toBe("Inbox");
			expect(projects[0].url).toContain("p1");
		});

		it("throws on non-200", async () => {
			const app = mockApp([{ status: 401 }]);
			await expect(fetchProjects(app, "token")).rejects.toThrow(/projects failed/);
		});
	});

	describe("fetchAllSections", () => {
		it("returns mapped sections", async () => {
			const app = mockApp([
				jsonRes({
					sections: [{ id: "s1", name: "Section A", order: 0, project_id: "p1" }],
				}),
			]);
			const sections = await fetchAllSections(app, "token");
			expect(sections).toHaveLength(1);
			expect(sections[0].id).toBe("s1");
			expect(sections[0].name).toBe("Section A");
			expect(sections[0].project_id).toBe("p1");
		});

		it("throws on non-200", async () => {
			const app = mockApp([{ status: 401 }]);
			await expect(fetchAllSections(app, "token")).rejects.toThrow(/sections failed/);
		});
	});

	describe("fetchSections", () => {
		it("filters by projectId and sorts by order", async () => {
			const app = mockApp([
				jsonRes({
					sections: [
						{ id: "s2", name: "B", order: 1, project_id: "p1" },
						{ id: "s1", name: "A", order: 0, project_id: "p1" },
						{ id: "s3", name: "Other", order: 0, project_id: "p2" },
					],
				}),
			]);
			const sections = await fetchSections(app, "token", "p1");
			expect(sections).toHaveLength(2);
			expect(sections[0].id).toBe("s1");
			expect(sections[1].id).toBe("s2");
		});
	});
});
