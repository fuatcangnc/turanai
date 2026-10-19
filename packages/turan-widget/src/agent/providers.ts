/**
 * LLM providers (Anthropic + OpenAI) with streaming through global `fetch`.
 * The trusted plugin runs in the site process, where the sandboxed
 * `ctx.http.fetch` buffering does not apply.
 */

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
	runTurn(messages: ChatMessage[], tools: ToolSpec[], onText: (delta: string) => void): Promise<TurnResult>;
}

const MAX_TOKENS = 8_192;
/** Evren (yapayzekalab/evren-llmapi) is OpenAI-compatible. */
export const EVREN_DEFAULT_BASE_URL = "https://evren-llmapi.ssyz.org.tr/v1";
const DEFAULT_MODELS = { anthropic: "claude-sonnet-4-5", openai: "gpt-4.1-mini", evren: "deepseek-v4.1-flash" } as const;

async function fail(res: Response, label: string): Promise<never> {
	let detail = "";
	try {
		detail = (await res.text()).slice(0, 600);
	} catch {
		/* body already consumed */
	}
	throw new Error(`${label} API error ${res.status}: ${detail || res.statusText}`);
}

async function* readSse(res: Response): AsyncGenerator<Record<string, unknown>> {
	const reader = res.body?.getReader();
	if (!reader) return;
	const decoder = new TextDecoder();
	let buffer = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let sep: number;
		while ((sep = buffer.indexOf("\n\n")) >= 0) {
			const chunk = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			for (const line of chunk.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const payload = trimmed.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;
				try {
					yield JSON.parse(payload) as Record<string, unknown>;
				} catch {
					/* keep-alive frame */
				}
			}
		}
	}
}

interface Acc {
	id: string;
	name: string;
	json: string;
}

function parseArgs(json: string): unknown {
	try {
		return json ? JSON.parse(json) : {};
	} catch {
		return { _raw: json };
	}
}

function anthropicProvider(apiKey: string, model: string): Provider {
	return {
		id: "anthropic",
		model,
		async runTurn(messages, tools, onText) {
			const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
			const converted: Array<Record<string, unknown>> = [];
			for (const message of messages) {
				if (message.role === "system") continue;
				if (message.role === "user") converted.push({ role: "user", content: [{ type: "text", text: message.content }] });
				else if (message.role === "assistant") {
					const blocks: Array<Record<string, unknown>> = [];
					if (message.content) blocks.push({ type: "text", text: message.content });
					for (const call of message.toolCalls ?? []) blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.args });
					converted.push({ role: "assistant", content: blocks.length ? blocks : [{ type: "text", text: "" }] });
				} else {
					converted.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }] });
				}
			}
			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
				body: JSON.stringify({
					model,
					max_tokens: MAX_TOKENS,
					...(system ? { system } : {}),
					messages: converted,
					...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) } : {}),
					stream: true,
				}),
			});
			if (!res.ok) await fail(res, "Anthropic");

			let text = "";
			const blocks = new Map<number, Acc>();
			for await (const evt of readSse(res)) {
				if (evt.type === "content_block_start") {
					const block = evt.content_block as Record<string, unknown> | undefined;
					if (block?.type === "tool_use") blocks.set(evt.index as number, { id: String(block.id ?? ""), name: String(block.name ?? ""), json: "" });
				} else if (evt.type === "content_block_delta") {
					const delta = evt.delta as Record<string, unknown> | undefined;
					if (delta?.type === "text_delta" && typeof delta.text === "string") {
						text += delta.text;
						onText(delta.text);
					} else if (delta?.type === "input_json_delta") {
						const acc = blocks.get(evt.index as number);
						if (acc && typeof delta.partial_json === "string") acc.json += delta.partial_json;
					}
				} else if (evt.type === "error") {
					const err = evt.error as Record<string, unknown> | undefined;
					throw new Error(`Anthropic stream error: ${String(err?.message ?? "unknown")}`);
				}
			}
			return {
				text,
				toolCalls: [...blocks.values()].map((acc) => ({ id: acc.id, name: acc.name, args: parseArgs(acc.json) })),
			};
		},
	};
}

function openAiCompatibleProvider(id: "openai" | "evren", baseUrl: string, apiKey: string, model: string): Provider {
	return {
		id,
		model,
		async runTurn(messages, tools, onText) {
			const converted: Array<Record<string, unknown>> = [];
			for (const message of messages) {
				if (message.role === "system" || message.role === "user") converted.push({ role: message.role, content: message.content });
				else if (message.role === "assistant") {
					converted.push({
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
				} else converted.push({ role: "tool", tool_call_id: message.toolCallId, content: message.content });
			}
			const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({
					model,
					messages: converted,
					...(tools.length
						? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })) }
						: {}),
					stream: true,
				}),
			});
			if (!res.ok) await fail(res, "OpenAI");

			let text = "";
			const accs = new Map<number, Acc>();
			for await (const chunk of readSse(res)) {
				const choice = (chunk.choices as Array<Record<string, unknown>> | undefined)?.[0];
				const delta = choice?.delta as Record<string, unknown> | undefined;
				if (typeof delta?.content === "string" && delta.content) {
					text += delta.content;
					onText(delta.content);
				}
				for (const call of (delta?.tool_calls as Array<Record<string, unknown>> | undefined) ?? []) {
					const index = (call.index as number) ?? 0;
					const acc = accs.get(index) ?? { id: "", name: "", json: "" };
					if (typeof call.id === "string") acc.id = call.id;
					const fn = call.function as Record<string, unknown> | undefined;
					if (typeof fn?.name === "string") acc.name = fn.name;
					if (typeof fn?.arguments === "string") acc.json += fn.arguments;
					accs.set(index, acc);
				}
			}
			return {
				text,
				toolCalls: [...accs.values()].map((acc, i) => ({ id: acc.id || `call_${i}`, name: acc.name, args: parseArgs(acc.json) })),
			};
		},
	};
}

export interface ProviderConfig {
	provider: string | null;
	model: string | null;
	anthropicApiKey: string | null;
	openaiApiKey: string | null;
	/** OpenAI-compatible (Evren) credentials. */
	evrenApiKey: string | null;
	evrenBaseUrl: string | null;
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export function resolveProvider(config: ProviderConfig): Provider {
	const anthropic = config.anthropicApiKey?.trim() || null;
	const openai = config.openaiApiKey?.trim() || null;
	const evren = config.evrenApiKey?.trim() || null;
	const requested =
		config.provider === "anthropic" || config.provider === "openai" || config.provider === "evren" ? config.provider : null;
	const chosen = requested ?? (anthropic ? "anthropic" : openai ? "openai" : evren ? "evren" : null);
	if (!chosen) {
		throw new Error(
			"Model sağlayıcı yapılandırılmadı. Admin → Eklentiler → Turan AI ayarlarından bir Anthropic, OpenAI veya Evren anahtarı kaydedin.",
		);
	}
	if (chosen === "anthropic") {
		if (!anthropic) throw new Error("Anthropic seçili ama Anthropic API anahtarı yok.");
		return anthropicProvider(anthropic, config.model || DEFAULT_MODELS.anthropic);
	}
	if (chosen === "openai") {
		if (!openai) throw new Error("OpenAI seçili ama OpenAI API anahtarı yok.");
		return openAiCompatibleProvider("openai", OPENAI_BASE_URL, openai, config.model || DEFAULT_MODELS.openai);
	}
	if (!evren) throw new Error("Evren seçili ama Evren API anahtarı yok (EVREN_API_KEY veya ayarlardaki anahtar).");
	return openAiCompatibleProvider(
		"evren",
		config.evrenBaseUrl?.trim() || EVREN_DEFAULT_BASE_URL,
		evren,
		config.model || DEFAULT_MODELS.evren,
	);
}
