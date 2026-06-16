// scripts/dead-code.ts
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(__dirname, ".codecheck.config.json");

  try {
    const commonScriptsConfig = fs.readFileSync(configPath, "utf-8");
    const commonScriptsConfigParsed = JSON.parse(commonScriptsConfig);
    return commonScriptsConfigParsed.deadCode;
  } catch {
    return {};
  }
}

function getDefaultIgnorePatterns(): IgnorePatterns {
  return { src: [], tests: [], common: [] };
}

function run(type: "src" | "tests"): DeadCodeResult {
  const config = readConfig();
  const ignorePatterns = config.ignorePatterns || getDefaultIgnorePatterns();

  const patterns: string[] = [...ignorePatterns.common];

  if (type === "src") {
    patterns.push(...ignorePatterns.src);
  }

  if (type === "tests") {
    patterns.push(...ignorePatterns.tests);
  }

  let output = "";

  try {
    output = execSync("ts-prune -p tsconfig.dead-code.json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch (error: unknown) {
    if (isExecError(error)) {
      output = error.stdout?.toString() ?? "";
    } else {
      throw error;
    }
  }

  const lines = output
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      const normalizedLine = line.replaceAll("\\", "/");

      return !patterns.some((pattern) => {
        try {
          return new RegExp(pattern).test(normalizedLine);
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
  const { defaultLines, otherLines } = result;

  if (defaultLines.length > 0) {
    console.log("Default exports:");
    console.log(defaultLines.join("\n"));
  }

  if (otherLines.length > 0) {
    console.log(otherLines.join("\n"));
  }
}

function main(): void {
  const type = process.argv[2] || "all";

  if (type !== "src" && type !== "tests" && type !== "all") {
    console.error("Используйте: yarn dead-code [src|tests|all]");
    process.exit(1);
  }

  const results: DeadCodeResult[] = [];

  if (type === "all") {
    results.push(run("src"), run("tests"));
  } else {
    results.push(run(type));
  }

  results.forEach(printResult);

  const totalOther = results.reduce((sum, r) => sum + r.otherLines.length, 0);

  if (totalOther > 0) {
    console.error(`\nНайдено ${totalOther} неиспользуемых экспортов`);
    process.exit(1);
  }
}

main();
