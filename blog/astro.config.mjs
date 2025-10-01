import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://blog.simscent.com',        // zaten tanımlı 👍
  integrations: [
    mdx(),
    sitemap({
      // isteğe bağlı ayarlar:
      // filter: (page) => !page.startsWith('/drafts'),
      // entryLimit: 45000, // çok sayfa olduğunda parçalama eşiği
      // i18n: { defaultLocale: 'tr', locales: { tr: 'tr' } },
    }),
  ],
  markdown: { shikiConfig: { theme: 'github-light' } }
});
