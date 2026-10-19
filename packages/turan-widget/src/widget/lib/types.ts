/** Widget-local view models. */

export interface Tab {
	url: string;
	title: string;
}

export interface ToolChip {
	callId: string;
	name: string;
	args: unknown;
	ok?: boolean;
	summary?: string;
	running: boolean;
}

export interface SessionItem {
	id: string;
	title: string;
	updatedAt: string;
	messageCount: number;
}

export interface PageItem {
	url: string;
	title: string;
}
