/**
 * Locale scope picker state: which locales the agent is allowed to change.
 *
 * Empty selection means "no locale restriction" (the agent decides). A
 * selection is sent with every request as a `[SCOPE]` block, so the agent keeps
 * changes inside those locales (CMS entries, media text) instead of touching
 * the whole site.
 */

import { useCallback, useEffect, useState } from "react";

import type { SiteLocale } from "../../i18n";
import { KEY_LOCALES, localStore } from "../lib/widget-store";

export interface LocaleScopeApi {
	active: string[];
	toggle(code: string): void;
	selectAll(): void;
	clear(): void;
	/** `[SCOPE]` block prepended to outgoing messages ("" when unrestricted). */
	block(): string;
}

const NO_LOCALES: SiteLocale[] = [];

function readStored(): string[] {
	try {
		const raw = localStore(KEY_LOCALES);
		const parsed = raw ? (JSON.parse(raw) as unknown) : [];
		return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
	} catch {
		return [];
	}
}

export function useLocaleScope(available: SiteLocale[] = NO_LOCALES): LocaleScopeApi {
	const [active, setActive] = useState<string[]>(readStored);

	// Drop codes the site no longer configures. Returning the previous array
	// keeps React from re-rendering when nothing changed.
	useEffect(() => {
		if (!available.length) return;
		setActive((previous) => {
			const next = previous.filter((code) => available.some((locale) => locale.code === code));
			return next.length === previous.length ? previous : next;
		});
	}, [available]);

	const persist = useCallback((next: string[]) => {
		setActive(next);
		localStore(KEY_LOCALES, JSON.stringify(next));
	}, []);

	const toggle = useCallback(
		(code: string) => {
			setActive((previous) => {
				// Single-select: one language at a time; clicking it again clears
				// the scope. The active locale drives the preview and the URL field.
				const next = previous[0] === code ? [] : [code];
				localStore(KEY_LOCALES, JSON.stringify(next));
				return next;
			});
		},
		[],
	);

	const selectAll = useCallback(() => {
		if (available.length) persist(available.map((locale) => locale.code));
	}, [available, persist]);

	const clear = useCallback(() => persist([]), [persist]);

	const block = useCallback(() => {
		if (!active.length) return "";
		return [
			"[SCOPE]",
			`Aktif diller: ${active.join(", ")}`,
			"Tüm değişiklikleri yalnızca bu diller için yap: CMS içeriğini o dilde güncelle/oluştur (content_update / content_create + locale, çeviri yoksa translationOf), medya metinlerini media_set_translation ile o dile yaz. Tema kaynak metnini bu diller için topluca değiştirme; yalnızca istenen dile özgü değişiklik yap. Dile özgü yapılamayan bir istek varsa kısaca açıkla ve genel değişiklik yapma.",
		].join("\n");
	}, [active]);

	return { active, toggle, selectAll, clear, block };
}
