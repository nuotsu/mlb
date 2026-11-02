<!--
	@component
	A number, colored good or bad. For cells that show more than the column's plain value.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js'
	import type { Snippet } from 'svelte'

	let {
		value,
		tone,
		title,
		dim,
		class: className,
		children,
	}: {
		value?: string | number | null
		tone?: 'positive' | 'negative' | false | null
		title?: string
		/** Faded, e.g. a zero */
		dim?: boolean
		class?: string
		children?: Snippet
	} = $props()
</script>

<span class={cn('tabular-nums', tone, dim && 'text-current/40', className)} {title}>
	{#if children}
		{@render children()}
	{:else}
		{value ?? '-'}
	{/if}
</span>
