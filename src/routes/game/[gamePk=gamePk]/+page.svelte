<script lang="ts">
	import {
		fetchBoxscore,
		fetchfeedLive,
		fetchLinescore,
		fetchWinProbability,
	} from '$lib/fetch/presets'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import AllPlays from '$ui/game/all-plays.svelte'
	import AtBatSequence from '$ui/game/at-bat-sequence.svelte'
	import Boxscore from '$ui/game/boxscore.svelte'
	import Decision from '$ui/game/decision.svelte'
	import GameData from '$ui/game/game-data.svelte'
	import Game from '$ui/game/game.svelte'
	import Highlights from '$ui/game/highlights.svelte'
	import HomeRuns from '$ui/game/home-runs.svelte'
	import Reviews from '$ui/game/reviews.svelte'
	import TopPerformers from '$ui/game/top-performers.svelte'
	import WinProbability from '$ui/game/win-probability.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import type { PageProps } from './$types'

	let { data, params }: PageProps = $props()

	const game = $derived(data.game)

	const isLive = $derived(data.game?.status?.abstractGameState === 'Live')
	const isFinal = $derived(data.game?.status?.abstractGameState === 'Final')

	const [{ data: feedLive }, { data: linescore }, { data: boxscore }, { data: winProbability }] =
		$derived(
			isLive
				? [
						fetchfeedLive.live(params.gamePk),
						fetchLinescore.live(params.gamePk),
						fetchBoxscore.live(params.gamePk),
						fetchWinProbability.live(params.gamePk),
					]
				: [
						{ data: data.feedLive },
						{ data: data.feedLive?.liveData.linescore },
						{ data: data.boxscore },
						{ data: data.winProbability },
					],
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
</script>

<svelte:head>
	<link rel="preconnect" href="https://mlb-cuts-diamond.mlb.com" />

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
		<Game class="w-full" {game} boxscore={boxscore ?? undefined} {linescore} showLiveDetails />
	{/if}
</Header>

<section class="group/game-page grid gap-[2lh] py-lh md:grid-cols-2">
	{#if !isSpoilerPrevented && Array.isArray(winProbability) && (isLive || isFinal)}
		<article
			class="col-span-full grid gap-y-lh lg:grid-cols-3 lg:h-[14lh] lg:max-h-[14lh] lg:*:min-h-0"
		>
			{#if isLive || isFinal}
				<AtBatSequence
					plays={feedLive?.liveData?.plays}
					players={feedLive?.gameData?.players}
				/>

				<AllPlays
					class="max-lg:max-h-[14lh]"
					{awayTeam}
					{homeTeam}
					{linescore}
					status={game?.status}
					plays={feedLive?.liveData?.plays}
					onPlayHover={(i) => (hoveredAtBatIndex = i)}
				/>
			{/if}

			{#if Array.isArray(winProbability)}
				<!-- The chart derives its viewBox from its own measured height, so it needs a
				     definite height to size against — `h-full` alone leaves it unbounded here. -->
				<div class="flex h-full min-h-0 flex-col gap-ch max-lg:h-[8lh]">
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
		/>
	{/if}

	{#if game && feedLive}
		<div
			class={cn(
				'm-auto px-ch md:group-not-has-[#theater-mode]/game-page:col-span-full md:group-has-[#theater-mode:checked]/game-page:col-span-full',
				isFinal && 'order-first',
			)}
		>
			<GameData {game} {feedLive} seriesRecord={data.seriesRecord} />

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

	{#if !isSpoilerPrevented && feedLive && (hasTopPerformers || hasDecisions || hasHomeRuns || hasReviews)}
		<div
			class="col-span-full flex flex-wrap items-start justify-evenly gap-lh px-[2ch] *:grow *:only:mx-auto *:only:max-w-max"
		>
			{#if hasTopPerformers}
				<TopPerformers {feedLive} />
			{/if}

			{#if hasDecisions}
				<Decision {feedLive} />
			{/if}

			{#if hasHomeRuns}
				<HomeRuns {feedLive} />
			{/if}

			{#if hasReviews}
				<Reviews {feedLive} />
			{/if}
		</div>
	{/if}

	{#if hasBattingOrder || hasBench}
		<Boxscore
			class="col-span-full"
			{boxscore}
			gameDate={game?.gameDate}
			players={feedLive?.gameData?.players as Record<string, MLB.Person> | undefined}
			{isSpoilerPrevented}
		/>
	{/if}
</section>

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));
	}
</style>
