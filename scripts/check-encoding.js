import { readFileSync } from "fs";
import { relative } from "path";
import { collectEncodingTargets } from "./encoding-targets.js";

const root = process.cwd();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const suspiciousPatterns = [
  { id: "replacement-char", regex: /\uFFFD/g },
  // Typical mojibake when UTF-8 is decoded as Latin-1/Windows-1252.
  { id: "latin1-mojibake", regex: /(?:\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u0080[\u0080-\u00BF])/g },
];

function lineInfo(text, index) {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  const lineText = text.slice(start, end === -1 ? text.length : end).trim();
  const lineNumber = text.slice(0, start).split("\n").length;
  return { lineNumber, lineText };
}

function checkFile(filePath) {
  const relPath = relative(root, filePath).replace(/\\/g, "/");
  const buffer = readFileSync(filePath);
  const issues = [];
  let decoded = "";

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    issues.push(`${relPath}: has UTF-8 BOM (remove BOM)`);
  }

  try {
    decoded = utf8Decoder.decode(buffer);
  } catch {
    issues.push(`${relPath}: invalid UTF-8 byte sequence`);
    return issues;
  }

  if (decoded !== decoded.normalize("NFC")) {
    issues.push(`${relPath}: text is not NFC-normalized`);
  }

  for (const pattern of suspiciousPatterns) {
    const match = pattern.regex.exec(decoded);
    pattern.regex.lastIndex = 0;
    if (!match || typeof match.index !== "number") {
      continue;
    }
    const { lineNumber, lineText } = lineInfo(decoded, match.index);
    issues.push(`${relPath}:${lineNumber}: ${pattern.id}: ${lineText}`);
  }
  return issues;
}

const targets = collectEncodingTargets(root);
const allIssues = targets.flatMap(checkFile);

if (allIssues.length > 0) {
  console.error("Encoding check failed:");
  allIssues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Encoding check passed (${targets.length} files). UTF-8 + no BOM + NFC.`);
