/**
 * Translation lists panel: dynamic Text / Media overview per locale.
 *
 * Text rows come from the CMS (entries of the selected locale); media rows merge
 * the media library with the plugin's per-locale records. Both are searchable,
 * filterable and can hand a scoped prompt to the agent.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { TranslationLocale, TranslationMediaRow, TranslationsResponse } from "../../protocol";
import { api } from "../api";
import { flagFor } from "../lib/locale-url";
import { Icon } from "../ui/icons";

export interface TranslationListProps {
	open: boolean;
	onClose(): void;
	locales: TranslationLocale[];
	/** Current canvas page path (kept in prompts for context). */
	here: string;
	/** Hand a scoped prompt to the agent. */
	onTranslate(prompt: string): void;
}

function textPrompt(collection: string, slug: string | null, locale: string, here: string): string {
	return [
		"[SCOPE]",
		`Aktif diller: ${locale}`,
		`Şu kaydı yalnızca ${locale} için çevir: ${collection}/${slug ?? "(slug yok)"} (sayfa: ${here}).`,
		"Başlık, özet ve gövdeyi çevir; başka dile dokunma. Çeviri yoksa translationOf ile oluştur ve yayımla. Bitince tek satır özet ver.",
	].join("\n");
}

function mediaPrompt(url: string, locale: string): string {
	return [
		"[SCOPE]",
		`Aktif diller: ${locale}`,
		`Şu medya için ${locale} alt metni ve caption'ı çevir / dosya varyantını eşle: ${url}`,
		"media_set_translation kullan; başka dile dokunma.",
	].join("\n");
}

function pendingPrompt(rows: Array<{ collection: string; slug: string | null }>, locale: string): string {
	const list = rows.map((row) => `- ${row.collection}/${row.slug ?? "(slug yok)"}`).join("\n");
	return [
		"[SCOPE]",
		`Aktif diller: ${locale}`,
		`Şu kayıtların ${locale} çevirisi yok; her biri için çeviri oluştur (translationOf), içeriği çevir ve yayımla:`,
		list,
		"Başka dile dokunma; bitince kaç kayıt oluşturduğunu tek satırda söyle.",
	].join("\n");
}

function MediaRow({
	row,
	locale,
	onTranslated,
	onTranslate,
}: {
	row: TranslationMediaRow;
	locale: string;
	onTranslated(): void;
	onTranslate(prompt: string): void;
}) {
	const [alt, setAlt] = useState(row.alt ?? "");
	const [caption, setCaption] = useState(row.caption ?? "");
	const [localizedUrl, setLocalizedUrl] = useState(row.localizedUrl ?? "");
	const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

	const save = async () => {
		setState("saving");
		try {
			await api.mediaSet({
				mediaId: row.mediaId,
				locale,
				url: row.url,
				alt: alt || null,
				caption: caption || null,
				localizedUrl: localizedUrl || null,
			});
			setState("saved");
			onTranslated();
		} catch {
			setState("error");
		}
	};

	return (
		<div className="t-tl-media">
			<div className="t-tl-media-head">
				<code title={row.url}>{row.url}</code>
				{row.translated ? <span className="t-tl-badge">translated</span> : null}
			</div>
			<div className="t-tl-media-grid">
				<label>
					<span>File (localized)</span>
					<input value={localizedUrl} onChange={(e) => setLocalizedUrl(e.target.value)} placeholder="/uploads/…pdf" />
				</label>
				<label>
					<span>Alt</span>
					<input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt metni" />
				</label>
				<label>
					<span>Caption</span>
					<input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
				</label>
			</div>
			<div className="t-tl-media-actions">
				<button type="button" className="t-tl-save" onClick={save} disabled={state === "saving"}>
					{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Error" : "Save"}
				</button>
				<button type="button" className="t-tl-ai" title="AI ile bu medyanın alt/caption metnini çevir" onClick={() => onTranslate(mediaPrompt(row.url, locale))}>
					<Icon name="spark" /> Translate with AI
				</button>
			</div>
		</div>
	);
}

export function TranslationList({ open, onClose, locales, here, onTranslate }: TranslationListProps) {
	const [tab, setTab] = useState<"text" | "media">("text");
	const [locale, setLocale] = useState(locales.find((l) => l.isDefault)?.code ?? locales[0]?.code ?? "en");
	const [query, setQuery] = useState("");
	const [collection, setCollection] = useState("all");
	const [data, setData] = useState<TranslationsResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [nonce, setNonce] = useState(0);
	const panelRef = useRef<HTMLDivElement | null>(null);

	// Dialog behaviour: move focus in, close on Escape, keep Tab inside, and
	// restore focus to the trigger when the panel closes.
	useEffect(() => {
		if (!open) return;
		const previous = document.activeElement as HTMLElement | null;
		const panel = panelRef.current;
		const focusables = () =>
			Array.from(
				panel?.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				) ?? [],
			).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
		focusables()[0]?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const items = focusables();
			if (!items.length) return;
			const first = items[0]!;
			const last = items[items.length - 1]!;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			// Return focus to whatever opened the panel; fall back to the trigger.
			const target = previous && previous !== document.body ? previous : document.querySelector<HTMLElement>(".t-tlbtn");
			target?.focus?.();
		};
	}, [open, onClose]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setLoading(true);
		setError("");
		api
			.translations(locale)
			.then((next) => {
				if (!cancelled) setData(next);
			})
			.catch((err: Error) => {
				if (!cancelled) setError(err.message);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, locale, nonce]);

	const needle = query.trim().toLowerCase();
	const textRows = useMemo(
		() =>
			(data?.text ?? []).filter(
				(row) =>
					(collection === "all" || row.collection === collection) &&
					(!needle || `${row.title} ${row.slug ?? ""} ${row.collection}`.toLowerCase().includes(needle)),
			),
		[data, collection, needle],
	);
	const mediaRows = useMemo(
		() =>
			(data?.media ?? []).filter(
				(row) => !needle || `${row.url} ${row.localizedUrl ?? ""} ${row.alt ?? ""}`.toLowerCase().includes(needle),
			),
		[data, needle],
	);

	if (!open) return null;
	const mediaCount = data?.media.length ?? 0;
	const newBadge = (data?.media ?? []).some((row) => !row.translated);

	const togglePublish = async (row: { collection: string; id: string; status: string }) => {
		try {
			await api.translationsPublish({ collection: row.collection, id: row.id, publish: row.status !== "published" });
			setNonce((n) => n + 1);
		} catch (err) {
			setError((err as Error).message);
		}
	};

	return (
		<>
			<div className="t-tl-backdrop" onClick={onClose} aria-hidden="true" />
			<div
				ref={panelRef}
				className="t-tl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="t-tl-title"
			>
				<div className="t-tl-head">
					<h2 id="t-tl-title">Translations list</h2>
				<button type="button" className="t-lclear" aria-label="Close" onClick={onClose}>
					<Icon name="close" />
				</button>
			</div>

			<div className="t-tl-tabs" role="tablist" aria-label="Translation type">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "text"}
					className={`t-tl-tab${tab === "text" ? " on" : ""}`}
					onClick={() => setTab("text")}
				>
					<Icon name="pencil" /> Text <span className="t-tl-count">{data?.text.length ?? 0}</span>
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "media"}
					className={`t-tl-tab${tab === "media" ? " on" : ""}`}
					onClick={() => setTab("media")}
				>
					<Icon name="globe" /> Media <span className="t-tl-count">{mediaCount}</span>
					{newBadge ? <span className="t-tl-new">NEW</span> : null}
				</button>
			</div>

			<div className="t-tl-bar">
				<input
					className="t-tl-search"
					type="search"
					placeholder="Search a translation…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					aria-label="Search translations"
				/>
				<select className="t-tl-select" value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Language">
					{locales.map((entry) => (
						<option key={entry.code} value={entry.code}>
							{flagFor(entry.code)} {entry.label}
						</option>
					))}
				</select>
				<select
					className="t-tl-select"
					value={collection}
					onChange={(e) => setCollection(e.target.value)}
					aria-label="Collection"
					disabled={tab === "media"}
				>
					<option value="all">All collections</option>
					{(data?.collections ?? []).map((slug) => (
						<option key={slug} value={slug}>
							{slug}
						</option>
					))}
				</select>
				<button type="button" className="t-lclear" title="Refresh" aria-label="Refresh" onClick={() => setNonce((n) => n + 1)}>
					<Icon name="reload" />
				</button>
				<span className="t-tl-results">{tab === "text" ? textRows.length : mediaRows.length} sonuç</span>
			</div>

			{error ? <p className="t-tl-error">{error}</p> : null}

			{data && data.pending.length > 0 ? (
				<div className="t-tl-pending">
					<span>
						{data.pending.length} rows have no translation in this language (auto-detected)
					</span>
					<button type="button" className="t-tl-ai" onClick={() => onTranslate(pendingPrompt(data.pending, locale))}>
						<Icon name="spark" /> Translate all with AI
					</button>
				</div>
			) : null}

			<div className="t-tl-body">
				{loading ? <p className="t-tl-empty">Loading…</p> : null}
				{!loading && tab === "text" && textRows.length === 0 ? <p className="t-tl-empty">No content in this language.</p> : null}
				{!loading && tab === "media" && mediaRows.length === 0 ? <p className="t-tl-empty">No media translations for this language.</p> : null}

				{tab === "text"
					? textRows.map((row) => (
							<div className="t-tl-row" key={`${row.collection}:${row.id}`}>
								<span className="t-tl-col">{row.collection}</span>
								<span className="t-tl-slug" title={row.slug ?? row.id}>{row.slug ?? row.id}</span>
								<span className="t-tl-title">{row.title || "—"}</span>
								<button
									type="button"
									className={`t-tl-status${row.status === "published" ? " ok" : ""}`}
									title="Per-language publish state — click to toggle"
									onClick={() => togglePublish(row)}
								>
									{row.status === "published" ? "Published" : "Draft"}
								</button>
								<button
									type="button"
									className="t-tl-ai"
									title="Translate this entry into the selected language with AI"
									onClick={() => onTranslate(textPrompt(row.collection, row.slug, locale, here))}
								>
									<Icon name="spark" /> Çevir
								</button>
							</div>
						))
					: mediaRows.map((row) => (
							<MediaRow
								key={row.mediaId}
								row={row}
								locale={locale}
								onTranslated={() => setNonce((n) => n + 1)}
								onTranslate={onTranslate}
							/>
						))}
			</div>
		</div>
		</>
	);
}
