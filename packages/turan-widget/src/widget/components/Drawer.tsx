/** Drawer shell: header, two-column body (history + conversation), resizer. */

import type { ChatApi } from "../hooks/useChat";
import type { SelectionApi } from "../hooks/useSelection";
import type { SidebarApi } from "../hooks/useSidebar";
import { MIN_DW } from "../lib/layout";
import { ChatHistory } from "./ChatHistory";
import { ChatLog } from "./ChatLog";
import { Composer } from "./Composer";
import type { ComposerProps } from "./Composer";
import { Resizer } from "./Resizer";
import { IconButton } from "../ui/icons";

export interface DrawerProps {
	open: boolean;
	drawerRef: React.RefObject<HTMLDivElement | null>;
	sidebar: SidebarApi;
	chat: ChatApi;
	selection: SelectionApi;
	composer: Omit<ComposerProps, "selections" | "onRemoveSelection" | "selMode" | "onToggleSelMode">;
	onClose(): void;
}

export function Drawer({ open, drawerRef, sidebar, chat, selection, composer, onClose }: DrawerProps) {
	return (
		<div
			id="turan-drawer"
			ref={drawerRef}
			className={open ? "turan-open" : ""}
			role="dialog"
			aria-label="Turan AI"
			aria-modal="false"
			style={{ width: sidebar.drawerWidth }}
		>
			<div className="t-head">
				<IconButton icon="spark" label="Turan AI" onClick={() => chat.openSession(null)} />
				<IconButton
					icon="clock"
					label={sidebar.historyOpen ? "Hide chat history" : "Show chat history"}
					active={sidebar.historyOpen}
					extra={{ "aria-expanded": sidebar.historyOpen ? "true" : "false", "aria-controls": "turan-history" }}
					onClick={sidebar.toggleHistory}
				/>
				<span className="t-spacer" />
				<IconButton
					icon={sidebar.collapsed ? "right" : "left"}
					label={sidebar.collapsed ? "Paneli genişlet" : "Paneli daralt"}
					extra={{ "aria-expanded": sidebar.collapsed ? "false" : "true", "aria-controls": "turan-drawer" }}
					onClick={sidebar.toggleCollapse}
				/>
				<IconButton icon="close" label="Kapat (Esc)" onClick={onClose} />
			</div>

			<div className="t-body-row">
				{sidebar.showHistory ? (
					<ChatHistory
						sessions={chat.sessions}
						activeId={chat.activeSessionId}
						onSelect={(id) => chat.openSession(id)}
						onNew={() => chat.openSession(null)}
					/>
				) : null}

				<div className="t-main-col">
					<ChatLog
						messages={chat.messages}
						tools={chat.tools}
						stream={chat.stream}
						note={chat.note}
						error={chat.error}
						onCopy={(text) => void navigator.clipboard?.writeText(text)}
						onEdit={(text) => chat.setDraft(text)}
						onUndoChange={(changeId) => chat.undo(changeId)}
					/>
					<Composer
						{...composer}
						selections={selection.selections}
						onRemoveSelection={selection.toggleSelect}
						selMode={selection.selMode}
						onToggleSelMode={selection.toggleSelMode}
					/>
				</div>
			</div>

			<Resizer
				min={MIN_DW}
				max={sidebar.maxDrawerWidth}
				now={sidebar.drawerWidth}
				onPointerDown={sidebar.resizer.onPointerDown}
				onPointerMove={sidebar.resizer.onPointerMove}
				onPointerUp={sidebar.resizer.onPointerUp}
				onKeyDown={sidebar.resizer.onKeyDown}
				onDoubleClick={sidebar.resizer.toDefault}
			/>
		</div>
	);
}
