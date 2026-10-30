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
		payroll: number
		luxuryTaxPayroll: number | null
		rank: number
	}
</script>

<script lang="ts">
	import { formatPayroll, linearRegression, ticks } from '#lib/payroll.js'
	import { teamColor } from '#lib/team-colors.js'
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

	/** Pixels; the SVG draws at 1:1 so text and logos keep their size as the chart widens. */
	let width = $state(640)

	const narrow = $derived(width < 480)

	// --- Scatter ---

	const M = 1e6
	const scatter = $derived.by(() => {
		const margin = { top: 24, right: 16, bottom: 40, left: 44 }
		const height = Math.round(Math.min(Math.max(width * 0.62, 320), 560))
		/** Avatars shrink with the chart so 30 of them stay legible on a phone. */
		const avatar = Math.round(Math.min(Math.max(width / 22, 20), 36))

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

		return { margin, height, avatar, xs, ys, x, y, trend, top: y(y1), bottom: y(y0) }
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

	/** Where each team's avatar sits, centered, and its diameter. */
	function position({ team, payroll, winningPercentage }: PayrollTeam) {
		return chart === 'scatter'
			? {
					x: scatter.x(payroll / M),
					y: scatter.y(Number(winningPercentage)),
					size: scatter.avatar,
				}
			: { x: bars.margin.left - 56, y: bars.y(team.id), size: 24 }
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

	/**
	 * Like `TeamAvatar`: the cap logo on the team's color, then the team's "spots" artwork if the
	 * cap fails, then the bare color.
	 */
	let logos = $state<Record<number, 'fallback' | 'failed'>>({})
	/** Logos wait for the browser, so none can fail before its `onerror` is listening. */
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

<div class={cn('relative', className)} bind:clientWidth={width}>
	<svg
		class="block w-full overflow-visible transition-[height] duration-500 ease-out select-none motion-reduce:transition-none"
		style:height="{height}px"
		role="group"
		aria-label={chart === 'scatter' ? 'Payroll vs. win percentage' : 'Payroll by team'}
		onpointerdown={(e) => (lastPointer = e.pointerType)}
	>
		<defs>
			<!-- In each avatar's own units, where it's a circle of diameter 1 -->
			<clipPath id="{uid}-avatar">
				<circle r=".5" />
			</clipPath>
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
			{@const { team, payroll } = t}
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
						fill={teamColor(team.id)}
						stroke-width="1"
						class={cn(
							// The darkest team colors need an edge to stand off a black background
							'stroke-transparent dark:stroke-white/25',
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
						<text x={bars.margin.left - 38} y={bars.y(team.id) + 4} class="fill-current">
							{team.abbreviation}
						</text>
						<text
							x={bars.x(payroll) + 6}
							y={bars.y(team.id) + 4}
							class="fill-current"
							fill-opacity=".7">{formatPayroll(payroll, narrow ? 0 : 1)}</text
						>
					</g>

					<!-- The avatar, which moves between the two charts. Drawn at diameter 1, then scaled. -->
					<g
						class="transition-transform duration-500 ease-out motion-reduce:transition-none"
						style:transform="translate({x}px, {y}px) scale({size})"
					>
						<circle r=".7" class="fill-transparent" />
						<!-- A ring of background keeps overlapping avatars apart -->
						<circle r={0.5 + 2 / size} class="fill-background" />
						<!-- The team's color doubles as the placeholder until a logo loads -->
						<circle r=".5" fill={teamColor(team.id)} />
						{#if mounted && logos[team.id] === 'fallback'}
							<image
								href="https://midfield.mlbstatic.com/v1/team/{team.id}/spots/72"
								x="-.5"
								y="-.5"
								width="1"
								height="1"
								preserveAspectRatio="xMidYMid slice"
								clip-path="url(#{uid}-avatar)"
								onerror={() => (logos[team.id] = 'failed')}
							/>
						{:else if mounted && !logos[team.id]}
							<image
								href="https://www.mlbstatic.com/team-logos/team-cap-on-dark/{team.id}.svg"
								x="-.32"
								y="-.32"
								width=".64"
								height=".64"
								onerror={() => (logos[team.id] = 'fallback')}
							/>
						{/if}
						<circle
							r={0.5 + 1 / size}
							class={cn('fill-none stroke-accent opacity-0', active === team.id && 'opacity-100')}
							stroke-width={2 / size}
						/>
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
