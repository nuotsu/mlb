import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
	PUBLIC_POSTHOG_KEY: { public: true, static: true },
	MCP_SECRET: { schema: (input) => input ?? '' },
	PUBLIC_POSTHOG_HOST: { public: true, static: true },
	VERCEL_ENV: {
		public: true,
		static: true,
		schema: (input) => input ?? 'development',
		description: 'Set by Vercel: `production`, `preview`, or `development`',
	},
})
