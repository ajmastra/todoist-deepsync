/** Todoist REST API v2 task (snake_case from API). */
export interface TodoistTask {
	id: string;
	content: string;
	description: string;
	is_completed: boolean;
	order: number;
	priority: number;
	project_id: string;
	labels: string[];
	due: { date: string; datetime?: string; string?: string; timezone?: string } | null;
	deadline: unknown | null;
	section_id: string | null;
	parent_id: string | null;
	creator_id: string;
	created_at: string;
	assignee_id: string | null;
	assigner_id: string | null;
	url: string;
}

/** Todoist project (snake_case from API). */
export interface TodoistProject {
	id: string;
	name: string;
	order: number;
	color: string;
	is_shared: boolean;
	is_favorite: boolean;
	is_inbox_project: boolean;
	parent_id: string | null;
	url: string;
}

/** Todoist section (snake_case from API). */
export interface TodoistSection {
	id: string;
	name: string;
	order: number;
	project_id: string;
}

/** Tree node: task with optional children (subtasks). */
export interface TaskNode {
	task: TodoistTask;
	children: TaskNode[];
}

/** Query parsed from ```todoist block content. */
export interface TodoistQuery {
	/** project_id, section_id, or filter (only one used per API call). */
	projectId?: string;
	sectionId?: string;
	/** Todoist filter string, e.g. "today | overdue" or "#ProjectName". */
	filter?: string;
}
