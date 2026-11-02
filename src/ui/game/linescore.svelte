<script lang="ts">
	import { fetchLiveMLB } from '#lib/fetch/live.svelte.js'
	import { ordinal } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'

	let {
		linescore,
		game,
		poll = true,
	}: {
		linescore?: MLB.Linescore
		game: MLB.Game
		/** Keep a live game's linescore fresh. Off when the caller already has the moment to show. */
		poll?: boolean
	} = $props()

	const isLive = $derived(game?.status.abstractGameState === 'Live')

	let { data } = $derived(
		isLive && poll
			? fetchLiveMLB<MLB.Linescore>(`/api/v1/game/${game.gamePk}/linescore`, {
					fields: [
						'currentInning,scheduledInnings,inningState',
						'innings,num,runs,hits,errors,leftOnBase',
						'teams,away,home',
					],
				})
			: { data: linescore },
	)

	let innings = $derived(data?.innings ?? [])
	let currentInning = $derived(data?.currentInning)

	const remainingInnings = $derived.by(() =>
		Array.from(
			{ length: (data?.scheduledInnings ?? 0) - innings.length },
			(_, i) => i + innings.length + 1,
		),
	)

	type Side = 'away' | 'home'

	/** Rows are objects, as the table needs */
	const SIDES = [{ side: 'away' }, { side: 'home' }] as const satisfies { side: Side }[]
	type SideRow = (typeof SIDES)[number]

	const team = (side: Side) => (data?.teams?.[side] ?? {}) as Partial<MLB.LinescoreTeam>

	function isCurrent(num: number, teamKey: Side) {
		return (
			isLive &&
			num === currentInning &&
			((teamKey === 'away' && data?.inningState === 'Top') ||
				(teamKey === 'home' && data?.inningState === 'Bottom'))
		)
	}

	/** Every scheduled inning, played or not, then the totals */
	const columns = $derived<DataTableColumn<SideRow>[]>([
		...[...innings.map(({ num }) => num), ...remainingInnings].map(
			(num): DataTableColumn<SideRow> => ({
				id: String(num),
				header: String(num),
				title: `${ordinal(num)} inning`,
				align: 'center',
				cell: inningCell,
				cellClass: ({ side: teamKey }) => {
					const inning = innings.find((inning) => inning.num === num)
					const runs = inning?.[teamKey]?.runs
					const bye = num === currentInning && teamKey === 'home' && runs === undefined
					return [
						'overflow-clip border-foreground/10 tabular-nums nth-[3n+4]:border-l',
						inning && (runs === 0 || bye) && 'text-current/40',
						isCurrent(num, teamKey) &&
							'bg-foreground/10 group-has-data-scoring/game:animate-pulse group-has-data-scoring/game:text-accent',
					]
				},
				class: 'min-w-[3ch] px-0',
			}),
		),
		{
			id: 'runs',
			header: 'R',
			title: 'Runs',
			value: ({ side }) => team(side).runs,
			align: 'center',
			cellClass: 'border-l border-foreground/25 font-bold tabular-nums',
			class: 'w-[4ch] px-0',
		},
		{
			id: 'hits',
			header: 'H',
			title: 'Hits',
			value: ({ side }) => team(side).hits,
			align: 'center',
			cellClass: 'tabular-nums',
			class: 'w-[4ch] px-0',
		},
		{
			id: 'errors',
			header: 'E',
			title: 'Errors',
			value: ({ side }) => team(side).errors,
			align: 'center',
			cellClass: 'tabular-nums',
			class: 'w-[4ch] px-0',
		},
		{
			id: 'lob',
			header: 'LOB',
			title: 'Left on base',
			value: ({ side }) => team(side).leftOnBase,
			align: 'center',
			cellClass: 'tabular-nums',
			class: 'w-[4ch] px-0',
		},
	])
</script>

<DataTable
	class="no-scrollbar"
	style="grid-area: linescore"
	label="Linescore"
	data={SIDES}
	{columns}
	getRowId={(row) => row.side}
	sortable={false}
	stickyHeader={false}
	tableClass="table-fixed text-center"
/>

{#snippet inningCell({ row: { side: teamKey }, columnId }: CellArgs<SideRow>)}
	{@const num = Number(columnId)}
	{@const inning = innings.find((inning) => inning.num === num)}
	{#if inning}
		{@const runs = inning[teamKey]?.runs}
		{#if game?.status.abstractGameState === 'Final' && num === currentInning && teamKey === 'home' && runs === undefined}
			X
		{:else if isCurrent(num, teamKey)}
			{#key runs}
				<span class="inline-block anim-fade-to-t">{runs}</span>
			{/key}
		{:else}
			{runs}
		{/if}
	{/if}
{/snippet}
