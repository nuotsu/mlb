<script lang="ts">
	import { pitchSpeedColor } from '#lib/colors.js'
	import {
		pitchFlight,
		PLATE_FRONT_Y,
		project,
		spinAxis,
		UMPIRE_CAMERA,
	} from '#lib/pitch-flight.js'
	import { pitchOutcome } from '#lib/pitch-outcome.js'
	import { batterUniformSrc, type BatterUniforms } from '#lib/uniforms.js'
	import { cn } from '#lib/utils.js'
	import BatterFigure from '#ui/game/batter-figure.svelte'
	import SpinningBaseball from '#ui/game/spinning-baseball.svelte'
	import { ChevronLeftIcon, ChevronRightIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'
	import { prefersReducedMotion } from 'svelte/motion'

	let {
		plays,
		players,
		status,
		uniforms,
		pinnedIndex = $bindable(null),
	}: {
		plays?: MLB.Plays
		players?: Record<string, MLB.Person>
		status?: MLB.GameStatus
		uniforms?: BatterUniforms | null
		/** `null` means follow `defaultIndex` as new at-bats arrive. */
		pinnedIndex?: number | null
	} = $props()

	const uid = $props.id()

	const allPlays = $derived(plays?.allPlays ?? [])
	const lastIndex = $derived(Math.max(0, allPlays.length - 1))

	/** Completed games read from the first at-bat; live ones follow the latest. */
	const isFinal = $derived(status?.abstractGameState === 'Final')
	const defaultIndex = $derived(isFinal ? 0 : lastIndex)

	const selectedIndex = $derived(pinnedIndex ?? defaultIndex)

	/** Under the mouse. Wins over `pinnedPitch` while it lasts. */
	let hoveredPitch = $state<number | null>(null)
	/** Tapped or clicked; cleared by tapping it again or anywhere else. */
	let pinnedPitch = $state<{ atBat: number; pitch: number } | null>(null)
	let pitchListEl = $state<HTMLOListElement | null>(null)
	let rootEl = $state<HTMLDivElement | null>(null)

	function go(delta: number) {
		const next = Math.min(lastIndex, Math.max(0, selectedIndex + delta))
		pinnedIndex = next === defaultIndex ? null : next
		hoveredPitch = null
		pinnedPitch = null
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

	/** A pin only holds for the at-bat it was made in, so live updates don't carry it over. */
	const pinnedPitchIndex = $derived(
		pinnedPitch && pinnedPitch.atBat === play?.about?.atBatIndex ? pinnedPitch.pitch : null,
	)

	const selectedPitch = $derived.by(() => {
		const i = hoveredPitch ?? pinnedPitchIndex
		return i != null && i < pitches.length ? i : null
	})

	$effect(() => {
		if (selectedPitch == null || !pitchListEl) return
		const item = pitchListEl.querySelector<HTMLElement>(`[data-pitch="${selectedPitch}"]`)
		item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	})

	/** Hover is for mice only; a tap shouldn't leave a stuck hover behind. */
	function hoverPitch(e: PointerEvent, i: number) {
		if (e.pointerType === 'mouse') hoveredPitch = i
	}

	function unhoverPitch(e: PointerEvent, i: number) {
		if (e.pointerType === 'mouse' && hoveredPitch === i) hoveredPitch = null
	}

	function togglePitch(i: number) {
		const atBat = play?.about?.atBatIndex
		if (atBat == null) return
		pinnedPitch = pinnedPitchIndex === i ? null : { atBat, pitch: i }
	}

	/** Hover and tap targets for a pitch's trail and marker in the zone. */
	function pitchTarget(i: number) {
		return {
			role: 'presentation',
			'data-pitch': i,
			onpointerenter: (e: PointerEvent) => hoverPitch(e, i),
			onpointerleave: (e: PointerEvent) => unhoverPitch(e, i),
			onclick: () => togglePitch(i),
		}
	}

	/** Tapping anywhere but a pitch (in the zone or the list) clears the pin. */
	function clearPinOutside(e: PointerEvent) {
		if (!pinnedPitch || !(e.target instanceof Element)) return
		const target = e.target.closest('[data-pitch]')
		if (target && rootEl?.contains(target)) return
		pinnedPitch = null
	}

	/** SVG has no z-index — paint order is document order, so draw the selected pitch last. */
	const paintOrder = $derived.by(() => {
		const order = pitches.map((_, i) => i)
		if (selectedPitch == null) return order
		return [...order.filter((i) => i !== selectedPitch), selectedPitch]
	})

	const isLefty = $derived(play?.matchup?.batSide?.code === 'L')
	const pitchHand = $derived(play?.matchup?.pitchHand?.code)
	const batSide = $derived(play?.matchup?.batSide?.code)

	const pitcher = $derived(play?.matchup?.pitcher)
	const batter = $derived(play?.matchup?.batter)

	/** The batting team's uniform, drawn for the side batted from in this at-bat. */
	const batterSrcs = $derived.by(() => {
		const codes = play?.about?.isTopInning ? uniforms?.away : uniforms?.home
		if (!codes || (batSide !== 'L' && batSide !== 'R')) return null
		const srcs = codes.map((code) => batterUniformSrc(code, batSide))
		return srcs.every(Boolean) ? (srcs as string[]) : null
	})

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
		pinnedPitch = null
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
	/** Numbered marker and spinning ball radius at the plate, SVG units. */
	const DOT_R = 7
	/** Trajectory width at the plate; it tapers with distance. */
	const TRAIL_W = 2.5
	const SELECTED_TRAIL_W = 4

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

	/**
	 * Each pitch's flight from release to the plate, through the umpire's-eye
	 * camera. `x` / `z` are feet on the plane of the front of the plate, so the
	 * zone and `pX` / `pZ` line up untouched. `null` falls back to just the dot.
	 */
	const flights = $derived(
		pitches.map((pitch) => {
			const flight = pitchFlight(pitch.pitchData)
			if (!flight) return null
			return flight.map((p) => ({ ...project(UMPIRE_CAMERA, p.x, p.y, p.z), t: p.t }))
		}),
	)

	/** Home plate lying on the ground, point toward the catcher. */
	const plateFeet = $derived(
		[
			[-PLATE_HALF, PLATE_FRONT_Y],
			[PLATE_HALF, PLATE_FRONT_Y],
			[PLATE_HALF, PLATE_HALF],
			[0, 0],
			[-PLATE_HALF, PLATE_HALF],
		].map(([x, y]) => project(UMPIRE_CAMERA, x, y, 0)),
	)

	const view = $derived.by(() => {
		let xMin = -PLATE_HALF - PAD
		let xMax = PLATE_HALF + PAD
		// Flights reach above the zone on their own, so it needs less headroom
		let zMin = zone.bottom - PAD
		let zMax = zone.top + PAD / 2

		for (const p of plateFeet) {
			zMin = Math.min(zMin, p.z - 0.1)
		}

		pitches.forEach((pitch, i) => {
			const c = pitch.pitchData?.coordinates
			if (c?.pX != null) {
				xMin = Math.min(xMin, c.pX - 0.2)
				xMax = Math.max(xMax, c.pX + 0.2)
			}
			if (c?.pZ != null) {
				zMin = Math.min(zMin, c.pZ - 0.2)
				zMax = Math.max(zMax, c.pZ + 0.2)
			}
			for (const pt of flights[i] ?? []) {
				xMin = Math.min(xMin, pt.x - 0.1)
				xMax = Math.max(xMax, pt.x + 0.1)
				zMin = Math.min(zMin, pt.z - 0.1)
				zMax = Math.max(zMax, pt.z + 0.1)
			}
		})

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

	const platePoints = $derived(plateFeet.map((p) => toSvg(p.x, p.z)))
	const plate = $derived(platePoints.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))

	let boxWidth = $state(0)
	let boxHeight = $state(0)

	/** The SVG sits on the box's outer edge, away from the pitch list and the batter. */
	const svgAlign = $derived(isLefty ? 'xMinYMid' : 'xMaxYMid')

	/** SVG units → px, matching the SVG's `meet` scaling and `svgAlign`. */
	const svgFrame = $derived.by(() => {
		if (!boxWidth || !boxHeight) return null
		const scale = Math.min(boxWidth / W, boxHeight / H)
		return {
			scale,
			ox: isLefty ? 0 : boxWidth - W * scale,
			oy: (boxHeight - H * scale) / 2,
		}
	})

	/** How wide the batter stands, px, as last measured. Kept across at-bats so the layout holds still. */
	let figureWidth = $state(0)

	/**
	 * Just wide enough for the zone at full height and the batter beside it, so
	 * the pitch list gets the rest. `null` until the box is measured.
	 */
	const zoneBox = $derived.by(() => {
		if (!boxHeight) return null
		const scale = boxHeight / H
		const min = W * scale
		if (!batterSrcs || !figureWidth) return { min, width: min }
		const beside = (isLefty ? W - sz.x - sz.w : sz.x) * scale
		return { min, width: min + Math.max(0, figureWidth - beside) }
	})

	/** The batter stands about even with the middle of the plate. */
	const BATTER_Y = PLATE_HALF

	/** Zone, plate, and ground in px, for the batter standing beside them. */
	const figureFrame = $derived.by(() => {
		if (!svgFrame) return null
		const { scale, ox, oy } = svgFrame
		const atBatter = (z: number) => {
			const p = project(UMPIRE_CAMERA, 0, BATTER_Y, z)
			return oy + toSvg(p.x, p.z).y * scale
		}
		const plateBack = Math.max(...platePoints.map((p) => p.y))
		return {
			width: boxWidth,
			zoneLeft: ox + sz.x * scale,
			zoneRight: ox + (sz.x + sz.w) * scale,
			floor: Math.min(boxHeight, oy + plateBack * scale),
			zoneTop: atBatter(zone.top),
			ground: atBatter(0),
		}
	})

	/** Each flight in SVG units, with the ball's apparent size at every point. */
	const tracks = $derived(
		flights.map((flight) =>
			flight ? flight.map((p) => ({ ...toSvg(p.x, p.z), scale: p.scale, t: p.t })) : null,
		),
	)

	const fmt = (n: number) => n.toFixed(1)

	/** Centerline, for the hover hit area. */
	function trackLine(track: { x: number; y: number }[]) {
		return track.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')
	}

	/**
	 * The trail as a filled ribbon that widens with the ball's apparent size,
	 * thin out by the mound and full width at the plate.
	 */
	function trackRibbon(track: { x: number; y: number; scale: number }[], width: number) {
		const left: string[] = []
		const right: string[] = []
		track.forEach((p, i) => {
			const a = track[Math.max(0, i - 1)]
			const b = track[Math.min(track.length - 1, i + 1)]
			const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
			const half = Math.max(0.35, (width * p.scale) / 2)
			const nx = (-(b.y - a.y) / len) * half
			const ny = ((b.x - a.x) / len) * half
			left.push(`${fmt(p.x + nx)},${fmt(p.y + ny)}`)
			right.push(`${fmt(p.x - nx)},${fmt(p.y - ny)}`)
		})
		return `M${left.join('L')}L${right.reverse().join('L')}Z`
	}

	/** Spin, for the selected pitch only. `null` keeps the numbered marker. */
	const selectedSpin = $derived.by(() => {
		if (selectedPitch == null) return null
		const pitch = pitches[selectedPitch]
		const { spinRate, spinDirection } = pitch?.pitchData?.breaks ?? {}
		const c = pitch?.pitchData?.coordinates
		if (spinRate == null || spinDirection == null || c?.pX == null || c?.pZ == null) return null
		const { x, y } = toSvg(c.pX, c.pZ)
		return {
			x,
			y,
			spinRate,
			axis: spinAxis(spinDirection),
			twoSeam: ['SI', 'FT'].includes(pitch.details?.type?.code ?? ''),
		}
	})

	/** How far the selected pitch's ball has flown, seconds. */
	let flight = $state<{ pitch: number; t: number } | null>(null)

	/** The selected ball flies in when it spins and motion is allowed. */
	const throwing = $derived(selectedSpin != null && !prefersReducedMotion.current)

	/** A pitch's trail follows its ball in, like a trail, while it's being thrown. */
	function trailUntil(i: number) {
		if (!throwing || selectedPitch !== i) return Infinity
		return flight?.pitch === i ? flight.t : 0
	}

	function trackUntil<P extends { x: number; y: number; scale: number; t: number }>(
		track: P[],
		t: number,
	) {
		if (t >= track[track.length - 1].t) return track
		const shown: P[] = []
		for (const [k, p] of track.entries()) {
			if (p.t <= t) {
				shown.push(p)
				continue
			}
			const a = track[k - 1]
			if (a) {
				const f = (t - a.t) / (p.t - a.t)
				shown.push({
					...p,
					x: a.x + (p.x - a.x) * f,
					y: a.y + (p.y - a.y) * f,
					scale: a.scale + (p.scale - a.scale) * f,
					t,
				})
			}
			break
		}
		return shown
	}
</script>

<svelte:window onpointerdown={clearPinOutside} />

<div
	bind:this={rootEl}
	class="mx-ch flex h-full min-h-0 flex-col overflow-hidden border border-stroke text-sm"
>
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
			onpointerleave={(e) => {
				if (e.pointerType === 'mouse') hoveredPitch = null
			}}
		>
			<!-- Gives way before the pitch list does, but never below the zone's full size -->
			<div
				class="relative aspect-5/6 h-full min-w-0 shrink-[100]"
				style:width={zoneBox && `${zoneBox.width}px`}
				style:min-width={zoneBox && `${zoneBox.min}px`}
				bind:clientWidth={boxWidth}
				bind:clientHeight={boxHeight}
			>
				<!-- Painted first so the zone and pitches sit on top -->
				{#if batterSrcs && figureFrame && (batSide === 'L' || batSide === 'R')}
					{#key batterSrcs.join(' ')}
						<BatterFigure
							srcs={batterSrcs}
							{batSide}
							{...figureFrame}
							onmeasure={(w) => (figureWidth = w)}
						/>
					{/key}
				{/if}

				<svg
					viewBox="0 0 {W} {H}"
					class="absolute inset-0 h-full w-full text-current/40"
					preserveAspectRatio="{svgAlign} meet"
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

					<!-- Home plate, catcher's view -->
					<polygon points={plate} fill="currentColor" fill-opacity="0.25" />

					<!-- Trails go under every marker, so a trail's wide hit area never steals a marker's hover -->
					{#each paintOrder as i (pitches[i].index ?? i)}
						{@const track = tracks[i]}
						{#if track}
							{@const color = pitchColor(pitches[i].details)}
							{@const active = selectedPitch === i}
							{@const first = track[0]}
							{@const last = track[track.length - 1]}
							{@const shown = trackUntil(track, trailUntil(i))}
							<g
								class="cursor-pointer transition-opacity"
								opacity={selectedPitch != null && !active ? 0.2 : 1}
								{...pitchTarget(i)}
							>
								<!-- Fades in toward the plate as the ball comes closer -->
								<linearGradient
									id="{uid}-trail-{i}"
									gradientUnits="userSpaceOnUse"
									x1={first.x}
									y1={first.y}
									x2={last.x}
									y2={last.y}
								>
									<stop offset="0" style:stop-color={color} stop-opacity={active ? 0.5 : 0.3} />
									<stop offset="1" style:stop-color={color} stop-opacity={active ? 1 : 0.7} />
								</linearGradient>

								<!-- Wider invisible stroke for easier hover -->
								<polyline
									points={trackLine(track)}
									fill="none"
									stroke="transparent"
									stroke-width="12"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								{#if shown.length > 1}
									<path
										d={trackRibbon(shown, active ? SELECTED_TRAIL_W : TRAIL_W)}
										fill="url(#{uid}-trail-{i})"
									/>
								{/if}
							</g>
						{/if}
					{/each}

					{#each paintOrder as i (pitches[i].index ?? i)}
						{@const pX = pitches[i].pitchData?.coordinates?.pX}
						{@const pZ = pitches[i].pitchData?.coordinates?.pZ}
						{#if pX != null && pZ != null}
							{@const { x, y } = toSvg(pX, pZ)}
							{@const color = pitchColor(pitches[i].details)}
							{@const active = selectedPitch === i}
							<g
								class="cursor-pointer transition-opacity"
								opacity={selectedPitch != null && !active ? 0.2 : 1}
								{...pitchTarget(i)}
							>
								{#if active && selectedSpin}
									<SpinningBaseball
										{x}
										{y}
										r={DOT_R + 1.5}
										axis={selectedSpin.axis}
										spinRate={selectedSpin.spinRate}
										twoSeam={selectedSpin.twoSeam}
										{color}
										path={tracks[i]}
										animate={!prefersReducedMotion.current}
										onflight={(t) => (flight = { pitch: i, t })}
									/>
								{:else}
									<circle cx={x} cy={y} r={active ? DOT_R + 1 : DOT_R} fill={color} />
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
						{/if}
					{/each}
				</svg>

				<!-- In HTML rather than the SVG so it stays readable when the SVG is scaled down -->
				{#if selectedSpin && svgFrame}
					{@const { x, y, spinRate } = selectedSpin}
					{@const { scale, ox, oy } = svgFrame}
					<!-- Centered under the ball, kept inside the box -->
					<p
						class="pointer-events-none absolute -translate-x-1/2 rounded-sm bg-background/75 px-[.5ch] text-[10px] leading-tight whitespace-nowrap tabular-nums"
						style:left="{ox + x * scale}px"
						style:top="{Math.min(boxHeight - 14, oy + (y + DOT_R + 1.5) * scale + 2)}px"
					>
						{Math.round(spinRate).toLocaleString('en-US')} rpm
					</p>
				{/if}
			</div>

			<div class="flex max-h-full min-w-0 grow basis-[18ch] flex-col gap-y-[.25ch]">
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
					class="flex min-h-0 grow flex-col overflow-y-auto text-xs tabular-nums"
				>
					{#each pitches as pitch, i (pitch.index ?? i)}
						{@const { type, isBall, isStrike, isInPlay } = pitch.details ?? {}}
						{@const speed = pitch.pitchData?.startSpeed}
						{@const outcome = pitchOutcome(play, pitch)}
						{@const active = selectedPitch === i}
						{@const dimmed = selectedPitch != null && !active}
						<li data-pitch={i} class={cn('transition-opacity', dimmed && 'opacity-25')}>
							<button
								type="button"
								class="flex w-full items-center gap-x-ch py-[.5px] text-left leading-tight"
								aria-pressed={pinnedPitchIndex === i}
								onpointerenter={(e) => hoverPitch(e, i)}
								onpointerleave={(e) => unhoverPitch(e, i)}
								onclick={() => togglePitch(i)}
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
									<span class="shrink-0" style:color={pitchSpeedColor(speed)}
										>{speed.toFixed(1)}</span
									>
								{/if}

								<span
									class="w-[3.5ch] shrink-0 text-right"
									style:color={pitchColor(pitch.details)}
									title={outcome?.title}
								>
									{#if outcome}
										<span aria-hidden="true">
											{#if outcome.mirrored}
												<span class="inline-block -scale-x-100">{outcome.label}</span>
											{:else if outcome.struck}
												<s>{outcome.label}</s>
											{:else}
												{outcome.label}
											{/if}
										</span>
										<span class="sr-only">{outcome.title}</span>
									{/if}
								</span>
							</button>
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
							{#if hrDistance != null || hitData?.launchSpeed != null || hitData?.launchAngle != null}
								<span class="text-current/40">·</span>
							{/if}
						{/if}
						{#if hrDistance != null}
							<span>{hrDistance} ft</span>
						{/if}
						{#if hrDistance != null && (hitData?.launchSpeed != null || hitData?.launchAngle != null)}
							<span class="text-current/40">·</span>
						{/if}
						{#if hitData?.launchSpeed != null}
							<span>{hitData.launchSpeed.toFixed(1)} mph</span>
						{/if}
						{#if hitData?.launchSpeed != null && hitData?.launchAngle != null}
							<span class="text-current/40">·</span>
						{/if}
						{#if hitData?.launchAngle != null}
							<span>{Math.round(hitData.launchAngle)}°</span>
						{/if}
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
