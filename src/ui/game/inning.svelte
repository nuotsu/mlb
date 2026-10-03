<script lang="ts">
	import { cn } from '#lib/utils.js'

	let { linescore }: { linescore?: MLB.Linescore } = $props()

	const isMiddleOrEnd = $derived(['Middle', 'End'].includes(linescore?.inningState ?? ''))
</script>

<b
	class={cn(
		'pointer-events-none flex items-center justify-center gap-[.5ch]',
		!isMiddleOrEnd && 'mt-auto translate-y-[.25lh]',
	)}
>
	{#if isMiddleOrEnd}
		<small class="text-xs">{linescore?.inningState?.slice(0, 3)}</small>
	{/if}

	<span class="text-lg">{linescore?.currentInning}</span>
</b>
