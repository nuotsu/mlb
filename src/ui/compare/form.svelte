<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import { ENABLED_BASEBALL_STATS } from '#lib/stats.js'
	import { formatDate, getToday } from '#lib/temporal.js'
	import { compareStore } from '#ui/compare/store.svelte.js'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import { enhance } from '$app/forms'
	import type { HTMLAttributes } from 'svelte/elements'

	// MLB API inconsistency: `name` from /baseballStats doesn't always match the actual JSON key
	const STAT_KEY: Record<string, string> = { strikeouts: 'strikeOuts' }

	let form = $state<HTMLFormElement | null>(null)

	const PARAMETERS = {
		season: { displayName: 'season' },
		date: {
			displayName: 'date',
			type: 'date',
			value: formatDate(getToday(), { locale: 'en-CA' }),
			min: '1901-01-01',
			max: `${getToday().getFullYear() + 1}-12-31`,
		},
		vsTeam: { displayName: 'opposingTeamId' },
	} as Record<string, HTMLAttributes<HTMLInputElement> & { displayName?: string }>

	const TYPES: {
		displayName: string
		label?: string
		parameters?: (typeof PARAMETERS)[keyof typeof PARAMETERS][]
	}[] = [
		{
			displayName: 'season,seasonAdvanced',
			label: 'Season',
			parameters: [PARAMETERS.season],
		},
		{ displayName: 'careerRegularSeason,careerAdvanced', label: 'Career' },
		{
			displayName: 'projected',
			label: 'Projected',
			parameters: [PARAMETERS.season],
		},
		{
			displayName: 'byDateRange',
			label: 'By date range',
			parameters: [
				{ ...PARAMETERS.date, displayName: 'startDate' },
				{ ...PARAMETERS.date, displayName: 'endDate' },
			],
		},
		{ displayName: 'vsTeam', label: 'vs Team', parameters: [PARAMETERS.vsTeam] },
	]

	let selectedGroup = $state<MLB.StatGroupRef['displayName']>('hitting')
	let selectedType = $state(TYPES[0].displayName)

	$effect(() => {
		form?.requestSubmit()
	})
</script>

<form
	class="grid grid-cols-[auto_1fr] gap-x-ch gap-y-[.5ch] px-ch"
	method="POST"
	use:enhance={() => {
		return async ({ update }) => {
			await update({ reset: false })
		}
	}}
	bind:this={form}
	onchange={() => form?.requestSubmit()}
>
	<input type="hidden" name="ids" value={compareStore.ids.join(',')} />

	<fieldset class="contents">
		<div class="contents">
			<legend>Group</legend>

			<div>
				<select class="button" name="group" bind:value={selectedGroup}>
					{#each ['hitting', 'pitching', 'fielding'] as displayName (displayName)}
						<option value={displayName}>{displayName}</option>
					{/each}
				</select>
			</div>
		</div>
	</fieldset>

	<fieldset class="contents">
		<div class="contents">
			<legend>Stats</legend>

			{#await fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats') then baseballStats}
				{@const stats = baseballStats.filter(
					(s) =>
						s.statGroups.map((s) => s.displayName).includes(selectedGroup) &&
						ENABLED_BASEBALL_STATS.has(s.name),
				)}

				<div class="overflow-y-auto border border-stroke max-sm:max-h-[7.5lh]">
					<div class="sticky top-0 w-full border-b border-stroke px-ch text-right backdrop-blur-xs">
						<button
							class="link"
							type="button"
							onclick={(e) => {
								const radios =
									(e.target as HTMLElement)
										.closest('fieldset')
										?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? []
								const hasChecked = Array.from(radios).some((radio) => radio.checked)
								radios.forEach((radio) => {
									radio.checked = hasChecked ? false : true
								})
								form?.requestSubmit()
							}}>Toggle all</button
						>
					</div>

					{#if stats.length}
						<div class="px-ch py-[.5ch] *:break-inside-avoid sm:columns-[12ch]">
							{#each stats as { lookupParam, name, isCounting } (name)}
								<label
									class="mb-px flex items-baseline gap-ch p-[.5ch] leading-tight hover:bg-accent/15 has-checked:bg-accent/15 has-checked:text-accent"
								>
									<input
										class="shrink-0"
										name="stats"
										type="checkbox"
										value={STAT_KEY[name] ??
											(isCounting ? name || lookupParam : lookupParam || name)}
									/>

									<span>
										{#each name.split(/(?=[A-Z])/g) as word (word)}
											<span class="inline-block lowercase first:capitalize">{word}&nbsp;</span>
										{/each}
									</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/await}
		</div>
	</fieldset>

	<fieldset class="contents">
		<div class="contents">
			<legend>Types</legend>
			<div>
				<select class="button" name="type" bind:value={selectedType}>
					{#each TYPES as { displayName, label } (displayName)}
						<option value={displayName}>{label ?? displayName}</option>
					{/each}
				</select>
			</div>
		</div>
	</fieldset>

	{#if TYPES.find((t) => t.displayName === selectedType)?.parameters}
		{@const { parameters } = TYPES.find((t) => t.displayName === selectedType) ?? {}}
		{#each parameters as { displayName, ...props } (displayName)}
			<fieldset class="contents">
				<div class="contents">
					<legend>{displayName}</legend>

					{#if displayName === 'season'}
						<SelectSeason
							class="justify-start"
							name={displayName}
							onchange={() => form?.requestSubmit()}
						/>
					{:else if displayName === 'month'}
						<select class="button" name={displayName}>
							{#each Array.from({ length: 12 }, (_, i) => i + 1) as m (m)}
								<option value={m}>
									{new Date(2000, m - 1).toLocaleString('en-US', { month: 'long' })}
								</option>
							{/each}
						</select>
					{:else if displayName === 'opposingTeamId'}
						{#await fetchMLB<MLB.TeamsResponse>( '/api/v1/teams', { sportId: '1', fields: ['teams,id,name,abbreviation'] } ) then { teams }}
							<select class="button" name={displayName}>
								<option value="">All teams</option>
								{#each teams.sort((a, b) => a.name.localeCompare(b.name)) as t (t.id)}
									<option value={t.id}>{t.abbreviation ?? t.name}</option>
								{/each}
							</select>
						{/await}
					{:else}
						<label>
							<input class="button" name={displayName} {...props} />
						</label>
					{/if}
				</div>
			</fieldset>
		{/each}
	{/if}
</form>

<style>
	legend {
		position: sticky;
		top: var(--header-height);
		align-self: start;
	}

	select {
		height: 1lh;
	}
</style>
