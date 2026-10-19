/**
 * Turan — sandbox-compatible EmDash plugin (standard format).
 *
 * Runs in trusted in-process mode and inside the sandboxed isolate: no Node
 * built-ins, no filesystem, no page fragments. The agent reaches the site
 * through EmDash's capability-gated content APIs and the model providers
 * through `ctx.http.fetch` (declared hosts in `emdash-plugin.jsonc`).
 *
 * Surfaces:
 *   admin          Block Kit chat page (declared in the manifest)
 *   ask            JSON route + MCP tool: one agent turn over a session
 *   status         provider/key state
 *   sessions/*     transcript listing and lookup
 */

import type { SandboxedPlugin } from "emdash/plugin";
import { z } from "zod";

import { chatBlocks, statusBlocks } from "./blocks";
import { runAgent } from "./agent/loop";
import { readProviderStatus } from "./agent/providers";
import { deleteSession, getSession, listSessions, loadOrCreateSession } from "./agent/sessions";
import {
	adminInteractionSchema,
	askInputSchema,
	askOutputSchema,
	publishInputSchema,
	publishOutputSchema,
	undoInputSchema,
	undoOutputSchema,
} from "./protocol";
import { undoLastChange } from "./agent/tools";

const ADMIN_SESSION_KEY = "admin:sessionId";

const sessionIdInput = z.object({ sessionId: z.string().min(1).max(120) });

const plugin: SandboxedPlugin = {
	routes: {
		/**
		 * Block Kit surface for the manifest page. Every interaction arrives as
		 * `routeCtx.input`, so validate before doing anything.
		 */
		admin: {
			permission: "plugins:manage",
			handler: async (routeCtx, ctx) => {
				const currentId = (await ctx.kv.get<string>(ADMIN_SESSION_KEY)) ?? null;
				const session = await loadOrCreateSession(ctx, currentId);
				if (session.id !== currentId) await ctx.kv.set(ADMIN_SESSION_KEY, session.id);

				const parsed = adminInteractionSchema.safeParse(routeCtx.input);
				if (!parsed.success) {
					return { blocks: statusBlocks(await readProviderStatus(ctx)) };
				}
				const interaction = parsed.data;

				if (interaction.type === "block_action" && interaction.action_id === "undo") {
					const value = typeof interaction.value === "string" ? interaction.value : undefined;
					try {
						await undoLastChange(ctx, value);
						return { blocks: chatBlocks(session), toast: { type: "success", message: "Son değişiklik geri alındı" } };
					} catch (error) {
						return { blocks: chatBlocks(session, (error as Error).message), toast: { type: "error", message: (error as Error).message } };
					}
				}

				if (interaction.type === "block_action" && interaction.action_id === "reset") {
					await deleteSession(ctx, session.id);
					await ctx.kv.delete(ADMIN_SESSION_KEY);
					const fresh = await loadOrCreateSession(ctx, null);
					await ctx.kv.set(ADMIN_SESSION_KEY, fresh.id);
					return { blocks: chatBlocks(fresh), toast: { type: "success", message: "Yeni sohbet" } };
				}

				if (interaction.type === "form_submit" && interaction.action_id === "send") {
					const message = String((interaction.values as Record<string, unknown>).message ?? "").trim();
					if (!message) return { blocks: chatBlocks(session, "Mesaj boş.") };
					try {
						const result = await runAgent(ctx, { session, userText: message });
						return {
							blocks: chatBlocks(session),
							toast: { type: "success", message: `${result.provider}/${result.model}` },
						};
					} catch (error) {
						const detail = (error as Error).message;
						ctx.log.warn("turan admin turn failed", { pluginId: ctx.plugin.id, reason: detail });
						return { blocks: chatBlocks(session, detail), toast: { type: "error", message: detail } };
					}
				}

				const status = await readProviderStatus(ctx);
				return {
					blocks: chatBlocks(session, status.providers.anthropic || status.providers.openai ? undefined : "Önce ayarlardan bir Anthropic veya OpenAI anahtarı kaydedin."),
				};
			},
		},

		/** One agent turn; also exposed to MCP clients as the `ask` tool. */
		ask: {
			permission: "content:read",
			input: askInputSchema,
			handler: async (routeCtx, ctx) => {
				const input = askInputSchema.parse(routeCtx.input);
				const session = await loadOrCreateSession(ctx, input.sessionId ?? null);
				try {
					const result = await runAgent(ctx, { session, userText: input.message });
					return {
						ok: true,
						answer: result.text,
						sessionId: session.id,
						provider: result.provider,
						model: result.model,
						toolCalls: result.toolCalls,
					};
				} catch (error) {
					// Expected domain failures (missing key, provider hiccup) are
					// returned as a stable payload so MCP callers can act on them.
					const detail = (error as Error).message;
					ctx.log.warn("turan ask failed", { pluginId: ctx.plugin.id, reason: detail });
					return {
						ok: false,
						error: detail,
						answer: "",
						sessionId: session.id,
						provider: "",
						model: "",
						toolCalls: [],
					};
				}
			},
		},

		status: {
			permission: "plugins:manage",
			handler: async (_routeCtx, ctx) => readProviderStatus(ctx),
		},

		/** Revision-fenced publish, exposed to MCP clients as a destructive tool. */
		"content/publish": {
			permission: "content:publish_any",
			input: publishInputSchema,
			handler: async (routeCtx, ctx) => {
				const { collection, id } = publishInputSchema.parse(routeCtx.input);
				const content = ctx.content as unknown as {
					getVersioned(collection: string, id: string): Promise<{ item: { id: string; status: string }; _rev: string } | null>;
					publish(collection: string, id: string, options: { _rev: string }): Promise<{ item: { id: string; status: string }; _rev: string }>;
				};
				if (!content?.getVersioned || !content.publish) {
					return { ok: false, id, status: "unknown", error: "content:publish yetkisi yok" };
				}
				try {
					const current = await content.getVersioned(collection, id);
					if (!current) return { ok: false, id, status: "unknown", error: "Kayıt bulunamadı" };
					const published = await content.publish(collection, id, { _rev: current._rev });
					return { ok: true, id: published.item.id, status: published.item.status, _rev: published._rev };
				} catch (error) {
					return { ok: false, id, status: "unknown", error: (error as Error).message };
				}
			},
		},

		/** Reverts the last content change (widget UI or MCP callers). */
		"content/undo": {
			permission: "content:publish_any",
			input: undoInputSchema,
			handler: async (routeCtx, ctx) => {
				const changeId = (routeCtx.input as { changeId?: string } | undefined)?.changeId;
				try {
					const result = (await undoLastChange(ctx, changeId)) as {
						changeId?: string;
						reverted: boolean;
						live?: boolean;
					};
					return { ok: true, reverted: true, changeId: result.changeId, live: result.live };
				} catch (error) {
					return { ok: false, reverted: false, error: (error as Error).message };
				}
			},
		},

		"sessions/list": {
			permission: "plugins:manage",
			handler: async (_routeCtx, ctx) => {
				const sessions = await listSessions(ctx, 25);
				return {
					sessions: sessions.map((s) => ({
						id: s.id,
						title: s.title,
						updatedAt: s.updatedAt,
						messageCount: s.messages.length,
					})),
				};
			},
		},

		"session/get": {
			permission: "plugins:manage",
			input: sessionIdInput,
			handler: async (routeCtx, ctx) => {
				const { sessionId } = sessionIdInput.parse(routeCtx.input);
				const session = await getSession(ctx, sessionId);
				if (!session) throw new Error("Oturum bulunamadı");
				return { session };
			},
		},
	},

	mcp: {
		tools: {
			ask: {
				description:
					"Ask the site's Turan agent. It can inspect the EmDash schema and content and save draft edits; publishing happens only through the separate publish tool.",
				route: "ask",
				input: askInputSchema,
				output: askOutputSchema,
				destructive: false,
			},
			publish: {
				description: "Publish one entry's current draft so it becomes visible on the live site.",
				route: "content/publish",
				input: publishInputSchema,
				output: publishOutputSchema,
				destructive: true,
			},
			undo: {
				description: "Revert the most recent Turan content change (restores previous field values and visibility).",
				route: "content/undo",
				input: undoInputSchema,
				output: undoOutputSchema,
				destructive: true,
			},
		},
	},
};

export default plugin;
