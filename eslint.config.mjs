import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["main.js", "wasm_exec.js", "node_modules/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: {
				WebAssembly: "readonly",
				document: "readonly",
				HTMLElement: "readonly",
				HTMLTableElement: "readonly",
				HTMLTableCellElement: "readonly",
				FocusEvent: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"no-var": "off",
		},
	},
);
