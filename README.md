# Turan — EmDash için AI agent (sandbox çekirdeği + React widget)

İki paket, tek ürün:

| Paket | Tür | Ne sağlar | Dağıtım |
|---|---|---|---|
| **`turan-emdash`** | **Sandbox uyumlu plugin** (`format:"standard"`) | Block Kit admin sohbeti, `ask` route + **MCP aracı**, içerik araçları, oturumlar `ctx.storage`'da, `ctx.http.fetch` ile sağlayıcılar | Plugin CLI + registry |
| **`turan-widget`** | **Trusted companion** (native) | Sayfa üstü **React widget**: sol altta ✦ AI, çekmece, **AI modu canvas** (pencereler), **öğe seçici**, sekmeler, model seçici; dev-only **dosya araçları** | Site bağımlılığı (registry değil) |

Neden iki paket: EmDash `page:fragments`, React admin kodu, ham script/CSS ve
host-process erişimini **trusted-only** sayar (bkz. skill: `SKILL.md`,
`sandbox-boundaries.md`). Bu yüzden overlay/widget yalnız native pakette
olabilir; ajan çekirdeği ise sandbox paketinde registry ile kurulabilir kalır.

## Widget modül yapısı (`packages/turan-widget/src/widget/`)

Bileşen bazlı; her dosya tek sorumluluk taşır, App yalnızca kompozisyon yapar:

```
main.tsx                 entry: iframe/çift-mount guard'ı + React root (stiller önce)
App.tsx                  kompozisyon: hook'ları bağlar, bileşenleri dizer (UI içermez)
api.ts                   private route'lar için tipli HTTP istemcisi
frame.ts                 iframe bağlama + seçim tanımı/CSS yolu + bağlam bloğu
styles.ts                widget CSS'i (tek enjeksiyon)
lib/
  layout.ts              sabitler (BAR_H, MIN/MAX/DEFAULT_DW, MAX_WINDOWS) + canvas geometrisi
  models.ts              model kataloğu (Auto/Claude/GPT/Evren)
  types.ts               Tab, ToolChip, PageItem, SessionItem
  tool-summary.ts        araç çağrısı gruplama + argüman önizlemesi (ellipsis)
  markdown.ts            bağımlılıksız Markdown ayrıştırıcı (blok + satır içi token)
  widget-store.ts        storage anahtarları, navigateTo, popover kapatma, pencereleri yenileme
  popover.ts             useOnPopoverOpen (native popover `toggle` olayı)
hooks/
  useChat.ts             transkript, ajan turu & event polling, oturumlar, undo
  useWindows.ts          pencere seçimi (max 2), sıralama (HTML5 DnD), sayfa envanteri
  useSelection.ts        öğe seçici: iframe bağlama, hover/seçim, bağlam bloğu
  useSidebar.ts          genişlik + daralt/genişlet + geçmiş tercihi + geometri
ui/
  icons.tsx              ikon seti + IconButton
components/
  Launcher.tsx           sol alt ✦ AI
  Canvas.tsx / Window.tsx  pencere ızgarası ve chrome bar
  CanvasBars.tsx         sekmeler / gezinme / araç satırları
  Drawer.tsx             çekmece kabuğu (başlık + iki sütun + resizer)
  ChatHistory.tsx        sol sohbet geçmişi rail'i
  ChatLog.tsx            mesajlar, araç grupları, akış, notlar
  Markdown.tsx           token → React öğeleri (ham HTML yok; kod bloğu başlığı + kopyala)
  ToolGroup.tsx          katlanmış araç grubu: tek özet satırı → tıklayınca tek tek çağrılar
  Composer.tsx           mesaj kutusu + seçim chip'leri + aksiyon satırı
  PageSwitcher.tsx       aranabilir sayfa değiştirici popover'ı
  menus.tsx              ModelMenu / SessionMenu / PagesMenu
  Resizer.tsx            erişilebilir boyutlandırma tutamacı
```

## Kurulum (site tarafı)

```mjs
// astro.config.mjs
import emdash from "emdash/astro";
import turan from "turan-emdash";        // sandbox descriptor (CLI çıktısı)
import turanWidget from "turan-widget";  // native widget + dosya araçları

export default defineConfig({
  integrations: [emdash({ /* … */ plugins: [turan, turanWidget()] })],
});
```

- Anahtarlar: **Plugins → Turan AI** ayarları (şifreli). Widget paketi
  `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `EVREN_API_KEY` ortam değişkenlerini
  de okur (Node dev'de `.env` otomatik yüklenmez: `set -a; . ./.env; set +a`
  ile başlatın). Sandbox paketi **yalnız ayarlardan** okur (`process.env` yok).
- **Evren (test modeli):** model menüsünde **Evren · DeepSeek V4.1 Flash**
  (`evren` / `deepseek-v4.1-flash`) hazır; Evren OpenAI-uyumlu bir ağ geçididir
  (`EVREN_BASE_URL`, varsayılan `https://evren-llmapi.ssyz.org.tr/v1`) ve her
  iki plugin'in `allowedHosts` listesine eklenmiştir.
- Yalnız sandbox kullanmak isteyen siteler (registry kurulumu) widget paketini
  hiç eklemez; o durumda sol alttaki başlatıcı için paketle gelen site-kodu
  bileşenini kullanın:

```astro
---
import TuranLauncher from "turan-emdash/launcher.astro";
---
<TuranLauncher />
```

## Yetenekler

**Widget (trusted):** sol alt ✦ AI → çekmece; AI modunda sayfa chrome bar'lı bir
pencerede (canlı iframe), diğer sekmeler yanında önizleme penceresi olarak
(en fazla 2 pencere; chrome'dan **sürükle-bırak** ile sıra değişir); öğe seçici
iframe DOM'undan `[SECLI_OGELER]` bağlamı üretir; model seçici her istekte
provider+model override eder (`Evren · DeepSeek V4.1 Flash` test girdisi dahil);
**yeniden boyutlandırılabilir sidebar** (aşağıya bakın); `astro dev`'de
`read_file` / `edit_file` / `write_file` / `list_files` / `grep` (allowlist +
`.env`/`data.db` kapalı).

**Markdown yanıtlar:** ajanın yanıtı düz metin gibi değil, biçimli render edilir —
başlıklar, **kalın**/*italik*, satır içi `kod`, fenced kod bloğu (dil etiketi +
**Kopyala** düğmesi), numaralı/madde listeleri, alıntı ve bağlantı. Ayrıştırıcı
bağımlılıksızdır (`lib/markdown.ts`) ve **ham HTML üretmez**: her token React
metin öğesine dönüşür, yalnız `http(s)/mailto/tel//#` bağlantıları tıklanabilir
olur. Akış sırasında da (yarım kalan kod bloğu dahil) aynı renderer çalışır.

**Kaydırma çubukları:** widget'ın tüm kaydırma alanları (sohbet günlüğü, geçmiş
rail'i, menüler, sayfa listesi, kod blokları) ince + yuvarlak ve **vurgu
renginde** (`rgba(143,182,255,.42)`, hover `#8fb6ff`); site genelinde marka
turuncusu (`--primary`). Not: `::-webkit-scrollbar` kuralları virgüllü seçici
listesiyle yazılamaz — Chromium kuralı listedeki *her* seçiciye uygular (pseudo
düşürülür); `styles.ts` bu yüzden pseudo'yu her seçici için tekrarlar
(`scrollersWith()`).

**Tema dili ve AI ile çeviri (çalışma anı i18n yok):** Hedef dil **ayarlarda**
durur — Admin → Plugins → Turan AI → *Tema dili (AI çeviri)* (`en/tr/de/fr/es`) —
ve çekmecedeki 🌐 düğmesinden de seçilir. Düğmedeki iki eylem ajanı çalıştırır:

- **Temayı … diline çevir:** tüm tema metinleri (`src/layouts`, `src/components`,
  `src/pages`, `src/data`) hedef dile çevrilir,
- **Yalnızca bileşenleri çevir (güvenli):** sadece `src/components` (tek turda biter).

Ajan metinleri **kaynak dosyalarda** `edit_file` ile değiştirir; bileşenler sade
Astro kalır, sözlük/runtime katmanı gerekmez. Prompt ajanı `write_file` ile
dosyayı baştan yazmaktan men eder, her dosyanın sonunun bozulmadığını doğrulatır
(bir kez dosya kesilmesi yaşandığı için bu kural serttir) ve `<html lang>`i
günceller. EmDash i18n notu: `i18n.routing`ta `prefixDefaultLocale` /
`prefix-always` **kullanılmaz** — `/_emdash/admin` rotaları 404 döner.

**Çok dilli routing + hreflang (tema-bağımsız):** Site `astro.config.mjs`'te
Astro `i18n` bloğunu tanımladığında (EmDash aynı bloğu `getI18nConfig()` ile
okur) widget iki şeyi **tema dosyasına dokunmadan** yapar:

- **hreflang:** `page:metadata` hook'u her sayfa için `rel="alternate"
  hreflang="…"` + `x-default` üretir (varsayılan dil öneksiz, diğerleri
  `/{code}/…`). İçerik sayfalarında (`page.context.content` varsa) susar —
  orada `EmDashHead` çeviri gruplarından alternates üretir, çift kayıt olmaz.
- **Dil değiştirici:** `page:fragments` kendini monte eden
  `<turan-lang-switcher>` enjekte eder: sayfada `header / [role=banner] /
  #site-header / .site-header` varsa oraya, yoksa sağ üste sabitlenir. Tema
  isterse kendi `<turan-lang-switcher>` elementini koyabilir (bizimki çekilir).
  Dil listesi **yalnız** `i18n.locales`'ten gelir (kopya yok); `lang`/`hreflang`
  ve `aria-current` doğru işaretlenir. Ayarlardan **kapatılabilir**
  (*Dil değiştirici + hreflang → Kapalı*).

**Farklı slug'lı çeviriler (içerik sayfaları):** Layout'a
`content={{ collection, id, slug }}` geçildiğinde iki katman birlikte çalışır:

- `EmDashHead` → çeviri grubundan **hreflang alternates** üretir: her çeviri
  kendi slug'ıyla, self-referencing + `x-default`; yayında olmayan/noindex/
  rotasız çeviriler dışlanır. Bizim plugin bu sayfalarda **susar** (çift kayıt
  olmaz; EmDashHead `hreflang` değerine göre dedupe eder).
- Switcher → `ctx.content.getTranslations()` + `getPublicUrl()` ile her dilin
  **kendi slug'ına** bağlanır; yayınlanmış çevirisi olmayan dil, varsayılan
  kaydın yolu + o dilin önekiyle (fallback davranışıyla) bağlanır.

Doğrulanan örnek: `tr` çevirisi `kaynak-duzenleme-rehberi` slug'ıyla
yayımlandı → EN sayfasında `hreflang="tr" → /tr/posts/kaynak-duzenleme-rehberi`,
`x-default → /posts/kaynak-duzenleme`; TR sayfası kendi kaydını render ediyor ve
switcher'da EN → `/posts/kaynak-duzenleme` gösteriyor.

Not: `routing.fallbackType: "rewrite"` ile `/de/…` istekleri varsayılan dil
sayfasını render eder; **metin** çevirisi ayrı iş: tema metni AI çeviri eylemiyle,
içerik ise EmDash'te `locale`/`translationOf` ile çevrilir.

**Medya çevirisi (alt / caption / PDF):** EmDash her medya için tek `alt`/`caption`
tutar; yerelleştirilmiş değerler widget'ın KV'sinde (`mediai18n:<id>:<locale>`)
saklanır ve **tema dosyası değişmeden** enjekte edilen küçük bir script ile
sayfaya uygulanır:

- `<img>` → yerelleştirilmiş **alt** metni (Astro `/_image?href=…` optimizasyonu
  dahil: eşleştirme basename + decode edilmiş `href` ile yapılır),
- `<figure><figcaption>` → yalnızca metin kaydedilen kaynak caption ile **birebir
  eşleşiyorsa** çeviriyle değiştirilir (yanlış yere yazmaz),
- `<a href="…pdf">` → o dile ait **dosya varyantı** (`localizedUrl`) — yerelleştirilmiş
  PDF/görsel için.

Yönetim: rotalar `media/list`, `media/set`, `media/remove`; ajan araçları
`media_list`, `media_set_translation` (AI çeviri prompt'u bunları kullanır).
Kütüphane dışındaki statik varlıklar da desteklenir: `mediaId: "static:<ad>"` +
`url`. Yetki: widget paketine **`media:read`** eklendi (kurulum onayı yenilenir).

Doğrulanan: TR kaydı (`/karakasmuhendislik-96.webp` → "Karakaş Mühendislik
logosu") TR sayfada uygulandı, EN sayfada orijinal alt korundu. Caption ve PDF
varyantı kod yolu hazır; demo sitesinde bu öğeler bulunmadığı için canlı
örneklenmedi.

**Canvas dil kapsamı (çoklu seçim):** Canvas araç çubuğunda (`#t-bar2`) diller
**bayrak + dil adı** çipleri olarak yan yana görünür (`🇬🇧 English · 🇹🇷 Türkçe ·
🇩🇪 Deutsch · 🇫🇷 Français · 🇪🇸 Español`). Çipe tıklayınca o dil
seçilir/kaldırılır (`aria-pressed`, klavye odağında görünür çerçeve); yanındaki
`×` tüm seçimi temizler. Hemen sağında **URL alanı** o dilin sayfa adresini
gösterir (ör. `http://localhost:4323/es/`; seçim yoksa varsayılan dilin URL'i).
Seçim `localStorage`'da saklanır ve `[SCOPE]` bloğu olarak ajana gider:

```
[SCOPE]
Aktif diller: tr, de
Tüm değişiklikleri yalnızca bu diller için yap: CMS içeriği (locale/translationOf),
medya metinleri (media_set_translation) … tema kaynağını topluca değiştirme.
```

Böylece **hangi dil(ler) seçiliyse AI yalnızca onlarda spesifik değişiklik yapar**;
dile özgü olamayan bir istek gelirse genel değişiklik yapmadan kısaca açıklar.

**Translation lists paneli:** Canvas üst çubuğundaki **Translation lists** düğmesi
sağdan açılan bir panel açar (`role="dialog"`):

- **Text / Media** sekmeleri (canlı sayılar; media'da çevrilmemiş varsa **NEW**),
- **arama**, **dil** seçici (bayrak + ad; `i18n.locales`), **koleksiyon** filtresi
  (text) ve yenile; sağda **sonuç sayısı**,
- **Text** satırları o dildeki CMS kayıtlarıdır (`schema → collections → entries`):
  koleksiyon · slug · başlık · durum + **AI ile çevir** (o kayıt için `[SCOPE]`'lu
  prompt gönderir),
- **Media** satırları medya kütüphanesi + `mediai18n` kayıtlarının birleşimidir:
  orijinal URL · *Dosya (yerelleştirilmiş)* · *Alt* · *Caption* alanları,
  **Kaydet** (`media/set`) ve **AI ile çevir**.

Erişilebilirlik: panel `role="dialog"` + `aria-modal` + başlık bağlantısı
(`aria-labelledby`) taşır; açılınca odak panelin içine alınır, **Tab focus trap**
uygulanır, **Escape** ve **backdrop'a tıklama** paneli kapatır, kapanışta odak
tetikleyici düğmeye geri döner. Düğmelerde `focus-visible` halkası vardır.

Veri rotası `translations/list` (`{locale}`) her açılışta CMS'ten ve KV'den
okur; liste tamamen dinamiktir (demo: `tr` → Text 1, Media 1).

**Weglot paritesi (çok dilli SEO/GEO + yayın):**

- **hreflang:** içerik sayfalarında `EmDashHead` çeviri grubundan (farklı slug'lar
  dahil, self + `x-default`); içerik dışı sayfalarda plugin `page:metadata`.
- **Yerelleştirilmiş metadata:** dil başına `<title>`, `description`, dil önekli
  **canonical**, OG/Twitter (EmDashHead); astro-seo kaldırıldı (çift etiket yok).
- **Dil bazlı slug:** EmDash `slug` alanı locale başına (ör. `kaynak-duzenleme` ↔
  `kaynak-duzenleme-rehberi`).
- **Dil bazlı publish/unpublish:** panelde durum düğmesi + `translations/publish`
  (`getVersioned` → `publish|unpublish`).
- **Otomatik senkron tespiti:** `translations/list` varsayılan dildeki kayıtları
  çeviri grubuyla karşılaştırır; eksik diller **pending** olarak listelenir,
  panelde "N kayıt bu dilde çevrilmemiş" + **Hepsini AI ile çevir** çıkar.
- **Sitemap/GEO:** `/sitemap-{koleksiyon}.xml` her dil URL'ini ve
  `xhtml:link hreflang` + `x-default` alternates'ini üretir.

Testler (canlı): yayından al → `/tr/posts/…` **404**, yeniden yayımla → **200**;
pending **4** kayıt; TR canonical `/tr/posts/kaynak-duzenleme-rehberi`; sitemap'te
en/tr alternates + x-default.

**Araç çağrıları (kompakt):** Bir turda onlarca araç çağrısı olabilir; transkript
bunları **tek bir özet satırında** gösterir — örn. *"✓ 17 komut çalıştı · grep ×9,
read_file ×4, list_files ×2 +2"*. Satıra tıklayınca (native `<details>`, klavye ve
ekran okuyucu uyumlu; chevron döner) çağrılar tek tek açılır: her satır durum
ikonu + araç adı + **kısaltılmış argüman önizlemesi** (`…` ile) ve genişletilince
tam argüman + sonuç. Hata olan grupta satır kırmızı ikonla **otomatik açık**
gelir; çalışırken "Çalışıyor · N komut" (`aria-live="polite"`) olarak canlı
sayar. Kayıtlı oturumlarda da aynı gruplama geçerlidir.

**Sohbet geçmişi (sol sütun):** çekmecenin solunda kalıcı bir rail:
`<nav aria-label="Sohbet geçmişi">` + `＋ Yeni sohbet` + oturum listesi
(başlık ve mesaj sayısı). Etkin sohbet `aria-current="true"` ile işaretlenir,
öğeler klavyeyle gezilebilir. Başlıktaki saat düğmesiyle göster/gizle
(`aria-expanded` + `aria-controls`); çekmece **430px altına inince** rail
otomatik gizlenir ve yerine besteci içindeki saat **popover**'ı devreye girer.
Yeni oturumların başlığı seçim bloğundan (`[SECLI_OGELER]…`) arındırılır.

**Sidebar boyutlandırma (erişilebilir):** çekmecenin sağ kenarında
`role="separator"`, `aria-orientation="vertical"`, `aria-valuemin/max/now` +
`aria-valuetext` taşıyan ve `tabindex="0"` ile odaklanabilen bir tutamaç var:
- **Fare:** sürükle (pointer capture; `cursor: col-resize`), **çift tık** → varsayılan (460px),
- **Klavye:** ←/→ (16px), **Shift**+←/→ (64px), **Home/End** → min/max, **Enter/Space** → varsayılan,
- **Daralt/Genişlet** düğmesi (`aria-expanded` + `aria-controls`) ve genişlik
  `localStorage`'da saklanır (300–720px arası; dar ekranda %70 ile sınırlı),
- genişlik değişince canvas yeniden hesaplanır (pencereler yeni ızgaraya oturur),
- klavye odağında `:focus-visible` çerçevesi, ekran okuyucuya piksel değeri duyurulur.

**Sandbox çekirdeği:** Block Kit admin sohbeti (form tabanlı), `ask` route
(+MCP aracı `turan__ask`), **`content/publish` route (MCP aracı `turan__publish`,
`destructive: true`)**, `get_site_info`, `content_list/get/create/update`
(taslak), `content_publish` / `content_unpublish`, `status`, `sessions/*`.

**Taslak, yayın ve geri alma:** `content_update`/`content_create` önce taslak
yazar, ajan **aynı turda `content_publish` ile yayımlar ve sormaz** (değişiklik
anında canlıda olur). Her içerik mutasyonu **changeId** ile bir yığının
(`undo:stack`, son 20) üzerine kaydedilir; ajan turu `content_changed` olayı
yayar ve yanıt mesajına `changeIds` yazar:
- **Mesaj bazlı undo:** değişikliği isteyen **kullanıcı mesajının** altında
  (kopyala/düzenle ikonlarının yanında) **↶ Geri al** düğmesi — yalnız o turun
  değişikliklerini geri alır (alan değerleri + görünürlük), düğme kaybolur ve
  pencereler yenilenir; `changeIds` transkripte yazıldığı için yenileme sonrası
  da görünür,
- **MCP:** `turan__undo` (destructive) — `changeId` verilebilir; sandbox'ta
  Block Kit sohbetinde de "↶ Son değişikliği geri al" düğmesi çıkar,
- Ajan aracı `undo_last_change` ("geri al" dediğinizde; isteğe bağlı `changeId`).

Widget yayımlama/geri alma sonrası **pencereleri otomatik yeniler**, böylece
değişiklik anında görünür.


```sh
pnpm --filter turan-emdash validate | test | build   # manifest + sandbox host testleri + dist
pnpm --filter turan-widget build:widget              # React widget bundle'ı (fragment'a gömülür)
pnpm --filter playground dev                         # site (localhost:4323)
```

Notlar:

- `turan-widget` bundle'ı `page:fragments` ile **inline** enjekte edilir
  (EmDash plugin route'larından JS servis etmeyi yasaklar); widget `status`
  route'u 200 dönmezse kendini kaldırır, ziyaretçiye görünmez.
- Sandbox pakette `zod` EmDash'in sürümüne hizalıdır; widget paketinde route
  `input` şemaları `routeInput()` ile tip-düzeyinde izole edilir (runtime'da
  host şemayı kullanır).
- `emdash-plugin.jsonc` sandbox paketin sözleşmesidir: yeni yetki/public
  route/MCP aracı eklemek kurulum onayını yeniler.

## Astro boilerplate (`apps/playground`)

Playground artık **Karakas/Sveltia şablonunun birebir tasarım katmanını** taşır
(`/home/fuat/Desktop/Klasör/++++/karakas/karakas-sveltia`) ve EmDash CMS ile
birleşiktir. Yeni siteler bu iskeletten türetilir.

| Katman | Kaynak / araç |
|---|---|
| UI bileşenleri | `bejamas/ui` registry → **CLI ile kuruldu**: `accordion, button, carousel, marquee, navigation-menu` (+ `src/ui/icon/SemanticIcon.astro`) |
| Tasarım jetonları | `src/styles/globals.css` (Tailwind 4 + `bejamas/tailwind.css` + `tw-animate-css`); `--primary:#dd641e`, `--radius:0`, Space Grotesk |
| Tema yapılandırması | `components.json` (`style: bejamas-juno`), `tsconfig.json` → `@/*` |
| Fontlar | `public/font/space-grotesk-*-variable.woff2` + `astro:assets` `Font` (astro.config `fonts`) |
| Site bileşenleri | `src/components/*` (SiteHeader/Footer, ServiceCard/Carousel, CtaBanner, WhyChooseUs, ProjectForm, …) |
| İçerik/veri | `src/data/*` (site-settings, services, couriers, site.ts) + `src/content/*` (posts, pages, services, service-articles, couriers) |
| Sayfalar | `src/pages/*` — tüm Karakas rotaları (`getStaticPaths` kullananlar `export const prerender = true`) |

EmDash bağlantısı korunur: `src/layouts/Layout.astro` (Karakas kabuğu)
`EmDashHead` / `EmDashBodyStart` / `EmDashBodyEnd` + `createPublicPageContext`
kancalarını taşır; `Base.astro` ince bir sarmalayıcıdır. EmDash'e ait `/posts/*`
ve `/pages/*` rotaları ajanın içerik araçlarıyla düzenlenmeye devam eder.

Kural: yeni bir UI primitif gerekirse elle yazmak yerine `npx bejamas add <ad>`
ile `bejamas/ui`'den kurulur (skill: `bejamas-ui-components`); bileşenler
`src/ui/<ad>/` altında projeye ait (source-owned) dosyalar olarak yaşar.

> Not: Şablondaki firma bilgisi (ad, logo, telefon, WhatsApp, Google yorumları)
> Karakas Mühendislik **demo** verisidir; canlıya çıkmadan önce
> `src/data/site-settings.json` ve görseller gerçek müşteriyle değiştirilmelidir.

Temanın **kaynak dili tek**dir (şu an Türkçe) ve çalışma anında i18n katmanı
yoktur; dil desteği Talimatlar → *Tema dili (AI çeviri)* + çekmecedeki 🌐
"… diline çevir" eylemiyle **AI tarafından kaynak metinlere** uygulanır
(ör. İngilizce'ye çevirince tema İngilizce olur, `<html lang>` de güncellenir).

