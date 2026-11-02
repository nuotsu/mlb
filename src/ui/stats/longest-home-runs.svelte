<script lang="ts">
	import type { LongestHomeRun } from '#lib/fetch/savant.js'
	import { formatDate } from '#lib/temporal.js'
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'

	let { homeRuns }: { homeRuns: LongestHomeRun[] | null } = $props()

	const columns: DataTableColumn<LongestHomeRun>[] = [
		{
			id: 'rank',
			header: '#',
			title: 'Rank by distance',
			sortable: false,
			align: 'center',
			value: (hr) => hr.rank,
			cellClass: 'text-xs text-current/50',
			class: 'w-[4ch]',
		},
		{
			id: 'batter',
			header: 'Batter',
			value: (hr) => hr.batter.lastName ?? hr.batter.fullName,
			sticky: true,
			rowHeader: true,
			cell: batterCell,
			team: (hr) => ({ team: hr.team }),
			class: 'min-w-[18ch]',
		},
		{
			id: 'dist',
			header: 'Dist',
			title: 'Projected distance (ft)',
			value: (hr) => hr.distance,
			numeric: true,
			format: (value) => String(Math.round(Number(value))),
			cellClass: (hr) => hr.distance >= 450 && 'positive',
			class: 'w-[7ch]',
		},
		{
			id: 'ev',
			header: 'Velo',
			title: 'Exit velocity (mph)',
			value: (hr) => hr.launchSpeed,
			numeric: true,
			format: (value) => (value == null ? '—' : Number(value).toFixed(1)),
			class: 'w-[7ch] border-l border-current/25',
		},
		{
			id: 'la',
			header: 'LA',
			title: 'Launch angle',
			value: (hr) => hr.launchAngle,
			numeric: true,
			format: (value) => (value == null ? '—' : `${Math.round(Number(value))}°`),
			class: 'w-[6ch] border-r border-current/25',
		},
		{
			id: 'date',
			header: 'Date',
			title: 'Game date',
			value: (hr) => hr.date,
			sortDescFirst: true,
			align: 'center',
			cell: dateCell,
			cellClass: 'text-xs whitespace-nowrap tabular-nums',
			class: 'w-[9ch]',
		},
		{
			id: 'opp',
			header: 'Opp',
			title: 'Opponent',
			value: (hr) => hr.opponent?.abbreviation,
			align: 'center',
			format: (_, hr) => `${hr.isHome ? 'vs' : '@'} ${hr.opponent?.abbreviation ?? ''}`,
			cellClass: 'text-xs whitespace-nowrap text-current/50',
			class: 'w-[8ch]',
		},
		{
			id: 'pitcher',
			header: 'Pitcher',
			value: (hr) => hr.pitcher?.lastName ?? hr.pitcher?.fullName,
			cell: pitcherCell,
			class: 'min-w-[16ch]',
		},
	]
</script>

<DataTable
	label="Longest home runs"
	data={homeRuns ?? []}
	{columns}
	getRowId={(hr) => String(hr.rank)}
	sortParam="hrSort"
	defaultSorting={[{ id: 'dist', desc: true }]}
>
	{#snippet empty()}
		<Empty>
			{homeRuns ? 'No Statcast home runs' : 'Statcast home runs unavailable'}
		</Empty>
	{/snippet}
</DataTable>

{#snippet batterCell({ row: { batter, team } }: CellArgs<LongestHomeRun>)}
	<PlayerCell
		person={batter}
		type="silo"
		name={batter.lastName ?? batter.boxscoreName ?? batter.fullName}
		nameClass="w-[10ch]"
	>
		<small class="w-[4ch] shrink-0 text-center text-xs opacity-50">
			{team?.abbreviation ?? ''}
		</small>
	</PlayerCell>
{/snippet}

{#snippet dateCell({ row: hr }: CellArgs<LongestHomeRun>)}
	{@const date = formatDate(hr.date, { month: 'short', day: 'numeric' })}
	{#if hr.gamePk}
		<a class="decoration-dashed hover:underline" href="/game/{hr.gamePk}">{date}</a>
	{:else}
		{date}
	{/if}
{/snippet}

{#snippet pitcherCell({ row: { pitcher } }: CellArgs<LongestHomeRun>)}
	{#if pitcher?.id}
		<PlayerCell
			person={pitcher}
			name={pitcher.lastName ?? pitcher.boxscoreName ?? pitcher.fullName ?? String(pitcher.id)}
			nameClass="line-clamp-none whitespace-nowrap"
		/>
	{:else}
		—
	{/if}
{/snippet}
