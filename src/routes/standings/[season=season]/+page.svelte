<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import { ArrowUpIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import SelectGameType from '$ui/select-game-type.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import SelectSeason from '$ui/stats/select-season.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const since = $derived(formatDate(data.comparisonDate, { month: 'short', day: 'numeric' }))

	const leagueGroups = $derived(
		Object.groupBy(data.standings.records, (record) => record.league?.id ?? 0),
	)

	function sortOrder(
		a: (typeof data.standings.records)[number],
		b: (typeof data.standings.records)[number],
	) {
		return (a.division?.sortOrder ?? 0) - (b.division?.sortOrder ?? 0)
	}

	function removeDuplicates(records: (typeof data.standings.records)[number][]) {
		const seen = new Set<number>()
		return records.filter((record) => {
			const id = record.division?.id
			if (id === undefined) return true
			if (seen.has(id)) return false
			seen.add(id)
			return true
		})
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: `${page.params.season} MLB Standings`,
		url: `https://mlb.theohtani.com/standings/${page.params.season}`,
		itemListElement: data.standings.records.flatMap(({ division, teamRecords }) =>
			teamRecords.map(({ team, wins, losses, winningPercentage, leagueRank }) => ({
				'@type': 'ListItem',
				position: Number(leagueRank),
				name: `${team.name} (${wins}-${losses}, ${winningPercentage})`,
				item: {
					'@type': 'SportsTeam',
					name: team.name,
					url: `https://mlb.theohtani.com/teams/${team.id}`,
					description: `${division?.nameShort ?? 'MLB'} | ${wins}-${losses} | ${winningPercentage}`,
				},
			})),
		),
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{page.params.season} MLB Standings | MLB.TheOhtani.com"
	description="MLB standings for the {page.params.season} season"
/>

<Header title="Standings" crumbs={[{ name: 'Standings' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<div class="flex items-center gap-px">
				<SelectSport available={data.availableSportIds} />
				<SelectGameType class="button text-center" available={data.availableGameTypes} />
			</div>
			<SelectSeason
				onchange={(e) =>
					goto(`/standings/${(e.currentTarget as HTMLSelectElement).value}${page.url.search}`)}
			/>
		</div>
	{/snippet}
</Header>

<section class="grid gap-lh p-ch">
	{#each Object.entries(leagueGroups) as [leagueId, records] (leagueId)}
		{@const divisions = removeDuplicates((records ?? []).sort(sortOrder))}
		<div class="flex flex-col gap-ch">
			<h2 class="px-ch text-sm text-current/50">{divisions?.[0]?.league?.name}</h2>
			<div
				class={cn('grid items-start gap-[2lh]', {
					'sm:grid-cols-2 lg:grid-cols-3':
						(divisions?.length ?? 0) > 4 || (divisions?.length ?? 0) === 3,
					'sm:grid-cols-2': (divisions?.length ?? 0) === 4 || (divisions?.length ?? 0) === 2,
				})}
			>
				{#each divisions as { division, teamRecords }, i (i)}
					<div class="overflow-x-auto overflow-y-hidden">
						<table class="w-max min-w-full text-center">
							<thead>
								<tr class="text-sm text-current/50 *:font-normal">
									<th
										class="sticky left-0 z-1 min-w-[10ch] bg-background text-left text-foreground"
									>
										<span class="line-clamp-1 break-all">{division?.nameShort}</span>
									</th>
									<th class="w-[8ch]">W-L</th>
									<th class="w-[5ch]">%</th>
									<th class="w-[5ch]">GB</th>
									<th class="w-[5ch]">Strk</th>
									<th class="w-[5ch]">#</th>
									<th class="w-[8ch]">↑/↓</th>
								</tr>
							</thead>
							<tbody>
								{#each teamRecords as { team, wins, losses, winningPercentage, gamesBack, streak, leagueRank } (team.id)}
									{@const change = data.rankChanges[team.id]}
									<tr class="hover:[&>td]:bg-foreground/10">
										<td
											class={cn('sticky left-0 z-1 min-w-[10ch] bg-background', {
												'dark:text-dark': isDarkOnLightTeam(team),
												'dark:text-light': isLightOnDarkTeam(team),
											})}
										>
											<StyledTeam class="text-left" {team} linked />
										</td>
										<td class="flex justify-center tabular-nums">
											<span class="positive">{wins}</span>
											-
											<span class="negative">{losses}</span>
										</td>
										<td
											class={cn(
												'tabular-nums',
												Number(winningPercentage) >= 0.5 ? 'positive' : 'negative',
											)}
										>
											{winningPercentage}
										</td>
										<td class={cn('tabular-nums', gamesBack === '0' && 'text-current/50')}>
											{gamesBack === '0' ? '-' : gamesBack}
										</td>
										<td
											class="tabular-nums"
											class:positive={streak?.streakCode?.startsWith('W')}
											class:negative={streak?.streakCode?.startsWith('L')}
										>
											{streak?.streakCode}
										</td>
										<td class="tabular-nums">{leagueRank}</td>
										<td
											class="tabular-nums"
											class:positive={change > 0}
											class:negative={change < 0}
										>
											{#if change}
												<span
													class="inline-flex items-center gap-[.25ch]"
													title="{change > 0 ? 'Up' : 'Down'} {Math.abs(change)} since {since}"
												>
													<ArrowUpIcon
														class={cn('size-[.85em]', change < 0 && 'rotate-180')}
														role="img"
														aria-label={change > 0 ? 'Up' : 'Down'}
													/>
													{Math.abs(change)}
												</span>
											{:else}
												<span class="text-current/50">-</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<Empty>No standings</Empty>
	{/each}
</section>
