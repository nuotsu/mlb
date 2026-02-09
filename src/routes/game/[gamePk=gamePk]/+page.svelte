<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import Boxscore from '$ui/game/boxscore.svelte'
	import Decision from '$ui/game/decision.svelte'
	import GameData from '$ui/game/game-data.svelte'
	import Game from '$ui/game/game.svelte'
	import Highlights from '$ui/game/highlights.svelte'
	import TopPerformers from '$ui/game/top-performers.svelte'
	import WinProbability from '$ui/game/win-probability.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const game = $derived(data.game)
	const feedLive = $derived(data.feedLive)
	const linescore = $derived(feedLive.liveData.linescore)
	const boxscore = $derived(data.boxscore)

	const [away, home] = $derived([boxscore.teams.away.team, boxscore.teams.home.team])
	const date = $derived(
		formatDate(game.gameDate, { year: 'numeric', month: 'short', day: 'numeric' }),
	)

	const hasTopPerformers = $derived(feedLive.liveData.boxscore.topPerformers?.length)
	const hasDecisions = $derived(feedLive.liveData.decisions)
	const hasBattingOrder = $derived(
		boxscore.teams.away.battingOrder?.length || boxscore.teams.home.battingOrder?.length,
	)
</script>

<svelte:head>
	<link rel="preconnect" href="https://mlb-cuts-diamond.mlb.com" />
</svelte:head>

<Metadata
	title="{[away.clubName, home.clubName].join(' @ ')} ({date}) | MLB.TheOhtani.com"
	description="Game details for {[away.name, home.name].join(' at ')} on {date}"
/>

<Header
	class="max-sm:px-0 max-sm:[&_nav]:pl-ch"
	crumbs={[
		{
			href: `/schedule/week/${formatDate(game.gameDate, { locale: 'en-CA' })}`,
			name: 'Weekly Schedule',
		},
		{
			href: `/schedule/day/${formatDate(game.gameDate, { locale: 'en-CA' })}`,
			name: formatDate(game.gameDate, { weekday: 'short', month: 'short', day: 'numeric' }),
		},
		{ name: `${away.abbreviation} @ ${home.abbreviation}` },
	]}
>
	<Game class="w-full" {game} {boxscore} {linescore} />
</Header>

<section class="space-y-lh py-lh">
	{#if hasTopPerformers || hasDecisions}
		<div class="flex flex-wrap items-start gap-ch px-ch *:grow">
			{#if hasTopPerformers}
				<TopPerformers {feedLive} />
			{/if}

			{#if hasDecisions}
				<Decision {feedLive} />
			{/if}
		</div>
	{/if}

	{#if Array.isArray(data.winProbability)}
		<WinProbability winProbability={data.winProbability} {boxscore} {linescore} />
	{/if}

	<article
		class="group/details grid items-center gap-y-lh md:has-[#theater-mode:not(:checked)]:grid-cols-2"
	>
		<Highlights content={data.content} />

		{#if hasBattingOrder}
			<Boxscore {boxscore} />
		{/if}

		<GameData {game} {feedLive} />
	</article>
</section>

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));
	}
</style>
