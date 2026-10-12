<script lang="ts">
	import { isAppleTV } from '#lib/broadcasts.js'
	import { fetchLiveMLB } from '#lib/fetch/live.svelte.js'
	import {
		fetchBoxscore,
		fetchLinescore,
		fetchScorebugAt,
		SCOREBUG_FIELDS,
	} from '#lib/fetch/presets.js'
	import { gameAsOf, readStoredDelay, toTimecode, writeStoredDelay } from '#lib/time-travel.js'
	import { cn } from '#lib/utils.js'
	import Linescore from '#ui/game/linescore.svelte'
	import ProbablePitchers from '#ui/game/probable-pitchers.svelte'
	import TeamScores from '#ui/game/team-scores.svelte'
	import { AppleTVIcon, ChevronRightIcon, HistoryIcon } from '#ui/icons/index.js'
	import Loading from '#ui/loading.svelte'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import { page } from '$app/state'
	import { onMount, untrack } from 'svelte'
	import BaseRunners from './base-runners.svelte'
	import BSO from './bso.svelte'
	import Matchup from './matchup.svelte'
	import Plays from './plays.svelte'
	import Status from './status.svelte'

	let {
		game: scheduled,
		boxscore,
		linescore: scheduledLinescore,
		showDescription,
		showLiveDetails,
		seriesRecord: scheduledSeriesRecord,
		feed: givenFeed,
		concealed: givenConcealed = false,
		class: className = '',
	}: {
		game: MLB.Game
		boxscore?: MLB.Boxscore
		linescore?: MLB.Linescore
		showDescription?: boolean
		showLiveDetails?: boolean
		seriesRecord?: { homeWins: number; awayWins: number } | null
		/** A feed to show instead of polling the live one, like a time-travel snapshot */
		feed?: MLB.LiveGameFeed
		/** Show no scores or live details, as with spoiler prevention, until the moment to show loads */
		concealed?: boolean
		class?: string
	} = $props()

	const isGamePage = $derived(page.url.pathname === `/game/${scheduled.gamePk}`)

	/** Saved delays live in storage, so they're read once hydrated */
	let mounted = $state(false)
	onMount(() => (mounted = true))

	/**
	 * A delay saved on the game's own page (which passes its own `feed`), so this card
	 * trails the stream too instead of showing the live game
	 */
	const savedDelay = $derived(
		mounted && !isGamePage && !givenFeed && scheduled.status.abstractGameState !== 'Preview'
			? readStoredDelay(localStorage, scheduled.gamePk)
			: null,
	)
	const isDelayedCard = $derived(savedDelay != null)

	/** The scorebug as of "now − delay", on the live polling cadence */
	let delayedFeed = $state<MLB.LiveGameFeed>()

	$effect(() => {
		if (savedDelay == null) return

		const gamePk = scheduled.gamePk
		const ms = savedDelay
		let stopped = false
		let busy = false

		async function tick() {
			if (busy) return
			busy = true
			try {
				const next = await fetchScorebugAt(gamePk, toTimecode(Date.now() - ms))
				if (stopped) return
				// Still watching delayed, so the saved moment moves along with this card
				writeStoredDelay(localStorage, gamePk, ms)
				if (next.metaData?.timeStamp !== untrack(() => delayedFeed?.metaData?.timeStamp)) {
					delayedFeed = next
				}
			} catch {
				// Keep the last moment; the next tick tries again
			} finally {
				busy = false
			}
		}

		tick()
		const timer = setInterval(tick, 3_000)
		return () => {
			stopped = true
			clearInterval(timer)
			// Leaving: the game's page picks up from exactly here
			writeStoredDelay(localStorage, gamePk, ms)
		}
	})

	const feed = $derived(givenFeed ?? (isDelayedCard ? delayedFeed : undefined))
	const concealed = $derived(givenConcealed || (isDelayedCard && !delayedFeed))
	const game = $derived(isDelayedCard && delayedFeed ? gameAsOf(scheduled, delayedFeed) : scheduled)
	const linescore = $derived(isDelayedCard ? delayedFeed?.liveData?.linescore : scheduledLinescore)
	// A finished series' standings already count this game
	const seriesRecord = $derived(
		isDelayedCard && scheduled.status.abstractGameState === 'Final' ? null : scheduledSeriesRecord,
	)

	const { flags } = $derived(game as unknown as { flags: MLB.GameFlags })

	const isFinal = $derived(game.status.abstractGameState === 'Final')
	const isLive = $derived(game.status.abstractGameState === 'Live')

	const onAppleTV = $derived(isAppleTV(game))

	const isSpoilerPrevented = $derived(
		concealed ||
			spoilerPreventionStore.has(game.teams.away.team.id) ||
			spoilerPreventionStore.has(game.teams.home.team.id),
	)

	const { data: liveGame } = $derived(
		feed
			? { data: feed }
			: isLive && !concealed
				? fetchLiveMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${game.gamePk}/feed/live`, {
						fields: SCOREBUG_FIELDS,
						hydrate: 'flags,linescore',
					})
				: { data: undefined },
	)

	const { data: absFeed } = $derived(
		isFinal && !feed && !isSpoilerPrevented
			? fetchLiveMLB<Pick<MLB.LiveGameFeed, 'gameData'>>(
					`/api/v1.1/game/${game.gamePk}/feed/live`,
					{
						fields: [
							'gameData,absChallenges,hasChallenges,away,home,usedSuccessful,usedFailed,remaining',
						],
					},
					{ interval: 0 },
				)
			: { data: undefined },
	)

	/** Scores from the feed, or the caller's linescore while the feed (re)loads, like after going live */
	const scoreLinescore = $derived(liveGame?.liveData?.linescore ?? (isLive ? linescore : undefined))

	const absChallenges = $derived(
		liveGame?.gameData?.absChallenges ?? absFeed?.gameData?.absChallenges,
	)

	const absChallengeTeamId = $derived.by(() => {
		const events = liveGame?.liveData?.plays?.currentPlay?.playEvents ?? []
		for (let i = events.length - 1; i >= 0; i--) {
			const details = events[i]?.reviewDetails
			if (details?.inProgress && details.challengeTeamId != null) {
				return details.challengeTeamId
			}
		}
	})
</script>

<article
	class="group/game @container/game isolate grid items-end {className}"
	data-gamePk={game.gamePk}
	data-spoiler-prevented={isSpoilerPrevented || undefined}
	data-time-travel={givenFeed || isDelayedCard ? 'delayed' : mounted ? 'live' : undefined}
>
	<div
		class={cn(
			'relative z-1 m-auto grid w-full text-center *:leading-none group-has-[[style*=linescore]]/game:h-12',
			(isLive || isFinal) && !isSpoilerPrevented && 'max-md:mt-rlh',
		)}
		style:grid-area="status"
	>
		<div
			class={cn(
				'absolute top-1/2 left-1/2 -z-1 -translate-1/2',
				isGamePage &&
					game.status.abstractGameState !== 'Preview' &&
					!isSpoilerPrevented &&
					'md:mt-1',
			)}
		>
			<BaseRunners
				class="w-max"
				linescore={!isSpoilerPrevented ? liveGame?.liveData?.linescore : undefined}
			/>
		</div>

		<Status {game} {liveGame} {linescore} {isSpoilerPrevented} />
	</div>

	<span
		class={cn(
			'group/description grid items-end text-center text-xs font-light *:col-span-full *:row-span-full *:line-clamp-1',
			(!isGamePage || (isGamePage && game.status.abstractGameState === 'Preview') || onAppleTV) &&
				'min-h-rlh',
			onAppleTV && 'px-[4em]',
		)}
		style:grid-area="description"
	>
		{#if !isGamePage && showDescription}
			{#if game.description}
				<span>{game.description}</span>
			{:else if game.seriesGameNumber && game.gamesInSeries && game.gamesInSeries > 1}
				<span class="text-current/50">
					Series {game.seriesGameNumber} of {game.gamesInSeries}
					{#if seriesRecord && seriesRecord.homeWins + seriesRecord.awayWins > 0}
						(Home {seriesRecord.homeWins}-{seriesRecord.awayWins})
					{/if}
				</span>
			{/if}
		{/if}

		{#if !isSpoilerPrevented && (flags?.perfectGame || flags?.noHitter)}
			<strong
				class="border bg-background font-bold text-red-500 group-has-hover/description:hidden"
			>
				{#if flags.perfectGame}
					Perfect game
				{:else if flags.noHitter}
					No-hitter
				{/if}
			</strong>
		{/if}
	</span>

	{#if onAppleTV}
		<span
			class="self-end justify-self-end px-ch text-xs text-[#fff]"
			style:grid-area="description"
			title="Streaming on Apple TV"
		>
			<!-- The glyph's baseline sits 3/24 above the SVG's bottom edge, so drop it by that much. -->
			<AppleTVIcon class="inline-block h-[1em] w-auto align-[-0.125em]" />
		</span>
	{/if}

	<div
		class="relative z-1 has-data-loading:h-full has-data-loading:bg-background"
		style:grid-area="boxscore"
	>
		{#if boxscore}
			<TeamScores
				{game}
				{boxscore}
				linescore={scoreLinescore}
				{absChallenges}
				{absChallengeTeamId}
				{isSpoilerPrevented}
			/>
		{:else}
			{#await fetchBoxscore(game.gamePk)}
				<Loading class="h-full justify-center" data-loading>Loading...</Loading>
			{:then data}
				<TeamScores
					{game}
					boxscore={data}
					linescore={scoreLinescore}
					{absChallenges}
					{absChallengeTeamId}
					{isSpoilerPrevented}
				/>
			{/await}
		{/if}
	</div>

	{#if (isFinal || isLive) && !isSpoilerPrevented}
		{#if linescore}
			<Linescore {linescore} {game} poll={!feed} />
		{:else}
			{#await fetchLinescore(game.gamePk) then data}
				<Linescore linescore={data} {game} />
			{/await}
		{/if}
	{:else if game.status.abstractGameState === 'Preview' || isSpoilerPrevented}
		<ProbablePitchers {game} />
	{/if}

	{#if showLiveDetails && isLive && linescore && !isSpoilerPrevented}
		<BSO linescore={liveGame?.liveData?.linescore} className="mx-auto text-xs mt-ch" />
		<Matchup {liveGame} />
		<Plays {liveGame} />
	{/if}

	{#if !isGamePage}
		<div class="flex items-center justify-center gap-ch text-xs font-light" style:grid-area="link">
			<!-- Always shown, unlike the link, so a card running behind live never passes for live -->
			{#if isDelayedCard}
				<span
					class="inline-flex h-rlh items-center gap-[.5ch] text-yellow-600 dark:text-yellow-300"
				>
					<HistoryIcon class="size-[1.2em]" aria-hidden="true" />
					Delayed
				</span>
			{/if}

			<a
				class="inline-flex h-rlh items-center gap-[.5ch] text-current/50 hover-link group-not-hover/game:transition-[translate,opacity] hover:text-current md:group-not-hover/game:-translate-y-full md:group-not-hover/game:opacity-0"
				href="/game/{game.gamePk}"
			>
				See details
				<ChevronRightIcon class="size-lh" />
			</a>
		</div>
	{/if}
</article>

<style>
	article {
		--status-size: 5ch;

		grid-template:
			'. description' auto
			'status boxscore' auto
			'. pregame' auto
			'. link' auto / var(--status-size) 1fr;

		&:global(:has([style*='linescore'])) {
			grid-template:
				'. description linescore' auto
				'status boxscore linescore' auto
				'bso matchup plays' auto
				'. link link' auto / var(--status-size) 1fr minmax(18ch, 57%);

			@media (width < 32rem) {
				grid-template:
					'. description description' auto
					'status boxscore linescore' auto
					'bso matchup matchup' auto
					'bso plays plays' auto
					'. link link' auto / var(--status-size) minmax(5.5ch, 1fr) 57%;
			}
		}
	}
</style>
