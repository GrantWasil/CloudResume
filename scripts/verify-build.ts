import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../dist/", import.meta.url)));
const files = await readdir(dist, { recursive: true, withFileTypes: true });
const relativeFiles = files.filter(entry => entry.isFile()).map(entry => path.relative(dist, path.join(entry.parentPath, entry.name)));
const pages = ["index.html", "404.html", "notes/from-prompts-to-systems/index.html", "work/organizational-ai-integration/index.html", "work/reliability-as-a-foundation/index.html"];
const publicFiles = new Set([...pages, "favicon.svg", "gwlogo.png", "robots.txt", "sitemap-index.xml", "sitemap-0.xml"]);
const errors: string[] = [];
for (const file of relativeFiles) {
  if (!publicFiles.has(file) && !/^_astro\/[^/]+\.(css|woff2?)$/.test(file)) errors.push(`Unexpected deploy artifact: ${file}`);
}
for (const file of publicFiles) if (!relativeFiles.includes(file)) errors.push(`Missing deploy artifact: ${file}`);

for (const file of pages) {
  if (!relativeFiles.includes(file)) continue;
  const html = await readFile(path.join(dist, file), "utf8");
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${file}: missing title`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) errors.push(`${file}: missing description`);
  for (const phrase of ["Read the terrain", "Cap Query", "GovCloud", "air-gapped", "Caleb", "compensation decrease", "/previews/", "/designs/", "AI Integration Engineer"]) {
    if (html.toLowerCase().includes(phrase.toLowerCase())) errors.push(`${file}: excluded content ${phrase}`);
  }
  if (file === "index.html") {
    if (/noindex/i.test(html)) errors.push("Homepage must be indexable");
    if (!html.includes('rel="canonical" href="https://grantwasil.com/"')) errors.push("Homepage canonical missing");
    for (const required of ["I build software and help people use AI to make their lives better.", "I’m based in Colorado. I like board games, escape rooms, and murder mystery parties.", "AWS rollout automation at Duo Security / Cisco", "https://github.com/GrantWasil/crewview", "https://paintr.dev", "https://apps.apple.com/us/app/paintr-a-little-color/id6808892551", "mailto:dev@grantwasil.com", "https://github.com/GrantWasil", "https://www.linkedin.com/in/grant-wasil/", "https://x.com/GrantWasil"]) {
      if (!html.includes(required)) errors.push(`Homepage missing approved content/link: ${required}`);
    }
    if (/<details\b/.test(html)) errors.push("Project evidence must be visible without disclosure controls");
  } else if (file !== "404.html") {
    if (!html.includes('content="0;url=/#work"')) errors.push(`${file}: missing legacy redirect`);
    if (!html.includes('name="robots" content="noindex,follow"')) errors.push(`${file}: redirect must not be indexed`);
  }
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|data:|\/\/)/.test(ref)) continue;
    const url = new URL(ref, `https://grantwasil.com/${file.replace(/index\.html$/, "")}`);
    const target = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    try {
      const targetPath = path.join(dist, target);
      await access(targetPath);
      if (url.hash && target.endsWith(".html")) {
        const body = await readFile(targetPath, "utf8");
        const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
        if (!ids.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`${file}: missing anchor ${ref}`);
      }
    } catch { errors.push(`${file}: broken local reference ${ref}`); }
  }
}
for (const file of relativeFiles.filter(file => file.endsWith(".css"))) {
  const css = await readFile(path.join(dist, file), "utf8");
  for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
    if (/^(data:|https?:)/.test(match[1])) continue;
    const target = match[1].startsWith("/") ? path.join(dist, match[1]) : path.resolve(dist, path.dirname(file), match[1]);
    try { await access(target); } catch { errors.push(`${file}: missing font/asset ${match[1]}`); }
  }
}
if (relativeFiles.includes("sitemap-0.xml")) {
  const sitemap = await readFile(path.join(dist, "sitemap-0.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (urls.length !== 1 || urls[0] !== "https://grantwasil.com/") errors.push("Sitemap must contain only the approved homepage");
}
if (errors.length) { console.error([...new Set(errors)].join("\n")); process.exit(1); }
console.log(`Verified ${pages.length} HTML pages, approved homepage, legacy redirects, local links/fonts, homepage-only sitemap, and ${relativeFiles.length}-file deployment allowlist.`);
