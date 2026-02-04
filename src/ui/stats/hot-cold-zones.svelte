<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'
	import Strikezone from './strikezone.svelte'

	let {
		hotColdZones,
		baseballStats,
		...props
	}: {
		hotColdZones?: MLB.PlayerStats
		baseballStats?: MLB.BaseballStat[]
	} & HTMLAttributes<HTMLElement> = $props()
</script>

<article
	class="mx-auto grid max-w-max grid-cols-[2fr_1fr] grid-rows-[1fr_repeat(var(--count),auto)] items-center gap-x-ch"
	style:--count={(hotColdZones?.splits?.length ?? 0) + 2}
	{...props}
>
	<h2 class="col-start-2 mb-auto text-sm text-current/50">Hot/Cold Zones</h2>

	{#each hotColdZones?.splits as { stat }, i (stat.name)}
		<label class="order-last col-start-2 flex items-center gap-[.5ch] uppercase">
			<input
				class="shrink-0"
				type="radio"
				name="{props['data-group'] ?? 'hitting'}-hotColdZone"
				value={stat.zone}
				checked={i === 0}
			/>

			<abbr title={String(stat.name)}>
				{baseballStats?.find((s) => s.name === stat.name)?.lookupParam ?? stat.name}
			</abbr>
		</label>

		<Strikezone
			class="col-start-1 row-[1/var(--count)]"
			zones={stat.zones as unknown as MLB.HotColdZone[]}
		/>
	{/each}
</article>

<style>
	label:has(input:not(:checked)) + :global(figure) {
		display: none;
	}
</style>
