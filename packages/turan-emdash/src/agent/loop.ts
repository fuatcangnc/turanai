/**
 * The agent loop: a bounded tool-calling conversation over the configured
 * provider, restricted to EmDash's content tools (sandboxed plugins have no
 * filesystem access). Transcripts are persisted after every turn.
 */

import type { PluginContext } from "emdash/plugin";

import type { TuranSession } from "../protocol";
import { resolveProvider, type ChatMessage, type ProviderOverrides, type ToolSpec } from "./providers";
import { buildTools } from "./tools";
import { saveSession } from "./sessions";

const MAX_STEPS = 12;
const TOOL_RESULT_LIMIT = 4_000;

export interface RunAgentResult {
	text: string;
	provider: string;
	model: string;
	toolCalls: Array<{ name: string; ok: boolean }>;
}

function systemPrompt(): string {
	return [
		"You are Turan, the AI agent that lives inside this EmDash CMS site's admin.",
		"You work on the site's *content* through the provided tools: read the schema, list/read entries, and save draft changes.",
		"Rules:",
		"- Call get_site_info first so you know the collections and fields.",
		"- content_update and content_create save a draft first, then IMMEDIATELY call content_publish in the same turn so the change is live. Never ask whether to publish; just publish and state that it is live.",
		"- If the user asks to undo/revert ('geri al'), call undo_last_change.",
		"- Never invent ids or field slugs: read them first.",
		"- Keep answers short and concrete, and mention what changed (collection, entry, fields).",
		"- Reply in the language the user writes in (Turkish input -> Turkish answer).",
		"- You cannot edit source code or files; if asked, explain that the content tools are what you have.",
	].join("\n");
}

function historyMessages(session: TuranSession): ChatMessage[] {
	const messages: ChatMessage[] = [];
	for (const entry of session.messages) {
		if (entry.role === "user") messages.push({ role: "user", content: entry.text });
		else if (entry.role === "assistant") messages.push({ role: "assistant", content: entry.text });
		else messages.push({ role: "assistant", content: `[önceki araç ${entry.toolName ?? "?"}]: ${entry.text.slice(0, 400)}` });
	}
	return messages;
}

function truncateToolResult(payload: unknown): string {
	let text: string;
	try {
		text = typeof payload === "string" ? payload : JSON.stringify(payload);
	} catch {
		text = String(payload);
	}
	return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}\n…[kısaltıldı]` : text;
}

export async function runAgent(
	ctx: PluginContext,
	options: { session: TuranSession; userText: string } & ProviderOverrides,
): Promise<RunAgentResult> {
	const { session, userText } = options;
	const provider = await resolveProvider(ctx, { provider: options.provider, model: options.model });

	const changeIds: string[] = [];
	const tools = buildTools(ctx, { onContentChange: (info) => changeIds.push(info.changeId) });
	const specs: ToolSpec[] = tools.map((tool) => tool.spec);
	const byName = new Map(tools.map((tool) => [tool.spec.name, tool]));

	const history = historyMessages(session);
	session.messages.push({ role: "user", text: userText, ts: new Date().toISOString() });
	await saveSession(ctx, session);

	const messages: ChatMessage[] = [
		{ role: "system", content: systemPrompt() },
		...history,
		{ role: "user", content: userText },
	];

	const executed: Array<{ name: string; ok: boolean }> = [];
	let finalText = "";

	for (let step = 0; step < MAX_STEPS; step++) {
		const turn = await provider.runTurn(ctx, messages, specs);
		if (turn.text.trim()) finalText = turn.text.trim();

		if (!turn.toolCalls.length) break;

		messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });
		for (const call of turn.toolCalls) {
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
			executed.push({ name: call.name, ok });
			messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: resultText });
			session.messages.push({
				role: "tool",
				toolName: call.name,
				text: ok ? resultText.slice(0, 600) : `HATA: ${resultText.slice(0, 600)}`,
				ts: new Date().toISOString(),
			});
		}
	}

	if (!finalText) finalText = "İşlem tamamlandı ancak model metin döndürmedi.";
	session.messages.push({
		role: "assistant",
		text: finalText,
		ts: new Date().toISOString(),
		// Per-message undo: the answer carries the ids of the changes it made.
		...(changeIds.length ? { changeIds } : {}),
	});
	await saveSession(ctx, session);

	return { text: finalText, provider: provider.id, model: provider.model, toolCalls: executed };
}
