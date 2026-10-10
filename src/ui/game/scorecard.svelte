<script lang="ts">
	import {
		buildScorecard,
		isInGame,
		lineupFromBoxscore,
		type ScorecardCell,
		type ScorecardKind,
		type ScorecardRow,
	} from '#lib/scorecard.js'
	import { cn, ordinal } from '#lib/utils.js'
	import type { Snippet } from 'svelte'

	let {
		team,
		side,
		plays,
		scheduledInnings,
		isFinal,
		isSpoilerPrevented,
		player,
		onAtBatSelect,
	}: {
		team: MLB.TeamBoxscore
		side: 'away' | 'home'
		plays?: MLB.Play[]
		scheduledInnings?: number
		isFinal?: boolean
		isSpoilerPrevented?: boolean
		/** The box score's own headshot and name cells, so both views line up the same way */
		player: Snippet<[player: MLB.BoxscorePlayer, substituted?: boolean, label?: string]>
		/** Show this plate appearance in the pitch sequence */
		onAtBatSelect?: (atBatIndex: number) => void
	} = $props()

	/** Home, first, second, third and home again, on the diamond's 40 × 40 box. */
	const BASE_PATH = ['20,37', '37,20', '20,3', '3,20', '20,37']

	const scorecard = $derived(
		buildScorecard({
			plays: isSpoilerPrevented ? [] : plays,
			side,
			lineup: lineupFromBoxscore(team),
			scheduledInnings,
			isFinal,
		}),
	)

	/** Each inning's columns, so the header, rows and totals line up. */
	const columns = $derived(
		scorecard.innings.flatMap(({ inning, columns }) =>
			Array.from({ length: columns }, (_, column) => ({ inning, column })),
		),
	)

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
	let tooltip = $state.raw<{ key: string; text: string; anchor: HTMLElement } | null>(null)
	let tooltipEl = $state<HTMLElement>()

	/** The open cell takes this name, and the tooltip anchors to it with CSS. */
	const anchorName = $derived(`--scorecard-cell-${side}`)

	/** Without CSS anchor positioning, the tooltip is placed (and follows scrolling) by hand. */
	const isAnchorPositioned = () => typeof CSS !== 'undefined' && CSS.supports('anchor-name: --a')

	function cellKey(playerId: number, { inning, column }: { inning: number; column: number }) {
		return `${playerId}-${inning}-${column}`
	}

	function showTooltip(anchor: HTMLElement, key: string, text: string) {
		tooltip = { key, text, anchor }
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

	/** Every position played, and the inning a substitute came in: `PH-C · 5th`. */
	function positionLabel(p: MLB.BoxscorePlayer, row: ScorecardRow) {
		const positions = (p.allPositions?.length ? p.allPositions : [p.position])
			.map((position) => position?.abbreviation)
			.filter(Boolean)
			.join('-')
		return row.enteredInning ? `${positions} · ${ordinal(row.enteredInning)}` : positions
	}

	function cellLabel(cell: ScorecardCell) {
		return `${ordinal(cell.inning)} inning: ${cell.description}`
	}
</script>

<table class="scorecard w-max border-collapse text-center" aria-label="{team.team.name} scorecard">
	<thead class="text-xs text-current/40">
		<tr class="*:pt-[.5ch] *:font-normal">
			<th colspan="2" scope="col">
				<span class="sr-only">Batter</span>
			</th>
			{#each scorecard.innings as { inning, columns } (inning)}
				<th scope="col" colspan={columns}>{inning}</th>
			{/each}
			<th class="end" aria-hidden="true"></th>
		</tr>
	</thead>

	<tbody>
		{#each scorecard.rows as row (row.playerId)}
			{@const boxscorePlayer = team.players[`ID${row.playerId}`]}
			{@const replaced = !isSpoilerPrevented && !team.battingOrder.includes(row.playerId)}
			{@const cells = cellsByRow.get(row.playerId)}

			<tr class="hover:*:not-first:bg-foreground/5" data-substituted={replaced ? '' : undefined}>
				{#if boxscorePlayer}
					{@render player(boxscorePlayer, replaced, positionLabel(boxscorePlayer, row))}
				{:else}
					<th class="sticky left-0 z-1 min-w-lh"></th>
					<th class="pl-ch text-left">{row.playerId}</th>
				{/if}

				{#each columns as column (`${column.inning}-${column.column}`)}
					{@const cell = cells?.get(`${column.inning}-${column.column}`)}
					{@const key = cellKey(row.playerId, column)}
					<td class="p-0" class:inning-start={column.column === 0}>
						{#if cell}
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
									e.pointerType === 'mouse' && showTooltip(e.currentTarget, key, cell.description)}
								onpointerleave={(e) => e.pointerType === 'mouse' && hideTooltip(key)}
								onfocus={(e) => showTooltip(e.currentTarget, key, cell.description)}
								onblur={() => hideTooltip(key)}
								onpointerdown={(e) =>
									(tapToClose = e.pointerType !== 'mouse' && tooltip?.key === key)}
								onclick={(e) => {
									// A tap focuses the cell (which opens it) before the click, so decide on pointerdown
									if (tapToClose) hideTooltip()
									else showTooltip(e.currentTarget, key, cell.description)
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

								{#if cell.rbi > 0}
									<span
										class="absolute right-0.5 bottom-0 text-[0.5625rem] leading-tight font-bold"
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
					</td>
				{/each}

				<td class="end" aria-hidden="true"></td>
			</tr>
		{/each}
	</tbody>
</table>

<!-- Only in the page while open, so a closed tooltip can never take up room -->
{#if tooltip}
	<div
		bind:this={tooltipEl}
		popover="manual"
		role="tooltip"
		class="tooltip pointer-events-none fixed z-10 max-w-[min(40ch,calc(100vw-2ch))] border border-current/25 bg-background/70 px-ch py-[.5ch] text-left text-xs text-foreground shadow-lg backdrop-blur-md"
		style:position-anchor={anchorName}
	>
		{tooltip.text}
	</div>
{/if}

<!--
	An empty diamond takes its cell's color. A plate appearance's outline only says whether it
	made an out: red if so, gray otherwise, whatever color its label is.
-->
{#snippet diamond(cell?: ScorecardCell)}
	<svg viewBox="0 0 40 40" class="absolute inset-0.5 size-[calc(100%-0.25rem)]" aria-hidden="true">
		<path
			class={cn(
				cell && (cell.madeOut ? 'stroke-red-600 dark:stroke-red-400' : 'stroke-foreground/45'),
				cell?.scored && 'fill-blue-500 dark:fill-blue-400',
			)}
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

	.scorecard {
		td,
		th {
			font-variant-numeric: tabular-nums;
		}

		tbody td:not(.end) {
			width: 2.75rem;
			min-width: 2.75rem;
			height: 2.5rem;
		}

		/* The box score's name cell: the table is as wide as its content, so names never truncate,
		   and the position sits right after the name */
		tbody tr > :global(th:nth-child(2)) {
			width: auto;
			padding-right: 1ch;

			:global(a > span) {
				flex-grow: 0;
			}
		}

		/* The sticky headshot covers the names and diamonds that scroll under it */
		tbody tr > :global(th:first-child:not(.bg-accent)) {
			background: var(--color-background);
		}

		/* …but not the substitute arrow that hangs from the replaced player's cell into it */
		tbody tr[data-substituted] > :global(th:first-child) {
			z-index: 2;
		}

		/* Room past the last inning, under the scroll container's fade */
		.end {
			min-width: 1.5ch;
		}

		/* A hairline between innings, but not between an inning's own columns */
		.inning-start {
			border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
		}
	}
</style>
