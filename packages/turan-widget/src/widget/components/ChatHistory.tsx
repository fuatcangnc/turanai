/** Persistent chat-history rail (left column of the drawer). */

import type { SessionSummary } from "../../protocol";
import { Icon } from "../ui/icons";

export interface ChatHistoryProps {
	sessions: SessionSummary[];
	activeId: string | null;
	onSelect(id: string): void;
	onNew(): void;
}

export function ChatHistory({ sessions, activeId, onSelect, onNew }: ChatHistoryProps) {
	return (
		<nav className="t-history" id="turan-history" aria-label="Chat history">
			<button type="button" className="t-newchat" onClick={onNew}>
				<Icon name="plus" />
				<span>New chat</span>
			</button>
			{sessions.length === 0 ? (
				<p className="t-history-empty">No conversations yet.</p>
			) : (
				<ul>
					{sessions.map((s) => {
						const active = s.id === activeId;
						return (
							<li key={s.id}>
								<button
									type="button"
									className="t-hitem"
									aria-current={active ? "true" : undefined}
									title={s.title}
									onClick={() => onSelect(s.id)}
								>
									<span className="t-hname">{s.title}</span>
									<span className="t-hmeta">{s.messageCount} mesaj</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</nav>
	);
}
