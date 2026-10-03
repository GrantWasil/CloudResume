import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../dist/", import.meta.url)));
const files = await readdir(dist, { recursive: true, withFileTypes: true });
const relativeFiles = files.filter(entry => entry.isFile()).map(entry => path.relative(dist, path.join(entry.parentPath, entry.name)));
const pages = ["index.html", "404.html", "notes/from-prompts-to-systems/index.html", "work/organizational-ai-integration/index.html", "work/reliability-as-a-foundation/index.html"];
const publicFiles = new Set([...pages, "favicon.svg", "gwlogo.png", "assets/paintr-iphone-painting.webp", "robots.txt", "sitemap-index.xml", "sitemap-0.xml"]);
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
    for (const required of ["I build software and help people use AI to make their lives better.", "At Gary Community Ventures, I work with people to figure out where AI can genuinely help.", "I do the engineering and the coaching, and I run demos and office hours where people can bring their own questions.", "Before Gary, I was a site reliability engineer at Duo Security / Cisco.", "An iPhone and iPad app that turns your own photos into paint-by-number puzzles.", "I built paintr for my wife, who loves settling into long, detailed painting sessions.", "Photos are converted on your device.", "with the option to keep the finished picture a surprise.", "I’m based in Colorado. Outside of work, I’m usually bringing people together around a game, an escape room, or a murder mystery party.", "whether that’s an app, a workshop, or a slightly overambitious game night.", "AWS rollout automation at Duo Security / Cisco", "https://github.com/GrantWasil/VideoPaste", "https://github.com/GrantWasil/crewview", "https://paintr.dev", "https://apps.apple.com/us/app/paintr-a-little-color/id6808892551", "mailto:dev@grantwasil.com", "https://github.com/GrantWasil", "https://www.linkedin.com/in/grant-wasil/", "https://x.com/GrantWasil"]) {
      if (!html.includes(required)) errors.push(`Homepage missing approved content/link: ${required}`);
    }
    const disclosures = [...html.matchAll(/<details\b[^>]*>/g)].map(match => match[0]);
    if (disclosures.length !== 1 || !disclosures[0].includes('id="paintr-screenshot"') || !/\bopen(?:\s|>)/.test(disclosures[0])) errors.push("Only the approved, initially open paintr image disclosure is permitted");
    if (!html.includes("View screenshot") || !html.includes("Hide screenshot")) errors.push("Paintr image disclosure labels missing");
    if (!/<img\b[^>]*src="\/assets\/paintr-iphone-painting\.webp"[^>]*width="1206"[^>]*height="2622"[^>]*alt="[^"]+"/.test(html)) errors.push("Homepage missing dimensioned, accessible paintr screenshot");
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
