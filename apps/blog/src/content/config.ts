import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.string(),          // ISO date
    heroImage: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
});

export const collections = { blog };
