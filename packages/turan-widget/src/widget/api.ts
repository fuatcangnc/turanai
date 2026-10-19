/** Typed client for the widget's private routes. */

import { API_BASE, type EventsResponse, type MediaSetInput, type PromptInput, type SessionSummary, type StatusResponse, type TranslationsResponse, type TuranSession } from "../protocol";

const HEADERS = { "Content-Type": "application/json", "X-EmDash-Request": "1" };

interface Envelope<T> {
	success?: boolean;
	data?: T;
	error?: { message?: string };
}

export async function post<T>(route: string, body: unknown = {}): Promise<T> {
	const res = await fetch(`${API_BASE}/${route}`, {
		method: "POST",
		headers: HEADERS,
		credentials: "same-origin",
		body: JSON.stringify(body),
	});
	let payload: Envelope<T>;
	try {
		payload = (await res.json()) as Envelope<T>;
	} catch {
		throw new Error(`HTTP ${res.status}`);
	}
	if (!res.ok || !payload.success) throw new Error(payload.error?.message ?? `${route} failed`);
	return payload.data as T;
}

export const api = {
	status: () => post<StatusResponse>("status"),
	prompt: (input: PromptInput) => post<{ sessionId: string; runId: string }>("prompt", input),
	events: (input: { sessionId: string; runId?: string; cursor: number }) => post<EventsResponse>("events", input),
	stop: (sessionId: string) => post<{ ok: boolean; runId?: string }>("run/stop", { sessionId }),
	sessions: () => post<{ sessions: SessionSummary[] }>("sessions/list"),
	session: (sessionId: string) => post<{ session: TuranSession }>("session/get", { sessionId }),
	pages: () => post<{ pages: Array<{ url: string; title: string }> }>("pages/list"),
	undo: (changeId?: string) =>
		post<{ ok: boolean; reverted: boolean; live?: boolean; changeId?: string; error?: string }>("undo", changeId ? { changeId } : {}),
	translations: (locale: string) => post<TranslationsResponse>("translations/list", { locale }),
	translationsPublish: (input: { collection: string; id: string; publish: boolean }) =>
		post<{ ok: boolean; status: string }>("translations/publish", input),
	setDefaultLocale: (code: string) => post<{ ok: boolean; defaultLocale: string }>("locale/default", { code }),
	mediaSet: (input: MediaSetInput) => post<{ record: unknown }>("media/set", input),
	mediaRemove: (input: { mediaId: string; locale: string }) => post<{ deleted: boolean }>("media/remove", input),
};
