<script lang="ts">
	import { ABS_ZONE, batterPlacement, parseHeight } from '#lib/batter-figure.js'
	import { pitchSpeedColor } from '#lib/colors.js'
	import {
		pitchFlight,
		pitchLocation,
		PLATE_FRONT_Y,
		project,
		spinAxis,
		UMPIRE_CAMERA,
		zonePlaneY,
	} from '#lib/pitch-flight.js'
	import { pitchOutcome } from '#lib/pitch-outcome.js'
	import { batterUniformSrc, uniformSeason, type BatterUniforms } from '#lib/uniforms.js'
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

	// One scene in feet from the catcher's view: `x` toward the catcher's right
	// from the middle of the plate, `z` up from the ground. The zone, the
	// plate, the batter, and every pitch share it, at one scale.
	const PLATE_HALF = 17 / 24
	/** Padding past the plate on the side away from the batter, where nothing else stands, ft. */
	const OUTER_PAD = 0.25
	/** Padding on the batter's side when there's no batter to draw, ft. */
	const BATTER_PAD = 0.9
	/** Room above the batter, and below the plate, ft. */
	const HEAD_PAD = 0.15
	const FOOT_PAD = 0.1
	/** SVG height in its own units; the width follows the scene. */
	const H = 240
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
	 * Standing height, ft. Without one on the roster, it's read back from the
	 * top of the zone, which ABS sets at a share of it.
	 */
	const batterHeight = $derived.by(() => {
		const person = batter?.id != null ? players?.[`ID${batter.id}`] : undefined
		const height = parseHeight(person?.height ?? batter?.height)
		if (height) return height
		return Math.min(7.5, Math.max(5, zone.top / ABS_ZONE.top))
	})

	/** A batter whose render failed to load isn't drawn, so the zone gets his room. */
	let failedFigure = $state<string | null>(null)

	/** The batter standing in the box, in feet. */
	const figure = $derived.by(() => {
		if (!batterSrcs || (batSide !== 'L' && batSide !== 'R')) return null
		const key = batterSrcs.join(' ')
		if (failedFigure === key) return null
		const codes = play?.about?.isTopInning ? uniforms?.away : uniforms?.home
		return { key, ...batterPlacement(batterHeight, batSide, uniformSeason(codes?.[0])) }
	})

	/**
	 * The umpire's-eye camera, drawing the plane the zone is judged on at true
	 * size: the middle of the plate under ABS, its front before. The batter
	 * stands about there too.
	 */
	const camera = $derived({ ...UMPIRE_CAMERA, plane: zonePlaneY(pitches[0]?.pitchData) })

	/** Each pitch's flight from release to the zone's plane, in feet. */
	const paths = $derived(pitches.map((pitch) => pitchFlight(pitch.pitchData)))

	/**
	 * Where each pitch is judged: on the zone's plane, so it's a strike when
	 * the ball touches the zone. `null` without a location.
	 */
	const locations = $derived(pitches.map((pitch, i) => pitchLocation(pitch.pitchData, paths[i])))

	/**
	 * Each flight through the camera. `x` / `z` are feet on the zone's plane,
	 * so the flight ends on its location untouched. `null` falls back to just
	 * the dot.
	 */
	const flights = $derived(
		paths.map(
			(flight) => flight?.map((p) => ({ ...project(camera, p.x, p.y, p.z), t: p.t })) ?? null,
		),
	)

	/**
	 * Home plate lying on the ground, point toward the catcher. The ground is
	 * at `z = 0` on the zone's plane, with the batter's feet; the plate rises
	 * past it toward the mound and dips toward the camera.
	 */
	const plateFeet = $derived(
		[
			[-PLATE_HALF, PLATE_FRONT_Y],
			[PLATE_HALF, PLATE_FRONT_Y],
			[PLATE_HALF, PLATE_HALF],
			[0, 0],
			[-PLATE_HALF, PLATE_HALF],
		].map(([x, y]) => project(camera, x, y, 0)),
	)

	/**
	 * What the scene spans, ft: the plate, the batter from his feet to the end
	 * of his bat, and every pitch. `unit` is SVG units per foot, the same both
	 * ways.
	 */
	const view = $derived.by(() => {
		let xMin = -PLATE_HALF - (isLefty ? OUTER_PAD : BATTER_PAD)
		let xMax = PLATE_HALF + (isLefty ? BATTER_PAD : OUTER_PAD)
		let zMin = -FOOT_PAD
		let zMax = zone.top + 0.5

		const reach = (x0: number, x1: number, z0: number, z1: number) => {
			xMin = Math.min(xMin, x0)
			xMax = Math.max(xMax, x1)
			zMin = Math.min(zMin, z0)
			zMax = Math.max(zMax, z1)
		}

		if (figure) {
			reach(figure.bounds.left, figure.bounds.right, 0, figure.bounds.top + HEAD_PAD)
		}
		for (const p of plateFeet) reach(p.x, p.x, p.z - FOOT_PAD, p.z)

		locations.forEach((at, i) => {
			if (at) reach(at.x - 0.2, at.x + 0.2, at.z - 0.2, at.z + 0.2)
			for (const pt of flights[i] ?? []) reach(pt.x - 0.1, pt.x + 0.1, pt.z - 0.1, pt.z + 0.1)
		})

		const unit = H / (zMax - zMin)
		return { xMin, zMax, unit, width: (xMax - xMin) * unit }
	})

	function toSvg(x: number, z: number) {
		const { xMin, zMax, unit } = view
		return { x: (x - xMin) * unit, y: (zMax - z) * unit }
	}

	const sz = $derived.by(() => {
		const tl = toSvg(-PLATE_HALF, zone.top)
		const br = toSvg(PLATE_HALF, zone.bottom)
		return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y }
	})

	const plate = $derived(
		plateFeet
			.map((p) => toSvg(p.x, p.z))
			.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
			.join(' '),
	)

	/** The batter's render, in SVG units. */
	const figureBox = $derived.by(() => {
		if (!figure) return null
		const { x, y } = toSvg(figure.canvas.x, figure.canvas.z)
		return { x, y, width: figure.canvas.w * view.unit, height: figure.canvas.h * view.unit }
	})

	let boxWidth = $state(0)
	let boxHeight = $state(0)

	/**
	 * The SVG sits on the box's outer edge, away from the pitch list and the
	 * batter, with his feet at the bottom.
	 */
	const svgAlign = $derived(isLefty ? 'xMinYMax' : 'xMaxYMax')

	/** SVG units → px, matching the SVG's `meet` scaling and `svgAlign`. */
	const svgFrame = $derived.by(() => {
		if (!boxWidth || !boxHeight) return null
		const scale = Math.min(boxWidth / view.width, boxHeight / H)
		return {
			scale,
			ox: isLefty ? 0 : boxWidth - view.width * scale,
			oy: boxHeight - H * scale,
		}
	})

	/**
	 * Just wide enough for the scene at full height, so the pitch list gets the
	 * rest, up to half. On narrow screens it gives a little first, shrinking
	 * the scene with it. `null` until the box is measured.
	 */
	const zoneBox = $derived.by(() => {
		if (!boxHeight) return null
		const width = (boxHeight / H) * view.width
		return { min: width * 0.8, width }
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
		const at = locations[selectedPitch]
		if (spinRate == null || spinDirection == null || !at) return null
		const { x, y } = toSvg(at.x, at.z)
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
			<!-- Gives way before the pitch list does, but only a little,
			     and is centered in whatever the list leaves past half -->
			<div
				class="relative mx-auto aspect-5/6 h-full min-w-0 shrink-[100]"
				style:width={zoneBox && `${zoneBox.width}px`}
				style:min-width={zoneBox && `${zoneBox.min}px`}
				bind:clientWidth={boxWidth}
				bind:clientHeight={boxHeight}
			>
				<svg
					viewBox="0 0 {view.width} {H}"
					class="absolute inset-0 h-full w-full text-current/40"
					preserveAspectRatio="{svgAlign} meet"
					aria-hidden="true"
				>
					<!-- Painted first so the zone and pitches sit on top -->
					{#if figure && figureBox && batterSrcs}
						{@const key = figure.key}
						{#key key}
							<BatterFigure srcs={batterSrcs} {...figureBox} onerror={() => (failedFigure = key)} />
						{/key}
					{/if}

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
						{@const at = locations[i]}
						{#if at}
							{@const { x, y } = toSvg(at.x, at.z)}
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

			<div class="flex max-h-full max-w-1/2 min-w-0 grow basis-[18ch] flex-col gap-y-[.25ch]">
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
						{@const overturned =
							pitch.reviewDetails?.reviewType?.toUpperCase() === 'MJ' &&
							pitch.reviewDetails.isOverturned &&
							(isBall || isStrike)}
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
									class="pitch-number relative inline-grid shrink-0 text-[10px]"
									title={overturned
										? `Called a ${isStrike ? 'ball' : 'strike'}, overturned by ABS challenge`
										: undefined}
								>
									{#if overturned}
										<!-- The call on the field, peeking out from behind the call that stood after the ABS challenge -->
										<span
											class={cn(
												'overturned-call absolute top-0 left-0 size-lh rounded-full',
												isStrike ? 'bg-accent' : 'bg-yellow-300',
											)}
										></span>
									{/if}

									<span
										class={cn(
											'relative inline-grid size-lh place-items-center rounded-full bg-foreground text-background',
											{
												'bg-accent text-dark': isBall,
												'bg-yellow-300 text-dark': isStrike,
												'bg-blue-500 text-light': isInPlay,
											},
										)}
									>
										{i + 1}
									</span>

									{#if overturned}
										<span class="sr-only">
											(called a {isStrike ? 'ball' : 'strike'}, overturned by ABS challenge)
										</span>
									{/if}
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

<style>
	/* Room on the left for an overturned call to peek out, kept on every row so the numbers line up */
	.pitch-number {
		--overturned-offset: 4px;
		padding-left: var(--overturned-offset);
	}

	/* A gap cut around the pitch number, in the page's background, softened by a quarter pixel */
	.overturned-call {
		mask: radial-gradient(
			circle calc(0.5lh + 1.5px) at calc(0.5lh + var(--overturned-offset)) center,
			transparent 100%,
			black calc(100% + 0.25px)
		);
	}
</style>
