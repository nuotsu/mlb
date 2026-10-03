<script lang="ts">
	import { cn } from '#lib/utils.js'
	import ToggleSidebar from './toggle-sidebar.svelte'

	let { children } = $props()

	let nav: HTMLElement

	$effect(() => {
		let startX = 0
		let swipeX = 0

		nav.style.setProperty('--swipe-x', '0px')

		const start = (e: TouchEvent) => {
			startX = e.touches[0].clientX
			nav.style.transition = 'none'
		}
		const move = (e: TouchEvent) => {
			swipeX = Math.min(0, e.touches[0].clientX - startX)
			nav.style.setProperty('--swipe-x', `${swipeX}px`)
		}
		const end = () => {
			nav.style.transition = ''
			if (swipeX < nav.clientWidth * -0.25) {
				const input = document.querySelector('#sidebar-open') as HTMLInputElement
				if (input) {
					input.checked = false
					input.dispatchEvent(new Event('change'))
				}
			}
			swipeX = 0
			nav.style.setProperty('--swipe-x', '0px')
		}

		nav.addEventListener('touchstart', start)
		nav.addEventListener('touchmove', move)
		nav.addEventListener('touchend', end)
		nav.addEventListener('touchcancel', end)

		return () => {
			nav.removeEventListener('touchstart', start)
			nav.removeEventListener('touchmove', move)
			nav.removeEventListener('touchend', end)
			nav.removeEventListener('touchcancel', end)
		}
	})
</script>

<label for="sidebar-open" class="fixed inset-0 z-1 cursor-default sm:hidden sidebar-not-open:hidden"
></label>

<nav
	id="drawer"
	class={cn(
		'relative z-1 h-dvh whitespace-nowrap backdrop-blur-xs transition-colors [grid-area:nav]',
		'max-sm:bg-neutral-200/50 max-sm:dark:bg-neutral-800/50',
		'sm:w-[calc(2ch+1rem)] sm:overflow-clip sm:transition-[width] sm:sidebar-open:overflow-y-auto',
		'max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:transition-transform max-sm:sidebar-open:translate-x-(--swipe-x) max-sm:sidebar-not-open:-translate-x-full',
	)}
	bind:this={nav}
>
	<ToggleSidebar />

	{@render children()}
</nav>

<style>
	nav {
		--drawer-width: 20ch;

		:global(body:has(#sidebar-open:checked)) & {
			width: calc(var(--drawer-width) + env(safe-area-inset-right));
		}
	}
</style>
