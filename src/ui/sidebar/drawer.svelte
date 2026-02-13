<script lang="ts">
	import { browser } from '$app/environment'
	import { cn } from '$lib/utils'
	import ToggleSidebar from './toggle-sidebar.svelte'

	let { children } = $props()

	let startX = $state(0)
	let swipeX = $state(0)
	let clientWidth = $state(0)
</script>

<label for="sidebar-open" class="fixed inset-0 z-1 cursor-default sm:hidden sidebar-not-open:hidden"
></label>

<nav
	id="drawer"
	class={cn(
		'relative z-1 h-dvh p-ch whitespace-nowrap backdrop-blur-xs transition-colors [grid-area:nav]',
		'max-sm:bg-neutral-200/50 max-sm:dark:bg-neutral-800/50',
		'sm:w-[calc(2ch+1rem)] sm:overflow-clip sm:transition-[width] sm:sidebar-open:overflow-y-auto',
		'max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:transition-transform max-sm:active:transition-none max-sm:sidebar-open:translate-x-(--swipe-x) max-sm:sidebar-not-open:-translate-x-full',
	)}
	style:--swipe-x="{swipeX}px"
	ontouchstart={(e) => {
		startX = e.touches[0].clientX
	}}
	ontouchmove={(e) => {
		swipeX = Math.min(0, e.touches[0].clientX - startX)
	}}
	ontouchend={() => {
		if (browser && swipeX < clientWidth * -0.25) {
			const input = document.querySelector('#sidebar-open') as HTMLInputElement
			if (input) input.checked = false
		}

		startX = 0
		swipeX = 0
	}}
	bind:clientWidth
>
	<ToggleSidebar />

	{@render children()}
</nav>

<style>
	nav {
		--drawer-width: 20ch;

		padding-left: max(1ch, env(safe-area-inset-left));
		padding-bottom: max(1ch, env(safe-area-inset-bottom));

		:global(body:has(#sidebar-open:checked)) & {
			width: calc(var(--drawer-width) + env(safe-area-inset-right));
		}
	}
</style>
