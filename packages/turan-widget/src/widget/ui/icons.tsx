/** Widget icon set (inline SVG) and the shared icon button. */

import type { CSSProperties } from "react";

export type IconName =
	| "spark" | "plus" | "clock" | "close" | "chevron" | "term"
	| "copy" | "up" | "check" | "cursor" | "left" | "right" | "reload"
	| "search" | "pencil" | "undo" | "globe" | "stop";

const PATHS: Record<IconName, React.ReactElement> = {
	spark: <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />,
	stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
	globe: (
		<>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5z" />
		</>
	),
	plus: <path d="M12 5v14M5 12h14" />,
	clock: (
		<>
			<circle cx="12" cy="12" r="8" />
			<path d="M12 8v4l3 2" />
		</>
	),
	close: <path d="M6 6l12 12M18 6L6 18" />,
	chevron: <path d="M6 9l6 6 6-6" />,
	term: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M7 9l3 3-3 3M13 15h4" />
		</>
	),
	copy: (
		<>
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15V5a1 1 0 011-1h9" />
		</>
	),
	up: <path d="M12 19V5M5 12l7-7 7 7" />,
	check: <path d="M5 13l4 4L19 7" />,
	cursor: <path d="M4 4l7 16 2.2-6.3L19.5 11.5z" />,
	left: <path d="M15 6l-6 6 6 6" />,
	right: <path d="M9 6l6 6-6 6" />,
	reload: <path d="M20 12a8 8 0 10-2.3 5.6M20 6v6h-6" />,
	search: (
		<>
			<circle cx="11" cy="11" r="6" />
			<path d="M20 20l-4.3-4.3" />
		</>
	),
	pencil: <path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4" />,
	undo: <path d="M9 14l-4-4 4-4M5 10h9a5 5 0 010 10h-3" />,
};

export function Icon({ name }: { name: IconName }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{PATHS[name]}
		</svg>
	);
}

export interface IconButtonProps {
	icon: IconName;
	label: string;
	onClick?: () => void;
	active?: boolean;
	/** Extra DOM attributes (e.g. `popoverTarget`, `aria-controls`). */
	extra?: Record<string, unknown>;
	style?: CSSProperties;
	className?: string;
}

export function IconButton({ icon, label, onClick, active, extra, style, className }: IconButtonProps) {
	return (
		<button
			type="button"
			className={`t-icon${active ? " on" : ""}${className ? ` ${className}` : ""}`}
			title={label}
			aria-label={label}
			onClick={onClick}
			style={style}
			{...extra}
		>
			<Icon name={icon} />
		</button>
	);
}
