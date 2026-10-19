/**
 * Client-side locale URL helpers for the canvas bar (no server imports).
 *
 * Mirrors `src/i18n.ts` (server): the default locale is unprefixed, every other
 * locale is prefixed with `/{code}`.
 */

/** Flag emoji per locale; unknown locales fall back to the uppercase code. */
const FLAGS: Record<string, string> = {
	en: "🇬🇧",
	tr: "🇹🇷",
	de: "🇩🇪",
	fr: "🇫🇷",
	es: "🇪🇸",
	it: "🇮🇹",
	pt: "🇵🇹",
	nl: "🇳🇱",
	pl: "🇵🇱",
	ru: "🇷🇺",
	uk: "🇺🇦",
	ar: "🇸🇦",
	fa: "🇮🇷",
	he: "🇮🇱",
	hi: "🇮🇳",
	ja: "🇯🇵",
	ko: "🇰🇷",
	zh: "🇨🇳",
	sv: "🇸🇪",
	no: "🇳🇴",
	da: "🇩🇰",
	fi: "🇫🇮",
	el: "🇬🇷",
	cs: "🇨🇿",
	ro: "🇷🇴",
	hu: "🇭🇺",
	bg: "🇧🇬",
	az: "🇦🇿",
};

export function flagFor(code: string): string {
	return FLAGS[code.toLowerCase()] ?? code.toUpperCase();
}

export function stripLocalePath(path: string, locales: Array<{ code: string; isDefault: boolean }>): string {
	for (const locale of locales) {
		if (locale.isDefault) continue;
		if (path === `/${locale.code}`) return "/";
		if (path.startsWith(`/${locale.code}/`)) return path.slice(locale.code.length + 1);
	}
	return path || "/";
}

export function localeUrlFor(
	path: string,
	code: string,
	locales: Array<{ code: string; isDefault: boolean }>,
): string {
	const clean = stripLocalePath(path, locales);
	const isDefault = locales.find((locale) => locale.isDefault)?.code === code;
	if (isDefault) return clean;
	return clean === "/" ? `/${code}/` : `/${code}${clean}`;
}

/** Locale of the page currently on screen (`/es/...` → es, default otherwise). */
export function localeOfPath(path: string, locales: Array<{ code: string; isDefault: boolean }>): string {
	const match = locales.find(
		(locale) => !locale.isDefault && (path === `/${locale.code}` || path.startsWith(`/${locale.code}/`)),
	);
	return match?.code ?? locales.find((locale) => locale.isDefault)?.code ?? "en";
}
