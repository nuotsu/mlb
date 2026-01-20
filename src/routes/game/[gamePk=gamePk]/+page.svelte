<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import Game from '$ui/game/game.svelte'
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const game = $derived(data.game)
	const feedLive = $derived(data.feedLive)
	const boxscore = $derived(data.boxscore)
	const linescore = $derived(data.linescore)

	const [away, home] = $derived([boxscore.teams.away.team, boxscore.teams.home.team])
	const date = $derived(
		formatDate(game.gameDate, { year: 'numeric', month: 'short', day: 'numeric' }),
	)
</script>

<Metadata
	title="{[away.teamName, home.teamName].join(' @ ')} ({date})| MLB.TheOhtani.com"
	description="Game details for {[away.name, home.name].join(' at ')} on {date}"
/>

<section class="mx-auto max-w-5xl space-y-ch p-ch">
	<Game {game} {boxscore} {linescore} />

	<dl class="grid grid-cols-[auto_1fr] gap-x-lh">
		{#if game.description}
			<dt>Description</dt>
			<dd>{game.description}</dd>
		{/if}

		<dt>Series</dt>
		<dd>{game.seriesGameNumber} of {game.gamesInSeries}</dd>

		<dt>Venue</dt>
		<dd>{game.venue.name}</dd>

		{#if feedLive.gameData.gameInfo}
			{@const duration = feedLive.gameData.gameInfo.gameDurationMinutes ?? 0}
			{@const hours = Math.floor(duration / 60)}
			{@const remainingMinutes = duration % 60}

			<dt>Attendance</dt>
			<dd>{feedLive.gameData.gameInfo.attendance?.toLocaleString()}</dd>

			<dt>Duration</dt>
			<dd>{hours}h {remainingMinutes}m</dd>

			<dt>Weather</dt>
			<dd>
				{feedLive.gameData.weather?.condition} /
				{feedLive.gameData.weather?.temp}°F /
				{feedLive.gameData.weather?.wind} mph
			</dd>
		{/if}

		<dt>Endpoint</dt>
		<dd>
			<a href="https://statsapi.mlb.com{game.link}">Official</a> |
			<a href={game.link}>Playground</a>
		</dd>
	</dl>
</section>

<style>
	dl a {
		text-decoration: underline dashed;

		&:hover {
			text-decoration-style: solid;
		}
	}
</style>
