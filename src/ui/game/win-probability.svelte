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

	const innings = $derived(linescore?.innings?.length ?? linescore?.scheduledInnings ?? 9)

	const pathData = $derived(() => {
		const points = winProbability.map((d, i) => {
			const x = (i / (winProbability.length - 1)) * width
			const y = (d.homeTeamWinProbability / 100) * height
			return `${x},${y}`
		})
		return `M ${points?.join(' L ')}`
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

	<svg class="w-full grow" {width} {height}>
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

		<path d={pathData()} fill="none" stroke="var(--color-accent,currentColor)" stroke-width="1" />
	</svg>
</figure>
