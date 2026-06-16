import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "yaml";

const env = process.env.env || "dev"; // по умолчанию dev

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, `../helm-values/${env}-values.yml`);
const outPath = path.join(__dirname, "../.env.production");

if (!fs.existsSync(filePath)) {
  console.error(`❌ Файл ${filePath} не найден`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, "utf8");
const data = yaml.parse(content);

// плоская запись ключ=значение
const lines = [];
for (const [key, value] of Object.entries(data.env || {})) {
  if (Array.isArray(value) || typeof value === "object" || value !== null) {
    // массивы и объекты сериализуем в JSON
    lines.push(`${key}=${JSON.stringify(value)}`);
  } else {
    // обычные строки/числа пишем напрямую
    lines.push(`${key}=${String(value)}`);
  }
}

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`✅ Сгенерирован ${outPath} из ${filePath}`);
