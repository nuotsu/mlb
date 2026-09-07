<script lang="ts">
	import type { BracketSeries } from '$lib/postseason/bracket'
	import { cn } from '$lib/utils'

	let {
		series,
		direction,
		spoiler = false,
	}: {
		series: BracketSeries
		/** `ltr` when the next round is to the right (AL side), `rtl` for the NL side. */
		direction: 'ltr' | 'rtl'
		spoiler?: boolean
	} = $props()

	// Drawn in a 100 × (rows) box stretched to the cell, so vertical positions are in rows.
	const from = $derived(direction === 'ltr' ? 0 : 100)
	const to = $derived(direction === 'ltr' ? 100 : 0)
	const mid = $derived(series.height / 2)

	const winner = $derived(spoiler ? undefined : series.winner)
	const topWon = $derived(!!winner && winner.id === series.top.team?.id)
	const bottomWon = $derived(!!winner && winner.id === series.bottom.team?.id)
</script>

<svg
	class="size-full overflow-visible"
	viewBox="0 0 100 {series.height}"
	preserveAspectRatio="none"
	aria-hidden="true"
>
	<path
		class={cn('line', topWon && 'won')}
		d="M{from},{series.top.center} H50 V{mid}"
		vector-effect="non-scaling-stroke"
	/>
	<path
		class={cn('line', bottomWon && 'won')}
		d="M{from},{series.bottom.center} H50 V{mid}"
		vector-effect="non-scaling-stroke"
	/>
	<path
		class={cn('line', (topWon || bottomWon) && 'won')}
		d="M50,{mid} H{to}"
		vector-effect="non-scaling-stroke"
	/>
</svg>

<style>
	.line {
		fill: none;
		stroke: currentColor;
		stroke-opacity: 0.25;
		stroke-width: 1.5px;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			stroke 0.3s,
			stroke-opacity 0.3s,
			stroke-width 0.3s;
	}

	.won {
		stroke: var(--color-accent);
		stroke-opacity: 1;
		stroke-width: 3px;
	}
</style>
