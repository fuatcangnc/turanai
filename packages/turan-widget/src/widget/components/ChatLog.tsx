/** Conversation transcript: messages, grouped tool calls, streamed text and notes. */

import type { StoredMessage } from "../../protocol";
import type { ToolChip } from "../lib/types";
import { Icon } from "../ui/icons";
import { Markdown } from "./Markdown";
import { ToolGroup } from "./ToolGroup";

export interface ChatLogProps {
	messages: StoredMessage[];
	tools: ToolChip[];
	stream: string;
	note: string;
	error: string;
	onCopy(text: string): void;
	onEdit(text: string): void;
	/** Revert a content change that this answer made. */
	onUndoChange(changeId: string): void;
}

type Row =
	| { key: string; kind: "user"; message: StoredMessage }
	| { key: string; kind: "assistant"; message: StoredMessage }
	| { key: string; kind: "tools"; chips: ToolChip[] };

/**
 * Stored transcript → render rows. Consecutive tool messages collapse into a
 * single summary row (`ToolGroup`), so a 17-call turn costs one line instead of
 * seventeen; expanding the row reveals the individual calls.
 */
function buildRows(messages: StoredMessage[]): Row[] {
	const rows: Row[] = [];
	let chips: ToolChip[] = [];
	let seq = 0;
	const flush = () => {
		if (!chips.length) return;
		rows.push({ key: `g${seq++}`, kind: "tools", chips });
		chips = [];
	};
	for (const message of messages) {
		if (message.role === "tool") {
			const failed = message.text.startsWith("HATA:");
			chips.push({
				callId: `stored-${seq}-${chips.length}`,
				name: message.toolName ?? "araç",
				args: null,
				ok: !failed,
				summary: message.text,
				running: false,
			});
			continue;
		}
		flush();
		rows.push(
			message.role === "user"
				? { key: `m${seq++}`, kind: "user", message }
				: { key: `m${seq++}`, kind: "assistant", message },
		);
	}
	flush();
	return rows;
}

export function ChatLog({ messages, tools, stream, note, error, onCopy, onEdit, onUndoChange }: ChatLogProps) {
	return (
		<div className="t-log">
			{error ? <div className="t-err">{error}</div> : null}

			{buildRows(messages).map((row) => {
				if (row.kind === "tools") return <ToolGroup chips={row.chips} key={row.key} />;
				const message = row.message;
				if (row.kind === "assistant") {
					return (
						<div className="t-bot" key={row.key}>
							<Markdown text={message.text} onCopy={onCopy} />
						</div>
					);
				}
				return (
					<div className="t-user" key={row.key}>
						<div className="t-bub">{message.text}</div>
						<div className="t-meta">
							{message.changeIds?.length ? (
								<button
									type="button"
									className="t-undo"
									title="Undo the content change made by this message"
									onClick={() => onUndoChange(message.changeIds![0]!)}
								>
									<Icon name="undo" />
									<span>Undo</span>
								</button>
							) : null}
							<button type="button" className="t-mini" title="Copy" onClick={() => onCopy(message.text)}>
								<Icon name="copy" />
							</button>
							<button type="button" className="t-mini" title="Edit" onClick={() => onEdit(message.text)}>
								<Icon name="pencil" />
							</button>
						</div>
					</div>
				);
			})}

			{tools.length ? <ToolGroup chips={tools} /> : null}

			{stream ? (
				<div className="t-bot">
					<Markdown text={stream} onCopy={onCopy} />
				</div>
			) : null}
			{note ? <div className="t-note">{note}</div> : null}
		</div>
	);
}
