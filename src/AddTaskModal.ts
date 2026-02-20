import type { App } from "obsidian";
import { Modal, setIcon, Menu } from "obsidian";
import type { TodoistProject, TodoistSection, TodoistTask } from "./types";
import {
	createTask,
	fetchAllSections,
	fetchProjects,
	fetchSections,
	fetchTasks,
} from "./todoistApi";
import type { RequestUrlParam, RequestUrlResponse } from "./todoistApi";

/** Indent string for hierarchical menu (one level). */
const MENU_INDENT = "    ";

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
	/** Sections by project id (for hierarchical menu). Populated when opening project/section menu. */
	private sectionsByProjectId: Map<string, TodoistSection[]> = new Map();

	// Selected values
	private selectedProjectId: string = "";
	private selectedSectionId: string | null = null;
	private selectedParentId: string | null = null;
	private selectedDue: { date?: string; string?: string } | null = null;
	private selectedPriority: number = 1;

	// UI elements
	private contentInput!: HTMLInputElement;
	private descriptionInput!: HTMLTextAreaElement;
	private projectSectionBtn!: HTMLElement;
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

		// Task name
		const inputContainer = contentEl.createDiv({ cls: "todoist-modal-input-container" });
		this.contentInput = inputContainer.createEl("input", {
			type: "text",
			cls: "todoist-modal-main-input",
			placeholder: "Task name",
		});

		// Description
		const descContainer = contentEl.createDiv({ cls: "todoist-modal-desc-container" });
		this.descriptionInput = descContainer.createEl("textarea", {
			cls: "todoist-modal-desc-input",
			placeholder: "Description",
		});
		this.descriptionInput.rows = 3;

		// Icon buttons row — build all icons immediately so they appear at once
		const iconRow = contentEl.createDiv({ cls: "todoist-modal-icon-row" });

		// Project/Section combined button (hierarchical selector like Todoist)
		this.projectSectionBtn = iconRow.createDiv({ cls: "todoist-modal-project-section-btn" });
		setIcon(this.projectSectionBtn, "folder");
		const labelSpan = this.projectSectionBtn.createSpan({ cls: "todoist-project-section-label" });
		labelSpan.textContent = "Project & section";
		const chevron = this.projectSectionBtn.createSpan({ cls: "todoist-project-section-chevron" });
		setIcon(chevron, "chevron-down");
		this.projectSectionBtn.setAttribute("aria-label", "Project & section");
		this.projectSectionBtn.title = "Project & section";
		this.projectSectionBtn.addEventListener("click", (e) => this.showProjectSectionMenu(e));

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
			this.updateProjectSectionButton();
			this.updateParentButton();
		});
	}

	/** Build project tree: roots (parent_id null) and children grouped by parent_id. */
	private getProjectTree(): {
		roots: TodoistProject[];
		childrenByParent: Map<string, TodoistProject[]>;
	} {
		const childrenByParent = new Map<string, TodoistProject[]>();
		const roots: TodoistProject[] = [];
		const sorted = [...this.projects].sort((a, b) => a.order - b.order);
		for (const p of sorted) {
			if (p.parent_id == null || p.parent_id === "") {
				roots.push(p);
			} else {
				const siblings = childrenByParent.get(p.parent_id) ?? [];
				siblings.push(p);
				childrenByParent.set(p.parent_id, siblings);
			}
		}
		return { roots, childrenByParent };
	}

	/** Ensure sections for all projects are loaded (for hierarchical menu). */
	private async ensureAllSectionsLoaded(): Promise<void> {
		if (this.sectionsByProjectId.size > 0) return;
		const all = await fetchAllSections({ requestUrl: this.requestUrl }, this.token);
		const byProject = new Map<string, TodoistSection[]>();
		for (const s of all) {
			const list = byProject.get(s.project_id) ?? [];
			list.push(s);
			byProject.set(s.project_id, list);
		}
		for (const list of byProject.values()) {
			list.sort((a, b) => a.order - b.order);
		}
		this.sectionsByProjectId = byProject;
	}

	private async loadProjects() {
		const [projects, allSections] = await Promise.all([
			fetchProjects({ requestUrl: this.requestUrl }, this.token),
			fetchAllSections({ requestUrl: this.requestUrl }, this.token),
		]);
		this.projects = projects;
		const byProject = new Map<string, TodoistSection[]>();
		for (const s of allSections) {
			const list = byProject.get(s.project_id) ?? [];
			list.push(s);
			byProject.set(s.project_id, list);
		}
		for (const list of byProject.values()) list.sort((a, b) => a.order - b.order);
		this.sectionsByProjectId = byProject;

		if (this.defaultProjectId) {
			this.selectedProjectId = this.defaultProjectId;
		} else if (this.projects.length > 0) {
			this.selectedProjectId = this.projects[0].id;
		}
		if (this.selectedProjectId) {
			this.sections = this.sectionsByProjectId.get(this.selectedProjectId) ?? [];
			await this.loadTasksForProject(this.selectedProjectId);
		}
	}

	/** Load sections (from cache if available) and tasks for the selected project. */
	private async loadSectionsAndTasks() {
		if (!this.selectedProjectId) return;
		const cached = this.sectionsByProjectId.get(this.selectedProjectId);
		if (cached) {
			this.sections = cached;
		} else {
			this.sections = await fetchSections(
				{ requestUrl: this.requestUrl },
				this.token,
				this.selectedProjectId
			);
		}
		this.tasks = await fetchTasks(
			{ requestUrl: this.requestUrl },
			{ token: this.token, projectId: this.selectedProjectId, includeCompleted: false }
		);
	}

	private updateProjectSectionButton() {
		const project = this.projects.find((p) => p.id === this.selectedProjectId);
		const labelEl = this.projectSectionBtn.querySelector(".todoist-project-section-label");
		if (!project) {
			this.projectSectionBtn.removeAttribute("data-selected");
			this.projectSectionBtn.title = "Project & section";
			if (labelEl) labelEl.textContent = "Project & section";
			return;
		}
		this.projectSectionBtn.setAttribute("data-selected", "true");
		const section = this.sections.find((s) => s.id === this.selectedSectionId);
		const label = section ? `${project.name} › ${section.name}` : project.name;
		this.projectSectionBtn.title = label;
		if (labelEl) labelEl.textContent = label;
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

	private async showProjectSectionMenu(evt: MouseEvent) {
		if (this.projects.length === 0) {
			const menu = new Menu();
			menu.addItem((item) => item.setTitle("Loading...").setDisabled(true));
			menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
			return;
		}
		await this.ensureAllSectionsLoaded();
		const { roots, childrenByParent } = this.getProjectTree();
		const menu = new Menu();

		const addProjectAndSections = (project: TodoistProject, depth: number) => {
			const indent = MENU_INDENT.repeat(depth);
			// Project option (no section)
			menu.addItem((item) => {
				item.setTitle(indent + project.name);
				item.setChecked(this.selectedProjectId === project.id && this.selectedSectionId == null);
				item.onClick(async () => {
					this.selectedProjectId = project.id;
					this.selectedSectionId = null;
					this.selectedParentId = null;
					this.sections = this.sectionsByProjectId.get(project.id) ?? [];
					await this.loadTasksForProject(project.id);
					this.updateProjectSectionButton();
					this.updateParentButton();
				});
			});
			const sections = this.sectionsByProjectId.get(project.id) ?? [];
			for (const s of sections) {
				menu.addItem((item) => {
					item.setTitle(indent + MENU_INDENT + "# " + s.name);
					item.setChecked(this.selectedProjectId === project.id && this.selectedSectionId === s.id);
					item.onClick(async () => {
						this.selectedProjectId = project.id;
						this.selectedSectionId = s.id;
						this.selectedParentId = null;
						this.sections = this.sectionsByProjectId.get(project.id) ?? [];
						await this.loadTasksForProject(project.id);
						this.updateProjectSectionButton();
						this.updateParentButton();
					});
				});
			}
			const children = childrenByParent.get(project.id) ?? [];
			for (const child of children) {
				addProjectAndSections(child, depth + 1);
			}
		};

		for (const root of roots) {
			addProjectAndSections(root, 0);
		}
		menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
	}

	/** Load only tasks for a project (sections already set from cache). */
	private async loadTasksForProject(projectId: string): Promise<void> {
		this.tasks = await fetchTasks(
			{ requestUrl: this.requestUrl },
			{ token: this.token, projectId, includeCompleted: false }
		);
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

	private async showParentMenu(evt: MouseEvent) {
		if (!this.selectedProjectId) return;
		// Load tasks if not yet loaded (e.g. user clicked before loadProjects() completed)
		if (this.tasks.length === 0) {
			await this.loadSectionsAndTasks();
		}
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
		const description = this.descriptionInput.value.trim();

		try {
			await createTask(
				{ requestUrl: this.requestUrl },
				{
					token: this.token,
					content,
					description: description || undefined,
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
