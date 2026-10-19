/**
 * Theme-agnostic language layer.
 *
 * The single source of truth is the site's Astro `i18n` block — the same one
 * EmDash reads (`getI18nConfig()`). Nothing is duplicated in plugin storage and
 * no theme markup is required:
 *
 *  - `page:metadata` contributes `<link rel="alternate" hreflang>` for pages
 *    EmDashHead does not already cover (pages without CMS content).
 *  - `page:fragments` injects a self-mounting `<turan-lang-switcher>` that moves
 *    itself into the page header (or floats as a last resort), so any Astro
 *    theme gets a working switcher without edits.
 */

import { getI18nConfig } from "emdash";

export interface SiteLocale {
	code: string;
	/** Native language name (Intl.DisplayNames), e.g. "Türkçe". */
	label: string;
	isDefault: boolean;
}

function labelFor(code: string): string {
	try {
		const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
		if (!name) return code.toUpperCase();
		return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
	} catch {
		return code.toUpperCase();
	}
}

/** Locales from the Astro i18n config; empty when i18n is disabled. */
export function siteLocales(): SiteLocale[] {
	let config: { defaultLocale?: string; locales?: string[] } | null = null;
	try {
		config = getI18nConfig() as { defaultLocale?: string; locales?: string[] } | null;
	} catch {
		config = null;
	}
	const defaultLocale = config?.defaultLocale ?? "en";
	const codes = [...new Set((config?.locales ?? []).filter(Boolean))];
	return codes.map((code) => ({ code, label: labelFor(code), isDefault: code === defaultLocale }));
}

export function defaultCode(locales: SiteLocale[], fallback = "en"): string {
	return locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? fallback;
}

/** Remove a non-default locale prefix from a pathname (`/en/blog` → `/blog`). */
export function stripLocale(path: string, locales: SiteLocale[]): string {
	for (const locale of locales) {
		if (locale.isDefault) continue;
		if (path === `/${locale.code}`) return "/";
		if (path.startsWith(`/${locale.code}/`)) return path.slice(locale.code.length + 1);
	}
	return path || "/";
}

/** `/en/blog` for non-default locales, `/blog` for the default one. */
export function localePath(path: string, code: string, locales: SiteLocale[]): string {
	if (code === defaultCode(locales)) return path || "/";
	return path === "/" ? `/${code}/` : `/${code}${path}`;
}

/** JSON that is safe inside an inline <script>. */
function safeJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
}

/**
 * Switcher markup: an empty custom element plus a tiny bootstrap. The theme may
 * place its own `<turan-lang-switcher>`; ours removes itself in that case.
 *
 * `hrefByLocale` carries translation-group URLs (content pages) so a language
 * link points at that locale's own slug; locales without a published
 * translation fall back to the default entry's path with their prefix.
 */
export function switcherHtml(
	page: { path: string; locale: string | null },
	locales: SiteLocale[],
	hrefByLocale: Record<string, string> = {},
): string {
	const defaultLocale = defaultCode(locales);
	const current = page.locale && locales.some((locale) => locale.code === page.locale) ? page.locale : defaultLocale;
	const clean = stripLocale(page.path || "/", locales);
	const toPath = (url: string) => {
		if (!/^https?:\/\//.test(url)) return url.startsWith("/") ? url : `/${url}`;
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.search}`;
	};
	const defaultPath = hrefByLocale[defaultLocale] ? toPath(hrefByLocale[defaultLocale]!) : clean;
	const items = locales.map((locale) => ({
		code: locale.code,
		label: locale.label,
		href: hrefByLocale[locale.code]
			? toPath(hrefByLocale[locale.code]!)
			: localePath(defaultPath, locale.code, locales),
	}));
	const config = safeJson({ current, items });

	return `<turan-lang-switcher id="turan-lang-switcher" data-turan-lang-switcher="1"></turan-lang-switcher>
<script>(function(){var cfg=${config};var host=document.getElementById("turan-lang-switcher");if(!host)return;
if(document.querySelector("turan-lang-switcher:not([data-turan-lang-switcher])")){host.remove();return;}
var nav=document.createElement("nav");nav.className="turan-ls";nav.setAttribute("aria-label","Language");
cfg.items.forEach(function(it){var a=document.createElement("a");a.href=it.href;a.hreflang=it.code;a.lang=it.code;
a.className="turan-ls-link";a.title=it.label;a.setAttribute("aria-label",it.label);a.textContent=it.code.toUpperCase();
if(it.code===cfg.current)a.setAttribute("aria-current","page");nav.appendChild(a);});
host.appendChild(nav);
var slot=document.querySelector("header,[role=banner],#site-header,.site-header");
if(slot){slot.appendChild(host);}else{host.classList.add("turan-ls--fixed");document.body.appendChild(host);}
})();</script>
<style>
turan-lang-switcher{display:inline-flex;align-items:center;vertical-align:middle}
turan-lang-switcher.turan-ls--fixed{position:fixed;top:12px;right:12px;z-index:2147482000;padding:3px;border-radius:999px;background:rgba(17,17,16,.62);backdrop-filter:blur(6px)}
.turan-ls{display:inline-flex;align-items:center;gap:1px}
.turan-ls-link{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 7px;border-radius:999px;
font:700 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em;text-decoration:none;color:inherit;opacity:.62;transition:opacity .15s ease,background-color .15s ease}
.turan-ls-link:hover{opacity:1;background:color-mix(in oklab,currentColor 14%,transparent)}
.turan-ls-link[aria-current="page"]{opacity:1;background:color-mix(in oklab,currentColor 16%,transparent)}
turan-lang-switcher.turan-ls--fixed .turan-ls-link{color:#fff}
</style>`;
}
