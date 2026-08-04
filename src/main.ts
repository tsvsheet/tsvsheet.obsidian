/**
 * The tsvsheet Obsidian plugin.
 *
 * One engine, two frontends:
 *  - a ```sheet fenced-code-block processor that renders a live, read-only
 *    computed grid in Reading/Preview mode;
 *  - a `.tsvt` file view ({@link TsvtView}) that opens the file as an editable
 *    computed spreadsheet.
 *
 * The WebAssembly engine is instantiated once and shared. Its bytes and Go
 * runtime shim are read from the plugin's own directory at runtime (not the
 * vault), so nothing depends on `import.meta.url` resolving after bundling.
 */

import type { Engine, View } from "@tsvsheet/tsvsheet";
import { Notice, Plugin, normalizePath } from "obsidian";
import { loadEngine } from "./engine";
import { buildTable } from "./grid";
import { errorMessage } from "./util";
import { TSVT_VIEW_TYPE, TsvtView } from "./view";

export default class TsvsheetPlugin extends Plugin {
	private enginePromise: Promise<Engine> | undefined;

	override onload(): void {
		this.registerMarkdownCodeBlockProcessor("sheet", (source, el) =>
			this.renderSheetBlock(source, el),
		);
		this.registerView(TSVT_VIEW_TYPE, (leaf) => new TsvtView(leaf, this));
		this.registerExtensions(["tsvt"], TSVT_VIEW_TYPE);
		// A `.tsvt` opens in a custom view, and Obsidian's built-in
		// reading/editing toggle (Cmd-E) is `markdown:toggle-preview`, gated to
		// a MarkdownView — so it does nothing here, and until this command
		// existed there was nothing a key could be bound to. Registering it
		// puts the toggle in the palette and makes it bindable, including to
		// Cmd-E itself, which is free while a .tsvt is focused.
		this.addCommand({
			id: "toggle-preview",
			name: "Toggle computed values and formulas",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(TsvtView);
				if (view === null) {
					return false;
				}
				if (!checking) {
					view.toggleMode();
				}
				return true;
			},
		});

		// Kick off engine instantiation eagerly so the first render is fast and
		// a load failure surfaces immediately; consumers await the same promise.
		this.getEngine().catch((error: unknown) => {
			new Notice(`tsvsheet: failed to load engine — ${errorMessage(error)}`);
		});
	}

	/** The shared engine, instantiated once and cached. */
	getEngine(): Promise<Engine> {
		if (this.enginePromise === undefined) {
			this.enginePromise = this.instantiateEngine();
		}
		return this.enginePromise;
	}

	/** Read the wasm + runtime from the plugin directory and instantiate. */
	private async instantiateEngine(): Promise<Engine> {
		const dir = this.manifest.dir;
		if (dir === undefined) {
			throw new Error("plugin directory is unknown");
		}
		const adapter = this.app.vault.adapter;
		const wasm = await adapter.readBinary(
			normalizePath(`${dir}/tsvsheet.wasm`),
		);
		const wasmExec = await adapter.read(normalizePath(`${dir}/wasm_exec.js`));
		return loadEngine(wasm, wasmExec);
	}

	/** Render one ```sheet block as a read-only computed grid. */
	private async renderSheetBlock(
		source: string,
		el: HTMLElement,
	): Promise<void> {
		let view: View;
		try {
			const engine = await this.getEngine();
			view = engine.compute(source);
		} catch (error) {
			el.empty();
			el.createEl("div", { cls: "tsvsheet-error", text: errorMessage(error) });
			return;
		}
		el.empty();
		el.appendChild(buildTable(el.ownerDocument, view.computed, false));
		renderDiagnostics(el, view);
	}
}

/** Append a diagnostics list beneath the grid when the engine reports any. */
function renderDiagnostics(el: HTMLElement, view: View): void {
	if (view.diagnostics === null || view.diagnostics.length === 0) {
		return;
	}
	const list = el.createEl("ul", { cls: "tsvsheet-diagnostics" });
	for (const diagnostic of view.diagnostics) {
		const prefix = diagnostic.fatal ? "error" : "warning";
		list.createEl("li", {
			text: `${diagnostic.cell}: ${prefix}: ${diagnostic.message}`,
		});
	}
}
