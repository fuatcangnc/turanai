/** Canvas: the windows container rendering one window per selected page. */

import { useMemo } from "react";

import type { Tab } from "../lib/types";
import { CHROME_H, REF_W, type Geo } from "../lib/layout";
import { Window } from "./Window";

export interface CanvasProps {
	geo: Geo | null;
	tabs: Tab[];
	here: string;
	liveRef: React.RefObject<HTMLIFrameElement | null>;
	onLiveFrameLoad(): void;
	onOpenTab(url: string): void;
	dragging: string | null;
	dragHandlers(url: string): {
		onDragStart(e: React.DragEvent): void;
		onDrop(e: React.DragEvent): void;
		onDragOver(e: React.DragEvent): void;
		onDragLeave(): void;
	};
}

export function Canvas({ geo, tabs, here, liveRef, onLiveFrameLoad, onOpenTab, dragging, dragHandlers }: CanvasProps) {
	const style = useMemo(() => {
		if (!geo) return { display: "none" as const };
		const gap = 16;
		const count = Math.max(1, tabs.length);
		return {
			left: geo.x0,
			top: geo.y0,
			width: geo.winW * count + gap * (count - 1),
			height: geo.canvasH,
		};
	}, [geo, tabs.length]);

	const frameStyle = {
		width: REF_W,
		height: geo ? Math.round(geo.innerH / geo.k) : 0,
		transform: `scale(${geo?.k ?? 1})`,
	};

	return (
		<div id="t-frames" style={style}>
			{tabs.map((tab) => {
				const live = tab.url === here;
				return (
					<Window
						key={tab.url}
						url={tab.url}
						winW={geo?.winW}
						canvasH={geo?.canvasH}
						dragging={dragging === tab.url}
						onClick={live ? undefined : () => onOpenTab(tab.url)}
						{...dragHandlers(tab.url)}
					>
						<div className="t-body" style={{ height: geo?.innerH, maxHeight: geo ? geo.canvasH - CHROME_H - 2 : undefined }}>
							{live ? (
								<iframe ref={liveRef} title="Canlı sayfa" src={here} onLoad={onLiveFrameLoad} style={frameStyle} />
							) : (
								<iframe className="t-prev" tabIndex={-1} title={tab.title} src={tab.url} style={frameStyle} />
							)}
						</div>
					</Window>
				);
			})}
		</div>
	);
}
