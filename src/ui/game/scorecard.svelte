<script lang="ts">
	import {
		absChallengeSummary,
		absChallengeText,
		buildScorecard,
		isInGame,
		lineupFromBoxscore,
		type AbsChallenge,
		type ScorecardCell,
		type ScorecardKind,
		type Steal,
	} from '#lib/scorecard.js'
	import { cn, ordinal } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import BoxscorePlayer from '#ui/game/boxscore-player.svelte'

	let {
		team,
		side,
		plays,
		scheduledInnings,
		isFinal,
		isSpoilerPrevented,
		players,
		onAtBatSelect,
	}: {
		team: MLB.TeamBoxscore
		side: 'away' | 'home'
		plays?: MLB.Play[]
		scheduledInnings?: number
		isFinal?: boolean
		isSpoilerPrevented?: boolean
		/** `gameData.players`, for the player cells' throwing hands */
		players?: Record<string, MLB.Person> | null
		/** Show this plate appearance in the pitch sequence */
		onAtBatSelect?: (atBatIndex: number) => void
	} = $props()

	/** Home, first, second, third and home again, on the diamond's 40 × 40 box. */
	const BASE_PATH = ['20,37', '37,20', '20,3', '3,20', '20,37']
	const BASE_POINTS = BASE_PATH.map((p) => p.split(',').map(Number))

	/** A steal's side of the diamond, cut off halfway when they were caught in a rundown. */
	function stealPoints({ from, to, caught }: Steal) {
		const [x1, y1] = BASE_POINTS[from]
		const [x2, y2] = BASE_POINTS[to]
		return caught === 'between'
			? `${x1},${y1} ${(x1 + x2) / 2},${(y1 + y2) / 2}`
			: `${x1},${y1} ${x2},${y2}`
	}

	const scorecard = $derived(
		buildScorecard({
			plays: isSpoilerPrevented ? [] : plays,
			side,
			lineup: lineupFromBoxscore(team),
			scheduledInnings,
			isFinal,
		}),
	)

	type ScorecardRow = (typeof scorecard.rows)[number]

	/** One column per inning; an inning that batted around holds a box for each time through. */
	const tableColumns = $derived<DataTableColumn<ScorecardRow>[]>([
		{
			id: 'batter',
			header: '',
			title: 'Batter',
			sticky: true,
			rowHeader: true,
			cell: batterCell,
			cellClass: (row) => isFavorite(row) && 'bg-accent! text-dark',
			class: 'pl-[1rch]',
		},
		...scorecard.innings.map(({ inning, columns }): DataTableColumn<ScorecardRow> => ({
			id: `inning-${inning}`,
			header: String(inning),
			title: `${ordinal(inning)} inning`,
			align: 'center',
			cell: inningCell,
			class: 'inning-start p-0',
			// a box per time through the order
			headerClass: columns > 1 && 'text-center',
		})),
	])

	const columnCounts = $derived(
		new Map(scorecard.innings.map(({ inning, columns }) => [inning, columns])),
	)

	const isFavorite = (row: ScorecardRow) => favoritesStore.has(`/player/${row.playerId}`)

	/** Taken out of the game */
	const isReplaced = (row: ScorecardRow) =>
		!isSpoilerPrevented && !team.battingOrder.includes(row.playerId)

	const cellsByRow = $derived(
		new Map(
			scorecard.rows.map((row) => [
				row.playerId,
				new Map(row.cells.map((cell) => [`${cell.inning}-${cell.column}`, cell])),
			]),
		),
	)

	/** Same hues as the pitch list (blue in play, green ball, yellow strike), darkened in light mode to stay legible. */
	/*
	 * Blue is a run: a label is blue when a run scored on the play, and a diamond is filled blue
	 * when its batter came around to score. Red is an out. Strikeouts and walks keep their own
	 * colors from the pitch list (yellow strike, green ball).
	 */
	const BLUE = 'text-blue-600 dark:text-blue-400'
	const RED = 'text-red-600 dark:text-red-400'
	const GRAY = 'text-current/60'

	const COLORS: Record<ScorecardKind, string> = {
		hit: 'text-foreground',
		homeRun: 'font-bold text-blue-700 dark:text-blue-300',
		walk: 'text-green-700 dark:text-accent',
		strikeout: 'text-yellow-700 dark:text-yellow-300',
		error: GRAY,
		fieldersChoice: GRAY,
		out: GRAY,
		runner: GRAY,
		other: GRAY,
	}

	function cellColor(cell: ScorecardCell) {
		if (cell.kind === 'walk' || cell.kind === 'strikeout' || cell.kind === 'homeRun') {
			return COLORS[cell.kind]
		}
		if (cell.isScoringPlay) return BLUE
		if (cell.madeOut) return RED
		return COLORS[cell.kind]
	}

	/** The bold base paths: green for a walk, white for an error, the label's color for a hit. */
	const BASE_PATH_COLORS: Partial<Record<ScorecardKind, string>> = {
		walk: 'stroke-green-700 dark:stroke-accent',
		error: 'stroke-foreground',
	}

	// Tooltip: hover with a mouse, tap on a touchscreen, or focus with a keyboard
	let tooltip = $state.raw<{ key: string; lines: string[]; anchor: HTMLElement } | null>(null)
	let tooltipEl = $state<HTMLElement>()

	/** The open cell takes this name, and the tooltip anchors to it with CSS. */
	const anchorName = $derived(`--scorecard-cell-${side}`)

	/** Without CSS anchor positioning, the tooltip is placed (and follows scrolling) by hand. */
	const isAnchorPositioned = () => typeof CSS !== 'undefined' && CSS.supports('anchor-name: --a')

	function cellKey(playerId: number, { inning, column }: { inning: number; column: number }) {
		return `${playerId}-${inning}-${column}`
	}

	function showTooltip(anchor: HTMLElement, key: string, cell: ScorecardCell) {
		tooltip = {
			key,
			lines: [cell.description, ...(cell.absChallenges ?? []).map(absChallengeText)],
			anchor,
		}
	}

	/** A second tap on the same cell closes its tooltip. */
	let tapToClose = false

	function hideTooltip(key?: string) {
		if (!key || tooltip?.key === key) tooltip = null
	}

	/** Above the cell, kept on screen. */
	function place(el: HTMLElement, anchor: HTMLElement) {
		const rect = anchor.getBoundingClientRect()
		const margin = 8
		const left = Math.min(
			Math.max(rect.left + rect.width / 2 - el.offsetWidth / 2, margin),
			window.innerWidth - el.offsetWidth - margin,
		)
		el.style.left = `${left}px`
		el.style.top = `${Math.max(rect.top - el.offsetHeight - 4, margin)}px`
	}

	$effect(() => {
		const el = tooltipEl
		if (!el || !tooltip) return

		// In the top layer where supported, so no scroll container clips it; plain `fixed` otherwise
		if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) el.showPopover()
		if (!isAnchorPositioned()) place(el, tooltip.anchor)
	})

	$effect(() => {
		if (!tooltip || !tooltipEl) return
		const { anchor } = tooltip
		const el = tooltipEl

		const close = () => (tooltip = null)
		// Focusing a cell can scroll it into view, so follow it rather than close
		const onScroll = () => {
			if (!isAnchorPositioned()) requestAnimationFrame(() => place(el, anchor))
		}
		const onKeydown = (e: KeyboardEvent) => e.key === 'Escape' && close()
		const onPointerdown = (e: PointerEvent) => {
			if (!(e.target as Element | null)?.closest?.('[data-scorecard-cell]')) close()
		}

		window.addEventListener('scroll', onScroll, { capture: true, passive: true })
		window.addEventListener('keydown', onKeydown)
		window.addEventListener('pointerdown', onPointerdown)

		return () => {
			window.removeEventListener('scroll', onScroll, { capture: true })
			window.removeEventListener('keydown', onKeydown)
			window.removeEventListener('pointerdown', onPointerdown)
		}
	})

	/** Every position played: `PH-C`. */
	function positionLabel(p: MLB.BoxscorePlayer) {
		return (p.allPositions?.length ? p.allPositions : [p.position])
			.map((position) => position?.abbreviation)
			.filter(Boolean)
			.join('-')
	}

	/** The batter challenges for their own team; the pitcher or catcher for the other one. */
	function challengedBy({ challenger }: AbsChallenge) {
		if (!challenger) return
		if (challenger.role === 'batter') return side
		return side === 'away' ? 'home' : 'away'
	}

	function cellLabel(cell: ScorecardCell) {
		const abs = absChallengeSummary(cell.absChallenges)
		return `${ordinal(cell.inning)} inning: ${cell.description}${abs ? ` ${abs}.` : ''}`
	}
</script>

<DataTable
	class="scorecard"
	label="{team.team.name} scorecard"
	data={scorecard.rows}
	columns={tableColumns}
	getRowId={(row) => String(row.playerId)}
	sortable={false}
	stickyHeader={false}
/>

{#snippet batterCell({ row, index }: CellArgs<ScorecardRow>)}
	{@const boxscorePlayer = team.players[`ID${row.playerId}`]}
	{@const previous = scorecard.rows[index - 1]}
	{#if boxscorePlayer}
		<BoxscorePlayer
			player={boxscorePlayer}
			{players}
			label={positionLabel(boxscorePlayer)}
			substitute={!isSpoilerPrevented && !!previous && isReplaced(previous)}
		/>
	{:else}
		{row.playerId}
	{/if}
{/snippet}

{#snippet inningCell({ row, columnId }: CellArgs<ScorecardRow>)}
	{@const inning = Number(columnId.replace('inning-', ''))}
	{@const cells = cellsByRow.get(row.playerId)}
	<div class="flex">
		{#each { length: columnCounts.get(inning) ?? 1 }, col (col)}
			{@const column = { inning, column: col }}
			{@const cell = cells?.get(`${inning}-${col}`)}
			{@const key = cellKey(row.playerId, column)}
			<div class="box">
				{#if cell}
					{@const homeChallenges = (cell.absChallenges ?? []).filter(
						(c) => challengedBy(c) === 'home',
					)}
					{@const awayChallenges = (cell.absChallenges ?? []).filter(
						(c) => challengedBy(c) !== 'home',
					)}
					<button
						type="button"
						class={cn(
							'relative grid size-full place-items-center outline-none focus-visible:bg-foreground/10',
							cellColor(cell),
						)}
						style:anchor-name={tooltip?.key === key ? anchorName : undefined}
						aria-label={cellLabel(cell)}
						data-scorecard-cell
						onpointerenter={(e) =>
							e.pointerType === 'mouse' && showTooltip(e.currentTarget, key, cell)}
						onpointerleave={(e) => e.pointerType === 'mouse' && hideTooltip(key)}
						onfocus={(e) => showTooltip(e.currentTarget, key, cell)}
						onblur={() => hideTooltip(key)}
						onpointerdown={(e) => (tapToClose = e.pointerType !== 'mouse' && tooltip?.key === key)}
						onclick={(e) => {
							// A tap focuses the cell (which opens it) before the click, so decide on pointerdown
							if (tapToClose) hideTooltip()
							else showTooltip(e.currentTarget, key, cell)
							tapToClose = false
							if (cell.kind !== 'runner') onAtBatSelect?.(cell.atBatIndex)
						}}
					>
						{@render diamond(cell)}

						<span class="relative text-[0.6875rem] leading-none" aria-hidden="true">
							{#if cell.mirrored}
								<span class="inline-block -scale-x-100">{cell.label}</span>
							{:else}
								{cell.label}
							{/if}
						</span>

						{#if cell.out}
							<span
								class="absolute top-0.5 left-1 text-[0.625rem] leading-none font-semibold text-red-600 dark:text-red-400"
								aria-hidden="true"
							>
								{cell.out}
							</span>
						{/if}

						<!-- ABS challenges: the away team's top right, the home team's bottom right -->
						{#if awayChallenges.length}
							{@render absChallengeMarks(awayChallenges, 'top-[2px]')}
						{/if}
						{#if homeChallenges.length}
							{@render absChallengeMarks(homeChallenges, 'bottom-[2px]')}
						{/if}

						{#if cell.rbi > 0}
							<span
								class={cn(
									'absolute bottom-0 text-[0.5625rem] leading-tight font-bold',
									homeChallenges.length ? 'right-2' : 'right-0.5',
								)}
								aria-hidden="true"
								title="{cell.rbi} RBI"
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
					</button>
				{:else}
					<!-- Fainter before a substitute came in, and after a player was replaced -->
					<div
						class={cn(
							'relative grid size-full place-items-center',
							isInGame(row, column.inning, side) ? 'text-current/40' : 'text-current/15',
						)}
						aria-hidden="true"
					>
						{@render diamond()}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

<!-- Only in the page while open, so a closed tooltip can never take up room -->
{#if tooltip}
	<div
		bind:this={tooltipEl}
		popover="manual"
		role="tooltip"
		class="tooltip pointer-events-none fixed z-10 max-w-[min(40ch,calc(100vw-2ch))] border border-current/25 bg-background/70 px-ch py-[.5ch] text-left text-xs text-foreground shadow-lg backdrop-blur-md"
		style:position-anchor={anchorName}
	>
		{#each tooltip.lines as line, i (i)}
			<p class={cn(i > 0 && 'mt-[.5ch] text-current/70')}>{line}</p>
		{/each}
	</div>
{/if}

<!-- Top to bottom in pitch order: filled when won, struck through when lost -->
{#snippet absChallengeMarks(challenges: AbsChallenge[], position: string)}
	<span class={cn('absolute right-[2px] flex flex-col gap-px', position)} aria-hidden="true">
		{#each challenges.slice(0, 2) as { overturned }, i (i)}
			<svg viewBox="0 0 5 5" class="size-[5px]">
				{#if overturned}
					<rect class="fill-tmobile" width="5" height="5" shape-rendering="crispEdges" />
				{:else}
					<rect
						class="stroke-tmobile"
						x=".25"
						y=".25"
						width="4.5"
						height="4.5"
						fill="none"
						stroke-width=".5"
						shape-rendering="crispEdges"
					/>
					<path class="stroke-tmobile" d="M4.75 .25 .25 4.75" stroke-width=".5" />
				{/if}
			</svg>
		{/each}
	</span>
{/snippet}

<!--
	An empty diamond takes its cell's color. A plate appearance's outline is always gray; an out
	shows in its red label, not its outline.
-->
{#snippet diamond(cell?: ScorecardCell)}
	<svg
		viewBox="0 0 40 40"
		class="absolute inset-x-0.5 inset-y-0 h-full w-[calc(100%-0.25rem)]"
		aria-hidden="true"
	>
		<path
			class={cn(cell && 'stroke-foreground/45', cell?.scored && 'fill-blue-500 dark:fill-blue-400')}
			d="M20 3 37 20 20 37 3 20Z"
			fill="none"
			fill-opacity={cell?.kind === 'homeRun' ? 0.5 : 0.35}
			stroke="currentColor"
			stroke-width="1"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>

		<!-- Base paths, counterclockwise from home: one side for a single, walk or error, all four for a homer -->
		{#if cell?.bases}
			<polyline
				class={BASE_PATH_COLORS[cell.kind]}
				points={BASE_PATH.slice(0, cell.bases + 1).join(' ')}
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{/if}

		<!-- Stolen bases, dashed; red when caught stealing, and half a side when caught in a rundown -->
		{#each cell?.steals ?? [] as steal, i (i)}
			<polyline
				class={steal.caught ? 'stroke-red-600 dark:stroke-red-400' : 'stroke-foreground'}
				points={stealPoints(steal)}
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-dasharray="3.5 2.5"
				stroke-linecap="butt"
				vector-effect="non-scaling-stroke"
			/>
		{/each}

		{#if cell?.pickedOff}
			{@const [cx, cy] = BASE_POINTS[cell.pickedOff]}
			<circle class="fill-red-600 dark:fill-red-400" {cx} {cy} r="3" />
		{/if}
	</svg>
{/snippet}

<style>
	.tooltip {
		/* Placed by hand (see place) where anchor positioning isn't supported */
		inset: auto;
		margin: 0;

		/* Centered above the open cell. Near a side of the screen it lines up with the cell's
		   edge instead, and near the top it goes below. */
		@supports (anchor-name: --a) {
			position-area: top;
			margin-block: 4px;
			position-try-fallbacks:
				top span-left,
				top span-right,
				bottom,
				bottom span-left,
				bottom span-right;
		}
	}

	/* A box per plate appearance: a 40px tap target, and a square for the diamond */
	.box {
		width: 2.5rem;
		height: 2.5rem;
		font-variant-numeric: tabular-nums;
	}

	/* A hairline between innings, but not between an inning's own boxes */
	:global(.scorecard .inning-start) {
		border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
	}
</style>
