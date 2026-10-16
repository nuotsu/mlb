import { VERCEL_ENV } from '$app/env/public'

/** PostHog only runs on Vercel production deploys (not previews, branch deploys, or local dev) */
export const analyticsEnabled = VERCEL_ENV === 'production'
