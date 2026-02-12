<script lang="ts">
	import { browser } from '$app/environment'
	import { afterNavigate } from '$app/navigation'
	import { SidebarIcon } from '$ui/icons'

	let checked = $derived(browser ? localStorage.getItem('sidebar-open') === 'true' : false)
	let isMobile = $state(false)

	function handleIconClick(e: MouseEvent) {
		e.preventDefault()
		checked = true
		const details = (e.target as HTMLElement).closest('details')
		if (details) details.open = true
	}

	$effect(() => {
		if (browser) {
			localStorage.setItem('sidebar-open', checked.toString())

			const drawerDetails = document.querySelectorAll<HTMLDetailsElement>('#drawer details')

			drawerDetails?.forEach((details) => {
				const summary = details.querySelector<HTMLElement>('summary')

				if (!checked) {
					details.open = false
					summary?.addEventListener('click', handleIconClick)
				} else {
					summary?.removeEventListener('click', handleIconClick)
					if (details.querySelectorAll('ul li').length > 0) details.open = true
				}
			})
		}
	})

	afterNavigate(() => {
		if (isMobile) checked = false
	})
</script>

<svelte:window
	onkeydown={({ key, metaKey }) => {
		if (key === '\\' && metaKey) checked = !checked
	}}
	onresize={() => {
		isMobile = window.matchMedia('(width < 40rem)').matches
		if (isMobile) checked = false
	}}
/>

<label
	class="absolute top-ch right-0 z-1 grid h-lh place-content-center px-ch transition-transform max-sm:sidebar-not-open:translate-x-full"
	aria-label="Toggle sidebar"
	title="Toggle sidebar (⌘ + \)"
>
	<input id="sidebar-open" class="sr-only" type="checkbox" bind:checked />

	<SidebarIcon class="size-[1em]" />
</label>
