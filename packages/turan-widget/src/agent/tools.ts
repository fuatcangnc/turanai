/**
 * Agent tools: EmDash content through PluginContext, plus dev-only file tools.
 */

import type { PluginContext } from "emdash/plugin";

import { editProjectFile, grepProject, isDevServer, listProjectTree, readProjectFile, writeProjectFile } from "./files";
import { MEDIA_PREFIX, setMediaRecord, type MediaI18nRecord } from "../media-i18n";
import type { ToolSpec } from "./providers";

export interface AgentTool {
	spec: ToolSpec;
	execute(args: Record<string, unknown>): Promise<unknown>;
}

/** Snapshot of a content mutation, kept on a stack for per-message undo. */
export interface UndoSnapshot {
	changeId: string;
	kind: "update" | "publish" | "unpublish";
	collection: string;
	entryId: string;
	/** Field values before the change. */
	data: Record<string, unknown>;
	/** Visibility before the change ("published" | "draft" | null). */
	status: string | null;
	/** Human label, e.g. "posts · Kaynak düzenleme testi". */
	label: string;
	ts: string;
}

/** Reported to the run so the message can offer an undo action. */
export interface ContentChangeInfo {
	changeId: string;
	kind: string;
	collection: string;
	entryId: string;
	label: string;
}

export interface ToolRunHooks {
	onContentChange?(info: ContentChangeInfo): void;
}

const UNDO_STACK_KEY = "undo:stack";
const MAX_UNDO = 20;

async function readStack(ctx: PluginContext): Promise<UndoSnapshot[]> {
	try {
		return (await ctx.kv.get<UndoSnapshot[]>(UNDO_STACK_KEY)) ?? [];
	} catch {
		return [];
	}
}

/** Record a change and hand its id to the run (for the message-level undo). */
async function recordUndo(ctx: PluginContext, snapshot: Omit<UndoSnapshot, "changeId">, hooks: ToolRunHooks): Promise<string> {
	const changeId = crypto.randomUUID();
	try {
		const stack = await readStack(ctx);
		stack.push({ ...snapshot, changeId });
		if (stack.length > MAX_UNDO) stack.splice(0, stack.length - MAX_UNDO);
		await ctx.kv.set(UNDO_STACK_KEY, stack);
	} catch {
		/* undo is best-effort */
	}
	hooks.onContentChange?.({ changeId, kind: snapshot.kind, collection: snapshot.collection, entryId: snapshot.entryId, label: snapshot.label });
	return changeId;
}

export async function readUndo(ctx: PluginContext): Promise<UndoSnapshot | null> {
	const stack = await readStack(ctx);
	return stack[stack.length - 1] ?? null;
}

/**
 * Revert one recorded change (the latest by default): restores the previous
 * field values and visibility. Shared by the tool, the `undo` route and the
 * message-level undo button.
 */
export async function undoLastChange(ctx: PluginContext, changeId?: string): Promise<Record<string, unknown>> {
	const content = (ctx as unknown as ToolContext).content;
	const stack = await readStack(ctx);
	const index = changeId ? stack.findIndex((s) => s.changeId === changeId) : stack.length - 1;
	if (index < 0) throw new Error("Geri alınacak bir değişiklik yok.");
	const snapshot = stack[index]!;
	if (!content?.update || !content.getVersioned || !content.publish || !content.unpublish) {
		throw new Error("content:write / content:publish yetkisi yok.");
	}
	let item: ContentItemLike | null = null;
	if (snapshot.kind === "update") item = await content.update(snapshot.collection, snapshot.entryId, snapshot.data);
	if (snapshot.status === "published") {
		const current = await content.getVersioned(snapshot.collection, snapshot.entryId);
		item = (await content.publish(snapshot.collection, snapshot.entryId, { _rev: current?._rev ?? "" })).item;
	} else if (snapshot.kind !== "update") {
		const current = await content.getVersioned(snapshot.collection, snapshot.entryId);
		item = (await content.unpublish(snapshot.collection, snapshot.entryId, { _rev: current?._rev ?? "" })).item;
	}
	stack.splice(index, 1);
	try {
		await ctx.kv.set(UNDO_STACK_KEY, stack);
	} catch {
		/* ignore */
	}
	return {
		...(item ? preview(item) : { collection: snapshot.collection, entryId: snapshot.entryId }),
		changeId: snapshot.changeId,
		reverted: true,
		live: snapshot.status === "published",
	};
}

interface ContentItemLike {
	id: string;
	slug: string | null;
	status: string;
	data: Record<string, unknown>;
}

interface ToolContext {
	content?: {
		list(collection: string, options?: { limit?: number; where?: { status?: string } }): Promise<{ items: ContentItemLike[]; hasMore?: boolean }>;
		get(collection: string, id: string): Promise<ContentItemLike | null>;
		create?(collection: string, data: Record<string, unknown>): Promise<ContentItemLike>;
		update?(collection: string, id: string, data: Record<string, unknown>): Promise<ContentItemLike>;
		getVersioned?(collection: string, id: string): Promise<{ item: ContentItemLike; _rev: string } | null>;
		publish?(collection: string, id: string, options: { _rev: string }): Promise<{ item: ContentItemLike; _rev: string }>;
		unpublish?(collection: string, id: string, options: { _rev: string }): Promise<{ item: ContentItemLike; _rev: string }>;
	};
	schema?: { listCollections(): Promise<Array<{ slug: string; label: string; fields?: Array<{ slug: string; type: string }> }>> };
	site?: { name?: string; url?: string };
}

function str(args: Record<string, unknown>, key: string): string {
	const value = args[key];
	if (typeof value !== "string" || !value) throw new Error(`"${key}" (metin) gerekli`);
	return value;
}
function optStr(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	return typeof value === "string" && value ? value : undefined;
}
function optNum(args: Record<string, unknown>, key: string, fallback: number): number {
	const value = args[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function objArg(args: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = args[key];
	if (value === undefined || value === null) return {};
	if (typeof value !== "object" || Array.isArray(value)) throw new Error(`"${key}" nesne olmalı`);
	return value as Record<string, unknown>;
}
function entryLabel(item: ContentItemLike): string {
	const title = item.data?.title;
	if (typeof title === "string" && title) return title;
	return item.slug ?? item.id;
}

function preview(item: ContentItemLike): Record<string, unknown> {	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(item.data ?? {})) {
		if (typeof value === "string") data[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
		else if (value === null || typeof value !== "object") data[key] = value;
		else data[key] = Array.isArray(value) ? "[array]" : "[object]";
	}
	return { id: item.id, slug: item.slug, status: item.status, data };
}

/** Remember the state before a mutation so the last change can be reverted. */
export function buildTools(ctx: PluginContext, hooks: ToolRunHooks = {}): AgentTool[] {
	const toolCtx = ctx as unknown as ToolContext;
	const tools: AgentTool[] = [];

	tools.push({
		spec: {
			name: "get_site_info",
			description: "Site name, URL, dev-server state and the content collections with fields. Call this first.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			const collections = toolCtx.schema ? await toolCtx.schema.listCollections() : [];
			return {
				siteName: toolCtx.site?.name ?? null,
				siteUrl: toolCtx.site?.url ?? null,
				devServer: isDevServer(),
				collections: collections.map((c) => ({ slug: c.slug, label: c.label, fields: (c.fields ?? []).map((f) => ({ slug: f.slug, type: f.type })) })),
			};
		},
	});

	tools.push({
		spec: {
			name: "read_file",
			description:
				"Read a project source file (dev only). Large files are paged by line: pass offset (1-based) and limit. The result reports totalLines, from, to and truncated — continue from `to + 1` instead of re-reading the same range.",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string" },
					offset: { type: "number", description: "First line (1-based)" },
					limit: { type: "number", description: "Max lines (default 400, cap 400)" },
				},
				required: ["path"],
			},
		},
		async execute(args) {
			const offset = typeof args.offset === "number" ? args.offset : undefined;
			const limit = typeof args.limit === "number" ? args.limit : undefined;
			return readProjectFile(str(args, "path"), { offset, limit });
		},
	});

	tools.push({
		spec: {
			name: "write_file",
			description: "Create or overwrite a project source file with full content (dev only).",
			inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
		},
		async execute(args) {
			return writeProjectFile(str(args, "path"), str(args, "content"));
		},
	});

	tools.push({
		spec: {
			name: "edit_file",
			description: "Replace an exact oldString with newString in a file (dev only). Must match once unless replaceAll.",
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" }, oldString: { type: "string" }, newString: { type: "string" }, replaceAll: { type: "boolean" } },
				required: ["path", "oldString", "newString"],
			},
		},
		async execute(args) {
			return editProjectFile({
				path: str(args, "path"),
				oldString: str(args, "oldString"),
				newString: str(args, "newString"),
				replaceAll: args.replaceAll === true,
			});
		},
	});

	tools.push({
		spec: {
			name: "list_files",
			description: 'Project file tree (directories end with "/"), dev only.',
			inputSchema: { type: "object", properties: { dir: { type: "string" }, depth: { type: "number" } } },
		},
		async execute(args) {
			return { entries: await listProjectTree(optStr(args, "dir") ?? ".", optNum(args, "depth", 3)) };
		},
	});

	tools.push({
		spec: {
			name: "grep",
			description: "Regex search across project text files (dev only): returns file, line, text.",
			inputSchema: {
				type: "object",
				properties: { pattern: { type: "string" }, dir: { type: "string" }, pathContains: { type: "string" } },
				required: ["pattern"],
			},
		},
		async execute(args) {
			return grepProject({ pattern: str(args, "pattern"), dir: optStr(args, "dir"), pathContains: optStr(args, "pathContains") });
		},
	});

	tools.push({
		spec: {
			name: "content_list",
			description: "List entries of an EmDash collection (id, slug, status, field preview).",
			inputSchema: {
				type: "object",
				properties: { collection: { type: "string" }, limit: { type: "number" }, status: { type: "string" } },
				required: ["collection"],
			},
		},
		async execute(args) {
			if (!toolCtx.content) throw new Error("content:read yetkisi yok");
			const result = await toolCtx.content.list(str(args, "collection"), {
				limit: Math.min(optNum(args, "limit", 20), 50),
				...(optStr(args, "status") ? { where: { status: str(args, "status") } } : {}),
			});
			return { items: result.items.map(preview), hasMore: Boolean(result.hasMore) };
		},
	});

	tools.push({
		spec: {
			name: "content_get",
			description: "Read one entry's full field data.",
			inputSchema: { type: "object", properties: { collection: { type: "string" }, id: { type: "string" } }, required: ["collection", "id"] },
		},
		async execute(args) {
			if (!toolCtx.content) throw new Error("content:read yetkisi yok");
			const item = await toolCtx.content.get(str(args, "collection"), str(args, "id"));
			if (!item) throw new Error("Kayıt bulunamadı");
			return preview(item);
		},
	});

	tools.push({
		spec: {
			name: "content_update",
			description: "Update an entry's fields (draft revision; never publishes).",
			inputSchema: {
				type: "object",
				properties: { collection: { type: "string" }, id: { type: "string" }, data: { type: "object" } },
				required: ["collection", "id", "data"],
			},
		},
		async execute(args) {
			const content = toolCtx.content;
			if (!content?.update) throw new Error("content:write yetkisi yok");
			const collection = str(args, "collection");
			const id = str(args, "id");
			const before = await content.get(collection, id);
			const item = await content.update(collection, id, objArg(args, "data"));
			if (before) {
				await recordUndo(
					ctx,
					{
						kind: "update",
						collection,
						entryId: id,
						data: before.data,
						status: before.status,
						label: `${collection} · ${entryLabel(before)}`,
						ts: new Date().toISOString(),
					},
					hooks,
				);
			}
			return preview(item);
		},
	});

	tools.push({
		spec: {
			name: "content_create",
			description: "Create a new draft entry in a collection.",
			inputSchema: { type: "object", properties: { collection: { type: "string" }, data: { type: "object" } }, required: ["collection", "data"] },
		},
		async execute(args) {
			if (!toolCtx.content?.create) throw new Error("content:write yetkisi yok");
			return preview(await toolCtx.content.create(str(args, "collection"), objArg(args, "data")));
		},
	});

	tools.push({
		spec: {
			name: "content_publish",
			description:
				"Publish an entry's current draft so the change becomes visible on the live site. Revision-fenced; call only when the user wants it live (or explicitly asks to publish).",
			inputSchema: { type: "object", properties: { collection: { type: "string" }, id: { type: "string" } }, required: ["collection", "id"] },
		},
		async execute(args) {
			const content = toolCtx.content;
			if (!content?.getVersioned || !content.publish) throw new Error("content:publish yetkisi yok");
			const collection = str(args, "collection");
			const id = str(args, "id");
			const current = await content.getVersioned(collection, id);
			if (!current) throw new Error("Kayıt bulunamadı");
			const published = await content.publish(collection, id, { _rev: current._rev });
			// An update snapshot for the same entry already captures the previous
			// state; keep it so undo reverts content and visibility in one step.
			const pending = await readUndo(ctx);
			if (!pending || pending.kind !== "update" || pending.entryId !== id || pending.collection !== collection) {
				await recordUndo(
					ctx,
					{
						kind: "publish",
						collection,
						entryId: id,
						data: published.item.data,
						status: "draft",
						label: `${collection} · ${entryLabel(published.item)}`,
						ts: new Date().toISOString(),
					},
					hooks,
				);
			}
			return { ...preview(published.item), live: true };
		},
	});

	tools.push({
		spec: {
			name: "content_unpublish",
			description: "Take an entry off the live site (keeps the content as a draft).",
			inputSchema: { type: "object", properties: { collection: { type: "string" }, id: { type: "string" } }, required: ["collection", "id"] },
		},
		async execute(args) {
			const content = toolCtx.content;
			if (!content?.getVersioned || !content.unpublish) throw new Error("content:publish yetkisi yok");
			const collection = str(args, "collection");
			const id = str(args, "id");
			const current = await content.getVersioned(collection, id);
			if (!current) throw new Error("Kayıt bulunamadı");
			const unpublished = await content.unpublish(collection, id, { _rev: current._rev });
			await recordUndo(
				ctx,
				{
					kind: "unpublish",
					collection,
					entryId: id,
					data: unpublished.item.data,
					status: "published",
					label: `${collection} · ${entryLabel(unpublished.item)}`,
					ts: new Date().toISOString(),
				},
				hooks,
			);
			return { ...preview(unpublished.item), live: false };
		},
	});

	tools.push({
		spec: {
			name: "undo_last_change",
			description:
				"Revert the most recent content change made here: restores the previous field values and the previous visibility (publishes if it was live). Use on 'geri al' / 'undo' or to fix a mistake.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			return undoLastChange(ctx);
		},
	});

	// ── Media i18n: localized alt text, captions and file variants ──
	tools.push({
		spec: {
			name: "media_list",
			description:
				"List site media (id, filename, url, alt, caption) together with the saved per-locale translations. Read this before translating alt text/captions or mapping localized PDFs.",
			inputSchema: {
				type: "object",
				properties: {
					mimeType: { type: "string", description: 'Filter by MIME prefix, e.g. "image/" or "application/pdf"' },
					limit: { type: "number", description: "1-200 (default 100)" },
				},
			},
		},
		async execute(args) {
			const media = ctx.media;
			if (!media) throw new Error("media:read yetkisi gerekli.");
			const limit = typeof args.limit === "number" ? Math.min(Math.max(Math.trunc(args.limit), 1), 200) : 100;
			const mimeType = typeof args.mimeType === "string" ? args.mimeType : undefined;
			const result = await media.list({ limit, mimeType });
			const items = Array.isArray(result) ? result : ((result as { items?: unknown[] }).items ?? []);
			const translations = (await ctx.kv.list(MEDIA_PREFIX))
				.map((entry) => entry.value as MediaI18nRecord | null)
				.filter((record): record is MediaI18nRecord => Boolean(record?.mediaId));
			return { media: items, translations };
		},
	});

	tools.push({
		spec: {
			name: "media_set_translation",
			description:
				"Save one locale's alt text, caption and/or localized file URL for a media item or a static asset URL. For localized PDFs or images with embedded text, point localizedUrl at that locale's file.",
			inputSchema: {
				type: "object",
				properties: {
					mediaId: { type: "string", description: 'Media item id, or "static:<name>" for an asset outside the library' },
					locale: { type: "string", description: "Target locale code, e.g. tr, de" },
					alt: { type: "string", description: "Translated alt text" },
					caption: { type: "string", description: "Translated caption" },
					url: { type: "string", description: "Required for static assets: the original asset URL" },
					localizedUrl: { type: "string", description: "Per-locale file URL (localized PDF/image)" },
				},
				required: ["mediaId", "locale"],
			},
		},
		async execute(args) {
			const mediaId = typeof args.mediaId === "string" ? args.mediaId.trim() : "";
			const locale = typeof args.locale === "string" ? args.locale.trim() : "";
			if (!mediaId || !locale) throw new Error("mediaId ve locale gerekli.");
			return setMediaRecord(ctx.kv, ctx.media, {
				mediaId,
				locale,
				alt: typeof args.alt === "string" ? args.alt : null,
				caption: typeof args.caption === "string" ? args.caption : null,
				url: typeof args.url === "string" ? args.url : undefined,
				localizedUrl: typeof args.localizedUrl === "string" ? args.localizedUrl : null,
			});
		},
	});

	return tools;
}