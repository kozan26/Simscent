export const prerender = true;

export async function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: https://blog.simscent.com/sitemap.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
