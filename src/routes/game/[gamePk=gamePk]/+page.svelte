<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import Boxscore from '$ui/game/boxscore.svelte'
	import Decision from '$ui/game/decision.svelte'
	import GameData from '$ui/game/game-data.svelte'
	import Game from '$ui/game/game.svelte'
	import Highlights from '$ui/game/highlights.svelte'
	import TopPerformers from '$ui/game/top-performers.svelte'
	import WinProbability from '$ui/game/win-probability.svelte'
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
	title="{[away.teamName, home.teamName].join(' @ ')} ({date}) | MLB.TheOhtani.com"
	description="Game details for {[away.name, home.name].join(' at ')} on {date}"
/>

<section class="mx-auto max-w-5xl space-y-lh py-ch *:px-ch">
	<Game
		class="sticky top-0 z-1 bg-background/50 backdrop-blur max-sm:px-0"
		{game}
		{boxscore}
		{linescore}
	/>

	{#if hasTopPerformers || hasDecisions}
		<div class="flex flex-wrap gap-ch *:grow">
			{#if hasTopPerformers}
				<TopPerformers {feedLive} />
			{/if}

			<hr class="border-dashed border-current/25 sm:hidden" />

			{#if hasDecisions}
				<Decision {feedLive} />
			{/if}
		</div>
	{/if}

	{#if Array.isArray(data.winProbability)}
		<WinProbability winProbability={data.winProbability} {boxscore} {linescore} />
	{/if}

	<article class="grid items-start gap-ch md:has-[#theater-mode:not(:checked)]:grid-cols-2">
		{#if hasBattingOrder}
			<Boxscore {feedLive} {boxscore} />
		{/if}

		{#if data.content?.media?.epgAlternate}
			<Highlights content={data.content} />
		{/if}

		<GameData {game} {feedLive} />
	</article>
</section>
