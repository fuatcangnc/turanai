/**
 * Widget composition root.
 *
 * Keeps no UI of its own: it wires the hooks (windows, selection, chat,
 * sidebar) and renders the component modules. Everything visible lives in
 * `./components/*`, all behaviour in `./hooks/*`, constants in `./lib/*`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StatusResponse } from "../protocol";
import { api } from "./api";
import { Canvas } from "./components/Canvas";
import { CanvasBars } from "./components/CanvasBars";
import { Drawer } from "./components/Drawer";
import { Launcher } from "./components/Launcher";
import { ModelMenu, LanguageMenu, PagesMenu, SessionMenu } from "./components/menus";
import { PageSwitcher } from "./components/PageSwitcher";
import { useChat } from "./hooks/useChat";
import { useLocaleScope } from "./hooks/useLocaleScope";
import { useSelection } from "./hooks/useSelection";
import { useSidebar } from "./hooks/useSidebar";
import { useWindows } from "./hooks/useWindows";
import { TranslationList } from "./components/TranslationList";
import { DEFAULT_LANGUAGE, findLanguage, quickTranslatePrompt, translationPrompt } from "./lib/languages";
import { localeOfPath, localeUrlFor } from "./lib/locale-url";
import { findModel, type ModelEntry } from "./lib/models";
import { KEY_LANG, KEY_MODEL, KEY_OPEN, localStore, navigateTo, refreshWindows, sessionStore } from "./lib/widget-store";
import { injectStyles } from "./styles";

export function App() {
	const here = window.location.pathname;
	const [open, setOpen] = useState(() => sessionStore(KEY_OPEN) === "1");
	const [ready, setReady] = useState(false);
	const [status, setStatus] = useState<StatusResponse | null>(null);
	const [model, setModel] = useState<ModelEntry>(() => findModel(localStore(KEY_MODEL)));
	/** Target language of the AI theme translation (plugin setting default). */
	const [lang, setLang] = useState<string>(() => localStore(KEY_LANG) ?? DEFAULT_LANGUAGE);
	const [translationsOpen, setTranslationsOpen] = useState(false);
	/** Locale URL shown in the live preview; the host page itself is not reloaded. */
	const [previewPath, setPreviewPath] = useState<string | null>(null);
	/** Path currently previewed (may be another locale than the host page). */
	const liveHere = previewPath ?? here;

	const drawerRef = useRef<HTMLDivElement | null>(null);
	const liveRef = useRef<HTMLIFrameElement | null>(null);
	const composerRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => injectStyles(document), []);
	useEffect(() => {
		api
			.status()
			.then((st) => {
				setStatus(st);
				setReady(true);
				// The plugin setting seeds the language; a local choice wins.
				if (!localStore(KEY_LANG) && st.settings.language) setLang(st.settings.language);
			})
			.catch(() => setReady(false));
	}, []);

	const windows = useWindows(here);
	const selection = useSelection(liveRef);
	const availableLocales = useMemo(() => status?.locales ?? [], [status]);
	const localeScope = useLocaleScope(availableLocales);
	const chat = useChat({
		model,
		status,
		contextBlock: () => [localeScope.block(), selection.contextBlock()].filter(Boolean).join("\n\n"),
		selectedCount: () => selection.selections.length,
		onSent: selection.clearSelections,
		onContentChanged: refreshWindows,
	});
	const sidebar = useSidebar({ open, previews: windows.previews.length, drawerRef, onShowHistory: chat.refreshSessions });

	// AI mode is a class on <html>: the page is hidden and the UI (outside
	// <body>) is unaffected by page styles.
	useEffect(() => {
		document.documentElement.classList.toggle("turan-ai", open);
		if (!open) sessionStore(KEY_OPEN, null);
		return () => document.documentElement.classList.remove("turan-ai");
	}, [open]);

	useEffect(() => {
		if (open) chat.refreshSessions();
	}, [open, chat.refreshSessions]);

	useEffect(() => {
		if (!open) selection.setSelMode(false);
	}, [open, selection]);

	// Bind the element picker to the live iframe document. A native `load`
	// listener (instead of React's onLoad) also covers fast/cached documents
	// that finish before React attaches its handler.
	const bindRef = useRef(selection.bindLiveFrame);
	bindRef.current = selection.bindLiveFrame;
	const selectionRef = useRef(selection);
	selectionRef.current = selection;
	useEffect(() => {
		if (!open) return;
		const frame = liveRef.current;
		const bind = () => selectionRef.current.bindLiveFrame();
		bind();
		frame?.addEventListener("load", bind);
		return () => frame?.removeEventListener("load", bind);
	}, [open, liveHere]);

	// Escape: popovers dismiss themselves natively, then picker, then the drawer.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (document.querySelector(":popover-open")) return;
			if (selection.selMode) selection.setSelMode(false);
			else if (open) setOpen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, selection]);

	const selectModel = useCallback((entry: ModelEntry) => {
		setModel(entry);
		localStore(KEY_MODEL, entry.id);
	}, []);

	const selectLanguage = useCallback((code: string) => {
		setLang(code);
		localStore(KEY_LANG, code);
	}, []);

	/**
	 * Clicking a language chip selects that locale (single-select) and points the
	 * live preview at its URL. Only the iframe navigates — the host page and the
	 * widget keep their state, so nothing reloads.
	 */
	const norm = (url: string) => url.replace(/\/+$/, "") || "/";
	// Point the live tab at the previewed locale (trailing-slash tolerant) and
	// drop duplicates so exactly one window stays live.
	const seen = new Set<string>();
	const canvasTabs = windows.tabs
		.map((tab) => (norm(tab.url) === norm(here) ? { ...tab, url: liveHere } : tab))
		.filter((tab) => {
			if (seen.has(tab.url)) return false;
			seen.add(tab.url);
			return true;
		});

	const toggleLocale = useCallback(
		(code: string) => {
			const wasActive = localeScope.active[0] === code;
			localeScope.toggle(code);
			if (!wasActive) setPreviewPath(localeUrlFor(liveHere, code, availableLocales));
		},
		[availableLocales, liveHere, localeScope],
	);

	/**
	 * Close a canvas tab. Closing the live tab hands the live view to the next
	 * tab (that needs a real navigation); other tabs are just removed.
	 */
	const closeTab = useCallback(
		(url: string) => {
			const isLive = url.replace(/\/+$/, "") === liveHere.replace(/\/+$/, "");
			if (!isLive) {
				windows.closeTab(url);
				return;
			}
			const next = windows.tabs.find((tab) => tab.url.replace(/\/+$/, "") !== liveHere.replace(/\/+$/, ""));
			if (!next) return;
			windows.closeTab(url);
			navigateTo(next.url);
		},
		[windows, liveHere],
	);

	/** Ready-made action: translate the selection into the page's own locale. */
	const quickTranslate = useCallback(() => {
		const code = localeOfPath(liveHere, availableLocales);
		const label = availableLocales.find((locale) => locale.code === code)?.label ?? code.toUpperCase();
		chat.send(quickTranslatePrompt(code, label, liveHere));
	}, [availableLocales, chat, liveHere]);

	/** One click: send the translation prompt for the selected language. */
	const translateTheme = useCallback((code: string) => {
		selectLanguage(code);
		chat.send(translationPrompt(findLanguage(code)));
	}, [chat, selectLanguage]);

	/** Bounded variant: only `src/components`, safer for one run. */
	const translateComponents = useCallback((code: string) => {
		selectLanguage(code);
		chat.send(translationPrompt(findLanguage(code), "the components in src/components"));
	}, [chat, selectLanguage]);

	return (
		<>
			<Launcher ready={ready} onOpen={() => setOpen(true)} />

			<Canvas
				geo={sidebar.geo}
				tabs={canvasTabs}
				here={liveHere}
				liveRef={liveRef}
				onLiveFrameLoad={selection.bindLiveFrame}
				onOpenTab={navigateTo}
				dragging={windows.dragging}
				dragHandlers={windows.dragHandlers}
			/>

			<CanvasBars
				barPad={sidebar.barPad}
				tabs={canvasTabs}
				here={liveHere}
				onSelectTab={navigateTo}
				onCloseTab={closeTab}
				onOpenPagesMenu={windows.loadPages}
				liveRef={liveRef}
				selMode={selection.selMode}
				onToggleSelMode={selection.toggleSelMode}
				onFocusComposer={() => composerRef.current?.focus()}
				activePageTitle={windows.activePageTitle}
				onOpenSwitcher={windows.loadPages}
				onOpenTranslations={() => setTranslationsOpen(true)}
				locales={availableLocales}
				activeLocales={localeScope.active}
				onToggleLocale={toggleLocale}
				onClearLocales={localeScope.clear}
			/>

			<Drawer
				open={open}
				drawerRef={drawerRef}
				sidebar={sidebar}
				chat={chat}
				selection={selection}
				onClose={() => setOpen(false)}
				composer={{
					draft: chat.draft,
					onDraft: chat.setDraft,
					onSend: chat.send,
					onQuickTranslate: quickTranslate,
					quickLocale: localeOfPath(liveHere, availableLocales),
					hasSelection: selection.selections.length > 0,
					onStop: chat.stop,
					busy: chat.busy,
					onNewSession: () => chat.openSession(null),
					onRefreshSessions: chat.refreshSessions,
					model,
					status,
					selectedModelLabel: model.label,
					languageCode: lang,
					showClockButton: !sidebar.showHistory,
					textareaRef: composerRef,
				}}
			/>

			{/* Popovers: rendered once, opened by id from the buttons above. */}
			<PageSwitcher
				tabs={windows.tabs}
				pages={windows.pages}
				here={here}
				onSelect={(url, title) => windows.selectPage(url, title)}
				onOpen={windows.loadPages}
			/>
			<PagesMenu pages={windows.pages} openUrls={windows.tabs.map((t) => t.url)} onSelect={(p) => windows.selectPage(p.url, p.title)} />
			<ModelMenu status={status} model={model} onSelect={selectModel} />
			<LanguageMenu
				value={lang}
				onSelect={selectLanguage}
				onTranslate={translateTheme}
				onTranslateComponents={translateComponents}
				locales={availableLocales}
				onSetDefault={(code) => {
					api
						.setDefaultLocale(code)
						.then(() => setTimeout(() => window.location.reload(), 1600))
						.catch((err: Error) => chat.setError(err.message));
				}}
			/>
			<TranslationList
				open={translationsOpen}
				onClose={() => setTranslationsOpen(false)}
				locales={availableLocales}
				here={here}
				onTranslate={(prompt) => {
					setTranslationsOpen(false);
					chat.send(prompt);
				}}
			/>
			<SessionMenu
				sessions={chat.sessions}
				activeId={chat.activeSessionId}
				onSelect={(id) => chat.openSession(id)}
				onNew={() => chat.openSession(null)}
				onOpen={chat.refreshSessions}
			/>
		</>
	);
}
