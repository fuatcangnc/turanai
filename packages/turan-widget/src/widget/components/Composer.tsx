/** Composer: message box, selection chips, action row and its popovers. */

import type { Selection } from "../frame";
import type { ModelEntry } from "../lib/models";
import type { StatusResponse } from "../../protocol";
import { Icon, IconButton } from "../ui/icons";

export interface ComposerProps {
	draft: string;
	onDraft(value: string): void;
	onSend(): void;
	/** One-click translate into the current page's locale. */
	onQuickTranslate(): void;
	/** Locale code of the page on screen (shown on the chip). */
	quickLocale: string;
	/** Show the quick-translate chip only when an element/range is selected. */
	hasSelection: boolean;
	/** Stop the running turn. */
	onStop(): void;
	busy: boolean;
	onNewSession(): void;
	onRefreshSessions(): void;
	selections: Selection[];
	onRemoveSelection(el: Element): void;
	selMode: boolean;
	onToggleSelMode(): void;
	model: ModelEntry;
	status: StatusResponse | null;
	selectedModelLabel: string;
	/** Active target language of the AI theme translation (e.g. "en"). */
	languageCode: string;
	/** When the history rail is hidden, the clock popover stays available. */
	showClockButton: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
	draft,
	onDraft,
	onSend,
	onQuickTranslate,
	quickLocale,
	hasSelection,
	onStop,
	busy,
	onNewSession,
	onRefreshSessions,
	selections,
	onRemoveSelection,
	selMode,
	onToggleSelMode,
	model,
	status,
	selectedModelLabel,
	languageCode,
	showClockButton,
	textareaRef,
}: ComposerProps) {
	return (
		<div className="t-composer">
			{selections.length > 0 ? (
				<div className="t-sels">
					{selections.map((s) => (
						<span className="t-selchip" key={s.path + s.label} title={s.path}>
							<span>
								{s.label}
								{s.text ? ` · ${s.text.slice(0, 18)}${s.text.length > 18 ? "…" : ""}` : ""}
							</span>
							<button type="button" title="Remove" onClick={() => onRemoveSelection(s.el)}>
								<Icon name="close" />
							</button>
						</span>
					))}
				</div>
			) : null}

			<textarea
				ref={textareaRef}
				rows={1}
				placeholder="Ask for the next changes"
				value={draft}
				onChange={(e) => onDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						onSend();
					}
				}}
			/>

			<div className="t-row">
				<IconButton icon="plus" label="New chat" onClick={onNewSession} />
				{showClockButton ? (
					<IconButton
						icon="clock"
						label="Conversations"
						extra={{ popoverTarget: "t-session-menu", "aria-haspopup": "dialog" }}
						onClick={onRefreshSessions}
					/>
				) : null}
				{hasSelection ? (
					<button
						type="button"
						className="t-quick"
						title={`Translate the selection into ${quickLocale.toUpperCase()} (this page's language)`}
						onClick={() => onQuickTranslate()}
					>
						<Icon name="globe" />
						Translate {quickLocale.toUpperCase()}
					</button>
				) : null}
				<div className="t-center">
					<button
						type="button"
						className="t-model t-model--inline"
						title="Site language and AI translation"
						popoverTarget="t-lang-menu"
						aria-haspopup="dialog"
					>
						<Icon name="globe" />
						<span>{languageCode.toUpperCase()}</span>
						<Icon name="chevron" />
					</button>
					<button type="button" className="t-model t-model--inline" title="Choose model" popoverTarget="t-model-menu" aria-haspopup="dialog">
						<span>{model.provider ? selectedModelLabel : "Auto"}</span>
						<Icon name="chevron" />
					</button>
				</div>
				<IconButton icon="cursor" label="Pick an element" active={selMode} onClick={onToggleSelMode} />
				{busy ? (
					<button type="button" className="t-send t-stop" title="Stop" aria-label="Stop the running turn" onClick={() => onStop()}>
						<Icon name="stop" />
					</button>
				) : (
					<button type="button" className="t-send" title="Send" onClick={() => onSend()}>
						<Icon name="up" />
					</button>
				)}
			</div>
		</div>
	);
}
