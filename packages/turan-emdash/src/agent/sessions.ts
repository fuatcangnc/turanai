/**
 * Chat transcripts in the declared `sessions` storage collection. Using
 * storage (not a module-scope map) keeps sessions working across the Node and
 * Cloudflare sandbox runners.
 */

import type { PluginContext } from "emdash/plugin";

import type { TuranSession } from "../protocol";
import { cleanTitle } from "../protocol";

interface SessionsCollection {
	get(id: string): Promise<TuranSession | null>;
	put(id: string, data: TuranSession): Promise<void>;
	delete(id: string): Promise<boolean>;
	query(options?: {
		limit?: number;
		orderBy?: Record<string, "asc" | "desc">;
	}): Promise<{ items: Array<{ id: string; data: TuranSession }>; hasMore: boolean }>;
}

function collection(ctx: PluginContext): SessionsCollection {
	return (ctx.storage as unknown as { sessions: SessionsCollection }).sessions;
}

export function newSession(id: string): TuranSession {
	const now = new Date().toISOString();
	return { id, title: "Yeni sohbet", createdAt: now, updatedAt: now, messages: [] };
}

export async function getSession(ctx: PluginContext, id: string): Promise<TuranSession | null> {
	const stored = await collection(ctx).get(id);
	return stored ?? null;
}

export async function loadOrCreateSession(ctx: PluginContext, id?: string | null): Promise<TuranSession> {
	if (id) {
		const existing = await getSession(ctx, id);
		if (existing) return existing;
	}
	return newSession(id || crypto.randomUUID());
}

export async function saveSession(ctx: PluginContext, session: TuranSession): Promise<void> {
	session.updatedAt = new Date().toISOString();
	if (session.title === "Yeni sohbet" && session.messages.length > 0) {
		const firstUser = session.messages.find((m) => m.role === "user");
		if (firstUser) session.title = cleanTitle(firstUser.text);
	}
	await collection(ctx).put(session.id, session);
}

export async function listSessions(ctx: PluginContext, limit = 20): Promise<TuranSession[]> {
	const result = await collection(ctx).query({ limit, orderBy: { updatedAt: "desc" } });
	return result.items.map((item) => item.data);
}

export async function deleteSession(ctx: PluginContext, id: string): Promise<boolean> {
	return collection(ctx).delete(id);
}
