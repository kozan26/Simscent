export const prerender = true;

export async function GET() {
  // İstersen ana sitenin sayfalarını burada dinamik toplayabilirsin.
  // Basit bir index’ten link vermek istiyorsan redirect de yapabiliriz (Seçenek B).
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.simscent.com/</loc></url>
  <url><loc>https://www.simscent.com/blog</loc></url>
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' }});
}
