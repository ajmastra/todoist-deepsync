import type { TodoistTask, TodoistProject, TodoistSection } from "./types";

export interface RequestUrlParam {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}
export interface RequestUrlResponse {
	status: number;
	json?: () => Promise<unknown>;
	text?: string;
}

type AppWithRequest = { requestUrl: (opts: RequestUrlParam) => Promise<RequestUrlResponse> };

/** Parse JSON from Obsidian requestUrl response. Handles json() method, json Promise getter, or text. */
async function parseJson<T>(res: RequestUrlResponse): Promise<T> {
	const r = res as RequestUrlResponse & { json?: unknown; text?: string };
	const j = r.json;
	if (typeof j === "function") return (await j.call(res)) as T;
	if (j && typeof (j as Promise<unknown>).then === "function") return (await j) as T;
	// Fallback: parse text if available (some Obsidian versions expose body as text)
	if (typeof r.text === "string") return JSON.parse(r.text) as T;
	throw new Error("Response has no json method, Promise, or text");
}

// Use Sync API (api.todoist.com/api/v1/sync) — REST v2 (rest/v2/tasks) returns 410 Gone
const SYNC_URL = "https://api.todoist.com/api/v1/sync";

function authHeader(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
	};
}

/** Sync API item (tasks are "items" in Sync API). */
interface SyncItem {
	id: string;
	content: string;
	project_id: string;
	completed?: boolean;
	checked?: boolean; // legacy Sync field
	parent_id?: string | null;
	priority?: number;
	item_order?: number;
	due?: { date?: string; datetime?: string; string?: string } | null;
	section_id?: string | null;
	child_order?: number;
	day_order?: number;
	responsible_uid?: string | null;
	assignee_id?: string | null;
	date_added?: string;
	date_completed?: string | null;
	labels?: string[];
}

/** Sync API response when reading resources. */
interface SyncReadResponse {
	items?: SyncItem[];
	projects?: Array<{
		id: string;
		name: string;
		order: number;
		color: string;
		is_shared?: boolean;
		is_favorite?: boolean;
		is_inbox_project?: boolean;
		parent_id?: string | null;
		child_order?: number;
	}>;
	sections?: Array<{ id: string; name: string; order: number; project_id: string }>;
	sync_token?: string;
}

/** Map Sync API item to our TodoistTask shape. */
function syncItemToTask(item: SyncItem): TodoistTask {
	const due = item.due
		? {
				date: item.due.date ?? "",
				datetime: item.due.datetime,
				string: item.due.string,
			}
		: null;
	return {
		id: item.id,
		content: item.content,
		description: "",
		is_completed: item.completed === true || item.checked === true,
		order: item.item_order ?? item.child_order ?? 0,
		priority: item.priority ?? 1,
		project_id: item.project_id,
		labels: item.labels ?? [],
		due,
		deadline: null,
		section_id: item.section_id ?? null,
		parent_id: item.parent_id ?? null,
		creator_id: "",
		created_at: item.date_added ?? "",
		assignee_id: item.assignee_id ?? item.responsible_uid ?? null,
		assigner_id: null,
		url: `https://app.todoist.com/showTask?id=${item.id}`,
	};
}

export interface FetchTasksOptions {
	token: string;
	projectId?: string;
	sectionId?: string;
	filter?: string;
	includeCompleted?: boolean;
}

/** Parse a task's due date to a Date object (date only, ignoring time). */
function parseDueDate(task: TodoistTask): Date | null {
	if (!task.due) return null;
	const dateStr = task.due.datetime || task.due.date;
	if (!dateStr) return null;
	// Extract date part (YYYY-MM-DD) from ISO datetime or use date directly
	const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
	return new Date(dateOnly + "T00:00:00");
}

/** Check if a date is today (ignoring time). */
function isToday(date: Date): boolean {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const compare = new Date(date);
	compare.setHours(0, 0, 0, 0);
	return compare.getTime() === today.getTime();
}

/** Check if a date is before today (overdue). */
function isOverdue(date: Date): boolean {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const compare = new Date(date);
	compare.setHours(0, 0, 0, 0);
	return compare.getTime() < today.getTime();
}

/** Check if a date is tomorrow. */
function isTomorrow(date: Date): boolean {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(0, 0, 0, 0);
	const compare = new Date(date);
	compare.setHours(0, 0, 0, 0);
	return compare.getTime() === tomorrow.getTime();
}

/** Apply client-side filter matching Todoist filter syntax. */
function applyFilter(tasks: TodoistTask[], filter: string): TodoistTask[] {
	const filterLower = filter.trim().toLowerCase();

	// Handle common filter patterns
	if (filterLower === "today") {
		return tasks.filter((task) => {
			const dueDate = parseDueDate(task);
			if (!dueDate) return false; // Exclude tasks without dates
			return isToday(dueDate);
		});
	}

	if (filterLower === "overdue") {
		return tasks.filter((task) => {
			const dueDate = parseDueDate(task);
			if (!dueDate) return false;
			return isOverdue(dueDate);
		});
	}

	if (filterLower === "tomorrow") {
		return tasks.filter((task) => {
			const dueDate = parseDueDate(task);
			if (!dueDate) return false;
			return isTomorrow(dueDate);
		});
	}

	// Handle "today | overdue" (today OR overdue)
	if (filterLower.includes("|")) {
		const parts = filterLower.split("|").map((p) => p.trim());
		return tasks.filter((task) => {
			const dueDate = parseDueDate(task);
			if (!dueDate) return false;
			return parts.some((part) => {
				if (part === "today") return isToday(dueDate);
				if (part === "overdue") return isOverdue(dueDate);
				if (part === "tomorrow") return isTomorrow(dueDate);
				return false;
			});
		});
	}

	// Handle "today & overdue" (today AND overdue - which would be empty, but handle it)
	if (filterLower.includes("&")) {
		const parts = filterLower.split("&").map((p) => p.trim());
		return tasks.filter((task) => {
			const dueDate = parseDueDate(task);
			if (!dueDate) return false;
			return parts.every((part) => {
				if (part === "today") return isToday(dueDate);
				if (part === "overdue") return isOverdue(dueDate);
				if (part === "tomorrow") return isTomorrow(dueDate);
				return false;
			});
		});
	}

	// For project filters like "#ProjectName", we'd need project names, which we don't have here
	// So for now, just return all tasks if filter doesn't match known patterns
	// In a full implementation, you'd parse project names from the filter
	return tasks;
}

/**
 * Fetch tasks via Todoist Sync API (POST /api/v1/sync).
 * REST v2 returns 410 Gone, so we use Sync API and filter client-side.
 */
export async function fetchTasks(
	app: AppWithRequest,
	opts: FetchTasksOptions
): Promise<TodoistTask[]> {
	const { token, projectId, sectionId, filter, includeCompleted } = opts;
	// Sync API: POST form with sync_token=* and resource_types=["items"]
	const body = new URLSearchParams();
	body.set("sync_token", "*");
	body.set("resource_types", JSON.stringify(["items"]));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) {
		let errBody = String(res.status);
		try {
			const data = await parseJson<unknown>(res);
			if (data != null) errBody = JSON.stringify(data);
		} catch (_) {
			// Ignore JSON parse errors, fall back to status code
		}
		throw new Error(`Todoist API error ${res.status}: ${errBody}`);
	}

	const data = await parseJson<SyncReadResponse>(res);
	const items: SyncItem[] = data.items ?? [];
	let tasks = items.map(syncItemToTask);

	if (projectId) tasks = tasks.filter((t) => t.project_id === projectId);
	if (sectionId) tasks = tasks.filter((t) => t.section_id === sectionId);
	if (!includeCompleted) tasks = tasks.filter((t) => !t.is_completed);
	if (filter) tasks = applyFilter(tasks, filter);

	// Sort by order for stable tree
	tasks.sort((a, b) => a.order - b.order);
	return tasks;
}

/**
 * Close (complete) a task via Sync API command.
 */
export async function closeTask(app: AppWithRequest, token: string, taskId: string): Promise<void> {
	const uuid = crypto.randomUUID?.() ?? `close-${taskId}-${Date.now()}`;
	const commands = [{ type: "item_complete", uuid, args: { id: taskId } }];
	const body = new URLSearchParams();
	body.set("commands", JSON.stringify(commands));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) {
		throw new Error(`Todoist close task failed: ${res.status}`);
	}
	const data = await parseJson<{ sync_status?: Record<string, unknown> }>(res);
	const status = data.sync_status?.[uuid];
	if (
		status !== "ok" &&
		status != null &&
		typeof status === "object" &&
		(status as { error?: string }).error
	) {
		throw new Error((status as { error: string }).error);
	}
}

/**
 * Reopen (uncomplete) a task via Sync API command.
 */
export async function reopenTask(
	app: AppWithRequest,
	token: string,
	taskId: string
): Promise<void> {
	const uuid = crypto.randomUUID?.() ?? `reopen-${taskId}-${Date.now()}`;
	const commands = [{ type: "item_uncomplete", uuid, args: { id: taskId } }];
	const body = new URLSearchParams();
	body.set("commands", JSON.stringify(commands));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) {
		throw new Error(`Todoist reopen task failed: ${res.status}`);
	}
	const data = await parseJson<{ sync_status?: Record<string, unknown> }>(res);
	const status = data.sync_status?.[uuid];
	if (
		status !== "ok" &&
		status != null &&
		typeof status === "object" &&
		(status as { error?: string }).error
	) {
		throw new Error((status as { error: string }).error);
	}
}

export interface CreateTaskOptions {
	token: string;
	content: string;
	description?: string;
	project_id: string;
	section_id?: string | null;
	parent_id?: string | null;
	due?: { date?: string; string?: string } | null;
	priority?: number;
}

/**
 * Create a task via Sync API item_add command.
 */
export async function createTask(app: AppWithRequest, opts: CreateTaskOptions): Promise<string> {
	const tempId = crypto.randomUUID?.() ?? `temp-${Date.now()}`;
	const uuid = crypto.randomUUID?.() ?? `add-${Date.now()}`;
	const args: Record<string, unknown> = {
		content: opts.content,
		project_id: opts.project_id,
	};
	if (opts.description != null && opts.description !== "")
		args.description = opts.description;
	if (opts.section_id) args.section_id = opts.section_id;
	if (opts.parent_id) args.parent_id = opts.parent_id;
	if (opts.priority != null && opts.priority > 1) args.priority = opts.priority;
	if (opts.due) {
		if (opts.due.string) args.due = { string: opts.due.string };
		else if (opts.due.date) args.due = { date: opts.due.date };
	}
	const commands = [{ type: "item_add", temp_id: tempId, uuid, args }];
	const body = new URLSearchParams();
	body.set("commands", JSON.stringify(commands));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(opts.token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) {
		throw new Error(`Todoist create task failed: ${res.status}`);
	}
	const data = await parseJson<{
		sync_status?: Record<string, unknown>;
		temp_id_mapping?: Record<string, string>;
	}>(res);
	const status = data.sync_status?.[uuid];
	if (
		status !== "ok" &&
		status != null &&
		typeof status === "object" &&
		(status as { error?: string }).error
	) {
		throw new Error((status as { error: string }).error);
	}
	const newId = data.temp_id_mapping?.[tempId];
	return newId ?? "";
}

/**
 * Get all projects via Sync API.
 */
export async function fetchProjects(app: AppWithRequest, token: string): Promise<TodoistProject[]> {
	const body = new URLSearchParams();
	body.set("sync_token", "*");
	body.set("resource_types", JSON.stringify(["projects"]));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) throw new Error(`Todoist projects failed: ${res.status}`);
	const data = await parseJson<SyncReadResponse>(res);
	const raw = data.projects ?? [];
	return raw.map((p) => ({
		id: p.id,
		name: p.name,
		order: p.order ?? 0,
		color: p.color ?? "grey",
		is_shared: p.is_shared ?? false,
		is_favorite: p.is_favorite ?? false,
		is_inbox_project: p.is_inbox_project ?? false,
		parent_id: p.parent_id ?? null,
		url: `https://app.todoist.com/showProject?id=${p.id}`,
	})) as TodoistProject[];
}

/**
 * Get all sections via Sync API (single call; filter client-side by project_id if needed).
 */
export async function fetchAllSections(
	app: AppWithRequest,
	token: string
): Promise<TodoistSection[]> {
	const body = new URLSearchParams();
	body.set("sync_token", "*");
	body.set("resource_types", JSON.stringify(["sections"]));

	const res = await app.requestUrl({
		url: SYNC_URL,
		method: "POST",
		headers: {
			...authHeader(token),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	if (res.status !== 200) throw new Error(`Todoist sections failed: ${res.status}`);
	const data = await parseJson<SyncReadResponse>(res);
	const raw = data.sections ?? [];
	return raw.map((s) => ({
		id: s.id,
		name: s.name,
		order: s.order,
		project_id: s.project_id,
	})) as TodoistSection[];
}

/**
 * Get sections for a single project via Sync API.
 */
export async function fetchSections(
	app: AppWithRequest,
	token: string,
	projectId: string
): Promise<TodoistSection[]> {
	const all = await fetchAllSections(app, token);
	return all.filter((s) => s.project_id === projectId).sort((a, b) => a.order - b.order);
}
