import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";

describe("DEFAULT_SETTINGS", () => {
	it("has required keys with expected types", () => {
		expect(DEFAULT_SETTINGS).toHaveProperty("apiToken", "");
		expect(DEFAULT_SETTINGS).toHaveProperty("defaultProjectOrFilter", "");
		expect(DEFAULT_SETTINGS).toHaveProperty("refreshIntervalMinutes", 15);
		expect(DEFAULT_SETTINGS).toHaveProperty("showCompletedTasks", false);
	});

	it("has only the expected keys", () => {
		const keys = Object.keys(DEFAULT_SETTINGS).sort();
		expect(keys).toEqual([
			"apiToken",
			"defaultProjectOrFilter",
			"refreshIntervalMinutes",
			"showCompletedTasks",
		]);
	});
});
