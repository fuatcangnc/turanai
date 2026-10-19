/** Runs a callback when a native popover opens (its `toggle` event). */

import { useEffect, type RefObject } from "react";

export function useOnPopoverOpen(ref: RefObject<HTMLElement | null>, callback: () => void): void {
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const handler = (event: Event) => {
			if ((event as Event & { newState?: string }).newState === "open") callback();
		};
		el.addEventListener("toggle", handler);
		return () => el.removeEventListener("toggle", handler);
	}, [callback, ref]);
}
