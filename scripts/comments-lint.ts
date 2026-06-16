#!/usr/bin/env ts-node

import { execSync } from "node:child_process";
import fs from "node:fs";

const CONFIG_FILE = "scripts/.codecheck.config.json";

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
  console.error("❌ Ошибка при получении staged файлов", e);
  process.exit(1);
}

if (!files.length) process.exit(0);

const forbiddenComments: string[] = [];
files.forEach((file) => {
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, "utf-8").split("\n");
  content.forEach((line, idx) => {
    const match = new RegExp(/^\s*(\/\/|\/\*)/).exec(line);
    if (match && !/TODO|FIXME|NOTE|HACK|XXX/i.test(line)) {
      forbiddenComments.push(`${file}:${idx + 1}: ${line}`);
    }
  });
});

if (forbiddenComments.length) {
  console.error("❌ Обнаружены запрещенные комментарии.");
  console.error(
    "Разрешены только комментарии с маркерами: TODO, FIXME, NOTE, HACK, XXX\n",
  );
  console.error(forbiddenComments.join("\n"));
  process.exit(1);
}

process.exit(0);
