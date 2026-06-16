#!/usr/bin/env ts-node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface ICodecheckConfig {
  commentsLint: {
    excludeFiles: string[];
  };
  deadCode: {
    ignorePatterns?: {
      src: string[];
      tests: string[];
      common: string[];
    };
  };
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

function dumpFile(file: string) {
  fs.appendFileSync(OUT, `===== ${file} =====\n`);
  try {
    const content = fs.readFileSync(file, "utf-8");
    fs.appendFileSync(OUT, `${content}\n\n`);
  } catch {
    fs.appendFileSync(OUT, `⚠️ Не удалось прочитать файл: ${file}\n\n`);
  }
}

function dumpDir(dir: string, excludeFolders: string[] = []) {
  const excludeArgs = excludeFolders
    .map((f) => `-path "*/${f}" -prune -o`)
    .join(" ");
  const cmd = `find "${dir}" ${excludeArgs} -type f -print | sort`;

  const files = execSync(cmd, { encoding: "utf-8" })
    .split("\n")
    .filter(Boolean);

  files.forEach(dumpFile);
}

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`❌ Конфиг не найден: ${CONFIG_FILE}`);
  process.exit(1);
}

const configContent = fs.readFileSync(CONFIG_FILE, "utf-8");
let configJson: ICodecheckConfig | null = null;
try {
  configJson = JSON.parse(configContent);
} catch (e) {
  console.error("❌ Ошибка парсинга JSON", e);
  process.exit(1);
}

const files: string[] = configJson?.dumpFiles.files ?? [];
const folders: string[] = configJson?.dumpFiles.folders ?? [];
const excludeFolders: string[] = configJson?.dumpFiles.excludeFolders ?? [
  "node_modules",
  ".git",
];

console.log(`Files to dump: ${files.join(", ")}`);
console.log(`Folders to dump: ${folders.join(", ")}`);
console.log(`Excluded folders: ${excludeFolders.join(", ")}`);

files.forEach((f) => {
  if (fs.existsSync(f) && fs.statSync(f).isFile()) {
    dumpFile(f);
  } else {
    console.warn(`⚠️ File not found: ${f}`);
  }
});

folders.forEach((d) => {
  if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
    dumpDir(d, excludeFolders);
  } else {
    console.warn(`⚠️ Folder not found: ${d}`);
  }
});

console.log(`✔ dumped: files & folders → ${OUT}`);
