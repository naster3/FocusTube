import { readFileSync, writeFileSync } from "fs";
import { relative } from "path";
import { collectEncodingTargets } from "./encoding-targets.js";

const root = process.cwd();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

let updatedCount = 0;

function normalizeContent(text) {
  const normalizedNfc = text.normalize("NFC");
  const normalizedEol = normalizedNfc.replace(/\r\n/g, "\n");
  return normalizedEol;
}

function fixFile(filePath) {
  const relPath = relative(root, filePath).replace(/\\/g, "/");
  const buffer = readFileSync(filePath);

  let decoded = "";
  try {
    decoded = utf8Decoder.decode(buffer);
  } catch {
    throw new Error(`${relPath}: invalid UTF-8 byte sequence (cannot auto-fix safely)`);
  }

  const normalized = normalizeContent(decoded);
  const encoded = utf8Encoder.encode(normalized);
  const current = Uint8Array.from(buffer);

  const sameLength = encoded.length === current.length;
  const sameBytes = sameLength && encoded.every((byte, idx) => byte === current[idx]);
  if (sameBytes) {
    return;
  }

  writeFileSync(filePath, encoded);
  updatedCount += 1;
  console.log(`fixed: ${relPath}`);
}

const targets = collectEncodingTargets(root);
for (const filePath of targets) {
  fixFile(filePath);
}

console.log(`Encoding fix completed. Updated ${updatedCount} of ${targets.length} files.`);
