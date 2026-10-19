/** Model catalogue for the picker (provider + model + required key). */

export interface ModelEntry {
	id: string;
	provider: "anthropic" | "openai" | "evren" | null;
	model: string | null;
	label: string;
	/** Provider whose API key must exist for this entry to be selectable. */
	needs: "anthropic" | "openai" | "evren" | null;
}

export const MODELS: ModelEntry[] = [
	{ id: "auto", provider: null, model: null, label: "Auto", needs: null },
	{ id: "claude-sonnet-4-5", provider: "anthropic", model: "claude-sonnet-4-5", label: "Claude · Sonnet 4.5", needs: "anthropic" },
	{ id: "claude-opus-4-1", provider: "anthropic", model: "claude-opus-4-1", label: "Claude · Opus 4.1", needs: "anthropic" },
	{ id: "claude-haiku-4-5", provider: "anthropic", model: "claude-haiku-4-5", label: "Claude · Haiku 4.5", needs: "anthropic" },
	{ id: "gpt-4.1-mini", provider: "openai", model: "gpt-4.1-mini", label: "GPT · 4.1 mini", needs: "openai" },
	{ id: "gpt-4.1", provider: "openai", model: "gpt-4.1", label: "GPT · 4.1", needs: "openai" },
	// Test entry: Evren's OpenAI-compatible gateway.
	{ id: "evren-deepseek-v4.1-flash", provider: "evren", model: "deepseek-v4.1-flash", label: "Evren · DeepSeek V4.1 Flash", needs: "evren" },
];

export const DEFAULT_MODEL: ModelEntry = MODELS[0]!;

export function findModel(id: string | null): ModelEntry {
	return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}
