<script lang="ts">
	import { page } from '$app/state'
	import YearByYear from '$ui/stats/year-by-year.svelte'

	let {
		person,
	}: {
		person: MLB.Person & { stats: MLB.PlayerStats[] }
	} = $props()

	let baseballStats = $derived(page.data.baseballStats as MLB.BaseballStat[])

	const statKeys = {
		hitting: [
			'avg',
			'homeRuns',
			'rbi',
			'hits',
			'doubles',
			'triples',
			'baseOnBalls',
			'stolenBases',
			'slg',
		],
		pitching: [
			'era',
			'whip',
			'inningsPitched',
			'strikeOuts',
			'baseOnBalls',
			'hitBatsmen',
			'wins',
			'losses',
			'saves',
		],
	} as const

	const hasStats = (group: string) =>
		person.stats?.some(
			(s) => (s.group as unknown as MLB.StatGroupRef)?.displayName === group && s.splits?.length,
		)

	const getStatLabel = (key: string) =>
		baseballStats?.find((s) => [s.name, s.lookupParam].includes(key))?.lookupParam ?? key
</script>

<article
	class="grid grid-cols-[repeat(auto-fit,minmax(10ch,1fr))] gap-px text-center"
	ontouchmove={(e) => {
		const touch = e.touches[0]
		const element = document.elementFromPoint(touch.clientX, touch.clientY)
		const input = element?.closest('label')?.querySelector('input')
		if (input) input.checked = true
	}}
>
	{#each Object.entries(statKeys) as [group, keys] (group)}
		{#if hasStats(group)}
			{#each keys as key, i (key)}
				<label
					class="order-last button-base touch-none border-b border-current/25 bg-neutral-200/50 uppercase has-checked:border-accent has-checked:font-bold dark:bg-neutral-800/50 dark:has-checked:text-accent"
					data-group={group}
				>
					<input class="sr-only" type="radio" name="{group}-stat" value={key} checked={i === 0} />

					{#if key === 'doubles'}
						2B
					{:else if key === 'triples'}
						3B
					{:else if key === 'strikeOuts'}
						K
					{:else if key === 'baseOnBalls'}
						BB
					{:else if key === 'hitBatsmen'}
						HBP
					{:else}
						{getStatLabel(key)}
					{/if}
				</label>

				<YearByYear
					class="col-span-full mb-ch"
					{group}
					stats={person.stats}
					{baseballStats}
					{key}
				/>
			{/each}
		{/if}
	{/each}
</article>

<style>
	label:has(:not(:checked)) + :global([data-stat]) {
		display: none;
	}
</style>
