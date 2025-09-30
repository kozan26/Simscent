import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.simscent.com', // set your blog subdomain
  scopedStyleStrategy: 'where'       // safer CSS scoping
});
