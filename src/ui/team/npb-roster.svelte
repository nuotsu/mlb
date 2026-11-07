<!--
	@component
	An NPB team's current roster from npb.jp, laid out like the MLB `Roster`: batters, pitchers,
	then the manager (npb.jp lists no coaching staff). Players have no page here, so their names
	link to npb.jp. Developmental (育成) players are tagged; players who have left are dropped.
-->
<script lang="ts">
	import type { NpbRoster, NpbRosterPlayer } from '#lib/npb-roster.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'

	let { roster }: { roster: NpbRoster } = $props()

	const current = $derived(roster.players.filter(({ departed }) => !departed))
	const batters = $derived(current.filter(({ position }) => position !== 'P'))
	const pitchers = $derived(current.filter(({ position }) => position === 'P'))

	/** Catchers, then infielders, then outfielders, as npb.jp orders them */
	const POSITION_ORDER = ['C', 'IF', 'OF']

	const numberColumn: DataTableColumn<NpbRosterPlayer> = {
		id: 'number',
		header: '#',
		title: 'Uniform number',
		value: (row) => row.number,
		// By length, then digits: "0" before "00", and developmental "011" after "99"
		sortFn: (a, b) => a.number.length - b.number.length || a.number.localeCompare(b.number),
		align: 'center',
		cellClass: 'text-sm tabular-nums',
		class: 'w-[5ch]',
	}

	const playerColumn: DataTableColumn<NpbRosterPlayer> = {
		id: 'player',
		header: 'Player',
		value: (row) => row.name,
		rowHeader: true,
		cell: playerCell,
	}

	const batterColumns: DataTableColumn<NpbRosterPlayer>[] = [
		{
			id: 'position',
			header: 'Pos',
			title: 'Position',
			value: (row) => row.position,
			sortFn: (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
		numberColumn,
		playerColumn,
		{
			id: 'batsThrows',
			header: 'B/T',
			title: 'Bats / Throws',
			value: (row) => `${row.bats ?? '-'}/${row.throws ?? '-'}`,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
	]

	const pitcherColumns: DataTableColumn<NpbRosterPlayer>[] = [
		numberColumn,
		playerColumn,
		{
			id: 'throws',
			header: 'T',
			title: 'Throws',
			value: (row) => row.throws,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
	]
</script>

<!-- Sorts stay per table: the batters' position column has no pitcher counterpart -->
{@render list(batters, batterColumns, 'Batters', 'batters', [
	{ id: 'position', desc: false },
	{ id: 'number', desc: false },
])}
{@render list(pitchers, pitcherColumns, 'Pitchers', 'pitchers', [{ id: 'number', desc: false }])}

<section id="coaches" class="min-w-0" aria-labelledby="coaches-heading">
	{@render heading('Manager', 'coaches')}

	{#if roster.manager}
		<p class="flex items-center gap-ch px-ch sm:px-rch">
			<span class="w-[5ch] shrink-0 text-center text-sm tabular-nums">{roster.manager.number}</span>
			<span class="line-clamp-1 break-all">{roster.manager.name}</span>
		</p>
	{/if}
</section>

{#snippet heading(label: string, id: string)}
	<h3
		id="{id}-heading"
		class="sticky-below-header z-3 mb-ch px-ch text-sm text-current/50 backdrop-blur-xs"
	>
		{label}
	</h3>
{/snippet}

{#snippet list(
	players: NpbRosterPlayer[],
	columns: DataTableColumn<NpbRosterPlayer>[],
	label: string,
	id: string,
	defaultSorting: { id: string; desc: boolean }[],
)}
	<section {id} class="min-w-0" aria-labelledby="{id}-heading">
		{@render heading(label, id)}

		<DataTable
			class="sm:px-rch"
			{label}
			data={players}
			{columns}
			getRowId={(row) => row.id}
			{defaultSorting}
			stickyHeader={false}
		/>
	</section>
{/snippet}

{#snippet playerCell({ row }: CellArgs<NpbRosterPlayer>)}
	<a
		class="group/player flex min-w-0 items-center gap-ch text-left decoration-dashed"
		href={row.href}
		target="_blank"
		rel="noopener noreferrer"
		title={row.note ?? undefined}
	>
		<span class="line-clamp-1 grow break-all group-hover/player:underline">{row.name}</span>

		{#if row.developmental}
			<abbr class="shrink-0 text-xs text-current/50 no-underline" title="Developmental squad">
				Dev
			</abbr>
		{/if}
	</a>
{/snippet}
