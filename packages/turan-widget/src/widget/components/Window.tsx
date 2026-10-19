/** One browser-like window: chrome bar (URL pill) + content area. */

import type { ReactNode } from "react";

export interface WindowProps {
	url: string;
	winW?: number;
	canvasH?: number;
	onClick?: () => void;
	dragging?: boolean;
	onDragStart?: (e: React.DragEvent) => void;
	onDrop?: (e: React.DragEvent) => void;
	onDragOver?: (e: React.DragEvent) => void;
	onDragLeave?: (e: React.DragEvent) => void;
	children: ReactNode;
}

export function Window(props: WindowProps) {
	return (
		<div
			className={`t-win${props.onClick ? " t-click" : ""}${props.dragging ? " t-over" : ""}`}
			style={{ width: props.winW, height: props.canvasH }}
			title={props.onClick ? "Bu sayfaya geç" : undefined}
			onDrop={props.onDrop}
			onDragOver={props.onDragOver}
			onDragLeave={props.onDragLeave}
		>
			<div className="t-chrome" onClick={props.onClick} draggable onDragStart={props.onDragStart} title="Sürükleyip sırayı değiştir">
				<span className="t-dots">
					<i className="t-dot2" />
					<i className="t-dot2" />
					<i className="t-dot2" />
				</span>
				<span className="t-url">{props.url}</span>
			</div>
			{props.children}
		</div>
	);
}
