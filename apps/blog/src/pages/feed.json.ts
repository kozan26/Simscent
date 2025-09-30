import { getCollection } from 'astro:content';

export async function GET() {
  const posts = (await getCollection('blog'))
    .sort((a,b)=>+new Date(b.data.date)-+new Date(a.data.date))
    .slice(0,5)
    .map(p=>({
      title: p.data.title,
      url: `/posts/${p.slug}/`,
      date: p.data.date,
      excerpt: p.data.description ?? '',
      heroImage: p.data.heroImage ?? ''
    }));
  return new Response(JSON.stringify({ posts }), {
    headers: { 'Content-Type':'application/json; charset=utf-8' }
  });
}
