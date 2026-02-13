<script lang="ts">
	import { browser } from '$app/environment'
	import { afterNavigate, beforeNavigate } from '$app/navigation'
	import Sidebar from '$ui/sidebar/nav.svelte'
	import posthog from 'posthog-js'
	import './app.css'

	let { children } = $props()

	if (browser) {
		beforeNavigate(() => posthog.capture('$pageleave'))
		afterNavigate(() => posthog.capture('$pageview'))
	}
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="48x48" href="/favicons/favicon-48x48.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png" />

	<link rel="manifest" href="/manifest.json" />

	<link rel="preconnect" href="https://statsapi.mlb.com" />
	<link rel="preconnect" href="https://www.mlbstatic.com" />
	<link rel="preconnect" href="https://midfield.mlbstatic.com" />

	<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
</svelte:head>

<Sidebar />

<main
	class="
		isolate max-h-dvh overflow-x-clip overflow-y-auto bg-background transition-[margin,border-radius,max-height]
		sm:sidebar-open:m-[.5ch] sm:sidebar-open:ml-0 sm:sidebar-open:max-h-[calc(100dvh-1ch)] sm:sidebar-open:rounded-md
	"
>
	{@render children()}
</main>

<style>
	:global(body) {
		display: grid;
		grid-template: 'nav main' / auto 1fr;
		min-height: 100dvh;
	}

	main {
		grid-area: main;
		padding-right: max(1ch, env(safe-area-inset-right));
	}
</style>
