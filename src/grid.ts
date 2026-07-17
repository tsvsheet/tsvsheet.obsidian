/**
 * Pure grid <-> DOM / text helpers. These have no Obsidian or engine
 * dependency, so they are trivially testable and reused by both frontends
 * (the ```sheet code-block processor and the .tsvt file view).
 */
import type { Grid } from "@tsvsheet/tsvsheet";

/**
 * Serialize a 2-D grid back to a `.tsvt` source string: TAB between columns,
 * newline between rows. Mirrors the engine's own `toTsv` so a round-trip
 * through `setCell` preserves the on-disk shape.
 */
export const toTsv = (grid: Grid): string =>
	grid.map((row) => row.join("\t")).join("\n");

/**
 * Build a `<table>` from a computed grid. Cell text is assigned via
 * `textContent`, so any value — including an error string like `#DIV/0!` — is
 * rendered literally and safely (no HTML injection). When `editable` is set,
 * each cell becomes `contenteditable` and carries its zero-based coordinates
 * in `data-row` / `data-col` for the edit handler to read back.
 */
export function buildTable(doc: Document, grid: Grid, editable: boolean): HTMLTableElement {
	const table = doc.createElement("table");
	table.className = "tsvsheet-grid";
	for (const [rowIndex, row] of grid.entries()) {
		const tr = doc.createElement("tr");
		for (const [colIndex, value] of row.entries()) {
			tr.appendChild(buildCell(doc, value, rowIndex, colIndex, editable));
		}
		table.appendChild(tr);
	}
	return table;
}

/** Build one table cell, optionally editable and coordinate-tagged. */
function buildCell(
	doc: Document,
	value: string,
	row: number,
	col: number,
	editable: boolean,
): HTMLTableCellElement {
	const td = doc.createElement("td");
	td.textContent = value;
	if (editable) {
		td.contentEditable = "true";
		td.dataset.row = String(row);
		td.dataset.col = String(col);
	}
	return td;
}
