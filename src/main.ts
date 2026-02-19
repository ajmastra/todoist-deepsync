import { Plugin, MarkdownPostProcessorContext, MarkdownRenderChild, Notice, requestUrl, setIcon } from "obsidian";
import { buildTaskTree } from "./taskTree";
import { fetchTasks, closeTask, reopenTask } from "./todoistApi";
import { parseTodoistQuery } from "./parseQuery";
import { renderTaskTree } from "./renderer";
import { AddTaskModal } from "./AddTaskModal";
import { TodoistSubtaskSyncSettingTab } from "./settingsTab";
import { DEFAULT_SETTINGS } from "./settings";
import type { TodoistSubtaskSyncSettings } from "./settings";

export default class TodoistSubtaskSyncPlugin extends Plugin {
	settings!: TodoistSubtaskSyncSettings;
	private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
	private blockRenderers: Set<TodoistBlockRenderer> = new Set();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new TodoistSubtaskSyncSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor("todoist", (source, el, ctx) => {
			const child = new TodoistBlockRenderer(el, source, ctx, this);
			ctx.addChild(child);
			this.blockRenderers.add(child);
		});

		this.resetRefreshInterval();
	}

	onunload() {
		this.blockRenderers.clear();
		if (this.refreshIntervalId) clearInterval(this.refreshIntervalId);
	}

	registerBlock(renderer: TodoistBlockRenderer) {
		this.blockRenderers.add(renderer);
	}

	unregisterBlock(renderer: TodoistBlockRenderer) {
		this.blockRenderers.delete(renderer);
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	resetRefreshInterval() {
		if (this.refreshIntervalId) clearInterval(this.refreshIntervalId);
		const mins = Math.max(1, this.settings.refreshIntervalMinutes);
		this.refreshIntervalId = setInterval(() => {
			this.blockRenderers.forEach((r) => r.render());
		}, mins * 60 * 1000);
	}
}

class TodoistBlockRenderer extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private source: string,
		private ctx: MarkdownPostProcessorContext,
		private plugin: TodoistSubtaskSyncPlugin
	) {
		super(containerEl);
	}

	onload() {
		this.render();
	}

	onunload() {
		this.plugin.unregisterBlock(this);
	}

	async render() {
		const token = this.plugin.settings.apiToken?.trim();
		if (!token) {
			this.containerEl.empty();
			this.containerEl.createEl("p", { text: "Todoist: Set your API token in plugin settings." });
			return;
		}

		const query = parseTodoistQuery(this.source);
		const defaultQ = this.plugin.settings.defaultProjectOrFilter?.trim();
		const projectId = query.projectId ?? (defaultQ && /^\d+$/.test(defaultQ) ? defaultQ : undefined);
		const sectionId = query.sectionId;
		const filter = query.filter ?? (defaultQ && !/^\d+$/.test(defaultQ) ? defaultQ : undefined);

		try {
			const tasks = await fetchTasks(
				{ requestUrl },
				{
					token,
					projectId,
					sectionId,
					filter: filter || undefined,
					includeCompleted: this.plugin.settings.showCompletedTasks,
				}
			);
			const roots = buildTaskTree(tasks);
			this.containerEl.empty();
			this.containerEl.addClass("todoist-deepsync-block");

			const header = this.containerEl.createDiv({ cls: "todoist-block-header" });
			const refreshBtn = header.createEl("button", { cls: "todoist-refresh-btn clickable-icon" });
			setIcon(refreshBtn, "refresh-cw");
			refreshBtn.setAttribute("aria-label", "Refresh task list");
			refreshBtn.addEventListener("click", () => this.render());
			const addTaskBtn = header.createEl("button", { cls: "todoist-add-task-btn clickable-icon" });
			setIcon(addTaskBtn, "plus");
			addTaskBtn.setAttribute("aria-label", "Add task");
			addTaskBtn.addEventListener("click", () => {
				new AddTaskModal(this.plugin.app, {
					token,
					requestUrl,
					defaultProjectId: projectId ?? undefined,
					onSuccess: () => this.render(),
				}).open();
			});

			const content = this.containerEl.createDiv({ cls: "todoist-block-content" });
			renderTaskTree(content, roots, {
				showCompleted: this.plugin.settings.showCompletedTasks,
				onToggle: (taskId, completed) => this.handleToggle(taskId, completed),
			});
		} catch (e) {
			this.containerEl.empty();
			const err = e instanceof Error ? e.message : String(e);
			this.containerEl.createEl("p", { cls: "todoist-error", text: `Todoist: ${err}` });
		}
	}

	private async handleToggle(taskId: string, completed: boolean) {
		const token = this.plugin.settings.apiToken?.trim();
		if (!token) return;
		try {
			const req = { requestUrl };
			if (completed) {
				await closeTask(req, token, taskId);
			} else {
				await reopenTask(req, token, taskId);
			}
			new Notice(completed ? "Task completed" : "Task reopened");
			this.render();
		} catch (e) {
			const err = e instanceof Error ? e.message : String(e);
			new Notice(`Todoist: ${err}`);
			this.render();
		}
	}
}
