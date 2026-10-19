/**
 * Agent loop for the trusted plugin: bounded tool-calling turns with streamed
 * text and tool activity appended to the run's event log (polled by the UI).
 */

import type { PluginContext } from "emdash/plugin";

import type { StoredMessage, TuranEvent, TuranSession } from "../protocol";
import { appendEvent, finishRun, putSession } from "./bus";
import { isDevServer } from "./files";
import { resolveProvider, type ChatMessage, type Provider, type ProviderConfig } from "./providers";
import { buildTools } from "./tools";
import { getProjectIndex, markProjectIndexDirty, projectMapBlock } from "./index-cache";
import { clearStop, isStopRequested } from "./bus";

const DEFAULT_MAX_STEPS = 80;
const MAX_STEPS_HARD_CAP = 500;

/**
 * Step budget for one agent run. Long jobs (translating the whole theme) need
 * far more than a chat turn, so it is configurable from the plugin settings and
 * the run reports clearly when the budget is exhausted instead of stopping
 * mid-sentence.
 */
async function stepBudget(ctx: PluginContext): Promise<number> {
	const raw = await ctx.settings.get<string | number>("maxSteps");
	const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
	const value = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_STEPS;
	return Math.min(Math.max(value, 4), MAX_STEPS_HARD_CAP);
}
const TOOL_RESULT_LIMIT = 6_000;

function now(): string {
	return new Date().toISOString();
}

function emit(runId: string, event: TuranEvent): void {
	appendEvent(runId, event);
}

function truncateToolResult(payload: unknown): string {
	let text: string;
	try {
		text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 1);
	} catch {
		text = String(payload);
	}
	return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}\n…[kısaltıldı]` : text;
}

function systemPrompt(): string {
	const dev = isDevServer();
	return [
		"You are Turan, an in-app AI coding and content agent inside an EmDash CMS site (Astro).",
		`Working directory (project root): ${process.cwd()}. Site content lives in EmDash collections (content_* tools); site source lives under src/.`,
		dev
			? "You run in `astro dev`: file tools (read_file, edit_file, write_file, list_files, grep) are enabled and write real source files. Vite HMR reloads the site automatically — do not restart anything."
			: "Production mode: file tools are disabled; only content tools work.",
		"Guidelines:",
		"- Call get_site_info first (collections, fields, mode).",
		"- The PROJECT MAP below is cached memory. Do NOT rebuild it: no whole-project list_files, no repeated identical grep. Read only the files you will change or whose exact contents you need.",
		"- read_file is line-paged: if it returns truncated, continue with offset = to + 1. Never re-read a range you already have.",
		"- grep returns {path, line, text}. Use the line number to jump straight in with read_file offset. If two greps miss, read the file section instead of grepping again.",
		"- list_files and grep also accept a single file path (not only directories).",
		"- Never read .env, data.db, node_modules or uploads/ — they are blocked and waste a step.",
		"- Prefer edit_file (exact-string replace) over write_file for existing files; read first so oldString matches.",
		"- content_update/content_create save to a draft first, then IMMEDIATELY call content_publish in the same turn so the change is live. Never ask whether to publish; just publish and state that it is live.",
		"- If the user asks to undo/revert ('geri al'), call undo_last_change.",
		"- Keep changes minimal and consistent with the surrounding code; explain briefly.",
		"- Styling & dependencies: check package.json first. If Tailwind CSS v4 is present (tailwindcss + @tailwindcss/vite installed and wired in astro.config.mjs), style with Tailwind 4 utility classes. If it is NOT present: you must NEVER install it or add any dependency/config yourself — build the same result with custom CSS (a scoped <style> block in the .astro component or a plain CSS file) and, in your final answer, ask once whether the user wants to install Tailwind 4 themselves for future work.",
		"- Missing directories are created automatically by write_file.",
		"- Match the user's language (Turkish input -> Turkish prose).",
	].join("\n");
}

function historyToMessages(history: StoredMessage[]): ChatMessage[] {
	const messages: ChatMessage[] = [];
	for (const message of history) {
		if (message.role === "user") messages.push({ role: "user", content: message.text });
		else if (message.role === "assistant") messages.push({ role: "assistant", content: message.text });
		else messages.push({ role: "assistant", content: `[önceki araç ${message.toolName ?? "?"}]: ${message.text.slice(0, 500)}` });
	}
	return messages;
}

async function loadProviderConfig(
	ctx: PluginContext,
	override: { provider?: "anthropic" | "openai" | "evren" | null; model?: string | null },
): Promise<ProviderConfig> {
	const [provider, model, anthropicKey, openaiKey, evrenKey, evrenBase] = await Promise.all([
		ctx.settings.get<string>("provider"),
		ctx.settings.get<string>("model"),
		ctx.settings.get<string>("anthropicApiKey"),
		ctx.settings.get<string>("openaiApiKey"),
		ctx.settings.get<string>("evrenApiKey"),
		ctx.settings.get<string>("evrenBaseUrl"),
	]);
	return {
		provider: override.provider || provider,
		model: override.model || model,
		anthropicApiKey: anthropicKey || process.env.ANTHROPIC_API_KEY || null,
		openaiApiKey: openaiKey || process.env.OPENAI_API_KEY || null,
		evrenApiKey: evrenKey || process.env.EVREN_API_KEY || null,
		evrenBaseUrl: evrenBase || process.env.EVREN_BASE_URL || null,
	};
}

async function persistSession(ctx: PluginContext, session: TuranSession): Promise<void> {
	putSession(session);
	try {
		await ctx.kv.set(`session:${session.id}`, session);
	} catch {
		/* request teardown; the in-memory copy stands */
	}
}

export interface RunAgentParams {
	ctx: PluginContext;
	session: TuranSession;
	runId: string;
	userText: string;
	provider?: "anthropic" | "openai" | "evren" | null;
	model?: string | null;
}

export async function runAgent({
	ctx,
	session,
	runId,
	userText,
	provider: providerOverride,
	model: modelOverride,
}: RunAgentParams): Promise<void> {
	const historyMessages = historyToMessages(session.messages);
	// Keep a handle on the user turn: this run's content changes are attached to
	// it so the UI can offer "Geri al" right under the message that caused them.
	const userMessage: StoredMessage = { role: "user", text: userText, ts: now() };
	session.messages.push(userMessage);
	if (session.title === "Yeni sohbet") {
		// Selection context is noise in a title: keep only the user's own words.
		const cleaned = userText.replace(/\[SECLI_OGELER\][\s\S]*?\[\/SECLI_OGELER\]\s*/g, "").trim() || userText;
		session.title = cleaned.replace(/\s+/g, " ").slice(0, 60) || "Yeni sohbet";
	}
	session.updatedAt = now();
	await persistSession(ctx, session);

	let provider: Provider;
	let modelLabel = "";
	try {
		const config = await loadProviderConfig(ctx, { provider: providerOverride, model: modelOverride });
		provider = resolveProvider(config);
		modelLabel = `${provider.id}/${provider.model}`;
	} catch (error) {
		emit(runId, { type: "run_error", ts: now(), message: (error as Error).message });
		finishRun(runId);
		return;
	}

	emit(runId, { type: "run_started", ts: now(), provider: provider.id, model: modelLabel });

	const editIds: string[] = [];
	const tools = buildTools(ctx, {
		onContentChange: (info) => {
			editIds.push(info.changeId);
			emit(runId, { type: "content_changed", ts: now(), ...info });
		},
	});
	const byName = new Map(tools.map((tool) => [tool.spec.name, tool]));
	const index = isDevServer() ? await getProjectIndex(ctx) : null;
	const map = projectMapBlock(index);
	const messages: ChatMessage[] = [
		{ role: "system", content: map ? `${systemPrompt()}\n\n${map}` : systemPrompt() },
		...historyMessages,
		{ role: "user", content: userText },
	];

	try {
		const maxSteps = await stepBudget(ctx);
		const runStart = now();
		let finished = false;
		let stopped = false;
		for (let step = 0; step < maxSteps; step++) {
			if (isStopRequested(runId)) {
				stopped = true;
				break;
			}
			const turn = await provider.runTurn(messages, tools.map((t) => t.spec), (delta) => {
				emit(runId, { type: "assistant_text_delta", ts: now(), text: delta });
			});
			if (turn.text.trim()) {
				emit(runId, { type: "assistant_text_done", ts: now(), text: turn.text });
				session.messages.push({ role: "assistant", text: turn.text, ts: now() });
			}
			if (!turn.toolCalls.length) {
				finished = true;
				break;
			}
			messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });

			for (const call of turn.toolCalls) {
				if (isStopRequested(runId)) {
					stopped = true;
					break;
				}
				emit(runId, { type: "tool_started", ts: now(), callId: call.id, name: call.name, args: call.args });
				const tool = byName.get(call.name);
				let ok = true;
				let resultText: string;
				if (!tool) {
					ok = false;
					resultText = `Bilinmeyen araç "${call.name}". Kullanılabilir: ${[...byName.keys()].join(", ")}`;
				} else {
					try {
						resultText = truncateToolResult(await tool.execute((call.args ?? {}) as Record<string, unknown>));
					} catch (error) {
						ok = false;
						resultText = `Hata: ${(error as Error).message}`;
					}
				}
				emit(runId, { type: "tool_done", ts: now(), callId: call.id, name: call.name, ok, summary: resultText.slice(0, 900) });
				if (ok && (call.name === "edit_file" || call.name === "write_file" || call.name === "install_packages")) {
					// The cached project map is stale now; the next run rebuilds it once.
					void markProjectIndexDirty(ctx);
				}
				messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: resultText });
				session.messages.push({
					role: "tool",
					toolName: call.name,
					text: ok ? resultText.slice(0, 800) : `HATA: ${resultText.slice(0, 800)}`,
					ts: now(),
				});
			}
			session.updatedAt = now();
		}
		if (stopped) {
			const text = "Stopped by user.";
			emit(runId, { type: "assistant_text_done", ts: now(), text });
			session.messages.push({ role: "assistant", text, ts: now() });
		} else if (!finished) {
			// Never stop mid-task silently: say why and how to continue.
			const text = `Step limit reached (${maxSteps}). Say "continue" to resume; finished files stay unchanged.`;
			emit(runId, { type: "assistant_text_done", ts: now(), text });
			session.messages.push({ role: "assistant", text, ts: now() });
		} else if (!session.messages.some((message) => message.role === "assistant" && message.ts >= runStart)) {
			// The model ended without any text (empty final turn): make it visible.
			const text = "The model ended the turn without any text. Please try again.";
			emit(runId, { type: "assistant_text_done", ts: now(), text });
			session.messages.push({ role: "assistant", text, ts: now() });
		}
		emit(runId, { type: "run_finished", ts: now() });
	} catch (error) {
		ctx.log.error("turan run failed", { runId, reason: (error as Error).message });
		emit(runId, { type: "run_error", ts: now(), message: (error as Error).message });
	} finally {
		clearStop(runId);
		// Attach this run's content changes to the user turn so the UI can offer
		// a per-message undo (persisted, so it survives reloads).
		if (editIds.length) userMessage.changeIds = [...(userMessage.changeIds ?? []), ...editIds];
		session.updatedAt = now();
		await persistSession(ctx, session);
		finishRun(runId);
	}
}
