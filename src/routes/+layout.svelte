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
</svelte:head>

<Sidebar />

<main class="isolate">
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
	}
</style>
