/**
 * Project index cache ("memory").
 *
 * Rebuilding the file map on every turn makes the agent scan the project over
 * and over (dozens of list_files/grep/read_file calls). The map is built once,
 * stored in the plugin KV and injected into the system prompt; file mutations
 * mark it dirty so the next run rebuilds it once instead of scanning per step.
 */

import type { PluginContext } from "emdash/plugin";

import { listProjectTree } from "./files";

const KEY = "project:index:v1";
const TTL_MS = 15 * 60_000;
const MAX_FILES = 600;

export interface ProjectIndex {
	builtAt: number;
	dirty?: boolean;
	files: string[];
	dirs: string[];
}

/** Cached index; rebuilds once when missing, dirty or older than 15 minutes. */
export async function getProjectIndex(ctx: PluginContext): Promise<ProjectIndex | null> {
	try {
		const cached = await ctx.kv.get<ProjectIndex>(KEY);
		if (cached && !cached.dirty && Date.now() - cached.builtAt < TTL_MS) return cached;
	} catch {
		/* fall through to rebuild */
	}
	try {
		const src = await listProjectTree("src", 4);
		const root = await listProjectTree(".", 1);
		const index: ProjectIndex = {
			builtAt: Date.now(),
			// Sizes tell the agent which files are big (read them in ranges).
			files: src
				.filter((entry) => !entry.path.endsWith("/"))
				.map((entry) => `${entry.path} (${Math.max(1, Math.round(entry.bytes / 1024))}KB)`)
				.slice(0, MAX_FILES),
			dirs: root.filter((entry) => entry.path.endsWith("/")).map((entry) => entry.path),
		};
		await ctx.kv.set(KEY, index).catch(() => undefined);
		return index;
	} catch {
		return null;
	}
}

/** A file tool ran: next turn rebuilds the map once. */
export async function markProjectIndexDirty(ctx: PluginContext): Promise<void> {
	const cached = await ctx.kv.get<ProjectIndex>(KEY).catch(() => null);
	if (!cached || cached.dirty) return;
	await ctx.kv.set(KEY, { ...cached, dirty: true }).catch(() => undefined);
}

/** Compact prompt block: paths only (no contents) to keep tokens low. */
export function projectMapBlock(index: ProjectIndex | null): string {
	if (!index) return "";
	const shown = index.files.slice(0, 160).join("\n");
	return [
		"PROJECT MAP (cached memory — do NOT re-scan the project; use read_file/grep only for targeted lookups):",
		index.dirs.length ? `Top-level dirs: ${index.dirs.join(" ")}` : "",
		shown,
		index.files.length > 160 ? `… +${index.files.length - 160} more files` : "",
	]
		.filter(Boolean)
		.join("\n");
}
