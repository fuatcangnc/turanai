/** Collapsed tool-call group: one compact summary row that expands into the calls. */

import { summarizeTools, toolArgsPreview, toolGroupLabel } from "../lib/tool-summary";
import type { ToolChip } from "../lib/types";
import { Icon } from "../ui/icons";

export interface ToolGroupProps {
	chips: ToolChip[];
}

export function ToolGroup({ chips }: ToolGroupProps) {
	if (!chips.length) return null;
	const counts = summarizeTools(chips);
	const failed = counts.failed > 0;
	const running = counts.running > 0;
	return (
		<details className="t-tg" open={failed || undefined}>
			<summary>
				<span className={`t-ticon${failed ? " bad" : ""}`}>
					<Icon name={running ? "term" : failed ? "close" : "check"} />
				</span>
				<span className="t-tg-label" aria-live={running ? "polite" : undefined}>
					{toolGroupLabel(counts)}
				</span>
				<span className="t-tg-chev" aria-hidden="true">
					<Icon name="chevron" />
				</span>
			</summary>
			<ul className="t-tg-list">
				{chips.map((chip) => {
					const preview = toolArgsPreview(chip.args);
					return (
						<li key={chip.callId}>
							<details className="t-tool">
								<summary>
									<span className="t-ticon">
										<Icon name={chip.running ? "term" : chip.ok === false ? "close" : "check"} />
									</span>
									<span className="t-tool-name">{chip.name}</span>
									{preview ? <span className="t-tool-args">{preview}</span> : null}
								</summary>
								<pre>
									{chip.args === undefined || chip.args === null ? "" : JSON.stringify(chip.args, null, 1)}
									{chip.summary ? `${chip.args == null ? "" : "\n→ "}${chip.summary}` : ""}
								</pre>
							</details>
						</li>
					);
				})}
			</ul>
		</details>
	);
}
