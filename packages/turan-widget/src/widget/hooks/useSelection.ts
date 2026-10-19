/**
 * Element picker: binds the live iframe document, tracks hover/selection and
 * builds the `[SECLI_OGELER]` context block for the next message.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
	bindFrame,
	describeSelection,
	selectionContext,
	type FrameBinding,
	type Selection,
} from "../frame";
import { closeAllPopovers, navigateTo } from "../lib/widget-store";

export interface SelectionApi {
	selMode: boolean;
	toggleSelMode(): void;
	setSelMode(value: boolean): void;
	selections: Selection[];
	toggleSelect(el: Element): void;
	clearSelections(): void;
	/** Call from the live iframe's onLoad. */
	bindLiveFrame(): void;
	contextBlock(): string;
}

export function useSelection(liveFrame: React.RefObject<HTMLIFrameElement | null>): SelectionApi {
	const [selMode, setSelMode] = useState(false);
	const [selections, setSelections] = useState<Selection[]>([]);
	const selModeRef = useRef(false);
	const selectionsRef = useRef<Selection[]>([]);
	const binding = useRef<FrameBinding | null>(null);

	useEffect(() => () => binding.current?.destroy(), []);

	/** Crosshair cursor + highlight cleanup live in the iframe document. */
	const applyPickClass = useCallback(() => {
		const doc = liveFrame.current?.contentDocument;
		if (!doc) return;
		doc.documentElement.classList.toggle("turan-pick", selModeRef.current);
		if (!selModeRef.current) binding.current?.clearHighlight();
	}, [liveFrame]);

	useEffect(() => {
		selModeRef.current = selMode;
		applyPickClass();
	}, [applyPickClass, selMode]);

	const apply = useCallback((next: Selection[]) => {
		selectionsRef.current = next;
		setSelections(next);
	}, []);

	const toggleSelect = useCallback(
		(el: Element) => {
			const current = selectionsRef.current;
			const existing = current.findIndex((s) => s.el === el);
			if (existing >= 0) {
				el.classList.remove("turan-sel");
				apply(current.filter((_, i) => i !== existing));
				return;
			}
			if (current.length >= 6) return;
			el.classList.add("turan-sel");
			apply([...current, describeSelection(el, liveFrame.current?.contentDocument?.body ?? null)]);
		},
		[apply, liveFrame],
	);

	const clearSelections = useCallback(() => {
		selectionsRef.current.forEach((s) => s.el.classList.remove("turan-sel"));
		apply([]);
	}, [apply]);

	const bindLiveFrame = useCallback(() => {
		const doc = liveFrame.current?.contentDocument;
		if (!doc) return;
		binding.current?.destroy();
		binding.current = bindFrame(doc, {
			isPicking: () => selModeRef.current,
			onPick: (el) => toggleSelect(el),
			onNavigate: (url) => navigateTo(url),
			onOutsideClick: () => closeAllPopovers(),
		});
		// A reloaded iframe starts without the picking class.
		doc.documentElement.classList.toggle("turan-pick", selModeRef.current);
	}, [applyPickClass, liveFrame, toggleSelect]);

	const contextBlock = useCallback(() => selectionContext(selectionsRef.current), []);

	return {
		selMode,
		setSelMode,
		toggleSelMode: () => setSelMode((v) => !v),
		selections,
		toggleSelect,
		clearSelections,
		bindLiveFrame,
		contextBlock,
	};
}
