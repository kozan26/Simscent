import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [mdx()],
  site: 'https://blog.simscent.com',
  markdown: {
    shikiConfig: {
      theme: 'github-light'
    }
  }
});
