<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		zones = [],
		aspect = [17, 24],
		class: className = '',
		...props
	}: {
		zones?: MLB.HotColdZone[]
		aspect?: [number, number]
		class?: string
	} & HTMLAttributes<HTMLElement> = $props()

	const zoneTemp = $derived(Object.fromEntries(zones.map((z) => [z.zone, z.temp])))
	const zoneValue = $derived(Object.fromEntries(zones.map((z) => [z.zone, z.value])))

	const r = (n: number) => Math.round(n * 10) / 10

	const W = 200
	const H = $derived(r(W * (aspect[1] / aspect[0])))

	// Strike zone dimensions (centered, 70% of total)
	const szW = W * 0.7
	const szH = $derived(r(H * 0.7))
	const szX = W * 0.15
	const szY = $derived(r(H * 0.15))

	// Cell dimensions
	const cellW = r(szW / 3)
	const cellH = $derived(r(szH / 3))

	// Outside zone midpoints
	const midX = W / 2
	const midY = $derived(r(H / 2))

	const innerZones = $derived(
		Array.from({ length: 9 }, (_, i) => ({
			zone: String(i + 1).padStart(2, '0'),
			x: r(szX + (i % 3) * cellW),
			y: r(szY + Math.floor(i / 3) * cellH),
		})),
	)
</script>

<figure class="grid w-full place-content-center {className}" {...props}>
	<svg viewBox="0 0 {W} {H}" class="w-full p-px">
		<path
			data-zone="11"
			data-temp={zoneTemp['11'] ?? ''}
			d="M0 0 L{midX} 0 L{midX} {szY} L{szX} {szY} L{szX} {midY} L0 {midY} Z"
			fill="transparent"
			stroke="currentColor"
			stroke-width="1"
		/>
		<text
			class="text-current/50"
			x={r(szX / 2)}
			y={r(szY / 2 - 9)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="8">11</text
		>
		<text
			x={r(szX / 2)}
			y={r(szY / 2 + 3)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="10">{zoneValue['11'] ?? ''}</text
		>

		<path
			data-zone="12"
			data-temp={zoneTemp['12'] ?? ''}
			d="M{midX} 0 L{W} 0 L{W} {midY} L{szX + szW} {midY} L{szX + szW} {szY} L{midX} {szY} Z"
			fill="transparent"
			stroke="currentColor"
			stroke-width="1"
		/>
		<text
			class="text-current/50"
			x={r(W - szX / 2)}
			y={r(szY / 2 - 9)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="8">12</text
		>
		<text
			x={r(W - szX / 2)}
			y={r(szY / 2 + 3)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="10">{zoneValue['12'] ?? ''}</text
		>

		<path
			data-zone="13"
			data-temp={zoneTemp['13'] ?? ''}
			d="M0 {midY} L{szX} {midY} L{szX} {szY + szH} L{midX} {szY + szH} L{midX} {H} L0 {H} Z"
			fill="transparent"
			stroke="currentColor"
			stroke-width="1"
		/>
		<text
			class="text-current/50"
			x={r(szX / 2)}
			y={r(H - szY / 2 - 5)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="8">13</text
		>
		<text
			x={r(szX / 2)}
			y={r(H - szY / 2 + 7)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="10">{zoneValue['13'] ?? ''}</text
		>

		<path
			data-zone="14"
			data-temp={zoneTemp['14'] ?? ''}
			d="M{szX + szW} {midY} L{W} {midY} L{W} {H} L{midX} {H} L{midX} {szY + szH} L{szX +
				szW} {szY + szH} Z"
			fill="transparent"
			stroke="currentColor"
			stroke-width="1"
		/>
		<text
			class="text-current/50"
			x={r(W - szX / 2)}
			y={r(H - szY / 2 - 5)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="8">14</text
		>
		<text
			x={r(W - szX / 2)}
			y={r(H - szY / 2 + 7)}
			text-anchor="middle"
			dominant-baseline="central"
			fill="currentColor"
			font-size="10">{zoneValue['14'] ?? ''}</text
		>

		{#each innerZones as iz (iz.zone)}
			<rect
				data-zone={iz.zone}
				data-temp={zoneTemp[iz.zone] ?? ''}
				x={iz.x}
				y={iz.y}
				width={cellW}
				height={cellH}
				fill="transparent"
				stroke="currentColor"
				stroke-width="1"
			/>
			<text
				class="text-current/50"
				x={r(iz.x + cellW / 2)}
				y={r(iz.y + cellH / 2 - 5)}
				text-anchor="middle"
				dominant-baseline="central"
				fill="currentColor"
				font-size="8">{iz.zone}</text
			>
			<text
				x={r(iz.x + cellW / 2)}
				y={r(iz.y + cellH / 2 + 7)}
				text-anchor="middle"
				dominant-baseline="central"
				fill="currentColor"
				font-size="10">{zoneValue[iz.zone] ?? ''}</text
			>
		{/each}

		<!-- Strike zone border -->
		<rect
			x={szX}
			y={szY}
			width={szW}
			height={szH}
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		/>
	</svg>
</figure>

<style>
	[data-temp='hot'] {
		fill: color-mix(in srgb, var(--color-green-600) 60%, transparent);
	}
	[data-temp='warm'] {
		fill: color-mix(in srgb, var(--color-green-600) 45%, transparent);
	}
	[data-temp='lukewarm'] {
		fill: color-mix(in srgb, var(--color-green-600) 30%, transparent);
	}
	[data-temp='cool'] {
		fill: color-mix(in srgb, var(--color-green-600) 15%, transparent);
	}
	[data-temp='cold'] {
		fill: color-mix(in srgb, var(--color-green-600) 0%, transparent);
	}
</style>
