/** Widget entry: guards, mount point under <html>, React root. */

import { createRoot } from "react-dom/client";

import { App } from "./App";
import { injectStyles } from "./styles";

declare global {
	interface Window {
		__turanWidget?: boolean;
	}
}

if (window.self === window.top && !window.__turanWidget) {
	window.__turanWidget = true;
	// Styles must exist before the first render: the layout measures the
	// drawer, and without the CSS it would measure the whole viewport.
	injectStyles(document);
	const mount = () => {
		const host = document.createElement("div");
		host.id = "turan-root";
		document.documentElement.appendChild(host);
		createRoot(host).render(<App />);
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
	else mount();
}
