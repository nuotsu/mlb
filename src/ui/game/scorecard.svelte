<script lang="ts">
	import {
		buildScorecard,
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
	}: {
		team: MLB.TeamBoxscore
		side: 'away' | 'home'
		plays?: MLB.Play[]
		scheduledInnings?: number
		isFinal?: boolean
		isSpoilerPrevented?: boolean
		/** The box score's own headshot and name cells, so both views line up the same way */
		player: Snippet<[player: MLB.BoxscorePlayer, substituted?: boolean, label?: string]>
	} = $props()

	const STATS = ['ab', 'r', 'h', 'rbi', 'bb', 'k'] as const
	const STAT_LABELS = { ab: 'AB', r: 'R', h: 'H', rbi: 'RBI', bb: 'BB', k: 'K' }

	const INNING_STATS = [
		{ key: 'runs', label: 'R', title: 'Runs' },
		{ key: 'hits', label: 'H', title: 'Hits' },
		{ key: 'errors', label: 'E', title: 'Errors' },
		{ key: 'lob', label: 'LOB', title: 'Left on base' },
	] as const

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

	const teamTotals = $derived(
		scorecard.rows.reduce(
			(sum, { totals }) => {
				for (const key of STATS) sum[key] += totals[key]
				return sum
			},
			{ ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 },
		),
	)

	/** Same hues as the pitch list (blue in play, green ball, yellow strike), darkened in light mode to stay legible. */
	const COLORS: Record<ScorecardKind, string> = {
		hit: 'text-blue-600 dark:text-blue-400',
		homeRun: 'font-bold text-blue-700 dark:text-blue-300',
		walk: 'text-green-700 dark:text-accent',
		strikeout: 'text-yellow-700 dark:text-yellow-300',
		error: 'text-rose-700/85 dark:text-rose-300/85',
		fieldersChoice: 'text-rose-700/85 dark:text-rose-300/85',
		out: 'text-current/60',
		runner: 'text-current/60',
		other: 'text-current/60',
	}

	// Tooltip: hover with a mouse, tap on a touchscreen, or focus with a keyboard
	let tooltip = $state.raw<{ key: string; text: string; anchor: HTMLElement } | null>(null)
	let tooltipEl = $state<HTMLElement>()

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
		place(el, tooltip.anchor)
	})

	$effect(() => {
		if (!tooltip || !tooltipEl) return
		const { anchor } = tooltip
		const el = tooltipEl

		const close = () => (tooltip = null)
		// Focusing a cell can scroll it into view, so follow it rather than close
		const onScroll = () => requestAnimationFrame(() => place(el, anchor))
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

<table
	class="scorecard table-fixed border-collapse text-center"
	aria-label="{team.team.name} scorecard"
>
	<thead class="text-xs text-current/40">
		<tr class="*:pt-[.5ch] *:font-normal">
			<th class="w-full" colspan="2" scope="col">
				<span class="sr-only">Batter</span>
			</th>
			{#each scorecard.innings as { inning, columns } (inning)}
				<th scope="col" colspan={columns}>{inning}</th>
			{/each}
			{#each STATS as stat (stat)}
				<th scope="col" class="stat">{STAT_LABELS[stat]}</th>
			{/each}
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
					<th class="w-full min-w-[14ch] pl-ch text-left">{row.playerId}</th>
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
									COLORS[cell.kind],
								)}
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
								}}
							>
								{@render diamond(cell.scored, cell.kind === 'homeRun')}

								<span class="relative text-[0.6875rem] leading-none" aria-hidden="true">
									{#if cell.mirrored}
										<span class="inline-block -scale-x-100">{cell.label}</span>
									{:else}
										{cell.label}
									{/if}
								</span>

								{#if cell.out}
									<span
										class="absolute top-0.5 left-0.5 grid size-[1.4em] place-items-center rounded-full border border-current/40 text-[0.5625rem] leading-none text-foreground/70"
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
							<div
								class="relative grid size-full place-items-center text-current/40"
								aria-hidden="true"
							>
								{@render diamond(false)}
							</div>
						{/if}
					</td>
				{/each}

				{#each STATS as stat (stat)}
					{@const value = row.totals[stat]}
					<td class={cn('stat', !isSpoilerPrevented && value === 0 && 'text-current/40')}>
						{#if !isSpoilerPrevented}
							{value}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>

	{#if !isSpoilerPrevented}
		<tfoot class="text-xs">
			{#each INNING_STATS as { key, label, title }, i (key)}
				<tr class={cn(i === 0 && 'border-t border-dashed border-current/25')}>
					<th
						scope="row"
						colspan="2"
						class={cn('pl-ch text-left text-current/40', i === 0 && 'pt-[.5ch]')}
					>
						<abbr {title}>{label}</abbr>
					</th>
					{#each scorecard.innings as { inning, columns, totals } (inning)}
						{@const value = totals?.[key]}
						<td
							colspan={columns}
							class={cn(
								'inning-start',
								i === 0 && 'pt-[.5ch]',
								value === 0 && 'text-current/40',
								key === 'runs' && value && 'font-bold',
							)}
						>
							{value ?? ''}
						</td>
					{/each}
					{#if i === 0}
						<!-- The whole lineup's totals, under each batter's -->
						{#each STATS as stat (stat)}
							<td class="stat pt-[.5ch] align-top text-sm" rowspan={INNING_STATS.length}>
								{teamTotals[stat]}
							</td>
						{/each}
					{/if}
				</tr>
			{/each}
		</tfoot>
	{/if}
</table>

<!-- Only in the page while open, so a closed tooltip can never take up room -->
{#if tooltip}
	<div
		bind:this={tooltipEl}
		popover="manual"
		role="tooltip"
		class="pointer-events-none fixed top-0 right-auto bottom-auto left-0 z-10 m-0 max-w-[min(40ch,calc(100vw-2ch))] border border-current/25 bg-background px-ch py-[.5ch] text-left text-xs text-foreground shadow-lg"
	>
		{tooltip.text}
	</div>
{/if}

{#snippet diamond(scored: boolean, strong?: boolean)}
	<svg viewBox="0 0 40 40" class="absolute inset-0.5 size-[calc(100%-0.25rem)]" aria-hidden="true">
		<path
			d="M20 3 37 20 20 37 3 20Z"
			fill="currentColor"
			fill-opacity={scored ? (strong ? 0.35 : 0.2) : 0}
			stroke="currentColor"
			stroke-width={strong ? 1.75 : 1}
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{/snippet}

<style>
	.scorecard {
		td,
		th {
			font-variant-numeric: tabular-nums;
		}

		tbody td:not(.stat) {
			width: 2.75rem;
			min-width: 2.75rem;
			height: 2.5rem;
		}

		/* The box score's name cell, with room for a substitute's `PH-LF · 5th` */
		tbody tr > :global(th:nth-child(2)) {
			min-width: 21ch;
		}

		/* A hairline between innings, but not between an inning's own columns */
		.inning-start {
			border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
		}

		.stat {
			min-width: 3.5ch;
			padding-inline: 0.25ch;
			font-family: var(--font-sans);

			&:last-child {
				padding-right: 1ch;
			}
		}
	}
</style>
