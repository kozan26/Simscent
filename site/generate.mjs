// site/generate.mjs
// Build the static site into ./dist and create a single sitemap.xml
// that includes BOTH www and blog URLs.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -------------------------
// Basic FS helpers
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;               // site/
const OUT_DIR = path.join(ROOT, "dist");
const DOMAIN = process.env.DOMAIN || "https://www.simscent.com";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function write(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}
function exists(p) {
  return fs.existsSync(p);
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function copyIfExists(src, dst) {
  if (!exists(src)) return false;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dst);
    for (const name of fs.readdirSync(src)) {
      copyIfExists(path.join(src, name), path.join(dst, name));
    }
  } else {
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }
  return true;
}

// -------------------------
// Domain-specific helpers
// -------------------------
function slugify(t) {
  return String(t || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/&/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
function addFullName(arr) {
  for (const p of arr) {
    const name = p["Fragrance Name"] ?? p.name ?? "";
    const conc = p.Concentration ?? p.concentration ?? "";
    p.fullName = (conc ? `${name} ${conc}` : name).trim();
  }
  return arr;
}
function pageURL(p) {
  const brand = slugify(p.Brand || p.brand || "unknown");
  const full = slugify(p.fullName || p.name || "unknown");
  return `/p/${brand}/${full}/`;
}

// -------------------------
// Blog sitemap merge helpers
// -------------------------
async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/xml,text/xml,*/*" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}
function extractLocsFromUrlset(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s][^<]*)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}
function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}
function extractSitemapsFromIndex(xml) {
  // sitemapindex also uses <loc> for child sitemaps
  return extractLocsFromUrlset(xml);
}
async function fetchAllBlogUrls(entryUrl = "https://blog.simscent.com/sitemap-index.xml") {
  try {
    const rootXml = await fetchText(entryUrl);
    if (isSitemapIndex(rootXml)) {
      const parts = extractSitemapsFromIndex(rootXml);
      const batches = await Promise.allSettled(parts.map((u) => fetchText(u)));
      const urls = [];
      for (const b of batches) {
        if (b.status === "fulfilled") urls.push(...extractLocsFromUrlset(b.value));
      }
      return Array.from(new Set(urls));
    } else {
      // directly a urlset
      return Array.from(new Set(extractLocsFromUrlset(rootXml)));
    }
  } catch (e) {
    // fallback: try /sitemap.xml
    try {
      const xml = await fetchText("https://blog.simscent.com/sitemap.xml");
      return Array.from(new Set(extractLocsFromUrlset(xml)));
    } catch {
      console.warn("Blog sitemap fetch failed:", e?.message || e);
      return [];
    }
  }
}

// -------------------------
// Minimal product page template
// (keeps things simple; you can replace with your real template)
// -------------------------
function renderProductHTML(p) {
  const title = `${p.Brand || ""} ${p.fullName || ""}`.trim() || "Perfume";
  const safeDesc =
    (p.Description || p.description || "Fragrance details and notes.") + "";
  const canonical = new URL(pageURL(p), DOMAIN).toString();
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} | simscent</title>
  <link rel="canonical" href="${canonical}" />
  <meta name="description" content="${escapeHtml(safeDesc).slice(0, 160)}" />
  <link rel="stylesheet" href="/assets/styles.css" onerror="this.remove()">
</head>
<body>
  <header style="padding:16px;max-width:960px;margin:0 auto;">
    <a href="/" style="text-decoration:none;color:inherit"><strong>simscent</strong></a>
  </header>
  <main style="max-width:960px;margin:0 auto;padding:16px;">
    <h1 style="margin:0 0 12px 0">${escapeHtml(title)}</h1>
    <p style="color:#555">${escapeHtml(safeDesc)}</p>

    <section style="margin-top:16px">
      <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 16px">
        <dt style="color:#666">Brand</dt><dd>${escapeHtml(p.Brand || "")}</dd>
        <dt style="color:#666">Name</dt><dd>${escapeHtml(p["Fragrance Name"] || p.name || "")}</dd>
        <dt style="color:#666">Concentration</dt><dd>${escapeHtml(p.Concentration || p.concentration || "")}</dd>
      </dl>
    </section>

    <nav style="margin-top:24px">
      <a href="/" style="color:#1155cc">← Ana sayfa</a>
    </nav>
  </main>
</body>
</html>`;
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// -------------------------
// Build steps
// -------------------------
async function build() {
  // 0) Clean dist
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  ensureDir(OUT_DIR);

  // 1) Copy basics from site/
  copyIfExists(path.join(ROOT, "index.html"), path.join(OUT_DIR, "index.html"));
  copyIfExists(path.join(ROOT, "assets"), path.join(OUT_DIR, "assets"));
  copyIfExists(path.join(ROOT, "data"), path.join(OUT_DIR, "data"));
  copyIfExists(path.join(ROOT, "_headers"), path.join(OUT_DIR, "_headers"));

  // perfumes_data.json (try a few common locations under site/)
  const jsonCandidates = [
    path.join(ROOT, "perfumes_data.json"),
    path.join(ROOT, "data", "perfumes_data.json"),
    path.join(ROOT, "assets", "perfumes_data.json"),
  ];
  let jsonSrc = jsonCandidates.find((p) => exists(p));
  if (!jsonSrc) {
    throw new Error(
      `perfumes_data.json not found. Checked: ${jsonCandidates
        .map((p) => path.relative(ROOT, p))
        .join(", ")}`
    );
  }
  const jsonDist = path.join(OUT_DIR, "perfumes_data.json");
  copyIfExists(jsonSrc, jsonDist);

  // 2) Read data (tolerant JSON)
  let raw = readText(jsonSrc);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // NDJSON fallback
    data = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((j) => JSON.parse(j));
  }
  if (!Array.isArray(data)) {
    throw new Error("perfumes_data.json is not an array.");
  }
  addFullName(data);

  // 3) Generate product pages
  let count = 0;
  for (const p of data) {
    const urlPath = pageURL(p); // /p/brand/name/
    const out = path.join(OUT_DIR, urlPath, "index.html");
    write(out, renderProductHTML(p));
    count++;
  }
  console.log(`✓ Generated ${count} product pages`);

  // 4) Redirects (force sitemap/robots 200, SPA fallback at end)
  const redirects = `
/sitemap.xml  /sitemap.xml  200
/robots.txt   /robots.txt   200
/*            /index.html   200
`.trim() + "\n";
  write(path.join(OUT_DIR, "_redirects"), redirects);

  // 5) robots.txt
  const robots = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`;
  write(path.join(OUT_DIR, "robots.txt"), robots);

  // 6) SITEMAP (merge WWW + BLOG into ONE file)
  const today = new Date().toISOString().slice(0, 10);
  const wwwUrls = data.map((p) => `${DOMAIN}${pageURL(p)}`);
  const home = `${DOMAIN}/`;

  const blogUrls = await fetchAllBlogUrls("https://blog.simscent.com/sitemap-index.xml");

  // Merge + uniq + keep home first
  const all = Array.from(new Set([home, ...wwwUrls, ...blogUrls]));
  all.sort((a, b) => (a === home ? -1 : a.localeCompare(b)));

  const xmlItems = all
    .map((u) => {
      const pr = u.startsWith("https://www.simscent.com/") ? "0.9" : "0.7";
      return `<url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${pr}</priority></url>`;
    })
    .join("\n  ");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${xmlItems}
</urlset>
`;
  write(path.join(OUT_DIR, "sitemap.xml"), sitemap);
  console.log(`✓ sitemap.xml (merged) — ${all.length} URLs`);

  console.log("✔ Build complete");
}

// -------------------------
(async function main() {
  try {
    await build();
  } catch (e) {
    console.error("Build failed:", e?.stack || e?.message || e);
    process.exit(1);
  }
})();
