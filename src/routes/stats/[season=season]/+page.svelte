<script lang="ts">
	import { LOWER_IS_BETTER } from '#lib/stats.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import Header from '#ui/header.svelte'
	import Loading from '#ui/loading.svelte'
	import Metadata from '#ui/metadata.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import SelectGameType from '#ui/select-game-type.svelte'
	import SelectSport from '#ui/select-sport.svelte'
	import LongestHomeRuns from '#ui/stats/longest-home-runs.svelte'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let position = $derived(page.url.searchParams.get('position'))

	let positionPlayers = $derived(
		data.positions.filter(
			(p) => p.gamePosition && !p.pitcher && !['PH', 'PR', 'EH'].includes(p.abbrev),
		),
	)

	const GROUPS = [
		{ id: 'hitting', label: 'Hitting' },
		{ id: 'pitching', label: 'Pitching' },
		{ id: 'longest-home-runs', label: 'Longest HRs' },
	] as const

	// Statcast, where the longest home runs come from, only covers MLB
	const groups = $derived(
		(page.url.searchParams.get('sportId') ?? '1') === '1'
			? GROUPS
			: GROUPS.filter(({ id }) => id !== 'longest-home-runs'),
	)

	/** Kept in `?group=` so a shared link opens the same leaders. */
	const group = $derived.by(() => {
		const requested = currentUrl().searchParams.get('group')
		return groups.find(({ id }) => id === requested)?.id ?? 'hitting'
	})

	let hittingSortStat = $derived(page.url.searchParams.get('hittingSortStat') ?? 'homeRuns')
	let pitchingSortStat = $derived(page.url.searchParams.get('pitchingSortStat') ?? 'era')

	const HITTING_STATS = [
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
	]
	const PITCHING_STATS = ['era', 'wins', 'losses', 'saves', 'strikeOuts', 'whip', 'inningsPitched']

	/** Hairlines after these, grouping related stats */
	const DIVIDERS = new Set(['rbi', 'triples', 'stolenBases', 'era', 'saves', 'strikeOuts'])

	const SHORT: Record<string, string> = { doubles: '2B', triples: '3B', strikeOuts: 'K' }

	/** Good numbers, the same thresholds the team stats use */
	function tone(stat: string, value: unknown) {
		const n = Number(value)
		return (stat === 'avg' && n >= 0.3) ||
			(stat === 'ops' && n >= 1) ||
			(stat === 'era' && n < 3) ||
			(stat === 'whip' && n < 1)
			? 'positive'
			: undefined
	}

	function leaderColumns(group: 'hitting' | 'pitching', stats: string[]) {
		return [
			{
				id: 'rank',
				header: '#',
				title: 'Rank',
				sortable: false,
				align: 'center',
				cell: rankCell,
				class: 'w-[4ch]',
			},
			{
				id: 'player',
				header: group === 'hitting' ? positionSelect : 'Player',
				title: 'Player',
				sortable: false,
				sticky: true,
				rowHeader: true,
				cell: playerCell,
				team: ({ team, sport }) => ({ team, sport }),
				class: 'min-w-[17ch]',
			},
			{
				id: 'league',
				header: 'Lg',
				title: 'League',
				sortable: false,
				value: (split) => split.league?.name,
				cellClass: 'text-xs text-current/40',
			},
			...stats.map((stat): DataTableColumn<MLB.StatSplit> => {
				const { label, name, lookupParam } =
					data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}

				return {
					id: stat,
					header: (SHORT[stat] ?? lookupParam ?? stat).toUpperCase(),
					title: label ?? name,
					value: (split) => split.stat[stat],
					numeric: true,
					class: DIVIDERS.has(stat) && 'border-r border-current/25',
					cellClass: (split) => tone(stat, split.stat[stat]),
				}
			}),
		] satisfies DataTableColumn<MLB.StatSplit>[]
	}

	const hittingColumns = $derived(leaderColumns('hitting', HITTING_STATS))
	const pitchingColumns = $derived(leaderColumns('pitching', PITCHING_STATS))

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
		name: `${page.params.season} MLB Hitting Leaders`,
		url: `https://mlb.theohtani.com/stats/${page.params.season}`,
		itemListElement:
			data.hittingLeaders?.stats?.[0]?.splits?.map(({ rank, player, stat }) => ({
				'@type': 'ListItem',
				position: rank,
				item: {
					'@type': 'Person',
					name: player?.lastName ?? '',
					url: player?.id ? `https://mlb.theohtani.com/player/${player.id}` : undefined,
					description: `HR: ${stat?.homeRuns}, AVG: ${stat?.avg}, RBI: ${stat?.rbi}`,
				},
			})) ?? [],
	})}<\/script>`}

	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: `${page.params.season} MLB Pitching Leaders`,
		url: `https://mlb.theohtani.com/stats/${page.params.season}`,
		itemListElement:
			data.pitchingLeaders?.stats?.[0]?.splits?.map(({ rank, player, stat }) => ({
				'@type': 'ListItem',
				position: rank,
				item: {
					'@type': 'Person',
					name: player?.lastName ?? '',
					url: player?.id ? `https://mlb.theohtani.com/player/${player.id}` : undefined,
					description: `ERA: ${stat?.era}, W: ${stat?.wins}, K: ${stat?.strikeOuts}`,
				},
			})) ?? [],
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{page.params.season} Stat Leaders | MLB.TheOhtani.com"
	description="MLB statistical leaders for the {page.params.season} season"
/>

<Header
	title="Stat Leaders"
	crumbs={[
		{ href: '/stats', name: 'Stat Leaders' },
		position ? { href: page.url.pathname, name: position } : {},
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
					goto(`/stats/${(e.currentTarget as HTMLSelectElement).value}${currentUrl().search}`)}
			/>
		</div>
	{/snippet}
</Header>

<section class="space-y-lh py-lh md:px-ch">
	<PillSwitcher
		id="stats-group"
		aria-label="Stat group"
		options={groups}
		value={group}
		controls="stats-leaders"
		onchange={(next) => setViewParam('group', next, 'hitting')}
	/>

	<div id="stats-leaders" role="tabpanel" aria-labelledby="stats-group-tab-{group}">
		{#if group === 'hitting' || group === 'pitching'}
			{@const leaders = group === 'hitting' ? data.hittingLeaders : data.pitchingLeaders}
			{@const sortStat = group === 'hitting' ? hittingSortStat : pitchingSortStat}
			<DataTable
				label="{page.params.season} {group} leaders"
				data={leaders?.stats?.flatMap(({ splits }) => splits) ?? []}
				columns={group === 'hitting' ? hittingColumns : pitchingColumns}
				getRowId={(split, i) => `${split.player?.id ?? i}-${split.team?.id ?? ''}`}
				sorting={[{ id: sortStat, desc: !LOWER_IS_BETTER[group]?.has(sortStat) }]}
				sortHref={(stat) => withParam(`${group}SortStat`, stat)}
			>
				{#snippet empty()}
					<Empty>No {group} stats</Empty>
				{/snippet}
			</DataTable>
		{:else}
			{#await data.longestHomeRuns}
				<Loading class="w-full justify-center p-lh text-current/40">Loading longest HRs...</Loading>
			{:then longestHomeRuns}
				<LongestHomeRuns homeRuns={longestHomeRuns} />
			{/await}
		{/if}
	</div>
</section>

{#snippet rankCell({ row }: CellArgs<MLB.StatSplit>)}
	<span class="text-xs text-current/50">{row.rank}</span>
{/snippet}

{#snippet playerCell({ row: { player, position } }: CellArgs<MLB.StatSplit>)}
	{#if player}
		<PlayerCell person={player} type="silo" nameClass="w-[10ch]">
			<small class="w-[3ch] shrink-0 text-center text-xs opacity-50">
				{position?.abbreviation}
			</small>
		</PlayerCell>
	{/if}
{/snippet}

{#snippet positionSelect()}
	<select
		class="button w-full text-center hover:bg-current/10"
		aria-label="Position"
		value={position ?? ''}
		onchange={(e) => {
			const { value } = e.target as HTMLSelectElement
			goto(withParam('position', value))
		}}
	>
		<option value="">All positions</option>
		{#each positionPlayers as { abbrev, formalName } (abbrev)}
			<option value={abbrev}>{abbrev} — {formalName}</option>
		{/each}
	</select>
{/snippet}
