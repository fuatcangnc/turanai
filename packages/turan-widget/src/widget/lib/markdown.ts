/**
 * Dependency-free Markdown subset parser.
 *
 * The agent answers with Markdown (headings, **bold**, `code`, lists, fenced
 * blocks). Rendering that text verbatim looked like raw source, so it is parsed
 * into structured tokens here and turned into React elements by
 * `components/Markdown.tsx`. Nothing ever becomes raw HTML — every token is a
 * text node — so model output cannot inject markup.
 *
 * Supported: headings (#..####), paragraphs, ordered/unordered lists (one level
 * of continuation lines), blockquotes, fenced code (``` / ~~~), horizontal rules,
 * and inline code / bold / italic / links (http(s), mailto, tel, relative, #).
 * Not supported (rendered as plain text): tables, nested lists, images, HTML.
 */

export type Inline =
	| { type: "text"; value: string }
	| { type: "strong"; children: Inline[] }
	| { type: "em"; children: Inline[] }
	| { type: "code"; value: string }
	| { type: "link"; children: Inline[]; href: string };

export type Block =
	| { type: "p"; lines: Inline[][] }
	| { type: "heading"; level: 1 | 2 | 3 | 4; content: Inline[] }
	| { type: "list"; ordered: boolean; items: Inline[][] }
	| { type: "quote"; lines: Inline[][] }
	| { type: "code"; lang: string; value: string }
	| { type: "hr" };

/** Only these link targets are emitted as anchors. */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

/** code | strong (** veya __) | em (* veya _) | link */
const INLINE_PATTERN =
	/(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))/g;

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*(```|~~~)\s*([A-Za-z0-9+#._-]*)\s*$/;
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_ITEM = /^(\s*)(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/;
const QUOTE = /^\s*>\s?/;

export function parseInline(text: string): Inline[] {
	const out: Inline[] = [];
	let last = 0;
	for (const match of text.matchAll(INLINE_PATTERN)) {
		const index = match.index ?? 0;
		if (index > last) out.push({ type: "text", value: text.slice(last, index) });
		const token = match[0];
		if (token.startsWith("`")) {
			out.push({ type: "code", value: token.slice(1, -1) });
		} else if (token.startsWith("**") || token.startsWith("__")) {
			out.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
		} else if (token.startsWith("[")) {
			const split = token.indexOf("](");
			const label = token.slice(1, split);
			const href = token.slice(split + 2, -1);
			if (SAFE_HREF.test(href)) out.push({ type: "link", children: parseInline(label), href });
			else out.push({ type: "text", value: label });
		} else {
			out.push({ type: "em", children: parseInline(token.slice(1, -1)) });
		}
		last = index + token.length;
	}
	if (last < text.length) out.push({ type: "text", value: text.slice(last) });
	return out;
}

export function parseMarkdown(source: string): Block[] {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	let quote: string[] = [];

	const flushParagraph = () => {
		if (!paragraph.length) return;
		blocks.push({ type: "p", lines: paragraph.map(parseInline) });
		paragraph = [];
	};
	const flushQuote = () => {
		if (!quote.length) return;
		blocks.push({ type: "quote", lines: quote.map(parseInline) });
		quote = [];
	};
	const flushAll = () => {
		flushParagraph();
		flushQuote();
	};

	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? "";

		const fence = FENCE.exec(line);
		if (fence) {
			flushAll();
			const marker = fence[1] ?? "```";
			const lang = fence[2] ?? "";
			const body: string[] = [];
			i += 1;
			while (i < lines.length && !(lines[i] ?? "").trimStart().startsWith(marker)) {
				body.push(lines[i] ?? "");
				i += 1;
			}
			i += 1; // closing fence, or end of input for a still-streaming block
			blocks.push({ type: "code", lang, value: body.join("\n") });
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			flushAll();
			const level = Math.min(4, (heading[1] ?? "#").length) as 1 | 2 | 3 | 4;
			blocks.push({ type: "heading", level, content: parseInline((heading[2] ?? "").trim()) });
			i += 1;
			continue;
		}

		if (HR.test(line)) {
			flushAll();
			blocks.push({ type: "hr" });
			i += 1;
			continue;
		}

		if (QUOTE.test(line)) {
			flushParagraph();
			quote.push(line.replace(QUOTE, ""));
			i += 1;
			continue;
		}

		const item = LIST_ITEM.exec(line);
		if (item) {
			flushAll();
			const ordered = Boolean(item[3]);
			const items: Inline[][] = [[...parseInline((item[4] ?? "").trim())]];
			i += 1;
			while (i < lines.length) {
				const next = lines[i] ?? "";
				const nextItem = LIST_ITEM.exec(next);
				if (nextItem && Boolean(nextItem[3]) === ordered) {
					items.push([...parseInline((nextItem[4] ?? "").trim())]);
					i += 1;
					continue;
				}
				const continuation = /^\s+\S/.test(next) && !FENCE.test(next) && !HEADING.test(next) && !QUOTE.test(next);
				if (continuation) {
					const target = items[items.length - 1];
					if (target) target.push({ type: "text", value: " " }, ...parseInline(next.trim()));
					i += 1;
					continue;
				}
				break;
			}
			blocks.push({ type: "list", ordered, items });
			continue;
		}

		flushQuote();

		if (!line.trim()) {
			flushParagraph();
			i += 1;
			continue;
		}

		paragraph.push(line.trim());
		i += 1;
	}

	flushAll();
	return blocks;
}
