import { defineEnvVars } from '@sveltejs/kit/env'

/** Optional private variable: missing or empty means "not configured" */
const optional = (input: string | undefined) => input || undefined

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

	// Accounts. All optional: without them, auth is disabled and the app runs signed out only.
	DATABASE_URL: {
		schema: optional,
		description: 'Pooled Neon connection string, used by the app at runtime',
	},
	DATABASE_URL_UNPOOLED: {
		schema: optional,
		description: 'Direct (unpooled) Neon connection string, used by drizzle-kit migrations',
	},
	BETTER_AUTH_SECRET: {
		schema: optional,
		description: 'Secret used to sign session cookies (`openssl rand -base64 32`)',
	},
	BETTER_AUTH_URL: {
		schema: optional,
		description:
			'Public origin of the app, e.g. `http://localhost:5173`. Ignored in production (always `https://mlb.theohtani.com`). Falls back to the Vercel branch URL',
	},
	GOOGLE_CLIENT_ID: { schema: optional },
	GOOGLE_CLIENT_SECRET: { schema: optional },
	OAUTH_PROXY_SECRET: {
		schema: optional,
		description:
			'Shared by production and preview so previews can sign in through the production callback',
	},
	VERCEL_URL: {
		schema: optional,
		description: 'Set by Vercel: the deployment URL (no protocol)',
	},
	VERCEL_BRANCH_URL: {
		schema: optional,
		description: 'Set by Vercel: the stable git branch URL (no protocol)',
	},
})
