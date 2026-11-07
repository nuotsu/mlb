<script lang="ts">
	import { analyticsEnabled } from '#lib/analytics.js'
	import { appIconScript } from '#lib/app-icon.js'
	import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '#lib/seo.js'
	import { hideDelayedGamesScript } from '#lib/time-travel.js'
	import { accountStore, initAccount } from '#ui/account/store.svelte.js'
	import { setAnalyticsContext } from '#ui/analytics.js'
	import Offline from '#ui/offline.svelte'
	import Sidebar from '#ui/sidebar/nav.svelte'
	import { colorSchemeStore } from '#ui/store.svelte.js'
	import { browser } from '$app/env'
	import { afterNavigate, beforeNavigate } from '$app/navigation'
	import { page } from '$app/state'
	import posthog from 'posthog-js'
	import './app.css'

	let { children } = $props()

	if (browser) {
		initAccount(page.data)

		// Before the first `$pageview` (afterNavigate runs on mount), and again on any change
		$effect.pre(() => {
			setAnalyticsContext({
				signed_in: !!accountStore.user,
				color_scheme: colorSchemeStore.mode === 'dark' ? 'dark' : 'light',
				system_color_scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
			})
		})

		beforeNavigate(({ shallow }) => {
			if (shallow || !analyticsEnabled) return

			return posthog.capture('$pageleave')
		})

		afterNavigate(({ shallow }) => {
			if (shallow || !analyticsEnabled) return

			return posthog.capture('$pageview')
		})

		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

		document.cookie = `tz=${tz};path=/;max-age=31536000;SameSite=Lax`
	}
</script>

<svelte:head>
	<!-- Game cards running behind live stay hidden until the browser shows the delayed moment -->
	{@html `<script>${hideDelayedGamesScript()}<\/script>`}
	<!-- The chosen app icon replaces the favicon before first paint -->
	{@html `<script>${appIconScript()}<\/script>`}

	<link rel="sitemap" type="application/xml" href="/sitemap.xml" />

	<link rel="preconnect" href="https://statsapi.mlb.com" />
	<link rel="preconnect" href="https://www.mlbstatic.com" />
	<link rel="preconnect" href="https://midfield.mlbstatic.com" />
	<link rel="preconnect" href="https://img.mlbstatic.com" />
	<!-- Font files from fonts.css; fonts are fetched in CORS mode, so this needs crossorigin -->
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />

	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{
				// Gives Google the site name shown above search results
				'@type': 'WebSite',
				'@id': `${SITE_URL}/#website`,
				name: SITE_NAME,
				alternateName: ["Mitchell's Live scoreBug", 'TheOhtani MLB'],
				url: `${SITE_URL}/`,
				inLanguage: 'en',
			},
			{
				'@type': 'WebApplication',
				name: SITE_NAME,
				url: `${SITE_URL}/`,
				description: SITE_DESCRIPTION,
				applicationCategory: 'SportsApplication',
				operatingSystem: 'Web',
				inLanguage: 'en',
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
				author: { '@type': 'Person', name: 'nuotsu', url: 'https://github.com/nuotsu' },
			},
		],
	})}<\/script>`}
</svelte:head>

<Sidebar />

<main
	class="
		relative isolate no-scrollbar max-h-dvh overflow-x-clip overflow-y-auto bg-background transition-[margin,border-radius,max-height]
		sm:sidebar-open:m-[.5ch] sm:sidebar-open:ml-0 sm:sidebar-open:max-h-[calc(100dvh-1ch)] sm:sidebar-open:rounded-md
	"
>
	<Offline />{@render children()}
</main>

<style>
	:global(body) {
		display: grid;
		grid-template: 'nav main' / auto minmax(0, 1fr);
		min-height: 100dvh;
	}

	/*
		`main` is `relative` so absolutely positioned content (e.g. `sr-only` inputs) stays inside its
		scroller; resolved against the page instead, it stretches the document past the viewport,
		which iOS then scrolls on rotation, shifting the whole app up for good
	*/
	main {
		grid-area: main;
	}
</style>
