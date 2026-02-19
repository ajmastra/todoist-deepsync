import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";
import type TodoistSubtaskSyncPlugin from "./main";
import { DEFAULT_SETTINGS } from "./settings";

export class TodoistSubtaskSyncSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: TodoistSubtaskSyncPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Todoist API token")
			.setDesc("Your Todoist API token from Integrations settings.")
			.addText((text) =>
				text
					.setPlaceholder("Enter token")
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (v) => {
						this.plugin.settings.apiToken = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default project or filter")
			.setDesc(
				"Default project ID, section ID, or filter string when the block is empty (e.g. 123456 or today)."
			)
			.addText((text) =>
				text
					.setPlaceholder("Project ID, section ID, or filter")
					.setValue(this.plugin.settings.defaultProjectOrFilter)
					.onChange(async (v) => {
						this.plugin.settings.defaultProjectOrFilter = v ?? "";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Refresh interval (minutes)")
			.setDesc("How often to refresh Todoist blocks (minimum 1).")
			.addText((text) =>
				text
					.setPlaceholder(String(DEFAULT_SETTINGS.refreshIntervalMinutes))
					.setValue(String(this.plugin.settings.refreshIntervalMinutes))
					.onChange(async (v) => {
						const n = Math.max(1, parseInt(v, 10) || DEFAULT_SETTINGS.refreshIntervalMinutes);
						this.plugin.settings.refreshIntervalMinutes = n;
						await this.plugin.saveSettings();
						this.plugin.resetRefreshInterval();
					})
			);

		new Setting(containerEl)
			.setName("Show completed tasks")
			.setDesc("Include completed tasks in the list (when supported by the API).")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showCompletedTasks).onChange(async (v) => {
					this.plugin.settings.showCompletedTasks = v;
					await this.plugin.saveSettings();
				})
			);
	}
}
