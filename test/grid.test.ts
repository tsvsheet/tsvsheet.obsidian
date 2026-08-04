/**
 * Contract tests for the pure grid -> DOM helpers, run against a happy-dom
 * document (no Obsidian, no engine).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { buildTable } from "../src/grid.ts";

const doc = () => new Window().document as unknown as Document;

test("buildTable renders every row and column with literal text", () => {
	const table = buildTable(
		doc(),
		[
			["a", "b"],
			["1", "=A2+1"],
		],
		false,
	);
	assert.equal(table.className, "tsvsheet-grid");
	const rows = [...table.querySelectorAll("tr")];
	assert.equal(rows.length, 2);
	assert.deepEqual(
		rows.map((tr) => [...tr.children].map((td) => td.textContent)),
		[
			["a", "b"],
			["1", "=A2+1"],
		],
	);
});

test("buildTable renders markup-like and error values as text, never HTML", () => {
	const table = buildTable(doc(), [["<b>bold</b>", "#DIV/0!"]], false);
	const cells = [...table.querySelectorAll("td")];
	assert.equal(cells[0]?.children.length, 0);
	assert.equal(cells[0]?.textContent, "<b>bold</b>");
	assert.equal(cells[1]?.textContent, "#DIV/0!");
});

test("buildTable editable cells carry contenteditable and their coordinates", () => {
	const table = buildTable(
		doc(),
		[
			["a", "b"],
			["c", "d"],
		],
		true,
	);
	const cells = [...table.querySelectorAll("td")] as HTMLTableCellElement[];
	assert.equal(cells.length, 4);
	for (const cell of cells) {
		assert.equal(cell.contentEditable, "true");
	}
	assert.deepEqual(
		cells.map((cell) => [cell.dataset.row, cell.dataset.col]),
		[
			["0", "0"],
			["0", "1"],
			["1", "0"],
			["1", "1"],
		],
	);
});

test("buildTable read-only cells carry neither contenteditable nor coordinates", () => {
	const table = buildTable(doc(), [["a"]], false);
	const cell = table.querySelector("td") as HTMLTableCellElement;
	assert.notEqual(cell.contentEditable, "true");
	assert.equal(cell.dataset.row, undefined);
	assert.equal(cell.dataset.col, undefined);
});

test("buildTable of an empty grid is an empty table", () => {
	const table = buildTable(doc(), [], false);
	assert.equal(table.querySelectorAll("tr").length, 0);
});

test("buildTable: editing shows A1 headers — the addresses formulas use", () => {
	const table = buildTable(
		doc(),
		[
			["a", "b", "c"],
			["1", "2", "3"],
		],
		true,
	);
	const rows = [...table.querySelectorAll("tr")];
	assert.equal(rows.length, 3, "a header row precedes the grid");
	assert.deepEqual(
		[...(rows[0]?.children ?? [])].map((th) => th.textContent),
		["", "A", "B", "C"],
		"an empty corner, then the column letters",
	);
	assert.deepEqual(
		rows.slice(1).map((tr) => tr.children[0]?.textContent),
		["1", "2"],
		"row numbers are 1-based, in the gutter",
	);
	assert.deepEqual(
		[...(rows[1]?.children ?? [])].slice(1).map((td) => td.textContent),
		["a", "b", "c"],
		"the data is unshifted by the gutter",
	);
});

test("buildTable: reading shows no spreadsheet chrome", () => {
	const table = buildTable(doc(), [["a", "b"]], false);
	assert.equal(
		table.querySelectorAll("th").length,
		0,
		"a rendered ```sheet fence is a table in a document, not a spreadsheet",
	);
	assert.equal(table.querySelectorAll("tr").length, 1);
});

test("buildTable: a ragged grid still gets a label per column", () => {
	const table = buildTable(doc(), [["a"], ["b", "c", "d"]], true);
	const header = [...(table.querySelectorAll("tr")[0]?.children ?? [])];
	assert.deepEqual(
		header.map((th) => th.textContent),
		["", "A", "B", "C"],
		"the widest row decides how many letters are needed",
	);
});

test("buildTable: headers carry the scope a screen reader needs", () => {
	const table = buildTable(doc(), [["a"]], true);
	const rows = [...table.querySelectorAll("tr")];
	assert.equal(rows[0]?.children[1]?.getAttribute("scope"), "col");
	assert.equal(rows[1]?.children[0]?.getAttribute("scope"), "row");
	assert.equal(
		rows[0]?.children[0]?.getAttribute("aria-label"),
		"row and column labels",
		"the corner is named, not announced as a bare cell",
	);
});
