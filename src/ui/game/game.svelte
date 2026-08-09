<script lang="ts">
	import { page } from '$app/state'
	import { fetchLiveMLB } from '$lib/fetch/live.svelte'
	import { fetchBoxscore, fetchLinescore } from '$lib/fetch/presets'
	import { cn } from '$lib/utils'
	import Linescore from '$ui/game/linescore.svelte'
	import ProbablePitchers from '$ui/game/probable-pitchers.svelte'
	import TeamScores from '$ui/game/team-scores.svelte'
	import { ChevronRightIcon } from '$ui/icons'
	import Loading from '$ui/loading.svelte'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import BaseRunners from './base-runners.svelte'
	import BSO from './bso.svelte'
	import Matchup from './matchup.svelte'
	import Plays from './plays.svelte'
	import Status from './status.svelte'

	let {
		game,
		boxscore,
		linescore,
		showDescription,
		showLiveDetails,
		seriesRecord,
		class: className = '',
	}: {
		game: MLB.Game
		boxscore?: MLB.Boxscore
		linescore?: MLB.Linescore
		showDescription?: boolean
		showLiveDetails?: boolean
		seriesRecord?: { homeWins: number; awayWins: number } | null
		class?: string
	} = $props()

	const { flags } = $derived(game as unknown as { flags: MLB.GameFlags })

	const isFinal = $derived(game.status.abstractGameState === 'Final')
	const isLive = $derived(game.status.abstractGameState === 'Live')

	const isGamePage = $derived(page.url.pathname === `/game/${game.gamePk}`)

	const isSpoilerPrevented = $derived(
		spoilerPreventionStore.has(game.teams.away.team.id) ||
			spoilerPreventionStore.has(game.teams.home.team.id),
	)

	const { data: liveGame } = $derived(
		isLive
			? fetchLiveMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${game.gamePk}/feed/live`, {
					fields: [
						'gameData,liveData,linescore,boxscore',
						'absChallenges,hasChallenges,usedSuccessful,usedFailed,remaining',
						'fullName,players,stats,pitching,batting,numberOfPitches,summary',
						'teams,away,home,runs,offense,defense,first,second,third',
						'balls,strikes,outs',
						'currentInning,currentInningOrdinal,inningHalf,inningState',
						'plays,currentPlay,result,description,eventType,rbi,about,isScoringPlay',
						'playEvents,isPitch,index,details,type,isBall,isStrike,isInPlay,call,pitchData,startSpeed',
						'reviewDetails,inProgress,challengeTeamId,reviewType',
						'matchup,pitcher,batter,id,lastInitName,pitchHand,batSide,code,onDeck,inHole',
					],
					hydrate: 'flags,linescore',
				})
			: { data: undefined },
	)

	const { data: absFeed } = $derived(
		isFinal && !isSpoilerPrevented
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
				'absolute top-1/2 left-1/2 -z-1 -translate-1/2 has-data-runner-active:z-10',
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
			(!isGamePage || (isGamePage && game.status.abstractGameState === 'Preview')) && 'min-h-rlh',
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

	<div class="relative z-1 has-data-loading:h-full has-data-loading:bg-background" style:grid-area="boxscore">
		{#if boxscore}
			<TeamScores
				{game}
				{boxscore}
				linescore={liveGame?.liveData?.linescore}
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
					linescore={liveGame?.liveData?.linescore}
					{absChallenges}
					{absChallengeTeamId}
					{isSpoilerPrevented}
				/>
			{/await}
		{/if}
	</div>

	{#if (isFinal || isLive) && !isSpoilerPrevented}
		{#if linescore}
			<Linescore {linescore} {game} />
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
		<div
			class="text-center text-xs font-light group-not-hover/game:transition-[translate,opacity] md:group-not-hover/game:-translate-y-full md:group-not-hover/game:opacity-0"
			style:grid-area="link"
		>
			<a
				class="inline-flex h-rlh items-center gap-[.5ch] text-current/50 hover-link hover:text-current"
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
