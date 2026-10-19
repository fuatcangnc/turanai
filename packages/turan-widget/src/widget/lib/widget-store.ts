/** Browser storage keys and small DOM helpers shared by the widget modules. */

export const KEY_TABS = "turan.tabs";
export const KEY_OPEN = "turan.widget.open";
export const KEY_MODEL = "turan.model";
/** Target language of the AI theme translation (mirrors the plugin setting). */
export const KEY_LANG = "turan.lang";
export const KEY_DRAWER = "turan.widget.dw";
export const KEY_HISTORY = "turan.widget.history";
/** In-flight run (survives the dev-server HMR reloads while the agent edits files). */
export const KEY_RUN = "turan.run";
/** Locales the agent is allowed to change (canvas scope picker). */
export const KEY_LOCALES = "turan.locales";

export function sessionStore(key: string, value?: string | null): string | null {
	try {
		if (value === undefined) return sessionStorage.getItem(key);
		if (value === null) sessionStorage.removeItem(key);
		else sessionStorage.setItem(key, value);
	} catch {
		return null;
	}
	return null;
}

export function localStore(key: string, value?: string | null): string | null {
	try {
		if (value === undefined) return localStorage.getItem(key);
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		return null;
	}
	return null;
}

/** Navigating in the widget keeps the drawer open on the next page. */
export function navigateTo(url: string): void {
	sessionStore(KEY_OPEN, "1");
	window.location.assign(url);
}

/** Closed every open popover (light dismiss inside iframes needs this too). */
export function closeAllPopovers(): void {
	document.querySelectorAll<HTMLElement>(":popover-open").forEach((el) => {
		try {
			el.hidePopover();
		} catch {
			/* already closed */
		}
	});
}

/** Reload every canvas window so content changes become visible. */
export function refreshWindows(): void {
	document.querySelectorAll<HTMLIFrameElement>("#t-frames iframe").forEach((frame) => {
		try {
			frame.contentWindow?.location.reload();
		} catch {
			/* ignore */
		}
	});
}
