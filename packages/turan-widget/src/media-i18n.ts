/**
 * Media internationalization.
 *
 * EmDash stores a single `alt`/`caption` per media item, so localized values
 * live in the plugin KV (`mediai18n:<mediaId>:<locale>`) and are applied at
 * runtime by a small injected script — no theme edits required:
 *
 *  - `<img src>`             → localized `alt`
 *  - `<figure><figcaption>`  → replaces the original caption text (only when it
 *                              matches the caption stored at save time)
 *  - `<a href="….pdf">`      → per-locale file variant (`localizedUrl`), which
 *                              also covers localized PDFs and images
 *
 * Records are keyed by asset URL, so static files outside the media library
 * (public images, PDFs) are supported too.
 */

export interface MediaI18nRecord {
	/** Media item id, or `static:<name>` for an asset outside the library. */
	mediaId: string;
	locale: string;
	/** Original asset URL the record applies to. */
	url: string;
	alt?: string | null;
	caption?: string | null;
	/** Caption text at save time; used for the safe figcaption text match. */
	sourceCaption?: string | null;
	/** Alternative file for this locale (localized PDF or image). */
	localizedUrl?: string | null;
	updatedAt: string;
}

export const MEDIA_PREFIX = "mediai18n:";

export const mediaKey = (mediaId: string, locale: string) => `${MEDIA_PREFIX}${mediaId}:${locale}`;

/** Pathname form of a URL, without a trailing slash. */
export function normalizeUrl(url: string): string {
	try {
		const pathname = new URL(url, "http://local").pathname;
		return pathname.replace(/\/+$/, "") || "/";
	} catch {
		return url;
	}
}

export interface MediaMapEntry {
	alt?: string | null;
	caption?: string | null;
	sourceCaption?: string | null;
	localizedUrl?: string | null;
}

/** Records for one locale, keyed by normalized asset URL and by basename. */
export async function mediaMapFor(
	kv: { list(prefix?: string): Promise<Array<{ key: string; value: unknown }>> },
	locale: string,
): Promise<Record<string, MediaMapEntry>> {
	const map: Record<string, MediaMapEntry> = {};
	for (const entry of await kv.list(MEDIA_PREFIX)) {
		const record = entry.value as MediaI18nRecord | null;
		if (!record || record.locale !== locale || !record.url) continue;
		const value: MediaMapEntry = {
			alt: record.alt ?? null,
			caption: record.caption ?? null,
			sourceCaption: record.sourceCaption ?? null,
			localizedUrl: record.localizedUrl ?? null,
		};
		const pathname = normalizeUrl(record.url);
		map[pathname] = value;
		// Astro rewrites optimized images to `/_image?href=…`; the basename keeps
		// the record matchable after the optimizer changes the rendered URL.
		const basename = pathname.split("/").pop();
		if (basename) map[basename] = value;
	}
	return map;
}

/**
 * Save (or replace) one locale record. The media item supplies the canonical
 * URL and the source caption used for the safe figcaption match; static assets
 * pass `url` explicitly.
 */
export async function setMediaRecord(
	kv: { set(key: string, value: unknown): Promise<void> },
	media: { get(id: string): Promise<{ url: string; caption?: string | null } | null> } | undefined,
	input: {
		mediaId: string;
		locale: string;
		alt?: string | null;
		caption?: string | null;
		url?: string;
		localizedUrl?: string | null;
	},
): Promise<MediaI18nRecord> {
	const item = media && !input.mediaId.startsWith("static:") ? await media.get(input.mediaId) : null;
	const url = input.url ?? item?.url;
	if (!url) throw new Error("Medya bulunamadı; statik varlıklar için `url` verin.");
	const record: MediaI18nRecord = {
		mediaId: input.mediaId,
		locale: input.locale,
		url,
		alt: input.alt ?? null,
		caption: input.caption ?? null,
		sourceCaption: item?.caption ?? null,
		localizedUrl: input.localizedUrl ?? null,
		updatedAt: new Date().toISOString(),
	};
	await kv.set(mediaKey(input.mediaId, input.locale), record);
	return record;
}

/**
 * Runtime applier: rewrites alt text, captions and file links on the rendered
 * page. Values are embedded with `<` escaped so a string cannot close the
 * script tag.
 */
export function mediaMapHtml(map: Record<string, MediaMapEntry>): string {
	if (!Object.keys(map).length) return "";
	const json = JSON.stringify(map).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
	return `<script>(function(){var map=${json};if(!map||!Object.keys(map).length)return;
function norm(u){try{var p=new URL(u,location.href).pathname;return p.replace(/\\/+$/,"")||"/";}catch(e){return u;}}
function base(u){try{var n=norm(u);return n.split("/").pop()||"";}catch(e){return "";}}
function candidates(u){var out=[];if(!u)return out;var n=norm(u);out.push(n,n.split("/").pop()||"");
try{var d=decodeURIComponent(u);if(d!==u){var dn=norm(d);out.push(dn,dn.split("/").pop()||"");}}catch(e){}
try{var p=new URL(u,location.href);var h=p.searchParams.get("href");if(h){var hd=decodeURIComponent(h);var hn=norm(hd);out.push(hn,hn.split("/").pop()||"");}}catch(e){}
return out;}
function find(u){var c=candidates(u);for(var i=0;i<c.length;i++){if(c[i]&&map[c[i]])return map[c[i]];}return null;}
document.querySelectorAll("img[src]").forEach(function(img){var rec=find(img.getAttribute("src"))||find(img.currentSrc);
if(rec&&rec.alt)img.setAttribute("alt",rec.alt);});
document.querySelectorAll("figure").forEach(function(fig){var img=fig.querySelector("img[src]"),cap=fig.querySelector("figcaption");
if(!img||!cap)return;var rec=find(img.getAttribute("src"));if(!rec||!rec.caption)return;
var text=(cap.textContent||"").trim();if(rec.sourceCaption&&text===rec.sourceCaption.trim())cap.textContent=rec.caption;});
document.querySelectorAll("a[href]").forEach(function(a){var rec=find(a.getAttribute("href"));
if(rec&&rec.localizedUrl)a.setAttribute("href",rec.localizedUrl);});
})();</script>`;
}
