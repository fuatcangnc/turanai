/**
 * Block Kit views for the sandboxed admin surface. A sandboxed plugin renders
 * declarative blocks, so the chat is a transcript plus a form: every send is a
 * `form_submit` interaction that runs one agent turn and re-renders.
 */

import type { TuranSession } from "./protocol";
import type { ProviderStatus } from "./protocol";

interface Block {
	type: string;
	[key: string]: unknown;
}

function section(text: string): Block {
	return { type: "section", text };
}

export function chatBlocks(session: TuranSession, note?: string): Block[] {
	const blocks: Block[] = [{ type: "header", text: "Turan AI" }];

	if (note) blocks.push(section(`⚠️ ${note}`));
	if (!session.messages.length) {
		blocks.push(
			section(
				"İçerik üzerinde değişiklik isteyin (başlık güncelle, taslak oluştur, yazıları listele). " +
					"Yanıtlar burada görünür; kaydedilen değişiklikler taslak olur ve yayımlamayı siz onaylarsınız.",
			),
		);
	} else {
		for (const message of session.messages.slice(-8)) {
			if (message.role === "user") blocks.push(section(`**Siz:** ${message.text.slice(0, 1200)}`));
			else if (message.role === "assistant") blocks.push(section(`**Turan:** ${message.text.slice(0, 1600)}`));
			else blocks.push({ type: "context", text: `araç · ${message.toolName ?? "?"}: ${message.text.slice(0, 200)}` });
		}
	}

	blocks.push({ type: "divider" });
	blocks.push({
		type: "form",
		block_id: "compose",
		fields: [
			{
				type: "text_input",
				action_id: "message",
				label: "Mesaj",
				multiline: true,
				placeholder: "örn. Merhaba Turan yazısının başlığını kısalt",
			},
		],
		submit: { action_id: "send", label: "Gönder" },
	});
	const lastAssistant = [...session.messages].reverse().find((message) => message.role === "assistant");
	const changeIds = lastAssistant?.changeIds ?? [];
	blocks.push({
		type: "actions",
		elements: [
			{ type: "button", action_id: "reset", label: "Yeni sohbet" },
			...(changeIds.length
				? [{ type: "button", action_id: "undo", label: "↶ Son değişikliği geri al", value: changeIds[changeIds.length - 1] }]
				: []),
		],
	});
	blocks.push({ type: "context", text: `oturum: ${session.id} · ${session.messages.length} mesaj` });
	return blocks;
}

export function statusBlocks(status: ProviderStatus): Block[] {
	const keyState = (ready: boolean) => (ready ? "ayarlı" : "yok");
	return [
		{ type: "header", text: "Turan AI · durum" },
		{
			type: "fields",
			fields: [
				{ label: "Anthropic anahtarı", value: keyState(status.providers.anthropic) },
				{ label: "OpenAI anahtarı", value: keyState(status.providers.openai) },
				{ label: "Sağlayıcı", value: status.provider ?? "auto" },
				{ label: "Model", value: status.model ?? "varsayılan" },
			],
		},
		{
			type: "context",
			text: `izinli ağ adresleri: ${status.hosts.join(", ")} · anahtarlar şifreli olarak saklanır`,
		},
		{ type: "divider" },
		{
			type: "section",
			text:
				"Site widget (optional, trusted)\n" +
				"The in-page widget (drawer, canvas, element picker) cannot be injected by a registry plugin: EmDash only allows page scripts for trusted plugins. Install it as a site dependency:\n" +
				"1) npm i turan-widget\n" +
				"2) astro.config.mjs → import turanWidget from \"turan-widget\"; plugins: [turan, turanWidget()]\n" +
				"No theme edits: the widget injects itself via page:fragments. Without it this admin chat and the MCP tools keep working; alternatively add `import TuranLauncher from \"turan-emdash/launcher.astro\"` to a layout for a small chat panel.",
		},
	];
}
