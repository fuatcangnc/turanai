/** Searchable page switcher popover. */

import { useCallback, useRef, useState } from "react";

import { useOnPopoverOpen } from "../lib/popover";
import type { PageItem, Tab } from "../lib/types";
import { closeAllPopovers } from "../lib/widget-store";
import { Icon } from "../ui/icons";

export interface PageSwitcherProps {
	tabs: Tab[];
	pages: PageItem[];
	here: string;
	onSelect(url: string, title: string): void;
	/** Refresh the page inventory when the panel opens. */
	onOpen(): void;
}

export function PageSwitcher({ tabs, pages, here, onSelect, onOpen }: PageSwitcherProps) {
	const [query, setQuery] = useState("");
	const ref = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	useOnPopoverOpen(
		ref,
		useCallback(() => {
			setQuery("");
			onOpen();
			inputRef.current?.focus();
		}, [onOpen]),
	);

	const rows = [
		...tabs.map((t) => ({ ...t, open: true })),
		...pages.filter((p) => !tabs.some((t) => t.url === p.url)).map((p) => ({ ...p, open: false })),
	].filter((r) => !query || r.title.toLowerCase().includes(query.toLowerCase()) || r.url.toLowerCase().includes(query.toLowerCase()));

	return (
		<div id="t-switch" ref={ref} popover="auto" role="dialog" aria-label="Sayfa ara ve geç">
			<label className="t-sbox">
				<Icon name="search" />
				<input ref={inputRef} type="search" placeholder="Sayfa ara" value={query} onChange={(e) => setQuery(e.target.value)} />
			</label>
			<div className="t-slist">
				{rows.length === 0 ? <div className="t-mtitle">Sonuç yok</div> : null}
				{rows.map((r) => (
					<button
						key={r.url}
						type="button"
						className={`t-sitem${r.url === here ? " on" : ""}`}
						title={r.url === here ? "Canlı sayfa" : r.open ? "Seçimi kaldır" : "Yanına ekle"}
						onClick={() => {
							closeAllPopovers();
							onSelect(r.url, r.title);
						}}
					>
						<span className="t-item" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
							{r.title}
						</span>
						<span className="t-spath">{r.url}</span>
						<span className={`t-dot${r.open ? " on" : ""}`}>
							<Icon name="check" />
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
