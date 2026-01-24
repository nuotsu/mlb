import { browser, dev } from '$app/environment'
import { PUBLIC_POSTHOG_KEY } from '$env/static/public'
import posthog from 'posthog-js'
import type { LayoutLoad } from './$types'
import '$lib/console'

export const load: LayoutLoad = async () => {
	if (browser && !dev) {
		posthog.init(PUBLIC_POSTHOG_KEY, {
			api_host: '/ph',
			ui_host: 'https://us.posthog.com',
			capture_pageview: false,
			capture_pageleave: false,
			capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
		})
	}

	return
}
