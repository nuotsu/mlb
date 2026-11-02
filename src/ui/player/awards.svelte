<script lang="ts">
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Divider from '#ui/divider.svelte'
	import Logo from '#ui/team/logo.svelte'

	let {
		person,
	}: {
		person: MLB.Person & {
			awards?: MLB.Award[]
		}
	} = $props()

	/** Drops the league from an award ID, so AL and NL versions (`ALMVP`, `NLMVP`) count as one award. */
	const leaguelessId = (id: string) => id.replace(/^(MLBPC|W)?[AN]L/, '$1')

	/** MVP and Cy Young, either league, are highlighted as the most notable awards. */
	const NOTABLE = new Set(['MVP', 'CY'])

	/**
	 * One row per award per season, latest first; repeats in a season (e.g. Player of the Week) are counted.
	 * `nth` is how many times the award (either league) had been won by that row's last win, and `total` across the career.
	 */
	type Row = {
		key: string
		id: string
		name: string
		season?: string
		team?: MLB.Team
		count: number
		nth: number
		total: number
	}

	const columns: DataTableColumn<Row>[] = [
		{
			id: 'season',
			header: 'Season',
			value: (row) => row.season,
			sticky: true,
			rowHeader: true,
			team: (row) => ({ team: row.team }),
			cellClass: 'tabular-nums',
			class: 'w-[5ch] min-w-[5ch] px-[.5ch]',
		},
		{
			id: 'team',
			header: 'Team',
			cell: logoCell,
			team: (row) => ({ team: row.team }),
			class: 'w-lh min-w-lh px-0',
		},
		{
			id: 'count',
			header: 'Count',
			title: 'Times won that season, or which win of the award it was',
			cell: countCell,
			cellClass: (row) => [
				'text-sm tabular-nums',
				NOTABLE.has(leaguelessId(row.id)) ? 'font-bold positive' : 'text-current/50',
			],
			class: 'min-w-[4ch]',
		},
		{
			id: 'award',
			header: 'Award',
			value: (row) => row.name,
			cellClass: (row) => [
				'leading-tight',
				NOTABLE.has(leaguelessId(row.id)) && 'font-bold positive',
			],
		},
	]

	const rows = $derived.by(() => {
		const byKey = new Map<string, Row>()

		const sorted = (person.awards ?? []).toSorted((a, b) =>
			(b.date ?? b.season ?? '').localeCompare(a.date ?? a.season ?? ''),
		)

		for (const { id, name, season, team } of sorted) {
			const key = `${season}-${id}`
			const row = byKey.get(key) ?? {
				key,
				id,
				name,
				season,
				team,
				count: 0,
				nth: 0,
				total: 0,
			}
			row.count++
			byKey.set(key, row)
		}

		const rows = [...byKey.values()]
		const wins = new Map<string, number>()

		for (const row of rows.toReversed()) {
			const id = leaguelessId(row.id)
			row.nth = (wins.get(id) ?? 0) + row.count
			wins.set(id, row.nth)
		}

		for (const row of rows) row.total = wins.get(leaguelessId(row.id))!

		return rows
	})
</script>

{#if rows.length}
	<section id="awards" class="px-ch">
		<Divider>Awards</Divider>

		<!-- In date order: dashed lines between seasons, and every other award shaded to follow a row -->
		<DataTable
			tableClass="mx-auto min-w-0"
			label="Awards"
			data={rows}
			{columns}
			getRowId={(row) => row.key}
			sortable={false}
			hideHeader
			rowClass={(row, i, all) => [
				i > 0 &&
					all[i - 1].season !== row.season &&
					'*:border-t *:border-dashed *:border-t-foreground/30',
				i % 2 && 'shade',
			]}
		/>
	</section>
{/if}

{#snippet logoCell({ row: { team } }: CellArgs<Row>)}
	{#if team}
		<a class="block" href="/teams/{team.id}" aria-label={team.name}>
			<Logo class="mx-auto size-lh object-contain" {team} loading="lazy" decoding="async" />
		</a>
	{/if}
{/snippet}

{#snippet countCell({ row: { count, nth, total } }: CellArgs<Row>)}
	{#if count > 1}
		×{count}
	{:else if total > 1}
		#{nth}
	{/if}
{/snippet}

<style>
	/* Shading only the count and name, so team colors stay as they are */
	:global(tr.shade > :nth-child(n + 3)) {
		background-color: color-mix(in srgb, var(--color-foreground) 5%, transparent);
	}
	:global([data-color-scheme='dark']) :global(tr.shade > :nth-child(n + 3)) {
		background-color: color-mix(in srgb, var(--color-foreground) 8%, transparent);
	}
</style>
