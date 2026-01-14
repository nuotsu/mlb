import { browser } from '$app/environment'
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$env/static/public'
import posthog from 'posthog-js'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async () => {
	if (browser) {
		posthog.init(PUBLIC_POSTHOG_KEY, {
			api_host: PUBLIC_POSTHOG_HOST,
			capture_pageview: false,
			capture_pageleave: false,
			capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
		})
	}

	return
}
