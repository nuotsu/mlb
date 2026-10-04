<script lang="ts">
	import type { MissedCall } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'
	import type { SVGAttributes } from 'svelte/elements'

	let {
		misses,
		class: className,
		...props
	}: { misses: MissedCall[] } & SVGAttributes<SVGSVGElement> = $props()

	/** Zone drawn 2ft tall; every pitch's height is scaled to the batter's own zone. */
	const ZONE_HEIGHT = 2
	const HALF_PLATE = 8.5 / 12
	const BALL_RADIUS = 1.45 / 12
	const [X, Y, W, H] = [-1.5, -1.1, 3, 4.2]

	const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
</script>

<svg
	class={cn('aspect-[3/4.2] overflow-visible', className)}
	viewBox="{X} {Y} {W} {H}"
	role="img"
	aria-label="{misses.length} missed calls, catcher's view"
	{...props}
>
	<g transform="scale(1 -1) translate(0 {-(2 * Y + H)})">
		<rect
			x={-HALF_PLATE}
			y={0}
			width={HALF_PLATE * 2}
			height={ZONE_HEIGHT}
			class="fill-current/5 stroke-current/40"
			stroke-width="0.03"
		/>
		{#each [1, 2] as i (i)}
			<line
				x1={-HALF_PLATE + (i * HALF_PLATE * 2) / 3}
				x2={-HALF_PLATE + (i * HALF_PLATE * 2) / 3}
				y1={0}
				y2={ZONE_HEIGHT}
				class="stroke-current/10"
				stroke-width="0.02"
			/>
			<line
				x1={-HALF_PLATE}
				x2={HALF_PLATE}
				y1={(i * ZONE_HEIGHT) / 3}
				y2={(i * ZONE_HEIGHT) / 3}
				class="stroke-current/10"
				stroke-width="0.02"
			/>
		{/each}

		<!-- Home plate, catcher's view -->
		<path
			d="M{-HALF_PLATE} -0.75 h{HALF_PLATE * 2} v-0.12 l{-HALF_PLATE} -0.15 l{-HALF_PLATE} 0.15 z"
			class="fill-current/10"
		/>

		{#each misses as miss, i (i)}
			<circle
				cx={clamp(miss.pX, X + BALL_RADIUS, X + W - BALL_RADIUS)}
				cy={clamp(miss.zone * ZONE_HEIGHT, -0.6, Y + H - BALL_RADIUS)}
				r={BALL_RADIUS}
				class={cn(
					miss.call === 'strike' ? 'fill-red-500 stroke-red-500' : 'fill-sky-500/15 stroke-sky-500',
				)}
				stroke-width="0.035"
			>
				<title>
					{miss.call === 'strike' ? 'Called strike' : 'Called ball'}, {miss.inches.toFixed(1)}in {miss.call ===
					'strike'
						? 'off'
						: 'inside'} · {miss.inning}{miss.count ? ` · ${miss.count}` : ''}
				</title>
			</circle>
		{/each}
	</g>
</svg>
