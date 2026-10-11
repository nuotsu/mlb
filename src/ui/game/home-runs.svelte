<script lang="ts">
	import {
		angleOf,
		DIRECTION_LABELS,
		directionFromAngle,
		directionFromDescription,
		distanceOf,
		fenceDistanceAt,
		fenceDistances,
		fencePoints,
		flightPath,
		isInsideTheParkHomeRun,
		landingSpot,
		polar,
		round,
		separate,
		teamChartColors,
		toPath,
		type Point,
	} from '#lib/home-run-chart.js'
	import { teamColor } from '#lib/team-colors.js'
	import { cn } from '#lib/utils.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Headshot from '#ui/player/headshot.svelte'

	let { feedLive, class: className }: { feedLive: MLB.LiveGameFeed; class?: string } = $props()

	const RBI_LABELS = {
		1: 'Solo',
		2: '2-run',
		3: '3-run',
		4: 'Grand slam',
	} as const

	/** Avatar radius (ft) at each landing spot; it scales with the chart. */
	const AVATAR = 11
	const AVATAR_ACTIVE = 16

	/** Landing spots closer than this (ft) are nudged apart so avatars don't pile up. */
	const MIN_GAP = AVATAR * 2

	const uid = $props.id()

	// Infield, in feet: 90 ft bases, the mound at 60.5 ft, and a 95 ft dirt arc around it.
	const BASE = 90 / Math.SQRT2
	const MOUND = 60.5
	const SKIN_RADIUS = 95
	// The dirt: up the foul lines to where the arc crosses them (x = y), then around the arc
	const SKIN_EDGE = (MOUND + Math.sqrt(2 * SKIN_RADIUS ** 2 - MOUND ** 2)) / 2
	const SKIN = `M0 0L${round(-SKIN_EDGE)} ${round(-SKIN_EDGE)}A${SKIN_RADIUS} ${SKIN_RADIUS} 0 0 1 ${round(SKIN_EDGE)} ${round(-SKIN_EDGE)}Z`

	function lastHitData(play: MLB.Play) {
		return play.playEvents?.findLast((event) => event.hitData)
	}

	function parseSeasonOrdinal(description?: string): number | undefined {
		const match = description?.match(/(?:homers?|home run|grand slam)\s*\((\d+)\)/i)
		return match ? Number(match[1]) : undefined
	}

	function person(id?: number) {
		return id
			? (feedLive.gameData.players[`ID${id}`] as unknown as MLB.Person | undefined)
			: undefined
	}

	const venue = $derived(feedLive.gameData.venue)
	const distances = $derived(fenceDistances(venue?.fieldInfo))
	const fence = $derived(fencePoints(distances))

	const teams = $derived(feedLive.gameData.teams)
	const colors = $derived(
		teamChartColors(teamColor(teams.away.id), teamColor(teams.home.id), '#72f088'),
	)

	const homeRuns = $derived.by(() => {
		const list = (feedLive.liveData.plays.allPlays ?? [])
			.filter((play) => play.result?.eventType === 'home_run')
			.map((play) => {
				const event = lastHitData(play)
				const hitData = event?.hitData
				const description = play.result.description
				const batter = person(play.matchup.batter.id) ?? play.matchup.batter
				const pitcher = person(play.matchup.pitcher?.id) ?? play.matchup.pitcher
				const side = play.about.isTopInning ? ('away' as const) : ('home' as const)

				const landing = landingSpot({ hitData, description, distances })
				const insideThePark = isInsideTheParkHomeRun(description)
				const rbiLabel = /grand slam/i.test(description)
					? RBI_LABELS[4]
					: RBI_LABELS[play.result.rbi as keyof typeof RBI_LABELS]

				return {
					atBatIndex: play.atBatIndex ?? play.about.atBatIndex,
					batter,
					pitcher,
					team: teams[side],
					color: colors[side],
					ordinal: parseSeasonOrdinal(description),
					type: [rbiLabel ?? 'Home run', insideThePark && 'inside-the-park']
						.filter(Boolean)
						.join(', '),
					inning: `${play.about.isTopInning ? 'Top' : 'Bot'} ${play.about.inning}`,
					hitData,
					direction:
						DIRECTION_LABELS[
							directionFromDescription(description) ?? directionFromAngle(angleOf(landing))
						],
					pitch: [
						event?.details?.type?.description,
						event?.pitchData?.startSpeed && `${event.pitchData.startSpeed.toFixed(1)} mph`,
					]
						.filter(Boolean)
						.join(' '),
					landing,
					insideThePark,
				}
			})

		const ends = separate(
			list.map((hr) => hr.landing),
			MIN_GAP,
		)

		return list.map((hr, i) => ({
			...hr,
			end: ends[i],
			// As big a tap target as fits without covering a neighbor's
			hitRadius: Math.min(
				20,
				...ends.map((p, j) =>
					i === j ? Infinity : Math.hypot(p.x - ends[i].x, p.y - ends[i].y) / 2,
				),
			),
			path: flightPath(ends[i], hr.hitData?.launchAngle).d,
		}))
	})

	// Fit the park and every landing spot, with home plate centered at the bottom.
	const viewBox = $derived.by(() => {
		const points: Point[] = [...fence, ...homeRuns.map((hr) => hr.end)]
		const pad = 24
		const halfWidth = Math.max(...points.map((p) => Math.abs(p.x))) + pad
		const top = Math.max(...points.map((p) => p.y)) + pad
		const bottom = 24
		return { x: -halfWidth, y: -top, width: halfWidth * 2, height: top + bottom }
	})

	const grass = $derived(`M0 0${toPath(fence).replace('M', 'L')}Z`)

	const labels = $derived(
		[-42, -22.5, 0, 22.5, 42].map((angle, i) => ({
			distance: distances[i],
			...polar(angle, fenceDistanceAt(distances, angle) - 22),
		})),
	)

	let selected = $state<number | null>(null)
	let hovered = $state<number | null>(null)
	let focused = $state<number | null>(null)

	const active = $derived(
		homeRuns.find((hr) => hr.atBatIndex === (hovered ?? focused ?? selected))?.atBatIndex ?? null,
	)
	const activeHomeRun = $derived(homeRuns.find((hr) => hr.atBatIndex === active))

	function toggle(atBatIndex: number) {
		selected = selected === atBatIndex ? null : atBatIndex
	}

	// Touch has no hover; a tap selects instead.
	function hover(e: PointerEvent, atBatIndex: number | null) {
		if (e.pointerType === 'mouse') hovered = atBatIndex
	}

	function onkeydown(e: KeyboardEvent, atBatIndex: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			toggle(atBatIndex)
		} else if (e.key === 'Escape') {
			selected = null
		}
	}

	function label(hr: (typeof homeRuns)[number]) {
		return [
			hr.batter.fullName,
			hr.ordinal != null && `home run #${hr.ordinal}`,
			hr.inning,
			hr.hitData?.totalDistance && `${hr.hitData.totalDistance} ft`,
			hr.direction,
		]
			.filter(Boolean)
			.join(', ')
	}
</script>

<!-- The batter's headshot in a team-colored ring, centered on the landing spot -->
{#snippet avatar(hr: (typeof homeRuns)[number], r: number)}
	{@const { x, y } = hr.end}
	<circle cx={x} cy={-y} {r} class="fill-background" />
	<circle cx={x} cy={-y} {r} class="fill-current/10" />
	<!-- The enlarged (selected) avatar layers a sharper image over the small one, which
	     is already loaded, so it never flashes empty -->
	{#each r > AVATAR ? [96, 240] : [96] as size (size)}
		<image
			href="https://midfield.mlbstatic.com/v1/people/{hr.batter.id}/spots/{size}"
			x={x - r}
			y={-y - r}
			width={r * 2}
			height={r * 2}
			clip-path="url(#{uid}-avatar)"
			preserveAspectRatio="xMidYMid slice"
		/>
	{/each}
	<circle
		cx={x}
		cy={-y}
		{r}
		class="hr-stroke fill-none"
		stroke-width={r > AVATAR ? 2 : 1.5}
		vector-effect="non-scaling-stroke"
	/>
{/snippet}

{#if homeRuns.length}
	<!-- Chart beside the details and list when there's room, stacked otherwise -->
	<article
		class={cn(
			'grid items-start gap-x-lh gap-y-ch md:grid-cols-[minmax(0,32rem)_minmax(0,26rem)] md:justify-center',
			className,
		)}
	>
		<h2 class="text-xs text-current/40 md:col-span-full">Home Runs</h2>

		<figure class="mx-auto w-full max-w-lg">
			<div class="relative">
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<svg
					class="block h-auto w-full overflow-visible select-none"
					viewBox="{round(viewBox.x)} {round(viewBox.y)} {round(viewBox.width)} {round(
						viewBox.height,
					)}"
					role="group"
					aria-label="Home run flight paths at {venue?.name ?? 'the ballpark'}"
					onclick={() => (selected = null)}
				>
					<defs>
						<clipPath id="{uid}-avatar" clipPathUnits="objectBoundingBox">
							<circle cx=".5" cy=".5" r=".5" />
						</clipPath>
					</defs>

					<g class="pointer-events-none" aria-hidden="true">
						<path d={grass} class="fill-green-600/8 dark:fill-green-400/8" />

						<path d={SKIN} class="fill-amber-700/15 dark:fill-amber-500/10" />
						<path
							d="M0 -6L{BASE - 6} {-BASE}L0 {-2 * BASE + 6}L{-BASE + 6} {-BASE}Z"
							class="fill-green-600/15 dark:fill-green-400/10"
						/>
						<circle
							cy={-MOUND}
							r="9"
							class="fill-amber-700/20 stroke-current/20 dark:fill-amber-500/15"
							stroke-width="1"
							vector-effect="non-scaling-stroke"
						/>
						<circle r="13" class="fill-amber-700/15 dark:fill-amber-500/10" />

						<path
							d="M0 0L{BASE} {-BASE}L0 {-2 * BASE}L{-BASE} {-BASE}Z"
							class="fill-none stroke-current/25"
							stroke-width="1"
							vector-effect="non-scaling-stroke"
						/>
						{#each [[BASE, -BASE], [0, -2 * BASE], [-BASE, -BASE]] as [x, y] (`${x},${y}`)}
							<rect
								{x}
								{y}
								width="5"
								height="5"
								transform="rotate(45 {x} {y}) translate(-2.5 -2.5)"
								class="fill-current/50"
							/>
						{/each}
						<path
							d="M-2.5 0h5v-2.5l-2.5-2.5-2.5 2.5Z"
							class="fill-current/50"
							transform="scale(1.4)"
						/>

						<path
							d="{toPath([fence[0], { x: 0, y: 0 }, fence.at(-1)!])}{toPath(fence)}"
							class="fill-none stroke-current/40"
							stroke-width="1"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
						/>

						{#each labels as { distance, x, y }, i (i)}
							<text
								{x}
								y={-y}
								class="fill-current/40 font-mono tabular-nums"
								font-size="15"
								text-anchor="middle"
								dominant-baseline="middle">{distance}</text
							>
						{/each}
					</g>

					<!-- Paths: a thin visible stroke under a wide invisible one that takes the clicks -->
					{#each homeRuns as hr (hr.atBatIndex)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<g
							class={cn(
								'hr-color cursor-pointer transition-opacity',
								active !== null && active !== hr.atBatIndex && 'opacity-25',
							)}
							style:--light={hr.color.light}
							style:--dark={hr.color.dark}
							aria-hidden="true"
							onclick={(e) => {
								e.stopPropagation()
								toggle(hr.atBatIndex)
							}}
							onpointerenter={(e) => hover(e, hr.atBatIndex)}
							onpointerleave={(e) => hover(e, null)}
						>
							<path
								d={hr.path}
								class="hr-stroke fill-none"
								stroke-width={active === hr.atBatIndex ? 2.5 : 1.5}
								stroke-linecap="round"
								stroke-dasharray={hr.insideThePark ? '4 3' : undefined}
								vector-effect="non-scaling-stroke"
							/>
							<path
								d={hr.path}
								class="fill-none stroke-transparent"
								stroke-width="16"
								pointer-events="stroke"
								vector-effect="non-scaling-stroke"
							/>
						</g>
					{/each}

					<!-- Landing spots sit above every path, so each stays reachable. They're the
					     keyboard stops, too. -->
					{#each homeRuns as hr (hr.atBatIndex)}
						{@const isActive = active === hr.atBatIndex}
						<g
							class={cn(
								'hr-color group/hr cursor-pointer transition-opacity outline-none',
								active !== null && !isActive && 'opacity-25',
							)}
							style:--light={hr.color.light}
							style:--dark={hr.color.dark}
							role="button"
							tabindex="0"
							aria-pressed={selected === hr.atBatIndex}
							aria-label={label(hr)}
							onclick={(e) => {
								e.stopPropagation()
								toggle(hr.atBatIndex)
							}}
							onkeydown={(e) => onkeydown(e, hr.atBatIndex)}
							onfocus={(e) => {
								if (e.currentTarget.matches(':focus-visible')) focused = hr.atBatIndex
							}}
							onblur={() => (focused = null)}
							onpointerenter={(e) => hover(e, hr.atBatIndex)}
							onpointerleave={(e) => hover(e, null)}
						>
							<circle
								cx={hr.end.x}
								cy={-hr.end.y}
								r={AVATAR + 4}
								class="hidden fill-none stroke-current group-focus-visible/hr:block"
								stroke-width="1.5"
								vector-effect="non-scaling-stroke"
							/>
							{@render avatar(hr, AVATAR)}
							<circle
								cx={hr.end.x}
								cy={-hr.end.y}
								r={Math.max(hr.hitRadius, AVATAR)}
								class="fill-transparent"
							/>
						</g>
					{/each}

					<!-- The active one again, larger and on top of any neighbor it overlaps -->
					{#if activeHomeRun}
						<g
							class="hr-color pointer-events-none"
							style:--light={activeHomeRun.color.light}
							style:--dark={activeHomeRun.color.dark}
						>
							{@render avatar(activeHomeRun, AVATAR_ACTIVE)}
						</g>
					{/if}
				</svg>
			</div>

			<figcaption class="flex justify-center gap-[2ch] text-xs text-current/60">
				{#each ['away', 'home'] as const as side (side)}
					<span
						class="hr-color flex items-center gap-[.5ch]"
						style:--light={colors[side].light}
						style:--dark={colors[side].dark}
					>
						<span class="hr-bg inline-block size-[1ch] rounded-full"></span>
						{teams[side].abbreviation ?? teams[side].teamName}
					</span>
				{/each}
			</figcaption>
		</figure>

		<div class="space-y-ch">
			<!-- Every card shares one grid cell, so the slot keeps the tallest card's height and
		     hovering between home runs never shifts the list below. Touch screens can't hover,
		     so there the slot only takes up room once something is selected. -->
			<div class="grid *:col-span-full *:row-span-full">
				<p
					class={cn(
						'grid place-content-center rounded border border-dashed border-stroke p-ch text-center text-xs text-current/40',
						activeHomeRun && 'invisible pointer-coarse:hidden',
					)}
				>
					Select a home run for details
				</p>

				{#each homeRuns as hr (hr.atBatIndex)}
					<div
						class={cn(
							'hr-color flex gap-ch rounded border border-stroke p-ch',
							active !== hr.atBatIndex && 'invisible pointer-coarse:hidden',
						)}
						style:--light={hr.color.light}
						style:--dark={hr.color.dark}
					>
						<Headshot person={hr.batter} size={180} class="hr-ring size-[3lh] shrink-0 border-2" />

						<div class="min-w-0 grow space-y-[.25lh]">
							<p class="flex flex-wrap items-baseline gap-x-ch">
								<a class="font-bold hover:underline" href="/player/{hr.batter.id}">
									{hr.batter.fullName}
								</a>
								<span class="text-xs text-current/40">{hr.team.abbreviation}</span>
							</p>

							<p class="text-xs">
								{#if hr.ordinal != null}
									<span class="hr-text font-bold">#{hr.ordinal}</span> ·
								{/if}
								{hr.type} · {hr.inning}
							</p>

							<dl
								class="grid grid-cols-[repeat(auto-fill,minmax(8ch,1fr))] gap-x-ch text-xs tabular-nums *:grid"
							>
								{#if hr.hitData?.totalDistance != null}
									<div>
										<dt class="text-current/40">Distance</dt>
										<dd>{Math.round(hr.hitData.totalDistance)} ft</dd>
									</div>
								{/if}
								{#if hr.hitData?.launchSpeed != null}
									<div>
										<dt class="text-current/40">Exit velo</dt>
										<dd>{hr.hitData.launchSpeed} mph</dd>
									</div>
								{/if}
								{#if hr.hitData?.launchAngle != null}
									<div>
										<dt class="text-current/40">Launch</dt>
										<dd>{Math.round(hr.hitData.launchAngle)}°</dd>
									</div>
								{/if}
								<div>
									<dt class="text-current/40">Direction</dt>
									<dd>{hr.direction}</dd>
								</div>
							</dl>

							{#if hr.pitcher?.fullName}
								<p class="text-xs text-current/60">
									off <a class="hover:underline" href="/player/{hr.pitcher.id}"
										>{hr.pitcher.fullName}</a
									>
									{#if hr.pitch}· {hr.pitch}{/if}
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<ol class="grid gap-[.25ch]">
				{#each homeRuns as hr (hr.atBatIndex)}
					<li class="hr-color" style:--light={hr.color.light} style:--dark={hr.color.dark}>
						<button
							class={cn(
								'flex w-full items-center gap-ch rounded-sm px-[.5ch] text-left transition-opacity',
								active !== null && active !== hr.atBatIndex && 'opacity-40',
								selected === hr.atBatIndex && 'bg-current/10',
								favoritesStore.has(`/player/${hr.batter.id}`) && 'bg-accent text-dark',
							)}
							type="button"
							aria-pressed={selected === hr.atBatIndex}
							aria-label={label(hr)}
							onclick={() => toggle(hr.atBatIndex)}
							onkeydown={(e) => e.key === 'Escape' && (selected = null)}
							onfocus={(e) => {
								if (e.currentTarget.matches(':focus-visible')) focused = hr.atBatIndex
							}}
							onblur={() => (focused = null)}
							onpointerenter={(e) => hover(e, hr.atBatIndex)}
							onpointerleave={(e) => hover(e, null)}
						>
							<span class="hr-bg inline-block size-[1ch] shrink-0 rounded-full"></span>
							<Headshot person={hr.batter} class="size-lh shrink-0" />
							<span class="flex min-w-0 grow gap-[.5ch]">
								<span class="line-clamp-1 break-all">
									{hr.batter.boxscoreName ?? hr.batter.lastName ?? hr.batter.fullName}
								</span>
								<!-- Season home run count, kept visible when a long name truncates -->
								{#if hr.ordinal != null}
									<span class="shrink-0 text-current/60 tabular-nums">(#{hr.ordinal})</span>
								{/if}
							</span>
							{#if hr.hitData?.totalDistance != null}
								<span class="text-xs text-current/40 tabular-nums"
									>{Math.round(hr.hitData.totalDistance)} ft</span
								>
							{/if}
							<span class="w-[5ch] shrink-0 text-right text-xs text-current/60 tabular-nums"
								>{hr.inning}</span
							>
						</button>
					</li>
				{/each}
			</ol>
		</div>
	</article>
{/if}

<style>
	/* Each home run sets --light and --dark; pick the one that reads on the current theme. */
	.hr-color {
		--c: var(--light);
	}

	:global(html:has([data-color-scheme='dark'])) .hr-color {
		--c: var(--dark);
	}

	.hr-stroke {
		stroke: var(--c);
	}

	.hr-bg {
		background-color: var(--c);
	}

	.hr-text {
		color: var(--c);
	}

	.hr-color :global(.hr-ring) {
		border-color: var(--c);
	}
</style>
