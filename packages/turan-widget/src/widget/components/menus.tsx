/** Native-popover menus: model picker, session list and page list. */

import { useCallback, useRef } from "react";

import type { SessionSummary, StatusResponse } from "../../protocol";
import { LANGUAGES, findLanguage } from "../lib/languages";
import { MODELS, type ModelEntry } from "../lib/models";
import { useOnPopoverOpen } from "../lib/popover";
import type { PageItem } from "../lib/types";
import { closeAllPopovers } from "../lib/widget-store";
import { Icon } from "../ui/icons";

export function ModelMenu({
	status,
	model,
	onSelect,
}: {
	status: StatusResponse | null;
	model: ModelEntry;
	onSelect(entry: ModelEntry): void;
}) {
	return (
		<div id="t-model-menu" className="t-menu" popover="auto" role="dialog" aria-label="Choose model">
			<div className="t-mtitle">Model</div>
			{MODELS.map((m) => {
				const off = m.needs !== null && !status?.providers[m.needs];
				return (
					<button
						key={m.id}
						type="button"
						className={`t-opt${m.id === model.id ? " on" : ""}${off ? " off" : ""}`}
						onClick={() => {
							if (off) return;
							onSelect(m);
							closeAllPopovers();
						}}
					>
						<span className="t-item">
							{m.label}
							{off ? " — anahtar yok" : ""}
						</span>
						<span className="t-tick">
							<Icon name="check" />
						</span>
					</button>
				);
			})}
		</div>
	);
}

export function SessionMenu({
	sessions,
	activeId,
	onSelect,
	onNew,
	onOpen,
}: {
	sessions: SessionSummary[];
	activeId: string | null;
	onSelect(id: string): void;
	onNew(): void;
	/** Called whenever the menu opens (refresh the list). */
	onOpen(): void;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	useOnPopoverOpen(ref, useCallback(() => onOpen(), [onOpen]));

	return (
		<div id="t-session-menu" ref={ref} className="t-menu" popover="auto" role="dialog" aria-label="Conversations">
			<div className="t-mtitle">Conversations</div>
			<button
				type="button"
				className="t-opt"
				onClick={() => {
					onNew();
					closeAllPopovers();
				}}
			>
				<span className="t-item">New chat</span>
			</button>
			{sessions.map((s) => (
				<button
					key={s.id}
					type="button"
					className={`t-opt${s.id === activeId ? " on" : ""}`}
					onClick={() => {
						onSelect(s.id);
						closeAllPopovers();
					}}
				>
					<span className="t-item">{s.title}</span>
				</button>
			))}
		</div>
	);
}

export function PagesMenu({	pages,
	openUrls,
	onSelect,
}: {
	pages: PageItem[];
	openUrls: string[];
	onSelect(page: PageItem): void;
}) {
	return (
		<div id="t-page-menu" className="t-menu t-menu-top" popover="auto" role="dialog" aria-label="Pages">
			<div className="t-mtitle">Pages</div>
			{pages.map((p) => {
				const open = openUrls.includes(p.url);
				return (
					<button
						key={p.url}
						type="button"
						className={`t-opt${open ? " on" : ""}`}
						onClick={() => {
							if (!open) onSelect(p);
						}}
					>
						<span className="t-item">{p.title}</span>
						<span className="t-tick">
							<Icon name="check" />
						</span>
					</button>
				);
			})}
		</div>
	);
}

/** Target language + the one-click "translate the theme with AI" action. */
export function LanguageMenu({
	value,
	onSelect,
	onTranslate,
	onTranslateComponents,
	locales,
	onSetDefault,
}: {
	value: string;
	onSelect(code: string): void;
	onTranslate(code: string): void;
	/** Safer, bounded run: only `src/components`. */
	onTranslateComponents(code: string): void;
	/** Site locales (Astro i18n config). */
	locales: Array<{ code: string; label: string; isDefault: boolean }>;
	onSetDefault(code: string): void;
}) {
	const active = findLanguage(value);
	return (
		<div id="t-lang-menu" className="t-menu t-lang-menu" popover="auto" role="dialog" aria-label="Site language and AI translation">
			<div className="t-mtitle">Site language</div>
			{LANGUAGES.map((entry) => (
				<button
					key={entry.code}
					type="button"
					className={`t-opt${entry.code === active.code ? " on" : ""}`}
					onClick={() => {
						onSelect(entry.code);
						closeAllPopovers();
					}}
				>
					<span className="t-item">
						{entry.label}
						<span className="t-langcode">{entry.code.toUpperCase()}</span>
					</span>
					<span className="t-tick">
						<Icon name="check" />
					</span>
				</button>
			))}
			<div className="t-mtitle">AI translation</div>
			<button
				type="button"
				className="t-opt t-opt--go"
				title="The agent translates the theme text in the source files into this language"
				onClick={() => {
					onTranslate(active.code);
					closeAllPopovers();
				}}
			>
				<span className="t-item">Translate the theme into {active.label}</span>
			</button>
			<button
				type="button"
				className="t-opt"
				title="Yalnızca src/components çevrilir; tek turda biter, dosyayı kesme riski düşük"
				onClick={() => {
					onTranslateComponents(active.code);
					closeAllPopovers();
				}}
			>
				<span className="t-item">Translate components only (safe)</span>
			</button>
			<div className="t-mtitle">Default site language</div>
			{locales.map((locale) => (
				<button
					key={locale.code}
					type="button"
					className={`t-opt${locale.isDefault ? " on" : ""}`}
					title={locale.isDefault ? "Already the default (unprefixed) language" : "Make this the default (unprefixed) language"}
					onClick={() => {
						onSetDefault(locale.code);
						closeAllPopovers();
					}}
				>
					<span className="t-item">
						{locale.label} <span className="t-langcode">{locale.code.toUpperCase()}</span>
						{locale.isDefault ? " · default" : ""}
					</span>
				</button>
			))}
		</div>
	);
}
