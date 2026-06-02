#!/usr/bin/env ts-node
// src/commands/dump-files.ts
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface ICodecheckConfig {
  dumpFiles: {
    files: string[];
    folders: string[];
    excludeFolders: string[];
  };
}

const DUMPS_DIR = "dump";
if (!fs.existsSync(DUMPS_DIR)) fs.mkdirSync(DUMPS_DIR);

const DATE = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
const OUT = path.join(DUMPS_DIR, `${DATE}-dump-files.txt`);

fs.writeFileSync(OUT, "");

const CONFIG_FILE = "scripts/.codecheck.config.json";

// ------------------------
// FILE WRITER
// ------------------------

function dumpFile(file: string) {
  fs.appendFileSync(OUT, `===== ${file} =====\n`);

  try {
    const content = fs.readFileSync(file, "utf-8");
    fs.appendFileSync(OUT, `${content}\n\n`);
  } catch {
    fs.appendFileSync(OUT, `⚠️ Не удалось прочитать файл: ${file}\n\n`);
  }
}

// ------------------------
// DIR WALK (FIXED)
// ------------------------

function dumpDir(dir: string, excludeFolders: string[]) {
  const excludeArgs = excludeFolders
    .map((f) => `-name "${f}" -prune -o`)
    .join(" ");

  const cmd = `find "${dir}" ${excludeArgs} -type f -print`;

  const files = execSync(cmd, { encoding: "utf-8" })
    .split("\n")
    .filter(Boolean);

  for (const file of files) {
    dumpFile(file);
  }
}

// ------------------------
// CONFIG
// ------------------------

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`❌ Config not found: ${CONFIG_FILE}`);
  process.exit(1);
}

let configJson: ICodecheckConfig;

try {
  configJson = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
} catch (e) {
  console.error("❌ Invalid JSON config", e);
  process.exit(1);
}

const files = configJson.dumpFiles?.files ?? [];
const folders = configJson.dumpFiles?.folders ?? [];
const excludeFolders = configJson.dumpFiles?.excludeFolders ?? [
  "node_modules",
  ".git",
];

// ------------------------
// LOG CONFIG
// ------------------------

console.log(`Files: ${files.join(", ") || "none"}`);
console.log(`Folders: ${folders.join(", ") || "none"}`);
console.log(`Excluded: ${excludeFolders.join(", ")}`);

// ------------------------
// FILES
// ------------------------

for (const f of files) {
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    dumpFile(f);
  } else {
    console.warn(`⚠️ File not found: ${f}`);
  }
}

// ------------------------
// FOLDERS
// ------------------------

for (const d of folders) {
  if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
    dumpDir(d, excludeFolders);
  } else {
    console.warn(`⚠️ Folder not found: ${d}`);
  }
}

console.log(`✔ dumped → ${OUT}`);
