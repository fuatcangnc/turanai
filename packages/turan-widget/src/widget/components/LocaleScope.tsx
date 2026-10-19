/**
 * Canvas toolbar language scope: one pill per locale (flag + language name),
 * plus the URL that locale resolves to for the current page.
 *
 * Clicking a pill toggles that locale for the agent (select/deselect), so the
 * selection is visible at a glance. No selection means "no restriction".
 */

import { useEffect, useRef } from "react";

import type { SiteLocale } from "../../i18n";
import { flagFor, localeUrlFor } from "../lib/locale-url";
import { Icon } from "../ui/icons";

export interface LocaleScopeProps {
	locales: SiteLocale[];
	active: string[];
	/** Current canvas page path (may already carry a locale prefix). */
	here: string;
	onToggle(code: string): void;
	onClear(): void;
}

export function LocaleScope({ locales, active, here, onToggle, onClear }: LocaleScopeProps) {
	const rowRef = useRef<HTMLDivElement | null>(null);
	// Keep the selected chip in view when the row scrolls.
	useEffect(() => {
		const row = rowRef.current;
		const pressed = row?.querySelector<HTMLElement>(".t-lchip[aria-pressed='true']");
		if (!row || !pressed) return;
		const rowBox = row.getBoundingClientRect();
		const chipBox = pressed.getBoundingClientRect();
		if (chipBox.left < rowBox.left) row.scrollLeft -= rowBox.left - chipBox.left + 6;
		else if (chipBox.right > rowBox.right) row.scrollLeft += chipBox.right - rowBox.right + 6;
	}, [active]);

	if (locales.length < 2) return null;
	const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]!.code;
	// URL field = the page actually on screen; the chips are the AI scope.
	const pageLocale =
		locales.find(
			(locale) => !locale.isDefault && (here === `/${locale.code}` || here.startsWith(`/${locale.code}/`)),
		)?.code ?? defaultCode;
	const scopePrimary = active[0];
	const scopeLabel = scopePrimary
		? (locales.find((locale) => locale.code === scopePrimary)?.label ?? scopePrimary.toUpperCase())
		: null;
	const showScope = Boolean(scopeLabel && scopePrimary !== pageLocale);
	const path = localeUrlFor(here, pageLocale, locales);
	const origin = typeof window === "undefined" ? "" : window.location.origin;
	const url = `${origin}${path}`;

	return (
		<>
			<div ref={rowRef} className="t-locales" role="group" aria-label="Languages for AI changes">
				{locales.map((locale) => {
					const on = active.includes(locale.code);
					return (
						<button
							key={locale.code}
							type="button"
							className={`t-lchip${on ? " on" : ""}`}
							aria-pressed={on}
							title={`${locale.label}${on ? " · the AI also changes this language" : " · add this language to the scope"}`}
							onClick={() => onToggle(locale.code)}
						>
							<span className="t-lflag" aria-hidden="true">{flagFor(locale.code)}</span>
							<span>{locale.label}</span>
						</button>
					);
				})}
				{active.length ? (
					<button
						type="button"
						className="t-lclear"
						title="Clear the language scope (no restriction)"
						aria-label="Clear the language scope"
						onClick={onClear}
					>
						<Icon name="close" />
					</button>
				) : null}
			</div>
			<output
				className="t-lurl"
				title={`Page shown: ${url}${showScope ? ` · AI scope: ${scopeLabel}` : ""}`}
				aria-label={`Page URL: ${url}`}
			>
				{url}
			</output>
			{showScope ? (
				<span className="t-lurl-scope" title={`AI yalnızca ${scopeLabel} için değişiklik yapar; görüntülenen sayfa farklı dilde`}>
					AI: {scopeLabel}
				</span>
			) : null}
		</>
	);
}
