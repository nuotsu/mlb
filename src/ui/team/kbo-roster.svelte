<!--
	@component
	A KBO team's registered (first-team) roster from koreabaseball.com, laid out like the MLB
	`Roster`: batters, pitchers, then the manager and coaches. Players have no page here, so their
	names link to koreabaseball.com. Names are KBO's, in Korean.
-->
<script lang="ts">
	import type { KboRoster, KboRosterPlayer } from '#lib/kbo-roster.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'

	let { roster }: { roster: KboRoster } = $props()

	const batters = $derived(
		roster.players.filter(({ group }) => group === 'C' || group === 'IF' || group === 'OF'),
	)
	const pitchers = $derived(roster.players.filter(({ group }) => group === 'P'))
	const manager = $derived(roster.players.find(({ group }) => group === 'manager'))
	const coaches = $derived(roster.players.filter(({ group }) => group === 'coach'))

	/** Catchers, infielders, then outfielders, as KBO lists them */
	const POSITION_ORDER = ['C', 'IF', 'OF']

	const numberColumn: DataTableColumn<KboRosterPlayer> = {
		id: 'number',
		header: '#',
		title: 'Uniform number',
		value: (row) => row.number,
		// By length, then digits: "0" before "00", and "1" before "10"
		sortFn: (a, b) => a.number.length - b.number.length || a.number.localeCompare(b.number),
		align: 'center',
		cellClass: 'text-sm tabular-nums',
		class: 'w-[5ch]',
	}

	const playerColumn: DataTableColumn<KboRosterPlayer> = {
		id: 'player',
		header: 'Player',
		value: (row) => row.nameKo,
		rowHeader: true,
		cell: playerCell,
	}

	const handColumns: DataTableColumn<KboRosterPlayer>[] = [
		{
			id: 'bats',
			header: 'B',
			title: 'Bats',
			value: (row) => row.bats,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[4ch]',
		},
		{
			id: 'throws',
			header: 'T',
			title: 'Throws',
			value: (row) => row.throws,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[4ch]',
		},
	]

	const ageColumn: DataTableColumn<KboRosterPlayer> = {
		id: 'age',
		header: 'Age',
		title: "Age on the register's day",
		value: (row) => age(row.birthDate),
		numeric: true,
		align: 'center',
		cellClass: 'text-sm tabular-nums',
		class: 'w-[5ch]',
	}

	const batterColumns: DataTableColumn<KboRosterPlayer>[] = [
		{
			id: 'position',
			header: 'Pos',
			title: 'Position group',
			value: (row) => row.group,
			sortFn: (a, b) => POSITION_ORDER.indexOf(a.group) - POSITION_ORDER.indexOf(b.group),
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
		numberColumn,
		playerColumn,
		...handColumns,
		ageColumn,
	]

	const pitcherColumns: DataTableColumn<KboRosterPlayer>[] = [
		numberColumn,
		playerColumn,
		...handColumns,
		ageColumn,
	]

	/** Age on the register's day */
	function age(birthDate: string | null) {
		if (!birthDate) return null
		const [y, m, d] = birthDate.split('-').map(Number)
		const [ry, rm, rd] = roster.date.split('-').map(Number)
		return ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0)
	}
</script>

<!-- Sorts stay per table: the batters' position column has no pitcher counterpart -->
{@render list(batters, batterColumns, 'Batters', 'batters', [
	{ id: 'position', desc: false },
	{ id: 'number', desc: false },
])}
{@render list(pitchers, pitcherColumns, 'Pitchers', 'pitchers', [{ id: 'number', desc: false }])}

<section id="coaches" class="min-w-0" aria-labelledby="coaches-heading">
	{@render heading('Coaching Staff', 'coaches')}

	<ul class="grid">
		{#each [manager, ...coaches].filter((person) => !!person) as person (person.id)}
			<li class="flex items-center gap-ch px-ch sm:px-rch">
				<span class="w-[5ch] shrink-0 text-center text-sm tabular-nums">{person.number}</span>
				<a
					class="line-clamp-1 grow break-all decoration-dashed hover:underline"
					href={person.href}
					target="_blank"
					rel="noopener noreferrer"
					lang="ko">{person.nameKo}</a
				>
				<small class="shrink-0 text-xs text-current/50">
					{person.group === 'manager' ? 'Manager' : 'Coach'}
				</small>
			</li>
		{/each}
	</ul>
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
	players: KboRosterPlayer[],
	columns: DataTableColumn<KboRosterPlayer>[],
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

{#snippet playerCell({ row }: CellArgs<KboRosterPlayer>)}
	<a
		class="group/player flex min-w-0 items-center gap-ch text-left decoration-dashed"
		href={row.href}
		target="_blank"
		rel="noopener noreferrer"
		title={[
			row.batsThrowsKo,
			row.heightCm && `${row.heightCm}cm`,
			row.weightKg && `${row.weightKg}kg`,
		]
			.filter(Boolean)
			.join(', ')}
		lang="ko"
	>
		<!-- A circle cropped from the top of the photo; it stays an empty circle if missing -->
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

		<span class="line-clamp-1 grow break-all group-hover/player:underline">{row.nameKo}</span>
	</a>
{/snippet}
