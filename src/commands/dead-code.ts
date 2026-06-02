// src/commands/dead-code.ts
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type ExecError = Error & {
	stdout?: Buffer | string;
};

interface IgnorePatterns {
	src: string[];
	tests: string[];
	common: string[];
}

interface Config {
	ignorePatterns?: IgnorePatterns;
}

interface DeadCodeResult {
	defaultLines: string[];
	otherLines: string[];
}

function isExecError(error: unknown): error is ExecError {
	return typeof error === "object" && error !== null && "stdout" in error;
}

function readConfig(): Config {
	// FIX: читаем из root проекта, а не из dist/scripts
	const configPath = path.join(process.cwd(), "scripts/.codecheck.config.json");

	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(raw);
		return parsed.deadCode ?? {};
	} catch {
		return {};
	}
}

function getDefaultIgnorePatterns(): IgnorePatterns {
	return { src: [], tests: [], common: [] };
}

function runTsPrune(): string {
	try {
		return execSync("ts-prune -p tsconfig.json", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		});
	} catch (error: unknown) {
		if (isExecError(error)) {
			return error.stdout?.toString() ?? "";
		}
		throw error;
	}
}

function runInternal(type: "src" | "tests"): DeadCodeResult {
	const config = readConfig();
	const ignorePatterns = config.ignorePatterns ?? getDefaultIgnorePatterns();

	const patterns: string[] = [...ignorePatterns.common];

	if (type === "src") patterns.push(...ignorePatterns.src);
	if (type === "tests") patterns.push(...ignorePatterns.tests);

	const output = runTsPrune();

	const lines = output
		.split("\n")
		.filter(Boolean)
		.filter((line) => {
			const normalized = line.replaceAll("\\", "/");

			return !patterns.some((pattern) => {
				try {
					return new RegExp(pattern).test(normalized);
				} catch {
					return false;
				}
			});
		});

	const defaultLines: string[] = [];
	const otherLines: string[] = [];

	for (const line of lines) {
		if (line.includes(" - default")) {
			defaultLines.push(line);
		} else {
			otherLines.push(line);
		}
	}

	return { defaultLines, otherLines };
}

function printResult(result: DeadCodeResult): void {
	if (result.defaultLines.length) {
		console.log("Default exports:");
		console.log(result.defaultLines.join("\n"));
	}

	if (result.otherLines.length) {
		console.log(result.otherLines.join("\n"));
	}
}

/**
 * PUBLIC API (используется CLI и может использоваться как npm package)
 */
export function runDeadCode(type: "src" | "tests" | "all" = "all"): void {
	const results: DeadCodeResult[] = [];

	if (type === "all") {
		results.push(runInternal("src"), runInternal("tests"));
	} else {
		results.push(runInternal(type));
	}

	results.forEach(printResult);

	const total = results.reduce((sum, r) => sum + r.otherLines.length, 0);

	if (total > 0) {
		throw new Error(`Найдено ${total} неиспользуемых экспортов`);
	}
}
