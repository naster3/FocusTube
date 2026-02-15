import { readdirSync, statSync } from "fs";
import { extname, resolve } from "path";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "playwright-report",
  "test-results",
  ".vscode"
]);

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".css",
  ".html",
  ".md",
  ".txt",
  ".yml",
  ".yaml"
]);

const TEXT_BASENAMES = new Set([".editorconfig", ".gitignore", ".prettierrc", ".prettierignore", "LICENSE"]);

function isTextFile(filePath) {
  const normalized = filePath.toLowerCase();
  for (const ignored of [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".zip", ".db", ".sqlite"]) {
    if (normalized.endsWith(ignored)) {
      return false;
    }
  }
  const ext = extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  const base = filePath.split(/[/\\]/).pop() || "";
  return TEXT_BASENAMES.has(base);
}

function walk(dirPath, acc) {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) {
      continue;
    }
    const fullPath = resolve(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    if (isTextFile(fullPath)) {
      acc.push(fullPath);
    }
  }
}

export function collectEncodingTargets(rootDir = process.cwd()) {
  const files = [];
  walk(rootDir, files);
  return files;
}
