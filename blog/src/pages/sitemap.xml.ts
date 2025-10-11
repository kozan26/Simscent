export const prerender = true;

// Astro v4 + Vite: build-time glob. MD/MDX/HTML sayfaları listeler.
// Gerekirse klasörleri daralt: 'src/pages/blog/**/*.md?(x)'
const pageFiles = import.meta.glob([
  '/src/pages/**/*.md',
  '/src/pages/**/*.mdx',
  '/src/pages/**/*.html',
  '/src/pages/**/*.astro' // yalnızca saf sayfaları; dynamic route'lar çoğunlukla astro içinde.
], { eager: true });

function routeFromFile(filePath: string): string {
  // '/src/pages/...' -> '/...'
  let route = filePath
    .replace(/^\/src\/pages/, '')
    .replace(/\/index\.(mdx?|html|astro)$/, '/')   // /foo/index.* -> /foo/
    .replace(/\.(mdx?|html|astro)$/, '');           // /foo.md -> /foo

  // Astro'da 'index' kökü zaten '/', üstte handle edildi.
  if (route === '') route = '/';
  return route;
}

function isDraft(mod: any): boolean {
  // Frontmatter'ta 'draft: true' varsa hariç tut
  // MDX loader'larda genelde 'frontmatter' alanı bulunur.
  try {
    const fm = (mod as any)?.frontmatter ?? (mod as any)?.default?.frontmatter;
    return !!fm?.draft;
  } catch { return false; }
}

export async function GET() {
  const base = (import.meta as any).env?.SITE || 'https://blog.simscent.com';
  const urls: string[] = [];

  for (const filePath of Object.keys(pageFiles)) {
    const mod = (pageFiles as any)[filePath];
    if (isDraft(mod)) continue;

    const route = routeFromFile(filePath);
    // Statik asset veya özel 404 gibi yolları filtrele (ihtiyaca göre genişlet)
    if (route.startsWith('/_') || route.includes('[[') || route.includes(']')) continue;

    urls.push(new URL(route, base).toString());
  }

  // Tekrarlı URL'leri ayıkla, kök önce gelsin
  const uniq = Array.from(new Set(urls)).sort((a, b) => (a === base ? -1 : a.localeCompare(b)));

  const today = new Date().toISOString().slice(0, 10);
  const xmlItems = uniq.map(loc => {
    let priority = '0.7';
    let changefreq = 'weekly';
    
    if (loc === base) {
      priority = '1.0';
      changefreq = 'daily';
    } else if (loc.includes('/posts/')) {
      priority = '0.8';
      changefreq = 'monthly';
    } else if (loc.includes('?category=') || loc.includes('?tag=')) {
      priority = '0.6';
      changefreq = 'weekly';
    }
    
    return `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  }).join('\n');

  const body =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
