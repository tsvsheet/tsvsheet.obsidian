/**
 * The `.tsvt` file view: a computed spreadsheet grid with two modes.
 *
 * Preview mode (the default) renders the computed grid read-only; edit mode
 * renders the source grid — formulas visible — with editable cells, mirroring
 * Obsidian's reading/editing split. A header action toggles between them.
 *
 * Extending {@link TextFileView} lets Obsidian own the raw-text load/save
 * lifecycle — `this.data` holds the `.tsvt` source, `getViewData()` hands it
 * back to be written, and `setViewData()` receives it on open or external
 * change. Editing a cell drives the shared engine's `setCell` with the typed
 * source text and persists the engine's canonical `View.text` — never a grid
 * re-serialization, which would drop comment lines and the trailing newline.
 */

import type { View } from "@tsvsheet/tsvsheet";
import { Notice, TextFileView, type WorkspaceLeaf, setIcon } from "obsidian";
import { buildTable } from "./grid";
import type TsvsheetPlugin from "./main";
import { errorMessage } from "./util";

export const TSVT_VIEW_TYPE = "tsvsheet-view";

type Mode = "preview" | "edit";

/** The header-action icon and tooltip for the mode the toggle switches TO. */
const TOGGLE = {
	preview: { icon: "pencil", title: "Edit formulas" },
	edit: { icon: "book-open", title: "Preview computed values" },
} as const satisfies Record<Mode, { icon: string; title: string }>;

export class TsvtView extends TextFileView {
	private readonly plugin: TsvsheetPlugin;
	private readonly toggleEl: HTMLElement;
	private mode: Mode = "preview";
	private view: View | undefined;

	constructor(leaf: WorkspaceLeaf, plugin: TsvsheetPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.contentEl.addClass("tsvsheet-view");
		this.toggleEl = this.addAction(
			TOGGLE.preview.icon,
			TOGGLE.preview.title,
			() => {
				this.setMode(this.mode === "preview" ? "edit" : "preview");
			},
		);
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
		this.view = undefined;
		this.contentEl.empty();
	}

	/** Switch between the computed preview and the formula-editing grid. */
	private setMode(mode: Mode): void {
		this.mode = mode;
		const toggle = TOGGLE[mode];
		setIcon(this.toggleEl, toggle.icon);
		this.toggleEl.setAttribute("aria-label", toggle.title);
		if (this.view !== undefined) {
			this.renderGrid(this.view);
		}
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
		this.view = view;
		this.renderGrid(view);
	}

	/**
	 * Replace the view contents with the mode's table: the computed grid
	 * read-only in preview, the source grid — formulas visible — editable in
	 * edit mode.
	 */
	private renderGrid(view: View): void {
		this.contentEl.empty();
		const editing = this.mode === "edit";
		const grid = editing ? view.source : view.computed;
		const table = buildTable(this.contentEl.ownerDocument, grid, editing);
		table.classList.toggle("tsvsheet-grid-source", editing);
		this.contentEl.appendChild(table);
	}

	/** Replace the view contents with a visible error banner. */
	private renderError(text: string): void {
		this.view = undefined;
		this.contentEl.empty();
		this.contentEl.createEl("div", { cls: "tsvsheet-error", text });
	}

	/**
	 * Persist a single cell edit through the engine and re-render. Only edit
	 * mode has editable cells, and their text is cell *source* (a formula or
	 * literal), so an untouched cell round-trips exactly; unchanged text is
	 * skipped outright so merely focusing a cell never rewrites the file.
	 */
	private async onCellEdit(event: FocusEvent): Promise<void> {
		const cell = event.target;
		if (!(cell instanceof HTMLTableCellElement)) {
			return;
		}
		const { row, col } = cell.dataset;
		if (row === undefined || col === undefined) {
			return;
		}
		const text = cell.textContent ?? "";
		if (text === (this.view?.source[Number(row)]?.[Number(col)] ?? "")) {
			return;
		}
		try {
			const engine = await this.plugin.getEngine();
			const view = engine.setCell(this.data, Number(row), Number(col), text);
			this.data = view.text;
			this.view = view;
			this.requestSave();
			this.renderGrid(view);
		} catch (error) {
			new Notice(`tsvsheet: ${errorMessage(error)}`);
		}
	}
}
