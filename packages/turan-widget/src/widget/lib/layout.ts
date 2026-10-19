/** Shared widget constants and the canvas layout solver. */

export const BAR_H = 124;
export const CHROME_H = 34;
export const REF_W = 1440;

/** Canvas shows at most this many page windows (live page + previews). */
export const MAX_WINDOWS = 2;

/** Sidebar width bounds (px); pointer and keyboard both clamp to these. */
export const MIN_DW = 300;
export const MAX_DW = 720;
/** Default leaves room for the chat-history rail. */
export const DEFAULT_DW = 460;
/** Below this the rail is unusable, so it hides (clock popover takes over). */
export const HISTORY_MIN_DW = 430;
/** Width of the chat-history rail. */
export const RAIL_W = 188;

export interface Geo {
	/** Drawer width. */
	dw: number;
	/** Canvas left edge (drawer + gutter). */
	x0: number;
	/** Canvas top edge (bars + gap). */
	y0: number;
	/** Window width when `previews + 1` windows are shown. */
	winW: number;
	canvasH: number;
	/** Window content height (canvas minus chrome). */
	innerH: number;
	/** Scale applied to each 1440px-wide page iframe. */
	k: number;
}

export interface GeoInput {
	vw: number;
	vh: number;
	drawerWidth: number;
	previews: number;
}

/** One alignment grid for bars and canvas: 16px gutter next to the drawer,
 * 12px on the outer edges, 12px below the bars. */
export function computeGeo({ vw, vh, drawerWidth, previews }: GeoInput): Geo {
	const x0 = drawerWidth + 16;
	const y0 = BAR_H + 12;
	const canvasW = Math.max(220, vw - x0 - 12);
	const canvasH = Math.max(200, vh - y0 - 12);
	const n = Math.max(1, previews + 1);
	const winW = Math.max(160, (canvasW - 16 * (n - 1)) / n);
	const innerH = canvasH - CHROME_H - 2;
	return { dw: drawerWidth, x0, y0, winW, canvasH, innerH, k: (winW - 2) / REF_W };
}
