<script lang="ts">
	let {
		group,
		key,
		stats,
	}: {
		group: 'hitting' | 'pitching'
		key: string
		stats: MLB.PlayerStats[]
	} = $props()

	let width = $state(0)
	const height = 100
	const padding = { top: 16, bottom: 18, left: 20, right: 20 }
	const chartHeight = height - padding.top - padding.bottom

	const splits = $derived(
		stats.find((s) => (s.group as unknown as MLB.StatGroupRef).displayName === group)?.splits,
	)

	const parseValue = (val: unknown): number => {
		if (typeof val === 'number') return val
		if (typeof val === 'string') return parseFloat(val)
		return 0
	}

	const dataPoints = $derived.by(() => {
		if (!splits?.length) return []

		// Filter to use total stats (no team property) when player was on multiple teams in a season
		const filteredSplits = splits.filter((split) => {
			const hasDuplicateSeason = splits.filter((s) => s.season === split.season).length > 1
			if (hasDuplicateSeason) {
				return !split.team // Use the total (no team) entry
			}
			return true
		})

		return filteredSplits
			.map((split) => ({
				season: parseInt(split.season ?? ''),
				value: parseValue(split.stat[key as keyof typeof split.stat]),
			}))
			.filter((d) => isFinite(d.value) && isFinite(d.season))
			.sort((a, b) => a.season - b.season)
	})

	const yearRange = $derived.by(() => {
		if (dataPoints.length === 0) return { min: 0, max: 0 }
		return {
			min: Math.min(...dataPoints.map((d) => d.season)),
			max: Math.max(...dataPoints.map((d) => d.season)),
		}
	})

	const valueRange = $derived.by(() => {
		if (dataPoints.length === 0) return { min: 0, max: 1 }
		const values = dataPoints.map((d) => d.value).filter((v) => isFinite(v))
		if (values.length === 0) return { min: 0, max: 1 }
		const min = Math.min(...values)
		const max = Math.max(...values)
		// Add some padding to the range
		const rangePadding = (max - min) * 0.1 || 0.1
		return {
			min: Math.max(0, min - rangePadding), // Clamp to 0 since baseball stats can't be negative
			max: max + rangePadding,
		}
	})

	const scaledPoints = $derived.by(() => {
		if (dataPoints.length === 0 || width === 0) return []

		const yearSpan = yearRange.max - yearRange.min || 1
		const valueSpan = valueRange.max - valueRange.min || 1

		return dataPoints.map((d) => ({
			x:
				padding.left +
				((d.season - yearRange.min) / yearSpan) * (width - padding.left - padding.right),
			y: padding.top + (1 - (d.value - valueRange.min) / valueSpan) * chartHeight,
			season: d.season,
			value: d.value,
		}))
	})

	const pathData = $derived.by(() => {
		if (scaledPoints.length < 2) return ''

		let d = `M ${scaledPoints[0].x},${scaledPoints[0].y}`

		for (let i = 0; i < scaledPoints.length - 1; i++) {
			const p0 = scaledPoints[i - 1] ?? scaledPoints[i]
			const p1 = scaledPoints[i]
			const p2 = scaledPoints[i + 1]
			const p3 = scaledPoints[i + 2] ?? p2

			const tension = 6
			const cp1x = p1.x + (p2.x - p0.x) / tension
			const cp1y = p1.y + (p2.y - p0.y) / tension
			const cp2x = p2.x - (p3.x - p1.x) / tension
			const cp2y = p2.y - (p3.y - p1.y) / tension

			d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
		}

		return d
	})

	const maxPoint = $derived(
		scaledPoints.reduce(
			(max, point) => (point.value > max.value ? point : max),
			scaledPoints[0] ?? { x: 0, y: 0, value: 0 },
		),
	)

	const minPoint = $derived(
		scaledPoints.reduce(
			(min, point) => (point.value < min.value ? point : min),
			scaledPoints[0] ?? { x: 0, y: 0, value: Infinity },
		),
	)

	const formatValue = (val: number): string => {
		if (key === 'avg' || key === 'obp' || key === 'slg' || key === 'ops') {
			return val.toFixed(3).replace(/^0/, '')
		}
		return val.toFixed(0)
	}
</script>

{#if dataPoints.length > 0}
	<figure class="grid *:col-span-full *:row-span-full" bind:clientWidth={width}>
		<figcaption class="pointer-events-none z-1 m-auto self-start text-xl text-current/25 uppercase">
			{key}
		</figcaption>

		{#if width > 0}
			<svg class="w-full" viewBox="0 0 {width} {height}">
				<!-- Min/max value guidelines -->
				<line
					class="stroke-current/25"
					x1={padding.left}
					y1={padding.top}
					x2={width - padding.right}
					y2={padding.top}
					stroke-width="0.5"
					stroke-dasharray="4,4"
				/>
				<line
					class="stroke-current/25"
					x1={padding.left}
					y1={height - 18}
					x2={width - padding.right}
					y2={height - 18}
					stroke-width="0.5"
				/>

				<!-- Min/max value labels -->
				<text
					class="positive"
					fill="currentColor"
					x={maxPoint.x}
					y={maxPoint.y - 6}
					text-anchor="middle"
					font-size="10"
				>
					{formatValue(maxPoint.value)}
				</text>
				<text
					class="negative"
					fill="currentColor"
					x={minPoint.x}
					y={minPoint.y + 12}
					text-anchor="middle"
					font-size="10"
				>
					{formatValue(minPoint.value)}
				</text>

				<!-- Main curve -->
				{#if scaledPoints.length >= 2}
					<path
						d={pathData}
						fill="none"
						stroke="var(--color-accent,currentColor)"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				{/if}

				<!-- Data points -->
				{#each scaledPoints as point (point.season)}
					<circle cx={point.x} cy={point.y} r="2" fill="var(--color-accent,currentColor)" />
				{/each}

				<!-- Season labels -->
				{#each scaledPoints as point, i (point.season)}
					{#if i === 0 || i === scaledPoints.length - 1 || scaledPoints.length <= 4}
						<text
							class="fill-current/50"
							x={point.x}
							y={height - 2}
							text-anchor="middle"
							font-size="10"
						>
							'{String(point.season).slice(-2)}
						</text>
					{/if}
				{/each}
			</svg>
		{/if}
	</figure>
{/if}
