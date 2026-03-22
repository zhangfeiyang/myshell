import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "buildResources/icon.ico",
  "buildResources/installerSidebar.bmp",
  "buildResources/uninstallerSidebar.bmp",
  "dist/index.html",
  "electron/main.cjs",
  "electron/preload.cjs"
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error("Missing release files:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Release assets look ready.");
