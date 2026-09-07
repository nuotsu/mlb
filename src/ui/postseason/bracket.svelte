<script lang="ts">
	import {
		roundName,
		type Bracket,
		type BracketSeries,
		type LeagueSide,
	} from '$lib/postseason/bracket'
	import { cn } from '$lib/utils'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import Connector from './connector.svelte'
	import Series from './series.svelte'
	import TeamAvatar from './team-avatar.svelte'

	let { bracket }: { bracket: Bracket } = $props()

	type Cell = { series: BracketSeries; side: LeagueSide; col: number; row: number }

	const roundCount = $derived(bracket.rounds.length)
	const totalCols = $derived(4 * roundCount + 1)
	const worldSeriesCol = $derived(2 * roundCount + 1)

	const columns = $derived(
		Array.from({ length: totalCols }, (_, i) => {
			const col = i + 1
			if (col === worldSeriesCol) return 'var(--ws)'
			return col % 2 === 1 ? 'var(--col)' : 'var(--conn)'
		}).join(' '),
	)

	function columnFor(series: BracketSeries, side: LeagueSide) {
		const index = bracket.rounds.findIndex((r) => r.round === series.round)
		return side === 'AL' ? 1 + 2 * index : totalCols - 2 * index
	}

	/** Every series on one side with its grid position, feeders stacked under their slot. */
	function place(root: BracketSeries | undefined, side: LeagueSide): Cell[] {
		if (!root) return []
		const cells: Cell[] = []
		const offset = Math.floor((bracket.height - root.height) / 2)

		const walk = (series: BracketSeries, row: number) => {
			cells.push({ series, side, col: columnFor(series, side), row })
			if (series.top.feeder) walk(series.top.feeder, row)
			if (series.bottom.feeder) walk(series.bottom.feeder, row + series.top.height)
		}

		walk(root, offset)
		return cells
	}

	const cells = $derived([...place(bracket.al, 'AL'), ...place(bracket.nl, 'NL')])

	const headers = $derived([
		...bracket.rounds.flatMap((spec, index) => [
			{ col: 1 + 2 * index, label: roundName(spec.round, 'AL') },
			{ col: totalCols - 2 * index, label: roundName(spec.round, 'NL') },
		]),
		{ col: worldSeriesCol, label: roundName('W') },
	])

	function isSpoiler(series: BracketSeries) {
		return [series.top.team, series.bottom.team].some(
			(team) => team && spoilerPreventionStore.has(team.id),
		)
	}

	/** Whether a league's final series has been won, which lights the line into the World Series. */
	function pennant(final?: BracketSeries) {
		return !!final?.winner && !isSpoiler(final)
	}

	const worldSeries = $derived(bracket.worldSeries)
	const worldSeriesSpoiler = $derived(isSpoiler(worldSeries))
	const champion = $derived(worldSeriesSpoiler ? undefined : worldSeries.winner)
	const showWorldSeriesScore = $derived(
		!worldSeriesSpoiler && (worldSeries.gamesPlayed > 0 || worldSeries.live),
	)
</script>

<div class="-mx-ch overflow-x-auto overscroll-x-contain px-ch">
	<div
		class="mx-auto grid w-max min-w-full [--avatar:2.5rem] [--col:4rem] [--conn:2.25rem] [--unit:3.75rem] [--ws:10rem] md:[--col:5rem] md:[--conn:3rem]"
		style:grid-template-columns={columns}
		style:grid-template-rows="auto repeat({bracket.height}, var(--unit))"
		aria-label="{bracket.season} postseason bracket"
		role="figure"
	>
		{#each headers as { col, label } (col)}
			<div
				class="self-end pb-ch text-center text-[x-small] tracking-widest text-current/50 uppercase"
				style:grid-column={col}
				style:grid-row="1"
			>
				{label}
			</div>
		{/each}

		{#each cells as { series, side, col, row } (series.id)}
			{@const spoiler = isSpoiler(series)}
			<div style:grid-column={col} style:grid-row="{row + 2} / span {series.height}">
				<Series {series} {spoiler} />
			</div>
			<div
				style:grid-column={side === 'AL' ? col + 1 : col - 1}
				style:grid-row="{row + 2} / span {series.height}"
			>
				<Connector {series} direction={side === 'AL' ? 'ltr' : 'rtl'} {spoiler} />
			</div>
		{/each}

		<div
			class="flex items-center"
			style:grid-column={worldSeriesCol}
			style:grid-row="2 / span {bracket.height}"
			title={[
				roundName('W'),
				worldSeries.top.team &&
					worldSeries.bottom.team &&
					`${worldSeries.top.team.name} vs ${worldSeries.bottom.team.name}`,
				showWorldSeriesScore && `${worldSeries.top.wins}-${worldSeries.bottom.wins}`,
			]
				.filter(Boolean)
				.join(' · ')}
		>
			{#if roundCount > 0}
				{@render edge(pennant(bracket.al))}
			{/if}

			<div class="flex items-center gap-[.75ch] px-[.5ch]">
				<TeamAvatar
					team={worldSeries.top.team}
					champion={!!champion && champion.id === worldSeries.top.team?.id}
				/>

				<div
					class={cn(
						'flex min-w-[3ch] items-center justify-center gap-[.5ch] text-sm font-medium tabular-nums',
						champion && 'text-accent',
					)}
				>
					{#if showWorldSeriesScore}
						<span>{worldSeries.top.wins}-{worldSeries.bottom.wins}</span>
						{#if worldSeries.live}
							<span class="size-1.5 animate-pulse rounded-full bg-accent" title="In progress"
							></span>
						{/if}
					{:else}
						<span class="text-current/25">vs</span>
					{/if}
				</div>

				<TeamAvatar
					team={worldSeries.bottom.team}
					champion={!!champion && champion.id === worldSeries.bottom.team?.id}
				/>
			</div>

			{#if roundCount > 0}
				{@render edge(pennant(bracket.nl))}
			{/if}
		</div>
	</div>
</div>

<!-- The stretch of line between a league's final series and its World Series logo. -->
{#snippet edge(won: boolean)}
	<span
		class={cn(
			'h-px grow rounded-full bg-current/25 transition-[height,background-color]',
			won && 'h-[3px] bg-accent',
		)}
	></span>
{/snippet}
