<script lang="ts">
	import { browser } from '$app/environment'
	import { afterNavigate } from '$app/navigation'

	let open = $derived(browser ? localStorage.getItem('sidebar-open') === 'true' : false)
	let isMobile = $state(false)

	$effect(() => {
		if (browser) {
			localStorage.setItem('sidebar-open', open.toString())
			isMobile && (open = false)
		}
	})

	afterNavigate(() => {
		isMobile && (open = false)
	})
</script>

<svelte:window
	onkeydown={({ key }) => {
		if (key === '\\' && document.activeElement === document.body) {
			open = !open
		}
	}}
	onresize={() => {
		isMobile = window.matchMedia('(width < 40rem)').matches
	}}
/>

<label
	class="absolute top-ch right-0 z-1 grid h-lh place-content-center px-ch transition-transform max-sm:sidebar-not-open:translate-x-full"
	aria-label="Toggle sidebar"
	title="Toggle sidebar (\)"
>
	<input id="sidebar-open" class="sr-only" type="checkbox" bind:checked={open} />

	<!-- prettier-ignore -->
	<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16.5 4C17.3284 4 18 4.67157 18 5.5V14.5C18 15.3284 17.3284 16 16.5 16H3.5C2.67157 16 2 15.3284 2 14.5V5.5C2 4.67157 2.67157 4 3.5 4H16.5ZM7 15H16.5C16.7761 15 17 14.7761 17 14.5V5.5C17 5.22386 16.7761 5 16.5 5H7V15ZM3.5 5C3.22386 5 3 5.22386 3 5.5V14.5C3 14.7761 3.22386 15 3.5 15H6V5H3.5Z"></path></svg>
</label>

<style>
	svg {
		width: 1em;
		height: 1em;
	}
</style>
