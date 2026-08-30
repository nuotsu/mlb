<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { monthName } from '$lib/temporal'
	import { cn, ordinal } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SelectGameType from '$ui/select-game-type.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import SelectMonth from '$ui/stats/select-month.svelte'
	import SelectSeason from '$ui/stats/select-season.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageData, PageProps } from './$types'
	import type { StatGroup } from './rank'

	let { data }: PageProps = $props()

	type StatTable = PageData['hitting']

	/** Stats whose `lookupParam` isn't the abbreviation everyone reads them by */
	const SHORT: Record<string, string> = {
		doubles: '2B',
		triples: '3B',
		strikeOuts: 'K',
		inningsPitched: 'IP',
	}

	let period = $derived(
		data.month ? `${monthName(data.month)} ${page.params.season}` : page.params.season,
	)

	function labelFor(stat: string) {
		const meta = data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat))

		return {
			short: SHORT[stat] ?? meta?.lookupParam ?? stat,
			full: meta?.label ?? meta?.name ?? stat,
		}
	}

	/** The same thresholds the player leaders use, so a good number reads the same on both pages. */
	function tone(group: StatGroup, stat: string, value: number | string | undefined) {
		const n = Number(value)
		if (!Number.isFinite(n)) return undefined

		if (group === 'hitting')
			return (stat === 'avg' && n >= 0.3) || (stat === 'ops' && n >= 1) ? 'positive' : undefined

		return (stat === 'era' && n < 3) || (stat === 'whip' && n < 1) ? 'positive' : undefined
	}

	function withParam(key: string, value: string) {
		const url = new URL(page.url)
		if (value) {
			url.searchParams.set(key, value)
		} else {
			url.searchParams.delete(key)
		}
		return url.toString()
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: `${period} MLB Team Hitting Leaders`,
		url: `https://mlb.theohtani.com/team-stats/${page.params.season}`,
		itemListElement: data.hitting.rows.map(({ rank, team, stat }) => ({
			'@type': 'ListItem',
			position: rank,
			item: {
				'@type': 'SportsTeam',
				name: team.name,
				url: `https://mlb.theohtani.com/teams/${team.id}`,
				description: `R: ${stat.runs}, HR: ${stat.homeRuns}, AVG: ${stat.avg}`,
			},
		})),
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{period} Team Stats | MLB.TheOhtani.com"
	description="MLB team hitting and pitching stats for {period}, ranked league-wide and within each league"
/>

<Header
	title="Team Stats"
	crumbs={[
		{ href: '/team-stats', name: 'Team Stats' },
		data.month ? { href: page.url.pathname + page.url.search, name: monthName(data.month) } : {},
	]}
>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<div class="flex items-center gap-px">
				<SelectSport available={data.availableSportIds} />
				<SelectGameType class="button text-center" available={data.availableGameTypes} />
			</div>

			<SelectSeason
				onchange={(e) =>
					goto(`/team-stats/${(e.currentTarget as HTMLSelectElement).value}${page.url.search}`)}
			/>

			<SelectMonth
				value={data.month ?? ''}
				max={data.maxMonth}
				allLabel="Full season"
				onchange={(e) => goto(withParam('month', (e.currentTarget as HTMLSelectElement).value))}
			/>
		</div>
	{/snippet}
</Header>

<section class="space-y-lh py-lh md:px-ch">
	{@render statTable('Hitting', data.hitting)}

	<hr class="border-dashed border-stroke" />

	{@render statTable('Pitching', data.pitching)}
</section>

{#snippet statTable(heading: string, { group, param, sortStat, stats, rows }: StatTable)}
	<article class="space-y-ch">
		<h2 class="px-ch text-sm text-current/50">
			{heading} — {period}
		</h2>

		<div class="overflow-x-auto overflow-y-hidden">
			<table class="w-max min-w-full text-center">
				<thead class="text-sm">
					<tr>
						<th
							class="sticky left-0 z-1 min-w-[16ch] bg-background text-left md:w-[1%] md:min-w-[30ch]"
							scope="col"
						>
							Team
						</th>

						<th class="w-[6ch] text-current/40" scope="col">
							<abbr title="Rank within its own league, by the sorted stat">Lg</abbr>
						</th>

						{#each stats as stat, i (i)}
							{@const { short, full } = labelFor(stat)}
							{@const allowed = group === 'pitching' && ['runs', 'homeRuns'].includes(stat)}

							<th class="px-[.5ch]" scope="col">
								<abbr title="{full}{allowed ? ' allowed' : ''}">
									<a
										href={withParam(param, stat)}
										class={cn(
											'block uppercase',
											sortStat === stat
												? 'bg-foreground font-bold text-background'
												: 'text-current/40',
										)}
									>
										{short}
									</a>
								</abbr>
							</th>
						{/each}
					</tr>
				</thead>

				<tbody>
					{#if rows.length}
						{#each rows as { team, stat, league, rank, leagueRank } (team.id)}
							<tr class="hover:[&>td]:bg-foreground/10">
								<th
									class="sticky left-0 z-1 min-w-[16ch] bg-background text-left md:w-[1%] md:min-w-[30ch]"
									scope="row"
								>
									<div class="flex items-center gap-ch">
										<span class="w-[3ch] shrink-0 text-right text-xs text-current/50 tabular-nums">
											{rank}
										</span>

										<StyledTeam class="grow" {team} linked />
									</div>
								</th>

								<td class="text-xs whitespace-nowrap text-current/50">
									{#if league}
										<abbr
											title="{ordinal(leagueRank)} in the {league} by {labelFor(sortStat).full}"
										>
											{league}
											{leagueRank}
										</abbr>
									{:else}
										-
									{/if}
								</td>

								{#each stats as name, i (i)}
									<td
										class={cn(
											'tabular-nums',
											sortStat === name && 'font-bold',
											tone(group, name, stat[name]),
										)}
									>
										{stat[name] ?? '-'}
									</td>
								{/each}
							</tr>
						{/each}
					{:else}
						<tr>
							<td colspan={stats.length + 2}>
								<Empty>No {group} stats</Empty>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</article>
{/snippet}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
