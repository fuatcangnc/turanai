/**
 * Canvas windows: which pages are shown (max two), their order (HTML5
 * drag & drop) and the page inventory for the tabs / switcher.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { api } from "../api";
import { MAX_WINDOWS } from "../lib/layout";
import type { PageItem, Tab } from "../lib/types";
import { KEY_TABS, sessionStore } from "../lib/widget-store";

function readTabs(here: string, title: string): Tab[] {
	let stored: Tab[] = [];
	try {
		stored = (JSON.parse(sessionStore(KEY_TABS) ?? "[]") as Tab[]) ?? [];
	} catch {
		stored = [];
	}
	// The live page is always the first window; the rest are previews.
	const rest = stored.filter((t) => t.url !== here);
	const next = [{ url: here, title: stored.find((t) => t.url === here)?.title ?? title }, ...rest].slice(0, MAX_WINDOWS);
	sessionStore(KEY_TABS, JSON.stringify(next));
	return next;
}

export interface WindowsApi {
	tabs: Tab[];
	previews: Tab[];
	pages: PageItem[];
	activePageTitle: string;
	selectPage(url: string, title: string): void;
	closeTab(url: string): void;
	loadPages(): void;
	/** Drag & drop wiring; `dragging` marks the current drop target. */
	dragging: string | null;
	dragHandlers(url: string): {
		onDragStart: (e: React.DragEvent) => void;
		onDrop: (e: React.DragEvent) => void;
		onDragOver: (e: React.DragEvent) => void;
		onDragLeave: () => void;
	};
}

export function useWindows(here: string): WindowsApi {
	const [tabs, setTabs] = useState<Tab[]>(() => readTabs(here, document.title.split(" · ")[0] || here));
	const [pages, setPages] = useState<PageItem[]>([]);
	const [dragging, setDragging] = useState<string | null>(null);
	const dragUrl = useRef<string | null>(null);

	const previews = useMemo(() => tabs.filter((t) => t.url !== here), [tabs, here]);

	const updateTabs = useCallback((next: Tab[]) => {
		const trimmed = next.slice(0, MAX_WINDOWS);
		sessionStore(KEY_TABS, JSON.stringify(trimmed));
		setTabs(trimmed);
	}, []);

	const selectPage = useCallback(
		(url: string, title: string) => {
			if (url === here) return; // the live page cannot be deselected
			if (tabs.some((t) => t.url === url)) {
				updateTabs(tabs.filter((t) => t.url !== url));
				return;
			}
			const current = tabs.filter((t) => t.url !== here);
			if (current.length >= MAX_WINDOWS - 1) {
				// At the limit: replace the existing preview.
				updateTabs([tabs.find((t) => t.url === here) ?? { url: here, title: document.title }, { url, title }]);
				return;
			}
			updateTabs([...tabs, { url, title }]);
		},
		[here, tabs, updateTabs],
	);

	const closeTab = useCallback((url: string) => updateTabs(tabs.filter((t) => t.url !== url)), [tabs, updateTabs]);

	const loadPages = useCallback(() => {
		api.pages().then((d) => setPages(d.pages)).catch(() => undefined);
	}, []);

	const dragHandlers = useCallback(
		(url: string) => ({
			onDragStart: (e: React.DragEvent) => {
				dragUrl.current = url;
				e.dataTransfer.effectAllowed = "move";
				try {
					e.dataTransfer.setData("text/plain", url);
				} catch {
					/* some browsers restrict custom data */
				}
			},
			onDragOver: (e: React.DragEvent) => {
				e.preventDefault();
				if (dragUrl.current && dragUrl.current !== url) setDragging(url);
			},
			onDragLeave: () => setDragging((v) => (v === url ? null : v)),
			onDrop: (e: React.DragEvent) => {
				e.preventDefault();
				setDragging(null);
				let from = dragUrl.current;
				try {
					from = from ?? e.dataTransfer.getData("text/plain");
				} catch {
					/* ignore */
				}
				dragUrl.current = null;
				if (!from || from === url) return;
				const order = tabs.map((t) => t.url);
				const i = order.indexOf(from);
				const j = order.indexOf(url);
				if (i < 0 || j < 0) return;
				order.splice(i, 1);
				order.splice(j, 0, from);
				const byUrl = new Map(tabs.map((t) => [t.url, t]));
				updateTabs(order.map((u) => byUrl.get(u)).filter((t): t is Tab => Boolean(t)));
			},
		}),
		[tabs, updateTabs],
	);

	return {
		tabs,
		previews,
		pages,
		activePageTitle: document.title.split(" · ")[0] || "Sayfa",
		selectPage,
		closeTab,
		loadPages,
		dragging,
		dragHandlers,
	};
}
