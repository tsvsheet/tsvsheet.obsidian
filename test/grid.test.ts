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
	const table = buildTable(doc(), [["a", "b"], ["1", "=A2+1"]], false);
	assert.equal(table.className, "tsvsheet-grid");
	const rows = [...table.querySelectorAll("tr")];
	assert.equal(rows.length, 2);
	assert.deepEqual(
		rows.map((tr) => [...tr.children].map((td) => td.textContent)),
		[["a", "b"], ["1", "=A2+1"]],
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
	const table = buildTable(doc(), [["a", "b"], ["c", "d"]], true);
	const cells = [...table.querySelectorAll("td")] as HTMLTableCellElement[];
	assert.equal(cells.length, 4);
	for (const cell of cells) {
		assert.equal(cell.contentEditable, "true");
	}
	assert.deepEqual(
		cells.map((cell) => [cell.dataset.row, cell.dataset.col]),
		[["0", "0"], ["0", "1"], ["1", "0"], ["1", "1"]],
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
