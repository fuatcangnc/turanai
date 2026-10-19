/**
 * Sidebar: resizable (pointer + keyboard, WCAG-friendly), collapsible, plus the
 * chat-history rail preference and the canvas geometry derived from the width.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { computeGeo, DEFAULT_DW, HISTORY_MIN_DW, MAX_DW, MIN_DW, type Geo } from "../lib/layout";
import { KEY_DRAWER, KEY_HISTORY, localStore } from "../lib/widget-store";

export interface SidebarApi {
	drawerWidth: number;
	maxDrawerWidth: number;
	geo: Geo | null;
	collapsed: boolean;
	showHistory: boolean;
	historyOpen: boolean;
	setWidth(width: number): void;
	toggleCollapse(): void;
	toggleHistory(): void;
	barPad: { paddingLeft: string };
	resizer: {
		onPointerDown(e: React.PointerEvent<HTMLDivElement>): void;
		onPointerMove(e: React.PointerEvent<HTMLDivElement>): void;
		onPointerUp(e: React.PointerEvent<HTMLDivElement>): void;
		onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void;
		toDefault(): void;
	};
}

export function useSidebar(opts: {
	open: boolean;
	previews: number;
	drawerRef: React.RefObject<HTMLDivElement | null>;
	onShowHistory(): void;
}): SidebarApi {
	const { open, previews, drawerRef, onShowHistory } = opts;
	const [drawerWidth, setDrawerWidth] = useState(() => {
		const saved = Number(localStore(KEY_DRAWER) ?? "");
		return Number.isFinite(saved) && saved >= MIN_DW ? Math.min(saved, MAX_DW) : DEFAULT_DW;
	});
	const [lastExpanded, setLastExpanded] = useState(DEFAULT_DW);
	const [historyOpen, setHistoryOpen] = useState(() => localStore(KEY_HISTORY) !== "0");
	const [geo, setGeo] = useState<Geo | null>(null);

	const maxDrawerWidth = Math.max(MIN_DW, Math.min(MAX_DW, Math.round((window.innerWidth || 1200) * 0.7)));

	const setWidth = useCallback(
		(width: number) => {
			const clamped = Math.max(MIN_DW, Math.min(maxDrawerWidth, Math.round(width)));
			setDrawerWidth(clamped);
			localStore(KEY_DRAWER, String(clamped));
		},
		[maxDrawerWidth],
	);

	const recompute = useCallback(() => {
		const root = document.documentElement;
		const vw = root.clientWidth || window.innerWidth;
		const vh = root.clientHeight || window.innerHeight;
		// Guard against measuring before the widget CSS applies (an unstyled
		// drawer spans the whole viewport).
		const measured = drawerRef.current?.offsetWidth ?? 0;
		const dw = measured > 0 && measured < vw * 0.6 ? measured : drawerWidth;
		setGeo(computeGeo({ vw, vh, drawerWidth: dw, previews }));
	}, [drawerWidth, drawerRef, previews]);

	useLayoutEffect(() => {
		if (!open) return;
		recompute();
		const raf = requestAnimationFrame(recompute);
		const onResize = () => recompute();
		window.addEventListener("resize", onResize);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", onResize);
		};
	}, [open, recompute]);

	const dragRef = useRef<{ startX: number; startW: number } | null>(null);

	const resizer = {
		onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
			dragRef.current = { startX: e.clientX, startW: drawerWidth };
			e.currentTarget.setPointerCapture?.(e.pointerId);
			e.preventDefault();
		},
		onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
			const drag = dragRef.current;
			if (!drag) return;
			setWidth(drag.startW + (e.clientX - drag.startX));
		},
		onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
			dragRef.current = null;
			e.currentTarget.releasePointerCapture?.(e.pointerId);
		},
		onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
			const step = e.shiftKey ? 64 : 16;
			if (e.key === "ArrowLeft") setWidth(drawerWidth - step);
			else if (e.key === "ArrowRight") setWidth(drawerWidth + step);
			else if (e.key === "Home") setWidth(MIN_DW);
			else if (e.key === "End") setWidth(maxDrawerWidth);
			else if (e.key === "Enter" || e.key === " ") setWidth(DEFAULT_DW);
			else return;
			e.preventDefault();
		},
		toDefault: () => setWidth(DEFAULT_DW),
	};

	const collapsed = drawerWidth <= MIN_DW + 4;

	const toggleCollapse = useCallback(() => {
		if (collapsed) {
			setWidth(lastExpanded);
			return;
		}
		setLastExpanded(drawerWidth);
		setWidth(MIN_DW);
	}, [collapsed, drawerWidth, lastExpanded, setWidth]);

	const toggleHistory = useCallback(() => {
		const next = !historyOpen;
		setHistoryOpen(next);
		localStore(KEY_HISTORY, next ? "1" : "0");
		if (next) {
			onShowHistory();
			// Showing the rail needs room; widen instead of rendering it cramped.
			if (drawerWidth < HISTORY_MIN_DW) setWidth(DEFAULT_DW);
		}
	}, [drawerWidth, historyOpen, onShowHistory, setWidth]);

	return {
		drawerWidth,
		maxDrawerWidth,
		geo,
		collapsed,
		showHistory: historyOpen && drawerWidth >= HISTORY_MIN_DW,
		historyOpen,
		setWidth,
		toggleCollapse,
		toggleHistory,
		barPad: { paddingLeft: `${(geo?.dw ?? drawerWidth) + 16}px` },
		resizer,
	};
}
