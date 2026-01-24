import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			$ui: './src/ui',
			$pkg: './package.json',
		},
		paths: {
			relative: false, // Required for PostHog session replay to work correctly
		},
	},

	compilerOptions: {
		experimental: {
			async: true,
		},
	},
}

export default config
