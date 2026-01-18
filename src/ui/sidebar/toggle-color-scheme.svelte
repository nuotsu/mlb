<script lang="ts">
	import { colorSchemeStore } from '$ui/store.svelte'

	let mode = $derived(colorSchemeStore.mode)

	$effect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		function handleChange() {
			if (colorSchemeStore.colorScheme === 'auto') mode // re-derive mode
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
	data-color-scheme={mode}
	onclick={() => {
		colorSchemeStore.colorScheme = mode === 'dark' ? 'light' : 'dark'
	}}
>
	{mode === 'dark' ? 'Dark' : 'Light'} mode
</button>
