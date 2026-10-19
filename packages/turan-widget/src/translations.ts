/**
 * Translation list data for the widget panel.
 *
 * Two dynamic sources:
 *  - Text: content entries that exist in the selected locale (schema → collections
 *    → entries), so the list reflects the CMS as it is right now.
 *  - Media: the media library merged with the plugin's per-locale records
 *    (`mediai18n:<id>:<locale>`), plus static assets mapped by URL.
 */

import type { PluginContext } from "emdash/plugin";

import { MEDIA_PREFIX, type MediaI18nRecord } from "./media-i18n";
import type { TranslationMediaRow, TranslationPendingRow, TranslationTextRow } from "./protocol";

function titleOf(data: unknown): string {
	if (!data || typeof data !== "object") return "";
	const title = (data as { title?: unknown }).title;
	return typeof title === "string" ? title : "";
}

export async function listTranslations(
	ctx: PluginContext,
	locale: string,
	defaultLocale: string,
): Promise<{ collections: string[]; media: TranslationMediaRow[]; text: TranslationTextRow[]; pending: TranslationPendingRow[] }> {
	const records = (await ctx.kv.list(MEDIA_PREFIX))
		.map((entry) => entry.value as MediaI18nRecord | null)
		.filter((record): record is MediaI18nRecord => Boolean(record?.mediaId && record.locale === locale));
	const recordByMedia = new Map(records.map((record) => [record.mediaId, record]));

	const media: TranslationMediaRow[] = [];
	if (ctx.media) {
		const result = await ctx.media.list({ limit: 60 });
		const items = Array.isArray(result) ? result : ((result as { items?: unknown[] }).items ?? []);
		for (const raw of items) {
			const item = raw as { id: string; filename?: string; url: string; alt?: string | null; caption?: string | null };
			const record = recordByMedia.get(item.id);
			media.push({
				mediaId: item.id,
				url: item.url,
				filename: item.filename ?? null,
				alt: record?.alt ?? item.alt ?? null,
				caption: record?.caption ?? item.caption ?? null,
				localizedUrl: record?.localizedUrl ?? null,
				translated: Boolean(record),
			});
		}
	}
	// Static assets mapped by URL (not in the media library).
	for (const record of records) {
		if (!record.mediaId.startsWith("static:")) continue;
		media.push({
			mediaId: record.mediaId,
			url: record.url,
			filename: record.mediaId.slice("static:".length),
			alt: record.alt ?? null,
			caption: record.caption ?? null,
			localizedUrl: record.localizedUrl ?? null,
			translated: true,
		});
	}

	const text: TranslationTextRow[] = [];
	const collections: string[] = [];
	if (ctx.schema) {
		const schemas = await ctx.schema.listCollections();
		for (const schema of schemas.slice(0, 8)) {
			collections.push(schema.slug);
			try {
				const page = await ctx.content!.list(schema.slug, { where: { locale }, limit: 50 });
				const items = Array.isArray(page) ? page : ((page as { items?: unknown[] }).items ?? []);
				for (const raw of items) {
					const item = raw as { id: string; slug?: string | null; status?: string; data?: unknown };
					text.push({
						collection: schema.slug,
						id: item.id,
						slug: item.slug ?? null,
						title: titleOf(item.data),
						status: item.status ?? "unknown",
					});
				}
			} catch {
				// A collection without entries for this locale simply contributes none.
			}
		}
	}

	return { collections, media, text, pending: await pendingFor(ctx, defaultLocale, locale, collections) };
}

/**
 * Automatic sync detection: default-locale entries that have no translation in
 * the selected locale. Computed on every list request, so newly published
 * content shows up without a separate queue table.
 */
async function pendingFor(
	ctx: PluginContext,
	defaultLocale: string,
	locale: string,
	collections: string[],
): Promise<TranslationPendingRow[]> {
	if (defaultLocale === locale || !ctx.content?.getTranslations) return [];
	const pending: TranslationPendingRow[] = [];
	for (const slug of collections) {
		try {
			const page = await ctx.content.list(slug, { where: { locale: defaultLocale }, limit: 50 });
			const items = Array.isArray(page) ? page : ((page as { items?: unknown[] }).items ?? []);
			for (const raw of items) {
				const item = raw as { id: string; slug?: string | null; data?: unknown };
				const { translations } = await ctx.content.getTranslations(slug, item.id);
				if (translations.some((translation) => translation.locale === locale)) continue;
				pending.push({
					collection: slug,
					id: item.id,
					slug: item.slug ?? null,
					title: titleOf(item.data),
					locale,
				});
			}
		} catch {
			// ignore collections that cannot be listed
		}
	}
	return pending;
}
