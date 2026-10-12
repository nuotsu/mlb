<script lang="ts">
	import {
		fetchBoxscore,
		fetchfeedLive,
		fetchGameSnapshot,
		fetchLinescore,
		fetchPitchStartTimes,
		fetchWinProbability,
	} from '#lib/fetch/presets.js'
	import { formatDate } from '#lib/temporal.js'
	import {
		adjacentPitch,
		DELAY_PARAM,
		delaySince,
		gameAsOf,
		latestPitch,
		parseDelay,
		pitchStartTimes,
		pitchTimeline,
		readStoredDelay,
		restoreDelayScript,
		toTimecode,
		writeStoredDelay,
		type GameSnapshot,
	} from '#lib/time-travel.js'
	import { cn } from '#lib/utils.js'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import AllPlays from '#ui/game/all-plays.svelte'
	import AtBatSequence from '#ui/game/at-bat-sequence.svelte'
	import Boxscore from '#ui/game/boxscore.svelte'
	import Decision from '#ui/game/decision.svelte'
	import GameData from '#ui/game/game-data.svelte'
	import Game from '#ui/game/game.svelte'
	import Highlights from '#ui/game/highlights.svelte'
	import HomeRuns from '#ui/game/home-runs.svelte'
	import Reviews from '#ui/game/reviews.svelte'
	import SectionNav from '#ui/game/section-nav.svelte'
	import TimeTravel from '#ui/game/time-travel.svelte'
	import TopPerformers from '#ui/game/top-performers.svelte'
	import Umpires from '#ui/game/umpires/umpires.svelte'
	import WinProbability from '#ui/game/win-probability.svelte'
	import Header from '#ui/header.svelte'
	import Metadata from '#ui/metadata.svelte'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import { browser } from '$app/env'
	import { beforeNavigate, goto } from '$app/navigation'
	import { page } from '$app/state'
	import { untrack } from 'svelte'
	import type { PageProps } from './$types'

	let { data, params }: PageProps = $props()

	/** The game as the schedule had it when the page loaded */
	const isGameLive = $derived(data.game?.status?.abstractGameState === 'Live')
	const isGameFinal = $derived(data.game?.status?.abstractGameState === 'Final')

	/**
	 * Time travel: how far behind live the page runs, in ms (`null` is live), so it can
	 * trail a TV or stream. Kept on `?delay=` (seconds), and the moment on screen is saved
	 * per game, so following a link away and back resumes at the same pitch (it wins over
	 * an older `?delay=`, like the back button's); other games start live.
	 */
	let delay = $derived(
		isGameLive || isGameFinal
			? ((browser ? readStoredDelay(localStorage, params.gamePk) : null) ??
					parseDelay(page.url.searchParams.get(DELAY_PARAM)))
			: null,
	)
	const isDelayed = $derived(delay != null)

	// Save the delay for this game and keep it on the address (the address bar, not
	// `page.url`: shallow updates like `?view=` live only there)
	$effect(() => {
		writeStoredDelay(localStorage, params.gamePk, delay)

		const url = new URL(location.href)
		const seconds = delay == null ? null : String(Math.round(delay / 1000))
		if (url.searchParams.get(DELAY_PARAM) === seconds) return

		if (seconds == null) url.searchParams.delete(DELAY_PARAM)
		else url.searchParams.set(DELAY_PARAM, seconds)
		untrack(() => goto(url, { shallow: true, replace: true, state: page.state }))
	})

	/** The whole page as of "now − delay", refreshed on the live polling cadence */
	let snapshot = $derived<GameSnapshot | null>(data.snapshot ?? null)

	/** Bumped by every delay change, so a reply for an older delay is dropped */
	let generation = 0

	$effect(() => {
		if (delay == null) return

		const gamePk = params.gamePk
		const ms = delay
		const current = generation
		let busy = false

		async function tick() {
			if (busy) return
			busy = true
			try {
				const next = await fetchGameSnapshot(gamePk, toTimecode(Date.now() - ms), {
					unchangedFrom: untrack(() => snapshot?.timecode),
				})
				if (next && current === generation) {
					snapshot = next
					// Still watching delayed, so keep it saved
					writeStoredDelay(localStorage, gamePk, ms)
				}
			} catch {
				// Keep the last snapshot; the next tick tries again
			} finally {
				busy = false
			}
		}

		tick()
		const timer = setInterval(tick, 3_000)
		return () => clearInterval(timer)
	})

	/** Set while going live reloads the page, which mustn't save the moment it's leaving */
	let goingLive = false

	/** Leaving: save the exact moment on screen, to pick up from there on the way back */
	function saveMoment() {
		if (delay != null && !goingLive) writeStoredDelay(localStorage, params.gamePk, delay)
	}
	beforeNavigate(saveMoment)

	/** Run `ms` behind live, or go live with `null` */
	async function setDelay(ms: number | null) {
		const next = ms != null && ms > 0 ? ms : null
		const current = ++generation
		pinnedAtBatIndex = null

		// Load the moment first, so the page jumps straight to it instead of flashing
		if (next != null) {
			const fresh = await fetchGameSnapshot(params.gamePk, toTimecode(Date.now() - next)).catch(
				() => null,
			)
			if (current !== generation) return
			if (fresh) snapshot = fresh
		}

		hasTimeTraveled = true

		// A page that loaded delayed has no data past the delay; a finished game won't be
		// polled for it either, so load it (which also clears the delay)
		if (next == null && !isGameLive && !data.feedLive) {
			writeStoredDelay(localStorage, params.gamePk, null)
			const url = new URL(location.href)
			url.searchParams.delete(DELAY_PARAM)
			goingLive = true
			return goto(url, { replace: true, reset: false }).finally(() => (goingLive = false))
		}

		delay = next
	}

	/** Delayed, but the moment to show hasn't loaded yet: show nothing that could spoil it */
	const isPending = $derived(isDelayed && !snapshot)

	const game = $derived(
		isDelayed && snapshot && data.game ? gameAsOf(data.game, snapshot) : data.game,
	)

	/** The game as shown, which trails the real one while delayed */
	const isLive = $derived(game?.status?.abstractGameState === 'Live')
	const isFinal = $derived(game?.status?.abstractGameState === 'Final')

	/** Polled only while showing a live game in real time */
	const live = $derived(
		isGameLive && !isDelayed
			? {
					feedLive: fetchfeedLive.live(params.gamePk),
					linescore: fetchLinescore.live(params.gamePk),
					boxscore: fetchBoxscore.live(params.gamePk),
					winProbability: fetchWinProbability.live(params.gamePk),
				}
			: null,
	)

	const [feedLive, linescore, boxscore, winProbability] = $derived(
		isDelayed
			? [
					snapshot?.feedLive,
					snapshot?.feedLive.liveData.linescore,
					snapshot?.boxscore,
					snapshot?.winProbability,
				]
			: // Just back from a delay, the last snapshot stands in until the live data lands
				[
					live?.feedLive.data ?? data.feedLive ?? snapshot?.feedLive,
					live?.linescore.data ??
						data.feedLive?.liveData.linescore ??
						snapshot?.feedLive.liveData.linescore,
					live?.boxscore.data ?? data.boxscore ?? snapshot?.boxscore,
					live?.winProbability.data ?? data.winProbability ?? snapshot?.winProbability,
				],
	)

	/** Every pitch up to the moment on screen, so the picker can't run ahead of it */
	const timeline = $derived(
		pitchTimeline(
			feedLive?.liveData?.plays?.allPlays,
			feedLive?.gameData?.players as Record<string, MLB.Person> | undefined,
		),
	)

	/** Pitches on screen, oldest first */
	const pitchTimes = $derived(pitchStartTimes(feedLive?.liveData?.plays?.allPlays))

	/** Where a step is headed, so quick presses keep stepping before the page catches up */
	let stepTarget: string | null = null

	/** Show the pitch before or after the one on screen; stepping past the last goes live */
	async function stepPitch(step: -1 | 1) {
		const from = stepTarget ?? pitchTimes.at(-1)
		// Later pitches aren't on a delayed page, so look up just their times
		const times =
			step === 1 ? await fetchPitchStartTimes(params.gamePk).catch(() => null) : pitchTimes
		if (!times) return

		const target = adjacentPitch(times, from, step)
		if (!target) {
			if (step === 1) {
				stepTarget = null
				await setDelay(null)
			}
			return
		}

		stepTarget = target
		await setDelay(delaySince(target))
		if (stepTarget === target) stepTarget = null
	}

	/** Once the row has been used, keep it around even if the game is over */
	const gamePk = $derived(params.gamePk)
	let hasTimeTraveled = $derived(!!gamePk && untrack(() => isDelayed))

	const showTimeTravel = $derived(
		!!game && (isGameLive || hasTimeTraveled) && (isDelayed || !!feedLive),
	)

	const [away, home] = $derived([boxscore?.teams.away.team, boxscore?.teams.home.team])
	const date = $derived(
		formatDate(game?.gameDate, { year: 'numeric', month: 'short', day: 'numeric' }),
	)

	const hasTopPerformers = $derived(feedLive?.liveData.boxscore.topPerformers?.length)
	const hasDecisions = $derived(feedLive?.liveData.decisions)
	const hasHomeRuns = $derived(
		feedLive?.liveData.plays.allPlays?.some((play) => play.result?.eventType === 'home_run'),
	)
	const hasReviews = $derived(
		feedLive?.liveData.plays.allPlays?.some(
			(play) =>
				play.playEvents?.some((event) => event.reviewDetails) ||
				/challenged \([^)]+\), call on the field was (confirmed|overturned|upheld)/i.test(
					play.result?.description ?? '',
				),
		),
	)
	const hasBattingOrder = $derived(
		boxscore?.teams.away.battingOrder?.length || boxscore?.teams.home.battingOrder?.length,
	)
	const hasBench = $derived(
		boxscore?.teams.away.bench?.length || boxscore?.teams.home.bench?.length,
	)

	const isSpoilerPrevented = $derived(
		spoilerPreventionStore.has(away?.id!) || spoilerPreventionStore.has(home?.id!),
	)

	const awayTeam = $derived(boxscore?.teams.away.team ?? game?.teams?.away?.team)
	const homeTeam = $derived(boxscore?.teams.home.team ?? game?.teams?.home?.team)

	let hoveredAtBatIndex = $state<number | null>(null)
	let pinnedAtBatIndex = $state<number | null>(null)

	function selectAtBatFromPlay(atBatIndex: number) {
		const allPlays = feedLive?.liveData?.plays?.allPlays ?? []
		const index = allPlays.findIndex((play) => play.about.atBatIndex === atBatIndex)
		if (index === -1) return

		const lastIndex = Math.max(0, allPlays.length - 1)
		const defaultIndex = isFinal ? 0 : lastIndex
		pinnedAtBatIndex = index === defaultIndex ? null : index
	}
</script>

<svelte:window onpagehide={saveMoment} />

<svelte:head>
	<link rel="preconnect" href="https://mlb-cuts-diamond.mlb.com" />

	<!-- A full load lands on the saved moment before anything paints -->
	{#if isGameLive || isGameFinal}
		{@html `<script>${restoreDelayScript(params.gamePk)}<\/script>`}
	{/if}

	{#if awayTeam && homeTeam && game}
		{@html `<script type="application/ld+json">${JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'SportsEvent',
			name: `${awayTeam.name} at ${homeTeam.name}`,
			startDate: game.gameDate,
			...(game.status?.abstractGameState === 'Preview' && {
				eventStatus: 'https://schema.org/EventScheduled',
			}),
			location: { '@type': 'Place', name: game.venue?.name },
			awayTeam: { '@type': 'SportsTeam', name: awayTeam.name },
			homeTeam: { '@type': 'SportsTeam', name: homeTeam.name },
			url: `https://mlb.theohtani.com/game/${game.gamePk}`,
			organizer: { '@type': 'SportsOrganization', name: 'Major League Baseball' },
			sport: 'https://en.wikipedia.org/wiki/Baseball',
		})}<\/script>`}
	{/if}
</svelte:head>

<Metadata
	title="{[away?.clubName, home?.clubName].join(' @ ')} ({date}) | MLB.TheOhtani.com"
	description="Game details for {[away?.name, home?.name].join(' at ')} on {date}"
/>

<Header
	class="max-sm:px-0 max-sm:[&_nav]:pl-ch"
	crumbs={[
		{
			href: `/schedule/week/${formatDate(game?.gameDate, { locale: 'en-CA' })}`,
			name: 'Weekly Schedule',
		},
		{
			href: `/schedule/day/${formatDate(game?.gameDate, { locale: 'en-CA' })}`,
			name: formatDate(game?.gameDate, { weekday: 'short', month: 'short', day: 'numeric' }),
		},
		{ name: `${away?.abbreviation} @ ${home?.abbreviation}` },
	]}
>
	{#if game}
		<Game
			class="w-full"
			{game}
			boxscore={boxscore ?? undefined}
			{linescore}
			feed={isDelayed ? snapshot?.feedLive : undefined}
			concealed={isPending}
			showLiveDetails
		/>
	{/if}
</Header>

{#if showTimeTravel}
	<TimeTravel
		class="border-b border-current/10 dark:border-current/25"
		{timeline}
		{delay}
		value={isDelayed ? (latestPitch(timeline)?.startTime ?? '') : 'live'}
		final={!isDelayed && feedLive?.gameData?.status?.abstractGameState === 'Final'}
		onselect={(startTime) => setDelay(startTime ? delaySince(startTime) : null)}
		onnudge={(ms) => setDelay((delay ?? 0) + ms)}
		onstep={stepPitch}
		canStepBack={pitchTimes.length > 1}
		canStepForward={isDelayed}
	/>
{/if}

<section class="group/game-page grid gap-[2lh] py-lh md:grid-cols-2">
	{#if !isSpoilerPrevented && Array.isArray(winProbability) && (isLive || isFinal)}
		<article
			class="col-span-full grid gap-y-lh lg:h-[14lh] lg:max-h-[14lh] lg:grid-cols-3 lg:*:min-h-0"
		>
			{#if isLive || isFinal}
				<AtBatSequence
					plays={feedLive?.liveData?.plays}
					players={feedLive?.gameData?.players as Record<string, MLB.Person> | undefined}
					status={game?.status}
					uniforms={data.uniforms}
					bind:pinnedIndex={pinnedAtBatIndex}
				/>

				<AllPlays
					class="max-lg:max-h-[14lh]"
					{awayTeam}
					{homeTeam}
					{linescore}
					status={game?.status}
					plays={feedLive?.liveData?.plays}
					onPlayHover={(i) => (hoveredAtBatIndex = i)}
					onPlayClick={selectAtBatFromPlay}
				/>
			{/if}

			{#if Array.isArray(winProbability)}
				<!-- The chart derives its viewBox from its own measured height, so it needs a
				     definite height to size against — `h-full` alone leaves it unbounded here. -->
				<div id="win-probability" class="flex h-full min-h-0 flex-col gap-ch max-lg:h-[8lh]">
					<h2 class="shrink-0 px-ch text-xs text-current/40">Win Probability</h2>
					<WinProbability
						class="min-h-0 grow"
						{winProbability}
						boxscore={boxscore ?? undefined}
						{linescore}
						{hoveredAtBatIndex}
					/>
				</div>
			{/if}
		</article>
	{/if}

	{#if (isLive || isFinal) && !isSpoilerPrevented}
		<Highlights
			class={cn(
				'md:group-has-[#theater-mode:checked]/game-page:col-span-full',
				isFinal && 'order-first',
			)}
			{game}
			content={data.content}
			delayed={isDelayed}
		/>
	{/if}

	{#if game && feedLive}
		<div
			id="game-info"
			class={cn(
				'm-auto px-ch md:group-not-has-[#theater-mode]/game-page:col-span-full md:group-has-[#theater-mode:checked]/game-page:col-span-full',
				isFinal && 'order-first',
			)}
		>
			<!-- A finished series' standings already count this game -->
			<GameData
				{game}
				{feedLive}
				seriesRecord={isDelayed && isGameFinal ? null : data.seriesRecord}
				delayed={isDelayed}
			/>

			<hr class="my-ch border-dashed border-stroke" />

			<menu class="flex items-center justify-center gap-ch">
				<li>
					<ToggleFavorite
						target={{
							href: `/game/${game.gamePk}`,
							label: [
								feedLive.gameData.teams.away.abbreviation,
								feedLive.gameData.teams.home.abbreviation,
							].join(' @ '),
						}}
					>
						Favorite
					</ToggleFavorite>
				</li>
			</menu>
		</div>
	{/if}

	{#if hasBattingOrder || hasBench}
		<Boxscore
			class="col-span-full"
			{boxscore}
			gameDate={game?.gameDate}
			players={feedLive?.gameData?.players as Record<string, MLB.Person> | undefined}
			plays={feedLive?.liveData?.plays?.allPlays}
			scheduledInnings={linescore?.scheduledInnings}
			{isFinal}
			{isSpoilerPrevented}
			onAtBatSelect={selectAtBatFromPlay}
		/>
	{/if}

	{#if !isSpoilerPrevented && feedLive && (hasTopPerformers || hasDecisions || hasReviews)}
		<div
			class="col-span-full flex flex-wrap items-start justify-evenly gap-lh px-[2ch] *:grow *:only:mx-auto *:only:max-w-max"
		>
			{#if hasTopPerformers}
				<TopPerformers {feedLive} />
			{/if}

			{#if hasDecisions}
				<Decision {feedLive} />
			{/if}

			{#if hasReviews}
				<Reviews {feedLive} onAtBatSelect={selectAtBatFromPlay} />
			{/if}
		</div>
	{/if}

	{#if !isSpoilerPrevented && feedLive && hasHomeRuns}
		<HomeRuns class="col-span-full px-[2ch]" {feedLive} />
	{/if}

	{#if game}
		<Umpires
			class="col-span-full"
			gamePk={game.gamePk}
			date={data.schedule?.dates?.[0]?.date}
			officials={boxscore?.officials ?? feedLive?.liveData.boxscore.officials}
			{feedLive}
			{isFinal}
		/>
	{/if}
</section>

<SectionNav />

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));

		/* Land section titles below the sticky header when jumping to them */
		:global([id]) {
			scroll-margin-top: calc(var(--header-height, 0px) + 1ch);
		}
	}
</style>
