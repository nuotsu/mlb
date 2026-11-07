<!--
	@component
	An NPB team's current roster from npb.jp, laid out like the MLB `Roster`: batters, pitchers,
	then the manager (npb.jp lists no coaching staff). Players have no page here, so their names
	link to npb.jp: the Japanese name to the Japanese page, the English name to the English one.
	Developmental (育成) players are tagged; players who have left are dropped.
-->
<script lang="ts">
	import type { NpbRoster, NpbRosterPlayer } from '#lib/npb-roster.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'

	let { roster }: { roster: NpbRoster } = $props()

	const current = $derived(roster.players.filter(({ departed }) => !departed))
	const batters = $derived(current.filter(({ group }) => group !== 'P'))
	const pitchers = $derived(current.filter(({ group }) => group === 'P'))

	/** Around the diamond, then the groups of players with no fielding stats to narrow them */
	const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'IF', 'OF']

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

	const nameJaColumn: DataTableColumn<NpbRosterPlayer> = {
		id: 'nameJa',
		header: '選手',
		title: 'Japanese name',
		value: (row) => row.nameJa,
		cell: nameJaCell,
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
			title: 'Position played most this season',
			value: (row) => row.position,
			sortFn: (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position),
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
		numberColumn,
		nameJaColumn,
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
		nameJaColumn,
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
			{#if roster.manager.nameJa}
				<span class="line-clamp-1 break-all" lang="ja">{roster.manager.nameJa}</span>
			{/if}
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

{#snippet nameJaCell({ row }: CellArgs<NpbRosterPlayer>)}
	<a
		class="group/player flex min-w-0 items-center gap-ch text-left decoration-dashed"
		href="https://npb.jp/bis/players/{row.id}.html"
		target="_blank"
		rel="noopener noreferrer"
		lang="ja"
	>
		<!-- A circle cropped from the top of the 4:5 photo; it stays an empty circle if missing -->
		<img
			class="img-fade block size-lh shrink-0 rounded-full bg-foreground/10 object-cover object-top text-transparent opacity-0 transition-opacity"
			src={row.photo}
			width="144"
			height="180"
			alt=""
			loading="lazy"
			decoding="async"
			draggable="false"
			onload={(e) => e.currentTarget.classList.remove('opacity-0')}
		/>

		<span class="line-clamp-1 grow break-all group-hover/player:underline">
			{row.nameJa ?? ''}
		</span>
	</a>
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
