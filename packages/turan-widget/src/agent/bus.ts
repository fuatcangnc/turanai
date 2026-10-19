/**
 * In-memory run/event bus plus a live session cache. Module state lives on
 * `globalThis` because Vite duplicates modules across SSR chunks.
 */

import type { TuranEvent, TuranSession } from "../protocol";

const BUS_KEY = Symbol.for("turan.widget.bus.v1");
const MAX_EVENTS_PER_RUN = 5_000;

interface RunState {
	sessionId: string;
	events: TuranEvent[];
	dropped: number;
	done: boolean;
}

interface BusState {
	runs: Map<string, RunState>;
	lastRun: Map<string, string>;
	sessions: Map<string, TuranSession>;
}

function bus(): BusState {
	const g = globalThis as Record<symbol, BusState | undefined>;
	let state = g[BUS_KEY];
	if (!state) {
		state = { runs: new Map(), lastRun: new Map(), sessions: new Map() };
		g[BUS_KEY] = state;
	}
	return state;
}

export function createRun(runId: string, sessionId: string): void {
	const state = bus();
	if (state.runs.size > 50) {
		for (const [id, run] of state.runs) {
			if (run.done) state.runs.delete(id);
			if (state.runs.size <= 40) break;
		}
	}
	state.runs.set(runId, { sessionId, events: [], dropped: 0, done: false });
	state.lastRun.set(sessionId, runId);
}

export function appendEvent(runId: string, event: TuranEvent): void {
	const run = bus().runs.get(runId);
	if (!run || run.done) return;
	run.events.push(event);
	if (run.events.length > MAX_EVENTS_PER_RUN) {
		const excess = run.events.length - MAX_EVENTS_PER_RUN;
		run.events.splice(0, excess);
		run.dropped += excess;
	}
}

export function finishRun(runId: string): void {
	const run = bus().runs.get(runId);
	if (run) run.done = true;
}

export function readRun(runId: string, cursor: number): { events: TuranEvent[]; cursor: number; done: boolean } | null {
	const run = bus().runs.get(runId);
	if (!run) return null;
	const start = Math.max(0, cursor - run.dropped);
	return { events: run.events.slice(start), cursor: run.dropped + run.events.length, done: run.done };
}

export function isRunning(sessionId: string): boolean {
	const state = bus();
	const runId = state.lastRun.get(sessionId);
	if (!runId) return false;
	const run = state.runs.get(runId);
	return run !== undefined && !run.done;
}

export function lastRunId(sessionId: string): string | undefined {
	return bus().lastRun.get(sessionId);
}

export function putSession(session: TuranSession): void {
	bus().sessions.set(session.id, session);
}

export function getSession(sessionId: string): TuranSession | undefined {
	return bus().sessions.get(sessionId);
}

export function allSessions(): TuranSession[] {
	return [...bus().sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteSessionLive(sessionId: string): void {
	bus().sessions.delete(sessionId);
}

/** Runs the user asked to stop (checked between steps and tool calls). */
const stopRequests = new Set<string>();

export function requestStop(runId: string): void {
	stopRequests.add(runId);
}

export function isStopRequested(runId: string): boolean {
	return stopRequests.has(runId);
}

export function clearStop(runId: string): void {
	stopRequests.delete(runId);
}
