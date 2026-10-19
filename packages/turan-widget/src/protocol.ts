/** Shared contracts between the widget routes and the UI. */

import { z } from "zod";

export const PLUGIN_ID = "turan-widget";
export const API_BASE = `/_emdash/api/plugins/${PLUGIN_ID}`;

export type TuranEvent =
	| { type: "run_started"; ts: string; provider: string; model: string }
	| { type: "assistant_text_delta"; ts: string; text: string }
	| { type: "assistant_text_done"; ts: string; text: string }
	| { type: "tool_started"; ts: string; callId: string; name: string; args: unknown }
	| { type: "tool_done"; ts: string; callId: string; name: string; ok: boolean; summary: string }
	/** Emitted when a content mutation is recorded, so the UI can offer undo. */
	| { type: "content_changed"; ts: string; changeId: string; kind: string; collection: string; entryId: string; label: string }
	| { type: "run_finished"; ts: string }
	| { type: "run_error"; ts: string; message: string };

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

export interface SessionSummary {
	id: string;
	title: string;
	updatedAt: string;
	messageCount: number;
}

export const promptInputSchema = z.object({
	message: z.string().min(1).max(32_000),
	sessionId: z.string().min(1).max(128).optional(),
	provider: z.enum(["anthropic", "openai", "evren"]).optional(),
	model: z.string().min(1).max(120).optional(),
});
export type PromptInput = z.infer<typeof promptInputSchema>;

export const eventsInputSchema = z.object({
	sessionId: z.string().min(1).max(128),
	runId: z.string().min(1).max(128).optional(),
	cursor: z.number().int().min(0).default(0),
});
export type EventsInput = z.infer<typeof eventsInputSchema>;

export interface EventsResponse {
	events: TuranEvent[];
	cursor: number;
	done: boolean;
	runId?: string;
}

export const sessionGetInputSchema = z.object({ sessionId: z.string().min(1).max(128) });

/** `undo` route: revert one recorded content change (default: the last one). */
export const undoInputSchema = z.object({
	changeId: z.string().min(1).max(64).optional(),
});

/** `media/*` routes: per-locale alt text, caption and file variants. */
export const mediaListInputSchema = z.object({
	mimeType: z.string().max(100).optional(),
	limit: z.number().int().min(1).max(200).optional(),
});
export type MediaListInput = z.infer<typeof mediaListInputSchema>;

export const mediaSetInputSchema = z.object({
	mediaId: z.string().min(1).max(128),
	locale: z.string().min(2).max(12),
	alt: z.string().max(2000).nullable().optional(),
	caption: z.string().max(4000).nullable().optional(),
	/** Required when `mediaId` is not a library item (`static:<name>`). */
	url: z.string().max(2000).optional(),
	localizedUrl: z.string().max(2000).nullable().optional(),
});
export type MediaSetInput = z.infer<typeof mediaSetInputSchema>;

export const mediaRemoveInputSchema = z.object({
	mediaId: z.string().min(1).max(128),
	locale: z.string().min(2).max(12),
});
export type MediaRemoveInput = z.infer<typeof mediaRemoveInputSchema>;

/** `translations/list`: rows for the Translation lists panel. */
export const translationsInputSchema = z.object({
	locale: z.string().min(2).max(12).optional(),
});
export type TranslationsInput = z.infer<typeof translationsInputSchema>;

export interface TranslationLocale {
	code: string;
	label: string;
	isDefault: boolean;
}

export interface TranslationMediaRow {
	mediaId: string;
	url: string;
	filename?: string | null;
	alt?: string | null;
	caption?: string | null;
	localizedUrl?: string | null;
	/** A locale record exists for this asset. */
	translated: boolean;
}

export interface TranslationTextRow {
	collection: string;
	id: string;
	slug: string | null;
	title: string;
	status: string;
}

export interface TranslationsResponse {
	locale: string;
	locales: TranslationLocale[];
	collections: string[];
	media: TranslationMediaRow[];
	text: TranslationTextRow[];
	/** Default-locale entries that have no translation in the selected locale. */
	pending: TranslationPendingRow[];
}

export interface TranslationPendingRow {
	collection: string;
	id: string;
	slug: string | null;
	title: string;
	locale: string;
}

/** `translations/publish`: publish or unpublish one entry (per language). */
export const translationsPublishSchema = z.object({
	collection: z.string().min(1).max(64),
	id: z.string().min(1).max(128),
	publish: z.boolean(),
});
export type TranslationsPublishInput = z.infer<typeof translationsPublishSchema>;

/** `locale/default`: change the default (unprefixed) site locale. */
export const localeDefaultSchema = z.object({
	code: z.string().min(2).max(12),
});
export type LocaleDefaultInput = z.infer<typeof localeDefaultSchema>;

/** `run/stop`: ask the running agent to stop at the next step boundary. */
export const runStopSchema = z.object({
	sessionId: z.string().min(1).max(128),
});
export type RunStopInput = z.infer<typeof runStopSchema>;

export interface StatusResponse {
	dev: boolean;
	pluginVersion: string;
	providers: { anthropic: boolean; openai: boolean; evren: boolean };
	settings: { provider: string | null; model: string | null; language?: string | null };
	/** Locales from the site's Astro i18n config (empty when i18n is off). */
	locales?: Array<{ code: string; label: string; isDefault: boolean }>;
}
