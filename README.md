# Turan — AI agent for EmDash (sandbox core + React widget)

**English** · [Türkçe](README.tr.md)

Two packages, one product:

| Package | Type | What it provides | Distribution |
|---|---|---|---|
| **`turan-emdash`** | **Sandbox-compatible plugin** (`format:"standard"`) | Block Kit admin chat, `ask` route + **MCP tool**, content tools, sessions in `ctx.storage`, providers via `ctx.http.fetch` | Plugin CLI + registry |
| **`turan-widget`** | **Trusted companion** (native) | In-page **React widget**: ✦ AI launcher, drawer, **AI-mode canvas** (windows), **element picker**, tabs, model picker; dev-only **file tools** | Site dependency (not registry) |

Why two packages: EmDash treats `page:fragments`, React admin code, raw
script/CSS and host-process access as **trusted-only** (see the skill files
`SKILL.md`, `sandbox-boundaries.md`). The overlay/widget can therefore only
live in the native package, while the agent core stays registry-installable in
the sandbox package.

## Widget module map (`packages/turan-widget/src/widget/`)

Component-based; every file has a single responsibility and `App` only composes:

```
main.tsx                 entry: iframe/double-mount guard + React root (styles first)
App.tsx                  composition: wires hooks, lays out components (no UI)
api.ts                   typed HTTP client for the private routes
frame.ts                 iframe binding + selection description/CSS path + context block
styles.ts                widget CSS (single injection)
lib/
  layout.ts              constants (BAR_H, MIN/MAX/DEFAULT_DW, MAX_WINDOWS) + canvas geometry
  models.ts              model catalog (Auto/Claude/GPT/Evren)
  types.ts               Tab, ToolChip, PageItem, SessionItem
  tool-summary.ts        tool-call grouping + argument preview (ellipsis)
  markdown.ts            dependency-free Markdown parser (block + inline tokens)
  widget-store.ts        storage keys, navigateTo, popover closing, window refresh
  popover.ts             useOnPopoverOpen (native popover `toggle` event)
hooks/
  useChat.ts             transcript, agent turn & event polling, sessions, undo
  useWindows.ts          window selection (max 2), ordering (HTML5 DnD), page inventory
  useSelection.ts        element picker: iframe binding, hover/selection, context block
  useSidebar.ts          width + collapse/expand + history preference + geometry
ui/
  icons.tsx              icon set + IconButton
components/
  Launcher.tsx           bottom-left ✦ AI
  Canvas.tsx / Window.tsx  window grid and chrome bar
  CanvasBars.tsx         tabs / navigation / tool rows
  Drawer.tsx             drawer shell (header + two columns + resizer)
  ChatHistory.tsx        left chat-history rail
  ChatLog.tsx            messages, tool groups, streaming, notes
  Markdown.tsx           token → React elements (no raw HTML; code header + copy)
  ToolGroup.tsx          collapsed tool group: one summary row → per-call detail
  Composer.tsx           message box + selection chips + action row
  PageSwitcher.tsx       searchable page switcher popover
  menus.tsx              ModelMenu / SessionMenu / PagesMenu / LanguageMenu
  Resizer.tsx            accessible resize handle
```

## Installation (site side)

```sh
npm i turan-emdash                 # agent core (sandbox-compatible)
npm i turan-widget                 # full in-page widget (trusted companion)
```

```mjs
// astro.config.mjs
import emdash from "emdash/astro";
import turan from "turan-emdash";        // sandbox descriptor (CLI output)
import turanWidget from "turan-widget";  // native widget + file tools

export default defineConfig({
  integrations: [emdash({ /* … */ plugins: [turan, turanWidget()] })],
});
```

- Keys live in **Plugins → Turan AI** settings (encrypted). The widget package
  also reads `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `EVREN_API_KEY`
  environment variables (Node dev does not load `.env` automatically: start
  with `set -a; . ./.env; set +a`). The sandbox package reads **settings only**
  (`process.env` is unavailable).
- **Evren (test model):** the model menu ships **Evren · DeepSeek V4.1 Flash**
  (`evren` / `deepseek-v4.1-flash`); Evren is an OpenAI-compatible gateway
  (`EVREN_BASE_URL`, default `https://evren-llmapi.ssyz.org.tr/v1`) and is in
  both plugins' `allowedHosts` lists.
- Sites that only want the sandbox package (registry install) skip the widget;
  for the bottom-left launcher, use the site-code component that ships with the
  package:

```astro
---
import TuranLauncher from "turan-emdash/launcher.astro";
---
<TuranLauncher />
```

> `turan-emdash/widget.astro` mounts the full widget bundle explicitly (requires
> `turan-widget`; renders nothing when it is absent).

## Capabilities

**Widget (trusted):** bottom-left ✦ AI → drawer; in AI mode the page sits in a
window with a chrome bar (live iframe), other tabs as preview windows (max two
windows; reorder by **drag & drop** on the chrome); the element picker builds a
`[SECLI_OGELER]` context from the iframe DOM; the model picker overrides
provider+model per request (including the `Evren · DeepSeek V4.1 Flash` test
entry); **resizable sidebar** (below); in `astro dev`, `read_file` /
`edit_file` / `write_file` / `list_files` / `grep` (allowlist + `.env`/`data.db`
blocked).

**Markdown answers:** the agent's reply is rendered, not dumped as plain text —
headings, **bold**/*italic*, inline `code`, fenced code blocks (language label +
**Copy** button), ordered/unordered lists, quotes and links. The parser is
dependency-free (`lib/markdown.ts`) and **never emits raw HTML**: every token
becomes a React text element, and only `http(s)/mailto/tel//#` links become
clickable. The same renderer runs during streaming (including an unfinished code
block).

**Scrollbars:** every scroll container the widget owns (chat log, history rail,
menus, page list, code blocks) is thin + rounded in the **accent colour**
(`rgba(143,182,255,.42)`, hover `#8fb6ff`); the site itself uses the brand
orange (`--primary`). Note: `::-webkit-scrollbar` rules cannot be written as a
comma-separated selector list — Chromium applies the rule to *every* selector in
the list (dropping the pseudo); `styles.ts` therefore repeats the pseudo for
each selector (`scrollersWith()`).

**Theme language and AI translation (no runtime i18n):** the target language
lives in **settings** — Admin → Plugins → Turan AI → *Theme language (AI
translation)* (`en/tr/de/fr/es`) — and is also selectable from the drawer's 🌐
button. Two actions run the agent:

- **Translate the theme into …:** all theme text (`src/layouts`,
  `src/components`, `src/pages`, `src/data`) into the target language,
- **Translate components only (safe):** `src/components` only (finishes in one
  turn).

The agent edits text **in the source files** with `edit_file`; components stay
plain Astro and no dictionary/runtime layer is needed. The prompt forbids
rewriting files with `write_file`, asks the agent to verify each file's tail is
intact (hard rule after one truncation incident) and updates `<html lang>`.
EmDash i18n note: never use `prefixDefaultLocale` / `prefix-always` in
`i18n.routing` — `/_emdash/admin` routes return 404.

**Multilingual routing + hreflang (theme-agnostic):** when the site defines the
Astro `i18n` block in `astro.config.mjs` (EmDash reads the same block via
`getI18nConfig()`), the widget does two things **without touching theme files**:

- **hreflang:** the `page:metadata` hook emits `rel="alternate" hreflang="…"` +
  `x-default` for every page (default locale unprefixed, others `/{code}/…`).
  It stays silent on content pages (`page.context.content` present) — there
  `EmDashHead` produces alternates from translation groups, so nothing is
  duplicated.
- **Language switcher:** `page:fragments` injects a self-mounting
  `<turan-lang-switcher>`: it moves into `header / [role=banner] /
  #site-header / .site-header` when present, otherwise it is fixed top-right. A
  theme may place its own `<turan-lang-switcher>` element (ours removes itself).
  The locale list comes **only** from `i18n.locales` (no copy); `lang`,
  `hreflang` and `aria-current` are set correctly. It can be **disabled** from
  settings (*Language switcher + hreflang → Off*).

**Translations with different slugs (content pages):** when a layout passes
`content={{ collection, id, slug }}`, two layers work together:

- `EmDashHead` → **hreflang alternates** from the translation group: each
  translation with its own slug, self-referencing + `x-default`; unpublished,
  `noindex` or unroutable translations are excluded. Our plugin stays silent on
  these pages (no duplicates; EmDashHead deduplicates by `hreflang`).
- The switcher → `ctx.content.getTranslations()` + `getPublicUrl()` link each
  language to **its own slug**; a language without a published translation
  links to the default entry's path with that language's prefix (fallback
  behaviour).

Verified example: a `tr` translation published as `kaynak-duzenleme-rehberi` →
on the EN page `hreflang="tr" → /tr/posts/kaynak-duzenleme-rehberi`,
`x-default → /posts/kaynak-duzenleme`; the TR page renders its own entry and the
switcher shows EN → `/posts/kaynak-duzenleme`.

Note: with `routing.fallbackType: "rewrite"`, `/de/…` requests render the
default-locale page. **Text** translation is separate: theme text through the AI
translation action, content through EmDash `locale`/`translationOf`.

**Media translation (alt / caption / PDF):** EmDash stores one `alt`/`caption`
per media item; localized values live in the widget's KV
(`mediai18n:<id>:<locale>`) and are applied to the page by a small injected
script **without theme changes**:

- `<img>` → localized **alt** text (including Astro's `/_image?href=…`
  optimization: matched by basename + decoded `href`),
- `<figure><figcaption>` → replaced only when the text **exactly matches** the
  source caption stored at save time (never writes into the wrong place),
- `<a href="…pdf">` → the locale's **file variant** (`localizedUrl`) for
  localized PDFs/images.

Management: routes `media/list`, `media/set`, `media/remove`; agent tools
`media_list`, `media_set_translation` (the AI translation prompt uses them).
Assets outside the library are supported too: `mediaId: "static:<name>"` +
`url`. Permission: the widget package now requests **`media:read`** (install
consent renews).

Verified: the TR record (`/karakasmuhendislik-96.webp` → “Karakaş Mühendislik
logosu”) applied on the TR page while the EN page kept its original alt. The
caption and PDF-variant code paths are ready; the demo site has no such
elements, so they were not exercised live.

**Canvas language scope (single selection):** the canvas toolbar (`#t-bar2`)
shows locales as **flag + language name** chips side by side (`🇬🇧 English ·
🇹🇷 Türkçe · 🇩🇪 Deutsch · 🇫🇷 Français · 🇪🇸 Español`). Clicking a chip selects
that language (single-select; clicking it again clears the scope) and points the
live preview at that locale's URL with **no page reload** — only the preview
iframe navigates. The `×` clears the scope. To its right, a **URL field** shows
the page currently on screen (e.g. `http://localhost:4323/es/`). The selection
is stored in `localStorage` and sent to the agent as a `[SCOPE]` block:

```
[SCOPE]
Active locales: tr, de
Apply every change only for these locales: CMS content (locale/translationOf),
media text (media_set_translation) … do not mass-edit the theme source.
```

So **whichever language is selected, the AI makes changes only there**; a
request that cannot be locale-specific is explained instead of applied globally.

**Translation lists panel:** the **Translation lists** button in the canvas top
bar opens a right-side panel (`role="dialog"`):

- **Text / Media** tabs (live counts; media shows **NEW** when something is
  untranslated),
- **search**, a **language** picker (flag + name; `i18n.locales`), a
  **collection** filter (text) and refresh; the **result count** on the right,
- **Text** rows are the CMS entries of that locale (`schema → collections →
  entries`): collection · slug · title · status + **Translate with AI** (sends a
  `[SCOPE]` prompt for that entry),
- **Media** rows merge the media library with `mediai18n` records: original URL
  · *File (localized)* · *Alt* · *Caption*, **Save** (`media/set`) and
  **Translate with AI**.

Accessibility: the panel has `role="dialog"` + `aria-modal` + `aria-labelledby`;
focus moves inside on open, a **Tab focus trap** applies, **Escape** and a
**backdrop click** close it, and focus returns to the trigger. Buttons have a
`focus-visible` ring.

The `translations/list` route (`{locale}`) reads from the CMS and the KV on every
open; the list is fully dynamic (demo: `tr` → Text 1, Media 1).

**Weglot parity (multilingual SEO/GEO + publishing):**

- **hreflang:** content pages via `EmDashHead` translation groups (including
  different slugs, self + `x-default`); non-content pages via the plugin's
  `page:metadata`.
- **Localized metadata:** per-language `<title>`, `description`, locale-prefixed
  **canonical**, OG/Twitter (EmDashHead); astro-seo was removed (no duplicate
  tags).
- **Per-language slugs:** EmDash `slug` per locale (e.g. `kaynak-duzenleme` ↔
  `kaynak-duzenleme-rehberi`).
- **Per-language publish/unpublish:** status button in the panel +
  `translations/publish` (`getVersioned` → `publish|unpublish`).
- **Automatic sync detection:** `translations/list` compares default-locale
  entries with their translation group; missing languages are listed as
  **pending**, and the panel shows “N rows have no translation in this language”
  + **Translate all with AI**.
- **Sitemap/GEO:** `/sitemap-{collection}.xml` emits every locale URL with
  `xhtml:link hreflang` + `x-default` alternates.

Live tests: unpublish → `/tr/posts/…` **404**, republish → **200**; pending
**4** rows; TR canonical `/tr/posts/kaynak-duzenleme-rehberi`; sitemap carries
en/tr alternates + x-default.

**Compact tool calls:** a turn can contain dozens of tool calls; the transcript
shows them in a **single summary row** — e.g. *“✓ 17 calls completed · grep ×9,
read_file ×4, list_files ×2 +2”*. Clicking the row (native `<details>`,
keyboard and screen-reader friendly; the chevron rotates) expands the calls one
by one: status icon + tool name + **ellipsised argument preview**, and full
arguments + result when expanded. A group with errors opens **automatically**
with a red icon; while running it counts live as “Running · N calls”
(`aria-live="polite"`). Stored sessions use the same grouping.

**Chat history (left column):** a persistent rail left of the conversation:
`<nav aria-label="Chat history">` + `+ New chat` + the session list (title and
message count). The active chat is marked with `aria-current="true"` and items
are keyboard navigable. The clock button in the header shows/hides it
(`aria-expanded` + `aria-controls`); below **430px** the rail hides itself and a
chronometer **popover** in the composer takes over. New session titles are
stripped of the selection block (`[SECLI_OGELER]…`).

**Sidebar resizing (accessible):** the drawer's right edge has a handle with
`role="separator"`, `aria-orientation="vertical"`, `aria-valuemin/max/now` +
`aria-valuetext`, focusable via `tabindex="0"`:
- **Mouse:** drag (pointer capture; `cursor: col-resize`), **double click** →
  default (460px),
- **Keyboard:** ←/→ (16px), **Shift**+←/→ (64px), **Home/End** → min/max,
  **Enter/Space** → default,
- a **Collapse/Expand** button (`aria-expanded` + `aria-controls`); the width is
  stored in `localStorage` (300–720px; capped at 70% on narrow screens),
- resizing recomputes the canvas (windows re-fit the grid),
- `:focus-visible` ring on keyboard focus; the pixel value is announced to screen
  readers.

**Sandbox core:** Block Kit admin chat (form based), `ask` route (+MCP tool
`turan__ask`), **`content/publish` route (MCP tool `turan__publish`,
`destructive: true`)**, `get_site_info`, `content_list/get/create/update`
(drafts), `content_publish` / `content_unpublish`, `status`, `sessions/*`.

**Draft, publish and undo:** `content_update`/`content_create` write a draft
first, and the agent **publishes in the same turn with `content_publish` without
asking** (the change is live immediately). Every content mutation is pushed onto
an **undo stack** (`undo:stack`, last 20) with a **changeId**; the run emits
`content_changed` events and stores `changeIds` on the reply message:
- **Per-message undo:** a **↶ Undo** button under the **user message** that asked
  for the change (next to copy/edit) — reverts only that turn's changes (field
  values + visibility), the button disappears and windows refresh; because
  `changeIds` are stored in the transcript it survives reloads,
- **MCP:** `turan__undo` (destructive) — accepts a `changeId`; the Block Kit chat
  also offers “↶ Undo the last change”,
- Agent tool `undo_last_change` (on “undo”; optional `changeId`).

After a publish/undo the widget **refreshes its windows automatically**, so the
change is visible immediately.

```sh
pnpm --filter turan-emdash validate | test | build   # manifest + sandbox host tests + dist
pnpm --filter turan-widget build:widget              # React widget bundle (inlined fragment)
pnpm --filter playground dev                         # site (localhost:4323)
```

Notes:

- the `turan-widget` bundle is injected **inline** through `page:fragments`
  (EmDash forbids serving JS from plugin routes); if the `status` route does not
  return 200 the widget removes itself and visitors never see it.
- the sandbox package pins `zod` to EmDash's version; in the widget package route
  `input` schemas are isolated at the type level via `routeInput()` (the host
  schema is used at runtime).
- `emdash-plugin.jsonc` is the sandbox package's contract: adding a permission,
  public route or MCP tool renews install consent.

## Publishing the npm packages

Both packages are publish-ready (`npm pack --dry-run` verified) with
`publishConfig.access: public`, scoped READMEs and MIT license files:

```sh
npm login        # once; or add //registry.npmjs.org/:_authToken=… to ~/.npmrc

cd packages/turan-emdash && npm publish
cd ../turan-widget && npm publish
```

`prepublishOnly` builds automatically: `turan-emdash` runs `emdash-plugin build`
(`dist/`), `turan-widget` rebuilds the React bundle
(`src/widget-bundle.generated.ts`). Bump versions with
`npm version patch|minor|major` inside each package directory.

## Astro boilerplate (`apps/playground`)

The playground carries the **1:1 design layer of the Karakas/Sveltia template**
(`/home/fuat/Desktop/Klasör/++++/karakas/karakas-sveltia`) merged with EmDash.
New sites are derived from this skeleton.

| Layer | Source / tool |
|---|---|
| UI components | `bejamas/ui` registry → **installed via CLI**: `accordion, button, carousel, marquee, navigation-menu` (+ `src/ui/icon/SemanticIcon.astro`) |
| Design tokens | `src/styles/globals.css` (Tailwind 4 + `bejamas/tailwind.css` + `tw-animate-css`); `--primary:#dd641e`, `--radius:0`, Space Grotesk |
| Theme config | `components.json` (`style: bejamas-juno`), `tsconfig.json` → `@/*` |
| Fonts | `public/font/space-grotesk-*-variable.woff2` + `astro:assets` `Font` (astro.config `fonts`) |
| Site components | `src/components/*` (SiteHeader/Footer, ServiceCard/Carousel, CtaBanner, WhyChooseUs, ProjectForm, …) |
| Content/data | `src/data/*` (site-settings, services, couriers, site.ts) + `src/content/*` (posts, pages, services, service-articles, couriers) |
| Pages | `src/pages/*` — every Karakas route (those using `getStaticPaths` export `prerender = true`) |

The EmDash wiring is preserved: `src/layouts/Layout.astro` (the Karakas shell)
carries `EmDashHead` / `EmDashBodyStart` / `EmDashBodyEnd` +
`createPublicPageContext`; `Base.astro` is a thin wrapper. EmDash `/posts/*` and
`/pages/*` routes remain editable through the agent's content tools.

Rule: when a new UI primitive is needed, install it from `bejamas/ui` with
`npx bejamas add <name>` instead of hand-writing it (skill:
`bejamas-ui-components`); components live under `src/ui/<name>/` as
source-owned files.

> Note: the template's company data (name, logo, phone, WhatsApp, Google
> reviews) is **demo** data for Karakas Mühendislik; replace
> `src/data/site-settings.json` and the images with the real customer before
> going live.

The theme has a **single source language** (currently Turkish) and no runtime
i18n layer; language support is applied **by AI to the source text** through
Settings → *Theme language (AI translation)* and the drawer's 🌐 “Translate
into …” action (translating to English makes the theme English and also updates
`<html lang>`).
