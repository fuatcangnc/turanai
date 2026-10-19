/**
 * Dev-only, path-guarded filesystem tools. Constrained to a source allowlist
 * under the project root and inert in production builds (import.meta.env.DEV
 * is a compile-time constant).
 */

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOW_PREFIXES = ["src/", "seed/", "public/", "scripts/"];
const ALLOW_FILES = new Set(["astro.config.mjs", "package.json"]);
const DENY_PATTERNS = [".env", "data.db", "node_modules", "/.git/", "uploads/"];
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", ".astro", ".output", ".emdash", "uploads"]);
const TEXT_EXTENSIONS = new Set([
	".astro", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
	".css", ".md", ".html", ".svg", ".txt", ".yml", ".yaml",
]);

const MAX_READ_BYTES = 400_000;
const MAX_GREP_FILE_BYTES = 512_000;
const MAX_GREP_MATCHES = 200;

/** True only under `astro dev`; `astro build` inlines this as `false`. */
export function isDevServer(): boolean {
	// Static access is required: Vite's module runner rejects dynamic access.
	return import.meta.env.DEV === true;
}

function assertDev(): void {
	if (!isDevServer()) throw new Error("Turan dosya araçları yalnız geliştirme sunucusunda çalışır.");
}

function projectRoot(): string {
	return process.cwd();
}

export interface SafePath {
	abs: string;
	rel: string;
}

/** Accept both `src/...` paths and the bare allowed roots (`src`). */
function isAllowed(rel: string): boolean {
	if (ALLOW_FILES.has(rel)) return true;
	return ALLOW_PREFIXES.some((prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix));
}

function safeResolve(relInput: string): SafePath {
	const root = projectRoot();
	const rel = relInput.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
	if (!rel || path.isAbsolute(rel) || rel.split("/").includes("..")) {
		throw new Error(`Yol proje köküne göre göreli olmalı ve ".." içermemeli ("${relInput}").`);
	}
	const abs = path.resolve(root, rel);
	if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`Yol proje kökünün dışına çıkıyor: "${relInput}"`);
	const posixRel = path.relative(root, abs).split(path.sep).join("/");
	const probe = `/${posixRel}/`;
	if (posixRel === ".env" || DENY_PATTERNS.some((pattern) => posixRel.startsWith(pattern) || probe.includes(pattern))) {
		throw new Error(`Bu yol ajana kapalı: "${posixRel}"`);
	}
	if (!isAllowed(posixRel)) {
		throw new Error(`"${posixRel}" izinli liste dışında (${ALLOW_PREFIXES.join(", ")} + ${[...ALLOW_FILES].join(", ")}).`);
	}
	return { abs, rel: posixRel };
}

export async function readProjectFile(
	relInput: string,
	options: { offset?: number; limit?: number } = {},
): Promise<{ path: string; content: string; bytes: number; totalLines: number; from: number; to: number; truncated: boolean }> {
	assertDev();
	const { abs, rel } = safeResolve(relInput);
	const info = await stat(abs).catch(() => null);
	if (!info || !info.isFile()) throw new Error(`Dosya yok: "${rel}"`);
	const raw = await readFile(abs, "utf8");
	const lines = raw.split("\n");
	const totalLines = lines.length;
	// Line-addressed paging keeps large files readable instead of truncating the
	// head (the agent then greps endlessly to find later sections).
	const maxLines = options.limit && options.limit > 0 ? Math.min(options.limit, 400) : 400;
	const from = Math.max(1, Math.trunc(options.offset ?? 1));
	const to = Math.min(totalLines, from + maxLines - 1);
	const content = lines.slice(from - 1, to).join("\n");
	return {
		path: rel,
		content,
		bytes: info.size,
		totalLines,
		from,
		to,
		truncated: from > 1 || to < totalLines,
	};
}

export async function writeProjectFile(relInput: string, content: string): Promise<{ path: string; bytes: number }> {
	assertDev();
	const { abs, rel } = safeResolve(relInput);
	// New components/styles usually need their directory created first.
	await mkdir(path.dirname(abs), { recursive: true });
	await writeFile(abs, content, "utf8");
	return { path: rel, bytes: Buffer.byteLength(content, "utf8") };
}

export async function editProjectFile(args: {
	path: string;
	oldString: string;
	newString: string;
	replaceAll?: boolean;
}): Promise<{ path: string; replacements: number; bytes: number }> {
	assertDev();
	if (!args.oldString) throw new Error("oldString boş olamaz.");
	// Always edit the FULL file. readProjectFile is paged for prompting; using it
	// here would write back only the first page and truncate the rest.
	const { abs, rel } = safeResolve(args.path);
	const full = await readFile(abs, "utf8");
	const occurrences = full.split(args.oldString).length - 1;
	if (occurrences === 0) throw new Error(`oldString "${rel}" içinde bulunamadı.`);
	if (occurrences > 1 && !args.replaceAll) {
		throw new Error(`oldString "${rel}" içinde ${occurrences} kez geçiyor; bağlam ekleyin veya replaceAll kullanın.`);
	}
	const updated = args.replaceAll
		? full.split(args.oldString).join(args.newString)
		: full.replace(args.oldString, args.newString);
	// Guard: an edit must not silently drop big parts of a file.
	const beforeLines = full.split("\n").length;
	const afterLines = updated.split("\n").length;
	if (beforeLines >= 120 && afterLines < beforeLines * 0.7) {
		throw new Error(
			`Bu düzenleme dosyanın %${Math.round((1 - afterLines / beforeLines) * 100)}'ini siliyor (${beforeLines} → ${afterLines} satır). Daha küçük oldString/newString kullanın veya write_file ile tam içeriği yazın.`,
		);
	}
	const written = await writeProjectFile(rel, updated);
	return { ...written, replacements: args.replaceAll ? occurrences : 1 };
}

export async function listProjectTree(dirInput = ".", maxDepth = 3): Promise<Array<{ path: string; bytes: number }>> {
	assertDev();
	const root = projectRoot();
	const start = dirInput === "." ? root : safeResolve(dirInput).abs;
	const startInfo = await stat(start).catch(() => null);
	// A file path is valid input: return just that file instead of ENOTDIR.
	if (startInfo?.isFile()) {
		const rel = path.relative(root, start).split(path.sep).join("/");
		return [{ path: rel, bytes: startInfo.size }];
	}
	const entries: Array<{ path: string; bytes: number }> = [];
	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > maxDepth || entries.length >= 800) return;
		for (const dirent of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
			if (IGNORE_DIRS.has(dirent.name)) continue;
			const abs = path.join(dir, dirent.name);
			const rel = path.relative(root, abs).split(path.sep).join("/");
			if (dirent.isDirectory()) {
				entries.push({ path: `${rel}/`, bytes: 0 });
				await walk(abs, depth + 1);
			} else if (dirent.isFile()) {
				const info = await stat(abs).catch(() => null);
				entries.push({ path: rel, bytes: info?.size ?? 0 });
			}
		}
	}
	await walk(start, 0);
	return entries;
}

export async function grepProject(args: {
	pattern: string;
	dir?: string;
	pathContains?: string;
}): Promise<{ matches: Array<{ path: string; line: number; text: string }>; truncated: boolean }> {
	assertDev();
	if (!args.pattern) throw new Error("pattern gerekli");
	let regex: RegExp;
	try {
		regex = new RegExp(args.pattern, "g");
	} catch (error) {
		throw new Error(`Geçersiz düzenli ifade: ${(error as Error).message}`);
	}
	const root = projectRoot();
	const start = args.dir && args.dir !== "." ? safeResolve(args.dir).abs : root;
	const startInfo = await stat(start).catch(() => null);
	// Grep inside a single file when `dir` points at one (common agent input).
	if (startInfo?.isFile()) {
		const matches: Array<{ path: string; line: number; text: string }> = [];
		const rel = path.relative(root, start).split(path.sep).join("/");
		const lines = (await readFile(start, "utf8")).split("\n");
		lines.forEach((text, index) => {
			regex.lastIndex = 0;
			if (regex.test(text)) matches.push({ path: rel, line: index + 1, text: text.trim().slice(0, 200) });
		});
		return { matches: matches.slice(0, 80), truncated: matches.length > 80 };
	}
	const matches: Array<{ path: string; line: number; text: string }> = [];
	let truncated = false;
	async function walk(dir: string): Promise<void> {
		if (truncated) return;
		for (const dirent of await readdir(dir, { withFileTypes: true })) {
			if (truncated) return;
			if (IGNORE_DIRS.has(dirent.name)) continue;
			const abs = path.join(dir, dirent.name);
			const rel = path.relative(root, abs).split(path.sep).join("/");
			if (dirent.isDirectory()) {
				await walk(abs);
				continue;
			}
			if (!dirent.isFile() || !TEXT_EXTENSIONS.has(path.extname(dirent.name).toLowerCase())) continue;
			if (args.pathContains && !rel.includes(args.pathContains)) continue;
			const info = await stat(abs).catch(() => null);
			if (!info || info.size > MAX_GREP_FILE_BYTES) continue;
			const raw = await readFile(abs, "utf8").catch(() => null);
			if (raw === null) continue;
			const lines = raw.split("\n");
			for (let i = 0; i < lines.length; i++) {
				regex.lastIndex = 0;
				if (regex.test(lines[i] ?? "")) {
					matches.push({ path: rel, line: i + 1, text: (lines[i] ?? "").trim().slice(0, 300) });
					if (matches.length >= MAX_GREP_MATCHES) {
						truncated = true;
						return;
					}
				}
			}
		}
	}
	await walk(start);
	return { matches, truncated };
}
