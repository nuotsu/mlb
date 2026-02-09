<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		class: className,
		children,
		...props
	}: {
		class?: string
		children?: Snippet
	} & HTMLAttributes<HTMLDivElement> = $props()
</script>

<div
	class="grid place-content-center gap-ch p-lh text-center text-current/40 select-none {className}"
	{...props}
>
	<span>{':('}</span>

	{#if children}
		{@render children()}
	{:else}
		No data
	{/if}
</div>
