<script lang="ts">
	let {
		winProbability,
		boxscore,
		linescore,
	}: {
		winProbability: MLB.PlayWinProbability[]
		boxscore?: MLB.Boxscore
		linescore?: MLB.Linescore
	} = $props()

	let width = $state(0)
	let height = $state(100)
	const padding = 2

	const innings = $derived(linescore?.innings?.length ?? linescore?.scheduledInnings ?? 9)

	const pathData = $derived(() => {
		const points = winProbability.map((d, i) => ({
			x: (i / (winProbability.length - 1)) * width,
			y: (d.homeTeamWinProbability / 100) * height,
		}))

		if (points.length < 2) return ''

		// Generate smooth curve using Catmull-Rom to Bezier conversion
		let d = `M ${points[0].x},${points[0].y}`

		for (let i = 0; i < points.length - 1; i++) {
			const p0 = points[i - 1] ?? points[i]
			const p1 = points[i]
			const p2 = points[i + 1]
			const p3 = points[i + 2] ?? p2

			const tension = 6
			const cp1x = p1.x + (p2.x - p0.x) / tension
			const cp1y = p1.y + (p2.y - p0.y) / tension
			const cp2x = p2.x - (p3.x - p1.x) / tension
			const cp2y = p2.y - (p3.y - p1.y) / tension

			d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
		}

		return d
	})

	const inningDividers = $derived(() => {
		const result = []
		for (let i = 0; i < innings; i++) {
			const startX = (i / innings) * width
			const endX = ((i + 1) / innings) * width
			const centerX = (startX + endX) / 2
			result.push({ num: i + 1, startX, endX, centerX })
		}
		return result
	})
</script>

<figure class="grid *:col-span-full *:row-span-full" bind:clientWidth={width}>
	<figcaption
		class="mr-auto grid grid-cols-2 text-center text-[xx-small] text-current/25 uppercase sm:text-xs"
		style:writing-mode="vertical-rl"
	>
		<span>{boxscore?.teams.away.team.abbreviation ?? 'Away'}</span>
		<span>{boxscore?.teams.home.team.abbreviation ?? 'Home'}</span>
	</figcaption>

	<svg class="w-full grow" viewBox="0 {-padding} {width} {height + padding * 2}">
		{#each inningDividers() as inning, i}
			{#if i > 0}
				<line
					class="stroke-current/25"
					x1={inning.startX}
					y1={0}
					x2={inning.startX}
					y2={height}
					stroke-width="0.5"
				/>
			{/if}

			<text class="fill-current/25" x={inning.centerX} y={12} text-anchor="middle" font-size="16">
				{inning.num}
			</text>
		{/each}

		<line
			class="stroke-current/25"
			x1={0}
			y1={height / 2}
			x2={width}
			y2={height / 2}
			stroke-width="0.5"
			stroke-dasharray="4,4"
		/>

		<path
			d={pathData()}
			fill="none"
			stroke="var(--color-accent,currentColor)"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</figure>
