<script lang="ts">
	import type { UmpireCalls } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'
	import { SOURCE_LABEL } from './types'

	let {
		calls,
		href,
		class: className,
	}: { calls: UmpireCalls; href: string; class?: string } = $props()
</script>

{#if calls.source === 'umpscorecards'}
	<a class={cn('text-xs text-current/40 hover:underline', className)} {href} target="_blank">
		{SOURCE_LABEL.umpscorecards}
	</a>
{:else}
	<span
		class={cn('text-xs text-current/40', className)}
		title="Graded against the rulebook zone with no margin for tracking error, so it runs slightly below official scorecards"
	>
		{SOURCE_LABEL.tracking}
	</span>
{/if}
