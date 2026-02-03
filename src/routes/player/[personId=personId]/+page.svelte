<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import StatGraph from '$ui/stats/graph.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let person = $derived(
		data.person as MLB.Person & {
			currentTeam: MLB.Team
			preferredTeam?: { team: MLB.Team }
			stats: MLB.PlayerStats[]
		},
	)

	const team = $derived(person.active ? person.currentTeam : person.preferredTeam?.team)

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
			(s) => (s.group as unknown as MLB.StatGroupRef).displayName === group && s.splits?.length,
		)

	const isPitcher = $derived(person.primaryPosition?.abbreviation === 'P')

	const getStatLabel = (key: string) =>
		data.statsList?.find((s) => [s.name, s.lookupParam].includes(key))?.lookupParam ?? key
</script>

<Metadata title="{person.fullName} | MLB.TheOhtani.com" description="{person.fullName} profile" />

<section class="p-ch">
	<header class="flex flex-wrap items-end gap-ch">
		<Headshot
			class="size-[4lh] shrink-0 rounded-none bg-transparent"
			{person}
			size={240}
			type={person.active ? 'silo' : 'spots'}
		/>

		<h1 class="grid">
			<span>{person.useName || person.firstName}</span>
			<strong class="text-3xl">{person.useLastName || person.lastName}</strong>
		</h1>

		{#if person.primaryNumber}
			<div>
				#{person.primaryNumber}
			</div>
		{/if}

		{#if person.primaryPosition}
			<div>
				{person.primaryPosition.abbreviation}
			</div>
		{/if}

		{#if team}
			<a href="/teams/{team.id}" class="decoration-dashed hover:underline">
				{team.name}
			</a>
		{/if}
	</header>

	<!-- <img
		src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_426,q_auto:best/v1/people/{person.id}/action/hero/current"
		alt=""
	/> -->

	<div class="stats-toggle text-center">
		{#if hasStats('hitting') && hasStats('pitching')}
			<nav class="flex items-center justify-center gap-ch">
				<label>
					<input type="radio" name="stat-group" value="hitting" checked={!isPitcher} />
					Hitting
				</label>
				<label>
					<input type="radio" name="stat-group" value="pitching" checked={isPitcher} />
					Pitching
				</label>
			</nav>
		{/if}

		<div class="grid grid-cols-[repeat(auto-fit,minmax(10ch,1fr))] gap-px">
			{#each Object.entries(statKeys) as [group, keys]}
				{#if hasStats(group)}
					{#each keys as key, i}
						<label
							class="order-last button uppercase has-checked:border-accent has-checked:font-bold dark:has-checked:text-accent"
							data-group={group}
						>
							<input type="radio" name="{group}-stat" value={key} checked={i === 0} hidden />
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

						<StatGraph
							class="col-span-full mb-ch"
							{group}
							stats={person.stats}
							statsList={data.statsList}
							{key}
						/>
					{/each}
				{/if}
			{/each}
		</div>
	</div>
</section>

<style>
	.stats-toggle:has([value='hitting']:not(:checked)) :global([data-group='hitting']),
	.stats-toggle:has([value='pitching']:not(:checked)) :global([data-group='pitching']) {
		display: none;
	}

	label:has(:not(:checked)) + :global([data-stat]) {
		display: none;
	}
</style>
