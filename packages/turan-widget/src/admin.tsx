/** Turan admin chat panel (React) for the trusted widget plugin. */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { API_BASE, type EventsResponse, type SessionSummary, type StatusResponse, type StoredMessage } from "./protocol";

async function api<T>(route: string, body: unknown = {}): Promise<T> {
	const res = await fetch(`${API_BASE}/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
		credentials: "same-origin",
		body: JSON.stringify(body),
	});
	let payload: { success?: boolean; data?: T; error?: { message?: string } };
	try {
		payload = await res.json();
	} catch {
		throw new Error(`${route}: HTTP ${res.status}`);
	}
	if (!payload.success) throw new Error(payload.error?.message ?? `${route} failed`);
	return payload.data as T;
}

interface Chip {
	callId: string;
	name: string;
	args: unknown;
	state: "running" | "ok" | "error";
	summary: string;
}

const styles: Record<string, CSSProperties> = {
	wrap: { display: "flex", height: "calc(100vh - 140px)", minHeight: 480, gap: 12 } as CSSProperties,
	side: { width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 },
	list: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, flex: 1 },
	item: { padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, border: "1px solid rgba(128,128,128,0.25)", background: "transparent", textAlign: "start" as const },
	itemOn: { background: "rgba(128,128,128,0.18)" },
	main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, overflow: "hidden" },
	head: { padding: "10px 14px", borderBottom: "1px solid rgba(128,128,128,0.25)", fontSize: 13, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },
	log: { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
	bubUser: { alignSelf: "flex-end", maxWidth: "80%", padding: "8px 12px", borderRadius: 12, background: "#2563eb", color: "#fff", fontSize: 14, whiteSpace: "pre-wrap" as const },
	bubBot: { alignSelf: "flex-start", maxWidth: "85%", fontSize: 14, whiteSpace: "pre-wrap" as const, lineHeight: 1.5 },
	chip: { fontSize: 12, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 8, padding: "4px 8px" },
	composer: { display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(128,128,128,0.25)" },
	input: { flex: 1, resize: "none" as const, padding: 10, borderRadius: 8, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", font: "inherit" },
	btn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: 14 },
	ghost: { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 13 },
	warn: { padding: "8px 14px", background: "rgba(234,179,8,0.15)", borderBottom: "1px solid rgba(234,179,8,0.4)", fontSize: 13 },
};

function TuranAdminChat() {
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
	const [stream, setStream] = useState("");
	const [chips, setChips] = useState<Chip[]>([]);
	const [busy, setBusy] = useState(false);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [status, setStatus] = useState<StatusResponse | null>(null);
	const cursor = useRef(0);
	const runId = useRef<string | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const logRef = useRef<HTMLDivElement | null>(null);

	const refresh = useCallback(() => {
		api<{ sessions: SessionSummary[] }>("sessions/list").then((d) => setSessions(d.sessions)).catch(() => undefined);
	}, []);

	useEffect(() => {
		api<StatusResponse>("status").then(setStatus).catch(() => undefined);
		refresh();
		return () => {
			if (timer.current) clearInterval(timer.current);
		};
	}, [refresh]);

	useEffect(() => {
		logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
	}, [messages, stream, chips]);

	const stop = useCallback(() => {
		if (timer.current) {
			clearInterval(timer.current);
			timer.current = null;
		}
	}, []);

	const loadSession = useCallback(
		async (id: string | null) => {
			stop();
			setBusy(false);
			setSessionId(id);
			setStream("");
			setChips([]);
			setError("");
			cursor.current = 0;
			runId.current = null;
			if (!id) {
				setMessages([]);
				return;
			}
			const { session } = await api<{ session: { messages: StoredMessage[] } }>("session/get", { sessionId: id });
			setMessages(session.messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as "user" | "assistant", text: m.text })));
		},
		[stop],
	);

	const poll = useCallback(
		(sid: string) => {
			stop();
			timer.current = setInterval(async () => {
				try {
					const res = await api<EventsResponse>("events", { sessionId: sid, runId: runId.current ?? undefined, cursor: cursor.current });
					if (res.runId) runId.current = res.runId;
					for (const evt of res.events) {
						if (evt.type === "assistant_text_delta") setStream((t) => t + evt.text);
						else if (evt.type === "tool_started") setChips((c) => [...c, { callId: evt.callId, name: evt.name, args: evt.args, state: "running", summary: "" }]);
						else if (evt.type === "tool_done")
							setChips((c) => c.map((chip) => (chip.callId === evt.callId ? { ...chip, state: evt.ok ? "ok" : "error", summary: evt.summary } : chip)));
						else if (evt.type === "run_error") setError(evt.message);
					}
					cursor.current = res.cursor;
					if (res.done) {
						stop();
						setBusy(false);
						setStream("");
						await loadSession(sid);
						refresh();
					}
				} catch (err) {
					stop();
					setBusy(false);
					setError((err as Error).message);
				}
			}, 350);
		},
		[loadSession, refresh, stop],
	);

	const send = useCallback(async () => {
		const text = draft.trim();
		if (!text || busy) return;
		setDraft("");
		setError("");
		setBusy(true);
		setChips([]);
		setStream("");
		setMessages((m) => [...m, { role: "user", text }]);
		try {
			const res = await api<{ sessionId: string; runId: string }>("prompt", { message: text, sessionId: sessionId ?? undefined });
			setSessionId(res.sessionId);
			runId.current = res.runId;
			cursor.current = 0;
			poll(res.sessionId);
		} catch (err) {
			setBusy(false);
			setError((err as Error).message);
		}
	}, [busy, draft, poll, sessionId]);

	const noKeys = status && !status.providers.anthropic && !status.providers.openai;
	const modelLabel = useMemo(() => {
		if (!status) return "";
		return `${status.settings.provider ?? "auto"}${status.settings.model ? ` · ${status.settings.model}` : ""}`;
	}, [status]);

	return (
		<div>
			<h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Turan AI</h1>
			<div style={styles.wrap}>
				<aside style={styles.side}>
					<button type="button" style={styles.ghost} onClick={() => void loadSession(null)}>
						+ Yeni sohbet
					</button>
					<div style={styles.list}>
						{sessions.map((s) => (
							<button
								key={s.id}
								type="button"
								style={{ ...styles.item, ...(s.id === sessionId ? styles.itemOn : {}) }}
								onClick={() => void loadSession(s.id)}
								title={s.title}
							>
								{s.title}
							</button>
						))}
					</div>
				</aside>
				<section style={styles.main}>
					<header style={styles.head}>
						<strong>Turan</strong>
						<span style={{ opacity: 0.7 }}>{modelLabel}</span>
						<span style={{ opacity: 0.7 }}>{status?.dev ? "dev · dosya araçları açık" : "prod · yalnız içerik"}</span>
					</header>
					{noKeys ? <div style={styles.warn}>API anahtarı yok. Plugins → Turan AI ayarlarından ekleyin (veya ANTHROPIC_API_KEY / OPENAI_API_KEY).</div> : null}
					<div ref={logRef} style={styles.log}>
						{messages.map((m, i) =>
							m.role === "user" ? (
								<div key={i} style={styles.bubUser}>
									{m.text}
								</div>
							) : (
								<div key={i} style={styles.bubBot}>
									{m.text}
								</div>
							),
						)}
						{chips.map((chip) => (
							<details key={chip.callId} style={{ ...styles.chip, opacity: chip.state === "running" ? 0.7 : 1 }}>
								<summary>
									{chip.state === "running" ? "⏳" : chip.state === "ok" ? "✓" : "✗"} {chip.name}
								</summary>
								<pre style={{ margin: "6px 0 0", fontSize: 11, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap" }}>
									{JSON.stringify(chip.args, null, 1)}
									{chip.summary ? `\n→ ${chip.summary}` : ""}
								</pre>
							</details>
						))}
						{stream ? <div style={styles.bubBot}>{stream}</div> : busy && !stream ? <div style={{ ...styles.bubBot, opacity: 0.6 }}>…</div> : null}
						{error ? <div style={{ color: "#dc2626", fontSize: 13 }}>Hata: {error}</div> : null}
					</div>
					<footer style={styles.composer}>
						<textarea
							style={styles.input}
							rows={2}
							value={draft}
							placeholder="Turan'dan bir değişiklik iste… (Enter gönderir)"
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									void send();
								}
							}}
						/>
						<button type="button" style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void send()}>
							{busy ? "…" : "Gönder"}
						</button>
					</footer>
				</section>
			</div>
		</div>
	);
}

export const pages = {
	"/": TuranAdminChat,
};
