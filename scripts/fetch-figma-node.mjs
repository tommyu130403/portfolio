import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

let token = process.env.FIGMA_ACCESS_TOKEN;
if (!token) {
  const content = readFileSync(envPath, "utf8");
  const match = content.match(/FIGMA_ACCESS_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}
if (!token) {
  console.error("FIGMA_ACCESS_TOKEN not found in .env.local");
  process.exit(1);
}

const fileKey = "KpNwkdFy1usaO1sBR0dycv";
const mode = process.argv[2] || "nodes";
const nodeId = process.argv[3] || "55-291";

const url =
  mode === "file"
    ? `https://api.figma.com/v1/files/${fileKey}`
    : `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;

const res = await fetch(url, { headers: { "X-Figma-Token": token } });
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
