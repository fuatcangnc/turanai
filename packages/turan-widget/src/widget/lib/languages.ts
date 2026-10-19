/**
 * Target languages for the AI theme translation.
 *
 * The theme keeps a single source language (no runtime i18n layer): the agent
 * rewrites the human-readable strings in the source files with its dev file
 * tools, driven by the plugin's `language` setting and the composer's
 * "AI ile çevir" action. That keeps components plain Astro and makes any
 * language reachable without a build-time dictionary.
 */

export interface LanguageEntry {
	/** BCP-47 code: the plugin setting value and the `<html lang>` value. */
	code: string;
	/** English name used inside the prompt. */
	name: string;
	/** Native label shown in the picker. */
	label: string;
}

export const LANGUAGES: LanguageEntry[] = [
	{ code: "en", name: "English", label: "English" },
	{ code: "tr", name: "Turkish", label: "Türkçe" },
	{ code: "de", name: "German", label: "Deutsch" },
	{ code: "fr", name: "French", label: "Français" },
	{ code: "es", name: "Spanish", label: "Español" },
];

export const DEFAULT_LANGUAGE = "en";

/** One-click translation of the current selection into the page's locale. */
export function quickTranslatePrompt(locale: string, label: string, path: string): string {
	return [
		"[QUICK TRANSLATE]",
		`Target locale: ${locale} (${label}) · page: ${path}`,
		`Translate the selected text/element into ${label} so it is shown only on ${locale} pages.`,
		"For theme source text: make it locale-conditional (e.g. Astro.currentLocale check) without changing the other locales.",
		`For CMS content: use the ${locale} entry (create with translationOf when missing) and publish it.`,
		"Do not translate the whole theme; reply with one short summary line (in English).",
	].join("\n");
}

export function findLanguage(code: string | null | undefined): LanguageEntry {
	return LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0]!;
}

/**
 * Prompt sent as a normal user message. It is deliberately explicit: the agent
 * must translate text without touching code, keys or routes.
 */
export function translationPrompt(language: LanguageEntry, scope = "the theme"): string {
	return [
		`Translate ${scope}'s user-facing text into ${language.name} (${language.code}).`,
		"",
		"Files to cover: src/layouts, src/components, src/pages, src/data/site-settings.json and shared copy in src/data/site.ts.",
		"Rules:",
		"- Change only human-readable strings: labels, headings, paragraphs, placeholders, aria-labels, titles, button text, meta descriptions.",
		"- Never rename identifiers, props, CSS classes, data keys, file names, routes, slugs or JSON keys.",
		"- Keep brand and personal names, phone numbers, e-mail addresses, SKUs and URLs unchanged.",
		"- Preserve the markup, formatting, quotes and indentation exactly as they are.",
		"- NEVER rewrite a whole file with write_file. Use edit_file with one exact oldString per string (several small edits are fine). A rewrite risks truncating the file, which already happened once.",
		"- After editing a file, read it back and confirm it still ends exactly like before (same last lines, no missing blocks). If a file looks shorter than before, restore it immediately and report it.",
		"- Translate the files completely before moving to the next one; if you run low on room, stop and list what is still pending instead of leaving a file half-changed.",
		`- Set <html lang="${language.code}"> in src/layouts/Layout.astro.`,
		`- Leave strings that are already in ${language.name} untouched.`,
		"- Do not touch src/content/** or EmDash entries: this is theme source text only.",
		"- Media: translate image `alt` text and captions too. Call media_list first, then media_set_translation for each target locale (alt + caption). For localized PDFs or images that contain text, point `localizedUrl` at that locale's file.",
		"- Do not ask for confirmation. When you are done, reply with a one-line summary plus the list of files you changed.",
	].join("\n");
}
