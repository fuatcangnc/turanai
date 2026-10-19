# TuranAI — Frontman Klonu: Analiz ve İnşa Planı

> **Durum (güncel):** Ürün, **sandbox uyumlu EmDash plugin'i** olarak
> paketlendi (`packages/turan-emdash`): `emdash-plugin.jsonc` manifesti +
> `src/plugin.ts` (`SandboxedPlugin`), Block Kit admin sohbeti, `ask` route'u
> ve **MCP aracı**, içerik araçları (schema + content), oturumlar `ctx.storage`
> üzerinde, sağlayıcılar `ctx.http.fetch` ile. `emdash-plugin validate/build/test`
> yeşil; admin sayfası Block Kit olarak render ediliyor.
>
> **Kapsam değişikliği:** Skill'in `sandbox-boundaries.md`/`SKILL.md` kuralları
> gereği site-side widget, AI-mode canvas/seçim ve dosya sistemi araçları
> **sandbox dışıdır** (page:fragments, React admin ve Node built-in'leri
> trusted-only). Bu nedenle sandbox sürümünde bilinçli olarak yoklar; aşağıdaki
> §4 planının widget/annotation kısımları yalnızca ileride yazılabilecek
> **opsiyonel native companion** paket için referanstır.

> Amaç: Frontman'in (github.com/frontman-dev/frontman benzeri yapı, burada `frontman-main`)
> "uygulama içinde çalışan frontend AI ajanı" modelini, **EmDash CMS + Astro**'ya özel
> olarak `turanai/` klasörü altında yeniden inşa etmek.
>
> Bu dosya: (1) frontman-main'in klasör yapısı ve çalışma mekanizması, (2) emdash-main'in
> klasör yapısı ve uzantı noktaları, (3) klonun neye benzeyeceği ve nasıl yapılacağı.
>
> Analiz tarihi: 2026-10-17. Kaynaklar: `frontman-main/` ve `emdash-main/` tam kaynak
> ağaçları (oku-okunur repo; REA kanıt ID'leri aşağıda).

---

## 0. Yöntem ve Kanıtlar (REA)

- Tam kaynak kodu olan repolarda REA'nın native/decompiler katmanı kullanılmadı
  (skill kuralı: kaynak varsa repo araçları). REA'nın **statik JavaScript analiz**
  katmanı doğrulama için çalıştırıldı:
  - `frontman-main/libs/frontman-astro` → Evidence `ev_fc1a6ac6…` (özet: `ev_73ed8b20…`)
    — 21 ilgili dosya, 19 JS parse, 99 bulgu, 0 parse hatası. SHA-256:
    `b81a0964cb1e9296…`
  - `frontman-main/libs/frontman-core` → Evidence `ev_cc275b82…` (özet: `ev_480f0e5a…`)
    — paket çoğunlukla derlenmemiş ReScript `.res` kaynağı; 6 JS dosyası doğrulandı.
- Mekanizmanın tamamı kaynak okumasıyla (dosya/dosya) doğrulandı; aşağıdaki her iddia
  bir dosya yoluna bağlıdır. **[gözlem]** = kodda okundu, **[çıkarım]** = varsayım.

---

## 1. FRONTMAN — Klasör Yapısı ve Nasıl Çalışıyor

### 1.1 Üst düzey yapı

Monorepo: **Yarn 4 workspaces**, derleme **Makefile** odaklı, JS tarafı **ReScript**,
sunucu **Elixir/Phoenix**, WordPress eklentisi **PHP**.
Lisans: `libs/*` Apache-2.0, `apps/frontman_server` **AGPL-3.0** (klon için önemli, §4.7).

```
frontman-main/
├── apps/
│   ├── frontman_server/    # Elixir/Phoenix 1.8 · ~151 .ex · AGPL · bulut orkestrasyon
│   │                       #   (auth/WorkOS, BYOK LLM anahtarları, billing/Stripe,
│   │                       #    ACP kanalları, SwarmAi ajan döngüsü konuğu)
│   ├── swarm_ai/           # Elixir lib · ~3.2k LOC · framework-bağımsız ajan döngüsü
│   │                       #   (saf state machine + Sync/Await tool executor)
│   ├── frontman_notifier/  # Elixir · Discord webhook işçisi (prod-only)
│   └── marketing/          # Astro 7 site (frontman.sh)
├── libs/
│   ├── client/                 # @frontman-ai/client · ReScript+React · ~25k LOC
│   │                           #   /frontman overlay'inin chat+preview UI'ı (hosted bundle)
│   ├── frontman-core/          # @frontman-ai/frontman-core · Node tarafı tool runtime:
│   │                           #   HTTP middleware, dosya araçları, SSE, log capture,
│   │                           #   UI shell HTML, SafePath
│   ├── frontman-astro/         # @frontman-ai/astro · Astro integration (dev-only)
│   ├── frontman-astro-browser/ # Astro'ya özel tarayıcı araçları (get_astro_audit vb.)
│   ├── frontman-vite/          # Vite plugin (React/Vue/Svelte/Solid)
│   ├── frontman-nextjs/        # Next.js integration (proxy.ts + OTel log yakalama)
│   ├── frontman-wordpress/     # PHP eklenti · ~8.5k LOC · ~70 wp_* aracı
│   ├── frontman-client/        # Tarayıcı protokol istemcisi (ACP + MCP + Relay)
│   ├── frontman-protocol/      # Şema paketi: JSON-RPC/ACP/MCP/Relay + JSON şemaları
│   ├── frontman-preview-bridge/# iframe postMessage köprüsü
│   ├── react-statestore/       # reducer+effect state patterni
│   └── bindings/               # CSS-selector üretimi, snapdom screenshot, ripgrep...
└── test/  docs/  infra/  scripts/
```

### 1.2 Çekirdek mimari: 3 katman + tarayıcı

```
[LLM Provider] ← [frontman_server (Elixir, bulut)] ←WS /socket→ [Tarayıcı: /frontman UI]
                        │ ACP (session/prompt, streaming)            │  MCP server (tarayıcıda!)
                        │ MCP tools/call (mcp:message)                │  Relay istemcisi
                        ▼                                             ▼
                 [SwarmAi ajan döngüsü]                     [Dev server: /frontman/tools*]
                                                              (frontman-core runtime, Astro
                                                               integration'ın taktığı middleware)
                                                                     │ dosya oku/yaz/değiştir
                                                                     ▼
                                                              [gerçek kaynak dosyalar]
```

Kritik tasarım kararları **[gözlem]**:

1. **Tarayıcı = MCP sunucusu.** Bulut sunucusu dosya sistemine asla dokunmaz.
   Agent'ın tool'ları browser üzerinden `mcp:message` ile tarayıcıya sorulur;
   tarayıcı da relay ile lokal dev server'a `POST /frontman/tools/call` atar.
2. **İki uç nokta + tek SSE sözleşmesi** (tüm framework integration'ları aynı):
   - `GET  {base}/frontman/tools` → `{tools, serverInfo, protocolVersion:"2.0"}`
   - `POST {base}/frontman/tools/call` → body `{name, arguments}`, yanıt **SSE**
     (`event: result` + tek JSON `CallToolResult`)
   - `GET  {base}/frontman` veya `{sayfa}/frontman` (suffix route) → UI shell HTML
   - `POST {base}/frontman/resolve-source-location` → React source-map çözümü
     (WP'de 501).
3. **Protokoller:** taban = JSON-RPC 2.0; sohbet = **ACP** (Agent Client Protocol:
   `session/new|load|prompt`, `session/update` → `agent_message_chunk`, `tool_call`,
   `tool_call_update`, `plan`, `state_update`); araç = MCP (stateless
   `server/discover`, `tools/list`, `tools/call`, `_meta` içinde execution-context ve
   `access: read|write` metadata).
4. **Dev-only guard:** Astro integration'da her şey `if ctx.command == #dev` içinde;
   Vite annotation plugin'leri `apply: "serve"`. Prod build'e Frontman kodu sızmaz.

### 1.3 Astro integration'ının tam mekanizması (`libs/frontman-astro`)

`src/FrontmanAstro__Integration.res` — hook'lar **[gözlem]**:

| Hook | İş |
|---|---|
| `routesResolved` | Route tablosu → `get_client_pages` aracı (Astro ≥5) |
| `configSetup` | `import.meta.env.FRONTMAN_API_ORIGIN`; `frontman-middleware` Vite plugin (connect→Web `Request` adaptörü `FrontmanAstro__ViteAdapter`); kaynak-annotation plugin'leri; dev toolbar app; `injectScript` (annotation capture + navigation) |
| `configDone` | astro config yakalama → `get_resolved_astro_config` |
| `serverSetup` | `LogCapture.initialize()`, `/frontman` trailing-slash route rewrite |

**DOM → kaynak dosya eşlemesi (klon için en önemli parça):**

1. **Astro ≥7:** `vite-plugin-source-annotations.mjs` — `@astrojs/compiler` ile her
   `.astro`'yu parse edip tüm literal elementlere `data-frontman-source-file` +
   `data-frontman-source-loc="line:col` basar (Astro <7 için Astro'nun kendi
   `data-astro-source-file`'i kullanılır).
2. **Props yakalama:** `vite-plugin-props-injection.mjs` — Astro render'ın
   `renderComponent` fonksiyonunu sarar, her component render'ından önce
   `<!-- __frontman_props__:{base64 JSON} -->` yorumu yayar (secret sanitizer,
   depth≤4, 4KB/değer).
3. **Tarayıcıda:** `annotation-capture.mjs` — DOM walk'ıyla annotation'lı elementleri
   props yorumlarıyla eşleştirir, `window.__frontman_annotations__.get(el) →
   {file, loc, componentProps, displayName}` yayınlar.
4. İçerik dosyası annotation'ı: markdown/content için `data-frontman-content-file`.

**Araç kayıt defteri:** core araçları (`read_file, write_file, edit_file, list_files,
list_tree, grep, search_files, file_exists, load_agent_instructions, lighthouse,
get_logs`) + Astro'ya özel: `get_client_pages`, `get_content_collections`
(`server.ssrLoadModule` ile `astro:content` okur), `get_resolved_astro_config`,
`get_astro_audit` (dev-toolbar bulguları).

### 1.4 UI: `/frontman` ekranı (`libs/client`)

- Hosted tek bundle (`frontman.es.js`), UI shell HTML'i `window.__frontmanRuntime =
  {framework, basePath, projectRoot, traits}` + `entrypointUrl` (preview iframe'in
  yükleyeceği asıl sayfa) gömer.
- **Element seçme:** preview iframe'in `contentDocument`'ine capture-phase click;
  hover kutusu, ⌘⇧-drag çoklu seçim, annotation popup → "Execute".
- **Annotation zenginleştirme (paralel):** selector üretimi (finder benzeri), DOM alt
  ağaç özeti, **snapdom** ile element JPG'si, kaynak konumu (`__frontman_annotations__`
  / React fiber / `resolve-source-location` uç noktası).
- **Prompt kurulumu:** sayfa bağlamı + annotation blokları (`element://…` resource +
  `_meta`{selector, sourceLocation, boundingBox, props} + `annotation://<id>/screenshot`)
  → `session/prompt`.
- State: tek büyük reducer + effect kuyruğu (`react-statestore`); tüm API çağrıları
  reducer'dan.

### 1.5 Sunucu tarafı (`apps/frontman_server`) — klon için ne ifade ediyor

- Phoenix `/socket`, `tasks` + `task:<uuid>` kanalları; **event-sourced `interactions`
  tablosu** (user_message/agent_message/tool_call/tool_result, turn_number, dedup
  index'i) → kopunca yeniden akıtmak (replay) mümkün.
- `TaskChannel` tek yazar (Registry guard), MCP başlatma makinesi (discover→list→
  AGENTS.md okuma→list_tree), araçlar ya backend'de `Sync` ya browser'a `Await`
  (park eden executor, interactive tool'da `:infinity` timeout).
- SwarmAi: saf `Loop` state machine + provider-agnostic `LLM` behaviour (ReqLLM ile
  Anthropic/OpenAI/OpenRouter...). Sistem prompt'u annotation formatını öğretir.
- **Klon bunu birebir kopyalamaz** — AGPL + bulut/BYOK/billing katmanı bizim kapsamımız
  dışı; aynı sözleşmeyi lokalde kuracağız (§4).

### 1.6 WordPress eklentisi (`libs/frontman-wordpress`) — EmDash klonunun gerçek şablonu

Frontman'in "CMS içi" yüzü budur ve EmDash'a en çok benzeyecek parça **[gözlem]**:

- `parse_request` (öncelik 1) ile route yakalama → aynı URL sözleşmesi
  (`/frontman`, suffix route, `/frontman/tools`, SSE `tools/call`, resolve→501).
- Auth: CMS oturumu + nonce; nonce UI runtime'ına gömülür, 403'te rotate edilir.
- `Frontman_Tools` kayıt defteri: `{name, description, input_schema, handler, access}`;
  `access` isim önekinden türer (`wp_get_*→read`, `wp_create_*→write`); çıktı MCP
  `callToolResult`'a sarılır.
- **Şema-güdümlü input sanitizasyonu** (kayıtlı JSON Schema'yı yürüyüp alan bazlı
  temizleyici uygular) → klon için birebir örnek.
- ~70 araç: posts/blocks/menus/options/media/WooCommerce/Elementor. **Dosya
  düzenleme aracı yok** (CMS içerik odaklı; UI'da `supportsFileChanges:false`).

### 1.7 Uçtan uca akış (referans davranış)

1. `localhost:4321/x/frontman` → UI shell + preview iframe (`/x`, annotation'lı HTML).
2. UI → WS connect → `initialize` → relay `GET /frontman/tools` → tool havuzu.
3. Element tıkla → zenginleştir → prompt'a ek → `session/prompt`.
4. Sunucu: kaydet → ajan döngüsü → LLM'e annotation'lı prompt.
5. `edit_file` tool çağrısı: `mcp:message` → browser → `POST /frontman/tools/call` →
   dev-server'da gerçek dosya değişir (SafePath守卫) → SSE → HMR → preview'da canlı.
6. Diff UI'da, `state_update idle` ile tur biter.

---

## 2. EMDASH — Klasör Yapısı ve Nasıl Çalışıyor

### 2.1 Üst düzey yapı

pnpm workspaces (pnpm 11.9, tedarik zinciri sertleştirilmiş), **tsdown** derleyici,
Node ≥22.16, Astro `^7.3.2`, **MIT lisans** (© Cloudflare). Slogan:
*"Agent-portable reimplementation of WordPress on Astro"*.

```
emdash-main/
├── packages/
│   ├── core/            # `emdash` v1.3.0 — HER ŞEY: Astro integration, ~150 enjekte
│   │                    #   route, Kysely DB katmanı, 91 migration, schema registry,
│   │                    #   plugin sistemi, MCP sunucusu (74 araç), CLI (em/emdash)
│   ├── admin/           # React SPA (TanStack Router/Query, Kumo UI, Tiptap, Lingui)
│   │                    #   /_emdash/admin altında served
│   ├── auth/            # Passkey-first auth + RBAC + OAuth (GitHub/Google)
│   ├── blocks/          # Block Kit — sandboxed eklentiler için deklaratif JSON UI
│   ├── cloudflare/      # D1/R2/Hyperdrive/Workler适配leri
│   ├── create-emdash/   # `npm create emdash@latest`
│   ├── plugin-types/    # manifest + yetenek (capability) kelime listesi
│   ├── plugin-cli/      # sandboxed eklenti geliştirme CLI'ı
│   ├── workerd/         # plugin sandbox (Node'da workerd)
│   ├── plugins/*        # 12 örnek eklenti (forms, embeds, mcp-smoke, ...)
│   └── registry-*, marketplace/  # atproto tabanlı eklenti kayıt sistemi
├── apps/*               # altyapı (aggregator, labeler, release-*) — ürün değil
├── demos/               # simple (Node+SQLite), postgres, cloudflare, playground...
├── templates/           # starter/blog/marketing/portfolio (+ -cloudflare kardeşleri)
├── skills/              # AGENTS/skills: building-emdash-site, creating-plugins, ...
├── docs/  e2e/  rfcs/  proposals/
```

### 2.2 Bir Astro sitesinin içinde nasıl çalışıyor

- Site `astro.config.mjs`'de `emdash({database: sqlite("file:./data.db"),
  storage: local("./uploads")})` çağırır → `packages/core/src/astro/integration/index.ts`
  (880 satır):
  - `astro:config:setup`: ~150 route enjekte (`/_emdash/api/*`, `/_emdash/admin`),
    middleware zinciri, Vite sanal modüller (`virtual:emdash/{config,dialect,storage,
    plugins,admin-registry,...}`), image endpoint sarmalama.
  - `astro:server:setup`: debounced **dev typegen** → `emdash-env.d.ts` (kolleksiyon
    tipleri; `InferCollectionData<"posts">`).
- **Veri modeli:** şema kodda değil DB'de (`_emdash_collections/_emdash_fields`);
  her kolleksiyon gerçek bir SQL tablosu (`ec_{slug}`, tipli kolonlar — EAV yok).
  Kullanıcı tarafı başlangıç: `seed/seed.json`.
- **İçerik API:** site içinden doğrudan `getEmDashCollection("posts", {...})`
  (Astro Live Content Collections loader'ı + request-scoped DB); FTS5 arama; menüler,
  taksonomiler, widget'lar sunucu tarafı helper'lar.
- **Yetki:** `locals.emdash` → `EmDashHandlers` — REST ve MCP aynı handler katmanını
  paylaşır; `_rev` optimistic concurrency + edit-lock; hook pipeline'ı
  (`content:beforeSave` veto edebilir).

### 2.3 Eklenti sistemi ve uzantı noktaları (klon buraya oturacak)

- İki format: **native** (güvenilir, in-process, React admin girişi, tam SDK) ve
  **standard/sandboxed** (manifest + capability: `content:*`, `schema:read`,
  `admin.editor-draft:read|patch`, ...; workerd sandbox; React yok, Block Kit JSON).
- Admin UI genişletme: `pages` (`/_emdash/admin/plugins/<id>/…`), `widgets`,
  `contentEditorPanels`, `contentListColumns`, `fieldWidgets`, `settingsSchema`.
- **`admin.editor-draft:read|patch`**: sandboxed bir eklenti, kullanıcının açık
  editöründeki taslağı okuyup **zod-doğrulamalı patch** uygulayabiliyor — editör içi
  AI asistanı için birinci sınıf kanal **[gözlem]**.
- **Gömülü MCP sunucusu:** `/_emdash/api/mcp` — 74 çekirdek araç
  (`content_*`, `schema_*`, `media_*`, `menu_*`, `taxonomy_*`, `revision_*`,
  settings, transfer...), stateless Streamable HTTP, OAuth/token'lı. Eklentiler
  kendi route'larını MCP aracı olarak yayınlayabilir.
- **Görsel düzenleme:** entry'lerde `post.edit.title` spread'i → DOM'a
  `data-emdash-ref='{collection,id,field,status}'`. Edit modunda (`?_edit`) çalışır;
  içerik-eleman ↔ entry/field eşlemesi hazır. **Astro component → dosya satırı**
  eşlemesi EmDash'ta YOK (Frontman'in annotation plugin'i bu boşluğu doldurur)
  **[gözlem+çıkarım]**.
- **Dev-bypass** uçları (`/setup/dev-bypass`, `/auth/dev-bypass`) → tarayıcı
  otomasyonunda oturum kurmak trivial.
- Şablonlar zaten agent-ready: `AGENTS.md`, `.mcp.json` (docs MCP), skills.

---

## 3. İKİ REPONUN KESİŞİMİ — Klon İçin Çıkarılan İlkeler

| Frontman'de | EmDash'ta karşılığı | Klon kararı |
|---|---|---|
| 3-4 framework integration (astro/vite/nextjs/wp) | Tek hedef: EmDash+Astro | Tek paket seti, Astro/EmDash-özel |
| Bulut Elixir sunucu + WS + event sourcing | Yok (lokal çalışma) | Ajan döngüsü **dev server'da Node/TS**; oturum geçmişi SQLite (EmDash DB yanında ayrı tablo/dosya) |
| Browser = MCP server, relay via browser | Zorunluluk yok (her şey lokal) | Basitleştir: UI → SSE ile doğrudan dev-server ajanına bağlanır; **yine de** dosya işlemleri middleware'de kalır |
| 2 endpoint + SSE relay sözleşmesi | `/_emdash/api/mcp` zaten var | Route sözleşmesini koru (`/turan/tools`, `/turan/tools/call` SSE) ama EmDash MCP'sini **araç kaynağı** olarak kullan |
| DOM→kaynak: annotation plugin + props inject | `data-emdash-ref` (içerik eşlemesi) | **İkisini birleştir:** kaynak annotation'ı (Astro component→file:line) + `data-emdash-ref` (içerik→collection:field) |
| ReScript + React | EmDash = TS ekosistemi | **TypeScript** (EmDash stack'iyle uyum; ReScript'in getirdiği disiplin TS+zod ile yeter) |
| ACP/MCP/JSON-RPC şema paketi | Zod tabanlı şemalar | `turan-protocol`: TS + zod, JSON şeması export |
| WP plugin: şema-güdümlü sanitizasyon, access=prefix | Hook vetoesu, RBAC, `_rev` | EmDash handler'larını kullan (yetki+hook bedava); dosya araçlarına SafePath + allowlist |
| `load_agent_instructions` (AGENTS.md) | `AGENTS.md` + skills şablonlarda hazır | Aynen koru |

---

## 4. KLON: "Turan" — EmDash+Astro için uygulama-içi AI ajanı

### 4.1 Ürün tanımı

EmDash ile kurulmuş bir Astro sitesinin dev sunucusunda çalışan, sitenin
`/turan` (veya `/{sayfa}/turan`) adresinde açılan chat + canlı önizleme arayüzü:

- Kullanıcı element seçer → ajan hem **kaynak dosyayı** (Astro komponenti) hem
  **içerik kaydını** (EmDash entry/field) hedefleyebilir.
- Kaynak dosya değişiklikleri dev-server middleware'i üzerinden gerçek dosyaya
  yazılır → HMR ile önizleme canlı güncellenir.
- İçerik değişiklikleri EmDash'ın kendi handler/hook yetki zincirinden geçer
  (`_rev`, lock, `content:beforeSave` vetoları) → insan onaylı editör akışı
  (editor-draft patch) korunur.
- Ajan döngüsü **lokaldir** (API anahtarı env'den). Bulut, hesap, billing YOK.

### 4.2 Hedef klasör yapısı (`turanai/`)

pnpm monorepo (EmDash'la aynı paket yöneticisi/derleyici yaklaşımı):

```
turanai/
├── package.json                  # pnpm workspaces: packages/*, apps/*
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md                     # bu dosyanın kullanıcı versiyonu
├── packages/
│   ├── turan-protocol/           # TS + zod sözleşme paketi
│   │   └── src/
│   │       ├── relay.ts          #   GET tools / POST tools/call şemaları (Frontman
│   │       │                     #   Relay 2.0'ın sadeleştirilmiş TS karşılığı)
│   │       ├── chat.ts           #   mesaj/parça/araç-çagrisi/plan olayları (SSE akışı)
│   │       ├── annotation.ts     #   element:// bloğu, sourceLocation, data-emdash-ref
│   │       └── schemas/*.json    #   dışa aktarılmış JSON şemaları
│   ├── turan-core/               # framework-bağımsız runtime (Node)
│   │   └── src/
│   │       ├── middleware.ts     #   Fetch-uyumlu router: /turan, /turan/tools,
│   │       │                     #   /turan/tools/call (SSE), /turan/chat (SSE), OPTIONS/CORS
│   │       ├── ui-shell.ts       #   UI HTML üretimi (__turanRuntime + entrypointUrl)
│   │       ├── tool-registry.ts  #   {name, description, inputSchema, handler, access}
│   │       ├── tools/
│   │       │   ├── files.ts      #   read_file write_file edit_file list_tree grep
│   │       │   │                 #   (SafePath + yazma allowlist'i: src/, seed/, ...)
│   │       │   ├── logs.ts       #   dev-server log buffer (ring buffer, HMR hataları)
│   │       │   ├── pages.ts      #   get_client_pages (route tablosu)
│   │       │   └── agent-md.ts   #   load_agent_instructions
│   │       ├── agent/
│   │       │   ├── loop.ts       #   LLM tool-döngüsü state machine (SwarmAi'nin TS
│   │       │   │                 #   karşılığı; paralel araç, park eden interactive araç)
│   │       │   ├── providers.ts  #   Anthropic/OpenAI/openai-uyumlu (env anahtarı)
│   │       │   └── session-store.ts  #   interactions tablosu (event-sourced, SQLite)
│   │       └── sanitize.ts       #   şema-güdümlü input temizliği (WP kalıbı)
│   ├── turan-astro/              # Astro entegrasyonu (dev-only)
│   │   └── src/
│   │       ├── index.ts          #   hooks: routesResolved, config:setup (middleware +
│   │       │                     #   injectScript), server:setup (log capture)
│   │       ├── vite-plugin-source-annotations.ts   # data-turan-source-file/-loc
│   │       ├── vite-plugin-props-injection.ts      # __turan_props__ yorumları
│   │       ├── annotation-capture.ts               # window.__turan_annotations__
│   │       └── toolbar.ts        #   Astro dev toolbar app (bağlantı durumu)
│   ├── turan-emdash/             # EmDash NATIVE eklentisi (ürünün kalbi)
│   │   └── src/
│   │       ├── index.ts          #   definePlugin({name:"turan", routes, admin, mcp})
│   │       ├── routes/           #   /_emdash/api/turan/* (chat SSE, oturumlar) —
│   │       │                     #   EmDash auth+CSRF'si altında
│   │       ├── emdash-tools.ts   #   EmDash içerik araçları: mevcut 74 MCP aracını
│   │       │                     #   adapter'la turan tool-registry'sine bağlar
│   │       │                     #   (content_get/update, media_*, menu_*, schema_*)
│   │       ├── admin-panel.tsx   #   admin sayfası: /_emdash/admin/plugins/turan
│   │       └── editor-panel.tsx  #   contentEditorPanel + editor-draft patch köprüsü
│   └── turan-client/             # Tarayıcı UI (React + TS, tek bundle)
│       └── src/
│           ├── main.ts           #   /turan sayfasında boot
│           ├── app/              #   chat, tool-call blokları, diff görüntüleyici, plan
│           ├── preview/          #   iframe + seçim modu (hover/click/drag-çoklu)
│           ├── annotate.ts       #   __turan_annotations__ + data-emdash-ref okuma,
│           │                     #   selector üretimi, element screenshot (html-to-image)
│           └── state.ts          #   reducer + effect kuyruğu (Frontman statestore kalıbı)
├── apps/
│   └── playground/               # emdash blog şablonu kopyası + turan bağlı, test sitesi
│       ├── astro.config.mjs      #   emdash({...}) + turan() + react()
│       └── seed/seed.json
└── docs/
    └── mimari.md                 # bu dosyanın kalıcılaştırılmış sürümü
```

### 4.3 Hedeflenen istek akışı (lokal-first sürüm)

```
/turan (dev middleware) → UI shell → bundle (turan-client)
   │  SSE  POST /_emdash/api/turan/chat   (EmDash auth/CSRF altında)
   ▼
turan-core agent loop (Node, dev-server prosesinin içinde)
   │  LLM (env: ANTHROPIC_API_KEY / OPENAI_API_KEY)
   │  tools: dosya araçları (middleware, SafePath)
   │         + EmDash içerik araçları (in-process EmDashHandlers — HTTP loopback yok)
   │         + browser araçları (take_screenshot, execute_js, get_dom) ← UI'a
   │           SSE üzerinden "tool request" olarak sorulur, UI sonucu döner
   ▼
dosya değişti → Vite HMR → preview iframe canlı güncellenir
içerik değişti → EmDash hook zinciri (_rev/lock/veto) → admin editörü senkron
```

Frontman'den farkı: bulut WS katmanı yok; `mcp:message` relay'i tek SSE kanalına
indirgenmiş; tarayıcı yine "bazı araçların yürütüldüğü yer" (screenshot/execute_js)
ama dosya işlemleri sunucu tarafında kalıyor — çünkü ajan zaten lokal.

### 4.4 Araç listesi (v1)

| Kategori | Araçlar | Not |
|---|---|---|
| Dosya (dev-only, SafePath) | `read_file`, `edit_file`, `write_file`, `list_tree`, `grep`, `file_exists` | allowlist: `src/`, `seed/`, `astro.config.mjs` |
| Astro | `get_client_pages`, `get_logs`, `get_astro_config` | config:setup'tan yakalanan veriler |
| EmDash içerik | `content_list/get/create/update/publish`, `media_list/upload`, `menu_get/update`, `taxonomy_*`, `schema_read`, `search` | EmDash handler'larına in-process bağ; yetki = EmDash kullanıcısı |
| Görsel/browser | `take_screenshot`, `get_dom`, `execute_js`, `get_interactive_elements` | UI'a SSE tool-request; timeout + onay |
| Süreç | `load_agent_instructions`, `question` (interactive) | AGENTS.md + şablon skills'leri |

### 4.5 DOM → hedef eşleme stratejisi (klonun ayırt edici özelliği)

Seçilen element için sırayla:

1. `el.closest('[data-emdash-ref]')` → **içerik hedefi** `{collection, id, field}` →
   ajan `content_update` aracıyla içeriği değiştirir (editör-draft patch opsiyonu).
2. `window.__turan_annotations__.get(el)` → **kaynak hedefi** `{file, line, col,
   componentName, props}` → ajan `edit_file` ile komponenti değiştirir.
3. Yoksa selector + element-context + screenshot ajan'a verilir (arama araçlarıyla
   hedefi kendisi bulur).

### 4.6 Faz planı

| Faz | Çıktı | Ölçüt |
|---|---|---|
| **F0 — İskelet** | pnpm monorepo, `turan-astro` middleware: `/turan` shell + `/turan/tools` + SSE `tools/call`; `apps/playground` ayağa kalkar | `curl localhost:4321/turan/tools` JSON; `/turan` HTML |
| **F1 — Araçlar** | dosya araçları + SafePath + grep + log buffer; şema-güdümlü sanitize | playground'da read/edit round-trip, path traversal testleri geçsin |
| **F2 — Ajan** | loop + provider (Anthropic/OpenAI) + SSE chat + oturum kaydı | CLI'dan "başlığı değiştir" → dosya değişir, HMR tetiklenir |
| **F3 — UI** | turan-client: chat + preview iframe + seçim + annotation + screenshot | tarayıcıda element seç → prompt → diff → canlı önizleme |
| **F4 — EmDash derin entegrasyon** | `turan-emdash` native eklenti: admin paneli, içerik araçları, editor-draft patch, `data-emdash-ref` hedefleme | içerik + kod hibrit görev ("bu kartın hem komponentini hem 3 post'un başlığını değiştir") |
| **F5 — Sertleştirme** | log/build-error araçları, audit, `question` aracı, oturum replay, çoklu seçim | E2E Playwright senaryoları |

### 4.7 Lisans ve temiz-oda notu **[önemli]**

- `emdash-main` **MIT** → serbestçe kullanılabilir/türetilecilir (bildirim korunur).
- `frontman-main`: `libs/*` **Apache-2.0** ( NOTICE/LICENSE korunursa kopyalama/türetme
  yapılabilir), `apps/frontman_server` **AGPL-3.0** → bu koddan alıntı/türetme yasak;
  davranışsal analizimiz referans, sunucu kodunu **okumadan/yazmadan** kendi TS
  döngümüzü kuruyoruz (yukarıdaki plan zaten AGPL kodunu yeniden yazmıyor; dosya
  bazlı kaynak referansları yalnızca davranış belgesi niteliğindedir).
- Klon paketleri: kendi lisansımız (öneri: MIT veya AGPL-korumalı olmamak kaydıyla
  Apache-2.0; ticari plan netleşince karar verilir).

### 4.8 Bilinmeyenler / açık sorular

1. Model sağlayıcı kapsamı ilk sürümde ne olsun? (Anthropic + OpenAI yeter mi?)
2. UI bağımsız `/turan` overlay mi, admin içi panel mi, ikisi mi? (Plan ikisini de
   taşıyacak şekilde; varsayılan: `/turan` overlay + admin'de giriş sayfası.)
3. İçerik yazımlarında otomatik publish mi, taslak/patch-onay akışı mı? (Öneri: F4'e
   kadar taslak, sonra editor-draft patch.)
4. Çok dilli siteler (i18n row-per-locale) için hedefleme kuralı.
5. Production'da çalışma senaryosu (Frontman'in WP eklentisi gibi) isteniyor mu,
   yoksa kesin dev-only mi? (Plan dev-only; WP tarzı prod modu ayrı faz olur.)

---

## 5. Hızlı Referans — Kritik Dosyalar

**Frontman (davranış referansı):**
- `libs/frontman-astro/src/FrontmanAstro__Integration.res` — Astro hook'ları
- `libs/frontman-astro/src/vite-plugin-source-annotations.mjs` (+props-injection,
  annotation-capture) — DOM→kaynak zinciri
- `libs/frontman-core/src/FrontmanCore__Middleware.res` / `__RequestHandlers.res` /
  `__ToolRegistry.res` / `__SSE.res` — uç nokta + tool + SSE sözleşmesi
- `libs/frontman-protocol/src/FrontmanProtocol__Relay.res` — relay şemaları
- `libs/frontman-wordpress/includes/class-frontman-tools.php` — CMS içi tool
  kalıbı + sanitizasyon
- `libs/client/src/state/Client__Task__Reducer.res` — annotation zenginleştirme

**EmDash (entegrasyon noktaları):**
- `packages/core/src/astro/integration/index.ts` + `routes.ts` — route/middleware enjeksiyonu
- `packages/core/src/mcp/server.ts` — 74 araç + `_rev`/lock semantiği
- `packages/core/src/plugins/define-plugin.ts`, `packages/plugin-types/src/index.ts` —
  eklenti manifesti + capability'ler
- `packages/core/src/plugins/editor-draft.ts` — editör taslak okuma/patch
- `packages/core/src/visual-editing/editable.ts` — `data-emdash-ref`
- `templates/blog/` — playground'ın başlangıç iskeleti
