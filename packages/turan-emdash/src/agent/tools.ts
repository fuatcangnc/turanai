/**
 * Agent tools for the sandboxed runtime: EmDash schema/content through the
 * capability-gated PluginContext, plus content publish/unpublish and a
 * per-change undo stack (no filesystem in a sandboxed plugin).
 */

import type { PluginContext } from "emdash/plugin";

import type { ToolSpec } from "./providers";

export interface AgentTool {
	spec: ToolSpec;
	execute(args: Record<string, unknown>): Promise<unknown>;
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
	schema?: {
		listCollections(): Promise<Array<{ slug: string; label: string; fields?: Array<{ slug: string; type: string }> }>>;
	};
	site?: { name?: string; url?: string };
}

/** Snapshot of a content mutation, kept on a stack for per-message undo. */
export interface UndoSnapshot {
	changeId: string;
	kind: "update" | "publish" | "unpublish";
	collection: string;
	entryId: string;
	data: Record<string, unknown>;
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

function preview(item: ContentItemLike): Record<string, unknown> {
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(item.data ?? {})) {
		if (typeof value === "string") data[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
		else if (value === null || typeof value !== "object") data[key] = value;
		else data[key] = Array.isArray(value) ? "[array]" : "[object]";
	}
	return { id: item.id, slug: item.slug, status: item.status, data };
}

// --- Undo stack ------------------------------------------------------------------

async function readStack(ctx: PluginContext): Promise<UndoSnapshot[]> {
	try {
		return (await ctx.kv.get<UndoSnapshot[]>(UNDO_STACK_KEY)) ?? [];
	} catch {
		return [];
	}
}

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
	hooks.onContentChange?.({
		changeId,
		kind: snapshot.kind,
		collection: snapshot.collection,
		entryId: snapshot.entryId,
		label: snapshot.label,
	});
	return changeId;
}

/** Revert one recorded change (the latest by default). */
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

// --- Tools ------------------------------------------------------------------------

export function buildTools(ctx: PluginContext, hooks: ToolRunHooks = {}): AgentTool[] {
	const toolCtx = ctx as unknown as ToolContext;
	const tools: AgentTool[] = [];

	tools.push({
		spec: {
			name: "get_site_info",
			description: "Site name, URL and the content collections with their fields. Call this first.",
			inputSchema: { type: "object", properties: {} },
		},
		async execute() {
			const collections = toolCtx.schema ? await toolCtx.schema.listCollections() : [];
			return {
				siteName: toolCtx.site?.name ?? null,
				siteUrl: toolCtx.site?.url ?? null,
				collections: collections.map((c) => ({
					slug: c.slug,
					label: c.label,
					fields: (c.fields ?? []).map((f) => ({ slug: f.slug, type: f.type })),
				})),
			};
		},
	});

	tools.push({
		spec: {
			name: "content_list",
			description: "List entries of an EmDash collection (id, slug, status and a field preview).",
			inputSchema: {
				type: "object",
				properties: {
					collection: { type: "string", description: 'Collection slug, e.g. "posts"' },
					limit: { type: "number", description: "Max entries (default 20, max 50)" },
					status: { type: "string", description: '"published" or "draft"' },
				},
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
			description: "Read one entry's full field data by collection and id.",
			inputSchema: {
				type: "object",
				properties: { collection: { type: "string" }, id: { type: "string" } },
				required: ["collection", "id"],
			},
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
			description:
				"Update an existing entry's fields (saved as a draft revision first; publish afterwards when the change should be visible). `data` maps field slugs to new values.",
			inputSchema: {
				type: "object",
				properties: {
					collection: { type: "string" },
					id: { type: "string" },
					data: { type: "object", description: "Field slug -> new value (partial update)" },
				},
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
			description: "Create a new draft entry in a collection. `data` maps field slugs to values.",
			inputSchema: {
				type: "object",
				properties: { collection: { type: "string" }, data: { type: "object" } },
				required: ["collection", "data"],
			},
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
				"Publish an entry's current draft so the change becomes visible on the live site. Revision-fenced; call in the same turn as the update.",
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
			// Keep the pending update snapshot so undo restores content + visibility
			// in one step instead of only reversing the publish.
			const stack = await readStack(ctx);
			const pending = stack[stack.length - 1];
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
				"Revert a content change made here (the most recent by default): restores the previous field values and visibility. Use on 'geri al' / 'undo'.",
			inputSchema: { type: "object", properties: { changeId: { type: "string" } } },
		},
		async execute(args) {
			return undoLastChange(ctx, optStr(args, "changeId"));
		},
	});

	return tools;
}
