<script lang="ts">
	import { browser } from '$app/environment'
	import { afterNavigate, beforeNavigate } from '$app/navigation'
	import favicon from '$lib/assets/favicon.svg'
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
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://statsapi.mlb.com" />
	<link rel="preconnect" href="https://www.mlbstatic.com" />
	<link rel="preconnect" href="https://midfield.mlbstatic.com" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
</svelte:head>

<Sidebar />

<main class="isolate max-h-dvh overflow-y-auto">
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
		padding-right: env(safe-area-inset-right);
	}
</style>
