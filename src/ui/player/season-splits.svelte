<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import Logo from '$ui/team/logo.svelte'

	let {
		group,
		person,
		baseballStats,
	}: {
		group: 'hitting' | 'pitching'
		person: MLB.Person & { stats: MLB.PlayerStats[] }
		baseballStats: MLB.BaseballStat[]
	} = $props()

	const statKeys = {
		hitting: [
			'avg',
			'homeRuns',
			'rbi',
			'hits',
			'doubles',
			'triples',
			'stolenBases',
			'obp',
			'slg',
			'ops',
		],
		pitching: [
			'era',
			'gamesPlayed',
			'wins',
			'losses',
			'saves',
			'strikeOuts',
			'whip',
			'inningsPitched',
		],
	} as const

	const borderKeys = {
		hitting: ['rbi', 'triples', 'stolenBases'],
		pitching: ['era', 'saves', 'strikeOuts'],
	} as const

	const groupDisplayName = (s: MLB.PlayerStats) =>
		(s.group as unknown as MLB.StatGroupRef)?.displayName

	const yearByYearSplits = $derived(
		person.stats?.find((s) => s.type?.displayName === 'yearByYear' && groupDisplayName(s) === group)
			?.splits ?? [],
	)

	const careerSplit = $derived(
		person.stats?.find((s) => s.type?.displayName === 'career' && groupDisplayName(s) === group)
			?.splits?.[0],
	)

	/** Prefer per-team stints; drop team-less combined totals when a season has team rows. */
	const seasonRows = $derived(
		yearByYearSplits
			.map((split, index) => ({ split, index }))
			.filter(({ split }) => {
				const sameSeason = yearByYearSplits.filter((s) => s.season === split.season)
				if (sameSeason.length > 1) {
					return !!split.team
				}
				return true
			})
			// Same-season stints arrive chronologically; reverse so the latest team is on top
			.sort(
				(a, b) => Number(b.split.season ?? 0) - Number(a.split.season ?? 0) || b.index - a.index,
			)
			.map(({ split }) => split),
	)

	const hasStats = $derived(seasonRows.length > 0)

	function getStatLabel(key: string) {
		const { label, name, lookupParam } =
			baseballStats.find((s) => [s.name, s.lookupParam].includes(key)) ?? {}

		if (key === 'doubles') return { abbr: '2B', title: label ?? name ?? '2B' }
		if (key === 'triples') return { abbr: '3B', title: label ?? name ?? '3B' }
		if (key === 'strikeOuts') return { abbr: 'K', title: label ?? name ?? 'K' }
		if (key === 'gamesPlayed') return { abbr: 'G', title: label ?? name ?? 'Games' }

		return { abbr: lookupParam ?? key, title: label ?? name ?? key }
	}

	function valueClass(key: string, value: unknown) {
		const n = Number(value)
		if (!Number.isFinite(n)) return undefined

		if (key === 'avg') {
			if (n >= 0.3) return 'positive'
			if (n < 0.23) return 'negative'
		}
		if (key === 'ops') {
			if (n >= 1) return 'positive'
			if (n < 0.65) return 'negative'
		}
		if (key === 'era') {
			if (n < 3) return 'positive'
			if (n > 4.5) return 'negative'
		}
		if (key === 'whip') {
			if (n < 1) return 'positive'
			if (n > 1.4) return 'negative'
		}

		return undefined
	}

	function borderClass(key: string) {
		return (borderKeys[group] as readonly string[]).includes(key)
			? 'border-r border-r-current/25'
			: ''
	}
</script>

{#if hasStats}
	<article class="overflow-x-auto has-[table]:flex">
		<table class="min-w-full table-fixed text-center">
			<thead class="text-sm">
				<tr>
					<th class="w-[5ch] min-w-[5ch]"></th>
					<th class="w-lh min-w-lh"></th>

					{#each statKeys[group] as key (key)}
						{@const { abbr, title } = getStatLabel(key)}
						<th class="px-[.5ch]">
							<abbr class="text-current/40 uppercase" {title}>{abbr}</abbr>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				{#if careerSplit}
					<tr class="hover:[&>td]:bg-foreground/10 hover:[&>th]:bg-foreground/10">
						<th
							class="border-b [border-bottom-style:dashed] border-stroke bg-background px-[.5ch] text-center align-middle font-normal"
							colspan="2"
						>
							Career
						</th>

						{#each statKeys[group] as key (key)}
							{@const value = careerSplit.stat[key]}
							<td
								class={cn(
									'border-b [border-bottom-style:dashed] border-b-stroke tabular-nums',
									borderClass(key),
									valueClass(key, value),
								)}
							>
								{value ?? '—'}
							</td>
						{/each}
					</tr>
				{/if}

				{#each seasonRows as split (split.season + '-' + (split.team?.id ?? 'none'))}
					{@const team = split.team}
					{@const bg = team
						? `url(https://midfield.mlbstatic.com/v1/team/${team.id}/spots/32)`
						: undefined}

					<tr class="hover:[&>td]:bg-foreground/10 hover:[&>th]:bg-foreground/10">
						<th
							class={cn(
								'sticky left-0 z-1 px-[.5ch] text-left tabular-nums',
								!team && 'bg-background',
								team && {
									'dark:text-dark': isDarkOnLightTeam(team),
									'dark:text-light': isLightOnDarkTeam(team),
								},
							)}
							style:--team-bg={bg}
						>
							{split.season}
						</th>

						<td
							class={cn('relative w-lh min-w-lh', {
								'dark:text-dark': team && isDarkOnLightTeam(team),
								'dark:text-light': team && isLightOnDarkTeam(team),
							})}
							style:--team-bg={bg}
						>
							{#if team}
								<a class="block" href="/teams/{team.id}" aria-label={team.name}>
									<Logo class="mx-auto size-lh object-contain" {team} />
								</a>
							{/if}
						</td>

						{#each statKeys[group] as key (key)}
							{@const value = split.stat[key]}
							<td class={cn('tabular-nums', borderClass(key), valueClass(key, value))}>
								{value ?? '—'}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</article>
{/if}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
