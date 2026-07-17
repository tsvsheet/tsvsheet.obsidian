/**
 * Small shared helpers with no Obsidian or engine dependency.
 */

/** Extract a human-readable message from an unknown thrown value. */
export const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
