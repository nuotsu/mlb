<!--
	@component
	A scorecard box's diamond. An empty diamond takes its cell's color. A plate appearance's
	outline is always gray; an out shows in its red label, not its outline. Shared by the MLB and
	NPB scorecards.
-->
<script lang="ts" module>
	import type { ScorecardKind, Steal } from '#lib/scorecard.js'

	export type DiamondCell = {
		kind: ScorecardKind
		/** Bases the batter took, 1 to 4, drawn bold */
		bases?: number
		/** The batter came around to score: filled blue */
		scored?: boolean
		steals?: Steal[]
		/** The base this player was picked off at, 1 to 3 */
		pickedOff?: number
	}

	/** Home, first, second, third and home again, on the diamond's 40 × 40 box. */
	const BASE_PATH = ['20,37', '37,20', '20,3', '3,20', '20,37']
	const BASE_POINTS = BASE_PATH.map((p) => p.split(',').map(Number))

	/** The bold base paths: green for a walk, white for an error, the label's color for a hit. */
	const BASE_PATH_COLORS: Partial<Record<ScorecardKind, string>> = {
		walk: 'stroke-green-700 dark:stroke-accent',
		error: 'stroke-foreground',
	}

	/** A steal's side of the diamond, cut off halfway when they were caught in a rundown. */
	function stealPoints({ from, to, caught }: Steal) {
		const [x1, y1] = BASE_POINTS[from]
		const [x2, y2] = BASE_POINTS[to]
		return caught === 'between'
			? `${x1},${y1} ${(x1 + x2) / 2},${(y1 + y2) / 2}`
			: `${x1},${y1} ${x2},${y2}`
	}
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js'

	let { cell }: { cell?: DiamondCell } = $props()
</script>

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
