<script lang="ts">
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
	class="flex w-full items-center gap-ch hover-link"
	data-color-scheme={mode}
	onclick={() => {
		colorSchemeStore.colorScheme = mode === 'dark' ? 'light' : 'dark'
	}}
>
	{#if mode === 'dark'}
		<MoonIcon />
	{:else}
		<SunIcon />
	{/if}

	<span class="sm:sidebar-closed-hidden">{mode === 'dark' ? 'Dark' : 'Light'} mode</span>
</button>

<style>
	button :global(svg) {
		flex-shrink: 0;
	}
</style>
