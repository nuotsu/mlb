<script lang="ts">
	import { pitchSpeedColor } from '$lib/colors'
	import { cn } from '$lib/utils'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'
	import Headshot from '$ui/player/headshot.svelte'

	let {
		plays,
		players,
		status,
		pinnedIndex = $bindable(null),
	}: {
		plays?: MLB.Plays
		players?: Record<string, MLB.Person>
		status?: MLB.GameStatus
		/** `null` means follow `defaultIndex` as new at-bats arrive. */
		pinnedIndex?: number | null
	} = $props()

	const allPlays = $derived(plays?.allPlays ?? [])
	const lastIndex = $derived(Math.max(0, allPlays.length - 1))

	/** Completed games read from the first at-bat; live ones follow the latest. */
	const isFinal = $derived(status?.abstractGameState === 'Final')
	const defaultIndex = $derived(isFinal ? 0 : lastIndex)

	const selectedIndex = $derived(pinnedIndex ?? defaultIndex)

	let hoveredPitch = $state<number | null>(null)
	let pitchListEl = $state<HTMLOListElement | null>(null)

	$effect(() => {
		if (hoveredPitch == null || !pitchListEl) return
		const item = pitchListEl.querySelector<HTMLElement>(`[data-pitch="${hoveredPitch}"]`)
		item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	})

	function go(delta: number) {
		const next = Math.min(lastIndex, Math.max(0, selectedIndex + delta))
		pinnedIndex = next === defaultIndex ? null : next
		hoveredPitch = null
	}

	const play = $derived(allPlays[selectedIndex])
	const pitches = $derived(play?.playEvents?.filter((e) => e.isPitch) ?? [])
	const hitData = $derived(play?.playEvents?.find((e) => e.hitData)?.hitData)
	const hitHasOut = $derived(Boolean(play?.about?.hasOut))
	const hitIsScoring = $derived(Boolean(play?.about?.isScoringPlay) || (play?.result?.rbi ?? 0) > 0)
	const hitOutcomeLabel = $derived.by(() => {
		const eventType = play?.result?.eventType
		switch (eventType) {
			case 'single':
				return 'Single'
			case 'double':
				return 'Double'
			case 'triple':
				return 'Triple'
			case 'home_run':
				return 'HR'
			default:
				return hitHasOut ? null : (play?.result?.event ?? null)
		}
	})
	const hrDistance = $derived(
		play?.result?.eventType === 'home_run' && hitData?.totalDistance != null
			? Math.round(hitData.totalDistance)
			: null,
	)
	const count = $derived(play?.count)
	const balls = $derived(count?.balls ?? 0)
	const strikes = $derived(count?.strikes ?? 0)
	const outs = $derived(count?.outs ?? 0)

	/** SVG has no z-index — paint order is document order, so draw the hovered pitch last. */
	const paintOrder = $derived.by(() => {
		const order = pitches.map((_, i) => i)
		if (hoveredPitch == null || hoveredPitch >= order.length) return order
		return [...order.filter((i) => i !== hoveredPitch), hoveredPitch]
	})

	const isLefty = $derived(play?.matchup?.batSide?.code === 'L')
	const pitchHand = $derived(play?.matchup?.pitchHand?.code)
	const batSide = $derived(play?.matchup?.batSide?.code)

	const pitcher = $derived(play?.matchup?.pitcher)
	const batter = $derived(play?.matchup?.batter)

	function lastName(person?: MLB.Person) {
		if (!person) return ''
		const fromRoster =
			person.id != null ? (players?.[`ID${person.id}`] as MLB.Person | undefined) : undefined
		return (
			fromRoster?.lastName ??
			person.lastName ??
			fromRoster?.boxscoreName ??
			person.boxscoreName ??
			''
		)
	}

	function ordinal(n: number) {
		const s = ['th', 'st', 'nd', 'rd']
		const v = n % 100
		return n + (s[(v - 20) % 10] || s[v] || s[0])
	}

	const playsByHalfInning = $derived.by(() => {
		const groups: {
			key: string
			label: string
			plays: { play: MLB.Play; index: number }[]
		}[] = []

		allPlays.forEach((play, index) => {
			const inning = play.about.inning
			const isTop = play.about.isTopInning
			const key = `${inning}-${isTop ? 'top' : 'bot'}`
			let group = groups.find((g) => g.key === key)
			if (!group) {
				group = {
					key,
					label: `${isTop ? 'Top' : 'Bot'} ${ordinal(inning)}`,
					plays: [],
				}
				groups.push(group)
			}
			group.plays.push({ play, index })
		})

		return groups
	})

	function matchupOptionLabel(p: MLB.Play) {
		return `${lastName(p.matchup?.pitcher)} vs ${lastName(p.matchup?.batter)}`
	}

	function selectAtBat(index: number) {
		pinnedIndex = index === defaultIndex ? null : index
		hoveredPitch = null
	}

	function pitchTypeLabel(description?: string) {
		if (description === 'Four-Seam Fastball') return '4-Seam Fastball'
		if (description === 'Two-Seam Fastball') return '2-Seam Fastball'
		return description ?? ''
	}

	function pitchColor(details?: MLB.PitchDetails) {
		if (details?.isBall) return 'var(--color-accent)'
		if (details?.isStrike) return 'var(--color-yellow-300)'
		if (details?.isInPlay) return 'var(--color-blue-500)'
		return 'var(--color-foreground)'
	}

	// Strike zone geometry (feet → SVG). Plate is 17" wide.
	const PLATE_HALF = 17 / 24
	const PAD = 0.9
	const W = 200
	const H = 240
	/** Stretch height vs width so the zone reads taller. */
	const Z_STRETCH = 1.2

	const zone = $derived.by(() => {
		const tops = pitches
			.map((p) => p.pitchData?.strikeZoneTop)
			.filter((v): v is number => typeof v === 'number')
		const bottoms = pitches
			.map((p) => p.pitchData?.strikeZoneBottom)
			.filter((v): v is number => typeof v === 'number')
		const top = tops.length ? tops.reduce((a, b) => a + b, 0) / tops.length : 3.5
		const bottom = bottoms.length ? bottoms.reduce((a, b) => a + b, 0) / bottoms.length : 1.5
		return { top, bottom }
	})

	/** Simple quadratic from above the zone down into the plate. */
	function curvePoints(pitch: MLB.PlayEvent): { x: number; z: number }[] | null {
		const c = pitch.pitchData?.coordinates
		if (c?.pX == null || c?.pZ == null) return null

		const breakX = (c.pfxX ?? 0) / 12

		const releaseX = c.x0 ?? c.pX - breakX
		const releaseZ = c.z0 ?? zone.top + 2.4
		// Keep release X lean, but pull start height down toward the zone
		const startX = releaseX * 0.55 + c.pX * 0.45
		const startZ = zone.top + (releaseZ - zone.top) * 0.28

		const ctrlX = (startX + c.pX) / 2 + breakX * 0.35
		const ctrlZ = startZ * 0.45 + c.pZ * 0.55

		const steps = 20
		const points: { x: number; z: number }[] = []
		for (let i = 0; i <= steps; i++) {
			const t = i / steps
			const u = 1 - t
			points.push({
				x: u * u * startX + 2 * u * t * ctrlX + t * t * c.pX,
				z: u * u * startZ + 2 * u * t * ctrlZ + t * t * c.pZ,
			})
		}
		return points
	}

	const view = $derived.by(() => {
		let xMin = -PLATE_HALF - PAD
		let xMax = PLATE_HALF + PAD
		let zMin = zone.bottom - PAD
		let zMax = zone.top + PAD

		for (const pitch of pitches) {
			const c = pitch.pitchData?.coordinates
			if (c?.pX != null) {
				xMin = Math.min(xMin, c.pX - 0.2)
				xMax = Math.max(xMax, c.pX + 0.2)
			}
			if (c?.pZ != null) {
				zMin = Math.min(zMin, c.pZ - 0.2)
				zMax = Math.max(zMax, c.pZ + 0.2)
			}
			const path = curvePoints(pitch)
			if (path) {
				for (const pt of path) {
					xMin = Math.min(xMin, pt.x - 0.1)
					xMax = Math.max(xMax, pt.x + 0.1)
					zMin = Math.min(zMin, pt.z - 0.1)
					zMax = Math.max(zMax, pt.z + 0.1)
				}
			}
		}

		const xRange = xMax - xMin
		const zRange = zMax - zMin
		const topPad = 4
		let scaleX = W / xRange
		let scaleZ = scaleX * Z_STRETCH
		const usedH = zRange * scaleZ
		if (usedH > H - topPad) {
			const fit = (H - topPad) / usedH
			scaleX *= fit
			scaleZ *= fit
		}
		const usedW = xRange * scaleX

		return {
			xMin,
			zMax,
			scaleX,
			scaleZ,
			ox: (W - usedW) / 2,
			// Top-align so paths reach the top of the SVG instead of floating mid-frame
			oy: topPad + Math.max(0, (H - zRange * scaleZ - topPad) * 0.15),
		}
	})

	function toSvg(pX: number, pZ: number) {
		const { xMin, zMax, scaleX, scaleZ, ox, oy } = view
		return {
			x: ox + (pX - xMin) * scaleX,
			y: oy + (zMax - pZ) * scaleZ,
		}
	}

	const sz = $derived.by(() => {
		const tl = toSvg(-PLATE_HALF, zone.top)
		const br = toSvg(PLATE_HALF, zone.bottom)
		return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y }
	})

	function trajectoryPath(pitch: MLB.PlayEvent): string | null {
		const path = curvePoints(pitch)
		if (!path?.length) return null
		return path
			.map((pt) => {
				const { x, y } = toSvg(pt.x, pt.z)
				return `${x.toFixed(1)},${y.toFixed(1)}`
			})
			.join(' ')
	}
</script>

<div class="mx-ch flex h-full min-h-0 flex-col overflow-hidden border border-stroke text-sm">
	<header class="flex items-stretch gap-px border-b border-stroke">
		<button
			type="button"
			class="button shrink-0 disabled:opacity-25"
			disabled={selectedIndex <= 0}
			aria-label="Previous at-bat"
			onclick={() => go(-1)}
		>
			<ChevronLeftIcon />
		</button>

		<label
			class="relative flex min-w-0 grow cursor-pointer items-center justify-center gap-ch self-stretch px-ch py-[.2lh] text-xs hover:bg-foreground/5"
		>
			{#if pitcher}
				<span class="flex min-w-0 flex-row-reverse items-center gap-ch">
					<Headshot person={pitcher} class="size-rlh shrink-0" />
					<span class="truncate font-medium">{lastName(pitcher)}</span>
					{#if pitchHand}
						<span class="shrink-0 text-[xx-small] font-normal text-current/40">{pitchHand}</span>
					{/if}
				</span>
			{/if}

			{#if pitcher && batter}
				<span class="shrink-0 text-current/40">vs</span>
			{/if}

			{#if batter}
				<span class="flex min-w-0 items-center gap-ch">
					<Headshot person={batter} class="size-rlh shrink-0" />
					<span class="truncate font-medium">{lastName(batter)}</span>
					{#if batSide}
						<span class="shrink-0 text-[xx-small] font-normal text-current/40">{batSide}</span>
					{/if}
				</span>
			{/if}

			<select
				class="absolute inset-0 cursor-pointer opacity-0"
				aria-label="Select at-bat"
				value={selectedIndex}
				onchange={(e) => selectAtBat(Number(e.currentTarget.value))}
			>
				{#each playsByHalfInning as group (group.key)}
					<optgroup label={group.label}>
						{#each group.plays as { play: p, index: i } (p.about.atBatIndex)}
							<option value={i}>{matchupOptionLabel(p)}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>

		<button
			type="button"
			class="button shrink-0 disabled:opacity-25"
			disabled={selectedIndex >= lastIndex}
			aria-label="Next at-bat"
			onclick={() => go(1)}
		>
			<ChevronRightIcon />
		</button>
	</header>

	{#if !play}
		<p class="grid grow place-content-center p-ch text-center text-current/40">No at-bats</p>
	{:else if !pitches.length}
		<p class="grid grow place-content-center p-ch text-center text-current/40">No pitches yet</p>
	{:else}
		<div
			class={cn(
				'flex h-[10lh] shrink-0 items-stretch gap-ch overflow-hidden p-ch',
				!isLefty && 'flex-row-reverse',
			)}
			role="presentation"
			onmouseleave={() => (hoveredPitch = null)}
		>
			<div class="relative h-full min-w-0 grow basis-0">
				<svg
					viewBox="0 0 {W} {H}"
					class="absolute inset-0 h-full w-full text-current/40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<!-- 3×3 strike zone -->
					{#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
						{@const col = i % 3}
						{@const row = Math.floor(i / 3)}
						<rect
							x={sz.x + (col * sz.w) / 3}
							y={sz.y + (row * sz.h) / 3}
							width={sz.w / 3}
							height={sz.h / 3}
							fill="none"
							stroke="currentColor"
							stroke-width="0.75"
						/>
					{/each}
					<rect
						x={sz.x}
						y={sz.y}
						width={sz.w}
						height={sz.h}
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					/>

					{#each paintOrder as i (pitches[i].index ?? i)}
						{@const pitch = pitches[i]}
						{@const pX = pitch.pitchData?.coordinates?.pX}
						{@const pZ = pitch.pitchData?.coordinates?.pZ}
						{@const color = pitchColor(pitch.details)}
						{@const path = trajectoryPath(pitch)}
						{@const dimmed = hoveredPitch != null && hoveredPitch !== i}
						{@const active = hoveredPitch === i}

						<g
							class="cursor-pointer"
							opacity={dimmed ? 0.25 : 1}
							role="presentation"
							onmouseenter={() => (hoveredPitch = i)}
							onmouseleave={() => (hoveredPitch = null)}
						>
							{#if path}
								<!-- Wider invisible stroke for easier hover -->
								<polyline
									points={path}
									fill="none"
									stroke="transparent"
									stroke-width="12"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<polyline
									points={path}
									fill="none"
									stroke={color}
									stroke-width={active ? 3 : 1.5}
									stroke-opacity={active ? 0.9 : 0.45}
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							{/if}

							{#if pX != null && pZ != null}
								{@const { x, y } = toSvg(pX, pZ)}
								<circle cx={x} cy={y} r={active ? 8 : 7} fill={color} />
								<text
									{x}
									{y}
									text-anchor="middle"
									dominant-baseline="central"
									fill="var(--color-dark)"
									font-size="8"
									font-weight="bold">{i + 1}</text
								>
							{/if}
						</g>
					{/each}
				</svg>
			</div>

			<div class="flex max-h-full w-[14ch] shrink-0 flex-col gap-y-[.25ch]">
				<div
					class="flex shrink-0 items-center justify-center gap-ch text-xs leading-none tabular-nums"
					aria-label={`${balls} ball${balls === 1 ? '' : 's'}, ${strikes} strike${strikes === 1 ? '' : 's'}, ${outs} out${outs === 1 ? '' : 's'}`}
				>
					<span>
						<span class="text-accent">{balls}</span><span class="text-light">-</span><span
							class="text-yellow-300">{strikes}</span
						>
					</span>

					<span class="flex items-center gap-[.25ch]" aria-hidden="true">
						{#each Array.from({ length: 2 }) as _, i (i)}
							<span
								class={cn(
									'inline-block size-[.75lh] rounded-full bg-linear-to-b to-foreground/10 dark:to-foreground/25',
									i < outs && 'bg-red-500',
								)}
							></span>
						{/each}
					</span>
				</div>

				<ol
					bind:this={pitchListEl}
					class="flex min-h-0 grow flex-col gap-y-[.25ch] overflow-y-auto text-xs tabular-nums"
				>
					{#each pitches as pitch, i (pitch.index ?? i)}
						{@const { type, isBall, isStrike, isInPlay } = pitch.details ?? {}}
						{@const speed = pitch.pitchData?.startSpeed}
						{@const dimmed = hoveredPitch != null && hoveredPitch !== i}
						<li
							data-pitch={i}
							class={cn(
								'flex cursor-pointer items-center gap-x-ch leading-tight transition-opacity',
								dimmed && 'opacity-25',
							)}
							onmouseenter={() => (hoveredPitch = i)}
							onmouseleave={() => {
								if (hoveredPitch === i) hoveredPitch = null
							}}
						>
							<span
								class={cn(
									'inline-grid size-lh shrink-0 place-items-center rounded-full bg-foreground text-[10px] text-background',
									{
										'bg-accent text-dark': isBall,
										'bg-yellow-300 text-dark': isStrike,
										'bg-blue-500 text-light': isInPlay,
									},
								)}
							>
								{i + 1}
							</span>

							<span class="min-w-0 grow truncate">{pitchTypeLabel(type?.description)}</span>

							{#if speed != null}
								<span class="shrink-0" style:color={pitchSpeedColor(speed)}>{speed.toFixed(1)}</span
								>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		</div>

		{#if play.result?.description}
			<div class="shrink-0 border-t border-dashed border-stroke px-ch py-[.25ch] text-xs">
				<p class={cn(hitIsScoring ? 'text-accent' : 'text-current/60')}>
					{play.result.description}
				</p>
				{#if hrDistance != null || hitData?.launchSpeed != null || hitData?.launchAngle != null}
					<p class="mt-[.15lh] flex flex-wrap items-baseline gap-x-[.5ch] tabular-nums">
						{#if hitHasOut}
							<span class="text-red-500">Out</span>
						{/if}
						{#if hitOutcomeLabel}
							<span class="text-blue-500">{hitOutcomeLabel}</span>
						{/if}
						{#if hitHasOut || hitOutcomeLabel}
							{#if hrDistance != null || hitData.launchSpeed != null || hitData.launchAngle != null}
								<span class="text-current/40">·</span>
							{/if}
						{/if}
						{#if hrDistance != null}
							<span>{hrDistance} ft</span>
						{/if}
						{#if hrDistance != null && (hitData.launchSpeed != null || hitData.launchAngle != null)}
							<span class="text-current/40">·</span>
						{/if}
						{#if hitData.launchSpeed != null}
							<span>{hitData.launchSpeed.toFixed(1)} mph</span>
						{/if}
						{#if hitData.launchSpeed != null && hitData.launchAngle != null}
							<span class="text-current/40">·</span>
						{/if}
						{#if hitData.launchAngle != null}
							<span>{Math.round(hitData.launchAngle)}°</span>
						{/if}
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
