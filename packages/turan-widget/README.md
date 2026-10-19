# turan-widget

Trusted companion for [`turan-emdash`](https://www.npmjs.com/package/turan-emdash):
the in-page React AI widget for EmDash + Astro sites. It injects itself through
the `page:fragments` hook — **no theme edits required**.

## Install

```sh
npm i turan-emdash turan-widget
```

```mjs
// astro.config.mjs
import emdash from "emdash/astro";
import turan from "turan-emdash";
import turanWidget from "turan-widget";

export default defineConfig({
  integrations: [emdash({ plugins: [turan, turanWidget()] })],
});
```

Configure provider keys in **Admin → Plugins → Turan AI**. Alternatively set
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `EVREN_API_KEY` in the environment.

## Features

- **Launcher + drawer** — bottom-left ✦ AI button, resizable sidebar (mouse,
  keyboard, double-click reset, collapse).
- **AI-mode canvas** — the live page in a resizable window, up to two preview
  windows, drag & drop reordering, tabs with close buttons.
- **Element picker** — click elements in the preview to attach a `[SECLI_OGELER]`
  context block to your message.
- **Language scope** — single-select locale chips; the preview navigates without
  a page reload and the agent scopes changes to that language.
- **Translations panel** — text and media translation status per locale, AI
  translate, per-language publish/unpublish.
- **Media i18n** — localized `alt`, `caption`, and file variants applied at
  runtime without theme changes.
- **hreflang + language switcher** — generated from your `i18n` config.
- **Safe Markdown rendering**, compact tool-call groups, chat history, model
  picker (Claude, GPT, Evren).
- **Dev-only file tools** — `read_file`, `edit_file`, `write_file`,
  `list_files`, `grep`, guarded by an allowlist and blocked for `.env` /
  database files.

## How it works

The widget bundle is injected **inline** via the `page:fragments` hook (EmDash
does not serve plugin-route JavaScript). If the plugin's `status` route is not
reachable, the widget removes itself and visitors never see it.

## Development

```sh
pnpm --filter turan-widget build:widget   # rebuild src/widget-bundle.generated.ts
pnpm --filter turan-widget typecheck
```

## License

MIT
