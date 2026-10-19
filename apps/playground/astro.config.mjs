import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
// Sandboxed plugin: the package's default export is the descriptor produced by
// `emdash-plugin build` (no factory call).
import turan from "turan-emdash";
// Trusted companion: the React in-page widget (AI mode, picker) + dev file tools.
import turanWidget from "turan-widget";

// Space Grotesk is served locally, exactly as in the Karakas/Sveltia template.
// (The bejamas CLI offered to inject a Google `Inter` font here; the theme keeps
// its own face, so that block was removed — re-add it only if Inter is wanted.)
const FONTS = [
	{
		provider: fontProviders.local(),
		name: "Space Grotesk",
		cssVariable: "--font-sans",
		options: {
			variants: [
				{
					src: ["./public/font/space-grotesk-latin-variable.woff2"],
					weight: "300 700",
					unicodeRange: ["U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
				},
				{
					src: ["./public/font/space-grotesk-latin-ext-variable.woff2"],
					weight: "300 700",
					unicodeRange: ["U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"],
				},
			],
		},
	},
];

export default defineConfig({
	output: "server",
	adapter: node({ mode: "standalone" }),
	// Astro i18n: EmDash reads the same block (`getI18nConfig()`). The Turan
	// widget turns it into a self-mounting language switcher + hreflang, with no
	// theme markup. Never set `routing.prefixDefaultLocale` ("prefix-always"):
	// /_emdash/admin routes would 404.
	i18n: {
		defaultLocale: "en",
		locales: ["en", "tr", "de", "fr", "es"],
		fallback: { tr: "en", de: "en", fr: "en", es: "en" },
		routing: { fallbackType: "rewrite" },
	},
	image: { layout: "constrained", responsiveStyles: true },
	fonts: FONTS,
	integrations: [
		icon({
			include: {
				lucide: [
					"arrow-left",
					"arrow-right",
					"check",
					"chevron-down",
					"chevron-right",
					"chevron-up",
					"clock-3",
					"globe",
					"languages",
					"mail",
					"map-pin",
					"menu",
					"phone",
					"search",
					"wrench",
					"x",
				],
				"simple-icons": ["facebook", "instagram", "youtube", "whatsapp"],
			},
		}),
		react(),
		emdash({
			database: sqlite({ url: "file:./data.db" }),
			storage: local({ directory: "./uploads", baseUrl: "/_emdash/api/media/file" }),
			plugins: [turan, turanWidget()],
		}),
	],
	vite: { plugins: [tailwindcss()] },
	devToolbar: { enabled: false },
});
