<script lang="ts">
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'

	let { roster, coaches }: { roster: MLB.Roster[]; coaches: MLB.Coach[] } = $props()

	const batters = $derived(roster.filter(({ position }) => position.abbreviation !== 'P'))
	const pitchers = $derived(roster.filter(({ position }) => position.abbreviation === 'P'))

	const name = (person: MLB.Person) => person.lastFirstName ?? person.fullName

	const playerColumns: DataTableColumn<MLB.Roster>[] = [
		{
			id: 'position',
			header: 'Pos',
			title: 'Position',
			value: (row) => row.position.abbreviation,
			align: 'center',
			cellClass: 'text-sm',
			class: 'w-[5ch]',
		},
		{
			id: 'player',
			header: 'Player',
			value: (row) => name(row.person as MLB.Person),
			rowHeader: true,
			cell: playerCell,
		},
		{
			id: 'favorite',
			header: '',
			title: 'Favorite',
			sortable: false,
			align: 'right',
			cell: favoriteCell,
			class: 'w-[4ch]',
		},
	]

	const coachColumns: DataTableColumn<MLB.Coach>[] = [
		{
			id: 'coach',
			header: 'Coach',
			value: (row) => name(row.person as MLB.Person),
			rowHeader: true,
			cell: coachCell,
		},
		{
			id: 'job',
			header: 'Job',
			value: (row) => row.job,
			cellClass: 'text-sm',
		},
	]
</script>

{@render list(batters, 'Batters', 'batters')}
{@render list(pitchers, 'Pitchers', 'pitchers')}

<section id="coaches" class="min-w-0" aria-labelledby="coaches-heading">
	{@render heading('Coaches', 'coaches')}

	<DataTable
		class="sm:px-rch"
		label="Coaches"
		data={coaches}
		columns={coachColumns}
		getRowId={(row, i) => `${row.person.id}-${i}`}
		stickyHeader={false}
		density="compact"
	/>
</section>

{#snippet heading(label: string, id: string)}
	<h3
		id="{id}-heading"
		class="sticky-below-header z-3 mb-ch px-ch text-sm text-current/50 backdrop-blur-xs"
	>
		{label}
	</h3>
{/snippet}

{#snippet list(players: MLB.Roster[], label: string, id: string)}
	<section {id} class="min-w-0" aria-labelledby="{id}-heading">
		{@render heading(label, id)}

		<!-- A–Z by default; both lists share the sort -->
		<DataTable
			class="sm:px-rch"
			{label}
			data={players}
			columns={playerColumns}
			getRowId={(row) => String(row.person.id)}
			sortParam="roster"
			defaultSorting={[{ id: 'player', desc: false }]}
			stickyHeader={false}
			density="compact"
		/>
	</section>
{/snippet}

{#snippet playerCell({ row: { person } }: CellArgs<MLB.Roster>)}
	<PlayerCell {person} name={name(person as MLB.Person)} />
{/snippet}

{#snippet favoriteCell({ row: { person } }: CellArgs<MLB.Roster>)}
	<ToggleFavorite
		class="shrink-0"
		target={{ href: `/player/${person.id}`, label: (person as MLB.Person).lastName! }}
	/>
{/snippet}

{#snippet coachCell({ row: { person } }: CellArgs<MLB.Coach>)}
	<PlayerCell {person} name={name(person as MLB.Person)} />
{/snippet}
