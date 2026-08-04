/**
 * Pure grid -> DOM helpers. These have no Obsidian or engine dependency, so
 * they are trivially testable and reused by both frontends (the ```sheet
 * code-block processor and the .tsvt file view). Serialization back to text
 * is deliberately absent: the engine's `View.text` is the one sanctioned
 * source serialization (rebuilding from a grid drops comment lines).
 */
import type { Grid } from "@tsvsheet/tsvsheet";
// The labels come from the engine package rather than a local copy, by the
// subpath that avoids its Node-only asset loading (see esbuild.config.mjs).
import { colLetter, rowLabel } from "@tsvsheet/tsvsheet/a1";

/**
 * Build a `<table>` from a computed grid. Cell text is assigned via
 * `textContent`, so any value — including an error string like `#DIV/0!` — is
 * rendered literally and safely (no HTML injection). When `editable` is set,
 * each cell becomes `contenteditable` and carries its zero-based coordinates
 * in `data-row` / `data-col` for the edit handler to read back.
 *
 * Editing also gets A1 headers — column letters and row numbers — because an
 * author writing `=B4*2` needs to see which column is B, the way every other
 * tsvsheet surface shows it. Reading does not: a rendered ```sheet fence is a
 * table in a document, and spreadsheet chrome around it would be furniture the
 * reader did not ask for. The labels come from the engine's own package so
 * they name the same columns its diagnostics do.
 */
export function buildTable(
	doc: Document,
	grid: Grid,
	editable: boolean,
): HTMLTableElement {
	const table = doc.createElement("table");
	table.className = "tsvsheet-grid";
	if (editable) {
		table.appendChild(buildColumnHeader(doc, widestRow(grid)));
	}
	for (const [rowIndex, row] of grid.entries()) {
		const tr = doc.createElement("tr");
		if (editable) {
			tr.appendChild(buildRowHeader(doc, rowIndex));
		}
		for (const [colIndex, value] of row.entries()) {
			tr.appendChild(buildCell(doc, value, rowIndex, colIndex, editable));
		}
		table.appendChild(tr);
	}
	return table;
}

/** The widest row's length: a ragged grid still needs a label per column. */
function widestRow(grid: Grid): number {
	return grid.reduce((widest, row) => Math.max(widest, row.length), 0);
}

/** The header row: an empty corner, then A, B, C… */
function buildColumnHeader(doc: Document, cols: number): HTMLTableRowElement {
	const tr = doc.createElement("tr");
	tr.className = "tsvsheet-head";
	tr.appendChild(corner(doc));
	for (let col = 0; col < cols; col++) {
		const th = doc.createElement("th");
		th.scope = "col";
		th.textContent = colLetter(col);
		tr.appendChild(th);
	}
	return tr;
}

/** One row's number, in the leading gutter cell. */
function buildRowHeader(doc: Document, row: number): HTMLTableCellElement {
	const th = doc.createElement("th");
	th.scope = "row";
	th.className = "tsvsheet-gutter";
	th.textContent = rowLabel(row);
	return th;
}

/** The empty top-left cell where the two header axes meet. */
function corner(doc: Document): HTMLTableCellElement {
	const th = doc.createElement("th");
	th.className = "tsvsheet-corner";
	// Named for a screen reader, which would otherwise announce a bare cell
	// before every column label.
	th.setAttribute("aria-label", "row and column labels");
	return th;
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
