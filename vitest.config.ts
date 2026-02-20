import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			include: ["src/**/*.ts"],
			// Exclude test files, type-only module, and plugin/UI entry points (Obsidian-heavy, tested manually)
			exclude: [
				"src/**/*.test.ts",
				"src/**/*.spec.ts",
				"src/types.ts",
				"src/main.ts",
				"src/AddTaskModal.ts",
				"src/settingsTab.ts",
			],
		},
	},
});
