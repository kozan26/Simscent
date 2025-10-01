import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://blog.simscent.com',
  integrations: [
    mdx(),
    sitemap({
      // İstersen hariç bırakma vb. kurallar burada:
      // filter: (page) => !page.startsWith('/drafts'),
    })
  ],
  // (Varsa) diğer ayarların burada kalabilir
})
