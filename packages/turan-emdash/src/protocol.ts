/**
 * Shared contracts for the Turan plugin: route inputs/outputs, MCP tool
 * schemas, admin Block Kit interactions and the stored chat transcript.
 */

import { z } from "zod";

export const providerIdSchema = z.enum(["anthropic", "openai", "evren"]);

/** `ask` route / MCP tool input. */
export const askInputSchema = z.object({
	message: z.string().min(1).max(8_000).describe("The request for the agent, in natural language."),
	sessionId: z.string().min(1).max(120).optional().describe("Continue an existing chat session."),
});
export type AskInput = z.infer<typeof askInputSchema>;

export const askOutputSchema = z.object({
	ok: z.boolean().describe("false when the request could not be completed (see error)."),
	error: z.string().optional().describe("Human-readable reason when ok is false."),
	answer: z.string(),
	sessionId: z.string(),
	provider: z.string(),
	model: z.string(),
	toolCalls: z.array(z.object({ name: z.string(), ok: z.boolean() })),
});
export type AskOutput = z.infer<typeof askOutputSchema>;

/** `content/publish` route + MCP tool: revision-fenced publish of one entry. */
export const publishInputSchema = z.object({
	collection: z.string().min(1).max(63).describe("Collection slug, e.g. posts"),
	id: z.string().min(1).max(128).describe("Entry id"),
});
export type PublishInput = z.infer<typeof publishInputSchema>;

export const publishOutputSchema = z.object({
	ok: z.boolean(),
	id: z.string(),
	status: z.string(),
	_rev: z.string().optional(),
	error: z.string().optional(),
});

/** `content/undo` route + MCP tool: revert the last content change. */
export const undoInputSchema = z.object({
	changeId: z.string().min(1).max(64).optional().describe("Revert this recorded change (default: the most recent)."),
});

export const undoOutputSchema = z.object({
	ok: z.boolean(),
	reverted: z.boolean(),
	changeId: z.string().optional(),
	live: z.boolean().optional(),
	collection: z.string().optional(),
	id: z.string().optional(),
	error: z.string().optional(),
});

/** Block Kit interactions sent by the admin surface. */export const adminInteractionSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("page_load"), page: z.string().optional() }),
	z.object({
		type: z.literal("form_submit"),
		action_id: z.string(),
		values: z.record(z.string(), z.unknown()).default({}),
	}),
	z.object({ type: z.literal("block_action"), action_id: z.string(), value: z.unknown().optional() }),
]);
export type AdminInteraction = z.infer<typeof adminInteractionSchema>;

export interface StoredMessage {
	role: "user" | "assistant" | "tool";
	text: string;
	ts: string;
	toolName?: string;
	/** Content changes made while producing this message (for per-message undo). */
	changeIds?: string[];
}

export interface TuranSession {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messages: StoredMessage[];
}

export interface ProviderStatus {	provider: string | null;
	model: string | null;
	providers: { anthropic: boolean; openai: boolean; evren: boolean };
	hosts: string[];
}

export function cleanTitle(text: string): string {
	return text.replace(/\s+/g, " ").trim().slice(0, 60) || "Yeni sohbet";
}
