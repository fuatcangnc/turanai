/** Canvas bars above the windows: page tabs, navigation and tools. */

import type { SiteLocale } from "../../i18n";
import type { Tab } from "../lib/types";
import { Icon, IconButton } from "../ui/icons";
import { LocaleScope } from "./LocaleScope";

export interface CanvasBarsProps {
	barPad: { paddingLeft: string };
	tabs: Tab[];
	here: string;
	onSelectTab(url: string): void;
	onCloseTab(url: string): void;
	onOpenPagesMenu(): void;
	liveRef: React.RefObject<HTMLIFrameElement | null>;
	selMode: boolean;
	onToggleSelMode(): void;
	onFocusComposer(): void;
	activePageTitle: string;
	onOpenSwitcher(): void;
	onOpenTranslations(): void;
	/** Locale scope of the agent (canvas chips). */
	locales: SiteLocale[];
	activeLocales: string[];
	onToggleLocale(code: string): void;
	onClearLocales(): void;
}

export function CanvasBars({
	barPad,
	tabs,
	here,
	onSelectTab,
	onCloseTab,
	onOpenPagesMenu,
	liveRef,
	selMode,
	onToggleSelMode,
	onFocusComposer,
	activePageTitle,
	onOpenSwitcher,
	onOpenTranslations,
	locales,
	activeLocales,
	onToggleLocale,
	onClearLocales,
}: CanvasBarsProps) {
	return (
		<>
			<div id="t-tabsbar" style={barPad}>
				<div className="t-tabwrap">
					{tabs.map((t) => {
						const active = t.url === here;
						return (
							<button
								key={t.url}
								type="button"
								className={`t-tab${active ? " on" : ""}`}
								title={t.url}
								onClick={() => {
									if (!active) onSelectTab(t.url);
								}}
							>
								<span className="t-tabinner">
									<span>{t.title}</span>
									{tabs.length > 1 ? (
										<span
											className="t-tabx"
											role="button"
											aria-label="Close tab"
											title="Close tab"
											onClick={(e) => {
												e.stopPropagation();
												onCloseTab(t.url);
											}}
										>
											<Icon name="close" />
										</span>
									) : null}
								</span>
							</button>
						);
					})}
					<IconButton
						icon="plus"
						label="Open page"
						style={{ width: 26, height: 26 }}
						extra={{ popoverTarget: "t-page-menu", "aria-haspopup": "dialog" }}
						onClick={onOpenPagesMenu}
					/>
				</div>
			</div>

			<div id="t-bar" style={barPad}>
				<IconButton icon="left" label="Back" onClick={() => liveRef.current?.contentWindow?.history.back()} />
				<IconButton icon="right" label="Forward" onClick={() => liveRef.current?.contentWindow?.history.forward()} />
				<IconButton
					icon="reload"
					label="Reload"
					onClick={() => {
						try {
							liveRef.current?.contentWindow?.location.reload();
						} catch {
							/* ignore */
						}
					}}
				/>
				<span className="t-path">{here}</span>
				<button type="button" className="t-tlbtn" onClick={onOpenTranslations} title="Translations list">
					<Icon name="globe" />
					<span>Translation lists</span>
				</button>
			</div>

			<div id="t-bar2" style={barPad}>
				<div className="t-toolgroup">
					<IconButton icon="cursor" label="Pick an element" active={selMode} onClick={onToggleSelMode} />
					<IconButton icon="pencil" label="Write to chat" onClick={onFocusComposer} />
				</div>
				<LocaleScope
					locales={locales}
					active={activeLocales}
					here={here}
					onToggle={onToggleLocale}
					onClear={onClearLocales}
				/>
				<button type="button" className="t-sw" title="Search pages" aria-haspopup="dialog" popoverTarget="t-switch" onClick={onOpenSwitcher}>
					<Icon name="search" />
					<span>{activePageTitle}</span>
					<Icon name="chevron" />
				</button>
			</div>
		</>
	);
}
