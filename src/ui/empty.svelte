<script lang="ts">
	import type { Snippet } from 'svelte'

	let { children }: { children?: Snippet } = $props()
</script>

<div class="grid place-content-center gap-ch p-lh text-center text-current/40 select-none">
	<span>{':('}</span>

	{#if children}
		{@render children()}
	{:else}
		No data
	{/if}
</div>
