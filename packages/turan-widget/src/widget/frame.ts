/** Same-origin iframe helpers for the picker (the live window is an iframe). */

export interface Selection {
	el: Element;
	tag: string;
	label: string;
	text: string;
	html: string;
	path: string;
}

export function elementLabel(el: Element): string {
	let name = el.tagName.toLowerCase();
	if (el.id) name += `#${el.id}`;
	else {
		const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : undefined;
		if (cls && !cls.startsWith("turan-") && !cls.startsWith("t-")) name += `.${cls}`;
	}
	return name.length > 34 ? `${name.slice(0, 34)}…` : name;
}

export function cssPath(el: Element, stopAt: Element | null): string {
	const parts: string[] = [];
	let node: Element | null = el;
	let guard = 0;
	while (node && node.nodeType === 1 && guard < 5 && node !== stopAt) {
		let part = node.tagName.toLowerCase();
		if (node.id) {
			parts.unshift(`#${node.id}`);
			break;
		}
		const parent = node.parentNode as Element | null;
		if (parent) {
			const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
			if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
		}
		parts.unshift(part);
		node = parent;
		guard++;
	}
	return parts.join(" > ");
}

export function describeSelection(el: Element, stopAt: Element | null): Selection {
	const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
	const html = el.outerHTML
		.replace(/\s+/g, " ")
		.replace(/ class="([^"]*)\bturan-sel\b([^"]*)"/g, (_m, before: string, after: string) => {
			const cls = `${before} ${after}`.replace(/\s+/g, " ").trim();
			return cls ? ` class="${cls}"` : "";
		})
		.slice(0, 500);
	return { el, tag: el.tagName.toLowerCase(), label: elementLabel(el), text, html, path: cssPath(el, stopAt) };
}

export function selectionContext(selected: Selection[]): string {
	if (!selected.length) return "";
	const lines = selected.map(
		(s, i) => `#${i + 1} <${s.tag}> css: ${s.path}${s.text ? ` | text: "${s.text}"` : ""} | html: ${s.html}`,
	);
	return `[SECLI_OGELER]\n${lines.join("\n")}\n[/SECLI_OGELER]\n\n`;
}

export interface FrameBinding {
	clearHighlight(): void;
	destroy(): void;
}

export function bindFrame(
	doc: Document,
	handlers: { isPicking(): boolean; onPick(el: Element): void; onNavigate(url: string): void; onOutsideClick(): void },
): FrameBinding {
	const { hl, hlTag } = injectFrameStyles(doc);
	let current: Element | null = null;

	const onMove = (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (!target || target.nodeType !== 1 || target === doc.documentElement || target === hl) {
			hl.style.display = "none";
			return;
		}
		const r = target.getBoundingClientRect();
		hl.style.display = "block";
		hl.style.left = `${r.left}px`;
		hl.style.top = `${r.top}px`;
		hl.style.width = `${r.width}px`;
		hl.style.height = `${r.height}px`;
		hlTag.textContent = elementLabel(target);
		current = target;
	};

	const onClick = (e: MouseEvent) => {
		const target = (e.target as Element | null) ?? null;
		if (!target || target.nodeType !== 1) return;
		if (handlers.isPicking()) {
			e.preventDefault();
			e.stopPropagation();
			hl.style.display = "none";
			handlers.onPick(target);
			return;
		}
		handlers.onOutsideClick();
		const anchor = target.closest("a");
		const href = anchor?.getAttribute("href");
		if (anchor && href && !href.startsWith("#")) {
			e.preventDefault();
			e.stopPropagation();
			handlers.onNavigate((anchor as HTMLAnchorElement).href);
		}
	};

	doc.addEventListener("mousemove", onMove, true);
	doc.addEventListener("click", onClick, true);
	return {
		clearHighlight: () => {
			hl.style.display = "none";
			current = null;
		},
		destroy: () => {
			doc.removeEventListener("mousemove", onMove, true);
			doc.removeEventListener("click", onClick, true);
			if (current) current.classList.remove("turan-sel");
		},
	};
}

function injectFrameStyles(doc: Document): { hl: HTMLElement; hlTag: HTMLElement } {
	const style = doc.createElement("style");
	style.textContent = [
		".turan-pick, .turan-pick *{cursor:crosshair !important}",
		".turan-sel{outline:2px solid #4f8cff !important;outline-offset:2px}",
		"#turan-fhl{position:fixed;z-index:2147483000;pointer-events:none;border:2px solid #4f8cff;border-radius:5px;box-sizing:border-box;display:none}",
		"#turan-fhl span{position:absolute;top:-20px;left:-2px;background:#4f8cff;color:#fff;font:500 10.5px/1.6 ui-sans-serif,system-ui;padding:1px 6px;border-radius:4px 4px 0 0;white-space:nowrap;max-width:260px;overflow:hidden}",
	].join("");
	doc.head.appendChild(style);
	const hl = doc.createElement("div");
	hl.id = "turan-fhl";
	const tag = doc.createElement("span");
	hl.appendChild(tag);
	doc.documentElement.appendChild(hl);
	return { hl, hlTag: tag };
}
