<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import GameData from '$ui/game/game-data.svelte'
	import Game from '$ui/game/game.svelte'
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

<section class="mx-auto max-w-5xl space-y-ch p-ch">
	<Game {game} {boxscore} {linescore} />
	<GameData {game} {feedLive} />

	{#if Array.isArray(data.winProbability)}
		<WinProbability winProbability={data.winProbability} {boxscore} {linescore} />
	{/if}
</section>
