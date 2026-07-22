import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const htmlFiles = (await readdir(dist, { recursive: true })).filter((file) =>
  file.endsWith(".html"),
);

const expectedRoutes = [
  "index.html",
  "notes/from-prompts-to-systems/index.html",
  "work/organizational-ai-integration/index.html",
  "work/reliability-as-a-foundation/index.html",
];

const deniedPhrases = [
  "myspark",
  "thought leader",
  "director of ai",
  "partner-participation",
  "platform & gen ai specialist",
  "you are visitor number",
];

const errors: string[] = [];

for (const route of expectedRoutes) {
  if (!htmlFiles.includes(route)) errors.push(`Missing expected route: ${route}`);
}

for (const file of htmlFiles) {
  const absoluteFile = path.join(dist, file);
  const html = await readFile(absoluteFile, "utf8");
  const lower = html.toLowerCase();

  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: missing title`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) {
    errors.push(`${file}: missing meta description`);
  }
  if (!lower.includes("ai integration engineer")) {
    errors.push(`${file}: current role is not present`);
  }

  for (const phrase of deniedPhrases) {
    if (lower.includes(phrase)) errors.push(`${file}: denied phrase found: ${phrase}`);
  }

  const references = html.matchAll(/(?:href|src)="([^"]+)"/g);
  for (const match of references) {
    const reference = match[1];
    if (
      reference.startsWith("http://") ||
      reference.startsWith("https://") ||
      reference.startsWith("mailto:") ||
      reference.startsWith("#") ||
      reference.startsWith("data:")
    ) {
      continue;
    }

    const pathname = reference.split("#")[0].split("?")[0];
    if (!pathname) continue;

    const target = pathname.endsWith("/")
      ? path.join(dist, pathname, "index.html")
      : path.join(dist, pathname);

    try {
      await access(target);
    } catch {
      errors.push(`${file}: broken internal reference: ${reference}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Verified ${htmlFiles.length} HTML pages and their internal references.`);
