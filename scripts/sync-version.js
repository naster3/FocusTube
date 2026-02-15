import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const root = process.cwd();
const packagePath = resolve(root, "package.json");
const manifestPaths = [resolve(root, "manifest.json"), resolve(root, "src", "manifest", "manifest.base.json")];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isManifestCompatibleVersion(version) {
  return /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version);
}

const pkg = readJson(packagePath);
const version = pkg?.version;

if (typeof version !== "string" || version.trim().length === 0) {
  throw new Error("package.json version is missing or invalid.");
}

if (!isManifestCompatibleVersion(version)) {
  throw new Error(
    `Version "${version}" is not valid for Chrome manifest. Use numeric segments like 3.2.0 or 3.2.0.1.`
  );
}

let updatedCount = 0;

for (const path of manifestPaths) {
  if (!existsSync(path)) {
    continue;
  }
  const manifest = readJson(path);
  if (manifest.version === version) {
    continue;
  }
  manifest.version = version;
  writeJson(path, manifest);
  updatedCount += 1;
  console.log(`Synced version ${version} -> ${path}`);
}

if (updatedCount === 0) {
  console.log(`Version already synced (${version}).`);
}
