<!--
	@component
	An NPB game's box score: each side's batting and pitching lines, or a scorecard of npb.jp's
	scorebook entries by inning, on the same tables as the MLB box score, sortable by any stat as it is.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/npb-game-mlb.js'
	import {
		npbPlayerUrl,
		npbScorecard,
		translatePlay,
		translatePositions,
		type NpbBatterLine,
		type NpbGame,
		type NpbLang,
		type NpbPitcherLine,
		type NpbPlayerRef,
		type NpbScorecardCell,
		type NpbSide,
	} from '#lib/npb-game.js'
	import type { NpbGamePlayerName } from '#lib/npb-game.js'
	import type { ScorecardKind } from '#lib/scorecard.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn, ordinal } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import ScorecardDiamond from '#ui/game/scorecard-diamond.svelte'
	import { ArrowDownRightIcon } from '#ui/icons/index.js'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import StyledTeam from '#ui/team/styled-team.svelte'
	import { playerName } from './names.js'
	import NpbPhoto from './photo.svelte'

	let {
		game,
		names,
		lang,
		class: className,
	}: {
		game: NpbGame
		names: Record<string, NpbGamePlayerName>
		lang: NpbLang
		class?: string
	} = $props()

	const ja = $derived(lang === 'ja')

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

	type BatterRow = NpbBatterLine & {
		substitute: boolean
		/** Scorecard boxes by inning */
		cells: NpbScorecardCell[][]
	}

	const rows = $derived(
		Object.fromEntries(
			(['away', 'home'] as const).map((side) => {
				const lines = game.box?.[side].batters ?? []
				const cells = npbScorecard(lines, game.plays, side)
				return [
					side,
					lines.map((line, i): BatterRow => ({
						...line,
						substitute: line.order === null,
						cells: cells[i],
					})),
				]
			}),
		) as Record<NpbSide, BatterRow[]>,
	)

	const innings = $derived(
		Math.max(9, ...Object.values(rows).flatMap((lines) => lines.map((b) => b.innings.length))),
	)

	/** Boxes per inning: more than one when the order bats around */
	const boxesPerInning = $derived(
		Array.from({ length: innings }, (_, i) =>
			Math.max(
				1,
				...Object.values(rows).flatMap((lines) => lines.map((b) => b.cells[i]?.length ?? 0)),
			),
		),
	)

	function positions(positionsJa: string[]) {
		return ja ? positionsJa.join('') : translatePositions(positionsJa)
	}

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
		nameColumn<BatterRow>(batterCell, ja ? '選手' : 'Player'),
	])

	const battingColumns = $derived<DataTableColumn<BatterRow>[]>([
		...batterColumns,
		stat('atBats', ja ? '打数' : 'AB', 'At bats', (row) => row.atBats),
		stat('hits', ja ? '安打' : 'H', 'Hits', (row) => row.hits),
		stat('runs', ja ? '得点' : 'R', 'Runs', (row) => row.runs),
		stat('rbi', ja ? '打点' : 'RBI', 'Runs batted in', (row) => row.rbi),
		stat('stolenBases', ja ? '盗塁' : 'SB', 'Stolen bases', (row) => row.stolenBases),
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

	const pitchingColumns = $derived<DataTableColumn<NpbPitcherLine>[]>([
		avatarColumn<NpbPitcherLine>(pitcherAvatarCell),
		nameColumn<NpbPitcherLine>(pitcherCell, ja ? '投手' : 'Pitcher'),
		stat('inningsPitched', ja ? '回' : 'IP', 'Innings pitched', (row) => row.inningsPitched),
		stat('pitches', ja ? '球数' : 'P', 'Pitches', (row) => row.pitches),
		stat('battersFaced', ja ? '打者' : 'BF', 'Batters faced', (row) => row.battersFaced),
		stat('hits', ja ? '安打' : 'H', 'Hits allowed', (row) => row.hits),
		stat('runs', ja ? '失点' : 'R', 'Runs allowed', (row) => row.runs),
		stat('earnedRuns', ja ? '自責' : 'ER', 'Earned runs', (row) => row.earnedRuns),
		stat('homeRuns', ja ? '本塁打' : 'HR', 'Home runs allowed', (row) => row.homeRuns),
		stat('baseOnBalls', ja ? '四球' : 'BB', 'Walks', (row) => row.baseOnBalls),
		stat('hitBatsmen', ja ? '死球' : 'HBP', 'Hit batters', (row) => row.hitBatsmen),
		stat('strikeOuts', ja ? '三振' : 'K', 'Strikeouts', (row) => row.strikeOuts),
	])

	/*
	 * The MLB scorecard's colors: blue for a run batted in, red for an out, and strikeouts and walks
	 * in their own colors (yellow strike, green ball)
	 */
	const COLORS: Record<ScorecardKind, string> = {
		hit: 'text-foreground',
		homeRun: 'font-bold text-blue-700 dark:text-blue-300',
		walk: 'text-green-700 dark:text-accent',
		strikeout: 'text-yellow-700 dark:text-yellow-300',
		error: 'text-current/60',
		fieldersChoice: 'text-current/60',
		out: 'text-current/60',
		runner: 'text-current/60',
		other: 'text-current/60',
	}

	function cellColor(cell: NpbScorecardCell) {
		if (cell.kind === 'walk' || cell.kind === 'strikeout' || cell.kind === 'homeRun') {
			return COLORS[cell.kind]
		}
		if (cell.rbi) return 'text-blue-600 dark:text-blue-400'
		if (cell.kind === 'out') return 'text-red-600 dark:text-red-400'
		return COLORS[cell.kind]
	}

	/** A box's tooltip: the play-by-play's result, else npb.jp's scorebook entry */
	function cellTitle(cell: NpbScorecardCell, inning: number) {
		const result = cell.resultJa
			? ja
				? cell.resultJa
				: translatePlay(cell.resultJa, (p) => playerName(p, names, lang))
			: cell.entryJa
		return `${ja ? `${inning}回` : `${ordinal(inning)} inning`}: ${result}`
	}

	const DECISIONS = { W: '勝', L: '敗', S: 'S', H: 'H' } as const
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

{#snippet team(side: NpbSide)}
	{@const mlbTeam = toMlbTeam(game.teams[side], lang)}
	<article class="snap-center bg-background">
		<StyledTeam team={mlbTeam} class="z-1 pr-ch" linked />

		<div id="boxscore-lineup-{side}" role="tabpanel" aria-labelledby="boxscore-tab-{view}">
			<DataTable
				class={view === 'scorecard' ? 'npb-scorecard' : undefined}
				label="{mlbTeam.name} {view === 'scorecard' ? 'scorecard' : 'batting'}"
				data={rows[side]}
				columns={view === 'scorecard' ? scorecardColumns : battingColumns}
				getRowId={(row) => `${row.player.id ?? row.player.nameJa}-${row.positionsJa.join('')}`}
				sortable={view === 'boxscore'}
				sortParam={view === 'boxscore' ? 'batting' : undefined}
				tableClass="w-full"
				stickyHeader={false}
			/>
		</div>

		<hr class="my-[.5ch] border-dashed border-current/25" />

		<DataTable
			label="{mlbTeam.name} pitching"
			data={game.box?.[side].pitchers ?? []}
			columns={pitchingColumns}
			getRowId={(row) => row.player.id ?? row.player.nameJa}
			sortable
			sortParam="pitching"
			tableClass="w-full"
			stickyHeader={false}
		/>
	</article>
{/snippet}

{#snippet avatar(ref: NpbPlayerRef, substitute = false)}
	<!-- The name's link is the one in the tab order; this one is just a bigger target -->
	<svelte:element
		this={ref.id ? 'a' : 'span'}
		class="relative block"
		href={ref.id ? npbPlayerUrl(ref.id) : undefined}
		target={ref.id ? '_blank' : undefined}
		rel={ref.id ? 'noopener noreferrer' : undefined}
		tabindex="-1"
		aria-hidden="true"
	>
		{#if substitute}
			<!-- In the headshot's place, with the headshot nudged aside, so the column doesn't widen -->
			<ArrowDownRightIcon class="absolute inset-y-0 left-0 my-auto size-ch text-current/40" />
		{/if}

		<NpbPhoto
			src={ref.id ? names[ref.id]?.photo : null}
			class={cn('size-lh', substitute && 'translate-x-lh')}
		/>
	</svelte:element>
{/snippet}

{#snippet player(ref: NpbPlayerRef, label: string, substitute = false)}
	<svelte:element
		this={ref.id ? 'a' : 'span'}
		class={cn('group/player flex items-center gap-[.5ch] text-left', substitute && 'pl-lh')}
		href={ref.id ? npbPlayerUrl(ref.id) : undefined}
		target={ref.id ? '_blank' : undefined}
		rel={ref.id ? 'noopener noreferrer' : undefined}
		title={playerName(ref, names, lang, 'full')}
	>
		<span
			class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline"
			lang={ja || !ref.id || !names[ref.id] ? 'ja' : undefined}
		>
			{playerName(ref, names, lang)}
		</span>

		{#if label}
			<small class="min-w-[3ch] shrink-0 text-center text-xs whitespace-nowrap text-current/40">
				{label}
			</small>
		{/if}
	</svelte:element>
{/snippet}

{#snippet batterAvatarCell({ row }: CellArgs<BatterRow>)}
	{@render avatar(row.player, row.substitute && !isSorted('batting'))}
{/snippet}

{#snippet pitcherAvatarCell({ row }: CellArgs<NpbPitcherLine>)}
	{@render avatar(row.player)}
{/snippet}

{#snippet batterCell({ row }: CellArgs<BatterRow>)}
	{@render player(row.player, positions(row.positionsJa), row.substitute && !isSorted('batting'))}
{/snippet}

{#snippet pitcherCell({ row }: CellArgs<NpbPitcherLine>)}
	{@render player(row.player, row.decision ? (ja ? DECISIONS[row.decision] : row.decision) : '')}
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
						class={cn('relative grid size-full place-items-center', cellColor(cell))}
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

						{#if cell.rbi > 0}
							<span
								class="absolute right-0.5 bottom-0 text-[0.5625rem] leading-tight font-bold"
								aria-hidden="true"
							>
								{cell.rbi}
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
	:global(.npb-scorecard .inning-start) {
		border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
	}
</style>
