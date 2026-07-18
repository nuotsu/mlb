<script lang="ts">
	import { page } from '$app/state'
	import { labelDrag } from '$lib/attachments/label-drag'
	import Empty from '$ui/empty.svelte'
	import YearByYear from '$ui/stats/year-by-year.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		group,
		person,
		...props
	}: {
		group: 'hitting' | 'pitching'
		person: MLB.Person & { stats: MLB.PlayerStats[] }
	} & HTMLAttributes<HTMLElement> = $props()

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

	const hasStats = $derived(
		person.stats?.some(
			(s) =>
				s.type?.displayName === 'yearByYear' &&
				(s.group as unknown as MLB.StatGroupRef)?.displayName === group &&
				s.splits?.length,
		),
	)

	const getStatLabel = (key: string) =>
		baseballStats?.find((s) => [s.name, s.lookupParam].includes(key))?.lookupParam ?? key
</script>

<article class="group/yby grid grid-cols-3 gap-px text-center" {@attach labelDrag()} {...props}>
	{#if hasStats}
		<h2 class="col-span-full text-center text-sm text-current/50 group-has-data-empty/yby:hidden">
			Year-by-year
		</h2>

		{#each statKeys[group] as key, i (key)}
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

			<YearByYear class="col-span-full mb-ch" {group} stats={person.stats} {baseballStats} {key} />
		{/each}
	{:else}
		<Empty data-empty>No year-by-year stats</Empty>
	{/if}
</article>

<style>
	label:has(:not(input:checked)) + :global([data-stat]) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border-width: 0;
	}
</style>
