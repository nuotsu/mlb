import adapter from '@sveltejs/adapter-vercel'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { mdsvex } from 'mdsvex'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSlug from 'rehype-slug'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			extensions: ['.svelte', '.md'],
			preprocess: [
				vitePreprocess(),
				mdsvex({
					extensions: ['.md'],
					rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'prepend' }]],
				}),
			],
			compilerOptions: { experimental: { async: true } },
			adapter: adapter(),
			paths: {
				relative: false /* Required for PostHog session replay to work correctly */,
			},
		}),
	],
	server: { fs: { allow: ['package.json'] } },
})
