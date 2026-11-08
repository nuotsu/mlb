<!--
	@component
	A KBO game's box score: each side's batting and pitching lines, or a scorecard of its results by
	inning, on the same tables as the MLB box score, sortable by any stat as it is.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/kbo-game-mlb.js'
	import {
		kboScorecard,
		translatePositions,
		translateResult,
		type KboBatterLine,
		type KboGame,
		type KboPitcherLine,
		type KboPlayerRef,
		type KboScorecardCell,
		type KboSide,
	} from '#lib/kbo-game.js'
	import type { ScorecardKind } from '#lib/scorecard.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn, ordinal } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import ScorecardDiamond from '#ui/game/scorecard-diamond.svelte'
	import { ArrowDownRightIcon } from '#ui/icons/index.js'
	import NpbPhoto from '#ui/npb-game/photo.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import StyledTeam from '#ui/team/styled-team.svelte'
	import Player from './player.svelte'

	let { game, class: className }: { game: KboGame; class?: string } = $props()

	const VIEWS = [
		{ id: 'boxscore', label: 'Boxscore' },
		{ id: 'scorecard', label: 'Scorecard' },
	] as const

	type View = (typeof VIEWS)[number]['id']

	/** Kept in `?view=` so a shared link opens the same tab, as on the MLB game page */
	const view = $derived<View>(
		currentUrl().searchParams.get('view') === 'scorecard' ? 'scorecard' : 'boxscore',
	)

	/**
	 * Sorted by a stat (kept in `?batting=` or `?pitching=`, shared by both teams' tables, as on the
	 * MLB box score), so a substitute no longer sits under the player they came in for
	 */
	const isSorted = (group: 'batting' | 'pitching') =>
		view === 'boxscore' && !!currentUrl().searchParams.get(group)

	type BatterRow = KboBatterLine & {
		/** Scorecard boxes by inning */
		cells: KboScorecardCell[][]
	}

	const rows = $derived(
		Object.fromEntries(
			(['away', 'home'] as const).map((side) => {
				const lines = game.box?.teams[side].batters ?? []
				const cells = game.box ? kboScorecard(game.box, side) : []
				return [side, lines.map((line, i): BatterRow => ({ ...line, cells: cells[i] ?? [] }))]
			}),
		) as Record<KboSide, BatterRow[]>,
	)

	const innings = $derived(Math.max(9, game.box?.innings ?? 0))

	/** Boxes per inning: more than one when the order bats around */
	const boxesPerInning = $derived(
		Array.from({ length: innings }, (_, i) =>
			Math.max(
				1,
				...Object.values(rows).flatMap((lines) => lines.map((b) => b.cells[i]?.length ?? 0)),
			),
		),
	)

	function stat<T>(
		id: string,
		header: string,
		title: string,
		read: (row: T) => number | string | null,
	): DataTableColumn<T> {
		return {
			id,
			header,
			title,
			value: (row) => read(row),
			numeric: true,
			format: (value) => String(value ?? ''),
			cellClass: (row) => {
				const value = read(row)
				return ['font-sans', value !== '0.0' && Number(value) === 0 && 'text-current/40']
			},
			class: 'min-w-[3rch] px-[.25ch] text-center last:pr-[1rch]',
		}
	}

	/**
	 * As in the MLB box score: only the headshot stays put while the stats scroll sideways, and
	 * a substitute is indented under the player they came in for
	 */
	function avatarColumn<T>(
		cell: DataTableColumn<T>['cell'],
		substitute?: (row: T) => boolean,
	): DataTableColumn<T> {
		return {
			id: 'avatar',
			header: '',
			title: 'Headshot',
			sortable: false,
			sticky: true,
			cell,
			// sticks 1lh further left, so once stuck its nudged headshot lines up with the others
			cellClass: (row) => substitute?.(row) && 'left-[-1lh]',
			class: 'w-lh min-w-lh px-0',
		}
	}

	function nameColumn<T>(cell: DataTableColumn<T>['cell'], title: string): DataTableColumn<T> {
		return {
			id: 'player',
			header: '',
			title,
			sortable: false,
			rowHeader: true,
			cell,
			class: 'min-w-[14ch] pl-ch',
		}
	}

	const batterColumns = $derived([
		avatarColumn<BatterRow>(batterAvatarCell, (row) => row.substitute && !isSorted('batting')),
		nameColumn<BatterRow>(batterCell, 'Player'),
	])

	const battingColumns = $derived<DataTableColumn<BatterRow>[]>([
		...batterColumns,
		stat('atBats', 'AB', 'At bats', (row) => row.atBats),
		stat('runs', 'R', 'Runs', (row) => row.runs),
		stat('hits', 'H', 'Hits', (row) => row.hits),
		stat('rbi', 'RBI', 'Runs batted in', (row) => row.rbi),
		stat('avg', 'AVG', 'Batting average this season', (row) => row.avg),
	])

	const scorecardColumns = $derived<DataTableColumn<BatterRow>[]>([
		...batterColumns,
		...Array.from({ length: innings }, (_, i): DataTableColumn<BatterRow> => ({
			id: `inning-${i + 1}`,
			header: String(i + 1),
			title: `${ordinal(i + 1)} inning`,
			sortable: false,
			cell: scorebookCell,
			align: 'center',
			class: 'inning-start p-0',
		})),
	])

	const pitchingColumns: DataTableColumn<KboPitcherLine>[] = [
		avatarColumn<KboPitcherLine>(pitcherAvatarCell),
		nameColumn<KboPitcherLine>(pitcherCell, 'Pitcher'),
		stat('inningsPitched', 'IP', 'Innings pitched', (row) => row.inningsPitched),
		stat('pitches', 'P', 'Pitches', (row) => row.pitches),
		stat('battersFaced', 'BF', 'Batters faced', (row) => row.battersFaced),
		stat('hits', 'H', 'Hits allowed', (row) => row.hits),
		stat('runs', 'R', 'Runs allowed', (row) => row.runs),
		stat('earnedRuns', 'ER', 'Earned runs', (row) => row.earnedRuns),
		stat('homeRuns', 'HR', 'Home runs allowed', (row) => row.homeRuns),
		stat('baseOnBalls', 'BB', 'Walks and hit batters', (row) => row.baseOnBalls),
		stat('strikeOuts', 'K', 'Strikeouts', (row) => row.strikeOuts),
		stat('era', 'ERA', 'Earned run average this season', (row) => row.era),
	]

	/*
	 * The MLB scorecard's colors: red for an out, and strikeouts and walks in their own colors
	 * (yellow strike, green ball). The box score doesn't say who drove in which run.
	 */
	const COLORS: Record<ScorecardKind, string> = {
		hit: 'text-foreground',
		homeRun: 'font-bold text-blue-700 dark:text-blue-300',
		walk: 'text-green-700 dark:text-accent',
		strikeout: 'text-yellow-700 dark:text-yellow-300',
		error: 'text-current/60',
		fieldersChoice: 'text-current/60',
		out: 'text-red-600 dark:text-red-400',
		runner: 'text-current/60',
		other: 'text-current/60',
	}

	const cellTitle = (cell: KboScorecardCell, inning: number) =>
		`${ordinal(inning)} inning: ${translateResult(cell.resultKo)} (${cell.resultKo})`
</script>

<div id="boxscore" class={cn('min-w-0', className)}>
	{#if game.box}
		<PillSwitcher
			id="boxscore"
			aria-label="Lineup view"
			class="mb-[.5lh]"
			options={VIEWS}
			value={view}
			controls="boxscore-lineup-away boxscore-lineup-home"
			onchange={(next) => setViewParam('view', next, 'boxscore')}
		/>

		<article
			class="grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2 sm:px-ch"
		>
			{@render team('away')}
			{@render team('home')}
		</article>
	{:else}
		<Empty class="text-center">No box score yet</Empty>
	{/if}
</div>

{#snippet team(side: KboSide)}
	{@const mlbTeam = toMlbTeam(game.teams[side].id, game.teams[side].nameKo)}
	<article class="snap-center bg-background">
		<StyledTeam team={mlbTeam} class="z-1 pr-ch" linked />

		<div id="boxscore-lineup-{side}" role="tabpanel" aria-labelledby="boxscore-tab-{view}">
			<DataTable
				class={view === 'scorecard' ? 'kbo-scorecard' : undefined}
				label="{mlbTeam.name} {view === 'scorecard' ? 'scorecard' : 'batting'}"
				data={rows[side]}
				columns={view === 'scorecard' ? scorecardColumns : battingColumns}
				getRowId={(row) => `${row.order}-${row.player.nameKo}-${row.positionsKo.join('')}`}
				sortable={view === 'boxscore'}
				sortParam={view === 'boxscore' ? 'batting' : undefined}
				tableClass="w-full"
				stickyHeader={false}
			/>
		</div>

		<hr class="my-[.5ch] border-dashed border-current/25" />

		<DataTable
			label="{mlbTeam.name} pitching"
			data={game.box?.teams[side].pitchers ?? []}
			columns={pitchingColumns}
			getRowId={(row) => row.player.nameKo}
			sortable
			sortParam="pitching"
			tableClass="w-full"
			stickyHeader={false}
		/>
	</article>
{/snippet}

{#snippet avatar(ref: KboPlayerRef, pitcher = false, substitute = false)}
	<!-- The name's link is the one in the tab order; this one is just a bigger target -->
	<Player player={ref} {pitcher} class="relative block hover:no-underline" tabindex={-1}>
		{#if substitute}
			<!-- In the headshot's place, with the headshot nudged aside, so the column doesn't widen -->
			<ArrowDownRightIcon class="absolute inset-y-0 left-0 my-auto size-ch text-current/40" />
		{/if}

		<NpbPhoto
			src={ref.id ? game.photos[ref.id] : null}
			class={cn('size-lh', substitute && 'translate-x-lh')}
		/>
	</Player>
{/snippet}

{#snippet player(ref: KboPlayerRef, label: string, pitcher = false, substitute = false)}
	<span class={cn('group/player flex items-center gap-[.5ch] text-left', substitute && 'pl-lh')}>
		<Player
			player={ref}
			{pitcher}
			class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline"
		/>

		{#if label}
			<small class="min-w-[3ch] shrink-0 text-center text-xs whitespace-nowrap text-current/40">
				{label}
			</small>
		{/if}
	</span>
{/snippet}

{#snippet batterAvatarCell({ row }: CellArgs<BatterRow>)}
	{@render avatar(row.player, false, row.substitute && !isSorted('batting'))}
{/snippet}

{#snippet pitcherAvatarCell({ row }: CellArgs<KboPitcherLine>)}
	{@render avatar(row.player, true)}
{/snippet}

{#snippet batterCell({ row }: CellArgs<BatterRow>)}
	{@render player(
		row.player,
		translatePositions(row.positionsKo),
		false,
		row.substitute && !isSorted('batting'),
	)}
{/snippet}

{#snippet pitcherCell({ row }: CellArgs<KboPitcherLine>)}
	{@render player(row.player, row.decision ?? '', true)}
{/snippet}

{#snippet scorebookCell({ row, columnId }: CellArgs<BatterRow>)}
	{@const inning = Number(columnId.replace('inning-', ''))}
	{@const cells = row.cells[inning - 1] ?? []}
	<div class="flex">
		{#each { length: boxesPerInning[inning - 1] ?? 1 }, i (i)}
			{@const cell = cells[i]}
			<div class="box">
				{#if cell}
					<span
						class={cn('relative grid size-full place-items-center', COLORS[cell.kind])}
						title={cellTitle(cell, inning)}
						role="img"
						aria-label={cellTitle(cell, inning)}
					>
						<ScorecardDiamond {cell} />

						<span class="relative text-[0.6875rem] leading-none" aria-hidden="true">
							{cell.label}
						</span>

						{#if cell.out}
							<span
								class="absolute top-0.5 left-1 text-[0.625rem] leading-none font-semibold text-red-600 dark:text-red-400"
								aria-hidden="true"
							>
								{cell.out}
							</span>
						{/if}

						{#if cell.badge}
							<span
								class="absolute bottom-0 left-0.5 text-[0.5rem] leading-tight font-bold tracking-tight"
								aria-hidden="true"
							>
								{cell.badge}
							</span>
						{/if}
					</span>
				{:else}
					<div
						class="relative grid size-full place-items-center text-current/15"
						aria-hidden="true"
					>
						<ScorecardDiamond />
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

<style>
	/* A box per plate appearance, as on the MLB scorecard */
	.box {
		width: 2.5rem;
		height: 2rem;
		font-variant-numeric: tabular-nums;
	}

	/* A hairline between innings, but not between an inning's own boxes */
	:global(.kbo-scorecard .inning-start) {
		border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
	}
</style>
