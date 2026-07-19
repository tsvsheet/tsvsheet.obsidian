/**
 * Instantiate the embedded tsvsheet WebAssembly engine inside a bundled
 * Obsidian plugin.
 *
 * The upstream `@tsvsheet/tsvsheet` package resolves its wasm + `wasm_exec.js`
 * assets relative to `import.meta.url`, which does not point at the plugin
 * directory once the module is bundled into `main.js`. So we do not call its
 * `load()` / `loadFrom()`; instead we replicate the (tiny) instantiation dance
 * here over bytes and runtime source the caller has already read from the
 * plugin's own directory, and reuse the package's exported {@link Engine}
 * facade for the typed API surface.
 */
import { Engine } from "@tsvsheet/tsvsheet";

/** The stateless function table the Go program publishes on `globalThis`. */
type TsvsheetApi = Record<string, (...args: unknown[]) => string>;

/** The Go runtime shim that `wasm_exec.js` installs as `globalThis.Go`. */
interface GoRuntime {
	importObject: WebAssembly.Imports;
	run(instance: WebAssembly.Instance): void;
}

type GoConstructor = new () => GoRuntime;

declare global {
	// Installed by wasm_exec.js and by the Go program, respectively.
	var Go: GoConstructor | undefined;
	var tsvsheet: TsvsheetApi | undefined;
}

/**
 * `Engine`'s public `.d.ts` hides its runtime constructor (the api object),
 * so we widen the type here to construct it from the global function table.
 */
type EngineConstructor = new (api: TsvsheetApi) => Engine;

/**
 * Evaluate the `wasm_exec.js` source (a classic script that assigns
 * `globalThis.Go`) in a function scope and recover the `Go` constructor. The
 * source is the version-pinned Go build artifact shipped beside the plugin,
 * never user input.
 */
function defineGo(source: string): GoConstructor {
	const factory = new Function(
		`${source}\nreturn globalThis.Go;`,
	) as () => unknown;
	const Go = factory();
	if (typeof Go !== "function") {
		throw new Error("wasm_exec.js did not define Go");
	}
	return Go as GoConstructor;
}

/**
 * Instantiate the engine from the caller-supplied `tsvsheet.wasm` bytes and
 * `wasm_exec.js` runtime source, start the Go program (which installs the
 * `globalThis.tsvsheet` function table synchronously and then blocks), and
 * return the typed {@link Engine} wrapping it.
 */
export async function loadEngine(
	wasmBytes: BufferSource,
	wasmExecSource: string,
): Promise<Engine> {
	const Go = defineGo(wasmExecSource);
	const go = new Go();
	const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
	go.run(result.instance); // starts the engine; intentionally not awaited
	if (globalThis.tsvsheet === undefined) {
		throw new Error("wasm did not export tsvsheet");
	}
	return new (Engine as unknown as EngineConstructor)(globalThis.tsvsheet);
}
