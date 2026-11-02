<script lang="ts">
	import { formatDate, formatRelativeDays, getToday } from '#lib/temporal.js'
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import type { InjuredPlayer } from './injured-list'

	let {
		players,
		today = getToday(),
	}: {
		players: InjuredPlayer[]
		/** What "in 12d" / "12d ago" is relative to: the list's as-of date */
		today?: Date | string
	} = $props()

	const columns: DataTableColumn<InjuredPlayer>[] = [
		{
			id: 'status',
			header: 'IL',
			title: 'Injured list',
			value: (player) => player.label,
			align: 'center',
			cell: statusCell,
			cellClass: 'text-sm',
			class: 'w-[6ch]',
		},
		{
			id: 'position',
			header: 'Pos',
			title: 'Position',
			value: (player) => player.position.abbreviation,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
		{
			id: 'player',
			header: 'Player',
			value: (player) => player.person.lastFirstName,
			rowHeader: true,
			cell: playerCell,
			// names truncate, so the table fits a phone
			class: 'min-w-[14ch]',
		},
		{
			// Under the name on a phone
			id: 'reason',
			header: 'Reason',
			value: (player) => player.reason,
			cell: reasonCell,
			class: 'max-sm:hidden',
		},
		{
			id: 'return',
			header: 'Exp. Return',
			title: 'Expected return: eligible date, or days on the injured list',
			// day-to-day players have no date, and sort last
			value: (player) => player.eligibleDate,
			align: 'right',
			cell: returnCell,
			cellClass: 'whitespace-nowrap leading-tight',
		},
	]
</script>

<DataTable
	class="sm:px-rch"
	label="Injured list"
	data={players}
	{columns}
	getRowId={(player) => String(player.person.id)}
	tableClass="w-full"
	sortParam="il"
/>

{#snippet statusCell({ row }: CellArgs<InjuredPlayer>)}
	<span title={row.status.description}>{row.label}</span>
{/snippet}

{#snippet playerCell({ row }: CellArgs<InjuredPlayer>)}
	<PlayerCell person={row.person} name={row.person.lastFirstName} />
	{#if row.reason}
		<!-- w-0 min-w-full: as wide as the name, never wider -->
		<small class="line-clamp-1 w-0 min-w-full break-all text-current/70 sm:hidden"
			>{row.reason}</small
		>
	{/if}
{/snippet}

{#snippet reasonCell({ row }: CellArgs<InjuredPlayer>)}
	<small class="line-clamp-1 break-all text-current/70">{row.reason ?? ''}</small>
{/snippet}

{#snippet returnCell({ row }: CellArgs<InjuredPlayer>)}
	{#if row.eligibleDate}
		<small>
			{formatDate(row.eligibleDate, { month: 'short', day: 'numeric' })}
			<!-- under the date on a phone -->
			<span class="text-current/50 tabular-nums max-sm:block"
				>({formatRelativeDays(row.eligibleDate, { from: today })})</span
			>
		</small>
	{:else if row.daysOnIL != null}
		<small>
			{row.label}
			<span class="text-current/50 tabular-nums">({row.daysOnIL}d)</span>
		</small>
	{/if}
{/snippet}
