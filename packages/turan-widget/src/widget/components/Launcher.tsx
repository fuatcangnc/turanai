/** Floating launcher; hidden until the private `status` route answers. */

import { Icon } from "../ui/icons";

export function Launcher({ ready, onOpen }: { ready: boolean; onOpen(): void }) {
	return (
		<button id="turan-btn" type="button" style={{ display: ready ? "inline-flex" : "none" }} onClick={onOpen}>
			<Icon name="spark" />
			<span>&nbsp;AI</span>
		</button>
	);
}
