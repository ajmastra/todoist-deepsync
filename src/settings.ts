export interface TodoistSubtaskSyncSettings {
	apiToken: string;
	defaultProjectOrFilter: string;
	refreshIntervalMinutes: number;
	showCompletedTasks: boolean;
}

export const DEFAULT_SETTINGS: TodoistSubtaskSyncSettings = {
	apiToken: "",
	defaultProjectOrFilter: "",
	refreshIntervalMinutes: 15,
	showCompletedTasks: false,
};
