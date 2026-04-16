<script lang="ts">
	import { cn } from '$lib/utils'
	import { MoonIcon, SunIcon } from '$ui/icons'
	import { colorSchemeStore } from '$ui/store.svelte'

	let mode = $derived(colorSchemeStore.mode)

	$effect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

		function handleChange() {
			if (colorSchemeStore.colorScheme === 'auto') mode
		}
		mediaQuery.addEventListener('change', handleChange)

		return () => mediaQuery.removeEventListener('change', handleChange)
	})

	$effect(() => {
		localStorage.setItem('color-scheme', mode)
	})
</script>

<button
	id="toggle-color-scheme"
	class="flex items-center gap-[.5ch]"
	data-color-scheme={mode}
	onclick={() => {
		colorSchemeStore.colorScheme = mode === 'dark' ? 'light' : 'dark'
	}}
	title="Toggle light/dark mode"
>
	<SunIcon class={cn(mode === 'dark' && 'opacity-25 sidebar-not-open:hidden')} />
	<MoonIcon class={cn(mode === 'light' && 'opacity-25 sidebar-not-open:hidden')} />
</button>

<style>
	button :global(svg) {
		flex-shrink: 0;
	}
</style>
