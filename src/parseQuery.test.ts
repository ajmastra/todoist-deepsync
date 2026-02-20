import { describe, it, expect } from "vitest";
import { parseTodoistQuery } from "./parseQuery";

describe("parseTodoistQuery", () => {
	it("returns empty query for empty/whitespace input", () => {
		expect(parseTodoistQuery("")).toEqual({});
		expect(parseTodoistQuery("   ")).toEqual({});
		expect(parseTodoistQuery("\n\t")).toEqual({});
	});

	it("parses project:id and project id", () => {
		expect(parseTodoistQuery("project:123")).toEqual({ projectId: "123" });
		expect(parseTodoistQuery("project 456")).toEqual({ projectId: "456" });
		expect(parseTodoistQuery("  project : 789  ")).toEqual({ projectId: "789" });
	});

	it("parses section:id and section id", () => {
		expect(parseTodoistQuery("section:123")).toEqual({ sectionId: "123" });
		expect(parseTodoistQuery("section 456")).toEqual({ sectionId: "456" });
	});

	it("parses filter with colon or space", () => {
		expect(parseTodoistQuery("filter:today")).toEqual({ filter: "today" });
		expect(parseTodoistQuery('filter:"today & !subtask"')).toEqual({
			filter: "today & !subtask",
		});
		expect(parseTodoistQuery("filter today")).toEqual({ filter: "today" });
	});

	it("treats plain numeric line as project id", () => {
		expect(parseTodoistQuery("123")).toEqual({ projectId: "123" });
		expect(parseTodoistQuery("  999  ")).toEqual({ projectId: "999" });
	});

	it("treats other non-matching line as filter", () => {
		expect(parseTodoistQuery("today")).toEqual({ filter: "today" });
		expect(parseTodoistQuery("#Work")).toEqual({ filter: "#Work" });
		expect(parseTodoistQuery("today & overdue")).toEqual({
			filter: "today & overdue",
		});
	});
});
