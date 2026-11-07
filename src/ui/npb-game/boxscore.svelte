<!--
	@component
	An NPB game's box score: each side's batting and pitching lines, or a scorecard of npb.jp's
	scorebook entries by inning, on the same tables as the MLB box score.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/npb-game-mlb.js'
	import {
		npbPlayerUrl,
		scorebookNotation,
		translatePositions,
		type NpbBatterLine,
		type NpbGame,
		type NpbLang,
		type NpbPitcherLine,
		type NpbPlayerRef,
		type NpbSide,
	} from '#lib/npb-game.js'
	import type { NpbGamePlayerName } from '#lib/npb-game.js'
	import type { ScorecardKind } from '#lib/scorecard.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn, ordinal } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import { ArrowDownRightIcon } from '#ui/icons/index.js'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import StyledTeam from '#ui/team/styled-team.svelte'
	import { playerName } from './names.js'

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

	type BatterRow = NpbBatterLine & { substitute: boolean }

	const batters = (side: NpbSide): BatterRow[] =>
		game.box?.[side].batters.map((line) => ({ ...line, substitute: line.order === null })) ?? []

	const innings = $derived(
		Math.max(
			9,
			...(['away', 'home'] as const).flatMap(
				(side) => game.box?.[side].batters.map((b) => b.innings.length) ?? [],
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

	const batterName = $derived<DataTableColumn<BatterRow>>({
		id: 'player',
		header: '',
		title: ja ? '選手' : 'Player',
		sortable: false,
		sticky: true,
		rowHeader: true,
		cell: batterCell,
		class: 'min-w-[14ch] pl-ch',
	})

	const battingColumns = $derived<DataTableColumn<BatterRow>[]>([
		batterName,
		stat('atBats', ja ? '打数' : 'AB', 'At bats', (row) => row.atBats),
		stat('hits', ja ? '安打' : 'H', 'Hits', (row) => row.hits),
		stat('runs', ja ? '得点' : 'R', 'Runs', (row) => row.runs),
		stat('rbi', ja ? '打点' : 'RBI', 'Runs batted in', (row) => row.rbi),
		stat('stolenBases', ja ? '盗塁' : 'SB', 'Stolen bases', (row) => row.stolenBases),
	])

	const scorecardColumns = $derived<DataTableColumn<BatterRow>[]>([
		batterName,
		...Array.from({ length: innings }, (_, i): DataTableColumn<BatterRow> => ({
			id: `inning-${i + 1}`,
			header: String(i + 1),
			title: `${ordinal(i + 1)} inning`,
			sortable: false,
			cell: scorebookCell,
			align: 'center',
			class: 'min-w-[4ch] px-[.25ch] text-center border-l border-foreground/10',
		})),
	])

	const pitchingColumns = $derived<DataTableColumn<NpbPitcherLine>[]>([
		{
			id: 'player',
			header: '',
			title: ja ? '投手' : 'Pitcher',
			sortable: false,
			sticky: true,
			rowHeader: true,
			cell: pitcherCell,
			class: 'min-w-[14ch] pl-ch',
		},
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

	/** The scorecard's colors: blue for a run batted in, red for an out, as on the MLB scorecard */
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
				label="{mlbTeam.name} batting"
				data={batters(side)}
				columns={view === 'scorecard' ? scorecardColumns : battingColumns}
				getRowId={(row) => `${row.player.id ?? row.player.nameJa}-${row.positionsJa.join('')}`}
				sortable={false}
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
			sortable={false}
			tableClass="w-full"
			stickyHeader={false}
		/>
	</article>
{/snippet}

{#snippet player(ref: NpbPlayerRef, label: string, substitute = false)}
	{@const photo = ref.id ? names[ref.id]?.photo : null}
	<svelte:element
		this={ref.id ? 'a' : 'span'}
		class={cn('group/player flex items-center gap-[.5ch] text-left', substitute && 'pl-lh')}
		href={ref.id ? npbPlayerUrl(ref.id) : undefined}
		target={ref.id ? '_blank' : undefined}
		rel={ref.id ? 'noopener noreferrer' : undefined}
		title={playerName(ref, names, lang, 'full')}
	>
		{#if substitute}
			<ArrowDownRightIcon class="-ml-lh size-ch shrink-0 text-current/40" />
		{/if}

		{#if photo}
			<!-- A circle cropped from the top of the 4:5 photo, as on the NPB roster -->
			<img
				class="img-fade block size-lh shrink-0 rounded-full bg-foreground/10 object-cover object-top text-transparent opacity-0 transition-opacity"
				src={photo}
				width="144"
				height="180"
				alt=""
				loading="lazy"
				decoding="async"
				draggable="false"
				onload={(e) => e.currentTarget.classList.remove('opacity-0')}
			/>
		{/if}

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

{#snippet batterCell({ row }: CellArgs<BatterRow>)}
	{@render player(row.player, positions(row.positionsJa), row.substitute)}
{/snippet}

{#snippet pitcherCell({ row }: CellArgs<NpbPitcherLine>)}
	{@render player(row.player, row.decision ? (ja ? DECISIONS[row.decision] : row.decision) : '')}
{/snippet}

{#snippet scorebookCell({ row, columnId }: CellArgs<BatterRow>)}
	{@const entries = row.innings[Number(columnId.replace('inning-', '')) - 1] ?? []}
	<span class="flex flex-col items-center leading-tight">
		{#each entries as entry, i (i)}
			{@const notation = scorebookNotation(entry)}
			<span
				class={cn(
					'whitespace-nowrap tabular-nums',
					notation.rbi ? 'font-bold text-blue-600 dark:text-blue-400' : COLORS[notation.kind],
					notation.kind === 'homeRun' && COLORS.homeRun,
				)}
				title={entry}
				lang={ja ? 'ja' : undefined}
			>
				{ja ? entry : notation.label}{#if notation.badge}<sup class="text-[.6em]"
						>{notation.badge}</sup
					>{/if}{#if notation.rbi && !ja}<sub class="text-[.6em]">{notation.rbi}</sub>{/if}
			</span>
		{/each}
	</span>
{/snippet}
