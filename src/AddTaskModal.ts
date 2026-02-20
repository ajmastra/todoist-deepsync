import type { App } from "obsidian";
import { Modal, setIcon, Menu } from "obsidian";
import type { TodoistProject, TodoistSection, TodoistTask } from "./types";
import { createTask, fetchProjects, fetchSections, fetchTasks } from "./todoistApi";
import type { RequestUrlParam, RequestUrlResponse } from "./todoistApi";

export type RequestUrlFn = (opts: RequestUrlParam) => Promise<RequestUrlResponse>;

export interface AddTaskModalResult {
	content: string;
	project_id: string;
	section_id: string | null;
	parent_id: string | null;
	due: { date?: string; string?: string } | null;
	priority: number;
}

export class AddTaskModal extends Modal {
	private defaultProjectId: string;
	private token: string;
	private requestUrl: RequestUrlFn;
	private projects: TodoistProject[] = [];
	private sections: TodoistSection[] = [];
	private tasks: TodoistTask[] = [];

	// Selected values
	private selectedProjectId: string = "";
	private selectedSectionId: string | null = null;
	private selectedParentId: string | null = null;
	private selectedDue: { date?: string; string?: string } | null = null;
	private selectedPriority: number = 1;

	// UI elements
	private contentInput!: HTMLInputElement;
	private projectBtn!: HTMLElement;
	private sectionBtn!: HTMLElement;
	private priorityBtn!: HTMLElement;
	private dueBtn!: HTMLElement;
	private parentBtn!: HTMLElement;

	constructor(
		app: App,
		opts: {
			token: string;
			requestUrl: RequestUrlFn;
			defaultProjectId?: string;
			onSuccess?: () => void;
		}
	) {
		super(app);
		this.token = opts.token;
		this.requestUrl = opts.requestUrl;
		this.defaultProjectId = opts.defaultProjectId ?? "";
		(this as AddTaskModal & { onSuccess?: () => void }).onSuccess = opts.onSuccess;
	}

	async onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("todoist-add-task-modal");
		contentEl.empty();

		// Title
		const titleRow = contentEl.createDiv({ cls: "todoist-modal-title-row" });
		titleRow.createEl("h2", { text: "Create task" });

		// Main task input
		const inputContainer = contentEl.createDiv({ cls: "todoist-modal-input-container" });
		this.contentInput = inputContainer.createEl("input", {
			type: "text",
			cls: "todoist-modal-main-input",
			placeholder: "Task description",
		});

		// Icon buttons row — build all icons immediately so they appear at once
		const iconRow = contentEl.createDiv({ cls: "todoist-modal-icon-row" });

		// Project button
		this.projectBtn = iconRow.createDiv({ cls: "todoist-icon-btn" });
		setIcon(this.projectBtn, "folder");
		this.projectBtn.setAttribute("aria-label", "Project");
		this.projectBtn.title = "Project";
		this.projectBtn.addEventListener("click", (e) => this.showProjectMenu(e));

		// Section button
		this.sectionBtn = iconRow.createDiv({ cls: "todoist-icon-btn" });
		setIcon(this.sectionBtn, "list");
		this.sectionBtn.setAttribute("aria-label", "Section");
		this.sectionBtn.title = "Section";
		this.sectionBtn.addEventListener("click", (e) => this.showSectionMenu(e));

		// Separator
		iconRow.createDiv({ cls: "todoist-icon-separator" });

		// Due date button
		this.dueBtn = iconRow.createDiv({ cls: "todoist-icon-btn" });
		setIcon(this.dueBtn, "calendar");
		this.dueBtn.setAttribute("aria-label", "Due date");
		this.dueBtn.title = "Due date";
		this.updateDueButton();
		this.dueBtn.addEventListener("click", (e) => this.showDueMenu(e));

		// Priority button
		this.priorityBtn = iconRow.createDiv({ cls: "todoist-icon-btn" });
		setIcon(this.priorityBtn, "flag");
		this.priorityBtn.setAttribute("aria-label", "Priority");
		this.priorityBtn.title = "Priority";
		this.updatePriorityButton();
		this.priorityBtn.addEventListener("click", (e) => this.showPriorityMenu(e));

		// Parent/Subtask button
		this.parentBtn = iconRow.createDiv({ cls: "todoist-icon-btn" });
		setIcon(this.parentBtn, "indent");
		this.parentBtn.setAttribute("aria-label", "Subtask of");
		this.parentBtn.title = "Subtask of";
		this.parentBtn.addEventListener("click", (e) => this.showParentMenu(e));

		// Buttons row
		const btnRow = contentEl.createDiv({ cls: "todoist-modal-buttons" });
		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		const submitBtn = btnRow.createEl("button", { text: "Save", cls: "mod-cta" });
		cancelBtn.addEventListener("click", () => this.close());
		submitBtn.addEventListener("click", () => this.submit());
		this.contentInput.focus();

		// Load projects in the background so the full UI is visible immediately
		this.loadProjects().then(() => {
			this.updateProjectButton();
			this.updateSectionButton();
			this.updateParentButton();
		});
	}

	private async loadProjects() {
		this.projects = await fetchProjects({ requestUrl: this.requestUrl }, this.token);
		if (this.defaultProjectId) {
			this.selectedProjectId = this.defaultProjectId;
		} else if (this.projects.length > 0) {
			this.selectedProjectId = this.projects[0].id;
		}
		if (this.selectedProjectId) {
			await this.loadSectionsAndTasks();
		}
	}

	private async loadSectionsAndTasks() {
		if (!this.selectedProjectId) return;
		this.sections = await fetchSections(
			{ requestUrl: this.requestUrl },
			this.token,
			this.selectedProjectId
		);
		this.tasks = await fetchTasks(
			{ requestUrl: this.requestUrl },
			{ token: this.token, projectId: this.selectedProjectId, includeCompleted: false }
		);
	}

	private updateProjectButton() {
		const project = this.projects.find((p) => p.id === this.selectedProjectId);
		if (project) {
			this.projectBtn.setAttribute("data-selected", "true");
			this.projectBtn.title = `Project: ${project.name}`;
		} else {
			this.projectBtn.removeAttribute("data-selected");
			this.projectBtn.title = "Project";
		}
	}

	private updateDueButton() {
		if (this.selectedDue) {
			this.dueBtn.setAttribute("data-selected", "true");
			const dueStr = this.selectedDue.string || this.selectedDue.date || "";
			this.dueBtn.title = `Due: ${dueStr}`;
		} else {
			this.dueBtn.removeAttribute("data-selected");
			this.dueBtn.title = "Due date";
		}
	}

	private updatePriorityButton() {
		if (this.selectedPriority > 1) {
			this.priorityBtn.setAttribute("data-selected", "true");
			this.priorityBtn.title = `Priority: ${this.selectedPriority}`;
		} else {
			this.priorityBtn.removeAttribute("data-selected");
			this.priorityBtn.title = "Priority";
		}
	}

	private showProjectMenu(evt: MouseEvent) {
		const menu = new Menu();
		if (this.projects.length === 0) {
			menu.addItem((item) => item.setTitle("Loading...").setDisabled(true));
		}
		for (const p of this.projects) {
			menu.addItem((item) => {
				item.setTitle(p.name);
				item.setChecked(p.id === this.selectedProjectId);
				item.onClick(async () => {
					this.selectedProjectId = p.id;
					this.selectedSectionId = null;
					this.selectedParentId = null;
					await this.loadSectionsAndTasks();
					this.updateProjectButton();
					this.updateSectionButton();
					this.updateParentButton();
				});
			});
		}
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	private updateSectionButton() {
		if (this.selectedSectionId) {
			const section = this.sections.find((s) => s.id === this.selectedSectionId);
			if (section) {
				this.sectionBtn.setAttribute("data-selected", "true");
				this.sectionBtn.title = `Section: ${section.name}`;
			}
		} else {
			this.sectionBtn.removeAttribute("data-selected");
			this.sectionBtn.title = "Section";
		}
	}

	private showSectionMenu(evt: MouseEvent) {
		if (!this.selectedProjectId) return;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle("— None —");
			item.setChecked(!this.selectedSectionId);
			item.onClick(() => {
				this.selectedSectionId = null;
				this.updateSectionButton();
			});
		});
		for (const s of this.sections) {
			menu.addItem((item) => {
				item.setTitle(s.name);
				item.setChecked(s.id === this.selectedSectionId);
				item.onClick(() => {
					this.selectedSectionId = s.id;
					this.updateSectionButton();
				});
			});
		}
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	private showDueMenu(evt: MouseEvent) {
		const menu = new Menu();
		const quickDates = [
			{ label: "Today", value: "today" },
			{ label: "Tomorrow", value: "tomorrow" },
			{ label: "Next week", value: "next week" },
			{ label: "No date", value: "" },
		];
		for (const qd of quickDates) {
			menu.addItem((item) => {
				item.setTitle(qd.label);
				item.setChecked(
					this.selectedDue?.string === qd.value || (!this.selectedDue && qd.value === "")
				);
				item.onClick(() => {
					this.selectedDue = qd.value ? { string: qd.value } : null;
					this.updateDueButton();
				});
			});
		}
		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle("Custom date...");
			item.onClick(() => {
				const input = prompt("Enter date (e.g. 2025-12-31, next monday):");
				if (input) {
					this.selectedDue = /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
						? { date: input.trim() }
						: { string: input.trim() };
					this.updateDueButton();
				}
			});
		});
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	private showPriorityMenu(evt: MouseEvent) {
		const menu = new Menu();
		const priorities = [
			{ label: "Normal", value: 1 },
			{ label: "Priority 2", value: 2 },
			{ label: "Priority 3", value: 3 },
			{ label: "Priority 4", value: 4 },
		];
		for (const p of priorities) {
			menu.addItem((item) => {
				item.setTitle(p.label);
				item.setChecked(this.selectedPriority === p.value);
				item.onClick(() => {
					this.selectedPriority = p.value;
					this.updatePriorityButton();
				});
			});
		}
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	private updateParentButton() {
		if (this.selectedParentId) {
			const task = this.tasks.find((t) => t.id === this.selectedParentId);
			if (task) {
				this.parentBtn.setAttribute("data-selected", "true");
				this.parentBtn.title = `Subtask of: ${task.content.slice(0, 30)}`;
			}
		} else {
			this.parentBtn.removeAttribute("data-selected");
			this.parentBtn.title = "Subtask of";
		}
	}

	private showParentMenu(evt: MouseEvent) {
		if (!this.selectedProjectId) return;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle("— None —");
			item.setChecked(!this.selectedParentId);
			item.onClick(() => {
				this.selectedParentId = null;
				this.updateParentButton();
			});
		});
		const rootTasks = this.tasks.filter((t) => !t.parent_id);
		for (const t of rootTasks) {
			menu.addItem((item) => {
				item.setTitle(t.content.slice(0, 50) + (t.content.length > 50 ? "…" : ""));
				item.setChecked(t.id === this.selectedParentId);
				item.onClick(() => {
					this.selectedParentId = t.id;
					this.updateParentButton();
				});
			});
		}
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	private async submit() {
		const content = this.contentInput.value.trim();
		if (!content) return;
		if (!this.selectedProjectId) return;

		try {
			await createTask(
				{ requestUrl: this.requestUrl },
				{
					token: this.token,
					content,
					project_id: this.selectedProjectId,
					section_id: this.selectedSectionId,
					parent_id: this.selectedParentId,
					due: this.selectedDue,
					priority: this.selectedPriority,
				}
			);
			(this as AddTaskModal & { onSuccess?: () => void }).onSuccess?.();
			this.close();
		} catch (e) {
			const err = e instanceof Error ? e.message : String(e);
			const { contentEl } = this;
			const existingErr = contentEl.querySelector(".todoist-modal-error");
			if (existingErr) existingErr.remove();
			const errEl = contentEl.createEl("p", { cls: "todoist-modal-error", text: err });
			contentEl.insertBefore(errEl, contentEl.firstElementChild?.nextSibling ?? null);
		}
	}
}
