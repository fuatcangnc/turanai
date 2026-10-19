# turan-emdash

Sandbox-compatible AI agent plugin for [EmDash](https://emdash.dev). It adds a
Block Kit admin chat, content tools, and MCP tools to any EmDash site — no theme
changes required.

## Install

```sh
npm i turan-emdash
```

```mjs
// astro.config.mjs
import emdash from "emdash/astro";
import turan from "turan-emdash";

export default defineConfig({
  integrations: [emdash({ plugins: [turan()] })],
});
```

Then open **Admin → Plugins → Turan AI** and add a provider key (stored
encrypted). Supported: Anthropic, OpenAI, and any OpenAI-compatible gateway
(such as Evren) via base URL.

## What you get

- **Admin chat** (Block Kit) with sessions stored in plugin storage.
- **MCP tools**: `turan__ask`, `turan__publish`, `turan__undo`.
- **Content tools**: list / read / create / update / publish / unpublish, plus
  `undo_last_change`.
- **Site info** and status helpers.

## Optional: in-page widget

A registry/sandbox plugin cannot inject page scripts, so the full in-page widget
(drawer, canvas, element picker) ships separately as the trusted package
[`turan-widget`](https://www.npmjs.com/package/turan-widget):

```sh
npm i turan-widget
```

```mjs
import turanWidget from "turan-widget";
// plugins: [turan, turanWidget()]
```

For a lightweight site-owned chat panel, use the bundled component:

```astro
---
import TuranLauncher from "turan-emdash/launcher.astro";
---
<TuranLauncher />
```

Or mount the full widget bundle explicitly (requires `turan-widget`; renders
nothing when absent):

```astro
---
import TuranWidget from "turan-emdash/widget.astro";
---
<TuranWidget />
```

## Development

```sh
pnpm --filter turan-emdash validate   # manifest check
pnpm --filter turan-emdash test       # sandbox host tests
pnpm --filter turan-emdash build      # dist/
```

## License

MIT
