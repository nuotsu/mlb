import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$env/static/public'
import posthog, { PostHog } from 'posthog-node'

let _client: PostHog | null = null

export function getPostHogClient() {
	if (!_client) {
		_client = new posthog.PostHog(PUBLIC_POSTHOG_KEY, {
			host: PUBLIC_POSTHOG_HOST,
		})
	}
	return _client
}
