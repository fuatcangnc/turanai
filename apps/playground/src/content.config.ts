import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    image: z.string().default('/images/project-guidance.webp'),
    relatedService: z.string().optional(),
  }),
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().optional(),
    description: z.string(),
  }),
})

export const collections = { posts, pages }
