/**
 * Scans i18n.ts for mojibake artifacts caused by bad encoding (Latin-1 read as UTF-8).
 * Run: node scripts/check-i18n.mjs
 * Exits with code 1 and prints offending lines when artifacts are found.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, "../src/lib/i18n.ts");
const source = readFileSync(filePath, "utf8");

// Patterns that indicate UTF-8 bytes were mis-decoded as Latin-1 (mojibake).
// Cyrillic in UTF-8 encodes to 0xD0/0xD1 sequences; when those bytes are
// read as Latin-1 they appear as Ð, Ñ, etc.
const MOJIBAKE_PATTERNS = [
  /Ð[А-ЯЁа-яёÐÑ\x80-\xBF]/u, // Cyrillic two-byte lead decoded as Latin-1
  /Ñ[\x80-\x9F]/u,             // 0xD1 + continuation byte as Latin-1
  /\xC2[\x80-\xBF]/u,          // 0xC2 + continuation
  /\xC3[\x80-\xBF]/u,          // 0xC3 + continuation
  /â€/u,                        // curly quote artifact
  /Â·/u,                        // middle-dot artifact
];

const lines = source.split("\n");
const violations = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (pattern.test(line)) {
      violations.push(`  Line ${i + 1}: ${line.trim()}`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("❌  Mojibake detected in src/lib/i18n.ts:");
  for (const v of violations) {
    console.error(v);
  }
  process.exit(1);
} else {
  console.log("✓  src/lib/i18n.ts looks clean — no mojibake detected.");
}
