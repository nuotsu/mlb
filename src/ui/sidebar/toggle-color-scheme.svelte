<script lang="ts">
	import { browser } from '$app/environment'

	let colorScheme = $derived(browser ? localStorage.getItem('color-scheme') || 'auto' : 'auto')

	let mode = $derived.by(() => {
		if (browser) {
			return colorScheme === 'auto'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: colorScheme
		}
		return colorScheme
	})

	$effect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		function handleChange() {
			if (colorScheme === 'auto') mode // re-derive mode
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
		colorScheme = mode === 'dark' ? 'light' : 'dark'
	}}
>
	{mode === 'dark' ? 'Dark' : 'Light'} mode
</button>
