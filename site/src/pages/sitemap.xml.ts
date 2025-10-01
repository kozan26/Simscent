export const prerender = true;

export async function GET() {
  // İstersen sadece index’e yönlendir:
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.simscent.com/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://blog.simscent.com/sitemap-index.xml</loc></sitemap>
</sitemapindex>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
