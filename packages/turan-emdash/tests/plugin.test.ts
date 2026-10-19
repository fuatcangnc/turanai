import { afterEach, describe, expect, it } from "vitest";

import { createPluginTestHost, type PluginTestHost } from "@emdash-cms/plugin-test";

let host: PluginTestHost | undefined;

afterEach(async () => {
	await host?.dispose();
	host = undefined;
});

describe("turan sandbox plugin", () => {
	it("reports provider status through the route", async () => {
		host = await createPluginTestHost();
		const result = (await host.invokeRoute("status")) as {
			providers: { anthropic: boolean; openai: boolean };
			hosts: string[];
		};
		expect(result.providers.anthropic).toBe(false);
		expect(result.providers.openai).toBe(false);
		expect(result.hosts).toContain("api.anthropic.com");
	});

	it("lists sessions from storage (empty on a fresh install)", async () => {
		host = await createPluginTestHost();
		const result = (await host.invokeRoute("sessions/list")) as { sessions: unknown[] };
		expect(Array.isArray(result.sessions)).toBe(true);
	});
});
