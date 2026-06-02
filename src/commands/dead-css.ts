#!/usr/bin/env ts-node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { PurgeCSS } from "purgecss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// -------------------------
// FILES
// -------------------------

const cssFiles = await glob("src/**/*.css", {
	cwd: projectRoot,
	absolute: true,
});

const contentPatterns = [
	"src/**/*.{ts,tsx,js,jsx}",
	"app/**/*.{ts,tsx,js,jsx}",
	"!src/**/*.test.{ts,tsx}",
	"!**/node_modules/**",
	"!**/.next/**",
	"!**/coverage/**",
	"!**/__tests__/**",
];

// -------------------------
// CACHE
// -------------------------

const fileCache = new Map<string, string>();
const contentFilePaths: string[] = [];

for (const pattern of contentPatterns) {
	const files = await glob(pattern, {
		cwd: projectRoot,
		absolute: true,
		ignore: ["**/node_modules/**", "**/.next/**", "**/coverage/**"],
	});

	contentFilePaths.push(...files);
}

for (const file of contentFilePaths) {
	try {
		fileCache.set(file, readFileSync(file, "utf-8"));
	} catch {}
}

const allContentText = Array.from(fileCache.values()).join("\n");

// -------------------------
// USED CLASSES
// -------------------------

function extractUsedClasses(content: string): Set<string> {
	const used = new Set<string>();

	const classNameRegex = /className\s*=\s*["'`]([^"'`]+)["'`]/g;

	for (const match of content.matchAll(classNameRegex)) {
		for (const c of match[1].split(/\s+/)) {
			if (c) used.add(c);
		}
	}

	for (const match of content.matchAll(/styles\.(\w+)/g)) {
		used.add(match[1]);
	}

	for (const match of content.matchAll(/(?:clsx|cn)\(([^)]*)\)/g)) {
		const inner = match[1];
		const strings = inner.match(/["'`]([^"'`]+)["'`]/g);

		if (strings) {
			for (const s of strings) {
				used.add(s.replace(/["'`]/g, ""));
			}
		}
	}

	return used;
}

const usedClasses = extractUsedClasses(allContentText);

// -------------------------
// CSS PARSER
// -------------------------

function extractClassesFromCSS(css: string): string[] {
	const set = new Set<string>();

	const cleaned = css
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/url\([^)]*\)/g, "");

	const regex = /\.([a-zA-Z0-9_-]+)/g;

	let match: RegExpExecArray | null;

	while (true) {
		match = regex.exec(cleaned);
		if (!match) break; // <-- FIX: no assignment in expression warning

		const cls = match[1];

		if (
			cls.length >= 2 &&
			!["svg", "png", "jpg", "jpeg", "woff", "woff2"].includes(cls.toLowerCase())
		) {
			set.add(cls);
		}
	}

	return [...set];
}

// -------------------------
// ANALYSIS
// -------------------------

interface DeadCssItem {
	file: string;
	totalClasses: number;
	deadClasses: number;
	classes: string[];
}

const report: DeadCssItem[] = [];

let totalClasses = 0;
let totalDead = 0;

for (const cssFile of cssFiles) {
	const cssContent = readFileSync(cssFile, "utf-8");
	const classes = extractClassesFromCSS(cssContent);

	totalClasses += classes.length;

	const deadClasses = classes.filter((cls) => {
		const base = cls.includes("__")
			? cls.split("__")[0].split("_").pop() || cls
			: cls;

		return !usedClasses.has(cls) && !usedClasses.has(base);
	});

	totalDead += deadClasses.length;

	if (deadClasses.length > 0) {
		report.push({
			file: cssFile.replace(projectRoot, ""),
			totalClasses: classes.length,
			deadClasses: deadClasses.length,
			classes: deadClasses,
		});
	}
}

// -------------------------
// PURGECSS
// -------------------------

const purge = await new PurgeCSS().purge({
	content: contentFilePaths,
	css: cssFiles,
	safelist: {
		standard: [/^html$/, /^body$/, /^:root$/],
		deep: [/__.+/],
	},
});

let originalSize = 0;
let afterSize = 0;

for (let i = 0; i < cssFiles.length; i++) {
	const original = readFileSync(cssFiles[i], "utf-8");
	const purged = purge[i]?.css ?? "";

	originalSize += original.length;
	afterSize += purged.length;
}

// -------------------------
// OUTPUT
// -------------------------

console.log("\n==============================");
console.log("📊 CSS DEAD CODE ANALYSIS");
console.log("==============================");

console.log(`📁 Files: ${cssFiles.length}`);
console.log(`🎯 Classes: ${totalClasses}`);
console.log(`🗑️ Dead: ${totalDead}`);
console.log(
	`📉 %: ${
		totalClasses ? ((totalDead / totalClasses) * 100).toFixed(2) : 0
	}%\n`,
);

console.log("🔧 PURGECSS");
console.log(`Original: ${(originalSize / 1024).toFixed(2)} KB`);
console.log(`After: ${(afterSize / 1024).toFixed(2)} KB`);
console.log(`Saved: ${((originalSize - afterSize) / 1024).toFixed(2)} KB\n`);

if (report.length) {
	console.log("🗑️ DEAD CLASSES:");

	for (const item of report) {
		console.log(`\n📄 ${item.file}`);
		console.log(`Total: ${item.totalClasses}`);
		console.log(`Dead: ${item.deadClasses}`);

		for (const c of item.classes) {
			console.log(`  - .${c}`);
		}
	}
}

console.log("\n✅ Done \n");
