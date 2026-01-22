<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import Decision from '$ui/game/decision.svelte'
	import GameData from '$ui/game/game-data.svelte'
	import Game from '$ui/game/game.svelte'
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
</script>

<Metadata
	title="{[away.teamName, home.teamName].join(' @ ')} ({date}) | MLB.TheOhtani.com"
	description="Game details for {[away.name, home.name].join(' at ')} on {date}"
/>

<section class="mx-auto max-w-5xl space-y-lh py-ch *:px-ch">
	<Game class="max-sm:px-0" {game} {boxscore} {linescore} />

	<div class="flex flex-wrap gap-ch *:grow">
		{#if feedLive.liveData.boxscore.topPerformers?.length}
			<TopPerformers {feedLive} />
		{/if}

		{#if feedLive.liveData.decisions}
			<Decision {feedLive} />
		{/if}
	</div>

	{#if Array.isArray(data.winProbability)}
		<WinProbability winProbability={data.winProbability} {boxscore} {linescore} />
	{/if}

	<GameData {game} {feedLive} />
</section>
