<script lang="ts">
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Logo from '#ui/team/logo.svelte'

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
			'atBats',
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

		if (key === 'atBats') return { abbr: 'AB', title: label ?? name ?? 'At Bats' }
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

	type SplitRow = { id: string; split: MLB.StatSplit; career?: boolean }

	/** The career line, kept on top whatever the sort, then each season, latest first */
	const tableRows = $derived<SplitRow[]>([
		...(careerSplit ? [{ id: 'career', split: careerSplit, career: true }] : []),
		...seasonRows.map((split) => ({
			id: `${split.season}-${split.team?.id ?? 'none'}`,
			split,
		})),
	])

	const columns = $derived<DataTableColumn<SplitRow>[]>([
		{
			id: 'season',
			header: 'Year',
			title: 'Season',
			value: (row) => row.split.season,
			numeric: true,
			align: 'left',
			sticky: true,
			rowHeader: true,
			cell: seasonCell,
			team: (row) => ({ team: row.career ? undefined : row.split.team }),
			class: 'w-[5ch] min-w-[5ch] px-[.5ch]',
		},
		{
			id: 'team',
			header: '',
			title: 'Team',
			value: (row) => row.split.team?.name,
			sortable: false,
			cell: logoCell,
			team: (row) => ({ team: row.career ? undefined : row.split.team }),
			class: 'w-lh min-w-lh px-0',
		},
		...statKeys[group].map((key): DataTableColumn<SplitRow> => {
			const { abbr, title } = getStatLabel(key)
			return {
				id: key,
				header: abbr.toUpperCase(),
				title,
				value: (row) => row.split.stat[key],
				numeric: true,
				format: (value) => (value == null ? '—' : String(value)),
				cellClass: (row) => valueClass(key, row.split.stat[key]),
				class: borderClass(key),
			}
		}),
	])

	function borderClass(key: string) {
		return (borderKeys[group] as readonly string[]).includes(key)
			? 'border-r border-r-current/25'
			: ''
	}
</script>

{#if hasStats}
	<DataTable
		label="{group} by season"
		data={tableRows}
		{columns}
		getRowId={(row) => row.id}
		pinnedTop={(row) => !!row.career}
		sortParam="splits"
		rowClass={(row) => row.career && '*:border-b *:border-dashed *:border-b-(--color-stroke)'}
	/>
{/if}

{#snippet seasonCell({ row }: CellArgs<SplitRow>)}
	{row.career ? 'Career' : row.split.season}
{/snippet}

{#snippet logoCell({ row: { split } }: CellArgs<SplitRow>)}
	{#if split.team}
		<a class="block" href="/teams/{split.team.id}" aria-label={split.team.name}>
			<Logo
				class="mx-auto size-lh object-contain"
				team={split.team}
				loading="lazy"
				decoding="async"
			/>
		</a>
	{/if}
{/snippet}
