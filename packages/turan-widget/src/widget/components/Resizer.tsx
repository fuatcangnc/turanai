/** Sidebar resize handle: pointer drag + full keyboard support (separator role). */

export interface ResizerProps {
	min: number;
	max: number;
	now: number;
	onPointerDown(e: React.PointerEvent<HTMLDivElement>): void;
	onPointerMove(e: React.PointerEvent<HTMLDivElement>): void;
	onPointerUp(e: React.PointerEvent<HTMLDivElement>): void;
	onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void;
	onDoubleClick(): void;
}

export function Resizer({ min, max, now, onPointerDown, onPointerMove, onPointerUp, onKeyDown, onDoubleClick }: ResizerProps) {
	return (
		<div
			className="t-resizer"
			role="separator"
			aria-orientation="vertical"
			aria-label="Sohbet panelini yeniden boyutlandır"
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={Math.round(now)}
			aria-valuetext={`${Math.round(now)} piksel`}
			title="Sürükle veya ←/→ (Shift: hızlı, Home/End: uçlar, Enter: varsayılan)"
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onKeyDown={onKeyDown}
			onDoubleClick={onDoubleClick}
		/>
	);
}
