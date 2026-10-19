/**
 * Tool-call grouping helpers.
 *
 * A single agent turn can call dozens of tools; rendering one row per call
 * floods the transcript. These helpers reduce a run to a one-line summary
 * ("17 komut çalıştı · grep ×9, read_file ×4 +2") plus a short argument
 * preview per call, so the transcript stays readable and the group can be
 * expanded on demand.
 */

import type { ToolChip } from "./types";

export interface ToolCounts {
	total: number;
	failed: number;
	running: number;
	/** Distinct tool names, most frequent first. */
	names: Array<{ name: string; count: number }>;
}

export function summarizeTools(chips: ToolChip[]): ToolCounts {
	const byName = new Map<string, number>();
	let failed = 0;
	let running = 0;
	for (const chip of chips) {
		byName.set(chip.name, (byName.get(chip.name) ?? 0) + 1);
		if (chip.running) running += 1;
		else if (chip.ok === false) failed += 1;
	}
	const names = [...byName.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	return { total: chips.length, failed, running, names };
}

/** One-line label: "17 komut çalıştı · grep ×9, read_file ×4 +2" / "Çalışıyor · 6 komut". */
export function toolGroupLabel(counts: ToolCounts, distinctLimit = 3): string {
	if (counts.running > 0) return `Running · ${counts.total} calls`;
	const shown = counts.names
		.slice(0, distinctLimit)
		.map((entry) => (entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name));
	const extra = counts.names.length - shown.length;
	const tail = shown.length ? ` · ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}` : "";
	const fail = counts.failed > 0 ? ` · ${counts.failed} errors` : "";
	return `${counts.total} calls completed${tail}${fail}`;
}

/** Short single-line preview of a tool call's arguments, ellipsised. */
export function toolArgsPreview(args: unknown, max = 46): string {
	let text = "";
	if (typeof args === "string") text = args;
	else if (args && typeof args === "object") {
		const parts: string[] = [];
		for (const value of Object.values(args as Record<string, unknown>)) {
			if (typeof value === "string" && value.trim()) parts.push(value.trim());
			else if (typeof value === "number" || typeof value === "boolean") parts.push(String(value));
			if (parts.length === 2) break;
		}
		text = parts.join(" · ");
	}
	const flat = text.replace(/\s+/g, " ").trim();
	if (!flat) return "";
	return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
