/**
 * The `.tsvt` file view: an editable, computed spreadsheet grid.
 *
 * Extending {@link TextFileView} lets Obsidian own the raw-text load/save
 * lifecycle — `this.data` holds the `.tsvt` source, `getViewData()` hands it
 * back to be written, and `setViewData()` receives it on open or external
 * change. Editing a cell drives the shared engine's `setCell`, updates
 * `this.data` from the returned source grid, requests a save, and re-renders
 * the recomputed grid.
 */
import { Notice, TextFileView, type WorkspaceLeaf } from "obsidian";
import type { View } from "@tsvsheet/tsvsheet";
import type TsvsheetPlugin from "./main";
import { buildTable, toTsv } from "./grid";
import { errorMessage } from "./util";

export const TSVT_VIEW_TYPE = "tsvsheet-view";

export class TsvtView extends TextFileView {
	private readonly plugin: TsvsheetPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: TsvsheetPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.contentEl.addClass("tsvsheet-view");
		this.registerDomEvent(this.contentEl, "focusout", (event) => {
			void this.onCellEdit(event);
		});
	}

	getViewType(): string {
		return TSVT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "tsvsheet";
	}

	getIcon(): string {
		return "table";
	}

	/** Hand the current source back to Obsidian to persist. */
	getViewData(): string {
		return this.data;
	}

	/** Receive source on open or external change, then render the grid. */
	setViewData(data: string, _clear: boolean): void {
		this.data = data;
		void this.render();
	}

	/** Reset to an empty document. */
	clear(): void {
		this.data = "";
		this.contentEl.empty();
	}

	/** Compute `this.data` and (re)render the grid, or show an error. */
	private async render(): Promise<void> {
		let view: View;
		try {
			const engine = await this.plugin.getEngine();
			view = engine.compute(this.data);
		} catch (error) {
			this.renderError(errorMessage(error));
			return;
		}
		this.renderGrid(view);
	}

	/** Replace the view contents with an editable table of the computed grid. */
	private renderGrid(view: View): void {
		this.contentEl.empty();
		const table = buildTable(this.contentEl.ownerDocument, view.computed, true);
		this.contentEl.appendChild(table);
	}

	/** Replace the view contents with a visible error banner. */
	private renderError(text: string): void {
		this.contentEl.empty();
		this.contentEl.createEl("div", { cls: "tsvsheet-error", text });
	}

	/** Persist a single cell edit through the engine and re-render. */
	private async onCellEdit(event: FocusEvent): Promise<void> {
		const cell = event.target;
		if (!(cell instanceof HTMLTableCellElement)) {
			return;
		}
		const { row, col } = cell.dataset;
		if (row === undefined || col === undefined) {
			return;
		}
		try {
			const engine = await this.plugin.getEngine();
			const view = engine.setCell(this.data, Number(row), Number(col), cell.textContent ?? "");
			this.data = toTsv(view.source);
			this.requestSave();
			this.renderGrid(view);
		} catch (error) {
			new Notice(`tsvsheet: ${errorMessage(error)}`);
		}
	}
}
