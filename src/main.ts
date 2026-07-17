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
import { Notice, Plugin, normalizePath } from "obsidian";
import type { Engine, View } from "@uplang/tsvsheet";
import { loadEngine } from "./engine";
import { buildTable } from "./grid";
import { TSVT_VIEW_TYPE, TsvtView } from "./view";
import { errorMessage } from "./util";

export default class TsvsheetPlugin extends Plugin {
	private enginePromise: Promise<Engine> | undefined;

	override onload(): void {
		this.registerMarkdownCodeBlockProcessor("sheet", (source, el) =>
			this.renderSheetBlock(source, el),
		);
		this.registerView(TSVT_VIEW_TYPE, (leaf) => new TsvtView(leaf, this));
		this.registerExtensions(["tsvt"], TSVT_VIEW_TYPE);

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
		const wasm = await adapter.readBinary(normalizePath(`${dir}/tsvsheet.wasm`));
		const wasmExec = await adapter.read(normalizePath(`${dir}/wasm_exec.js`));
		return loadEngine(wasm, wasmExec);
	}

	/** Render one ```sheet block as a read-only computed grid. */
	private async renderSheetBlock(source: string, el: HTMLElement): Promise<void> {
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
		list.createEl("li", { text: `${diagnostic.cell}: ${prefix}: ${diagnostic.message}` });
	}
}
