<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		children,
		value,
		class: className = '',
	}: {
		value: string
		class?: string
		children: Snippet
	} = $props()

	let isCopied = $state(false)
	let timeoutId = $state<null | ReturnType<typeof setTimeout>>(null)
</script>

<button
	class={className}
	onclick={() => {
		navigator.clipboard.writeText(value)

		if (timeoutId) clearTimeout(timeoutId)

		isCopied = true

		timeoutId = setTimeout(() => {
			isCopied = false
			timeoutId = null
		}, 1000)
	}}
>
	{#if isCopied}
		<!-- prettier-ignore -->
		<svg class="text-green-500" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="200px" width="200px" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"></path></svg>
	{:else}
		<!-- prettier-ignore -->
		<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="200px" width="200px" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 4l1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3l-3-3H5v10h8V7z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M3 1L2 2v10l1 1V2h6.414l-1-1H3z"></path></svg>
	{/if}

	{@render children()}
</button>
