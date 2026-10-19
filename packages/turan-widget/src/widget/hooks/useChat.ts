/**
 * Chat session state: transcript, agent run polling, session list and undo.
 * All HTTP goes through `../api`; the component layer only renders.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { SessionSummary, StatusResponse, StoredMessage, TuranEvent } from "../../protocol";
import { api } from "../api";
import type { ModelEntry } from "../lib/models";
import type { ToolChip } from "../lib/types";
import { KEY_RUN, sessionStore } from "../lib/widget-store";

export interface ChatApi {
	messages: StoredMessage[];
	stream: string;
	tools: ToolChip[];
	note: string;
	error: string;
	busy: boolean;
	sessions: SessionSummary[];
	activeSessionId: string | null;
	draft: string;
	setDraft(value: string): void;
	setError(value: string): void;
	/** Send the draft, or a provided message (e.g. the AI translation prompt). */
	send(text?: string): void;
	/** Ask the running turn to stop at the next step boundary. */
	stop(): void;
	openSession(id: string | null): void;
	refreshSessions(): void;
	/** Revert one recorded change (or the most recent one when omitted). */
	undo(changeId?: string): void;
}

export interface ChatOptions {
	model: ModelEntry;
	status: StatusResponse | null;
	/** Selection context block prepended to the outgoing message. */
	contextBlock(): string;
	/** How many elements are currently attached to the message. */
	selectedCount(): number;
	/** Called when the message is dispatched (clears the selection chips). */
	onSent(): void;
	/** Called after a run that published/unpublished content. */
	onContentChanged(): void;
}

export function useChat({ model, contextBlock, selectedCount, onSent, onContentChanged }: ChatOptions): ChatApi {
	const [messages, setMessages] = useState<StoredMessage[]>([]);
	const [stream, setStream] = useState("");
	const [tools, setTools] = useState<ToolChip[]>([]);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");

	const sessionId = useRef<string | null>(null);
	const runId = useRef<string | null>(null);
	const cursor = useRef(0);
	const poll = useRef<ReturnType<typeof setInterval> | null>(null);
	const startedAt = useRef(0);
	const lastEventAt = useRef(0);
	const contentChanged = useRef(false);
	/** A file tool ran during this turn (theme source edit → refresh previews). */
	const filesChanged = useRef(false);

	const stopPoll = useCallback(() => {
		if (poll.current) {
			clearInterval(poll.current);
			poll.current = null;
		}
	}, []);

	useEffect(() => stopPoll, [stopPoll]);

	const renderStored = useCallback((stored: StoredMessage[]) => {
		// Tool rows are kept: ChatLog collapses consecutive calls into one group.
		setMessages(stored);
		setTools([]);
		setStream("");
	}, []);

	const startPoll = useCallback(() => {
		stopPoll();
		const applyEvent = (evt: TuranEvent) => {
			if (evt.type === "assistant_text_delta") setStream((s) => s + evt.text);
			else if (evt.type === "tool_started")
				setTools((t) => [...t, { callId: evt.callId, name: evt.name, args: evt.args, running: true }]);
			else if (evt.type === "tool_done") {
				if ((evt.name === "content_publish" || evt.name === "content_unpublish") && evt.ok) contentChanged.current = true;
				if (evt.ok && (evt.name === "edit_file" || evt.name === "write_file" || evt.name === "install_packages")) filesChanged.current = true;
				setTools((t) => t.map((c) => (c.callId === evt.callId ? { ...c, running: false, ok: evt.ok, summary: evt.summary } : c)));
			} else if (evt.type === "run_error") setError(evt.message);
		};

		poll.current = setInterval(() => {
			const sid = sessionId.current;
			if (!sid) return;
			// A stalled run (no events for 3 minutes) must not lock the composer.
			if (lastEventAt.current && Date.now() - lastEventAt.current > 180_000) {
				stopPoll();
				setBusy(false);
				setError("Koşu 3 dakikadır ilerlemiyor (zaman aşımı). Tekrar deneyin.");
				return;
			}
			api
				.events({ sessionId: sid, runId: runId.current ?? undefined, cursor: cursor.current })
				.then((res) => {
					lastEventAt.current = Date.now();
					if (res.runId) runId.current = res.runId;
					res.events.forEach(applyEvent);
					cursor.current = res.cursor;
					if (!res.done) return;
					stopPoll();
					setBusy(false);
					const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
					setNote(`Done · ${secs}s`);
					setStream("");
					sessionStore(KEY_RUN, null);
					if (contentChanged.current || filesChanged.current) {
						const fileOnly = !contentChanged.current && filesChanged.current;
						contentChanged.current = false;
						filesChanged.current = false;
						// Reload canvas previews so edits are visible immediately.
						// Vite may still be compiling the changed file, so file edits
						// refresh once more shortly after.
						onContentChanged();
						if (fileOnly) setTimeout(() => onContentChanged(), 1200);
					}
					api.session(sid).then((d) => renderStored(d.session.messages)).catch(() => undefined);
					api.sessions().then((d) => setSessions(d.sessions)).catch(() => undefined);
				})
				.catch((err: Error) => {
					stopPoll();
					setBusy(false);
					setError(err.message);
				});
		}, 350);
	}, [onContentChanged, renderStored, stopPoll]);

	// A dev-server reload (HMR fires whenever the agent writes a .astro file)
	// must not lose the run: reattach, replay the events from the start and keep
	// polling, so the transcript and the live tool group come back.
	useEffect(() => {
		const raw = sessionStore(KEY_RUN);
		if (!raw) return;
		try {
			const saved = JSON.parse(raw) as { sessionId?: string; runId?: string; at?: number };
			if (!saved.sessionId || Date.now() - (saved.at ?? 0) > 15 * 60_000) {
				sessionStore(KEY_RUN, null);
				return;
			}
			sessionId.current = saved.sessionId;
			runId.current = saved.runId ?? null;
			cursor.current = 0;
			startedAt.current = saved.at ?? Date.now();
			setActiveSessionId(saved.sessionId);
			setBusy(true);
			setNote("Reattached to the running task…");
			api.session(saved.sessionId).then((d) => renderStored(d.session.messages)).catch(() => undefined);
			startPoll();
		} catch {
			sessionStore(KEY_RUN, null);
		}
	}, [renderStored, startPoll]);

	const send = useCallback(
		(override?: string) => {
			const text = (override ?? draft).trim();
			if (!text || busy) return;
			const picked = selectedCount();
			// Selection context + [SCOPE] must travel with ready-made actions too,
			// otherwise the agent translates a guessed element instead of the picked one.
			const body = contextBlock() + text;
			if (!override) setDraft("");
			setError("");
			setNote("");
			setBusy(true);
			onSent();
		setMessages((m) => [...m, { role: "user", text: picked ? `${text}  ·  ${picked} öğe` : text, ts: new Date().toISOString() }]);
		startedAt.current = Date.now();
		lastEventAt.current = Date.now();
		api
			.prompt({
				message: body,
				sessionId: sessionId.current ?? undefined,
				provider: model.provider ?? undefined,
				model: model.model ?? undefined,
			})
			.then((d) => {
				sessionId.current = d.sessionId;
				setActiveSessionId(d.sessionId);
				runId.current = d.runId;
				cursor.current = 0;
				sessionStore(KEY_RUN, JSON.stringify({ sessionId: d.sessionId, runId: d.runId, at: Date.now() }));
				startPoll();
			})
			.catch((err: Error) => {
				setBusy(false);
				setError(err.message);
			});
	}, [busy, contextBlock, draft, model, onSent, selectedCount, startPoll]);

	const stop = useCallback(() => {
		const sid = sessionId.current;
		if (!sid) return;
		setNote("Stopping…");
		api.stop(sid).catch((err: Error) => setError(err.message));
	}, []);

	const openSession = useCallback(
		(id: string | null) => {
			stopPoll();
			setBusy(false);
			setStream("");
			setTools([]);
			setError("");
			setNote("");
			cursor.current = 0;
			runId.current = null;
			sessionId.current = id;
			setActiveSessionId(id);
			if (!id) {
				setMessages([]);
				return;
			}
			api.session(id).then((d) => renderStored(d.session.messages)).catch((err: Error) => setError(`Sohbet yüklenemedi: ${err.message}`));
		},
		[renderStored, stopPoll],
	);

	const refreshSessions = useCallback(() => {
		api.sessions().then((d) => setSessions(d.sessions)).catch(() => undefined);
	}, []);

	const undo = useCallback(
		(changeId?: string) => {
			api
				.undo(changeId)
				.then((res) => {
					if (!res.ok) {
						setError(res.error ?? "Undo failed.");
						return;
					}
					setError("");
					setNote(res.live ? "Undone and published" : "Undone");
					const undone = res.changeId ?? changeId;
					setMessages((rows) =>
						rows.map((m) =>
							undone && m.changeIds?.includes(undone)
								? { ...m, changeIds: m.changeIds.filter((id) => id !== undone) }
								: m,
						),
					);
					onContentChanged();
				})
				.catch((err: Error) => setError(err.message));
		},
		[onContentChanged],
	);

	return {
		messages,
		stream,
		tools,
		note,
		error,
		busy,
		sessions,
		activeSessionId,
		draft,
		setDraft,
		setError,
		send,
		stop,
		openSession,
		refreshSessions,
		undo,
	};
}
