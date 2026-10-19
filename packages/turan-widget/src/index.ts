/**
 * Turan widget plugin — trusted native companion (id: `turan-widget`).
 *
 * Provides the in-page React widget (launcher, drawer, AI-mode canvas, element
 * picker) through the `page:fragments` hook plus dev-only file tools. EmDash
 * reserves fragments, React admin code and host-process access for trusted
 * plugins, so this package is a site dependency rather than a registry plugin;
 * the sandbox-compatible core lives in `turan-emdash`.
 */

import { definePlugin, type PageFragmentContribution, type PageFragmentEvent, type PageMetadataEvent, type PluginContext, type PluginDescriptor, type ResolvedPlugin, type RouteContext } from "emdash";

import { allSessions, createRun, deleteSessionLive, getSession, isRunning, lastRunId, putSession, readRun, requestStop } from "./agent/bus";
import { editProjectFile, isDevServer, readProjectFile } from "./agent/files";
import { runAgent } from "./agent/loop";
import { undoLastChange } from "./agent/tools";
import { defaultCode, localePath, siteLocales, stripLocale, switcherHtml } from "./i18n";
import { MEDIA_PREFIX, mediaKey, mediaMapFor, mediaMapHtml, setMediaRecord, type MediaI18nRecord } from "./media-i18n";
import { listTranslations } from "./translations";
import {
	eventsInputSchema,
	mediaListInputSchema,
	mediaRemoveInputSchema,
	mediaSetInputSchema,
	promptInputSchema,
	localeDefaultSchema,
	sessionGetInputSchema,
	runStopSchema,
	translationsInputSchema,
	translationsPublishSchema,
	undoInputSchema,
	type EventsInput,
	type LocaleDefaultInput,
	type MediaListInput,
	type MediaRemoveInput,
	type MediaSetInput,
	type PromptInput,
	type RunStopInput,
	type SessionSummary,
	type StatusResponse,
	type TranslationsInput,
	type TranslationsPublishInput,
	type TuranSession,
} from "./protocol";
import { TURAN_WIDGET_BUNDLE } from "./widget-bundle.generated";

const PLUGIN_ID = "turan-widget";
const VERSION = "0.1.0";

/**
 * Route inputs are validated by the host with the schema object we hand it at
 * runtime; the cast isolates a zod minor-version drift between this package
 * and `emdash`'s bundled copy, which only affects the type-level instance.
 */
const routeInput = (schema: unknown): never => schema as never;

const now = () => new Date().toISOString();

function summaryOf(session: TuranSession): SessionSummary {
	return { id: session.id, title: session.title, updatedAt: session.updatedAt, messageCount: session.messages.length };
}

type SessionInput = { sessionId: string };

/** Native implementation loaded through the descriptor's `entrypoint`. */
export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: PLUGIN_ID,
		version: VERSION,
		capabilities: ["content:read", "content:write", "content:publish", "schema:read", "media:read", "network:request", "hooks.page-fragments:register"],
		allowedHosts: ["api.anthropic.com", "api.openai.com", "evren-llmapi.ssyz.org.tr"],

		hooks: {
			"plugin:activate": {
				handler: async (_event, ctx) => {
					ctx.log.info("Turan widget enabled", { version: VERSION, dev: isDevServer() });
				},
			},
			// Injects the built React widget; it self-gates on the private
			// `status` route, so visitors never see it. When the site configures
			// Astro i18n, a self-mounting language switcher rides along (no theme
			// markup required).
			"page:fragments": {
				handler: async (event: PageFragmentEvent, ctx: PluginContext) => {
					const fragments: PageFragmentContribution[] = [
						{ kind: "inline-script" as const, placement: "body:end" as const, key: "turan-widget", code: TURAN_WIDGET_BUNDLE },
					];
					const locales = siteLocales();
					const enabled = (await ctx.settings.get<string>("languageSwitcher")) !== "off";
					if (enabled && locales.length > 1) {
						// Content pages: link every locale to its own slug (translation
						// groups), so a translated entry with a different slug is reached
						// directly. Locales without a published translation fall back to
						// the default entry under their prefix.
						const hrefByLocale: Record<string, string> = {};
						const content = event.page.content;
						const contentApi = ctx.content;
						if (content?.collection && content.id && contentApi?.getTranslations) {
							try {
								const { translations } = await contentApi.getTranslations(content.collection, content.id);
								for (const translation of translations) {
									if (!translation.locale || translation.status !== "published") continue;
									const url = await contentApi.getPublicUrl?.(content.collection, translation.id);
									if (url) hrefByLocale[translation.locale] = url;
								}
							} catch (error) {
								ctx.log.warn("turan: translation URLs could not be resolved", { reason: (error as Error).message });
							}
						}
						fragments.push({
							kind: "html" as const,
							placement: "body:end" as const,
							key: "turan-lang-switcher",
							html: switcherHtml({ path: event.page.path, locale: event.page.locale }, locales, hrefByLocale),
						});

						// Media i18n: localized alt text, captions and file variants.
						const locale = event.page.locale ?? defaultCode(locales);
						const mediaHtml = mediaMapHtml(await mediaMapFor(ctx.kv, locale));
						if (mediaHtml) {
							fragments.push({
								kind: "html" as const,
								placement: "body:end" as const,
								key: "turan-media-i18n",
								html: mediaHtml,
							});
						}
					}
					return fragments;
				},
			},

			// hreflang for pages EmDashHead does not cover (no CMS content on the
			// page context). Pages with content are handled upstream from the
			// translation groups, so we stay silent there and never duplicate.
			"page:metadata": {
				handler: async (event: PageMetadataEvent) => {
					const locales = siteLocales();
					if (locales.length <= 1 || event.page.content) return null;
					const origin = /^https?:\/\//.test(event.page.url) ? new URL(event.page.url).origin : null;
					const clean = stripLocale(event.page.path || "/", locales);
					const href = (code: string) => {
						const path = localePath(clean, code, locales);
						return origin ? new URL(path, origin).href : path;
					};
					const links = locales.map((locale) => ({
						kind: "link" as const,
						rel: "alternate" as const,
						hreflang: locale.code,
						href: href(locale.code),
					}));
					links.push({
						kind: "link" as const,
						rel: "alternate" as const,
						hreflang: "x-default",
						href: href(defaultCode(locales)),
					});
					return links;
				},
			},
		},

		routes: {
			// ── Translation lists panel ──
			// ── Stop the running agent at the next step boundary ──
			"run/stop": {
				input: routeInput(runStopSchema),
				handler: async (ctx: RouteContext<RunStopInput>) => {
					const runId = lastRunId(ctx.input.sessionId);
					if (!runId) return { ok: false, reason: "no-run" };
					requestStop(runId);
					return { ok: true, runId };
				},
			},

			"translations/list": {				input: routeInput(translationsInputSchema),
				handler: async (ctx: RouteContext<TranslationsInput>) => {
					const locales = siteLocales();
					const locale = ctx.input.locale ?? defaultCode(locales);
					const data = await listTranslations(ctx, locale, defaultCode(locales));
					return { locale, locales, ...data };
				},
			},

			// ── Default locale (dev): edits astro.config.mjs i18n.defaultLocale.
			// Astro restarts the dev server automatically when the config changes.
			"locale/default": {
				input: routeInput(localeDefaultSchema),
				handler: async (ctx: RouteContext<LocaleDefaultInput>) => {
					if (!isDevServer()) throw new Error("Varsayılan dil yalnız geliştirme sunucusunda değiştirilebilir.");
					const code = ctx.input.code;
					const locales = siteLocales();
					if (!locales.some((locale) => locale.code === code)) {
						throw new Error(`"${code}" yapılandırılmış dillerde yok.`);
					}
					const file = await readProjectFile("astro.config.mjs");
					const match = /defaultLocale:\s*"[^"]+"/.exec(file.content);
					if (!match) throw new Error("astro.config.mjs içinde i18n.defaultLocale bulunamadı.");
					await editProjectFile({
						path: "astro.config.mjs",
						oldString: match[0],
						newString: `defaultLocale: "${code}"`,
					});
					return { ok: true, defaultLocale: code, restarting: true };
				},
			},

			"translations/publish": {				input: routeInput(translationsPublishSchema),
				handler: async (ctx: RouteContext<TranslationsPublishInput>) => {
					const content = ctx.content;
					if (!content?.getVersioned || !content.publish || !content.unpublish) throw new Error("content:read/write yetkisi gerekli.");
					const current = await content.getVersioned(ctx.input.collection, ctx.input.id);
					if (!current) throw new Error("Kayıt bulunamadı.");
					const next = ctx.input.publish
						? await content.publish(ctx.input.collection, ctx.input.id, { _rev: current._rev })
						: await content.unpublish(ctx.input.collection, ctx.input.id, { _rev: current._rev });
					return { ok: true, status: (next.item as { status?: string }).status ?? "unknown" };
				},
			},

			// ── Media internationalization (alt / caption / file variants) ──
			"media/list": {
				input: routeInput(mediaListInputSchema),
				handler: async (ctx: RouteContext<MediaListInput>) => {
					const media = ctx.media;
					if (!media) throw new Error("media:read yetkisi gerekli.");
					const result = await media.list({ limit: ctx.input.limit ?? 100, mimeType: ctx.input.mimeType });
					const items = Array.isArray(result) ? result : ((result as { items?: unknown[] }).items ?? []);
					const translations = (await ctx.kv.list(MEDIA_PREFIX))
						.map((entry) => entry.value as MediaI18nRecord | null)
						.filter((record): record is MediaI18nRecord => Boolean(record?.mediaId));
					return { media: items, translations };
				},
			},

			"media/set": {
				input: routeInput(mediaSetInputSchema),
				handler: async (ctx: RouteContext<MediaSetInput>) => {
					const record = await setMediaRecord(ctx.kv, ctx.media, ctx.input);
					return { record };
				},
			},

			"media/remove": {
				input: routeInput(mediaRemoveInputSchema),
				handler: async (ctx: RouteContext<MediaRemoveInput>) => {
					const deleted = await ctx.kv.delete(mediaKey(ctx.input.mediaId, ctx.input.locale));
					return { deleted };
				},
			},

			prompt: {
				input: routeInput(promptInputSchema),
				handler: async (ctx: RouteContext<PromptInput>) => {
					const { message, sessionId, provider, model } = ctx.input;
					const sid = sessionId ?? crypto.randomUUID();
					let session = getSession(sid);
					if (!session && sessionId) {
						session = (await ctx.kv.get<TuranSession>(`session:${sid}`)) ?? undefined;
						if (session) putSession(session);
					}
					if (sessionId && !session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
					session ??= { id: sid, title: "Yeni sohbet", createdAt: now(), updatedAt: now(), messages: [] };
					if (isRunning(sid)) throw new Error("Bu oturumda zaten çalışan bir istek var.");
					const runId = crypto.randomUUID();
					createRun(runId, sid);
					putSession(session);
					void runAgent({ ctx, session, runId, userText: message, provider, model }).catch((error: unknown) => {
						ctx.log.error("turan background run crashed", { runId, reason: (error as Error).message });
					});
					return { sessionId: sid, runId };
				},
			},

			events: {
				input: routeInput(eventsInputSchema),
				handler: async (ctx: RouteContext<EventsInput>) => {
					const { sessionId, runId, cursor } = ctx.input;
					const target = runId ?? lastRunId(sessionId);
					if (!target) return { events: [], cursor: 0, done: true };
					const run = readRun(target, cursor);
					return run ? { ...run, runId: target } : { events: [], cursor: 0, done: true };
				},
			},

			"sessions/list": {
				handler: async (ctx) => {
					const merged = new Map<string, SessionSummary>();
					for (const entry of await ctx.kv.list("session:")) {
						const session = entry.value as TuranSession | null;
						if (session?.id) merged.set(session.id, summaryOf(session));
					}
					for (const session of allSessions()) merged.set(session.id, summaryOf(session));
					return { sessions: [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
				},
			},

			"session/get": {
				input: routeInput(sessionGetInputSchema),
				handler: async (ctx: RouteContext<SessionInput>) => {
					const { sessionId } = ctx.input;
					const session = getSession(sessionId) ?? (await ctx.kv.get<TuranSession>(`session:${sessionId}`)) ?? null;
					if (!session) throw new Error(`Oturum bulunamadı: ${sessionId}`);
					return { session };
				},
			},

			"session/delete": {
				input: routeInput(sessionGetInputSchema),
				handler: async (ctx: RouteContext<SessionInput>) => {
					const { sessionId } = ctx.input;
					if (isRunning(sessionId)) throw new Error("Çalışan bir istek varken oturum silinemez.");
					deleteSessionLive(sessionId);
					await ctx.kv.delete(`session:${sessionId}`);
					return { deleted: true };
				},
			},

			// Page inventory for the canvas tabs (collections with a URL pattern).
			"pages/list": {
				handler: async (ctx) => {
					const pages: Array<{ url: string; title: string }> = [{ url: "/", title: "Anasayfa" }];
					const content = ctx.content as unknown as {
						list(collection: string, options?: { limit?: number; where?: { status?: string } }): Promise<{ items: Array<{ slug: string | null; data: Record<string, unknown> }> }>;
					} | undefined;
					const schema = ctx.schema as unknown as {
						listCollections(): Promise<Array<{ slug: string; hidden?: boolean; routable?: boolean; urlPattern?: string | null; titleField?: string | null }>>;
					} | undefined;
					if (schema && content) {
						for (const col of await schema.listCollections()) {
							if (col.hidden || !col.routable || !col.urlPattern) continue;
							try {
								const res = await content.list(col.slug, { limit: 10, where: { status: "published" } });
								for (const item of res.items) {
									if (!item.slug) continue;
									const raw = item.data[col.titleField ?? "title"] ?? item.data.title;
									pages.push({
										url: col.urlPattern.replace(/\{slug\}/g, item.slug),
										title: typeof raw === "string" && raw ? raw.slice(0, 60) : item.slug,
									});
								}
							} catch {
								/* a failing collection must not break the list */
							}
						}
					}
					return { pages: pages.slice(0, 40) };
				},
			},

			// Manual undo from the widget UI (no model round-trip). Without a
			// changeId it reverts the most recent change.
			undo: {
				input: routeInput(undoInputSchema),
				handler: async (ctx: RouteContext<{ changeId?: string }>) => {
					try {
						const result = await undoLastChange(ctx, ctx.input?.changeId);
						return {
							ok: true,
							reverted: Boolean(result.reverted),
							live: Boolean(result.live),
							changeId: typeof result.changeId === "string" ? result.changeId : undefined,
							id: typeof result.id === "string" ? result.id : undefined,
						};
					} catch (error) {
						return { ok: false, reverted: false, error: (error as Error).message };
					}
				},
			},

			status: {
				handler: async (ctx) => {
					const [provider, model, language, anthropicKey, openaiKey, evrenKey] = await Promise.all([
						ctx.settings.get<string>("provider"),
						ctx.settings.get<string>("model"),
						ctx.settings.get<string>("language"),
						ctx.settings.get<string>("anthropicApiKey"),
						ctx.settings.get<string>("openaiApiKey"),
						ctx.settings.get<string>("evrenApiKey"),
					]);
					const body: StatusResponse = {
						dev: isDevServer(),
						pluginVersion: VERSION,
						providers: {
							anthropic: Boolean(anthropicKey || process.env.ANTHROPIC_API_KEY),
							openai: Boolean(openaiKey || process.env.OPENAI_API_KEY),
							evren: Boolean(evrenKey || process.env.EVREN_API_KEY),
						},
						settings: { provider, model, language },
						locales: siteLocales(),
					};
					return body;
				},
			},
		},

		admin: {
			entry: "turan-widget/admin",
			pages: [{ path: "/", label: "Turan AI", icon: "chat-circle-text" }],
			settingsSchema: {
				anthropicApiKey: { type: "secret", label: "Anthropic API key", description: "claude-* modelleri için. ANTHROPIC_API_KEY ortam değişkeni de kullanılabilir." },
				openaiApiKey: { type: "secret", label: "OpenAI API key", description: "OPENAI_API_KEY de kullanılabilir." },
				evrenApiKey: { type: "secret", label: "Evren API key", description: "OpenAI-uyumlu Evren ağ geçidi (test). EVREN_API_KEY de kullanılabilir." },
				evrenBaseUrl: { type: "string", label: "Evren base URL", description: "Boş = https://evren-llmapi.ssyz.org.tr/v1 (EVREN_BASE_URL ile de verilebilir)." },
				provider: {
					type: "select",
					label: "Provider",
					options: [
						{ label: "Auto (prefer Anthropic)", value: "" },
						{ label: "Anthropic", value: "anthropic" },
						{ label: "OpenAI", value: "openai" },
						{ label: "Evren", value: "evren" },
					],
				},
				model: { type: "string", label: "Model override", description: "örn. claude-sonnet-4-5, gpt-4.1-mini veya deepseek-v4.1-flash. Boş = varsayılan." },
				maxSteps: {
					type: "string",
					label: "Adım limiti (maxSteps)",
					description:
						"Bir ajan turu için en fazla adım. Boş = 80. Uzun işler (tüm temayı çevirme) için 150-250 uygundur; limit dolunca ajan \"devam et\" ile kaldığı yerden sürdürür.",
				},
				languageSwitcher: {
					type: "select",
					label: "Dil değiştirici + hreflang",
					description:
						"Astro i18n yapılandırıldıysa sayfalara kendini monte eden bir dil değiştirici ekler ve hreflang alternates üretir. Tema dosyası değişmez; dil listesi Astro `i18n.locales` bloğundan okunur.",
					options: [
						{ label: "Açık (varsayılan)", value: "" },
						{ label: "Kapalı", value: "off" },
					],
				},
				language: {
					type: "select",
					label: "Tema dili (AI çeviri)",
					description:
						"Temanın metinleri bu dile çevrilir. Çekmecedeki küre düğmesi → \"Temayı ... diline çevir\" ajanı çalıştırır; ajan metinleri kaynak dosyalarda (components/pages/layouts) günceller. Çalışma anında i18n katmanı yoktur.",
					options: [
						{ label: "English", value: "en" },
						{ label: "Türkçe", value: "tr" },
						{ label: "Deutsch", value: "de" },
						{ label: "Français", value: "fr" },
						{ label: "Español", value: "es" },
					],
				},
			},
		},
	});
}

/** Descriptor for `astro.config.mjs` → `emdash({ plugins: [turanWidget()] })`. */
export default function turanWidget(): PluginDescriptor {
	return {
		id: PLUGIN_ID,
		version: VERSION,
		format: "native",
		entrypoint: "turan-widget",
		adminEntry: "turan-widget/admin",
		capabilities: ["content:read", "content:write", "content:publish", "schema:read", "media:read", "network:request", "hooks.page-fragments:register"],
		allowedHosts: ["api.anthropic.com", "api.openai.com", "evren-llmapi.ssyz.org.tr"],
		adminPages: [{ path: "/", label: "Turan AI", icon: "chat-circle-text" }],
	};
}
