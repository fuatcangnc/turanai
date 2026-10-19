/**
 * Model providers for the sandboxed runtime.
 *
 * Sandboxed plugins have no Node built-ins and no global fetch with streaming:
 * outbound HTTP goes through `ctx.http.fetch`, whose response is buffered. The
 * providers therefore make single, non-streaming turns.
 */

import type { PluginContext } from "emdash/plugin";

import type { ProviderStatus } from "../protocol";

export interface ToolSpec {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface ToolCall {
	id: string;
	name: string;
	args: unknown;
}

export type ChatMessage =
	| { role: "system"; content: string }
	| { role: "user"; content: string }
	| { role: "assistant"; content: string; toolCalls?: ToolCall[] }
	| { role: "tool"; toolCallId: string; name: string; content: string };

export interface TurnResult {
	text: string;
	toolCalls: ToolCall[];
}

export interface Provider {
	readonly id: "anthropic" | "openai" | "evren";
	readonly model: string;
	runTurn(ctx: PluginContext, messages: ChatMessage[], tools: ToolSpec[]): Promise<TurnResult>;
}

const MAX_TOKENS = 4_096;
/** Evren is an OpenAI-compatible gateway (used here for testing). */
export const EVREN_DEFAULT_BASE_URL = "https://evren-llmapi.ssyz.org.tr/v1";
const DEFAULT_MODELS = { anthropic: "claude-sonnet-4-5", openai: "gpt-4.1-mini", evren: "deepseek-v4.1-flash" } as const;

interface HttpError extends Error {
	status?: number;
}

async function postJson(
	ctx: PluginContext,
	label: string,
	url: string,
	headers: Record<string, string>,
	body: unknown,
): Promise<Record<string, unknown>> {
	const http = ctx.http;
	if (!http) throw new Error("network:request yetkisi yok; emdash-plugin.jsonc içindeki capabilities ve allowedHosts kontrol edin.");
	const res = await http.fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
	const text = await res.text();
	if (!res.ok) {
		const error: HttpError = new Error(`${label} error ${res.status}: ${text.slice(0, 400) || res.statusText}`);
		error.status = res.status;
		throw error;
	}
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		throw new Error(`${label}: yanıt JSON değil`);
	}
}

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
	const out: Array<Record<string, unknown>> = [];
	for (const message of messages) {
		if (message.role === "system") continue;
		if (message.role === "user") {
			out.push({ role: "user", content: [{ type: "text", text: message.content }] });
		} else if (message.role === "assistant") {
			const blocks: Array<Record<string, unknown>> = [];
			if (message.content) blocks.push({ type: "text", text: message.content });
			for (const call of message.toolCalls ?? []) {
				blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.args });
			}
			out.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
		} else {
			out.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }] });
		}
	}
	return out;
}

function anthropicProvider(apiKey: string, model: string): Provider {
	return {
		id: "anthropic",
		model,
		async runTurn(ctx, messages, tools) {
			const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
			const json = await postJson(
				ctx,
				"Anthropic",
				"https://api.anthropic.com/v1/messages",
				{ "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
				{
					model,
					max_tokens: MAX_TOKENS,
					...(system ? { system } : {}),
					messages: toAnthropicMessages(messages),
					...(tools.length
						? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) }
						: {}),
				},
			);
			const content = (json.content as Array<Record<string, unknown>> | undefined) ?? [];
			let text = "";
			const toolCalls: ToolCall[] = [];
			for (const block of content) {
				if (block.type === "text" && typeof block.text === "string") text += block.text;
				else if (block.type === "tool_use") {
					toolCalls.push({ id: String(block.id ?? crypto.randomUUID()), name: String(block.name ?? ""), args: block.input ?? {} });
				}
			}
			return { text, toolCalls };
		},
	};
}

function toOpenAiMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
	const out: Array<Record<string, unknown>> = [];
	for (const message of messages) {
		if (message.role === "system" || message.role === "user") {
			out.push({ role: message.role, content: message.content });
		} else if (message.role === "assistant") {
			out.push({
				role: "assistant",
				content: message.content || null,
				...(message.toolCalls?.length
					? {
							tool_calls: message.toolCalls.map((call) => ({
								id: call.id,
								type: "function",
								function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
							})),
						}
					: {}),
			});
		} else {
			out.push({ role: "tool", tool_call_id: message.toolCallId, content: message.content });
		}
	}
	return out;
}

function openAiCompatibleProvider(id: "openai" | "evren", baseUrl: string, apiKey: string, model: string): Provider {
	return {
		id,
		model,
		async runTurn(ctx, messages, tools) {
			const json = await postJson(
				ctx,
				id === "evren" ? "Evren" : "OpenAI",
				`${baseUrl.replace(/\/$/, "")}/chat/completions`,
				{ authorization: `Bearer ${apiKey}` },
				{
					model,
					messages: toOpenAiMessages(messages),
					...(tools.length
						? {
								tools: tools.map((t) => ({
									type: "function",
									function: { name: t.name, description: t.description, parameters: t.inputSchema },
								})),
							}
						: {}),
				},
			);
			const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
			const message = (choice?.message as Record<string, unknown> | undefined) ?? {};
			const text = typeof message.content === "string" ? message.content : "";
			const rawCalls = (message.tool_calls as Array<Record<string, unknown>> | undefined) ?? [];
			const toolCalls: ToolCall[] = rawCalls.map((call) => {
				const fn = (call.function as Record<string, unknown> | undefined) ?? {};
				let args: unknown = {};
				try {
					args = typeof fn.arguments === "string" && fn.arguments ? JSON.parse(fn.arguments) : {};
				} catch {
					args = { _raw: fn.arguments };
				}
				return { id: String(call.id ?? crypto.randomUUID()), name: String(fn.name ?? ""), args };
			});
			return { text, toolCalls };
		},
	};
}

export interface ProviderOverrides {
	provider?: string | null;
	model?: string | null;
}

export async function readProviderStatus(ctx: PluginContext): Promise<ProviderStatus> {
	const [provider, model, anthropicKey, openaiKey, evrenKey] = await Promise.all([
		ctx.settings.get<string>("provider"),
		ctx.settings.get<string>("model"),
		ctx.settings.get<string>("anthropicApiKey"),
		ctx.settings.get<string>("openaiApiKey"),
		ctx.settings.get<string>("evrenApiKey"),
	]);
	return {
		provider: provider || null,
		model: model || null,
		providers: { anthropic: Boolean(anthropicKey), openai: Boolean(openaiKey), evren: Boolean(evrenKey) },
		hosts: ["api.anthropic.com", "api.openai.com", "evren-llmapi.ssyz.org.tr"],
	};
}

/**
 * Sandboxed plugins cannot read process.env, so keys come from the plugin's
 * encrypted settings (configured in the admin settings form).
 */
export async function resolveProvider(ctx: PluginContext, overrides: ProviderOverrides = {}): Promise<Provider> {
	const [settingsProvider, settingsModel, anthropicKey, openaiKey, evrenKey, evrenBase] = await Promise.all([
		ctx.settings.get<string>("provider"),
		ctx.settings.get<string>("model"),
		ctx.settings.get<string>("anthropicApiKey"),
		ctx.settings.get<string>("openaiApiKey"),
		ctx.settings.get<string>("evrenApiKey"),
		ctx.settings.get<string>("evrenBaseUrl"),
	]);
	const requested = overrides.provider || settingsProvider || null;
	const chosen =
		requested === "anthropic" || requested === "openai" || requested === "evren"
			? requested
			: anthropicKey
				? "anthropic"
				: openaiKey
					? "openai"
					: evrenKey
						? "evren"
						: null;
	if (!chosen) {
		throw new Error(
			"Model sağlayıcı yapılandırılmadı. Admin → Eklentiler → Turan AI ayarlarından bir Anthropic, OpenAI veya Evren anahtarı kaydedin.",
		);
	}
	const model = overrides.model || settingsModel || DEFAULT_MODELS[chosen];
	if (chosen === "anthropic") {
		if (!anthropicKey) throw new Error("Anthropic seçili ama Anthropic API anahtarı yok.");
		return anthropicProvider(anthropicKey, model);
	}
	if (chosen === "openai") {
		if (!openaiKey) throw new Error("OpenAI seçili ama OpenAI API anahtarı yok.");
		return openAiCompatibleProvider("openai", "https://api.openai.com/v1", openaiKey, model);
	}
	if (!evrenKey) throw new Error("Evren seçili ama Evren API anahtarı yok.");
	return openAiCompatibleProvider("evren", evrenBase || EVREN_DEFAULT_BASE_URL, evrenKey, model);
}
