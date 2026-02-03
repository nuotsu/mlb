<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		hotColdZones,
		baseballStats,
		...props
	}: {
		hotColdZones?: MLB.PlayerStats
		baseballStats?: MLB.BaseballStat[]
	} & HTMLAttributes<HTMLElement> = $props()
</script>

<article {...props}>
	{#each hotColdZones?.splits as { stat }, i (stat.name)}
		<label class="uppercase">
			<input
				type="radio"
				name="{props['data-group'] ?? 'hitting'}-hotColdZone"
				value={stat.zone}
				checked={i === 0}
			/>

			<abbr title={String(stat.name)}>
				{baseballStats?.find((s) => s.name === stat.name)?.lookupParam ?? stat.name}
			</abbr>
		</label>
	{/each}
</article>
