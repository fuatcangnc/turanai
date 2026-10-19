/** Markdown renderer: turns parsed tokens into React elements (never raw HTML). */

import type { ReactNode } from "react";

import type { Block, Inline } from "../lib/markdown";
import { parseMarkdown } from "../lib/markdown";

export interface MarkdownProps {
	text: string;
	/** Copy handler for fenced code blocks (the header button is hidden without it). */
	onCopy?(text: string): void;
}

function renderInline(nodes: Inline[], keyPrefix: string): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		switch (node.type) {
			case "strong":
				return <strong key={key}>{renderInline(node.children, key)}</strong>;
			case "em":
				return <em key={key}>{renderInline(node.children, key)}</em>;
			case "code":
				return <code key={key}>{node.value}</code>;
			case "link":
				return (
					<a key={key} href={node.href} target="_blank" rel="noreferrer noopener">
						{node.children.length ? renderInline(node.children, key) : node.href}
					</a>
				);
			default:
				return node.value;
		}
	});
}

function renderLines(lines: Inline[][], keyPrefix: string): ReactNode[] {
	return lines.map((line, index) => (
		<span key={`${keyPrefix}-l${index}`} className="t-md-line">
			{renderInline(line, `${keyPrefix}-${index}`)}
		</span>
	));
}

function renderBlock(block: Block, index: number, onCopy?: (text: string) => void): ReactNode {
	const key = `b${index}`;
	switch (block.type) {
		case "heading": {
			const Tag = (`h${block.level}` as const) satisfies keyof React.JSX.IntrinsicElements as "h1" | "h2" | "h3" | "h4";
			return <Tag key={key}>{renderInline(block.content, key)}</Tag>;
		}
		case "list":
			return block.ordered ? (
				<ol key={key}>
					{block.items.map((item, i) => (
						<li key={`${key}-i${i}`}>{renderLines([item], `${key}-i${i}`)}</li>
					))}
				</ol>
			) : (
				<ul key={key}>
					{block.items.map((item, i) => (
						<li key={`${key}-i${i}`}>{renderLines([item], `${key}-i${i}`)}</li>
					))}
				</ul>
			);
		case "quote":
			return <blockquote key={key}>{renderLines(block.lines, key)}</blockquote>;
		case "code":
			return (
				<div className="t-md-code" key={key}>
					<div className="t-md-codehead">
						<span>{block.lang || "code"}</span>
						{onCopy ? (
							<button type="button" className="t-md-copy" onClick={() => onCopy(block.value)} title="Copy code">
								Copy
							</button>
						) : null}
					</div>
					<pre>
						<code>{block.value}</code>
					</pre>
				</div>
			);
		case "hr":
			return <hr key={key} />;
		default:
			return <p key={key}>{renderLines(block.lines, key)}</p>;
	}
}

export function Markdown({ text, onCopy }: MarkdownProps) {
	const blocks = parseMarkdown(text);
	if (!blocks.length) return null;
	return <div className="t-md">{blocks.map((block, index) => renderBlock(block, index, onCopy))}</div>;
}
