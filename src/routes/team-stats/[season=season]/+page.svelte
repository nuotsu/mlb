<script lang="ts">
	import { LOWER_IS_BETTER } from '#lib/stats.js'
	import { monthName } from '#lib/temporal.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { ordinal } from '#lib/utils.js'
	import TeamCell from '#ui/data-table/cells/team-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import Header from '#ui/header.svelte'
	import Metadata from '#ui/metadata.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import SelectGameType from '#ui/select-game-type.svelte'
	import SelectSport from '#ui/select-sport.svelte'
	import SelectMonth from '#ui/stats/select-month.svelte'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageData, PageProps } from './$types'
	import { ABBREVIATIONS, type StatGroup } from './rank'

	let { data }: PageProps = $props()

	type StatTable = PageData['hitting']
	type StatRow = StatTable['rows'][number]

	/** Sorting reloads the page (ranks are worked out in `load`), so each header links to its sort. */
	function columnsFor({ group, sortStat, stats }: StatTable): DataTableColumn<StatRow>[] {
		return [
			{
				id: 'team',
				header: 'Team',
				sortable: false,
				sticky: true,
				rowHeader: true,
				cell: teamCell,
				class: 'min-w-[18ch] md:w-[1%] md:min-w-[30ch]',
			},
			{
				id: 'league',
				header: 'Lg',
				title: 'Rank within its own league, by the sorted stat',
				sortable: false,
				align: 'center',
				cell: leagueRankCell,
				cellClass: 'text-xs whitespace-nowrap text-current/50',
				class: 'w-[6ch]',
			},
			...stats.map((stat): DataTableColumn<StatRow> => {
				const { short, full } = labelFor(stat)
				const allowed = group === 'pitching' && ['runs', 'homeRuns'].includes(stat)

				return {
					id: stat,
					header: short,
					title: `${full}${allowed ? ' allowed' : ''}`,
					value: (row) => row.stat[stat],
					numeric: true,
					cellClass: (row) => tone(group, stat, row.stat[stat]),
				}
			}),
		]
	}

	const GROUPS = [
		{ id: 'hitting', label: 'Hitting' },
		{ id: 'pitching', label: 'Pitching' },
	] as const satisfies { id: StatGroup; label: string }[]

	/** Kept in `?group=` so a shared link opens the same table. */
	const group = $derived<StatGroup>(
		currentUrl().searchParams.get('group') === 'pitching' ? 'pitching' : 'hitting',
	)

	let period = $derived(
		data.month ? `${monthName(data.month)} ${page.params.season}` : page.params.season,
	)

	function labelFor(stat: string) {
		const meta = data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat))

		return {
			short: ABBREVIATIONS[stat] ?? meta?.lookupParam ?? stat,
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
		const url = new URL(currentUrl().href)
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
					goto(`/team-stats/${(e.currentTarget as HTMLSelectElement).value}${currentUrl().search}`)}
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
	<PillSwitcher
		id="team-stats-group"
		aria-label="Stat group"
		options={GROUPS}
		value={group}
		controls="team-stats-table"
		onchange={(next) => setViewParam('group', next, 'hitting')}
	/>

	{@render statTable(data[group])}
</section>

{#snippet statTable(table: StatTable)}
	{@const { group, param, sortStat, rows, unavailable } = table}
	<DataTable
		id="team-stats-table"
		role="tabpanel"
		aria-labelledby="team-stats-group-tab-{group}"
		label="{period} team {group}"
		data={rows}
		columns={columnsFor(table)}
		getRowId={(row) => String(row.team.id)}
		sorting={[{ id: sortStat, desc: !LOWER_IS_BETTER[group]?.has(sortStat) }]}
		sortHref={(stat) => withParam(param, stat)}
	>
		{#snippet empty()}
			<Empty>
				{unavailable ? `Couldn't load ${group} stats` : `No ${group} stats`}
			</Empty>
		{/snippet}
	</DataTable>
{/snippet}

{#snippet teamCell({ row }: CellArgs<StatRow>)}
	<TeamCell team={row.team} lead={row.rank} />
{/snippet}

{#snippet leagueRankCell({ row: { league, leagueRank } }: CellArgs<StatRow>)}
	{#if league}
		<abbr title="{ordinal(leagueRank)} in the {league} by {labelFor(data[group].sortStat).full}">
			{league}
			{leagueRank}
		</abbr>
	{:else}
		-
	{/if}
{/snippet}
