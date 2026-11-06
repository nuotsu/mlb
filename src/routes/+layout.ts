import { analyticsEnabled } from '#lib/analytics.js'
import { browser } from '$app/env'
import { PUBLIC_POSTHOG_KEY } from '$app/env/public'
import posthog from 'posthog-js'
import type { LayoutLoad } from './$types'
import '#lib/console.js'

export const load: LayoutLoad = async ({ data }) => {
	if (browser && analyticsEnabled) {
		posthog.init(PUBLIC_POSTHOG_KEY, {
			api_host: '/ph',
			ui_host: 'https://us.posthog.com',
			// Sent by hand on client-side navigations (see +layout.svelte)
			capture_pageview: false,
			capture_pageleave: false,
			// Every click (and rage click) was an `$autocapture` event. The interactions that matter
			// are captured explicitly (#ui/analytics.ts); heatmaps are separate and unaffected.
			autocapture: false,
			// Anonymous visitors don't get person profiles (cheaper events); signed-in users do
			person_profiles: 'identified_only',
			capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
		})
	}

	return data
}
