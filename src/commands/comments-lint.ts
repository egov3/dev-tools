// src/commands/comments-lint.ts
import { execSync } from "node:child_process";
import fs from "node:fs";

export interface CommentsLintOptions {
	configPath?: string;
}

export function runCommentsLint(options: CommentsLintOptions = {}) {
	const CONFIG_FILE = options.configPath ?? "scripts/.codecheck.config.json";

	let commentExcludes: string[] = [];

	if (fs.existsSync(CONFIG_FILE)) {
		const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
		commentExcludes = cfg.commentsLint?.excludeFiles ?? [];
	}

	let files: string[] = [];

	try {
		const staged = execSync("git diff --cached --name-only --diff-filter=d", {
			encoding: "utf-8",
		})
			.split("\n")
			.filter(Boolean)
			.filter((f) => /\.(ts|tsx|js|jsx|css|scss)$/.test(f));

		if (commentExcludes.length) {
			const excludeRegex = new RegExp(commentExcludes.join("|"));
			files = staged.filter((f) => !excludeRegex.test(f));
		} else {
			files = staged;
		}
	} catch (e) {
		throw new Error(`Failed to get staged files: ${e}`);
	}

	if (!files.length) return [];

	const forbiddenComments: string[] = [];

	for (const file of files) {
		if (!fs.existsSync(file)) continue;

		const content = fs.readFileSync(file, "utf-8").split("\n");

		content.forEach((line, idx) => {
			const match = /^\s*(\/\/|\/\*)/.exec(line);

			if (match && !/TODO|FIXME|NOTE|HACK|XXX/i.test(line)) {
				forbiddenComments.push(`${file}:${idx + 1}: ${line}`);
			}
		});
	}

	return forbiddenComments;
}
