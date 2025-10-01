export const prerender = true;

// /src/pages/posts/* içindeki .md dosyalarını al
const postFiles = import.meta.glob('/src/pages/posts/*.md', { eager: true }) as Record<string, any>;

// Küçük yardımcı: rota ve URL hesapla
function routeFromFile(p: string) {
  // /src/pages/posts/foo.md  -> /posts/foo/
  return p
    .replace(/^\/src\/pages/, '')
    .replace(/\.md$/, '')
    .replace(/\/index$/, '/')
    + '/';
}

export async function GET() {
  const BASE = (import.meta as any).env?.SITE || 'https://blog.simscent.com';

  const items = Object.entries(postFiles).map(([path, mod]) => {
    const fm = mod?.frontmatter ?? {};
    const route = routeFromFile(path);
    return {
      title: fm.title ?? '',
      description: fm.description ?? '',
      date: fm.date ?? null,
      slug: route.split('/').filter(Boolean).pop() ?? '',
      url: new URL(route, BASE).toString(),
      // isterseniz tag’ler vb. alanları da ekleyebilirsiniz: fm.tags ?? []
    };
  })
  // tarih varsa en yeni üste
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return new Response(JSON.stringify({ items }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
