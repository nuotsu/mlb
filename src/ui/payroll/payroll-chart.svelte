<script lang="ts" module>
	export const CHARTS = [
		{ id: 'scatter', label: 'Scatter' },
		{ id: 'bars', label: 'Bars' },
	] as const

	export type Chart = (typeof CHARTS)[number]['id']

	export type PayrollTeam = {
		team: MLB.Team
		wins: number
		losses: number
		winningPercentage: string
		/** `AL`/`NL` */
		league?: string
		/** `East`/`Central`/`West` */
		region?: string
		payroll: number
		luxuryTaxPayroll: number | null
		rank: number
	}
</script>

<script lang="ts">
	import { formatPayroll, linearRegression, ticks } from '#lib/payroll.js'
	import { cn, ordinal } from '#lib/utils.js'

	let {
		teams,
		chart,
		threshold,
		class: className,
	}: {
		teams: PayrollTeam[]
		chart: Chart
		/** Luxury tax threshold, in dollars */
		threshold: number | null
		class?: string
	} = $props()

	const uid = $props.id()

	const REGIONS = ['East', 'Central', 'West'] as const
	const LEAGUES = ['AL', 'NL'] as const

	/** Fill for a division: hue by region, with stripes marking the NL so no two divisions match. */
	const divisionFill = (league?: string, region?: string) =>
		!region
			? 'currentColor'
			: league === 'NL'
				? `url(#${uid}-nl-${region.toLowerCase()})`
				: `var(--${region.toLowerCase()})`

	/** Pixels; the SVG draws at 1:1 so text and logos keep their size as the chart widens. */
	let width = $state(640)

	const narrow = $derived(width < 480)

	// --- Scatter ---

	const M = 1e6
	const scatter = $derived.by(() => {
		const margin = { top: 24, right: 16, bottom: 40, left: 44 }
		const height = Math.round(Math.min(Math.max(width * 0.62, 320), 560))
		/** Logos shrink with the chart so 30 of them stay legible on a phone. */
		const logo = Math.round(Math.min(Math.max(width / 24, 18), 34))

		const payrolls = teams.map(({ payroll }) => payroll / M)
		const pcts = teams.map(({ winningPercentage }) => Number(winningPercentage))
		const xs = ticks(
			Math.min(...payrolls, (threshold ?? Infinity) / M) - 5,
			Math.max(...payrolls, (threshold ?? 0) / M) + 5,
			narrow ? 100 : 50,
		)
		const ys = ticks(Math.min(...pcts, 0.5) - 0.01, Math.max(...pcts, 0.5) + 0.01, 0.05)

		const [x0, x1] = [xs[0], xs.at(-1)!]
		const [y0, y1] = [ys[0], ys.at(-1)!]
		const x = (millions: number) =>
			margin.left + ((millions - x0) / (x1 - x0)) * (width - margin.left - margin.right)
		const y = (pct: number) =>
			height - margin.bottom - ((pct - y0) / (y1 - y0)) * (height - margin.top - margin.bottom)

		const fit = linearRegression(teams.map((t, i) => ({ x: payrolls[i], y: pcts[i] })))
		const trend = fit && {
			x1: x(x0),
			y1: y(fit.slope * x0 + fit.intercept),
			x2: x(x1),
			y2: y(fit.slope * x1 + fit.intercept),
		}

		return { margin, height, logo, xs, ys, x, y, trend, top: y(y1), bottom: y(y0) }
	})

	// --- Bars ---

	const bars = $derived.by(() => {
		const row = 30
		const thickness = 18
		const margin = { top: 28, right: 56, bottom: 8, left: 72 }
		const height = margin.top + teams.length * row + margin.bottom
		const max = Math.max(...teams.map(({ payroll }) => payroll), threshold ?? 0)
		const x = (dollars: number) =>
			margin.left + (dollars / max) * (width - margin.left - margin.right)

		/** Highest payroll on top */
		const order = new Map(
			teams.toSorted((a, b) => b.payroll - a.payroll).map(({ team }, i) => [team.id, i]),
		)
		const y = (teamId: number) => margin.top + (order.get(teamId) ?? 0) * row + row / 2

		return { row, thickness, margin, height, x, y }
	})

	const height = $derived(chart === 'scatter' ? scatter.height : bars.height)
	const thresholdX = $derived(
		threshold === null ? null : chart === 'scatter' ? scatter.x(threshold / M) : bars.x(threshold),
	)

	/** Where each team's logo sits, centered, and how big it's drawn. */
	function position({ team, payroll, winningPercentage }: PayrollTeam) {
		return chart === 'scatter'
			? {
					x: scatter.x(payroll / M),
					y: scatter.y(Number(winningPercentage)),
					size: scatter.logo,
				}
			: { x: bars.margin.left - 56, y: bars.y(team.id), size: 22 }
	}

	/** A bar with only its data end rounded, so it reads as growing from the baseline. */
	function barPath(x0: number, x1: number, cy: number, h: number) {
		const r = Math.min(4, (x1 - x0) / 2, h / 2)
		const top = cy - h / 2
		return `M${x0},${top}H${x1 - r}A${r},${r} 0 0 1 ${x1},${top + r}V${top + h - r}A${r},${r} 0 0 1 ${x1 - r},${top + h}H${x0}Z`
	}

	// --- Tooltip ---

	let active = $state<number | null>(null)
	/** Opened by a tap, so it stays until the next tap elsewhere and its link can be followed. */
	let pinned = $state(false)
	let lastPointer = 'mouse'
	let tooltipWidth = $state(0)
	let tooltipHeight = $state(0)

	/** `true` once a logo loads, `false` if it fails; until it loads, a dot stands in. */
	let loaded = $state<Record<number, boolean>>({})
	/** Logos wait for the browser, so none can finish loading before its `onload` is listening. */
	let mounted = $state(false)

	$effect(() => {
		mounted = true
	})

	const activeTeam = $derived(teams.find(({ team }) => team.id === active))

	const tooltip = $derived.by(() => {
		if (!activeTeam) return null
		const { x, y, size } = position(activeTeam)
		const anchorX = chart === 'bars' ? bars.x(activeTeam.payroll) : x
		const left = Math.min(Math.max(anchorX - tooltipWidth / 2, 0), width - tooltipWidth)
		const above = y - size / 2 - 8 - tooltipHeight
		return { left, top: above >= 0 ? above : y + size / 2 + 8 }
	})

	function onclick(e: MouseEvent, teamId: number) {
		// On touch there's no hover, so the first tap shows the tooltip and the second follows the link.
		if (lastPointer === 'touch' && !(pinned && active === teamId)) {
			e.preventDefault()
			active = teamId
			pinned = true
		}
	}

	function dismiss(e: PointerEvent) {
		if (pinned && !(e.target as Element).closest?.('[data-payroll-team], [data-payroll-tooltip]')) {
			pinned = false
			active = null
		}
	}

	function label({ team, payroll, wins, losses, winningPercentage, rank }: PayrollTeam) {
		return `${team.name}: ${formatPayroll(payroll)} payroll, ${ordinal(rank)} in MLB; ${wins}-${losses}, ${winningPercentage}`
	}
</script>

<svelte:window onpointerdown={dismiss} />

<div
	class={cn(
		'relative [--central:#eb6834] [--east:#2a78d6] [--west:#1baf7a] dark:[--central:#d95926] dark:[--east:#3987e5] dark:[--west:#199e70]',
		className,
	)}
	bind:clientWidth={width}
>
	{#if chart === 'bars'}
		<ul
			class="mb-ch flex flex-wrap justify-center gap-x-[2ch] gap-y-[.5ch] text-xs text-current/70"
		>
			{#each LEAGUES as league (league)}
				{#each REGIONS as region (region)}
					<li class="flex items-center gap-[.5ch]">
						<svg class="size-[1.25em]" viewBox="0 0 12 12" aria-hidden="true">
							<rect width="12" height="12" rx="2" fill={divisionFill(league, region)} />
						</svg>
						{league}
						{region}
					</li>
				{/each}
			{/each}
		</ul>
	{/if}

	<svg
		class="block w-full overflow-visible transition-[height] duration-500 ease-out select-none motion-reduce:transition-none"
		style:height="{height}px"
		role="group"
		aria-label={chart === 'scatter' ? 'Payroll vs. win percentage' : 'Payroll by team'}
		onpointerdown={(e) => (lastPointer = e.pointerType)}
	>
		<defs>
			{#each REGIONS as region (region)}
				<pattern
					id="{uid}-nl-{region.toLowerCase()}"
					patternUnits="userSpaceOnUse"
					width="6"
					height="6"
					patternTransform="rotate(45)"
				>
					<rect width="6" height="6" fill="var(--{region.toLowerCase()})" />
					<rect width="2" height="6" class="fill-background" opacity=".55" />
				</pattern>
			{/each}
		</defs>

		<!-- Scatter axes -->
		<g
			class={cn(
				'transition-opacity duration-500 motion-reduce:transition-none',
				chart !== 'scatter' && 'opacity-0',
			)}
			aria-hidden="true"
		>
			{#each scatter.xs as tick (tick)}
				{@const x = scatter.x(tick)}
				<line
					x1={x}
					x2={x}
					y1={scatter.top}
					y2={scatter.bottom}
					class="stroke-current"
					stroke-opacity=".08"
				/>
				<text
					{x}
					y={scatter.bottom + 16}
					text-anchor="middle"
					class="fill-current text-[11px] tabular-nums"
					fill-opacity=".5">${tick}M</text
				>
			{/each}
			{#each scatter.ys as tick (tick)}
				{@const y = scatter.y(tick)}
				<line
					x1={scatter.margin.left}
					x2={width - scatter.margin.right}
					y1={y}
					y2={y}
					class="stroke-current"
					stroke-opacity={tick === 0.5 ? 0.35 : 0.08}
				/>
				<text
					x={scatter.margin.left - 6}
					y={y + 4}
					text-anchor="end"
					class="fill-current text-[11px] tabular-nums"
					fill-opacity=".5">{tick.toFixed(3).replace(/^0/, '')}</text
				>
			{/each}
			<text
				x={(scatter.margin.left + width - scatter.margin.right) / 2}
				y={scatter.height - 4}
				text-anchor="middle"
				class="fill-current text-[11px]"
				fill-opacity=".5">Payroll</text
			>
			<text
				transform="translate(10 {(scatter.top + scatter.bottom) / 2}) rotate(-90)"
				text-anchor="middle"
				class="fill-current text-[11px]"
				fill-opacity=".5">Win %</text
			>

			{#if scatter.trend}
				{@const { x1, y1, x2, y2 } = scatter.trend}
				<line
					{x1}
					{y1}
					{x2}
					{y2}
					class="stroke-current"
					stroke-opacity=".3"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<text
					x={x2 - 4}
					y={y2 + (y2 > y1 ? 14 : -6)}
					text-anchor="end"
					class="fill-current text-[11px]"
					fill-opacity=".5">Trend</text
				>
			{/if}
		</g>

		<!-- Luxury tax threshold, shared by both charts -->
		{#if threshold !== null && thresholdX !== null}
			<g
				class="transition-transform duration-500 ease-out motion-reduce:transition-none"
				style:transform="translateX({thresholdX}px)"
				aria-hidden="true"
			>
				<line
					y1={chart === 'scatter' ? scatter.top - 8 : bars.margin.top - 8}
					y2={chart === 'scatter' ? scatter.bottom : bars.height - bars.margin.bottom}
					class="stroke-current"
					stroke-opacity=".6"
					stroke-dasharray="4 4"
				/>
				<text
					y={chart === 'scatter' ? scatter.top - 12 : bars.margin.top - 12}
					text-anchor="middle"
					class="fill-current text-[11px] tabular-nums"
					fill-opacity=".7">CBT {formatPayroll(threshold, 0)}</text
				>
			</g>
		{/if}

		{#each teams as t (t.team.id)}
			{@const { team, payroll, league, region } = t}
			{@const { x, y, size } = position(t)}
			{@const isBars = chart === 'bars'}
			<a
				href="/teams/{team.id}"
				class="outline-none"
				aria-label={label(t)}
				data-payroll-team
				onpointerenter={(e) => {
					if (e.pointerType === 'touch') return
					active = team.id
					pinned = false
				}}
				onpointerleave={() => {
					if (!pinned) active = null
				}}
				onfocus={() => (active = team.id)}
				onblur={() => {
					if (!pinned) active = null
				}}
				onclick={(e) => onclick(e, team.id)}
			>
				<g
					class={cn(
						'transition-opacity duration-200',
						active !== null && active !== team.id && 'opacity-40',
					)}
				>
					<!-- Bars: the whole row is the hit target -->
					<rect
						x="0"
						y={bars.y(team.id) - bars.row / 2}
						{width}
						height={bars.row}
						class={cn(
							'fill-current opacity-0',
							active === team.id && isBars && 'opacity-5',
							!isBars && 'hidden',
						)}
					/>
					<path
						d={barPath(bars.margin.left, bars.x(payroll), bars.y(team.id), bars.thickness)}
						fill={divisionFill(league, region)}
						class={cn(
							'origin-left transition-[scale,opacity] duration-500 ease-out [transform-box:fill-box] motion-reduce:transition-none',
							!isBars && 'scale-x-0 opacity-0',
						)}
					/>
					<g
						class={cn(
							'text-[12px] tabular-nums transition-opacity duration-300 motion-reduce:transition-none',
							// Labels follow the bars in, once they've mostly grown to meet them
							isBars ? 'delay-300' : 'opacity-0',
						)}
					>
						<text x={bars.margin.left - 40} y={bars.y(team.id) + 4} class="fill-current">
							{team.abbreviation}
						</text>
						<text
							x={bars.x(payroll) + 6}
							y={bars.y(team.id) + 4}
							class="fill-current"
							fill-opacity=".7">{formatPayroll(payroll, narrow ? 0 : 1)}</text
						>
					</g>

					<!-- The logo, which moves between the two charts -->
					<g
						class="transition-transform duration-500 ease-out motion-reduce:transition-none"
						style:transform="translate({x}px, {y}px) scale({size})"
					>
						<circle r=".7" class="fill-transparent" />
						<circle
							r=".5"
							class={cn('fill-none stroke-accent opacity-0', active === team.id && 'opacity-100')}
							stroke-width={2 / size}
						/>
						{#if !loaded[team.id]}
							<circle r=".18" class="fill-current" fill-opacity=".6" />
						{/if}
						{#if mounted && loaded[team.id] !== false}
							<image
								href="https://www.mlbstatic.com/team-logos/team-cap-on-dark/{team.id}.svg"
								x="-.4"
								y="-.4"
								width=".8"
								height=".8"
								onload={() => (loaded[team.id] = true)}
								onerror={() => (loaded[team.id] = false)}
							/>
						{/if}
					</g>
				</g>
			</a>
		{/each}
	</svg>

	{#if activeTeam && tooltip}
		{@const { team, payroll, luxuryTaxPayroll, wins, losses, winningPercentage, rank } = activeTeam}
		<div
			class={cn(
				'absolute z-10 grid w-max max-w-[min(24ch,100%)] gap-[.25ch] border border-current/25 bg-background/90 p-ch text-sm shadow-lg backdrop-blur-xs',
				!pinned && 'pointer-events-none',
			)}
			style:left="{tooltip.left}px"
			style:top="{tooltip.top}px"
			bind:offsetWidth={tooltipWidth}
			bind:offsetHeight={tooltipHeight}
			data-payroll-tooltip
			role="tooltip"
		>
			<strong class="leading-tight">{team.name}</strong>
			<dl class="grid grid-cols-[auto_auto] gap-x-ch tabular-nums *:odd:text-current/50">
				<dt>Payroll</dt>
				<dd class="text-right">
					{formatPayroll(payroll)} <small class="text-current/50">({ordinal(rank)})</small>
				</dd>
				{#if luxuryTaxPayroll}
					<dt>CBT payroll</dt>
					<dd class="text-right">{formatPayroll(luxuryTaxPayroll)}</dd>
				{/if}
				<dt>Record</dt>
				<dd class="text-right">{wins}-{losses}</dd>
				<dt>Win %</dt>
				<dd class={cn('text-right', Number(winningPercentage) >= 0.5 ? 'positive' : 'negative')}>
					{winningPercentage}
				</dd>
			</dl>
			<a href="/teams/{team.id}" class="text-xs link">Team page</a>
		</div>
	{/if}
</div>
